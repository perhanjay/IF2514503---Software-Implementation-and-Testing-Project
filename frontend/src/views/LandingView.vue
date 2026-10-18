<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import AppNavbar from '../components/AppNavbar.vue'
import SectionBadge from '../components/SectionBadge.vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const isLaunching = ref(false)
const packages = ref([
  { id: 'PKG-10', name: 'Paket Starter', tokens: 10, priceIdr: 25000, description: 'Cocok untuk persiapan 1 single atau EP mini proyek studio.' },
  { id: 'PKG-25', name: 'Paket Studio Pro', tokens: 25, priceIdr: 50000, featured: true, description: 'Pilihan paling populer untuk engineer mixing album & produksi rutin.' },
  { id: 'PKG-60', name: 'Paket Enterprise', tokens: 60, priceIdr: 100000, description: 'Kapasitas maksimal untuk commercial mastering & post-production studio.' }
])

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
  <div class="min-h-screen bg-[#FAFAFA] text-slate-900 flex flex-col selection:bg-[#0052FF]/20 selection:text-[#0052FF]">
    <AppNavbar />

    <!-- HERO SECTION (Asymmetric 1.15fr / 0.85fr Workbench Layout) -->
    <section class="relative pt-12 pb-20 md:pt-20 md:pb-28">
      <div class="max-w-6xl mx-auto px-6">
        <div class="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-8 items-center">
          
          <!-- Left Column: Typography & CTAs -->
          <div class="space-y-6 z-10">
            <div class="space-y-4">
              <h1 class="font-display text-4xl sm:text-5xl lg:text-[4rem] leading-[1.08] tracking-[-0.02em] text-slate-900">
                Diagnostik fasa presisi, <br class="hidden sm:inline" />
                perbaikan stem <br class="hidden sm:inline" />
                <span class="text-[#0052FF]">tanpa kompromi.</span>
              </h1>

              <p class="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl font-normal pt-1">
                Otomatisasi pembersihan multitrack mixing berbasis hybrid DSP &amp; AI. Deteksi fasa terbalik, fake stereo, DC offset, dan normalisasi headroom secara transparan dalam hitungan detik.
              </p>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              <button 
                @click="launchStudioInstantly"
                :disabled="isLaunching"
                class="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#0052FF] hover:bg-[#0043D6] text-white font-semibold text-sm shadow-accent hover:shadow-accent-lg transition-all cursor-pointer">
                <span>{{ isLaunching ? 'Menyiapkan Studio...' : 'Buka Studio Instan (Tanpa Login)' }}</span>
              </button>

              <router-link 
                to="/register"
                class="inline-flex items-center justify-center px-6 py-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm hover:border-[#0052FF]/40 transition-all shadow-sm">
                Daftar Akun Permanen
              </router-link>
            </div>

            <!-- Trust Bar / Technical Signals -->
            <div class="pt-6 border-t border-slate-200/80 grid grid-cols-3 gap-6 max-w-lg">
              <div>
                <span class="block font-mono-accent text-2xl font-bold text-slate-900">&lt; 1 Sample</span>
                <span class="text-xs text-slate-500">Sync Drift Tolerance</span>
              </div>
              <div>
                <span class="block font-mono-accent text-2xl font-bold text-slate-900">32-Bit FP</span>
                <span class="text-xs text-slate-500">Native DSP Precision</span>
              </div>
              <div>
                <span class="block font-mono-accent text-2xl font-bold text-[#0052FF]">-\infty dB</span>
                <span class="text-xs text-slate-500">Bit-Transparent Null Test</span>
              </div>
            </div>
          </div>

          <!-- Right Column: Honest Product Preview Card (R-17 & R-38 Compliance) -->
          <div class="flex items-center justify-center lg:justify-end">
            <div class="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-md space-y-4">
              <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span class="font-display text-sm font-semibold text-slate-900">Console Telemetry</span>
                </div>
                <span class="text-[10px] font-mono-accent font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                  [PREVIEW]
                </span>
              </div>

              <!-- Paired Track Demonstration -->
              <div class="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-medium text-slate-700">Kick In / Kick Sub (Mic Pair)</span>
                  <span class="font-mono-accent text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                    +0.92 Phase Sync
                  </span>
                </div>
                <div class="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div class="h-full bg-emerald-500 w-[92%]"></div>
                </div>
                <div class="flex justify-between text-[11px] text-slate-500 font-mono-accent">
                  <span>Delta Alignment: +2.1ms</span>
                  <span>Stereo Haar: 0.0% Clean</span>
                </div>
              </div>

              <!-- Core Metrics Grid -->
              <div class="grid grid-cols-2 gap-3 pt-1 text-xs">
                <div class="border border-slate-200 rounded-xl p-3 bg-[#FAFAFA]">
                  <span class="text-[10px] font-mono-accent text-slate-500 block">TRUE-PEAK HEADROOM</span>
                  <span class="font-display text-xl text-slate-900 font-bold block mt-0.5">-0.3 dBFS</span>
                  <span class="text-[10px] text-emerald-600 font-medium">ITU-R BS.1770 Guard</span>
                </div>
                <div class="border border-slate-200 rounded-xl p-3 bg-[#FAFAFA]">
                  <span class="text-[10px] font-mono-accent text-slate-500 block">DC OFFSET LEVEL</span>
                  <span class="font-display text-xl text-slate-900 font-bold block mt-0.5">0.00%</span>
                  <span class="text-[10px] text-emerald-600 font-medium">Pure Center Balance</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- INVERTED CONTRAST SECTION (Clean Deep Slate Studio Console) -->
    <section class="bg-[#0F172A] text-white py-20 md:py-28">
      <div class="max-w-6xl mx-auto px-6 space-y-14">
        <!-- Section Header -->
        <div class="text-center max-w-2xl mx-auto space-y-3">
          <span class="inline-block text-xs font-semibold text-cyan-400 font-mono-accent uppercase tracking-wider">
            Fitur Diagnostik Mendalam
          </span>
          <h2 class="font-display text-3xl sm:text-4xl lg:text-5xl leading-tight">
            Standar audit audio studio tanpa tebak-tebakan.
          </h2>
          <p class="text-slate-400 text-sm sm:text-base">
            Polaris Audio memeriksa setiap sampel audio dengan perhitungan DSP deterministik agar hasil mixing Anda terdengar kokoh di semua sistem playback.
          </p>
        </div>

        <!-- 3 Feature Cards Grid with Purposeful SVG Icons -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <!-- Card 1 -->
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-7 hover:border-slate-700 transition-all flex flex-col justify-between">
            <div class="space-y-4">
              <div class="w-11 h-11 rounded-xl bg-blue-600/20 text-[#4D7CFF] border border-blue-500/30 flex items-center justify-center">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 class="font-display text-xl text-white">Deteksi Fasa &amp; Comb Filtering</h3>
              <p class="text-slate-400 text-xs sm:text-sm leading-relaxed font-normal">
                Memindai korelasi stereo dari -1.0 hingga +1.0 serta menyelaraskan waktu mikrofon berpasangan dalam skala sub-milidetik untuk mencegah vokal dan bass terdengar hampa.
              </p>
            </div>
            <div class="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-400 font-mono-accent">
              Sub-sample Micro-delay
            </div>
          </div>

          <!-- Card 2 -->
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-7 hover:border-slate-700 transition-all flex flex-col justify-between">
            <div class="space-y-4">
              <div class="w-11 h-11 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <h3 class="font-display text-xl text-white">Pembersihan Fake Stereo</h3>
              <p class="text-slate-400 text-xs sm:text-sm leading-relaxed font-normal">
                Mengidentifikasi manipulasi Haas effect artifisial yang merusak kompatibilitas mono. Kembalikan ke true mono murni tanpa degradasi frekuensi.
              </p>
            </div>
            <div class="mt-6 pt-4 border-t border-slate-800 text-[11px] text-cyan-400 font-mono-accent">
              100% Mono-Safe Processing
            </div>
          </div>

          <!-- Card 3 -->
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-7 hover:border-slate-700 transition-all flex flex-col justify-between">
            <div class="space-y-4">
              <div class="w-11 h-11 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 class="font-display text-xl text-white">True-Peak &amp; DC Offset Guard</h3>
              <p class="text-slate-400 text-xs sm:text-sm leading-relaxed font-normal">
                Kalkulasi 4x oversampling untuk menangkal inter-sample peaks (ISP), membuang getaran subsonik di bawah 30Hz, dan menstabilkan gain staging DAW.
              </p>
            </div>
            <div class="mt-6 pt-4 border-t border-slate-800 text-[11px] text-emerald-400 font-mono-accent">
              ITU-R BS.1770-4 Standard
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- PRICING / TOKEN TIERS (Clean Studio Capacity Presentation) -->
    <section class="py-20 md:py-28 max-w-6xl mx-auto px-6 w-full space-y-12">
      <div class="text-center max-w-2xl mx-auto space-y-3">
        <h2 class="font-display text-3xl sm:text-4xl text-slate-900">
          Bayar sesuai kebutuhan produksi studio Anda.
        </h2>
        <p class="text-slate-600 text-sm">
          Semua pengguna baru mendapatkan jatah gratis. Tambah kuota kapan saja melalui payment gateway Midtrans otomatis (QRIS, VA, Kartu).
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
        <div 
          v-for="p in packages" 
          :key="p.id" 
          class="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm flex flex-col justify-between">
          <div class="space-y-5">
            <div class="flex justify-between items-center">
              <span class="text-xs font-semibold text-slate-700">{{ p.name }}</span>
              <span class="font-mono-accent text-xs font-semibold text-[#0052FF] bg-blue-50 px-2 py-0.5 rounded">
                {{ p.tokens }} Token
              </span>
            </div>

            <div>
              <span class="font-display text-3xl sm:text-4xl text-slate-900 font-normal">Rp {{ p.priceIdr.toLocaleString() }}</span>
              <span class="text-xs text-slate-500 block mt-1">Total kapasitas perbaikan stem sesi</span>
            </div>

            <p class="text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
              {{ p.description }}
            </p>
          </div>

          <div class="pt-6">
            <button 
              @click="launchStudioInstantly"
              class="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer">
              Gunakan Sekarang
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="mt-auto border-t border-slate-200 bg-white py-8">
      <div class="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
        <div class="flex items-center gap-2">
          <span class="font-display text-slate-900 font-bold text-sm">Polaris Audio</span>
          <span>: IF2514503 Software Implementation and Testing</span>
        </div>
        <div>
          <span>Polaris Audio Studio Prep Suite</span>
        </div>
      </div>
    </footer>
  </div>
</template>
