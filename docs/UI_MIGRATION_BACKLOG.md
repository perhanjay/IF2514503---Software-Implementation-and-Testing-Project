# Backlog Migrasi Visual & Peningkatan UI — Polaris Audio (Design System v2)

Dokumen ini menjadi patokan gerak (*single source of truth*) untuk menyelesaikan migrasi seluruh antarmuka web Polaris Audio ke **Design System v2 (Retro Studio & Frosted Notebook)** sesuai [`DESIGN.md`](../DESIGN.md) dan prinsip `frontend-ui-engineering`.

> **Kriteria Selesai per Layar/Komponen:**
> - Kanvas `.notebook-paper` + *ambient pastel halos* (untuk halaman penuh) atau panel `#111111`-outlined seragam (radius `12px`–`20px`).
> - Nol kelas legasi v1 (`bg-bone`, `border-stone`, `rounded-none`, `.btn-ink-stamp`, `.btn-bone-secondary`, `.editorial-card`, dan `font-mono-accent` pada teks/angka non-audio).
> - Ikon vektor konsisten (`lucide-vue-next`), tombol memakai `.btn-keycap*`, dropdown/input mengikuti standar v2 (`RetroSelect` atau input ber-border `1.5px` radius `10px`–`12px`), serta status tidak bergantung pada warna saja.
> - Lolos `npm run build`, uji keyboard/WCAG 2.1 AA, dan responsif tanpa *horizontal overflow* di `320px`, `768px`, `1024px`, dan `1440px`.

---

## Status Selesai (Done)

- [x] **Fondasi Design System v2** — [`DESIGN.md`](../DESIGN.md), [`frontend/src/style.css`](../frontend/src/style.css) (`.notebook-paper`, `.retro-glass-*`, `.retro-telemetry-plate`, `.btn-keycap-*`).
- [x] **Beranda / Landing Page** — [`frontend/src/views/LandingView.vue`](../frontend/src/views/LandingView.vue).
- [x] **Studio Workspace** — [`DashboardView.vue`](../frontend/src/views/DashboardView.vue), tab folder berwarna `01`–`03`, [`TrackClassificationCard.vue`](../frontend/src/components/TrackClassificationCard.vue), [`DiagnosticTrackCard.vue`](../frontend/src/components/DiagnosticTrackCard.vue), [`HealthScoreGauge.vue`](../frontend/src/components/HealthScoreGauge.vue), [`RetroSelect.vue`](../frontend/src/components/ui/RetroSelect.vue), modal workspace, serta panel audio (`MultitrackAuditionPanel`, `GoniometerVisualizer`, `LedPeakMeter`, `SessionTransportBar`, `TrackTallyButtons`).
- [x] **Dompet & Kuota Token (`/billing`)** — [`BillingView.vue`](../frontend/src/views/BillingView.vue) dipecah menjadi [`WalletBalanceCard.vue`](../frontend/src/components/billing/WalletBalanceCard.vue), [`TokenPackageSelector.vue`](../frontend/src/components/billing/TokenPackageSelector.vue), dan [`TokenLedgerCard.vue`](../frontend/src/components/billing/TokenLedgerCard.vue).
- [x] **Panel Admin (`/admin/users`, `/admin/transactions`)** — [`AdminUsersView.vue`](../frontend/src/views/AdminUsersView.vue), [`AdminTransactionsView.vue`](../frontend/src/views/AdminTransactionsView.vue), [`adminFormatters.js`](../frontend/src/utils/adminFormatters.js), serta komponen adaptif dan drawer di [`frontend/src/components/admin/`](../frontend/src/components/admin/) ([`AdminUsersDirectory.vue`](../frontend/src/components/admin/AdminUsersDirectory.vue), [`AdminTransactionsDirectory.vue`](../frontend/src/components/admin/AdminTransactionsDirectory.vue), [`UserSupportDrawer.vue`](../frontend/src/components/admin/UserSupportDrawer.vue), [`AdminUserOverviewCard.vue`](../frontend/src/components/admin/AdminUserOverviewCard.vue), [`AdminTokenAdjustmentForm.vue`](../frontend/src/components/admin/AdminTokenAdjustmentForm.vue), [`AdminUserLedgerSection.vue`](../frontend/src/components/admin/AdminUserLedgerSection.vue), [`AdminAccountSecurityCard.vue`](../frontend/src/components/admin/AdminAccountSecurityCard.vue), [`AdminSecurityConfirmModals.vue`](../frontend/src/components/admin/AdminSecurityConfirmModals.vue)).
- [x] **Masuk Akun (`/login`)** — [`LoginView.vue`](../frontend/src/views/LoginView.vue) dan [`ForgotPasswordModal.vue`](../frontend/src/components/auth/ForgotPasswordModal.vue).

---

## Prioritas 1 (Selesai): Panel Admin

Panel Admin merupakan area dengan komponen v1 terbanyak (121 baris terdeteksi memakai kelas legasi) dan dipakai khusus untuk operasional administrator (`/admin/users`, `/admin/transactions`).

### 1.1 Direktori Pengguna — [`AdminUsersView.vue`](../frontend/src/views/AdminUsersView.vue)
- [x] Ganti kanvas `bg-paper-white` dengan `.notebook-paper` + *ambient pastel halos*.
- [x] Rombak header & tombol *refresh* ke keycap v2 (`.btn-keycap-sm`), hilangkan pembatas `border-stone`.
- [x] Ubah strip KPI 3 kolom (`bg-bone border-stone rounded-none`) menjadi kartu statistik ber-outline `#111111` dengan `Plus Jakarta Sans` (`tabular-nums`) menggantikan `font-mono-accent`.
- [x] Ganti `<input>` pencarian dan `<select>` filter Role/Status `rounded-none` ke input v2 + [`RetroSelect.vue`](../frontend/src/components/ui/RetroSelect.vue).
- [x] Bungkus tabel pengguna & kontrol paginasi dalam kartu `#111111`-outlined seragam (radius `18px`), hilangkan `bg-bone` pada header tabel/footer paginasi, perbarui *badge* role/status menjadi pill ber-ikon + teks, dan ganti tombol aksi baris menjadi `.btn-keycap-mini`.
- [x] Tangani tampilan mobile (`320px`–`768px`) agar tabel tidak memaksa *overflow* sempit atau menyediakan kartu/baris responsif yang nyaman dibaca.

### 1.2 Audit Transaksi Token Admin — [`AdminTransactionsView.vue`](../frontend/src/views/AdminTransactionsView.vue)
- [x] Ganti kanvas `bg-paper-white` dengan `.notebook-paper` + *ambient pastel halos*.
- [x] Rombak 4 kartu metrik (`totalInCirculation`, `totalPurchased`, `totalBurned`, `totalGrants`) dari `bg-bone rounded-none` + `font-mono-accent` ke kartu KPI v2 (`tabular-nums`).
- [x] Perbaiki filter tipe transaksi (`typeFilterOptions`) agar memakai label manusiawi (bukan enum mentah `TOPUP`, `DEDUCTION`, `WELCOME_GRANT`, `REFUND`) dalam gaya pill-tab v2, serta rapikan input pencarian.
- [x] Rombak tabel transaksi, paginasi, tombol aksi pengguna (`openUserDrawer`), dan *badge* tipe transaksi ke desain v2; gunakan `lucide-vue-next` menggantikan SVG inline mentah.
- [x] Pertimbangkan pemecahan sub-komponen jika berkas melebihi ~200 baris (`frontend-ui-engineering`).

### 1.3 Drawer & Modal Dukungan Pengguna — [`UserSupportDrawer.vue`](../frontend/src/components/admin/UserSupportDrawer.vue)
- [x] Ubah panel drawer & dua modal konfirmasi (*Suspend Akun* dan *Revoke Sessions*) dari `border-black rounded-none` + `bg-bone` menjadi `.retro-glass-panel` / kartu v2 ber-radius `16px`–`20px` + backdrop ter-blur (`bg-[#111111]/55 backdrop-blur-xs`).
- [x] Ganti semua `.btn-bone-secondary`, `.btn-ink-stamp`, input, serta selector tipe adjustment token (`TOPUP` / `REFUND` / `DEDUCTION`) dengan komponen keycap & kontrol v2.
- [x] Pecah [`UserSupportDrawer.vue`](../frontend/src/components/admin/UserSupportDrawer.vue) (saat ini ~789 baris) menjadi beberapa sub-komponen fokus agar tiap berkas tetap ringkas (`< 200` baris) dan mudah dirawat (misal info akun & sesi, form mutasi token admin, serta modal konfirmasi Suspend/Revoke).
- [x] Pastikan aksesibilitas modal/drawer: `Escape` menutup modal/drawer paling atas dan *focus management* berjalan rapi.

---

## Prioritas 2 (Fokus Sekarang): Laman Autentikasi

- [x] **Masuk Akun** — [`LoginView.vue`](../frontend/src/views/LoginView.vue) (`/login`) + [`ForgotPasswordModal.vue`](../frontend/src/components/auth/ForgotPasswordModal.vue)
  - [x] Kanvas `.notebook-paper` + *ambient pastel halos* dan kartu utama `#111111`-outlined `rounded-[18px]`.
  - [x] Keycap navigasi atas (`Kembali ke Beranda`, `Studio Instan`), tombol mata sandi, keycap `.btn-keycap-blue`, serta pemecahan & migrasi modal Lupa Kata Sandi 2-langkah (`ForgotPasswordModal.vue`) menggunakan `useDialogFocus`.
- [ ] **Daftar Akun Baru** — [`RegisterView.vue`](../frontend/src/views/RegisterView.vue) (`/register`)
  - [ ] Selaraskan kanvas, kartu, input formulir, helper teks, dan keycap CTA dengan [`LoginView.vue`](../frontend/src/views/LoginView.vue) v2.

---

## Prioritas 3: Shared Navigation & Pembersihan Sistem Desain

- [ ] **Navbar Aplikasi** — [`AppNavbar.vue`](../frontend/src/components/AppNavbar.vue)
  - [ ] Perbarui menu dropdown `#navbar-account-menu` dari `rounded-none` + `#c1c0bc` menjadi radius `16px` dengan *hairline* `#111111`/15.
  - [ ] Perbarui *badge* `Admin Operator`, tombol CTA `Daftar Akun` (`rounded-none bg-black`), tombol menu mobile, serta tautan di *mobile drawer* agar memakai radius `10px`–`12px` dan varian `.btn-keycap*` yang seragam dengan seluruh aplikasi.
  - [ ] Verifikasi modal Pengaturan Akun & Ubah Kata Sandi di dalam [`AppNavbar.vue`](../frontend/src/components/AppNavbar.vue) terhadap aturan kontras & fokus v2.
- [ ] **Pembersihan Akhir (Cleanup)**
  - [ ] Hapus atau migrasikan [`SectionBadge.vue`](../frontend/src/components/SectionBadge.vue) (terdeteksi memakai `rounded-none bg-[#f1f0eb] border-[#c1c0bc]` dan saat ini belum terpakai).
  - [ ] Setelah seluruh grep kelas legasi (`bg-bone`, `border-stone`, `rounded-none`, `btn-ink-stamp`, `btn-bone-secondary`, `editorial-card`, `font-mono-accent`) bernilai `0` di `views/` dan `components/`, hapus blok `@deprecated` alias di [`frontend/src/style.css`](../frontend/src/style.css).

---

## Backlog Teknis Sekunder (Performa / UX Workspace)

- [ ] **Cegah Reload Audio Berulang saat Sesi Dibuka-Tutup di Studio Workspace**
  - [`DashboardView.vue`](../frontend/src/views/DashboardView.vue) (baris 986): mengganti `v-if="isSessionExpanded(s.id)"` dengan mekanisme lazy-mount + `v-show` agar `MultitrackAuditionPanel` tidak di-*unmount* ketika pengguna menekan **"Tutup Sesi"**.
  - [`MultitrackAuditionPanel.vue`](../frontend/src/components/audio/MultitrackAuditionPanel.vue) (baris 25–34 & 62–79): perbaiki kondisi watcher `hasPendingRepaired` agar tidak memicu *reload* berulang saat ada trek tanpa `repairedAudioUrl`, serta turunkan `isFetchingSources = false` sebelum `player.loadSessionAudio(tracksData)` agar label progres decoding tampil akurat.
