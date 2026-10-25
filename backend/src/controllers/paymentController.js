import crypto from 'crypto';
import prisma from '../config/prisma.js';
import { snap, TOKEN_PACKAGES } from '../config/midtrans.js';
import { WalletService } from '../services/walletService.js';

export class PaymentController {
  /**
   * Mengambil daftar paket token yang tersedia
   */
  static async getPackages(req, res) {
    return res.json({
      packages: TOKEN_PACKAGES
    });
  }

  /**
   * Checkout Order & Penerbitan Midtrans Snap Token (UC-07)
   */
  static async checkout(req, res) {
    try {
      const { packageId } = req.body;
      const pkg = TOKEN_PACKAGES.find(p => p.id === packageId);

      if (!pkg) {
        return res.status(400).json({ error: 'Paket token tidak valid' });
      }

      const orderId = `POLARIS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // 1. Simpan order ke database status PENDING
      const order = await prisma.tokenOrder.create({
        data: {
          id: orderId,
          userId: req.user.id,
          packageId: pkg.id,
          tokenAmount: pkg.tokens,
          priceIdr: pkg.priceIdr,
          status: 'PENDING'
        }
      });

      // 2. Request Midtrans Snap Transaction
      let snapToken = null;
      let snapRedirectUrl = null;

      try {
        const parameter = {
          transaction_details: {
            order_id: order.id,
            gross_amount: pkg.priceIdr
          },
          customer_details: {
            first_name: req.user.name,
            email: req.user.email
          },
          item_details: [{
            id: pkg.id,
            price: pkg.priceIdr,
            quantity: 1,
            name: `${pkg.tokens} Token Polaris Audio`
          }]
        };

        const transaction = await snap.createTransaction(parameter);
        snapToken = transaction.token;
        snapRedirectUrl = transaction.redirect_url;

        // Update snap details ke order
        await prisma.tokenOrder.update({
          where: { id: order.id },
          data: { snapToken, snapRedirectUrl }
        });
      } catch (gatewayErr) {
        console.warn('[Midtrans Gateway Sandbox Notice]:', gatewayErr.message);
        // Fallback demo snap token jika sandbox key placeholder
        snapToken = `DEMO-SNAP-TOKEN-${order.id}`;
        snapRedirectUrl = `https://app.sandbox.midtrans.com/snap/v2/vtweb/${snapToken}`;
        await prisma.tokenOrder.update({
          where: { id: order.id },
          data: { snapToken, snapRedirectUrl }
        });
      }

      return res.status(201).json({
        message: 'Order berhasil dibuat',
        orderId: order.id,
        snapToken,
        redirectUrl: snapRedirectUrl,
        package: pkg
      });
    } catch (err) {
      console.error('[Payment Checkout Error]', err);
      return res.status(500).json({ error: 'Gagal membuat tagihan pembayaran' });
    }
  }

  /**
   * Webhook Listener Midtrans (FR-7.4 & UC-07 Fase 3)
   */
  static async handleWebhook(req, res) {
    try {
      const {
        order_id,
        status_code,
        gross_amount,
        signature_key,
        transaction_status,
        payment_type,
        fraud_status
      } = req.body;

      if (!order_id) {
        return res.status(400).json({ error: 'Payload webhook tidak valid' });
      }

      const order = await prisma.tokenOrder.findUnique({
        where: { id: order_id }
      });

      if (!order) {
        return res.status(404).json({ error: 'Order tidak ditemukan' });
      }

      // Validasi Signature Key jika signature_key disertakan (Row 110)
      const serverKey = process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-DemoPolarisAudioKey123';
      if (signature_key) {
        const expectedSignature = crypto
          .createHash('sha512')
          .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
          .digest('hex');

        if (signature_key !== expectedSignature) {
          return res.status(401).json({ error: 'Signature key tidak valid (Invalid signature key)' });
        }
      }

      // Validasi nominal gross_amount terhadap tagihan order asli (Anti-Tampering)
      if (gross_amount && Math.round(parseFloat(gross_amount)) !== order.priceIdr) {
        return res.status(400).json({ error: 'Nominal pembayaran tidak sesuai dengan total tagihan order' });
      }

      // Cek apakah order sudah diselesaikan sebelumnya (Idempotency Guard)
      if (order.status === 'PAID') {
        return res.status(200).json({ message: 'Order sudah diproses sebelumnya' });
      }

      const isSuccess =
        transaction_status === 'capture' ||
        transaction_status === 'settlement' ||
        (fraud_status && fraud_status === 'accept');

      if (isSuccess) {
        // Atomic ACID Transaction: Update order & kreditkan saldo token
        await prisma.$transaction(async (tx) => {
          await tx.tokenOrder.update({
            where: { id: order.id },
            data: {
              status: 'PAID',
              paymentType: payment_type || 'MIDTRANS_SANDBOX',
              paidAt: new Date()
            }
          });

          const wallet = await tx.wallet.findUnique({ where: { userId: order.userId } });
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: order.tokenAmount } }
          });

          await tx.tokenTransaction.create({
            data: {
              userId: order.userId,
              walletId: wallet.id,
              amount: order.tokenAmount,
              type: 'TOPUP',
              description: `Pembelian Berhasil (${order.packageId}) via Midtrans`,
              referenceId: order.id
            }
          });
        });

        console.log(`[Webhook Success] Order ${order.id} PAID. Credited ${order.tokenAmount} tokens.`);
        return res.status(200).json({ message: 'Pembayaran berhasil dikonfirmasi' });
      } else if (transaction_status === 'expire' || transaction_status === 'cancel') {
        await prisma.tokenOrder.update({
          where: { id: order.id },
          data: { status: 'EXPIRED' }
        });
        return res.status(200).json({ message: 'Order kedaluwarsa atau dibatalkan' });
      }

      return res.status(200).json({ message: 'Status transaksi dicatat' });
    } catch (err) {
      console.error('[Payment Webhook Error]', err);
      return res.status(500).json({ error: 'Gagal memproses webhook pembayaran' });
    }
  }

  /**
   * Cek Status Order Terkini (Polling / Callback)
   */
  static async getOrderStatus(req, res) {
    try {
      const { id } = req.params;
      const order = await prisma.tokenOrder.findUnique({
        where: { id }
      });

      if (!order) {
        return res.status(404).json({ error: 'Order tidak ditemukan' });
      }

      // Proteksi IDOR (Row 96): Pengguna hanya boleh melihat order miliknya sendiri
      if (order.userId !== req.user.id && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Akses ditolak: Anda tidak memiliki izin untuk melihat pesanan ini' });
      }

      return res.json(order);
    } catch (err) {
      return res.status(500).json({ error: 'Gagal memuat status order' });
    }
  }
}
