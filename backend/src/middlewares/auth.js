import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import TokenRevocationService from '../services/tokenRevocationService.js';

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Token tidak disertakan' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl';
    const decoded = jwt.verify(token, JWT_SECRET);

    const userId = decoded.userId || decoded.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Pengguna tidak ditemukan' });
    }

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Akses ditolak: Akun Anda telah ditangguhkan oleh administrator' });
    }

    // Revokasi Token JWT Saat Kata Sandi Diperbarui (Row 54 / UC-05)
    const isRevoked = await TokenRevocationService.isTokenRevoked(
      user.id,
      decoded.iat,
      decoded.authTime
    );

    if (isRevoked) {
      return res.status(401).json({
        error: 'Sesi telah kedaluwarsa atau kata sandi telah diperbarui. Silakan login kembali'
      });
    }

    req.user = user;
    req.user.isGuest = Boolean(decoded.isGuest || user.email === 'guest@polaris.audio');
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorized: Sesi telah kedaluwarsa, silakan login ulang' });
    }
    return res.status(401).json({ error: 'Unauthorized: Token tidak valid' });
  }
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Akses ditolak: Memerlukan hak akses Administrator' });
  }
  next();
};

export const requireAudioEngineer = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    return res.status(403).json({
      error: 'Akses ditolak: Akun Administrator tidak diizinkan membuat, mengubah, atau memproses sesi audio.'
    });
  }
  next();
};
