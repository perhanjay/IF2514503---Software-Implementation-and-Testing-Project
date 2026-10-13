import { Router } from 'express';
import { WalletController } from '../controllers/walletController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.get('/details', authenticate, WalletController.getDetails);
router.post('/topup', authenticate, WalletController.topup);
router.post('/claim-daily', authenticate, WalletController.claimDaily);

export default router;
