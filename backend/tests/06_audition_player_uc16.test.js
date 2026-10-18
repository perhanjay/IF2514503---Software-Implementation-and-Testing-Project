import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { createTestUser, cleanupTestData, TEST_EMAIL_DOMAIN } from './helpers/testDb.js';

describe('Phase 6 (Part 1): A/B Multitrack Auditioning Player Audio Sources (UC-16)', () => {
  let userFixture;
  let userJwtToken;
  let otherUserFixture;
  let otherUserJwtToken;
  let testSession;
  let testTrack;

  before(async () => {
    await cleanupTestData();

    userFixture = await createTestUser({
      name: 'Audition Engineer',
      email: `audition-${Date.now()}${TEST_EMAIL_DOMAIN}`,
      password: 'SecureAudition2026!'
    });

    userJwtToken = jwt.sign(
      { userId: userFixture.user.id, role: userFixture.user.role },
      process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
      { expiresIn: '7d' }
    );

    otherUserFixture = await createTestUser({
      name: 'Intruder Engineer',
      email: `intruder-${Date.now()}${TEST_EMAIL_DOMAIN}`,
      password: 'SecureIntruder2026!'
    });

    otherUserJwtToken = jwt.sign(
      { userId: otherUserFixture.user.id, role: otherUserFixture.user.role },
      process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
      { expiresIn: '7d' }
    );

    // Buat sesi dengan track yang memiliki raw dan repaired key
    testSession = await prisma.session.create({
      data: {
        userId: userFixture.user.id,
        title: 'Session Audition A/B Test',
        status: 'REPAIRED',
        healthScore: 98.0,
        sampleRate: 48000,
        bitDepth: 24
      }
    });

    testTrack = await prisma.track.create({
      data: {
        sessionId: testSession.id,
        fileName: '01_Snare.wav',
        originalStorageKey: `sessions/${testSession.id}/raw/01_Snare.wav`,
        repairedStorageKey: `sessions/${testSession.id}/repaired/FIXED_01_Snare.wav`,
        instrumentLabel: 'Drums: Snare',
        isStereo: true,
        durationSec: 3.5,
        status: 'REPAIRED'
      }
    });

    await prisma.diagnosticResult.create({
      data: {
        trackId: testTrack.id,
        phaseCorrelation: 0.95,
        hasPolarityInvert: false,
        healthStatus: 'Clean'
      }
    });
  });

  after(async () => {
    await cleanupTestData();
  });

  describe('1. Negative & Authorization Tests', () => {
    it('TC-AUD-NEG-01: harus menolak akses tanpa token autentikasi JWT (401)', async () => {
      const res = await request(app)
        .get(`/api/v1/sessions/${testSession.id}/audio-sources`);

      assert.equal(res.status, 401);
    });

    it('TC-AUD-NEG-02: harus menolak pengambilan audio sources untuk session ID fiktif (404)', async () => {
      const res = await request(app)
        .get('/api/v1/sessions/fictional-session-uuid-9999/audio-sources')
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(res.status, 404);
      assert.match(res.body.error, /tidak ditemukan/i);
    });

    it('TC-AUD-NEG-03: harus menolak akses jika sesi dimiliki oleh user lain (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/sessions/${testSession.id}/audio-sources`)
        .set('Authorization', `Bearer ${otherUserJwtToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error, /Akses ditolak/i);
    });
  });

  describe('2. Happy Path Audio Sources Streaming Retrieval', () => {
    it('TC-AUD-HP-01: harus mengembalikan presigned rawAudioUrl dan repairedAudioUrl yang valid', async () => {
      const res = await request(app)
        .get(`/api/v1/sessions/${testSession.id}/audio-sources`)
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.session.id, testSession.id);
      assert.equal(res.body.session.title, 'Session Audition A/B Test');
      assert.equal(res.body.session.status, 'REPAIRED');

      assert.equal(res.body.tracks.length, 1);
      const track = res.body.tracks[0];
      assert.equal(track.id, testTrack.id);
      assert.equal(track.fileName, '01_Snare.wav');
      assert.equal(track.isStereo, true);
      assert.equal(track.instrumentLabel, 'Drums: Snare');

      // Verifikasi keberadaan URL presigned S3
      assert.ok(track.rawAudioUrl);
      assert.match(track.rawAudioUrl, /^http:\/\/localhost:9000\/polaris-audio-stems\//);
      assert.match(track.rawAudioUrl, /X-Amz-Signature=/);

      assert.ok(track.repairedAudioUrl);
      assert.match(track.repairedAudioUrl, /^http:\/\/localhost:9000\/polaris-audio-stems\//);
      assert.match(track.repairedAudioUrl, /FIXED_01_Snare\.wav/);

      // Verifikasi keberadaan diagnostic
      assert.ok(track.diagnostic);
      assert.equal(track.diagnostic.healthStatus, 'Clean');
    });
  });
});
