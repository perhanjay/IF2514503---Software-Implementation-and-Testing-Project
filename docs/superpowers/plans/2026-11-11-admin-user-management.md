# Admin User Management & Support Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a complete Admin User Management and Customer Support dashboard in Polaris Audio, enabling administrators to search users, inspect token ledgers, adjust balances with audit tracking, manage roles, and enforce account suspension with instant session revocation.

**Architecture:** An integrated, role-gated admin module built directly into the Node.js/Express backend and Vue 3 frontend. Backend endpoints at `/api/v1/admin/users` are secured by `[authenticate, requireAdmin]` middlewares, with user status tracking (`ACTIVE`, `SUSPENDED`) in PostgreSQL via Prisma ORM. The Vue 3 UI implements the **"Boutique liner notes on sunlit paper"** editorial standard (0px border-radius, Paper White canvas, Bone surfaces, Stone hairline dividers, Ink Black stamp buttons, and JetBrains Mono tabular readouts).

**Tech Stack:** Node.js (ES Modules), Express.js 4.21, Prisma ORM 6.4, PostgreSQL 17, Vue 3.5 Composition API (`<script setup>`), Vite 8.3, Pinia 4.0, Tailwind CSS v4, Lucide Icons, Node.js Native Test Runner (`node:test`).

**Spec:** [`docs/superpowers/specs/2026-11-11-admin-user-management-design.md`](file:///home/perhanjay/Documents/Koolyeah/Semester%205/IPPL%20%7C%20Implementasi%20Perancangan%20Perangkat%20Lunak/IF2514503%20-%20Software%20Implementation%20and%20Testing%20Project/docs/superpowers/specs/2026-11-11-admin-user-management-design.md)

---

## Global Constraints

- **Language & Modules:** Node.js v20+ with native ES Modules (`import`/`export`), Vue 3 Composition API with `<script setup>`.
- **Database Schema:** All changes to `schema.prisma` must be executed via `npx prisma migrate dev`; direct SQL migrations are prohibited.
- **Design System (`DESIGN.md`):** Strict `0px border-radius` (`rounded-none`) across all cards, panels, inputs, and buttons (`.btn-ink-stamp`, `.btn-bone-secondary`). Only pill status badges use `rounded-full` (`.badge-pill-stamp`, `9999px`).
- **Typography:** `Plus Jakarta Sans` for interface headings (`font-editorial font-bold`) and body text; `JetBrains Mono` (`font-mono-accent`) strictly reserved for numeric telemetry, token amounts, and timestamps.
- **Ledger Integrity:** Direct modification of `Wallet.balance` without an accompanying `TokenTransaction` record is forbidden. Token deductions must never reduce wallet balance below zero.
- **Test Baseline:** Must maintain 100% pass status across existing 68 backend tests and add complete coverage for admin features.

---

## Review Focus

1. **Self-Action Lockout Prevention:** An admin attempting to suspend or demote their own account must be blocked with `400 Bad Request` or `403 Forbidden` (`req.user.id === targetId`).
2. **Instant Token Revocation on Suspension:** Suspending an account must immediately invoke `TokenRevocationService.revokeAllUserTokens(targetId)` so existing active JWTs cannot make further requests.
3. **Suspended Login Block:** A user with `status: 'SUSPENDED'` attempting to log in via `/api/v1/auth/login` must be rejected with `403 Forbidden` and message `"Akun Anda telah ditangguhkan"`.
4. **Debit Insufficient Balance Guard:** Admin token deduction (`type: 'DEDUCTION'`) on a user with insufficient balance must fail with `400 Bad Request` and message `"Saldo token tidak mencukupi untuk pemotongan"` without modifying wallet balance.
5. **Admin Actor Attribution:** Every administrative token adjustment must record `referenceId: 'ADM:' + req.user.id` and require an audit reason with at least 5 characters.

---

## Tasks

### Task 1: Database Schema Migration for User Status & Reason

**Files:**
- Modify: `backend/prisma/schema.prisma:10-20,46-60`
- Migration: `backend/prisma/migrations/YYYYMMDD_add_user_status_and_reason/migration.sql`

**Interfaces:**
- Consumes: Existing Prisma `User` model.
- Produces: `UserStatus` enum (`ACTIVE`, `SUSPENDED`), `User.status`, and `User.statusReason`.

- [ ] **Step 1: Update Prisma schema with `UserStatus` enum and fields**
  In `backend/prisma/schema.prisma`:
  ```prisma
  enum UserStatus {
    ACTIVE
    SUSPENDED
  }

  model User {
    id            String             @id @default(uuid())
    name          String
    email         String             @unique
    passwordHash  String             @map("password_hash")
    role          Role               @default(AUDIO_ENGINEER)
    status        UserStatus         @default(ACTIVE)
    statusReason  String?            @map("status_reason")
    createdAt     DateTime           @default(now()) @map("created_at")
    updatedAt     DateTime           @updatedAt @map("updated_at")
    ...
  }
  ```

- [ ] **Step 2: Run Prisma migration and client generation**
  Run: `cd backend && npx prisma migrate dev --name add_user_status_and_reason`
  Expected: Migration created and applied, Prisma client generated successfully.

- [ ] **Step 3: Verify existing test suite passes with updated schema**
  Run: `cd backend && npm test`
  Expected: All 68 existing tests PASS.

- [ ] **Step 4: Commit schema changes**
  ```bash
  git add backend/prisma/schema.prisma backend/prisma/migrations/
  git commit -m "feat(db): add UserStatus enum and statusReason to User model"
  ```

---

### Task 2: Security Middlewares & Suspended Account Enforcement

**Files:**
- Modify: `backend/src/middlewares/auth.js:5-45`
- Modify: `backend/src/controllers/authController.js:15-80`
- Create: `backend/tests/12_admin_user_management.test.js`

**Interfaces:**
- Consumes: `req.user` from `authenticate` middleware, `TokenRevocationService`.
- Produces: Exported `requireAdmin` middleware; updated `authenticate` rejecting `user.status === 'SUSPENDED'`; updated `login` rejecting suspended users.

- [ ] **Step 1: Write failing tests for `requireAdmin` and suspended account lockout**
  In `backend/tests/12_admin_user_management.test.js`:
  ```javascript
  import test from 'node:test';
  import assert from 'node:assert/strict';
  import request from 'supertest';
  import app from '../src/app.js';
  // Test cases:
  // 1. Unauthenticated request to /api/v1/admin/users returns 401
  // 2. Authenticated AUDIO_ENGINEER request to /api/v1/admin/users returns 403
  // 3. Authenticated ADMIN request to /api/v1/admin/users succeeds
  // 4. Suspended user cannot authenticate via login (returns 403)
  // 5. Existing token of suspended user rejected by authenticate (returns 403)
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `cd backend && node --test tests/12_admin_user_management.test.js`
  Expected: FAIL (endpoints or `requireAdmin` not yet implemented).

- [ ] **Step 3: Implement `requireAdmin` and update `authenticate` in `backend/src/middlewares/auth.js`**
  ```javascript
  export const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Akses ditolak: Memerlukan hak akses Administrator' });
    }
    next();
  };
  ```
  In `authenticate`:
  ```javascript
  if (user.status === 'SUSPENDED') {
    return res.status(403).json({ error: 'Akses ditolak: Akun Anda telah ditangguhkan oleh administrator' });
  }
  ```

- [ ] **Step 4: Update `authController.login` in `backend/src/controllers/authController.js`**
  Verify user is not suspended before generating JWT:
  ```javascript
  if (user.status === 'SUSPENDED') {
    return res.status(403).json({
      error: 'Akun Anda telah ditangguhkan oleh administrator. Silakan hubungi tim dukungan.',
      reason: user.statusReason
    });
  }
  ```

- [ ] **Step 5: Run tests to verify pass**
  Run: `cd backend && node --test tests/12_admin_user_management.test.js`
  Expected: Auth guard and lockout tests PASS.

- [ ] **Step 6: Commit auth security changes**
  ```bash
  git add backend/src/middlewares/auth.js backend/src/controllers/authController.js backend/tests/12_admin_user_management.test.js
  git commit -m "feat(auth): implement requireAdmin middleware and suspended account enforcement"
  ```

---

### Task 3: Admin User Directory & Search API

**Files:**
- Create: `backend/src/controllers/adminUserController.js`
- Create: `backend/src/routes/adminUserRoutes.js`
- Modify: `backend/src/app.js:10-25`
- Test: `backend/tests/12_admin_user_management.test.js`

**Interfaces:**
- Consumes: Prisma `user.findMany`, `user.count`, `wallet`, `session`.
- Produces: `GET /api/v1/admin/users` and `GET /api/v1/admin/users/:id`.

- [ ] **Step 1: Write failing tests for user directory listing, search, filtering, and detail**
  In `backend/tests/12_admin_user_management.test.js`:
  - Test pagination (`page=1&limit=10`).
  - Test search query `q=mayer`.
  - Test role filter `role=ADMIN` vs `role=AUDIO_ENGINEER`.
  - Test status filter `status=ACTIVE` vs `status=SUSPENDED`.
  - Test global stats in response: `{ totalUsers, activeEngineers, suspendedAccounts }`.
  - Test detail endpoint `GET /api/v1/admin/users/:id` returns user, wallet, transactions, and sessionStats (`total`, `successful`, `failed`).
  - Test detail endpoint with non-existent id returns 404.

- [ ] **Step 2: Run tests to verify they fail**
  Run: `cd backend && node --test tests/12_admin_user_management.test.js`
  Expected: FAIL with 404 Route Not Found.

- [ ] **Step 3: Implement `adminUserController.js` (listUsers and getUserDetail)**
  - `listUsers(req, res)`:
    - Parses `page`, `limit`, `q`, `role`, `status`, `sortBy`, `order`.
    - Builds Prisma `where` clause with `mode: 'insensitive'`.
    - Computes `stats`: parallel count queries for `totalUsers`, `activeEngineers` (role: AUDIO_ENGINEER, status: ACTIVE), `suspendedAccounts` (status: SUSPENDED).
    - Returns `{ users, pagination, stats }`.
  - `getUserDetail(req, res)`:
    - Fetches user by `id` including `wallet`, `transactions` (ordered desc, take 20), and session counts (`total`, `successful` [where status in READY, REPAIRED], `failed` [where status: FAILED]).
    - Returns `{ user: { ... } }` or 404.

- [ ] **Step 4: Mount routes in `backend/src/routes/adminUserRoutes.js` and `backend/src/app.js`**
  ```javascript
  import { Router } from 'express';
  import { authenticate, requireAdmin } from '../middlewares/auth.js';
  import AdminUserController from '../controllers/adminUserController.js';

  const router = Router();
  router.use(authenticate, requireAdmin);

  router.get('/', AdminUserController.listUsers);
  router.get('/:id', AdminUserController.getUserDetail);

  export default router;
  ```
  In `backend/src/app.js`:
  ```javascript
  import adminUserRoutes from './routes/adminUserRoutes.js';
  app.use('/api/v1/admin/users', adminUserRoutes);
  ```

- [ ] **Step 5: Run tests to verify directory endpoints pass**
  Run: `cd backend && node --test tests/12_admin_user_management.test.js`
  Expected: PASS for listing, filters, stats, and detail.

- [ ] **Step 6: Commit user directory endpoints**
  ```bash
  git add backend/src/controllers/adminUserController.js backend/src/routes/adminUserRoutes.js backend/src/app.js backend/tests/12_admin_user_management.test.js
  git commit -m "feat(admin): implement user directory listing and detail inspection API"
  ```

---

### Task 4: Account Actions & Token Adjustment API

**Files:**
- Modify: `backend/src/controllers/adminUserController.js`
- Modify: `backend/src/routes/adminUserRoutes.js`
- Test: `backend/tests/12_admin_user_management.test.js`

**Interfaces:**
- Consumes: `WalletService.creditToken`, `WalletService.debitToken`, `TokenRevocationService.revokeAllUserTokens`.
- Produces:
  - `PATCH /api/v1/admin/users/:id/role`
  - `PATCH /api/v1/admin/users/:id/status`
  - `POST /api/v1/admin/users/:id/tokens`
  - `POST /api/v1/admin/users/:id/revoke-sessions`

- [ ] **Step 1: Write failing tests for role change, status toggle, token adjustment, and session revocation**
  In `backend/tests/12_admin_user_management.test.js`:
  - Test role update: promotes engineer to `ADMIN`.
  - Test self-demotion prevention: admin cannot demote themselves (returns 400).
  - Test status update: suspends user with reason, stores `statusReason`.
  - Test self-suspension prevention: admin cannot suspend themselves (returns 400).
  - Test suspension side effect: revokes user sessions via `TokenRevocationService`.
  - Test token credit: adds tokens as `TOPUP` or `REFUND`, records `referenceId: 'ADM:' + adminId`.
  - Test token debit: deducts tokens as `DEDUCTION`, decreases balance, records negative amount.
  - Test token debit over-deduction: fails with 400 ("Saldo token tidak mencukupi untuk pemotongan").
  - Test token validation: invalid amount (zero/negative) or short description (<5 chars) returns 400.
  - Test revoke sessions: calls `revokeAllUserTokens` successfully.

- [ ] **Step 2: Run tests to verify they fail**
  Run: `cd backend && node --test tests/12_admin_user_management.test.js`
  Expected: FAIL on action endpoints.

- [ ] **Step 3: Implement actions in `adminUserController.js`**
  - `updateRole(req, res)`:
    - Validates `req.user.id !== targetId` (prevent self-demotion).
    - Updates `user.role`.
  - `updateStatus(req, res)`:
    - Validates `req.user.id !== targetId` (prevent self-suspension).
    - If `status === 'SUSPENDED'`, calls `TokenRevocationService.revokeAllUserTokens(targetId)`.
    - Updates `status` and `statusReason`.
  - `adjustTokens(req, res)`:
    - Validates `amount > 0` and `description.length >= 5`.
    - If `type === 'DEDUCTION'`: checks balance, calls `WalletService.debitToken(targetId, amount, type, description, 'ADM:' + req.user.id)`.
    - If `type === 'TOPUP' || type === 'REFUND'`: calls `WalletService.creditToken(targetId, amount, type, description, 'ADM:' + req.user.id)`.
  - `revokeSessions(req, res)`:
    - Calls `TokenRevocationService.revokeAllUserTokens(targetId)`.

- [ ] **Step 4: Register action routes in `backend/src/routes/adminUserRoutes.js`**
  ```javascript
  router.patch('/:id/role', AdminUserController.updateRole);
  router.patch('/:id/status', AdminUserController.updateStatus);
  router.post('/:id/tokens', AdminUserController.adjustTokens);
  router.post('/:id/revoke-sessions', AdminUserController.revokeSessions);
  ```

- [ ] **Step 5: Run tests to verify actions pass**
  Run: `cd backend && node --test tests/12_admin_user_management.test.js`
  Expected: PASS on all action tests.

- [ ] **Step 6: Run full backend test suite to ensure zero regressions**
  Run: `cd backend && npm test`
  Expected: All tests pass.

- [ ] **Step 7: Commit account action API**
  ```bash
  git add backend/src/controllers/adminUserController.js backend/src/routes/adminUserRoutes.js backend/tests/12_admin_user_management.test.js
  git commit -m "feat(admin): implement role management, account suspension, and token adjustment API"
  ```

---

### Task 5: Frontend Route & Admin Users Management View

**Files:**
- Create: `frontend/src/views/AdminUsersView.vue`
- Modify: `frontend/src/router/index.js:10-35`
- Modify: `frontend/src/views/DashboardView.vue` (navigation link)
- Modify: `frontend/src/views/BillingView.vue` (navigation link)

**Interfaces:**
- Consumes: Pinia `useAuthStore` (`user.role === 'ADMIN'`), `/api/v1/admin/users`.
- Produces: `/admin/users` route, Admin navigation link, and `AdminUsersView` page with metrics strip and directory table.

- [ ] **Step 1: Configure `/admin/users` route and navigation guard in `frontend/src/router/index.js`**
  ```javascript
  {
    path: '/admin/users',
    name: 'AdminUsers',
    component: () => import('../views/AdminUsersView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  }
  ```
  In navigation guard:
  ```javascript
  if (to.meta.requiresAdmin) {
    if (!token || !user || user.role !== 'ADMIN') {
      return next('/dashboard');
    }
  }
  ```

- [ ] **Step 2: Add Admin navigation link to global headers**
  In `DashboardView.vue` and `BillingView.vue`, render conditional link:
  ```html
  <router-link
    v-if="authStore.user?.role === 'ADMIN'"
    to="/admin/users"
    class="text-xs font-semibold uppercase tracking-wider text-slate hover:text-ink-black transition-colors"
  >
    Admin: Users
  </router-link>
  ```

- [ ] **Step 3: Implement `frontend/src/views/AdminUsersView.vue`**
  - **Header & Stats Strip**:
    - Title: `USERS MANAGEMENT` (`font-editorial font-bold text-2xl tracking-tight`).
    - Stat badges in `font-mono-accent`: `TOTAL USERS`, `ACTIVE ENGINEERS`, `SUSPENDED`.
  - **Filter Controls**:
    - Search text input (`0px border border-stone focus:border-black`).
    - Role select (`ALL`, `AUDIO_ENGINEER`, `ADMIN`).
    - Status select (`ALL`, `ACTIVE`, `SUSPENDED`).
  - **Table Layout**:
    - Strictly `rounded-none`, `#FFFFFF` canvas, `#F1F0EB` Bone header, `#C1C0BC` Stone hairline divider.
    - Pill badges (`.badge-pill-stamp` for `ACTIVE`/`SUSPENDED` and role).
    - Monospace values for tokens and dates.
    - Action button `.btn-bone-secondary` triggering user inspection.
  - **Pagination Controls**: Previous / Next page buttons (`.btn-bone-secondary`).

- [ ] **Step 4: Verify frontend build compiles without errors**
  Run: `cd frontend && npm run build`
  Expected: Build succeeds with 0 errors.

- [ ] **Step 5: Commit admin view and routing**
  ```bash
  git add frontend/src/router/index.js frontend/src/views/AdminUsersView.vue frontend/src/views/DashboardView.vue frontend/src/views/BillingView.vue
  git commit -m "feat(ui): implement AdminUsersView and admin navigation guard"
  ```

---

### Task 6: Frontend User Support Drawer & Action Modals

**Files:**
- Create: `frontend/src/components/admin/UserSupportDrawer.vue`
- Modify: `frontend/src/views/AdminUsersView.vue`

**Interfaces:**
- Consumes: Selected `user.id`, `/api/v1/admin/users/:id` endpoints.
- Produces: Slide-over drawer with role manager, suspension toggle, token adjustment form, transaction ledger, and session revocation.

- [ ] **Step 1: Implement `UserSupportDrawer.vue` component**
  - **Geometry & Backdrop**:
    - Fixed right-hand slide-over drawer with `0px border-l-2 border-black bg-paper-white z-50`.
    - Escape key and backdrop click dismissal.
  - **User Overview Card**:
    - Display Name, Email, UUID in `font-mono-accent text-xs`.
    - Current Wallet Balance in JetBrains Mono.
    - Session counts: Total, Successful, Failed.
  - **Role Management Section**:
    - Select input for `AUDIO_ENGINEER` vs `ADMIN`.
    - `.btn-ink-stamp` button: "UPDATE ROLE".
    - Disabled if target is currently logged-in admin (self-demotion safeguard).
  - **Account Status & Suspension Section**:
    - Displays current status (`ACTIVE` vs `SUSPENDED`).
    - If active: "SUSPEND ACCOUNT" button opening modal prompting for `statusReason`.
    - If suspended: Displays `statusReason` note and "REACTIVATE ACCOUNT" button.
  - **Token Adjustment Section**:
    - Form: Adjustment type (`TOPUP`, `REFUND`, `DEDUCTION`), Amount input (number), Reason textarea (min 5 characters).
    - Current balance preview calculation.
    - Submit button `.btn-ink-stamp` with loading indicator.
  - **Transaction Ledger List**:
    - Scrollable list of recent transactions: amount, type badge, reference badge, timestamp in `font-mono-accent`.
  - **Security Actions**:
    - "REVOKE ALL ACTIVE SESSIONS" button calling `/revoke-sessions`.

- [ ] **Step 2: Connect drawer to `AdminUsersView.vue`**
  - Manage state `selectedUserId` and `isDrawerOpen`.
  - Fetch detailed user data on open and trigger table refresh when actions complete.

- [ ] **Step 3: Verify frontend build compiles without errors**
  Run: `cd frontend && npm run build`
  Expected: Build succeeds with 0 errors.

- [ ] **Step 4: Commit user support drawer component**
  ```bash
  git add frontend/src/components/admin/UserSupportDrawer.vue frontend/src/views/AdminUsersView.vue
  git commit -m "feat(ui): implement UserSupportDrawer for admin actions and token ledger"
  ```

---

### Task 7: Full Stack Integration & Quality Gate

**Files:**
- Backend tests: `backend/tests/`
- Documentation: `docs/`

- [ ] **Step 1: Run complete backend test suite**
  Run: `cd backend && npm test`
  Expected: 100% PASS across all test files (existing 68 tests + new admin tests).

- [ ] **Step 2: Run frontend production build check**
  Run: `cd frontend && npm run build`
  Expected: Vite build completes cleanly.

- [ ] **Step 3: Verify Design System compliance**
  - Verify zero `rounded-lg`, `rounded-md`, or `rounded-xl` in new components.
  - Verify all primary action buttons use `.btn-ink-stamp`.
  - Verify all secondary buttons use `.btn-bone-secondary`.
  - Verify zero emojis in UI controls.
  - Verify all numeric telemetry and token quantities use `font-mono-accent`.

- [ ] **Step 4: Commit final integration verification**
  ```bash
  git commit --allow-empty -m "chore(release): verify admin user management integration and test suites"
  ```
