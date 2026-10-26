import redis, { isRedisReady } from '../config/redis.js';

const isTestEnv = () => process.env.NODE_ENV === 'test' || process.argv.some(arg => typeof arg === 'string' && arg.includes('test'));

// In-memory fallback map: userId -> timestamp (ms)
const passwordChangedAtMap = new Map();

export class TokenRevocationService {
  /**
   * Revoke all tokens issued prior to this moment for a user
   */
  static async revokeUserTokens(userId) {
    if (!userId) return null;
    const now = Date.now();
    passwordChangedAtMap.set(userId, now);

    try {
      if (!isTestEnv() && (await isRedisReady())) {
        await redis.set(`user:passwordChangedAt:${userId}`, String(now));
      }
    } catch (e) {
      // Redis fallback ignored
    }

    return now;
  }

  /**
   * Check if a token (with issued-at timestamp or token authTime) is revoked
   */
  static async isTokenRevoked(userId, tokenIatSeconds, tokenAuthTime = null) {
    if (!userId) return false;

    let changedAt = null;
    try {
      if (!isTestEnv() && (await isRedisReady())) {
        const val = await redis.get(`user:passwordChangedAt:${userId}`);
        if (val) changedAt = Number(val);
      }
    } catch (e) {
      // Redis fallback ignored
    }

    if (!changedAt) {
      changedAt = passwordChangedAtMap.get(userId);
    }

    if (changedAt) {
      if (tokenAuthTime) {
        if (tokenAuthTime < changedAt) return true;
      } else if (tokenIatSeconds) {
        const changedAtSeconds = Math.floor(changedAt / 1000);
        if (tokenIatSeconds < changedAtSeconds) return true;
      }
    }
    return false;
  }

  /**
   * Clear all records (useful for test teardown)
   */
  static async clearAll() {
    passwordChangedAtMap.clear();
    try {
      if (!isTestEnv() && (await isRedisReady())) {
        const keys = await redis.keys('user:passwordChangedAt:*');
        if (keys && keys.length > 0) {
          await redis.del(...keys);
        }
      }
    } catch (e) {
      // Redis fallback ignored
    }
  }
}

export default TokenRevocationService;
