import prisma from '../config/prisma.js';

export class AdminUserController {
  /**
   * GET /api/v1/admin/users
   * Lists users with search, role/status filtering, pagination, and global summary stats.
   */
  static async listUsers(req, res, next) {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const skip = (page - 1) * limit;

      const { q, role, status, sortBy, order } = req.query;

      const where = {};

      // Text search by name or email (case-insensitive)
      if (q && q.trim()) {
        const searchTerm = q.trim();
        where.OR = [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { email: { contains: searchTerm, mode: 'insensitive' } }
        ];
      }

      // Role filter
      if (role && role !== 'ALL' && ['AUDIO_ENGINEER', 'ADMIN'].includes(role)) {
        where.role = role;
      }

      // Status filter
      if (status && status !== 'ALL' && ['ACTIVE', 'SUSPENDED'].includes(status)) {
        where.status = status;
      }

      // Sorting
      const orderDirection = order === 'asc' ? 'asc' : 'desc';
      let orderBy;
      if (sortBy === 'balance') {
        orderBy = { wallet: { balance: orderDirection } };
      } else if (sortBy === 'name') {
        orderBy = { name: orderDirection };
      } else {
        orderBy = { createdAt: orderDirection };
      }

      // Execute queries in parallel for high throughput
      const [total, users, totalUsers, activeEngineers, suspendedAccounts] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            statusReason: true,
            createdAt: true,
            updatedAt: true,
            wallet: {
              select: {
                balance: true
              }
            },
            _count: {
              select: {
                sessions: true
              }
            }
          },
          orderBy,
          skip,
          take: limit
        }),
        prisma.user.count(),
        prisma.user.count({ where: { role: 'AUDIO_ENGINEER', status: 'ACTIVE' } }),
        prisma.user.count({ where: { status: 'SUSPENDED' } })
      ]);

      const totalPages = Math.ceil(total / limit) || 1;

      const normalizedUsers = users.map(user => ({
        ...user,
        wallet: user.wallet || { balance: 0 }
      }));

      return res.json({
        users: normalizedUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages
        },
        stats: {
          totalUsers,
          activeEngineers,
          suspendedAccounts
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/users/:id
   * Returns complete user details including wallet, last 20 transactions, and session stats.
   */
  static async getUserDetail(req, res, next) {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          statusReason: true,
          createdAt: true,
          updatedAt: true,
          wallet: {
            select: {
              id: true,
              balance: true
            }
          },
          transactions: {
            select: {
              id: true,
              amount: true,
              type: true,
              description: true,
              referenceId: true,
              createdAt: true
            },
            orderBy: { createdAt: 'desc' },
            take: 20
          }
        }
      });

      if (!user) {
        return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      }

      // Compute session counts for audio support context
      const [totalSessions, successfulSessions, failedSessions] = await Promise.all([
        prisma.session.count({ where: { userId: id } }),
        prisma.session.count({
          where: {
            userId: id,
            status: { in: ['READY', 'REPAIRED'] }
          }
        }),
        prisma.session.count({
          where: {
            userId: id,
            status: 'FAILED'
          }
        })
      ]);

      return res.json({
        user: {
          ...user,
          wallet: user.wallet || { balance: 0 },
          transactions: user.transactions || [],
          sessionStats: {
            total: totalSessions,
            successful: successfulSessions,
            failed: failedSessions
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

export default AdminUserController;
