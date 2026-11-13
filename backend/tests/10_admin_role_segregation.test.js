import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/server.js';
import prisma from '../src/config/prisma.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl';

describe('Admin Role Segregation & Read-Only Session Inspection', () => {
  let adminToken, engineerToken, engineerUser, engineerSession;

  before(async () => {
    // 1. Get or create admin
    let admin = await prisma.user.findUnique({ where: { email: 'admin@polaris.audio' } });
    if (!admin) {
      admin = await prisma.user.create({
        data: { name: 'System Admin', email: 'admin@polaris.audio', passwordHash: 'hash', role: 'ADMIN', status: 'ACTIVE' }
      });
    }
    // Ensure admin wallet balance is strictly 0 under zero-token policy
    await prisma.wallet.upsert({
      where: { userId: admin.id },
      update: { balance: 0 },
      create: { userId: admin.id, balance: 0 }
    });
    adminToken = jwt.sign(
      { userId: admin.id, id: admin.id, email: admin.email, role: 'ADMIN' },
      JWT_SECRET
    );

    // 2. Create engineer user
    engineerUser = await prisma.user.upsert({
      where: { email: 'test_seg_engineer@polaris.audio' },
      update: {},
      create: { name: 'Test Engineer', email: 'test_seg_engineer@polaris.audio', passwordHash: 'hash', role: 'AUDIO_ENGINEER', status: 'ACTIVE' }
    });
    engineerToken = jwt.sign(
      { userId: engineerUser.id, id: engineerUser.id, email: engineerUser.email, role: 'AUDIO_ENGINEER' },
      JWT_SECRET
    );

    // 3. Create test session for engineer with diagnostic data
    engineerSession = await prisma.session.create({
      data: {
        userId: engineerUser.id,
        title: 'Session For Support Inspection',
        status: 'READY',
        healthScore: 88,
        tracks: {
          create: [
            {
              fileName: 'Kick.wav',
              durationSec: 120.0,
              originalStorageKey: 'mock/kick.wav',
              diagnosticResult: {
                create: {
                  truePeakDbfs: -1.2,
                  crestFactor: 12.8,
                  healthStatus: 'Clean',
                  recommendations: ['Tingkat puncak optimal.']
                }
              }
            }
          ]
        }
      }
    });
  });

  test('ADM-SEG-01: Admin must be rejected with 403 Forbidden on session creation (/upload-init)', async () => {
    const res = await request(app)
      .post('/api/v1/sessions/upload-init')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Admin Session Attempt', fileCount: 2 });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /Akun Administrator tidak diizinkan/);
  });

  test('ADM-SEG-02: Admin must be rejected with 403 Forbidden on audio diagnostics (/diagnose)', async () => {
    const res = await request(app)
      .post(`/api/v1/sessions/${engineerSession.id}/diagnose`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 403);
    assert.match(res.body.error, /Akun Administrator tidak diizinkan/);
  });

  test('ADM-SEG-03: Admin must be rejected with 403 Forbidden on audio repair (/repair-auto)', async () => {
    const res = await request(app)
      .post(`/api/v1/sessions/${engineerSession.id}/repair-auto`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 403);
    assert.match(res.body.error, /Akun Administrator tidak diizinkan/);
  });

  test('ADM-SEG-04: Admin must be rejected with 403 Forbidden on session deletion (DELETE /:id)', async () => {
    const res = await request(app)
      .delete(`/api/v1/sessions/${engineerSession.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 403);
  });

  test('ADM-SEG-05: Admin can inspect an engineer session in read-only mode (GET /:id) (200 OK)', async () => {
    const res = await request(app)
      .get(`/api/v1/sessions/${engineerSession.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.id, engineerSession.id);
    assert.equal(res.body.title, 'Session For Support Inspection');
  });

  test('ADM-SEG-06: Non-admin engineer receives 404 when accessing another engineer session', async () => {
    const anotherEngineer = await prisma.user.upsert({
      where: { email: 'another_eng@polaris.audio' },
      update: {},
      create: { name: 'Another Eng', email: 'another_eng@polaris.audio', passwordHash: 'hash', role: 'AUDIO_ENGINEER', status: 'ACTIVE' }
    });
    const anotherToken = jwt.sign(
      { userId: anotherEngineer.id, id: anotherEngineer.id, email: anotherEngineer.email, role: 'AUDIO_ENGINEER' },
      JWT_SECRET
    );

    const res = await request(app)
      .get(`/api/v1/sessions/${engineerSession.id}`)
      .set('Authorization', `Bearer ${anotherToken}`);
    assert.equal(res.status, 404);
  });

  test('ADM-SEG-07: Admin can inspect an engineer session diagnostics (GET /:id/diagnostics) (200 OK)', async () => {
    const res = await request(app)
      .get(`/api/v1/sessions/${engineerSession.id}/diagnostics`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.session.id, engineerSession.id);
    assert.equal(res.body.healthScore, 88);
    assert.ok(Array.isArray(res.body.tracks));
  });

  test('ADM-SEG-08: Admin can inspect and download an engineer session PDF report (GET /:id/report) (200 OK)', async () => {
    const res = await request(app)
      .get(`/api/v1/sessions/${engineerSession.id}/report`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /application\/pdf/i);
    assert.ok(res.body);
  });

  test('ADM-SEG-09: Admin must be rejected with 403 Forbidden on daily token claim (/wallet/claim-daily)', async () => {
    const res = await request(app)
      .post('/api/v1/wallet/claim-daily')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 403);
  });

  test('ADM-SEG-10: Admin must be rejected with 403 Forbidden on checkout (/payments/checkout)', async () => {
    const res = await request(app)
      .post('/api/v1/payments/checkout')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ packageId: 'STUDIO_PRO' });
    assert.equal(res.status, 403);
  });

  test('ADM-SEG-11: Admin cannot promote or demote any account under single-admin policy (400 Bad Request)', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${engineerUser.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'ADMIN' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /kebijakan akun admin tunggal/);
  });

  test('ADM-SEG-12: Legacy internal top-up (/wallet/top-up) returns 403 Forbidden for admin', async () => {
    const res = await request(app)
      .post('/api/v1/wallet/top-up')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 10 });
    assert.equal(res.status, 403);
  });
});
