import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/server.js';
import prisma from '../src/config/prisma.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl';

describe('Global Token Audit Trail API (GET /api/v1/admin/transactions)', () => {
  let adminToken, engineerToken, engineerUser, txTopup, txDeduction;

  before(async () => {
    let admin = await prisma.user.findUnique({ where: { email: 'admin@polaris.audio' } });
    if (!admin) {
      admin = await prisma.user.create({
        data: { name: 'System Admin', email: 'admin@polaris.audio', passwordHash: 'hash', role: 'ADMIN', status: 'ACTIVE' }
      });
    }
    adminToken = jwt.sign({ id: admin.id, email: admin.email, role: 'ADMIN' }, JWT_SECRET);

    engineerUser = await prisma.user.upsert({
      where: { email: 'tx_audit_eng@polaris.audio' },
      update: {},
      create: { name: 'Audit Test Engineer', email: 'tx_audit_eng@polaris.audio', passwordHash: 'hash', role: 'AUDIO_ENGINEER', status: 'ACTIVE' }
    });
    engineerToken = jwt.sign({ id: engineerUser.id, email: engineerUser.email, role: 'AUDIO_ENGINEER' }, JWT_SECRET);

    let wallet = await prisma.wallet.upsert({
      where: { userId: engineerUser.id },
      update: { balance: 50 },
      create: { userId: engineerUser.id, balance: 50 }
    });

    // Clean up test transactions if leftover from previous run
    await prisma.tokenTransaction.deleteMany({
      where: {
        referenceId: { in: ['POLARIS-AUDIT-TEST-001', 'SESSION-AUDIT-001'] }
      }
    });

    // Create sample audit transactions
    txTopup = await prisma.tokenTransaction.create({
      data: {
        userId: engineerUser.id,
        walletId: wallet.id,
        amount: 20,
        type: 'TOPUP',
        description: 'Pembelian Paket Token Studio Midtrans',
        referenceId: 'POLARIS-AUDIT-TEST-001'
      }
    });

    txDeduction = await prisma.tokenTransaction.create({
      data: {
        userId: engineerUser.id,
        walletId: wallet.id,
        amount: -2,
        type: 'DEDUCTION',
        description: 'Perbaikan Audio DSP Sesi (Auto-Fix): Rock Track',
        referenceId: 'SESSION-AUDIT-001'
      }
    });
  });

  after(async () => {
    await prisma.tokenTransaction.deleteMany({
      where: {
        referenceId: { in: ['POLARIS-AUDIT-TEST-001', 'SESSION-AUDIT-001'] }
      }
    });
  });

  test('TX-API-01: Non-admin engineer receives 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/v1/admin/transactions')
      .set('Authorization', `Bearer ${engineerToken}`);
    assert.equal(res.status, 403);
  });

  test('TX-API-02: Unauthenticated request receives 401 Unauthorized', async () => {
    const res = await request(app).get('/api/v1/admin/transactions');
    assert.equal(res.status, 401);
  });

  test('TX-API-03: Admin receives 200 OK with transactions list and macro metrics', async () => {
    const res = await request(app)
      .get('/api/v1/admin/transactions?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.transactions));
    assert.ok(res.body.pagination);
    assert.equal(res.body.pagination.page, 1);
    assert.ok(res.body.metrics);
    assert.equal(typeof res.body.metrics.totalInCirculation, 'number');
    assert.equal(typeof res.body.metrics.totalPurchased, 'number');
    assert.equal(typeof res.body.metrics.totalBurned, 'number');
    assert.equal(typeof res.body.metrics.totalGrants, 'number');
  });

  test('TX-API-04: Filter by type=DEDUCTION returns only deduction transactions', async () => {
    const res = await request(app)
      .get('/api/v1/admin/transactions?type=DEDUCTION')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.transactions.length > 0);
    for (const tx of res.body.transactions) {
      assert.equal(tx.type, 'DEDUCTION');
      assert.ok(tx.amount < 0);
    }
  });

  test('TX-API-05: Search query q filters by referenceId or user email', async () => {
    const res = await request(app)
      .get('/api/v1/admin/transactions?q=POLARIS-AUDIT-TEST-001')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.transactions.length, 1);
    assert.equal(res.body.transactions[0].referenceId, 'POLARIS-AUDIT-TEST-001');
  });

  test('TX-API-06: Date range filtering (startDate and endDate)', async () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    const futureDate = new Date(Date.now() + 3600000).toISOString();
    const res = await request(app)
      .get(`/api/v1/admin/transactions?startDate=${pastDate}&endDate=${futureDate}&q=POLARIS-AUDIT-TEST-001`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.transactions.length, 1);

    // Old date window should return 0 for this test record
    const farPast = new Date(Date.now() - 7200000).toISOString();
    const midPast = new Date(Date.now() - 3600000).toISOString();
    const resEmpty = await request(app)
      .get(`/api/v1/admin/transactions?startDate=${farPast}&endDate=${midPast}&q=POLARIS-AUDIT-TEST-001`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(resEmpty.status, 200);
    assert.equal(resEmpty.body.transactions.length, 0);
  });

  test('TX-API-07: Pagination bounds clamp properly (page <= 0, limit > 100)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/transactions?page=0&limit=999')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.pagination.page, 1);
    assert.equal(res.body.pagination.limit, 100);
  });

  test('TX-API-08: Sensitive user fields like passwordHash are omitted from response', async () => {
    const res = await request(app)
      .get('/api/v1/admin/transactions?limit=5')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.transactions.length > 0);
    for (const tx of res.body.transactions) {
      if (tx.user) {
        assert.equal(tx.user.passwordHash, undefined);
        assert.ok(tx.user.id);
        assert.ok(tx.user.email);
      }
    }
  });

  test('TX-API-09: Filtering by invalid type ignores invalid filter and returns 200', async () => {
    const res = await request(app)
      .get('/api/v1/admin/transactions?type=INVALID_HACK_TYPE')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.transactions));
  });
});
