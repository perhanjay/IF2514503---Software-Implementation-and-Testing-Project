import { Router } from 'express';
import { AdminTransactionController } from '../controllers/adminTransactionController.js';
import { authenticate, requireAdmin } from '../middlewares/auth.js';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', AdminTransactionController.listTransactions);

export default router;
