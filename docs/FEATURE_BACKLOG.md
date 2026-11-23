# Feature Backlog & Pengembangan Lanjutan — Polaris Audio

Dokumen ini mencatat rencana fitur bernilai guna tinggi (*high-utility pre-mixing & audio utility features*) yang dijadwalkan untuk fase diskusi dan implementasi berikutnya setelah fitur inti **Audio Workbench** (AI 4-Stem Separator & Head/Tail Smart Silence Trimmer) selesai.

---

## Prioritas 1: Multi-Region Asset Splitter (*Split by Silence*)

> **Status:** Planned / Backlog (Diskusi Lanjutan)  
> **Lokasi Target:** **Audio Workbench** (`/workbench` — Sub-mode pada Tab Trimmer atau Tab `03 Asset Splitter`)

### Latar Belakang & Masalah Nyata
Seorang *sound designer*, *foley artist*, atau kreator aset game sering merekam atau mengekspor puluhan aset suara terpisah (SFX, *UI clicks*, *one-shot samples*, atau *voice lines*) ke dalam **satu berkas audio panjang** yang dipisahkan oleh jeda diam (*silence*), misalnya 20 aset berdurasi ~3 detik di dalam satu berkas sepanjang 90 detik. Memotong, merapikan amplop awal/akhir agar tidak berbunyi klik, serta menamai file satu per satu secara manual di editor seperti Audacity sangat melelahkan.

### Perbedaan dengan Smart Silence Trimmer Saat Ini
* **Head & Tail Trimmer (Saat Ini):** Hanya memangkas keheningan di **ujung awal** dan **ujung akhir**, menghasilkan tepat 1 berkas output yang tetap aman (*zero-aligned*) untuk dikirim ke multitrack Studio Workspace.
* **Multi-Region Asset Splitter (Backlog):** Memindai seluruh garis waktu, mendeteksi **jeda hening internal**, dan memecah 1 file menjadi **banyak berkas potongan terpisah** (`asset_01.wav`, `asset_02.wav`, dst.).

### Rencana Fungsionalitas
1. **Parameter Kontrol:**
   - **Threshold Hening (`Threshold dB`):** Rentang `-60 dB` s.d. `-20 dB` untuk menentukan batas sinyal dianggap diam.
   - **Durasi Jeda Pemisah Minimal (`Min Silence Gap ms`):** Default `300 ms` (rentang `100 ms – 2000 ms`) agar jeda pendek/ekor reverb alami di dalam satu efek suara tidak dianggap sebagai pemisah file.
   - **Durasi Aset Minimal (`Min Asset Duration ms`):** Default `80 ms` untuk menyaring *noise spike* singkat yang bukan aset valid.
   - **Margin & De-Clicker (`Pad ms` & `Micro-Fade ms`):** Menjaga serangan (*transient*) tidak terpotong mepet dan menerapkan *raised-cosine micro-fade* di setiap awal/akhir potongan.
2. **Visualisasi Kanvas `.retro-monitor`:**
   - Menyoroti seluruh region aktif terdeteksi secara berurutan (`01`, `02`, ..., `N`) secara *real-time* ketika parameter slider digeser, lengkap dengan jumlah estimasi potongan yang akan dihasilkan.
3. **Output & Ekspor:**
   - Daftar kartu aset potongan (`[Prefix]_01.wav`, `[Prefix]_02.wav`, ...) berformat `48 kHz` lossless lengkap dengan pemutar pratinjau satuan, tombol unduh individual, dan tombol **"Unduh Semua Aset (ZIP)"**.
4. **Batasan Arsitektur:**
   - Hasil pemecahan ditujukan khusus untuk manajemen & ekspor aset satuan (*single-track utility*), **tidak** untuk dikirim sebagai sesi multitrack *zero-aligned* ke Studio Workspace.

### Titik Integrasi Kode (Fondasi Tersedia)
* **Worker Python (`worker/src/workbench/silence_trimmer.py`):** Dapat memanfaatkan ulang `decode_audio_bytes`, `encode_wav_bytes`, dan `_slice_and_fade`, lalu menambahkan fungsi `detect_active_regions` dan `split_by_silence`.
* **Backend & Storage:** Memanfaatkan S3 bucket sementara (`workbench/...`) dan `AdmZip`.
* **Frontend:** Memanfaatkan kanvas `.retro-monitor` dari `WaveformTrimmerCanvas.vue`.

---

## Prioritas 2: Reference Track Tonal Matching (*Tonal Balance & Match EQ*)

> **Status:** Planned / Backlog (Diskusi Lanjutan — Opsi B Fase 2)  
> **Lokasi Target:** **Audio Workbench** (`/workbench` — Tab `03 Reference Tonal Matcher` atau modul Pre-Mastering)

### Latar Belakang & Masalah Nyata
Musisi dan *mixing engineer* di studio rumahan sering mengalami kelelahan telinga (*ear fatigue*) atau bias akustik ruangan—hasil mix terdengar pas di kamar, namun terdengar keruh (*muddy*), kurang terang (*dull*), atau bass-nya kurang seimbang saat diputar di luar ruangan atau disandingkan dengan lagu komersial hits di platform streaming.

### Rencana Fungsionalitas
1. **Input Dua Jalur:**
   - **Target Audio:** Mixdown / berkas audio milik pengguna (`.wav`, `.flac`, `.mp3`).
   - **Lagu Referensi (*Reference Song*):** Satu berkas lagu komersial favorit sebagai acuan karakter tonal.
2. **Visualisasi Spektrum Logaritmik (`20 Hz – 20 kHz`) di `.retro-monitor`:**
   - Menampilkan overlay kurva *Long-Term Average Spectrum (LTAS)* audio pengguna terhadap kurva/zona aman lagu referensi, dibagi menjadi 5 zona frekuensi utama: *Sub (20–60 Hz)*, *Low-Mid (60–250 Hz)*, *Mid (250 Hz–2 kHz)*, *High-Mid (2–6 kHz)*, dan *Air/Bright (6–20 kHz)*.
3. **Diagnostik Bahasa Engineer:**
   - Menerjemahkan selisih grafik menjadi saran EQ yang praktis (mis. *"Kelebihan energi Low-Mid +3.1 dB di rentang 220–320 Hz — potensi suara keruh"*, *"Kekurangan Air -4.2 dB di 8–14 kHz — vokal & simbal kurang terbuka"*).
4. **Auto-Match EQ & Volume-Matched A/B Audition:**
   - Slider **Intensitas Match EQ (`0% – 100%`, default `65%`)** untuk mengadopsi karakter tonal referensi secara halus tanpa merusak keaslian dinamika lagu.
   - Pemutar **A/B (Asli vs Matched)** yang otomatis disetarakan kenyaringannya (*LUFS loudness-matched*) agar penilaian telinga tetap objektif.
   - Tombol unduh berkas hasil *Match EQ* (`48 kHz` WAV dengan *True-Peak* guard `-1.0 dBFS`).

### Pendekatan Teknis (100% DSP Deterministik)
* **Energy-Gated LTAS (`scipy.signal.welch`):** Menghitung spektrum daya rata-rata hanya pada blok frame aktif bersuara (mengabaikan intro/outro yang diam agar tidak membiaskan kurva).
* **1/3-Octave Psychoacoustic Smoothing:** Menghaluskan kurva FFT mentah pada grid frekuensi logaritmik 1/3 oktaf agar selisih kurva menghasilkan filter koreksi yang musikal dan bebas *ringing*.
* **Clamped Difference Filter:** Selisih kurva dibatasi aman pada rentang $\pm 8\text{ dB}$, dikalikan faktor intensitas slider pengguna, dan diaplikasikan menggunakan filter FIR *linear-phase* / *minimum-phase*.

---

## Ide Tambahan Lainnya (*Exploratory / Long-Term*)

Daftar ide pelengkap hasil brainstorming yang dapat dipertimbangkan pada iterasi selanjutnya:
* [ ] **Pre-Mix Multi-Track Auto Gain Staging (LUFS):** Penyetaraan kenyaringan per kategori instrumen (Drums, Bass, Vocals) berbasis EBU R128/LUFS agar fader DAW bisa dimulai dari `0 dB` (*unity gain*).
* [ ] **AI Vocal De-Reverb & Room Acoustic Cleaner:** Pembersihan gema pantulan ruangan kamar tidur/kamar kos pada trek vokal agar terdengar kering (*dry studio booth*).
* [ ] **Deteksi Otomatis BPM / Tempo & Estimasi Nada Dasar (Musical Key):** Menampilkan metadata tempo dan nada dasar pada ringkasan sesi.
* [ ] **DAW Project Exporter (Reaper `.RPP` Template & Timeline Markers):** Menghasilkan berkas sesi DAW siap buka lengkap dengan urutan track, pewarnaan instrumen, dan penanda posisi anomali.
