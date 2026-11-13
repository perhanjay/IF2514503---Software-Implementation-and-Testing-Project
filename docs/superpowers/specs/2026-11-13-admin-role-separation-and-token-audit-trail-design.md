# Design Document: Admin Role Segregation & Global Token Audit Trail

**Author:** Antigravity Engineering  
**Date:** 2026-11-13  
**Status:** Approved by Builder Review (Pending Final User Sign-off)  
**Target File:** `docs/superpowers/specs/2026-11-13-admin-role-separation-and-token-audit-trail-design.md`

---

## 1. Intent & The Why

In Polaris Audio, administrative operations are strictly separated from audio engineering:
- **Single Administrator Architecture:** The platform operates with a single dedicated administrator account (`admin@polaris.audio`) for system governance, customer support, and financial oversight. End-users cannot be promoted to administrators.
- **Zero-Token Policy for Admins:** Administrative accounts do not hold tokens (wallet balance is permanently `0`), cannot claim daily credits, cannot purchase token packages, and cannot initiate or run multitrack audio sessions (uploading, AI classification, DSP diagnostics, or audio repairs).
- **Read-Only Session Inspection for Support:** To effectively resolve user disputes and support tickets (e.g., failed DSP runs or anomalous stems), administrators can inspect an engineer's session in **read-only mode** (viewing track lists, diagnostic results, and PDF reports), while all mutating actions (`POST`, `PATCH`, `DELETE`) remain strictly blocked.
- **Global Token Audit Trail (`/admin/transactions`):** A centralized, platform-wide ledger view allows administrators to inspect all token movements, verify payment settlements, investigate user token disputes, and monitor real-time platform token circulation metrics.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **Enforce Backend Role Boundaries:** Restrict all session creation and mutation endpoints (`POST`, `PATCH`, `DELETE` in `sessionRoutes.js`), token package checkout, and daily claims to `AUDIO_ENGINEER` users via `requireAudioEngineer` middleware. Any mutation request by `ADMIN` returns `403 Forbidden`.
- **Read-Only Session Access for Support:** Allow `ADMIN` users to inspect session details, track lists, diagnostic results, and PDF reports (`GET /api/v1/sessions/:id`, `GET /api/v1/sessions/:id/diagnostics`, `GET /api/v1/sessions/:id/report`) across users for technical support and verification without permitting any modification.
- **Single Administrator & Zero-Token Guarantee:** Lock the administrator wallet balance permanently at `0`. Block token self-topup (`POST /api/v1/wallet/top-up` returns `403`). Disable user promotion to `ADMIN` (`PATCH /api/v1/admin/users/:id/role` returns `400 Bad Request` or is disabled).
- **Global Token Audit Trail API:** Expose `GET /api/v1/admin/transactions` protected by `authenticate` and `requireAdmin`, supporting pagination (`page`, `limit`), search query `q` (matching user name, email, transaction description, and reference ID), type filtering (`type`), date filtering, and global platform macro metrics.
- **Dedicated Admin Navigation & Experience:** Replace audio studio navigation and quota pills with a dedicated Admin header bar (**Pengguna** at `/admin/users` and **Audit Transaksi** at `/admin/transactions`). Redirect `ADMIN` attempts to access `/dashboard` or `/billing` to `/admin/users`.
- **Tactile Editorial UI Compliance (`DESIGN.md`):** Build `AdminTransactionsView.vue` conforming to the "Boutique liner notes on sunlit paper" standard (0px border-radius `rounded-none`, Paper White `#FFFFFF`, Bone `#F1F0EB`, Stone `#C1C0BC`, Ink Black `#000000`, `Plus Jakarta Sans` typography, `JetBrains Mono` telemetry, zero emojis).
- **Direct Bridge to User Support:** Allow clicking any user in the audit trail to open the `UserSupportDrawer` directly without losing search context.

### Non-Goals
- Multi-admin team hierarchy or role-based delegation (single admin account policy).
- Exporting transactions to external CSV/Excel files (can be added in future iterations).
- Modifying audio DSP algorithms or BullMQ worker execution logic.

### Anti-Goals
- **No Hybrid Admin-Engineer State:** Admins must never be allowed to run audio jobs, enqueue BullMQ worker tasks, or hold a virtual token balance.
- **No Soft UI-Only Blocking:** Permissions must be guarded at the HTTP API middleware/service layer.
- **No Session Mutation by Admin:** Administrators can observe diagnostic data for support, but can never alter, delete, or repair another user's session.

---

## 3. Constraints

- **Design System (`DESIGN.md` & `AGENTS.md`):**
  - Geometry: Strict `0px border-radius` (`rounded-none`) across all cards, dialogs, inputs, tables, and buttons (`.btn-ink-stamp`, `.btn-bone-secondary`). Only pill status badges use `rounded-full` (`9999px`).
  - Palette: `#FFFFFF` Paper White canvas, `#F1F0EB` Bone surface, `#C1C0BC` Stone hairline border, `#000000` Ink Black contrast & CTAs, with deliberate `#FF82C2` (Hot Pink) and `#20AFFF` (Signal Blue) accents.
  - Typography: `Plus Jakarta Sans` for display and body text; `JetBrains Mono` strictly reserved for timestamps, token amounts (+/-), reference IDs, and numerical telemetry.
- **ES Modules & Architecture:** Native ES Modules in Node.js backend. Controllers remain thin; business logic resides in `backend/src/services/`.
- **Test Integrity:** Maintain 100% pass status across backend integration tests (`npm test` in `backend/`) and python worker tests (`pytest` in `worker/`).

---

## 4. Approaches & Decisions

### Selected Approach: Dedicated Admin Portal with Support Inspection
- **Architecture:** Complete separation of administrative concerns from studio production.
- **Backend Permissions:**
  - `requireAudioEngineer` middleware applied at the router level to all mutating endpoints (`POST`, `PATCH`, `DELETE`) in `sessionRoutes.js`.
  - Read routes (`GET /api/v1/sessions/:id`, `/diagnostics`, `/report`) permit `ADMIN` to view sessions without IDOR restriction (`userId: req.user.role === 'ADMIN' ? undefined : req.user.id`).
  - `admin@polaris.audio` wallet balance is set to `0`. `POST /api/v1/wallet/top-up` returns `403 Forbidden` for admins.
  - Role promotion is disabled (single admin policy).
- **Frontend Architecture:**
  - Route guards redirect `ADMIN` users away from `/dashboard` and `/billing` to `/admin/users`.
  - Top navigation bar for `ADMIN` replaces consumer controls with an Admin Sub-navigation: **Pengguna** (`/admin/users`) and **Audit Transaksi** (`/admin/transactions`), hiding the "Kuota" pill badge.
  - `AdminTransactionsView.vue` renders 4 macro platform metric cards, search/filter controls, a paginated audit ledger, and an integrated `UserSupportDrawer`.

---

## 5. Detailed Specifications

### A. Backend Architecture & Security Middleware

1. **Role Restriction Middleware (`requireAudioEngineer`):**
   - In `backend/src/middlewares/auth.js`:
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
   - Applied to ALL mutating session routes in `backend/src/routes/sessionRoutes.js`:
     - `POST /upload-init`
     - `POST /upload-direct`
     - `POST /:id/verify-integrity`
     - `POST /:id/classify`
     - `POST /:id/pairs/ai`
     - `PATCH /:id/tracks/:trackId/label`
     - `POST /:id/pairs`
     - `DELETE /:id/pairs/:pairId`
     - `POST /:id/finalize-classification`
     - `POST /:id/diagnose`
     - `POST /:id/repair-auto`
     - `POST /:id/repair-custom`
     - `PATCH /:id/title`
     - `DELETE /:id`
   - Applied to consumer wallet routes in `backend/src/routes/walletRoutes.js` and `backend/src/routes/paymentRoutes.js`:
     - `POST /api/v1/wallet/claim-daily`
     - `POST /api/v1/wallet/top-up` (returns `403` for `ADMIN`)
     - `POST /api/v1/payments/checkout`

2. **Read-Only Session Inspection for Support:**
   - In `backend/src/services/sessionService.js`:
     - When fetching session details (`getSessionDetails`), diagnostics (`getDiagnostics`), or PDF report (`downloadReport`), allow access if `req.user.role === 'ADMIN'` even if the session belongs to another user:
       ```javascript
       const where = req.user.role === 'ADMIN' ? { id } : { id, userId };
       ```
     - Session mutation methods continue to strictly block non-owners and admins.

3. **Single Admin & Zero-Token Guarantee:**
   - Update database seed: ensure `admin@polaris.audio` wallet balance is `0`.
   - Update `PATCH /api/v1/admin/users/:id/role`: return `400 Bad Request` with message `"Sistem beroperasi dengan kebijakan akun admin tunggal. Perubahan peran tidak diizinkan."`
   - Update test `TC-TOPUP-03` in `backend/tests/07_security_idor_paket1.test.js` to assert `403 Forbidden` for admin top-up.

4. **Global Token Audit Trail API Endpoint:**
   - **Route:** `GET /api/v1/admin/transactions`
   - **Guards:** `authenticate`, `requireAdmin`
   - **Query Parameters:**
     - `page` (default: 1)
     - `limit` (default: 20)
     - `q` (case-insensitive search matching user `name`, `email`, transaction `description`, or `referenceId`)
     - `type` (optional: `WELCOME_GRANT`, `TOPUP`, `DEDUCTION`, `REFUND`)
     - `startDate` & `endDate` (ISO date strings)
   - **Macro Metrics (All-time platform health):**
     - `totalInCirculation`: `prisma.wallet.aggregate({ _sum: { balance: true } })` (excluding admin accounts)
     - `totalPurchased`: `prisma.tokenTransaction.aggregate({ where: { type: 'TOPUP' }, _sum: { amount: true } })`
     - `totalBurned`: `prisma.tokenTransaction.aggregate({ where: { type: 'DEDUCTION' }, _sum: { amount: true } })` (absolute value)
     - `totalGrants`: `prisma.tokenTransaction.aggregate({ where: { type: 'WELCOME_GRANT' }, _sum: { amount: true } })`

---

### B. Frontend Architecture & Design

1. **Routing & Guards (`frontend/src/router/index.js`):**
   - Register route `/admin/transactions` (`AdminTransactionsView.vue`, `requiresAuth: true`, `requiresAdmin: true`).
   - In `router.beforeEach`: If `user.role === 'ADMIN'` navigates to `/dashboard` or `/billing` or `/wallet`, redirect to `/admin/users`.

2. **Top Navigation (`frontend/src/components/AppNavbar.vue`):**
   - When `authStore.user?.role === 'ADMIN'`:
     - Hide "Studio Workspace", "Dompet & Kuota", and the "Kuota: X Token" pill badge.
     - Show admin tabs: **Pengguna** (`/admin/users`) and **Audit Transaksi** (`/admin/transactions`).
     - Display `[ADMIN OPERATOR]` badge in Bone surface with Stone border.

3. **Admin Transactions View (`frontend/src/views/AdminTransactionsView.vue`):**
   - **Aesthetic:** Paper White `#FFFFFF` canvas, Stone `#C1C0BC` hairline dividers, Bone `#F1F0EB` surfaces.
   - **Header & Navigation Strip:**
     - Title: `Audit Transaksi Token` (Editorial typography `font-bold font-editorial text-2xl`).
     - Sub-navigation tabs: `[Pengguna]` and `[Audit Transaksi]` (active).
   - **Macro Metric Cards (Grid of 4):**
     1. *Total Beredar*: Platform circulating balance in `JetBrains Mono`.
     2. *Total Pembelian (Top-Up)*: Lifetime tokens bought.
     3. *Total Konsumsi DSP*: Lifetime tokens burned for audio repairs.
     4. *Total Hibah*: Welcome & daily free grants.
   - **Interactive Ledger Table:**
     - Columns: `WAKTU` | `PENGGUNA` | `TIPE` | `JUMLAH` | `KETERANGAN` | `REFERENSI` | `AKSI`.
     - Clicking user name or "Detail" button opens `<UserSupportDrawer>` directly on the page.
   - **Search & Filter Controls:**
     - Debounced search input (name, email, order ID, session ID).
     - Filter tabs: `Semua`, `TOPUP`, `DEDUCTION`, `WELCOME_GRANT`, `REFUND`.
     - Pagination (`Sebelumnya`, `Halaman X dari Y`, `Berikutnya`).

---

## 6. Verification Plan & Quality Gates

1. **Backend Integration Tests (`backend/tests/`):**
   - Verify `ADMIN` role receives `403 Forbidden` on all session write routes (`upload-init`, `classify`, `diagnose`, `repair-auto`).
   - Verify `ADMIN` role receives `403 Forbidden` on `POST /api/v1/wallet/top-up` and `claim-daily`.
   - Verify `ADMIN` role receives `200 OK` on read-only session inspection (`GET /api/v1/sessions/:id`).
   - Verify `GET /api/v1/admin/transactions` returns paginated transactions and correct macro metrics.
   - Verify 100% pass across all 178 backend tests and 51 worker tests.
2. **Frontend UI Verification:**
   - Verify admin login defaults to `/admin/users` and navbar hides studio workspace and token pill.
   - Verify `/admin/transactions` displays metric cards, search/filter bar, and transaction ledger.
   - Verify clicking user opens `UserSupportDrawer`.
   - Verify Vite production build passes with zero errors.
