# Design Specification: Perombakan Panel Admin ke Design System v2

- **Inisiatif:** Polaris Audio — Migrasi UI Panel Admin (Manajemen Pengguna, Audit Transaksi & Drawer Dukungan)
- **Status:** Disetujui — Siap untuk Perencanaan & Implementasi
- **Tanggal:** 2026-11-22
- **Referensi Desain:** [`DESIGN.md`](../../../DESIGN.md), [`docs/UI_MIGRATION_BACKLOG.md`](../../UI_MIGRATION_BACKLOG.md)

---

## 1. Tujuan & Masalah yang Diselesaikan

Panel Admin saat ini (`AdminUsersView.vue`, `AdminTransactionsView.vue`, `UserSupportDrawer.vue`) masih menggunakan Design System v1 (`bg-paper-white`, `bg-bone`, `border-stone`, `rounded-none`, `.btn-ink-stamp`, `.btn-bone-secondary`, `<select>` native, SVG inline mentah, serta `font-mono-accent` pada angka non-audio). Selain ketidaksinkronan visual dengan Studio Workspace dan Dompet & Kuota, antarmuka admin sekarang memiliki tiga masalah UX:

1. **Kebanyakan teks penjelasan redundan ("yapping"):**
   - Drawer memuat tag/judul ganda bahasa Inggris (`SUPPORT & LEDGER` + `USER DETAILS & CONTROLS`), blok *Peran Pengguna* lengkap dengan paragraf kebijakan 3 baris, serta paragraf penjelasan panjang di kartu *Status Akun* dan *Keamanan Sesi* padahal aksi konfirmasinya sudah memiliki modal terpisah.
   - Halaman utama & strip metrik memakai subjudul dan keterangan panjang yang mengulang judul.
2. **Tampilan UUID `user.id` berulang di identitas akun:**
   - `user.id` (UUID panjang) ditampilkan dua kali di drawer: di bawah email pada kartu identitas dan di *sticky footer* (`ID Pengguna: ...`), memberi beban visual yang tidak diperlukan operator admin.
3. **Tabel 6–7 kolom belum adaptif untuk mobile (`320px`–`767px`)** dan [`UserSupportDrawer.vue`](../../../frontend/src/components/admin/UserSupportDrawer.vue) membengkak menjadi 789 baris monolitik.

### Non-Goals & Anti-Goals
- **Non-Goals:** Tidak mengubah kontrak REST API backend (`/api/v1/admin/*`), skema Prisma, atau route guard [`frontend/src/router/index.js`](../../../frontend/src/router/index.js). Tidak menambah endpoint backend baru.
- **Anti-Goals:** Tidak menghilangkan `tx.referenceId` dari baris transaksi (dibutuhkan untuk pelacakan ID order Midtrans / ID sesi), tidak membuang konfirmasi modal untuk aksi destruktif (*Suspend* & *Revoke Sessions*), dan tidak menyembunyikan validasi saldo saat admin melakukan `DEDUCTION`.

---

## 2. Kendala & Kontrak Sistem

1. **Design System v2 (`DESIGN.md`):**
   - Kanvas `.notebook-paper` (`#fcfcfb`) dengan 3 *ambient pastel halos* (`#20afff/12`, `#ffda40/14`, `#ff82c2/10`) pada halaman penuh.
   - Kartu utama seragam `rounded-[18px] border-2 border-[#111111] bg-white/95 backdrop-blur-md shadow-[3px_4px_0_#111111]`; pelat dalam `#fcfcfb` atau `#f5f3eb` ber-radius `14px`.
   - Kontrol aksi memakai `.btn-keycap-sm` / `.btn-keycap-mini` dengan ikon `lucide-vue-next`; dropdown memakai [`RetroSelect.vue`](../../../frontend/src/components/ui/RetroSelect.vue).
   - Tipografi `Plus Jakarta Sans` (`tabular-nums`) untuk seluruh angka non-audio (saldo, jumlah mutasi, total pengguna, tanggal `id-ID`, paginasi). Nol `font-mono-accent` pada teks/angka non-audio.
2. **Standar `frontend-ui-engineering`:**
   - Tiap berkas komponen terfokus `< 200`–`250` baris.
   - Seluruh state **loading (skeleton `aria-busy`)**, **error (+ tombol coba lagi)**, dan **empty** tertangani eksplisit.
   - Navigasi keyboard & WCAG 2.1 AA: target sentuh nyaman di mobile, *focus-visible* jelas, `Escape` menutup modal terlebih dahulu baru drawer, status tidak mengandalkan warna saja (selalu sertakan ikon + teks).
   - Nol *horizontal overflow* pada `320px`, `768px`, `1024px`, dan `1440px`.

---

## 3. Pendekatan yang Dipertimbangkan & Pilihan Terpilih

- **Pendekatan A — Kartu KPI Studio + Tabel Adaptif (Kartu di Mobile) + Slide-Over Frosted Drawer Terdekomposisi *(Dipilih User)***
  - **Desktop (`>= 768px` untuk `AdminUsersView`, `>= 1024px` untuk `AdminTransactionsView`):** Tabel tetap tampil di dalam satu kartu `#111111`-outlined agar admin dapat memindai banyak baris secara efisien.
  - **Mobile / Tablet Sempit (`< 768px` / `< 1024px`):** Otomatis beralih menjadi daftar kartu ringkas per item (tanpa scroll horizontal paksa), tetap menampilkan seluruh informasi utama dan tombol aksi.
  - **Drawer:** Tetap *slide-over* di kanan agar posisi filter/halaman di tabel tidak hilang saat admin membuka beberapa akun berturut-turut, namun dibersihkan dari UUID/yapping dan dipecah menjadi sub-komponen kecil.
- **Pendekatan B — Tabel Horizontal-Scroll Murni + Modal Tengah *(Ditolak)***
  - Ditolak karena tabel 7 kolom berat dipakai di layar `320px`–`640px` dan modal tengah terlalu sempit untuk form + daftar 20 transaksi.

---

## 4. Spesifikasi Desain per Layar & Komponen

### 4.1 Manajemen Pengguna (`/admin/users` — [`AdminUsersView.vue`](../../../frontend/src/views/AdminUsersView.vue))

- **Header Halaman:**
  - Judul `<h1>`: `Manajemen Pengguna` (tanpa paragraf yapping di bawah judul, seragam dengan `Studio Workspace` dan `Dompet & Kuota Token`).
  - Tombol kanan: `.btn-keycap btn-keycap-sm btn-keycap-white` **`Segarkan Data`** dengan ikon `RefreshCw` (`animate-spin` saat `loading`).
- **Strip KPI (3 Kartu):**
  - Grid `grid-cols-1 sm:grid-cols-3 gap-4`:
    1. `Total Pengguna` (aksen biru muda `#87d7ff`, ikon `Users`)
    2. `Engineer Aktif` (aksen hijau muda `#d8f3dc`, ikon `UserCheck`)
    3. `Akun Ditangguhkan` (aksen pink `#ffcae6` saat `> 0` atau `#f5f3eb` saat `0`, ikon `UserX`)
  - Hanya tampilkan label singkat + angka besar `tabular-nums` (hilangkan kalimat pengisi panjang di bawah angka).
- **Bar Kontrol Pencarian & Filter:**
  - Input pencarian ber-radius `12px` (`border-[1.5px] border-[#111111]/25 focus:border-[#111111]`), tombol clear `X` saat `searchQuery` terisi, serta 2 [`RetroSelect`](../../../frontend/src/components/ui/RetroSelect.vue) untuk **Peran** (`Semua Peran`, `Audio Engineer`, `Admin`) dan **Status** (`Semua Status`, `Aktif`, `Ditangguhkan`).
- **Direktori Pengguna (Tabel Desktop `md:block` + Kartu Mobile `md:hidden`):**
  - Kedua mode dibungkus dalam satu kartu `#111111`-outlined (`rounded-[18px]`) bersama *footer* paginasi (`Menampilkan X dari Y pengguna`, `Halaman A dari B`, keycap `Sebelumnya` / `Berikutnya`).
  - Kolom desktop: `Pengguna` (Nama + Email), `Peran` (pill ikon+teks), `Status` (pill ikon+teks `Aktif`/`Ditangguhkan`), `Kuota` (`N Token`), `Bergabung` (`id-ID`), `Aksi` (`.btn-keycap-mini btn-keycap-white` **`Kelola`**).
  - Kartu mobile: menampilkan Nama + Email di atas, pill Peran & Status, Kuota + Tanggal bergabung sejajar, serta tombol **`Kelola`**.
  - Menangani loading skeleton (`aria-busy="true"`), error card + retry, dan empty state.

### 4.2 Audit Transaksi Token (`/admin/transactions` — [`AdminTransactionsView.vue`](../../../frontend/src/views/AdminTransactionsView.vue))

- **Header Halaman:**
  - Judul `<h1>`: `Audit Transaksi Token` (ringkas, tanpa subjudul panjang).
  - Tombol kanan: keycap **`Segarkan Data`**.
- **Ribbon KPI (4 Kartu):**
  - Grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`:
    1. `Total Beredar` (ikon `Coins`, `#ffda40`)
    2. `Total Pembelian` (ikon `ArrowDownLeft`, `#d8f3dc`)
    3. `Total Konsumsi DSP` (ikon `ArrowUpRight`, `#ffcae6`)
    4. `Hibah & Bonus` (ikon `Gift`, `#87d7ff`)
  - Menampilkan label ringkas + nilai `N Token` dalam `tabular-nums` tanpa subjudul panjang.
- **Pencarian & Filter Tipe:**
  - Input pencarian ber-radius `12px` + tombol clear `X`.
  - Filter pill berlabel bahasa Indonesia manusiawi (nilai parameter API tetap sama):
    - `ALL` -> `Semua`
    - `TOPUP` -> `Top-Up`
    - `DEDUCTION` -> `Pemakaian`
    - `WELCOME_GRANT` -> `Bonus & Klaim`
    - `REFUND` -> `Pengembalian`
  - Pill aktif memakai gaya tegas (`bg-[#111111] text-white border-[#111111]`).
- **Ledger Transaksi (Tabel Desktop `lg:block` + Kartu Mobile `lg:hidden`) & Paginasi:**
  - Kolom desktop: `Waktu` (`id-ID`), `Pengguna` (klik nama membuka `UserSupportDrawer`), `Tipe` (pill ikon + label manusiawi), `Jumlah` (`+N` / `-N Token` + warna kontras tinggi), `Keterangan`, `Referensi` (chip ringkas `tx.referenceId` jika ada), `Aksi` (`.btn-keycap-mini btn-keycap-white` **`Detail`**).
  - Kartu mobile (`< lg`): header kartu berisi Tipe badge + Nominal (`+N`/`-N Token`) + Waktu; diikuti Pengguna (klik untuk buka drawer), Keterangan, Referensi (bila ada), serta tombol **`Detail`**.
  - Footer paginasi seragam dengan `AdminUsersView`.

### 4.3 Drawer Dukungan Pengguna (`UserSupportDrawer`) — Ringkas, Bebas Yapping & Tanpa UUID

Memecah [`UserSupportDrawer.vue`](../../../frontend/src/components/admin/UserSupportDrawer.vue) agar arsitektur bersih (`< 200`–`250` baris/berkas):

1. **`UserSupportDrawer.vue` (Shell & Orkestrasi):**
   - Overlay backdrop (`bg-[#111111]/55 backdrop-blur-xs`), panel kanan `bg-[#fcfcfb]` ber-outline kiri `border-l-2 border-[#111111] max-w-xl`.
   - **Header ringkas:** hanya judul **`Kelola Pengguna`** + tombol tutup keycap mini `X` (hapus badge `SUPPORT & LEDGER` dan judul Inggris `USER DETAILS & CONTROLS`).
   - Banner notifikasi sukses/error inline (`role="status"` / `role="alert"`).
   - Footer sederhana hanya berisi tombol **`Tutup`** (hapus `ID Pengguna: ...` dari footer).
2. **`AdminUserOverviewCard.vue` (Identitas, Peran, Status & Statistik Sesi):**
   - Menampilkan **Nama**, **Email**, pill **Peran** (`Admin` / `Audio Engineer`), pill **Status** (`Aktif` / `Ditangguhkan`), dan blok **Saldo Token** di kanan.
   - **Menghapus UUID `user.id`** di bawah email.
   - **Menghapus kotak terpisah `PERAN PENGGUNA` dan paragraf kebijakannya.**
   - Bar statistik ringkas 3 kolom: `Total Sesi`, `Berhasil`, `Gagal` (`tabular-nums`).
3. **`AdminTokenAdjustmentForm.vue` (Penyesuaian Saldo Token):**
   - Header `Penyesuaian Saldo Token` + saldo saat ini.
   - Pilihan tipe sebagai 3 tab/tombol ringkas: `Top-Up (+)`, `Refund (+)`, `Potong (-)`.
   - Input `Jumlah Token` & textarea `Alasan Penyesuaian` ber-style v2 (`rounded-[10px] border-[1.5px]`).
   - Strip proyeksi saldo (`76 -> 77 Token` dalam `.retro-telemetry-plate`) + peringatan bila saldo tidak mencukupi.
   - Submit CTA: `.btn-keycap btn-keycap-sm btn-keycap-blue w-full` **`Terapkan Penyesuaian Token`**.
4. **`AdminUserLedgerSection.vue` (Riwayat Mutasi Pengguna):**
   - Judul `Mutasi Terakhir` + pill jumlah (`N Mutasi`).
   - Daftar scrollable `max-h-64` ber-outline `#111111`/20 menampilkan tipe manusiawi (ikon + pill), `referenceId` bila ada, jumlah `+`/`-`, deskripsi, dan waktu `id-ID`.
5. **`AdminAccountSecurityCard.vue` (Konsolidasi Status & Keamanan Akun):**
   - Menggabungkan bekas kartu *Status Akun & Penangguhan* + *Tindakan Keamanan Sesi* menjadi **satu bagian ringkas**.
   - Tanpa paragraf penjelasan panjang (*yapping*). Hanya tampilkan:
     - Callout `Alasan Penangguhan` (hanya muncul jika `status === 'SUSPENDED'`).
     - Notice singkat `Akun Anda sendiri tidak dapat ditangguhkan.` (hanya muncul jika `isSelf && status === 'ACTIVE'`).
     - Dua tombol aksi sejajar: `.btn-keycap-sm btn-keycap-pink` **`Tangguhkan Akun`** (atau `.btn-keycap-green` **`Aktifkan Kembali`**) + `.btn-keycap-sm btn-keycap-white` **`Cabut Semua Sesi`**.
6. **`AdminSecurityConfirmModals.vue` (2 Modal Konfirmasi v2):**
   - Menggunakan `.retro-glass-panel` (`rounded-[20px] border-2 border-[#111111] shadow-[4px_5px_0_#111111]`) + backdrop blur.
   - Penjelasan singkat dampak penangguhan / pencabutan sesi ditempatkan di dalam modal konfirmasi ini tepat sebelum admin menekan tombol aksi final (`.btn-keycap-pink`).

---

## 5. Urutan Implementasi & Verifikasi

1. Buat helper bersama [`frontend/src/utils/adminFormatters.js`](../../../frontend/src/utils/adminFormatters.js) (`getAdminTxMeta`, `formatDateId`, `formatDateTimeId`, `formatNumberId`) agar nol duplikasi antara `AdminTransactionsView`, `AdminUsersView`, dan `AdminUserLedgerSection`.
2. Migrasikan & pecah [`UserSupportDrawer.vue`](../../../frontend/src/components/admin/UserSupportDrawer.vue) beserta 5 sub-komponennya (`AdminUserOverviewCard`, `AdminTokenAdjustmentForm`, `AdminUserLedgerSection`, `AdminAccountSecurityCard`, `AdminSecurityConfirmModals`).
3. Migrasikan [`AdminUsersView.vue`](../../../frontend/src/views/AdminUsersView.vue) (beserta komponen KPI/direktori bila perlu agar tiap file tetap `< 250` baris).
4. Migrasikan [`AdminTransactionsView.vue`](../../../frontend/src/views/AdminTransactionsView.vue).
5. Verifikasi akhir: `npm run build`, grep nol kelas legasi v1 (`bg-bone`, `border-stone`, `rounded-none`, `btn-ink-stamp`, `btn-bone-secondary`, `font-mono-accent`) di seluruh berkas admin, serta inspeksi Chromium pada `320px`, `768px`, `1024px`, dan `1440px` (termasuk state drawer dan modal konfirmasi).
