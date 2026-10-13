import { Router } from 'express';
import { PaymentController } from '../controllers/paymentController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

// Endpoint Publik / Webhook
router.post('/webhook', PaymentController.handleWebhook);
router.get('/orders/:id/status', authenticate, PaymentController.getOrderStatus);

// Endpoint Terotentikasi
router.get('/packages', authenticate, PaymentController.getPackages);
router.post('/checkout', authenticate, PaymentController.checkout);

export default router;
