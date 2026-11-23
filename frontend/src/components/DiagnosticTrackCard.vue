<script setup>
import { ref, computed } from 'vue'
import {
  AudioLines,
  Mic,
  Link2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  AlertTriangle,
  Zap,
  Ban,
  TrendingDown,
  Scale,
  CheckCircle2,
  Wrench
} from 'lucide-vue-next'
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

const phaseTone = computed(() => {
  const val = diag.value?.phaseCorrelation ?? 1.0
  if (val < 0.0) {
    return {
      pill: 'bg-[#ff82c2] border-[#111111] text-[#111111]',
      label: 'Fasa Batal (Out of Phase)'
    }
  }
  if (val < 0.4) {
    return {
      pill: 'bg-[#ffda40] border-[#111111] text-[#111111]',
      label: 'Stereo Lebar'
    }
  }
  return {
    pill: 'bg-[#5ad363] border-[#111111] text-[#111111]',
    label: 'Fasa Terpadu (In Phase)'
  }
})

const statusBadge = computed(() => {
  if (props.track?.status === 'REPAIRED' || props.track?.repairedStorageKey) {
    return {
      label: 'Telah Diperbaiki',
      pillClass: 'bg-[#5ad363] border-[#111111] text-[#111111] shadow-[1.5px_2px_0_#111111]'
    }
  }
  if (!diag.value) {
    return {
      label: 'Belum Dipindai',
      pillClass: 'bg-[#eaeef4] border-[#111111]/25 text-[#60605e]'
    }
  }
  const s = diag.value?.healthStatus || 'Clean'
  if (s === 'Critical') {
    return {
      label: 'Kritis',
      pillClass: 'bg-[#ff82c2] border-[#111111] text-[#111111] shadow-[1.5px_2px_0_#111111]'
    }
  } else if (s === 'Warning') {
    return {
      label: 'Perhatian',
      pillClass: 'bg-[#ffda40] border-[#111111] text-[#111111] shadow-[1.5px_2px_0_#111111]'
    }
  } else {
    return {
      label: 'Bersih',
      pillClass: 'bg-[#5ad363] border-[#111111] text-[#111111] shadow-[1.5px_2px_0_#111111]'
    }
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
  <div :class="showDetails ? 'py-2' : 'py-2.5'">
    <!-- Unified Track Card Container (black outline wraps BOTH stem header + details when expanded) -->
    <div
      class="transition-all"
      :class="showDetails
        ? 'rounded-[16px] border-2 border-[#111111] bg-[#fcfcfb] shadow-[3px_4px_0_#111111] overflow-hidden'
        : 'rounded-[12px] hover:bg-[#fcfcfb]'"
    >
      <!-- Header: Tactile Stem Emblem, Filename, Uniform Retro Pills & Rincian Keycap -->
      <div
        @click="showDetails = !showDetails"
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none transition-colors"
        :class="showDetails
          ? 'p-4 sm:p-5 bg-white border-b border-dashed border-[#111111]/15'
          : 'p-2.5 sm:p-3'"
      >
        <div class="flex items-center gap-3.5 min-w-0">
          <!-- Tactile Stem Icon Tile -->
          <div
            class="w-10 h-10 rounded-[10px] border-[1.5px] border-[#111111] shadow-[1.5px_2px_0_#111111] flex items-center justify-center shrink-0 text-[#111111]"
            :class="track.isStereo ? 'bg-[#87d7ff]' : 'bg-[#fff099]'"
            :title="track.isStereo ? 'Stem Stereo' : 'Stem Mono'"
          >
            <AudioLines v-if="track.isStereo" class="w-4.5 h-4.5" :stroke-width="2.2" />
            <Mic v-else class="w-4.5 h-4.5" :stroke-width="2.2" />
          </div>

          <div class="min-w-0 space-y-1.5">
            <div class="flex flex-wrap items-center gap-2">
              <h4 class="font-sans font-bold text-sm sm:text-base text-[#111111] truncate max-w-xs sm:max-w-md">
                {{ track.fileName }}
              </h4>
              <span class="inline-flex items-center rounded-full bg-[#f5f3eb] border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-2.5 py-1 font-sans text-[11px] font-bold text-[#111111] leading-none">
                {{ track.instrumentLabel || track.detectedLabel || 'Audio' }}
              </span>
              <span
                v-if="track.isStereo"
                class="inline-flex items-center rounded-full bg-[#87d7ff] border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-2.5 py-1 font-sans text-[11px] font-bold text-[#111111] leading-none"
              >
                Stereo
              </span>
              <span
                v-else
                class="inline-flex items-center rounded-full bg-white border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-2.5 py-1 font-sans text-[11px] font-bold text-[#111111] leading-none"
              >
                Mono
              </span>
            </div>

            <p v-if="pairedTrack" class="font-sans text-xs text-[#60605e] flex flex-wrap items-center gap-1">
              <Link2 class="w-3 h-3 shrink-0 text-[#20afff]" :stroke-width="2.1" />
              <span>Pasangan:</span>
              <span class="font-bold text-[#111111]">{{ pairedTrack.fileName }}</span>
              <span v-if="pairInfo" class="text-[11px] text-[#60605e]">({{ pairInfo.pairType }})</span>
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          <span
            :class="[statusBadge.pillClass]"
            class="inline-flex items-center justify-center rounded-full px-3 py-1 border-[1.5px] font-sans text-[11px] font-bold leading-none"
          >
            {{ statusBadge.label }}
          </span>

          <button
            type="button"
            @click.stop="showDetails = !showDetails"
            :class="showDetails ? 'btn-keycap-yellow' : 'btn-keycap-white'"
            class="btn-keycap btn-keycap-mini px-3.5 py-1.5 text-xs"
          >
            <span>{{ showDetails ? 'Tutup' : 'Rincian' }}</span>
            <ChevronUp v-if="showDetails" class="w-3.5 h-3.5" :stroke-width="2.2" />
            <ChevronDown v-else class="w-3.5 h-3.5" :stroke-width="2.2" />
          </button>
        </div>
      </div>

      <!-- Detailed Section (Seamlessly enclosed inside the unified black outline) -->
      <div
        v-if="showDetails"
        class="p-4 sm:p-5 space-y-4 animate-fade-in"
      >
      <!-- Phase Correlation & DSP Telemetry -->
      <div v-if="diag" class="space-y-4">
        <!-- Unified Light-Paper Phase Correlation Plate -->
        <div class="rounded-[14px] border-[1.5px] border-[#111111] bg-white shadow-[2px_3px_0_#111111] p-4 sm:p-5 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div class="flex items-center gap-2.5">
              <span class="font-sans text-[11px] font-bold uppercase tracking-wider text-[#60605e]">
                Korelasi Fasa
              </span>
              <span
                :class="[phaseTone.pill]"
                class="inline-flex items-center rounded-full border-[1.5px] shadow-[1.5px_2px_0_#111111] px-2.5 py-1 font-telemetry text-[11px] font-bold leading-none"
              >
                {{ diag.phaseCorrelation >= 0 ? '+' : '' }}{{ (diag.phaseCorrelation ?? 1.0).toFixed(2) }}
              </span>
            </div>
            <span
              :class="[phaseTone.pill]"
              class="inline-flex items-center rounded-full border-[1.5px] shadow-[1.5px_2px_0_#111111] px-3 py-1 font-sans text-[11px] font-bold leading-none"
            >
              {{ phaseTone.label }}
            </span>
          </div>

          <!-- Calibrated Light Gauge Bar -->
          <div class="relative w-full pt-1.5 pb-1">
            <div class="relative w-full h-3 rounded-full bg-[#eaeef4] border-[1.5px] border-[#111111]/20 overflow-hidden">
              <div class="absolute left-0 top-0 bottom-0 w-1/2 bg-[#ff82c2]/55" />
              <div class="absolute right-0 top-0 bottom-0 w-1/2 bg-[#5ad363]/55" />
              <div class="absolute left-1/2 top-0 bottom-0 w-0.5 bg-[#111111]/55 z-10" />
            </div>

            <!-- Tactile Needle Pointer (clamped cleanly inside track ends) -->
            <div
              class="absolute top-0.5 w-4 h-4 -ml-2 rounded-full bg-white border-2 border-[#111111] shadow-[1px_1.5px_0_#111111] z-20 transition-all duration-300 ease-out"
              :style="{ left: `clamp(8px, ${correlationPercent}%, calc(100% - 8px))` }"
            />

            <!-- Scale Calibration Markings -->
            <div class="relative w-full mt-2 flex justify-between text-[11px] text-[#60605e] select-none">
              <span class="text-rose-800 font-bold">
                <span class="font-telemetry">-1.0</span>
                <span class="font-sans"> (Batal)</span>
              </span>
              <span class="font-telemetry hidden sm:inline">-0.5</span>
              <span class="font-bold text-[#111111]">
                <span class="font-telemetry">0.0</span>
                <span class="font-sans"> (Stereo)</span>
              </span>
              <span class="font-telemetry hidden sm:inline">+0.5</span>
              <span class="text-emerald-800 font-bold">
                <span class="font-telemetry">+1.0</span>
                <span class="font-sans"> (Mono)</span>
              </span>
            </div>
          </div>
        </div>

        <!-- 4-Column Tactile Telemetry Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
          <!-- True-Peak with Hardware LED Peak Meter -->
          <div class="rounded-[14px] border-[1.5px] border-[#111111] bg-white shadow-[2px_3px_0_#111111] p-4 space-y-2">
            <div class="flex items-center justify-between gap-2">
              <span class="font-sans text-[11px] font-bold text-[#60605e] uppercase tracking-wide">True-Peak</span>
              <span
                v-if="diag.hasClipping"
                class="inline-flex items-center rounded-full border-[1.5px] border-[#111111] bg-[#ff82c2] shadow-[1.5px_2px_0_#111111] px-2.5 py-0.5 font-sans text-[10px] font-bold text-[#111111] leading-none"
              >
                Clipped
              </span>
            </div>
            <div
              class="font-telemetry font-bold text-base"
              :class="diag.hasClipping ? 'text-rose-700' : 'text-[#111111]'"
            >
              {{ diag.truePeakDbfs !== null ? `${diag.truePeakDbfs.toFixed(1)} dBFS` : '-' }}
            </div>
            <LedPeakMeter
              :value="diag.truePeakDbfs"
              :is-clipped="diag.hasClipping"
            />
          </div>

          <!-- Crest Factor -->
          <div class="rounded-[14px] border-[1.5px] border-[#111111] bg-white shadow-[2px_3px_0_#111111] p-4 flex flex-col justify-between space-y-2">
            <span class="font-sans text-[11px] font-bold text-[#60605e] uppercase tracking-wide">Crest Factor</span>
            <div class="flex items-baseline gap-2">
              <span class="font-telemetry font-bold text-base text-[#111111]">
                {{ diag.crestFactor !== null ? `${diag.crestFactor.toFixed(1)} dB` : '-' }}
              </span>
              <span class="font-sans text-xs font-medium text-[#60605e]">Dinamika</span>
            </div>
          </div>

          <!-- DC Offset -->
          <div class="rounded-[14px] border-[1.5px] border-[#111111] bg-white shadow-[2px_3px_0_#111111] p-4 flex flex-col justify-between space-y-2">
            <div class="flex items-center justify-between gap-2">
              <span class="font-sans text-[11px] font-bold text-[#60605e] uppercase tracking-wide">DC Offset</span>
              <span
                v-if="diag.hasDcOffset"
                class="inline-flex items-center rounded-full border-[1.5px] border-[#111111] bg-[#ffda40] shadow-[1.5px_2px_0_#111111] px-2.5 py-0.5 font-sans text-[10px] font-bold text-[#111111] leading-none"
              >
                Offset
              </span>
            </div>
            <div class="flex flex-wrap items-baseline gap-1.5">
              <span
                class="font-bold text-base"
                :class="diag.hasDcOffset ? 'text-amber-800 font-sans' : 'text-[#111111]'"
              >
                <template v-if="diag.hasDcOffset">Terdeteksi</template>
                <template v-else>
                  <span class="font-telemetry">0.00%</span>
                  <span class="font-sans text-xs font-semibold text-emerald-800 ml-1.5">Bersih</span>
                </template>
              </span>
            </div>
          </div>

          <!-- Sub Rumble -->
          <div class="rounded-[14px] border-[1.5px] border-[#111111] bg-white shadow-[2px_3px_0_#111111] p-4 flex flex-col justify-between space-y-2">
            <div class="flex items-center justify-between gap-2">
              <span class="font-sans text-[11px] font-bold text-[#60605e] uppercase tracking-wide">Sub-Rumble</span>
              <span
                v-if="diag.hasSubRumble"
                class="inline-flex items-center rounded-full border-[1.5px] border-[#111111] bg-[#ffda40] shadow-[1.5px_2px_0_#111111] px-2.5 py-0.5 font-sans text-[10px] font-bold text-[#111111] leading-none"
              >
                Filter
              </span>
            </div>
            <div class="flex flex-wrap items-baseline gap-1.5">
              <span
                class="font-bold text-base"
                :class="diag.hasSubRumble ? 'text-amber-800' : 'text-[#111111] font-sans'"
              >
                <template v-if="diag.hasSubRumble">
                  <span class="font-telemetry">&lt; 35 Hz</span>
                  <span class="font-sans text-xs ml-1">Rumble</span>
                </template>
                <template v-else>Aman</template>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Active Problem Flags (Uniform Stamp Pills) -->
      <div v-if="diag && hasAnyAnomalies" class="flex flex-wrap items-center gap-2.5 pt-0.5 font-sans text-xs">
        <span
          v-if="diag.hasPolarityInvert"
          class="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#111111] bg-[#ff82c2] shadow-[1.5px_2px_0_#111111] px-3 py-1 font-bold text-[11px] text-[#111111] leading-none"
        >
          <Ban class="w-3.5 h-3.5 text-[#111111] shrink-0" :stroke-width="2.2" />
          <span>Polaritas Terbalik <span class="font-telemetry">180°</span></span>
        </span>

        <span
          v-if="diag.hasFakeStereo"
          class="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#111111] bg-[#ff82c2] shadow-[1.5px_2px_0_#111111] px-3 py-1 font-bold text-[11px] text-[#111111] leading-none"
        >
          <AlertCircle class="w-3.5 h-3.5 text-[#111111] shrink-0" :stroke-width="2.2" />
          <span>Fake Stereo (Haas Effect)</span>
        </span>

        <span
          v-if="diag.hasCombFiltering"
          class="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#111111] bg-[#ffda40] shadow-[1.5px_2px_0_#111111] px-3 py-1 font-bold text-[11px] text-[#111111] leading-none"
        >
          <AlertTriangle class="w-3.5 h-3.5 text-[#111111] shrink-0" :stroke-width="2.2" />
          <span>Comb Filtering Mikro</span>
        </span>

        <span
          v-if="diag.hasClipping"
          class="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#111111] bg-[#ff82c2] shadow-[1.5px_2px_0_#111111] px-3 py-1 font-bold text-[11px] text-[#111111] leading-none"
        >
          <Zap class="w-3.5 h-3.5 text-[#111111] shrink-0" :stroke-width="2.2" />
          <span>Inter-Sample Peak Clipping</span>
        </span>

        <span
          v-if="diag.hasSubRumble"
          class="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#111111] bg-[#ffda40] shadow-[1.5px_2px_0_#111111] px-3 py-1 font-bold text-[11px] text-[#111111] leading-none"
        >
          <TrendingDown class="w-3.5 h-3.5 text-[#111111] shrink-0" :stroke-width="2.2" />
          <span>Sub-Rumble (<span class="font-telemetry">&lt; 35 Hz</span>)</span>
        </span>

        <span
          v-if="diag.hasDcOffset"
          class="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#111111] bg-[#ffda40] shadow-[1.5px_2px_0_#111111] px-3 py-1 font-bold text-[11px] text-[#111111] leading-none"
        >
          <Scale class="w-3.5 h-3.5 text-[#111111] shrink-0" :stroke-width="2.2" />
          <span>Penyimpangan DC Offset</span>
        </span>
      </div>

      <!-- Prominent Recommendations Callout Box -->
      <div
        class="rounded-[14px] border-2 border-[#111111] p-4 sm:p-5 shadow-[2px_3px_0_#111111] space-y-2.5"
        :class="
          diag && diag.recommendations && diag.recommendations.length
            ? (diag.recommendations.some(r => r.severity === 'CRITICAL') ? 'bg-[#ff82c2]/22' : 'bg-[#ffda40]/32')
            : diag
              ? 'bg-[#5ad363]/20'
              : 'bg-white'
        "
      >
        <div class="flex items-center gap-2.5">
          <span class="w-6 h-6 rounded-[7px] bg-[#111111] text-white flex items-center justify-center shrink-0">
            <CheckCircle2 v-if="diag && (!diag.recommendations || !diag.recommendations.length)" class="w-3.5 h-3.5 text-[#5ad363]" :stroke-width="2.3" />
            <Wrench v-else class="w-3.5 h-3.5 text-[#ffda40]" :stroke-width="2.2" />
          </span>
          <h5 class="font-editorial font-bold text-xs sm:text-sm text-[#111111] tracking-tight">
            Rekomendasi Solusi Teknis
          </h5>
        </div>

        <div
          v-if="diag && diag.recommendations && diag.recommendations.length"
          class="divide-y divide-[#111111]/15"
        >
          <div
            v-for="(rec, idx) in diag.recommendations"
            :key="idx"
            class="font-sans text-[13px] sm:text-sm flex items-start gap-2.5 py-2 first:pt-1 last:pb-0 text-[#111111]"
          >
            <AlertCircle
              v-if="rec.severity === 'CRITICAL'"
              class="w-4 h-4 text-[#111111] shrink-0 mt-0.5"
              :stroke-width="2.3"
            />
            <AlertTriangle
              v-else
              class="w-4 h-4 text-[#111111] shrink-0 mt-0.5"
              :stroke-width="2.3"
            />
            <p class="leading-relaxed font-semibold text-[#111111]">
              {{ rec.message }}
            </p>
          </div>
        </div>
        <p
          v-else-if="diag"
          class="font-sans text-[13px] sm:text-sm font-bold text-[#111111] leading-relaxed"
        >
          Kondisi stem optimal — seluruh parameter DSP memenuhi standar toleransi mixing.
        </p>
        <p
          v-else
          class="font-sans text-xs font-medium text-[#60605e] italic"
        >
          Data diagnostik DSP untuk trek ini belum tersedia.
        </p>
      </div>
      </div>
    </div>
  </div>
</template>
