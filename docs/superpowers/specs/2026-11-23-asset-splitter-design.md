# Design Document: Multi-Region Asset Splitter (Pengganti Smart Silence Trimmer di Audio Workbench)

**Date:** 2026-11-23  
**Project:** Polaris Audio  
**Route:** `/workbench` (Tab 02: `Asset Splitter`)  
**Replaces:** Smart Silence Trimmer (`SilenceTrimmerTab.vue`, `POST /api/v1/workbench/trim`, `--trim-stdin`)

---

## 1. Intent & The Why

Pada implementasi awal Tab 2 Audio Workbench (**Smart Silence Trimmer**), pengguna hanya bisa memangkas keheningan di ujung awal dan akhir berkas menjadi 1 berkas output tunggal—yang efek perubahannya terasa sangat halus dan kurang memberikan nilai guna instan.

Di sisi lain, *sound designer*, kreator game, dan *bedroom producer* sering merekam atau mengekspor puluhan aset suara terpisah (*SFX*, *foley hits*, *one-shot samples*, atau rekaman *take* beruntun) ke dalam **satu berkas audio panjang** yang dipisahkan jeda hening. Mengganti Tab 2 menjadi **Multi-Region Asset Splitter** memberikan kemampuan otomasi visual yang langsung berdampak besar: sistem otomatis mendeteksi seluruh blok suara aktif, memberi pengguna kendali *manual override* lengkap langsung pada kanvas waveform, lalu mengekspor puluhan berkas bersih secara serempak.

---

## 2. Goals, Non-Goals, & Anti-Goals

### Goals
- Mengganti Tab 2 Audio Workbench dari *Head/Tail Trimmer* menjadi **Multi-Region Asset Splitter** (`Pendekatan 1` — menggantikan jalur lama tanpa memelihara dua mode tumpang tindih).
- Mempertahankan penuh skema visual kanvas **Retro Studio Light Paper** yang sudah disempurnakan:
  - Latar kertas `#fcfcfb` berbingkai `#111111`, garis amplitudo Signal Blue (`#0284c7`), cursor playhead Ember Orange (`#ff5a2c`), zona diam/jeda berarsir Hot Pink transparan (`#ff82c2/28`), dan garis potong putus-putus Hot Pink (`#db2777`) lengkap dengan tag handle `IN` / `OUT`.
- **Deteksi Multi-Region Otomatis:** Mendeteksi seluruh segmen suara aktif menggunakan parameter `Silence Threshold (dB)`, `Jeda Pemisah Minimal (ms)`, `Durasi Aset Minimal (ms)`, dan `Margin Aman / Pad (ms)`.
- **Manual Override Lengkap di Kanvas & Daftar Region:**
  1. Menggeser batas kiri/kanan (`IN` / `OUT`) tiap blok region langsung di kanvas tanpa menabrak blok tetangga.
  2. Menambah titik potong baru di tengah gelombang (**Split Mode** klik kanvas atau tombol **"Belah di Playhead"**).
  3. Menggabungkan dua blok berurutan yang terpotong terlalu cepat (**Merge / Gabung Berikutnya**).
  4. Menghapus region yang tidak diinginkan (*false positive / noise*) dan mereset ulang ke hasil deteksi otomatis (**Deteksi Ulang Otomatis**).
  5. Mengubah nama kustom per aset (*editable filename*) beserta pratinjau audio (*Web Audio preview*) per blok region.
- **Ekspor Batch Lossless / Multi-Format:** Menggunakan kembali mesin ekspor `audio_exporter.py` dan dropdown 4 format (`Sesuai File Asli`, `FLAC 24-bit`, `WAV 24-bit PCM`, `MP3 320 kbps`) untuk mengunduh tiap aset satuan maupun seluruh paket ZIP.
- **Keterhubungan dengan Tab 1 (`AI Stem Separator`):** Kartu stem hasil separasi AI di Tab 1 memiliki tombol **"Pecah di Asset Splitter"** untuk mencacah 1 stem tunggal (misal drum hits / frasa vokal) menjadi potongan-potongan pendek, tanpa mengganggu tombol **"Kirim ke Studio Workspace"** di Tab 1 yang tetap menjaga keutuhan 4-stem *zero-aligned*.

### Non-Goals
- **Sinkronisasi Multi-Stem 4-Track pada Tab 2 (`syncAllStems`):** Dihapus sepenuhnya. Pemecahan aset menghasilkan potongan-potongan klip terpisah untuk ekspor/sampel mandiri, **bukan** untuk dikirim ke Studio Workspace sebagai sesi multitrack.
- **Waveform Destructive Editing Lanjutan (Draw/Pitch/Time-Stretch):** Di luar cakupan pemotongan & micro-fade aset.

### Anti-Goals
- **Jangan menumpuk 40 tag `IN`/`OUT` sekaligus di kanvas saat ada 20+ region:** Tag handle `IN`/`OUT` penuh hanya digambar pada region yang sedang aktif dipilih/disorot (`selectedRegionId`), sedangkan region lain cukup menampilkan penomoran ringkas (`01`, `02`, ...) dan garis batas potong agar kanvas tetap bersih.
- **Jangan membiarkan kode mati (*dead code*):** Endpoint `POST /api/v1/workbench/trim`, worker `--trim-stdin`, serta UI/sync state `syncAllStems` lama dihapus bersih ketika digantikan oleh `/split` & `--split-stdin`.
- **Jangan membuat file 0 sampel atau tanpa *de-clicker*:** Setiap potongan aset wajib minimal `10 ms` dan diberi *Hann raised-cosine fade-in/out* agar bebas klik/letupan DC.

---

## 3. Constraints

1. **Design System & Visual Asset Splitter:**
   - Mempertahankan desain light-paper **Waveform Canvas** (`#fcfcfb`, `#0284c7`, `#db2777`, `#ff82c2`, `#ff5a2c`, bingkai `border-[1.5px] border-[#111111]`) serta kartu `.retro-telemetry-plate`, tombol `.btn-keycap`, dan `RetroSelect`.
   - Tidak ada label `UC-XX` atau token `@deprecated`.
2. **Audio & Processing Constraints:**
   - Pemrosesan internal pada worker Python tetap menggunakan `48000 Hz` stereo `float32` dan menyimpan berkas potongan dasar ke MinIO S3 dalam format `WAV PCM_24` agar siap di-preview di browser dan cepat ditranskode saat unduh.
   - Menggunakan ulang `decode_audio_bytes`, `encode_wav_bytes`, `_slice_and_fade`, dan `audio_exporter.py` (`--export-stdin`).
3. **Batas Aman Sistem & Anti-IDOR:**
   - Batas jumlah region per permintaan split adalah `1` hingga `100` region (mencegah payload/S3 spam berlebihan).
   - Batas berkas input tetap `100 MB` (`.wav`, `.flac`, `.mp3`).
   - Manifest hasil split di Redis (`workbench:split:{splitId}`, TTL `86400s`) selalu mengikat `userId` pemilik untuk validasi Anti-IDOR (`403`), serta validasi prefix `workbench/${userId}/` pada `/export`.
4. **Web Audio Lifecycle:** Seluruh `AudioBufferSourceNode`, `GainNode`, `AudioContext`, `requestAnimationFrame`, dan `ResizeObserver` wajib dibersihkan pada `onUnmounted` dan pergantian berkas/tab.

---

## 4. Technical Design

### 4.1 Deteksi Multi-Region Otomatis & Parietas Klien–Server
- **Algoritma Deteksi (`detect_active_regions`):**
  1. Hitung magnitudo puncak / RMS per jendela `10 ms` dari sinyal stereo.
  2. Tandai frame aktif jika amplitudo $\ge 10^{\text{thresholdDb}/20}$.
  3. **Bridge Silence Gaps:** Jika ada jeda non-aktif di antara dua segmen aktif yang durasinya $< \text{minSilenceGapMs}$, gabungkan menjadi satu segmen aktif kontinu agar jeda mikro atau ekor reverb alami tidak memecah satu aset.
  4. **Filter Noise Spikes:** Buang segmen yang durasinya $< \text{minAssetMs}$.
  5. **Padding Aman Anti-Tumpang-Tindih:** Tambahkan `padMs` sebelum titik awal dan setelah titik akhir tiap segmen (dijaga `[0, totalDurationSec]`). Bila padding dua region bertetangga saling bersentuhan/melewati titik tengah jeda, kunci titik pertemuan keduanya di titik tengah celah agar region tetap berurutan tanpa overlap (`prev.endSec <= next.startSec`).
- **Kalkulasi Real-Time di Browser:**
  Saat berkas atau stem dimuat ke `AssetSplitterTab.vue` dan didekode menjadi `AudioBuffer`, browser langsung menghitung array envelope `10 ms` lokal. Setiap pergeseran slider (`thresholdDb`, `minSilenceGapMs`, `minAssetMs`, `padMs`) menghitung ulang `regions[]` secara lokal dalam $< 10\text{ ms}$ tanpa memanggil server—memberikan umpan balik kanvas yang mulus 60fps sebelum pengguna melakukan override atau ekspor final.

### 4.2 Kanvas Interaktif (`WaveformSplitterCanvas.vue`) & Daftar Region
- **Tool Mode:**
  - `select` (**Pilih & Scrub**, default): Klik area gelombang untuk memindah *playhead* (sekaligus memilih region bila klik jatuh di dalamnya). Menyeret handle `IN` / `OUT` pada region terpilih mengubah `startSec` / `endSec` (dijaga minimal `0.05s` durasi klip dan tidak menabrak batas `prevRegion.endSec` / `nextRegion.startSec`).
  - `split` (**Mode Belah**): Kursor berubah menjadi pisau potong; klik di dalam region aktif pada posisi $t$ (dengan jarak minimal `0.05s` dari tepi region) langsung membelah region tersebut menjadi 2 region bertetangga: `[startSec, t]` dan `[t, endSec]` (`name_part1` & `name_part2`), lalu otomatis kembali ke mode `select` atau tetap siap belah sesuai toggle. Tersedia juga tombol **"Belah di Playhead"** pada region terpilih.
- **Editor Daftar Region (`AssetSplitterTab.vue`):**
  - Setiap baris region menampilkan nomor (`01`), input teks nama aset kustom (editable), rentang waktu (`start – end` & durasi), tombol **▶ Putar Klip** (memutar `[startSec..endSec]` langsung dari `AudioBuffer` lokal), tombol **Gabung ($\leftrightarrow$)** ke region berikutnya (pada baris `0 .. n-2`, menghasilkan `[curr.startSec, next.endSec]` dengan nama `curr.name`), dan tombol **Hapus**.
  - Terdapat opsi cepat **Prefix Batch Rename** (opsional, misal ketik prefix `sfx_hero` lalu terapkan agar menamai otomatis `sfx_hero_01`, `sfx_hero_02`, ...), atau edit satuan tiap nama file.

### 4.3 Backend API (`/api/v1/workbench`)
- **Dihapus (Penggantian bersih):** `POST /api/v1/workbench/trim` dan state/kode `syncAllStems` pada `workbenchService.js` / `workbenchController.js` / `workbenchRoutes.js`.
- **Endpoint Baru:**
  1. `POST /api/v1/workbench/split`:
     - Menerima `multipart/form-data` (`audio` file) **atau** `{ jobId, stemName }` (untuk stem hasil Tab 1), plus `regions` (JSON string/array berisi `[{ name, startSec, endSec }]`), `fadeMs` (default `15`).
     - Validasi ketat: minimal `1` region, maksimal `100` region; setiap region wajib memenuhi `Number.isFinite`, `startSec >= 0`, `endSec - startSec >= 0.01`, dan `startSec < durationSec`. Duplikasi nama yang disanitasi diberi akhiran unik `_1`, `_2`, dst.
     - Memanggil Python worker `--split-stdin` untuk memotong & meng-encode tiap region sebagai `PCM_24` WAV 48 kHz ke S3 `workbench/{userId}/split-{splitId}/{idx}_{safeName}.wav`.
     - Menyimpan manifest di Redis `workbench:split:{splitId}` (TTL `86400s`) dan mengembalikan HTTP `200`:
       `{ splitId, sourceFileName, sourceFormat, fadeMs, totalAssets, assets: [{ name, fileName, storageKey, audioUrl, durationSec }] }`.
  2. `GET /api/v1/workbench/splits/:splitId/download-zip?format=auto|flac24|wav24|mp3_320`:
     - Verifikasi `isValidUuid(splitId)` (`404` jika tidak ada) dan `split.userId === req.user.id` (`403` jika bukan pemilik).
     - Memanfaatkan `resolveExportSpec` + `transcodeStorageItems` yang sudah ada di `workbenchService.js` untuk mengemas seluruh potongan aset (`{asset.name}{ext}`) menjadi 1 berkas ZIP dalam format pilihan pengguna.
  3. **Unduhan Satuan Per Aset:** Memanfaatkan `GET /api/v1/workbench/export?storageKey=...&format=...&sourceTargetFormat=...&fileName=...` yang sudah ada (telah memvalidasi kepemilikan `workbench/${userId}/`).

### 4.4 Python Worker (`worker/src/workbench/silence_trimmer.py` & `worker.py`)
- Di `worker/src/workbench/silence_trimmer.py`:
  - Menambahkan `detect_active_regions(audio_data, sample_rate, threshold_db=-45.0, min_silence_gap_ms=300.0, min_asset_ms=100.0, pad_ms=50.0) -> list[dict]`: mengembalikan daftar region `{ start_sec, end_sec, duration_sec }` yang bebas tumpang tindih dan menolak input audio hening total.
  - Menambahkan `split_audio_by_regions(audio_data, sample_rate, regions, fade_ms=15.0) -> list[dict]`: memvalidasi batas tiap region (`0 <= start < end <= total_samples`, minimal `0.01s`), memotong dengan `_slice_and_fade` (*Hann raised-cosine*), men-dedup nama file aman, dan mengembalikan WAV bytes `PCM_24` 48 kHz beserta `duration_sec`.
  - Menghapus `compute_union_trim_bounds`, `slice_aligned_batch`, dan wrapper trim tunggal lama yang tidak terpakai setelah pergantian ke `--split-stdin`.
- Di `worker/src/worker.py`:
  - Mengganti `trim_workbench_audio` / `--trim-stdin` menjadi `split_workbench_audio(payload)` / `--split-stdin` (mendekode input sekali dari S3, memanggil `split_audio_by_regions`, lalu mengunggah N berkas aset potongan ke S3).

---

## 5. Testing Strategy (IPPL Standard)

1. **Worker Unit Tests (`worker/tests/test_workbench.py` via `pytest`):**
   - `test_detect_active_regions_finds_multiple_assets_and_bridges_short_gaps`: Menguji sinyal sintetis berisi 3 burst suara berdurasi masing-masing `0.5s` dengan celah diam internal pendek (`80ms`, wajib tergabung jika `min_silence_gap_ms=300`) dan celah pemisah panjang (`600ms`, wajib terpisah) $\rightarrow$ menghasilkan jumlah region eksak dengan padding tanpa tumpang tindih.
   - `test_detect_active_regions_filters_short_noise_bursts_and_rejects_full_silence`: Spike `20ms` dibuang saat `min_asset_ms=100`; audio hening total melempar `ValueError`.
   - `test_split_audio_by_regions_slices_pcm24_with_zero_crossing_fade_and_unique_names`: Memverifikasi pemotongan manual override multi-region (termasuk nama duplikat yang di-deduplikasi bersih) menghasilkan berkas `48000 Hz` `PCM_24` WAV valid dengan ujung `~0.0` bebas klik.
2. **Backend Integration Tests (`backend/tests/13_audio_workbench.test.js` via `node --test`):**
   - Uji validasi input `/split`: menolak `regions` kosong (`400`), `> 100` region (`400`), batas tidak valid `startSec >= endSec` (`400`), dan berkas korup/non-audio (`400`).
   - Uji `POST /api/v1/workbench/split` pada berkas multi-aset sintetis $\rightarrow$ HTTP `200`, mengembalikan `N` asset dengan `audioUrl`, lalu uji `GET /splits/:splitId/download-zip?format=flac24`, `?format=mp3_320`, dan `?format=auto` (memverifikasi isi ZIP berisi `N` file terpisah dengan nama kustom!).
   - Uji integrasi *"Pecah di Asset Splitter"* memakai `{ jobId, stemName: 'vocals' }` hasil Tab 1, serta Anti-IDOR `403` saat User B mengakses `/splits/:splitId/download-zip`.
3. **Frontend & Docs:**
   - `cd frontend && npm run build` lulus 0 error.
   - Pembaruan skenario **Modul 10** di `docs/BLACKBOX_TESTING.md`.

---

## 6. What's Left to the Builder

- Detail UX scroll-list & batch prefix rename input pada `AssetSplitterTab.vue`.
- Detail interaksi hover highlighting region & cursor visual pisau pada `WaveformSplitterCanvas.vue`.
- Pemetaan warna/ikon minor pada tombol aksi region dan label ringkas berbahasa Indonesia.
