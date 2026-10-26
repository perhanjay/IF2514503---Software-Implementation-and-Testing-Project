import prisma from '../config/prisma.js';

export class WalletService {
  /**
   * Mengambil saldo wallet dan ringkasan transaksi
   */
  static async getWalletDetails(userId) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });
    return wallet;
  }

  /**
   * Menambahkan saldo token (Credit) secara ACID Transaction
   */
  static async creditToken(userId, amount, type, description, referenceId = null) {
    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error('Dompet tidak ditemukan');

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount } }
      });

      const txRecord = await tx.tokenTransaction.create({
        data: {
          userId,
          walletId: wallet.id,
          amount,
          type,
          description,
          referenceId
        }
      });

      return { wallet: updatedWallet, transaction: txRecord };
    });
  }

  /**
   * Memotong saldo token (Debit) secara ACID Transaction
   */
  static async debitToken(userId, amount, type, description, referenceId = null) {
    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error('Dompet tidak ditemukan');
      if (wallet.balance < amount) {
        throw new Error('Saldo token tidak mencukupi');
      }

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } }
      });

      const txRecord = await tx.tokenTransaction.create({
        data: {
          userId,
          walletId: wallet.id,
          amount: -amount,
          type,
          description,
          referenceId
        }
      });

      return { wallet: updatedWallet, transaction: txRecord };
    });
  }

  /**
   * Klaim Token Harian (Daily Grant UC-09 / Row 113)
   */
  static async claimDailyTokens(userId) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const alreadyClaimed = await prisma.tokenTransaction.findFirst({
      where: {
        userId,
        OR: [
          { description: '[Klaim Harian] Jatah Token Gratis' },
          { description: 'DAILY_FREE_CLAIM' },
          { description: { contains: 'Klaim Harian' } }
        ],
        createdAt: { gte: cutoff }
      }
    });

    if (alreadyClaimed) {
      throw new Error('Anda sudah mengklaim jatah token gratis untuk hari ini');
    }

    return await this.creditToken(
      userId,
      2,
      'WELCOME_GRANT',
      '[Klaim Harian] Jatah Token Gratis'
    );
  }
}
