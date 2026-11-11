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
      assert.equal(res.body.ok, true);
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
});
