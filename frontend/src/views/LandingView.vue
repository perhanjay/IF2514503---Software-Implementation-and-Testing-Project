<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Zap,
  Mic,
  Activity,
  ShieldCheck,
  Play,
  Coins,
  UserPlus,
  ChevronLeft,
  ChevronRight
} from 'lucide-vue-next'
import AppNavbar from '../components/AppNavbar.vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const isLaunching = ref(false)

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

const heroKeys = [
  {
    id: 'd',
    label: 'D',
    transformClass: '-rotate-12 translate-y-3 hover:-translate-y-0.5',
    baseStops: ['#ffffff', '#e4e8ef', '#cbd5e1'],
    topStops: ['#ffffff', '#f4f6fa'],
    stroke: '#ffffff',
    strokeOpacity: '0.95',
    textColor: '#111111'
  },
  {
    id: 's',
    label: 'S',
    transformClass: 'rotate-6 -translate-y-2 z-10 hover:-translate-y-4',
    baseStops: ['#ffea80', '#ffda40', '#eab308'],
    topStops: ['#fff099', '#ffda40'],
    stroke: '#ffffff',
    strokeOpacity: '0.75',
    textColor: '#111111'
  },
  {
    id: 'p',
    label: 'P',
    transformClass: '-rotate-6 translate-y-1 z-10 hover:-translate-y-1',
    baseStops: ['#7cd4ff', '#20afff', '#0284c7'],
    topStops: ['#94dcff', '#20afff'],
    stroke: '#ffffff',
    strokeOpacity: '0.75',
    textColor: '#111111'
  },
  {
    id: 'wave',
    isWaveform: true,
    transformClass: 'rotate-12 translate-y-3 hover:-translate-y-0.5',
    baseStops: ['#ffc2e2', '#ff82c2', '#ec4899'],
    topStops: ['#ffd4eb', '#ff82c2'],
    stroke: '#ffffff',
    strokeOpacity: '0.75',
    textColor: '#111111'
  }
]

const featureStamps = [
  { id: 'phase', label: 'Deteksi Fasa 180°', glassBg: 'rgba(255, 218, 64, 0.82)', icon: Zap },
  { id: 'mic', label: 'Mic Pairing AI', glassBg: 'rgba(90, 211, 99, 0.78)', icon: Mic },
  { id: 'comb', label: 'Zero Comb Filtering', glassBg: 'rgba(255, 130, 194, 0.80)', icon: Activity },
  { id: 's3', label: 'Non-Destructive S3', glassBg: 'rgba(32, 175, 255, 0.78)', icon: ShieldCheck }
]

const activeModuleIndex = ref(0)

const diagnosticModules = [
  {
    id: 'phase',
    num: '01',
    layout: 'text-left',
    shortLabel: 'Deteksi Fasa',
    title: 'Deteksi Fasa & Comb Filtering',
    description:
      'Memindai korelasi stereo dari -1.0 hingga +1.0 serta menyelaraskan waktu mikrofon berpasangan dalam skala sub-milidetik untuk mencegah vokal dan bass terdengar tipis.',
    hex: '#20afff',
    glassBg: 'rgba(32, 175, 255, 0.74)',
    previewTag: 'Correlation +0.94',
    previewMetrics: [
      { label: 'Delta Delay', value: '+1.8 ms' },
      { label: 'Polarity', value: 'Aligned (0°)' }
    ],
    previewCaption: 'Snare Top & Bottom sinkron < 1 sample'
  },
  {
    id: 'fake-stereo',
    num: '02',
    layout: 'centered',
    shortLabel: 'Fake Stereo',
    title: 'Pembersihan Fake Stereo',
    description:
      'Mengidentifikasi manipulasi Haas effect artifisial dan mikrodifusi yang merusak kompatibilitas mono. Kembalikan ke format mono sejati tanpa degradasi frekuensi.',
    hex: '#ffda40',
    glassBg: 'rgba(255, 218, 64, 0.80)',
    previewTag: 'Haas Leak Detected',
    previewMetrics: [
      { label: 'L/R Drift', value: '14.2 ms' },
      { label: 'Mono Output', value: '100% Safe' },
      { label: 'Phase Cancel', value: '0.0%' }
    ],
    previewCaption: 'Collapsed ke True Mono tanpa comb cancellation'
  },
  {
    id: 'true-peak',
    num: '03',
    layout: 'visual-left',
    shortLabel: 'True-Peak Guard',
    title: 'True-Peak & DC Offset Guard',
    description:
      'Kalkulasi 4x oversampling untuk menangkal inter-sample peaks (ISP), memotong rumble subsonik di bawah 25Hz (Butterworth), dan menstabilkan headroom DAW.',
    hex: '#5ad363',
    glassBg: 'rgba(90, 211, 99, 0.74)',
    previewTag: '4x Oversampling',
    previewMetrics: [
      { label: 'Peak Target', value: '-3.0 dBFS' },
      { label: 'HPF Cutoff', value: '25 Hz' }
    ],
    previewCaption: 'DC Offset 0.00% • Siap untuk mixing'
  }
]

const currentModule = computed(() => diagnosticModules[activeModuleIndex.value])

function selectModule(index) {
  activeModuleIndex.value = index
}

function handleFolderTabKeyDown(e, index) {
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    selectModule((index + 1) % diagnosticModules.length)
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    selectModule((index - 1 + diagnosticModules.length) % diagnosticModules.length)
  }
}

const currentFaq = computed(() => faqs.value[activeFaq.value] || faqs.value[0])

function prevFaq() {
  activeFaq.value = (activeFaq.value - 1 + faqs.value.length) % faqs.value.length
}

function nextFaq() {
  activeFaq.value = (activeFaq.value + 1) % faqs.value.length
}

function selectFaq(index) {
  activeFaq.value = index
}

// Interactive 3D Cylindrical Carousel for Section 4
const posterCards = [
  { id: 'standar', tag: 'ITU-R BS.1770-4', title: '[ Standar Audio ]', footer: 'Polaris Audio' },
  { id: 'spektrum', tag: '48 kHz · 4x ISP', title: 'Audit Spektrum Deterministik', footer: 'Zero Coloration' },
  { id: 'precision', tag: '32-Bit FP', title: 'Proses 32-Bit FP', footer: '/03' },
  { id: 'ceiling', tag: '-3.0 dBFS', title: 'Terverifikasi Matematis', footer: 'DC Offset 0.00%' },
  { id: 'archive', tag: 'Non-Destructive', title: 'Arsip S3 Utuh', footer: 'FIXED_ Prefix' }
]

const activePosterIndex = ref(0)
const isPosterDragging = ref(false)
const posterDragStartX = ref(0)
const posterDragDeltaX = ref(0)
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)

function handleViewportResize() {
  viewportWidth.value = window.innerWidth
}

function prevPoster() {
  activePosterIndex.value = (activePosterIndex.value - 1 + posterCards.length) % posterCards.length
}

function nextPoster() {
  activePosterIndex.value = (activePosterIndex.value + 1) % posterCards.length
}

function selectPoster(index) {
  if (Math.abs(posterDragDeltaX.value) > 6) return
  activePosterIndex.value = index
}

function onPosterPointerDown(e) {
  isPosterDragging.value = true
  posterDragStartX.value = e.clientX
  posterDragDeltaX.value = 0
}

function onPosterPointerMove(e) {
  if (!isPosterDragging.value) return
  posterDragDeltaX.value = Math.max(-240, Math.min(240, e.clientX - posterDragStartX.value))
}

function onPosterPointerUp() {
  if (!isPosterDragging.value) return
  const delta = posterDragDeltaX.value
  isPosterDragging.value = false
  posterDragDeltaX.value = 0
  if (delta < -45) {
    nextPoster()
  } else if (delta > 45) {
    prevPoster()
  }
}

function getPosterCardStyle(idx) {
  const total = posterCards.length
  let offset = (idx - activePosterIndex.value + total) % total
  if (offset > total / 2) offset -= total

  const dragShift = isPosterDragging.value ? posterDragDeltaX.value / 240 : 0
  const continuous = offset + dragShift
  const angleDeg = continuous * 38
  const rad = (angleDeg * Math.PI) / 180

  const radiusX = viewportWidth.value < 640 ? 215 : viewportWidth.value < 1024 ? 335 : 435
  const tx = Math.sin(rad) * radiusX
  const tz = (Math.cos(rad) - 1) * 260
  const rotY = -angleDeg * 0.72
  const absPos = Math.abs(continuous)
  const scale = Math.max(0.72, 1 - absPos * 0.1)
  const zIndex = 50 - Math.round(absPos * 15)
  const opacity = Math.max(0.55, 1 - absPos * 0.18)
  const brightness = Math.max(0.72, 1 - absPos * 0.13)

  return {
    transform: `translate3d(${tx.toFixed(1)}px, 0, ${tz.toFixed(1)}px) rotateY(${rotY.toFixed(1)}deg) scale(${scale.toFixed(3)})`,
    zIndex,
    opacity,
    filter: `brightness(${brightness.toFixed(2)})`,
    transition: isPosterDragging.value
      ? 'none'
      : 'transform 460ms cubic-bezier(0.22, 1, 0.36, 1), opacity 320ms ease, filter 320ms ease'
  }
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

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

function scrollToFeatures() {
  scrollToSection('studio-features')
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(async () => {
  window.addEventListener('resize', handleViewportResize)
  if (authStore.isAuthenticated) {
    await authStore.fetchMe()
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleViewportResize)
})
</script>

<template>
  <div class="min-h-screen bg-white text-black flex flex-col font-sans selection:bg-[#ff82c2] selection:text-black">
    <AppNavbar :fluid="true" />

    <!-- HERO SECTION (Centered Layout + Notebook Retro Glassmorphism Style) -->
    <section class="relative notebook-paper pt-14 pb-10 md:pt-20 md:pb-12 overflow-hidden">
      <!-- Soft Ambient Retro Glow Behind Keycaps & Frosted CTAs -->
      <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-20 flex justify-center">
        <div class="w-[640px] h-[260px] rounded-full bg-gradient-to-r from-[#20afff]/18 via-[#ffda40]/22 to-[#ff82c2]/18 blur-3xl"></div>
      </div>

      <div class="relative z-10 max-w-[1100px] mx-auto px-6 flex flex-col items-center text-center">

        <!-- Bold Centered 2-Line Display Headline -->
        <h1 class="font-editorial text-[2.25rem] sm:text-5xl md:text-6xl lg:text-[4.5rem] leading-[0.98] tracking-[-0.045em] text-[#111111] font-extrabold max-w-4xl relative z-10">
          Diagnostik fasa presisi, <br class="hidden sm:inline" />
          perbaikan stem tanpa kompromi.
        </h1>

        <!-- Tactile Frosted Retro 3D Keycaps Visual (D · S · P · Audio Glyph) -->
        <div
          aria-hidden="true"
          class="relative z-20 -mt-1 sm:-mt-3 mb-8 flex items-center justify-center select-none"
        >
          <div class="flex items-center justify-center -space-x-1 sm:space-x-0 md:space-x-1">
            <div
              v-for="k in heroKeys"
              :key="k.id"
              :class="k.transformClass"
              class="w-16 h-16 sm:w-24 sm:h-24 md:w-28 md:h-28 transition-transform duration-200"
            >
              <svg viewBox="0 0 120 120" class="w-full h-full overflow-visible" fill="none">
                <defs>
                  <linearGradient :id="`keyBase-${k.id}`" x1="15" y1="15" x2="105" y2="110" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" :stop-color="k.baseStops[0]" />
                    <stop offset="55%" :stop-color="k.baseStops[1]" />
                    <stop offset="100%" :stop-color="k.baseStops[2]" />
                  </linearGradient>
                  <linearGradient :id="`keyTop-${k.id}`" x1="24" y1="20" x2="90" y2="88" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" :stop-color="k.topStops[0]" />
                    <stop offset="100%" :stop-color="k.topStops[1]" />
                  </linearGradient>
                </defs>
                <!-- Crisp Cartoon Offset Ink Shadow -->
                <rect x="19" y="23" width="90" height="88" rx="18" fill="#111111" />
                <!-- Frosted Retro Keycap Body -->
                <rect
                  x="14"
                  y="18"
                  width="90"
                  height="88"
                  rx="18"
                  :fill="`url(#keyBase-${k.id})`"
                  fill-opacity="0.92"
                  stroke="#111111"
                  stroke-width="2.2"
                />
                <!-- Specular Glass Dish Face -->
                <rect
                  x="23"
                  y="21"
                  width="68"
                  height="66"
                  rx="12"
                  :fill="`url(#keyTop-${k.id})`"
                  fill-opacity="0.88"
                  :stroke="k.stroke"
                  :stroke-opacity="k.strokeOpacity"
                  stroke-width="1.4"
                />
                <g v-if="k.isWaveform" :fill="k.textColor">
                  <rect x="39" y="50" width="4" height="8" />
                  <rect x="45" y="44" width="4" height="20" />
                  <rect x="51" y="38" width="4" height="32" />
                  <rect x="57" y="46" width="4" height="16" />
                  <rect x="63" y="40" width="4" height="28" />
                  <rect x="69" y="48" width="4" height="12" />
                </g>
                <text
                  v-else
                  x="57"
                  y="63"
                  text-anchor="middle"
                  font-family="'Plus Jakarta Sans', sans-serif"
                  font-size="30"
                  font-weight="700"
                  :fill="k.textColor"
                >
                  {{ k.label }}
                </text>
              </svg>
            </div>
          </div>
        </div>

        <!-- Concise Supporting Copy -->
        <p class="text-sm sm:text-base text-[#111111]/75 leading-relaxed max-w-xl font-normal mb-7">
          Otomatisasi pembersihan multitrack mixing berbasis hybrid DSP deterministik dan AI. Deteksi fasa terbalik, fake stereo, DC offset, dan normalisasi headroom studio secara instan.
        </p>

        <!-- Tactile 3D Keycap CTAs (Matches D · S · P · Wave keycap styling) -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-9">
          <button
            @click="launchStudioInstantly"
            :disabled="isLaunching"
            class="btn-keycap btn-keycap-blue px-6 py-2.5 text-xs disabled:opacity-50"
          >
            {{ isLaunching ? 'Menyiapkan Studio...' : 'Buka Studio Instan' }}
          </button>

          <router-link
            to="/register"
            class="btn-keycap btn-keycap-white px-5 py-2.5 text-xs"
          >
            Daftar Akun &rarr;
          </router-link>
        </div>

        <!-- Tactile Keycap Scroll Cue -->
        <button
          type="button"
          @click="scrollToFeatures"
          aria-label="Gulir ke fitur studio"
          class="btn-keycap btn-keycap-white w-10 h-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
        >
          <ArrowDown class="w-4 h-4" :stroke-width="2.2" />
        </button>

      </div>
    </section>

    <!-- FEATURE SCRAPBOOK BLOCK: NOTEBOOK LINER-NOTES SPREAD (Retro + Frosted Glass) -->
    <section id="studio-features" class="relative w-full notebook-paper text-black pt-10 pb-12 md:pt-14 md:pb-16 overflow-hidden">
      <!-- Soft Ambient Retro Glow Behind Glass Cards -->
      <div aria-hidden="true" class="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div class="w-[780px] h-[280px] rounded-full bg-gradient-to-r from-[#20afff]/12 via-[#ff82c2]/10 to-[#ffda40]/16 blur-3xl"></div>
      </div>

      <!-- Subtle Curved Notebook Top Edge -->
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 28"
        preserveAspectRatio="none"
        class="relative z-10 w-full h-5 sm:h-7 block -mt-10 md:-mt-14 mb-8 md:mb-10 pointer-events-none"
      >
        <path d="M0,26 Q720,0 1440,26" fill="none" stroke="#d4d4d0" stroke-width="1.25" />
      </svg>

      <div class="relative z-10 max-w-[1160px] mx-auto px-6">
        <!-- Top Margin Annotation -->
        <div class="mb-8 lg:mb-4">
          <span class="font-sans italic text-xs text-[#60605e] tracking-tight">
            studio notes
          </span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-[200px_1fr_200px] xl:grid-cols-[220px_1fr_220px] gap-10 lg:gap-8 items-center">

          <!-- Left Taped Frosted Polaroid Card: Reference Stem -->
          <div class="order-2 lg:order-1 flex justify-center">
            <div class="relative w-48 sm:w-52 bg-white/65 backdrop-blur-md p-2.5 pb-4 border-2 border-[#111111] shadow-[5px_5px_0px_0px_rgba(17,17,17,1),inset_0_1px_0_rgba(255,255,255,0.9)] -rotate-3 hover:rotate-0 transition-transform duration-300">
              <!-- Top-Left & Top-Right Translucent Washi Tape -->
              <span aria-hidden="true" class="absolute -top-2.5 -left-3 w-11 h-4 bg-[#cfd6e5]/85 backdrop-blur-xs -rotate-45 pointer-events-none"></span>
              <span aria-hidden="true" class="absolute -top-2.5 -right-3 w-11 h-4 bg-[#ffda40]/60 backdrop-blur-xs rotate-45 pointer-events-none"></span>

              <div class="bg-[#18181b]/95 text-white p-3.5 aspect-[4/4.2] flex flex-col justify-between">
                <div class="flex items-center justify-between text-[10px] font-sans font-medium">
                  <span class="text-[#a1a1aa]">Stem 01</span>
                  <span class="px-1.5 py-0.5 bg-white text-black font-bold">REF</span>
                </div>

                <!-- Clean Reference Phase Waveform SVG -->
                <svg viewBox="0 0 140 54" class="w-full h-12 my-1" fill="none" aria-hidden="true">
                  <line x1="0" y1="27" x2="140" y2="27" stroke="#3f3f46" stroke-width="1" stroke-dasharray="2 2" />
                  <path
                    d="M4 27 Q16 27 22 14 T38 38 T54 9 T70 43 T86 18 T102 33 T118 24 T136 27"
                    stroke="#ffffff"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>

                <div>
                  <span class="block text-xs font-semibold text-white truncate">Snare_Top.wav</span>
                  <span class="block text-[10px] text-[#a1a1aa] mt-0.5">Cluster: Drum Multi-Mic</span>
                </div>
              </div>

              <p class="font-sans text-[11px] font-medium text-[#111111]/75 text-center mt-2.5 tabular-nums">
                ref &middot; +0.0ms
              </p>
            </div>
          </div>

          <!-- Center Editorial Note & Frosted Perforated Feature Stamps -->
          <div class="order-1 lg:order-2 flex flex-col items-center text-center space-y-6 max-w-xl mx-auto">
            <p class="font-editorial text-base sm:text-lg md:text-[1.15rem] text-[#18181b] leading-[1.85] font-normal">
              Mikrofon ganda pada drum dan gitar sering saling membatalkan frekuensi bass akibat selisih jarak fisik. Algoritma korelasi Polaris mendeteksi pergeseran sinyal sub-milidetik dan menyelaraskan polaritas secara otomatis tanpa mengubah karakter asli rekaman Anda.
            </p>

            <!-- 2x2 Frosted Gel Perforated Chromatic Stamp Tags -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div
                v-for="stamp in featureStamps"
                :key="stamp.id"
                class="flex items-center justify-center gap-1.5"
              >
                <span
                  :style="{ backgroundColor: stamp.glassBg }"
                  class="stamp-serrated backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] px-4 py-1.5 text-xs font-semibold text-black whitespace-nowrap"
                >
                  {{ stamp.label }}
                </span>
                <span
                  aria-hidden="true"
                  :style="{ backgroundColor: stamp.glassBg }"
                  class="stamp-serrated-sq backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] w-8 h-8 flex items-center justify-center text-black shrink-0"
                >
                  <component :is="stamp.icon" class="w-3.5 h-3.5" :stroke-width="2" />
                </span>
              </div>
            </div>
          </div>

          <!-- Right Taped Frosted Polaroid Card: Inverted / Fixed Stem -->
          <div class="order-3 flex justify-center">
            <div class="relative w-48 sm:w-52 bg-white/65 backdrop-blur-md p-2.5 pb-4 border-2 border-[#111111] shadow-[5px_5px_0px_0px_rgba(17,17,17,1),inset_0_1px_0_rgba(255,255,255,0.9)] rotate-3 hover:rotate-0 transition-transform duration-300">
              <!-- Top-Left & Top-Right Translucent Washi Tape -->
              <span aria-hidden="true" class="absolute -top-2.5 -left-3 w-11 h-4 bg-[#cfd6e5]/85 backdrop-blur-xs -rotate-45 pointer-events-none"></span>
              <span aria-hidden="true" class="absolute -top-2.5 -right-3 w-11 h-4 bg-[#ffda40]/60 backdrop-blur-xs rotate-45 pointer-events-none"></span>

              <div class="bg-[#18181b]/95 text-white p-3.5 aspect-[4/4.2] flex flex-col justify-between">
                <div class="flex items-center justify-between text-[10px] font-sans font-medium">
                  <span class="text-[#a1a1aa]">Stem 02</span>
                  <span class="px-1.5 py-0.5 bg-[#ff6138] text-black font-bold tabular-nums">180° INV</span>
                </div>

                <!-- Inverted vs Aligned Dual Phase Waveform SVG -->
                <svg viewBox="0 0 140 54" class="w-full h-12 my-1" fill="none" aria-hidden="true">
                  <line x1="0" y1="27" x2="140" y2="27" stroke="#3f3f46" stroke-width="1" stroke-dasharray="2 2" />
                  <path
                    d="M4 27 Q16 27 22 40 T38 16 T54 45 T70 11 T86 36 T102 21 T118 30 T136 27"
                    stroke="#ff6138"
                    stroke-width="1.75"
                    stroke-dasharray="3 2"
                    stroke-linecap="round"
                  />
                  <path
                    d="M4 27 Q16 27 22 14 T38 38 T54 9 T70 43 T86 18 T102 33 T118 24 T136 27"
                    stroke="#20afff"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>

                <div>
                  <span class="block text-xs font-semibold text-white truncate">Snare_Bottom.wav</span>
                  <span class="block text-[10px] text-[#ff82c2] mt-0.5">Polaritas Terbalik (-0.88)</span>
                </div>
              </div>

              <p class="font-sans text-[11px] font-medium text-[#111111]/75 text-center mt-2.5 tabular-nums">
                phase fixed &middot; +1.8ms
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- RETRO + GLASSMORPHISM FOLDER STACK: ARSITEKTUR DIAGNOSTIK AUDIO -->
    <section class="relative pt-6 pb-20 md:pt-8 md:pb-28 notebook-paper w-full overflow-hidden">
      <!-- Ambient Chromatic Glow Behind Frosted Folder Stack -->
      <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-24 flex justify-center">
        <div class="w-[920px] h-[360px] rounded-full bg-gradient-to-tr from-[#20afff]/18 via-[#ff82c2]/14 to-[#ffda40]/20 blur-3xl"></div>
      </div>

      <div class="relative z-10 max-w-[1440px] mx-auto px-3 sm:px-5 md:px-6 space-y-10">
        <div class="text-center max-w-2xl mx-auto space-y-2 px-3">
          <span class="block text-xs font-medium tracking-wide text-[#60605e]">
            Arsitektur Diagnostik Audio
          </span>
          <h2 class="font-editorial text-3xl sm:text-4xl font-extrabold tracking-[-0.03em] text-black">
            Standar audit audio studio tanpa tebak-tebakan.
          </h2>
        </div>

        <!-- Frosted Acrylic Retro Die-Cut Folder Stack (No black outlines / hard shadow boxes) -->
        <div class="w-full relative pt-2">
          <!-- Back Translucent Folder Layers & White Paper Sheets Peeking Behind -->
          <div aria-hidden="true" class="hidden sm:block mx-6 h-3 rounded-t-[10px] bg-[#ff82c2]/55 backdrop-blur-sm border-t border-x border-white/60"></div>
          <div aria-hidden="true" class="hidden sm:block mx-8 h-1.5 bg-white/85 backdrop-blur-xs"></div>
          <div aria-hidden="true" class="hidden sm:block mx-4 h-3 rounded-t-[10px] bg-[#ffda40]/60 backdrop-blur-sm border-t border-x border-white/60"></div>
          <div aria-hidden="true" class="hidden sm:block mx-6 h-1.5 bg-white/85 backdrop-blur-xs"></div>

          <!-- Seamless Number-Only Die-Cut Folder Tabs (01 · 02 · 03) -->
          <div
            role="tablist"
            aria-label="Modul Diagnostik Audio"
            class="relative z-30 flex items-end pl-3 sm:pl-6"
          >
            <button
              v-for="(mod, idx) in diagnosticModules"
              :key="mod.id"
              :id="`folder-tab-${mod.id}`"
              type="button"
              role="tab"
              :aria-selected="activeModuleIndex === idx"
              :aria-controls="`folder-panel-${mod.id}`"
              :aria-label="`Modul ${mod.num}: ${mod.title}`"
              @click="selectModule(idx)"
              @keydown="handleFolderTabKeyDown($event, idx)"
              :class="[
                idx > 0 ? '-ml-2.5' : '',
                activeModuleIndex === idx ? 'z-30 h-10 opacity-100' : 'z-10 h-9 opacity-80 hover:opacity-100'
              ]"
              class="group relative w-20 sm:w-24 flex items-center justify-center pr-3 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black transition-all"
            >
              <!-- Single Seamless SVG Tab Shape (Zero internal vertical seam, zero black outline) -->
              <svg
                aria-hidden="true"
                viewBox="0 0 88 40"
                preserveAspectRatio="none"
                class="absolute inset-0 w-full h-full pointer-events-none"
              >
                <path
                  d="M0,40 L0,10 Q0,0 10,0 L64,0 Q71,0 75,10 L88,40 Z"
                  :fill="mod.glassBg"
                />
                <path
                  d="M1,39 L1,10 Q1,1 10,1 L64,1 Q70,1 74,10 L86,39"
                  fill="none"
                  stroke="#ffffff"
                  stroke-opacity="0.6"
                  stroke-width="1.2"
                />
              </svg>
              <span class="relative z-10 font-sans text-xs font-bold text-[#111111] tabular-nums">
                {{ mod.num }}
              </span>
            </button>
          </div>

          <!-- Active Frosted Glass Retro Folder Body (Soft glass rim, no black outline or shadow box) -->
          <div
            :id="`folder-panel-${currentModule.id}`"
            role="tabpanel"
            :aria-labelledby="`folder-tab-${currentModule.id}`"
            :style="{ backgroundColor: currentModule.glassBg }"
            :class="activeModuleIndex === 0 ? 'rounded-b-[14px] rounded-tr-[14px] rounded-tl-none sm:rounded-tl-[14px]' : 'rounded-[14px]'"
            class="relative z-20 backdrop-blur-md border border-white/65 text-[#111111] transition-colors duration-200 shadow-[0_14px_36px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.75)] overflow-hidden"
          >
            <div class="px-5 sm:px-9 md:px-12 pt-6 pb-8 md:pt-8 md:pb-10">
              <!-- Dotted Fold Score Line -->
              <div class="border-t border-dotted border-[#111111]/25 pt-6 md:pt-8">
                <div
                  :class="currentModule.layout === 'centered'
                    ? 'flex flex-col items-center text-center gap-7 max-w-2xl mx-auto'
                    : 'grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center'"
                >

                  <!-- Editorial Content Block (Left on 01, Top-Centered on 02, Right on 03) -->
                  <div
                    :class="currentModule.layout === 'centered'
                      ? 'flex flex-col items-center space-y-3 order-1'
                      : currentModule.layout === 'visual-left'
                        ? 'space-y-5 order-1 lg:order-2'
                        : 'space-y-5 order-1'"
                  >
                    <h3 class="font-editorial text-3xl sm:text-4xl lg:text-[2.75rem] leading-[1.05] font-extrabold tracking-[-0.035em] text-[#111111]">
                      {{ currentModule.title }}
                    </h3>

                    <p class="font-sans text-sm sm:text-base leading-relaxed text-[#111111]/85 max-w-xl font-normal">
                      {{ currentModule.description }}
                    </p>

                    <!-- Inline CTA for split layouts (01 & 03) -->
                    <button
                      v-if="currentModule.layout !== 'centered'"
                      type="button"
                      @click="launchStudioInstantly"
                      class="w-full max-w-md flex items-center gap-4 pt-3 group cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                    >
                      <span class="inline-flex items-center gap-1.5 text-xs font-bold text-[#111111] whitespace-nowrap group-hover:underline">
                        <span>Uji Modul di Studio</span>
                        <ArrowUpRight class="w-3.5 h-3.5" :stroke-width="2" />
                      </span>
                      <span class="flex-1 h-px bg-[#111111]/30"></span>
                    </button>
                  </div>

                  <!-- Taped Frosted Glass Polaroid Studio Card (Right on 01, Center on 02, Left on 03) -->
                  <div
                    :class="currentModule.layout === 'centered'
                      ? 'w-full flex justify-center order-2'
                      : currentModule.layout === 'visual-left'
                        ? 'flex justify-center lg:justify-start order-2 lg:order-1'
                        : 'flex justify-center lg:justify-end order-2'"
                  >
                    <div
                      :class="currentModule.layout === 'centered'
                        ? 'max-w-xl -rotate-1'
                        : currentModule.layout === 'visual-left'
                          ? 'max-w-md -rotate-1'
                          : 'max-w-md rotate-1'"
                      class="relative w-full bg-white/70 backdrop-blur-lg border border-white/80 p-4 sm:p-5 shadow-[0_12px_30px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.95)] hover:rotate-0 transition-transform duration-200"
                    >
                      <!-- Translucent Washi Tape Strips on Corners -->
                      <span aria-hidden="true" class="absolute -top-2.5 -left-3 w-12 h-4 bg-[#cfd6e5]/85 backdrop-blur-xs -rotate-45 pointer-events-none"></span>
                      <span aria-hidden="true" class="absolute -top-2.5 -right-3 w-12 h-4 bg-[#ff82c2]/65 backdrop-blur-xs rotate-45 pointer-events-none"></span>

                      <!-- Inner Smoked Translucent Dark Studio Screen -->
                      <div class="bg-[#18181b]/90 backdrop-blur-sm text-white p-4 sm:p-5 text-left">
                        <div class="flex items-center justify-between pb-3 border-b border-white/15 font-sans text-xs">
                          <span class="font-semibold text-[#a1a1aa]">{{ currentModule.shortLabel }}</span>
                          <span
                            :style="{ backgroundColor: currentModule.hex }"
                            class="px-2.5 py-0.5 text-[#111111] text-[11px] font-bold"
                          >
                            {{ currentModule.previewTag }}
                          </span>
                        </div>

                        <!-- Module-specific Graphic Display -->
                        <div class="py-5">
                          <svg v-if="currentModule.id === 'phase'" viewBox="0 0 260 76" class="w-full h-18" fill="none" aria-hidden="true">
                            <line x1="0" y1="38" x2="260" y2="38" stroke="#3f3f46" stroke-width="1" stroke-dasharray="3 3" />
                            <path
                              d="M6 38 Q26 10 46 38 T86 38 T126 38 T166 38 T206 38 T246 38"
                              stroke="#ffffff"
                              stroke-width="2"
                            />
                            <path
                              d="M6 38 Q26 14 46 38 T86 38 T126 38 T166 38 T206 38 T246 38"
                              stroke="#20afff"
                              stroke-width="2.25"
                            />
                          </svg>

                          <svg v-else-if="currentModule.id === 'fake-stereo'" viewBox="0 0 260 76" class="w-full h-18" fill="none" aria-hidden="true">
                            <line x1="0" y1="38" x2="260" y2="38" stroke="#3f3f46" stroke-width="1" stroke-dasharray="3 3" />
                            <path
                              d="M6 38 C32 8, 52 68, 78 38 C104 8, 124 68, 150 38 C176 8, 196 68, 222 38"
                              stroke="#ff82c2"
                              stroke-width="1.75"
                              stroke-dasharray="4 3"
                            />
                            <line x1="16" y1="38" x2="244" y2="38" stroke="#ffda40" stroke-width="2.5" />
                            <rect x="92" y="25" width="76" height="26" fill="#ffda40" stroke="#ffffff" stroke-width="1.2" />
                            <text x="130" y="42" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="800" fill="#111111">TRUE MONO</text>
                          </svg>

                          <svg v-else viewBox="0 0 260 76" class="w-full h-18" fill="none" aria-hidden="true">
                            <line x1="0" y1="18" x2="260" y2="18" stroke="#ff82c2" stroke-width="1" stroke-dasharray="4 3" />
                            <text x="256" y="13" text-anchor="end" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="600" fill="#ff82c2">-3.0 dBFS Ceiling</text>
                            <rect x="18" y="28" width="14" height="40" fill="#5ad363" />
                            <rect x="42" y="22" width="14" height="46" fill="#5ad363" />
                            <rect x="66" y="34" width="14" height="34" fill="#5ad363" />
                            <rect x="90" y="20" width="14" height="48" fill="#ffda40" />
                            <rect x="114" y="26" width="14" height="42" fill="#5ad363" />
                            <rect x="138" y="32" width="14" height="36" fill="#5ad363" />
                            <rect x="162" y="24" width="14" height="44" fill="#5ad363" />
                            <rect x="186" y="30" width="14" height="38" fill="#5ad363" />
                            <rect x="210" y="21" width="14" height="47" fill="#ffda40" />
                            <rect x="234" y="36" width="14" height="32" fill="#5ad363" />
                          </svg>
                        </div>

                        <!-- Frosted Metrics Grid (2 cols for split, 3 cols for centered wide) -->
                        <div
                          :class="currentModule.previewMetrics.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'"
                          class="grid gap-3 pt-3 border-t border-white/15"
                        >
                          <div
                            v-for="metric in currentModule.previewMetrics"
                            :key="metric.label"
                            class="bg-white/10 backdrop-blur-xs border border-white/15 px-3 py-2"
                          >
                            <span class="block font-sans text-[11px] font-medium text-[#d4d4d8]">{{ metric.label }}</span>
                            <span class="block font-sans text-sm font-bold text-white tabular-nums mt-0.5">{{ metric.value }}</span>
                          </div>
                        </div>
                      </div>

                      <!-- Polaroid Bottom Caption -->
                      <p class="font-sans text-xs font-medium text-[#111111]/75 text-center mt-3">
                        {{ currentModule.previewCaption }}
                      </p>
                    </div>
                  </div>

                  <!-- Centered CTA below visual for Folder 02 -->
                  <button
                    v-if="currentModule.layout === 'centered'"
                    type="button"
                    @click="launchStudioInstantly"
                    class="order-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#111111] underline underline-offset-4 hover:opacity-70 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                  >
                    <span>Uji Modul di Studio</span>
                    <ArrowUpRight class="w-3.5 h-3.5" :stroke-width="2" />
                  </button>

                </div>
              </div>
            </div>

            <!-- Bottom Physical Cardstock Crease Lines -->
            <div aria-hidden="true" class="space-y-1 pb-2.5">
              <div class="border-t border-[#111111]/20"></div>
              <div class="border-t border-white/55"></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION 4: INTERACTIVE 3D CYLINDRICAL RETRO CAROUSEL -->
    <section class="relative py-16 md:py-24 notebook-paper w-full overflow-hidden">
      <div class="max-w-[1440px] mx-auto px-4 sm:px-6 space-y-8">
        <div class="text-center max-w-xl mx-auto space-y-2">
          <span class="block text-xs font-medium tracking-wide text-[#60605e]">
            Standar &amp; Kualitas Output
          </span>
          <h2 class="font-editorial text-3xl sm:text-4xl font-extrabold tracking-[-0.03em] text-[#111111]">
            Terverifikasi secara matematis.
          </h2>
        </div>

        <!-- 3D Cylindrical Perspective Stage (Drag / Swipe / Click side cards) -->
        <div
          class="relative h-[400px] sm:h-[430px] flex items-center justify-center select-none touch-pan-y cursor-grab active:cursor-grabbing"
          style="perspective: 1200px;"
          @pointerdown="onPosterPointerDown"
          @pointermove="onPosterPointerMove"
          @pointerup="onPosterPointerUp"
          @pointercancel="onPosterPointerUp"
          @pointerleave="onPosterPointerUp"
        >
          <div class="relative w-full h-full flex items-center justify-center" style="transform-style: preserve-3d;">
            <div
              v-for="(card, idx) in posterCards"
              :key="card.id"
              :style="getPosterCardStyle(idx)"
              @click="selectPoster(idx)"
              role="button"
              tabindex="0"
              :aria-label="`Kartu ${idx + 1}: ${card.title}`"
              @keydown.enter="selectPoster(idx)"
              class="absolute w-[250px] sm:w-[295px] md:w-[315px] h-[355px] sm:h-[385px] rounded-[18px] overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
            >
              <!-- Card 0: Frosted Bone Paper -->
              <div
                v-if="card.id === 'standar'"
                class="w-full h-full bg-[#f4f3ee]/90 backdrop-blur-md border border-black/15 p-6 flex flex-col justify-between shadow-[0_18px_40px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.9)]"
              >
                <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-[#60605e]">
                  <span>01</span>
                  <span>{{ card.tag }}</span>
                </div>
                <div class="text-center space-y-2">
                  <h3 class="font-editorial text-2xl sm:text-3xl font-extrabold uppercase tracking-[-0.04em] text-[#111111] leading-none">
                    {{ card.title }}
                  </h3>
                  <p class="text-xs text-[#60605e] leading-relaxed">
                    Kepatuhan metrik DSP modern untuk kejernihan di semua sistem playback.
                  </p>
                </div>
                <div class="grid grid-cols-4 gap-1.5">
                  <div class="bg-[#18181b] h-14 p-1.5 flex items-center justify-center">
                    <svg viewBox="0 0 32 24" class="w-full h-full" fill="none" aria-hidden="true">
                      <path d="M2 12 Q8 2 16 12 T30 12" stroke="#20afff" stroke-width="2" />
                    </svg>
                  </div>
                  <div class="bg-[#20afff]/85 h-14 p-1.5 flex items-center justify-center">
                    <svg viewBox="0 0 28 28" class="w-6 h-6" fill="none" aria-hidden="true">
                      <circle cx="14" cy="14" r="10" stroke="#111111" stroke-width="1.5" stroke-dasharray="2 2" />
                      <line x1="14" y1="4" x2="14" y2="24" stroke="#111111" stroke-width="1.8" />
                    </svg>
                  </div>
                  <div class="bg-[#ffda40]/90 h-14 p-1.5 flex items-end justify-center gap-0.5">
                    <span class="w-1.5 h-4 bg-[#111111]"></span>
                    <span class="w-1.5 h-8 bg-[#111111]"></span>
                    <span class="w-1.5 h-6 bg-[#111111]"></span>
                  </div>
                  <div class="bg-[#ff82c2]/85 h-14 flex items-center justify-center">
                    <span class="text-[10px] font-extrabold text-[#111111]">32FP</span>
                  </div>
                </div>
              </div>

              <!-- Card 1: Vibrant Retro Ember Orange -->
              <div
                v-else-if="card.id === 'spektrum'"
                class="w-full h-full bg-[#ff5a2c]/92 backdrop-blur-md border border-white/35 p-6 flex flex-col justify-between text-[#111111] shadow-[0_18px_40px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.45)]"
              >
                <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em]">
                  <span>02</span>
                  <span class="bg-[#18181b] text-white px-2 py-0.5">{{ card.tag }}</span>
                </div>
                <div class="text-center space-y-3">
                  <h3 class="font-editorial text-3xl font-extrabold uppercase tracking-[-0.04em] leading-[0.95]">
                    Audit Spektrum <br /> Deterministik
                  </h3>
                  <p class="text-xs text-[#111111]/85 leading-relaxed font-medium">
                    Tanpa modulasi acak, pewarnaan frekuensi, atau saturasi artifisial.
                  </p>
                </div>
                <div class="flex items-center justify-between pt-3 border-t border-black/15 text-[10px] font-bold uppercase tracking-wider">
                  <span>Zero Coloration</span>
                  <span>Polaris Engine</span>
                </div>
              </div>

              <!-- Card 2: Smoked Ink Dark Console -->
              <div
                v-else-if="card.id === 'precision'"
                class="w-full h-full bg-[#141416]/95 backdrop-blur-md border border-white/15 p-6 flex flex-col justify-between text-white shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
              >
                <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-[#a1a1aa]">
                  <span>03</span>
                  <span>{{ card.tag }}</span>
                </div>
                <div class="flex flex-col items-center gap-4">
                  <svg viewBox="0 0 120 84" class="w-28 h-20" fill="none" aria-hidden="true">
                    <circle cx="60" cy="42" r="34" stroke="#27272a" stroke-width="1.2" />
                    <ellipse cx="60" cy="42" rx="10" ry="30" transform="rotate(-12 60 42)" stroke="#20afff" stroke-width="2" fill="#20afff" fill-opacity="0.14" />
                    <line x1="60" y1="8" x2="60" y2="76" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.6" />
                  </svg>
                  <div class="w-full divide-y divide-white/10 border-y border-white/10 text-[11px]">
                    <div class="py-1.5 flex justify-between">
                      <span class="text-[#a1a1aa]">Oversampling</span>
                      <span class="font-semibold">&ge; 4x Polyphase</span>
                    </div>
                    <div class="py-1.5 flex justify-between">
                      <span class="text-[#a1a1aa]">HPF Cutoff</span>
                      <span class="font-semibold">25 Hz Butterworth</span>
                    </div>
                    <div class="py-1.5 flex justify-between">
                      <span class="text-[#a1a1aa]">Peak Target</span>
                      <span class="font-semibold">-3.0 dBFS</span>
                    </div>
                  </div>
                </div>
                <div class="flex items-end justify-between text-[10px] text-[#a1a1aa] uppercase tracking-wider font-bold">
                  <span>Phase &amp; Headroom</span>
                  <span class="font-editorial text-lg text-white leading-none">/03</span>
                </div>
              </div>

              <!-- Card 3: Frosted Signal Blue -->
              <div
                v-else-if="card.id === 'ceiling'"
                class="w-full h-full bg-[#20afff]/82 backdrop-blur-md border border-white/60 p-6 flex flex-col justify-between text-[#111111] shadow-[0_18px_40px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.75)]"
              >
                <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em]">
                  <span>04</span>
                  <span class="bg-white/85 px-2 py-0.5">{{ card.tag }}</span>
                </div>
                <div class="space-y-3 text-center">
                  <h3 class="font-editorial text-3xl font-extrabold uppercase tracking-[-0.03em] leading-[0.98]">
                    Terverifikasi Matematis
                  </h3>
                  <p class="text-xs text-[#111111]/85 leading-relaxed font-medium">
                    Lulus uji inter-sample peak, bebas DC offset, dan siap dikirim ke tahap mixing.
                  </p>
                </div>
                <div class="bg-white/75 backdrop-blur-sm p-3 flex items-center justify-between text-xs font-bold">
                  <span>DC Offset</span>
                  <span class="tabular-nums">0.00% Clean</span>
                </div>
              </div>

              <!-- Card 4: Frosted Leaf Green -->
              <div
                v-else
                class="w-full h-full bg-[#5ad363]/80 backdrop-blur-md border border-white/60 p-6 flex flex-col justify-between text-[#111111] shadow-[0_18px_40px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.75)]"
              >
                <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em]">
                  <span>05</span>
                  <span class="bg-[#18181b] text-white px-2 py-0.5">{{ card.tag }}</span>
                </div>
                <div class="space-y-4">
                  <h3 class="font-editorial text-2xl sm:text-3xl font-extrabold uppercase tracking-[-0.03em] leading-none">
                    Arsip S3 Utuh
                  </h3>
                  <div class="bg-[#18181b] p-3.5 text-white space-y-2 text-[11px]">
                    <div class="flex items-center justify-between text-[#a1a1aa]">
                      <span>File Asli</span>
                      <span>Terjaga 100%</span>
                    </div>
                    <div class="flex items-center justify-between font-bold text-[#5ad363]">
                      <span>File Hasil</span>
                      <span>FIXED_stem.wav</span>
                    </div>
                  </div>
                </div>
                <div class="text-[10px] font-bold uppercase tracking-wider text-[#111111]/80">
                  {{ card.footer }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tactile Keycap Carousel Controls -->
        <div class="flex items-center justify-center gap-4">
          <button
            type="button"
            @click="prevPoster"
            aria-label="Kartu sebelumnya"
            class="btn-keycap btn-keycap-sm btn-keycap-white w-10 h-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
          >
            <ChevronLeft class="w-4 h-4" :stroke-width="2.2" />
          </button>

          <span class="font-sans text-xs font-semibold text-[#60605e] tabular-nums px-2">
            {{ String(activePosterIndex + 1).padStart(2, '0') }} / {{ String(posterCards.length).padStart(2, '0') }}
          </span>

          <button
            type="button"
            @click="nextPoster"
            aria-label="Kartu berikutnya"
            class="btn-keycap btn-keycap-sm btn-keycap-dark w-10 h-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
          >
            <ChevronRight class="w-4 h-4" :stroke-width="2.2" />
          </button>
        </div>
      </div>
    </section>

    <!-- FAQ & CTA SCRAPBOOK SECTION (Sticky-Note Frosted Glass + Taped Polaroids + Quick Dock) -->
    <section id="faq-studio" class="relative py-20 md:py-28 notebook-paper border-t border-[#e5e5e3] overflow-hidden">
      <!-- Soft Ambient Pastel Glow Behind Sticky Note & Polaroids -->
      <div aria-hidden="true" class="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div class="w-[760px] h-[340px] rounded-full bg-gradient-to-r from-[#ffda40]/20 via-[#ff82c2]/12 to-[#20afff]/16 blur-3xl"></div>
      </div>

      <div class="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6">
        <div class="grid grid-cols-1 lg:grid-cols-[200px_1fr_200px] xl:grid-cols-[220px_1fr_220px] gap-10 lg:gap-8 items-center">

          <!-- Left Taped Frosted Polaroid Card -->
          <div class="order-2 lg:order-1 flex justify-center">
            <div class="relative w-48 sm:w-52 bg-white/70 backdrop-blur-md p-2.5 pb-4 border border-white/80 shadow-[0_12px_28px_rgba(0,0,0,0.09),inset_0_1px_0_rgba(255,255,255,0.95)] -rotate-3 hover:rotate-0 transition-transform duration-300">
              <span aria-hidden="true" class="absolute -top-2.5 -left-3 w-11 h-4 bg-[#cfd6e5]/85 backdrop-blur-xs -rotate-45 pointer-events-none"></span>
              <span aria-hidden="true" class="absolute -top-2.5 -right-3 w-11 h-4 bg-[#ffda40]/60 backdrop-blur-xs rotate-45 pointer-events-none"></span>

              <div class="bg-[#18181b]/95 text-white p-3.5 aspect-[4/4.2] flex flex-col justify-between">
                <div class="flex items-center justify-between text-[10px] font-sans font-medium">
                  <span class="text-[#a1a1aa]">Standar</span>
                  <span class="px-1.5 py-0.5 bg-[#ffda40] text-black font-bold">BS.1770</span>
                </div>

                <!-- Level Ceiling Graphic -->
                <svg viewBox="0 0 140 54" class="w-full h-12 my-1" fill="none" aria-hidden="true">
                  <line x1="0" y1="14" x2="140" y2="14" stroke="#ff82c2" stroke-width="1" stroke-dasharray="3 2" />
                  <rect x="12" y="22" width="10" height="24" fill="#20afff" />
                  <rect x="30" y="18" width="10" height="28" fill="#20afff" />
                  <rect x="48" y="26" width="10" height="20" fill="#20afff" />
                  <rect x="66" y="17" width="10" height="29" fill="#5ad363" />
                  <rect x="84" y="24" width="10" height="22" fill="#20afff" />
                  <rect x="102" y="19" width="10" height="27" fill="#5ad363" />
                  <rect x="120" y="28" width="10" height="18" fill="#20afff" />
                </svg>

                <div>
                  <span class="block text-xs font-semibold text-white">48 kHz / 32-Bit</span>
                  <span class="block text-[10px] text-[#a1a1aa] mt-0.5">Headroom -3.0 dBFS</span>
                </div>
              </div>

              <p class="font-sans text-[11px] font-medium text-[#60605e] text-center mt-2.5">
                siap kirim ke mixing
              </p>
            </div>
          </div>

          <!-- Center Column: Selection-Box Header + Frosted Yellow Sticky Note FAQ + Quick CTA Dock -->
          <div class="order-1 lg:order-2 flex flex-col items-center">
            <!-- Small Handwritten-Feel Annotation -->
            <span class="font-sans italic text-xs text-[#60605e] mb-2">
              tanya jawab
            </span>

            <!-- Selection-Frame Header with Blue Corner Anchor Handles -->
            <div class="relative inline-block -rotate-1 border border-[#111111] bg-white/80 backdrop-blur-sm px-7 py-2 mb-6 shadow-[0_6px_18px_rgba(0,0,0,0.05)]">
              <span aria-hidden="true" class="absolute -top-1 -left-1 w-2 h-2 bg-[#20afff]"></span>
              <span aria-hidden="true" class="absolute -top-1 -right-1 w-2 h-2 bg-[#20afff]"></span>
              <span aria-hidden="true" class="absolute -bottom-1 -left-1 w-2 h-2 bg-[#20afff]"></span>
              <span aria-hidden="true" class="absolute -bottom-1 -right-1 w-2 h-2 bg-[#20afff]"></span>
              <h2 class="font-editorial text-2xl sm:text-3xl font-extrabold tracking-[-0.03em] uppercase text-[#111111]">
                FAQ &amp; Studio
              </h2>
            </div>

            <!-- Frosted Sticky-Note FAQ Carousel (Warm Yellow Translucent Glass) -->
            <div class="w-full max-w-xl bg-[#ffda40]/65 backdrop-blur-md border border-white/70 p-6 sm:p-8 shadow-[0_16px_36px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.75)]">
              <!-- Compact Step Numbers Only (1 2 3 4) -->
              <div class="flex items-center gap-2 pb-4 border-b border-[#111111]/12 mb-5" role="tablist" aria-label="Indikator pertanyaan FAQ">
                <button
                  v-for="(_, idx) in faqs"
                  :key="idx"
                  type="button"
                  role="tab"
                  :aria-selected="activeFaq === idx"
                  :aria-label="`Pertanyaan ${idx + 1}`"
                  @click="selectFaq(idx)"
                  :class="activeFaq === idx
                    ? 'btn-keycap-dark'
                    : 'btn-keycap-white opacity-85 hover:opacity-100'"
                  class="btn-keycap btn-keycap-mini w-8 h-8 text-[11px] tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black"
                >
                  {{ idx + 1 }}
                </button>
              </div>

              <!-- Carousel Active FAQ Slide -->
              <div class="min-h-[148px] sm:min-h-[132px] flex flex-col justify-center" aria-live="polite">
                <Transition name="faq-fade" mode="out-in">
                  <div :key="activeFaq" class="space-y-3">
                    <h3 class="font-editorial text-lg sm:text-xl font-bold text-[#111111] leading-snug">
                      {{ currentFaq.q }}
                    </h3>
                    <p class="font-sans text-xs sm:text-sm text-[#111111]/85 leading-relaxed font-normal">
                      {{ currentFaq.a }}
                    </p>
                  </div>
                </Transition>
              </div>

              <!-- Prev & Next Keycap Controls inside Sticky Note -->
              <div class="pt-5 mt-5 border-t border-[#111111]/12 flex items-center justify-between gap-3">
                <button
                  type="button"
                  @click="prevFaq"
                  class="btn-keycap btn-keycap-sm btn-keycap-white px-4 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black"
                >
                  <ChevronLeft class="w-3.5 h-3.5" :stroke-width="2.2" />
                  <span>Mundur</span>
                </button>

                <button
                  type="button"
                  @click="nextFaq"
                  class="btn-keycap btn-keycap-sm btn-keycap-dark px-5 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                >
                  <span>Lanjut</span>
                  <ChevronRight class="w-3.5 h-3.5" :stroke-width="2.2" />
                </button>
              </div>
            </div>

            <!-- Static CTA Block Outside Carousel (Does not slide with FAQ) -->
            <div class="mt-6 flex flex-col items-center text-center space-y-3">
              <button
                type="button"
                @click="launchStudioInstantly"
                :disabled="isLaunching"
                class="btn-keycap btn-keycap-blue px-6 py-2.5 text-xs disabled:opacity-50"
              >
                {{ isLaunching ? 'Menyiapkan Studio...' : 'Buka Studio Instan' }}
              </button>

              <div class="flex flex-col items-center space-y-1 pt-1">
                <div class="flex items-center gap-2 text-xs text-[#60605e] font-sans italic">
                  <svg aria-hidden="true" viewBox="0 0 28 18" class="w-5 h-3.5 text-[#111111]/60" fill="none">
                    <path d="M2,2 Q4,14 24,12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                    <path d="M19,8 L25,12 L19,16" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <span>Siap bersihkan fasa &amp; headroom multitrack Anda</span>
                </div>
                <router-link
                  to="/register"
                  class="text-xs font-semibold text-[#20afff] hover:underline"
                >
                  Buat akun permanen sekarang
                </router-link>
              </div>
            </div>

            <!-- Floating Frosted Glass Quick-Action Dock -->
            <div class="mt-5 inline-flex items-center divide-x divide-[#111111]/10 bg-white/75 backdrop-blur-lg border border-white/85 rounded-[12px] shadow-[0_10px_28px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.95)] px-2 py-2">
              <button
                type="button"
                @click="launchStudioInstantly"
                class="px-4 py-1.5 flex flex-col items-center gap-1 text-[#111111] hover:opacity-70 transition-opacity cursor-pointer"
              >
                <Play class="w-3.5 h-3.5" :stroke-width="2" />
                <span class="text-[10px] font-bold uppercase tracking-wider">Studio</span>
              </button>
              <router-link
                to="/billing"
                class="px-4 py-1.5 flex flex-col items-center gap-1 text-[#111111] hover:opacity-70 transition-opacity"
              >
                <Coins class="w-3.5 h-3.5" :stroke-width="2" />
                <span class="text-[10px] font-bold uppercase tracking-wider">Kuota</span>
              </router-link>
              <router-link
                to="/register"
                class="px-4 py-1.5 flex flex-col items-center gap-1 text-[#111111] hover:opacity-70 transition-opacity"
              >
                <UserPlus class="w-3.5 h-3.5" :stroke-width="2" />
                <span class="text-[10px] font-bold uppercase tracking-wider">Daftar</span>
              </router-link>
            </div>
          </div>

          <!-- Right Taped Frosted Polaroid Card -->
          <div class="order-3 flex justify-center">
            <div class="relative w-48 sm:w-52 bg-white/70 backdrop-blur-md p-2.5 pb-4 border border-white/80 shadow-[0_12px_28px_rgba(0,0,0,0.09),inset_0_1px_0_rgba(255,255,255,0.95)] rotate-3 hover:rotate-0 transition-transform duration-300">
              <span aria-hidden="true" class="absolute -top-2.5 -left-3 w-11 h-4 bg-[#cfd6e5]/85 backdrop-blur-xs -rotate-45 pointer-events-none"></span>
              <span aria-hidden="true" class="absolute -top-2.5 -right-3 w-11 h-4 bg-[#ff82c2]/60 backdrop-blur-xs rotate-45 pointer-events-none"></span>

              <div class="bg-[#18181b]/95 text-white p-3.5 aspect-[4/4.2] flex flex-col justify-between">
                <div class="flex items-center justify-between text-[10px] font-sans font-medium">
                  <span class="text-[#a1a1aa]">Arsip S3</span>
                  <span class="px-1.5 py-0.5 bg-[#5ad363] text-black font-bold">SAFE</span>
                </div>

                <!-- Non-Destructive File Fork Graphic -->
                <svg viewBox="0 0 140 54" class="w-full h-12 my-1" fill="none" aria-hidden="true">
                  <rect x="8" y="8" width="52" height="16" rx="2" stroke="#a1a1aa" stroke-width="1.2" />
                  <text x="34" y="19" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" fill="#a1a1aa">RAW_STEM</text>
                  <path d="M60 16 L80 16 L80 38 L88 38" stroke="#5ad363" stroke-width="1.5" />
                  <rect x="88" y="30" width="46" height="16" rx="2" fill="#5ad363" />
                  <text x="111" y="41" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="#111111">FIXED_</text>
                </svg>

                <div>
                  <span class="block text-xs font-semibold text-white">FIXED_stem.wav</span>
                  <span class="block text-[10px] text-[#5ad363] mt-0.5">Original Tetap Utuh</span>
                </div>
              </div>

              <p class="font-sans text-[11px] font-medium text-[#60605e] text-center mt-2.5">
                non-destructive
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- RETRO GIANT-WORDMARK FULL-BLEED FOOTER -->
    <footer class="mt-auto w-full bg-[#18161a] text-[#f5f3eb] overflow-hidden">
      <!-- Top Navigation & Quick-Start Area -->
      <div class="max-w-[1440px] mx-auto px-6 sm:px-10 md:px-14 pt-12 md:pt-14 pb-8 space-y-10">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr] gap-8 lg:gap-12 text-xs">

          <!-- Column 1: Ruang Kerja -->
          <div class="space-y-3">
            <span class="font-bold uppercase tracking-[0.12em] text-[10px] text-[#a1a1aa] block">
              Ruang Kerja
            </span>
            <ul class="space-y-2 text-[13px] font-medium text-[#f5f3eb]">
              <li>
                <button type="button" @click="scrollToTop" class="hover:text-[#ffda40] transition-colors cursor-pointer">
                  Beranda
                </button>
              </li>
              <li>
                <router-link to="/dashboard" class="hover:text-[#ffda40] transition-colors">
                  Studio Workspace
                </router-link>
              </li>
              <li>
                <router-link to="/billing" class="hover:text-[#ffda40] transition-colors">
                  Dompet &amp; Kuota
                </router-link>
              </li>
              <li>
                <router-link to="/login" class="hover:text-[#ffda40] transition-colors">
                  Masuk Akun
                </router-link>
              </li>
            </ul>
          </div>

          <!-- Column 2: Bantuan -->
          <div class="space-y-3">
            <span class="font-bold uppercase tracking-[0.12em] text-[10px] text-[#a1a1aa] block">
              Bantuan
            </span>
            <ul class="space-y-2 text-[13px] font-medium text-[#f5f3eb]">
              <li>
                <button type="button" @click="scrollToSection('faq-studio')" class="hover:text-[#ff82c2] transition-colors cursor-pointer">
                  Pertanyaan Umum
                </button>
              </li>
              <li>
                <router-link to="/register" class="hover:text-[#ff82c2] transition-colors">
                  Daftar Akun Gratis
                </router-link>
              </li>
              <li>
                <button type="button" @click="launchStudioInstantly" class="hover:text-[#ff82c2] transition-colors cursor-pointer">
                  Coba Tanpa Login
                </button>
              </li>
              <li>
                <router-link to="/billing" class="hover:text-[#ff82c2] transition-colors">
                  Klaim Kuota Harian
                </router-link>
              </li>
            </ul>
          </div>

          <!-- Column 3: Quick Studio Launch Bar -->
          <div class="space-y-3.5">
            <span class="font-bold uppercase tracking-[0.12em] text-[10px] text-[#a1a1aa] block">
              Mulai Sesi Anda
            </span>
            <p class="text-[13px] text-[#d4d4d8] leading-relaxed max-w-md">
              Siapkan multitrack bersih sebelum masuk tahap mixing tanpa instalasi tambahan.
            </p>
            <div class="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                @click="launchStudioInstantly"
                :disabled="isLaunching"
                class="btn-keycap btn-keycap-sm btn-keycap-yellow px-4 py-2 text-xs disabled:opacity-50"
              >
                {{ isLaunching ? 'Menyiapkan...' : 'Buka Studio Instan' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Subtle Metadata Bar Above Giant Wordmark -->
        <div class="pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-3 text-[11px] font-medium text-[#a1a1aa]">
          <span>&copy; {{ new Date().getFullYear() }} Polaris Audio &middot; Siap untuk sesi mixing Anda.</span>
          <button
            type="button"
            @click="scrollToTop"
            class="inline-flex items-center gap-1.5 text-[#f5f3eb] hover:text-[#ffda40] transition-colors cursor-pointer"
          >
            <span>Kembali ke Atas</span>
            <ArrowUp class="w-3.5 h-3.5" :stroke-width="2" />
          </button>
        </div>
      </div>

      <!-- Massive Edge-to-Edge Retro Wordmark + Tilted Circular Sticker -->
      <div class="relative pt-2 px-2 sm:px-4 overflow-hidden select-none">
        <!-- Retro Yellow Circular Stamp Sticker Overlapping Wordmark -->
        <div
          aria-hidden="true"
          class="hidden sm:flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-full bg-[#ffda40] text-[#111111] border-2 border-[#18161a] shadow-lg -rotate-12 absolute left-[58%] -top-1 z-20 pointer-events-none"
        >
          <svg viewBox="0 0 80 80" class="w-full h-full p-1" fill="none">
            <circle cx="40" cy="40" r="34" stroke="#111111" stroke-width="1.2" stroke-dasharray="3 2" />
            <text x="40" y="34" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="800" fill="#111111">STUDIO</text>
            <path d="M24 44 H28 V40 H32 V48 H36 V36 H40 V50 H44 V38 H48 V46 H52 V42 H56" stroke="#111111" stroke-width="2" stroke-linecap="round" />
            <text x="40" y="61" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="800" fill="#111111">48 KHZ</text>
          </svg>
        </div>

        <!-- Edge-to-Edge Giant Wordmark -->
        <div
          aria-hidden="true"
          class="font-editorial font-extrabold uppercase tracking-[-0.06em] leading-[0.80] text-[#f5f3eb] text-center whitespace-nowrap -mb-2 sm:-mb-3 md:-mb-5"
          style="font-size: clamp(3.8rem, 19.5vw, 17rem);"
        >
          POLARIS
        </div>
      </div>
    </footer>

  </div>
</template>

<style scoped>
.faq-fade-enter-active,
.faq-fade-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}
.faq-fade-enter-from {
  opacity: 0;
  transform: translateX(6px);
}
.faq-fade-leave-to {
  opacity: 0;
  transform: translateX(-6px);
}
</style>
