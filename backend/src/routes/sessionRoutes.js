import { Router } from 'express';
import multer from 'multer';
import { SessionController } from '../controllers/sessionController.js';
import { authenticate } from '../middlewares/auth.js';

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
router.patch('/:id/title', SessionController.updateTitle);
router.delete('/:id', SessionController.deleteSession);
router.post('/upload-init', SessionController.initUpload);
router.post('/upload-direct', uploadFilesMiddleware, SessionController.uploadDirect);
router.post('/:id/verify-integrity', SessionController.verifySession);

// UC-12: AI Instrument Classification & Multi-Mic Pairing
router.post('/:id/classify', SessionController.classifySession);
router.post('/:id/pairs/ai', SessionController.classifySession);
router.patch('/:id/tracks/:trackId/label', SessionController.updateTrackLabel);
router.post('/:id/pairs', SessionController.createPair);
router.delete('/:id/pairs/:pairId', SessionController.deletePair);
router.post('/:id/finalize-classification', SessionController.finalizeClassification);

// UC-13: Core DSP Diagnostic Engine & Mix Health Score
router.post('/:id/diagnose', SessionController.diagnoseSession);
router.get('/:id/diagnostics', SessionController.getDiagnostics);

// UC-14 & UC-15: DSP Audio Repair Engine
router.post('/:id/repair-auto', SessionController.repairAuto);
router.post('/:id/repair-custom', SessionController.repairCustom);

// UC-16: A/B Multitrack Auditioning Player Audio Sources
router.get('/:id/audio-sources', SessionController.getAudioSources);

export default router;

