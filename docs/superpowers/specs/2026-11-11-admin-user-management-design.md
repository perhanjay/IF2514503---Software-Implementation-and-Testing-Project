# Design Specification: Admin User Management & Support Dashboard

- **Initiative:** Polaris Audio - Admin Dashboard & User Management
- **Status:** Approved / Ready for Planning
- **Date:** 2026-11-11
- **Target Release:** v1.1.0

---

## 1. Intent & Objective

Polaris Audio is a web-based multitrack audio mixing preparation and deterministic DSP workstation. Currently, user accounts operate under a flat model where all users access the standard audio engineer workspace. While the data layer defines `enum Role { AUDIO_ENGINEER, ADMIN }` and a non-destructive token transaction ledger, there is no administrative interface or API to view users, provide customer support, adjust token balances, or enforce account governance.

The objective of this project is to implement an **Admin User Management & Support Module** within Polaris Audio. This enables platform administrators to:
1. Search, filter, and inspect registered users and their activity.
2. View detailed support context (wallet balance, token transaction audit logs, session metrics).
3. Safely manage roles (`AUDIO_ENGINEER` $\leftrightarrow$ `ADMIN`) with strict self-demotion safeguards.
4. Manually credit (`TOPUP`/`REFUND`) or debit (`DEDUCTION`) tokens with mandatory audit reason logging into the double-entry `TokenTransaction` ledger, with strict prevention of negative wallet balances.
5. Suspend or reactivate user accounts with persistent reason tracking, immediately revoking active sessions for suspended users.
6. Provide an interface conforming strictly to Polaris Audio's **"Boutique liner notes on sunlit paper"** editorial design system (0px border-radius, Paper White canvas, Bone surfaces, Stone hairline dividers, Ink Black stamp buttons, and JetBrains Mono tabular readouts).

---

## 2. Goals, Non-Goals, & Anti-Goals

### Goals
- **User Discovery & Oversight:** Fast, paginated listing with search (name, email) and multi-attribute filtering (role, status). Includes a global stats strip (`totalUsers`, `activeEngineers`, `suspendedAccounts`) in a single payload.
- **Audit-Compliant Token Adjustments:** Every administrative token adjustment must create a traceable `TokenTransaction` record (`TOPUP`, `REFUND`, or `DEDUCTION`) with a human-readable reason note and admin actor reference (`ADM:<admin_id>`).
- **Immediate Account Enforcement:** Account suspension (`SUSPENDED`) must immediately revoke all active JWT tokens via `TokenRevocationService`, store `statusReason` persistently, and block future authentication attempts.
- **Admin Self-Protection:** Safeguards preventing the last admin or the requesting admin from demoting or suspending their own account.
- **Design System Fidelity:** 100% adherence to `DESIGN.md` (0px sharp geometry, editorial typography, no generic AI slop, no emojis in controls, no drop shadows).

### Non-Goals
- **DSP Worker / Pipeline Diagnostics:** Operational BullMQ queue inspector and raw S3 audio asset file browsing are excluded from this phase.
- **Direct Password Mutation:** Admins will not set or view plaintext user passwords (password resets remain self-service via auth tokens).
- **Public Registration Override:** Admins do not manually invite users via magic email links in this scope.

### Anti-Goals
- **Destroying User History:** Admin suspension or deletion must never wipe financial transaction records or orphan audio sessions without explicit confirmation and cascade handling.
- **Unlogged Token Edits:** Direct modification of `wallet.balance` without an accompanying `TokenTransaction` row is strictly prohibited.
- **Negative Balances:** An admin token debit must never reduce a user's wallet balance below zero.
- **Generic Rounded SaaS Aesthetics:** No pill cards, no 8px rounded inputs, no floating pastel gradients, no unicode emojis.

---

## 3. Constraints

- **Runtime & Stack:** Node.js (ES Modules `"type": "module"`), Express 4.21, Prisma ORM 6.4, PostgreSQL 17, Vue 3.5 (`<script setup>`), Tailwind CSS v4, Pinia 4.0.
- **Prisma Migrations:** Direct SQL alteration is forbidden; all schema modifications must be applied through `npx prisma migrate dev`.
- **Existing Auth & Revocation:** Must reuse `backend/src/services/tokenRevocationService.js` and existing JWT claims (`userId`, `role`).
- **Test Integrity:** Must maintain 100% pass status across existing backend tests (all 68 tests) while adding comprehensive test coverage for admin endpoints.

---

## 4. Approaches Considered

### Approach 1: Integrated Admin Module within Core Stack (Selected)
- **Architecture:** Add `/api/v1/admin/users` endpoints guarded by `requireAdmin` middleware. Add `/admin/users` view in existing Vue 3 SPA with router guard protection. Extend Prisma `User` model with `status` enum (`ACTIVE`, `SUSPENDED`) and `statusReason` string.
- **Rationale:** Keeps infrastructure clean, reuses Pinia auth store and Prisma client, avoids container fragmentation, and guarantees consistent token transactions.
- **Selected by User:** Confirmed on 2026-11-11.

### Approach 2: Lightweight Admin API + In-place Overlays (Rejected)
- **Drawback:** Embedding admin tools inside regular user views clutters the audio engineer workspace and fails to scale as user directory grows.

### Approach 3: Independent Standalone Admin Micro-App (Rejected)
- **Drawback:** Massive infrastructure overhead (separate Vite app, duplicate Docker services, duplicated auth stores) without functional benefit for current scale.

---

## 5. Technical Specification & Implementation Details

### 5.1 Data Model Changes (`prisma/schema.prisma`)

Add `UserStatus` enum, `status`, and `statusReason` to the `User` model:

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

  wallet        Wallet?
  sessions      Session[]
  transactions  TokenTransaction[]
  orders        TokenOrder[]

  @@map("users")
}
```

### 5.2 Backend API & Security Architecture

#### Middleware: `requireAdmin`
Located in `backend/src/middlewares/auth.js`:
```javascript
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Akses ditolak: Memerlukan hak akses Administrator' });
  }
  next();
};
```

#### Middleware Update: `authenticate`
Extend the existing `authenticate` middleware in `backend/src/middlewares/auth.js`:
```javascript
if (user.status === 'SUSPENDED') {
  return res.status(403).json({ error: 'Akses ditolak: Akun Anda telah ditangguhkan oleh administrator' });
}
```

#### Admin Routes & Endpoints (`backend/src/routes/adminUserRoutes.js`)
Mounted at `/api/v1/admin/users` protected by `[authenticate, requireAdmin]`:

1. **`GET /api/v1/admin/users`**
   - **Query Parameters:**
     - `page` (default: `1`), `limit` (default: `20`, max: `100`)
     - `q` (case-insensitive search across `name` and `email`)
     - `role` (`ALL`, `AUDIO_ENGINEER`, `ADMIN`)
     - `status` (`ALL`, `ACTIVE`, `SUSPENDED`)
     - `sortBy` (`createdAt`, `name`, `balance`) & `order` (`asc`, `desc`)
   - **Response `200 OK`:**
     ```json
     {
       "users": [
         {
           "id": "uuid",
           "name": "John Mayer",
           "email": "john@mayer.com",
           "role": "AUDIO_ENGINEER",
           "status": "ACTIVE",
           "statusReason": null,
           "createdAt": "2026-10-12T10:00:00.000Z",
           "wallet": { "balance": 14 },
           "_count": { "sessions": 4 }
         }
       ],
       "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 },
       "stats": {
         "totalUsers": 42,
         "activeEngineers": 38,
         "suspendedAccounts": 2
       }
     }
     ```

2. **`GET /api/v1/admin/users/:id`**
   - **Response `200 OK`:**
     ```json
     {
       "user": {
         "id": "uuid",
         "name": "John Mayer",
         "email": "john@mayer.com",
         "role": "AUDIO_ENGINEER",
         "status": "ACTIVE",
         "statusReason": null,
         "createdAt": "2026-10-12T10:00:00.000Z",
         "wallet": { "balance": 14 },
         "transactions": [
           {
             "id": "tx_uuid",
             "amount": 10,
             "type": "TOPUP",
             "description": "Midtrans Paket Pro",
             "referenceId": "INV-1092",
             "createdAt": "2026-10-14T08:00:00.000Z"
           }
         ],
         "sessionStats": {
           "total": 4,
           "successful": 3,
           "failed": 1
         }
       }
     }
     ```
   - **Response `404 Not Found`:** If user does not exist.

3. **`PATCH /api/v1/admin/users/:id/status`**
   - **Body:** `{ "status": "ACTIVE" | "SUSPENDED", "reason": "Fraudulent dispute note" }`
   - **Safeguard:** Cannot suspend the currently authenticated admin (`req.user.id === targetId`).
   - **Side Effect:** If `status === 'SUSPENDED'`, immediately calls `TokenRevocationService.revokeAllUserTokens(targetId)`.
   - **Persistence:** Updates `status` and `statusReason`.
   - **Response `200 OK`:** `{ "message": "Status pengguna berhasil diperbarui", "user": { ... } }`

4. **`PATCH /api/v1/admin/users/:id/role`**
   - **Body:** `{ "role": "AUDIO_ENGINEER" | "ADMIN" }`
   - **Safeguard:** Cannot demote yourself from `ADMIN` to `AUDIO_ENGINEER` (`req.user.id === targetId`).
   - **Response `200 OK`:** `{ "message": "Peran pengguna berhasil diperbarui", "user": { ... } }`

5. **`POST /api/v1/admin/users/:id/tokens`**
   - **Body:** `{ "amount": 10, "type": "TOPUP" | "REFUND" | "DEDUCTION", "description": "Support compensation #402" }`
   - **Validation:**
     - `amount` must be a positive integer $> 0$.
     - `description` must have at least 5 characters.
     - If `type === 'DEDUCTION'`: checks `wallet.balance >= amount`. If insufficient, returns `400 Bad Request` (`error: 'Saldo token tidak mencukupi untuk pemotongan'`).
   - **Persistence:**
     - If `type` is `TOPUP` or `REFUND`: calls `WalletService.creditToken(targetId, amount, type, description, `ADM:${req.user.id}`)`.
     - If `type` is `DEDUCTION`: calls `WalletService.debitToken(targetId, amount, type, description, `ADM:${req.user.id}`)`.
   - **Response `200 OK`:** `{ "message": "Penyesuaian token berhasil diproses", "wallet": { "balance": 24 } }`

6. **`POST /api/v1/admin/users/:id/revoke-sessions`**
   - **Action:** Calls `TokenRevocationService.revokeAllUserTokens(targetId)`.
   - **Response `200 OK`:** `{ "message": "Semua sesi pengguna telah berhasil dicabut" }`

---

### 5.3 Frontend Architecture (`frontend/src/`)

#### Router Configuration (`frontend/src/router/index.js`)
```javascript
{
  path: '/admin/users',
  name: 'AdminUsers',
  component: () => import('../views/AdminUsersView.vue'),
  meta: { requiresAuth: true, requiresAdmin: true }
}
```
**Navigation Guard:**
```javascript
router.beforeEach((to, from, next) => {
  const user = JSON.parse(localStorage.getItem('polaris_user') || 'null');
  if (to.meta.requiresAdmin && (!user || user.role !== 'ADMIN')) {
    return next('/dashboard');
  }
  next();
});
```

#### Navigation Bar Integration
In existing global headers (e.g. `DashboardView.vue`, `BillingView.vue`):
- Conditionally render navigation link:
  ```html
  <router-link
    v-if="authStore.user?.role === 'ADMIN'"
    to="/admin/users"
    class="text-xs font-semibold uppercase tracking-wider text-slate hover:text-ink-black transition-colors"
  >
    Admin: Users
  </router-link>
  ```

#### Component Architecture: `AdminUsersView.vue` & `UserSupportDrawer.vue`
1. **Header & Summary Stats**:
   - Title: `USERS MANAGEMENT` in `font-editorial font-bold`.
   - Metrics strip: Total Users, Active Engineers, Suspended Accounts (`stats` payload).
2. **Filter & Search Bar**:
   - Search input (`0px border border-stone focus:border-black`).
   - Role dropdown filter (`All Roles`, `Audio Engineer`, `Admin`).
   - Status dropdown filter (`All Status`, `Active`, `Suspended`).
3. **User Directory Table**:
   - Columns: `NAME & EMAIL`, `ROLE`, `STATUS`, `TOKENS`, `JOINED`, `ACTIONS`.
   - Role Capsule: `.badge-pill-stamp` (`bg-bone text-ink-black border border-stone`).
   - Status Capsule: `.badge-pill-stamp` (Green for `ACTIVE`, Crimson for `SUSPENDED`).
   - Token & Date: `font-mono-accent text-sm`.
   - Action: `.btn-bone-secondary` with `MANAGE` label.
4. **Slide-over Support Drawer (`UserSupportDrawer.vue`)**:
   - Fixed side sheet (`w-full max-w-xl bg-paper-white border-l-2 border-black z-50`).
   - Role selector + save action (`.btn-ink-stamp`).
   - Account status toggle (`ACTIVE` $\leftrightarrow$ `SUSPENDED`) with persistent reason prompt.
   - Token adjustment form: Select `Credit (TOPUP)`, `Refund (REFUND)`, or `Deduct (DEDUCTION)`, token amount, mandatory reason, and confirmation.
   - Scrollable transaction ledger with timestamps, amounts, reference badges, and descriptions.
   - Force session revocation button (`.btn-bone-secondary`).

---

## 6. Testing Strategy

### 6.1 Backend Automated Tests (`backend/tests/12_admin_user_management.test.js`)
Using Node.js native test runner (`node:test` and `node:assert`):
- **RBAC Enforcement:**
  - Non-authenticated user receives `401 Unauthorized`.
  - Authenticated `AUDIO_ENGINEER` user receives `403 Forbidden` on all `/api/v1/admin/*` endpoints.
  - Authenticated `ADMIN` user succeeds (`200 OK`).
- **User Querying & Filtering:**
  - Pagination works correctly (`page`, `limit`).
  - Search by name and email prefix/substring works.
  - Role filter correctly isolates `ADMIN` vs `AUDIO_ENGINEER`.
  - Status filter correctly isolates `ACTIVE` vs `SUSPENDED`.
  - Response includes `stats` summary.
- **Role Management & Safeguards:**
  - Admin can promote `AUDIO_ENGINEER` to `ADMIN`.
  - Admin cannot demote their own account (`400 Bad Request` or `403 Forbidden`).
- **Status Management & Suspension:**
  - Admin can suspend a target user with `reason`.
  - Admin cannot suspend themselves (`400 Bad Request`).
  - Suspended user cannot authenticate via `/api/v1/auth/login` (`403 Forbidden`).
  - Suspended user's existing JWT is invalidated on subsequent API calls (`403 Forbidden`).
- **Token Adjustments (Credit & Debit):**
  - Admin can credit tokens (`TOPUP`/`REFUND`); `Wallet.balance` increases, and `TokenTransaction` entry with type `TOPUP` is recorded with `ADM:<id>` in `referenceId`.
  - Admin can deduct tokens (`DEDUCTION`); `Wallet.balance` decreases, and negative transaction amount is recorded.
  - Deducting more than current balance fails with `400 Bad Request` ("Saldo token tidak mencukupi").
  - Empty description or non-positive amount returns `400 Bad Request`.
- **Session Revocation:**
  - Calling revoke endpoint invalidates previous user tokens in `TokenRevocationService`.

---

## 7. Boundaries & Rules

| Category | Policy |
|---|---|
| **Always Do** | Verify `req.user.role === 'ADMIN'` on all administrative routes; log all token mutations to `TokenTransaction`; revoke JWTs immediately when suspending an account; use strict 0px border-radius across all UI elements; store admin id in `referenceId` (`ADM:<id>`). |
| **Ask First** | Modifying database models outside `User` and `UserStatus`; changing existing public endpoints or altering regular engineer user flows. |
| **Never Do** | Allow direct token balance mutations without a `TokenTransaction` record; permit an admin to suspend or demote their own account; allow negative wallet balances; use generic rounded UI corners or unicode emojis; serve files through Express memory buffers. |

---

## 8. Success Criteria

1. **Database Schema:** `UserStatus` enum, `status`, and `statusReason` columns successfully migrated via Prisma without regressions.
2. **API Completeness:** All 6 administrative endpoints implemented and passing integration tests.
3. **Security Verified:** Non-admins cannot access admin endpoints under any circumstance; suspended users cannot access any platform service.
4. **Frontend Usability:** Responsive, tactile editorial admin dashboard running at `/admin/users` adhering to 0px geometry and color tokens.
5. **Test Suite Green:** 100% test pass rate across both existing test files (68 tests) and the new admin test suite.
