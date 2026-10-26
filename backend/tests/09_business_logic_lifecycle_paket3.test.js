import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { createTestUser, cleanupTestData, TEST_EMAIL_DOMAIN } from './helpers/testDb.js';
import LoginRateLimiter from '../src/services/loginRateLimiter.js';
import TokenRevocationService from '../src/services/tokenRevocationService.js';

function makeWavBuffer(freq = 220, durationSec = 0.5, sampleRate = 44100, invert = false) {
  const numSamples = Math.floor(durationSec * sampleRate);
  const bytesPerSample = 2; // 16-bit PCM
  const numChannels = 1;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  const sign = invert ? -1 : 1;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const val = Math.sin(2 * Math.PI * freq * t) * sign;
    const sampleInt16 = Math.max(-32768, Math.min(32767, Math.floor(val * 20000)));
    buffer.writeInt16LE(sampleInt16, 44 + (i * blockAlign));
  }

  return buffer;
}

describe('Paket 3: Logika Bisnis, Idempotensi & Penegakan Prasyarat (16 Kasus Blackbox)', () => {
  before(async () => {
    await cleanupTestData();
  });

  after(async () => {
    await cleanupTestData();
    try {
      const { redis } = await import('../src/config/redis.js');
      if (redis.status === 'ready' || redis.status === 'connecting') {
        await redis.quit();
      }
    } catch {}
  });

  // ============================================================================
  // 1. PROTEKSI BRUTE-FORCE PADA LOGIN (POST /api/v1/auth/login) (Row 24 / UC-02)
  // ============================================================================
  describe('1. Proteksi Brute-Force pada Login (Row 24 / UC-02)', () => {
    const targetEmail = `brute-target-${Date.now()}${TEST_EMAIL_DOMAIN}`;
    const targetPassword = 'CorrectPassword2026!';
    let targetUser;

    before(async () => {
      targetUser = await createTestUser({
        name: 'Brute Target User',
        email: targetEmail,
        password: targetPassword,
        balance: 5
      });
    });

    it('TC-BIZ-01: percobaan login gagal 1 s.d. 4 kali berturut-turut harus ditolak dengan HTTP 401', async () => {
      for (let attempt = 1; attempt <= 4; attempt++) {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: targetEmail,
            password: `WrongPassword_${attempt}`
          });

        assert.equal(res.status, 401);
        assert.match(res.body.error, /Email atau kata sandi tidak valid/i);
      }
    });

    it('TC-BIZ-02: percobaan login gagal ke-5 berturut-turut harus mengunci akun sementara', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: targetEmail,
          password: 'WrongPassword_5'
        });

      assert.equal(res.status, 401);
      assert.match(res.body.error, /Email atau kata sandi tidak valid/i);

      const isLocked = await LoginRateLimiter.isLocked(targetEmail);
      assert.equal(isLocked, true);
    });

    it('TC-BIZ-03: percobaan login ke-6 (meskipun dengan password benar) harus ditolak HTTP 429 Akun Dikunci', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: targetEmail,
          password: targetPassword // Password yang benar!
        });

      assert.equal(res.status, 429);
      assert.equal(
        res.body.error,
        'Terlalu banyak percobaan login gagal. Akun dikunci sementara selama 15 menit.'
      );

      // Percobaan berikutnya dengan password salah juga tetap ditolak 429 selama periode terkunci
      const res7 = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: targetEmail,
          password: 'AnotherWrongPassword!'
        });
      assert.equal(res7.status, 429);
    });

    it('TC-BIZ-04: percobaan login berhasil sebelum 5x gagal harus mereset counter percobaan gagal ke 0', async () => {
      const safeEmail = `safe-reset-${Date.now()}${TEST_EMAIL_DOMAIN}`;
      const safePassword = 'SafePassword2026!';
      await createTestUser({
        name: 'Safe Reset User',
        email: safeEmail,
        password: safePassword,
        balance: 5
      });

      // 3 kali gagal berturut-turut
      for (let i = 1; i <= 3; i++) {
        const failRes = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: safeEmail, password: 'WrongPassword!' });
        assert.equal(failRes.status, 401);
      }

      // Login ke-4 berhasil dengan password yang benar
      const successRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: safeEmail, password: safePassword });

      assert.equal(successRes.status, 200);
      assert.equal(successRes.body.message, 'Login berhasil');

      // Verifikasi counter gagal telah direset
      const isLockedAfter = await LoginRateLimiter.isLocked(safeEmail);
      assert.equal(isLockedAfter, false);
    });
  });

  // ============================================================================
  // 2. REVOKASI TOKEN JWT SAAT KATA SANDI DIPERBARUI (Row 54 / UC-05)
  // ============================================================================
  describe('2. Revokasi Token JWT Saat Kata Sandi Diperbarui (Row 54 / UC-05)', () => {
    const pwEmail = `pwd-change-${Date.now()}${TEST_EMAIL_DOMAIN}`;
    const oldPassword = 'OldSecretPass2026!';
    const newPassword = 'NewSecretPass2026!';
    let userFixture;
    let oldJwtToken;

    before(async () => {
      userFixture = await createTestUser({
        name: 'Password Changing Engineer',
        email: pwEmail,
        password: oldPassword,
        balance: 5
      });

      // Login awal untuk mendapatkan token JWT lama
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: pwEmail, password: oldPassword });

      assert.equal(loginRes.status, 200);
      oldJwtToken = loginRes.body.token;

      // Verifikasi token awal dapat mengakses /me
      const checkRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${oldJwtToken}`);
      assert.equal(checkRes.status, 200);
    });

    it('TC-BIZ-05: POST /api/v1/auth/change-password berhasil memperbarui kata sandi (HTTP 200)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${oldJwtToken}`)
        .send({
          currentPassword: oldPassword,
          newPassword: newPassword,
          confirmPassword: newPassword
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.message, 'Kata sandi berhasil diperbarui');
    });

    it('TC-BIZ-06: token JWT lama harus ditolak dengan HTTP 401 setelah kata sandi diubah', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${oldJwtToken}`);

      assert.equal(res.status, 401);
      assert.match(
        res.body.error,
        /Sesi telah kedaluwarsa atau kata sandi telah diperbarui\. Silakan login kembali/i
      );
    });

    it('TC-BIZ-07: token JWT baru dari login ulang harus dapat mengakses endpoint terproteksi (200 OK)', async () => {
      // Login ulang dengan kata sandi baru
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: pwEmail, password: newPassword });

      assert.equal(loginRes.status, 200);
      const newJwtToken = loginRes.body.token;
      assert.ok(newJwtToken);

      // Akses /me dengan token baru
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${newJwtToken}`);

      assert.equal(meRes.status, 200);
      assert.equal(meRes.body.user.email, pwEmail);
    });
  });

  // ============================================================================
  // 3. PERBAIKAN LABEL MUTASI BUKU BESAR KLAIM HARIAN (Row 113 / UC-09)
  // ============================================================================
  describe('3. Perbaikan Label Mutasi Buku Besar Klaim Harian (Row 113 / UC-09)', () => {
    let claimUser;
    let claimUserToken;

    before(async () => {
      claimUser = await createTestUser({
        name: 'Daily Claim Tester',
        email: `claim-user-${Date.now()}${TEST_EMAIL_DOMAIN}`,
        password: 'Password123!',
        balance: 5
      });

      claimUserToken = jwt.sign(
        { userId: claimUser.user.id, role: claimUser.user.role, authTime: Date.now() },
        process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
        { expiresIn: '7d' }
      );
    });

    it('TC-BIZ-08: klaim harian pertama harus mencatat mutasi dengan deskripsi "[Klaim Harian] Jatah Token Gratis" (+2)', async () => {
      const res = await request(app)
        .post('/api/v1/wallet/claim-daily')
        .set('Authorization', `Bearer ${claimUserToken}`);

      assert.equal(res.status, 200);
      assert.match(res.body.message, /2 token gratis harian/i);
      assert.equal(res.body.wallet.balance, 7);

      // Verifikasi di database: riwayat mutasi buku besar
      const tx = await prisma.tokenTransaction.findFirst({
        where: {
          userId: claimUser.user.id,
          description: '[Klaim Harian] Jatah Token Gratis'
        }
      });

      assert.ok(tx);
      assert.equal(tx.amount, 2);
      assert.equal(tx.type, 'WELCOME_GRANT');
      assert.equal(tx.description, '[Klaim Harian] Jatah Token Gratis');
    });

    it('TC-BIZ-09: klaim harian kedua dalam 24 jam harus ditolak dengan HTTP 400 pesan spesifik', async () => {
      const res = await request(app)
        .post('/api/v1/wallet/claim-daily')
        .set('Authorization', `Bearer ${claimUserToken}`);

      assert.equal(res.status, 400);
      assert.match(res.body.error, /Anda sudah mengklaim jatah token gratis untuk hari ini/i);

      // Saldo dompet tidak boleh bertambah lagi
      const wallet = await prisma.wallet.findUnique({
        where: { userId: claimUser.user.id }
      });
      assert.equal(wallet.balance, 7);
    });
  });

  // ============================================================================
  // 4. PENEGAKAN PRASYARAT PERBAIKAN AUDIO (Row 246 / UC-14)
  // ============================================================================
  describe('4. Penegakan Prasyarat Perbaikan Audio (Wajib Diagnostik Dulu) (Row 246 / UC-14)', () => {
    let prereqUser;
    let prereqUserToken;
    let undiagnosedSession;

    before(async () => {
      prereqUser = await createTestUser({
        name: 'Prerequisite Test Engineer',
        email: `prereq-${Date.now()}${TEST_EMAIL_DOMAIN}`,
        password: 'Password123!',
        balance: 10
      });

      prereqUserToken = jwt.sign(
        { userId: prereqUser.user.id, role: prereqUser.user.role, authTime: Date.now() },
        process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
        { expiresIn: '7d' }
      );

      // Sesi yang belum melalui tahap diagnostik audio (healthScore === null, tanpa diagnosticResult)
      undiagnosedSession = await prisma.session.create({
        data: {
          userId: prereqUser.user.id,
          title: 'Undiagnosed Multitrack Session',
          status: 'READY',
          estimatedTokens: 1,
          healthScore: null
        }
      });

      await prisma.track.create({
        data: {
          sessionId: undiagnosedSession.id,
          fileName: '01_Vocal_Lead.wav',
          originalStorageKey: `sessions/${undiagnosedSession.id}/raw/01_Vocal_Lead.wav`,
          status: 'PENDING'
        }
      });
    });

    it('TC-BIZ-10: POST /repair-auto pada sesi tanpa diagnostik harus ditolak dengan HTTP 400', async () => {
      const res = await request(app)
        .post(`/api/v1/sessions/${undiagnosedSession.id}/repair-auto`)
        .set('Authorization', `Bearer ${prereqUserToken}`);

      assert.equal(res.status, 400);
      assert.match(
        res.body.error,
        /Sesi harus melalui tahap diagnostik audio terlebih dahulu sebelum dapat diperbaiki/i
      );

      // Saldo tidak boleh terpotong
      const wallet = await prisma.wallet.findUnique({
        where: { userId: prereqUser.user.id }
      });
      assert.equal(wallet.balance, 10);
    });

    it('TC-BIZ-11: POST /repair-custom pada sesi tanpa diagnostik harus ditolak dengan HTTP 400', async () => {
      const res = await request(app)
        .post(`/api/v1/sessions/${undiagnosedSession.id}/repair-custom`)
        .set('Authorization', `Bearer ${prereqUserToken}`)
        .send({ customSettings: { bypass: false } });

      assert.equal(res.status, 400);
      assert.match(
        res.body.error,
        /Sesi harus melalui tahap diagnostik audio terlebih dahulu sebelum dapat diperbaiki/i
      );

      // Saldo tidak boleh terpotong
      const wallet = await prisma.wallet.findUnique({
        where: { userId: prereqUser.user.id }
      });
      assert.equal(wallet.balance, 10);
    });
  });

  // ============================================================================
  // 5. IDEMPOTENSI PERBAIKAN AUDIO & PROTEKSI DOUBLE TOKEN DEDUCTION (Row 244-246)
  // ============================================================================
  describe('5. Idempotensi Perbaikan Audio & Proteksi Double Token Deduction (Row 244-246)', () => {
    let audioUser;
    let audioUserToken;
    let liveSession;

    before(async () => {
      audioUser = await createTestUser({
        name: 'Idempotency Audio Engineer',
        email: `idempotent-${Date.now()}${TEST_EMAIL_DOMAIN}`,
        password: 'Password123!',
        balance: 10
      });

      audioUserToken = jwt.sign(
        { userId: audioUser.user.id, role: audioUser.user.role, authTime: Date.now() },
        process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
        { expiresIn: '7d' }
      );

      // Upload berkas audio riil untuk sesi uji perbaikan
      const track1 = makeWavBuffer(200, 0.4, 44100, false);
      const track2 = makeWavBuffer(200, 0.4, 44100, true);

      const uploadRes = await request(app)
        .post('/api/v1/sessions/upload-direct')
        .set('Authorization', `Bearer ${audioUserToken}`)
        .field('title', 'Idempotent Multitrack Session')
        .attach('files', track1, 'Drum_Top.wav')
        .attach('files', track2, 'Drum_Bottom.wav');

      assert.equal(uploadRes.status, 201);
      liveSession = uploadRes.body.session;

      // Jalankan klasifikasi & finalisasi
      await request(app)
        .post(`/api/v1/sessions/${liveSession.id}/classify`)
        .set('Authorization', `Bearer ${audioUserToken}`);

      await request(app)
        .post(`/api/v1/sessions/${liveSession.id}/finalize-classification`)
        .set('Authorization', `Bearer ${audioUserToken}`);

      // Jalankan diagnostik DSP (UC-13)
      const diagRes = await request(app)
        .post(`/api/v1/sessions/${liveSession.id}/diagnose`)
        .set('Authorization', `Bearer ${audioUserToken}`);

      assert.equal(diagRes.status, 200);
    });

    it('TC-BIZ-12: eksekusi perbaikan pertama harus memotong 1 token dan mengubah status menjadi REPAIRED', async () => {
      const balanceBefore = (
        await prisma.wallet.findUnique({ where: { userId: audioUser.user.id } })
      ).balance;

      const res = await request(app)
        .post(`/api/v1/sessions/${liveSession.id}/repair-auto`)
        .set('Authorization', `Bearer ${audioUserToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.session.status, 'REPAIRED');

      const balanceAfter = (
        await prisma.wallet.findUnique({ where: { userId: audioUser.user.id } })
      ).balance;
      assert.equal(balanceAfter, balanceBefore - 1);
    });

    it('TC-BIZ-13: eksekusi ulang repair-auto pada sesi REPAIRED harus idempotent & TIDAK memotong token lagi (200)', async () => {
      const balanceBefore = (
        await prisma.wallet.findUnique({ where: { userId: audioUser.user.id } })
      ).balance;

      const res = await request(app)
        .post(`/api/v1/sessions/${liveSession.id}/repair-auto`)
        .set('Authorization', `Bearer ${audioUserToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.session.status, 'REPAIRED');

      // Proteksi Double Token Deduction: Saldo harus tetap sama persis!
      const balanceAfter = (
        await prisma.wallet.findUnique({ where: { userId: audioUser.user.id } })
      ).balance;
      assert.equal(balanceAfter, balanceBefore);

      // Mutasi buku besar DEDUCTION tidak boleh bertambah
      const deductionCount = await prisma.tokenTransaction.count({
        where: { referenceId: liveSession.id, type: 'DEDUCTION' }
      });
      assert.equal(deductionCount, 1);
    });

    it('TC-BIZ-14: eksekusi ulang repair-custom pada sesi REPAIRED juga tidak memotong token pengguna lagi (200)', async () => {
      const balanceBefore = (
        await prisma.wallet.findUnique({ where: { userId: audioUser.user.id } })
      ).balance;

      const tracks = await prisma.track.findMany({
        where: { sessionId: liveSession.id }
      });

      const customSettings = {};
      customSettings[tracks[0].id] = {
        flipPolarity: true,
        gainStaging: true
      };

      const res = await request(app)
        .post(`/api/v1/sessions/${liveSession.id}/repair-custom`)
        .set('Authorization', `Bearer ${audioUserToken}`)
        .send({ customSettings });

      assert.equal(res.status, 200);
      assert.equal(res.body.session.status, 'REPAIRED');

      // Proteksi Double Token Deduction: Saldo tidak boleh berkurang
      const balanceAfter = (
        await prisma.wallet.findUnique({ where: { userId: audioUser.user.id } })
      ).balance;
      assert.equal(balanceAfter, balanceBefore);

      // Mutasi buku besar DEDUCTION tetap 1
      const deductionCount = await prisma.tokenTransaction.count({
        where: { referenceId: liveSession.id, type: 'DEDUCTION' }
      });
      assert.equal(deductionCount, 1);
    });
  });

  // ============================================================================
  // 6. AUTO-REFUND TRANSAKSI TOKEN JIKA PERBAIKAN GAGAL
  // ============================================================================
  describe('6. Auto-Refund Transaksi Token Jika Perbaikan Gagal', () => {
    let refundUser;
    let refundUserToken;
    let failingSession;

    before(async () => {
      refundUser = await createTestUser({
        name: 'Refund Assurance Engineer',
        email: `refund-${Date.now()}${TEST_EMAIL_DOMAIN}`,
        password: 'Password123!',
        balance: 5
      });

      refundUserToken = jwt.sign(
        { userId: refundUser.user.id, role: refundUser.user.role, authTime: Date.now() },
        process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
        { expiresIn: '7d' }
      );

      // Sesi terdiagnosa namun menunjuk ke berkas storage S3 yang tidak ada untuk memicu kegagalan worker
      failingSession = await prisma.session.create({
        data: {
          userId: refundUser.user.id,
          title: 'Faulty Storage Session for Refund Verification',
          status: 'READY',
          estimatedTokens: 1,
          healthScore: 60.0
        }
      });

      const faultyTrack = await prisma.track.create({
        data: {
          sessionId: failingSession.id,
          fileName: 'corrupt_nonexistent_audio.wav',
          originalStorageKey: `sessions/${failingSession.id}/raw/nonexistent_file_9999.wav`,
          status: 'ANALYZED'
        }
      });

      await prisma.diagnosticResult.create({
        data: {
          trackId: faultyTrack.id,
          phaseCorrelation: 0.1,
          healthStatus: 'Warning'
        }
      });
    });

    it('TC-BIZ-15: token yang sempat dipotong harus dikembalikan otomatis (Auto-Refund) dengan transaksi REFUND', async () => {
      const balanceBefore = (
        await prisma.wallet.findUnique({ where: { userId: refundUser.user.id } })
      ).balance;

      const res = await request(app)
        .post(`/api/v1/sessions/${failingSession.id}/repair-auto`)
        .set('Authorization', `Bearer ${refundUserToken}`);

      // Repair harus gagal karena berkas audio tidak ditemukan di S3
      assert.ok(res.status >= 400);

      // Verifikasi saldo dompet: Harus dikembalikan utuh (Auto-Refund)
      const balanceAfter = (
        await prisma.wallet.findUnique({ where: { userId: refundUser.user.id } })
      ).balance;
      assert.equal(balanceAfter, balanceBefore);

      // Verifikasi pencatatan transaksi REFUND pada ledger
      const refundTx = await prisma.tokenTransaction.findFirst({
        where: {
          userId: refundUser.user.id,
          referenceId: failingSession.id,
          type: 'REFUND'
        }
      });

      assert.ok(refundTx);
      assert.equal(refundTx.amount, 1);
      assert.match(refundTx.description, /Auto-Refund/i);

      // Status sesi harus dikembalikan ke READY
      const dbSession = await prisma.session.findUnique({
        where: { id: failingSession.id }
      });
      assert.equal(dbSession.status, 'READY');
    });
  });

  // ============================================================================
  // 7. VALIDASI STATUS TRANSISI SESI (SESSION LIFECYCLE STATE MACHINE)
  // ============================================================================
  describe('7. Validasi Status Transisi Sesi (Session Lifecycle State Machine)', () => {
    let stateUser;
    let stateUserToken;
    let processingSession;

    before(async () => {
      stateUser = await createTestUser({
        name: 'State Machine Engineer',
        email: `statemachine-${Date.now()}${TEST_EMAIL_DOMAIN}`,
        password: 'Password123!',
        balance: 10
      });

      stateUserToken = jwt.sign(
        { userId: stateUser.user.id, role: stateUser.user.role, authTime: Date.now() },
        process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
        { expiresIn: '7d' }
      );

      // Sesi yang sedang dalam status PROCESSING
      processingSession = await prisma.session.create({
        data: {
          userId: stateUser.user.id,
          title: 'Session In Processing State',
          status: 'PROCESSING',
          estimatedTokens: 1,
          healthScore: 75.0
        }
      });

      const track = await prisma.track.create({
        data: {
          sessionId: processingSession.id,
          fileName: '01_Track.wav',
          originalStorageKey: `sessions/${processingSession.id}/raw/01_Track.wav`,
          status: 'ANALYZED'
        }
      });

      await prisma.diagnosticResult.create({
        data: {
          trackId: track.id,
          phaseCorrelation: 0.8,
          healthStatus: 'Clean'
        }
      });
    });

    it('TC-BIZ-16: sesi berstatus PROCESSING tidak boleh menerima operasi perbaikan atau diagnostik simultan (409 Conflict)', async () => {
      // 1. Coba panggil repair-auto pada sesi PROCESSING
      const repairRes = await request(app)
        .post(`/api/v1/sessions/${processingSession.id}/repair-auto`)
        .set('Authorization', `Bearer ${stateUserToken}`);

      assert.equal(repairRes.status, 409);
      assert.match(
        repairRes.body.error,
        /Sesi sedang dalam proses analisis atau perbaikan audio lain/i
      );

      // 2. Coba panggil diagnose pada sesi PROCESSING
      const diagRes = await request(app)
        .post(`/api/v1/sessions/${processingSession.id}/diagnose`)
        .set('Authorization', `Bearer ${stateUserToken}`);

      assert.equal(diagRes.status, 409);
      assert.match(
        diagRes.body.error,
        /Sesi sedang dalam proses analisis atau perbaikan audio lain/i
      );

      // 3. Coba panggil repair-custom pada sesi PROCESSING
      const customRes = await request(app)
        .post(`/api/v1/sessions/${processingSession.id}/repair-custom`)
        .set('Authorization', `Bearer ${stateUserToken}`)
        .send({ customSettings: { test: true } });

      assert.equal(customRes.status, 409);
      assert.match(
        customRes.body.error,
        /Sesi sedang dalam proses analisis atau perbaikan audio lain/i
      );

      // 4. Coba panggil classify pada sesi PROCESSING
      const classifyRes = await request(app)
        .post(`/api/v1/sessions/${processingSession.id}/classify`)
        .set('Authorization', `Bearer ${stateUserToken}`);

      assert.equal(classifyRes.status, 409);
      assert.match(
        classifyRes.body.error,
        /Sesi sedang dalam proses analisis atau perbaikan audio lain/i
      );
    });
  });
});
