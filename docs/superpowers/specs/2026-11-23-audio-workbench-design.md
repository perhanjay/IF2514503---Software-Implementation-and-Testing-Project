# Design Document: Audio Workbench (AI Stem Separator & Visual Smart Silence Trimmer)

**Date:** 2026-11-23  
**Project:** Polaris Audio  
**Route:** `/workbench`  
**Page Title:** `Audio Workbench`

---

## 1. Intent & The Why

Saat ini Polaris Audio berfokus pada tahap *multitrack diagnostics & repair* di **Studio Workspace**, yang mengasumsikan pengguna sudah memiliki berkas multitrack yang rapi dan siap dianalisis fasanya. Di studio nyata, produser dan audio engineer sering menghadapi dua hambatan sebelum masuk ke tahap tersebut:

1. **Hanya memiliki file campuran (stereo mix/demo):** Mereka membutuhkan pemisahan sumber suara (*Vocals, Drums, Bass, Other*) untuk dapat melakukan pre-mix atau analisis per instrumen.
2. **File rekaman penuh dengan jeda hening panjang & letupan klik:** Rekaman DAW/home studio sering memiliki 5–20 detik hening di awal (*lead-in*), ekor hening di akhir (*tail*), atau pemotongan mendadak (*non-zero-crossing*) yang memicu suara *pop/click*.

**Audio Workbench** hadir sebagai *pre-mixing preparation suite* terpadu di halaman terpisah (`/workbench`) agar pengguna dapat memisahkan stem dengan model AI nyata (**Meta Demucs**) dan memangkas jeda hening secara visual dan interaktif, sebelum mengirim hasilnya ke **Studio Workspace** atau mengunduhnya langsung.

---

## 2. Goals, Non-Goals, & Anti-Goals

### Goals
- Menyediakan satu halaman **Audio Workbench** (`/workbench`) dengan dua mode kerja terhubung melalui folder tab:
  1. **AI Stem Separator**: Memisah 1 file audio (`.wav`, `.flac`, `.mp3`) menjadi 4 stem diskrit (`vocals.wav`, `drums.wav`, `bass.wav`, `other.wav`) menggunakan model nyata **Meta Demucs (`htdemucs`)** di worker Python.
  2. **Smart Silence Trimmer & De-Clicker**: Kanvas waveform interaktif berbasis Web Audio API di dalam layar monitor studio gelap (`.retro-monitor`) yang menandai area hening (*dead zones*) secara visual, memungkinkan penyesuaian ambang batas (*threshold dB*) dan durasi *micro-fade* (anti-click), memangkas secara presisi di Python worker, serta membandingkan audio *Sebelum vs Sesudah Trim*.
- Menyediakan **Workflow Bridge** yang aman terhadap sinkronisasi (*zero-aligned*):
  - *"Buka di Trimmer"*: Membuka stem hasil separasi di tab Trimmer dengan mode default **Trim Tersinkron (4 Stem)** agar titik potong diterapkan serempak di seluruh 4 stem dan tidak bertumpuk di luar tempo saat dikirim ke Studio Workspace.
  - *"Kirim ke Studio Workspace"*: Membuat `Session` baru di database Polaris Audio beserta `Track`-nya di MinIO S3 dari stem hasil Workbench untuk langsung diaudit fasa dan headroom-nya.
  - *"Unduh WAV / ZIP"*: Mengunduh stem satuan (termasuk hasil trim tunggal independen) atau seluruh paket hasil separasi dalam satu ZIP lossless.
- Menjaga keselarasan visual 100% dengan **Design System v2 ("Retro Studio & Frosted Notebook")** pada `DESIGN.md` dan `frontend/src/style.css`.

### Non-Goals
- **Multi-take Audio Slicing (memecah 1 file menjadi puluhan potongan tengah lagu):** Memotong bagian tengah trek secara parsial berisiko merusak kontrak *zero-aligned timing*; cakupan trimmer difokuskan pada pemangkasan *lead-in* (awal) dan *tail* (akhir) secara seragam.
- **Pitch Detection / Auto-Tune & Tempo Grid Editing:** Di luar cakupan *pre-mixing cleanup* fase ini.
- **Reference Track Tonal Matching:** Disimpan secara eksplisit untuk fase pengembangan berikutnya (Opsi B).

### Anti-Goals
- **Jangan memblokir HTTP thread Node.js atau Vite:** Pemisahan stem Demucs pada CPU dapat memakan waktu 20–90 detik; proses harus berjalan asinkron berbasis Job ID + antrean konkurensi agar tidak menyebabkan timeout atau kehabisan memori (OOM).
- **Jangan mengimpor PyTorch CUDA raksasa ke container:** Container backend menggunakan **CPU-only PyTorch wheels**, `ffmpeg`, dan bobot `htdemucs` yang sudah dipanggang (*pre-baked*) saat build Docker agar tidak mengunduh ratusan MB saat user pertama kali klik.
- **Jangan bergantung pada download model saat CI/Unit Test:** Pengujian otomatis (`pytest` dan `node --test`) tidak boleh gagal atau hang menunggu unduhan jaringan; wajib tersedia mode deterministik cepat (`POLARIS_FAST_STEM_MODE=1`).
- **Jangan mencampur stem dengan durasi berbeda saat bridge ke Studio Workspace:** Mencegah kesalahan sinkronisasi waktu (*audio numpuk*) antar-trek.

---

## 3. Constraints

1. **Tech Stack Compliance (`AGENTS.md`):**
   - Backend: Node.js ES Modules (`"type": "module"`), Express.js, Prisma ORM, MinIO S3 (`@aws-sdk/client-s3`), Redis (`ioredis`).
   - Worker: Python 3.10+, NumPy, SciPy, SoundFile, PyTorch CPU-only, `torchaudio`, `demucs`, dan system package `ffmpeg` (didefinisikan di `worker/requirements.txt` serta diinstal di `backend/Dockerfile`).
   - Frontend: Vue 3 Composition API (`<script setup>`), Pinia, Tailwind CSS v4, Web Audio API (`AudioContext`).
2. **Design System Compliance (`DESIGN.md` v2 — Retro Studio & Frosted Notebook):**
   - Mengikuti penuh tampilan **Retro Studio v2** seperti `DashboardView.vue`:
     - Canvas latar `.notebook-paper` (`#fcfcfb`).
     - Panel dan kartu menggunakan `.retro-glass-card` / `rounded-[18px] border-2 border-[#111111] shadow-[3px_4px_0_#111111]`.
     - Tombol aksi menggunakan `.btn-keycap` (`.btn-keycap-blue`, `.btn-keycap-white`, `.btn-keycap-yellow`).
     - Kanvas waveform & kontrol visual berada di dalam bingkai hardware gelap `.retro-monitor` (`#18181b`) dengan aksen Signal Blue (`#20afff`), Leaf Green (`#5ad363`), dan Hot Pink (`#ff82c2`).
     - Heading menggunakan `font-editorial font-bold`, label kontrol menggunakan `Plus Jakarta Sans` (`font-sans`), dan metrik numerik menggunakan `JetBrains Mono` / `tabular-nums`.
   - Tidak menggunakan token lama yang sudah `@deprecated` (`--color-bone`, `rounded-none` flat v1) atau menampilkan kode internal `UC-XX`.
   - Seluruh komponen Web Audio API (`AudioBufferSourceNode`, `GainNode`, `AudioContext`) wajib dibersihkan/dihentikan pada `onUnmounted`.
3. **Sample Rate & Format Output:**
   - Output audio hasil pemisahan dan pemangkasan distandarkan pada format WAV `48000 Hz` (`FLOAT` / `PCM_24` lossless) menggunakan `soundfile`.
4. **Access Control & Guest Session Parity:**
   - Menggunakan middleware `authenticate` dan `requireAudioEngineer`.
   - Sama seperti `DashboardView.vue`, saat pengguna yang belum login membuka `/workbench`, komponen `AudioWorkbenchView.vue` otomatis memanggil `POST /api/v1/auth/guest-session` pada `onMounted`. Role `ADMIN` diarahkan ke `/admin/users` oleh `router.beforeEach`.

---

## 4. Approaches Considered

| Pendekatan | Deskripsi | Trade-off | Status |
|---|---|---|---|
| **1. Hybrid Client Waveform + Python Worker Pipeline** | Browser merender kanvas waveform di dalam `.retro-monitor` & pratinjau threshold secara real-time via Web Audio API; Node.js mengelola antrean job Redis & MinIO S3; Python Worker mengeksekusi Demucs (`htdemucs`) dan zero-crossing SciPy rendering. | Membutuhkan sinkronisasi job Redis & instalasi PyTorch CPU + `demucs` + `ffmpeg` di Docker, namun memberikan respons visual instan dan integrasi aman (*zero-aligned*) ke Studio Workspace. | **Dipilih** |
| **2. Server-Side Static Processing** | Browser hanya mengunggah file dan menerima gambar PNG statis untuk waveform; setiap ubah threshold memanggil server ulang. | Interaktivitas kaku, pengguna tidak bisa memantau zona potong secara real-time di browser. | Ditolak |
| **3. Standalone File-in File-out Terisolasi** | Halaman dibuat terpisah total tanpa koneksi S3 dan tanpa integrasi membuat `Session` ke Studio Workspace. | Mudah dibangun, tetapi memutus alur pengguna (harus download ZIP lalu upload ulang ke Studio Workspace). | Ditolak |

---

## 5. Architecture & Technical Design Decisions

### 5.1 Navigasi & Struktur Halaman Frontend
- **Route Baru:** `/workbench` di `frontend/src/router/index.js` mengarah ke `frontend/src/views/AudioWorkbenchView.vue`.
- **Navbar Link (`AppNavbar.vue`):** Menambahkan tautan `Audio Workbench` di antara `Studio Workspace` dan `Dompet & Kuota` (khusus non-Admin), mengikuti gaya aktif/inaktif `AppNavbar.vue` saat ini (`font-semibold` saat aktif, `font-medium` saat tidak aktif).
- **Pinia Store (`frontend/src/stores/workbench.js`):** Menyimpan state aktif tab (`separator` | `trimmer`), status polling job pemisahan, daftar stem hasil (`vocals`, `drums`, `bass`, `other`) beserta S3 object key / presigned URL & status sinkronisasinya, serta berkas aktif di Trimmer.

### 5.2 Tab 1: AI Stem Separator (Source Separation)
- **Alur Pengguna:**
  1. Dropzone (`.retro-glass-card` bergaya dropzone notebook) menerima 1 berkas audio (`.wav`, `.flac`, `.mp3`, batas ukuran `100 MB`).
  2. Mode pemisahan standar 4-stem: `Vocals`, `Drums`, `Bass`, `Other` (`htdemucs`).
  3. Klik tombol `.btn-keycap-blue` **"Mulai Pemisahan Stem"** $\rightarrow$ Backend membuat job asinkron (`jobId`), mengunggah file mentah ke S3 `workbench/{userId}/{jobId}/input.{ext}`, dan memasukkan job ke antrean konkurensi worker (`--separate-stdin`).
  4. UI melakukan polling `GET /api/v1/workbench/jobs/:jobId` setiap 1.5 detik (status: `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`) dengan pesan progres di dalam panel monitor gelap.
  5. Setelah `COMPLETED`, tampil **4 Stem Cards**:
     - Setiap kartu memiliki tombol **Play/Pause**, **Mute/Solo**, indikator RMS/Peak singkat, tombol **"Buka di Trimmer"**, dan **"Unduh WAV"**.
  6. Dua tombol aksi utama di footer kartu hasil:
     - **"Kirim ke Studio Workspace"**: Memanggil `POST /api/v1/workbench/jobs/:jobId/send-to-session`, membuat `Session` baru bertajuk `[Nama Lagu] (Separated Stems)` lengkap dengan 4 `Track` (atau subset stem pilihan) dan mengarahkan pengguna ke `/dashboard`.
     - **"Unduh Semua Stem (ZIP)"**: Mengemas 4 file WAV ke dalam 1 arsip `.zip` lossless.

### 5.3 Tab 2: Visual Smart Silence Trimmer & De-Clicker
- **Sumber Audio:** Pengguna dapat memilih berkas lokal via drag-and-drop **atau** menerima stem dari tombol *"Buka di Trimmer"* di Tab 1.
- **Visualisasi Kanvas Interaktif (`WaveformTrimmerCanvas.vue`):**
  - Dibingkai di dalam layar monitor gelap `.retro-monitor` (`#18181b`) agar kontras gelombang tinggi dan konsisten dengan Goniometer/Peak Meter Studio.
  - Web Audio API (`AudioContext.decodeAudioData`) mengekstrak puncak amplitudo (*peaks*) lokal di browser.
  - Gelombang aktif dirender dengan warna `#20afff` (Signal Blue) / `#fcfcfb` (Paper White); zona hening (*dead zones*) di awal & akhir yang melebihi garis potong ditandai dengan arsiran `#ff82c2` (Hot Pink semi-transparan) beserta garis batas potong yang jelas.
  - Terdapat **Playhead garis vertikal** yang dapat diklik untuk *scrubbing* pratinjau audio secara langsung.
- **Kontrol Parameter:**
  - **Silence Threshold Slider:** `-60 dB` hingga `-20 dB` (default: `-45 dB`). Memperbarui highlight zona hening pada kanvas secara real-time di browser terhadap ambang linear $10^{\text{dB}/20}$.
  - **Min Silence Pad (Margin Aman):** `0 ms` – `500 ms` (default: `100 ms`).
  - **De-Clicker Micro-Fade:** `5 ms`, `15 ms` (default), `30 ms` fade-in dan fade-out di kedua ujung potongan (menggunakan kurva *raised cosine / Hann half-window*) agar pemotongan selalu mulus di *zero-crossing*.
  - **Sinkronisasi Multi-Stem (Aktif Default jika berasal dari Job Tab 1):**
    - Checkbox tercentang secara default: **"Terapkan titik potong yang sama ke seluruh 4 stem agar tetap sinkron (Zero-Aligned)"**.
    - *Perilaku Mode Tersinkron (`syncAllStems: true`):* Ketika pengguna memilih auto-detect (tanpa handle manual), Python worker menghitung amplop RMS **gabungan (*union energy envelope*) dari keempat stem (`vocals`, `drums`, `bass`, `other`)**, sehingga suatu segmen di awal atau akhir hanya dianggap hening apabila **keempat instrumen sama-sama diam** (mencegah pemotongan intro musik saat vokal belum masuk). Kemudian worker memotong keempat stem pada `[start_sample, end_sample]` yang sama persis dan memperbarui storage key hasil trim masing-masing di Redis job (`workbench:job:{jobId}`). Dengan demikian saat user kembali ke Tab 1 dan menekan *"Kirim ke Studio Workspace"*, durasi keempat stem tetap identik (0 detik drift) dan audio tidak bertumpuk di luar tempo.
    - *Perilaku Mode Tunggal (`syncAllStems: false` atau unggahan file lokal tunggal):* Hanya menghasilkan berkas `TRIMMED_{fileName}.wav` di S3 untuk **Unduh WAV** independen tanpa menimpa himpunan 4-stem tersinkron di Redis job (memastikan integritas multitrack di Studio Workspace tetap terjaga).
- **Eksekusi & Perbandingan A/B:**
  - Klik **"Terapkan Pemangkasan & De-Click"** $\rightarrow$ Memanggil `POST /api/v1/workbench/trim`.
  - Worker mengembalikan metrik: `originalDurationSec`, `trimmedDurationSec`, `leadInRemovedSec`, `tailRemovedSec`, `trimmedAudioUrl`, `trimmedPeaks`, dan daftar stem terbarui (jika `syncAllStems: true`).
  - Browser memuat audio hasil pangkas untuk memutar perbandingan **Toggle A/B (Asli vs Dipangkas)** secara instan dan menyediakan tombol **Unduh WAV Hasil Trim**.

### 5.4 Desain Backend API (`/api/v1/workbench`)
Dibuat route baru `backend/src/routes/workbenchRoutes.js`, controller `workbenchController.js`, dan service `workbenchService.js`, didaftarkan di `backend/src/app.js` pada `/api/v1/workbench` dengan proteksi `authenticate` + `requireAudioEngineer`.

| Method & Endpoint | Fungsi | Request | Response (200/201/202) |
|---|---|---|---|
| `POST /api/v1/workbench/separate` | Mengantrekan job AI Stem Separation | `multipart/form-data` (`audio` max 100MB) | `202`: `{ jobId, status: "QUEUED", fileName }` |
| `GET /api/v1/workbench/jobs/:jobId` | Cek status & hasil job pemisahan | Path param `jobId` | `200`: `{ jobId, status, progress, stepMessage, stems: [{ name, label, storageKey, audioUrl, durationSec, isTrimmed }], error }` |
| `GET /api/v1/workbench/jobs/:jobId/download-zip` | Mengunduh semua stem aktif sebagai ZIP | Path param `jobId` | `200`: Stream `application/zip` |
| `POST /api/v1/workbench/jobs/:jobId/send-to-session` | Mengubah hasil stem Workbench menjadi `Session` di Studio Workspace | `{ title?: string, stemNames?: string[] }` (opsional subset dari `["vocals","drums","bass","other"]`) | `201`: `{ session, message }` |
| `POST /api/v1/workbench/trim` | Mengeksekusi pemangkasan hening & de-clicker | `multipart/form-data` (`audio` atau body `jobId`+`stemName`) + params `{ thresholdDb, padMs, fadeMs, manualStartSec?, manualEndSec?, syncAllStems? }` | `200`: `{ storageKey, audioUrl, originalDurationSec, trimmedDurationSec, leadInRemovedSec, tailRemovedSec, trimmedPeaks, updatedJobStems? }` |

*Keamanan, Anti-IDOR & Validasi `send-to-session`:*
- Setiap objek job di Redis (`workbench:job:{jobId}`) menyimpan `userId` pemiliknya. Seluruh endpoint job (`GET`, `download-zip`, `send-to-session`, maupun `jobId` pada `/trim`) memvalidasi `job.userId === req.user.id` (HTTP `403` jika bukan pemilik).
- Pada `send-to-session`, `stemNames` (jika dikirim) harus berisi himpunan bagian valid dari `["vocals", "drums", "bass", "other"]`. Sistem memverifikasi seluruh stem terpilih memiliki selisih `durationSec <= 0.1` sebelum membuat `Session` + `Track` di PostgreSQL.

### 5.5 Desain Python Worker (`worker/src/workbench/`) & Concurrency Guard
Struktur baru di worker:
- `worker/src/workbench/stem_separator.py`:
  - `separate_audio_stems(audio_bytes, file_name, use_fast_fallback=False)`:
    - Mendekode `.wav`, `.flac`, `.mp3` via `soundfile` atau `ffmpeg` subprocess menjadi `float32` stereo 48 kHz.
    - Jika `POLARIS_FAST_STEM_MODE=1` atau `use_fast_fallback=True` (khusus CI/testing): menjalankan pemisahan spektral cepat berbasis Butterworth + HPSS (`< 200ms`).
    - Mode produksi normal: Memuat model **Meta Demucs (`demucs.pretrained.get_model('htdemucs')` + `demucs.apply.apply_model`)** via PyTorch CPU, menghasilkan 4 stem `vocals`, `drums`, `bass`, `other` berformat WAV `48000 Hz` float32.
- `worker/src/workbench/silence_trimmer.py`:
  - `trim_audio_silence(audio_data, sample_rate, threshold_db=-45.0, pad_ms=100.0, fade_ms=15.0, manual_start_sec=None, manual_end_sec=None)`:
    - Menghitung indeks potong presisi berbasis RMS sliding envelope + pad buffer, atau menggunakan `manual_start_sec` / `manual_end_sec`.
    - Guard edge case: Jika seluruh trek hening total di bawah threshold, mengembalikan error deskriptif agar tidak menghasilkan file 0 sampel.
    - Menerapkan *raised-cosine micro fade-in & fade-out* sepanjang `fade_ms` di tepi potongan.
    - Mode sinkron: menyediakan helper `slice_aligned_batch(stems_dict, start_sample, end_sample, fade_ms)` untuk memangkas 4 stem sekaligus pada batas sampel identik.
- **Worker CLI & Antrean Konkurensi:**
  - `worker/src/worker.py` menambahkan flag `--separate-stdin` dan `--trim-stdin`.
  - Di sisi Node.js (`workbenchService.js`), eksekusi `--separate-stdin` dibatasi melalui **antrean konkurensi Redis/in-process (maksimal 1 job Demucs aktif per instance, antrean berurutan)** dengan timeout longgar (10 menit) agar memori container tidak pernah *overloaded* jika beberapa permintaan masuk bersamaan.

### 5.6 Infrastruktur & Docker Provisioning
- **`worker/requirements.txt` & `backend/Dockerfile`:**
  - Menginstal `ffmpeg` via `apt-get`.
  - Menginstal CPU-only `torch` dan `torchaudio` (`--index-url https://download.pytorch.org/whl/cpu`) serta `demucs` di `backend/Dockerfile` menggunakan `worker/requirements.txt`.
  - Menambahkan langkah *pre-bake* bobot `htdemucs` saat build image Docker (`python3 -c "from demucs.pretrained import get_model; get_model('htdemucs')"`) sehingga saat container menyala, model langsung siap pakai tanpa perlu mengunduh di runtime.

### 5.7 Kebijakan Token & Konsistensi Guest
- Operasi di **Audio Workbench** (`/workbench/separate` dan `/workbench/trim`) **gratis (0 Token)** sebagai alat persiapan mandiri; biaya token standar Polaris hanya berlaku ketika stem masuk ke Studio Workspace dan user mengeksekusi perbaikan DSP penuh.
- Sesi tamu (`guest@polaris.audio`) berbagi `userId` sesi tamu dengan kebijakan yang sama seperti di `DashboardView.vue`.

---

## 6. Testing Strategy (IPPL Standard)

1. **Worker Unit Tests (`worker/tests/test_workbench.py` via `pytest`):**
   - `test_silence_trimmer_strips_lead_and_tail`: Audio sintetis `[3s silence] + [2s 440Hz sine] + [4s silence]` dipangkas menjadi `~2.2s` (termasuk margin aman 100ms per sisi).
   - `test_silence_trimmer_applies_zero_crossing_fade`: Sampel ujung awal dan akhir melandai mulus dari `0.0` (tanpa lonjakan klik).
   - `test_silence_trimmer_rejects_full_silence`: Input hening penuh mengembalikan error deskriptif.
   - `test_aligned_batch_trim_preserves_zero_alignment`: Memangkas 4 stem sinkron mempertahankan jumlah sampel dan durasi yang 100% identik di keempat stem.
   - `test_stem_separator_produces_four_zero_aligned_stems`: Dengan mode cepat (`use_fast_fallback=True`), menghasilkan tepat 4 stem (`vocals`, `drums`, `bass`, `other`) 48 kHz dengan durasi identik.
2. **Backend Integration Tests (`backend/tests/13_audio_workbench.test.js` via `node --test`):**
   - Otorisasi: Menolak request tanpa JWT (`401`) dan role `ADMIN` (`403`).
   - Anti-IDOR: User B ditolak saat mengakses status job, ZIP, trim, maupun send-to-session milik User A (`403`).
   - Endpoint `/trim`: Mengunggah WAV berjeda hening, memverifikasi HTTP `200`, durasi terpangkas, serta keberadaan objek S3 `TRIMMED_*.wav`.
   - Alur terpadu `POST /separate` $\rightarrow$ polling `GET /jobs/:jobId` (`POLARIS_FAST_STEM_MODE=1`) $\rightarrow$ `POST /trim (syncAllStems=true)` $\rightarrow$ `POST /send-to-session`: Memverifikasi `Session` baru dan 4 `Track` tersimpan di PostgreSQL dengan durasi sinkron.
3. **Frontend Build & Blackbox Matrix:**
   - Verifikasi `npm run build` di `frontend/`.
   - Pembaruan skenario pengujian di `docs/BLACKBOX_TESTING.md`.

---

## 7. What's Left to the Builder

Hal-hal berikut diserahkan kepada pengembang (*builder*) saat menyusun implementasi teknis dan plan:
- Detail rendering kanvas waveform `<canvas>` (raster grid lines pada `.retro-monitor`, zoom level opsional, penanganan HiDPI `devicePixelRatio`).
- Konfigurasi tepat TTL Redis untuk key status job workbench (misal `86400` detik / 24 jam).
- Dekomposisi fungsi helper di komponen Vue (`WaveformTrimmerCanvas.vue`, `StemSeparatorTab.vue`, `SilenceTrimmerTab.vue`) serta modul service/controller Node.js.
- Detail pemetaan pesan error lokal berbahasa Indonesia pada status job dan kegagalan upload/validasi.
