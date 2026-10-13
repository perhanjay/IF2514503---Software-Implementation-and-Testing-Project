

# **Software Design Document**

#  **for**  **Polaris Audio** 

# 

# 

# **Prepared by Muhammad Iqbal Ferhan**

# 

#     **September 2026**

# **Daftar Isi** {#daftar-isi}

[**Daftar Isi	1**](#daftar-isi)

[**Abstrak	2**](#abstrak)

[**Bab I**](#bab-i-pendahuluan)  
[**Pendahuluan	3**](#bab-i-pendahuluan)

[1.1. Tujuan Software Design Document	3](#tujuan-software-design-document)

[1.2. Ruang Lingkup	3](#ruang-lingkup)

[**Bab II**](#bab-ii-rancangan-lingkungan-aplikasi)  
[**Rancangan Lingkungan Aplikasi	4**](#bab-ii-rancangan-lingkungan-aplikasi)

[2.1 Lingkungan Perangkat Keras	4](#2.1-lingkungan-perangkat-keras)

[2.2 Lingkungan Perangkat Lunak	5](#2.2-lingkungan-perangkat-lunak)

[2.3 Basis Data	5](#2.3-basis-data)

[**Bab III**](#bab-iii-perancangan-uml)  
[**Perancangan UML	7**](#bab-iii-perancangan-uml)

[3.1 Data Flow Diagram	7](#3.1-data-flow-diagram)

[3.2 Activity Diagram	20](#3.2-activity-diagram)

[3.3 Sequence Diagram	62](#heading=h.kszbor9e0ury)

# 

# 

# **Abstrak** {#abstrak}

Dokumen Software Design Document (SDD) ini disusun sebagai acuan teknis dalam pengembangan platform diagnostik dan perbaikan sesi mixing audio Polaris Audio. Sistem ini dirancang untuk mengotomatisasi dan mengintegrasikan alur persiapan sesi mixing (session prep) secara end-to-end berbasis arsitektur hybrid DSP dan AI, mencakup penerimaan berkas multitrack, klasifikasi instrumen otomatis, deteksi anomali fasa dan fake stereo, eksekusi perbaikan audio, hingga pratinjau A/B dan pelaporan audit teknis. Dokumen ini memuat spesifikasi arsitektur perangkat lunak, kebutuhan lingkungan perangkat keras dan perangkat lunak, serta perancangan basis data. Selain itu, pemodelan sistem disajikan secara komprehensif menggunakan Data Flow Diagram (DFD) serta diagram UML (Activity Diagram dan Sequence Diagram). Keberadaan dokumen SDD ini diharapkan menjadi pedoman terstruktur dalam tahapan pengembangan, pengujian, dan implementasi sistem agar selaras dengan kebutuhan fungsional produksi audio studio, sekaligus memfasilitasi kemudahan pemeliharaan (maintainability) perangkat lunak di masa mendatang.  
**Kata Kunci:** SDD, DSP, AI, Session Prep.

# 

# **Bab I** **Pendahuluan** {#bab-i-pendahuluan}

1. ## Tujuan Software Design Document {#tujuan-software-design-document}

Dokumen Software Design Document (SDD) ini disusun untuk menjelaskan secara menyeluruh rancangan teknis dari platform Polaris Audio. Dokumen ini menjadi acuan resmi bagi tim pengembang (software, DSP, dan AI engineer), tim penguji (audio QA), serta pemangku kepentingan dalam memahami struktur arsitektur, alur komputasi sinyal, dan integrasi antar-komponen perangkat lunak. Dokumen ini juga digunakan untuk:

* Mendeskripsikan arsitektur hybrid DSP dan AI, aliran data pemrosesan berkas audio multitrack, serta perancangan basis data untuk manajemen sesi dan transaksi token.  
* Menjadi panduan teknis dalam implementasi algoritma diagnostik fasa, inferensi klasifikasi instrumen, engine perbaikan audio otomatis, dan pemutar web berbasis Web Audio API.  
* Menyediakan landasan teknis yang solid untuk tahap penulisan kode (implementation), pengujian integritas suara (audio testing), pemeliharaan sistem, serta skalabilitas pengembangan di masa depan.

  2. ## Ruang Lingkup  {#ruang-lingkup}

Sistem yang dirancang adalah platform web Polaris Audio, sebuah sistem otomatisasi persiapan sesi mixing audio berarsitektur hybrid DSP dan AI yang berpusat pada pengguna utama yaitu Audio Engineer. Fokus perancangan sistem ini adalah memfasilitasi alur persiapan sesi mixing secara digital, mulai dari penerimaan berkas multitrack, klasifikasi instrumen otomatis, deteksi kesalahan teknis fasa dan fake stereo, eksekusi perbaikan audio berbasis DSP, perbandingan dengar A/B, pelaporan audit, hingga pengelolaan transaksi kuota token. Ruang lingkup dokumen SDD ini mencakup:

* **Perancangan Lingkungan Aplikasi:** Spesifikasi kebutuhan perangkat keras dan perangkat lunak minimum, arsitektur komputasi server, serta perancangan basis data untuk manajemen metadata sesi dan ledger token.   
* **Pemodelan Sistem (DFD dan UML):** Representasi aliran berkas audio dan data transaksi melalui Data Flow Diagram (DFD), pemodelan perilaku alur kerja persiapan sesi melalui Activity Diagram, serta interaksi terperinci antara aktor, antarmuka web, mesin pemrosesan DSP/AI, payment gateway, dan basis data melalui Sequence Diagram.

  # 

  # **Bab II**   **Rancangan Lingkungan Aplikasi** {#bab-ii-rancangan-lingkungan-aplikasi}


## **2.1	Lingkungan Perangkat Keras** {#2.1-lingkungan-perangkat-keras}

Untuk memastikan aplikasi Polaris Audio berjalan dan berfungsi dengan baik, persyaratan antarmuka perangkat keras yang harus dipenuhi adalah:  
Komputer Pengguna untuk Audio Engineer (PC / Laptop)

* CPU: Minimal Intel Core i5 (Gen 8\) / AMD Ryzen 5 (Seri 2000\) atau lebih tinggi (disarankan 4-Core 2.5 GHz+).  
* RAM: Minimal 8 GB (disarankan 16 GB untuk pemutaran multitrack bebas hambatan).  
* Storage: Minimal sisa ruang 10 GB (SSD disarankan untuk kecepatan caching dan ekspor berkas audio).  
* Display: Monitor dengan resolusi minimal 1366 × 768 (disarankan 1920 × 1080 Full HD untuk visibilitas waveform dan goniometer).  
* Konektivitas: Koneksi internet broadband stabil (minimal 10 Mbps unduh/unggah atau Gigabit Ethernet / Wi-Fi).

Perangkat Keras Audio Pendukung (Monitoring)

* Audio Interface: Soundcard eksternal (USB/Thunderbolt) atau DAC komputer dengan dukungan output stereo.  
* Perangkat Dengar: Speaker Studio Monitor atau Headphone Referensi Studio untuk evaluasi fasa dan perbandingan A/B secara akurat.

##  

## **2.2	Lingkungan Perangkat Lunak** {#2.2-lingkungan-perangkat-lunak}

Untuk memastikan aplikasi Polaris Audio berjalan dan berfungsi dengan baik, persyaratan antarmuka perangkat lunak yang harus dipenuhi adalah:  
Sistem Operasi (Desktop)

* Windows: Minimal Windows 10 (64-bit) atau Windows 11\.  
* macOS: Minimal macOS 11.0 (Big Sur) atau lebih baru (kompatibel arsitektur Intel dan Apple Silicon).  
* Linux: Distribusi Linux 64-bit modern seperti Ubuntu 20.04 LTS atau setara dengan subsistem audio aktif (ALSA / PulseAudio / PipeWire).

Browser (Mendukung Web Audio API & WebAssembly)

* Google Chrome versi 95+ (Desktop)  
* Mozilla Firefox versi 95+ (Desktop)  
* Microsoft Edge versi 95+ (Desktop)  
* Apple Safari versi 15+ (macOS)

## 

## **2.3	Basis Data** {#2.3-basis-data}

Basis data relasional yang digunakan dalam platform Polaris Audio adalah PostgreSQL. PostgreSQL dipilih karena memiliki keandalan tinggi, jaminan integritas data yang ketat (ACID Compliance), serta fleksibilitas dalam menangani data relasional maupun data semi-terstruktur. Perlu dicatat bahwa berkas audio fisik (raw stems) disimpan secara terpisah pada cloud object storage, sementara PostgreSQL difokuskan untuk mengelola metadata sesi, hasil kalkulasi diagnostik audio, dan transaksi token pengguna. Beberapa alasan utama pemilihan PostgreSQL meliputi:

* Kepatuhan ACID untuk Transaksi Token yang Ketat: Sistem manajemen token menuntut jaminan integritas data finansial yang mutlak. Fitur transaksi ACID pada PostgreSQL memastikan bahwa pemotongan, penambahan, dan auto-refund saldo token terjadi secara konsisten tanpa resiko double-spending atau race condition saat pemrosesan audio berlangsung.   
* Dukungan Tipe Data JSONB untuk Metrik Diagnostik DSP: Selain data relasional standar, sistem menghasilkan data diagnostik audio yang dinamis. Fitur JSONB pada PostgreSQL memungkinkan penyimpanan dan pengindeksan data teknis audio tersebut secara efisien tanpa memerlukan basis data NoSQL tambahan.   
* Konkurensi Tinggi dengan Multi-Version Concurrency Control (MVCC): PostgreSQL mampu menangani operasi baca-tulis konkuren yang intensif, seperti pembaruan progres status pemrosesan audio secara real-time dari background worker tanpa mengunci tabel yang dapat memperlambat antarmuka pengguna.   
* Struktur Relasional yang Kuat untuk Manajemen Sesi Multitrack: Sistem memiliki relasi entitas terstruktur yang menghubungkan data pengguna, proyek sesi mixing, daftar trek audio, hingga relasi pasangan multi-mikrofon (track pairing), yang dapat dikelola secara optimal menggunakan integritas referensial (foreign keys) PostgreSQL.  
  
    
  
  


  # 

  # **Bab III**   **Perancangan UML** {#bab-iii-perancangan-uml}

## 3.1 Data Flow Diagram {#3.1-data-flow-diagram}

1. Level 0

![][image1]

2. Level 1

![][image2]

## 3.2 Activity Diagram {#3.2-activity-diagram}

1. Register Akun  
   ![][image3]  
2. Login ke Sistem  
   ![][image4]  
3. Mereset Kata Sandi  
   ![][image5]  
4. Mengubah Profil  
   ![][image6]  
5. Mengubah Kata Sandi  
   ![][image7]  
6. Memeriksa Saldo Token  
   ![][image8]  
7. Melakukan Pembelian Paket Token  
   ![][image9]  
8. Memeriksa Riwayat Transaksi  
   ![][image10]  
9. Mengklaim Jatah Token Gratis  
   ![][image11]  
10. Mengunggah Sesi Mixing  
    ![][image12]  
11. Memverifikasi Integritas & Sinkronisasi Sesi  
    ![][image13]  
12. Mengoreksi Label & Pasangan Track Secara Manual  
    ![][image14]  
13. Memeriksa Skor Kesehatan Sesi & Ringkasan Masalah  
    ![][image15]  
14. Menjalankan Perbaikan Sesi Otomatis  
    ![][image16]  
15. Menyesuaikan Perbaikan Kecil  
    ![][image17]  
16. Mendengarkan Perbandingan Audio Mentah vs Audio Perbaikan  
    ![][image18]  
17. Mengunduh Stems Audio Hasil Perbaikan  
    ![][image19]  
18. Mengunduh Laporan Diagnostik Sesi  
    ![][image20]

3.3 Sequence Diagram

1. Register Akun Baru  
   ![][image21]  
2. Login ke Sistem  
   ![][image22]  
3. Mereset Kata Sandi  
   ![][image23]  
4. Mengubah Profil  
   ![][image24]  
5. Mengubah Kata Sandi  
   ![][image25]  
6. Memeriksa Saldo Token  
   ![][image26]  
7. Melakukan Pembelian Paket Token  
   ![][image27]  
8. Memeriksa Riwayat Transaksi  
   ![][image28]  
9. Mengklaim Jatah Token Gratis  
   ![][image29]  
10. Mengunggah Sesi Mixing  
    ![][image30]  
11. Memverifikasi Integritas & Sinkronisasi Sesi  
    ![][image31]  
12. Mengoreksi Label & Pasangan Track Secara Manual  
    ![][image32]  
13. Memeriksa Skor Kesehatan Sesi & Ringkasan Masalah  
    ![][image33]  
14. Menjalankan Perbaikan Sesi Otomatis  
    ![][image34]  
15. Menyesuaikan Perbaikan Kecil  
    ![][image35]  
16. Mendengarkan Perbandingan Audio Mentah vs Audio Perbaikan  
    ![][image36]  
17. Mengunduh Stems Audio Hasil Perbaikan  
    ![][image37]  
18. Mengunduh Laporan Diagnostik Sesi  
    ![][image38]

[]: <>
