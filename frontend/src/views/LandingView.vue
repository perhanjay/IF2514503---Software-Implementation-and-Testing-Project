<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import AppNavbar from '../components/AppNavbar.vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const isLaunching = ref(false)
const showAnnouncement = ref(true)

const packages = ref([
  { id: 'PKG-10', name: 'Paket Starter', tokens: 10, priceIdr: 25000, description: 'Cocok untuk persiapan 1 single atau EP mini proyek studio.' },
  { id: 'PKG-25', name: 'Paket Studio Pro', tokens: 25, priceIdr: 50000, featured: true, description: 'Pilihan paling populer untuk engineer mixing album & produksi rutin studio.' },
  { id: 'PKG-60', name: 'Paket Enterprise', tokens: 60, priceIdr: 100000, description: 'Kapasitas maksimal untuk commercial mastering & post-production studio skala besar.' }
])

const faqs = ref([
  {
    q: 'Bagaimana Polaris Audio mendeteksi fasa terbalik dan comb filtering?',
    a: 'Engine kami menggunakan algoritma korelasi silang (cross-correlation) berbasis DSP deterministik yang mengukur koefisien korelasi stereo dari -1.0 hingga +1.0. Jika ditemukan pembatalan fasa atau polaritas 180° terbalik antar pasangan mikrofon (seperti Snare Top & Snare Bottom), sistem menyelaraskan waktu mikrofon hingga skala sub-sampel tanpa merusak transient.'
  },
  {
    q: 'Apakah proses perbaikan audio bersifat destruktif terhadap file asli?',
    a: 'Sama sekali tidak. Polaris Audio mengadopsi prinsip non-destructive processing secara mutlak. File master stem asli Anda tetap tersimpan utuh di storage S3, sementara hasil perbaikan disimpan sebagai file terpisah dengan prefiks FIXED_.'
  },
  {
    q: 'Apa itu standar True-Peak ITU-R BS.1770-4 yang diterapkan?',
    a: 'Standar ITU-R BS.1770-4 menggunakan oversampling minimal 4x untuk mengidentifikasi inter-sample clipping (ISP) yang tidak terdeteksi oleh peak meter konvensional. Kami memastikan headroom staging target stabil di -3.0 dBFS Peak untuk mencegah distorsi inter-sample pada konversi digital-ke-analog (DAC).'
  },
  {
    q: 'Bagaimana sistem token dan top-up kuota bekerja?',
    a: 'Setiap perbaikan stem multitrack membutuhkan konsumsi token sesuai ukuran dan kompleksitas pemrosesan. Anda dapat menambah token kapan saja melalui integrasi Midtrans otomatis dengan metode pembayaran QRIS, Virtual Account, maupun Kartu Kredit.'
  }
])

const activeFaq = ref(0) // Open first FAQ by default

function toggleFaq(index) {
  activeFaq.value = activeFaq.value === index ? null : index
}

async function launchStudioInstantly() {
  isLaunching.value = true
  try {
    if (!authStore.isAuthenticated) {
      const res = await axios.post('/api/v1/auth/guest-session')
      authStore.setAuth(res.data.user, res.data.token, res.data.wallet.balance)
    }
    router.push('/dashboard')
  } catch (err) {
    console.error('Failed to launch guest session', err)
    router.push('/dashboard')
  } finally {
    isLaunching.value = false
  }
}

onMounted(async () => {
  if (authStore.isAuthenticated) {
    await authStore.fetchMe()
  }
})
</script>

<template>
  <div class="min-h-screen bg-white text-black flex flex-col font-sans selection:bg-[#ff82c2] selection:text-black">
    
    <!-- ANNOUNCEMENT BAR (Full-bleed Hot Pink #ff82c2) -->
    <aside 
      v-if="showAnnouncement" 
      class="w-full bg-[#ff82c2] text-black px-4 sm:px-6 md:px-8 lg:px-12 py-2.5 transition-all border-b border-black flex items-center justify-between text-xs sm:text-sm font-medium">
      <div class="w-full max-w-[1800px] 2xl:max-w-[1920px] mx-auto flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 overflow-hidden text-ellipsis whitespace-nowrap">
          <span class="badge-pill-stamp px-2.5 py-0.5 text-[10px] shrink-0 bg-black text-white">
            BARU
          </span>
          <span class="truncate">
            Mesin DSP Polaris v2.4 dirilis: Deteksi otomatis pasangan mikrofon &amp; normalisasi ITU-R BS.1770-4.
          </span>
          <button 
            @click="launchStudioInstantly" 
            class="hidden md:inline underline font-semibold hover:opacity-80 cursor-pointer shrink-0">
            Coba di Studio &rarr;
          </button>
        </div>
        <button 
          @click="showAnnouncement = false" 
          aria-label="Tutup Pengumuman"
          class="text-black hover:opacity-60 text-base font-bold px-1 cursor-pointer shrink-0">
          &times;
        </button>
      </div>
    </aside>

    <AppNavbar :fluid="true" />

    <!-- HERO SECTION (Editorial Typographic Focus) -->
    <section class="relative pt-14 pb-20 md:pt-24 md:pb-28 bg-white border-b border-[#c1c0bc]">
      <div class="max-w-[1200px] mx-auto px-6">
        <div class="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-8 items-center">
          
          <!-- Left Column: Editorial Display Typography -->
          <div class="space-y-8">
            <div class="space-y-4">
              <span class="text-[11px] font-bold uppercase tracking-[0.15em] text-[#60605e] block">
                Digital Signal Processing &bull; ITU-R BS.1770-4
              </span>
              <h1 class="font-editorial text-4xl sm:text-5xl lg:text-[4.25rem] leading-[1.04] tracking-[-0.035em] text-black font-extrabold">
                Diagnostik fasa presisi, <br />
                <span class="italic font-bold">perbaikan stem tanpa kompromi.</span>
              </h1>

              <p class="text-base sm:text-lg text-[#60605e] leading-[1.56] max-w-xl font-normal pt-2">
                Otomatisasi pembersihan multitrack mixing berbasis hybrid DSP deterministik dan AI. Deteksi fasa terbalik, fake stereo, DC offset, dan normalisasi headroom studio secara instan.
              </p>
            </div>

            <!-- Ink Stamp CTA Actions -->
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              <button 
                @click="launchStudioInstantly"
                :disabled="isLaunching"
                class="btn-ink-stamp px-8 py-3.5 text-xs transition-colors cursor-pointer text-center">
                <span>{{ isLaunching ? 'Menyiapkan Studio...' : 'Buka Studio Instan (Tanpa Login)' }}</span>
              </button>

              <router-link 
                to="/register"
                class="btn-bone-secondary px-7 py-3.5 text-xs border border-[#c1c0bc] transition-colors text-center">
                Daftar Akun Permanen
              </router-link>
            </div>

            <!-- Trust Bar / Technical Readouts -->
            <div class="pt-8 border-t border-[#c1c0bc] grid grid-cols-3 gap-6 max-w-lg">
              <div>
                <span class="block font-mono-accent text-2xl font-bold text-black">&lt; 1 Sample</span>
                <span class="text-[11px] font-medium tracking-[0.05em] uppercase text-[#60605e]">Sync Drift Tolerance</span>
              </div>
              <div>
                <span class="block font-mono-accent text-2xl font-bold text-black">32-Bit FP</span>
                <span class="text-[11px] font-medium tracking-[0.05em] uppercase text-[#60605e]">DSP Precision</span>
              </div>
              <div>
                <span class="block font-mono-accent text-2xl font-bold text-black">-&infin; dB</span>
                <span class="text-[11px] font-medium tracking-[0.05em] uppercase text-[#60605e]">Null Test Margin</span>
              </div>
            </div>
          </div>

          <!-- Right Column: Tactile Hardware Console Telemetry Card -->
          <div class="flex items-center justify-center lg:justify-end">
            <div class="w-full max-w-md bg-white border-2 border-black rounded-none p-6 space-y-4">
              <div class="flex items-center justify-between border-b border-[#c1c0bc] pb-3">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 bg-black" />
                  <span class="font-bold text-xs uppercase tracking-[0.1em] text-black">Console Telemetry</span>
                </div>
                <span class="text-[10px] font-mono-accent font-bold px-2 py-0.5 rounded-none bg-[#f1f0eb] border border-[#c1c0bc] text-black">
                  [PREVIEW]
                </span>
              </div>

              <!-- Paired Track Demonstration -->
              <div class="bg-[#f1f0eb] border border-[#c1c0bc] rounded-none p-4 space-y-3">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-semibold text-black">Snare Top / Snare Btm (Mic Pair)</span>
                  <span class="font-mono-accent text-[11px] font-bold text-white bg-black px-2 py-0.5">
                    +0.92 Phase Sync
                  </span>
                </div>
                <!-- Alignment Meter Bar -->
                <div class="h-2 w-full bg-[#c1c0bc] rounded-none overflow-hidden">
                  <div class="h-full bg-black w-[92%]"></div>
                </div>
                <div class="flex justify-between text-[11px] text-[#60605e] font-mono-accent">
                  <span>Delta Alignment: +1.8ms</span>
                  <span>Haas Leak: 0.0% Clean</span>
                </div>
              </div>

              <!-- Core Metrics Grid -->
              <div class="grid grid-cols-2 gap-3 pt-1 text-xs">
                <div class="border border-[#c1c0bc] rounded-none p-3.5 bg-white">
                  <span class="text-[10px] font-mono-accent text-[#60605e] uppercase tracking-wider block">TRUE-PEAK HEADROOM</span>
                  <span class="font-mono-accent text-xl text-black font-bold block mt-1">-3.0 dBFS</span>
                  <span class="text-[10px] text-black font-medium uppercase tracking-wider">ITU-R Guard Safe</span>
                </div>
                <div class="border border-[#c1c0bc] rounded-none p-3.5 bg-white">
                  <span class="text-[10px] font-mono-accent text-[#60605e] uppercase tracking-wider block">DC OFFSET LEVEL</span>
                  <span class="font-mono-accent text-xl text-black font-bold block mt-1">0.00%</span>
                  <span class="text-[10px] text-black font-medium uppercase tracking-wider">Zero Center Drift</span>
                </div>
              </div>

              <!-- Audio Status Footer -->
              <div class="pt-2 border-t border-[#c1c0bc] flex items-center justify-between text-[11px] text-[#60605e]">
                <span>Sample Rate: 48,000 Hz</span>
                <span class="font-semibold text-black uppercase tracking-wider">Non-Destructive S3</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- FEATURE HIGHLIGHT BLOCK: HOT PINK STUDIO SPREAD (Full-bleed #ff82c2) -->
    <section class="w-full bg-[#ff82c2] text-black py-20 md:py-24 border-b border-black">
      <div class="max-w-[1200px] mx-auto px-6">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <!-- Left Column (60% width) -->
          <div class="lg:col-span-7 space-y-6">
            <span class="badge-pill-stamp px-3 py-1 text-[11px] bg-black text-white inline-block">
              STUDIO FEATURE BLOCK
            </span>
            <h2 class="font-editorial text-3xl sm:text-4xl lg:text-5xl leading-tight font-extrabold tracking-[-0.03em]">
              Selesaikan masalah fasa drum &amp; vokal <br />
              <span class="italic">sebelum proses mixing dimulai.</span>
            </h2>
            <p class="text-base text-[#292c33] leading-relaxed max-w-xl font-normal">
              Mikrofon ganda pada instrumen drum dan gitar akustik sering kali saling membatalkan frekuensi bass akibat perbedaan jarak fisik. Algoritma korelasi Polaris mendeteksi keterlambatan sinyal sub-milidetik dan membalikkan polaritas secara otomatis tanpa mengubah karakter suara.
            </p>
            <div class="pt-2">
              <button 
                @click="launchStudioInstantly" 
                class="inline-flex items-center gap-2 text-black font-bold text-sm tracking-[0.05em] uppercase underline hover:opacity-80 cursor-pointer">
                <span>Buka Studio Workspace</span>
                <span>&rarr;</span>
              </button>
            </div>
          </div>

          <!-- Right Column: Floating Tactical Card with slight rotation -->
          <div class="lg:col-span-5 flex justify-center">
            <div class="w-full max-w-sm bg-white border-2 border-black p-6 rounded-none transform -rotate-2 hover:rotate-0 transition-transform duration-300 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <div class="flex justify-between items-center pb-3 border-b border-[#c1c0bc]">
                <span class="text-xs font-bold uppercase tracking-wider">Deteksi Pasangan Mic</span>
                <span class="text-[10px] font-mono-accent bg-[#ffda40] text-black px-2 py-0.5 font-bold border border-black">
                  AI ASSISTED
                </span>
              </div>
              <div class="py-4 space-y-3 text-xs">
                <div class="p-3 bg-[#f1f0eb] border border-[#c1c0bc] flex justify-between items-center">
                  <div>
                    <span class="block font-bold text-black">Stem 01: Snare_Top.wav</span>
                    <span class="text-[10px] text-[#60605e]">Cluster: Drum Multi-Mic</span>
                  </div>
                  <span class="font-mono-accent font-bold text-black text-xs">Ref Stem</span>
                </div>
                <div class="p-3 bg-[#f1f0eb] border border-black flex justify-between items-center">
                  <div>
                    <span class="block font-bold text-black">Stem 02: Snare_Bottom.wav</span>
                    <span class="text-[10px] text-[#ff6138] font-semibold">Polaritas Terbalik (-0.88)</span>
                  </div>
                  <span class="bg-black text-white font-mono-accent text-[10px] font-bold px-1.5 py-0.5">
                    180° Invert
                  </span>
                </div>
              </div>
              <div class="pt-2 border-t border-[#c1c0bc] flex justify-between items-center text-[11px] text-[#60605e]">
                <span>Status Rekomendasi:</span>
                <span class="font-bold text-black uppercase">Tindakan Siap Diaplikasikan</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- MONOCHROME TECHNICAL CARD GRID (White & Bone surfaces) -->
    <section class="py-20 md:py-28 max-w-[1200px] mx-auto px-6 w-full space-y-14">
      <div class="text-center max-w-2xl mx-auto space-y-3">
        <span class="text-[11px] font-bold uppercase tracking-[0.15em] text-[#60605e] block">
          Arsitektur Diagnostik Audio
        </span>
        <h2 class="font-editorial text-3xl sm:text-4xl font-extrabold tracking-[-0.03em] text-black">
          Standar audit audio studio tanpa tebak-tebakan.
        </h2>
        <p class="text-[#60605e] text-base leading-relaxed">
          Polaris Audio memeriksa setiap sampel audio dengan perhitungan DSP deterministik agar hasil mixing Anda terdengar kokoh di semua sistem playback.
        </p>
      </div>

      <!-- 3-Up Magazine Card Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        <!-- Card 1 -->
        <div class="bg-[#f1f0eb] border border-[#c1c0bc] rounded-none p-8 flex flex-col justify-between hover:border-black transition-colors">
          <div class="space-y-4">
            <div class="w-10 h-10 rounded-none bg-black text-white flex items-center justify-center font-bold">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 class="font-editorial text-xl font-bold text-black">Deteksi Fasa &amp; Comb Filtering</h3>
            <p class="text-[#60605e] text-sm leading-relaxed font-normal">
              Memindai korelasi stereo dari -1.0 hingga +1.0 serta menyelaraskan waktu mikrofon berpasangan dalam skala sub-milidetik untuk mencegah vokal dan bass terdengar tipis.
            </p>
          </div>
          <div class="mt-8 pt-4 border-t border-[#c1c0bc] text-[11px] text-black font-mono-accent font-semibold uppercase tracking-wider">
            Sub-sample Micro-delay Engine
          </div>
        </div>

        <!-- Card 2 -->
        <div class="bg-[#f1f0eb] border border-[#c1c0bc] rounded-none p-8 flex flex-col justify-between hover:border-black transition-colors">
          <div class="space-y-4">
            <div class="w-10 h-10 rounded-none bg-black text-white flex items-center justify-center font-bold">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h3 class="font-editorial text-xl font-bold text-black">Pembersihan Fake Stereo</h3>
            <p class="text-[#60605e] text-sm leading-relaxed font-normal">
              Mengidentifikasi manipulasi Haas effect artifisial dan mikrodifusi yang merusak kompatibilitas mono. Kembalikan ke format mono sejati tanpa degradasi frekuensi.
            </p>
          </div>
          <div class="mt-8 pt-4 border-t border-[#c1c0bc] text-[11px] text-black font-mono-accent font-semibold uppercase tracking-wider">
            100% Mono-Safe Processing Matrix
          </div>
        </div>

        <!-- Card 3 -->
        <div class="bg-[#f1f0eb] border border-[#c1c0bc] rounded-none p-8 flex flex-col justify-between hover:border-black transition-colors">
          <div class="space-y-4">
            <div class="w-10 h-10 rounded-none bg-black text-white flex items-center justify-center font-bold">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 class="font-editorial text-xl font-bold text-black">True-Peak &amp; DC Offset Guard</h3>
            <p class="text-[#60605e] text-sm leading-relaxed font-normal">
              Kalkulasi 4x oversampling untuk menangkal inter-sample peaks (ISP), memotong rumble subsonik di bawah 25Hz (Butterworth), dan menstabilkan headroom DAW.
            </p>
          </div>
          <div class="mt-8 pt-4 border-t border-[#c1c0bc] text-[11px] text-black font-mono-accent font-semibold uppercase tracking-wider">
            ITU-R BS.1770-4 Standard Compliance
          </div>
        </div>

      </div>
    </section>

    <!-- FEATURE HIGHLIGHT BLOCK: SIGNAL BLUE SPREAD (Full-bleed #20afff) -->
    <section class="w-full bg-[#20afff] text-black py-20 md:py-24 border-y border-black">
      <div class="max-w-[1200px] mx-auto px-6">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <!-- Left Column: Tactical Card -->
          <div class="lg:col-span-5 order-2 lg:order-1 flex justify-center">
            <div class="w-full max-w-sm bg-white border-2 border-black p-6 rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <div class="flex justify-between items-center pb-3 border-b border-[#c1c0bc]">
                <span class="text-xs font-bold uppercase tracking-wider text-black">Audit Spektrum Deterministik</span>
                <span class="text-[10px] font-mono-accent bg-black text-white px-2 py-0.5 font-bold">
                  ITU-R BS.1770-4
                </span>
              </div>
              <div class="py-4 space-y-3 font-mono-accent text-xs">
                <div class="flex justify-between items-center p-2.5 bg-[#f1f0eb] border border-[#c1c0bc]">
                  <span class="text-[#60605e]">True-Peak Oversampling</span>
                  <span class="font-bold text-black">&ge; 4x Polyphase Filter</span>
                </div>
                <div class="flex justify-between items-center p-2.5 bg-[#f1f0eb] border border-[#c1c0bc]">
                  <span class="text-[#60605e]">Sub-Rumble HPF Cutoff</span>
                  <span class="font-bold text-black">25 Hz Butterworth</span>
                </div>
                <div class="flex justify-between items-center p-2.5 bg-[#f1f0eb] border border-[#c1c0bc]">
                  <span class="text-[#60605e]">Gain Target Headroom</span>
                  <span class="font-bold text-black">-3.0 dBFS Peak</span>
                </div>
              </div>
              <div class="pt-2 border-t border-[#c1c0bc] text-[11px] text-[#60605e] text-center">
                Audio asli tidak pernah ditimpa (Non-destructive)
              </div>
            </div>
          </div>

          <!-- Right Column: Editorial Text (60% width) -->
          <div class="lg:col-span-7 order-1 lg:order-2 space-y-6">
            <span class="badge-pill-stamp px-3 py-1 text-[11px] bg-white text-black inline-block">
              DSP STANDARDS COMPLIANCE
            </span>
            <h2 class="font-editorial text-3xl sm:text-4xl lg:text-5xl leading-tight font-extrabold tracking-[-0.03em] text-white">
              Kualitas audio profesional, <br />
              <span class="italic text-black">terverifikasi secara matematis.</span>
            </h2>
            <p class="text-base text-black/90 leading-relaxed max-w-xl font-normal">
              Setiap sesi mixing diproses dengan presisi 32-bit floating point. Tidak ada modulasi tebakan acak, filter pewarnaan frekuensi tak diinginkan, atau saturasi artifisial. Hasil audio yang Anda unduh selalu bersih dan siap dikirim ke mixing engineer.
            </p>
            <div class="pt-2">
              <router-link 
                to="/register" 
                class="inline-flex items-center gap-2 text-black font-bold text-sm tracking-[0.05em] uppercase underline hover:opacity-80 cursor-pointer">
                <span>Daftar Akun Studio Sekarang</span>
                <span>&rarr;</span>
              </router-link>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- PRICING / TOKEN TIERS (Clean Magazine Grid) -->
    <section class="py-20 md:py-28 max-w-[1200px] mx-auto px-6 w-full space-y-14">
      <div class="text-center max-w-2xl mx-auto space-y-3">
        <span class="text-[11px] font-bold uppercase tracking-[0.15em] text-[#60605e] block">
          Investasi Produksi Audio
        </span>
        <h2 class="font-editorial text-3xl sm:text-4xl font-extrabold text-black">
          Bayar sesuai kebutuhan produksi studio Anda.
        </h2>
        <p class="text-[#60605e] text-base">
          Semua pengguna baru mendapatkan kuota gratis. Tambah kuota kapan saja melalui payment gateway Midtrans otomatis (QRIS, VA Bank, Kartu).
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
        <div 
          v-for="p in packages" 
          :key="p.id" 
          :class="p.featured ? 'border-2 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]' : 'border border-[#c1c0bc] bg-[#f1f0eb]'"
          class="rounded-none p-8 flex flex-col justify-between transition-all">
          <div class="space-y-6">
            <div class="flex justify-between items-center">
              <span class="text-xs font-bold uppercase tracking-wider text-black">{{ p.name }}</span>
              <span class="font-mono-accent text-xs font-bold text-white bg-black px-2.5 py-0.5">
                {{ p.tokens }} Token
              </span>
            </div>

            <div>
              <span class="font-editorial text-3xl sm:text-4xl text-black font-extrabold block">
                Rp {{ p.priceIdr.toLocaleString() }}
              </span>
              <span class="text-xs text-[#60605e] block mt-1 uppercase tracking-wider">
                Total kapasitas perbaikan stem sesi
              </span>
            </div>

            <p class="text-xs text-[#60605e] leading-relaxed border-t border-[#c1c0bc] pt-4 font-normal">
              {{ p.description }}
            </p>
          </div>

          <div class="pt-8">
            <button 
              @click="launchStudioInstantly"
              class="w-full py-3.5 rounded-none bg-black hover:bg-[#292c33] text-white font-semibold text-xs uppercase tracking-[0.1em] transition-colors cursor-pointer">
              Gunakan Paket Ini
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ ACCORDION SECTION (Bone Surface Rows) -->
    <section class="py-20 md:py-24 bg-[#f1f0eb] border-t border-[#c1c0bc]">
      <div class="max-w-[1200px] mx-auto px-6 space-y-10">
        <div class="text-center max-w-xl mx-auto space-y-2">
          <span class="text-[11px] font-bold uppercase tracking-[0.15em] text-[#60605e] block">
            Pertanyaan Umum
          </span>
          <h2 class="font-editorial text-3xl font-extrabold text-black">
            Ketahui lebih dalam tentang Polaris Audio.
          </h2>
        </div>

        <div class="space-y-2 max-w-3xl mx-auto">
          <div 
            v-for="(faq, idx) in faqs" 
            :key="idx" 
            class="bg-white border border-[#c1c0bc] transition-all">
            <button 
              @click="toggleFaq(idx)"
              class="w-full px-6 py-5 flex items-center justify-between text-left cursor-pointer focus:outline-none">
              <span class="font-semibold text-black text-sm sm:text-base pr-4">
                {{ faq.q }}
              </span>
              <span class="text-lg font-bold text-black transition-transform duration-200" :class="activeFaq === idx ? 'rotate-180' : ''">
                &darr;
              </span>
            </button>
            <div 
              v-show="activeFaq === idx" 
              class="px-6 pb-6 pt-1 text-xs sm:text-sm text-[#60605e] leading-relaxed border-t border-[#f1f0eb]">
              {{ faq.a }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- MONOCHROME EDITORIAL FOOTER -->
    <footer class="mt-auto bg-white border-t border-[#c1c0bc] py-14">
      <div class="max-w-[1200px] mx-auto px-6 space-y-10">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-8 text-xs">
          <div class="space-y-3">
            <span class="font-bold text-black uppercase tracking-[0.1em] block">Polaris Audio</span>
            <p class="text-[#60605e] leading-relaxed">
              Platform otomatisasi persiapan multitrack mixing dan diagnostik DSP deterministik berstandar industri.
            </p>
          </div>
          <div class="space-y-2">
            <span class="font-bold text-black uppercase tracking-[0.1em] block">Fitur Utama</span>
            <ul class="space-y-1.5 text-[#60605e]">
              <li>Deteksi Fasa Korelasi</li>
              <li>Pembersihan Fake Stereo</li>
              <li>True-Peak Headroom Guard</li>
              <li>Klasifikasi Stem AI</li>
            </ul>
          </div>
          <div class="space-y-2">
            <span class="font-bold text-black uppercase tracking-[0.1em] block">Standar Audio</span>
            <ul class="space-y-1.5 text-[#60605e]">
              <li>ITU-R BS.1770-4</li>
              <li>48 kHz Resampling Rule</li>
              <li>32-Bit Float DSP Precision</li>
              <li>Non-Destructive S3 Workflow</li>
            </ul>
          </div>
          <div class="space-y-2">
            <span class="font-bold text-black uppercase tracking-[0.1em] block">Informasi Proyek</span>
            <p class="text-[#60605e] leading-relaxed">
              IF2514503 Software Implementation and Testing Project. Didesain dengan filosofi editorial presisi tinggi.
            </p>
          </div>
        </div>

        <div class="pt-8 border-t border-[#c1c0bc] flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-[#60605e]">
          <div>
            &copy; {{ new Date().getFullYear() }} Polaris Audio. Hak cipta dilindungi undang-undang.
          </div>
          <div class="flex items-center gap-6">
            <router-link to="/login" class="hover:text-black">Masuk Akun</router-link>
            <router-link to="/register" class="hover:text-black">Daftar Akun</router-link>
            <router-link to="/billing" class="hover:text-black">Beli Token</router-link>
          </div>
        </div>
      </div>
    </footer>

  </div>
</template>
