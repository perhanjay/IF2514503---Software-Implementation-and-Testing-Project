import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { createTestUser, cleanupTestData, TEST_EMAIL_DOMAIN } from './helpers/testDb.js';

describe('Admin User Management & Security Middlewares (Task 2)', () => {
  let adminFixture;
  let adminToken;
  let engineerFixture;
  let engineerToken;
  let suspendedFixture;
  let suspendedToken;

  before(async () => {
    await cleanupTestData();

    // 1. Admin user fixture
    adminFixture = await createTestUser({
      name: 'Super Admin User',
      email: `admin-t2-${Date.now()}${TEST_EMAIL_DOMAIN}`,
      password: 'AdminPassword2026!',
      role: 'ADMIN'
    });
    adminToken = jwt.sign(
      { userId: adminFixture.user.id, role: adminFixture.user.role, authTime: Date.now() },
      process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
      { expiresIn: '7d' }
    );

    // 2. Audio Engineer user fixture
    engineerFixture = await createTestUser({
      name: 'Standard Engineer',
      email: `engineer-t2-${Date.now()}${TEST_EMAIL_DOMAIN}`,
      password: 'EngineerPassword2026!',
      role: 'AUDIO_ENGINEER'
    });
    engineerToken = jwt.sign(
      { userId: engineerFixture.user.id, role: engineerFixture.user.role, authTime: Date.now() },
      process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
      { expiresIn: '7d' }
    );

    // 3. Pre-suspended user fixture
    suspendedFixture = await createTestUser({
      name: 'Suspended Account User',
      email: `suspended-t2-${Date.now()}${TEST_EMAIL_DOMAIN}`,
      password: 'SuspendedPassword2026!',
      role: 'AUDIO_ENGINEER',
      status: 'SUSPENDED',
      statusReason: 'Pelanggaran ketentuan layanan: deteksi aktivitas mencurigakan'
    });
    suspendedToken = jwt.sign(
      { userId: suspendedFixture.user.id, role: suspendedFixture.user.role, authTime: Date.now() },
      process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
      { expiresIn: '7d' }
    );
  });

  after(async () => {
    await cleanupTestData();
  });

  describe('1. RBAC & requireAdmin Middleware Tests', () => {
    it('ADM-01: Permintaan tanpa token ke rute admin harus ditolak (401 Unauthorized)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users');

      assert.equal(res.status, 401);
      assert.match(res.body.error, /Unauthorized/i);
    });

    it('ADM-02: Pengguna dengan role AUDIO_ENGINEER harus ditolak saat mengakses rute admin (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${engineerToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error, /Memerlukan hak akses Administrator/i);
    });

    it('ADM-03: Sesi tamu (guest) harus ditolak saat mengakses rute admin (403 Forbidden)', async () => {
      // Create guest session
      const guestRes = await request(app).post('/api/v1/auth/guest-session');
      assert.equal(guestRes.status, 200);
      const guestToken = guestRes.body.token;

      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${guestToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error, /Memerlukan hak akses Administrator/i);
    });

    it('ADM-04: Pengguna dengan role ADMIN berhasil mengakses rute admin (200 OK)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.users));
    });
  });

  describe('2. Suspended Account Enforcement Tests', () => {
    it('ADM-05: Akun berstatus SUSPENDED tidak boleh login meskipun kata sandi benar (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: suspendedFixture.user.email,
          password: 'SuspendedPassword2026!'
        });

      assert.equal(res.status, 403);
      assert.match(res.body.error, /ditangguhkan/i);
      assert.equal(res.body.reason, 'Pelanggaran ketentuan layanan: deteksi aktivitas mencurigakan');
    });

    it('ADM-06: Token JWT aktif dari akun yang ditangguhkan harus ditolak oleh authenticate middleware (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${suspendedToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error, /ditangguhkan/i);
    });

    it('ADM-07: Akun aktif yang ditangguhkan saat sesi berjalan harus langsung ditolak pada request berikutnya (403 Forbidden)', async () => {
      // 1. Create an active user
      const victimFixture = await createTestUser({
        name: 'Victim User',
        email: `victim-t2-${Date.now()}${TEST_EMAIL_DOMAIN}`,
        password: 'VictimPassword2026!',
        role: 'AUDIO_ENGINEER',
        status: 'ACTIVE'
      });
      const victimToken = jwt.sign(
        { userId: victimFixture.user.id, role: victimFixture.user.role, authTime: Date.now() },
        process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
        { expiresIn: '7d' }
      );

      // Verify active user can access /api/v1/auth/me
      const activeRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${victimToken}`);
      assert.equal(activeRes.status, 200);

      // 2. Simulate admin suspending this user in database
      await prisma.user.update({
        where: { id: victimFixture.user.id },
        data: {
          status: 'SUSPENDED',
          statusReason: 'Penangguhan akun oleh admin secara real-time'
        }
      });

      // 3. Next request with the same token must be rejected immediately
      const blockedRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${victimToken}`);

      assert.equal(blockedRes.status, 403);
      assert.match(blockedRes.body.error, /ditangguhkan/i);

      // 4. Login attempt should also be rejected
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: victimFixture.user.email,
          password: 'VictimPassword2026!'
        });

      assert.equal(loginRes.status, 403);
      assert.equal(loginRes.body.reason, 'Penangguhan akun oleh admin secara real-time');
    });

    it('ADM-08: Akun ACTIVE dapat login dan mengakses endpoint terotentikasi secara normal', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: engineerFixture.user.email,
          password: 'EngineerPassword2026!'
        });

      assert.equal(res.status, 200);
      assert.ok(res.body.token);

      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${res.body.token}`);

      assert.equal(meRes.status, 200);
      assert.equal(meRes.body.user.email, engineerFixture.user.email);
    });
  });

  describe('3. Admin User Directory & Search API (Task 3)', () => {
    let johnMayerUser;
    let bobMayerUser;
    let detailUser;
    const extraUsers = [];

    before(async () => {
      // 1. Search targets: one active engineer, one suspended engineer matching "mayer"
      johnMayerUser = await createTestUser({
        name: 'John Mayer',
        email: `john.mayer.${Date.now()}${TEST_EMAIL_DOMAIN}`,
        role: 'AUDIO_ENGINEER',
        status: 'ACTIVE',
        balance: 14
      });

      bobMayerUser = await createTestUser({
        name: 'Robert Mayer',
        email: `bob.mayer.${Date.now()}${TEST_EMAIL_DOMAIN}`,
        role: 'AUDIO_ENGINEER',
        status: 'SUSPENDED',
        statusReason: 'Chargeback violation pending review',
        balance: 0
      });

      // 2. Extra users to guarantee multi-page pagination (10 users)
      for (let i = 1; i <= 10; i++) {
        const u = await createTestUser({
          name: `Catalog Engineer ${i}`,
          email: `catalog-eng-${i}-${Date.now()}-${Math.floor(Math.random() * 1000)}${TEST_EMAIL_DOMAIN}`,
          role: 'AUDIO_ENGINEER',
          status: 'ACTIVE',
          balance: i
        });
        extraUsers.push(u);
      }

      // 3. User fixture for detail inspection with wallet, transactions, and session history
      detailUser = await createTestUser({
        name: 'Detailed Engineer Target',
        email: `detail-target-${Date.now()}${TEST_EMAIL_DOMAIN}`,
        role: 'AUDIO_ENGINEER',
        status: 'ACTIVE',
        balance: 25
      });

      // Add 2 token transactions (one TOPUP, one DEDUCTION)
      await prisma.tokenTransaction.createMany({
        data: [
          {
            userId: detailUser.user.id,
            walletId: detailUser.wallet.id,
            amount: 20,
            type: 'TOPUP',
            description: 'Midtrans Paket Pro',
            referenceId: 'INV-TEST-101',
            createdAt: new Date(Date.now() - 3600000)
          },
          {
            userId: detailUser.user.id,
            walletId: detailUser.wallet.id,
            amount: -2,
            type: 'DEDUCTION',
            description: 'Biaya perbaikan sesi audio',
            referenceId: 'SES-TEST-001',
            createdAt: new Date(Date.now() - 1800000)
          }
        ]
      });

      // Add sessions: 2 READY, 1 REPAIRED, 1 FAILED, 1 CREATED (total 5: 3 successful, 1 failed)
      await prisma.session.createMany({
        data: [
          {
            userId: detailUser.user.id,
            title: 'Drum Stems Track 1',
            status: 'READY'
          },
          {
            userId: detailUser.user.id,
            title: 'Guitar Multi Track 2',
            status: 'REPAIRED'
          },
          {
            userId: detailUser.user.id,
            title: 'Vocal Track 3 (Corrupt)',
            status: 'FAILED'
          },
          {
            userId: detailUser.user.id,
            title: 'Synth Track 4 (Draft)',
            status: 'CREATED'
          },
          {
            userId: detailUser.user.id,
            title: 'Live Mix Track 5',
            status: 'READY'
          }
        ]
      });
    });

    it('ADM-DIR-01: Pagination query params (page=1&limit=10) return proper page, limit, total, totalPages, and never expose passwordHash', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.pagination, 'Should return pagination metadata');
      assert.equal(res.body.pagination.page, 1);
      assert.equal(res.body.pagination.limit, 10);
      assert.ok(res.body.pagination.total >= 13, `Total users should be >= 13, got ${res.body.pagination.total}`);
      assert.ok(res.body.pagination.totalPages >= 2, `Total pages should be >= 2, got ${res.body.pagination.totalPages}`);
      assert.equal(res.body.users.length, 10, 'Should return exactly 10 users on page 1');

      // Verify passwordHash is never exposed in user list
      for (const u of res.body.users) {
        assert.equal(u.passwordHash, undefined, `User ${u.id} leaked passwordHash!`);
        assert.ok(u.id, 'User must have id');
        assert.ok(u.email, 'User must have email');
        assert.ok(u.role, 'User must have role');
        assert.ok(u.status, 'User must have status');
        assert.ok(u.wallet, 'User must include wallet summary');
        assert.ok(typeof u.wallet.balance === 'number', 'Wallet must have numeric balance');
        assert.ok(u._count, 'User must include session _count');
      }
    });

    it('ADM-DIR-02: Search query q=mayer filters users by matching name or email case-insensitively', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?q=mayer')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.users));
      assert.ok(res.body.users.length >= 2, `Expected at least 2 users matching 'mayer', got ${res.body.users.length}`);

      for (const u of res.body.users) {
        const matchesName = u.name.toLowerCase().includes('mayer');
        const matchesEmail = u.email.toLowerCase().includes('mayer');
        assert.ok(matchesName || matchesEmail, `User ${u.name} (${u.email}) does not match search query 'mayer'`);
        assert.equal(u.passwordHash, undefined);
      }
    });

    it('ADM-DIR-03: Role filter role=ADMIN returns only admins and role=AUDIO_ENGINEER returns only engineers', async () => {
      // 1. Role ADMIN
      const adminRes = await request(app)
        .get('/api/v1/admin/users?role=ADMIN')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(adminRes.status, 200);
      assert.ok(adminRes.body.users.length >= 1);
      for (const u of adminRes.body.users) {
        assert.equal(u.role, 'ADMIN', `Expected role ADMIN, got ${u.role}`);
      }

      // 2. Role AUDIO_ENGINEER
      const engRes = await request(app)
        .get('/api/v1/admin/users?role=AUDIO_ENGINEER')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(engRes.status, 200);
      assert.ok(engRes.body.users.length >= 10);
      for (const u of engRes.body.users) {
        assert.equal(u.role, 'AUDIO_ENGINEER', `Expected role AUDIO_ENGINEER, got ${u.role}`);
      }
    });

    it('ADM-DIR-04: Status filter status=ACTIVE vs status=SUSPENDED', async () => {
      // 1. Status ACTIVE
      const activeRes = await request(app)
        .get('/api/v1/admin/users?status=ACTIVE')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(activeRes.status, 200);
      assert.ok(activeRes.body.users.length >= 10);
      for (const u of activeRes.body.users) {
        assert.equal(u.status, 'ACTIVE', `Expected status ACTIVE, got ${u.status}`);
      }

      // 2. Status SUSPENDED
      const suspendedRes = await request(app)
        .get('/api/v1/admin/users?status=SUSPENDED')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(suspendedRes.status, 200);
      assert.ok(suspendedRes.body.users.length >= 2, 'Expected at least 2 suspended users');
      for (const u of suspendedRes.body.users) {
        assert.equal(u.status, 'SUSPENDED', `Expected status SUSPENDED, got ${u.status}`);
      }
    });

    it('ADM-DIR-05: Global stats strip { totalUsers, activeEngineers, suspendedAccounts } reflects current database counts', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.stats, 'Response must include stats object');
      assert.equal(typeof res.body.stats.totalUsers, 'number');
      assert.equal(typeof res.body.stats.activeEngineers, 'number');
      assert.equal(typeof res.body.stats.suspendedAccounts, 'number');

      assert.ok(res.body.stats.totalUsers >= 13, `Total users should be >= 13, got ${res.body.stats.totalUsers}`);
      assert.ok(res.body.stats.activeEngineers >= 10, `Active engineers should be >= 10, got ${res.body.stats.activeEngineers}`);
      assert.ok(res.body.stats.suspendedAccounts >= 2, `Suspended accounts should be >= 2, got ${res.body.stats.suspendedAccounts}`);
      assert.ok(
        res.body.stats.totalUsers >= res.body.stats.activeEngineers + res.body.stats.suspendedAccounts,
        'totalUsers must be >= activeEngineers + suspendedAccounts'
      );
    });

    it('ADM-DIR-06: Detail endpoint GET /api/v1/admin/users/:id returns user, wallet, transactions (last 20 desc), and sessionStats', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/users/${detailUser.user.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.user, 'Response must include user object');
      const u = res.body.user;

      assert.equal(u.id, detailUser.user.id);
      assert.equal(u.email, detailUser.user.email);
      assert.equal(u.name, 'Detailed Engineer Target');
      assert.equal(u.role, 'AUDIO_ENGINEER');
      assert.equal(u.status, 'ACTIVE');
      assert.equal(u.passwordHash, undefined, 'Detail endpoint must never expose passwordHash');

      // Wallet
      assert.ok(u.wallet, 'User detail must include wallet');
      assert.equal(u.wallet.balance, 25);

      // Transactions
      assert.ok(Array.isArray(u.transactions), 'User detail must include transactions array');
      assert.equal(u.transactions.length, 2);
      assert.equal(u.transactions[0].type, 'DEDUCTION', 'First transaction must be most recent (descending)');
      assert.equal(u.transactions[1].type, 'TOPUP');

      // SessionStats: total: 5, successful (READY, REPAIRED): 3, failed (FAILED): 1
      assert.ok(u.sessionStats, 'User detail must include sessionStats');
      assert.equal(u.sessionStats.total, 5);
      assert.equal(u.sessionStats.successful, 3);
      assert.equal(u.sessionStats.failed, 1);
    });

    it('ADM-DIR-07: Detail endpoint with non-existent id returns 404', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 404);
      assert.match(res.body.error, /tidak ditemukan/i);
    });

    it('ADM-DIR-08: Directory and detail endpoints reject unauthenticated (401) and non-admin (403)', async () => {
      // 1. Unauthenticated directory
      const unauthDir = await request(app).get('/api/v1/admin/users');
      assert.equal(unauthDir.status, 401);

      // 2. Engineer accessing directory
      const engDir = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${engineerToken}`);
      assert.equal(engDir.status, 403);

      // 3. Unauthenticated detail
      const unauthDet = await request(app).get(`/api/v1/admin/users/${detailUser.user.id}`);
      assert.equal(unauthDet.status, 401);

      // 4. Engineer accessing detail
      const engDet = await request(app)
        .get(`/api/v1/admin/users/${detailUser.user.id}`)
        .set('Authorization', `Bearer ${engineerToken}`);
      assert.equal(engDet.status, 403);
    });
  });
});
