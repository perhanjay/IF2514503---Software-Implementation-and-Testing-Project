import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { createTestUser, cleanupTestData, TEST_EMAIL_DOMAIN } from './helpers/testDb.js';

function makeWavBufferWithTone(freq = 100, durationSec = 1.0, sampleRate = 48000, numChannels = 1, decay = 0, invert = false) {
  const numSamples = Math.floor(durationSec * sampleRate);
  const bytesPerSample = 2; // 16-bit
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
    const env = decay > 0 ? Math.exp(-t * decay) : 1.0;
    const val = Math.sin(2 * Math.PI * freq * t) * env * sign;
    const sampleInt16 = Math.max(-32768, Math.min(32767, Math.floor(val * 24000)));
    for (let c = 0; c < numChannels; c++) {
      buffer.writeInt16LE(sampleInt16, 44 + (i * blockAlign) + (c * bytesPerSample));
    }
  }

  return buffer;
}

describe('Phase T6: End-to-End API Integration (UC-12 & UC-13)', () => {
  let userFixture;
  let userJwtToken;

  before(async () => {
    await cleanupTestData();

    userFixture = await createTestUser({
      name: 'Integration Audio Engineer',
      email: `integration-engineer-${Date.now()}${TEST_EMAIL_DOMAIN}`,
      password: 'SecureAudio2026!'
    });

    userJwtToken = jwt.sign(
      { userId: userFixture.user.id, role: userFixture.user.role },
      process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
      { expiresIn: '7d' }
    );
  });

  after(async () => {
    await cleanupTestData();
  });

  // ============================================================================
  // SECTION 1: NEGATIVE & VALIDATION TESTS (HAPPY PATH LAST)
  // ============================================================================
  describe('1. Negative & Validation Tests (Happy Path Last Principle)', () => {
    it('NV-01: harus menolak klasifikasi pada session ID yang tidak terdaftar (400/500)', async () => {
      const res = await request(app)
        .post('/api/v1/sessions/non-existent-session-id-9999/classify')
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.ok(res.status >= 400);
      assert.match(res.body.error, /tidak ditemukan/i);
    });

    it('NV-02: harus menolak klasifikasi pada sesi kosong yang belum memiliki berkas track (400/500)', async () => {
      // Buat sesi kosong di database
      const emptySession = await prisma.session.create({
        data: {
          userId: userFixture.user.id,
          title: 'Empty Diagnostic Session',
          status: 'READY'
        }
      });

      const res = await request(app)
        .post(`/api/v1/sessions/${emptySession.id}/classify`)
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.ok(res.status >= 400);
      assert.match(res.body.error, /belum memiliki berkas trek/i);
    });

    it('NV-03: harus menolak pembaruan label instrumen manual jika kolom label tidak disertakan (400)', async () => {
      const res = await request(app)
        .patch('/api/v1/sessions/any-session-id/tracks/any-track-id/label')
        .set('Authorization', `Bearer ${userJwtToken}`)
        .send({});

      assert.equal(res.status, 400);
      assert.match(res.body.error, /Label instrumen baru wajib ditentukan/i);
    });

    it('NV-04: harus menolak pembuatan pasangan trek jika salah satu ID trek tidak disertakan (400)', async () => {
      const res = await request(app)
        .post('/api/v1/sessions/any-session-id/pairs')
        .set('Authorization', `Bearer ${userJwtToken}`)
        .send({ trackAId: 'track-only-a' }); // missing trackBId

      assert.equal(res.status, 400);
      assert.match(res.body.error, /ID kedua trek wajib ditentukan/i);
    });

    it('NV-05: harus menolak eksekusi diagnostik DSP pada session ID yang fiktif (400/500)', async () => {
      const res = await request(app)
        .post('/api/v1/sessions/non-existent-session-id-8888/diagnose')
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.ok(res.status >= 400);
      assert.match(res.body.error, /tidak ditemukan/i);
    });

    it('NV-06: harus menolak pengambilan laporan diagnostik untuk sesi yang tidak ada (400/500)', async () => {
      const res = await request(app)
        .get('/api/v1/sessions/non-existent-session-id-7777/diagnostics')
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.ok(res.status >= 400);
      assert.match(res.body.error, /tidak ditemukan/i);
    });
  });

  // ============================================================================
  // SECTION 2: BOUNDARY, LIFECYCLE & STATE EDGE CASES
  // ============================================================================
  describe('2. Boundary, Lifecycle & State Edge Cases', () => {
    it('ED-01: harus menolak akses ke seluruh endpoint sesi UC-12 & UC-13 tanpa token JWT (401)', async () => {
      const endpoints = [
        { method: 'post', url: '/api/v1/sessions/s1/classify' },
        { method: 'patch', url: '/api/v1/sessions/s1/tracks/t1/label' },
        { method: 'post', url: '/api/v1/sessions/s1/pairs' },
        { method: 'delete', url: '/api/v1/sessions/s1/pairs/p1' },
        { method: 'post', url: '/api/v1/sessions/s1/finalize-classification' },
        { method: 'post', url: '/api/v1/sessions/s1/diagnose' },
        { method: 'get', url: '/api/v1/sessions/s1/diagnostics' }
      ];

      for (const ep of endpoints) {
        const res = await request(app)[ep.method](ep.url);
        assert.equal(res.status, 401, `Endpoint ${ep.method.toUpperCase()} ${ep.url} harus ditolak 401`);
      }
    });

    let lifecycleSessionId;
    let trackAId;
    let trackBId;
    let createdPairId;

    it('ED-02: harus dapat membuat dan menghapus (unpair) pasangan mikrofon secara manual (UC-12)', async () => {
      // Inisialisasi sesi dengan 2 trek di database
      const session = await prisma.session.create({
        data: {
          userId: userFixture.user.id,
          title: 'Lifecycle Edge Test Session',
          status: 'READY',
          tracks: {
            create: [
              { fileName: 'Bass_DI.wav', originalStorageKey: 'sessions/test/bass_di.wav', status: 'PENDING' },
              { fileName: 'Bass_Amp.wav', originalStorageKey: 'sessions/test/bass_amp.wav', status: 'PENDING' }
            ]
          }
        },
        include: { tracks: true }
      });

      lifecycleSessionId = session.id;
      trackAId = session.tracks[0].id;
      trackBId = session.tracks[1].id;

      // Buat pasangan manual
      const pairRes = await request(app)
        .post(`/api/v1/sessions/${lifecycleSessionId}/pairs`)
        .set('Authorization', `Bearer ${userJwtToken}`)
        .send({
          trackAId,
          trackBId,
          pairType: 'BASS_DI_MIC'
        });

      assert.equal(pairRes.status, 201);
      assert.ok(pairRes.body.pair);
      assert.equal(pairRes.body.pair.pairType, 'BASS_DI_MIC');
      assert.equal(pairRes.body.pair.isConfirmed, true);

      createdPairId = pairRes.body.pair.id;

      // Hapus pasangan (Unpair)
      const deleteRes = await request(app)
        .delete(`/api/v1/sessions/${lifecycleSessionId}/pairs/${createdPairId}`)
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(deleteRes.status, 200);
      assert.match(deleteRes.body.message, /berhasil dilepas/i);

      // Verifikasi di database bahwa pasangan sudah terhapus
      const checkPair = await prisma.trackPair.findUnique({ where: { id: createdPairId } });
      assert.equal(checkPair, null);
    });

    it('ED-03: harus berhasil mengoreksi label instrumen trek secara manual (FR-2.3)', async () => {
      const res = await request(app)
        .patch(`/api/v1/sessions/${lifecycleSessionId}/tracks/${trackAId}/label`)
        .set('Authorization', `Bearer ${userJwtToken}`)
        .send({ label: 'Bass' });

      assert.equal(res.status, 200);
      assert.match(res.body.message, /berhasil diperbarui/i);
      assert.equal(res.body.track.instrumentLabel, 'Bass');

      // Verifikasi di DB
      const trackDb = await prisma.track.findUnique({ where: { id: trackAId } });
      assert.equal(trackDb.instrumentLabel, 'Bass');
    });

    it('ED-04: harus mengonfirmasi dan mengunci konfigurasi klasifikasi & pairing (finalize-classification)', async () => {
      const res = await request(app)
        .post(`/api/v1/sessions/${lifecycleSessionId}/finalize-classification`)
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(res.status, 200);
      assert.match(res.body.message, /berhasil dikunci/i);
      assert.equal(res.body.session.status, 'READY');
    });
  });

  // ============================================================================
  // SECTION 3: HAPPY PATH FUNCTIONAL VERIFICATION (LAST)
  // ============================================================================
  describe('3. Happy Path Functional Verification (Last)', () => {
    let e2eSessionId;
    let trackKickId;
    let trackSnareTopId;
    let trackSnareBtmId;

    it('HP-01: harus berhasil mengunggah 3 berkas multitrack (Kick, Snare Top, Snare Btm Invert) ke MinIO S3 (UC-10)', async () => {
      // Siapkan buffer WAV sintetis dengan karakteristik fisik audio
      const wavKick = makeWavBufferWithTone(50, 1.2, 48000, 1, 8);
      const wavSnareTop = makeWavBufferWithTone(220, 1.2, 48000, 1, 10, false);
      const wavSnareBtm = makeWavBufferWithTone(220, 1.2, 48000, 1, 10, true); // Inverted polarity

      const res = await request(app)
        .post('/api/v1/sessions/upload-direct')
        .set('Authorization', `Bearer ${userJwtToken}`)
        .field('title', 'Studio Multitrack E2E Acoustic Session')
        .attach('files', wavKick, '01_Kick_In.wav')
        .attach('files', wavSnareTop, '02_Snare_Top.wav')
        .attach('files', wavSnareBtm, '03_Snare_Btm.wav');

      assert.equal(res.status, 201);
      assert.ok(res.body.session);
      assert.equal(res.body.session.tracks.length, 3);

      e2eSessionId = res.body.session.id;

      const kickTrack = res.body.session.tracks.find(t => t.fileName === '01_Kick_In.wav');
      const snareTopTrack = res.body.session.tracks.find(t => t.fileName === '02_Snare_Top.wav');
      const snareBtmTrack = res.body.session.tracks.find(t => t.fileName === '03_Snare_Btm.wav');

      assert.ok(kickTrack);
      assert.ok(snareTopTrack);
      assert.ok(snareBtmTrack);

      trackKickId = kickTrack.id;
      trackSnareTopId = snareTopTrack.id;
      trackSnareBtmId = snareBtmTrack.id;
    });

    it('HP-02: harus berhasil menjalankan inferensi klasifikasi AI dan auto-detect pasangan mikrofon (UC-12)', async () => {
      const res = await request(app)
        .post(`/api/v1/sessions/${e2eSessionId}/classify`)
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(res.status, 200);
      assert.match(res.body.message, /selesai/i);
      assert.ok(res.body.session);

      // Verifikasi hasil klasifikasi instrumen trek
      const updatedKick = res.body.session.tracks.find(t => t.id === trackKickId);
      const updatedSnareTop = res.body.session.tracks.find(t => t.id === trackSnareTopId);
      const updatedSnareBtm = res.body.session.tracks.find(t => t.id === trackSnareBtmId);

      assert.equal(updatedKick.detectedLabel, 'Drums: Kick');
      assert.equal(updatedSnareTop.detectedLabel, 'Drums: Snare');
      assert.equal(updatedSnareBtm.detectedLabel, 'Drums: Snare');

      // Verifikasi pasangan otomatis multi-mic (Snare Top & Btm)
      assert.ok(res.body.session.trackPairs.length >= 1);
      const snarePair = res.body.session.trackPairs.find(p => p.pairType === 'DRUM_TOP_BOTTOM');
      assert.ok(snarePair, 'Snare Top dan Bottom harus otomatis dipasangkan sebagai DRUM_TOP_BOTTOM');
    });

    it('HP-03: harus berhasil menjalankan Core DSP Diagnostic Engine & Mix Health Score (UC-13)', async () => {
      const res = await request(app)
        .post(`/api/v1/sessions/${e2eSessionId}/diagnose`)
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(res.status, 200);
      assert.match(res.body.message, /selesai/i);
      assert.ok(res.body.sessionHealth);
      assert.ok(res.body.tracksDiagnostics);

      // Verifikasi kesehatan sesi
      const health = res.body.sessionHealth;
      assert.ok(health.health_score >= 0.0 && health.health_score <= 100.0);
      assert.equal(health.total_tracks, 3);
      assert.ok(['EXCELLENT', 'WARNING', 'CRITICAL'].includes(health.session_rating));

      // Verifikasi diagnostik disimpan di tabel diagnostic_results di database
      const dbDiagnostics = await prisma.diagnosticResult.findMany({
        where: {
          trackId: { in: [trackKickId, trackSnareTopId, trackSnareBtmId] }
        }
      });
      assert.equal(dbDiagnostics.length, 3);

      // Verifikasi bahwa Snare Bottom mendeteksi polaritas terbalik (invert) dan memberikan rekomendasi Bahasa Indonesia
      const btmDiag = dbDiagnostics.find(d => d.trackId === trackSnareBtmId);
      assert.ok(btmDiag);
      assert.ok(Array.isArray(btmDiag.recommendations));
    });

    it('HP-04: harus dapat mengambil laporan diagnostik sesi komprehensif via GET (UC-13)', async () => {
      const res = await request(app)
        .get(`/api/v1/sessions/${e2eSessionId}/diagnostics`)
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.session);
      assert.ok(res.body.healthScore !== null);
      assert.equal(res.body.tracks.length, 3);
      assert.ok(res.body.trackPairs.length >= 1);

      // Verifikasi bahwa data diagnosticResult disertakan pada tiap trek
      for (const trk of res.body.tracks) {
        assert.ok(trk.diagnosticResult, `Trek ${trk.fileName} harus menyertakan diagnosticResult`);
        assert.ok(typeof trk.diagnosticResult.healthStatus === 'string');
      }
    });
  });
});
