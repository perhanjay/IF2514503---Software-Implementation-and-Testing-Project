import { Router } from 'express';
import multer from 'multer';
import { SessionController } from '../controllers/sessionController.js';
import { authenticate, requireAudioEngineer } from '../middlewares/auth.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB per file
});

const uploadFilesMiddleware = (req, res, next) => {
  upload.array('files', 50)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Maksimal 50 berkas audio per sesi' });
      }
      return res.status(400).json({ error: err.message || 'Gagal memproses unggahan berkas' });
    }
    if (req.files && req.files.length > 50) {
      return res.status(400).json({ error: 'Maksimal 50 berkas audio per sesi' });
    }
    next();
  });
};

router.use(authenticate);

router.get('/', SessionController.listSessions);
router.get('/:id', SessionController.getDetails);
router.patch('/:id/title', requireAudioEngineer, SessionController.updateTitle);
router.delete('/:id', requireAudioEngineer, SessionController.deleteSession);
router.post('/upload-init', requireAudioEngineer, SessionController.initUpload);
router.post('/upload-direct', requireAudioEngineer, uploadFilesMiddleware, SessionController.uploadDirect);
router.post('/:id/verify-integrity', requireAudioEngineer, SessionController.verifySession);

// UC-12: AI Instrument Classification & Multi-Mic Pairing
router.post('/:id/classify', requireAudioEngineer, SessionController.classifySession);
router.post('/:id/pairs/ai', requireAudioEngineer, SessionController.classifySession);
router.patch('/:id/tracks/:trackId/label', requireAudioEngineer, SessionController.updateTrackLabel);
router.post('/:id/pairs', requireAudioEngineer, SessionController.createPair);
router.delete('/:id/pairs/:pairId', requireAudioEngineer, SessionController.deletePair);
router.post('/:id/finalize-classification', requireAudioEngineer, SessionController.finalizeClassification);

// UC-13: Core DSP Diagnostic Engine & Mix Health Score
router.post('/:id/diagnose', requireAudioEngineer, SessionController.diagnoseSession);
router.get('/:id/diagnostics', SessionController.getDiagnostics);

// UC-14 & UC-15: DSP Audio Repair Engine
router.post('/:id/repair-auto', requireAudioEngineer, SessionController.repairAuto);
router.post('/:id/repair-custom', requireAudioEngineer, SessionController.repairCustom);

// UC-16: A/B Multitrack Auditioning Player Audio Sources
router.get('/:id/audio-sources', SessionController.getAudioSources);

// UC-17: Unduh Stem Hasil Perbaikan ZIP Lossless
router.get('/:id/download', SessionController.downloadSession);

// UC-18: Unduh Laporan Diagnostik Sesi PDF
router.get('/:id/report', SessionController.downloadReport);

export default router;

