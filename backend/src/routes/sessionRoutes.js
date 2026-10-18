import { Router } from 'express';
import multer from 'multer';
import { SessionController } from '../controllers/sessionController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB per file
});

router.use(authenticate);

router.get('/', SessionController.listSessions);
router.get('/:id', SessionController.getDetails);
router.patch('/:id/title', SessionController.updateTitle);
router.delete('/:id', SessionController.deleteSession);
router.post('/upload-init', SessionController.initUpload);
router.post('/upload-direct', upload.array('files', 30), SessionController.uploadDirect);
router.post('/:id/verify-integrity', SessionController.verifySession);

// UC-12: AI Instrument Classification & Multi-Mic Pairing
router.post('/:id/classify', SessionController.classifySession);
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

export default router;

