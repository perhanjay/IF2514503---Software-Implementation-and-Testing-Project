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
}
