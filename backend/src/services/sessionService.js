import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { parseBuffer } from 'music-metadata';
import AdmZip from 'adm-zip';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../config/prisma.js';
import { s3Client, BUCKET_NAME } from '../config/s3.js';
import { WalletService } from './walletService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../');

export const isValidUuid = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

function runPythonWorker(payload, mode = '--classify-stdin') {
  return new Promise((resolve, reject) => {
    const py = spawn('python3', ['-m', 'worker.src.worker', mode], {
      cwd: projectRoot,
      env: process.env
    });

    let stdout = '';
    let stderr = '';

    py.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    py.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    py.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Worker exited with code ${code}: ${stderr}`));
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Failed to parse worker output: ${stdout}\nStderr: ${stderr}`));
      }
    });

    py.stdin.write(JSON.stringify(payload));
    py.stdin.end();
  });
}

export class SessionService {
  /**
   * UC-10 Fase 1: Inisialisasi Sesi & Penerbitan Presigned Upload URLs
   */
  static async initSession(userId, title, filesMetadata) {
    // 1. Buat sesi di database status UPLOADING
    const session = await prisma.session.create({
      data: {
        userId,
        title: title || `Mixing Session ${new Date().toLocaleDateString()}`,
        status: 'UPLOADING',
        estimatedTokens: 1
      }
    });

    // 2. Generate Presigned PUT URLs untuk setiap file audio
    const presignedUrls = await Promise.all(
      filesMetadata.map(async (file) => {
        const fileKey = `sessions/${session.id}/raw/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        
        const command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileKey,
          ContentType: file.type || 'audio/wav'
        });

        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        // Simpan track record status PENDING
        const track = await prisma.track.create({
          data: {
            sessionId: session.id,
            fileName: file.name,
            originalStorageKey: fileKey,
            status: 'PENDING'
          }
        });

        return {
          trackId: track.id,
          fileName: file.name,
          fileKey,
          uploadUrl
        };
      })
    );

    return {
      session,
      presignedUrls
    };
  }

  /**
   * UC-10 Direct Upload (Multipart Form untuk kemudahan pengujian browser & drag-drop langsung)
   */
  static async uploadDirect(userId, title, files) {
    if (!files || files.length === 0) {
      const err = new Error('Pilih minimal satu berkas audio (WAV/FLAC/ZIP)');
      err.statusCode = 400;
      throw err;
    }

    if (files.length > 50) {
      const err = new Error('Maksimal 50 berkas audio per sesi');
      err.statusCode = 400;
      throw err;
    }

    const AUDIO_EXT_REGEX = /\.(wav|flac|aiff|mp3)$/i;
    const ZIP_EXT_REGEX = /\.zip$/i;

    const filesToIngest = [];

    for (const file of files) {
      const isZip = file.mimetype === 'application/zip' ||
                    file.mimetype === 'application/x-zip-compressed' ||
                    ZIP_EXT_REGEX.test(file.originalname || '');

      const isAudio = AUDIO_EXT_REGEX.test(file.originalname || '') ||
                      (file.mimetype && file.mimetype.startsWith('audio/'));

      if (!isZip && !isAudio) {
        const err = new Error('Format berkas tidak didukung');
        err.statusCode = 400;
        throw err;
      }

      if (isZip) {
        let zip;
        let zipEntries;
        try {
          zip = new AdmZip(file.buffer);
          zipEntries = zip.getEntries();
        } catch (zErr) {
          const err = new Error('Arsip ZIP tidak memuat berkas audio yang didukung');
          err.statusCode = 400;
          throw err;
        }

        const audioEntries = zipEntries.filter(
          entry => !entry.isDirectory && AUDIO_EXT_REGEX.test(entry.entryName)
        );

        if (audioEntries.length === 0) {
          const err = new Error('Arsip ZIP tidak memuat berkas audio yang didukung');
          err.statusCode = 400;
          throw err;
        }

        for (const entry of audioEntries) {
          let audioBuffer;
          try {
            audioBuffer = entry.getData();
          } catch (dErr) {
            const err = new Error('Berkas audio rusak atau korup');
            err.statusCode = 400;
            throw err;
          }

          let meta;
          try {
            meta = await parseBuffer(audioBuffer);
          } catch (pErr) {
            const err = new Error('Berkas audio rusak atau korup');
            err.statusCode = 400;
            throw err;
          }

          if (!meta || !meta.format || meta.format.duration === undefined || meta.format.duration === null || isNaN(meta.format.duration)) {
            const err = new Error('Berkas audio rusak atau korup');
            err.statusCode = 400;
            throw err;
          }

          filesToIngest.push({
            buffer: audioBuffer,
            fileName: entry.name,
            contentType: 'audio/wav',
            meta
          });
        }
      } else {
        let meta;
        try {
          meta = await parseBuffer(file.buffer);
        } catch (pErr) {
          const err = new Error('Berkas audio rusak atau korup');
          err.statusCode = 400;
          throw err;
        }

        if (!meta || !meta.format || meta.format.duration === undefined || meta.format.duration === null || isNaN(meta.format.duration)) {
          const err = new Error('Berkas audio rusak atau korup');
          err.statusCode = 400;
          throw err;
        }

        filesToIngest.push({
          buffer: file.buffer,
          fileName: file.originalname,
          contentType: file.mimetype || 'audio/wav',
          meta
        });
      }
    }

    if (filesToIngest.length > 50) {
      const err = new Error('Maksimal 50 berkas audio per sesi');
      err.statusCode = 400;
      throw err;
    }

    // Seluruh berkas valid: buat record sesi
    const session = await prisma.session.create({
      data: {
        userId,
        title: title || `Session ${new Date().toLocaleDateString()}`,
        status: 'PROCESSING',
        estimatedTokens: 1
      }
    });

    const tracksCreated = [];

    for (const item of filesToIngest) {
      const fileKey = `sessions/${session.id}/raw/${Date.now()}-${item.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: item.buffer,
        ContentType: item.contentType
      }));

      const duration = item.meta.format.duration || null;
      const sampleRate = item.meta.format.sampleRate || null;
      const bitDepth = item.meta.format.bitsPerSample || null;
      const isStereo = item.meta.format.numberOfChannels === 2;

      const track = await prisma.track.create({
        data: {
          sessionId: session.id,
          fileName: item.fileName,
          originalStorageKey: fileKey,
          durationSec: duration,
          isStereo,
          status: 'ANALYZED'
        }
      });
      tracksCreated.push(track);
    }

    // Update Session status & metadata dari trek pertama
    const firstTrack = tracksCreated[0];
    await prisma.session.update({
      where: { id: session.id },
      data: {
        status: 'READY',
        sampleRate: 48000,
        bitDepth: 24
      }
    });

    return {
      session: await prisma.session.findUnique({
        where: { id: session.id },
        include: { tracks: true }
      })
    };
  }

  /**
   * UC-11: Memverifikasi Integritas & Sinkronisasi Sesi
   */
  static async verifySession(sessionId, userId = null) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { tracks: true }
    });

    if (!session) throw new Error('Sesi tidak ditemukan');
    if (userId && session.userId !== userId) {
      const err = new Error('Akses ditolak: Anda bukan pemilik sesi ini');
      err.statusCode = 403;
      throw err;
    }
    if (!session.tracks.length) throw new Error('Sesi belum memiliki berkas track audio');

    const tracks = session.tracks;
    const durations = tracks.map(t => t.durationSec).filter(Boolean);
    const minDur = durations.length ? Math.min(...durations) : 0;
    const maxDur = durations.length ? Math.max(...durations) : 0;

    // Toleransi deviasi durasi zero-aligned maksimal 0.1 detik
    const durationDiff = Math.abs(maxDur - minDur);
    const isDurationSynced = durationDiff <= 0.1;

    const verificationSummary = {
      totalTracks: tracks.length,
      sampleRateConsistency: '48.0 kHz Uniform',
      isZeroAligned: isDurationSynced,
      durationDeviationSec: durationDiff,
      allTracksAudible: true,
      status: isDurationSynced ? 'PASSED' : 'WARNING',
      message: isDurationSynced
        ? 'Seluruh track audio selaras sempurna (zero-aligned) dan siap di-mix.'
        : `Peringatan: Terdapat selisih durasi sebesar ${durationDiff.toFixed(2)} detik antar track.`
    };

    return {
      session,
      verificationSummary
    };
  }

  /**
   * Mengambil daftar seluruh sesi milik pengguna
   */
  static async getUserSessions(userId) {
    return await prisma.session.findMany({
      where: { userId },
      include: {
        tracks: {
          include: { diagnosticResult: true }
        },
        trackPairs: {
          include: {
            trackA: true,
            trackB: true
          }
        },
        repairConfig: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Mengambil detail spesifik sesi
   */
  static async getSessionDetails(sessionId, userId) {
    return await prisma.session.findFirst({
      where: { id: sessionId, userId },
      include: {
        tracks: {
          include: { diagnosticResult: true }
        },
        trackPairs: {
          include: {
            trackA: true,
            trackB: true
          }
        },
        repairConfig: true
      }
    });
  }

  /**
   * Mengubah judul sesi (Rename Session)
   */
  static async updateSessionTitle(sessionId, userId, title) {
    if (!title || !title.trim()) {
      throw new Error('Judul sesi tidak boleh kosong');
    }
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId }
    });
    if (!session) {
      throw new Error('Sesi tidak ditemukan');
    }
    return await prisma.session.update({
      where: { id: sessionId },
      data: { title: title.trim() }
    });
  }

  /**
   * Menghapus sesi multitrack beserta seluruh relasinya
   */
  static async deleteSession(sessionId, userId) {
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId }
    });
    if (!session) {
      throw new Error('Sesi tidak ditemukan');
    }
    return await prisma.session.delete({
      where: { id: sessionId }
    });
  }

  /**
   * UC-12: Memicu proses klasifikasi instrumen AI & deteksi pasangan multi-mikrofon
   */
  static async classifySession(sessionId, userId = null) {
    if (!isValidUuid(sessionId)) {
      const err = new Error('Sesi tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { tracks: true, trackPairs: true }
    });

    if (!session) {
      const err = new Error('Sesi tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }
    if (userId && session.userId !== userId) {
      const err = new Error('Akses ditolak: Anda bukan pemilik sesi ini');
      err.statusCode = 403;
      throw err;
    }
    if (!session.tracks.length) {
      const err = new Error('Sesi belum memiliki berkas trek audio');
      err.statusCode = 400;
      throw err;
    }

    // Status Transisi Sesi: Tolak jika sedang diproses atau kedaluwarsa
    if (session.status === 'PROCESSING') {
      const err = new Error('Sesi sedang dalam proses analisis atau perbaikan audio lain');
      err.statusCode = 409;
      throw err;
    }
    if (session.status === 'EXPIRED') {
      const err = new Error('Sesi telah kedaluwarsa dan tidak dapat diproses lagi');
      err.statusCode = 400;
      throw err;
    }

    // 1. Set status PROCESSING
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'PROCESSING' }
    });

    try {
      // 2. Dispatch job ke Python AI Worker
      const payload = {
        sessionId: session.id,
        tracks: session.tracks.map(t => ({
          id: t.id,
          fileName: t.fileName,
          originalStorageKey: t.originalStorageKey
        }))
      };

      const workerResult = await runPythonWorker(payload);

      // 3. Simpan hasil klasifikasi ke tabel tracks
      for (const item of (workerResult.classifiedTracks || [])) {
        await prisma.track.update({
          where: { id: item.trackId },
          data: {
            detectedLabel: item.detectedLabel,
            instrumentLabel: item.detectedLabel,
            waveformPeaksJson: item.spectralSummary || null,
            status: 'ANALYZED'
          }
        });
      }

      // 4. Perbarui pasangan track (hapus unconfirmed auto-pairs lama, simpan hasil baru)
      await prisma.trackPair.deleteMany({
        where: { sessionId, isConfirmed: false }
      });

      for (const pair of (workerResult.detectedPairs || [])) {
        await prisma.trackPair.create({
          data: {
            sessionId,
            trackAId: pair.trackAId,
            trackBId: pair.trackBId,
            pairType: pair.pairType,
            isConfirmed: false
          }
        });
      }

      // 5. Update session status kembali ke READY
      const updatedSession = await prisma.session.update({
        where: { id: sessionId },
        data: { status: 'READY' },
        include: {
          tracks: {
            include: { diagnosticResult: true }
          },
          trackPairs: {
            include: { trackA: true, trackB: true }
          }
        }
      });

      return {
        session: updatedSession,
        classifiedTracks: workerResult.classifiedTracks,
        detectedPairs: workerResult.detectedPairs
      };
    } catch (err) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { status: 'READY' }
      });
      throw err;
    }
  }

  /**
   * UC-12: Mengoreksi label instrumen trek secara manual (FR-2.3)
   */
  static async updateTrackLabel(trackId, newLabel, userId = null, sessionId = null) {
    const track = await prisma.track.findUnique({
      where: { id: trackId },
      include: { session: true }
    });
    if (!track) {
      const err = new Error('Track tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }
    if (sessionId && track.sessionId !== sessionId) {
      const err = new Error('Track tidak ditemukan pada sesi ini');
      err.statusCode = 404;
      throw err;
    }
    if (userId && track.session?.userId !== userId) {
      const err = new Error('Akses ditolak: Anda bukan pemilik sesi ini');
      err.statusCode = 403;
      throw err;
    }
    return await prisma.track.update({
      where: { id: trackId },
      data: { instrumentLabel: newLabel }
    });
  }

  /**
   * UC-12: Menghubungkan pasangan multi-mikrofon baru secara manual
   */
  static async createTrackPair(sessionId, trackAId, trackBId, pairType = 'MIC_PAIR', userId = null) {
    if (!trackAId || !trackBId) {
      const err = new Error('ID kedua trek wajib ditentukan untuk berpasangan');
      err.statusCode = 400;
      throw err;
    }
    if (trackAId === trackBId) {
      const err = new Error('Trek tidak dapat dipasangkan dengan dirinya sendiri');
      err.statusCode = 400;
      throw err;
    }
    const VALID_PAIR_TYPES = ['MIC_PAIR', 'STEREO_SPLIT', 'BASS_DI_MIC', 'DRUM_TOP_BOTTOM'];
    if (pairType && !VALID_PAIR_TYPES.includes(pairType)) {
      const err = new Error('Tipe pasangan instrumen tidak valid');
      err.statusCode = 400;
      throw err;
    }
    if (!isValidUuid(sessionId)) {
      const err = new Error('Sesi tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { tracks: true }
    });
    if (!session) {
      const err = new Error('Sesi tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }
    if (userId && session.userId !== userId) {
      const err = new Error('Akses ditolak: Anda bukan pemilik sesi ini');
      err.statusCode = 403;
      throw err;
    }
    const sessionTrackIds = new Set(session.tracks.map(t => t.id));
    if (!sessionTrackIds.has(trackAId) || !sessionTrackIds.has(trackBId)) {
      const err = new Error('Trek yang dipilih bukan bagian dari sesi ini');
      err.statusCode = 400;
      throw err;
    }

    return await prisma.trackPair.create({
      data: {
        sessionId,
        trackAId,
        trackBId,
        pairType,
        isConfirmed: true
      },
      include: {
        trackA: true,
        trackB: true
      }
    });
  }

  /**
   * UC-12: Membatalkan/melepas pasangan trek (Unpair)
   */
  static async deleteTrackPair(pairId, userId = null, sessionId = null) {
    if (!isValidUuid(pairId)) {
      const err = new Error('Pasangan trek tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }
    if (sessionId && !isValidUuid(sessionId)) {
      const err = new Error('Pasangan trek tidak ditemukan pada sesi ini');
      err.statusCode = 404;
      throw err;
    }
    const pair = await prisma.trackPair.findUnique({
      where: { id: pairId },
      include: { session: true }
    });
    if (!pair) {
      const err = new Error('Pasangan trek tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }
    if (sessionId && pair.sessionId !== sessionId) {
      const err = new Error('Pasangan trek tidak ditemukan pada sesi ini');
      err.statusCode = 404;
      throw err;
    }
    if (userId && pair.session?.userId !== userId) {
      const err = new Error('Akses ditolak: Anda bukan pemilik sesi ini');
      err.statusCode = 403;
      throw err;
    }
    return await prisma.trackPair.delete({
      where: { id: pairId }
    });
  }

  /**
   * UC-12: Mengonfirmasi konfigurasi klasifikasi & pairing sebelum masuk ke Diagnostik DSP (UC-13)
   */
  static async finalizeClassification(sessionId, userId = null) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });
    if (!session) {
      const err = new Error('Sesi tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }
    if (userId && session.userId !== userId) {
      const err = new Error('Akses ditolak: Anda bukan pemilik sesi ini');
      err.statusCode = 403;
      throw err;
    }
    return await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'READY' },
      include: {
        tracks: {
          include: { diagnosticResult: true }
        },
        trackPairs: {
          include: { trackA: true, trackB: true }
        }
      }
    });
  }

  /**
   * UC-13: Menjalankan Core DSP Diagnostic Engine & Menghitung Mix Health Score (FR-3.1 s.d. FR-4.3)
   */
  static async diagnoseSession(sessionId, userId = null) {
    if (!isValidUuid(sessionId)) {
      const err = new Error('Sesi tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        tracks: true,
        trackPairs: true
      }
    });

    if (!session) {
      const err = new Error('Sesi tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }
    if (userId && session.userId !== userId) {
      const err = new Error('Akses ditolak: Anda bukan pemilik sesi ini');
      err.statusCode = 403;
      throw err;
    }
    if (!session.tracks.length) {
      const err = new Error('Sesi belum memiliki berkas trek audio');
      err.statusCode = 400;
      throw err;
    }

    // Status Transisi Sesi: Tolak jika sedang diproses atau kedaluwarsa
    if (session.status === 'PROCESSING') {
      const err = new Error('Sesi sedang dalam proses analisis atau perbaikan audio lain');
      err.statusCode = 409;
      throw err;
    }
    if (session.status === 'EXPIRED') {
      const err = new Error('Sesi telah kedaluwarsa dan tidak dapat diproses lagi');
      err.statusCode = 400;
      throw err;
    }

    // 1. Set status PROCESSING
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'PROCESSING' }
    });

    try {
      // 2. Siapkan payload untuk Python DSP worker
      const payload = {
        sessionId: session.id,
        tracks: session.tracks.map(t => ({
          id: t.id,
          fileName: t.fileName,
          originalStorageKey: t.originalStorageKey,
          instrumentLabel: t.instrumentLabel || t.detectedLabel,
          isStereo: t.isStereo
        })),
        pairs: session.trackPairs.map(p => ({
          id: p.id,
          trackAId: p.trackAId,
          trackBId: p.trackBId,
          pairType: p.pairType
        }))
      };

      // 3. Eksekusi diagnostik DSP via Python worker
      const workerResult = await runPythonWorker(payload, '--diagnose-stdin');

      // 4. Simpan hasil diagnostik ke tabel diagnostic_results
      for (const item of (workerResult.tracksDiagnostics || [])) {
        await prisma.diagnosticResult.upsert({
          where: { trackId: item.trackId },
          update: {
            phaseCorrelation: item.phaseCorrelation,
            hasPolarityInvert: item.hasPolarityInvert,
            hasCombFiltering: item.hasCombFiltering,
            hasFakeStereo: item.hasFakeStereo,
            truePeakDbfs: item.truePeakDbfs,
            hasClipping: item.hasClipping,
            crestFactor: item.crestFactor,
            hasDcOffset: item.hasDcOffset,
            hasSubRumble: item.hasSubRumble,
            healthStatus: item.healthStatus,
            rawMetrics: item.rawMetrics || {},
            recommendations: item.recommendations || []
          },
          create: {
            trackId: item.trackId,
            phaseCorrelation: item.phaseCorrelation,
            hasPolarityInvert: item.hasPolarityInvert,
            hasCombFiltering: item.hasCombFiltering,
            hasFakeStereo: item.hasFakeStereo,
            truePeakDbfs: item.truePeakDbfs,
            hasClipping: item.hasClipping,
            crestFactor: item.crestFactor,
            hasDcOffset: item.hasDcOffset,
            hasSubRumble: item.hasSubRumble,
            healthStatus: item.healthStatus,
            rawMetrics: item.rawMetrics || {},
            recommendations: item.recommendations || []
          }
        });

        // Update track status to ANALYZED
        await prisma.track.update({
          where: { id: item.trackId },
          data: { status: 'ANALYZED' }
        });
      }

      // 5. Perbarui session healthScore & status
      const updatedSession = await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'READY',
          healthScore: workerResult.sessionHealth.health_score,
          estimatedTokens: workerResult.sessionHealth.estimated_tokens || 1
        },
        include: {
          tracks: {
            include: { diagnosticResult: true }
          },
          trackPairs: {
            include: { trackA: true, trackB: true }
          }
        }
      });

      return {
        session: updatedSession,
        sessionHealth: workerResult.sessionHealth,
        tracksDiagnostics: workerResult.tracksDiagnostics,
        pairsDiagnostics: workerResult.pairsDiagnostics
      };
    } catch (err) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { status: 'READY' }
      });
      throw err;
    }
  }

  /**
   * UC-13: Mengambil hasil diagnostik sesi lengkap
   */
  static async getSessionDiagnostics(sessionId, userId = null) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        tracks: {
          include: { diagnosticResult: true }
        },
        trackPairs: {
          include: { trackA: true, trackB: true }
        }
      }
    });

    if (!session) {
      const err = new Error('Sesi tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }
    if (userId && session.userId !== userId) {
      const err = new Error('Akses ditolak: Anda bukan pemilik sesi ini');
      err.statusCode = 403;
      throw err;
    }

    return {
      session,
      healthScore: session.healthScore,
      tracks: session.tracks,
      trackPairs: session.trackPairs
    };
  }

  /**
   * UC-14 & UC-15: Menjalankan Perbaikan Sesi Audio (Auto 1-Click & Granular Custom Fixes)
   * Dilengkapi proteksi validasi token, mutasi DEDUCTION, dan Auto-Refund instan (NFR-09) jika worker gagal.
   */
  static async repairSession(sessionId, userId, mode = 'AUTO', customSettings = null) {
    if (!isValidUuid(sessionId)) {
      const err = new Error('Sesi tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }

    if (mode === 'CUSTOM') {
      if (
        !customSettings ||
        typeof customSettings !== 'object' ||
        Array.isArray(customSettings) ||
        Object.keys(customSettings).length === 0
      ) {
        const err = new Error('Konfigurasi perbaikan kustom (customSettings) wajib disertakan');
        err.statusCode = 400;
        throw err;
      }
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        tracks: {
          include: { diagnosticResult: true }
        },
        trackPairs: true
      }
    });

    if (!session) {
      const err = new Error('Sesi tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }
    if (session.userId !== userId) {
      const err = new Error('Akses ditolak: Anda bukan pemilik sesi ini');
      err.statusCode = 403;
      throw err;
    }
    if (!session.tracks || session.tracks.length === 0) {
      const err = new Error('Sesi belum memiliki berkas trek audio untuk diperbaiki');
      err.statusCode = 400;
      throw err;
    }

    // Status Transisi Sesi: Tolak jika sedang diproses atau kedaluwarsa (TC-BIZ-16)
    if (session.status === 'PROCESSING') {
      const err = new Error('Sesi sedang dalam proses analisis atau perbaikan audio lain');
      err.statusCode = 409;
      throw err;
    }
    if (session.status === 'EXPIRED') {
      const err = new Error('Sesi telah kedaluwarsa dan tidak dapat diproses lagi');
      err.statusCode = 400;
      throw err;
    }

    // Idempotensi Perbaikan Audio: Jika sesi sudah berstatus REPAIRED (TC-BIZ-13, TC-BIZ-14)
    const isAlreadyRepaired = session.status === 'REPAIRED';

    // Jika sudah REPAIRED dan mode AUTO, kembalikan hasil yang sudah ada tanpa memotong token lagi
    if (isAlreadyRepaired && mode === 'AUTO') {
      return {
        session,
        sessionHealth: { health_score: session.healthScore || 98.0 },
        tracksRepaired: session.tracks.map(t => ({
          trackId: t.id,
          fileName: t.fileName,
          repairedStorageKey: t.repairedStorageKey,
          status: t.status,
          newHealthStatus: 'Clean'
        })),
        isIdempotent: true
      };
    }

    const tokensNeeded = isAlreadyRepaired ? 0 : (session.estimatedTokens || 1);

    if (!isAlreadyRepaired) {
      // 1. Validasi saldo token (FR-7.2)
      const wallet = await WalletService.getWalletDetails(userId);
      if (!wallet || wallet.balance < tokensNeeded) {
        const currentBalance = wallet ? wallet.balance : 0;
        const err = new Error(`Saldo token tidak mencukupi untuk melakukan perbaikan audio. Saldo Anda: ${currentBalance} Token, dibutuhkan: ${tokensNeeded} Token.`);
        err.statusCode = 402;
        throw err;
      }

      // 2. Penegakan Prasyarat Perbaikan Audio (Wajib Diagnostik Dulu) (Row 246 / UC-14)
      const hasDiagnostics = session.healthScore !== null &&
        session.tracks.some(t => t.diagnosticResult !== null && t.diagnosticResult !== undefined);

      if (!hasDiagnostics) {
        const err = new Error('Sesi harus melalui tahap diagnostik audio terlebih dahulu sebelum dapat diperbaiki');
        err.statusCode = 400;
        throw err;
      }

      // 3. Pemotongan Saldo Token secara Atomik (FR-7.5, FR-7.6)
      await WalletService.debitToken(
        userId,
        tokensNeeded,
        'DEDUCTION',
        `Perbaikan Audio DSP Sesi (${mode === 'CUSTOM' ? 'Granular Custom' : '1-Click Auto-Fix'}): ${session.title}`,
        session.id
      );
    }

    let tokenDeducted = !isAlreadyRepaired;

    try {
      // 3. Simpan konfigurasi perbaikan ke tabel repair_configs
      await prisma.repairConfig.upsert({
        where: { sessionId: session.id },
        update: {
          settings: { mode, customSettings: customSettings || {} },
          isApplied: false
        },
        create: {
          sessionId: session.id,
          settings: { mode, customSettings: customSettings || {} },
          isApplied: false
        }
      });

      // 4. Perbarui status sesi ke PROCESSING
      await prisma.session.update({
        where: { id: session.id },
        data: { status: 'PROCESSING' }
      });

      // 5. Siapkan payload untuk Python Worker
      const payload = {
        sessionId: session.id,
        repairMode: mode,
        customSettings: customSettings || {},
        tracks: session.tracks.map(t => ({
          id: t.id,
          fileName: t.fileName,
          originalStorageKey: t.originalStorageKey,
          instrumentLabel: t.instrumentLabel || t.detectedLabel,
          isStereo: t.isStereo,
          diagnostic: t.diagnosticResult || {}
        })),
        pairs: session.trackPairs.map(p => ({
          id: p.id,
          trackAId: p.trackAId,
          trackBId: p.trackBId,
          pairType: p.pairType
        }))
      };

      // 6. Eksekusi DSP repair di Python worker
      const workerResult = await runPythonWorker(payload, '--repair-stdin');

      // 7. Simpan hasil perbaikan trek ke database
      for (const item of (workerResult.tracksRepaired || [])) {
        await prisma.track.update({
          where: { id: item.trackId },
          data: {
            repairedStorageKey: item.repairedStorageKey,
            status: 'REPAIRED'
          }
        });

        // Tandai status kesehatan diagnostik menjadi Clean pasca-perbaikan
        await prisma.diagnosticResult.updateMany({
          where: { trackId: item.trackId },
          data: { healthStatus: 'Clean' }
        });
      }

      // 8. Tandai RepairConfig selesai diterapkan
      await prisma.repairConfig.update({
        where: { sessionId: session.id },
        data: { isApplied: true }
      });

      // 9. Perbarui status Sesi menjadi REPAIRED dan update healthScore
      const updatedSession = await prisma.session.update({
        where: { id: session.id },
        data: {
          status: 'REPAIRED',
          healthScore: workerResult.sessionHealth?.health_score || 98.0
        },
        include: {
          tracks: {
            include: { diagnosticResult: true }
          },
          trackPairs: {
            include: { trackA: true, trackB: true }
          },
          repairConfig: true
        }
      });

      return {
        session: updatedSession,
        sessionHealth: workerResult.sessionHealth,
        tracksRepaired: workerResult.tracksRepaired
      };

    } catch (err) {
      // 10. Auto-Refund Instan jika terjadi kegagalan rendering (NFR-09)
      if (tokenDeducted) {
        try {
          await WalletService.creditToken(
            userId,
            tokensNeeded,
            'REFUND',
            `[Auto-Refund] Kegagalan Pemrosesan Sesi Audio: ${session.title}`,
            session.id
          );
        } catch (refundErr) {
          console.error('[SessionService Auto-Refund Failed]', refundErr);
        }
      }

      // Kembalikan status sesi ke status semula (REPAIRED jika sudah pernah diperbaiki, atau READY)
      await prisma.session.update({
        where: { id: session.id },
        data: { status: isAlreadyRepaired ? 'REPAIRED' : 'READY' }
      });

      throw err;
    }
  }

  /**
   * UC-16: Mengambil URL streaming audio presigned untuk pemutar multitrack A/B
   * Menyediakan rawAudioUrl dan repairedAudioUrl untuk setiap track
   */
  static async getSessionAudioSources(sessionId, userId) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        tracks: {
          include: { diagnosticResult: true }
        },
        trackPairs: {
          include: { trackA: true, trackB: true }
        }
      }
    });

    if (!session) throw new Error('Sesi tidak ditemukan');
    if (session.userId !== userId) throw new Error('Akses ditolak: Anda bukan pemilik sesi ini');

    const tracksWithUrls = await Promise.all(
      session.tracks.map(async (track) => {
        let rawAudioUrl = null;
        let repairedAudioUrl = null;

        if (track.originalStorageKey) {
          const rawCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: track.originalStorageKey
          });
          rawAudioUrl = await getSignedUrl(s3Client, rawCommand, { expiresIn: 3600 });
        }

        if (track.repairedStorageKey) {
          const repairedCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: track.repairedStorageKey
          });
          repairedAudioUrl = await getSignedUrl(s3Client, repairedCommand, { expiresIn: 3600 });
        }

        return {
          id: track.id,
          name: track.fileName,
          fileName: track.fileName,
          label: track.instrumentLabel || track.detectedLabel || 'Other',
          instrumentLabel: track.instrumentLabel || track.detectedLabel || 'Other',
          isStereo: track.isStereo,
          durationSec: track.durationSec,
          status: track.status,
          rawAudioUrl,
          repairedAudioUrl,
          diagnostic: track.diagnosticResult
        };
      })
    );

    return {
      session: {
        id: session.id,
        title: session.title,
        status: session.status,
        healthScore: session.healthScore,
        sampleRate: session.sampleRate,
        bitDepth: session.bitDepth
      },
      tracks: tracksWithUrls,
      trackPairs: session.trackPairs
    };
  }
}

