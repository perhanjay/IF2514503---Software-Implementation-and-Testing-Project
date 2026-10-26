import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { createTestUser, cleanupTestData, TEST_EMAIL_DOMAIN } from './helpers/testDb.js';
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
    const sampleVal = Math.sin(2 * Math.PI * freq * t) * 0.7;
    const intVal = Math.floor(sampleVal * 32767);
    buffer.writeInt16LE(intVal, 44 + i * 2);
  }

  return buffer;
}

describe('Paket 5: Reaktivitas UI & Feedback Visual (5 Kasus)', () => {
  let user;
  let userToken;
  let session;
  let trackKick;
  let trackSnare;

  before(async () => {
    await cleanupTestData();
    const testEmail = `paket5_${Date.now()}${TEST_EMAIL_DOMAIN}`;
    const userFixture = await createTestUser({
      name: 'Paket 5 Test User',
      email: testEmail,
      password: 'Password123!',
      balance: 20
    });
    user = userFixture.user;
    userToken = jwt.sign(
      { userId: user.id, role: user.role, authTime: Date.now() },
      process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
      { expiresIn: '7d' }
    );

    // Buat dummy audio di S3
    const kickBuf = makeWavBuffer(60, 0.3);
    const snareBuf = makeWavBuffer(200, 0.3);
    const kickKey = `test/paket5/kick_${Date.now()}.wav`;
    const snareKey = `test/paket5/snare_${Date.now()}.wav`;

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: kickKey,
      Body: kickBuf,
      ContentType: 'audio/wav'
    }));

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: snareKey,
      Body: snareBuf,
      ContentType: 'audio/wav'
    }));

    // Buat sesi
    session = await prisma.session.create({
      data: {
        userId: user.id,
        title: 'Paket 5 Reactivity Session',
        status: 'READY',
        healthScore: 62.0,
        tracks: {
          create: [
            {
              fileName: '01_Kick_In.wav',
              originalStorageKey: kickKey,
              isStereo: false,
              durationSec: 0.3,
              status: 'PENDING'
            },
            {
              fileName: '02_Snare_Top.wav',
              originalStorageKey: snareKey,
              isStereo: false,
              durationSec: 0.3,
              status: 'PENDING'
            }
          ]
        }
      },
      include: { tracks: true }
    });

    trackKick = session.tracks.find(t => t.fileName === '01_Kick_In.wav');
    trackSnare = session.tracks.find(t => t.fileName === '02_Snare_Top.wav');
  });

  after(async () => {
    await cleanupTestData();
  });

  it('TC-PAKET5-01 (Row 202): AI Classification harus menyimpan skor confidence aktual di waveformPeaksJson', async () => {
    const res = await request(app)
      .post(`/api/v1/sessions/${session.id}/classify`)
      .set('Authorization', `Bearer ${userToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.session);

    // Ambil data track dari database
    const dbKick = await prisma.track.findUnique({ where: { id: trackKick.id } });
    const dbSnare = await prisma.track.findUnique({ where: { id: trackSnare.id } });

    assert.ok(dbKick.waveformPeaksJson, 'waveformPeaksJson harus tersimpan');
    assert.ok(dbSnare.waveformPeaksJson, 'waveformPeaksJson harus tersimpan');

    const kickConf = dbKick.waveformPeaksJson.confidence;
    const snareConf = dbSnare.waveformPeaksJson.confidence;

    assert.notEqual(kickConf, undefined, 'Kick confidence tidak boleh undefined');
    assert.notEqual(snareConf, undefined, 'Snare confidence tidak boleh undefined');
    assert.ok(typeof kickConf === 'number' && kickConf >= 0.5 && kickConf <= 1.0, `Kick confidence harus valid (${kickConf})`);
    assert.ok(typeof snareConf === 'number' && snareConf >= 0.5 && snareConf <= 1.0, `Snare confidence harus valid (${snareConf})`);
  });

  it('TC-PAKET5-02 (Row 203): Ubah label trek lalu simpan harus memperbarui instrumentLabel tanpa menghapus detectedLabel dan confidence', async () => {
    const patchRes = await request(app)
      .patch(`/api/v1/sessions/${session.id}/tracks/${trackSnare.id}/label`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ label: 'Drums: Kick' });

    assert.equal(patchRes.status, 200);

    const dbTrack = await prisma.track.findUnique({ where: { id: trackSnare.id } });
    assert.equal(dbTrack.instrumentLabel, 'Drums: Kick', 'instrumentLabel harus diperbarui ke label baru');
    assert.equal(dbTrack.detectedLabel, 'Drums: Snare', 'detectedLabel asli dari AI harus tetap utuh');
    assert.ok(dbTrack.waveformPeaksJson?.confidence, 'Confidence di waveformPeaksJson harus tetap tersimpan');

    // Kembalikan label ke Snare
    await request(app)
      .patch(`/api/v1/sessions/${session.id}/tracks/${trackSnare.id}/label`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ label: 'Drums: Snare' });
  });

  it('TC-PAKET5-03: Jalankan diagnostik DSP untuk menyiapkan data pra-perbaikan', async () => {
    const res = await request(app)
      .post(`/api/v1/sessions/${session.id}/diagnose`)
      .set('Authorization', `Bearer ${userToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.sessionHealth);
    assert.ok(typeof res.body.sessionHealth.health_score === 'number');
  });

  it('TC-PAKET5-04 (Row 254): Perbaikan kustom/otomatis harus mengembalikan status REPAIRED dengan health_score optimal (~98) dan status EXCELLENT', async () => {
    const res = await request(app)
      .post(`/api/v1/sessions/${session.id}/repair-custom`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        customSettings: {
          [trackKick.id]: { removeDcOffset: true, filterSubRumble: true },
          [trackSnare.id]: { removeDcOffset: true, gainStaging: true }
        }
      });

    assert.equal(res.status, 200);
    assert.ok(res.body.session);
    assert.equal(res.body.session.status, 'REPAIRED');
    assert.ok(res.body.session.healthScore >= 95, `healthScore harus >= 95 (aktual: ${res.body.session.healthScore})`);

    // Pastikan sessionHealth pasca-perbaikan dikembalikan di respons
    assert.ok(res.body.sessionHealth);
    assert.equal(res.body.sessionHealth.health_score, 98.0);
    assert.equal(res.body.sessionHealth.status, 'EXCELLENT');
    assert.equal(res.body.sessionHealth.warning_tracks, 0);
    assert.equal(res.body.sessionHealth.critical_tracks, 0);

    // Verifikasi database mencerminkan status REPAIRED
    const updatedDbSession = await prisma.session.findUnique({
      where: { id: session.id },
      include: { tracks: true }
    });
    assert.equal(updatedDbSession.status, 'REPAIRED');
    assert.equal(updatedDbSession.healthScore, 98.0);
  });
});
