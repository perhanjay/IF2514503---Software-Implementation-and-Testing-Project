import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/server.js';
import prisma from '../src/config/prisma.js';
import jwt from 'jsonwebtoken';

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
    adminToken = jwt.sign({ id: admin.id, email: admin.email, role: 'ADMIN' }, process.env.JWT_SECRET || 'test-secret');

    // 2. Create engineer user
    engineerUser = await prisma.user.upsert({
      where: { email: 'test_seg_engineer@polaris.audio' },
      update: {},
      create: { name: 'Test Engineer', email: 'test_seg_engineer@polaris.audio', passwordHash: 'hash', role: 'AUDIO_ENGINEER', status: 'ACTIVE' }
    });
    engineerToken = jwt.sign({ id: engineerUser.id, email: engineerUser.email, role: 'AUDIO_ENGINEER' }, process.env.JWT_SECRET || 'test-secret');

    // 3. Create test session for engineer
    engineerSession = await prisma.session.create({
      data: {
        userId: engineerUser.id,
        title: 'Session For Support Inspection',
        status: 'READY'
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
    const anotherToken = jwt.sign({ id: anotherEngineer.id, email: anotherEngineer.email, role: 'AUDIO_ENGINEER' }, process.env.JWT_SECRET || 'test-secret');

    const res = await request(app)
      .get(`/api/v1/sessions/${engineerSession.id}`)
      .set('Authorization', `Bearer ${anotherToken}`);
    assert.equal(res.status, 404);
  });
});
