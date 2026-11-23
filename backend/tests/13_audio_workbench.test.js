import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import AdmZip from 'adm-zip';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import redis, { isRedisReady } from '../src/config/redis.js';
import { s3Client, BUCKET_NAME, ensureBucketExists } from '../src/config/s3.js';
import { createTestUser, cleanupTestData, TEST_EMAIL_DOMAIN } from './helpers/testDb.js';

function makeWavBuffer({
  sampleRate = 48000,
  durationSec = 1.0,
  leadSilenceSec = 0,
  tailSilenceSec = 0,
  freq = 440,
  amp = 0.5,
  channels = 2
} = {}) {
  const totalSamples = Math.floor(durationSec * sampleRate);
  const leadSamples = Math.floor(leadSilenceSec * sampleRate);
  const tailSamples = Math.floor(tailSilenceSec * sampleRate);
  const activeEnd = Math.max(leadSamples, totalSamples - tailSamples);
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = totalSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);

  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    let sampleFloat = 0;
    if (i >= leadSamples && i < activeEnd && amp > 0) {
      sampleFloat = amp * Math.sin((2 * Math.PI * freq * i) / sampleRate);
    }
    const sampleInt = Math.max(-32768, Math.min(32767, Math.round(sampleFloat * 32767)));
    for (let ch = 0; ch < channels; ch++) {
      buffer.writeInt16LE(sampleInt, offset);
      offset += 2;
    }
  }

  return buffer;
}

function makeMultiBurstWavBuffer({
  sampleRate = 48000,
  durationSec = 2.0,
  bursts = [
    { startSec: 0.2, endSec: 0.7, freq: 440 },
    { startSec: 1.2, endSec: 1.7, freq: 660 }
  ],
  amp = 0.6,
  channels = 2
} = {}) {
  const totalSamples = Math.floor(durationSec * sampleRate);
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = totalSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);

  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const active = bursts.find((b) => t >= b.startSec && t < b.endSec);
    const sampleFloat = active ? amp * Math.sin(2 * Math.PI * active.freq * t) : 0;
    const sampleInt = Math.max(-32768, Math.min(32767, Math.round(sampleFloat * 32767)));
    for (let ch = 0; ch < channels; ch++) {
      buffer.writeInt16LE(sampleInt, offset);
      offset += 2;
    }
  }

  return buffer;
}

async function pollJobUntilDone(token, jobId, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await request(app)
      .get(`/api/v1/workbench/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 200);
    if (res.body.status === 'COMPLETED' || res.body.status === 'FAILED') {
      return res.body;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for workbench job ${jobId}`);
}

const binaryParser = (res, callback) => {
  res.setEncoding('binary');
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    callback(null, Buffer.from(data, 'binary'));
  });
};

describe('Audio Workbench API (Stem Separator, Asset Splitter, & Session Bridge)', () => {
  let userA;
  let userB;
  let adminUser;
  let tokenA;
  let tokenB;
  let adminToken;
  const createdJobIds = [];
  const createdSplitIds = [];

  before(async () => {
    process.env.POLARIS_FAST_STEM_MODE = '1';
    await cleanupTestData();
    await ensureBucketExists();
    await isRedisReady();

    const secret = process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl';

    userA = await createTestUser({
      name: 'Workbench Engineer A',
      email: `wb-eng-a-${Date.now()}${TEST_EMAIL_DOMAIN}`
    });
    tokenA = jwt.sign({ userId: userA.user.id, role: userA.user.role }, secret, { expiresIn: '1d' });

    userB = await createTestUser({
      name: 'Workbench Engineer B',
      email: `wb-eng-b-${Date.now()}${TEST_EMAIL_DOMAIN}`
    });
    tokenB = jwt.sign({ userId: userB.user.id, role: userB.user.role }, secret, { expiresIn: '1d' });

    adminUser = await createTestUser({
      name: 'Workbench Admin',
      email: `wb-admin-${Date.now()}${TEST_EMAIL_DOMAIN}`,
      role: 'ADMIN'
    });
    adminToken = jwt.sign({ userId: adminUser.user.id, role: adminUser.user.role }, secret, { expiresIn: '1d' });
  });

  after(async () => {
    for (const jobId of createdJobIds) {
      try {
        await redis.del(`workbench:job:${jobId}`);
      } catch {
        // Ignore cleanup errors
      }
    }
    for (const splitId of createdSplitIds) {
      try {
        await redis.del(`workbench:split:${splitId}`);
      } catch {
        // Ignore cleanup errors
      }
    }
    await cleanupTestData();
    if (redis.status === 'ready' || redis.status === 'connecting') {
      await redis.quit();
    }
    await prisma.$disconnect();
    s3Client.destroy();
  });

  describe('1. Auth & Role Guards', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res1 = await request(app).post('/api/v1/workbench/separate');
      assert.equal(res1.status, 401);

      const res2 = await request(app).get('/api/v1/workbench/jobs/00000000-0000-0000-0000-000000000000');
      assert.equal(res2.status, 401);

      const res3 = await request(app).post('/api/v1/workbench/split').send({});
      assert.equal(res3.status, 401);

      const res4 = await request(app).get('/api/v1/workbench/splits/00000000-0000-0000-0000-000000000000/download-zip');
      assert.equal(res4.status, 401);
    });

    it('rejects ADMIN role requests with 403', async () => {
      const wav = makeWavBuffer({ durationSec: 0.5 });

      const res1 = await request(app)
        .post('/api/v1/workbench/separate')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('audio', wav, 'admin_test.wav');
      assert.equal(res1.status, 403);

      const res2 = await request(app)
        .get('/api/v1/workbench/jobs/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(res2.status, 403);

      const res3 = await request(app)
        .post('/api/v1/workbench/split')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('regions', JSON.stringify([{ name: 'part_1', startSec: 0, endSec: 0.3 }]))
        .attach('audio', wav, 'admin_split.wav');
      assert.equal(res3.status, 403);

      const res4 = await request(app)
        .get('/api/v1/workbench/splits/00000000-0000-0000-0000-000000000000/download-zip')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(res4.status, 403);
    });
  });

  describe('2. Input & Resource Validation (404 & 400)', () => {
    it('returns 404 JSON cleanly for invalid or non-existent jobId and splitId', async () => {
      const resInvalid = await request(app)
        .get('/api/v1/workbench/jobs/not-a-uuid')
        .set('Authorization', `Bearer ${tokenA}`);
      assert.equal(resInvalid.status, 404);
      assert.ok(resInvalid.body.error);

      const resMissing = await request(app)
        .get('/api/v1/workbench/jobs/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${tokenA}`);
      assert.equal(resMissing.status, 404);
      assert.ok(resMissing.body.error);

      const resSplitInvalid = await request(app)
        .get('/api/v1/workbench/splits/not-a-uuid/download-zip')
        .set('Authorization', `Bearer ${tokenA}`);
      assert.equal(resSplitInvalid.status, 404);
      assert.ok(resSplitInvalid.body.error);

      const resSplitMissing = await request(app)
        .get('/api/v1/workbench/splits/00000000-0000-0000-0000-000000000000/download-zip')
        .set('Authorization', `Bearer ${tokenA}`);
      assert.equal(resSplitMissing.status, 404);
      assert.ok(resSplitMissing.body.error);
    });

    it('rejects empty, unsupported, and corrupt uploads with 400', async () => {
      const resNoFile = await request(app)
        .post('/api/v1/workbench/separate')
        .set('Authorization', `Bearer ${tokenA}`);
      assert.equal(resNoFile.status, 400);

      const resEmpty = await request(app)
        .post('/api/v1/workbench/separate')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('audio', Buffer.alloc(0), 'empty.wav');
      assert.equal(resEmpty.status, 400);

      const resUnsupported = await request(app)
        .post('/api/v1/workbench/separate')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('audio', Buffer.from('hello world'), 'notes.txt');
      assert.equal(resUnsupported.status, 400);

      const resCorruptSep = await request(app)
        .post('/api/v1/workbench/separate')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('audio', Buffer.from('not-a-real-wav-payload'), 'corrupt.wav');
      assert.equal(resCorruptSep.status, 400);

      const resCorruptSplit = await request(app)
        .post('/api/v1/workbench/split')
        .set('Authorization', `Bearer ${tokenA}`)
        .field('regions', JSON.stringify([{ name: 'part_1', startSec: 0, endSec: 0.3 }]))
        .attach('audio', Buffer.from('not-a-real-wav-payload'), 'corrupt.wav');
      assert.equal(resCorruptSplit.status, 400);

      const oversizedBuf = Buffer.alloc(100 * 1024 * 1024 + 1);
      const resOversized = await request(app)
        .post('/api/v1/workbench/separate')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('audio', oversizedBuf, 'oversized.wav');
      assert.equal(resOversized.status, 400);
      assert.match(resOversized.body.error, /100 MB/i);
    });
  });

  describe('3. Standalone Multi-Region Asset Splitter', () => {
    let standaloneSplitId;

    it('rejects invalid split regions and fadeMs bounds with 400 before invoking worker', async () => {
      const wav = makeWavBuffer({ sampleRate: 48000, durationSec: 1.5, freq: 440, amp: 0.5 });

      const resMissingRegions = await request(app)
        .post('/api/v1/workbench/split')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('audio', wav, 'missing_regions.wav');
      assert.equal(resMissingRegions.status, 400);

      const resEmptyRegions = await request(app)
        .post('/api/v1/workbench/split')
        .set('Authorization', `Bearer ${tokenA}`)
        .field('regions', JSON.stringify([]))
        .attach('audio', wav, 'empty_regions.wav');
      assert.equal(resEmptyRegions.status, 400);

      const tooManyRegions = Array.from({ length: 101 }, (_, idx) => ({
        name: `sfx_${idx + 1}`,
        startSec: 0,
        endSec: 0.5
      }));
      const resTooMany = await request(app)
        .post('/api/v1/workbench/split')
        .set('Authorization', `Bearer ${tokenA}`)
        .field('regions', JSON.stringify(tooManyRegions))
        .attach('audio', wav, 'too_many_regions.wav');
      assert.equal(resTooMany.status, 400);

      const resInverted = await request(app)
        .post('/api/v1/workbench/split')
        .set('Authorization', `Bearer ${tokenA}`)
        .field('regions', JSON.stringify([{ name: 'bad', startSec: 0.9, endSec: 0.4 }]))
        .attach('audio', wav, 'inverted_bounds.wav');
      assert.equal(resInverted.status, 400);

      const resTooShort = await request(app)
        .post('/api/v1/workbench/split')
        .set('Authorization', `Bearer ${tokenA}`)
        .field('regions', JSON.stringify([{ name: 'tiny', startSec: 0.2, endSec: 0.205 }]))
        .attach('audio', wav, 'too_short.wav');
      assert.equal(resTooShort.status, 400);

      const resBadFade = await request(app)
        .post('/api/v1/workbench/split')
        .set('Authorization', `Bearer ${tokenA}`)
        .field('fadeMs', '150')
        .field('regions', JSON.stringify([{ name: 'ok', startSec: 0.1, endSec: 0.6 }]))
        .attach('audio', wav, 'bad_fade.wav');
      assert.equal(resBadFade.status, 400);

      const resNegativeFade = await request(app)
        .post('/api/v1/workbench/split')
        .set('Authorization', `Bearer ${tokenA}`)
        .field('fadeMs', '-5')
        .field('regions', JSON.stringify([{ name: 'ok', startSec: 0.1, endSec: 0.6 }]))
        .attach('audio', wav, 'neg_fade.wav');
      assert.equal(resNegativeFade.status, 400);
    });

    it('splits standalone WAV into named S3 assets with presigned audioUrls', async () => {
      const multiBurstWav = makeMultiBurstWavBuffer({
        sampleRate: 48000,
        durationSec: 2.0,
        bursts: [
          { startSec: 0.2, endSec: 0.7, freq: 440 },
          { startSec: 1.2, endSec: 1.7, freq: 660 }
        ]
      });

      const regions = [
        { name: 'sfx_hit', startSec: 0.2, endSec: 0.7 },
        { name: 'sfx_jump', startSec: 1.2, endSec: 1.7 }
      ];

      const res = await request(app)
        .post('/api/v1/workbench/split')
        .set('Authorization', `Bearer ${tokenA}`)
        .field('fadeMs', '15')
        .field('regions', JSON.stringify(regions))
        .attach('audio', multiBurstWav, 'sfx_pack.wav');

      assert.equal(res.status, 200);
      assert.ok(res.body.splitId);
      assert.match(res.body.splitId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      standaloneSplitId = res.body.splitId;
      createdSplitIds.push(standaloneSplitId);

      assert.equal(res.body.sourceFileName, 'sfx_pack.wav');
      assert.equal(res.body.sourceFormat?.container, 'wav');
      assert.equal(res.body.fadeMs, 15);
      assert.equal(res.body.totalAssets, 2);
      assert.equal(res.body.assets.length, 2);

      assert.deepEqual(
        res.body.assets.map((a) => a.name),
        ['sfx_hit', 'sfx_jump']
      );
      assert.deepEqual(
        res.body.assets.map((a) => a.fileName),
        ['sfx_hit.wav', 'sfx_jump.wav']
      );
      assert.notEqual(res.body.assets[0].audioUrl, res.body.assets[1].audioUrl);

      for (const asset of res.body.assets) {
        assert.ok(asset.storageKey.startsWith(`workbench/${userA.user.id}/split-${standaloneSplitId}/`));
        assert.match(asset.audioUrl, /X-Amz-Signature=/);
        assert.ok(Math.abs(asset.durationSec - 0.5) < 0.02);

        const head = await s3Client.send(
          new HeadObjectCommand({
            Bucket: BUCKET_NAME,
            Key: asset.storageKey
          })
        );
        assert.ok(head.ContentLength > 44);
      }
    });

    it('downloads split assets ZIP in wav24, flac24, and mp3_320 and enforces validation & Anti-IDOR', async () => {
      const resWavZip = await request(app)
        .get(`/api/v1/workbench/splits/${standaloneSplitId}/download-zip?format=wav24`)
        .set('Authorization', `Bearer ${tokenA}`)
        .parse(binaryParser)
        .buffer(true);
      assert.equal(resWavZip.status, 200);
      assert.match(resWavZip.headers['content-type'], /application\/zip/);
      const wavNames = new AdmZip(resWavZip.body)
        .getEntries()
        .map((e) => e.entryName)
        .sort();
      assert.deepEqual(wavNames, ['sfx_hit.wav', 'sfx_jump.wav']);

      const resFlacZip = await request(app)
        .get(`/api/v1/workbench/splits/${standaloneSplitId}/download-zip?format=flac24`)
        .set('Authorization', `Bearer ${tokenA}`)
        .parse(binaryParser)
        .buffer(true);
      assert.equal(resFlacZip.status, 200);
      const flacNames = new AdmZip(resFlacZip.body)
        .getEntries()
        .map((e) => e.entryName)
        .sort();
      assert.deepEqual(flacNames, ['sfx_hit.flac', 'sfx_jump.flac']);

      const resMp3Zip = await request(app)
        .get(`/api/v1/workbench/splits/${standaloneSplitId}/download-zip?format=mp3_320`)
        .set('Authorization', `Bearer ${tokenA}`)
        .parse(binaryParser)
        .buffer(true);
      assert.equal(resMp3Zip.status, 200);
      const mp3Names = new AdmZip(resMp3Zip.body)
        .getEntries()
        .map((e) => e.entryName)
        .sort();
      assert.deepEqual(mp3Names, ['sfx_hit.mp3', 'sfx_jump.mp3']);

      const resBadFmt = await request(app)
        .get(`/api/v1/workbench/splits/${standaloneSplitId}/download-zip?format=ogg_bad`)
        .set('Authorization', `Bearer ${tokenA}`);
      assert.equal(resBadFmt.status, 400);

      const resIdor = await request(app)
        .get(`/api/v1/workbench/splits/${standaloneSplitId}/download-zip`)
        .set('Authorization', `Bearer ${tokenB}`);
      assert.equal(resIdor.status, 403);

      const resMissing = await request(app)
        .get('/api/v1/workbench/splits/00000000-0000-0000-0000-000000000000/download-zip')
        .set('Authorization', `Bearer ${tokenA}`);
      assert.equal(resMissing.status, 404);
    });
  });

  describe('4. Full Separation, Concurrency Queue, Anti-IDOR, Stem Split, ZIP, & Send-to-Session', () => {
    let job1Id;
    let job2Id;

    it('queues simultaneous POST /separate jobs cleanly (concurrency=1) and completes both with 4 stems', async () => {
      const mixWithSilence = makeWavBuffer({
        sampleRate: 48000,
        durationSec: 1.4,
        leadSilenceSec: 0.4,
        tailSilenceSec: 0.4,
        freq: 330,
        amp: 0.55
      });
      const mix2 = makeWavBuffer({
        sampleRate: 48000,
        durationSec: 0.8,
        freq: 220,
        amp: 0.5
      });

      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/workbench/separate')
          .set('Authorization', `Bearer ${tokenA}`)
          .attach('audio', mixWithSilence, 'song_one.wav'),
        request(app)
          .post('/api/v1/workbench/separate')
          .set('Authorization', `Bearer ${tokenA}`)
          .attach('audio', mix2, 'song_two.wav')
      ]);

      assert.equal(res1.status, 202);
      assert.equal(res2.status, 202);
      assert.equal(res1.body.status, 'QUEUED');
      assert.equal(res2.body.status, 'QUEUED');
      assert.ok(res1.body.jobId);
      assert.ok(res2.body.jobId);
      assert.notEqual(res1.body.jobId, res2.body.jobId);

      job1Id = res1.body.jobId;
      job2Id = res2.body.jobId;
      createdJobIds.push(job1Id, job2Id);

      const [job1, job2] = await Promise.all([
        pollJobUntilDone(tokenA, job1Id),
        pollJobUntilDone(tokenA, job2Id)
      ]);

      assert.equal(job1.status, 'COMPLETED', `Job 1 failed: ${job1.error}`);
      assert.equal(job2.status, 'COMPLETED', `Job 2 failed: ${job2.error}`);
      assert.equal(job1.stems.length, 4);
      assert.deepEqual(
        job1.stems.map((s) => s.name),
        ['vocals', 'drums', 'bass', 'other']
      );
      for (const stem of job1.stems) {
        assert.ok(stem.storageKey.startsWith('workbench/'));
        assert.match(stem.audioUrl, /X-Amz-Signature=/);
        assert.equal(stem.originalAudioUrl, stem.audioUrl);
        assert.equal(stem.originalDurationSec, stem.durationSec);
        assert.equal(stem.isTrimmed, false);
        assert.ok(stem.durationSec > 1.0);
      }
    });

    it('enforces Anti-IDOR (403) when User B accesses User A job endpoints', async () => {
      const resGet = await request(app)
        .get(`/api/v1/workbench/jobs/${job1Id}`)
        .set('Authorization', `Bearer ${tokenB}`);
      assert.equal(resGet.status, 403);

      const resZip = await request(app)
        .get(`/api/v1/workbench/jobs/${job1Id}/download-zip`)
        .set('Authorization', `Bearer ${tokenB}`);
      assert.equal(resZip.status, 403);

      const resSplitIdor = await request(app)
        .post('/api/v1/workbench/split')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          jobId: job1Id,
          stemName: 'vocals',
          regions: [{ name: 'stolen_clip', startSec: 0.1, endSec: 0.5 }]
        });
      assert.equal(resSplitIdor.status, 403);

      const resSend = await request(app)
        .post(`/api/v1/workbench/jobs/${job1Id}/send-to-session`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ title: 'Stolen Session' });
      assert.equal(resSend.status, 403);
    });

    it('splits a separated Tab 1 stem into named assets without altering job.stems and exports single asset cleanly', async () => {
      const beforeRes = await request(app)
        .get(`/api/v1/workbench/jobs/${job1Id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      assert.equal(beforeRes.status, 200);
      const beforeStems = beforeRes.body.stems;

      const resSplit = await request(app)
        .post('/api/v1/workbench/split')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          jobId: job1Id,
          stemName: 'vocals',
          fadeMs: 15,
          regions: [
            { name: 'vox_hook', startSec: 0.2, endSec: 0.6 },
            { name: 'vox_tail', startSec: 0.7, endSec: 1.1 }
          ]
        });

      assert.equal(resSplit.status, 200);
      assert.ok(resSplit.body.splitId);
      createdSplitIds.push(resSplit.body.splitId);
      assert.equal(resSplit.body.totalAssets, 2);
      assert.deepEqual(resSplit.body.sourceFormat, beforeRes.body.sourceFormat);
      assert.deepEqual(
        resSplit.body.assets.map((a) => a.name),
        ['vox_hook', 'vox_tail']
      );
      assert.deepEqual(
        resSplit.body.assets.map((a) => a.fileName),
        ['vox_hook.wav', 'vox_tail.wav']
      );
      for (const asset of resSplit.body.assets) {
        assert.ok(asset.storageKey.startsWith('workbench/'));
        assert.match(asset.audioUrl, /X-Amz-Signature=/);
        assert.ok(Math.abs(asset.durationSec - 0.4) < 0.02);
      }

      const firstAsset = resSplit.body.assets[0];
      const resExportFlac = await request(app)
        .get(`/api/v1/workbench/export?storageKey=${encodeURIComponent(firstAsset.storageKey)}&format=flac24&fileName=${encodeURIComponent(firstAsset.fileName)}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .parse(binaryParser)
        .buffer(true);
      assert.equal(resExportFlac.status, 200);
      assert.match(resExportFlac.headers['content-type'], /audio\/flac/);
      assert.match(resExportFlac.headers['content-disposition'], /vox_hook\.flac/);

      const resExportIdor = await request(app)
        .get(`/api/v1/workbench/export?storageKey=${encodeURIComponent(firstAsset.storageKey)}&format=flac24`)
        .set('Authorization', `Bearer ${tokenB}`);
      assert.equal(resExportIdor.status, 403);

      const afterRes = await request(app)
        .get(`/api/v1/workbench/jobs/${job1Id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      assert.equal(afterRes.status, 200);
      for (let i = 0; i < beforeStems.length; i++) {
        assert.equal(afterRes.body.stems[i].storageKey, beforeStems[i].storageKey);
        assert.equal(afterRes.body.stems[i].durationSec, beforeStems[i].durationSec);
        assert.equal(afterRes.body.stems[i].isTrimmed, false);
      }
    });

    it('downloads a valid ZIP archive containing all 4 WAV stems', async () => {
      const resZip = await request(app)
        .get(`/api/v1/workbench/jobs/${job1Id}/download-zip`)
        .set('Authorization', `Bearer ${tokenA}`)
        .parse(binaryParser)
        .buffer(true);

      assert.equal(resZip.status, 200);
      assert.match(resZip.headers['content-type'], /application\/zip/);
      const zipBuf = resZip.body;
      assert.ok(Buffer.isBuffer(zipBuf));
      assert.equal(zipBuf[0], 0x50); // 'P'
      assert.equal(zipBuf[1], 0x4b); // 'K'

      const zip = new AdmZip(zipBuf);
      const entries = zip.getEntries();
      assert.equal(entries.length, 4);
      for (const entry of entries) {
        assert.match(entry.entryName, /\.wav$/i);
        assert.ok(entry.getData().length > 44);
      }

      // Verify FLAC 24-bit and MP3 320 kbps ZIP export formats + invalid format rejection
      const resFlacZip = await request(app)
        .get(`/api/v1/workbench/jobs/${job1Id}/download-zip?format=flac24`)
        .set('Authorization', `Bearer ${tokenA}`)
        .parse(binaryParser)
        .buffer(true);
      assert.equal(resFlacZip.status, 200);
      const flacEntries = new AdmZip(resFlacZip.body).getEntries();
      assert.equal(flacEntries.length, 4);
      for (const entry of flacEntries) {
        assert.match(entry.entryName, /\.flac$/i);
      }

      const resMp3Zip = await request(app)
        .get(`/api/v1/workbench/jobs/${job1Id}/download-zip?format=mp3_320`)
        .set('Authorization', `Bearer ${tokenA}`)
        .parse(binaryParser)
        .buffer(true);
      assert.equal(resMp3Zip.status, 200);
      const mp3Entries = new AdmZip(resMp3Zip.body).getEntries();
      assert.equal(mp3Entries.length, 4);
      for (const entry of mp3Entries) {
        assert.match(entry.entryName, /\.mp3$/i);
      }

      const resBadFmt = await request(app)
        .get(`/api/v1/workbench/jobs/${job1Id}/download-zip?format=ogg_bad`)
        .set('Authorization', `Bearer ${tokenA}`);
      assert.equal(resBadFmt.status, 400);

      // Verify single stem download & Anti-IDOR
      const resStemFlac = await request(app)
        .get(`/api/v1/workbench/jobs/${job1Id}/stems/vocals/download?format=flac24`)
        .set('Authorization', `Bearer ${tokenA}`)
        .parse(binaryParser)
        .buffer(true);
      assert.equal(resStemFlac.status, 200);
      assert.match(resStemFlac.headers['content-type'], /audio\/flac/);
      assert.match(resStemFlac.headers['content-disposition'], /vocals\.flac/);

      const resStemIdor = await request(app)
        .get(`/api/v1/workbench/jobs/${job1Id}/stems/vocals/download?format=flac24`)
        .set('Authorization', `Bearer ${tokenB}`);
      assert.equal(resStemIdor.status, 403);

      // Verify /export Anti-IDOR and standalone transcoding
      const job1StatusForExport = await request(app)
        .get(`/api/v1/workbench/jobs/${job1Id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      const sampleExportKey = job1StatusForExport.body.stems[0].storageKey;

      const resExportIdor = await request(app)
        .get(`/api/v1/workbench/export?storageKey=${encodeURIComponent(sampleExportKey)}&format=mp3_320`)
        .set('Authorization', `Bearer ${tokenB}`);
      assert.equal(resExportIdor.status, 403);

      const resExportFlac = await request(app)
        .get(`/api/v1/workbench/export?storageKey=${encodeURIComponent(sampleExportKey)}&format=flac24&fileName=vocals.wav`)
        .set('Authorization', `Bearer ${tokenA}`)
        .parse(binaryParser)
        .buffer(true);
      assert.equal(resExportFlac.status, 200);
      assert.match(resExportFlac.headers['content-type'], /audio\/flac/);
      assert.match(resExportFlac.headers['content-disposition'], /TRIMMED_vocals\.flac/);

      // Verify 'auto' respects MP3 sourceFormat recorded in Redis
      const rawJob1 = await redis.get(`workbench:job:${job1Id}`);
      const parsedJob1 = JSON.parse(rawJob1);
      const originalSourceFormat = parsedJob1.sourceFormat;
      parsedJob1.sourceFormat = { container: 'mp3', targetFormat: 'mp3', bitrateKbps: 192 };
      await redis.set(`workbench:job:${job1Id}`, JSON.stringify(parsedJob1), 'EX', 86400);
      try {
        const resAutoMp3 = await request(app)
          .get(`/api/v1/workbench/jobs/${job1Id}/download-zip?format=auto`)
          .set('Authorization', `Bearer ${tokenA}`)
          .parse(binaryParser)
          .buffer(true);
        assert.equal(resAutoMp3.status, 200);
        const autoEntries = new AdmZip(resAutoMp3.body).getEntries();
        assert.equal(autoEntries.length, 4);
        for (const entry of autoEntries) {
          assert.match(entry.entryName, /\.mp3$/i);
        }
      } finally {
        parsedJob1.sourceFormat = originalSourceFormat;
        await redis.set(`workbench:job:${job1Id}`, JSON.stringify(parsedJob1), 'EX', 86400);
      }
    });

    it('validates stemNames and duration alignment, then creates READY Session + 4 Tracks on send-to-session', async () => {
      const resInvalidStem = await request(app)
        .post(`/api/v1/workbench/jobs/${job1Id}/send-to-session`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ stemNames: ['invalid'] });
      assert.equal(resInvalidStem.status, 400);

      const resEmptyStems = await request(app)
        .post(`/api/v1/workbench/jobs/${job1Id}/send-to-session`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ stemNames: [] });
      assert.equal(resEmptyStems.status, 400);

      // Verify duration mismatch guard on job2 by skewing one stem duration in Redis
      const rawJob2 = await redis.get(`workbench:job:${job2Id}`);
      const parsedJob2 = JSON.parse(rawJob2);
      parsedJob2.stems[0].durationSec = parsedJob2.stems[0].durationSec + 0.5;
      await redis.set(`workbench:job:${job2Id}`, JSON.stringify(parsedJob2), 'EX', 86400);

      const resMismatch = await request(app)
        .post(`/api/v1/workbench/jobs/${job2Id}/send-to-session`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Mismatched Stems' });
      assert.equal(resMismatch.status, 400);
      assert.match(resMismatch.body.error, /durasi|sinkron/i);

      // Happy path on job1
      const resSend = await request(app)
        .post(`/api/v1/workbench/jobs/${job1Id}/send-to-session`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Workbench Session Handoff' });

      assert.equal(resSend.status, 201);
      assert.ok(resSend.body.session);
      assert.ok(resSend.body.message);

      const dbSession = await prisma.session.findUnique({
        where: { id: resSend.body.session.id },
        include: { tracks: true }
      });

      assert.ok(dbSession);
      assert.equal(dbSession.userId, userA.user.id);
      assert.equal(dbSession.title, 'Workbench Session Handoff');
      assert.equal(dbSession.status, 'READY');
      assert.equal(dbSession.sampleRate, 48000);
      assert.equal(dbSession.bitDepth, 24);
      assert.equal(dbSession.tracks.length, 4);

      const labels = dbSession.tracks.map((t) => t.instrumentLabel).sort();
      assert.deepEqual(labels, ['Bass', 'Drums: Overhead', 'Other', 'Vocals: Lead']);

      for (const track of dbSession.tracks) {
        assert.ok(track.originalStorageKey.startsWith(`sessions/${dbSession.id}/raw/`));
        const head = await s3Client.send(new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: track.originalStorageKey
        }));
        assert.ok(head.ContentLength > 44);
      }
    });
  });
});
