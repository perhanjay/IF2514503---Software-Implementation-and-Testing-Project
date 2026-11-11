import prisma from '../config/prisma.js';
import TokenRevocationService from '../services/tokenRevocationService.js';
import { WalletService } from '../services/walletService.js';

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

  /**
   * PATCH /api/v1/admin/users/:id/role
   * Promotes or demotes user role between AUDIO_ENGINEER and ADMIN.
   * Prevents self-demotion by current admin.
   */
  static async updateRole(req, res, next) {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!role || !['AUDIO_ENGINEER', 'ADMIN'].includes(role)) {
        return res.status(400).json({ error: 'Peran tidak valid. Harus AUDIO_ENGINEER atau ADMIN' });
      }

      if (req.user.id === id && role !== 'ADMIN') {
        return res.status(400).json({ error: 'Tidak dapat mengubah peran akun Anda sendiri' });
      }

      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true }
      });

      if (!existingUser) {
        return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { role },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          statusReason: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return res.json({
        message: 'Peran pengguna berhasil diperbarui',
        user: updatedUser
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/admin/users/:id/status
   * Activates or suspends a user account.
   * Prevents self-suspension and immediately revokes sessions upon suspension.
   */
  static async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;

      if (!status || !['ACTIVE', 'SUSPENDED'].includes(status)) {
        return res.status(400).json({ error: 'Status tidak valid. Harus ACTIVE atau SUSPENDED' });
      }

      if (req.user.id === id && status === 'SUSPENDED') {
        return res.status(400).json({ error: 'Tidak dapat menangguhkan akun Anda sendiri' });
      }

      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true }
      });

      if (!existingUser) {
        return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      }

      if (status === 'SUSPENDED') {
        await TokenRevocationService.revokeUserTokens(id);
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          status,
          statusReason: req.body.reason || null
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          statusReason: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return res.json({
        message: 'Status pengguna berhasil diperbarui',
        user: updatedUser
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/users/:id/tokens
   * Adjusts user token balance via atomic ledger transaction (TOPUP, REFUND, DEDUCTION).
   */
  static async adjustTokens(req, res, next) {
    try {
      const { id } = req.params;
      const { amount, type, description } = req.body;

      if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Jumlah token harus berupa bilangan bulat positif lebih besar dari 0' });
      }

      if (!['TOPUP', 'REFUND', 'DEDUCTION'].includes(type)) {
        return res.status(400).json({ error: 'Tipe penyesuaian token tidak valid. Harus TOPUP, REFUND, atau DEDUCTION' });
      }

      if (!description || typeof description !== 'string' || description.trim().length < 5) {
        return res.status(400).json({ error: 'Deskripsi penyesuaian token minimal 5 karakter' });
      }

      const targetUser = await prisma.user.findUnique({
        where: { id },
        include: { wallet: true }
      });

      if (!targetUser) {
        return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      }

      const trimmedDescription = description.trim();
      const referenceId = `ADM:${req.user.id}`;

      let result;
      if (type === 'DEDUCTION') {
        if (!targetUser.wallet || targetUser.wallet.balance < amount) {
          return res.status(400).json({ error: 'Saldo token tidak mencukupi untuk pemotongan' });
        }
        result = await WalletService.debitToken(id, amount, type, trimmedDescription, referenceId);
      } else {
        result = await WalletService.creditToken(id, amount, type, trimmedDescription, referenceId);
      }

      return res.json({
        message: 'Penyesuaian token berhasil diproses',
        wallet: {
          balance: result.wallet.balance
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/users/:id/revoke-sessions
   * Forcefully invalidates all active sessions/tokens for the target user.
   */
  static async revokeSessions(req, res, next) {
    try {
      const { id } = req.params;

      const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true }
      });

      if (!targetUser) {
        return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      }

      await TokenRevocationService.revokeUserTokens(id);

      return res.json({
        message: 'Semua sesi pengguna telah berhasil dicabut'
      });
    } catch (err) {
      next(err);
    }
  }
}

export default AdminUserController;
