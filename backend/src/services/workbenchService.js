import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { PutObjectCommand, GetObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { parseBuffer } from 'music-metadata';
import AdmZip from 'adm-zip';
import prisma from '../config/prisma.js';
import redis, { isRedisReady } from '../config/redis.js';
import { s3Client, s3PublicClient, BUCKET_NAME, ensureBucketExists } from '../config/s3.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../');

const WORKBENCH_JOB_TTL_SEC = 86400;
const PRESIGNED_URL_TTL_SEC = 7200;
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const ALLOWED_EXT_REGEX = /\.(wav|flac|mp3)$/i;
const ALLOWED_MIME_TYPES = new Set([
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/vnd.wave',
  'audio/flac',
  'audio/x-flac',
  'audio/mpeg',
  'audio/mp3',
  'application/octet-stream'
]);
const STEM_NAMES = ['vocals', 'drums', 'bass', 'other'];
const STEM_INSTRUMENT_LABELS = {
  vocals: 'Vocals: Lead',
  drums: 'Drums: Overhead',
  bass: 'Bass',
  other: 'Other'
};
const MAX_SYNC_DURATION_DRIFT_SEC = 0.1;

// In-process FIFO queue serializing heavy Demucs separation processes (concurrency = 1)
let separationQueueTail = Promise.resolve();

export function enqueueSeparationTask(taskFn) {
  const run = separationQueueTail.then(() => taskFn());
  separationQueueTail = run.catch(() => {});
  return run;
}

function createHttpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export function isValidUuid(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function sanitizeFileName(name) {
  return String(name || 'audio.wav').replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function ensureRedisConnected() {
  const ready = await isRedisReady();
  if (!ready) {
    throw createHttpError(503, 'Layanan antrean Redis tidak tersedia');
  }
}

async function getJobRecord(jobId) {
  if (!isValidUuid(jobId)) {
    throw createHttpError(404, 'Pekerjaan workbench tidak ditemukan');
  }
  await ensureRedisConnected();
  const raw = await redis.get(`workbench:job:${jobId}`);
  if (!raw) {
    throw createHttpError(404, 'Pekerjaan workbench tidak ditemukan');
  }
  return JSON.parse(raw);
}

async function saveJobRecord(job) {
  await ensureRedisConnected();
  await redis.set(`workbench:job:${job.jobId}`, JSON.stringify(job), 'EX', WORKBENCH_JOB_TTL_SEC);
}

async function mergeJobUpdate(jobId, patch) {
  await ensureRedisConnected();
  const raw = await redis.get(`workbench:job:${jobId}`);
  const existing = raw ? JSON.parse(raw) : { jobId };
  const merged = {
    ...existing,
    ...patch
  };
  await redis.set(`workbench:job:${jobId}`, JSON.stringify(merged), 'EX', WORKBENCH_JOB_TTL_SEC);
  return merged;
}

async function validateUploadedAudio(file) {
  if (!file) {
    throw createHttpError(400, 'Berkas audio wajib diunggah');
  }
  if (!file.buffer || file.buffer.length === 0) {
    throw createHttpError(400, 'Berkas audio kosong (0 byte)');
  }
  if (file.size > MAX_FILE_SIZE_BYTES || file.buffer.length > MAX_FILE_SIZE_BYTES) {
    throw createHttpError(400, 'Ukuran berkas melebihi batas maksimal 100 MB');
  }

  const extOk = ALLOWED_EXT_REGEX.test(file.originalname || '');
  const mime = (file.mimetype || '').toLowerCase();
  const mimeOk = !mime || ALLOWED_MIME_TYPES.has(mime);

  if (!extOk || !mimeOk) {
    throw createHttpError(400, 'Format berkas tidak didukung. Gunakan WAV, FLAC, atau MP3');
  }

  let meta;
  try {
    meta = await parseBuffer(file.buffer);
  } catch {
    throw createHttpError(400, 'Berkas audio rusak atau format tidak didukung');
  }

  if (
    !meta?.format ||
    meta.format.duration === undefined ||
    meta.format.duration === null ||
    Number.isNaN(meta.format.duration) ||
    meta.format.duration <= 0
  ) {
    throw createHttpError(400, 'Berkas audio rusak atau format tidak didukung');
  }

  return detectSourceFormat(file, meta);
}

const REQUESTED_EXPORT_FORMATS = new Set(['auto', 'flac24', 'wav24', 'mp3_320']);
const RESOLVED_FORMAT_META = {
  wav24: { ext: '.wav', mime: 'audio/wav' },
  wav16: { ext: '.wav', mime: 'audio/wav' },
  flac24: { ext: '.flac', mime: 'audio/flac' },
  flac16: { ext: '.flac', mime: 'audio/flac' },
  mp3: { ext: '.mp3', mime: 'audio/mpeg' },
  mp3_320: { ext: '.mp3', mime: 'audio/mpeg' }
};

function detectSourceFormat(file, meta) {
  const ext = path.extname(file?.originalname || '').toLowerCase();
  const codec = (meta?.format?.codec || '').toLowerCase();
  const container = (meta?.format?.container || '').toLowerCase();
  const bitrateKbps = meta?.format?.bitrate ? Math.round(meta.format.bitrate / 1000) : null;
  const bitsPerSample = meta?.format?.bitsPerSample || null;

  if (ext === '.mp3' || container.includes('mpeg') || codec.includes('mp3')) {
    return {
      container: 'mp3',
      targetFormat: 'mp3',
      bitrateKbps: Math.min(320, Math.max(192, bitrateKbps || 320))
    };
  }
  if (ext === '.flac' || container.includes('flac') || codec.includes('flac')) {
    return {
      container: 'flac',
      targetFormat: bitsPerSample === 16 ? 'flac16' : 'flac24',
      bitrateKbps: null
    };
  }
  return {
    container: 'wav',
    targetFormat: bitsPerSample === 16 ? 'wav16' : 'wav24',
    bitrateKbps: null
  };
}

function resolveExportSpec(requestedFormat = 'auto', sourceFormat = null) {
  const normalized = String(requestedFormat || 'auto').trim().toLowerCase();
  if (!REQUESTED_EXPORT_FORMATS.has(normalized)) {
    throw createHttpError(400, 'Format unduhan tidak didukung. Pilih auto, flac24, wav24, atau mp3_320');
  }

  let targetFormat = normalized;
  let bitrateKbps = normalized === 'mp3_320' ? 320 : null;

  if (normalized === 'auto') {
    const srcTarget = sourceFormat?.targetFormat;
    targetFormat = RESOLVED_FORMAT_META[srcTarget] ? srcTarget : 'wav24';
    bitrateKbps = targetFormat === 'mp3' ? Math.min(320, Math.max(192, Number(sourceFormat?.bitrateKbps) || 320)) : null;
  }

  const meta = RESOLVED_FORMAT_META[targetFormat] || RESOLVED_FORMAT_META.wav24;
  return {
    requestedFormat: normalized,
    targetFormat,
    bitrateKbps,
    ext: meta.ext,
    mime: meta.mime
  };
}

async function fetchS3Buffer(storageKey) {
  try {
    const s3Res = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: storageKey
      })
    );
    const byteArray = await s3Res.Body.transformToByteArray();
    return Buffer.from(byteArray);
  } catch (err) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
      throw createHttpError(404, 'Berkas audio tidak ditemukan di penyimpanan');
    }
    throw err;
  }
}

async function transcodeStorageItems(items, spec) {
  if (spec.targetFormat === 'wav24') {
    return Promise.all(
      items.map(async (item) => ({
        name: item.name,
        ext: '.wav',
        mime: 'audio/wav',
        buffer: await fetchS3Buffer(item.sourceStorageKey)
      }))
    );
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'polaris-export-'));
  try {
    const workerItems = items.map((item, idx) => ({
      name: item.name,
      sourceStorageKey: item.sourceStorageKey,
      outputPath: path.join(tmpDir, `${idx}_${sanitizeFileName(item.name || 'audio')}${spec.ext}`),
      targetFormat: spec.targetFormat,
      bitrateKbps: spec.bitrateKbps,
      fileName: item.fileName || `${item.name || 'audio'}.wav`
    }));

    const result = await runPythonWorker(
      { items: workerItems },
      '--export-stdin',
      180000
    );

    const outItems = result.items || [];
    return Promise.all(
      outItems.map(async (entry, idx) => ({
        name: entry.name || workerItems[idx].name,
        ext: entry.ext || spec.ext,
        mime: entry.mime || spec.mime,
        buffer: await fs.readFile(entry.outputPath)
      }))
    );
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function signStorageUrl(storageKey) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: storageKey
  });
  return getSignedUrl(s3PublicClient, command, { expiresIn: PRESIGNED_URL_TTL_SEC });
}

async function attachStemUrls(stems = []) {
  return Promise.all(
    stems.map(async (stem) => {
      const audioUrl = await signStorageUrl(stem.storageKey);
      const originalAudioUrl =
        stem.isTrimmed && stem.originalStorageKey
          ? await signStorageUrl(stem.originalStorageKey)
          : audioUrl;
      return {
        name: stem.name,
        label: stem.label,
        storageKey: stem.storageKey,
        audioUrl,
        originalAudioUrl,
        durationSec: stem.durationSec,
        originalDurationSec: stem.originalDurationSec ?? stem.durationSec,
        isTrimmed: Boolean(stem.isTrimmed)
      };
    })
  );
}

function runPythonWorker(payload, mode, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const py = spawn('python3', ['-m', 'worker.src.worker', mode], {
      cwd: projectRoot,
      env: process.env
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      py.kill('SIGKILL');
      reject(new Error(`Worker ${mode} melebihi batas waktu (${timeoutMs} ms)`));
    }, timeoutMs);

    py.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    py.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    py.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    py.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code !== 0) {
        const lines = stderr
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        const lastMessage = lines[lines.length - 1] || `Worker exited with code ${code}`;
        if (/hening|rusak|tidak didukung|tidak valid|tidak boleh kosong/i.test(lastMessage)) {
          return reject(createHttpError(400, lastMessage));
        }
        return reject(new Error(`Worker exited with code ${code}: ${stderr.trim()}`));
      }

      try {
        const jsonMatch = stdout.match(/(\{[\s\S]*\})/);
        const jsonStr = jsonMatch ? jsonMatch[0] : stdout.trim();
        resolve(JSON.parse(jsonStr));
      } catch {
        reject(new Error(`Failed to parse worker output: ${stdout}\nStderr: ${stderr}`));
      }
    });

    py.stdin.write(JSON.stringify(payload));
    py.stdin.end();
  });
}

function parseOptionalNumber(val, defaultValue = null) {
  if (val === undefined || val === null || val === '') {
    return defaultValue;
  }
  const num = Number(val);
  if (!Number.isFinite(num)) {
    throw createHttpError(400, 'Parameter numerik pemangkasan tidak valid');
  }
  return num;
}

export class WorkbenchService {
  static async startSeparation(userId, file) {
    const sourceFormat = await validateUploadedAudio(file);
    await ensureBucketExists();

    const jobId = crypto.randomUUID();
    const originalFileName = file.originalname;
    const safeName = sanitizeFileName(originalFileName);
    const sourceStorageKey = `workbench/${userId}/${jobId}/source/${safeName}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: sourceStorageKey,
        Body: file.buffer,
        ContentType: file.mimetype || 'audio/wav'
      })
    );

    const initialJob = {
      jobId,
      userId,
      fileName: originalFileName,
      sourceStorageKey,
      sourceFormat,
      status: 'QUEUED',
      progress: 0,
      stepMessage: 'Menunggu antrean pemrosesan',
      stems: [],
      error: null,
      createdAt: new Date().toISOString()
    };

    await saveJobRecord(initialJob);

    enqueueSeparationTask(async () => {
      const redisKey = `workbench:job:${jobId}`;
      try {
        await mergeJobUpdate(jobId, {
          status: 'PROCESSING',
          progress: 5,
          stepMessage: 'Memulai pemisahan stem'
        });

        const result = await runPythonWorker(
          {
            jobId,
            userId,
            fileName: originalFileName,
            sourceStorageKey,
            redisKey
          },
          '--separate-stdin',
          600000
        );

        const stems = (result.stems || []).map((stem) => ({
          name: stem.name,
          label: stem.label,
          storageKey: stem.storageKey,
          originalStorageKey: stem.storageKey,
          durationSec: stem.durationSec,
          originalDurationSec: stem.durationSec,
          isTrimmed: false
        }));

        await mergeJobUpdate(jobId, {
          status: 'COMPLETED',
          progress: 100,
          stepMessage: 'Pemisahan stem selesai',
          durationSec: result.durationSec,
          stems,
          error: null
        });
      } catch (err) {
        await mergeJobUpdate(jobId, {
          status: 'FAILED',
          stepMessage: 'Pemisahan stem gagal',
          error: err.message || 'Gagal memisahkan stem audio'
        }).catch(() => {});
      }
    }).catch(() => {});

    return {
      jobId,
      status: 'QUEUED',
      fileName: originalFileName
    };
  }

  static async getJobStatus(jobId, userId) {
    const job = await getJobRecord(jobId);
    if (job.userId !== userId) {
      throw createHttpError(403, 'Akses ditolak: Anda bukan pemilik pekerjaan ini');
    }

    const stems = await attachStemUrls(job.stems || []);
    return {
      jobId: job.jobId,
      fileName: job.fileName,
      sourceFormat: job.sourceFormat || null,
      status: job.status,
      progress: job.progress ?? 0,
      stepMessage: job.stepMessage || '',
      stems,
      error: job.error || null
    };
  }

  static async trimAudio({
    userId,
    file,
    jobId,
    stemName,
    thresholdDb,
    padMs,
    fadeMs,
    manualStartSec,
    manualEndSec,
    syncAllStems
  }) {
    const parsedThreshold = parseOptionalNumber(thresholdDb, -45);
    const parsedPad = parseOptionalNumber(padMs, 100);
    const parsedFade = parseOptionalNumber(fadeMs, 15);
    const parsedStart = parseOptionalNumber(manualStartSec, null);
    const parsedEnd = parseOptionalNumber(manualEndSec, null);
    const isSynced = syncAllStems === true || syncAllStems === 'true';

    if (file) {
      const sourceFormat = await validateUploadedAudio(file);
      await ensureBucketExists();

      const trimId = crypto.randomUUID();
      const safeName = sanitizeFileName(file.originalname);
      const baseName = path.basename(safeName, path.extname(safeName)) || 'audio';
      const sourceStorageKey = `workbench/${userId}/trim-${trimId}/source_${safeName}`;
      const targetKey = `workbench/${userId}/trim-${trimId}/TRIMMED_${baseName}.wav`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: sourceStorageKey,
          Body: file.buffer,
          ContentType: file.mimetype || 'audio/wav'
        })
      );

      const result = await runPythonWorker(
        {
          mode: 'single',
          sourceStorageKey,
          targetKey,
          fileName: file.originalname,
          thresholdDb: parsedThreshold,
          padMs: parsedPad,
          fadeMs: parsedFade,
          manualStartSec: parsedStart,
          manualEndSec: parsedEnd
        },
        '--trim-stdin',
        180000
      );

      const audioUrl = await signStorageUrl(result.targetKey);
      return {
        storageKey: result.targetKey,
        audioUrl,
        sourceFormat,
        originalDurationSec: result.originalDurationSec,
        trimmedDurationSec: result.trimmedDurationSec,
        leadInRemovedSec: result.leadInRemovedSec,
        tailRemovedSec: result.tailRemovedSec,
        trimmedPeaks: result.trimmedPeaks
      };
    }

    if (jobId) {
      const job = await getJobRecord(jobId);
      if (job.userId !== userId) {
        throw createHttpError(403, 'Akses ditolak: Anda bukan pemilik pekerjaan ini');
      }
      if (job.status !== 'COMPLETED' || !Array.isArray(job.stems) || job.stems.length === 0) {
        throw createHttpError(400, 'Pemisahan stem belum selesai');
      }
      if (stemName !== undefined && stemName !== null && stemName !== '' && !STEM_NAMES.includes(stemName)) {
        throw createHttpError(400, 'Nama stem tidak valid');
      }

      if (isSynced) {
        const trimBatchId = crypto.randomUUID().slice(0, 8);
        const stemsPayload = job.stems.map((s) => ({
          name: s.name,
          sourceStorageKey: s.originalStorageKey || s.storageKey,
          targetKey: `workbench/${userId}/${jobId}/trimmed/${s.name}_${trimBatchId}.wav`
        }));

        const primaryStemName = stemName && STEM_NAMES.includes(stemName) ? stemName : 'vocals';
        const result = await runPythonWorker(
          {
            mode: 'synced',
            stems: stemsPayload,
            primaryStemName,
            thresholdDb: parsedThreshold,
            padMs: parsedPad,
            fadeMs: parsedFade,
            manualStartSec: parsedStart,
            manualEndSec: parsedEnd
          },
          '--trim-stdin',
          180000
        );

        const updatedByName = new Map((result.updatedStems || []).map((u) => [u.name, u]));
        const nextStems = job.stems.map((existing) => {
          const upd = updatedByName.get(existing.name);
          if (!upd) return existing;
          return {
            ...existing,
            originalStorageKey: existing.originalStorageKey || existing.storageKey,
            originalDurationSec: existing.originalDurationSec ?? existing.durationSec ?? result.originalDurationSec,
            storageKey: upd.storageKey,
            durationSec: upd.durationSec,
            isTrimmed: true
          };
        });

        await mergeJobUpdate(jobId, { stems: nextStems });
        const updatedJobStems = await attachStemUrls(nextStems);
        const primaryStem = updatedJobStems.find((s) => s.name === primaryStemName) || updatedJobStems[0];

        return {
          storageKey: primaryStem.storageKey,
          audioUrl: primaryStem.audioUrl,
          sourceFormat: job.sourceFormat || null,
          originalDurationSec: result.originalDurationSec,
          trimmedDurationSec: result.trimmedDurationSec,
          leadInRemovedSec: result.leadInRemovedSec,
          tailRemovedSec: result.tailRemovedSec,
          trimmedPeaks: result.trimmedPeaks,
          updatedJobStems
        };
      }

      if (!stemName) {
        throw createHttpError(400, 'Nama stem wajib dipilih untuk pemangkasan tunggal');
      }
      const targetStem = job.stems.find((s) => s.name === stemName);
      if (!targetStem) {
        throw createHttpError(400, 'Stem tidak ditemukan pada pekerjaan ini');
      }

      const trimId = crypto.randomUUID();
      const targetKey = `workbench/${userId}/trim-${trimId}/TRIMMED_${stemName}.wav`;
      const result = await runPythonWorker(
        {
          mode: 'single',
          sourceStorageKey: targetStem.originalStorageKey || targetStem.storageKey,
          targetKey,
          fileName: `${stemName}.wav`,
          thresholdDb: parsedThreshold,
          padMs: parsedPad,
          fadeMs: parsedFade,
          manualStartSec: parsedStart,
          manualEndSec: parsedEnd
        },
        '--trim-stdin',
        180000
      );

      const audioUrl = await signStorageUrl(result.targetKey);
      return {
        storageKey: result.targetKey,
        audioUrl,
        sourceFormat: job.sourceFormat || null,
        originalDurationSec: result.originalDurationSec,
        trimmedDurationSec: result.trimmedDurationSec,
        leadInRemovedSec: result.leadInRemovedSec,
        tailRemovedSec: result.tailRemovedSec,
        trimmedPeaks: result.trimmedPeaks
      };
    }

    throw createHttpError(400, 'Unggah berkas audio atau sertakan jobId stem');
  }

  static async downloadJobZip(jobId, userId, format = 'auto') {
    const job = await getJobRecord(jobId);
    if (job.userId !== userId) {
      throw createHttpError(403, 'Akses ditolak: Anda bukan pemilik pekerjaan ini');
    }
    if (job.status !== 'COMPLETED' || !Array.isArray(job.stems) || job.stems.length === 0) {
      throw createHttpError(400, 'Stem hasil pemisahan belum tersedia untuk diunduh');
    }

    const spec = resolveExportSpec(format, job.sourceFormat);
    const exported = await transcodeStorageItems(
      job.stems.map((stem) => ({
        name: stem.name,
        sourceStorageKey: stem.storageKey,
        fileName: `${stem.name}.wav`
      })),
      spec
    );

    const zip = new AdmZip();
    for (const item of exported) {
      zip.addFile(`${item.name}${item.ext}`, item.buffer);
    }

    const baseName = path.basename(job.fileName || 'Workbench', path.extname(job.fileName || ''));
    const safeTitle = sanitizeFileName(baseName) || 'Workbench';

    return {
      filename: `Polaris_Workbench_${safeTitle}_Stems.zip`,
      buffer: zip.toBuffer(),
      resolvedFormat: spec.targetFormat
    };
  }

  static async downloadJobStem(jobId, userId, stemName, format = 'auto') {
    const job = await getJobRecord(jobId);
    if (job.userId !== userId) {
      throw createHttpError(403, 'Akses ditolak: Anda bukan pemilik pekerjaan ini');
    }
    if (!STEM_NAMES.includes(stemName)) {
      throw createHttpError(400, 'Nama stem tidak valid');
    }
    if (job.status !== 'COMPLETED' || !Array.isArray(job.stems) || job.stems.length === 0) {
      throw createHttpError(400, 'Stem hasil pemisahan belum tersedia untuk diunduh');
    }

    const stem = job.stems.find((s) => s.name === stemName);
    if (!stem) {
      throw createHttpError(404, 'Stem tidak ditemukan pada pekerjaan ini');
    }

    const spec = resolveExportSpec(format, job.sourceFormat);
    const [exported] = await transcodeStorageItems(
      [
        {
          name: stem.name,
          sourceStorageKey: stem.storageKey,
          fileName: `${stem.name}.wav`
        }
      ],
      spec
    );

    return {
      filename: `${stem.name}${exported.ext}`,
      mimeType: exported.mime,
      buffer: exported.buffer
    };
  }

  static async exportStorageObject(userId, { storageKey, format = 'auto', sourceTargetFormat, sourceBitrateKbps, fileName }) {
    if (!storageKey || typeof storageKey !== 'string' || storageKey.includes('..') || !storageKey.startsWith(`workbench/${userId}/`)) {
      throw createHttpError(403, 'Akses ditolak: berkas bukan milik Anda');
    }

    const parsedSourceFormat = sourceTargetFormat
      ? { targetFormat: sourceTargetFormat, bitrateKbps: Number(sourceBitrateKbps) || null }
      : null;
    const spec = resolveExportSpec(format, parsedSourceFormat);

    const rawBase = path.basename(fileName || storageKey, path.extname(fileName || storageKey)) || 'trimmed_audio';
    const safeBase = sanitizeFileName(rawBase) || 'trimmed_audio';

    const [exported] = await transcodeStorageItems(
      [
        {
          name: safeBase,
          sourceStorageKey: storageKey,
          fileName: path.basename(storageKey)
        }
      ],
      spec
    );

    const downloadName = safeBase.startsWith('TRIMMED_') ? `${safeBase}${exported.ext}` : `TRIMMED_${safeBase}${exported.ext}`;
    return {
      filename: downloadName,
      mimeType: exported.mime,
      buffer: exported.buffer
    };
  }

  static async sendJobToSession(jobId, userId, { title, stemNames } = {}) {
    const job = await getJobRecord(jobId);
    if (job.userId !== userId) {
      throw createHttpError(403, 'Akses ditolak: Anda bukan pemilik pekerjaan ini');
    }
    if (job.status !== 'COMPLETED' || !Array.isArray(job.stems) || job.stems.length === 0) {
      throw createHttpError(400, 'Stem hasil pemisahan belum siap dikirim ke Studio Workspace');
    }

    let requestedNames;
    if (stemNames !== undefined) {
      if (!Array.isArray(stemNames) || stemNames.length === 0) {
        throw createHttpError(400, 'Daftar stemNames harus berupa array non-kosong');
      }
      const uniqueNames = [...new Set(stemNames)];
      if (uniqueNames.some((n) => !STEM_NAMES.includes(n))) {
        throw createHttpError(400, 'Pilihan stemNames mengandung nama stem yang tidak valid');
      }
      requestedNames = uniqueNames;
    } else {
      requestedNames = job.stems.map((s) => s.name);
    }

    const stemMap = new Map(job.stems.map((s) => [s.name, s]));
    const selectedStems = requestedNames.map((name) => stemMap.get(name)).filter(Boolean);
    if (selectedStems.length !== requestedNames.length) {
      throw createHttpError(400, 'Sebagian stem yang dipilih tidak tersedia');
    }

    const durations = selectedStems.map((s) => Number(s.durationSec || 0));
    const minDur = Math.min(...durations);
    const maxDur = Math.max(...durations);
    if (maxDur - minDur > MAX_SYNC_DURATION_DRIFT_SEC) {
      throw createHttpError(
        400,
        'Durasi antar stem tidak sinkron (selisih melebihi 0.1 detik). Silakan sinkronkan di Trimmer terlebih dahulu.'
      );
    }

    const sessionId = crypto.randomUUID();
    const copiedTracks = await Promise.all(
      selectedStems.map(async (stem) => {
        const destKey = `sessions/${sessionId}/raw/${stem.name}.wav`;
        await s3Client.send(
          new CopyObjectCommand({
            Bucket: BUCKET_NAME,
            CopySource: `${BUCKET_NAME}/${stem.storageKey}`,
            Key: destKey
          })
        );
        const label = STEM_INSTRUMENT_LABELS[stem.name] || 'Other';
        return {
          fileName: `${stem.name}.wav`,
          originalStorageKey: destKey,
          instrumentLabel: label,
          detectedLabel: label,
          isStereo: true,
          durationSec: stem.durationSec ?? null,
          status: 'PENDING'
        };
      })
    );

    const defaultTitle = job.fileName
      ? `${path.basename(job.fileName, path.extname(job.fileName))} (Workbench)`
      : `Workbench Session ${new Date().toLocaleDateString()}`;
    const sessionTitle = typeof title === 'string' && title.trim() ? title.trim() : defaultTitle;

    const session = await prisma.$transaction(async (tx) =>
      tx.session.create({
        data: {
          id: sessionId,
          userId,
          title: sessionTitle,
          status: 'READY',
          sampleRate: 48000,
          bitDepth: 24,
          estimatedTokens: 1,
          tracks: {
            create: copiedTracks
          }
        },
        include: {
          tracks: true
        }
      })
    );

    return {
      session,
      message: 'Stem workbench berhasil dikirim ke Studio Workspace'
    };
  }
}
