import { Redis } from 'ioredis';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = Number(process.env.REDIS_PORT) || 6379;

export const redis = new Redis({
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: null,
  lazyConnect: true
});

// Suppress unhandled error crash if Redis is unavailable or connecting in background
redis.on('error', (err) => {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[Redis Warning]', err.message);
  }
});

redis.on('ready', () => {
  if (process.env.NODE_ENV === 'test') {
    redis.stream?.unref();
    redis.connector?.stream?.unref();
  }
});

/**
 * Ensures Redis connection is ready, handling lazyConnect mode safely
 */
export async function isRedisReady() {
  if (redis.status === 'wait') {
    try {
      await redis.connect();
      if (process.env.NODE_ENV === 'test') {
        redis.stream?.unref();
        redis.connector?.stream?.unref();
      }
    } catch {
      return false;
    }
  }
  return redis.status === 'ready';
}

export default redis;
