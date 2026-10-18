<script setup>
import { ref, computed } from 'vue'
import LedPeakMeter from './audio/LedPeakMeter.vue'
import TrackTallyButtons from './audio/TrackTallyButtons.vue'

const props = defineProps({
  track: {
    type: Object,
    required: true
  },
  diagnostic: {
    type: Object,
    default: null
  },
  pairedTrack: {
    type: Object,
    default: null
  },
  pairInfo: {
    type: Object,
    default: null
  }
})

const showDetails = ref(false)

const diag = computed(() => {
  return props.diagnostic || props.track?.diagnosticResult || null
})

// Phase correlation mapped to percentage 0% to 100% (-1.0 -> 0%, 0.0 -> 50%, +1.0 -> 100%)
const correlationPercent = computed(() => {
  const val = diag.value?.phaseCorrelation ?? 1.0
  return Math.max(0, Math.min(100, ((val + 1.0) / 2.0) * 100))
})

const correlationColorClass = computed(() => {
  const val = diag.value?.phaseCorrelation ?? 1.0
  if (val < 0.0) return 'text-rose-500 bg-rose-50 border-rose-200'
  if (val < 0.4) return 'text-amber-600 bg-amber-50 border-amber-200'
  return 'text-emerald-600 bg-emerald-50 border-emerald-200'
})

const statusBadge = computed(() => {
  if (props.track?.status === 'REPAIRED' || props.track?.repairedStorageKey) {
    return { label: 'Telah Diperbaiki', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold', dot: 'bg-emerald-500' }
  }
  if (!diag.value) {
    return { label: 'Belum Dipindai', bg: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400' }
  }
  const s = diag.value?.healthStatus || 'Clean'
  if (s === 'Critical') {
    return { label: 'Kritis', bg: 'bg-rose-100 text-rose-700 border-rose-300', dot: 'bg-rose-500' }
  } else if (s === 'Warning') {
    return { label: 'Perhatian', bg: 'bg-amber-100 text-amber-700 border-amber-300', dot: 'bg-amber-500' }
  } else {
    return { label: 'Bersih', bg: 'bg-emerald-100 text-emerald-700 border-emerald-300', dot: 'bg-emerald-500' }
  }
})

const hasAnyAnomalies = computed(() => {
  if (!diag.value) return false
  return Boolean(
    diag.value.hasPolarityInvert ||
    diag.value.hasFakeStereo ||
    diag.value.hasCombFiltering ||
    diag.value.hasClipping ||
    diag.value.hasSubRumble ||
    diag.value.hasDcOffset
  )
})
</script>

<template>
  <div class="bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-5 shadow-sm transition-all space-y-4">
    
    <!-- Header: Track info, label, & status badge -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
          <svg v-if="track.isStereo" class="w-5 h-5 text-[#0052FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <svg v-else class="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
          </svg>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h4 class="font-display text-sm sm:text-base text-slate-900 truncate max-w-xs sm:max-w-md">
              {{ track.fileName }}
            </h4>
            <span class="font-mono-accent text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              {{ track.instrumentLabel || track.detectedLabel || 'Audio' }}
            </span>
            <span v-if="track.isStereo" class="font-mono-accent text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
              STEREO
            </span>
            <span v-else class="font-mono-accent text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
              MONO
            </span>
          </div>

          <p v-if="pairedTrack" class="text-xs text-slate-500 mt-0.5 font-mono-accent">
            Pasangan: <span class="font-semibold text-slate-700">{{ pairedTrack.fileName }}</span>
            <span v-if="pairInfo" class="text-[10px] text-slate-400"> ({{ pairInfo.pairType }})</span>
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2.5 self-start sm:self-auto">
        <!-- Studio Mute [M] & Solo [S] Tally Lamp Controls -->
        <TrackTallyButtons :track-id="track.id" />

        <span 
          :class="[statusBadge.bg]"
          class="font-mono-accent text-xs font-semibold px-2.5 py-1 rounded-md border flex items-center gap-1.5">
          <span :class="[statusBadge.dot]" class="w-2 h-2 rounded-full inline-block" />
          <span>{{ statusBadge.label }}</span>
        </span>

        <button 
          @click="showDetails = !showDetails"
          class="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium cursor-pointer transition-all">
          {{ showDetails ? 'Sembunyikan' : 'Rincian' }}
        </button>
      </div>
    </div>

    <!-- Phase Correlation Meter (Calibrated Biphasic Studio Gauge) -->
    <div v-if="diag" class="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
      <div class="flex items-center justify-between text-xs">
        <span class="font-semibold text-slate-700 flex items-center gap-2">
          <span>Korelasi Fasa:</span>
          <span 
            :class="[correlationColorClass]"
            class="font-mono-accent text-[11px] font-bold px-2 py-0.5 rounded border">
            {{ diag.phaseCorrelation >= 0 ? '+' : '' }}{{ (diag.phaseCorrelation ?? 1.0).toFixed(2) }}
          </span>
        </span>
        <span class="font-mono-accent text-[10px] text-slate-400">
          Status: <span class="font-semibold text-slate-600">{{ diag.phaseCorrelation < 0 ? 'Fasa Batal (Out of Phase)' : diag.phaseCorrelation < 0.4 ? 'Stereo Lebar' : 'Fasa Terpadu (In Phase)' }}</span>
        </span>
      </div>

      <!-- Calibrated Track -->
      <div class="relative w-full pt-1 pb-4">
        <div class="relative w-full h-2.5 bg-slate-200 rounded-xs overflow-hidden">
          <!-- Negative region tint (left half) -->
          <div class="absolute left-0 top-0 bottom-0 w-1/2 bg-rose-100/70" />
          <!-- Positive region tint (right half) -->
          <div class="absolute right-0 top-0 bottom-0 w-1/2 bg-emerald-100/50" />
          <!-- Center reference mark -->
          <div class="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-400 z-10" />
        </div>

        <!-- Needle pointer -->
        <div 
          class="absolute top-0 bottom-3 w-1.5 bg-slate-900 rounded-xs shadow-xs transform -translate-x-1/2 z-20 transition-all duration-300 ease-out"
          :style="{ left: `${correlationPercent}%` }"
        />

        <!-- Scale Calibration Markings -->
        <div class="relative w-full mt-1.5 flex justify-between text-[9px] font-mono-accent text-slate-400 select-none">
          <span class="text-rose-600 font-semibold">-1.0 (Batal)</span>
          <span>-0.5</span>
          <span class="font-bold text-slate-600">0.0 (Stereo)</span>
          <span>+0.5</span>
          <span class="text-emerald-700 font-semibold">+1.0 (Mono)</span>
        </div>
      </div>
    </div>

    <!-- Unified Telemetry Strip -->
    <div v-if="diag" class="bg-slate-50/70 border border-slate-200/80 rounded-xl grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 text-xs overflow-hidden">
      <!-- True-Peak with Hardware LED Peak Meter -->
      <div class="p-3 flex flex-col justify-between space-y-2" :class="diag.hasClipping ? 'bg-rose-50/50' : ''">
        <div>
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-mono-accent text-slate-400 uppercase">True-Peak</span>
            <span v-if="diag.hasClipping" class="text-[9px] font-bold px-1.5 py-0.5 bg-rose-200 text-rose-900 rounded font-mono-accent">
              CLIPPED
            </span>
          </div>
          <div class="font-mono-accent font-bold text-xs mt-1" :class="diag.hasClipping ? 'text-rose-700' : 'text-slate-800'">
            {{ diag.truePeakDbfs !== null ? `${diag.truePeakDbfs.toFixed(1)} dBFS` : '-' }}
          </div>
        </div>

        <!-- Integrated Hardware LED Peak Meter -->
        <LedPeakMeter 
          :value="diag.truePeakDbfs" 
          :is-clipped="diag.hasClipping" 
          class="mt-1"
        />
      </div>

      <!-- Crest Factor -->
      <div class="p-3 flex flex-col justify-between">
        <span class="text-[10px] font-mono-accent text-slate-400 uppercase">Crest Factor</span>
        <div class="flex items-center justify-between mt-1">
          <span class="font-mono-accent font-bold text-xs text-slate-800">
            {{ diag.crestFactor !== null ? `${diag.crestFactor.toFixed(1)} dB` : '-' }}
          </span>
          <span class="text-[10px] text-slate-400 font-mono-accent">Dinamika</span>
        </div>
      </div>

      <!-- DC Offset -->
      <div class="p-3 flex flex-col justify-between" :class="diag.hasDcOffset ? 'bg-amber-50/50' : ''">
        <span class="text-[10px] font-mono-accent text-slate-400 uppercase">DC Offset</span>
        <div class="flex items-center justify-between mt-1">
          <span class="font-mono-accent font-bold text-xs" :class="diag.hasDcOffset ? 'text-amber-700' : 'text-slate-800'">
            {{ diag.hasDcOffset ? 'Terdeteksi' : '0.00% Bersih' }}
          </span>
          <span v-if="diag.hasDcOffset" class="text-[9px] font-bold px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded font-mono-accent">
            OFFSET
          </span>
        </div>
      </div>

      <!-- Sub Rumble -->
      <div class="p-3 flex flex-col justify-between" :class="diag.hasSubRumble ? 'bg-amber-50/50' : ''">
        <span class="text-[10px] font-mono-accent text-slate-400 uppercase">Sub-Rumble</span>
        <div class="flex items-center justify-between mt-1">
          <span class="font-mono-accent font-bold text-xs" :class="diag.hasSubRumble ? 'text-amber-700' : 'text-slate-800'">
            {{ diag.hasSubRumble ? '< 35 Hz Rumble' : 'Aman' }}
          </span>
          <span v-if="diag.hasSubRumble" class="text-[9px] font-bold px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded font-mono-accent">
            FILTER
          </span>
        </div>
      </div>
    </div>

    <!-- Active Problem Flags Chips (Only rendered when anomalies exist) -->
    <div v-if="diag && hasAnyAnomalies" class="flex flex-wrap gap-1.5 pt-1">
      <span 
        v-if="diag.hasPolarityInvert"
        class="font-mono-accent text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-1 rounded-md flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        <span>Polaritas Terbalik 180°</span>
      </span>

      <span 
        v-if="diag.hasFakeStereo"
        class="font-mono-accent text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-1 rounded-md flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Fake Stereo (Haas Effect)</span>
      </span>

      <span 
        v-if="diag.hasCombFiltering"
        class="font-mono-accent text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-md flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>Comb Filtering Mikro</span>
      </span>

      <span 
        v-if="diag.hasClipping"
        class="font-mono-accent text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-1 rounded-md flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span>Inter-Sample Peak Clipping</span>
      </span>

      <span 
        v-if="diag.hasSubRumble"
        class="font-mono-accent text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
        </svg>
        <span>Sub-Rumble (&lt; 35 Hz)</span>
      </span>

      <span 
        v-if="diag.hasDcOffset"
        class="font-mono-accent text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
        </svg>
        <span>Penyimpangan DC Offset</span>
      </span>
    </div>

    <!-- Recommendations Accordion -->
    <div 
      v-if="showDetails"
      class="border-t border-slate-100 pt-3 space-y-2 animate-fade-in">
      <span class="font-display text-xs text-slate-800 block">
        Rekomendasi Solusi Teknis:
      </span>
      
      <div v-if="diag && diag.recommendations && diag.recommendations.length" class="space-y-2">
        <div 
          v-for="(rec, idx) in diag.recommendations" 
          :key="idx"
          :class="rec.severity === 'CRITICAL' ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-slate-50 border-slate-200 text-slate-800'"
          class="border rounded-xl p-3 text-xs flex items-start gap-2.5">
          <svg v-if="rec.severity === 'CRITICAL'" class="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg v-else class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p class="leading-relaxed font-normal">
            {{ rec.message }}
          </p>
        </div>
      </div>
      <div v-else-if="diag" class="py-1 text-xs text-slate-500 font-normal">
        Kondisi stem optimal — seluruh parameter DSP memenuhi standar toleransi mixing.
      </div>
      <div v-else class="py-1 text-xs text-slate-400 italic">
        Data diagnostik DSP untuk trek ini belum tersedia. Jalankan pemindaian via tombol 'Audit Fasa & DSP'.
      </div>
    </div>

  </div>
</template>
