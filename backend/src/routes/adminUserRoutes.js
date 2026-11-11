import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/auth.js';
import AdminUserController from '../controllers/adminUserController.js';

const router = Router();

// Protect all admin endpoints with authentication and administrator RBAC guard
router.use(authenticate, requireAdmin);

router.get('/', AdminUserController.listUsers);
router.get('/:id', AdminUserController.getUserDetail);

export default router;
