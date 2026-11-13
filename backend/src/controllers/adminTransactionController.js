import prisma from '../config/prisma.js';

export class AdminTransactionController {
  static async listTransactions(req, res, next) {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const skip = (page - 1) * limit;
      const { q, type, startDate, endDate } = req.query;

      const where = {};

      if (type && ['WELCOME_GRANT', 'TOPUP', 'DEDUCTION', 'REFUND'].includes(type)) {
        where.type = type;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate && !isNaN(new Date(startDate).getTime())) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate && !isNaN(new Date(endDate).getTime())) {
          where.createdAt.lte = new Date(endDate);
        }
        if (Object.keys(where.createdAt).length === 0) {
          delete where.createdAt;
        }
      }

      if (q && q.trim()) {
        const queryTerm = q.trim();
        where.OR = [
          { description: { contains: queryTerm, mode: 'insensitive' } },
          { referenceId: { contains: queryTerm, mode: 'insensitive' } },
          { user: { name: { contains: queryTerm, mode: 'insensitive' } } },
          { user: { email: { contains: queryTerm, mode: 'insensitive' } } }
        ];
      }

      const [transactions, total, circSum, purchaseSum, burnSum, grantSum] = await Promise.all([
        prisma.tokenTransaction.findMany({
          where,
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true, status: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.tokenTransaction.count({ where }),
        // Macro metric 1: Total in circulation (excluding admin accounts)
        prisma.wallet.aggregate({
          where: { user: { role: 'AUDIO_ENGINEER' } },
          _sum: { balance: true }
        }),
        // Macro metric 2: Total purchased (TOPUP)
        prisma.tokenTransaction.aggregate({
          where: { type: 'TOPUP' },
          _sum: { amount: true }
        }),
        // Macro metric 3: Total burned (DEDUCTION)
        prisma.tokenTransaction.aggregate({
          where: { type: 'DEDUCTION' },
          _sum: { amount: true }
        }),
        // Macro metric 4: Total grants (WELCOME_GRANT)
        prisma.tokenTransaction.aggregate({
          where: { type: 'WELCOME_GRANT' },
          _sum: { amount: true }
        })
      ]);

      const totalPages = Math.ceil(total / limit) || 1;

      return res.json({
        transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages
        },
        metrics: {
          totalInCirculation: circSum?._sum?.balance || 0,
          totalPurchased: purchaseSum?._sum?.amount || 0,
          totalBurned: Math.abs(burnSum?._sum?.amount || 0),
          totalGrants: grantSum?._sum?.amount || 0
        }
      });
    } catch (err) {
      next(err);
    }
  }
}
