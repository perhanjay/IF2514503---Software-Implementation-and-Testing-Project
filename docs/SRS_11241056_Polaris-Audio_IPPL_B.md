​                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          

***Software Requirements Specification***

**for**

**Polaris Audio**

**Version 1.0** 

**Prepared by** 

**11241056 \- Muhammad Iqbal Ferhan**

**September 2026**

**Table of Contents**

**[1\. Pendahuluan	1](#pendahuluan)**

[1.1 Tujuan Penulisan Dokumen	1](#tujuan-penulisan-dokumen)

[1.2 Audiens yang Dituju dan Pembaca yang Disarankan	1](#audiens-yang-dituju-dan-pembaca-yang-disarankan)

[1.3 Batasan Produk	2](#batasan-produk)

[1.4 Definisi dan Istilah	3](#definisi-dan-istilah)

[1.5 Referensi	5](#referensi)

[**2\. Deskripsi Keseluruhan	6**](#deskripsi-keseluruhan)

[2.1 Deskripsi Produk	6](#deskripsi-produk)

[2.2 Fungsi Produk	6](#fungsi-produk)

[2.3 Penggolongan Karakter Pengguna	7](#penggolongan-karakter-pengguna)

[2.4 Lingkungan Operasi	8](#lingkungan-operasi)

[2.5 Batasan Desain dan Implementasi	8](#batasan-desain-dan-implementasi)

[2.6 Dokumentasi Pengguna	8](#dokumentasi-pengguna)

[**3\. Kebutuhan Antarmuka Eksternal	10**](#kebutuhan-antarmuka-eksternal)

[3.1 Hardware Interface	10](#hardware-interface)

[3.2 Software Interface	10](#software-interface)

[3.3 Communication Interface	11](#communication-interface)

[**4\. Requirement	12**](#requirement)

[4.1 Functional Requirements	12](#functional-requirements)

[4.2 Non Functional Requirements	13](#non-functional-requirements)

[4.3 Use Case Diagram	15](#use-case-diagram)

[4.4 Use Case Description	16](#use-case-description)

**Revision History**

| Name | Date | Reason For Changes | Version |
| :---- | :---- | :---- | :---- |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |

1. # **Pendahuluan** {#pendahuluan}

   1. ## **Tujuan Penulisan Dokumen** {#tujuan-penulisan-dokumen}

Dokumen ini menjelaskan kebutuhan perangkat lunak untuk aplikasi Polaris Audio, sebuah platform diagnostik dan perbaikan sesi mixing audio berbasis web yang dirancang sebagai sistem terpadu berbasis arsitektur hybrid Digital Signal Processing (DSP) dan Artificial Intelligence (AI). Sistem ini memfasilitasi seluruh alur persiapan produksi audio, mulai dari penerimaan berkas multitrack mentah, klasifikasi instrumen otomatis, pemeriksaan kualitas terhadap kelainan teknis audio seperti fasa terbalik dan *fake stereo*, hingga eksekusi perbaikan audio otomatis dan pelaporan diagnostik sesi.

Dokumen ini menjadi pedoman utama dalam proses desain, pengembangan, dan pengujian sistem Polaris Audio agar spesifikasi teknis yang dibangun selaras dengan kebutuhan fungsional para penggunanya mulai dari musisi independen, produser musik, audio engineer, hingga pemilik studio rekaman. Serta sejalan dengan tujuan bisnis untuk memangkas waktu persiapan sesi rekaman, mengoptimalkan efisiensi kerja, dan meningkatkan kapasitas produksi studio secara signifikan.

2. ## **Audiens yang Dituju dan Pembaca yang Disarankan** {#audiens-yang-dituju-dan-pembaca-yang-disarankan}

Dokumen **Software Requirements Specification (SRS)** ini ditujukan untuk berbagai pihak yang terlibat langsung maupun tidak langsung dalam proses pengembangan dan implementasi sistem **Polaris Audio**. Setiap pembaca memiliki perspektif dan kepentingan berbeda terhadap sistem, dan isi dokumen ini dirancang agar dapat dimengerti oleh beragam peran tersebut.

**Jenis Pembaca yang Disarankan:**

1. **Pengembang (Developer & Programmer)**  
   * Memahami fungsionalitas sistem yang harus dibangun, termasuk logika kompleks.  
   * Menentukan arsitektur perangkat lunak dan implementasi teknis berdasarkan kebutuhan fungsional dan non-fungsional.  
2. **Manajer Proyek (Project Manager)**  
   * Menyusun jadwal proyek, estimasi biaya, serta alokasi sumber daya berdasarkan ruang lingkup dan kebutuhan sistem yang luas.  
   * Memastikan setiap tahap pengembangan sesuai dengan spesifikasi dalam dokumen ini.  
3. **Analis Sistem & Desainer UI/UX**  
   * Menafsirkan kebutuhan pengguna ke dalam alur sistem dan antarmuka yang efisien, intuitif, dan konsisten.  
   * Menyediakan rancangan interaksi dan prototipe yang mendukung proses bisnis.  
4. **Penguji Sistem (Software Tester / QA Engineer)**  
   * Menyusun skenario pengujian fungsional dan pengujian *edge cases*, seperti variasi sample rate, format file korup, hingga file audio tanpa sinyal.  
   * Memastikan ketahanan mesin perbaikan audio melalui pengujian transparansi, integritas sinkronisasi waktu, serta memastikan AI tidak memiliki bias terhadap genre musik tertentu.  
5. **Audio Engineer, Produser Musik & Pengguna Studio (End-Users)**  
   * Memahami alur fitur yang tersedia untuk memangkas waktu kerja rutin, seperti klasifikasi instrumen otomatis, deteksi fasa terbalik, evaluasi *fake stereo*, dan normalisasi headroom.  
   * Memberikan umpan balik langsung terhadap akurasi rekomendasi perbaikan serta kepraktisan hasil ekspor stem berdasarkan alur kerja nyata di studio mixing.  
6. **Tim Keamanan Data & Privasi (Security & Data Governance Officer)**  
   * Memastikan sistem mematuhi standar perlindungan data dan kerahasiaan berkas audio milik klien selama proses unggah, penyimpanan sementara, hingga pengunduhan.  
   * Memverifikasi mekanisme pembersihan berkas otomatis setelah sesi selesai diproses untuk mencegah kebocoran karya cipta.  
7. **Pemangku Kepentingan Lain (Stakeholders)**  
   * Meliputi pemilik produk, pemilik studio rekaman komersial, dan manajemen label yang berkepentingan terhadap peningkatan kapasitas produksi studio, pemangkasan biaya operasional, serta standarisasi kualitas audio yang dihasilkan.

   3. ##  **Batasan Produk** {#batasan-produk}

Berikut adalah beberapa batasan dalam pengembangan aplikasi **Polaris Audio** yang perlu diperhatikan:

1. **Koneksi Internet Stabil Diperlukan** Aplikasi beroperasi secara *cloud-based* untuk memproses berkas multitrack (WAV/FLAC) berukuran besar. Pengguna memerlukan koneksi internet yang stabil dengan *bandwidth* memadai agar proses unggah, analisis, dan pengunduhan stem tidak terputus.  
2. **Terbatas pada Peramban Desktop Modern** Sistem mengandalkan *Web Audio API* untuk pemutaran multitrack dan visualisasi fasa *real-time*. Oleh karena itu, aplikasi hanya optimal digunakan pada peramban desktop modern dengan monitor studio, bukan pada perangkat *mobile*.  
3. **Bergantung pada Kapasitas Komputasi Cloud** Kecepatan inferensi model AI dan kalkulasi DSP bergantung pada beban antrean server (*CPU/GPU worker*). Durasi analisis dan rendering perbaikan dapat bervariasi tergantung pada jumlah dan panjang trek yang diproses.  
4. **Keputusan Akhir Tetap Semi-Otomatis (\*Human-in-the-Loop\*)** Meskipun deteksi anomali berjalan otomatis, eksekusi perbaikan kritis (seperti pembalikan fasa atau perubahan stereo) tetap memerlukan tinjauan dan persetujuan dari audio engineer guna menjaga integritas artistik lagu.  
5. **Penyimpanan Berkas Bersifat Sementara (Retensi Terbatas)** Guna menjaga kerahasiaan materi rekaman yang belum dirilis serta menghemat ruang server, sistem tidak menyimpan audio secara permanen. Berkas asli dan hasil perbaikan akan dihapus otomatis setelah batas retensi (misal: 24–48 jam) berakhir.

   4. ##  **Definisi dan Istilah** {#definisi-dan-istilah}

| SRS | *Software Requirements Specification*, atau Spesifikasi Kebutuhan Perangkat Lunak (SKPL). |
| :---- | :---- |
| IEEE | *Institute of Electrical and Electronics Engineering*. Standar internasional untuk pengembangan dan perancangan produk. |
| Polaris Audio | Sistem diagnostik dan perbaikan sesi mixing audio yang dirumuskan pembuatannya dalam dokumen ini. |
| User / Pengguna | Individu yang berinteraksi dan menggunakan sistem Polaris Audio. |
| Software | Program atau aplikasi berbasis *web* yang berjalan di perangkat komputer desktop audio. |
| Interface | Antarmuka atau penghubung, baik antara sistem dengan pengguna (*User Interface*) maupun penghubung komunikasi data antar komponen sistem. |
| A/B Comparison (A/B Auditioning) | Metode pengujian dengar langsung antara dua berkas audio (sinyal asli vs hasil perbaikan) secara bergantian tanpa jeda (*seamless*) untuk memvalidasi perubahan secara objektif. |
| AI (Artificial Intelligence) | Kecerdasan buatan; dalam sistem ini merujuk pada model pembelajaran mesin (*Machine Learning*) yang bertugas mengklasifikasi jenis instrumen dan menganalisis peran track secara otomatis. |
| Audio Tagging / Classification | Proses analisis berbasis komputasi untuk mengidentifikasi dan melabeli konten instrumen di dalam berkas audio mentah (misalnya: mengenali apakah suatu stem adalah *Lead Vocal*, *Kick Drum*, atau *Bass DI*). |
| Bit Depth | Resolusi amplitudo sinyal audio digital pada setiap sampel (misalnya 16-bit, 24-bit, atau 32-bit float). Menentukan *dynamic range* dan batas kebisingan dasar (*noise floor*). |
| Clipping (Digital / True-Peak) | Bentuk distorsi digital destruktif yang terjadi ketika amplitudo sinyal melampaui batas maksimum sistem digital (0 dBFS) atau batas konversi digital-ke-analog. |
| Comb Filtering | Efek pembatalan frekuensi akustik berbentuk gerigi sisir yang terjadi saat dua sinyal serupa dijumlahkan dengan jeda waktu sangat kecil (beberapa milidetik), menyebabkan suara terdengar tipis dan hampa. |
| Crest Factor | Rasio matematis antara nilai puncak sinyal (*peak level*) terhadap nilai rata-rata energinya (*RMS*); digunakan untuk mengukur seberapa dinamis suatu trek audio. |
| DAW (Digital Audio Workstation) | Perangkat lunak tempat rekaman, penyuntingan, dan mixing musik diproduksi secara profesional (misalnya: Pro Tools, Logic Pro, Cubase, Reaper, FL Studio). |
| DC Offset | Anomali kelistrikan di mana bentuk gelombang audio tidak berpusat pada titik tegangan nol (garis horizontal tengah), yang memakan *headroom* dan dapat memicu bunyi letupan (*pop/click*). |
| DSP (Digital Signal Processing) | Pemrosesan sinyal digital berbasis kalkulasi matematis deterministik untuk menganalisis, memanipulasi, memfilter, atau mengukur sinyal audio tanpa memerlukan data pelatihan (*training data*). |
| Fake Stereo (Stereo Semu) | Sinyal mono yang diproses secara artifisial (misal dengan penundaan waktu/chorus) agar terdengar lebar di speaker stereo, namun rusak atau lenyap saat diputar dalam sistem monofonik. |
| Goniometer (Lissajous Meter) | Instrumen visualisasi dua dimensi untuk memantau hubungan fasa, lebar medan stereo, dan keseimbangan spasial antara saluran kiri (*Left*) dan kanan (*Right*). |
| Haas Effect | Fenomena psikoakustik di mana dua suara identik yang memiliki selisih waktu 5–35 milidetik dipersepsikan sebagai satu sumber suara spasial yang lebar, namun sangat rentan menimbulkan *comb filtering*. |
| Headroom | Rentang ruang aman (dalam satuan desibel/dB) antara level puncak sinyal audio tertinggi dengan batas distorsi maksimum digital (0 dBFS). |
| High-Pass Filter (HPF) | Filter audio yang meloloskan frekuensi di atas ambang batas tertentu dan memotong frekuensi di bawahnya; digunakan untuk membuang getaran subsonik (*sub-rumble*) yang tidak terdengar. |
| Inter-Sample Peak (ISP) | Puncak gelombang analog yang terbentang melampaui batas 0 dBFS di antara dua titik sampel digital selama proses rekonstruksi dari digital ke analog (*D/A conversion*). |
| Korelasi Fasa (Phase Correlation) | Nilai metrik berkisar antara $-1.0$ hingga $+1.0$ yang mengukur keselarasan fase antara dua saluran stereo. Nilai $+1.0$ berarti stereo sinkron sempurna, $0.0$ berarti independen, dan nilai negatif $(<0)$ menandakan pembatalan fasa. |
| LUFS (Loudness Units relative to Full Scale) | Standar internasional pengukuran persepsi kenyaringan suara manusia yang dihitung secara terintegrasi terhadap waktu (*perceived loudness*). |
| Mid/Side (M/S) Processing | Teknik pembagian sinyal stereo menjadi dua komponen: *Mid* (sinyal tengah/mono: $L+R$) dan *Side* (sinyal perbedaan stereo di sisi luar: $L-R$). |
| Mono-Compatibility | Kemampuan rekaman stereo untuk dimainkan pada sistem mono (misalnya speaker ponsel atau speaker klub) tanpa kehilangan kejelasan vokal atau instrumen penting. |
| Multitrack | Kumpulan berkas rekaman individual yang terpisah dari instrumen-instrumen dalam satu lagu sebelum digabungkan atau di-mix. |
| Null Test | Prosedur verifikasi integritas audio di mana sinyal hasil perbaikan dibalik polaritasnya lalu dijumlahkan dengan sinyal asli ($A-B$); jika hasilnya hening total ($-\infty dB$), menandakan tidak ada degradasi yang tidak diinginkan. |
| Polaritas (Polarity) | Arah getaran simpangan gelombang audio (fase positif vs fase negatif). Pembalikan polaritas ($18{0}^{\circ }$) mengubah bukit gelombang menjadi lembah. |
| Sample Rate | Jumlah cuplikan data audio per detik dalam representasi digital, diukur dalam satuan Hertz (misalnya: 44.1 kHz, 48 kHz, atau 96 kHz). |
| Session Prep (Mix Prep) | Rangkaian pekerjaan awal yang dilakukan audio engineer untuk merapikan nama track, mengecek fasa mikrofon, membuang noise, dan menata gain sebelum proses mixing kreatif dimulai. |
| Spectral Mud | Penumpukan energi berlebih pada rentang frekuensi rendah-menengah (umumnya 200 Hz – 400 Hz) yang menyebabkan suara instrumen terdengar keruh, mendengung, dan kehilangan artikulasi. |
| SRS (Software Requirements Specification) | Dokumen spesifikasi teknis formal yang merinci seluruh kebutuhan fungsional, non-fungsional, arsitektur, dan batasan perangkat lunak yang akan dikembangkan. |
| Stems | Berkas audio individual atau sub-grup instrumen yang diekspor dari titik awal yang sama (*zero-aligned*) dan siap diimpor ke dalam proyek DAW. |
| Web Audio API | Standar sistem antarmuka pemrograman aplikasi tingkat tinggi berbasis JavaScript di peramban web (*browser*) untuk komputasi, sintesis, dan pemutaran audio secara *real-time*. |
| Zero-Crossing Point | Titik potong di mana nilai amplitudo gelombang audio berada tepat pada angka nol; titik ideal untuk memotong atau memulai sampel audio tanpa menimbulkan bunyi klik (*pop/click*). |

   5. ##  **Referensi** {#referensi}

Fielding, R.T. (2000) 'Architectural Styles and the Design of Network-based Software Architectures', Disertasi Doktoral, University of California, Irvine.Google Firebase Documentation (n.d.) 'Firebase Cloud Messaging', Google.

Microsoft Docs (n.d.) 'Web API design best practices', Microsoft Learn. 

Microsoft Docs (n.d.) 'Transport Layer Security (TLS)', Microsoft Learn.

2. # **Deskripsi Keseluruhan** {#deskripsi-keseluruhan}

   1. ## **Deskripsi Produk**  {#deskripsi-produk}

Sistem ini merupakan platform digital berbasis web yang dirancang untuk mengotomatisasi dan mengintegrasikan seluruh alur persiapan sesi mixing audio secara terpadu berbasis arsitektur hybrid DSP dan AI. Produk ini memungkinkan pemilik studio dan kepala engineer untuk memantau ringkasan metrik teknis, skor kesehatan sesi rekaman, serta laporan audit proyek secara terpusat melalui dashboard diagnostik yang komprehensif. Selain itu, audio engineer dan produser musik dapat menggunakan sistem secara mandiri untuk memvalidasi integritas berkas multitrack, mendeteksi anomali fasa dan fake stereo, melakukan pratinjau perbandingan A/B terhadap audio hasil perbaikan, hingga mengekspor paket stem yang bersih dan siap di-mix secara efisien dan akurat.

2. ## **Fungsi Produk**  {#fungsi-produk}

Berikut adalah fungsi utama dari aplikasi **Polaris Audio**:

* Audio Engineer dapat mengunggah berkas multitrack (WAV, FLAC, ZIP) dan memverifikasi keselarasan durasi serta konsistensi sample rate.  
* Audio Engineer dapat meninjau dan mengoreksi hasil klasifikasi instrumen serta pasangan track (multi-mic pairing) yang dipetakan oleh AI.  
* Audio Engineer dapat memantau Skor Kesehatan Sesi (Mix Health Score) dan membaca rincian rekomendasi perbaikan teknis per track.  
* Audio Engineer dapat melakukan pengujian dengar perbandingan A/B secara real-time antara audio asli dan hasil perbaikan.  
* Audio Engineer dapat menguji kompatibilitas mono sesi menggunakan visualizer fasa (goniometer) dan tombol Mono Check.  
* Audio Engineer dapat memilih dan menyesuaikan parameter perbaikan DSP secara selektif (granular repair) sesuai kebutuhan artistik.  
* Audio Engineer dapat mengunduh seluruh paket stem bersih hasil perbaikan dalam satu arsip ZIP yang siap diimpor ke DAW.  
* Audio Engineer dapat mengunduh Laporan Diagnostik Sesi (PDF) sebagai bukti audit teknis untuk klien studio.  
* Sistem dapat mengklasifikasikan jenis instrumen audio secara otomatis menggunakan model inferensi AI.  
* Sistem dapat mendeteksi anomali teknis audio berbasis kalkulasi DSP, seperti fasa terbalik, fake stereo, clipping, dan DC offset.  
* Sistem dapat mengeksekusi perbaikan audio otomatis (polarity flip, koreksi stereo, pembersihan sub-rumble, dan gain staging).  
* Sistem dapat memberikan notifikasi peringatan kritis jika terdeteksi pembatalan fasa parah atau kerusakan berkas audio.  
* Sistem dapat menghapus berkas audio sesi secara otomatis (cache purge) setelah masa retensi berakhir untuk menjaga kerahasiaan karya klien.

  3. ## **Penggolongan Karakter Pengguna** {#penggolongan-karakter-pengguna}

**Tabel 1 Karakteristik Pengguna**

| Kategori Pengguna | Tugas | Hak Akses ke aplikasi | Kemampuan yang harus dimiliki |
| :---- | :---- | :---- | :---- |
| **Audio Engineer** *(Pengguna Utama)* | Menganalisis fasa & *fake stereo*, mengonfigurasi parameter perbaikan DSP, melakukan evaluasi A/B, serta mengekspor stem bersih dan laporan audit. | **Full Operational Access** (Upload, Process, Modify DSP, Export Stems & PDF) | Pemahaman mendalam tentang *audio engineering* (relasi fasa, *gain staging*, *stereo imaging*) dan alur kerja DAW. |

4. ## **Lingkungan Operasi**  {#lingkungan-operasi}

Perangkat lunak Polaris Audio dirancang untuk berjalan pada lingkungan operasional berikut:

* *Browser* yang Didukung: Google Chrome, Mozilla Firefox, dan Microsoft Edge.  
* Sistem Operasi *Desktop*: Windows 10/11, macOS 10.15 ke atas, serta distribusi Linux modern.  
* Koneksi Internet: Minimal 1 Mbps dengan latensi jaringan rendah.

  5. ## **Batasan Desain dan Implementasi**  {#batasan-desain-dan-implementasi}

Beberapa batasan dalam desain dan pengembangan sistem Polaris Audio meliputi:

* Pengguna wajib memiliki koneksi internet yang stabil untuk dapat menggunakan platform web, karena seluruh proses analisis DSP dan inferensi AI berjalan secara online dan real-time.  
* Sistem tidak dapat berjalan secara offline karena setiap kalkulasi fasa dan perbaikan audio memerlukan pemrosesan komputasi langsung di server cloud.  
* Sistem backend memerlukan server komputasi dan cloud storage yang selalu aktif dan tersedia untuk memproses serta menampung berkas audio multitrack berukuran besar.  
* Pengguna diwajibkan mengakses sistem melalui peramban web pada komputer desktop untuk mendapatkan visibilitas visualisasi fasa dan kontrol pemutar multitrack yang optimal, sehingga sistem tidak mendukung perangkat mobile.  
* Sistem Polaris Audio dirancang sebagai platform mandiri dan belum terintegrasi langsung sebagai format plugin (VST/AU) ke dalam perangkat lunak DAW pihak ketiga.  
* Antarmuka pengguna mewajibkan dukungan teknologi Web Audio API pada peramban untuk menjalankan pemutaran audio multitrack dan visualisasi sinyal secara real-time.

  6. ## **Dokumentasi Pengguna** {#dokumentasi-pengguna}

Untuk mempermudah adaptasi pengguna serta menjamin kelancaran operasional alur kerja mixing prep, sistem Polaris Audio menyediakan beberapa bentuk dokumentasi dan bantuan pengguna terpadu:

* **Tur Interaktif dan Sesi Demo:** Panduan visual langkah-demi-langkah yang aktif saat pengguna pertama kali masuk ke sistem. Pengguna disediakan sebuah proyek multitrack demo bawaan agar dapat langsung mempraktikkan cara navigasi antarmuka, memutar pemutar multitrack, menguji tombol perbandingan A/B, serta membaca visualizer goniometer tanpa risiko kesalahan pada berkas rekaman asli mereka.  
* **Pusat Bantuan Daring FAQ:** Dokumentasi berbasis web yang dapat diakses langsung dari menu navigasi. Bagian ini memuat artikel panduan teknis yang dapat dicari, termasuk tata cara mengekspor berkas multitrack yang benar dari berbagai DAW populer (seperti Pro Tools, Logic Pro, Cubase, FL Studio, dan Studio One), serta penanganan kendala umum terkait koneksi dan pemrosesan audio.

3. # **Kebutuhan Antarmuka Eksternal** {#kebutuhan-antarmuka-eksternal}

   1. ## **Hardware Interface** {#hardware-interface}

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

  2. ##  **Software Interface** {#software-interface}

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

  3. ##  **Communication Interface** {#communication-interface}

Sistem Polaris Audio dirancang dengan komunikasi data yang efisien antara antarmuka peramban web dan server backend untuk memastikan keandalan transfer serta pemrosesan berkas audio multitrack secara real-time. Komunikasi data utama menggunakan protokol HTTPS berbasis RESTful API sesuai standar arsitektur jaringan yang dikembangkan oleh Fielding (2000). Melalui antarmuka ini, pengguna dapat mengelola sesi proyek, melakukan unggah-unduh berkas multitrack (WAV/FLAC), serta mengirimkan instruksi analisis diagnostik dan perbaikan DSP ke server.  
Untuk memberikan pembaruan status pemrosesan audio secara langsung (seperti persentase progres kalkulasi fasa dan rendering perbaikan oleh worker AI/DSP), sistem memanfaatkan koneksi real-time berbasis WebSocket melalui protokol WSS (WebSocket Secure). Selain itu, untuk pengiriman ringkasan laporan diagnostik sesi atau pemberitahuan saat pemrosesan batch telah selesai, sistem menggunakan protokol SMTP melalui koneksi aman SMTPS.  
Seluruh pertukaran data dan pengiriman berkas audio wajib dienkripsi menggunakan protokol TLS 1.2 atau lebih tinggi guna melindungi materi rekaman klien (unreleased tracks) dari potensi penyadapan data. Sistem menerapkan autentikasi berbasis standar JSON Web Token (JWT) dengan Role-Based Access Control (RBAC) untuk memastikan bahwa hak akses ke berkas audio dan parameter DSP hanya dapat dijangkau oleh pengguna yang terotorisasi. Melalui kombinasi protokol ini, Polaris Audio mampu menghadirkan platform diagnostik dan perbaikan sesi mixing yang responsif, andal, dan aman.

4. # **Requirement** {#requirement}

   1. ## **Functional Requirements** {#functional-requirements}

| ID | Functional Requirement |
| :---- | :---- |
|  |  |
| FR-1.1 | Sistem harus dapat menerima unggahan file audio multitrack sekaligus, baik berupa *multiple selection audio*  maupun arsip ZIP/RAR. |
| FR-1.2 | Sistem harus memvalidasi apakah semua track memiliki panjang durasi dan titik awal yang identik. Jika ada track yang *offset* atau tidak sinkron, sistem memberi peringatan. |
| FR-1.3 | Sistem harus mendeteksi dan mengonversi format audio ke standar kerja internal tanpa mengubah data aslinya. |
| FR-1.4 | Sistem harus merender visual *waveform overview* untuk setiap track agar siap ditampilkan di antarmuka web. |
| FR-1.5 | Saat user mengunggah file multitrack, sistem menampilkan informasi estimasi kebutuhan token untuk sesi tersebut tanpa membatalkan proses unggahan. |
| FR-2.1 | Sistem harus secara otomatis mengklasifikasikan setiap track ke dalam kategori instrumen. |
| FR-2.2 | Sistem harus dapat mendeteksi dan mengelompokkan pasangan track yang saling berkaitan. |
| FR-2.3 | Pengguna harus dapat mengubah atau mengoreksi label instrumen jika hasil klasifikasi AI meleset. |
| FR-3.1 | Sistem dapat menghitung nilai koefisien korelasi fasa stereo pada setiap trek stereo. |
| FR-3.2 | Sistem dapat mendeteksi kondisi fasa terbalik mutlak pada trek stereo. |
| FR-3.3 | Sistem dapat mengukur tingkat degradasi energi audio akibat pembatalan fasa saat trek stereo di-*sum* ke mono. |
| FR-3.4 | Sistem dapat menganalisis korelasi fasa silang antar-trek berpasangan. |
| FR-3.5 | Sistem dapat mendeteksi pembatalan frekuensi rendah akibat selisih waktu mikrofon pada trek berpasangan. |
| FR-3.6 | Sistem dapat menganalisis rasio perbandingan energi *Mid/Side* untuk mengukur integritas lebar medan stereo. |
| FR-3.7 | Sistem dapat mendeteksi manipulasi *fake stereo* berbasis penundaan waktu pada sinyal audio. |
| FR-3.8 | Sistem dapat mendeteksi keberadaan *True-Peak Clipping* dan *Inter-Sample Peaks* (ISP) pada setiap trek audio. |
| FR-3.9 | Sistem dapat menghitung *Crest Factor* dan *Dynamic Range* guna mengidentifikasi kompresi berlebih pada trek audio. |
| FR-3.10 | Sistem dapat mendeteksi anomali *DC Offset* pada bentuk gelombang sinyal audio. |
| FR-3.11 | Sistem dapat mendeteksi penumpukan energi berlebih pada rentang frekuensi rendah-menengah. |
| FR-3.12 | Sistem dapat mendeteksi keberadaan getaran frekuensi subsonik pada trek non-bass. |
| FR-3.13 | Sistem dapat mendeteksi tabrakan frekuensi dominan antar-instrumen krusial. |
| FR-4.1 | Sistem harus menghasilkan skor kesehatan sesi berdasarkan agregasi bobot masalah teknis yang ditemukan. |
| FR-4.2 | Sistem dapat menampilkan laporan untuk setiap track yang memuat status kesehatan: *Critical*, *Warning*, atau *Clean*. |
| FR-4.3 | Sistem harus menyusun rekomendasi teks yang spesifik dan praktis untuk engineer. |
| FR-5.1 | Sistem dapat membalikkan polaritas fasa secara otomatis pada trek yang mengalami pembatalan fasa. |
| FR-5.2 | Sistem dapat menyelaraskan waktu mikrofon antar-trek berpasangan dalam skala milidetik untuk mengeliminasi *comb filtering*. |
| FR-5.3 | Sistem dapat mengubah trek *fake stereo* yang destruktif kembali menjadi format *true mono*. |
| FR-5.4 | Sistem dapat meregenerasi pelebaran stereo yang aman secara fasa pada trek yang bermasalah. |
| FR-5.5 | Sistem dapat menghilangkan anomali *DC Offset* pada gelombang audio ke titik nol. |
| FR-5.6 | Sistem dapat menerapkan filter pemotong frekuensi rendah secara otomatis pada trek non-bass untuk membersihkan *sub-rumble*. |
| FR-5.7 | Sistem harus dapat menyesuaikan gain setiap track agar memiliki *headroom* ideal untuk mixing. |
| FR-5.8 | Pengguna dapat memilih perbaikan mana yang ingin diaktifkan. |
| FR-6.1 | Pengguna dapat memutar seluruh trek audio secara sinkron melalui pemutar multitrack berbasis web yang dilengkapi kontrol fader volume, pan, solo, dan mute. |
| FR-6.2 | Pengguna dapat beralih mendengarkan perbandingan audio asli dan audio hasil perbaikan secara instan tanpa jeda. |
| FR-6.3 | Pengguna dapat memantau korelasi fasa dan lebar spasial stereo secara visual melalui tampilan *goniometer*. |
| FR-6.4 | Pengguna dapat menguji kompatibilitas mono seluruh sesi secara langsung menggunakan tombol *Mono Check*. |
| FR-6.5 | Pengguna dapat mengunduh seluruh paket stem hasil perbaikan dalam satu berkas arsip ZIP dengan format resolusi audio yang tetap terjaga. |
| FR-6.6 | Pengguna dapat mengunduh laporan diagnostik teknis sesi mixing dalam format dokumen PDF. |
| FR-7.1 | Sistem harus menyediakan dompet virtual untuk setiap user yang menyimpan saldo token secara *real-time*. |
| FR-7.2 | Sistem harus memvalidasi saldo token sebelum mengizinkan eksekusi tugas berat. |
| FR-7.3 | Sistem harus terintegrasi dengan *Payment Gateway* untuk memproses pembelian paket token. |
| FR-7.4 | Sistem harus memiliki *webhook listener* yang aman untuk mengonfirmasi pembayaran dan secara otomatis menambahkan saldo token ke *wallet* user. |
| FR-7.5 | Sistem harus memiliki *rules engine* untuk memotong saldo token berdasarkan parameter tertentu. |
| FR-7.6 | Sistem harus mencatat setiap Top-up dan Usage token ke dalam *database* yang *append-only*. |
| FR-7.7 | Sistem harus mampu melakukan refund token ke *wallet* user apabila sistem mengalami crash saat memproses audio. |
| FR-7.8 | Sistem dapat memberikan *free tier* untuk *user acquisition*, sebelum mereka harus membeli token premium. |

   2. ##  **Non Functional Requirements** {#non-functional-requirements}

| ID | Requirement Non Fungsional |
| :---- | :---- |
|  |  |
| NFR-01 | Perpindahan dengar perbandingan A/B antara audio asli dan hasil perbaikan pada peramban web harus terjadi secara instan dengan latensi di bawah 50 ms tanpa gangguan suara. |
| NFR-02 | Pemutaran seluruh trek multitrack secara simultan di peramban web harus sinkron sempurna dengan toleransi deviasi pergeseran antar-trek maksimal 1 sampel. |
| NFR-03 | Proses perbaikan audio tidak boleh merusak sinyal asli. |
| NFR-04 | Seluruh proses rendering perbaikan DSP tidak boleh menggeser waktu sinyal, sehingga semua trek hasil ekspor tetap mengunci tempo saat ditarik ke DAW. |
| NFR-05 | Model klasifikasi AI harus memiliki tingkat akurasi pengenalan instrumen minimal ≥ 80% pada dataset uji multitrack standar. |
| NFR-06 | Seluruh pengiriman data dan transfer berkas audio multitrack wajib dienkripsi saat transit menggunakan protokol TLS 1.2 atau TLS 1.3. |
| NFR-07 | Untuk melindungi kerahasiaan materi rekaman klien, seluruh berkas audio asli dan hasil perbaikan pada server harus dihapus permanen secara otomatis dalam waktu 24 hingga 48 jam setelah sesi selesai. |
| NFR-08 | Tautan unduhan berkas stem hasil perbaikan wajib menggunakan URL berbatas waktu dengan masa kadaluarsa maksimal 60 menit. |
| NFR-09 | Jika terjadi kegagalan pemrosesan di tengah proses perbaikan audio, sistem harus membatalkan transaksi dan mengembalikan saldo token pengguna secara utuh dalam waktu \< 5 detik. |
| NFR-10 | Sistem harus mampu menerima dan mengekstrak berkas multitrack dengan ukuran total hingga 2 GB per sesi tanpa mengalami timeout. |
| NFR-11 | Antarmuka web dan mesin Web Audio API harus berfungsi konsisten pada 4 peramban desktop utama. |
| NFR-12 | Tampilan visual antarmuka harus responsif untuk monitor studio dengan skala yang variatif. |

   3. ## **Use Case Diagram** {#use-case-diagram}

**![][image1]**

4. ## **Use Case Description** {#use-case-description}

| Use Case ID | UC-01 |  |
| :---- | :---- | :---- |
| **Use Case Name** | Register Akun Baru |  |
| **Process Owner** | Audio Engineer |  |
| **Date Created** | 28 September 2026 |  |
| **Purpose** | Mendaftarkan akun baru ke platform Polaris Audio serta menginisialisasi dompet token virtual dengan jatah kuota token awal. |  |
| **Overview** | Use case ini mendeskripsikan aktivitas pengguna baru saat mendaftarkan diri ke platform Polaris Audio. Pengguna mengisi identitas dasar berupa nama, alamat email, dan kata sandi pada formulir pendaftaran. Setelah data tervalidasi, sistem menyimpan akun ke basis data, secara otomatis membuat dompet virtual pengguna, mengisi saldo token selamat datang, dan mengarahkan pengguna ke dasbor utama. |  |
| **Cross Requirement** | FR-7.1, FR-7.8 |  |
| **Actor** | Audio Engineer |  |
| **Preconditions** | 1\. Pengguna memiliki alamat email aktif yang belum pernah terdaftar sebelumnya. 2\. Perangkat komputer pengguna terhubung ke jaringan internet. |  |
| **Postconditions** | 1\. Akun pengguna berhasil dibuat dan tersimpan di basis data sistem. 2\. Dompet virtual (*wallet*) akun terinisialisasi dengan saldo token gratis awal. 3\. Pengguna berhasil masuk dengan sesi aktif dan diarahkan ke halaman dasbor utama. |  |
| **Typical Course of Event** | **Aktor** | **Sistem** |
|  | 1\. Memilih tombol "Daftar / Register" pada halaman beranda. | 2\. Menampilkan formulir pendaftaran akun baru. |
|  | 3\. Memasukkan Nama Lengkap, Alamat Email, dan Kata Sandi pada formulir. |  |
|  | 4\. Menekan tombol "Daftar Akun". | 5\. Memvalidasi format email dan memastikan kata sandi memenuhi syarat keamanan. |
|  |  | 6\. Mendaftarkan akun baru ke dalam basis data sistem. |
|  |  | 7\. Membuat dompet token virtual (*wallet*) akun secara otomatis. |
|  |  | 8\. Menambahkan saldo token selamat datang (*welcome grant*) ke dompet pengguna. |
|  |  | 9\. Menerbitkan token sesi aman (JWT) dan mengarahkan pengguna ke halaman Dasbor Utama. |
|  | 10\. Berhasil masuk ke dasbor dan melihat nama profil beserta saldo token awal di sudut layar. |  |
| **Alternative Workflow** | **Pendaftaran Menggunakan Akun Google (Single Sign-On / OAuth):** Aktor memilih tombol *"Daftar dengan Google"*. Sistem mengarahkan ke layanan autentikasi Google, menerima data profil terverifikasi, membuat akun dan dompet token otomatis, lalu langsung mengarahkan ke dasbor utama tanpa perlu membuat kata sandi manual. |  |
| **Exceptional Workflow** | **1\. Alamat Email Sudah Terdaftar:** Jika email yang dimasukkan sudah tercatat di sistem, sistem menampilkan pesan peringatan: *"Alamat email sudah terdaftar. Silakan masuk atau gunakan tautan Lupa Kata Sandi"*. **2\. Kata Sandi Tidak Memenuhi Standar:** Jika kata sandi yang dimasukkan kurang dari batas minimal karakter (misal kurang dari 8 karakter) atau terlalu lemah, sistem menampilkan pesan: *"Kata sandi minimal 8 karakter dan harus mengandung kombinasi huruf serta angka"*. |  |

| Use Case ID | UC-02 |  |
| :---- | :---- | :---- |
| **Use Case Name** | Login ke Sistem |  |
| **Process Owner** | Audio Engineer |  |
| **Date Created** | 28 September 2026 |  |
| **Purpose** | Memverifikasi kredensial pengguna terdaftar dan mengaktifkan sesi kerja pengguna di platform Polaris Audio. |  |
| **Overview** | Use case ini mendeskripsikan aktivitas pengguna saat masuk ke akun Polaris Audio miliknya. Pengguna memasukkan alamat email dan kata sandi yang telah didaftarkan sebelumnya. Sistem akan memeriksa kecocokan kredensial, menerbitkan token sesi aman (JWT), memuat data saldo token terkini, dan mengarahkan pengguna ke halaman Dasbor Utama. |  |
| **Cross Requirement** | FR-7.1 |  |
| **Actor** | Audio Engineer |  |
| **Preconditions** | 1\. Pengguna telah memiliki akun yang terdaftar di Polaris Audio (UC-01). 2\. Perangkat komputer pengguna terhubung ke jaringan internet. |  |
| **Postconditions** | 1\. Kredensial pengguna berhasil diverifikasi oleh sistem. 2\. Sesi login aktif berbasis token JWT diterbitkan. 3\. Pengguna berhasil masuk ke Dasbor Utama dengan data akun dan saldo token termuat. |  |
| **Typical Course of Event** | **Aktor** | **Sistem** |
|  | 1\. Memilih tombol "Masuk / Login" pada halaman utama. | 2\. Menampilkan formulir login akun. |
|  | 3\. Memasukkan Alamat Email dan Kata Sandi. |  |
|  | 4\. Menekan tombol "Masuk". | 5\. Memvalidasi kecocokan email dan kata sandi pada basis data sistem. |
|  |  | 6\. Menerbitkan token sesi aktif (JWT) dan memuat informasi dompet token pengguna. |
|  |  | 7\. Mengarahkan pengguna ke halaman Dasbor Utama. |
|  | 8\. Berhasil masuk dan melihat dasbor sesi mixing aktif. |  |
| **Alternative Workflow** | **1\. Masuk Menggunakan Akun Google (Single Sign-On / OAuth):** Aktor memilih tombol *"Masuk dengan Google"*. Sistem melakukan otentikasi cepat via Google OAuth, mencocokkan akun di basis data, dan langsung membuka dasbor utama tanpa perlu memasukkan kata sandi manual. **2\. Mengaktifkan Fitur "Ingat Saya" (*Remember Me*):** Aktor mencentang kotak *"Ingat Saya"* sebelum menekan tombol masuk, sehingga sistem memperpanjang masa aktif token sesi di peramban agar pengguna tidak perlu login berulang kali. |  |
| **Exceptional Workflow** | **1\. Kredensial Email atau Kata Sandi Salah:** Jika kombinasi email atau kata sandi tidak cocok di basis data, sistem menolak akses dan memunculkan pesan peringatan: *"Email atau kata sandi tidak valid. Silakan periksa kembali"*. **2\. Pembatasan Percobaan Login Gagal (*Brute-force Protection*):** Jika pengguna gagal memasukkan kata sandi yang benar sebanyak 5 kali berturut-turut, sistem mengunci upaya login sementara selama 15 menit untuk melindungi akun dari serangan peretasan. |  |

| Use Case ID | UC-03 |  |
| :---- | :---- | :---- |
| **Use Case Name** | Mereset Kata Sandi |  |
| **Process Owner** | Audio Engineer |  |
| **Date Created** | 28 September 2026 |  |
| **Purpose** | Memfasilitasi pengguna yang lupa kata sandi untuk memulihkan akses akun secara aman melalui verifikasi tautan email. |  |
| **Overview** | Use case ini mendeskripsikan aktivitas ketika pengguna tidak dapat masuk ke akun Polaris Audio karena lupa kata sandi. Pengguna memasukkan alamat email terdaftar pada formulir pemulihan kata sandi. Sistem akan memverifikasi email, menghasilkan tautan verifikasi berbatas waktu, dan mengirimkannya ke kotak masuk email pengguna. Pengguna kemudian membuka tautan tersebut untuk memasukkan kata sandi baru yang memenuhi kriteria keamanan. |  |
| **Cross Requirement** | \- |  |
| **Actor** | Audio Engineer |  |
| **Preconditions** | 1\. Pengguna telah memiliki akun yang terdaftar di Polaris Audio (UC-01). 2\. Pengguna memiliki akses ke kotak masuk email yang terdaftar pada akun tersebut. |  |
| **Postconditions** | 1\. Kata sandi lama digantikan oleh kata sandi baru yang telah dienkripsi di basis data. 2\. Seluruh sesi login aktif di perangkat lain otomatis dinonaktifkan demi alasan keamanan. 3\. Pengguna dapat login kembali ke sistem menggunakan kata sandi baru (UC-02). |  |
| **Typical Course of Event** | **Aktor** | **Sistem** |
|  | 1\. Memilih tautan "Lupa Kata Sandi?" pada formulir login (UC-02). | 2\. Menampilkan formulir permintaan pemulihan kata sandi. |
|  | 3\. Memasukkan alamat email yang terdaftar pada akun. |  |
|  | 4\. Menekan tombol "Kirim Tautan Pemulihan". | 5\. Memvalidasi keberadaan email di basis data pengguna. |
|  |  | 6\. Menghasilkan token pemulihan berbatas waktu dan mengirimkan tautan reset ke email pengguna. |
|  |  | 7\. Menampilkan pesan notifikasi: *"Tautan pemulihan telah dikirim ke email Anda. Silakan periksa kotak masuk"*. |
|  | 8\. Membuka kotak masuk email dan mengklik tautan pemulihan yang dikirimkan oleh sistem. | 9\. Memvalidasi keabsahan token dan menampilkan halaman pembuatan kata sandi baru. |
|  | 10\. Memasukkan kata sandi baru dan mengonfirmasinya pada kolom yang tersedia. |  |
|  | 11\. Menekan tombol "Perbarui Kata Sandi". | 12\. Memvalidasi kekuatan kata sandi, mengenkripsi, dan memperbarui kata sandi di basis data. |
|  |  | 13\. Menampilkan pesan sukses *"Kata sandi berhasil diperbarui"* dan mengarahkan pengguna kembali ke halaman login (UC-02). |
| **Alternative Workflow** | **Membatalkan Permintaan Reset:** Jika aktor tiba-tiba mengingat kata sandinya saat berada di halaman input email, aktor dapat memilih tombol *"Kembali ke Halaman Login"* untuk membatalkan proses tanpa mengirim email pemulihan. |  |
| **Exceptional Workflow** | **1\. Alamat Email Tidak Ditemukan:** Jika email yang dimasukkan tidak terdaftar di sistem, sistem memunculkan pesan peringatan: *"Alamat email tidak terdaftar di sistem Polaris Audio"*. **2\. Tautan Pemulihan Kedaluwarsa (*Token Expired*):** Jika aktor mengklik tautan setelah batas waktu 30 menit terlampaui, sistem menolak akses dan menampilkan pesan: *"Tautan pemulihan telah kedaluwarsa. Silakan ajukan permintaan pemulihan kata sandi baru"*. **3\. Konfirmasi Kata Sandi Tidak Cocok:** Jika kolom konfirmasi kata sandi tidak sama persis dengan kolom kata sandi baru, sistem menolak penyimpanan dan meminta aktor mengetik ulang dengan benar. |  |

| Use Case ID | UC-04 |  |
| :---- | :---- | :---- |
| **Use Case Name** | Mengubah Profil |  |
| **Process Owner** | Audio Engineer |  |
| **Date Created** | 28 September 2026 |  |
| **Purpose** | Memfasilitasi pengguna untuk memperbarui informasi data pribadi dan identitas akun pada platform Polaris Audio. |  |
| **Overview** | Use case ini mendeskripsikan aktivitas pengguna saat memperbarui informasi data akun mereka, seperti nama lengkap, nama tampilan, dan preferensi akun. Pengguna mengakses menu pengaturan akun, menyunting data yang diinginkan pada formulir profil, lalu menyimpannya ke sistem agar data identitas pengguna selalu mutakhir. |  |
| **Cross Requirement** | \- |  |
| **Actor** | Audio Engineer |  |
| **Preconditions** | 1\. Pengguna telah berhasil masuk (*login*) ke dalam sistem (UC-02). 2\. Pengguna membuka halaman menu Pengaturan Profil. |  |
| **Postconditions** | 1\. Informasi profil pengguna berhasil diperbarui di basis data sistem. 2\. Nama tampilan terbaru langsung diperbarui pada bilah navigasi dan dasbor pengguna. |  |
| **Typical Course of Event** | **Aktor** | **Sistem** |
|  | 1\. Memilih menu avatar atau "Pengaturan Profil" di sudut kanan atas layar. | 2\. Menampilkan formulir profil pengguna yang memuat data saat ini (Nama Lengkap, Alamat Email, dan Nama Tampilan). |
|  | 3\. Menyunting data pada kolom properti yang dipilih. |  |
|  | 4\. Menekan tombol "Simpan Perubahan". | 5\. Memvalidasi kelengkapan data yang diinput. |
|  |  | 6\. Memperbarui data profil pengguna ke dalam basis data sistem. |
|  |  | 7\. Menampilkan pesan notifikasi sukses: *"Profil berhasil diperbarui"*. |
|  | 8\. Melihat properti profil terbaru telah diperbarui di antarmuka sistem. |  |
| **Alternative Workflow** | **Membatalkan Penyuntingan:** Jika aktor telah mengubah teks pada formulir profil namun memutuskan untuk tidak jadi menyimpannya, aktor dapat menekan tombol *"Batal"*, dan sistem akan mengembalikan isian formulir ke data awal tanpa menyimpan perubahan. |  |
| **Exceptional Workflow** | **1\. Kolom Nama Lengkap Dikosongkan:** Jika aktor menghapus nama dan membiarkan kolom nama lengkap kosong saat menekan tombol simpan, sistem menolak pembaruan dan menampilkan pesan peringatan: *"Nama lengkap wajib diisi"*. |  |

| Use Case ID | UC-05 |  |
| :---- | :---- | :---- |
| **Use Case Name** | Mengubah Kata Sandi |  |
| **Process Owner** | Audio Engineer |  |
| **Date Created** | 28 September 2026 |  |
| **Purpose** | Memfasilitasi pengguna yang telah masuk (*login*) untuk mengganti kata sandi akun demi menjaga keamanan akun secara berkala. |  |
| **Overview** | Use case ini mendeskripsikan aktivitas pengguna saat memperbarui kata sandi akun melalui tab Keamanan pada menu Pengaturan Akun. Pengguna memasukkan kata sandi yang sedang digunakan saat ini (*current password*), kata sandi baru, dan konfirmasi kata sandi baru. Sistem memvalidasi kecocokan kata sandi lama, memeriksa kriteria kekuatan kata sandi baru, lalu menyimpannya secara terenkripsi ke basis data sistem. |  |
| **Cross Requirement** | \- |  |
| **Actor** | Audio Engineer |  |
| **Preconditions** | 1\. Pengguna telah berhasil masuk (*login*) ke dalam sistem (UC-02). 2\. Pengguna membuka tab "Keamanan" pada halaman Pengaturan Akun. |  |
| **Postconditions** | 1\. Kata sandi akun berhasil diperbarui di basis data sistem dengan enkripsi baru. 2\. Kata sandi baru langsung aktif untuk digunakan pada sesi login berikutnya. |  |
| **Typical Course of Event** | **Aktor** | **Sistem** |
|  | 1\. Memilih tab "Keamanan" pada halaman Pengaturan Akun. | 2\. Menampilkan formulir pergantian kata sandi (Kata Sandi Saat Ini, Kata Sandi Baru, dan Konfirmasi Kata Sandi Baru). |
|  | 3\. Memasukkan kata sandi lama pada kolom "Kata Sandi Saat Ini". |  |
|  | 4\. Memasukkan kata sandi baru dan mengetik ulang pada kolom "Konfirmasi Kata Sandi Baru". |  |
|  | 5\. Menekan tombol "Simpan Kata Sandi". | 6\. Memvalidasi kecocokan kata sandi lama dengan data yang tersimpan di basis data. |
|  |  | 7\. Memverifikasi bahwa kata sandi baru memenuhi syarat keamanan dan cocok dengan kolom konfirmasi. |
|  |  | 8\. Mengenkripsi kata sandi baru dan memperbarui data akun di basis data. |
|  |  | 9\. Menampilkan pesan notifikasi sukses: *"Kata sandi berhasil diperbarui"*. |
| **Alternative Workflow** | **Membatalkan Pergantian Kata Sandi:** Jika aktor memutuskan tidak jadi mengubah kata sandi, aktor dapat menekan tombol *"Batal"* atau berpindah ke menu lain untuk mengosongkan isian formulir tanpa menyimpan perubahan. |  |
| **Exceptional Workflow** | **1\. Kata Sandi Lama Salah:** Jika kata sandi saat ini yang dimasukkan tidak cocok dengan basis data sistem, sistem menolak pergantian dan menampilkan pesan peringatan: *"Kata sandi saat ini salah. Silakan coba lagi"*. **2\. Konfirmasi Kata Sandi Baru Tidak Cocok:** Jika isian pada kolom konfirmasi kata sandi tidak sama persis dengan kolom kata sandi baru, sistem menampilkan pesan: *"Konfirmasi kata sandi baru tidak cocok"*. **3\. Kata Sandi Baru Sama dengan Kata Sandi Lama:** Jika kata sandi baru identik dengan kata sandi yang sedang digunakan saat ini, sistem menampilkan pesan: *"Kata sandi baru tidak boleh sama dengan kata sandi lama demi alasan keamanan"*. **4\. Kata Sandi Baru Terlalu Lemah:** Jika kata sandi baru kurang dari 8 karakter atau tidak mengandung kombinasi angka dan huruf, sistem menampilkan pesan penolakan dan meminta kata sandi yang lebih kuat. |  |

| Use Case ID | UC-06 |  |
| :---- | :---- | :---- |
| **Use Case Name** | Memeriksa Saldo Token |  |
| **Process Owner** | Audio Engineer |  |
| **Date Created** | 27 September 2026 |  |
| **Purpose** | Memberikan visibilitas langsung bagi audio engineer mengenai jumlah sisa saldo token pada dompet virtual (*wallet*) secara *real-time* sebelum mengeksekusi pemrosesan sesi audio. |  |
| **Overview** | Use case ini mendeskripsikan aktivitas engineer saat memantau saldo token akun mereka, baik melalui lencana (*badge*) saldo di bilah menu navigasi atas maupun pada halaman khusus Dompet Token (*Token Wallet*). Sistem menampilkan sisa token aktif, keterangan konversi biaya (misal: 1 token untuk 1 trek perbaikan), serta memberikan peringatan jika saldo token tidak cukup untuk memproses sesi yang sedang dikerjakan. |  |
| **Cross Requirement** | FR-1.5, FR-7.1, FR-7.2 |  |
| **Actor** | Audio Engineer |  |
| **Preconditions** | Pengguna sudah berhasil masuk (*login*) ke sistem (UC-02). |  |
| **Postconditions** | Pengguna mengetahui sisa saldo token aktif miliknya secara akurat. Pengguna dapat memastikan apakah saldo cukup untuk melanjutkan proses unggah sesi atau perlu melakukan pembelian token (UC-07). |  |
| **Typical Course of Event** | **Aktor** | **Sistem** |
|  | 1\. Memilih ikon atau menu "Dompet Token" pada bilah navigasi atas. | 2\. Mengambil data saldo terbaru dari basis data akun. |
|  |  | 3\. Menampilkan halaman Dasbor Dompet Token yang memuat angka saldo aktif (contoh: *"Saldo: 18 Token"*). |
|  |  | 4\. Menampilkan ringkasan aturan penggunaan (contoh: *"1 Token \= Perbaikan 1 Trek Audio"*). |
|  | 5\. Memeriksa sisa saldo yang tersedia. |  |
|  | 6\. Menutup panel dompet untuk kembali ke pekerjaan audio, atau memilih tombol "Top-up Token" jika ingin menambah saldo. | 7\. Mengarahkan pengguna sesuai menu yang dipilih. |
| **Alternative Workflow** | **1\. Pemeriksaan Otomatis saat Mengunggah Sesi (*Pre-flight Check*):** Saat aktor mengunggah berkas multitrack (UC-10), sistem secara otomatis membandingkan jumlah file trek dengan saldo token pengguna di layar (contoh: \*"Sesi ini butuh 12 Token Saldo Anda: 18 Token"\*), sehingga aktor tidak perlu membuka halaman dompet secara terpisah. **2\. Muncul Pilihan Klaim Token Gratis:** Jika ada jatah kuota harian atau bonus promosi yang belum diambil, sistem memunculkan tombol kecil *"Klaim Token Gratis"* tepat di samping angka saldo (berlanjut ke alur UC-09). |  |
| **Exceptional Workflow** | **Peringatan Saldo Habis / Tidak Cukup (*Zero Balance Warning*):** Jika saldo token bernilai 0 atau lebih kecil dari jumlah trek yang ingin diproses pada sesi aktif, sistem menandai angka saldo dengan warna merah dan memunculkan tombol peringatan *"Saldo Token Tidak Cukup"* yang langsung menghubungkan aktor ke alur pembelian paket token (UC-07). |  |

| Use Case ID | UC-07 |  |
| :---- | :---- | :---- |
| **Use Case Name** | Melakukan Pembelian Paket Token |  |
| **Process Owner** | Audio Engineer |  |
| **Date Created** | 27 September 2026 |  |
| **Purpose** | Memfasilitasi pengguna untuk membeli paket kuota token pemrosesan audio secara aman melalui integrasi *Payment Gateway* dan menerima penambahan saldo instan setelah pembayaran terkonfirmasi. |  |
| **Overview** | Use case ini mendeskripsikan alur transaksi saat pengguna melakukan pengisian ulang (*top-up*) saldo dompet mereka. Pengguna memilih paket kuota token yang tersedia (misal: Paket 20, 50, atau 100 Token), lalu memilih saluran pembayaran (seperti QRIS, Transfer Bank/Virtual Account, Kartu Kredit, atau E-Wallet). Sistem berkomunikasi dengan *Payment Gateway* untuk memproses transaksi. Segera setelah pembayaran berhasil diverifikasi melalui *webhook*, saldo token otomatis bertambah dan dicatat di riwayat mutasi. |  |
| **Cross Requirement** | FR-7.3, FR-7.4, FR-7.6 |  |
| **Actor** | Audio Engineer *(didukung sistem eksternal: Payment Gateway)* |  |
| **Preconditions** | 1\. Pengguna sudah berhasil masuk (*login*) ke sistem (UC-02). 2\. Pengguna mengakses menu pembelian token dari Dasbor Dompet atau peringatan saldo kurang. |  |
| **Postconditions** | 1\. Pembayaran berhasil terverifikasi oleh *Payment Gateway*. 2\. Saldo token di dompet virtual pengguna bertambah secara instan (*real-time*). 3\. Riwayat transaksi *top-up* tercatat permanen pada sistem (UC-08). 4\. Bukti tanda terima digital (*receipt*) dikirimkan ke email pengguna. |  |
| **Typical Course of Event** | **Aktor** | **Sistem** |
|  | 1\. Memilih tombol "Top-up / Beli Token" pada halaman dompet. | 2\. Menampilkan daftar paket bundle token (contoh: 20 Token, 50 Token, 100 Token) beserta harga dan detail penawaran. |
|  | 3\. Memilih paket token yang diinginkan (misal: Paket 50 Token). | 4\. Menampilkan jendela pembayaran (*checkout*) dan daftar metode pembayaran yang tersedia. |
|  | 5\. Memilih saluran pembayaran (misal: QRIS atau Virtual Account Bank). | 6\. Menghubungi *Payment Gateway* untuk menerbitkan kode QR atau nomor rekening pembayaran resmi, lalu menampilkannya di layar. |
|  | 7\. Menyelesaikan pembayaran melalui aplikasi perbankan atau dompet digital miliknya. |  |
|  |  | 8\. Menerima notifikasi konfirmasi pembayaran sukses dari *Payment Gateway* melalui *webhook listener*. |
|  |  | 9\. Menambahkan jumlah token ke saldo dompet akun pengguna dan mencatat mutasi transaksi ke buku besar (*ledger*). |
|  |  | 10\. Memperbarui tampilan layar dengan notifikasi sukses: *"Pembayaran Berhasil\! 50 Token telah ditambahkan ke saldo Anda"*. |
|  | 11\. Melihat saldo token telah bertambah dan siap kembali menggunakan fitur pemrosesan audio. |  |
| **Alternative Workflow** | **Pembayaran Menggunakan Kartu Kredit / Debit:** Jika aktor memilih metode Kartu Kredit, aktor mengisi informasi nomor kartu, masa berlaku, dan kode CVV pada formulir aman, lalu menyelesaikan otentikasi OTP (3D-Secure). Sistem langsung menerima verifikasi pembayaran instan tanpa perlu memindai kode QR. |  |
| **Exceptional Workflow** | **1\. Batas Waktu Pembayaran Habis (*Expired Transaction*):** Jika aktor tidak menyelesaikan transfer dalam batas waktu yang ditentukan (misal dalam 15–30 menit), tagihan otomatis dibatalkan oleh *Payment Gateway*. Sistem menampilkan notifikasi: *"Waktu pembayaran telah habis. Silakan ulangi pesanan baru"* dan tidak ada perubahan saldo pada dompet. **2\. Transaksi Ditolak (*Payment Declined*):** Jika pembayaran kartu kredit ditolak oleh pihak bank penerbit (misal limit tidak cukup atau kendala otorisasi), sistem menampilkan pesan: *"Transaksi gagal atau ditolak bank. Silakan coba metode pembayaran lain"*. |  |

| Use Case ID | UC-08 |  |
| :---- | :---- | :---- |
| **Use Case Name** | Memeriksa Riwayat Transaksi |  |
| **Process Owner** | Audio Engineer |  |
| **Date Created** | 27 September 2026 |  |
| **Purpose** | Memberikan transparansi mutasi kuota token bagi pengguna dengan menyajikan catatan lengkap mengenai riwayat isi ulang (*top-up*), pemotongan token per sesi mixing, dan pengembalian dana (*refund*). |  |
| **Overview** | Use case ini mendeskripsikan aktivitas pengguna saat memeriksa catatan mutasi token pada tab Riwayat Transaksi di menu Dompet Token. Sistem menampilkan daftar catatan transaksi permanen yang diurutkan berdasarkan waktu, lengkap dengan keterangan tanggal, jenis aktivitas (Top-up, Pemakaian Sesi, atau Pengembalian Token), nama proyek terkait, jumlah token (bertambah/berkurang), serta sisa saldo setelah transaksi. Engineer juga dapat mengunduh bukti tanda terima (*receipt*) untuk pencatatan biaya studio. |  |
| **Cross Requirement** | FR-7.6, FR-7.7 |  |
| **Actor** | Audio Engineer |  |
| **Preconditions** | 1\. Pengguna sudah berhasil masuk (*login*) ke sistem (UC-02). 2\. Pengguna membuka tab "Riwayat Transaksi" pada halaman Dompet Token. |  |
| **Postconditions** | 1\. Pengguna mendapatkan informasi yang jelas dan transparan mengenai alur masuk dan keluar saldo token mereka. 2\. Seluruh riwayat transaksi terbukti akurat dan dapat digunakan untuk pembukuan operasional studio. |  |
| **Typical Course of Event** | **Aktor** | **Sistem** |
|  | 1\. Memilih tab "Riwayat Transaksi" pada halaman Dompet Token. | 2\. Mengambil data catatan mutasi dari basis data akun pengguna. |
|  |  | 3\. Menampilkan tabel riwayat transaksi terbaru yang memuat kolom: Tanggal & Waktu, Jenis Aktivitas, Keterangan Sesi/Paket, Jumlah Token (+/-), dan Sisa Saldo. |
|  | 4\. Memeriksa rincian pemakaian token pada baris transaksi tertentu (contoh: *"Pemakaian 12 Token \- Proyek Single Rock"*). |  |
|  | 5\. Memilih baris transaksi tersebut untuk melihat rincian lebih lengkap. | 6\. Menampilkan jendela detail yang memuat ID Transaksi unik, daftar trek yang diproses, dan stempel waktu eksekusi. |
|  | 7\. Menutup jendela detail setelah selesai melakukan pemeriksaan. | 8\. Mengembalikan tampilan ke tabel riwayat transaksi utama. |
| **Alternative Workflow** | **1\. Menyaring Tampilan Transaksi (*Filter History*):** Aktor dapat menggunakan filter kategori untuk hanya menampilkan: *"Semua"*, *"Hanya Pembelian (Top-up)"*, *"Hanya Pemakaian Sesi"*, atau *"Hanya Pengembalian (Refund)"* guna mempercepat penelusuran data. **2\. Mengunduh Bukti Pembayaran Digital (Invoice/Receipt PDF):** Pada baris transaksi isi ulang token (UC-07), aktor dapat menekan tombol *"Unduh Tanda Terima"* untuk menyimpan berkas PDF kuitansi resmi sebagai bukti pengeluaran studio. |  |
| **Exceptional Workflow** | **Transparansi Log Pengembalian Token (*Auto-Refund Record*):** Jika sebelumnya pernah terjadi kegagalan server saat merender audio (pada UC-15), sistem menampilkan baris mutasi khusus berwarna hijau dengan label: *"\[Refund Otomatis\] Pengembalian Token (+X Token) \- Gangguan Pemrosesan Sesi"*, sehingga aktor dapat memastikan bahwa hak kuotanya tidak hilang secara sia-sia. |  |

| Use Case ID | UC-09 |  |
| :---- | :---- | :---- |
| **Use Case Name** | Mengklaim Jatah Token Gratis |  |
| **Process Owner** | Audio Engineer |  |
| **Date Created** | 27 September 2026 |  |
| **Purpose** | Memberikan insentif kepada pengguna melalui klaim kuota token harian gratis (*daily grant*) atau bonus uji coba awal (*freemium tier*) agar dapat mencoba fitur perbaikan audio tanpa harus langsung membeli paket token berbayar. |  |
| **Overview** | Use case ini mendeskripsikan aktivitas saat pengguna memanfaatkan kuota token gratis yang disediakan platform. Pengguna yang memiliki jatah klaim harian (misal: 1 token gratis setiap 24 jam) atau pengguna baru dapat menekan tombol klaim pada halaman Dasbor atau Dompet Token. Sistem akan memeriksa apakah jatah hari tersebut masih tersedia, menambahkan token ke saldo akun, mencatat mutasi gratis ke riwayat transaksi, dan mengaktifkan penghitung waktu mundur (*cooldown timer*) untuk jadwal klaim berikutnya. |  |
| **Cross Requirement** | FR-7.8, FR-7.1, FR-7.6 |  |
| **Actor** | Audio Engineer |  |
| **Preconditions** | 1\. Pengguna sudah berhasil masuk (*login*) ke sistem (UC-02). 2\. Pengguna memiliki hak klaim token gratis yang sedang aktif (belum pernah mengklaim pada hari yang bersangkutan). |  |
| **Postconditions** | 1\. Saldo token di dompet virtual pengguna bertambah secara instan. 2\. Status klaim gratis harian terkunci hingga siklus hari berikutnya dimulai. 3\. Catatan penambahan token tercatat permanen di riwayat mutasi transaksi (UC-08). |  |
| **Typical Course of Event** | **Aktor** | **Sistem** |
|  | 1\. Membuka halaman Dasbor Utama atau menu Dompet Token. | 2\. Memeriksa status akun dan mendeteksi ketersediaan jatah klaim gratis harian. |
|  |  | 3\. Menampilkan tombol aktif *"Klaim 1 Token Gratis Hari Ini"*. |
|  | 4\. Menekan tombol "Klaim 1 Token Gratis Hari Ini". | 5\. Memvalidasi bahwa pengguna belum melakukan klaim dalam kurun waktu 24 jam terakhir. |
|  |  | 6\. Menambahkan 1 token ke saldo dompet akun pengguna. |
|  |  | 7\. Mencatat transaksi kredit di buku besar dengan keterangan *"\[Klaim Harian\] Jatah Token Gratis"*. |
|  |  | 8\. Mengubah status tombol menjadi nonaktif dan memunculkan penghitung waktu mundur (*cooldown timer*) menuju waktu klaim berikutnya. |
|  |  | 9\. Menampilkan notifikasi sukses: *"Selamat\! 1 Token gratis berhasil ditambahkan ke saldo Anda"*. |
|  | 10\. Melihat saldo token telah bertambah dan siap digunakan untuk memproses audio. |  |
| **Alternative Workflow** | **Pemberian Bonus Registrasi Otomatis (*Welcome Grant*):** Bagi pengguna yang baru pertama kali mendaftar akun (UC-01), sistem secara otomatis mengkreditkan 3 token bonus selamat datang langsung ke dompet saat login perdana, tanpa pengguna harus menekan tombol klaim secara manual. |  |
| **Exceptional Workflow** | **Jatah Token Hari Ini Sudah Pernah Diklaim:** Jika aktor mencoba mengklaim kembali sebelum waktu *cooldown* berakhir (misal membuka beberapa tab peramban sekaligus), sistem menolak permintaan penambahan saldo dan menampilkan pesan: *"Anda sudah mengklaim jatah token gratis hari ini. Silakan kembali besok"* disertai sisa waktu tunggu hingga reset harian. |  |

| Use Case ID | UC-10 |  |
| :---- | :---- | :---- |
| **Use Case Name** | Mengunggah Sesi Mixing |  |
| **Process Owner** | Audio Engineer |  |
| **Date Created** | 27 September 2026 |  |
| **Purpose** | Menerima dan memvalidasi berkas audio multitrack dari pengguna ke dalam sistem untuk persiapan analisis fasa dan perbaikan sesi mixing. |  |
| **Overview** | Use case ini mendeskripsikan alur saat engineer mengunggah berkas stem atau multitrack lagu ke Polaris Audio. Engineer dapat memilih banyak file sekaligus (WAV, FLAC, AIFF) atau satu file arsip ZIP. Sistem akan memeriksa kecukupan token, memvalidasi keselarasan durasi trek, membuat gambar gelombang (*waveform*), dan menyiapkan sesi untuk tahap analisis diagnostik. |  |
| **Cross Requirement** | FR-1.1, FR-1.2, FR-1.3, FR-1.4, FR-1.5 |  |
| **Actor** | Audio Engineer |  |
| **Preconditions** | Pengguna sudah login ke akun Polaris Audio. Saldo token mencukupi untuk jumlah trek yang akan diproses. Berkas audio multitrack tersedia di komputer pengguna. |  |
| **Postconditions** | Berkas audio multitrack berhasil terunggah dan tersimpan sementara di server. Tampilan bentuk gelombang (*waveform*) selesai dirender di layar. Sesi mixing baru berhasil dibuat dan siap dianalisis. |  |
| **Typical Course of Event** | **Aktor** | **Sistem** |
|  | 1\. Memilih tombol "Unggah Sesi Baru". | 2\. Menampilkan area unggah berkas dan informasi saldo token aktif. |
|  | 3\. Memilih atau menarik (*drag-and-drop*) file-file audio multitrack (atau satu file ZIP) ke area unggah. | 4\. Sistem menerima berkas dan menampilkan informasi jumlah file yang diunggah serta status saldo token saat ini. |
|  |  | 5\. Menjalankan proses unggah sambil menampilkan bilah kemajuan (*progress bar*). |
|  |  | 6\. Memeriksa keselarasan durasi dan titik awal antar trek (*Include: Memverifikasi Integritas & Sinkronisasi Sesi*). |
|  |  | 7\. Menampilkan daftar trek yang berhasil diunggah beserta visual gelombangnya (*waveform*). |
|  | 8\. Menekan tombol "Lanjutkan ke Analisis". | 9\. Menyimpan sesi dan mengarahkan pengguna ke halaman hasil diagnostik mixing. |
| **Exceptional Workflow** | **Format Berkas Tidak Sesuai atau Rusak:** Jika sistem mendeteksi ada file non-audio atau file WAV yang rusak/korup, sistem menolak file tersebut, menandainya dengan warna merah di daftar, dan meminta pengguna mengunggah file yang benar.  **Koneksi Internet Terputus:** Jika jaringan internet terputus di tengah proses unggah, sistem menampilkan tombol *"Coba Lagi"* tanpa mengurangi saldo token pengguna. |  |

| Use Case ID | UC-11 |  |
| :---- | :---- | :---- |
| **Use Case Name** | Memverifikasi Integritas & Sinkronisasi Sesi |  |
| **Process Owner** | Audio Engineer |  |
| **Date Created** | 27 September 2026 |  |
| **Purpose** | Memastikan seluruh trek audio multitrack yang diunggah memiliki keselarasan titik awal (*zero-aligned*), durasi yang sinkron, dan format teknis yang seragam sebelum dianalisis. |  |
| **Overview** | Use case ini mendeskripsikan proses pengecekan otomatis terhadap berkas yang baru saja diunggah. Sistem akan membandingkan durasi setiap trek untuk memastikan audio diekspor dari titik awal (detik 0\) yang sama, memeriksa konsistensi *sample rate*, serta mendeteksi apakah ada trek yang kosong (hening total). Hasil verifikasi ini memastikan tidak ada data yang meleset saat dianalisis oleh AI dan DSP. |  |
| **Cross Requirement** | FR-1.2, FR-1.3 |  |
| **Actor** | Audio Engineer |  |
| **Preconditions** | Berkas audio multitrack telah selesai diunggah (dari alur UC-10). Metadata dasar audio (durasi, *sample rate*, jumlah channel) telah terbaca oleh sistem. |  |
| **Postconditions** | Status sinkronisasi seluruh trek terverifikasi. Format teknis audio telah dinormalisasi atau siap diproses. Sistem menghitung total trek aktif yang valid dan menetapkan kalkulasi final kebutuhan token untuk sesi ini. |  |
| **Typical Course of Event** | **Aktor** | **Sistem** |
|  |  | 1\. Memulai proses verifikasi otomatis segera setelah seluruh file selesai diunggah. |
|  |  | 2\. Memeriksa kesamaan panjang durasi dan titik awal seluruh trek. |
|  |  | 3\. Memeriksa keseragaman *sample rate* dan *bit depth* antar trek. |
|  |  | 4\. Memindai keberadaan sinyal suara untuk memastikan tidak ada trek yang hening total (*empty file*). |
|  |  | 5\. Menampilkan tanda centang hijau (*"Semua Trek Sinkron & Terverifikasi"*) pada setiap baris trek. |
|  | 6\. Meninjau ringkasan hasil verifikasi di layar. |  |
|  | 7\. Mengonfirmasi untuk melanjutkan ke proses berikutnya. | 8\. Mengunci sesi dan mempersiapkan data untuk proses klasifikasi AI. |
| **Alternative Workflow** | **Perbedaan Sample Rate Campuran:** Jika sistem mendeteksi ada sebagian trek dengan *sample rate* 44.1 kHz dan sebagian 48 kHz, sistem menampilkan opsi otomatis: *"Sesuaikan Sample Rate ke 48 kHz"*. Aktor menyetujui opsi tersebut, dan sistem melakukan *resampling* internal tanpa mengubah nada atau kecepatan lagu. |  |
| **Exceptional Workflow** | **Durasi Trek Tidak Sinkron (*Offset Detected*):** Jika ada satu atau beberapa trek yang durasinya jauh lebih pendek (indikasi klien tidak mengekspor dari detik awal), sistem memberi label peringatan oranye *"Durasi Berbeda/Tidak Sinkron"*. Sistem memberi pilihan kepada aktor untuk: (a) Mengabaikan dan tetap lanjut, atau (b) Menghapus trek tersebut untuk diganti dengan file yang benar. **Berkas Hening Total (*Empty Audio*):** Jika sistem mendeteksi trek berisi keheningan digital 100% tanpa suara sama sekali, sistem menampilkan peringatan *"Trek Kosong"* dan menyarankan aktor menghapus trek tersebut agar tidak membuang token pemrosesan. |  |

| Use Case ID | UC-12 |  |
| :---- | :---- | :---- |
| **Use Case Name** | Mengoreksi Label & Pasangan Track Secara Manual |  |
| **Process Owner** | Audio Engineer |  |
| **Date Created** | 27 September 2026 |  |
| **Purpose** | Memberikan kendali bagi audio engineer untuk memeriksa, mengubah label jenis instrumen, dan mengatur ulang pasangan trek (*multi-mic pairing*) yang diprediksi oleh AI. |  |
| **Overview** | Setelah sistem selesai mengklasifikasi instrumen secara otomatis menggunakan AI (misalnya menandai *Kick*, *Snare*, *Bass*, atau *Vocal*) dan mendeteksi pasangan mikrofon yang berkaitan, engineer dapat meninjau hasilnya. Jika ada tebakan AI yang meleset atau pasangan trek yang belum terhubung, engineer dapat mengoreksinya dengan mudah sebelum sistem menganalisis fasa antar-trek. |  |
| **Cross Requirement** | FR-2.1, FR-2.2, FR-2.3 |  |
| **Actor** | Audio Engineer |  |
| **Preconditions** | Berkas sesi telah selesai diverifikasi pada UC-11. AI telah selesai menjalankan klasifikasi instrumen awal dan pembuatan kelompok pasangan trek otomatis. |  |
| **Postconditions** | Label instrumen pada setiap trek terkonfirmasi benar oleh engineer. Hubungan pasangan trek (*multi-mic pairing*) terdefinisi dengan tepat. Konfigurasi trek tersimpan dan siap diproses ke tahap analisis diagnostik fasa. |  |
| **Typical Course of Event** | **Aktor** | **Sistem** |
|  |  | 1\. Menampilkan daftar seluruh trek beserta hasil tebakan instrumen AI dan ikon pasangan trek terkait. |
|  | 2\. Memeriksa kesesuaian label instrumen dan kelompok pasangan trek. |  |
|  | 3\. Memilih menu *dropdown* pada trek yang labelnya ingin diubah. | 4\. Menampilkan daftar kategori instrumen yang tersedia (*Drums*, *Bass*, *Guitars*, *Vocals*, *Keys*, dll.). |
|  | 5\. Memilih kategori instrumen yang tepat (misal: mengubah dari *Other* menjadi *Acoustic Guitar*). | 6\. Memperbarui label instrumen pada baris trek tersebut. |
|  | 7\. Memilih opsi "Pasangkan Trek" untuk menghubungkan dua trek mikrofon sejenis (misal: menghubungkan *Snare Top* dengan *Snare Bottom*). | 8\. Menghubungkan kedua trek secara visual dan menandainya sebagai pasangan analisis fasa. |
|  | 9\. Menekan tombol "Simpan & Lanjutkan ke Diagnostik". | 10\. Menyimpan seluruh pembaruan metadata dan memicu mesin analisis fasa serta diagnostik DSP. |
| **Alternative Workflow** | **1\. Seluruh Tebakan AI Sudah Tepat:** Jika seluruh label dan pasangan trek hasil tebakan AI sudah akurat, aktor tidak perlu mengubah apa pun dan dapat langsung menekan tombol "Lanjutkan ke Diagnostik". **2\. Membatalkan Pasangan Trek (*Unpair*):** Jika AI salah mengelompokkan dua trek independen sebagai pasangan, aktor dapat menekan tombol silang/lepas (*Unpair*) pada ikon pasangan, dan sistem akan memisahkan analisis fasa kedua trek tersebut. |  |
| **Exceptional Workflow** | **Pasangan Trek Tidak Masuk Akal:** Jika aktor mencoba memasangkan dua instrumen yang sama sekali tidak berhubungan untuk analisis fasa multi-mikrofon (misalnya memasangkan trek *Lead Vocal* dengan *Kick Drum*), sistem memunculkan kotak dialog konfirmasi: *"Apakah Anda yakin ingin memasangkan Vokal dengan Drum?"* untuk mencegah kesalahan klik yang tidak disengaja. |  |

| Use Case ID | UC-13 |  |
| :---- | :---- | :---- |
| **Use Case Name** | Memeriksa Skor Kesehatan Sesi & Ringkasan Masalah |  |
| **Process Owner** | Audio Engineer |  |
| **Date Created** | 27 September 2026 |  |
| **Purpose** | Memberikan gambaran ringkas tentang kualitas teknis sesi mixing melalui skor kesehatan (0–100) dan rekapitulasi jumlah masalah teknis secara gratis, serta memicu konfirmasi pemotongan token untuk membuka solusi perbaikan. |  |
| **Overview** | Setelah analisis DSP selesai, sistem menyajikan dasbor audit ringkas. Engineer dapat melihat Skor Kesehatan Sesi, status peringatan tiap trek, serta total kesalahan yang ditemukan. Namun, detail instruksi perbaikan teknis dan pemutar audio perbaikan masih terkunci di balik *paywall*. Halaman ini memfasilitasi engineer untuk menyetujui penggunaan token sebelum masuk ke tahap perbaikan. |  |
| **Cross Requirement** | FR-4.1, FR-4.2, FR-4.3, FR-3.1 s/d FR-3.13 |  |
| **Actor** | Audio Engineer |  |
| **Preconditions**  | 1\. Sesi telah selesai melalui tahap verifikasi dan klasifikasi trek (UC-11 & UC-12). 2\. Mesin diagnostik DSP telah selesai memindai seluruh parameter teknis audio pada sesi tersebut. |  |
| **Postconditions**  | 1\. Audio engineer memahami kondisi umum kesehatan sesinya dan mengetahui berapa banyak trek yang bermasalah. 2\. Engineer siap menyetujui pemotongan saldo token guna membuka kunci rincian solusi dan mengeksekusi perbaikan audio (UC-14 / UC-15). |  |
| **Typical Course of Event** | **Aktor** | **Sistem** |
|  |  | 1\. Menampilkan halaman Dasbor Diagnostik yang memuat Skor Kesehatan Sesi (0–100), ringkasan rekapitulasi masalah, dan daftar seluruh trek. |
|  | 2\. Memeriksa nilai skor kesehatan total dan kategori status sesi (misal: *Skor 58/100 \- Status: Critical*). | 3\. Menampilkan kartu ringkasan masalah, dengan rincian tindakan solusi bertanda gembok (*Locked*). |
|  |  | 4\. Menampilkan informasi jumlah token yang dibutuhkan untuk membuka seluruh detail solusi dan mengeksekusi perbaikan audio (misal: *"Dibutuhkan 12 Token"*). |
|  | 5\. Memeriksa ringkasan masalah dan memutuskan untuk memperbaiki sesi tersebut. |  |
|  | 6\. Menekan tombol "Buka Kunci & Perbaiki Sesi (Gunakan 12 Token)". | 7\. Mengarahkan aktor ke alur persetujuan pemotongan token dan eksekusi perbaikan DSP (UC-14 untuk perbaikan otomatis, atau UC-15 untuk kustom). |
| **Alternative Workflow** | **1\. Sesi Sempurna Tanpa Masalah (*Clean Session*):** Jika seluruh trek audio tidak memiliki cacat fasa atau clipping, sistem memberikan skor 100 dengan status *"Clean / Mix-Ready"*. Tombol perbaikan tidak dimunculkan, dan aktor dapat langsung mengunduh berkas laporan secara gratis tanpa memotong token.  **2\. Saldo Token Pengguna Kurang:** Jika saldo pengguna tidak mencukupi saat hendak menekan tombol perbaikan, sistem menampilkan tombol *"Beli Token / Top-up"* yang langsung mengarahkan ke UC-07. |  |
| **Exceptional Workflow** | **Kerusakan Sinyal Terlalu Parah (*Severe Audio Distortion*):** Jika sistem mendeteksi ada trek yang mengalami distorsi digital permanen yang tidak bisa diselamatkan oleh algoritma DSP, sistem menampilkan catatan peringatan gratis: *"Distorsi rekaman asli terlalu parah—rekam ulang trek ini disarankan"*, sehingga pengguna tidak membuang token untuk trek yang memang tidak dapat diperbaiki. |  |

| Use Case ID | UC-14 |  |
| :---- | :---- | :---- |
| **Use Case Name** | Menjalankan Perbaikan Sesi Otomatis |  |
| **Process Owner** | Audio Engineer |  |
| **Date Created** | 27 September 2026 |  |
| **Purpose** | Menerapkan seluruh rangkaian perbaikan teknis audio secara menyeluruh berdasarkan temuan diagnostik DSP tanpa memerlukan penyetelan manual yang rumit. |  |
| **Overview** | Use case ini mendeskripsikan tindakan engineer saat memilih opsi perbaikan satu klik. Sistem akan mengeksekusi algoritma DSP pada seluruh trek yang bermasalah di server: membalik polaritas fasa, menyelaraskan jeda waktu antar-mikrofon (*micro-delay*), mengoreksi trek *fake stereo*, membuang *DC offset*, membersihkan frekuensi *sub-rumble* pada instrumen non-bass, dan merapikan *gain staging*. Setelah selesai, saldo token dipotong sesuai jumlah trek yang diperbaiki dan pengguna diarahkan ke pemutar audio. |  |
| **Cross Requirement** | FR-5.1 s/d FR-5.7, FR-7.2, FR-7.5 |  |
| **Actor** | Audio Engineer |  |
| **Preconditions** | Sesi telah selesai melalui tahap diagnostik (UC-13) dan saldo token mencukupi untuk biaya pemrosesan perbaikan sesi. |  |
| **Postconditions** | 1\. Seluruh trek yang bermasalah berhasil diperbaiki secara permanen pada sesi tersebut. 2\. Saldo token pengguna terpotong dan tercatat pada riwayat transaksi (UC-08). 3\. Skor Kesehatan Sesi diperbarui menjadi optimal (mencapai skor 95–100). 4\. Audio perbaikan selesai dirender dan pengguna diarahkan ke Pemutar Audio Penuh untuk validasi A/B (UC-16). |  |
| **Typical Course of Event** | **Aktor** | **Sistem** |
|  |  | 1\. Menampilkan tombol utama "Terapkan Perbaikan Otomatis (1-Click Auto-Fix)" beserta ringkasan perbaikan yang akan dijalankan dan jumlah token yang dibutuhkan. |
|  | 2\. Menekan tombol "Terapkan Perbaikan Otomatis". | 3\. Memunculkan kotak dialog konfirmasi pemrosesan dan rincian pemotongan token. |
|  | 4\. Memilih "Setuju & Proses". | 5\. Memvalidasi kecukupan saldo token pengguna. |
|  |  | 6\. Memulai eksekusi perbaikan DSP di server (membalik fasa, merapikan stereo, memotong rumble, dan menyesuaikan gain). |
|  |  | 7\. Menampilkan bilah kemajuan (*progress bar*) proses rendering perbaikan. |
|  |  | 8\. Memotong saldo token pengguna dan mencatat mutasi ke buku besar transaksi (*ledger*). |
|  |  | 9\. Memperbarui tampilan layar dengan status centang hijau pada seluruh trek dan menampilkan skor kesehatan sesi yang baru (optimal). |
|  |  | 10\. Begitu rendering selesai, sistem menampilkan notifikasi sukses dan langsung membuka Pemutar Multitrack A/B (UC-16) agar engineer bisa mendengarkan hasil suaranya secara utuh. |
| **Alternative Workflow** | **Hanya Sebagian Trek yang Diperbaiki (*Selective Processing*):** Jika dari 20 trek hanya 4 trek yang memiliki masalah teknis, sistem secara cerdas hanya merender 4 trek tersebut, sedangkan 16 trek lainnya dibiarkan utuh tanpa pemrosesan ulang (*pass-through*). Pemotongan token hanya dihitung berdasarkan jumlah trek yang benar-benar memerlukan perbaikan. |  |
| **Exceptional Workflow** | **Kegagalan Server saat Memproses (*Server Timeout / Failure*):** Jika terjadi gangguan koneksi atau server mengalami kendala di tengah proses perbaikan, sistem menghentikan proses, membatalkan pemotongan token (*auto-rollback/refund* instan ke dompet pengguna), dan menampilkan pesan: *"Terjadi gangguan server. Saldo token Anda telah dikembalikan secara utuh. Silakan coba beberapa saat lagi"*. |  |

| Use Case ID | UC-15 |  |
| :---- | :---- | :---- |
| **Use Case Name** | Menyesuaikan Perbaikan Kecil |  |
| **Process Owner** | Audio Engineer |  |
| **Date Created** | 27 September 2026 |  |
| **Purpose** | Memberikan keleluasaan bagi audio engineer untuk memilih dan mengaktifkan modul perbaikan DSP tertentu secara selektif pada tiap trek (*granular fixes*), guna menjaga preferensi artistik rekaman. |  |
| **Overview** | Use case ini digunakan jika engineer tidak ingin menerapkan perbaikan otomatis secara penuh (*1-Click Auto-Fix*). Pada panel penyesuaian, engineer dapat memilih perbaikan apa saja yang ingin diterapkan atau dilewati melalui sakelar centang per trek—misalnya: engineer hanya ingin mengaktifkan perbaikan fasa terbalik (*Phase Flip*), tetapi sengaja mematikan fitur *Auto Gain Staging* atau pemotong *Sub-Rumble* karena ingin mempertahankan dinamika dan karakter asli rekaman. |  |
| **Cross Requirement** | FR-5.8, FR-5.1 s/d FR-5.7, FR-7.2, FR-7.5 |  |
| **Actor** | Audio Engineer |  |
| **Preconditions** | Sesi telah melalui tahap ringkasan diagnostik (UC-13) dan saldo token di akun pengguna mencukupi untuk memproses trek yang dipilih. |  |
| **Postconditions** | 1\. Hanya modul perbaikan yang dicentang oleh engineer yang dieksekusi oleh mesin DSP. 2\. Berkas audio diperbarui sesuai konfigurasi kustom yang dipilih pengguna. 3\. Saldo token terpotong secara proporsional dan dicatat pada riwayat transaksi (UC-08). 4\. Audio perbaikan selesai dirender dan pengguna diarahkan ke Pemutar Audio Penuh untuk validasi A/B (UC-16). |  |
| **Typical Course of Event** | **Aktor** | **Sistem** |
|  | 1\. Memilih tombol atau tab "Kustomisasi Perbaikan". | 2\. Menampilkan daftar trek lengkap dengan sakelar centang untuk setiap jenis perbaikan (*Polarity Flip*, *Micro-delay*, *Fake Stereo Fix*, *DC Offset*, *Sub-Rumble*, dan *Gain Staging*). |
|  | 3\. Mengubah sakelar perbaikan sesuai keinginan (misal: mematikan opsi *Gain Staging* pada trek vokal, namun tetap menyalakan *Polarity Flip* pada drum). | 4\. Memperbarui status pilihan secara visual dan menghitung estimasi token yang dibutuhkan. |
|  | 5\. Menekan tombol "Terapkan Perbaikan Terpilih". | 6\. Memvalidasi ketersediaan saldo token pengguna. |
|  |  | 7\. Mengeksekusi komputasi DSP hanya pada modul-modul perbaikan yang aktif. |
|  |  | 8\. Menampilkan bilah kemajuan (*progress bar*) proses rendering kustom. |
|  |  | 9\. Memotong saldo token pengguna sesuai jumlah trek yang diproses dan mencatat transaksi ke buku besar (UC-08). |
|  |  | 10\. Begitu rendering selesai, sistem menampilkan notifikasi sukses dan langsung membuka Pemutar Multitrack A/B (UC-16) agar engineer bisa mendengarkan hasil suaranya secara utuh. |
| **Alternative Workflow** | **Mengembalikan ke Pilihan Awal (*Reset to Default*):** Jika setelah mengubah opsi aktor ingin kembali ke rekomendasi standar yang disarankan oleh sistem, aktor dapat menekan tombol *"Reset ke Rekomendasi Sistem"*, dan sistem akan mencentang kembali seluruh perbaikan yang direkomendasikan secara otomatis. |  |
| **Exceptional Workflow** | **Tidak Ada Modul Perbaikan yang Dipilih:** Jika aktor mematikan seluruh sakelar perbaikan pada semua trek lalu menekan tombol "Terapkan", sistem menampilkan pesan peringatan: *"Tidak ada modul perbaikan yang dipilih. Silakan aktifkan minimal satu perbaikan atau kembali ke menu sebelumnya"* dan tidak memotong saldo token pengguna. |  |

| Use Case ID | UC-16 |  |
| :---- | :---- | :---- |
| **Use Case Name** | Mendengarkan Perbandingan Audio Mentah vs Audio Perbaikan |  |
| **Process Owner** | Audio Engineer |  |
| **Date Created** | 27 September 2026 |  |
| **Purpose** | Memfasilitasi audio engineer untuk memvalidasi dan mendengarkan secara langsung kualitas audio yang telah berhasil diperbaiki secara penuh, bebas latensi, serta menguji kompatibilitas mono sebelum mengunduh berkas. |  |
| **Overview** | Use case ini dijalankan setelah sesi mixing dibuka kuncinya dan proses perbaikan selesai dieksekusi (UC-14 atau UC-15). Engineer dapat memutar lagu secara utuh pada pemutar multitrack berbasis web untuk mendengarkan perbedaan sebelum dan sesudah perbaikan secara instan melalui tombol komparasi A/B. Engineer juga dapat menguji tombol *Mono Check* dan memantau visualizer fasa untuk memastikan seluruh trek telah koheren sebelum mengekspor berkas ke DAW. |  |
| **Cross Requirement** | FR-6.1, FR-6.2, FR-6.3, FR-6.4 |  |
| **Actor** | Audio Engineer |  |
| **Preconditions** | 1\. Sesi telah berhasil dibuka kuncinya menggunakan token pengguna. 2\. Mesin DSP telah selesai merender seluruh berkas perbaikan audio sesi tersebut (UC-14 atau UC-15). 3\. Perangkat output audio pengguna (speaker monitor studio atau headphone) terhubung dengan baik. |  |
| **Postconditions** | 1\. Audio engineer memvalidasi bahwa hasil perbaikan terdengar optimal di seluruh durasi lagu. 2\. Sesi terverifikasi dan engineer siap mengunduh paket stem bersih (UC-17) serta laporan audit PDF (UC-18). |  |
| **Typical Course of Event** | **Aktor** | **Sistem** |
|  |  | 1\. Membuka antarmuka pemutar multitrack penuh yang telah berisi audio asli dan audio hasil perbaikan lengkap. |
|  | 2\. Menekan tombol "Play" untuk memutar seluruh trek sesi secara bersamaan. | 3\. Memutar seluruh trek secara sinkron dan menampilkan pergerakan meter fasa serta level dinamis secara *real-time*. |
|  | 4\. Menekan tombol Komparasi untuk bergantian mendengar suara sebelum dan sesudah perbaikan secara instan. | 5\. Mengalihkan output suara antara trek asli dan trek hasil perbaikan pada posisi waktu putar yang sama tanpa jeda. |
|  | 6\. Menekan tombol "Mono Check" untuk menguji kekuatan fasa saat kedua channel digabungkan ke mono. | 7\. Menggabungkan sinyal master ke mono dan memperbarui grafik korelasi fasa di layar. |
|  | 8\. Memastikan bahwa masalah fasa terbalik telah diperbaiki. |  |
|  | 9\. Menekan tombol "Selesai & Lanjut ke Unduhan". | 10\. Mengarahkan aktor ke halaman pengunduhan berkas stem (UC-17) dan laporan audit (UC-18). |
| **Alternative Workflow** | **1\. Solo atau Mute Trek Tertentu:** Aktor dapat menekan tombol Solo (S) atau Mute (M) pada instrumen tertentu untuk mengaudit perbaikan fasa secara lebih mendalam tanpa gangguan instrumen lain. **2\. Melakukan Perulangan (*Loop Region*):** Aktor dapat memilih segmen tertentu pada garis waktu lagu untuk diputar berulang-ulang saat mengevaluasi perbedaan sonik. |  |
| **Exceptional Workflow** | **Beban CPU/Memori Pengguna Terlalu Tinggi (*Audio Glitch*):** Jika peramban web komputer pengguna mengalami penurunan performa akibat memutar terlalu banyak trek beresolusi tinggi secara bersamaan, sistem secara otomatis menurunkan animasi visualizer sementara agar audio tetap berputar lancar tanpa bunyi tersendat (*drop-out*). |  |

| Use Case ID | UC-17 |  |
| :---- | :---- | :---- |
| **Use Case Name** | Mengunduh Stems Audio Hasil Perbaikan |  |
| **Process Owner** | Audio Engineer |  |
| **Date Created** | 27 September 2026 |  |
| **Purpose** | Mengemas dan mengunduh seluruh trek audio yang telah diperbaiki dalam satu berkas arsip ZIP dengan struktur penamaan yang rapi dan kualitas audio asli yang terjaga, sehingga siap ditarik langsung ke dalam perangkat lunak DAW pengguna. |  |
| **Overview** | Setelah proses perbaikan audio selesai dijalankan (melalui UC-14 atau UC-15), engineer dapat mengunduh hasilnya. Sistem mengompresi seluruh berkas stem yang sudah diperbaiki (dan trek yang memang sudah bersih) ke dalam satu file ZIP. Nama-nama berkas diberi tanda yang rapi (misal: `FIXED_Snare_Bottom.wav`), mempertahankan *sample rate* dan *bit depth* asli tanpa kompresi yang merusak kualitas (*lossless*), serta menyediakan tautan unduh yang cepat dan aman. |  |
| **Cross Requirement** | FR-6.5 |  |
| **Actor** | Audio Engineer |  |
| **Preconditions**  | 1\. Sesi telah melalui proses eksekusi perbaikan (UC-14 atau UC-15). 2\. Seluruh berkas audio hasil perbaikan telah selesai dirender di server. |  |
| **Postconditions** | 1\. Berkas arsip ZIP berisi seluruh stem bersih berhasil tersimpan di komputer pengguna. 2\. Seluruh stem siap ditarik (*drag-and-drop*) langsung ke proyek DAW (Pro Tools, Logic Pro, FL Studio, Reaper, Cubase, dll.) secara sinkron. |  |
| **Typical Course of Event** | **Aktor** | **Sistem** |
|  |  | 1\. Menampilkan tombol utama "Unduh Seluruh Stems (.ZIP)" pada halaman ringkasan penyelesaian sesi. |
|  | 2\. Menekan tombol "Unduh Seluruh Stems (.ZIP)". | 3\. Memulai proses pengemasan seluruh berkas audio perbaikan ke dalam format arsip ZIP di server. |
|  |  | 4\. Memastikan nama berkas terstruktur rapi (format: `FIXED_[NamaTrek].wav`) dan resolusi audio (*sample rate* serta *bit depth*) tetap terjaga identik dengan aslinya. |
|  |  | 5\. Menghasilkan tautan unduhan aman dan memicu unduhan otomatis pada peramban web pengguna. |
|  | 6\. Menyimpan berkas ZIP ke dalam folder penyimpanan lokal di komputer. | 7\. Menampilkan konfirmasi unduhan selesai beserta pengingat sisa waktu retensi penyimpanan berkas di server sebelum dihapus otomatis. |
| **Alternative Workflow** | **Mengunduh Trek Secara Satuan (*Individual Track Download*):** Jika aktor hanya memerlukan satu atau dua trek spesifik yang diperbaiki (tidak ingin mengunduh seluruh sesi lagu), aktor dapat menekan ikon unduh kecil di sebelah baris trek tersebut untuk langsung mengunduh file audio individual tanpa harus mengunduh paket ZIP penuh. |  |
| **Exceptional Workflow** | **Unduhan Terputus di Tengah Jalan (*Network Interrupted*):** Jika proses pengunduhan terhenti akibat koneksi internet pengguna terputus saat mengunduh file besar, sistem menyediakan tombol *"Unduh Ulang"* pada riwayat sesi. Karena audio sudah selesai diproses, aktor dapat mengunduh kembali berkas tersebut secara gratis tanpa pemotongan token tambahan selama masa retensi sesi (24–48 jam) belum berakhir. |  |

| Use Case ID | UC-18 |  |
| :---- | :---- | :---- |
| **Use Case Name** | Mengunduh Laporan Diagnostik Sesi |  |
| **Process Owner** | Audio Engineer |  |
| **Date Created** | 27 September 2026 |  |
| **Purpose** | Menghasilkan dan mengunduh dokumen laporan audit teknis resmi dalam format PDF yang merangkum skor kesehatan sesi, grafik fasa, daftar masalah per trek, serta tindakan perbaikan yang telah dilakukan. |  |
| **Overview** | Use case ini mendeskripsikan proses pembuatan laporan resmi untuk kebutuhan dokumentasi studio atau pembuktian profesional ke pihak klien. Laporan PDF yang dihasilkan memuat identitas proyek, logo studio, skor kesehatan sesi, visualisasi grafik fasa, serta daftar trek yang mengalami masalah kritis beserta solusinya. Dokumen ini menjadi bukti objektif bagi engineer untuk menjelaskan kepada klien mengapa sesi rekaman mereka bermasalah dan memerlukan waktu pembersihan (*prep-time*). |  |
| **Cross Requirement** | FR-6.6 |  |
| **Actor** | Audio Engineer |  |
| **Preconditions**  | Sesi telah selesai melalui proses analisis diagnostik (UC-13) atau tahap perbaikan (UC-14 / UC-15). Data metrik teknis dan riwayat analisis trek telah tersimpan di sistem. |  |
| **Postconditions** | Dokumen PDF laporan diagnostik teknis berhasil diunduh ke komputer pengguna. Laporan siap dicetak atau dibagikan ke klien/produser musik sebagai bukti audit rekaman. |  |
| **Typical Course of Event** | **Aktor** | **Sistem** |
|  |  | 1\. Menampilkan tombol "Unduh Laporan Audit (PDF)" pada halaman ringkasan sesi. |
|  | 2\. Menekan tombol "Unduh Laporan Audit (PDF)". | 3\. Menampilkan jendela pratinjau laporan ringkas beserta opsi kustomisasi (nama proyek, artis, dan logo studio dari profil pengguna). |
|  | 4\. Memilih tombol "Konfirmasi & Unduh PDF". | 5\. Mengompilasi seluruh data analisis ke dalam tata letak dokumen PDF resmi (memuat skor kesehatan sesi, grafik korelasi fasa, tabel status tiap trek, dan log perbaikan). |
|  |  | 6\. Menghasilkan berkas PDF dan memicu proses unduhan di peramban web pengguna. |
|  | 7\. Menyimpan berkas PDF ke dalam komputer lokal. | 8\. Menampilkan notifikasi bahwa dokumen audit berhasil diunduh. |
| **Alternative Workflow** | **1\. Mengunduh Laporan Standar (Tanpa Logo Studio):** Jika aktor belum memasang logo studio pada profilnya (UC-04) atau memilih format polos, sistem secara otomatis menerbitkan dokumen PDF menggunakan kop standar resmi Polaris Audio.  **2\. Ekspor Format Data (JSON):** Selain PDF, aktor dapat memilih opsi unduh berkas data terstruktur (.JSON) jika ingin mengarsipkan nilai-nilai metrik fasa ke dalam sistem manajemen studio internal. |  |
| **Exceptional Workflow** | **Gagal Merender Grafik PDF pada Sesi Berukuran Masif:** Jika sesi memiliki jumlah trek yang sangat banyak (misal lebih dari 50 trek) sehingga server mengalami kendala saat merender grafik visual yang berat, sistem secara otomatis beralih ke mode *"Laporan Ringkas (Teks & Tabel)"* agar dokumen PDF tetap dapat diunduh tanpa terjadi *timeout* atau error. |  |

[]: <>