<script setup>
import { ref, computed } from 'vue'

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
  const s = diag.value?.healthStatus || 'Clean'
  if (s === 'Critical') {
    return { label: 'Kritis', bg: 'bg-rose-100 text-rose-700 border-rose-300', dot: 'bg-rose-500' }
  } else if (s === 'Warning') {
    return { label: 'Perhatian', bg: 'bg-amber-100 text-amber-700 border-amber-300', dot: 'bg-amber-500' }
  } else {
    return { label: 'Bersih', bg: 'bg-emerald-100 text-emerald-700 border-emerald-300', dot: 'bg-emerald-500' }
  }
})
</script>

<template>
  <div class="bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-5 shadow-sm transition-all space-y-4">
    
    <!-- Header: Track info, label, & status badge -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg shrink-0">
          {{ track.isStereo ? '🎧' : '🎙️' }}
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h4 class="font-display text-sm sm:text-base text-slate-900 truncate max-w-xs sm:max-w-md">
              {{ track.fileName }}
            </h4>
            <span class="font-mono-accent text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
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
            🔗 Pasangan: <span class="font-semibold text-slate-700">{{ pairedTrack.fileName }}</span>
            <span v-if="pairInfo" class="text-[10px] text-slate-400"> ({{ pairInfo.pairType }})</span>
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 self-start sm:self-auto">
        <span 
          :class="[statusBadge.bg]"
          class="font-mono-accent text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5">
          <span :class="[statusBadge.dot]" class="w-2 h-2 rounded-full inline-block animate-pulse" />
          <span>{{ statusBadge.label }}</span>
        </span>

        <button 
          @click="showDetails = !showDetails"
          class="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium cursor-pointer transition-all">
          {{ showDetails ? 'Sembunyikan ▲' : 'Rincian ▼' }}
        </button>
      </div>
    </div>

    <!-- Phase Correlation Meter -->
    <div v-if="diag" class="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
      <div class="flex items-center justify-between text-xs">
        <span class="font-semibold text-slate-700 flex items-center gap-1.5">
          <span>Korelasi Fasa:</span>
          <span 
            :class="[correlationColorClass]"
            class="font-mono-accent text-[11px] font-bold px-2 py-0.5 rounded border">
            {{ diag.phaseCorrelation >= 0 ? '+' : '' }}{{ (diag.phaseCorrelation ?? 1.0).toFixed(2) }}
          </span>
        </span>
        <span class="font-mono-accent text-[10px] text-slate-400">
          -1.0 (Batal Total) &larr; 0 (Wide) &rarr; +1.0 (Mono Murni)
        </span>
      </div>

      <!-- Linear gauge bar -->
      <div class="relative w-full h-3 bg-slate-200 rounded-full overflow-hidden flex items-center">
        <!-- Colored gradient background -->
        <div class="absolute inset-0 bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500 opacity-80" />
        <!-- Center reference mark -->
        <div class="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/70 z-10" />
        <!-- Pointer indicator -->
        <div 
          class="absolute w-3.5 h-3.5 bg-slate-900 border-2 border-white rounded-full shadow-md transform -translate-x-1/2 z-20 transition-all duration-500 ease-out"
          :style="{ left: `${correlationPercent}%` }"
        />
      </div>
    </div>

    <!-- Quick Metric Badges Grid -->
    <div v-if="diag" class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
      <!-- True-Peak -->
      <div 
        :class="diag.hasClipping ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-slate-50 border-slate-200 text-slate-700'"
        class="border rounded-xl p-2.5 flex flex-col justify-between">
        <span class="text-[10px] font-mono-accent text-slate-400 uppercase">True-Peak</span>
        <div class="flex items-center justify-between mt-1">
          <span class="font-mono-accent font-bold text-xs">
            {{ diag.truePeakDbfs !== null ? `${diag.truePeakDbfs.toFixed(1)} dBFS` : '-' }}
          </span>
          <span v-if="diag.hasClipping" class="text-[10px] font-bold px-1.5 py-0.5 bg-rose-200 text-rose-900 rounded">
            CLIPPED
          </span>
        </div>
      </div>

      <!-- Crest Factor -->
      <div class="bg-slate-50 border border-slate-200 text-slate-700 border rounded-xl p-2.5 flex flex-col justify-between">
        <span class="text-[10px] font-mono-accent text-slate-400 uppercase">Crest Factor</span>
        <div class="flex items-center justify-between mt-1">
          <span class="font-mono-accent font-bold text-xs">
            {{ diag.crestFactor !== null ? `${diag.crestFactor.toFixed(1)} dB` : '-' }}
          </span>
          <span class="text-[10px] text-slate-400 font-mono-accent">Dinamika</span>
        </div>
      </div>

      <!-- DC Offset -->
      <div 
        :class="diag.hasDcOffset ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-700'"
        class="border rounded-xl p-2.5 flex flex-col justify-between">
        <span class="text-[10px] font-mono-accent text-slate-400 uppercase">DC Offset</span>
        <div class="flex items-center justify-between mt-1">
          <span class="font-mono-accent font-bold text-xs">
            {{ diag.hasDcOffset ? 'Terdeteksi' : '0.0% Bersih' }}
          </span>
          <span v-if="diag.hasDcOffset" class="text-[10px] font-bold px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded">
            OFFSET
          </span>
        </div>
      </div>

      <!-- Sub Rumble -->
      <div 
        :class="diag.hasSubRumble ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-700'"
        class="border rounded-xl p-2.5 flex flex-col justify-between">
        <span class="text-[10px] font-mono-accent text-slate-400 uppercase">Sub-Rumble</span>
        <div class="flex items-center justify-between mt-1">
          <span class="font-mono-accent font-bold text-xs">
            {{ diag.hasSubRumble ? '< 35 Hz Rumble' : 'Aman' }}
          </span>
          <span v-if="diag.hasSubRumble" class="text-[10px] font-bold px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded">
            FILTER
          </span>
        </div>
      </div>
    </div>

    <!-- Active Problem Flags Chips -->
    <div v-if="diag" class="flex flex-wrap gap-1.5 pt-1">
      <span 
        v-if="diag.hasPolarityInvert"
        class="font-mono-accent text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-1 rounded-lg flex items-center gap-1">
        <span>🚫</span>
        <span>Polaritas Terbalik 180°</span>
      </span>

      <span 
        v-if="diag.hasFakeStereo"
        class="font-mono-accent text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-1 rounded-lg flex items-center gap-1">
        <span>📻</span>
        <span>Fake Stereo (Haas Effect)</span>
      </span>

      <span 
        v-if="diag.hasCombFiltering"
        class="font-mono-accent text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-lg flex items-center gap-1">
        <span>⚠️</span>
        <span>Comb Filtering Mikro</span>
      </span>

      <span 
        v-if="diag.hasClipping"
        class="font-mono-accent text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-1 rounded-lg flex items-center gap-1">
        <span>⚡</span>
        <span>Inter-Sample Peak Clipping</span>
      </span>

      <span 
        v-if="diag.hasSubRumble"
        class="font-mono-accent text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
        <span>🌊</span>
        <span>Sub-Rumble (< 35 Hz)</span>
      </span>

      <span 
        v-if="diag.hasDcOffset"
        class="font-mono-accent text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
        <span>⚖️</span>
        <span>Penyimpangan DC Offset</span>
      </span>

      <span 
        v-if="!diag.hasPolarityInvert && !diag.hasFakeStereo && !diag.hasCombFiltering && !diag.hasClipping && !diag.hasSubRumble && !diag.hasDcOffset"
        class="font-mono-accent text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
        <span>✓</span>
        <span>Tidak Ditemukan Anomali DSP</span>
      </span>
    </div>

    <!-- Recommendations Accordion (FR-4.3) -->
    <div 
      v-if="showDetails && diag && diag.recommendations && diag.recommendations.length"
      class="border-t border-slate-100 pt-3 space-y-2 animate-fade-in">
      <span class="font-display text-xs text-slate-800 block">
        💡 Rekomendasi Solusi Teknis:
      </span>
      
      <div class="space-y-2">
        <div 
          v-for="(rec, idx) in diag.recommendations" 
          :key="idx"
          :class="rec.severity === 'CRITICAL' ? 'bg-rose-50/80 border-rose-200 text-rose-900' : 'bg-slate-50 border-slate-200 text-slate-800'"
          class="border rounded-xl p-3 text-xs flex items-start gap-2.5">
          <span class="text-sm shrink-0 mt-0.5">
            {{ rec.severity === 'CRITICAL' ? '🚨' : (rec.severity === 'WARNING' ? '⚠️' : 'ℹ️') }}
          </span>
          <p class="leading-relaxed font-normal">
            {{ rec.message }}
          </p>
        </div>
      </div>
    </div>

  </div>
</template>
