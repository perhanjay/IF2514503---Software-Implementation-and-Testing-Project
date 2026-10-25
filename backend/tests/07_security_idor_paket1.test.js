import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { createTestUser, cleanupTestData, TEST_EMAIL_DOMAIN } from './helpers/testDb.js';

describe('Paket 1: Keamanan, Akses Kontrol & IDOR Integration Tests', () => {
  let ownerFixture;
  let ownerToken;
  let attackerFixture;
  let attackerToken;
  let guestFixture;
  let guestToken;
  let adminFixture;
  let adminToken;

  let testSession;
  let trackA;
  let trackB;
  let testPair;
  let diagnosticA;
  let testOrder;

  before(async () => {
    await cleanupTestData();

    // 1. Owner User
    ownerFixture = await createTestUser({
      name: 'Owner Engineer',
      email: `owner-${Date.now()}${TEST_EMAIL_DOMAIN}`,
      password: 'Password123!',
      role: 'AUDIO_ENGINEER',
      balance: 10
    });

    ownerToken = jwt.sign(
      { userId: ownerFixture.user.id, role: ownerFixture.user.role },
      process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
      { expiresIn: '7d' }
    );

    // 2. Attacker User (Unauthorized second user)
    attackerFixture = await createTestUser({
      name: 'Attacker Engineer',
      email: `attacker-${Date.now()}${TEST_EMAIL_DOMAIN}`,
      password: 'Password123!',
      role: 'AUDIO_ENGINEER',
      balance: 5
    });

    attackerToken = jwt.sign(
      { userId: attackerFixture.user.id, role: attackerFixture.user.role },
      process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
      { expiresIn: '7d' }
    );

    // 3. Guest User
    guestFixture = await createTestUser({
      name: 'Guest Studio Engineer',
      email: `guest-${Date.now()}${TEST_EMAIL_DOMAIN}`,
      password: 'Password123!',
      role: 'AUDIO_ENGINEER',
      balance: 3
    });

    guestToken = jwt.sign(
      { userId: guestFixture.user.id, role: guestFixture.user.role, isGuest: true },
      process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
      { expiresIn: '7d' }
    );

    // 4. Admin User
    adminFixture = await createTestUser({
      name: 'Admin Engineer',
      email: `admin-${Date.now()}${TEST_EMAIL_DOMAIN}`,
      password: 'Password123!',
      role: 'ADMIN',
      balance: 100
    });

    adminToken = jwt.sign(
      { userId: adminFixture.user.id, role: adminFixture.user.role },
      process.env.JWT_SECRET || 'super_secret_polaris_jwt_key_2026_ippl',
      { expiresIn: '7d' }
    );

    // 5. Create Test Session owned by Owner
    testSession = await prisma.session.create({
      data: {
        userId: ownerFixture.user.id,
        title: 'Secret Rock Mix Session',
        status: 'READY',
        estimatedTokens: 1,
        sampleRate: 48000,
        bitDepth: 24,
        healthScore: 75.0
      }
    });

    // 6. Create Tracks & Pair
    trackA = await prisma.track.create({
      data: {
        sessionId: testSession.id,
        fileName: '01_Snare_Top.wav',
        originalStorageKey: `sessions/${testSession.id}/raw/01_Snare_Top.wav`,
        instrumentLabel: 'Drums: Snare',
        isStereo: false,
        durationSec: 10.0,
        status: 'ANALYZED'
      }
    });

    trackB = await prisma.track.create({
      data: {
        sessionId: testSession.id,
        fileName: '02_Snare_Bottom.wav',
        originalStorageKey: `sessions/${testSession.id}/raw/02_Snare_Bottom.wav`,
        instrumentLabel: 'Drums: Snare',
        isStereo: false,
        durationSec: 10.0,
        status: 'ANALYZED'
      }
    });

    testPair = await prisma.trackPair.create({
      data: {
        sessionId: testSession.id,
        trackAId: trackA.id,
        trackBId: trackB.id,
        pairType: 'DRUM_TOP_BOTTOM',
        isConfirmed: true
      }
    });

    diagnosticA = await prisma.diagnosticResult.create({
      data: {
        trackId: trackA.id,
        phaseCorrelation: -0.92,
        hasPolarityInvert: true,
        healthStatus: 'Critical'
      }
    });

    // 7. Create Test Order owned by Owner
    testOrder = await prisma.tokenOrder.create({
      data: {
        id: `POLARIS-TEST-IDOR-${Date.now()}`,
        userId: ownerFixture.user.id,
        packageId: 'PKG-10',
        tokenAmount: 10,
        priceIdr: 25000,
        status: 'PENDING'
      }
    });
  });

  after(async () => {
    await cleanupTestData();
  });

  // ============================================================================
  // SECTION 1: IDOR & SESSION OWNERSHIP ACCESS CONTROL
  // ============================================================================
  describe('1. IDOR & Session Ownership Enforcement', () => {
    it('TC-IDOR-01 (Row 153): POST /verify-integrity harus tolak akses bukan pemilik (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/sessions/${testSession.id}/verify-integrity`)
        .set('Authorization', `Bearer ${attackerToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error, /Akses ditolak/i);

      // Pemilik sah harus berhasil (200)
      const ownerRes = await request(app)
        .post(`/api/v1/sessions/${testSession.id}/verify-integrity`)
        .set('Authorization', `Bearer ${ownerToken}`);

      assert.equal(ownerRes.status, 200);
      assert.equal(ownerRes.body.verificationSummary.status, 'PASSED');
    });

    it('TC-IDOR-02 (Row 163): POST /pairs harus tolak pembuatan pasangan bukan pemilik (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/sessions/${testSession.id}/pairs`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({
          trackAId: trackA.id,
          trackBId: trackB.id,
          pairType: 'MIC_PAIR'
        });

      assert.equal(res.status, 403);
      assert.match(res.body.error, /Akses ditolak/i);
    });

    it('TC-IDOR-03 (Row 170): DELETE /pairs/:pairId harus tolak pelepasan pasangan bukan pemilik (403)', async () => {
      const res = await request(app)
        .delete(`/api/v1/sessions/${testSession.id}/pairs/${testPair.id}`)
        .set('Authorization', `Bearer ${attackerToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error, /Akses ditolak/i);

      // Pastikan pasangan tidak terhapus di DB
      const pairInDb = await prisma.trackPair.findUnique({ where: { id: testPair.id } });
      assert.ok(pairInDb);
    });

    it('TC-IDOR-04 (Row 173): POST /finalize-classification harus tolak bukan pemilik (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/sessions/${testSession.id}/finalize-classification`)
        .set('Authorization', `Bearer ${attackerToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error, /Akses ditolak/i);
    });

    it('TC-IDOR-05 (Row 193): POST /classify harus tolak pemicuan klasifikasi bukan pemilik (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/sessions/${testSession.id}/classify`)
        .set('Authorization', `Bearer ${attackerToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error, /Akses ditolak/i);
    });

    it('TC-IDOR-06 (Row 198): POST /pairs/ai harus tolak pemicuan pairing AI bukan pemilik (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/sessions/${testSession.id}/pairs/ai`)
        .set('Authorization', `Bearer ${attackerToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error, /Akses ditolak/i);
    });

    it('TC-IDOR-07 (Row 201): PATCH /tracks/:trackId/label harus tolak pengubahan label bukan pemilik (403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/sessions/${testSession.id}/tracks/${trackA.id}/label`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ label: 'Bass: Synth' });

      assert.equal(res.status, 403);
      assert.match(res.body.error, /Akses ditolak/i);

      // Pemilik sah dapat mengubah label (200)
      const ownerRes = await request(app)
        .patch(`/api/v1/sessions/${testSession.id}/tracks/${trackA.id}/label`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ label: 'Drums: Snare Top' });

      assert.equal(ownerRes.status, 200);
      assert.equal(ownerRes.body.track.instrumentLabel, 'Drums: Snare Top');
    });

    it('TC-IDOR-08 (Row 214): POST /diagnose harus tolak pemicuan diagnostik bukan pemilik (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/sessions/${testSession.id}/diagnose`)
        .set('Authorization', `Bearer ${attackerToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error, /Akses ditolak/i);
    });

    it('TC-IDOR-09 (Row 222): GET /diagnostics harus tolak pembacaan laporan bukan pemilik (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/sessions/${testSession.id}/diagnostics`)
        .set('Authorization', `Bearer ${attackerToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error, /Akses ditolak/i);

      // Pemilik sah dapat mengakses diagnostik (200)
      const ownerRes = await request(app)
        .get(`/api/v1/sessions/${testSession.id}/diagnostics`)
        .set('Authorization', `Bearer ${ownerToken}`);

      assert.equal(ownerRes.status, 200);
      assert.ok(ownerRes.body.session);
    });

    it('TC-IDOR-10: POST /repair-auto harus tolak bukan pemilik dengan HTTP 403 (bukan HTTP 400)', async () => {
      const res = await request(app)
        .post(`/api/v1/sessions/${testSession.id}/repair-auto`)
        .set('Authorization', `Bearer ${attackerToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error, /Akses ditolak/i);
    });

    it('TC-IDOR-11 (Row 243): POST /repair-custom harus tolak bukan pemilik dengan HTTP 403 (bukan HTTP 400)', async () => {
      const res = await request(app)
        .post(`/api/v1/sessions/${testSession.id}/repair-custom`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({
          customSettings: {
            invertPolarity: true,
            filterSubRumble: false
          }
        });

      assert.equal(res.status, 403);
      assert.match(res.body.error, /Akses ditolak/i);
    });

    it('TC-IDOR-12 (Row 96): GET /orders/:id/status harus tolak pengecekan order milik orang lain (403)', async () => {
      // Akses via /api/v1/wallet/orders/:id/status
      const resWallet = await request(app)
        .get(`/api/v1/wallet/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${attackerToken}`);

      assert.equal(resWallet.status, 403);
      assert.match(resWallet.body.error, /Akses ditolak/i);

      // Akses via /api/v1/payments/orders/:id/status
      const resPayment = await request(app)
        .get(`/api/v1/payments/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${attackerToken}`);

      assert.equal(resPayment.status, 403);
      assert.match(resPayment.body.error, /Akses ditolak/i);

      // Pemilik sah dapat melihat status order miliknya (200)
      const resOwner = await request(app)
        .get(`/api/v1/payments/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${ownerToken}`);

      assert.equal(resOwner.status, 200);
      assert.equal(resOwner.body.id, testOrder.id);
    });

    it('TC-IDOR-13: POST /pairs harus menolak jika salah satu trek bukan milik sesi tersebut (400)', async () => {
      // Buat track di sesi lain
      const foreignSession = await prisma.session.create({
        data: {
          userId: ownerFixture.user.id,
          title: 'Another Session',
          status: 'READY'
        }
      });
      const foreignTrack = await prisma.track.create({
        data: {
          sessionId: foreignSession.id,
          fileName: 'foreign_kick.wav',
          originalStorageKey: 'sessions/foreign/kick.wav',
          status: 'ANALYZED'
        }
      });

      const res = await request(app)
        .post(`/api/v1/sessions/${testSession.id}/pairs`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          trackAId: trackA.id,
          trackBId: foreignTrack.id,
          pairType: 'MIC_PAIR'
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /bukan bagian dari sesi/i);
    });

    it('TC-IDOR-14: DELETE /pairs/:pairId harus menolak jika pairId bukan bagian dari session di URL (404)', async () => {
      // Buat session kedua milik owner dengan pair tersendiri
      const otherSession = await prisma.session.create({
        data: {
          userId: ownerFixture.user.id,
          title: 'Owner Session 2',
          status: 'READY'
        }
      });
      const t1 = await prisma.track.create({
        data: { sessionId: otherSession.id, fileName: 't1.wav', originalStorageKey: 'k1', status: 'ANALYZED' }
      });
      const t2 = await prisma.track.create({
        data: { sessionId: otherSession.id, fileName: 't2.wav', originalStorageKey: 'k2', status: 'ANALYZED' }
      });
      const otherPair = await prisma.trackPair.create({
        data: { sessionId: otherSession.id, trackAId: t1.id, trackBId: t2.id, pairType: 'MIC_PAIR' }
      });

      // Coba hapus otherPair lewat testSession.id (mismatch sesi)
      const res = await request(app)
        .delete(`/api/v1/sessions/${testSession.id}/pairs/${otherPair.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      assert.equal(res.status, 404);
      assert.match(res.body.error, /tidak ditemukan pada sesi ini/i);
    });

    it('TC-IDOR-15: PATCH /tracks/:trackId/label harus menolak jika trackId bukan bagian dari session di URL (404)', async () => {
      const otherSession = await prisma.session.create({
        data: {
          userId: ownerFixture.user.id,
          title: 'Owner Session 3',
          status: 'READY'
        }
      });
      const otherTrack = await prisma.track.create({
        data: { sessionId: otherSession.id, fileName: 't3.wav', originalStorageKey: 'k3', status: 'ANALYZED' }
      });

      // Coba ubah label otherTrack lewat testSession.id di URL
      const res = await request(app)
        .patch(`/api/v1/sessions/${testSession.id}/tracks/${otherTrack.id}/label`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ label: 'Guitar: Electric' });

      assert.equal(res.status, 404);
      assert.match(res.body.error, /tidak ditemukan pada sesi ini/i);
    });
  });

  // ============================================================================
  // SECTION 2: VALIDASI SIGNATURE WEBHOOK MIDTRANS (Row 110)
  // ============================================================================
  describe('2. Validasi Signature Webhook Midtrans (Row 110)', () => {
    let webhookOrder;

    before(async () => {
      webhookOrder = await prisma.tokenOrder.create({
        data: {
          id: `POLARIS-WH-TEST-${Date.now()}`,
          userId: ownerFixture.user.id,
          packageId: 'PKG-10',
          tokenAmount: 10,
          priceIdr: 25000,
          status: 'PENDING'
        }
      });
    });

    it('TC-WH-SIG-01: harus tolak webhook jika signature_key tidak valid atau dipalsukan (401/400)', async () => {
      const balanceBefore = (
        await prisma.wallet.findUnique({ where: { userId: ownerFixture.user.id } })
      ).balance;

      const res = await request(app)
        .post('/api/v1/wallet/webhook')
        .send({
          order_id: webhookOrder.id,
          status_code: '200',
          gross_amount: '25000',
          transaction_status: 'settlement',
          signature_key: 'fake_forged_sha512_signature_attack_attempt'
        });

      assert.ok(res.status === 401 || res.status === 400);
      assert.match(res.body.error, /signature/i);

      // Verifikasi token TIDAK dikreditkan
      const balanceAfter = (
        await prisma.wallet.findUnique({ where: { userId: ownerFixture.user.id } })
      ).balance;
      assert.equal(balanceAfter, balanceBefore);

      // Verifikasi order tetap PENDING
      const dbOrder = await prisma.tokenOrder.findUnique({ where: { id: webhookOrder.id } });
      assert.equal(dbOrder.status, 'PENDING');
    });

    it('TC-WH-SIG-02: harus menerima webhook jika signature_key SHA-512 sah dan mengkredit token (200)', async () => {
      const serverKey = process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-DemoPolarisAudioKey123';
      const validSignature = crypto
        .createHash('sha512')
        .update(`${webhookOrder.id}20025000${serverKey}`)
        .digest('hex');

      const balanceBefore = (
        await prisma.wallet.findUnique({ where: { userId: ownerFixture.user.id } })
      ).balance;

      const res = await request(app)
        .post('/api/v1/wallet/webhook')
        .send({
          order_id: webhookOrder.id,
          status_code: '200',
          gross_amount: '25000',
          transaction_status: 'settlement',
          payment_type: 'qris_sandbox',
          signature_key: validSignature
        });

      assert.equal(res.status, 200);
      assert.match(res.body.message, /pembayaran berhasil dikonfirmasi/i);

      // Status order berubah menjadi PAID
      const dbOrder = await prisma.tokenOrder.findUnique({ where: { id: webhookOrder.id } });
      assert.equal(dbOrder.status, 'PAID');

      // Saldo bertambah 10 token
      const balanceAfter = (
        await prisma.wallet.findUnique({ where: { userId: ownerFixture.user.id } })
      ).balance;
      assert.equal(balanceAfter, balanceBefore + 10);
    });
  });

  // ============================================================================
  // SECTION 3: PROTEKSI ENDPOINT TOP-UP LANGSUNG (Row 80)
  // ============================================================================
  describe('3. Proteksi Endpoint Top-up Langsung (Row 80)', () => {
    it('TC-TOPUP-01: harus tolak top-up sembarang oleh pengguna biasa tanpa verifikasi pembayaran (403)', async () => {
      const balanceBefore = (
        await prisma.wallet.findUnique({ where: { userId: attackerFixture.user.id } })
      ).balance;

      // Akses via /api/v1/wallet/top-up
      const resDash = await request(app)
        .post('/api/v1/wallet/top-up')
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ amount: 100 });

      assert.equal(resDash.status, 403);
      assert.match(resDash.body.error, /Akses ditolak/i);

      // Akses via /api/v1/wallet/topup
      const resNoDash = await request(app)
        .post('/api/v1/wallet/topup')
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ amount: 100 });

      assert.equal(resNoDash.status, 403);
      assert.match(resNoDash.body.error, /Akses ditolak/i);

      // Saldo tidak boleh bertambah
      const balanceAfter = (
        await prisma.wallet.findUnique({ where: { userId: attackerFixture.user.id } })
      ).balance;
      assert.equal(balanceAfter, balanceBefore);
    });

    it('TC-TOPUP-02: harus tetap menolak input token non-positif dengan HTTP 400', async () => {
      const res = await request(app)
        .post('/api/v1/wallet/top-up')
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ amount: 0 });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /jumlah token tidak valid/i);
    });

    it('TC-TOPUP-03: administrator internal dapat melakukan penyesuaian kuota token (200)', async () => {
      const res = await request(app)
        .post('/api/v1/wallet/top-up')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 20 });

      assert.equal(res.status, 200);
      assert.match(res.body.message, /berhasil ditambahkan/i);
    });
  });

  // ============================================================================
  // SECTION 4: PROTEKSI KLAIM HARIAN UNTUK PENGGUNA GUEST (Row 78)
  // ============================================================================
  describe('4. Proteksi Klaim Harian untuk Pengguna Tamu (Row 78)', () => {
    it('TC-GUEST-01: harus menolak klaim harian untuk akun tamu dengan HTTP 403', async () => {
      const res = await request(app)
        .post('/api/v1/wallet/claim-daily')
        .set('Authorization', `Bearer ${guestToken}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.error, 'Akun tamu tidak dapat mengklaim jatah token harian');
    });

    it('TC-GUEST-02: pengguna terdaftar permanen dapat mengklaim jatah harian (200)', async () => {
      const res = await request(app)
        .post('/api/v1/wallet/claim-daily')
        .set('Authorization', `Bearer ${ownerToken}`);

      assert.equal(res.status, 200);
      assert.match(res.body.message, /2 token gratis harian/i);
    });
  });
});
