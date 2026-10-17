import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { createTestUser, cleanupTestData, TEST_EMAIL_DOMAIN } from './helpers/testDb.js';

describe('Phase T1: Auth, User Security & Guest Session (UC-01, UC-02, UC-04, UC-05)', () => {
  let baselineFixture;

  before(async () => {
    await cleanupTestData();
    // Hermetic baseline fixture for testing existing-account negative cases (wrong password, duplicates)
    baselineFixture = await createTestUser({
      name: 'Baseline Security User',
      email: `baseline-auth-${Date.now()}${TEST_EMAIL_DOMAIN}`,
      password: 'SecurePassword2026!'
    });
  });

  after(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  // ==========================================
  // SECTION 1: NEGATIVE & VALIDATION TESTS FIRST
  // ==========================================
  describe('1. Negative & Validation Tests (Happy Path Last Principle)', () => {
    it('NV-01: harus menolak registrasi dengan body kosong (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({});

      assert.equal(res.status, 400);
      assert.match(res.body.error, /wajib diisi/i);
    });

    it('NV-02: harus menolak registrasi jika kolom email tidak disertakan (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Anonymous User',
          password: 'ValidPassword123'
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /wajib diisi/i);
    });

    it('NV-03: harus menolak registrasi kata sandi pendek < 8 karakter (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Short Password Tester',
          email: `shortpass-${Date.now()}${TEST_EMAIL_DOMAIN}`,
          password: 'Pass1'
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /minimal 8 karakter/i);
    });

    it('NV-04: harus menolak registrasi kata sandi tanpa kombinasi angka (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Alpha Only Tester',
          email: `alphaonly-${Date.now()}${TEST_EMAIL_DOMAIN}`,
          password: 'OnlyLettersPassword'
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /kombinasi huruf serta angka/i);
    });

    it('NV-05: harus menolak login dengan email yang tidak terdaftar (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: `nonexistent-${Date.now()}@polaris-test.local`,
          password: 'AnyPassword123'
        });

      assert.equal(res.status, 401);
      assert.match(res.body.error, /tidak valid/i);
    });

    it('NV-06: harus menolak login dengan kata sandi yang salah pada akun terdaftar (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: baselineFixture.user.email,
          password: 'WrongPasswordMismatch999!'
        });

      assert.equal(res.status, 401);
      assert.match(res.body.error, /tidak valid/i);
    });

    it('NV-07: harus menolak akses rute terproteksi (/api/v1/auth/me) tanpa header Authorization (401)', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      assert.equal(res.status, 401);
      assert.match(res.body.error, /token tidak disertakan/i);
    });

    it('NV-08: harus menolak akses dengan token JWT bertanda-tangan palsu/tampered (401)', async () => {
      const tamperedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmYWtlLWlkIn0.invalid_signature_here';

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      assert.equal(res.status, 401);
      assert.match(res.body.error, /token tidak valid/i);
    });
  });

  // ==========================================
  // SECTION 2: EDGE & SECURITY BOUNDARY CASES
  // ==========================================
  describe('2. Edge & Security Boundary Cases', () => {
    it('ED-01: harus menolak registrasi duplikat dengan email yang sudah ada (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Duplicate Register Attempt',
          email: baselineFixture.user.email,
          password: 'AnotherValidPass123'
        });

      assert.equal(res.status, 409);
      assert.match(res.body.error, /sudah terdaftar/i);
    });

    it('ED-02: harus menolak perubahan nama profil dengan string kosong atau spasi saja (400)', async () => {
      // Login fixture first to obtain valid token
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: baselineFixture.user.email,
          password: baselineFixture.rawPassword
        });

      const token = loginRes.body.token;

      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '    ' });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /nama lengkap wajib diisi/i);
    });

    it('ED-03: harus menerbitkan sesi Tamu instan (Guest Session) dengan jatah saldo demo 3 token', async () => {
      const res = await request(app).post('/api/v1/auth/guest-session');

      assert.equal(res.status, 200);
      assert.ok(res.body.token);
      assert.equal(res.body.user.isGuest, true);
      assert.equal(res.body.user.email, 'guest@polaris.audio');
      assert.equal(res.body.wallet.balance, 3);
    });
  });

  // ==========================================
  // SECTION 3: HAPPY PATH VERIFICATION LAST
  // ==========================================
  describe('3. Happy Path Functional Verification (Last)', () => {
    const validRegistrationData = {
      name: 'Dr. Mix Master',
      email: `valid-engineer-${Date.now()}${TEST_EMAIL_DOMAIN}`,
      password: 'ProAudio2026Master!'
    };

    let registeredJwtToken;

    it('HP-01: harus berhasil meregistrasi pengguna baru, membuat dompet otomatis, dan memberikan 5 token selamat datang', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegistrationData);

      assert.equal(res.status, 201);
      assert.equal(res.body.message, 'Registrasi berhasil');
      assert.ok(res.body.token);
      assert.equal(res.body.user.name, validRegistrationData.name);
      assert.equal(res.body.user.email, validRegistrationData.email);
      assert.equal(res.body.wallet.balance, 5);

      registeredJwtToken = res.body.token;

      // Verifikasi di database: kata sandi tidak boleh tersimpan dalam plain text
      const dbUser = await prisma.user.findUnique({
        where: { email: validRegistrationData.email },
        include: { wallet: true, transactions: true }
      });

      assert.ok(dbUser);
      assert.notEqual(dbUser.passwordHash, validRegistrationData.password);
      assert.ok(dbUser.passwordHash.startsWith('$2')); // bcrypt prefix
      assert.equal(dbUser.wallet.balance, 5);
      assert.equal(dbUser.transactions.length, 1);
      assert.equal(dbUser.transactions[0].type, 'WELCOME_GRANT');
      assert.equal(dbUser.transactions[0].amount, 5);
    });

    it('HP-02: harus berhasil login dengan kredensial yang sah dan mengembalikan JWT token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: validRegistrationData.email,
          password: validRegistrationData.password
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.message, 'Login berhasil');
      assert.ok(res.body.token);
      assert.equal(res.body.user.email, validRegistrationData.email);
      assert.equal(res.body.wallet.balance, 5);
    });

    it('HP-03: harus dapat mengakses profil pengguna terotentikasi (/api/v1/auth/me) menggunakan JWT token sah', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${registeredJwtToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.user.email, validRegistrationData.email);
      assert.equal(res.body.user.name, validRegistrationData.name);
      assert.equal(res.body.wallet.balance, 5);
    });

    it('HP-04: harus berhasil memperbarui nama profil pengguna terotentikasi (UC-04)', async () => {
      const updatedName = 'Chief Engineer Polaris';

      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${registeredJwtToken}`)
        .send({ name: updatedName });

      assert.equal(res.status, 200);
      assert.equal(res.body.message, 'Profil berhasil diperbarui');
      assert.equal(res.body.user.name, updatedName);

      // Verifikasi di basis data
      const dbCheck = await prisma.user.findUnique({
        where: { email: validRegistrationData.email }
      });
      assert.equal(dbCheck.name, updatedName);
    });
  });
});
