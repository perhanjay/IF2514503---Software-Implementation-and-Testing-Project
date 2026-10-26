import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { WalletService } from '../services/walletService.js';
import LoginRateLimiter from '../services/loginRateLimiter.js';
import TokenRevocationService from '../services/tokenRevocationService.js';

export class AuthController {
  /**
   * UC-01: Register Akun Baru
   */
  static async register(req, res) {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Nama, email, dan kata sandi wajib diisi' });
      }

      if (typeof name !== 'string') {
        return res.status(400).json({ error: 'Nama harus berupa teks' });
      }

      if (typeof email !== 'string') {
        return res.status(400).json({ error: 'Format email tidak valid' });
      }

      if (name.length > 255) {
        return res.status(400).json({ error: 'Nama tidak boleh melebihi 255 karakter' });
      }

      if (/[<>]/.test(name) || /<[a-z/][\s\S]*>/i.test(name)) {
        return res.status(400).json({ error: 'Nama tidak boleh mengandung karakter HTML atau skrip berbahaya' });
      }

      const EMAIL_REGEX = /^[\w.-]+@([\w-]+\.)+[a-zA-Z0-9-]{2,}$/;
      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: 'Format email tidak valid' });
      }

      if (typeof password !== 'string' || password.length < 8 || !/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password)) {
        return res.status(400).json({
          error: 'Kata sandi minimal 8 karakter dan harus mengandung kombinasi huruf serta angka'
        });
      }

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(409).json({ error: 'Alamat email sudah terdaftar. Silakan login' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // ACID: Create User, Wallet, & Welcome Bonus 5 Token
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name,
            email,
            passwordHash,
            role: 'AUDIO_ENGINEER'
          }
        });

        const wallet = await tx.wallet.create({
          data: {
            userId: user.id,
            balance: 5
          }
        });

        await tx.tokenTransaction.create({
          data: {
            userId: user.id,
            walletId: wallet.id,
            amount: 5,
            type: 'WELCOME_GRANT',
            description: 'Bonus Token Selamat Datang Pengguna Baru'
          }
        });

        return { user, wallet };
      });

      const token = jwt.sign(
        { userId: result.user.id, role: result.user.role, authTime: Date.now() },
        process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      return res.status(201).json({
        message: 'Registrasi berhasil',
        token,
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role
        },
        wallet: {
          balance: result.wallet.balance
        }
      });
    } catch (err) {
      console.error('[Register Error]', err);
      return res.status(500).json({ error: 'Terjadi kesalahan pada server' });
    }
  }

  /**
   * UC-02: Login ke Sistem
   */
  static async login(req, res) {
    try {
      const { email, password, rememberMe } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email dan kata sandi wajib diisi' });
      }

      // Proteksi Brute-Force pada Login (Row 24 / UC-02)
      if (await LoginRateLimiter.isLocked(email)) {
        return res.status(429).json({
          error: 'Terlalu banyak percobaan login gagal. Akun dikunci sementara selama 15 menit.'
        });
      }

      const user = await prisma.user.findUnique({
        where: { email },
        include: { wallet: true }
      });

      if (!user) {
        await LoginRateLimiter.recordFailedAttempt(email);
        return res.status(401).json({ error: 'Email atau kata sandi tidak valid. Silakan periksa kembali' });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        await LoginRateLimiter.recordFailedAttempt(email);
        return res.status(401).json({ error: 'Email atau kata sandi tidak valid. Silakan periksa kembali' });
      }

      // Reset counter percobaan gagal saat login berhasil
      await LoginRateLimiter.resetAttempts(email);

      const expiresIn = rememberMe ? '30d' : (process.env.JWT_EXPIRES_IN || '7d');
      const token = jwt.sign(
        { userId: user.id, role: user.role, authTime: Date.now() },
        process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
        { expiresIn }
      );

      return res.json({
        message: 'Login berhasil',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        wallet: {
          balance: user.wallet?.balance ?? 0
        }
      });
    } catch (err) {
      console.error('[Login Error]', err);
      return res.status(500).json({ error: 'Terjadi kesalahan pada server' });
    }
  }

  /**
   * UC-04: Mengubah Profil
   */
  static async updateProfile(req, res) {
    try {
      const { name } = req.body;
      if (name === undefined || name === null) {
        return res.status(400).json({ error: 'Nama lengkap wajib diisi' });
      }

      if (typeof name !== 'string') {
        return res.status(400).json({ error: 'Nama lengkap harus berupa teks' });
      }

      if (!name.trim()) {
        return res.status(400).json({ error: 'Nama lengkap wajib diisi' });
      }

      if (name.length > 255) {
        return res.status(400).json({ error: 'Nama tidak boleh melebihi 255 karakter' });
      }

      if (/[<>]/.test(name) || /<[a-z/][\s\S]*>/i.test(name)) {
        return res.status(400).json({ error: 'Nama tidak boleh mengandung karakter HTML atau skrip berbahaya' });
      }

      const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: { name: name.trim() }
      });

      return res.json({
        message: 'Profil berhasil diperbarui',
        user: { id: updated.id, name: updated.name, email: updated.email }
      });
    } catch (err) {
      console.error('[Update Profile Error]', err);
      return res.status(500).json({ error: 'Gagal memperbarui profil' });
    }
  }

  /**
   * UC-05: Mengubah Kata Sandi
   */
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;

      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ error: 'Seluruh kolom kata sandi wajib diisi' });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'Konfirmasi kata sandi baru tidak cocok' });
      }

      if (currentPassword === newPassword) {
        return res.status(400).json({ error: 'Kata sandi baru tidak boleh sama dengan kata sandi lama demi alasan keamanan' });
      }

      if (newPassword.length < 8 || !/(?=.*[a-zA-Z])(?=.*[0-9])/.test(newPassword)) {
        return res.status(400).json({ error: 'Kata sandi baru minimal 8 karakter dan mengandung kombinasi huruf serta angka' });
      }

      const isMatch = await bcrypt.compare(currentPassword, req.user.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Kata sandi saat ini salah. Silakan coba lagi' });
      }

      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(newPassword, salt);

      await prisma.user.update({
        where: { id: req.user.id },
        data: { passwordHash: newHash }
      });

      // Revokasi Seluruh Token JWT Pengguna Sebelumnya (Row 54 / UC-05)
      await TokenRevocationService.revokeUserTokens(req.user.id);

      return res.json({ message: 'Kata sandi berhasil diperbarui' });
    } catch (err) {
      console.error('[Change Password Error]', err);
      return res.status(500).json({ error: 'Gagal mengubah kata sandi' });
    }
  }

  /**
   * Sesi Tamu / Guest Session (Instant Studio Access tanpa wajib login)
   */
  static async guestSession(req, res) {
    try {
      let guestUser = await prisma.user.findUnique({
        where: { email: 'guest@polaris.audio' },
        include: { wallet: true }
      });

      if (!guestUser) {
        guestUser = await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              name: 'Guest Studio Engineer',
              email: 'guest@polaris.audio',
              passwordHash: 'GUEST_NO_PASSWORD',
              role: 'AUDIO_ENGINEER'
            }
          });

          const wallet = await tx.wallet.create({
            data: {
              userId: user.id,
              balance: 3
            }
          });

          await tx.tokenTransaction.create({
            data: {
              userId: user.id,
              walletId: wallet.id,
              amount: 3,
              type: 'WELCOME_GRANT',
              description: 'Bonus Kuota Sesi Tamu / Instant Demo'
            }
          });

          return { ...user, wallet };
        });
      }

      const token = jwt.sign(
        { userId: guestUser.id, role: guestUser.role, isGuest: true, authTime: Date.now() },
        process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
        { expiresIn: '30d' }
      );

      return res.json({
        message: 'Sesi tamu berhasil diaktifkan',
        token,
        user: {
          id: guestUser.id,
          name: guestUser.name,
          email: guestUser.email,
          role: guestUser.role,
          isGuest: true
        },
        wallet: {
          balance: guestUser.wallet?.balance ?? 3
        }
      });
    } catch (err) {
      console.error('[Guest Session Error]', err);
      return res.status(500).json({ error: 'Gagal membuat sesi tamu' });
    }
  }

  /**
   * Mengambil data user yang sedang login saat ini
   */
  static async getMe(req, res) {
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    const isGuest = req.user.email === 'guest@polaris.audio';
    return res.json({
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        isGuest
      },
      wallet: {
        balance: wallet?.balance ?? 0
      }
    });
  }
}
