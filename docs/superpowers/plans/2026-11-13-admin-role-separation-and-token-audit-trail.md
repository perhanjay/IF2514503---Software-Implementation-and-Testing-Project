# Admin Role Segregation & Global Token Audit Trail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish strict architectural segregation between administrator accounts and studio audio engineering (admins hold 0 tokens, cannot run or mutate audio sessions, but have read-only session inspection for support) and deliver a dedicated Global Token Audit Trail view (`/admin/transactions`) with real-time platform circulation metrics.

**Architecture:** A dedicated Express middleware (`requireAudioEngineer`) guards all session mutation routes, checkout, and token claims against `ADMIN` accounts, while `SessionService` permits `ADMIN` accounts read-only access for support inspection. A new REST endpoint `GET /api/v1/admin/transactions` aggregates macro token circulation statistics and serves paginated ledger records. On the frontend, `AppNavbar.vue` and Vue Router guards dynamically isolate the administrative portal from consumer studio views, powering `AdminTransactionsView.vue` with an embedded `UserSupportDrawer` bridge conforming to the 0px tactile editorial design system (`DESIGN.md`).

**Tech Stack:** Node.js (v20+ ES Modules), Express 4.21, Prisma ORM 6.4 (PostgreSQL), Vue 3.5 (Composition API `<script setup>`), Vite 8.3, Pinia 4.0, Tailwind CSS v4, Lucide Icons.

**Spec:** `docs/superpowers/specs/2026-11-13-admin-role-separation-and-token-audit-trail-design.md`

## Global Constraints

- **Design System (`DESIGN.md` & `AGENTS.md`):**
  - Strict `0px border-radius` (`rounded-none`) across all cards, containers, dialogs, form inputs, tables, and buttons (`.btn-ink-stamp`, `.btn-bone-secondary`). Only status capsule badges use `rounded-full` (`9999px`).
  - Palette: `#FFFFFF` Paper White canvas, `#F1F0EB` Bone surface, `#C1C0BC` Stone hairline border, `#000000` Ink Black contrast & CTAs, with deliberate `#FF82C2` (Hot Pink) and `#20AFFF` (Signal Blue) accents.
  - Typography: `Plus Jakarta Sans` for interface display & body; `JetBrains Mono` strictly reserved for audio telemetry, timestamps, and token numbers.
  - Zero AI-slop: No decorative Unicode emojis in buttons or labels, no floating gradient orbs, no perpetual pulsing dots on idle components, and no internal `UC-[NUMBER]` codes in user-facing text.
- **Architecture & API:**
  - ES Modules exclusively (`"type": "module"`).
  - Thin controllers; database transactions and business logic encapsulated in `services/`.
  - Maintain 100% pass status across backend integration tests (`npm test`) and python worker tests (`pytest`).

## Review Focus

1. **Attempted Admin Session Enqueueing:** `POST /api/v1/sessions/:id/classify` or `/diagnose` called by an `ADMIN` must return HTTP 403 Forbidden with `{ error: "Akses ditolak: Akun Administrator tidak diizinkan membuat, mengubah, atau memproses sesi audio." }`, preventing any worker queue contamination.
2. **Support Inspection Cross-User Session Access:** `GET /api/v1/sessions/:id` called by an `ADMIN` on a session belonging to another engineer must return HTTP 200 OK with session and track metadata, whereas a non-admin non-owner receives HTTP 404.
3. **Admin Self-Topup and Daily Claim Lockout:** `POST /api/v1/wallet/top-up` and `POST /api/v1/wallet/claim-daily` called by an `ADMIN` must return HTTP 403 Forbidden.
4. **Single Admin Role Protection:** `PATCH /api/v1/admin/users/:id/role` must reject all role modification attempts with HTTP 400 Bad Request `{ error: "Sistem beroperasi dengan kebijakan akun admin tunggal. Perubahan peran tidak diizinkan." }`.
5. **Zero Macro Metric Null Safety:** `GET /api/v1/admin/transactions` macro metrics (`totalInCirculation`, `totalPurchased`, `totalBurned`, `totalGrants`) must return `0` instead of `null` when a fresh database has no transactions of a specific type.

---

### Task 1: Backend Role Segregation Middleware & Session Mutation Lockout

**Files:**
- Modify: `backend/src/middlewares/auth.js:50-80`
- Modify: `backend/src/routes/sessionRoutes.js:1-75`
- Modify: `backend/src/services/sessionService.js:200-240, 715-745, 1310-1335`
- Create: `backend/tests/10_admin_role_segregation.test.js`

**Interfaces:**
- Produces: `requireAudioEngineer(req, res, next)` middleware in `backend/src/middlewares/auth.js`.
- Modifies: `SessionService.getSessionDetails(sessionId, userId, isAdmin = false)`, `SessionService.getDiagnostics(sessionId, userId, isAdmin = false)`, `SessionService.downloadReport(sessionId, userId, isAdmin = false)`.

- [ ] **Step 1: Write the failing integration tests for session role restrictions**

Create `backend/tests/10_admin_role_segregation.test.js`:
```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test backend/tests/10_admin_role_segregation.test.js`
Expected: FAIL with `400` or `200` instead of `403` for admin session mutation.

- [ ] **Step 3: Implement `requireAudioEngineer` and Read-Only Support Inspection**

1. In `backend/src/middlewares/auth.js`, export `requireAudioEngineer`:
```javascript
export const requireAudioEngineer = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    return res.status(403).json({
      error: 'Akses ditolak: Akun Administrator tidak diizinkan membuat, mengubah, atau memproses sesi audio.'
    });
  }
  next();
};
```
2. In `backend/src/routes/sessionRoutes.js`, import `requireAudioEngineer` and apply it to:
   - `router.patch('/:id/title', requireAudioEngineer, SessionController.updateTitle);`
   - `router.delete('/:id', requireAudioEngineer, SessionController.deleteSession);`
   - `router.post('/upload-init', requireAudioEngineer, SessionController.initUpload);`
   - `router.post('/upload-direct', requireAudioEngineer, uploadFilesMiddleware, SessionController.uploadDirect);`
   - `router.post('/:id/verify-integrity', requireAudioEngineer, SessionController.verifySession);`
   - `router.post('/:id/classify', requireAudioEngineer, SessionController.classifySession);`
   - `router.post('/:id/pairs/ai', requireAudioEngineer, SessionController.classifySession);`
   - `router.patch('/:id/tracks/:trackId/label', requireAudioEngineer, SessionController.updateTrackLabel);`
   - `router.post('/:id/pairs', requireAudioEngineer, SessionController.createPair);`
   - `router.delete('/:id/pairs/:pairId', requireAudioEngineer, SessionController.deletePair);`
   - `router.post('/:id/finalize-classification', requireAudioEngineer, SessionController.finalizeClassification);`
   - `router.post('/:id/diagnose', requireAudioEngineer, SessionController.diagnoseSession);`
   - `router.post('/:id/repair-auto', requireAudioEngineer, SessionController.repairAuto);`
   - `router.post('/:id/repair-custom', requireAudioEngineer, SessionController.repairCustom);`
3. In `backend/src/services/sessionService.js`:
   - In `getSessionDetails(sessionId, userId, isAdmin = false)`:
     Change where query: `where: isAdmin ? { id: sessionId } : { id: sessionId, userId }`.
   - In `getDiagnostics(sessionId, userId, isAdmin = false)`:
     Change where query: `where: isAdmin ? { id: sessionId } : { id: sessionId, userId }`.
   - In `downloadReport(sessionId, userId, isAdmin = false)`:
     Change where query: `where: isAdmin ? { id: sessionId } : { id: sessionId, userId }`.
   - In `backend/src/controllers/sessionController.js`, pass `req.user.role === 'ADMIN'` as `isAdmin` parameter into these 3 service calls.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test backend/tests/10_admin_role_segregation.test.js`
Expected: PASS (6/6 tests passing).

- [ ] **Step 5: Commit**

```bash
git add backend/src/middlewares/auth.js backend/src/routes/sessionRoutes.js backend/src/services/sessionService.js backend/src/controllers/sessionController.js backend/tests/10_admin_role_segregation.test.js
git commit -m "feat(security): enforce requireAudioEngineer and support read-only session inspection for admin"
```

---

### Task 2: Single Admin Policy, Zero-Token Wallet & Checkout Lockout

**Files:**
- Modify: `backend/src/routes/walletRoutes.js:1-40`
- Modify: `backend/src/routes/paymentRoutes.js:1-35`
- Modify: `backend/src/controllers/adminUserController.js:200-260`
- Modify: `backend/src/controllers/walletController.js:1-50`
- Modify: `backend/tests/07_security_idor_paket1.test.js:65-90`
- Modify: `backend/tests/10_admin_role_segregation.test.js`

**Interfaces:**
- Consumes: `requireAudioEngineer` from `backend/src/middlewares/auth.js`.
- Modifies: `AdminUserController.updateRole` to reject role modifications with 400 Bad Request.

- [ ] **Step 1: Write the failing tests for zero-token and single-admin policies**

Append to `backend/tests/10_admin_role_segregation.test.js`:
```javascript
  test('ADM-SEG-07: Admin must be rejected with 403 Forbidden on daily token claim (/wallet/claim-daily)', async () => {
    const res = await request(app)
      .post('/api/v1/wallet/claim-daily')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 403);
  });

  test('ADM-SEG-08: Admin must be rejected with 403 Forbidden on checkout (/payments/checkout)', async () => {
    const res = await request(app)
      .post('/api/v1/payments/checkout')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ packageId: 'STUDIO_PRO' });
    assert.equal(res.status, 403);
  });

  test('ADM-SEG-09: Admin cannot promote or demote any account under single-admin policy (400 Bad Request)', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${engineerUser.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'ADMIN' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /kebijakan akun admin tunggal/);
  });

  test('ADM-SEG-10: Legacy internal top-up (/wallet/top-up) returns 403 Forbidden for admin', async () => {
    const res = await request(app)
      .post('/api/v1/wallet/top-up')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 10 });
    assert.equal(res.status, 403);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test backend/tests/10_admin_role_segregation.test.js`
Expected: FAIL on `ADM-SEG-07`, `ADM-SEG-08`, `ADM-SEG-09`, `ADM-SEG-10`.

- [ ] **Step 3: Implement single admin policy & wallet lockout**

1. In `backend/src/routes/walletRoutes.js`:
   - Apply `requireAudioEngineer` to `POST /claim-daily` and `POST /top-up`.
2. In `backend/src/routes/paymentRoutes.js`:
   - Apply `requireAudioEngineer` to `POST /checkout`.
3. In `backend/src/controllers/adminUserController.js` (`updateRole`):
   ```javascript
   export const updateRole = async (req, res, next) => {
     return res.status(400).json({
       error: 'Sistem beroperasi dengan kebijakan akun admin tunggal. Perubahan peran tidak diizinkan.'
     });
   };
   ```
4. Reset `admin@polaris.audio` wallet balance in database to 0:
   Run a Prisma update script to ensure `wallet.balance = 0` for `admin@polaris.audio`.
5. Update `backend/tests/07_security_idor_paket1.test.js` `TC-TOPUP-03`:
   Change assertion from expecting 200 to expecting 403 Forbidden (`assert.equal(res.status, 403)`), since admins are strictly forbidden from self-topup under the Zero-Token Policy.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test backend/tests/10_admin_role_segregation.test.js`
Run: `node --test backend/tests/07_security_idor_paket1.test.js`
Expected: PASS across all tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/walletRoutes.js backend/src/routes/paymentRoutes.js backend/src/controllers/adminUserController.js backend/tests/07_security_idor_paket1.test.js backend/tests/10_admin_role_segregation.test.js
git commit -m "feat(security): enforce zero-token policy and single-admin restriction"
```

---

### Task 3: Global Token Audit Trail REST API Endpoint & Macro Metrics

**Files:**
- Create: `backend/src/controllers/adminTransactionController.js`
- Create: `backend/src/routes/adminTransactionRoutes.js`
- Modify: `backend/src/server.js:90-110`
- Create: `backend/tests/11_admin_transactions_api.test.js`

**Interfaces:**
- Produces: `GET /api/v1/admin/transactions` with query params `page`, `limit`, `q`, `type`, `startDate`, `endDate`.
- Returns: `{ transactions, pagination: { page, limit, total, totalPages }, metrics: { totalInCirculation, totalPurchased, totalBurned, totalGrants } }`.

- [ ] **Step 1: Write the failing tests for Global Token Audit Trail API**

Create `backend/tests/11_admin_transactions_api.test.js`:
```javascript
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/server.js';
import prisma from '../src/config/prisma.js';
import jwt from 'jsonwebtoken';

describe('Global Token Audit Trail API (GET /api/v1/admin/transactions)', () => {
  let adminToken, engineerToken, engineerUser, txTopup, txDeduction;

  before(async () => {
    let admin = await prisma.user.findUnique({ where: { email: 'admin@polaris.audio' } });
    adminToken = jwt.sign({ id: admin.id, email: admin.email, role: 'ADMIN' }, process.env.JWT_SECRET || 'test-secret');

    engineerUser = await prisma.user.upsert({
      where: { email: 'tx_audit_eng@polaris.audio' },
      update: {},
      create: { name: 'Audit Test Engineer', email: 'tx_audit_eng@polaris.audio', passwordHash: 'hash', role: 'AUDIO_ENGINEER', status: 'ACTIVE' }
    });
    engineerToken = jwt.sign({ id: engineerUser.id, email: engineerUser.email, role: 'AUDIO_ENGINEER' }, process.env.JWT_SECRET || 'test-secret');

    let wallet = await prisma.wallet.upsert({
      where: { userId: engineerUser.id },
      update: { balance: 50 },
      create: { userId: engineerUser.id, balance: 50 }
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test backend/tests/11_admin_transactions_api.test.js`
Expected: FAIL with 404 (route not defined).

- [ ] **Step 3: Implement `AdminTransactionController` and Route**

1. Create `backend/src/controllers/adminTransactionController.js`:
```javascript
import prisma from '../config/prisma.js';

export class AdminTransactionController {
  static async listTransactions(req, res, next) {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const skip = (page - 1) * limit;
      const { q, type, startDate, endDate } = req.query;

      const where = {};

      if (type && ['WELCOME_GRANT', 'TOPUP', 'DEDUCTION', 'REFUND'].includes(type)) {
        where.type = type;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      if (q && q.trim()) {
        const queryTerm = q.trim();
        where.OR = [
          { description: { contains: queryTerm, mode: 'insensitive' } },
          { referenceId: { contains: queryTerm, mode: 'insensitive' } },
          { user: { name: { contains: queryTerm, mode: 'insensitive' } } },
          { user: { email: { contains: queryTerm, mode: 'insensitive' } } }
        ];
      }

      const [transactions, total, circSum, purchaseSum, burnSum, grantSum] = await Promise.all([
        prisma.tokenTransaction.findMany({
          where,
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true, status: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.tokenTransaction.count({ where }),
        // Macro metric 1: Total in circulation (excluding admin accounts)
        prisma.wallet.aggregate({
          where: { user: { role: 'AUDIO_ENGINEER' } },
          _sum: { balance: true }
        }),
        // Macro metric 2: Total purchased (TOPUP)
        prisma.tokenTransaction.aggregate({
          where: { type: 'TOPUP' },
          _sum: { amount: true }
        }),
        // Macro metric 3: Total burned (DEDUCTION)
        prisma.tokenTransaction.aggregate({
          where: { type: 'DEDUCTION' },
          _sum: { amount: true }
        }),
        // Macro metric 4: Total grants (WELCOME_GRANT)
        prisma.tokenTransaction.aggregate({
          where: { type: 'WELCOME_GRANT' },
          _sum: { amount: true }
        })
      ]);

      const totalPages = Math.ceil(total / limit) || 1;

      return res.json({
        transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages
        },
        metrics: {
          totalInCirculation: circSum._sum.balance || 0,
          totalPurchased: purchaseSum._sum.amount || 0,
          totalBurned: Math.abs(burnSum._sum.amount || 0),
          totalGrants: grantSum._sum.amount || 0
        }
      });
    } catch (err) {
      next(err);
    }
  }
}
```
2. Create `backend/src/routes/adminTransactionRoutes.js`:
```javascript
import { Router } from 'express';
import { AdminTransactionController } from '../controllers/adminTransactionController.js';
import { authenticate, requireAdmin } from '../middlewares/auth.js';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', AdminTransactionController.listTransactions);

export default router;
```
3. In `backend/src/server.js`, mount route:
```javascript
import adminTransactionRoutes from './routes/adminTransactionRoutes.js';
// ...
app.use('/api/v1/admin/transactions', adminTransactionRoutes);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test backend/tests/11_admin_transactions_api.test.js`
Expected: PASS (5/5 tests passing).

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/adminTransactionController.js backend/src/routes/adminTransactionRoutes.js backend/src/server.js backend/tests/11_admin_transactions_api.test.js
git commit -m "feat(admin): implement global token audit trail API with macro metrics"
```

---

### Task 4: Frontend AppNavbar & Route Guards for Admin Segregation

**Files:**
- Modify: `frontend/src/router/index.js:10-45`
- Modify: `frontend/src/components/AppNavbar.vue:150-250`
- Modify: `frontend/src/components/admin/UserSupportDrawer.vue:350-450`

**Interfaces:**
- Router: Exposes `/admin/transactions` with `requiresAuth: true, requiresAdmin: true`.
- Navbar: Switches between `ADMIN` sub-nav and `AUDIO_ENGINEER` studio nav.

- [ ] **Step 1: Update router guards and add `/admin/transactions` route**

In `frontend/src/router/index.js`:
1. Register route `/admin/transactions`:
```javascript
  {
    path: '/admin/transactions',
    name: 'AdminTransactions',
    component: () => import('../views/AdminTransactionsView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
```
2. In `router.beforeEach`:
```javascript
  // If user is ADMIN, prevent access to consumer studio workspace and billing
  if (user && user.role === 'ADMIN') {
    if (to.path === '/dashboard' || to.path.startsWith('/dashboard') || to.path === '/billing' || to.path === '/wallet') {
      return next('/admin/users');
    }
  }
```

- [ ] **Step 2: Update AppNavbar.vue for Admin Role Segregation**

In `frontend/src/components/AppNavbar.vue`:
1. In desktop navigation `<nav class="hidden md:flex ...">`:
   - If `authStore.user?.role === 'ADMIN'`:
     Render Admin Tabs:
     - `Admin: Pengguna` (`/admin/users`)
     - `Audit Transaksi` (`/admin/transactions`)
   - Else:
     Render regular consumer links:
     - `Beranda` (`/`)
     - `Studio Workspace` (`/dashboard`)
     - `Dompet & Kuota` (`/billing`)
2. In `<div class="flex items-center gap-3">`:
   - If `authStore.user?.role === 'ADMIN'`:
     Hide the quota pill (`authStore.walletBalance Token`).
     Render an `[ADMIN OPERATOR]` badge:
     ```html
     <div class="hidden sm:flex items-center gap-1.5 bg-[#f1f0eb] border border-[#c1c0bc] px-3 py-1.5 text-xs font-mono font-semibold text-black uppercase tracking-wider">
       <span class="w-2 h-2 rounded-full bg-rose-600 animate-none"></span>
       ADMIN OPERATOR
     </div>
     ```
3. Update mobile hamburger navigation drawer to match the same conditional links.

- [ ] **Step 3: Remove Role Promotion UI from `UserSupportDrawer.vue`**

In `frontend/src/components/admin/UserSupportDrawer.vue`:
- Remove or hide the "Ubah Peran (Role)" button and selection dropdown since the platform operates under a single admin policy and role change is now rejected.

- [ ] **Step 4: Verify frontend build compiles cleanly**

Run: `npm --prefix frontend run build`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/router/index.js frontend/src/components/AppNavbar.vue frontend/src/components/admin/UserSupportDrawer.vue
git commit -m "feat(ui): isolate admin navigation and enforce router guards"
```

---

### Task 5: Frontend Admin Token Audit Trail View (`AdminTransactionsView.vue`)

**Files:**
- Create: `frontend/src/views/AdminTransactionsView.vue`

**Interfaces:**
- Consumes: `GET /api/v1/admin/transactions`
- Renders: `<UserSupportDrawer>` when a user row or "Detail" button is clicked.

- [ ] **Step 1: Create `AdminTransactionsView.vue` with 0px Editorial Tactile Direction**

Create `frontend/src/views/AdminTransactionsView.vue`:
- **Canvas:** Paper White `#FFFFFF` (`bg-white text-black min-h-screen`).
- **Header:**
  - Page title `Audit Transaksi Token` (`font-bold font-editorial text-2xl`).
  - Sub-navigation tabs:
    - `Pengguna` (link to `/admin/users`, text-muted hover:text-black).
    - `Audit Transaksi` (active tab with `border-b-2 border-black font-semibold`).
- **Top Macro Metrics Ribbon (Grid of 4):**
  - *Total Beredar* (`metrics.totalInCirculation Token` in `JetBrains Mono`).
  - *Total Pembelian (Top-Up)* (`metrics.totalPurchased Token`).
  - *Total Konsumsi DSP* (`metrics.totalBurned Token`).
  - *Total Hibah Gratis* (`metrics.totalGrants Token`).
  - Styled with Bone background `#F1F0EB`, Stone hairline border `#C1C0BC`, strict `rounded-none`.
- **Search & Filter Controls:**
  - Search input with debounced `fetchTransactions()` on `input`.
  - Type filter buttons: `Semua`, `TOPUP`, `DEDUCTION`, `WELCOME_GRANT`, `REFUND` using `.btn-bone-secondary` and active black stamp styling.
- **Transactions Table:**
  - Strict 0px table with Stone borders (`border border-[#c1c0bc]`).
  - Header: `WAKTU`, `PENGGUNA`, `TIPE`, `JUMLAH`, `KETERANGAN`, `REFERENSI`, `AKSI`.
  - Amount styled with `JetBrains Mono font-bold` (green `+` for credits, red `-` for debits).
  - Type badge: `badge-pill-stamp` (`rounded-full`).
  - Clicking user or "Detail" opens the slide-in `<UserSupportDrawer>`.
- **Pagination Strip:**
  - `Sebelumnya`, `Halaman X dari Y`, `Berikutnya`.

- [ ] **Step 2: Verify frontend build compiles cleanly**

Run: `npm --prefix frontend run build`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/views/AdminTransactionsView.vue
git commit -m "feat(ui): implement AdminTransactionsView with macro circulation metrics and support bridge"
```

---

### Task 6: Full System Integration, Quality Gate & Verification

**Files:**
- Modify: `backend/prisma/seed.js` (ensure admin wallet balance = 0)
- Verify: Full test suites in backend and worker

- [ ] **Step 1: Update database seed for zero admin balance**

In `backend/prisma/seed.js`:
Ensure `admin@polaris.audio` wallet is created with `balance: 0`.

- [ ] **Step 2: Run full backend automated integration tests**

Run: `npm --prefix backend test`
Expected: PASS across all 185+ tests with 0 failures.

- [ ] **Step 3: Run full worker pytest suite**

Run: `cd worker && PYTHONPATH=. pytest tests/`
Expected: PASS (51 passed).

- [ ] **Step 4: Verify production build of frontend**

Run: `npm --prefix frontend run build`
Expected: PASS with 0 errors.

- [ ] **Step 5: Verify live API endpoint with curl**

Execute live test:
```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"admin@polaris.audio","password":"Admin123!"}' | jq -r '.token')
curl -s -X GET http://localhost:5000/api/v1/admin/transactions -H "Authorization: Bearer $TOKEN" | jq '.metrics'
```
Expected: HTTP 200 with JSON metrics `{ totalInCirculation, totalPurchased, totalBurned, totalGrants }`.

- [ ] **Step 6: Commit all remaining quality-gate updates**

```bash
git add backend/prisma/seed.js
git commit -m "chore(release): complete admin role segregation and global token audit trail"
```
