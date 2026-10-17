# Panduan & Matriks Blackbox Testing - Polaris Audio

Dokumen ini disusun sebagai panduan pengujian fungsional independen (*Blackbox Testing*) untuk seluruh fitur yang telah diimplementasikan di **Polaris Audio** hingga tahap saat ini (**Fase 1 s.d. Fase 4 Milestone A / UC-12**).

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
| :--- | :--- | :--- | :--- | :---: |
| **TC-LP-01** | **Akses Publik & Desain Minimalist Modern** | Buka `http://localhost:5173/` di browser | • Halaman Landing Page termuat dengan tema *Minimalist Modern*.<br>• Tipografi judul Calistoga, animasi rotating ring, dan badge instrumen audio muncul normal.<br>• Section inverted deep slate (`#0F172A`) dan katalog harga Midtrans tampil rapi. | [ ] |
| **TC-LP-02** | **Peluncuran Studio Instan (Tanpa Login)** | Pada Landing Page, klik tombol **"Buka Studio Instan (Tanpa Login)"** | • Sistem otomatis membuat sesi tamu sementara via `POST /api/v1/auth/guest-session`.<br>• Pengguna langsung dialihkan ke `/dashboard` tanpa formulir registrasi.<br>• Kuota awal 3 Token langsung tersedia di navbar. | [ ] |
| **TC-LP-03** | **Navigasi ke Halaman Autentikasi** | Pada navbar Landing Page, klik tombol **"Masuk"** atau **"Daftar Akun"** | • Pengguna berhasil masuk ke halaman `/login` atau `/register` tanpa diblokir oleh redirect guard. | [ ] |

---

### Modul 2: Autentikasi Pengguna & Akun Permanen (UC-01 s.d. UC-05)

| ID Test | Kategori / Fitur | Tindakan Pengguna / Masukan | Hasil yang Diharapkan (*Expected Result*) | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-AUTH-01** | **UC-01: Registrasi Akun Baru** | 1. Buka `/register`<br>2. Nama: *"Budi Sound Engineer"*<br>3. Email baru: *"budi@studio.com"*<br>4. Password: *"Password123"*<br>5. Klik **"Daftar & Klaim 5 Token"** | • Akun berhasil dibuat di database.<br>• Otomatis masuk ke sistem & token JWT tersimpan di browser.<br>• Diarahkan ke studio dashboard dengan saldo awal **5 Token** (`WELCOME_GRANT`). | [ ] |
| **TC-AUTH-02** | **UC-01: Validasi Kata Sandi Lemah** | 1. Buka `/register`<br>2. Masukkan password $< 8$ karakter (misal *"pass"*) atau hanya angka | • Formulir ditolak oleh validasi sistem.<br>• Muncul pesan error informatif: *"Kata sandi minimal 8 karakter dan kombinasi huruf serta angka"*. | [ ] |
| **TC-AUTH-03** | **UC-01: Proteksi Email Duplikat** | 1. Buka `/register`<br>2. Masukkan email yang sudah terdaftar (`engineer@polaris.audio`) | • Sistem menolak registrasi (HTTP 409 Conflict).<br>• Muncul pesan: *"Email sudah terdaftar. Silakan login"*. | [ ] |
| **TC-AUTH-04** | **UC-02: Login Berhasil** | 1. Buka `/login`<br>2. Email: `engineer@polaris.audio`<br>3. Password: `Password123`<br>4. Centang *"Ingat Saya"* lalu klik Masuk | • Berhasil login.<br>• Token JWT tersimpan.<br>• Pengguna diarahkan ke `/dashboard` dan data engineer termuat. | [ ] |
| **TC-AUTH-05** | **UC-02: Kredensial Salah** | 1. Buka `/login`<br>2. Masukkan password salah (misal *"PassSalah123"*) | • Sistem menolak login (HTTP 401 Unauthorized).<br>• Muncul notifikasi peringatan: *"Email atau kata sandi tidak valid"*. | [ ] |
| **TC-AUTH-06** | **Logout Pengguna** | 1. Dalam kondisi login di `/dashboard`<br>2. Klik tombol **"Keluar"** di navbar | • Token JWT dan data akun dihapus dari LocalStorage browser.<br>• Diarahkan kembali ke `/login`. | [ ] |

---

### Modul 3: Virtual Token Ledger & Klaim Harian (UC-06 & UC-09)

| ID Test | Kategori / Fitur | Tindakan Pengguna / Masukan | Hasil yang Diharapkan (*Expected Result*) | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-WALLET-01** | **UC-06: Tampilan Saldo & Mutasi** | Buka `/dashboard` dalam keadaan login akun terdaftar | • Saldo kuota token pada navbar dan kartu dompet menampilkan nilai yang sinkron.<br>• Riwayat mutasi buku besar (*ledger*) menampilkan catatan penambahan token bertanda positif `+`. | [ ] |
| **TC-WALLET-02** | **UC-09: Klaim Token Harian Pertama** | 1. Login akun yang belum mengklaim token hari ini.<br>2. Klik tombol **"🎁 Klaim 2 Token Harian"** | • Proses klaim berhasil dieksekusi.<br>• Saldo token bertambah tepat **+2** secara instan.<br>• Muncul notifikasi sukses dan tercatat mutasi baru di buku besar. | [ ] |
| **TC-WALLET-03** | **UC-09: Proteksi Anti-Duplikasi Klaim** | 1. Setelah TC-WALLET-02 sukses.<br>2. Klik kembali tombol klaim harian di hari yang sama | • Sistem menolak permintaan (HTTP 400 Bad Request).<br>• Muncul peringatan: *"Anda sudah mengklaim jatah token gratis untuk hari ini"*. Saldo tidak bertambah ganda. | [ ] |
| **TC-WALLET-04** | **Proteksi Guest terhadap Klaim Harian** | 1. Dalam mode Tamu (*Guest*) di `/dashboard`.<br>2. Klik tombol klaim harian | • Muncul dialog pengingat: *"Silakan daftar akun atau masuk untuk mengklaim bonus token harian"*, dan diarahkan ke `/register`. | [ ] |

---

### Modul 4: Payment Gateway Midtrans Sandbox (UC-07)

| ID Test | Kategori / Fitur | Tindakan Pengguna / Masukan | Hasil yang Diharapkan (*Expected Result*) | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-PAY-01** | **Katalog Paket Kuota Token** | Buka panel dompet di sebelah kanan `/dashboard` | • Tersedia 3 opsi paket resmi:<br>  - Paket Starter (10 Token - Rp 25.000)<br>  - Paket Studio Pro (25 Token - Rp 50.000)<br>  - Paket Enterprise (60 Token - Rp 100.000). | [ ] |
| **TC-PAY-02** | **Inisialisasi Checkout Midtrans** | 1. Pilih Paket Studio Pro (25 Token).<br>2. Klik tombol **"Beli Paket via Midtrans"** | • Endpoint `/api/v1/payments/checkout` menghasilkan order baru.<br>• Muncul kartu tagihan dengan **Order ID unik** (misal `POLARIS-...`) dan status pesanan `PENDING`. | [ ] |
| **TC-PAY-03** | **Simulasi Settlement Webhook Midtrans** | Pada kartu tagihan pesanan aktif, klik tombol **"Simulasi Konfirmasi Pembayaran"** | • Webhook backend (`/api/v1/payments/webhook`) menerima notifikasi `settlement`.<br>• Saldo token pengguna otomatis bertambah **+25 Token** secara instan.<br>• Status pesanan di database berubah menjadi `PAID`. | [ ] |
| **TC-PAY-04** | **Idempotency Webhook (Anti-Double Credit)** | Mengirimkan webhook kedua kalinya untuk `order_id` yang sama | • Backend mendeteksi pesanan sudah berstatus `PAID`.<br>• Token tidak ditambahkan dua kali (mencegah manipulasi saldo). | [ ] |

---

### Modul 5: Ingestion Multitrack & Zero-Aligned Verification (UC-10 & UC-11)

| ID Test | Kategori / Fitur | Tindakan Pengguna / Masukan | Hasil yang Diharapkan (*Expected Result*) | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-INGEST-01** | **UC-10: Upload Berkas Audio WAV/FLAC** | 1. Di `/dashboard`, klik tombol **"Unggah Stem Baru"**.<br>2. Masukkan judul sesi: *"Mixing Single Rock"**.<br>3. Pilih/tarik beberapa file audio WAV/FLAC.<br>4. Klik Mulai Unggah | • Seluruh file audio berhasil diunggah ke MinIO S3 bucket `polaris-audio-stems`.<br>• Metadata audio (sample rate, bit depth, durasi) diekstrak otomatis.<br>• Kartu sesi baru muncul di dashboard studio. | [ ] |
| **TC-INGEST-02** | **UC-10: Upload Arsip ZIP Multitrack** | 1. Klik **"Unggah Stem Baru"**.<br>2. Masukkan berkas arsip `.zip` yang berisi kumpulan stem audio DAW | • Server otomatis mengekstrak berkas ZIP di memory buffer.<br>• Seluruh stem audio di dalamnya tersimpan sebagai track individual.<br>• Sesi berhasil dibuat tanpa perlu ekstrak manual. | [ ] |
| **TC-INGEST-03** | **UC-11: Verifikasi Integritas Sinkron (Zero-Aligned)** | Pada kartu sesi dengan track yang durasinya selaras (selisih $\le 0.1\text{ detik}$), klik tombol **"🔍 Verifikasi (UC-11)"** | • Sistem memindai durasi dan sample rate seluruh track.<br>• Muncul kartu status hijau: **"Integritas Sesi: PASSED"**.<br>• Pesan konfirmasi: *"Seluruh track audio selaras sempurna (zero-aligned) dan siap di-mix"*. | [ ] |
| **TC-INGEST-04** | **UC-11: Deteksi Drift Durasi Tidak Sinkron** | Jalankan verifikasi pada sesi yang memiliki track dengan panjang durasi berbeda jauh | • Sistem mendeteksi selisih durasi ($> 0.1\text{ detik}$).<br>• Muncul peringatan oranye: **"Integritas Sesi: WARNING"** beserta besaran detik offset/drift. | [ ] |

---

### Modul 6: AI Instrument Classification & Multi-Mic Pairing (UC-12)

| ID Test | Kategori / Fitur | Tindakan Pengguna / Masukan | Hasil yang Diharapkan (*Expected Result*) | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-AI-01** | **Pemicuan Klasifikasi Audio CNN** | Pada kartu sesi, klik tombol **"🤖 Klasifikasi AI & Pairing (UC-12)"** | • Backend memicu worker Python AI.<br>• Mel-Spectrogram (128 mel bins) diekstraksi dari setiap file audio di MinIO.<br>• Panel klasifikasi terbuka dan menampilkan hasil prediksi instrumen tiap track. | [ ] |
| **TC-AI-02** | **Akurasi Label & Meter Keyakinan AI** | Periksa chip label instrumen dan persentase skor keyakinan pada tiap baris track | • Setiap stem memiliki label spesifik (misal: *Drums: Kick*, *Drums: Snare*, *Bass*, dll.).<br>• Stem dengan keyakinan tinggi ($\ge 80\%$) memiliki meter berwarna hijau.<br>• Stem ambigu ($< 80\%$) memiliki badge kuning: *"Perlu Peninjauan"*. | [ ] |
| **TC-AI-03** | **Koreksi Manual Label Instrumen (FR-2.3)** | 1. Pada salah satu track, klik tautan **"Ubah"** di sebelah label.<br>2. Pilih kategori instrumen baru dari dropdown (misal ubah dari *Other* ke *Acoustic Guitar*).<br>3. Klik **"Simpan"** | • Label instrumen pada kartu langsung terbarui.<br>• Request `PATCH /tracks/:trackId/label` berhasil disimpan ke database PostgreSQL. | [ ] |
| **TC-AI-04** | **Deteksi Otomatis Pasangan Mikrofon (FR-2.2)** | Tinjau hasil pairing pada sesi yang memiliki mikrofon ganda (misal Snare Top & Snare Btm, atau Kick In & Kick Sub) | • Sistem otomatis mendeteksi dan menampilkan badge tautan: *"🔗 Dipasangkan dengan: [Nama Track Lain]"* dengan tipe yang tepat (`DRUM_TOP_BOTTOM` / `MIC_PAIR` / `BASS_DI_MIC` / `STEREO_SPLIT`). | [ ] |
| **TC-AI-05** | **Pelepasan Pasangan Track (Unpair)** | Pada track yang berpasangan, klik tombol silang **✕** di samping badge pasangan | • Request `DELETE /pairs/:pairId` dikirim ke backend.<br>• Garis tautan pasangan dilepas dan kedua track kembali berstatus *"Trek Independen"*. | [ ] |
| **TC-AI-06** | **Pembuatan Pasangan Manual** | 1. Pada formulir *"Hubungkan Pasangan Mikrofon Baru Secara Manual"*, pilih Trek A dan Trek B.<br>2. Tentukan Tipe Pasangan (misal `STEREO_SPLIT`).<br>3. Klik **"🔗 Hubungkan"** | • Request `POST /pairs` berhasil dieksekusi.<br>• Kedua track terhubung secara visual dengan badge pasangan baru. | [ ] |
| **TC-AI-07** | **Finalisasi & Penguncian Konfigurasi** | Klik tombol **"Konfirmasi & Lanjut ke Diagnostik Fasa (UC-13)"** | • Request `POST /finalize-classification` berhasil.<br>• Muncul alert konfirmasi bahwa konfigurasi trek dan pasangan telah terkunci dan sesi siap masuk ke tahap diagnostik DSP. | [ ] |

---

## 3. Skenario Pengujian Alur Penuh (End-to-End Walkthrough) di Browser

Anda dapat memverifikasi seluruh sistem secara berurutan dengan alur berikut:

1. **Uji Akses Tamu**: Buka [http://localhost:5173/](http://localhost:5173/) $\rightarrow$ Klik *"Buka Studio Instan (Tanpa Login)"* $\rightarrow$ Pastikan masuk ke Dashboard dengan kuota 3 token (*TC-LP-02*).
2. **Uji Unggah Stem**: Klik *"Unggah Stem Baru"* $\rightarrow$ Masukkan berkas audio multitrack Anda $\rightarrow$ Pastikan stem audio muncul di daftar sesi (*TC-INGEST-01*).
3. **Uji Verifikasi Zero-Aligned**: Klik tombol *"🔍 Verifikasi (UC-11)"* $\rightarrow$ Periksa kartu hasil verifikasi (*TC-INGEST-03*).
4. **Uji Audio CNN & Pairing**: Klik tombol *"🤖 Klasifikasi AI & Pairing (UC-12)"* $\rightarrow$ Tunggu beberapa detik $\rightarrow$ Amati label instrumen yang terdeteksi (*Drums, Bass, Vocal*) dan pasangan mikrofon yang terhubung (*TC-AI-01 s.d. TC-AI-04*).
5. **Uji Koreksi Label**: Coba ganti label salah satu track melalui tombol *"Ubah"* $\rightarrow$ Pastikan label tersimpan (*TC-AI-03*).
6. **Uji Finalisasi**: Klik tombol *"Konfirmasi & Lanjut ke Diagnostik Fasa (UC-13)"* (*TC-AI-07*).
7. **Uji Registrasi Akun Permanen**: Klik *"Daftar Akun"* di navbar $\rightarrow$ Masukkan email baru $\rightarrow$ Periksa bonus 5 token dan saldo dompet (*TC-AUTH-01*).
8. **Uji Top-up Midtrans**: Pilih paket token di panel kanan $\rightarrow$ Klik *"Beli Paket via Midtrans"* $\rightarrow$ Klik *"Simulasi Konfirmasi Pembayaran"* $\rightarrow$ Pastikan saldo bertambah secara real-time (*TC-PAY-02, TC-PAY-03*).
