import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { createTestUser, cleanupTestData, TEST_EMAIL_DOMAIN } from './helpers/testDb.js';

describe('Phase T2: Virtual Wallet, Daily Claim & Midtrans Payment Gateway (UC-06, UC-07, UC-08)', () => {
  let userFixture;
  let userJwtToken;

  before(async () => {
    await cleanupTestData();

    // Create an isolated hermetic test user with initial balance 5
    userFixture = await createTestUser({
      name: 'Wallet & Ledger Tester',
      email: `wallet-tester-${Date.now()}${TEST_EMAIL_DOMAIN}`,
      password: 'ProWallet2026!',
      balance: 5
    });

    userJwtToken = jwt.sign(
      { userId: userFixture.user.id, role: userFixture.user.role },
      process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
      { expiresIn: '7d' }
    );
  });

  after(async () => {
    await cleanupTestData();
  });

  // ==========================================
  // SECTION 1: NEGATIVE & ANTI-FRAUD TESTS FIRST
  // ==========================================
  describe('1. Negative, Anti-Fraud & Tampering Tests (Happy Path Last)', () => {
    it('NV-01: harus menolak topup dengan jumlah token non-positif (amount <= 0) (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/wallet/topup')
        .set('Authorization', `Bearer ${userJwtToken}`)
        .send({ amount: -10, packageId: 'PKG-10' });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /jumlah token tidak valid/i);
    });

    it('NV-02: harus menolak checkout dengan packageId yang tidak valid / fiktif (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/payments/checkout')
        .set('Authorization', `Bearer ${userJwtToken}`)
        .send({ packageId: 'PKG-FIKTIF-9999' });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /paket token tidak valid/i);
    });

    it('NV-03: harus menolak webhook Midtrans tanpa order_id (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .send({
          transaction_status: 'settlement',
          gross_amount: '50000'
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /payload webhook tidak valid/i);
    });

    it('NV-04: harus menolak webhook dengan order_id yang tidak terdaftar di sistem (404 Not Found)', async () => {
      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .send({
          order_id: 'POLARIS-NONEXISTENT-ORDER-999',
          transaction_status: 'settlement',
          gross_amount: '50000'
        });

      assert.equal(res.status, 404);
      assert.match(res.body.error, /order tidak ditemukan/i);
    });

    it('NV-05: Anti-Tampering: harus menolak webhook jika gross_amount dimanipulasi berbeda dari harga order (400)', async () => {
      // 1. Buat order sah terlebih dahulu
      const checkoutRes = await request(app)
        .post('/api/v1/payments/checkout')
        .set('Authorization', `Bearer ${userJwtToken}`)
        .send({ packageId: 'PKG-25' }); // Harga sah: Rp 50.000

      assert.equal(checkoutRes.status, 201);
      const orderId = checkoutRes.body.orderId;

      // 2. Kirim webhook dengan gross_amount yang dimanipulasi (misal diubah jadi Rp 10.000)
      const tamperedRes = await request(app)
        .post('/api/v1/payments/webhook')
        .send({
          order_id: orderId,
          transaction_status: 'settlement',
          gross_amount: '10000', // Mismatch!
          status_code: '200'
        });

      assert.equal(tamperedRes.status, 400);
      assert.match(tamperedRes.body.error, /tidak sesuai dengan total tagihan order/i);

      // Verifikasi status order di DB tetap PENDING (tidak terbobol)
      const dbOrder = await prisma.tokenOrder.findUnique({ where: { id: orderId } });
      assert.equal(dbOrder.status, 'PENDING');
    });

    it('NV-06: Anti-Abuse / Double-Claim: harus menolak klaim harian kedua pada hari kalender yang sama (400)', async () => {
      // Klaim pertama (harus berhasil)
      const firstClaimRes = await request(app)
        .post('/api/v1/wallet/claim-daily')
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(firstClaimRes.status, 200);
      assert.match(firstClaimRes.body.message, /2 token gratis harian/i);

      // Klaim kedua seketika (harus ditolak anti-abuse)
      const secondClaimRes = await request(app)
        .post('/api/v1/wallet/claim-daily')
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(secondClaimRes.status, 400);
      assert.match(secondClaimRes.body.error, /sudah mengklaim jatah token gratis untuk hari ini/i);
    });
  });

  // ==========================================
  // SECTION 2: SECURITY & BOUNDARY EDGE CASES
  // ==========================================
  describe('2. Security & Boundary Edge Cases', () => {
    it('ED-01: harus menolak akses ke endpoint dompet (/api/v1/wallet/details) tanpa token (401)', async () => {
      const res = await request(app).get('/api/v1/wallet/details');
      assert.equal(res.status, 401);
      assert.match(res.body.error, /token tidak disertakan/i);
    });

    it('ED-02: harus menolak akses ke endpoint checkout (/api/v1/payments/checkout) tanpa token (401)', async () => {
      const res = await request(app)
        .post('/api/v1/payments/checkout')
        .send({ packageId: 'PKG-10' });
      assert.equal(res.status, 401);
    });

    it('ED-03: Replay Attack / Idempotency: webhook settlement berulang pada order yang sudah PAID tidak boleh menggandakan saldo token (200 Idempotent)', async () => {
      // 1. Buat order baru
      const checkoutRes = await request(app)
        .post('/api/v1/payments/checkout')
        .set('Authorization', `Bearer ${userJwtToken}`)
        .send({ packageId: 'PKG-10' }); // 10 tokens, Rp 25.000

      const orderId = checkoutRes.body.orderId;

      // 2. Eksekusi webhook sukses pertama
      const webhook1 = await request(app)
        .post('/api/v1/payments/webhook')
        .send({
          order_id: orderId,
          transaction_status: 'settlement',
          gross_amount: '25000',
          status_code: '200'
        });
      assert.equal(webhook1.status, 200);

      // Cek saldo setelah settlement pertama
      const walletAfterFirst = await prisma.wallet.findUnique({
        where: { userId: userFixture.user.id }
      });
      const expectedBalance = walletAfterFirst.balance;

      // 3. Replay attack: kirim webhook yang sama persis untuk kedua kalinya
      const webhook2 = await request(app)
        .post('/api/v1/payments/webhook')
        .send({
          order_id: orderId,
          transaction_status: 'settlement',
          gross_amount: '25000',
          status_code: '200'
        });

      assert.equal(webhook2.status, 200);
      assert.match(webhook2.body.message, /sudah diproses sebelumnya/i);

      // Saldo di DB tidak boleh bertambah lagi!
      const walletAfterReplay = await prisma.wallet.findUnique({
        where: { userId: userFixture.user.id }
      });
      assert.equal(walletAfterReplay.balance, expectedBalance);
    });

    it('ED-04: harus mengembalikan 404 ketika memeriksa status order yang tidak ada di database', async () => {
      const res = await request(app)
        .get('/api/v1/payments/orders/ORDER-UNKNOWN-123/status')
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(res.status, 404);
      assert.match(res.body.error, /order tidak ditemukan/i);
    });
  });

  // ==========================================
  // SECTION 3: HAPPY PATH VERIFICATION LAST
  // ==========================================
  describe('3. Happy Path Functional Verification (Last)', () => {
    it('HP-01: harus mengembalikan daftar paket token studio resmi yang valid (UC-07)', async () => {
      const res = await request(app)
        .get('/api/v1/payments/packages')
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.packages));
      assert.equal(res.body.packages.length, 3);

      const pkg25 = res.body.packages.find((p) => p.id === 'PKG-25');
      assert.ok(pkg25);
      assert.equal(pkg25.tokens, 25);
      assert.equal(pkg25.priceIdr, 50000);
    });

    let checkoutOrderId;
    it('HP-02: harus berhasil menginisialisasi checkout paket token dan menghasilkan Snap token (UC-07)', async () => {
      const res = await request(app)
        .post('/api/v1/payments/checkout')
        .set('Authorization', `Bearer ${userJwtToken}`)
        .send({ packageId: 'PKG-60' }); // 60 Token, Rp 100.000

      assert.equal(res.status, 201);
      assert.equal(res.body.message, 'Order berhasil dibuat');
      assert.ok(res.body.orderId);
      assert.ok(res.body.snapToken);
      assert.ok(res.body.redirectUrl);
      assert.equal(res.body.package.tokens, 60);

      checkoutOrderId = res.body.orderId;

      // Verifikasi di basis data: order berstatus PENDING
      const dbOrder = await prisma.tokenOrder.findUnique({ where: { id: checkoutOrderId } });
      assert.equal(dbOrder.status, 'PENDING');
      assert.equal(dbOrder.priceIdr, 100000);
      assert.equal(dbOrder.tokenAmount, 60);
    });

    it('HP-03: harus berhasil mengonfirmasi pembayaran via webhook Midtrans, mengkreditkan 60 token, dan mencatat ledger (UC-07 & UC-08)', async () => {
      const balanceBefore = (
        await prisma.wallet.findUnique({ where: { userId: userFixture.user.id } })
      ).balance;

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .send({
          order_id: checkoutOrderId,
          status_code: '200',
          gross_amount: '100000',
          transaction_status: 'settlement',
          payment_type: 'qris_sandbox'
        });

      assert.equal(res.status, 200);
      assert.match(res.body.message, /pembayaran berhasil dikonfirmasi/i);

      // Verifikasi status order di DB berubah jadi PAID
      const updatedOrder = await prisma.tokenOrder.findUnique({ where: { id: checkoutOrderId } });
      assert.equal(updatedOrder.status, 'PAID');
      assert.ok(updatedOrder.paidAt);

      // Verifikasi saldo dompet bertambah tepat 60 token
      const balanceAfter = (
        await prisma.wallet.findUnique({ where: { userId: userFixture.user.id } })
      ).balance;
      assert.equal(balanceAfter, balanceBefore + 60);

      // Verifikasi catatan transaksi append-only di tabel token_transactions
      const tx = await prisma.tokenTransaction.findFirst({
        where: { referenceId: checkoutOrderId }
      });
      assert.ok(tx);
      assert.equal(tx.amount, 60);
      assert.equal(tx.type, 'TOPUP');
    });

    it('HP-04: harus dapat memuat informasi saldo dompet dan seluruh riwayat mutasi transaksi (UC-06 & UC-08)', async () => {
      const res = await request(app)
        .get('/api/v1/wallet/details')
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.balance > 0);
      assert.ok(Array.isArray(res.body.transactions));
      assert.ok(res.body.transactions.length >= 2); // Welcome Grant + Daily Claim + Topup

      // Pastikan transaksi topup tercantum
      const topupTx = res.body.transactions.find((t) => t.type === 'TOPUP');
      assert.ok(topupTx);
      assert.equal(topupTx.amount, 60);
    });
  });
});
