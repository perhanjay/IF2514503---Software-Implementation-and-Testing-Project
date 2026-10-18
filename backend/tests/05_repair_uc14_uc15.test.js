import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { createTestUser, cleanupTestData, TEST_EMAIL_DOMAIN } from './helpers/testDb.js';

function makeWavBuffer(freq = 200, durationSec = 0.5, sampleRate = 44100, invert = false) {
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
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
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

describe('Phase 5: Automated & Granular DSP Audio Repair (UC-14 & UC-15)', () => {
  let userFixture;
  let userJwtToken;
  let otherUserFixture;
  let otherUserJwtToken;
  let testSession;

  before(async () => {
    await cleanupTestData();

    userFixture = await createTestUser({
      name: 'Repair Lead Engineer',
      email: `repair-engineer-${Date.now()}${TEST_EMAIL_DOMAIN}`,
      password: 'SecureRepair2026!'
    });

    userJwtToken = jwt.sign(
      { userId: userFixture.user.id, role: userFixture.user.role },
      process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
      { expiresIn: '7d' }
    );

    otherUserFixture = await createTestUser({
      name: 'Other Audio Engineer',
      email: `other-engineer-${Date.now()}${TEST_EMAIL_DOMAIN}`,
      password: 'SecureOther2026!'
    });

    otherUserJwtToken = jwt.sign(
      { userId: otherUserFixture.user.id, role: otherUserFixture.user.role },
      process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
      { expiresIn: '7d' }
    );
  });

  after(async () => {
    await cleanupTestData();
  });

  describe('1. Negative & Boundary Security Tests (Happy Path Last)', () => {
    it('TC-REP-NEG-01: harus menolak perbaikan pada sesi yang tidak ditemukan (404/400)', async () => {
      const res = await request(app)
        .post('/api/v1/sessions/non-existent-session-id-9999/repair-auto')
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.ok(res.status >= 400);
      assert.match(res.body.error, /tidak ditemukan/i);
    });

    it('TC-REP-NEG-02: harus menolak perbaikan pada sesi milik user lain (400)', async () => {
      const foreignSession = await prisma.session.create({
        data: {
          userId: otherUserFixture.user.id,
          title: 'Foreign Session',
          status: 'READY',
          estimatedTokens: 1
        }
      });

      const res = await request(app)
        .post(`/api/v1/sessions/${foreignSession.id}/repair-auto`)
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.ok(res.status >= 400);
      assert.match(res.body.error, /Akses ditolak/i);
    });

    it('TC-REP-NEG-03: harus menolak perbaikan jika saldo token tidak mencukupi (402 Payment Required)', async () => {
      // Buat user miskin dengan balance 0
      const brokeUser = await createTestUser({
        name: 'Broke Engineer',
        email: `broke-${Date.now()}${TEST_EMAIL_DOMAIN}`,
        password: 'Password123'
      });
      // Set balance ke 0
      await prisma.wallet.update({
        where: { userId: brokeUser.user.id },
        data: { balance: 0 }
      });

      const brokeToken = jwt.sign(
        { userId: brokeUser.user.id, role: brokeUser.user.role },
        process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
        { expiresIn: '7d' }
      );

      const brokeSession = await prisma.session.create({
        data: {
          userId: brokeUser.user.id,
          title: 'Broke Session',
          status: 'READY',
          estimatedTokens: 2
        }
      });

      await prisma.track.create({
        data: {
          sessionId: brokeSession.id,
          fileName: 'snare.wav',
          originalStorageKey: 'sessions/dummy/raw/snare.wav',
          status: 'ANALYZED'
        }
      });

      const res = await request(app)
        .post(`/api/v1/sessions/${brokeSession.id}/repair-auto`)
        .set('Authorization', `Bearer ${brokeToken}`);

      assert.equal(res.status, 402);
      assert.match(res.body.error, /Saldo token tidak mencukupi/i);
    });
  });

  describe('2. End-to-End Execution of UC-14 (1-Click Auto-Fix) and UC-15 (Granular Fixes)', () => {
    it('TC-REP-HP-01: Ingestion & Diagnostics setup untuk sesi pengujian perbaikan', async () => {
      const wavTrack1 = makeWavBuffer(200, 0.5, 44100, false);
      const wavTrack2 = makeWavBuffer(200, 0.5, 44100, true); // Inverted polarity

      const uploadRes = await request(app)
        .post('/api/v1/sessions/upload-direct')
        .set('Authorization', `Bearer ${userJwtToken}`)
        .field('title', 'Acoustic Drum Phase Session')
        .attach('files', wavTrack1, 'Snare_Top.wav')
        .attach('files', wavTrack2, 'Snare_Bottom.wav');

      assert.equal(uploadRes.status, 201);
      testSession = uploadRes.body.session;
      assert.ok(testSession.id);

      // Jalankan klasifikasi & finalisasi
      await request(app)
        .post(`/api/v1/sessions/${testSession.id}/classify`)
        .set('Authorization', `Bearer ${userJwtToken}`);

      await request(app)
        .post(`/api/v1/sessions/${testSession.id}/finalize-classification`)
        .set('Authorization', `Bearer ${userJwtToken}`);

      // Jalankan diagnostik DSP (UC-13)
      const diagRes = await request(app)
        .post(`/api/v1/sessions/${testSession.id}/diagnose`)
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(diagRes.status, 200);
      assert.ok(diagRes.body.tracksDiagnostics.length >= 2);
    });

    it('TC-REP-HP-02: UC-14 Eksekusi 1-Click Auto-Fix berhasil merender file fixed dan memotong token', async () => {
      const walletBefore = await prisma.wallet.findUnique({
        where: { userId: userFixture.user.id }
      });
      const initialBalance = walletBefore.balance;

      const repairRes = await request(app)
        .post(`/api/v1/sessions/${testSession.id}/repair-auto`)
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(repairRes.status, 200);
      assert.match(repairRes.body.message, /Perbaikan otomatis DSP sesi berhasil diterapkan/i);
      assert.equal(repairRes.body.session.status, 'REPAIRED');
      assert.ok(repairRes.body.session.healthScore >= 95.0);

      // Verifikasi setiap track memiliki repairedStorageKey berprefix FIXED_
      assert.ok(repairRes.body.tracksRepaired.length >= 2);
      for (const t of repairRes.body.tracksRepaired) {
        assert.match(t.repairedStorageKey, /sessions\/.*\/repaired\/FIXED_/);
        assert.equal(t.newHealthStatus, 'Clean');
      }

      // Verifikasi saldo token terpotong tepat
      const walletAfter = await prisma.wallet.findUnique({
        where: { userId: userFixture.user.id }
      });
      assert.equal(walletAfter.balance, initialBalance - (testSession.estimatedTokens || 1));

      // Verifikasi pencatatan mutasi transaksi DEDUCTION
      const tx = await prisma.tokenTransaction.findFirst({
        where: {
          userId: userFixture.user.id,
          referenceId: testSession.id,
          type: 'DEDUCTION'
        }
      });
      assert.ok(tx);
      assert.equal(tx.amount, -(testSession.estimatedTokens || 1));
    });

    it('TC-REP-HP-03: UC-15 Eksekusi Granular Custom Repair dengan pilihan modul tertentu', async () => {
      const tracks = await prisma.track.findMany({
        where: { sessionId: testSession.id }
      });

      const customSettings = {};
      customSettings[tracks[0].id] = {
        flipPolarity: false,
        alignDelay: true,
        fixFakeStereo: false,
        removeDcOffset: true,
        filterSubRumble: true,
        gainStaging: true
      };

      const customRes = await request(app)
        .post(`/api/v1/sessions/${testSession.id}/repair-custom`)
        .set('Authorization', `Bearer ${userJwtToken}`)
        .send({ customSettings });

      assert.equal(customRes.status, 200);
      assert.match(customRes.body.message, /Perbaikan kustom DSP sesi berhasil diterapkan/i);
      assert.equal(customRes.body.session.status, 'REPAIRED');
      assert.equal(customRes.body.session.repairConfig.isApplied, true);
      assert.equal(customRes.body.session.repairConfig.settings.mode, 'CUSTOM');
    });
  });
});
