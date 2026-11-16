<script setup>
import { ref, computed } from 'vue'
import LedPeakMeter from './audio/LedPeakMeter.vue'

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
  if (val < 0.0) return 'text-rose-700 font-bold'
  if (val < 0.4) return 'text-amber-700 font-bold'
  return 'text-emerald-700 font-bold'
})

const statusBadge = computed(() => {
  if (props.track?.status === 'REPAIRED' || props.track?.repairedStorageKey) {
    return { label: 'Telah Diperbaiki', color: 'text-emerald-700' }
  }
  if (!diag.value) {
    return { label: 'Belum Dipindai', color: 'text-slate' }
  }
  const s = diag.value?.healthStatus || 'Clean'
  if (s === 'Critical') {
    return { label: 'Kritis', color: 'text-rose-700' }
  } else if (s === 'Warning') {
    return { label: 'Perhatian', color: 'text-amber-700' }
  } else {
    return { label: 'Bersih', color: 'text-emerald-700' }
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
  <div 
    class="py-3.5 px-1 sm:px-2 transition-colors hover:bg-bone/30"
    :class="showDetails ? 'space-y-4' : ''">
    
    <!-- Header: Track info, label, & status badge -->
    <div 
      @click="showDetails = !showDetails"
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-bone/40 -m-1 sm:-m-2 p-1 sm:p-2 transition-colors">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 flex items-center justify-center text-ink-black shrink-0">
          <svg v-if="track.isStereo" class="w-5 h-5 text-ink-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <svg v-else class="w-5 h-5 text-slate" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
          </svg>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h4 class="font-bold text-sm sm:text-base text-ink-black truncate max-w-xs sm:max-w-md">
              {{ track.fileName }}
            </h4>
            <span class="font-mono-accent text-xs text-ink-black uppercase font-semibold">
              {{ track.instrumentLabel || track.detectedLabel || 'Audio' }}
            </span>
            <span v-if="track.isStereo" class="font-mono-accent text-[10px] text-[#0052FF] font-bold">
              STEREO
            </span>
            <span v-else class="font-mono-accent text-[10px] text-stone font-semibold">
              MONO
            </span>
          </div>

          <p v-if="pairedTrack" class="text-xs text-slate mt-0.5 font-mono-accent">
            Pasangan: <span class="font-bold text-ink-black">{{ pairedTrack.fileName }}</span>
            <span v-if="pairInfo" class="text-[10px] text-slate"> ({{ pairInfo.pairType }})</span>
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2.5 self-start sm:self-auto">
        <span 
          :class="[statusBadge.color]"
          class="font-mono-accent text-xs font-bold">
          {{ statusBadge.label }}
        </span>

        <button 
          @click.stop="showDetails = !showDetails"
          class="btn-bone-secondary px-3 py-1 border border-stone text-ink-black text-xs font-semibold uppercase tracking-wider cursor-pointer font-mono-accent">
          {{ showDetails ? 'Tutup' : 'Rincian' }}
        </button>
      </div>
    </div>

    <!-- Detailed Section (Toggled by showDetails) -->
    <div v-if="showDetails" class="space-y-4 pt-1 animate-fade-in">
      <!-- Phase Correlation & DSP Telemetry (Borderless, Open Editorial Layout) -->
      <div v-if="diag" class="space-y-4">
      <!-- Phase Correlation Section -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-mono-accent uppercase tracking-wider text-slate font-semibold">
              Korelasi Fasa:
            </span>
            <span 
              :class="[correlationColorClass]"
              class="font-mono-accent text-xs">
              {{ diag.phaseCorrelation >= 0 ? '+' : '' }}{{ (diag.phaseCorrelation ?? 1.0).toFixed(2) }}
            </span>
          </div>
          <span class="font-mono-accent text-[10px] text-slate">
            Status: <span class="font-bold text-ink-black">{{ diag.phaseCorrelation < 0 ? 'Fasa Batal (Out of Phase)' : diag.phaseCorrelation < 0.4 ? 'Stereo Lebar' : 'Fasa Terpadu (In Phase)' }}</span>
          </span>
        </div>

        <!-- Calibrated Gauge Bar (Clean hairline, borderless) -->
        <div class="relative w-full pt-1 pb-3">
          <div class="relative w-full h-1.5 bg-bone overflow-hidden">
            <!-- Negative region tint (left half) -->
            <div class="absolute left-0 top-0 bottom-0 w-1/2 bg-rose-200/80" />
            <!-- Positive region tint (right half) -->
            <div class="absolute right-0 top-0 bottom-0 w-1/2 bg-emerald-200/80" />
            <!-- Center reference mark -->
            <div class="absolute left-1/2 top-0 bottom-0 w-0.5 bg-ink-black z-10" />
          </div>

          <!-- Needle pointer -->
          <div 
            class="absolute top-0 bottom-2.5 w-1.5 bg-ink-black z-20 transition-all duration-300 ease-out"
            :style="{ left: `${correlationPercent}%` }"
          />

          <!-- Scale Calibration Markings -->
          <div class="relative w-full mt-1 flex justify-between text-[9px] font-mono-accent text-slate select-none">
            <span class="text-rose-700 font-bold">-1.0 (Batal)</span>
            <span>-0.5</span>
            <span class="font-bold text-ink-black">0.0 (Stereo)</span>
            <span>+0.5</span>
            <span class="text-emerald-800 font-bold">+1.0 (Mono)</span>
          </div>
        </div>
      </div>

      <!-- Unified Telemetry Strip (Open 4-column layout, no nested border boxes, no dividing lines) -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-0.5">
        <!-- True-Peak with Hardware LED Peak Meter -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-mono-accent text-slate uppercase tracking-wider font-semibold">True-Peak</span>
            <span v-if="diag.hasClipping" class="text-[10px] font-bold text-rose-700 font-mono-accent">
              CLIPPED
            </span>
          </div>
          <div class="font-mono-accent font-bold text-xs" :class="diag.hasClipping ? 'text-rose-800' : 'text-ink-black'">
            {{ diag.truePeakDbfs !== null ? `${diag.truePeakDbfs.toFixed(1)} dBFS` : '-' }}
          </div>
          <LedPeakMeter 
            :value="diag.truePeakDbfs" 
            :is-clipped="diag.hasClipping" 
            class="mt-1"
          />
        </div>

        <!-- Crest Factor -->
        <div class="space-y-1.5">
          <span class="text-[10px] font-mono-accent text-slate uppercase tracking-wider font-semibold block">Crest Factor</span>
          <div class="flex items-baseline gap-2">
            <span class="font-mono-accent font-bold text-xs text-ink-black">
              {{ diag.crestFactor !== null ? `${diag.crestFactor.toFixed(1)} dB` : '-' }}
            </span>
            <span class="text-[10px] text-slate font-mono-accent">Dinamika</span>
          </div>
        </div>

        <!-- DC Offset -->
        <div class="space-y-1.5">
          <span class="text-[10px] font-mono-accent text-slate uppercase tracking-wider font-semibold block">DC Offset</span>
          <div class="flex items-baseline gap-2">
            <span class="font-mono-accent font-bold text-xs" :class="diag.hasDcOffset ? 'text-amber-900' : 'text-ink-black'">
              {{ diag.hasDcOffset ? 'Terdeteksi' : '0.00% Bersih' }}
            </span>
            <span v-if="diag.hasDcOffset" class="text-[10px] font-bold text-amber-700 font-mono-accent">
              OFFSET
            </span>
          </div>
        </div>

        <!-- Sub Rumble -->
        <div class="space-y-1.5">
          <span class="text-[10px] font-mono-accent text-slate uppercase tracking-wider font-semibold block">Sub-Rumble</span>
          <div class="flex items-baseline gap-2">
            <span class="font-mono-accent font-bold text-xs" :class="diag.hasSubRumble ? 'text-amber-900' : 'text-ink-black'">
              {{ diag.hasSubRumble ? '< 35 Hz Rumble' : 'Aman' }}
            </span>
            <span v-if="diag.hasSubRumble" class="text-[10px] font-bold text-amber-700 font-mono-accent">
              FILTER
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Active Problem Flags (Borderless Text Readouts) -->
    <div v-if="diag && hasAnyAnomalies" class="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 font-mono-accent text-xs">
      <span 
        v-if="diag.hasPolarityInvert"
        class="font-bold text-rose-700 flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        <span>Polaritas Terbalik 180°</span>
      </span>

      <span 
        v-if="diag.hasFakeStereo"
        class="font-bold text-rose-700 flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Fake Stereo (Haas Effect)</span>
      </span>

      <span 
        v-if="diag.hasCombFiltering"
        class="font-bold text-amber-700 flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>Comb Filtering Mikro</span>
      </span>

      <span 
        v-if="diag.hasClipping"
        class="font-bold text-rose-700 flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span>Inter-Sample Peak Clipping</span>
      </span>

      <span 
        v-if="diag.hasSubRumble"
        class="font-bold text-amber-700 flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
        </svg>
        <span>Sub-Rumble (&lt; 35 Hz)</span>
      </span>

      <span 
        v-if="diag.hasDcOffset"
        class="font-bold text-amber-700 flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
        </svg>
        <span>Penyimpangan DC Offset</span>
      </span>
    </div>

    <!-- Recommendations Section -->
    <div class="pt-2 space-y-2">
      <span class="font-bold text-xs uppercase tracking-wider text-ink-black block font-mono-accent">
        Rekomendasi Solusi Teknis:
      </span>
      
      <div v-if="diag && diag.recommendations && diag.recommendations.length" class="space-y-2">
        <div 
          v-for="(rec, idx) in diag.recommendations" 
          :key="idx"
          class="text-xs flex items-start gap-2.5 font-mono-accent py-1"
          :class="rec.severity === 'CRITICAL' ? 'text-rose-900' : 'text-ink-black'">
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
      <div v-else-if="diag" class="py-1 text-xs text-slate font-normal font-mono-accent">
        Kondisi stem optimal — seluruh parameter DSP memenuhi standar toleransi mixing.
      </div>
      <div v-else class="py-1 text-xs text-slate italic font-mono-accent">
        Data diagnostik DSP untuk trek ini belum tersedia.
      </div>
    </div>
  </div>

  </div>
</template>
