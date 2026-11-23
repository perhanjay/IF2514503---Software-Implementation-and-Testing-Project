import { Router } from 'express';
import multer from 'multer';
import { WorkbenchController } from '../controllers/workbenchController.js';
import { authenticate, requireAudioEngineer } from '../middlewares/auth.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB max
});

const uploadSingleAudio = (req, res, next) => {
  upload.single('audio')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Ukuran berkas melebihi batas maksimal 100 MB' });
      }
      return res.status(400).json({ error: err.message || 'Gagal memproses unggahan berkas audio' });
    }
    next();
  });
};

router.use(authenticate, requireAudioEngineer);

router.post('/separate', uploadSingleAudio, WorkbenchController.separate);
router.get('/jobs/:jobId', WorkbenchController.getJobStatus);
router.get('/jobs/:jobId/download-zip', WorkbenchController.downloadZip);
router.get('/jobs/:jobId/stems/:stemName/download', WorkbenchController.downloadStem);
router.post('/jobs/:jobId/send-to-session', WorkbenchController.sendToSession);
router.post('/split', uploadSingleAudio, WorkbenchController.split);
router.get('/splits/:splitId/download-zip', WorkbenchController.downloadSplitZip);
router.get('/export', WorkbenchController.exportObject);

export default router;
