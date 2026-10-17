<script setup>
import { computed } from 'vue'

const props = defineProps({
  score: {
    type: Number,
    default: 100
  },
  rating: {
    type: String,
    default: 'EXCELLENT'
  },
  ratingLabel: {
    type: String,
    default: 'Optimal & Siap Mix'
  },
  totalTracks: {
    type: Number,
    default: 0
  },
  cleanTracks: {
    type: Number,
    default: 0
  },
  warningTracks: {
    type: Number,
    default: 0
  },
  criticalTracks: {
    type: Number,
    default: 0
  },
  estimatedTokens: {
    type: Number,
    default: 1
  }
})

// Circular gauge calculations (radius = 54, circumference = 2 * PI * 54 = ~339.29)
const radius = 54
const circumference = 2 * Math.PI * radius
const strokeDashoffset = computed(() => {
  const clampedScore = Math.max(0, Math.min(100, props.score))
  return circumference - (clampedScore / 100) * circumference
})

const colorConfig = computed(() => {
  if (props.score >= 90) {
    return {
      stroke: '#10B981', // emerald-500
      glow: 'rgba(16, 185, 129, 0.25)',
      badgeBg: 'bg-emerald-50',
      badgeBorder: 'border-emerald-200',
      badgeText: 'text-emerald-700',
      icon: '✨'
    }
  } else if (props.score >= 65) {
    return {
      stroke: '#F59E0B', // amber-500
      glow: 'rgba(245, 158, 11, 0.25)',
      badgeBg: 'bg-amber-50',
      badgeBorder: 'border-amber-200',
      badgeText: 'text-amber-700',
      icon: '⚠️'
    }
  } else {
    return {
      stroke: '#EF4444', // red-500
      glow: 'rgba(239, 68, 68, 0.25)',
      badgeBg: 'bg-rose-50',
      badgeBorder: 'border-rose-200',
      badgeText: 'text-rose-700',
      icon: '🚨'
    }
  }
})
</script>

<template>
  <div class="bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-lg relative overflow-hidden">
    <!-- Subtle glow background -->
    <div 
      class="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none transition-all duration-700"
      :style="{ backgroundColor: colorConfig.glow }"
    />

    <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
      
      <!-- Left: Radial SVG Gauge -->
      <div class="flex items-center gap-6">
        <div class="relative w-32 h-32 flex items-center justify-center shrink-0">
          <svg class="w-full h-full -rotate-90 transform" viewBox="0 0 128 128">
            <!-- Background track -->
            <circle
              cx="64"
              cy="64"
              :r="radius"
              stroke="#1E293B"
              stroke-width="10"
              fill="transparent"
            />
            <!-- Animated progress ring -->
            <circle
              cx="64"
              cy="64"
              :r="radius"
              :stroke="colorConfig.stroke"
              stroke-width="10"
              fill="transparent"
              stroke-linecap="round"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="strokeDashoffset"
              class="transition-all duration-1000 ease-out"
            />
          </svg>

          <!-- Inside score readout -->
          <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span class="font-display text-3xl font-bold leading-none tracking-tight">
              {{ Math.round(score) }}
            </span>
            <span class="font-mono-accent text-[9px] uppercase tracking-widest text-slate-400 mt-1">
              / 100
            </span>
          </div>
        </div>

        <!-- Title & status text -->
        <div class="space-y-1.5 text-center md:text-left">
          <div class="flex items-center justify-center md:justify-start gap-2">
            <span 
              :class="[colorConfig.badgeBg, colorConfig.badgeBorder, colorConfig.badgeText]"
              class="font-mono-accent text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1">
              <span>{{ colorConfig.icon }}</span>
              <span>{{ rating }}</span>
            </span>
            <span class="font-mono-accent text-[11px] text-slate-400">
              Mix Health Score
            </span>
          </div>
          
          <h3 class="font-display text-xl sm:text-2xl text-white">
            {{ ratingLabel }}
          </h3>
          
          <p class="text-xs text-slate-400 max-w-sm leading-relaxed">
            Audit komprehensif fase, clipping inter-sample, DC offset, dan integritas multi-mikrofon berdasarkan standar ITU-R BS.1770-4.
          </p>
        </div>
      </div>

      <!-- Right: Stems Breakdown Stats & Token Estimation -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
        <div class="grid grid-cols-3 gap-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 text-center min-w-[220px]">
          <div>
            <span class="font-mono-accent text-xs font-bold text-emerald-400 block">
              {{ cleanTracks }}
            </span>
            <span class="font-mono-accent text-[10px] text-slate-400 uppercase">Bersih</span>
          </div>
          <div class="border-x border-slate-700/60">
            <span class="font-mono-accent text-xs font-bold text-amber-400 block">
              {{ warningTracks }}
            </span>
            <span class="font-mono-accent text-[10px] text-slate-400 uppercase">Warning</span>
          </div>
          <div>
            <span class="font-mono-accent text-xs font-bold text-rose-400 block">
              {{ criticalTracks }}
            </span>
            <span class="font-mono-accent text-[10px] text-slate-400 uppercase">Kritis</span>
          </div>
        </div>

        <div class="bg-gradient-to-r from-[#0052FF]/20 to-[#4D7CFF]/20 border border-[#0052FF]/40 rounded-xl p-3.5 text-center sm:text-left flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-[#0052FF] text-white flex items-center justify-center font-display text-sm shrink-0">
            ⚡
          </div>
          <div class="text-xs">
            <div class="font-semibold text-slate-200">Estimasi Perbaikan:</div>
            <div class="font-mono-accent font-bold text-cyan-400">{{ estimatedTokens }} Token Polaris</div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
