import prisma from '../../src/config/prisma.js';
import bcrypt from 'bcryptjs';

export const TEST_EMAIL_DOMAIN = '@polaris-test.local';

/**
 * Creates a unique hermetic test user with an initialized wallet
 */
export async function createTestUser({
  name = 'Hermetic Tester',
  email = null,
  password = 'Password123!',
  role = 'AUDIO_ENGINEER',
  balance = 5
} = {}) {
  const uniqueEmail = email || `test-${Date.now()}-${Math.floor(Math.random() * 10000)}${TEST_EMAIL_DOMAIN}`;
  const passwordHash = await bcrypt.hash(password, 10);

  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email: uniqueEmail,
        passwordHash,
        role
      }
    });

    const wallet = await tx.wallet.create({
      data: {
        userId: user.id,
        balance
      }
    });

    return { user, wallet, rawPassword: password };
  });
}

/**
 * Cleans up all test users and associated records created during testing
 */
export async function cleanupTestData() {
  try {
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { endsWith: TEST_EMAIL_DOMAIN } },
          { email: 'guest@polaris.audio' }
        ]
      }
    });
  } catch (err) {
    console.warn('[cleanupTestData warn]:', err.message);
  }
}
