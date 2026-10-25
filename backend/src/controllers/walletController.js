import { WalletService } from '../services/walletService.js';

export class WalletController {
  /**
   * UC-06: Memeriksa Saldo Token & Riwayat Transaksi
   */
  static async getDetails(req, res) {
    try {
      const details = await WalletService.getWalletDetails(req.user.id);
      return res.json(details);
    } catch (err) {
      console.error('[Wallet Details Error]', err);
      return res.status(500).json({ error: 'Gagal memuat informasi dompet token' });
    }
  }

  /**
   * UC-07: Pembelian Paket Token (Simulasi Payment Gateway / Internal Admin)
   */
  static async topup(req, res) {
    try {
      const { amount, packageId } = req.body;
      const tokenAmount = Number(amount);

      if (!tokenAmount || tokenAmount <= 0) {
        return res.status(400).json({ error: 'Jumlah token tidak valid' });
      }

      // Proteksi Row 80: Endpoint top-up langsung dilarang untuk user biasa
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({
          error: 'Akses ditolak: Endpoint top-up langsung hanya dapat diakses oleh administrator internal. Silakan lakukan pembayaran resmi via Midtrans.'
        });
      }

      // Simulasi checkout & payment approval berhasil
      const result = await WalletService.creditToken(
        req.user.id,
        tokenAmount,
        'TOPUP',
        `Pembelian Paket Token (${packageId || 'CUSTOM'})`,
        `INV-${Date.now()}`
      );

      return res.status(200).json({
        message: `Pembelian ${tokenAmount} token berhasil ditambahkan ke dompet Anda`,
        wallet: result.wallet,
        transaction: result.transaction
      });
    } catch (err) {
      console.error('[Wallet Topup Error]', err);
      return res.status(500).json({ error: 'Gagal memproses transaksi pembelian token' });
    }
  }

  /**
   * UC-09: Mengklaim Jatah Token Gratis
   */
  static async claimDaily(req, res) {
    try {
      // Proteksi Row 78: Pengguna tamu dilarang klaim harian
      if (req.user?.isGuest) {
        return res.status(403).json({ error: 'Akun tamu tidak dapat mengklaim jatah token harian' });
      }

      const result = await WalletService.claimDailyTokens(req.user.id);
      return res.status(200).json({
        message: 'Selamat! Jatah 2 token gratis harian telah ditambahkan ke dompet Anda',
        wallet: result.wallet,
        transaction: result.transaction
      });
    } catch (err) {
      console.error('[Claim Daily Error]', err);
      const isAlreadyClaimed = err.message?.includes('sudah mengklaim');
      return res.status(isAlreadyClaimed ? 400 : 500).json({
        error: err.message || 'Gagal mengklaim token harian'
      });
    }
  }
}
