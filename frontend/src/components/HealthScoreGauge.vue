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
  },
  isRescanning: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['rescan'])

const colorConfig = computed(() => {
  if (props.score >= 90) {
    return {
      scoreText: 'text-emerald-700',
      badgeBg: 'bg-emerald-50',
      badgeBorder: 'border-emerald-300',
      badgeText: 'text-emerald-800'
    }
  } else if (props.score >= 65) {
    return {
      scoreText: 'text-amber-700',
      badgeBg: 'bg-amber-50',
      badgeBorder: 'border-amber-300',
      badgeText: 'text-amber-800'
    }
  } else {
    return {
      scoreText: 'text-rose-700',
      badgeBg: 'bg-rose-50',
      badgeBorder: 'border-rose-300',
      badgeText: 'text-rose-800'
    }
  }
})
</script>

<template>
  <div class="pb-5 border-b border-stone/60">
    <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
      
      <!-- Left: Clean Typographic Score Block & Rating with Rescan Button Below -->
      <div class="flex items-start gap-4 sm:gap-6">
        <div class="flex items-baseline gap-1.5 shrink-0 pt-0.5">
          <span 
            :class="[colorConfig.scoreText]"
            class="font-editorial text-5xl sm:text-6xl font-black leading-none tracking-tighter">
            {{ Math.round(score) }}
          </span>
          <span class="font-mono-accent text-xs font-semibold uppercase tracking-widest text-slate">
            / 100
          </span>
        </div>

        <!-- Title & status text with Pindai Ulang button directly below it -->
        <div class="space-y-2 text-left">
          <h3 class="font-editorial text-xl sm:text-2xl text-ink-black font-extrabold tracking-tight leading-tight">
            {{ ratingLabel }}
          </h3>
          <div>
            <button 
              @click="emit('rescan')"
              :disabled="isRescanning"
              class="py-1 px-3 border border-stone hover:border-ink-black hover:bg-paper-white bg-bone text-ink-black text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-all font-mono-accent disabled:opacity-50">
              <svg class="w-3.5 h-3.5 text-stone" :class="{'animate-spin': isRescanning}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{{ isRescanning ? 'Memindai Ulang...' : 'Pindai Ulang' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Right: Stems Breakdown Stats & Token Estimation (Seamless, united with background) -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6 w-full md:w-auto">
        <div class="flex items-center divide-x divide-stone/60 text-center">
          <div class="pr-3">
            <span class="font-mono-accent text-sm font-bold text-emerald-700 block">
              {{ cleanTracks }}
            </span>
            <span class="font-mono-accent text-[10px] text-slate uppercase tracking-wider font-semibold">Bersih</span>
          </div>
          <div class="px-3">
            <span class="font-mono-accent text-sm font-bold text-amber-700 block">
              {{ warningTracks }}
            </span>
            <span class="font-mono-accent text-[10px] text-slate uppercase tracking-wider font-semibold">Warning</span>
          </div>
          <div class="pl-3">
            <span class="font-mono-accent text-sm font-bold text-rose-700 block">
              {{ criticalTracks }}
            </span>
            <span class="font-mono-accent text-[10px] text-slate uppercase tracking-wider font-semibold">Kritis</span>
          </div>
        </div>

        <div class="text-left flex items-center gap-2.5">
          <div class="w-7 h-7 bg-ink-black text-paper-white flex items-center justify-center shrink-0">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div class="text-xs">
            <div class="font-bold text-ink-black uppercase tracking-wider font-editorial text-[10px]">Estimasi Perbaikan:</div>
            <div class="font-mono-accent font-bold text-ink-black text-xs">{{ estimatedTokens }} Token Polaris</div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
