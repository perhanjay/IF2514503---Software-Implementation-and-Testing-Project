import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import prisma from './config/prisma.js';
import redis from './config/redis.js';
import { ensureBucketExists } from './config/s3.js';
import authRoutes from './routes/authRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes API
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/sessions', sessionRoutes);

// Health Check API
app.get('/api/health', async (req, res) => {
  const status = {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: 'UNKNOWN',
    redis: 'UNKNOWN',
    storage: 'UNKNOWN'
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    status.database = 'CONNECTED';
  } catch (err) {
    status.database = `ERROR: ${err.message}`;
  }

  try {
    if (redis.status !== 'ready') {
      await redis.connect();
    }
    const pong = await redis.ping();
    status.redis = pong === 'PONG' ? 'CONNECTED' : 'DISCONNECTED';
  } catch (err) {
    status.redis = `ERROR: ${err.message}`;
  }

  try {
    await ensureBucketExists();
    status.storage = 'CONNECTED';
  } catch (err) {
    status.storage = `ERROR: ${err.message}`;
  }

  const allHealthy = status.database === 'CONNECTED' && status.redis === 'CONNECTED' && status.storage === 'CONNECTED';
  return res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    services: status
  });
});

export default app;
