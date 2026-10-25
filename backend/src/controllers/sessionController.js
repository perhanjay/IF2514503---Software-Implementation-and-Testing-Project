import { SessionService, isValidUuid } from '../services/sessionService.js';

export class SessionController {
  /**
   * UC-10: Inisialisasi Presigned URL Upload Sesi
   */
  static async initUpload(req, res) {
    try {
      const { title, files } = req.body;
      if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'Daftar berkas file audio wajib disertakan' });
      }

      const result = await SessionService.initSession(req.user.id, title, files);
      return res.status(201).json(result);
    } catch (err) {
      console.error('[Init Upload Error]', err);
      return res.status(500).json({ error: 'Gagal menginisialisasi sesi upload' });
    }
  }

  /**
   * UC-10: Direct Multi-file & ZIP Upload Ingestion
   */
  static async uploadDirect(req, res) {
    try {
      const files = req.files;
      const { title } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'Pilih minimal satu berkas audio (WAV/FLAC/ZIP)' });
      }

      const result = await SessionService.uploadDirect(req.user.id, title, files);
      return res.status(201).json({
        message: 'Berkas multitrack berhasil diunggah dan disimpan ke MinIO S3',
        ...result
      });
    } catch (err) {
      console.error('[Upload Direct Error]', err);
      const isZipParseError = err.message?.includes('ADM-ZIP') || err.message?.includes('Invalid or unsupported zip format');
      const isClientError = err.statusCode === 400 ||
        err.message?.includes('tidak didukung') ||
        err.message?.includes('rusak atau korup') ||
        err.message?.includes('tidak memuat berkas audio') ||
        err.message?.includes('Maksimal 50') ||
        err.message?.includes('minimal satu berkas') ||
        isZipParseError;
      const status = isClientError ? 400 : (err.statusCode || 500);
      const errorMessage = isZipParseError
        ? 'Arsip ZIP tidak memuat berkas audio yang didukung'
        : (err.message || 'Gagal mengunggah berkas sesi');
      return res.status(status).json({ error: errorMessage });
    }
  }

  /**
   * UC-11: Memverifikasi Integritas & Sinkronisasi Sesi
   */
  static async verifySession(req, res) {
    try {
      const { id } = req.params;
      const result = await SessionService.verifySession(id, req.user.id);
      return res.json(result);
    } catch (err) {
      console.error('[Verify Session Error]', err);
      const isNotFound = err.message === 'Sesi tidak ditemukan';
      const isForbidden = err.message?.includes('Akses ditolak');
      const status = err.statusCode || (isForbidden ? 403 : (isNotFound ? 400 : 400));
      return res.status(status).json({ error: err.message || 'Gagal memverifikasi sesi' });
    }
  }

  /**
   * Mengambil daftar sesi milik user
   */
  static async listSessions(req, res) {
    try {
      const sessions = await SessionService.getUserSessions(req.user.id);
      return res.json({ sessions });
    } catch (err) {
      return res.status(500).json({ error: 'Gagal memuat daftar sesi' });
    }
  }

  /**
   * Mengambil detail sesi aktif
   */
  static async getDetails(req, res) {
    try {
      const { id } = req.params;
      const session = await SessionService.getSessionDetails(id, req.user.id);
      if (!session) {
        return res.status(404).json({ error: 'Sesi tidak ditemukan' });
      }
      return res.json({ session });
    } catch (err) {
      return res.status(500).json({ error: 'Gagal memuat detail sesi' });
    }
  }

  /**
   * UC-12: Memicu proses inferensi AI klasifikasi instrumen & multi-mic pairing
   */
  static async classifySession(req, res) {
    try {
      const { id } = req.params;
      if (!isValidUuid(id)) {
        return res.status(404).json({ error: 'Sesi tidak ditemukan' });
      }
      const result = await SessionService.classifySession(id, req.user.id);
      return res.json({
        message: 'Klasifikasi instrumen AI dan deteksi pasangan mikrofon selesai',
        ...result
      });
    } catch (err) {
      console.error('[Classify Session Error]', err);
      const isNotFound = err.message?.includes('tidak ditemukan');
      const isForbidden = err.message?.includes('Akses ditolak');
      const isBadRequest = err.message?.includes('belum memiliki');
      const status = err.statusCode || (isForbidden ? 403 : (isNotFound ? 404 : (isBadRequest ? 400 : 500)));
      return res.status(status).json({ error: err.message || 'Gagal menjalankan klasifikasi AI' });
    }
  }

  /**
   * UC-12: Mengoreksi label instrumen secara manual (FR-2.3)
   */
  static async updateTrackLabel(req, res) {
    try {
      const { id, trackId } = req.params;
      const { label } = req.body;
      if (!label) {
        return res.status(400).json({ error: 'Label instrumen baru wajib ditentukan' });
      }

      const updatedTrack = await SessionService.updateTrackLabel(trackId, label, req.user.id, id);
      return res.json({
        message: 'Label instrumen berhasil diperbarui',
        track: updatedTrack
      });
    } catch (err) {
      console.error('[Update Label Error]', err);
      const isNotFound = err.message?.includes('tidak ditemukan');
      const isForbidden = err.message?.includes('Akses ditolak');
      const status = err.statusCode || (isForbidden ? 403 : (isNotFound ? 404 : 500));
      return res.status(status).json({ error: err.message || 'Gagal memperbarui label instrumen' });
    }
  }

  /**
   * UC-12: Membuat pasangan track mikrofon manual
   */
  static async createPair(req, res) {
    try {
      const { id } = req.params;
      const { trackAId, trackBId, pairType } = req.body || {};

      if (!trackAId || !trackBId) {
        return res.status(400).json({ error: 'ID kedua trek wajib ditentukan untuk berpasangan' });
      }

      if (trackAId === trackBId) {
        return res.status(400).json({ error: 'Trek tidak dapat dipasangkan dengan dirinya sendiri' });
      }

      const VALID_PAIR_TYPES = ['MIC_PAIR', 'STEREO_SPLIT', 'BASS_DI_MIC', 'DRUM_TOP_BOTTOM'];
      if (pairType && !VALID_PAIR_TYPES.includes(pairType)) {
        return res.status(400).json({ error: 'Tipe pasangan instrumen tidak valid' });
      }

      if (!isValidUuid(id)) {
        return res.status(404).json({ error: 'Sesi tidak ditemukan' });
      }

      if (!isValidUuid(trackAId) || !isValidUuid(trackBId)) {
        return res.status(400).json({ error: 'Trek yang dipilih bukan bagian dari sesi ini' });
      }

      const pair = await SessionService.createTrackPair(id, trackAId, trackBId, pairType || 'MIC_PAIR', req.user.id);
      return res.status(201).json({
        message: 'Pasangan trek mikrofon berhasil dibuat',
        pair
      });
    } catch (err) {
      console.error('[Create Pair Error]', err);
      const isNotFound = err.message?.includes('tidak ditemukan');
      const isForbidden = err.message?.includes('Akses ditolak');
      const isBadRequest = err.message?.includes('bukan bagian dari sesi') ||
                           err.message?.includes('dirinya sendiri') ||
                           err.message?.includes('tidak valid') ||
                           err.message?.includes('wajib ditentukan');
      const status = err.statusCode || (isForbidden ? 403 : (isNotFound ? 404 : (isBadRequest ? 400 : 500)));
      return res.status(status).json({ error: err.message || 'Gagal membuat pasangan trek' });
    }
  }

  /**
   * UC-12: Menghapus / melepas pasangan trek (Unpair)
   */
  static async deletePair(req, res) {
    try {
      const { id, pairId } = req.params;
      if (!isValidUuid(id)) {
        return res.status(404).json({ error: 'Sesi tidak ditemukan' });
      }
      if (!isValidUuid(pairId)) {
        return res.status(404).json({ error: 'Pasangan trek tidak ditemukan' });
      }
      await SessionService.deleteTrackPair(pairId, req.user.id, id);
      return res.json({ message: 'Pasangan trek berhasil dilepas (unpaired)' });
    } catch (err) {
      console.error('[Delete Pair Error]', err);
      const isNotFound = err.message?.includes('tidak ditemukan');
      const isForbidden = err.message?.includes('Akses ditolak');
      const status = err.statusCode || (isForbidden ? 403 : (isNotFound ? 404 : 500));
      return res.status(status).json({ error: err.message || 'Gagal melepas pasangan trek' });
    }
  }

  /**
   * UC-12: Konfirmasi klasifikasi & lanjut ke diagnostik DSP
   */
  static async finalizeClassification(req, res) {
    try {
      const { id } = req.params;
      const resultSession = await SessionService.finalizeClassification(id, req.user.id);
      return res.json({
        message: 'Konfigurasi trek dan pasangan berhasil dikunci. Siap untuk analisis DSP.',
        session: resultSession
      });
    } catch (err) {
      console.error('[Finalize Error]', err);
      const isNotFound = err.message?.includes('tidak ditemukan');
      const isForbidden = err.message?.includes('Akses ditolak');
      const status = err.statusCode || (isForbidden ? 403 : (isNotFound ? 404 : 500));
      return res.status(status).json({ error: err.message || 'Gagal mengonfirmasi klasifikasi' });
    }
  }

  /**
   * UC-13: Menjalankan Core DSP Diagnostic Engine & Mix Health Score
   */
  static async diagnoseSession(req, res) {
    try {
      const { id } = req.params;
      if (!isValidUuid(id)) {
        return res.status(404).json({ error: 'Sesi tidak ditemukan' });
      }
      const result = await SessionService.diagnoseSession(id, req.user.id);
      return res.json({
        message: 'Pemindaian diagnostik DSP dan audit kesehatan sesi selesai',
        ...result
      });
    } catch (err) {
      console.error('[Diagnose Session Error]', err);
      const isNotFound = err.message?.includes('tidak ditemukan');
      const isForbidden = err.message?.includes('Akses ditolak');
      const isBadRequest = err.message?.includes('belum memiliki');
      const status = err.statusCode || (isForbidden ? 403 : (isNotFound ? 404 : (isBadRequest ? 400 : 500)));
      return res.status(status).json({ error: err.message || 'Gagal menjalankan diagnostik DSP' });
    }
  }

  /**
   * UC-13: Mengambil laporan metrik diagnostik sesi
   */
  static async getDiagnostics(req, res) {
    try {
      const { id } = req.params;
      const result = await SessionService.getSessionDiagnostics(id, req.user.id);
      return res.json(result);
    } catch (err) {
      console.error('[Get Diagnostics Error]', err);
      const isNotFound = err.message === 'Sesi tidak ditemukan' || err.message?.includes('tidak ditemukan');
      const isForbidden = err.message?.includes('Akses ditolak');
      const status = err.statusCode || (isForbidden ? 403 : (isNotFound ? 404 : 500));
      return res.status(status).json({ error: err.message || 'Gagal mengambil data diagnostik sesi' });
    }
  }

  /**
   * Mengubah judul sesi (Rename Session)
   */
  static async updateTitle(req, res) {
    try {
      const { id } = req.params;
      const { title } = req.body;
      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Judul sesi tidak boleh kosong' });
      }
      const session = await SessionService.updateSessionTitle(id, req.user.id, title);
      return res.json({
        message: 'Judul sesi berhasil diperbarui',
        session
      });
    } catch (err) {
      console.error('[Update Session Title Error]', err);
      const isNotFound = err.message === 'Sesi tidak ditemukan';
      return res.status(isNotFound ? 404 : 400).json({
        error: err.message || 'Gagal mengubah judul sesi'
      });
    }
  }

  /**
   * Menghapus sesi multitrack
   */
  static async deleteSession(req, res) {
    try {
      const { id } = req.params;
      await SessionService.deleteSession(id, req.user.id);
      return res.json({ message: 'Sesi berhasil dihapus' });
    } catch (err) {
      console.error('[Delete Session Error]', err);
      const isNotFound = err.message === 'Sesi tidak ditemukan';
      return res.status(isNotFound ? 404 : 500).json({
        error: err.message || 'Gagal menghapus sesi'
      });
    }
  }

  /**
   * UC-14: Menjalankan Perbaikan Sesi Otomatis (1-Click Auto-Fix)
   */
  static async repairAuto(req, res) {
    try {
      const { id } = req.params;
      const result = await SessionService.repairSession(id, req.user.id, 'AUTO');
      return res.json({
        message: 'Perbaikan otomatis DSP sesi berhasil diterapkan',
        ...result
      });
    } catch (err) {
      console.error('[Repair Auto Error]', err);
      const isNotFound = err.message?.includes('tidak ditemukan');
      const isForbidden = err.message?.includes('Akses ditolak');
      const status = err.statusCode || (isForbidden ? 403 : (isNotFound ? 404 : 400));
      return res.status(status).json({ error: err.message || 'Gagal mengeksekusi perbaikan otomatis' });
    }
  }

  /**
   * UC-15: Menyesuaikan Perbaikan Kecil (Granular DSP Fixes)
   */
  static async repairCustom(req, res) {
    try {
      const { id } = req.params;
      const { customSettings } = req.body || {};

      if (!isValidUuid(id)) {
        return res.status(404).json({ error: 'Sesi tidak ditemukan' });
      }

      if (
        !customSettings ||
        typeof customSettings !== 'object' ||
        Array.isArray(customSettings) ||
        Object.keys(customSettings).length === 0
      ) {
        return res.status(400).json({
          error: 'Konfigurasi perbaikan kustom (customSettings) wajib disertakan'
        });
      }

      const result = await SessionService.repairSession(id, req.user.id, 'CUSTOM', customSettings);
      return res.json({
        message: 'Perbaikan kustom DSP sesi berhasil diterapkan',
        ...result
      });
    } catch (err) {
      console.error('[Repair Custom Error]', err);
      const isNotFound = err.message?.includes('tidak ditemukan');
      const isForbidden = err.message?.includes('Akses ditolak');
      const status = err.statusCode || (isForbidden ? 403 : (isNotFound ? 404 : 400));
      return res.status(status).json({ error: err.message || 'Gagal mengeksekusi perbaikan kustom' });
    }
  }

  /**
   * UC-16: Mengambil URL streaming audio presigned untuk pemutar multitrack A/B
   */
  static async getAudioSources(req, res) {
    try {
      const { id } = req.params;
      const result = await SessionService.getSessionAudioSources(id, req.user.id);
      return res.json(result);
    } catch (err) {
      console.error('[Get Audio Sources Error]', err);
      const isNotFound = err.message === 'Sesi tidak ditemukan';
      const isForbidden = err.message?.includes('Akses ditolak');
      const status = isNotFound ? 404 : (isForbidden ? 403 : 500);
      return res.status(status).json({ error: err.message || 'Gagal mengambil URL audio sesi' });
    }
  }
}


