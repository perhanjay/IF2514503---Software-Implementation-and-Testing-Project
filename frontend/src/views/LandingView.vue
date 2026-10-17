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

    <!-- HERO SECTION (Asymmetric 1.1fr / 0.9fr Layout) -->
    <section class="relative pt-16 pb-24 md:pt-24 md:pb-36 overflow-hidden">
      <!-- Ambient Radial Glows -->
      <div class="radial-glow top-0 left-1/4 w-[500px] h-[500px]"></div>
      <div class="radial-glow -top-24 right-10 w-[450px] h-[450px]"></div>

      <div class="max-w-6xl mx-auto px-6">
        <div class="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-8 items-center">
          
          <!-- Left Column: Typography & CTAs -->
          <div class="space-y-8 z-10">
            <SectionBadge label="Zero-Loss Audio Prep Engine" />

            <div class="space-y-4">
              <h1 class="font-display text-4xl sm:text-5xl lg:text-[4.25rem] leading-[1.08] tracking-[-0.02em] text-slate-900">
                Diagnostik fasa presisi, <br class="hidden sm:inline" />
                perbaikan stem <br class="hidden sm:inline" />
                <span class="gradient-text gradient-underline">tanpa kompromi.</span>
              </h1>

              <p class="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl font-normal pt-2">
                Otomatisasi pembersihan multitrack mixing berbasis hybrid DSP & AI. Deteksi fasa terbalik, fake stereo, DC offset, dan normalisasi headroom secara transparan dalam hitungan detik.
              </p>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              <button 
                @click="launchStudioInstantly"
                :disabled="isLaunching"
                class="inline-flex items-center justify-center gap-3 px-7 py-4 rounded-xl bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] text-white font-semibold text-sm shadow-accent hover:shadow-accent-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer">
                <span>{{ isLaunching ? 'Menyiapkan Studio...' : 'Buka Studio Instan (Tanpa Login)' }}</span>
                <span class="font-mono text-base">→</span>
              </button>

              <router-link 
                to="/register"
                class="inline-flex items-center justify-center px-6 py-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm hover:border-[#0052FF]/40 transition-all shadow-sm">
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

          <!-- Right Column: Abstract Animated Hero Composition -->
          <div class="relative flex items-center justify-center lg:justify-end">
            <div class="relative w-[340px] h-[340px] sm:w-[420px] sm:h-[420px]">
              
              <!-- Rotating Outer Ring -->
              <div class="absolute inset-0 rounded-full border border-dashed border-[#0052FF]/30 animate-slow-rotate"></div>
              
              <!-- Subtle Background Disc -->
              <div class="absolute inset-8 rounded-full bg-gradient-to-tr from-slate-100 to-white shadow-xl border border-slate-200/60"></div>

              <!-- Floating Card 1: Phase Correlation Lissajous Status -->
              <div class="absolute -top-4 -left-4 sm:top-2 sm:-left-6 w-56 bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-slate-200 shadow-lg animate-float-slow z-20">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-mono-accent text-[10px] text-slate-400 uppercase tracking-wider">Korelasi Fasa</span>
                  <span class="text-[10px] font-bold font-mono-accent px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200">-0.84 INV</span>
                </div>
                <div class="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
                  <div class="h-full bg-rose-500 w-[20%]"></div>
                </div>
                <p class="text-[11px] text-slate-600 font-medium">Overhead L/R: Terdeteksi pembatalan frekuensi rendah.</p>
              </div>

              <!-- Floating Card 2: AI Stem Detection Status -->
              <div class="absolute -bottom-6 -right-2 sm:bottom-4 sm:-right-4 w-60 bg-[#0F172A] text-white rounded-2xl p-4 border border-slate-800 shadow-2xl animate-float-fast z-20">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-mono-accent text-[10px] text-cyan-400 uppercase tracking-wider">AI Classifier</span>
                  <span class="text-[10px] font-mono-accent text-emerald-400 font-bold">98.4% MATCH</span>
                </div>
                <div class="flex items-center gap-2 mb-2">
                  <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot"></div>
                  <span class="text-xs font-semibold text-slate-200">Kick In / Kick Sub</span>
                </div>
                <p class="text-[11px] text-slate-400">Microphone time alignment: Auto-adjusted +2.3ms</p>
              </div>

              <!-- Center Core Graphic -->
              <div class="absolute inset-20 rounded-2xl bg-gradient-to-br from-[#0052FF] to-[#4D7CFF] shadow-accent-lg flex flex-col items-center justify-center text-white p-6 text-center">
                <span class="font-display text-4xl mb-1">0.0</span>
                <span class="font-mono-accent text-[11px] uppercase tracking-widest text-cyan-200">dB True Peak</span>
                <span class="text-[10px] text-white/80 mt-2 font-medium">Headroom Normalized</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- INVERTED CONTRAST SECTION (Deep Slate #0F172A with Dot Grid Texture) -->
    <section class="bg-[#0F172A] text-white py-24 md:py-36 relative overflow-hidden bg-dot-pattern">
      <div class="radial-glow top-1/2 left-0 w-[400px] h-[400px]"></div>
      
      <div class="max-w-6xl mx-auto px-6 relative z-10 space-y-16">
        <!-- Section Header -->
        <div class="text-center max-w-2xl mx-auto space-y-4">
          <SectionBadge label="Fitur Diagnostik Mendalam" />
          <h2 class="font-display text-3xl sm:text-4xl lg:text-5xl leading-tight">
            Standar audit audio studio tanpa tebak-tebakan.
          </h2>
          <p class="text-slate-400 text-sm sm:text-base">
            Polaris Audio memeriksa setiap sampel audio dengan perhitungan DSP deterministik agar hasil mixing Anda terdengar kokoh di semua sistem playback.
          </p>
        </div>

        <!-- 3 Feature Cards Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <!-- Card 1 -->
          <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 hover:border-[#0052FF]/60 transition-all group">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0052FF] to-[#4D7CFF] flex items-center justify-center text-white text-xl mb-6 shadow-accent group-hover:scale-110 transition-transform">
              ⚡
            </div>
            <h3 class="font-display text-xl text-white mb-2">Deteksi Fasa & Comb Filtering</h3>
            <p class="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Memindai korelasi stereo dari -1.0 hingga +1.0 serta menyelaraskan waktu mikrofon berpasangan dalam skala sub-milidetik untuk mencegah vokal dan bass terdengar hampa.
            </p>
          </div>

          <!-- Card 2: Featured 2px Gradient Stroke -->
          <div class="gradient-border-card group">
            <div class="gradient-border-card-inner p-8 bg-[#0F172A]! text-white flex flex-col justify-between">
              <div>
                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0052FF] to-[#4D7CFF] flex items-center justify-center text-white text-xl mb-6 shadow-accent group-hover:scale-110 transition-transform">
                  🎯
                </div>
                <h3 class="font-display text-xl text-white mb-2">Pembersihan Fake Stereo</h3>
                <p class="text-slate-400 text-xs sm:text-sm leading-relaxed">
                  Mengidentifikasi manipulasi Haas effect artifisial yang merusak kompatibilitas mono. Kembalikan ke true mono murni tanpa degradasi frekuensi.
                </p>
              </div>
              <div class="mt-6 pt-4 border-t border-slate-800 font-mono-accent text-[11px] text-cyan-400">
                100% Mono-Safe Processing
              </div>
            </div>
          </div>

          <!-- Card 3 -->
          <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 hover:border-[#0052FF]/60 transition-all group">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0052FF] to-[#4D7CFF] flex items-center justify-center text-white text-xl mb-6 shadow-accent group-hover:scale-110 transition-transform">
              📊
            </div>
            <h3 class="font-display text-xl text-white mb-2">True-Peak & DC Offset Guard</h3>
            <p class="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Kalkulasi 4x oversampling untuk menangkal inter-sample peaks (ISP), membuang getaran subsonik di bawah 30Hz, dan menstabilkan gain staging DAW.
            </p>
          </div>

        </div>
      </div>
    </section>

    <!-- PRICING / TOKEN TIERS (Midtrans Gateway Highlight) -->
    <section class="py-24 md:py-36 max-w-6xl mx-auto px-6 w-full space-y-16">
      <div class="text-center max-w-2xl mx-auto space-y-4">
        <SectionBadge label="Paket Kuota Fleksibel" />
        <h2 class="font-display text-3xl sm:text-4xl text-slate-900">
          Bayar sesuai kebutuhan produksi studio Anda.
        </h2>
        <p class="text-slate-600 text-sm">
          Semua pengguna baru mendapatkan jatah gratis. Tambah kuota kapan saja melalui payment gateway Midtrans otomatis (QRIS, VA, Kartu).
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
        <div 
          v-for="p in packages" 
          :key="p.id" 
          :class="p.featured ? 'gradient-border-card shadow-xl md:-translate-y-3' : 'bg-white border border-slate-200/80 shadow-md'"
          class="rounded-2xl transition-all">
          <div :class="p.featured ? 'gradient-border-card-inner p-8' : 'p-8'" class="space-y-6">
            <div class="flex justify-between items-center">
              <span class="font-mono-accent text-xs uppercase tracking-wider text-slate-500">{{ p.name }}</span>
              <span v-if="p.featured" class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0052FF]/10 text-[#0052FF] font-mono-accent">
                POPULAR
              </span>
            </div>

            <div>
              <span class="font-display text-4xl text-slate-900 font-normal">Rp {{ p.priceIdr.toLocaleString() }}</span>
              <span class="text-xs text-slate-500 block mt-1 font-mono-accent">/ {{ p.tokens }} Token Perbaikan Sesi</span>
            </div>

            <p class="text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
              {{ p.description }}
            </p>

            <button 
              @click="launchStudioInstantly"
              :class="p.featured ? 'bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] text-white shadow-accent' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'"
              class="w-full py-3 rounded-xl font-semibold text-xs transition-all cursor-pointer">
              Gunakan Sekarang
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="mt-auto border-t border-slate-200 bg-white py-12">
      <div class="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
        <div class="flex items-center gap-2">
          <span class="font-display text-slate-900 font-bold text-sm">Polaris Audio</span>
          <span>— IF2514503 Software Implementation & Testing</span>
        </div>
        <div>
          <span>Design Style: Minimalist Modern (Electric Blue & Calistoga)</span>
        </div>
      </div>
    </footer>
  </div>
</template>
