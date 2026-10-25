import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import AdmZip from 'adm-zip';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { createTestUser, cleanupTestData, TEST_EMAIL_DOMAIN } from './helpers/testDb.js';

function makeWavBuffer(durationSec = 0.5, sampleRate = 48000, numChannels = 1) {
  const numSamples = Math.floor(durationSec * sampleRate);
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Chunk Descriptor
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // "fmt " sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat 1 = PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28); // ByteRate
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // "data" sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

describe('Paket 2: Validasi Input & Pencegahan HTTP 500 (16 Kasus Blackbox)', () => {
  let userFixture;
  let userToken;
  let activeSession;
  let trackA;
  let trackB;
  let testPair;

  before(async () => {
    await cleanupTestData();

    userFixture = await createTestUser({
      name: 'Validating Audio Engineer',
      email: `validator-${Date.now()}${TEST_EMAIL_DOMAIN}`,
      password: 'SecurePassword2026!',
      role: 'AUDIO_ENGINEER',
      balance: 10
    });

    userToken = jwt.sign(
      { userId: userFixture.user.id, role: userFixture.user.role },
      process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
      { expiresIn: '7d' }
    );

    activeSession = await prisma.session.create({
      data: {
        userId: userFixture.user.id,
        title: 'Paket 2 Validation Session',
        status: 'READY',
        estimatedTokens: 1,
        sampleRate: 48000,
        bitDepth: 24
      }
    });

    trackA = await prisma.track.create({
      data: {
        sessionId: activeSession.id,
        fileName: '01_Kick_In.wav',
        originalStorageKey: `sessions/${activeSession.id}/raw/01_Kick_In.wav`,
        instrumentLabel: 'Drums: Kick',
        durationSec: 5.0,
        status: 'ANALYZED'
      }
    });

    trackB = await prisma.track.create({
      data: {
        sessionId: activeSession.id,
        fileName: '02_Kick_Out.wav',
        originalStorageKey: `sessions/${activeSession.id}/raw/02_Kick_Out.wav`,
        instrumentLabel: 'Drums: Kick',
        durationSec: 5.0,
        status: 'ANALYZED'
      }
    });

    testPair = await prisma.trackPair.create({
      data: {
        sessionId: activeSession.id,
        trackAId: trackA.id,
        trackBId: trackB.id,
        pairType: 'MIC_PAIR',
        isConfirmed: true
      }
    });
  });

  after(async () => {
    await cleanupTestData();
  });

  // ============================================================================
  // 1. REGISTRASI PENGGUNA (POST /api/v1/auth/register)
  // ============================================================================
  describe('1. Registrasi Pengguna (POST /api/v1/auth/register)', () => {
    it('TC-VAL-01 (Row 11): harus menolak format email salah tanpa @ dan domain (400)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Sound Engineer',
          email: 'bukan-email-123',
          password: 'Password123'
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /format email tidak valid/i);
    });

    it('TC-VAL-02 (Row 12): harus menolak email tanpa TLD valid (misal a123@b atau test@domain) (400)', async () => {
      const res1 = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Sound Engineer',
          email: 'a123@b',
          password: 'Password123'
        });

      assert.equal(res1.status, 400);
      assert.match(res1.body.error, /format email tidak valid/i);

      const res2 = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Sound Engineer',
          email: 'engineer@localhost',
          password: 'Password123'
        });

      assert.equal(res2.status, 400);
      assert.match(res2.body.error, /format email tidak valid/i);
    });

    it('TC-VAL-03 (Row 13): harus menolak nama yang melebihi batas maksimal 255 karakter (400)', async () => {
      const longName = 'A'.repeat(256);
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: longName,
          email: `longname-${Date.now()}${TEST_EMAIL_DOMAIN}`,
          password: 'Password123'
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /255 karakter/i);
    });

    it('TC-VAL-04 (Row 15): harus menolak nama yang mengandung karakter/tag HTML berbahaya (XSS) (400)', async () => {
      const xssName = '<script>alert(1)</script>';
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: xssName,
          email: `xss-${Date.now()}${TEST_EMAIL_DOMAIN}`,
          password: 'Password123'
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /html|berbahaya/i);
    });
  });

  // ============================================================================
  // 2. PROFIL PENGGUNA (PATCH /api/v1/auth/profile dan PUT /api/v1/auth/profile)
  // ============================================================================
  describe('2. Profil Pengguna (PATCH & PUT /api/v1/auth/profile)', () => {
    it('TC-VAL-05 (Row 39): harus menolak jika name bukan string dengan HTTP 400 "Nama lengkap harus berupa teks"', async () => {
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 12345 });

      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'Nama lengkap harus berupa teks');
    });

    it('TC-VAL-06 (Row 40): route alias PATCH /api/v1/auth/profile harus tersedia dan berfungsi normal (200)', async () => {
      const newName = 'Senior Mixing Consultant';
      const res = await request(app)
        .patch('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: newName });

      assert.equal(res.status, 200);
      assert.equal(res.body.message, 'Profil berhasil diperbarui');
      assert.equal(res.body.user.name, newName);

      const dbUser = await prisma.user.findUnique({ where: { id: userFixture.user.id } });
      assert.equal(dbUser.name, newName);
    });
  });

  // ============================================================================
  // 3. INGESTI & UNGGAH BERKAS (POST /api/v1/sessions/upload-direct)
  // ============================================================================
  describe('3. Ingesti & Unggah Berkas (POST /api/v1/sessions/upload-direct)', () => {
    it('TC-VAL-07 (Row 124): harus menolak unggah berkas non-audio dengan HTTP 400 "Format berkas tidak didukung"', async () => {
      const res = await request(app)
        .post('/api/v1/sessions/upload-direct')
        .set('Authorization', `Bearer ${userToken}`)
        .field('title', 'Non Audio Upload Attempt')
        .attach('files', Buffer.from('This is a text documentation file'), 'readme.txt');

      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'Format berkas tidak didukung');
    });

    it('TC-VAL-08 (Row 126): harus menolak berkas WAV korup dengan HTTP 400 "Berkas audio rusak atau korup"', async () => {
      const corruptWavBuffer = Buffer.from('RIFFcorrupted_garbage_bytes_without_proper_wave_header');

      const res = await request(app)
        .post('/api/v1/sessions/upload-direct')
        .set('Authorization', `Bearer ${userToken}`)
        .field('title', 'Corrupt WAV Upload')
        .attach('files', corruptWavBuffer, 'corrupt.wav');

      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'Berkas audio rusak atau korup');
    });

    it('TC-VAL-09 (Row 130): harus menolak ZIP tanpa berkas audio dengan HTTP 400 "Arsip ZIP tidak memuat berkas audio yang didukung"', async () => {
      const emptyZip = new AdmZip();
      emptyZip.addFile('notes.txt', Buffer.from('No audio files inside this archive'));
      const zipBuffer = emptyZip.toBuffer();

      const res = await request(app)
        .post('/api/v1/sessions/upload-direct')
        .set('Authorization', `Bearer ${userToken}`)
        .field('title', 'Empty Audio Zip Upload')
        .attach('files', zipBuffer, 'empty_session.zip');

      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'Arsip ZIP tidak memuat berkas audio yang didukung');
    });

    it('TC-VAL-09b: harus menolak berkas ZIP yang rusak/korup dengan HTTP 400 tanpa crash HTTP 500', async () => {
      const corruptZipBuffer = Buffer.from('PK\x03\x04corrupted_zip_payload_with_invalid_central_directory');

      const res = await request(app)
        .post('/api/v1/sessions/upload-direct')
        .set('Authorization', `Bearer ${userToken}`)
        .field('title', 'Corrupted Zip Upload')
        .attach('files', corruptZipBuffer, 'corrupted.zip');

      assert.equal(res.status, 400);
      assert.match(res.body.error, /Arsip ZIP tidak memuat berkas audio/i);
    });

    it('TC-VAL-10 (Row 131): harus menolak unggah melebihi batas 50 file dengan HTTP 400 "Maksimal 50 berkas audio per sesi"', async () => {
      const req = request(app)
        .post('/api/v1/sessions/upload-direct')
        .set('Authorization', `Bearer ${userToken}`)
        .field('title', 'Massive Stem Upload 51 Files');

      const dummyAudio = makeWavBuffer(0.1, 48000, 1);
      for (let i = 1; i <= 51; i++) {
        req.attach('files', dummyAudio, `stem_${i}.wav`);
      }

      const res = await req;
      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'Maksimal 50 berkas audio per sesi');
    });
  });

  // ============================================================================
  // 4. PASANGAN TREK / PAIRING (POST & DELETE /api/v1/sessions/:id/pairs)
  // ============================================================================
  describe('4. Pasangan Trek / Pairing (POST & DELETE /api/v1/sessions/:id/pairs)', () => {
    it('TC-VAL-11 (Row 159): self-pairing harus ditolak dengan HTTP 400 "Trek tidak dapat dipasangkan dengan dirinya sendiri"', async () => {
      const res = await request(app)
        .post(`/api/v1/sessions/${activeSession.id}/pairs`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          trackAId: trackA.id,
          trackBId: trackA.id,
          pairType: 'MIC_PAIR'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'Trek tidak dapat dipasangkan dengan dirinya sendiri');
    });

    it('TC-VAL-12 (Row 162): pairType tidak valid harus ditolak dengan HTTP 400 "Tipe pasangan instrumen tidak valid"', async () => {
      const res = await request(app)
        .post(`/api/v1/sessions/${activeSession.id}/pairs`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          trackAId: trackA.id,
          trackBId: trackB.id,
          pairType: 'INVALID_SYNTH_PAIR_TYPE'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'Tipe pasangan instrumen tidak valid');
    });

    it('TC-VAL-13 (Row 169): format UUID tidak valid pada pairId atau sessionId harus ditangani 400/404 tanpa HTTP 500', async () => {
      // 1. Invalid UUID on sessionId
      const res1 = await request(app)
        .post('/api/v1/sessions/invalid-uuid-session-123/pairs')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          trackAId: trackA.id,
          trackBId: trackB.id,
          pairType: 'MIC_PAIR'
        });

      assert.ok(res1.status === 400 || res1.status === 404);
      assert.notEqual(res1.status, 500);

      // 2. Invalid UUID on pairId
      const res2 = await request(app)
        .delete(`/api/v1/sessions/${activeSession.id}/pairs/not-a-valid-pair-uuid`)
        .set('Authorization', `Bearer ${userToken}`);

      assert.ok(res2.status === 400 || res2.status === 404);
      assert.notEqual(res2.status, 500);
    });
  });

  // ============================================================================
  // 5. PENANGANAN UUID TIDAK DIKENAL PADA OPERASI SESI
  // ============================================================================
  describe('5. Penanganan UUID Tidak Dikenal pada Operasi Sesi', () => {
    const unknownSessionUuid = '00000000-0000-0000-0000-000000000000';

    it('TC-VAL-14 (Row 189): POST /classify dengan UUID tidak dikenal harus mengembalikan HTTP 404 "Sesi tidak ditemukan"', async () => {
      const res = await request(app)
        .post(`/api/v1/sessions/${unknownSessionUuid}/classify`)
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.error, 'Sesi tidak ditemukan');
    });

    it('TC-VAL-15 (Row 194): POST /pairs/ai dengan UUID tidak dikenal harus mengembalikan HTTP 404 "Sesi tidak ditemukan"', async () => {
      const res = await request(app)
        .post(`/api/v1/sessions/${unknownSessionUuid}/pairs/ai`)
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.error, 'Sesi tidak ditemukan');
    });

    it('TC-VAL-16 (Row 210): POST /diagnose dengan UUID tidak dikenal harus mengembalikan HTTP 404 "Sesi tidak ditemukan"', async () => {
      const res = await request(app)
        .post(`/api/v1/sessions/${unknownSessionUuid}/diagnose`)
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.error, 'Sesi tidak ditemukan');
    });
  });

  // ============================================================================
  // 6. PERBAIKAN KUSTOM (POST /api/v1/sessions/:id/repair-custom)
  // ============================================================================
  describe('6. Perbaikan Kustom (POST /api/v1/sessions/:id/repair-custom)', () => {
    it('TC-VAL-17 (Row 240): body tanpa customSettings atau kosong {} harus ditolak dengan HTTP 400', async () => {
      // 1. Missing customSettings property
      const resMissing = await request(app)
        .post(`/api/v1/sessions/${activeSession.id}/repair-custom`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      assert.equal(resMissing.status, 400);
      assert.equal(resMissing.body.error, 'Konfigurasi perbaikan kustom (customSettings) wajib disertakan');

      // 2. Empty customSettings object
      const resEmpty = await request(app)
        .post(`/api/v1/sessions/${activeSession.id}/repair-custom`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ customSettings: {} });

      assert.equal(resEmpty.status, 400);
      assert.equal(resEmpty.body.error, 'Konfigurasi perbaikan kustom (customSettings) wajib disertakan');

      // 3. Non-object customSettings
      const resInvalidType = await request(app)
        .post(`/api/v1/sessions/${activeSession.id}/repair-custom`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ customSettings: 'invalid_string' });

      assert.equal(resInvalidType.status, 400);
      assert.equal(resInvalidType.body.error, 'Konfigurasi perbaikan kustom (customSettings) wajib disertakan');
    });
  });
});
