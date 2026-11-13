import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const adminEmail = 'admin@polaris.audio';
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'Admin123!';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // Upsert admin user
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: 'System Admin',
      role: 'ADMIN',
      status: 'ACTIVE'
    },
    create: {
      name: 'System Admin',
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE'
    }
  });

  // Ensure admin wallet balance is strictly 0 under zero-token policy
  const wallet = await prisma.wallet.upsert({
    where: { userId: admin.id },
    update: {
      balance: 0
    },
    create: {
      userId: admin.id,
      balance: 0
    }
  });

  console.log(`Seeded admin user: ${admin.email} (Wallet balance: ${wallet.balance})`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
