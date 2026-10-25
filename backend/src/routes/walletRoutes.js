import { Router } from 'express';
import { WalletController } from '../controllers/walletController.js';
import { PaymentController } from '../controllers/paymentController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.get('/details', authenticate, WalletController.getDetails);
router.post('/topup', authenticate, WalletController.topup);
router.post('/top-up', authenticate, WalletController.topup);
router.post('/claim-daily', authenticate, WalletController.claimDaily);

// Payment order status & webhook aliases on /wallet prefix
router.get('/orders/:id/status', authenticate, PaymentController.getOrderStatus);
router.post('/webhook', PaymentController.handleWebhook);

export default router;
