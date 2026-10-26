import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import AdmZip from 'adm-zip';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { createTestUser, cleanupTestData, TEST_EMAIL_DOMAIN } from './helpers/testDb.js';
import PasswordResetService from '../src/services/passwordResetService.js';
import { s3Client, BUCKET_NAME } from '../src/config/s3.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';

function makeWavBuffer(freq = 440, durationSec = 0.2, sampleRate = 48000) {
  const numSamples = Math.floor(durationSec * sampleRate);
  const bytesPerSample = 2;
  const numChannels = 1;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);

  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const val = Math.sin(2 * Math.PI * freq * t);
    const sampleInt16 = Math.max(-32768, Math.min(32767, Math.floor(val * 15000)));
    buffer.writeInt16LE(sampleInt16, 44 + (i * blockAlign));
  }

  return buffer;
}

describe('Paket 4: Fitur Belum Selesai (Missing Endpoints & UI Components - 8 Kasus)', () => {
  let userFixture;
  let userJwtToken;
  let intruderFixture;
  let intruderJwtToken;

  let sessionRepaired;
  let trackRepaired;

  let sessionUnrepaired;
  let trackUnrepaired;

  let sessionUndiagnosed;

  before(async () => {
    await cleanupTestData();
    PasswordResetService.clearAll();

    // 1. Buat User Utama
    userFixture = await createTestUser({
      name: 'Paket4 Engineer',
      email: `paket4-${Date.now()}${TEST_EMAIL_DOMAIN}`,
      password: 'InitialPassword123!',
      balance: 10
    });

    userJwtToken = jwt.sign(
      { userId: userFixture.user.id, role: userFixture.user.role, authTime: Date.now() },
      process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
      { expiresIn: '7d' }
    );

    // 2. Buat User Intruder (IDOR testing)
    intruderFixture = await createTestUser({
      name: 'Intruder Engineer',
      email: `intruder-${Date.now()}${TEST_EMAIL_DOMAIN}`,
      password: 'IntruderPassword123!',
      balance: 5
    });

    intruderJwtToken = jwt.sign(
      { userId: intruderFixture.user.id, role: intruderFixture.user.role, authTime: Date.now() },
      process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
      { expiresIn: '7d' }
    );

    // 3. Sesi REPAIRED (lengkap dengan audio WAV di MinIO & hasil diagnostik)
    sessionRepaired = await prisma.session.create({
      data: {
        userId: userFixture.user.id,
        title: 'Session Rock Anthem Repaired',
        status: 'REPAIRED',
        healthScore: 96.5,
        sampleRate: 48000,
        bitDepth: 24
      }
    });

    const wavData = makeWavBuffer(440, 0.2, 48000);
    const rawKey = `sessions/${sessionRepaired.id}/raw/01_Snare.wav`;
    const repairedKey = `sessions/${sessionRepaired.id}/repaired/FIXED_01_Snare.wav`;

    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: rawKey,
        Body: wavData,
        ContentType: 'audio/wav'
      }));
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: repairedKey,
        Body: wavData,
        ContentType: 'audio/wav'
      }));
    } catch (e) {
      console.warn('[Test MinIO Upload Warning]:', e.message);
    }

    trackRepaired = await prisma.track.create({
      data: {
        sessionId: sessionRepaired.id,
        fileName: '01_Snare.wav',
        originalStorageKey: rawKey,
        repairedStorageKey: repairedKey,
        instrumentLabel: 'Drums: Snare',
        isStereo: true,
        durationSec: 0.2,
        status: 'REPAIRED'
      }
    });

    await prisma.diagnosticResult.create({
      data: {
        trackId: trackRepaired.id,
        phaseCorrelation: 0.94,
        hasPolarityInvert: false,
        hasCombFiltering: false,
        hasFakeStereo: false,
        truePeakDbfs: -3.0,
        hasClipping: false,
        hasDcOffset: false,
        hasSubRumble: false,
        healthStatus: 'Clean',
        recommendations: ['Trek selaras optimal dan siap di-mix']
      }
    });

    // 4. Sesi READY (belum REPAIRED tapi sudah didiagnosis)
    sessionUnrepaired = await prisma.session.create({
      data: {
        userId: userFixture.user.id,
        title: 'Session Acoustic Ready',
        status: 'READY',
        healthScore: 72.0,
        sampleRate: 44100,
        bitDepth: 16
      }
    });

    trackUnrepaired = await prisma.track.create({
      data: {
        sessionId: sessionUnrepaired.id,
        fileName: '02_Guitar.wav',
        originalStorageKey: `sessions/${sessionUnrepaired.id}/raw/02_Guitar.wav`,
        instrumentLabel: 'Acoustic Guitar',
        isStereo: true,
        durationSec: 0.5,
        status: 'ANALYZED'
      }
    });

    await prisma.diagnosticResult.create({
      data: {
        trackId: trackUnrepaired.id,
        phaseCorrelation: -0.65,
        hasPolarityInvert: true,
        hasCombFiltering: false,
        hasFakeStereo: false,
        truePeakDbfs: 0.8,
        hasClipping: true,
        hasDcOffset: true,
        hasSubRumble: true,
        healthStatus: 'Critical',
        recommendations: ['Terapkan Invert Polarity 180', 'Turunkan clip gain minimal 1.5 dBFS']
      }
    });

    // 5. Sesi CREATED (belum pernah didiagnosis dan belum pernah diperbaiki)
    sessionUndiagnosed = await prisma.session.create({
      data: {
        userId: userFixture.user.id,
        title: 'Session Fresh Created',
        status: 'CREATED',
        healthScore: null
      }
    });
  });

  after(async () => {
    PasswordResetService.clearAll();
    await cleanupTestData();
  });

  // ============================================================================
  // 1. UC-03: LUPA & RESET KATA SANDI (Row 51, 52, 53)
  // ============================================================================
  describe('1. UC-03: Lupa & Reset Kata Sandi (POST /api/v1/auth/forgot-password & reset-password)', () => {
    let generatedResetToken = '';

    it('TC-PAKET4-01: forgot-password dengan format email tidak valid harus ditolak (400)', async () => {
      const res1 = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({});
      assert.equal(res1.status, 400);

      const res2 = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'not-an-email' });
      assert.equal(res2.status, 400);
      assert.match(res2.body.error, /email/i);
    });

    it('TC-PAKET4-02: forgot-password dengan email terdaftar harus mengembalikan resetToken (200)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: userFixture.user.email });

      assert.equal(res.status, 200);
      assert.ok(res.body.resetToken, 'resetToken harus ada pada response body untuk testing/preview');
      assert.match(res.body.message, /tautan pemulihan/i);
      generatedResetToken = res.body.resetToken;
    });

    it('TC-PAKET4-03: forgot-password dengan email tidak terdaftar harus mengembalikan respons konsisten tanpa membocorkan eksistensi (200)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: `unregistered-${Date.now()}@polaris-random.io` });

      assert.equal(res.status, 200);
      assert.match(res.body.message, /tautan pemulihan/i);
      assert.equal(res.body.resetToken, undefined, 'resetToken tidak boleh diterbitkan untuk email fiktif');
    });

    it('TC-PAKET4-04: reset-password dengan token fiktif/salah harus ditolak (400)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'invalid-token-1234567890abcdef',
          newPassword: 'BrandNewPassword2026!'
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /tidak valid atau telah kedaluwarsa/i);
    });

    it('TC-PAKET4-05: reset-password dengan kata sandi baru yang lemah (< 8 karakter atau tanpa angka) harus ditolak (400)', async () => {
      const res1 = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: generatedResetToken,
          newPassword: 'short'
        });
      assert.equal(res1.status, 400);
      assert.match(res1.body.error, /minimal 8 karakter/i);

      const res2 = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: generatedResetToken,
          newPassword: 'allletterslongenough'
        });
      assert.equal(res2.status, 400);
      assert.match(res2.body.error, /kombinasi huruf serta angka/i);
    });

    it('TC-PAKET4-06: reset-password jika confirmPassword diberikan namun tidak cocok harus ditolak (400)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: generatedResetToken,
          newPassword: 'BrandNewPassword2026!',
          confirmPassword: 'MismatchPassword2026!'
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /tidak cocok/i);
    });

    it('TC-PAKET4-07: reset-password dengan token valid dan sandi kuat harus sukses dan mengubah kredensial di database (200)', async () => {
      const newPassword = 'BrandNewPassword2026!';
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: generatedResetToken,
          newPassword,
          confirmPassword: newPassword
        });

      assert.equal(res.status, 200);
      assert.match(res.body.message, /Kata sandi berhasil diperbarui/i);

      // Verifikasi: Login dengan kata sandi lama harus ditolak
      const loginOld = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: userFixture.user.email,
          password: 'InitialPassword123!'
        });
      assert.equal(loginOld.status, 401);

      // Verifikasi: Login dengan kata sandi baru harus berhasil
      const loginNew = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: userFixture.user.email,
          password: newPassword
        });
      assert.equal(loginNew.status, 200);
      assert.ok(loginNew.body.token);
      userJwtToken = loginNew.body.token; // Update token aktif setelah reset kata sandi
    });

    it('TC-PAKET4-08: token reset yang telah dipakai tidak boleh digunakan kembali (Anti-Replay / Idempotensi) (400)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: generatedResetToken,
          newPassword: 'AnotherPassword2026!'
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /tidak valid atau telah kedaluwarsa/i);
    });
  });

  // ============================================================================
  // 2. UC-17: UNDUH STEM HASIL PERBAIKAN (GET /api/v1/sessions/:id/download)
  // ============================================================================
  describe('2. UC-17: Unduh Stem Hasil Perbaikan ZIP (GET /api/v1/sessions/:id/download)', () => {
    it('TC-PAKET4-09: request unduh tanpa token JWT harus ditolak (401)', async () => {
      const res = await request(app)
        .get(`/api/v1/sessions/${sessionRepaired.id}/download`);

      assert.equal(res.status, 401);
    });

    it('TC-PAKET4-10: request unduh pada sesi milik pengguna lain harus ditolak (403 IDOR)', async () => {
      const res = await request(app)
        .get(`/api/v1/sessions/${sessionRepaired.id}/download`)
        .set('Authorization', `Bearer ${intruderJwtToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error, /Akses ditolak/i);
    });

    it('TC-PAKET4-11: request unduh pada sesi yang belum berstatus REPAIRED harus ditolak (400)', async () => {
      const res = await request(app)
        .get(`/api/v1/sessions/${sessionUnrepaired.id}/download`)
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(res.status, 400);
      assert.match(res.body.error, /Sesi belum melalui proses perbaikan audio/i);
    });

    it('TC-PAKET4-12: request unduh pada sesi REPAIRED harus mengembalikan arsip ZIP lossless (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/sessions/${sessionRepaired.id}/download`)
        .set('Authorization', `Bearer ${userJwtToken}`)
        .responseType('blob');

      assert.equal(res.status, 200);
      assert.match(res.headers['content-type'], /application\/zip/i);
      assert.match(res.headers['content-disposition'], /attachment; filename="Polaris_Session_.*_Repaired\.zip"/i);

      // Verifikasi berkas ZIP valid dan berisi file stem
      const zipBuffer = Buffer.from(res.body);
      const zip = new AdmZip(zipBuffer);
      const zipEntries = zip.getEntries();

      assert.ok(zipEntries.length >= 1, 'ZIP harus berisi setidaknya 1 berkas stem audio');
      const entryNames = zipEntries.map(e => e.entryName);
      assert.ok(
        entryNames.some(name => name.includes('FIXED_') || name.endsWith('.wav')),
        `Nama berkas dalam ZIP harus sesuai konvensi perbaikan, ditemukan: ${entryNames.join(', ')}`
      );
    });
  });

  // ============================================================================
  // 3. UC-18: UNDUH LAPORAN DIAGNOSTIK SESI PDF (GET /api/v1/sessions/:id/report)
  // ============================================================================
  describe('3. UC-18: Unduh Laporan Diagnostik Sesi PDF (GET /api/v1/sessions/:id/report)', () => {
    it('TC-PAKET4-13: request laporan tanpa token JWT harus ditolak (401)', async () => {
      const res = await request(app)
        .get(`/api/v1/sessions/${sessionRepaired.id}/report`);

      assert.equal(res.status, 401);
    });

    it('TC-PAKET4-14: request laporan pada sesi milik pengguna lain harus ditolak (403 IDOR)', async () => {
      const res = await request(app)
        .get(`/api/v1/sessions/${sessionRepaired.id}/report`)
        .set('Authorization', `Bearer ${intruderJwtToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error, /Akses ditolak/i);
    });

    it('TC-PAKET4-15: request laporan pada sesi yang belum memiliki hasil diagnostik harus ditolak (400)', async () => {
      const res = await request(app)
        .get(`/api/v1/sessions/${sessionUndiagnosed.id}/report`)
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(res.status, 400);
      assert.match(res.body.error, /Sesi belum memiliki laporan diagnostik/i);
    });

    it('TC-PAKET4-16: request laporan pada sesi yang telah didiagnosis harus mengembalikan dokumen PDF resmi (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/sessions/${sessionRepaired.id}/report`)
        .set('Authorization', `Bearer ${userJwtToken}`)
        .responseType('blob');

      assert.equal(res.status, 200);
      assert.match(res.headers['content-type'], /application\/pdf/i);
      assert.match(res.headers['content-disposition'], /attachment; filename="Polaris_Audit_.*\.pdf"/i);

      // Verifikasi berkas PDF valid (magic bytes %PDF)
      const pdfBuffer = Buffer.from(res.body);
      assert.ok(pdfBuffer.length > 500, 'Ukuran PDF harus valid dan memiliki konten');
      const headerMagic = pdfBuffer.toString('utf8', 0, 4);
      assert.equal(headerMagic, '%PDF', 'Format berkas harus diawali header magic %PDF');
    });

    it('TC-PAKET4-17: request unduh pada sesi ID tidak valid / tidak ditemukan harus ditolak (404)', async () => {
      const res1 = await request(app)
        .get('/api/v1/sessions/invalid-uuid-format/download')
        .set('Authorization', `Bearer ${userJwtToken}`);
      assert.equal(res1.status, 404);

      const res2 = await request(app)
        .get('/api/v1/sessions/00000000-0000-0000-0000-000000000000/download')
        .set('Authorization', `Bearer ${userJwtToken}`);
      assert.equal(res2.status, 404);
    });

    it('TC-PAKET4-18: request laporan pada sesi ID tidak valid / tidak ditemukan harus ditolak (404)', async () => {
      const res1 = await request(app)
        .get('/api/v1/sessions/invalid-uuid-format/report')
        .set('Authorization', `Bearer ${userJwtToken}`);
      assert.equal(res1.status, 404);

      const res2 = await request(app)
        .get('/api/v1/sessions/00000000-0000-0000-0000-000000000000/report')
        .set('Authorization', `Bearer ${userJwtToken}`);
      assert.equal(res2.status, 404);
    });

    it('TC-PAKET4-19: forgot-password untuk akun tamu (guest@polaris.audio) tidak boleh menerbitkan token reset', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'guest@polaris.audio' });
      assert.equal(res.status, 200);
      assert.equal(res.body.resetToken, undefined);
    });

    it('TC-PAKET4-20: reset-password dengan token kosong atau hanya spasi harus ditolak (400)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: '   ',
          newPassword: 'BrandNewPassword2026!'
        });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /tidak valid atau telah kedaluwarsa/i);
    });
  });
});
