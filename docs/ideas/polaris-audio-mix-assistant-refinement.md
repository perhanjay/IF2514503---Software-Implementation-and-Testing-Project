# Polaris Audio: Refined Product Concept & Context Handoff
*(Automated Mix Assistant for Bedroom Creators & Indie Artists)*

Dokumen ini merupakan artefak **Context Handoff** berbasis keahlian `/idea-refine`, yang menyintesis seluruh hasil audit kritis, perdebatan arsitektur, dan keputusan pivot strategis. Dokumen ini dirancang sebagai acuan eksekusi mandiri untuk sesi pengembangan berikutnya tanpa kehilangan konteks teknis maupun bisnis.

---

## Metadata Konteks & Titik Tolak Codebase
* **Proyek**: Polaris Audio (IF2514503 - Implementasi dan Pengujian Perangkat Lunak / IPPL)
* **Status Git Baseline**: Commit `61d6c72` (*test(auth): implement hermetic test suite for auth and user security with happy path last - Phase T1*)
* **Arsitektur Eksisting**: Express.js decoupled (`app.js`), PostgreSQL + Prisma ORM, MinIO S3, Redis, dan Python Worker DSP/AI.

---

## 1. Problem Statement
> **"How Might We..."**
> *Bagaimana kita dapat memberdayakan musisi kamar (bedroom producers) dan artis independen pemula untuk mendeteksi serta memperbaiki kekacauan teknis pada sesi mixing (vokal tenggelam, benturan frekuensi kick vs bass, room rumble rekaman murah, dan gain staging berantakan) secara otomatis dalam hitungan detik tanpa membebani mereka dengan matematika sinyal rumit atau alur kerja DAW enterprise yang mengintimidasi?*

---

## 2. Recommended Direction (The Strategic Pivot)

### A. Reposisi Produk (Dari "Alat Studio Enterprise" ke "Mix Assistant Kreator Kamar")
Berdasarkan audit objektif, membangun fitur kelas enterprise (seperti *AAF session import*, *all-pass continuous phase rotation* untuk 12 mic drum, *multi-tenant studio seats*, dan *forensic watermarking*) adalah **over-engineering yang fatal** bagi target pasar indie. Musisi pemula bekerja sendiri di kamar menggunakan MIDI drum samples (yang sudah *in-phase* dari pabriknya). Masalah nyata mereka adalah:
1. Rekaman vokal dari mic condenser murah di kamar tanpa peredam menghasilkan *sub-rumble* AC dan suara berdengung (*boxy mud* 300–500 Hz).
2. Bass 808 dan Kick saling bertabrakan frekuensi dan memakan *headroom*.
3. Volume stem tidak tertata (*gain staging* acak-acakan).
4. Tidak mengerti istilah teknis seperti *Pearson Correlation*, *ISP True-Peak*, atau *Haas Effect*.

### B. Arsitektur Hibrida Realistis (Menghindari "In-Browser Crash" & "Biaya Cloud Meledak")
* **Bukan Full Client-Side**: Memproses 32–48 track WAV di browser (Wasm) akan menabrak batas memori V8 (2 GB) dan menyebabkan *tab crash (Out Of Memory)* pada laptop standar pengguna.
* **Heavy Compute di Server Cloud**: Python Worker tetap menangani pemrosesan audio berat (rendering perbaikan stem WAV 24-bit dan pengemasan ZIP).
* **Solusi Efisiensi Biaya Storage**: Terapkan **S3 Lifecycle Ephemeral Retention (2 Jam)**. Seluruh audio mentah dan hasil olahan di MinIO S3 langsung dihapus otomatis 2 jam setelah pemrosesan selesai. Biaya storage server ditekan mendekati nol.
* **Solusi Pemutar Web Ringan**: Server merender **2 stem master stereo terpadu**: `Preview_Before.mp3` vs `Preview_After.mp3`. Browser klien hanya memuat 2 berkas audio ini (< 50 MB RAM), sehingga tombol A/B Comparison beralih secara instan tanpa risiko browser macet.

### C. Model Finansial Baru (Subscription dengan Jatah Harian / Agentic Quota Window)
Tinggalkan model pembelian koin/token bergaya arcade yang membebani psikologis musisi pemula. Beralih ke **Monthly Subscription + Daily Rolling Allowance**:
* **Tier Gratis**: 1 lagu / hari (maksimal 8 stem).
* **Tier Bedroom Creator (Rp 49.000 / bulan)**: 5 lagu penuh / hari (maksimal 24 stem).
* **Tier Studio Indie (Rp 129.000 / bulan)**: 15 lagu penuh / hari (maksimal 48 stem).
* Mekanisme pembatasan diatur via Redis Rate Limiter (`INCR` key dengan TTL 24 jam).

---

## 3. Key Assumptions to Validate

| No | Asumsi Kritis | Cara Menguji / Memvalidasi (*Validation Strategy*) |
| :---: | :--- | :--- |
| **1** | Musisi pemula 10x lebih peduli pada vokal yang jelas di atas beat dan kick-bass yang terpisah daripada matematika fasa mikrofon drum. | Wawancara terarah (*user interview*) pada 5 produser pemula / musisi kamar menggunakan sampel lagu mereka. |
| **2** | Memuat 2 stem master stereo terpadu (Before vs After) memangkas penggunaan memori RAM browser $> 90\%$ dibanding memuat 48 track mentah. | Benchmarking Web Audio API memory profile pada Google Chrome DevTools (target: RAM tab $< 80\text{ MB}$). |
| **3** | Model langganan bulanan dengan kuota harian menghasilkan konversi 3x lebih tinggi dibanding sistem beli paket token koin kasual. | Uji minat pengguna (*landing page pricing CTA click-through rate*). |
| **4** | Model audio AI ringan (YAMNet / Spectrogram heuristic) mampu mengenali instrumen dengan akurasi $\ge 85\%$ meski nama file diacak (`Audio_01.wav`). | Uji dataset benchmark 30 multitrack tanpa label nama instrumen. |

---

## 4. MVP Scope (What's IN)

1. **Ingestion Cepat & Ramah Awam**:
   * Drag-and-drop file multitrack WAV/FLAC atau satu berkas ZIP.
   * Auto-extract dan kalkulasi durasi konsistensi.
2. **The 4-Pillar Bedroom Audio Engine**:
   * **Pillar 1: Vocal Mud & Room Rumble Stripper**: High-pass filter adaptif ($< 60\text{--}80\text{ Hz}$) dan pengurangan resonansi boxy ($300\text{--}500\text{ Hz}$) pada stem vokal.
   * **Pillar 2: Kick & Bass Unmasker**: Deteksi benturan frekuensi dominan di rentang $60\text{--}120\text{ Hz}$ dan penerapan EQ ducking cerdas.
   * **Pillar 3: Smart Headroom Normalizer**: Normalisasi gain otomatis seluruh stem ke $-6\text{ dBFS}$ peak agar master bus tidak distorsi (*gain staging*).
   * **Pillar 4: Low-End Mono Anchor**: Mengunci frekuensi $< 200\text{ Hz}$ ke mono sejati untuk bass dan kick, tetapi **melindungi lebar stereo instrumen synth/ambience/FX**.
3. **Penyajian Masalah Berbahasa Manusiawi (Human-Readable UI)**:
   * Menghilangkan jargon: Ganti *"Pearson Correlation -0.87 & Haas Delay 14ms"* menjadi *"Vokal terdengar tipis saat diputar di speaker HP. Sistem telah mempertebal vokal di tengah."*
   * Skor Kesehatan Mix sederhana (0–100) dengan indikator visual *Needs Work / Good / Streaming Ready*.
4. **Instant A/B Master Switcher**:
   * Pemutar audio web dengan 1 tombol geser besar: *"Sebelum (Mentah)"* $\leftrightarrow$ *"Sesudah (Polaris Clean)"*.
5. **Ekspor 1-Klik**:
   * Unduh seluruh stem hasil perbaikan dalam format ZIP beresolusi asli (24-bit 48kHz).
6. **Sistem Kuota Harian (Subscription Window)**:
   * Pembatasan kuota sesi per hari berbasis Redis counter.

---

## 5. Not Doing (and Why) — *The Strategic Kill List*

Membuat produk yang hebat berarti berani mengatakan "TIDAK" pada hal-hal yang tidak esensial:

* ❌ **TIDAK MENDUKUNG Format Sesi AAF / OMF / Pro Tools XML**:
  * *Alasan*: Musisi pemula bekerja di FL Studio, Ableton, atau GarageBand; mereka tidak mengekspor AAF. Format ini hanya relevan untuk pasca-produksi film enterprise.
* ❌ **TIDAK MEMBANGUN Rotasi Fasa Sub-Sample All-Pass Filter untuk Drum Kit**:
  * *Alasan*: Pemula menggunakan drum samples VST/Splice yang fasanya sudah selaras dari pabrik.
* ❌ **TIDAK MEMBANGUN Multi-Tenant Studio Workspaces & Forensic Watermarking**:
  * *Alasan*: Musisi kamar adalah pengguna solo; fitur kolaborasi studio enterprise menambah kerumitan UI tanpa nilai tambah bagi pemula.
* ❌ **TIDAK MENGGUNAKAN Pembelian Koin Arcade per Sesi**:
  * *Alasan*: Menimbulkan kecemasan biaya per klik (*metered anxiety*); digantikan dengan langganan bulanan + limit harian yang santai.
* ❌ **TIDAK MENJALANKAN Full 48-Track Audio Rendering di Browser (Wasm Client-Side)**:
  * *Alasan*: Limit memori heap browser (2 GB) akan membuat browser pengguna awam crash saat memproses banyak stem.
* ❌ **TIDAK MEMBUAT Halaman Khusus Admin (Dedicated Admin Page)**:
  * *Alasan*: Polaris Audio adalah alat utilitas swalayan (*self-service SaaS*). Seluruh proses pembayaran, pembersihan berkas, dan kuota berjalan otomatis tanpa perlu persetujuan manual admin.

---

## 6. Jembatan Eksekusi: Apa yang Harus Dikerjakan Selanjutnya?

Untuk menjaga kepatuhan akademis proyek **IPPL (Implementasi dan Pengujian Perangkat Lunak)** sekaligus mengadopsi arsitektur baru ini:

1. **Jangka Sangat Pendek (Testing Harness Sesuai Roadmap)**:
   * Selesaikan pengujian **Fase T2 (`backend/tests/02_wallet.test.js`)** untuk memvalidasi keamanan transaksi dompet, proteksi klaim ganda, dan *idempotency* webhook Midtrans.
2. **Penyelarasan Worker DSP & Mix Health (Fase T4 & T5)**:
   * Perbaiki guard pada `phase_analyzer.py` agar tidak crash saat menerima sinyal periodik sintetis (memperbaiki bug `AssertionError` yang ditemukan sebelumnya).
   * Tambahkan algoritma *Kick vs Bass Frequency Masking Detection* pada worker Python.
3. **Penyelarasan Frontend**:
   * Sederhanakan antarmuka Dashboard agar menampilkan perbandingan Before/After yang ramah pengguna awam, bukan sekadar tabel metrik angka fasa mentah.
