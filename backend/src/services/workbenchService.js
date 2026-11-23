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

async function getSplitRecord(splitId) {
  if (!isValidUuid(splitId)) {
    throw createHttpError(404, 'Manifest pemecahan audio tidak ditemukan');
  }
  await ensureRedisConnected();
  const raw = await redis.get(`workbench:split:${splitId}`);
  if (!raw) {
    throw createHttpError(404, 'Manifest pemecahan audio tidak ditemukan');
  }
  return JSON.parse(raw);
}

async function saveSplitRecord(manifest) {
  await ensureRedisConnected();
  await redis.set(`workbench:split:${manifest.splitId}`, JSON.stringify(manifest), 'EX', WORKBENCH_JOB_TTL_SEC);
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
        if (/hening|rusak|tidak didukung|tidak valid|tidak boleh kosong|jumlah region|hingga 100|valueerror/i.test(lastMessage)) {
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

function parseSplitRegions(regionsInput) {
  let parsed = regionsInput;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw createHttpError(400, 'Format JSON daftar region tidak valid');
    }
  }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 100) {
    throw createHttpError(400, 'Daftar region harus berupa array berisi 1 hingga 100 segmen');
  }

  return parsed.map((region, idx) => {
    if (!region || typeof region !== 'object' || Array.isArray(region)) {
      throw createHttpError(400, `Region ke-${idx + 1} tidak valid`);
    }
    const rawStart = region.startSec;
    const rawEnd = region.endSec;
    if (
      rawStart === undefined || rawStart === null || rawStart === '' || typeof rawStart === 'boolean' ||
      rawEnd === undefined || rawEnd === null || rawEnd === '' || typeof rawEnd === 'boolean'
    ) {
      throw createHttpError(400, `Batas waktu region ke-${idx + 1} wajib berupa angka`);
    }
    const startSec = Number(rawStart);
    const endSec = Number(rawEnd);
    if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || startSec < 0 || endSec <= startSec) {
      throw createHttpError(400, `Rentang waktu region ke-${idx + 1} tidak valid`);
    }
    if (endSec - startSec < 0.01 - 1e-9) {
      throw createHttpError(400, `Durasi region ke-${idx + 1} minimal 0.01 detik`);
    }
    return {
      name: typeof region.name === 'string' ? region.name : '',
      startSec,
      endSec
    };
  });
}

function parseSplitFadeMs(fadeMsInput) {
  if (fadeMsInput === undefined || fadeMsInput === null || fadeMsInput === '') {
    return 15;
  }
  if (typeof fadeMsInput === 'boolean') {
    throw createHttpError(400, 'Parameter fadeMs harus berupa angka antara 0 hingga 100');
  }
  const num = Number(fadeMsInput);
  if (!Number.isFinite(num) || num < 0 || num > 100) {
    throw createHttpError(400, 'Parameter fadeMs harus berupa angka antara 0 hingga 100');
  }
  return num;
}

function buildAudioZip(exportedItems, rawSourceName, suffix) {
  const zip = new AdmZip();
  for (const item of exportedItems) {
    zip.addFile(`${item.name}${item.ext}`, item.buffer);
  }
  const baseName = path.basename(rawSourceName || 'Workbench', path.extname(rawSourceName || ''));
  const safeTitle = sanitizeFileName(baseName) || 'Workbench';
  return {
    filename: `Polaris_Workbench_${safeTitle}_${suffix}.zip`,
    buffer: zip.toBuffer()
  };
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

  static async splitAudio({
    userId,
    file,
    jobId,
    stemName,
    regions,
    fadeMs
  }) {
    const normalizedRegions = parseSplitRegions(regions);
    const parsedFadeMs = parseSplitFadeMs(fadeMs);

    let splitId;
    let sourceStorageKey;
    let sourceFileName;
    let sourceFormat = null;

    if (file) {
      sourceFormat = await validateUploadedAudio(file);
      await ensureBucketExists();

      splitId = crypto.randomUUID();
      const safeName = sanitizeFileName(file.originalname);
      sourceStorageKey = `workbench/${userId}/split-${splitId}/source_${safeName}`;
      sourceFileName = file.originalname;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: sourceStorageKey,
          Body: file.buffer,
          ContentType: file.mimetype || 'audio/wav'
        })
      );
    } else if (jobId) {
      const job = await getJobRecord(jobId);
      if (job.userId !== userId) {
        throw createHttpError(403, 'Akses ditolak: Anda bukan pemilik pekerjaan ini');
      }
      if (job.status !== 'COMPLETED' || !Array.isArray(job.stems) || job.stems.length === 0) {
        throw createHttpError(400, 'Pemisahan stem belum selesai');
      }
      if (!stemName || !STEM_NAMES.includes(stemName)) {
        throw createHttpError(400, 'Nama stem tidak valid');
      }
      const targetStem = job.stems.find((s) => s.name === stemName);
      if (!targetStem) {
        throw createHttpError(404, 'Stem tidak ditemukan pada pekerjaan ini');
      }

      splitId = crypto.randomUUID();
      sourceStorageKey = targetStem.storageKey;
      sourceFormat = job.sourceFormat || null;
      sourceFileName = `${stemName}.wav`;
    } else {
      throw createHttpError(400, 'Unggah berkas audio atau sertakan jobId stem');
    }

    const result = await runPythonWorker(
      {
        splitId,
        userId,
        sourceStorageKey,
        fileName: sourceFileName,
        regions: normalizedRegions,
        fadeMs: parsedFadeMs
      },
      '--split-stdin',
      180000
    );

    const manifestAssets = (result.assets || []).map((asset) => ({
      name: asset.name,
      fileName: asset.fileName || `${asset.name}.wav`,
      storageKey: asset.storageKey,
      durationSec: asset.durationSec
    }));

    await saveSplitRecord({
      splitId,
      userId,
      sourceFileName,
      sourceFormat,
      assets: manifestAssets
    });

    const signedAssets = await Promise.all(
      manifestAssets.map(async (asset) => ({
        ...asset,
        audioUrl: await signStorageUrl(asset.storageKey)
      }))
    );

    return {
      splitId,
      sourceFileName,
      sourceFormat,
      fadeMs: parsedFadeMs,
      totalAssets: signedAssets.length,
      assets: signedAssets
    };
  }

  static async downloadSplitZip(splitId, userId, format = 'auto') {
    const split = await getSplitRecord(splitId);
    if (split.userId !== userId) {
      throw createHttpError(403, 'Akses ditolak: Anda bukan pemilik aset pemecahan ini');
    }
    if (!Array.isArray(split.assets) || split.assets.length === 0) {
      throw createHttpError(400, 'Aset hasil pemecahan belum tersedia untuk diunduh');
    }

    const spec = resolveExportSpec(format, split.sourceFormat);
    const exported = await transcodeStorageItems(
      split.assets.map((asset) => ({
        name: asset.name,
        sourceStorageKey: asset.storageKey,
        fileName: asset.fileName || `${asset.name}.wav`
      })),
      spec
    );

    const { filename, buffer } = buildAudioZip(exported, split.sourceFileName, 'Assets');
    return {
      filename,
      buffer,
      resolvedFormat: spec.targetFormat
    };
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

    const { filename, buffer } = buildAudioZip(exported, job.fileName, 'Stems');
    return {
      filename,
      buffer,
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
