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
router.post('/upload-init', SessionController.initUpload);
router.post('/upload-direct', upload.array('files', 30), SessionController.uploadDirect);
router.post('/:id/verify-integrity', SessionController.verifySession);

export default router;
