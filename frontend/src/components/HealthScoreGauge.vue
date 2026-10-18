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
      badgeBg: 'bg-emerald-50',
      badgeBorder: 'border-emerald-200',
      badgeText: 'text-emerald-700'
    }
  } else if (props.score >= 65) {
    return {
      stroke: '#F59E0B', // amber-500
      badgeBg: 'bg-amber-50',
      badgeBorder: 'border-amber-200',
      badgeText: 'text-amber-700'
    }
  } else {
    return {
      stroke: '#EF4444', // red-500
      badgeBg: 'bg-rose-50',
      badgeBorder: 'border-rose-200',
      badgeText: 'text-rose-700'
    }
  }
})
</script>

<template>
  <div class="bg-slate-50/70 text-slate-900 border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs relative">
    <div class="flex flex-col md:flex-row items-center justify-between gap-6">
      
      <!-- Left: Radial SVG Gauge -->
      <div class="flex items-center gap-6">
        <div class="relative w-32 h-32 flex items-center justify-center shrink-0">
          <svg class="w-full h-full -rotate-90 transform" viewBox="0 0 128 128">
            <!-- Background track -->
            <circle
              cx="64"
              cy="64"
              :r="radius"
              stroke="#E2E8F0"
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
              class="transition-all duration-700 ease-out"
            />
          </svg>

          <!-- Inside score readout -->
          <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span class="font-display text-3xl font-bold leading-none tracking-tight text-slate-900">
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
              class="font-mono-accent text-[11px] font-bold px-2.5 py-0.5 rounded-md border">
              {{ rating }}
            </span>
            <span class="font-mono-accent text-[11px] text-slate-500">
              Mix Health Score
            </span>
          </div>
          
          <h3 class="font-display text-xl sm:text-2xl text-slate-900">
            {{ ratingLabel }}
          </h3>
        </div>
      </div>

      <!-- Right: Stems Breakdown Stats & Token Estimation -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
        <div class="grid grid-cols-3 gap-2.5 bg-white border border-slate-200/90 rounded-xl p-3.5 text-center min-w-[220px] shadow-xs">
          <div>
            <span class="font-mono-accent text-xs font-bold text-emerald-600 block">
              {{ cleanTracks }}
            </span>
            <span class="font-mono-accent text-[10px] text-slate-500 uppercase">Bersih</span>
          </div>
          <div class="border-x border-slate-200">
            <span class="font-mono-accent text-xs font-bold text-amber-600 block">
              {{ warningTracks }}
            </span>
            <span class="font-mono-accent text-[10px] text-slate-500 uppercase">Warning</span>
          </div>
          <div>
            <span class="font-mono-accent text-xs font-bold text-rose-600 block">
              {{ criticalTracks }}
            </span>
            <span class="font-mono-accent text-[10px] text-slate-500 uppercase">Kritis</span>
          </div>
        </div>

        <div class="bg-white border border-slate-200/90 rounded-xl p-3.5 text-center sm:text-left flex items-center gap-3 shadow-xs">
          <div class="w-8 h-8 rounded-lg bg-blue-50 text-[#0052FF] border border-blue-200 flex items-center justify-center shrink-0">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div class="text-xs">
            <div class="font-semibold text-slate-700">Estimasi Perbaikan:</div>
            <div class="font-mono-accent font-bold text-[#0052FF]">{{ estimatedTokens }} Token Polaris</div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
