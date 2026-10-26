import crypto from 'crypto';
import redis, { isRedisReady } from '../config/redis.js';

const isTestEnv = () =>
  process.env.NODE_ENV === 'test' ||
  process.argv.some(arg => typeof arg === 'string' && arg.includes('test'));

// In-memory fallback token store: tokenHash -> { userId, email, expiresAt }
const memoryResetTokens = new Map();
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour validity

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class PasswordResetService {
  /**
   * Generates a temporary 1-hour reset token for the specified user,
   * storing the SHA-256 hash in DB/memory/cache conforming to security best practices.
   */
  static async createResetToken(user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = Date.now() + TOKEN_EXPIRY_MS;

    const payload = {
      userId: user.id,
      email: (user.email || '').toLowerCase().trim(),
      expiresAt
    };

    memoryResetTokens.set(tokenHash, payload);

    try {
      if (!isTestEnv() && (await isRedisReady())) {
        await redis.set(
          `auth:reset:${tokenHash}`,
          JSON.stringify(payload),
          'EX',
          3600
        );
      }
    } catch {
      // Redis fallback ignored
    }

    return { token: rawToken, expiresAt };
  }

  /**
   * Verifies if a reset token is valid and not expired by comparing SHA-256 hashes
   */
  static async verifyResetToken(token) {
    if (!token || typeof token !== 'string' || !token.trim()) return null;

    const tokenHash = hashToken(token.trim());
    const entry = memoryResetTokens.get(tokenHash);

    if (entry) {
      if (Date.now() > entry.expiresAt) {
        memoryResetTokens.delete(tokenHash);
        return null;
      }
      return entry;
    }

    try {
      if (!isTestEnv() && (await isRedisReady())) {
        const raw = await redis.get(`auth:reset:${tokenHash}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
            await redis.del(`auth:reset:${tokenHash}`);
            return null;
          }
          return parsed;
        }
      }
    } catch {
      // Redis fallback ignored
    }

    return null;
  }

  /**
   * Consumes and invalidates a reset token upon successful password reset (Anti-replay)
   */
  static async consumeResetToken(token) {
    if (!token || typeof token !== 'string' || !token.trim()) return null;

    const tokenHash = hashToken(token.trim());
    const entry = await this.verifyResetToken(token);
    if (!entry) return null;

    memoryResetTokens.delete(tokenHash);

    try {
      if (!isTestEnv() && (await isRedisReady())) {
        await redis.del(`auth:reset:${tokenHash}`);
      }
    } catch {
      // Redis fallback ignored
    }

    return entry;
  }

  /**
   * Clears all tokens (useful for testing)
   */
  static clearAll() {
    memoryResetTokens.clear();
  }
}

export default PasswordResetService;
