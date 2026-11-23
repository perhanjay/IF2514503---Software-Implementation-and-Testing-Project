<script setup>
import { computed } from 'vue'
import { RefreshCw, Zap } from 'lucide-vue-next'

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
      scoreText: 'text-[#5ad363]',
      badgeBg: 'bg-[#5ad363]/20',
      badgeBorder: 'border-[#111111]/20',
      badgeText: 'text-emerald-900'
    }
  } else if (props.score >= 65) {
    return {
      scoreText: 'text-[#ffda40]',
      badgeBg: 'bg-[#ffda40]/45',
      badgeBorder: 'border-[#111111]/20',
      badgeText: 'text-amber-950'
    }
  } else {
    return {
      scoreText: 'text-rose-300',
      badgeBg: 'bg-[#ff82c2]/30',
      badgeBorder: 'border-[#111111]/20',
      badgeText: 'text-rose-950'
    }
  }
})
</script>

<template>
  <div class="rounded-[14px] border-[1.5px] border-[#111111] bg-white shadow-[2px_3px_0_#111111] p-4 sm:p-5">
    <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
      <!-- Left: Smoked Monitor Score Block & Rating with Tactile Rescan Keycap Below -->
      <div class="flex items-start sm:items-center gap-4 sm:gap-5">
        <div class="retro-monitor border-2 border-[#111111] shadow-[2px_3px_0_#111111] px-4 py-3 flex items-baseline gap-1.5 shrink-0">
          <span
            :class="[colorConfig.scoreText]"
            class="font-editorial tabular-nums text-4xl sm:text-5xl font-black leading-none tracking-tighter"
          >
            {{ Math.round(score) }}
          </span>
          <span class="font-sans text-xs font-semibold text-[#a1a1aa]">
            / 100
          </span>
        </div>

        <!-- Title & status text with Pindai Ulang keycap directly below it -->
        <div class="space-y-2 text-left">
          <h3 class="font-editorial text-xl sm:text-2xl text-[#111111] font-extrabold tracking-tight leading-tight">
            {{ ratingLabel }}
          </h3>
          <div>
            <button
              type="button"
              @click="emit('rescan')"
              :disabled="isRescanning"
              class="btn-keycap btn-keycap-sm btn-keycap-white px-3.5 py-1.5 text-xs"
            >
              <RefreshCw
                class="w-3.5 h-3.5 text-[#111111]"
                :class="{ 'animate-spin': isRescanning }"
                :stroke-width="2.1"
              />
              <span>{{ isRescanning ? 'Memindai Ulang...' : 'Pindai Ulang' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Right: Stems Breakdown Stats & Token Estimation (Uniform Tactile Retro Cards) -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full md:w-auto">
        <div class="rounded-[14px] border-[1.5px] border-[#111111] bg-[#fcfcfb] shadow-[2px_3px_0_#111111] px-4 py-2.5 flex items-center justify-around sm:justify-start divide-x divide-[#111111]/15 text-center">
          <div class="pr-3.5">
            <span class="font-sans tabular-nums text-base font-extrabold text-emerald-800 block leading-tight">
              {{ cleanTracks }}
            </span>
            <span class="font-sans text-[11px] text-[#111111] font-bold">Bersih</span>
          </div>
          <div class="px-3.5">
            <span class="font-sans tabular-nums text-base font-extrabold text-amber-800 block leading-tight">
              {{ warningTracks }}
            </span>
            <span class="font-sans text-[11px] text-[#111111] font-bold">Warning</span>
          </div>
          <div class="pl-3.5">
            <span class="font-sans tabular-nums text-base font-extrabold text-rose-800 block leading-tight">
              {{ criticalTracks }}
            </span>
            <span class="font-sans text-[11px] text-[#111111] font-bold">Kritis</span>
          </div>
        </div>

        <div class="rounded-[14px] border-[1.5px] border-[#111111] bg-[#fcfcfb] shadow-[2px_3px_0_#111111] px-3.5 py-2.5 text-left flex items-center gap-3">
          <div class="w-8 h-8 rounded-[10px] bg-[#ffda40] border-[1.5px] border-[#111111] shadow-[1.5px_2px_0_0_#111111] text-[#111111] flex items-center justify-center shrink-0">
            <Zap class="w-4 h-4" :stroke-width="2.2" />
          </div>
          <div class="leading-tight">
            <div class="font-sans font-semibold text-[#60605e] text-[11px]">Estimasi Perbaikan:</div>
            <div class="font-sans tabular-nums font-bold text-[#111111] text-xs mt-0.5">{{ estimatedTokens }} Token Polaris</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
