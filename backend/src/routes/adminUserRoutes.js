import express from 'express';
import { authenticate, requireAdmin } from '../middlewares/auth.js';

const router = express.Router();

// Placeholder route for middleware verification in Task 2
router.get('/', authenticate, requireAdmin, (req, res) => {
  res.json({ ok: true, message: 'Admin access granted' });
});

export default router;
