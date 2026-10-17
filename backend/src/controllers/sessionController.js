import { SessionService } from '../services/sessionService.js';

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
      return res.status(500).json({ error: 'Gagal mengunggah berkas sesi' });
    }
  }

  /**
   * UC-11: Memverifikasi Integritas & Sinkronisasi Sesi
   */
  static async verifySession(req, res) {
    try {
      const { id } = req.params;
      const result = await SessionService.verifySession(id);
      return res.json(result);
    } catch (err) {
      console.error('[Verify Session Error]', err);
      return res.status(400).json({ error: err.message || 'Gagal memverifikasi sesi' });
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
      const result = await SessionService.classifySession(id);
      return res.json({
        message: 'Klasifikasi instrumen AI dan deteksi pasangan mikrofon selesai',
        ...result
      });
    } catch (err) {
      console.error('[Classify Session Error]', err);
      return res.status(500).json({ error: err.message || 'Gagal menjalankan klasifikasi AI' });
    }
  }

  /**
   * UC-12: Mengoreksi label instrumen secara manual (FR-2.3)
   */
  static async updateTrackLabel(req, res) {
    try {
      const { trackId } = req.params;
      const { label } = req.body;
      if (!label) {
        return res.status(400).json({ error: 'Label instrumen baru wajib ditentukan' });
      }

      const updatedTrack = await SessionService.updateTrackLabel(trackId, label);
      return res.json({
        message: 'Label instrumen berhasil diperbarui',
        track: updatedTrack
      });
    } catch (err) {
      console.error('[Update Label Error]', err);
      return res.status(500).json({ error: 'Gagal memperbarui label instrumen' });
    }
  }

  /**
   * UC-12: Membuat pasangan track mikrofon manual
   */
  static async createPair(req, res) {
    try {
      const { id } = req.params;
      const { trackAId, trackBId, pairType } = req.body;
      if (!trackAId || !trackBId) {
        return res.status(400).json({ error: 'ID kedua trek wajib ditentukan untuk berpasangan' });
      }

      const pair = await SessionService.createTrackPair(id, trackAId, trackBId, pairType || 'MIC_PAIR');
      return res.status(201).json({
        message: 'Pasangan trek mikrofon berhasil dibuat',
        pair
      });
    } catch (err) {
      console.error('[Create Pair Error]', err);
      return res.status(500).json({ error: 'Gagal membuat pasangan trek' });
    }
  }

  /**
   * UC-12: Menghapus / melepas pasangan trek (Unpair)
   */
  static async deletePair(req, res) {
    try {
      const { pairId } = req.params;
      await SessionService.deleteTrackPair(pairId);
      return res.json({ message: 'Pasangan trek berhasil dilepas (unpaired)' });
    } catch (err) {
      console.error('[Delete Pair Error]', err);
      return res.status(500).json({ error: 'Gagal melepas pasangan trek' });
    }
  }

  /**
   * UC-12: Konfirmasi klasifikasi & lanjut ke diagnostik DSP
   */
  static async finalizeClassification(req, res) {
    try {
      const { id } = req.params;
      const session = await SessionService.finalizeClassification(id);
      return res.json({
        message: 'Konfigurasi trek dan pasangan berhasil dikunci. Siap untuk analisis DSP.',
        session
      });
    } catch (err) {
      console.error('[Finalize Error]', err);
      return res.status(500).json({ error: 'Gagal mengonfirmasi klasifikasi' });
    }
  }

  /**
   * UC-13: Menjalankan Core DSP Diagnostic Engine & Mix Health Score
   */
  static async diagnoseSession(req, res) {
    try {
      const { id } = req.params;
      const result = await SessionService.diagnoseSession(id);
      return res.json({
        message: 'Pemindaian diagnostik DSP dan audit kesehatan sesi selesai',
        ...result
      });
    } catch (err) {
      console.error('[Diagnose Session Error]', err);
      return res.status(500).json({ error: err.message || 'Gagal menjalankan diagnostik DSP' });
    }
  }

  /**
   * UC-13: Mengambil laporan metrik diagnostik sesi
   */
  static async getDiagnostics(req, res) {
    try {
      const { id } = req.params;
      const result = await SessionService.getSessionDiagnostics(id);
      return res.json(result);
    } catch (err) {
      console.error('[Get Diagnostics Error]', err);
      return res.status(500).json({ error: err.message || 'Gagal mengambil data diagnostik sesi' });
    }
  }
}


