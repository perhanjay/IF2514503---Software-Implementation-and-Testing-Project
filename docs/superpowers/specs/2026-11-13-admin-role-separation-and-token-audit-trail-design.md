# Design Document: Admin Role Segregation & Global Token Audit Trail

**Author:** Antigravity Engineering  
**Date:** 2026-11-13  
**Status:** In Review  
**Target File:** `docs/superpowers/specs/2026-11-13-admin-role-separation-and-token-audit-trail-design.md`

---

## 1. Intent & The Why

In Polaris Audio, the `ADMIN` role is intended purely for back-office system administration, account governance, user support, and financial auditing. Historically, administrative accounts retained virtual token balances and had unrestricted access to end-user studio audio sessions (uploading multitrack stems, triggering AI classification, and running DSP repairs). 

Allowing administrators to process audio sessions creates architectural and business conflicts:
- **Token Distortion:** Admins possessing tokens or claiming daily developer credits muddles real financial and token circulation metrics.
- **Accidental Queue Congestion:** Heavy DSP worker processing (BullMQ / Redis / Python DSP) should be dedicated strictly to paying or evaluating sound engineers, not administrative staff testing back-office functions.
- **Auditing Blindspot:** While administrators could inspect the last 20 transactions for a single user in the support drawer, there was no centralized, platform-wide ledger to inspect all token movements, verify Midtrans payment settlements, investigate user token disputes, or monitor platform token circulation.

This design introduces a strict separation of concerns:
1. **Admins have zero tokens and cannot run audio sessions.**
2. **Admins have a dedicated Global Token Audit Trail (`/admin/transactions`)** to monitor, filter, search, and audit all platform token movements with live macro circulation metrics.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **Enforce Backend Role Boundaries:** Restrict session initialization (`/upload-init`, `/upload-direct`), audio diagnostics (`/diagnose`), audio repair (`/repair-auto`, `/repair-custom`), token checkout, and daily token claims to `AUDIO_ENGINEER` users. Requests by `ADMIN` to these endpoints return `403 Forbidden`.
- **Zero-Token Policy for Admins:** Administrative users do not hold tokens; their wallet balance is permanently maintained at `0`, and token top-ups/claims are blocked.
- **Global Token Audit Trail API:** Expose `GET /api/v1/admin/transactions` protected by `authenticate` and `requireAdmin`, supporting pagination (`page`, `limit`), search query `q` (matching user name, email, transaction description, and reference ID), type filtering (`type`), date filtering, and global platform macro metrics.
- **Dedicated Admin Navigation & Experience:** Replace audio studio navigation and quota pills with a dedicated Admin header bar (**Pengguna** at `/admin/users` and **Audit Transaksi** at `/admin/transactions`). Redirect `ADMIN` attempts to access `/dashboard` or `/billing` to `/admin/users`.
- **Tactile Editorial UI Compliance (`DESIGN.md`):** Build `AdminTransactionsView.vue` using the "Boutique liner notes on sunlit paper" standard (0px border-radius `rounded-none`, Paper White `#FFFFFF`, Bone `#F1F0EB`, Stone `#C1C0BC`, Ink Black `#000000`, `Plus Jakarta Sans` typography, `JetBrains Mono` telemetry, zero emojis).
- **Direct Bridge to User Support:** Allow clicking any user in the audit trail to open the `UserSupportDrawer` directly without losing search context.

### Non-Goals
- Exporting transactions to CSV/Excel (can be added as an optional future enhancement).
- Creating custom user roles beyond `ADMIN` and `AUDIO_ENGINEER` (RBAC remains clean and binary).
- Modifying audio DSP algorithms or worker execution logic.

### Anti-Goals
- **No Hybrid Admin-Engineer State:** Admins must never be allowed to "toggle" into an engineer mode to upload stems under their admin identity.
- **No Soft UI-Only Blocking:** Permissions must be guarded at the HTTP API middleware/service layer, not just by hiding UI buttons.
- **No AI-Slop UI Elements:** No decorative Unicode emojis in button stamps, no floating gradient orbs, and no perpetual pulsing dots on idle status indicators.

---

## 3. Constraints

- **Design System (`DESIGN.md` & `AGENTS.md`):**
  - Geometry: Strict `0px border-radius` (`rounded-none`) across all cards, dialogs, inputs, tables, and buttons (`.btn-ink-stamp`, `.btn-bone-secondary`). Only pill status badges use `rounded-full` (`9999px`).
  - Palette: `#FFFFFF` Paper White canvas, `#F1F0EB` Bone surface, `#C1C0BC` Stone hairline border, `#000000` Ink Black contrast & CTAs, with deliberate `#FF82C2` (Hot Pink) and `#20AFFF` (Signal Blue) accents.
  - Typography: `Plus Jakarta Sans` for display and body text; `JetBrains Mono` strictly reserved for timestamps, token amounts (+/-), reference IDs, and numerical telemetry.
- **ES Modules & Architecture:** Native ES Modules in Node.js backend. Controllers remain thin; business logic resides in `backend/src/services/`.
- **Test Integrity:** Maintain 100% pass status across backend integration tests (`npm test` in `backend/`) and python worker tests (`pytest` in `worker/`).

---

## 4. Approaches Considered

### Approach 1: Dedicated Admin Portal with Unified Sub-Navigation (Selected)
- **Architecture:** Complete separation of concerns.
- **Backend:** Middleware blocks admins from audio sessions (`POST /api/v1/sessions/*`) and checkout with `403 Forbidden`. Admin wallet balance is locked at 0. Dedicated endpoint `GET /api/v1/admin/transactions` serves the audit ledger.
- **Frontend:** Route guards redirect admins away from `/dashboard` and `/billing` to `/admin/users`. Main navbar conditionally renders an Admin Tab Bar (`/admin/users` and `/admin/transactions`), hiding the consumer studio workspace and quota pill. The transactions view features 4 macro platform metric cards and an interactive table with a slide-in `UserSupportDrawer` bridge.
- **Why Selected:** Cleanest operational boundary. Prevents admin test data from contaminating production audio queues, guarantees accurate platform token accounting, and provides a focused back-office workflow.

### Approach 2: Global Audit Table Embedded on the Users Page
- **Architecture:** Keep single page `/admin/users` with an accordion or secondary tab below user cards.
- **Why Rejected:** Inadequate space for auditing hundreds of transactions, mixes user account lifecycle actions with financial forensics, lacks macro platform statistics, and feels cramped.

---

## 5. Detailed Design & Implementation Specifications

### A. Backend Architecture & Security Middleware

1. **Role Restriction Middleware (`requireAudioEngineer` or `forbidAdmin`):**
   - In `backend/src/middlewares/auth.js`, add `requireAudioEngineer`:
     ```javascript
     export const requireAudioEngineer = (req, res, next) => {
       if (req.user && req.user.role === 'ADMIN') {
         return res.status(403).json({
           error: 'Akses ditolak: Akun Administrator tidak diizinkan membuat atau memproses sesi audio.'
         });
       }
       next();
     };
     ```
   - Apply `requireAudioEngineer` to session-modifying and audio-processing routes in `backend/src/routes/sessionRoutes.js`:
     - `POST /upload-init`
     - `POST /upload-direct`
     - `POST /:id/verify-integrity`
     - `POST /:id/classify`
     - `POST /:id/diagnose`
     - `POST /:id/repair-auto`
     - `POST /:id/repair-custom`
   - Apply `requireAudioEngineer` to wallet mutation routes:
     - `POST /api/v1/wallet/claim-daily`
     - `POST /api/v1/payments/checkout`

2. **Admin Zero-Token Guarantee:**
   - In `backend/src/controllers/adminUserController.js`, when promoting a user to `ADMIN`, ensure their wallet balance is set to `0` or disallow admin self-credit.
   - Update database seeds (`prisma/seed.js` or manual migrations) so default administrator `admin@polaris.audio` has `balance: 0`.

3. **Global Token Audit Trail API Endpoint:**
   - **Route:** `GET /api/v1/admin/transactions`
   - **Guards:** `authenticate`, `requireAdmin`
   - **Query Parameters:**
     - `page` (default: 1, integer $\ge 1$)
     - `limit` (default: 20, integer $1 \le \text{limit} \le 100$)
     - `q` (string, optional: case-insensitive search matching user `name`, `email`, transaction `description`, or `referenceId`)
     - `type` (string, optional: `WELCOME_GRANT`, `TOPUP`, `DEDUCTION`, `REFUND`)
     - `startDate` & `endDate` (ISO date strings, optional)
   - **Response Payload (HTTP 200 OK):**
     ```json
     {
       "transactions": [
         {
           "id": "uuid",
           "userId": "uuid",
           "walletId": "uuid",
           "amount": -2,
           "type": "DEDUCTION",
           "description": "Perbaikan Audio DSP Sesi (1-Click Auto-Fix): Rock Multitrack",
           "referenceId": "session-uuid",
           "createdAt": "2026-11-13T10:00:00.000Z",
           "user": {
             "id": "uuid",
             "name": "Jane Sound",
             "email": "jane@sound.com"
           }
         }
       ],
       "pagination": {
         "page": 1,
         "limit": 20,
         "total": 142,
         "totalPages": 8
       },
       "metrics": {
         "totalInCirculation": 420,
         "totalPurchased": 350,
         "totalBurned": 180,
         "totalGrants": 250
       }
     }
     ```

4. **Aggregate Macro Metrics Calculation (ACID / Prisma):**
   - Calculate `metrics` using Prisma aggregations:
     - `totalInCirculation`: `prisma.wallet.aggregate({ _sum: { balance: true } })` (excluding admin accounts)
     - `totalPurchased`: `prisma.tokenTransaction.aggregate({ where: { type: 'TOPUP' }, _sum: { amount: true } })`
     - `totalBurned`: `prisma.tokenTransaction.aggregate({ where: { type: 'DEDUCTION' }, _sum: { amount: true } })` (absolute value)
     - `totalGrants`: `prisma.tokenTransaction.aggregate({ where: { type: 'WELCOME_GRANT' }, _sum: { amount: true } })`

---

### B. Frontend Architecture & Design

1. **Routing & Guards (`frontend/src/router/index.js`):**
   - Add route:
     ```javascript
     {
       path: '/admin/transactions',
       name: 'AdminTransactions',
       component: () => import('../views/AdminTransactionsView.vue'),
       meta: { requiresAuth: true, requiresAdmin: true }
     }
     ```
   - In `router.beforeEach`:
     - If authenticated user has `role === 'ADMIN'`:
       - If navigating to `/dashboard` or `/billing` or `/wallet`, automatically redirect to `/admin/users`.

2. **Top Navigation Overhaul (`frontend/src/components/AppNavbar.vue`):**
   - When `authStore.user?.role === 'ADMIN'`:
     - **Hide:** "Studio Workspace" link, "Dompet & Kuota" link, and the "Kuota: X Token" pill badge.
     - **Show:** Direct admin links:
       - **Pengguna** (`/admin/users`)
       - **Audit Transaksi** (`/admin/transactions`)
     - Display a distinct admin badge: `[ADMIN OPERATOR]` in `JetBrains Mono` with Bone background and Stone border.

3. **Admin Transactions View (`frontend/src/views/AdminTransactionsView.vue`):**
   - **Aesthetic:** Clean Paper White `#FFFFFF` canvas, Stone hairline borders `#C1C0BC`, Bone `#F1F0EB` tables.
   - **Header & Navigation Strip:**
     - Title: `Audit Transaksi Token` (Editorial typography `font-bold font-editorial text-2xl`).
     - Subtitle: `Rekam jejak mutasi token dan peredaran kredit platform real-time.`
     - Sub-navigation tabs: `[Pengguna]` (link to `/admin/users`) and `[Audit Transaksi]` (active tab with bottom border).
   - **Macro Metric Cards (Grid of 4):**
     1. *Total Beredar*: Sum of all user wallet balances.
     2. *Total Pembelian (Top-Up)*: Tokens bought via Midtrans.
     3. *Total Konsumsi DSP*: Tokens spent on repairs.
     4. *Total Hibah*: Welcome and daily free claims.
     - Rendered with `JetBrains Mono` for large numbers, sharp 0px corners, Stone borders.
   - **Search & Filter Controls:**
     - Search input (debounced 300ms) with placeholder `Cari nama, email, deskripsi, ID order...`
     - Filter tabs/pills: `Semua`, `TOPUP`, `DEDUCTION`, `WELCOME_GRANT`, `REFUND`.
     - Refresh button with spinner.
   - **Audit Ledger Table:**
     - Columns:
       - `WAKTU` (`JetBrains Mono`, formatted local timestamp)
       - `PENGGUNA` (Name in bold, email in muted slate; clickable to open drawer)
       - `TIPE` (Pill badge: Green for `TOPUP`, Red for `DEDUCTION`, Yellow for `WELCOME_GRANT`, Blue for `REFUND`)
       - `JUMLAH` (`JetBrains Mono font-bold`, e.g. `+10 Token` or `-2 Token`)
       - `KETERANGAN` (Detailed purpose, e.g. "Perbaikan Audio DSP Sesi...")
       - `REFERENSI` (`JetBrains Mono text-xs`, e.g. `POLARIS-...` or Session ID)
       - `AKSI` (Bone secondary button: `Detail Pengguna`)
     - Empty state with editorial styling.
     - Pagination controls (`Sebelumnya`, `Halaman X dari Y`, `Berikutnya`).
   - **User Support Drawer Integration:**
     - Embed `<UserSupportDrawer>` in the view so clicking any user in the ledger immediately slides out their details without changing the page.

---

## 6. What's Left to the Builder

- Implementing the Prisma transaction query with proper `where` clauses and sorting (`createdAt: 'desc'`).
- Handling edge cases where `_sum.amount` might be `null` in aggregations (defaulting cleanly to `0`).
- Updating test suites to verify that `ADMIN` attempts to upload sessions or buy tokens receive HTTP 403.
- Updating database seeds so `admin@polaris.audio` is initialized with balance 0.

---

## 7. Verification & Acceptance Criteria

1. **Role Enforcement Verification:**
   - Attempting `POST /api/v1/sessions/upload-init` with an `ADMIN` JWT returns `403 Forbidden`.
   - Attempting `POST /api/v1/wallet/claim-daily` or `POST /api/v1/payments/checkout` with an `ADMIN` JWT returns `403 Forbidden`.
   - `AUDIO_ENGINEER` accounts continue to upload sessions, claim tokens, and run DSP repairs seamlessly.
2. **Audit Ledger Verification:**
   - `GET /api/v1/admin/transactions` returns paginated transactions and correct aggregate metrics.
   - Filtering by `type=DEDUCTION` returns only DSP repair debits.
   - Search by user email or order ID filters records accurately.
3. **UI & Design Verification:**
   - Admin logging in is redirected to `/admin/users`.
   - Admin cannot see the "Kuota" pill or consumer Studio Workspace link in the navbar.
   - Visiting `/admin/transactions` renders the 4 metric cards, filter pills, search input, and transaction ledger conforming strictly to `0px border-radius` and `DESIGN.md`.
   - Clicking a user in the ledger opens `UserSupportDrawer`.
   - Automated test suite passes 100% (`npm test` in `backend/` and `pytest` in `worker/`).
