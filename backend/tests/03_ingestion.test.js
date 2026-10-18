import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import AdmZip from 'adm-zip';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { createTestUser, cleanupTestData, TEST_EMAIL_DOMAIN } from './helpers/testDb.js';

function makeWavBuffer(durationSec = 1.0, sampleRate = 48000, numChannels = 1) {
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

  return buffer;
}

describe('Phase T3: Multitrack Ingestion & Alignment Verification (UC-10, UC-11)', () => {
  let userFixture;
  let userJwtToken;

  before(async () => {
    await cleanupTestData();

    userFixture = await createTestUser({
      name: 'Ingestion & Alignment Engineer',
      email: `ingestion-tester-${Date.now()}${TEST_EMAIL_DOMAIN}`,
      password: 'ProIngestion2026!'
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

  // ==========================================
  // SECTION 1: NEGATIVE & CORRUPTION TESTS FIRST
  // ==========================================
  describe('1. Negative & Corruption Tests (Happy Path Last Principle)', () => {
    it('NV-01: harus menolak upload-init jika daftar file kosong (files: []) (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/sessions/upload-init')
        .set('Authorization', `Bearer ${userJwtToken}`)
        .send({
          title: 'Empty Files Session',
          files: []
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /daftar berkas file audio wajib disertakan/i);
    });

    it('NV-02: harus menolak upload-init jika body tidak menyertakan properti files (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/sessions/upload-init')
        .set('Authorization', `Bearer ${userJwtToken}`)
        .send({
          title: 'No Files Property Session'
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /daftar berkas file audio wajib disertakan/i);
    });

    it('NV-03: harus menolak upload-direct jika tidak ada berkas yang dilampirkan (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/sessions/upload-direct')
        .set('Authorization', `Bearer ${userJwtToken}`)
        .field('title', 'Direct Upload Tanpa Berkas');

      assert.equal(res.status, 400);
      assert.match(res.body.error, /pilih minimal satu berkas audio/i);
    });

    it('NV-04: harus menolak verifikasi integritas pada session ID yang tidak terdaftar (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/sessions/SESSION-NONEXISTENT-999/verify-integrity')
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(res.status, 400);
      assert.match(res.body.error, /sesi tidak ditemukan/i);
    });

    it('NV-05: harus menolak verifikasi integritas pada sesi kosong yang belum memiliki berkas trek (400)', async () => {
      // Buat sesi kosong tanpa track
      const emptySession = await prisma.session.create({
        data: {
          userId: userFixture.user.id,
          title: 'Sesi Tanpa Stem',
          status: 'CREATED'
        }
      });

      const res = await request(app)
        .post(`/api/v1/sessions/${emptySession.id}/verify-integrity`)
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(res.status, 400);
      assert.match(res.body.error, /belum memiliki berkas track audio/i);
    });
  });

  // ==========================================
  // SECTION 2: BOUNDARY & EDGE SYNCHRONIZATION CASES
  // ==========================================
  describe('2. Boundary & Edge Synchronization Cases', () => {
    it('ED-01: harus menolak akses rute sesi tanpa header Authorization (401 Unauthorized)', async () => {
      const res = await request(app).get('/api/v1/sessions');
      assert.equal(res.status, 401);
      assert.match(res.body.error, /token tidak disertakan/i);
    });

    it('ED-02: Boundary Desync: harus mendeteksi selisih durasi > 0.1s dan menandai status WARNING (UC-11)', async () => {
      // Buat sesi dengan 2 track: durasi 1.0s dan 1.35s (selisih 0.35s > toleransi 0.1s)
      const desyncSession = await prisma.session.create({
        data: {
          userId: userFixture.user.id,
          title: 'Sesi Out of Sync Multitrack',
          status: 'READY',
          tracks: {
            create: [
              {
                fileName: 'Kick.wav',
                originalStorageKey: 'dummy-key-1',
                durationSec: 1.0,
                status: 'ANALYZED'
              },
              {
                fileName: 'Snare.wav',
                originalStorageKey: 'dummy-key-2',
                durationSec: 1.35,
                status: 'ANALYZED'
              }
            ]
          }
        }
      });

      const res = await request(app)
        .post(`/api/v1/sessions/${desyncSession.id}/verify-integrity`)
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.verificationSummary.status, 'WARNING');
      assert.equal(res.body.verificationSummary.isZeroAligned, false);
      assert.equal(Math.round(res.body.verificationSummary.durationDeviationSec * 100) / 100, 0.35);
      assert.match(res.body.verificationSummary.message, /terdapat selisih durasi/i);
    });

    it('ED-03: Boundary Sync Tolerance: harus meloloskan selisih durasi <= 0.1s sebagai zero-aligned PASSED (UC-11)', async () => {
      // Buat sesi dengan 2 track: durasi 2.00s dan 2.06s (selisih 0.06s <= toleransi 0.1s)
      const borderSyncSession = await prisma.session.create({
        data: {
          userId: userFixture.user.id,
          title: 'Sesi Borderline Sync Multitrack',
          status: 'READY',
          tracks: {
            create: [
              {
                fileName: 'Bass.wav',
                originalStorageKey: 'dummy-key-3',
                durationSec: 2.00,
                status: 'ANALYZED'
              },
              {
                fileName: 'Guitar.wav',
                originalStorageKey: 'dummy-key-4',
                durationSec: 2.06,
                status: 'ANALYZED'
              }
            ]
          }
        }
      });

      const res = await request(app)
        .post(`/api/v1/sessions/${borderSyncSession.id}/verify-integrity`)
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.verificationSummary.status, 'PASSED');
      assert.equal(res.body.verificationSummary.isZeroAligned, true);
      assert.match(res.body.verificationSummary.message, /selaras sempurna \(zero-aligned\)/i);
    });
  });

  // ==========================================
  // SECTION 3: HAPPY PATH VERIFICATION LAST
  // ==========================================
  describe('3. Happy Path Functional Verification (Last)', () => {
    let initSessionId;

    it('HP-01: harus berhasil menginisialisasi sesi dan menerbitkan Presigned Upload URL untuk tiap stem (UC-10)', async () => {
      const filesMetadata = [
        { name: '01_Kick.wav', fileName: '01_Kick.wav', size: 500000, type: 'audio/wav' },
        { name: '02_Snare.wav', fileName: '02_Snare.wav', size: 450000, type: 'audio/wav' }
      ];

      const res = await request(app)
        .post('/api/v1/sessions/upload-init')
        .set('Authorization', `Bearer ${userJwtToken}`)
        .send({
          title: 'Presigned S3 Session Ingestion',
          files: filesMetadata
        });

      assert.equal(res.status, 201);
      assert.ok(res.body.session);
      assert.equal(res.body.session.title, 'Presigned S3 Session Ingestion');
      assert.equal(res.body.session.status, 'UPLOADING');
      assert.ok(Array.isArray(res.body.presignedUrls));
      assert.equal(res.body.presignedUrls.length, 2);
      assert.ok(res.body.presignedUrls[0].uploadUrl);
      assert.equal(res.body.presignedUrls[0].fileName, '01_Kick.wav');

      initSessionId = res.body.session.id;

      // Verifikasi di database
      const dbTracks = await prisma.track.findMany({ where: { sessionId: initSessionId } });
      assert.equal(dbTracks.length, 2);
    });

    let directSessionId;

    it('HP-02: harus berhasil mengunggah berkas WAV multitrack langsung, streaming ke MinIO S3, dan mengekstrak metadata (UC-10)', async () => {
      const wavKick = makeWavBuffer(1.5, 48000, 1);
      const wavSnare = makeWavBuffer(1.5, 48000, 1);

      const res = await request(app)
        .post('/api/v1/sessions/upload-direct')
        .set('Authorization', `Bearer ${userJwtToken}`)
        .field('title', 'Direct Multi-Stem Ingestion')
        .attach('files', wavKick, 'Direct_Kick.wav')
        .attach('files', wavSnare, 'Direct_Snare.wav');

      assert.equal(res.status, 201);
      assert.match(res.body.message, /berhasil diunggah dan disimpan ke MinIO/i);
      assert.ok(res.body.session);
      assert.equal(res.body.session.status, 'READY');
      assert.equal(res.body.session.tracks.length, 2);

      directSessionId = res.body.session.id;

      // Verifikasi durasi metadata terekstraksi
      const track1 = res.body.session.tracks[0];
      assert.ok(track1.durationSec > 1.4 && track1.durationSec < 1.6);
      assert.ok(track1.originalStorageKey.startsWith(`sessions/${directSessionId}/raw/`));
    });

    it('HP-03: harus berhasil mengekstrak berkas multitrack dari arsip ZIP dan menyimpannya ke MinIO S3 (UC-10)', async () => {
      // Buat ZIP berisi 2 stem WAV
      const zip = new AdmZip();
      zip.addFile('Stem_01_Guitar.wav', makeWavBuffer(1.2, 48000, 2));
      zip.addFile('Stem_02_Vocal.wav', makeWavBuffer(1.2, 48000, 1));
      const zipBuffer = zip.toBuffer();

      const res = await request(app)
        .post('/api/v1/sessions/upload-direct')
        .set('Authorization', `Bearer ${userJwtToken}`)
        .field('title', 'ZIP Multitrack Ingestion')
        .attach('files', zipBuffer, 'multitrack_session.zip');

      assert.equal(res.status, 201);
      assert.ok(res.body.session);
      assert.equal(res.body.session.tracks.length, 2);

      const fileNames = res.body.session.tracks.map((t) => t.fileName);
      assert.ok(fileNames.includes('Stem_01_Guitar.wav'));
      assert.ok(fileNames.includes('Stem_02_Vocal.wav'));
    });

    it('HP-04: harus memverifikasi sesi zero-aligned secara utuh dan memberikan hasil PASSED (UC-11)', async () => {
      const res = await request(app)
        .post(`/api/v1/sessions/${directSessionId}/verify-integrity`)
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.verificationSummary.status, 'PASSED');
      assert.equal(res.body.verificationSummary.isZeroAligned, true);
      assert.equal(res.body.verificationSummary.totalTracks, 2);
      assert.ok(res.body.verificationSummary.durationDeviationSec <= 0.1);
    });

    it('HP-05: harus dapat mengambil daftar seluruh sesi pengguna dan rincian spesifik sesi (UC-09)', async () => {
      // 1. List user sessions
      const listRes = await request(app)
        .get('/api/v1/sessions')
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(listRes.status, 200);
      assert.ok(Array.isArray(listRes.body.sessions));
      assert.ok(listRes.body.sessions.length >= 2);

      // 2. Get specific session details
      const detailRes = await request(app)
        .get(`/api/v1/sessions/${directSessionId}`)
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(detailRes.status, 200);
      assert.equal(detailRes.body.session.id, directSessionId);
      assert.equal(detailRes.body.session.tracks.length, 2);
    });

    it('HP-06: harus dapat mengubah judul sesi (Rename Session)', async () => {
      // 1. Valid rename
      const res = await request(app)
        .patch(`/api/v1/sessions/${directSessionId}/title`)
        .set('Authorization', `Bearer ${userJwtToken}`)
        .send({ title: 'New Mixing Session Mastered' });

      assert.equal(res.status, 200);
      assert.equal(res.body.session.title, 'New Mixing Session Mastered');

      // 2. Reject empty title
      const emptyRes = await request(app)
        .patch(`/api/v1/sessions/${directSessionId}/title`)
        .set('Authorization', `Bearer ${userJwtToken}`)
        .send({ title: '   ' });

      assert.equal(emptyRes.status, 400);
    });

    it('HP-07: harus dapat menghapus sesi multitrack beserta seluruh relasinya (Delete Session)', async () => {
      // 1. Delete session
      const res = await request(app)
        .delete(`/api/v1/sessions/${directSessionId}`)
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.message, 'Sesi berhasil dihapus');

      // 2. Verifikasi sesi tidak ditemukan lagi
      const checkRes = await request(app)
        .get(`/api/v1/sessions/${directSessionId}`)
        .set('Authorization', `Bearer ${userJwtToken}`);

      assert.equal(checkRes.status, 404);
    });
  });
});
