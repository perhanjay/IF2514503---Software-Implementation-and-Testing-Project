import redis, { isRedisReady } from '../config/redis.js';

const isTestEnv = () => process.env.NODE_ENV === 'test' || process.argv.some(arg => typeof arg === 'string' && arg.includes('test'));

// In-memory fallback map: normalizedEmail -> { count: number, lockedUntil: number | null, lastAttemptAt: number }
const memoryAttempts = new Map();

const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes (900,000 ms)
const MAX_FAILED_ATTEMPTS = 5;

export class LoginRateLimiter {
  static normalizeEmail(email) {
    return (email || '').toLowerCase().trim();
  }

  /**
   * Check if the account is currently locked out due to brute-force protection
   */
  static async isLocked(email) {
    const key = this.normalizeEmail(email);
    if (!key) return false;

    const now = Date.now();

    // 1. Check in-memory map
    const mem = memoryAttempts.get(key);
    if (mem && mem.lockedUntil) {
      if (now < mem.lockedUntil) {
        return true;
      }
      // Lock expired, reset
      memoryAttempts.delete(key);
    }

    // 2. Check Redis if available (bypassed in test environment to prevent hanging TCP sockets)
    try {
      if (!isTestEnv() && (await isRedisReady())) {
        const locked = await redis.get(`login:lock:${key}`);
        if (locked) return true;
      }
    } catch (e) {
      // Redis fallback ignored
    }

    return false;
  }

  /**
   * Record a failed login attempt for the given email.
   * If attempts reach 5, locks the account for 15 minutes.
   */
  static async recordFailedAttempt(email) {
    const key = this.normalizeEmail(email);
    if (!key) return { count: 0, isLocked: false };

    const now = Date.now();
    const mem = memoryAttempts.get(key) || { count: 0, lockedUntil: null, lastAttemptAt: now };

    // Rolling window: reset counter if more than 15 minutes elapsed since last attempt without lockout
    if (!mem.lockedUntil && mem.lastAttemptAt && (now - mem.lastAttemptAt > LOCK_DURATION_MS)) {
      mem.count = 0;
    }

    mem.count += 1;
    mem.lastAttemptAt = now;

    if (mem.count >= MAX_FAILED_ATTEMPTS) {
      mem.lockedUntil = now + LOCK_DURATION_MS;
    }
    memoryAttempts.set(key, mem);

    // Sync with Redis if available
    try {
      if (!isTestEnv() && (await isRedisReady())) {
        const attempts = await redis.incr(`login:attempts:${key}`);
        if (attempts === 1) {
          await redis.expire(`login:attempts:${key}`, 900);
        }
        if (attempts >= MAX_FAILED_ATTEMPTS) {
          await redis.set(`login:lock:${key}`, '1', 'EX', 900);
        }
      }
    } catch (e) {
      // Redis fallback ignored
    }

    return {
      count: mem.count,
      isLocked: mem.count >= MAX_FAILED_ATTEMPTS
    };
  }

  /**
   * Reset the failed attempt counter when a login succeeds
   */
  static async resetAttempts(email) {
    const key = this.normalizeEmail(email);
    if (!key) return;

    memoryAttempts.delete(key);

    try {
      if (!isTestEnv() && (await isRedisReady())) {
        await redis.del(`login:attempts:${key}`);
        await redis.del(`login:lock:${key}`);
      }
    } catch (e) {
      // Redis fallback ignored
    }
  }

  /**
   * Clear all records (useful for testing cleanup)
   */
  static async clearAll() {
    memoryAttempts.clear();
    try {
      if (!isTestEnv() && (await isRedisReady())) {
        const keys = await redis.keys('login:*');
        if (keys && keys.length > 0) {
          await redis.del(...keys);
        }
      }
    } catch (e) {
      // Redis fallback ignored
    }
  }
}

export default LoginRateLimiter;
