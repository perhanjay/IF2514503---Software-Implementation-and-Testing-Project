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
   * UC-07: Pembelian Paket Token (Simulasi Payment Gateway)
   */
  static async topup(req, res) {
    try {
      const { amount, packageId } = req.body;
      const tokenAmount = Number(amount);

      if (!tokenAmount || tokenAmount <= 0) {
        return res.status(400).json({ error: 'Jumlah token tidak valid' });
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
      const result = await WalletService.claimDailyTokens(req.user.id);
      return res.status(200).json({
        message: 'Selamat! Jatah 2 token gratis harian telah ditambahkan ke dompet Anda',
        wallet: result.wallet,
        transaction: result.transaction
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
}
