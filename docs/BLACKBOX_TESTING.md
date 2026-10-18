# Panduan & Matriks Blackbox Testing - Polaris Audio

Dokumen ini disusun sebagai panduan pengujian fungsional independen (*Blackbox Testing*) untuk seluruh fitur yang telah diimplementasikan di **Polaris Audio** hingga tahap saat ini (**Fase 1 s.d. Fase 4 Lengkap / UC-01 s.d. UC-13**).

---

## 1. Informasi Lingkungan Pengujian
* **URL Antarmuka Web (Frontend)**: [http://localhost:5173](http://localhost:5173)
* **URL Server Backend API**: [http://localhost:3000](http://localhost:3000)
* **Kredensial Akun Pengujian Default**:
  * Email: `engineer@polaris.audio`
  * Password: `Password123`
* **Layanan Infrastruktur (Docker Engine)**:
  * PostgreSQL: `localhost:5434` (Database: `polaris_audio`)
  * Redis: `localhost:6379`
  * MinIO S3 Console: [http://localhost:9001](http://localhost:9001) (`minioadmin` / `minioadmin`)
  * MinIO S3 API Endpoint: `http://localhost:9000` (Bucket: `polaris-audio-stems`)

---

## 2. Matriks Pengujian Fungsional (Test Matrix)

### Modul 1: Landing Page & Instant Guest Studio Access

| ID Test | Kategori / Fitur | Tindakan Pengguna / Masukan | Hasil yang Diharapkan (*Expected Result*) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-LP-01** | **Akses Publik & Desain Minimalist Modern** | Buka `http://localhost:5173/` di browser | • Halaman Landing Page termuat dengan tema *Minimalist Modern*.<br>• Tipografi judul Calistoga, animasi rotating ring, dan badge instrumen audio muncul normal.<br>• Section inverted deep slate (`#0F172A`) dan katalog harga Midtrans tampil rapi. | [x] PASSED |
| **TC-LP-02** | **Peluncuran Studio Instan (Tanpa Login)** | Pada Landing Page, klik tombol **"Buka Studio Instan (Tanpa Login)"** | • Sistem otomatis membuat sesi tamu sementara via `POST /api/v1/auth/guest-session`.<br>• Pengguna langsung dialihkan ke `/dashboard` tanpa formulir registrasi.<br>• Kuota awal 3 Token langsung tersedia di navbar. | [x] PASSED |
| **TC-LP-03** | **Navigasi ke Halaman Autentikasi** | Pada navbar Landing Page, klik tombol **"Masuk"** atau **"Daftar Akun"** | • Pengguna berhasil masuk ke halaman `/login` atau `/register` tanpa diblokir oleh redirect guard. | [x] PASSED |

---

### Modul 2: Autentikasi Pengguna & Akun Permanen (UC-01 s.d. UC-05)

| ID Test | Kategori / Fitur | Tindakan Pengguna / Masukan | Hasil yang Diharapkan (*Expected Result*) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-AUTH-01** | **UC-01: Registrasi Akun Baru** | 1. Buka `/register`<br>2. Nama: *"Budi Sound Engineer"*<br>3. Email baru: *"budi@studio.com"*<br>4. Password: *"Password123"*<br>5. Klik **"Daftar & Klaim 5 Token"** | • Akun berhasil dibuat di database.<br>• Otomatis masuk ke sistem & token JWT tersimpan di browser.<br>• Diarahkan ke studio dashboard dengan saldo awal **5 Token** (`WELCOME_GRANT`). | [x] PASSED |
| **TC-AUTH-02** | **UC-01: Validasi Kata Sandi Lemah** | 1. Buka `/register`<br>2. Masukkan password $< 8$ karakter (misal *"pass"*) atau tanpa kombinasi angka | • Formulir ditolak oleh validasi sistem (HTTP 400).<br>• Muncul pesan error informatif: *"Kata sandi minimal 8 karakter dan kombinasi huruf serta angka"*. | [x] PASSED |
| **TC-AUTH-03** | **UC-01: Proteksi Email Duplikat** | 1. Buka `/register`<br>2. Masukkan email yang sudah terdaftar (`engineer@polaris.audio`) | • Sistem menolak registrasi (HTTP 409 Conflict).<br>• Muncul pesan: *"Email sudah terdaftar. Silakan login"*. | [x] PASSED |
| **TC-AUTH-04** | **UC-02: Login Berhasil** | 1. Buka `/login`<br>2. Email: `engineer@polaris.audio`<br>3. Password: `Password123`<br>4. Centang *"Ingat Saya"* lalu klik Masuk | • Berhasil login.<br>• Token JWT tersimpan.<br>• Pengguna diarahkan ke `/dashboard` dan data engineer termuat. | [x] PASSED |
| **TC-AUTH-05** | **UC-02: Kredensial Salah** | 1. Buka `/login`<br>2. Masukkan password salah (misal *"PassSalah123"*) | • Sistem menolak login (HTTP 401 Unauthorized).<br>• Muncul notifikasi peringatan: *"Email atau kata sandi tidak valid"*. | [x] PASSED |
| **TC-AUTH-06** | **UC-04: Pembaruan Nama Profil** | 1. Di `/dashboard`, klik ikon profil.<br>2. Ubah nama profil menjadi nama baru.<br>3. Klik Simpan | • Request `PATCH /api/v1/auth/profile` berhasil (HTTP 200).<br>• Nama di navbar dan header studio langsung diperbarui secara reaktif. | [x] PASSED |
| **TC-AUTH-07** | **Logout Pengguna** | 1. Dalam kondisi login di `/dashboard`<br>2. Klik tombol **"Keluar"** di navbar | • Token JWT dan data akun dihapus dari LocalStorage browser.<br>• Diarahkan kembali ke `/login`. | [x] PASSED |

---

### Modul 3: Virtual Token Ledger & Klaim Harian (UC-06 & UC-09)

| ID Test | Kategori / Fitur | Tindakan Pengguna / Masukan | Hasil yang Diharapkan (*Expected Result*) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-WALLET-01** | **UC-06: Tampilan Saldo & Mutasi** | Buka `/dashboard` dalam keadaan login akun terdaftar | • Saldo kuota token pada navbar dan kartu dompet menampilkan nilai yang sinkron.<br>• Riwayat mutasi buku besar (*ledger*) menampilkan catatan penambahan token bertanda positif `+`. | [x] PASSED |
| **TC-WALLET-02** | **UC-09: Klaim Token Harian Pertama** | 1. Login akun yang belum mengklaim token hari ini.<br>2. Klik tombol **"🎁 Klaim 2 Token Harian"** | • Proses klaim berhasil dieksekusi.<br>• Saldo token bertambah tepat **+2** secara instan.<br>• Muncul notifikasi sukses dan tercatat mutasi baru di buku besar. | [x] PASSED |
| **TC-WALLET-03** | **UC-09: Proteksi Anti-Duplikasi Klaim** | 1. Setelah TC-WALLET-02 sukses.<br>2. Klik kembali tombol klaim harian di hari yang sama | • Sistem menolak permintaan (HTTP 400 Bad Request).<br>• Muncul peringatan: *"Anda sudah mengklaim jatah token gratis untuk hari ini"*. Saldo tidak bertambah ganda. | [x] PASSED |
| **TC-WALLET-04** | **Proteksi Guest terhadap Klaim Harian** | 1. Dalam mode Tamu (*Guest*) di `/dashboard`.<br>2. Klik tombol klaim harian | • Muncul dialog pengingat: *"Silakan daftar akun atau masuk untuk mengklaim bonus token harian"*, dan diarahkan ke `/register`. | [x] PASSED |

---

### Modul 4: Payment Gateway Midtrans Sandbox (UC-07 & UC-08)

| ID Test | Kategori / Fitur | Tindakan Pengguna / Masukan | Hasil yang Diharapkan (*Expected Result*) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-PAY-01** | **Katalog Paket Kuota Token** | Buka panel dompet di sebelah kanan `/dashboard` | • Tersedia 3 opsi paket resmi:<br>  - Paket Starter (10 Token - Rp 25.000)<br>  - Paket Studio Pro (25 Token - Rp 50.000)<br>  - Paket Enterprise (60 Token - Rp 100.000). | [x] PASSED |
| **TC-PAY-02** | **Inisialisasi Checkout Midtrans** | 1. Pilih Paket Studio Pro (25 Token).<br>2. Klik tombol **"Beli Paket via Midtrans"** | • Endpoint `/api/v1/payments/checkout` menghasilkan order baru.<br>• Muncul kartu tagihan dengan **Order ID unik** (misal `POLARIS-...`) dan status pesanan `PENDING`. | [x] PASSED |
| **TC-PAY-03** | **Simulasi Settlement Webhook Midtrans** | Pada kartu tagihan pesanan aktif, klik tombol **"Simulasi Konfirmasi Pembayaran"** | • Webhook backend (`/api/v1/payments/webhook`) menerima notifikasi `settlement`.<br>• Saldo token pengguna otomatis bertambah **+25 Token** secara instan.<br>• Status pesanan di database berubah menjadi `PAID`. | [x] PASSED |
| **TC-PAY-04** | **Anti-Tampering Nominal Webhook** | Mengirimkan payload webhook Midtrans dengan nilai `gross_amount` dimanipulasi berbeda dari harga order | • Backend menolak permintaan (HTTP 400 Bad Request) dengan pesan anomali tampering nominal.<br>• Saldo token tidak terisi secara ilegal. | [x] PASSED |
| **TC-PAY-05** | **Idempotency Webhook (Anti-Double Credit)** | Mengirimkan webhook kedua kalinya untuk `order_id` yang sama | • Backend mendeteksi pesanan sudah berstatus `PAID`.<br>• Token tidak ditambahkan dua kali (mencegah replay attack). | [x] PASSED |

---

### Modul 5: Ingestion Multitrack & Zero-Aligned Verification (UC-10 & UC-11)

| ID Test | Kategori / Fitur | Tindakan Pengguna / Masukan | Hasil yang Diharapkan (*Expected Result*) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-INGEST-01** | **UC-10: Upload Berkas Audio WAV/FLAC** | 1. Di `/dashboard`, klik tombol **"Unggah Stem Baru"**.<br>2. Masukkan judul sesi: *"Mixing Single Rock"*.<br>3. Pilih beberapa file audio WAV/FLAC.<br>4. Klik Mulai Unggah | • Seluruh file audio berhasil diunggah ke MinIO S3 bucket `polaris-audio-stems`.<br>• Metadata audio (sample rate, bit depth, durasi) diekstrak otomatis.<br>• Kartu sesi baru muncul di dashboard studio. | [x] PASSED |
| **TC-INGEST-02** | **UC-10: Upload Arsip ZIP Multitrack** | 1. Klik **"Unggah Stem Baru"**.<br>2. Masukkan berkas arsip `.zip` yang berisi kumpulan stem audio DAW | • Server otomatis mengekstrak berkas ZIP di memory buffer.<br>• Seluruh stem audio di dalamnya tersimpan sebagai track individual.<br>• Sesi berhasil dibuat tanpa perlu ekstrak manual. | [x] PASSED |
| **TC-INGEST-03** | **UC-11: Verifikasi Integritas Sinkron (Zero-Aligned)** | Pada kartu sesi dengan track yang durasinya selaras (selisih $\le 0.1\text{ detik}$), klik tombol **"🔍 Verifikasi (UC-11)"** | • Sistem memindai durasi dan sample rate seluruh track.<br>• Muncul kartu status hijau: **"Integritas Sesi: PASSED"**.<br>• Pesan konfirmasi: *"Seluruh track audio selaras sempurna (zero-aligned) dan siap di-mix"*. | [x] PASSED |
| **TC-INGEST-04** | **UC-11: Deteksi Drift Durasi Tidak Sinkron** | Jalankan verifikasi pada sesi yang memiliki track dengan panjang durasi berbeda jauh | • Sistem mendeteksi selisih durasi ($> 0.1\text{ detik}$).<br>• Muncul peringatan oranye: **"Integritas Sesi: WARNING"** beserta besaran detik offset/drift. | [x] PASSED |

---

### Modul 6: AI Instrument Classification & Multi-Mic Pairing (UC-12)

| ID Test | Kategori / Fitur | Tindakan Pengguna / Masukan | Hasil yang Diharapkan (*Expected Result*) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-AI-01** | **Pemicuan Klasifikasi Audio CNN** | Pada kartu sesi, klik tombol **"🤖 Klasifikasi AI & Pairing (UC-12)"** | • Backend memicu worker Python AI via flag `--classify-stdin`.<br>• Mel-Spectrogram (128 mel bins) diekstraksi dari setiap file audio di MinIO.<br>• Panel klasifikasi terbuka dan menampilkan hasil prediksi instrumen tiap track. | [x] PASSED |
| **TC-AI-02** | **Akurasi Label & Meter Keyakinan AI** | Periksa chip label instrumen dan persentase skor keyakinan pada tiap baris track | • Setiap stem memiliki label spesifik (misal: *Drums: Kick*, *Drums: Snare*, *Bass*, dll.).<br>• Stem dengan keyakinan tinggi ($\ge 80\%$) memiliki badge stabil.<br>• Stem ambigu ($< 80\%$) memiliki badge kuning: *"Perlu Peninjauan"*. | [x] PASSED |
| **TC-AI-03** | **Koreksi Manual Label Instrumen (FR-2.3)** | 1. Pada salah satu track, klik tautan **"Ubah"** di sebelah label.<br>2. Pilih kategori instrumen baru dari dropdown (misal ubah dari *Other* ke *Acoustic Guitar*).<br>3. Klik **"Simpan"** | • Label instrumen pada kartu langsung terbarui.<br>• Request `PATCH /tracks/:trackId/label` berhasil disimpan ke database PostgreSQL. | [x] PASSED |
| **TC-AI-04** | **Deteksi Otomatis Pasangan Mikrofon (FR-2.2)** | Tinjau hasil pairing pada sesi yang memiliki mikrofon ganda (misal Snare Top & Snare Btm, atau Kick In & Kick Sub) | • Sistem otomatis mendeteksi dan menampilkan badge tautan: *"🔗 Dipasangkan dengan: [Nama Track Lain]"* dengan tipe yang tepat (`DRUM_TOP_BOTTOM` / `MIC_PAIR` / `BASS_DI_MIC` / `STEREO_SPLIT`). | [x] PASSED |
| **TC-AI-05** | **Pelepasan Pasangan Track (Unpair)** | Pada track yang berpasangan, klik tombol silang **✕** di samping badge pasangan | • Request `DELETE /pairs/:pairId` dikirim ke backend.<br>• Garis tautan pasangan dilepas dan kedua track kembali berstatus *"Trek Independen"*. | [x] PASSED |
| **TC-AI-06** | **Pembuatan Pasangan Manual** | 1. Pada formulir *"Hubungkan Pasangan Mikrofon Baru Secara Manual"*, pilih Trek A dan Trek B.<br>2. Tentukan Tipe Pasangan (misal `STEREO_SPLIT`).<br>3. Klik **"🔗 Hubungkan"** | • Request `POST /pairs` berhasil dieksekusi.<br>• Kedua track terhubung secara visual dengan badge pasangan baru. | [x] PASSED |
| **TC-AI-07** | **Finalisasi & Penguncian Konfigurasi** | Klik tombol **"Konfirmasi & Lanjut ke Diagnostik Fasa (UC-13)"** | • Request `POST /finalize-classification` berhasil.<br>• Muncul alert konfirmasi bahwa konfigurasi trek dan pasangan telah terkunci dan sesi siap masuk ke tahap diagnostik DSP. | [x] PASSED |

---

### Modul 7: Core DSP Diagnostic Engine & Mix Health Score (UC-13)

| ID Test | Kategori / Fitur | Tindakan Pengguna / Masukan | Hasil yang Diharapkan (*Expected Result*) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-DSP-01** | **Pemicuan Diagnostik Fasa DSP & Audit Sesi** | Pada kartu sesi yang telah diklasifikasikan, klik tombol **"🔬 Diagnostik DSP (UC-13)"** | • Backend memanggil worker Python DSP via flag `--diagnose-stdin`.<br>• Audio diunduh dari MinIO S3, dianalisis melalui algoritma korelasi fasa, polyphase true-peak, DC offset, dan sub-rumble.<br>• Panel audit sesi terbuka dan menampilkan ringkasan kesehatan lengkap. | [x] PASSED |
| **TC-DSP-02** | **Radial Mix Health Score Gauge (FR-4.1, FR-4.2)** | Amati indikator melingkar Mix Health Score pada panel atas | • Meter SVG radial menampilkan skor 0–100 secara akurat.<br>• Warna berubah dinamis: Hijau Emerald ($\ge 90$ / *EXCELLENT*), Kuning Amber ($65\text{--}89$ / *WARNING*), atau Merah Rose ($< 65$ / *CRITICAL*).<br>• Rincian jumlah stem bersih, warning, dan kritis ditampilkan transparan. | [x] PASSED |
| **TC-DSP-03** | **Visual Phase Correlation Meter per Track (FR-3.1)** | Periksa kartu setiap stem pada daftar track | • Menampilkan bar korelasi fasa interaktif dari rentang $-1.0$ (Out-of-phase / merah) hingga $+1.0$ (In-phase / hijau).<br>• Menampilkan status teks: *In-Phase*, *Stereo Wide*, atau *Out-of-Phase / Reversed*. | [x] PASSED |
| **TC-DSP-04** | **Deteksi Anomali Akustik Lanjutan (FR-3.2 s.d. FR-3.13)** | Uji sesi dengan stem audio yang mengandung anomali akustik | • **Inversi Fasa 180°**: Terdeteksi badge merah *"Polaritas Terbalik (180°)"* pada pasangan mikrofon.<br>• **Fake Stereo / Haas Effect**: Terdeteksi badge *"Haas Pseudo-Stereo (X ms)"* bila ada delay artifisial 1–35ms.<br>• **True-Peak Clipping**: Terdeteksi badge *"Digital Clipping (X.X dBFS)"* bila melebihi $-0.1\text{ dBFS}$.<br>• **DC Offset**: Terdeteksi badge *"DC Offset (X.X%)"* bila titik nol bergeser $\ge 0.5\%$.<br>• **Sub-Rumble**: Terdeteksi badge *"Sub-Rumble (<35Hz)"* pada instrumen vokal/gitar (dibebaskan pada Bass/Kick). | [x] PASSED |
| **TC-DSP-05** | **Rekomendasi Teknis Audio Engineer Bahasa Indonesia (FR-4.3)** | Buka accordion rekomendasi pada stem yang bermasalah | • Rekomendasi solusi teknis disajikan dalam Bahasa Indonesia yang jelas dan dapat langsung dieksekusi (misal: *"Terapkan Invert Polarity (Phase Flip Ø)..."*, *"Turunkan clip gain minimal 1.5 dBFS..."*, *"Gunakan HPF di rentang 35–80 Hz..."*). | [x] PASSED |
| **TC-DSP-06** | **Kalkulator Estimasi Kuota Token Perbaikan (FR-4.1)** | Periksa ringkasan token perbaikan pada panel Health Score Gauge | • Menghitung estimasi token secara otomatis: 1 token untuk sesi standar ($\le 3$ track bermasalah), atau 2 token untuk sesi dengan kerusakan fasa masif ($> 3$ track bermasalah). | [x] PASSED |
| **TC-DSP-07** | **Persistensi Database PostgreSQL `diagnostic_results`** | Periksa persistensi data melalui API `GET /api/v1/sessions/:id/diagnostics` | • Seluruh metrik numerik (`phaseCorrelation`, `truePeakDbfs`, `crestFactor`, dll.) dan JSON rekomendasi tersimpan permanen di database PostgreSQL.<br>• Pengguna dapat me-refresh browser tanpa kehilangan hasil diagnostik. | [x] PASSED |

---

### Modul 8: Automated & Granular DSP Audio Repair Engine (UC-14 & UC-15)

| ID Test | Kategori / Fitur | Tindakan Pengguna / Masukan | Hasil yang Diharapkan (*Expected Result*) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-REP-01** | **UC-14: Eksekusi 1-Click Auto-Fix** | Pada kartu sesi beranomali fasa, klik tombol **"Terapkan Perbaikan (X Token)"** | • Sistem memvalidasi saldo token, mendebit token secara atomik, dan menjalankan worker DSP.<br>• Status sesi berubah menjadi `REPAIRED` dan Mix Health Score melonjak optimal ($\ge 95$).<br>• Setiap track yang diperbaiki berstatus *Clean* dan memiliki storage key `FIXED_[TrackName].wav` di MinIO S3. | [x] PASSED |
| **TC-REP-02** | **Proteksi Saldo Kurang (FR-7.2)** | Jalankan perbaikan pada akun dengan saldo token 0 atau tidak mencukupi | • Sistem menolak permintaan (HTTP 402 Payment Required).<br>• Muncul pesan: *"Saldo token tidak mencukupi untuk melakukan perbaikan audio"*. Audio tidak diproses. | [x] PASSED |
| **TC-REP-03** | **Pencatatan Buku Besar DEDUCTION (FR-7.6)** | Periksa riwayat transaksi setelah perbaikan berhasil | • Tercatat mutasi `DEDUCTION` bertanda negatif `-X Token` dengan deskripsi sesi dan ID referensi yang akurat. | [x] PASSED |
| **TC-REP-04** | **Auto-Refund Instan bila Gagal (NFR-09)** | Simulasikan gangguan rendering worker pada audio perbaikan | • Sistem secara otomatis membatalkan pemotongan dan mengembalikan saldo token pengguna dalam waktu $< 5$ detik dengan mutasi `REFUND`. | [x] PASSED |
| **TC-REP-05** | **UC-15: Kustomisasi Granular Repair (FR-5.8)** | 1. Klik **"Kustomisasi Perbaikan"**.<br>2. Nonaktifkan modul tertentu (misal matikan Sub-Rumble cut, nyalakan Polarity Flip).<br>3. Klik **"Terapkan Perbaikan Kustom"** | • Request `POST /sessions/:id/repair-custom` berhasil dieksekusi.<br>• Hanya modul yang dicentang yang diterapkan ke audio stem.<br>• `RepairConfig` tersimpan di database dengan status `isApplied = true`. | [x] PASSED |
| **TC-REP-06** | **Integritas Waktu & Preservasi Resolusi (NFR-03, NFR-04)** | Periksa durasi dan sample rate berkas `FIXED_...` di MinIO S3 | • Audio hasil perbaikan berformat 24-bit PCM WAV lossless.<br>• Durasi dan sinkronisasi zero-alignment antar-track tidak bergeser sama sekali. | [x] PASSED |

---

### Modul 9: Pemutar Audisi Multitrack A/B & Analisis Fase Real-time (UC-16)

| ID Test | Kategori / Fitur | Tindakan Pengguna / Masukan | Hasil yang Diharapkan (*Expected Result*) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-AUD-01** | **Presigned Audio Sources API (UC-16)** | Panggil API `GET /api/v1/sessions/:id/audio-sources` dengan bearer token pemilik sesi | • Sistem mengembalikan daftar stem lengkap dengan `rawAudioUrl` dan `repairedAudioUrl` bertanda presigned S3 URL.<br>• Menolak session ID fiktif (404) dan user bukan pemilik sesi (403). | [x] PASSED |
| **TC-AUD-02** | **Sample-Accurate Multitrack Playback (FR-6.1)** | Buka modal *"Dengar Perbandingan A/B"* dan tekan tombol Play / Spasi | • Seluruh stem audio dimuat ke Web Audio API dan diputar secara sinkron (*sample-accurate*).<br>• Timeline scrubber bergerak mulus dan durasi terhitung dari trek terpanjang. | [x] PASSED |
| **TC-AUD-03** | **Instant A/B Switching (NFR-01, FR-6.2)** | Beralih antara tombol **"A: Audio Asli"** dan **"B: Hasil Perbaikan"** saat audio sedang berputar | • Audio langsung beralih secara instan dengan micro-crossfade gain 5 ms.<br>• Latensi pergantian $< 50\text{ ms}$ tanpa jeda buffering dan tanpa letupan (*click/pop*). | [x] PASSED |
| **TC-AUD-04** | **Pemeriksaan Mono Real-Time (FR-6.4)** | Klik tombol **"MONO CHECK (L+R)"** saat audisi berlangsung | • Sinyal kiri dan kanan dijumlahkan ($L+R$) secara real-time ke kedua kanal.<br>• Pengguna dapat langsung mendengar perbedaan sebelum vs sesudah perbaikan fasa tanpa pembatalan frekuensi. | [x] PASSED |
| **TC-AUD-05** | **Goniometer Lissajous Phase Scope (FR-6.3)** | Amati pola Lissajous pada kanvas visualizer saat memutar Mode A vs Mode B | • Menampilkan pola gelombang terotasi $45^\circ$ ($X=(L-R)/\sqrt{2}, Y=(L+R)/\sqrt{2}$) dengan efek trailing phosphor CRT.<br>• Bar korelasi fasa $[-1.0 \text{ s.d. } +1.0]$ diperbarui secara real-time. | [x] PASSED |
| **TC-AUD-06** | **Multitrack Channel Strip Controls (FR-6.1)** | Atur slider Volume, Panning (-100% s.d. +100%), serta tombol Mute (M) dan Solo (S) per stem | • Volume fader mengatur gain trek individual secara responsif.<br>• Panning mengarahkan sinyal ke stereo field L/R.<br>• Mengaktifkan Solo (S) membungkam seluruh track lain secara instan; Mute (M) mematikan stem terkait. | [x] PASSED |

---

## 3. Skenario Pengujian Alur Penuh (End-to-End Walkthrough) di Browser

Anda dapat memverifikasi seluruh sistem dari hulu ke hilir secara berurutan dengan alur berikut:

1. **Uji Akses Tamu**: Buka [http://localhost:5173/](http://localhost:5173/) $\rightarrow$ Klik *"Buka Studio Instan (Tanpa Login)"* $\rightarrow$ Pastikan masuk ke Dashboard dengan kuota 3 token (*TC-LP-02*).
2. **Uji Unggah Stem**: Klik *"Unggah Stem Baru"* $\rightarrow$ Masukkan berkas audio multitrack Anda $\rightarrow$ Pastikan stem audio muncul di daftar sesi (*TC-INGEST-01*).
3. **Uji Verifikasi Zero-Aligned**: Klik tombol *"🔍 Verifikasi (UC-11)"* $\rightarrow$ Periksa kartu hasil verifikasi (*TC-INGEST-03*).
4. **Uji Audio CNN & Pairing**: Klik tombol *"🤖 Klasifikasi AI & Pairing (UC-12)"* $\rightarrow$ Tunggu beberapa detik $\rightarrow$ Amati label instrumen yang terdeteksi (*Drums, Bass, Vocal*) dan pasangan mikrofon yang terhubung (*TC-AI-01 s.d. TC-AI-04*).
5. **Uji Koreksi Label**: Coba ganti label salah satu track melalui tombol *"Ubah"* $\rightarrow$ Pastikan label tersimpan (*TC-AI-03*).
6. **Uji Finalisasi**: Klik tombol *"Konfirmasi & Lanjut ke Diagnostik Fasa (UC-13)"* (*TC-AI-07*).
7. **Uji Diagnostik DSP & Health Score**: Klik tombol *"🔬 Diagnostik DSP (UC-13)"* $\rightarrow$ Amati perputaran radial meter Health Score, deteksi fasa/clipping, dan rekomendasi berbahasa Indonesia (*TC-DSP-01 s.d. TC-DSP-06*).
8. **Uji Eksekusi 1-Click Auto-Fix**: Klik tombol *"Terapkan Perbaikan (X Token)"* $\rightarrow$ Amati pemotongan token saldo, status sesi berubah menjadi `REPAIRED`, dan seluruh track tertandai centang hijau (*TC-REP-01 s.d. TC-REP-03*).
9. **Uji Kustomisasi Granular Fixes**: Klik tombol *"Kustomisasi Perbaikan"* $\rightarrow$ Pilih/nonaktifkan modul perbaikan tertentu per track $\rightarrow$ Simpan (*TC-REP-05*).
10. **Uji Audisi Komparasi A/B Multitrack**: Klik tombol *"Dengar Perbandingan A/B"* $\rightarrow$ Tekan Play (Spasi) $\rightarrow$ Tekan A dan B bergantian untuk merasakan transisi halus $< 50\text{ ms}$ $\rightarrow$ Aktifkan *Mono Check* dan amati visualizer *Goniometer Lissajous* serta fader mixer track (*TC-AUD-01 s.d. TC-AUD-06*).
11. **Uji Registrasi Akun Permanen**: Klik *"Daftar Akun"* di navbar $\rightarrow$ Masukkan email baru $\rightarrow$ Periksa bonus 5 token dan saldo dompet (*TC-AUTH-01*).
12. **Uji Top-up Midtrans**: Pilih paket token di panel kanan $\rightarrow$ Klik *"Beli Paket via Midtrans"* $\rightarrow$ Klik *"Simulasi Konfirmasi Pembayaran"* $\rightarrow$ Pastikan saldo bertambah secara real-time (*TC-PAY-02, TC-PAY-03*).

---

## 4. Eksekusi Otomatis Pengujian (Automated Test Suites - 112 Tests)

Selain pengujian manual via browser di atas, seluruh fungsionalitas didukung oleh **112 Automated Unit & Integration Tests** yang dapat dieksekusi melalui terminal:

### A. Menjalankan Backend Test Suite (68 Tests)
```bash
cd backend
npm test
```
*Menguji*: Auth, Proteksi JWT, Guest Session, Dompet Token, Midtrans Webhook Idempotency, Multitrack S3 Ingestion, Zero-Aligned Sync, Integrasi API E2E UC-12 & UC-13, Automated & Granular Audio Repair Engine (UC-14 & UC-15), serta Presigned Multitrack Audition Audio Sources (UC-16).

### B. Menjalankan Python Worker Test Suite (44 Tests)
```bash
python3 -m pytest worker/tests -v
```
*Menguji*:
1. `worker/tests/test_ai_engine.py` (19 tests): Mel-Spectrogram 128 bins, Taksonomi 12 instrumen, Ambang batas confidence $< 0.80$, dan Deteksi Pasangan Multi-Mic.
2. `worker/tests/test_dsp_engine.py` (15 tests): Korelasi Pearson, Mono Sum Loss dB, Deteksi Fake Stereo Haas, 4x True-Peak Inter-Sample Peak, Deteksi DC Offset, Filter Sub-Rumble, dan Kalkulator Mix Health Score.
3. `worker/tests/test_repair_engine.py` (10 tests): Null Test Inversi Polaritas $180^\circ$, Penyelarasan Micro-Delay Pasangan Mikrofon, Restorasi Fake Stereo Haas ke True Mono, Eliminasi DC Offset, Filter Sub-Rumble $<35\text{ Hz}$, dan Headroom Gain Staging $-3.0\text{ dBFS}$.

---
*Dokumen ini diverifikasi dan diperbarui secara otomatis pada 18 Oktober 2026.*
