<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  track: {
    type: Object,
    required: true
  },
  pairedTrack: {
    type: Object,
    default: null
  },
  pairInfo: {
    type: Object,
    default: null
  },
  availableTracks: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update-label', 'unpair', 'create-pair'])

const isEditing = ref(false)
const selectedLabel = ref(props.track.instrumentLabel || props.track.detectedLabel || 'Other')

const instrumentCategories = [
  { label: 'Drums: Kick', value: 'Drums: Kick' },
  { label: 'Drums: Snare', value: 'Drums: Snare' },
  { label: 'Drums: Hi-Hat', value: 'Drums: Hi-Hat' },
  { label: 'Drums: Toms', value: 'Drums: Toms' },
  { label: 'Drums: Overhead', value: 'Drums: Overhead' },
  { label: 'Bass', value: 'Bass' },
  { label: 'Guitars: Electric', value: 'Guitars: Electric' },
  { label: 'Guitars: Acoustic', value: 'Guitars: Acoustic' },
  { label: 'Vocals: Lead', value: 'Vocals: Lead' },
  { label: 'Vocals: Backing', value: 'Vocals: Backing' },
  { label: 'Keys / Synth', value: 'Keys / Synth' },
  { label: 'Other', value: 'Other' }
]

const confidenceScore = computed(() => {
  if (props.track.waveformPeaksJson?.confidence) {
    return Math.round(props.track.waveformPeaksJson.confidence * 100)
  }
  // Fallback or estimated
  return props.track.detectedLabel ? 92 : 50
})

const isNeedsReview = computed(() => {
  return confidenceScore.value < 80
})

function saveLabel() {
  emit('update-label', { trackId: props.track.id, label: selectedLabel.value })
  isEditing.value = false
}
</script>

<template>
  <div class="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      
      <!-- Left: Track Name & Icon -->
      <div class="flex items-center gap-3.5 min-w-0">
        <div class="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
          <span v-if="track.isStereo" class="font-mono-accent text-[11px] font-bold text-[#0052FF]">ST</span>
          <span v-else class="font-mono-accent text-[11px] font-bold text-slate-500">M</span>
        </div>

        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-sm text-slate-900 truncate">{{ track.fileName }}</span>
            <span v-if="track.durationSec" class="font-mono-accent text-[10px] text-slate-400">
              {{ track.durationSec.toFixed(1) }}s
            </span>
          </div>

          <!-- Label & AI Confidence Status -->
          <div class="flex flex-wrap items-center gap-2 mt-1">
            <template v-if="!isEditing">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-[#0052FF]/10 text-[#0052FF] border border-[#0052FF]/20">
                <span>{{ track.instrumentLabel || track.detectedLabel || 'Belum Diberi Label' }}</span>
              </span>

              <button 
                @click="isEditing = true"
                class="text-[11px] text-slate-400 hover:text-[#0052FF] underline cursor-pointer">
                Ubah
              </button>
            </template>

            <template v-else>
              <div class="flex items-center gap-1.5">
                <select 
                  v-model="selectedLabel"
                  class="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-slate-900 focus:outline-none focus:border-[#0052FF]">
                  <option v-for="cat in instrumentCategories" :key="cat.value" :value="cat.value">
                    {{ cat.label }}
                  </option>
                </select>
                <button 
                  @click="saveLabel"
                  class="px-2 py-1 text-xs bg-[#0052FF] text-white rounded-lg font-medium hover:bg-blue-600 transition-colors cursor-pointer">
                  Simpan
                </button>
                <button 
                  @click="isEditing = false"
                  class="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer">
                  Batal
                </button>
              </div>
            </template>

            <!-- Confidence Badge -->
            <span 
              :class="isNeedsReview ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono-accent font-semibold border">
              <span class="w-1.5 h-1.5 rounded-full" :class="isNeedsReview ? 'bg-amber-500' : 'bg-emerald-500'" />
              <span>AI: {{ confidenceScore }}%</span>
              <span v-if="isNeedsReview">(Perlu Peninjauan)</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Right: Pairing Status & Action -->
      <div class="flex items-center gap-3">
        <template v-if="pairedTrack">
          <div class="flex items-center gap-2 bg-indigo-50/70 border border-indigo-200/80 rounded-xl px-3 py-1.5">
            <span class="text-sm">🔗</span>
            <div class="leading-tight">
              <span class="block text-[11px] font-semibold text-indigo-900">
                Dipasangkan dengan: {{ pairedTrack.fileName }}
              </span>
              <span class="font-mono-accent text-[9px] text-indigo-600 uppercase">
                Tipe: {{ pairInfo?.pairType || 'MIC_PAIR' }}
              </span>
            </div>
            <button 
              @click="emit('unpair', pairInfo?.id)"
              title="Lepas Pasangan (Unpair)"
              class="ml-1 text-indigo-400 hover:text-rose-600 font-bold text-xs p-1 cursor-pointer">
              ✕
            </button>
          </div>
        </template>

        <template v-else>
          <span class="text-[11px] text-slate-400 font-mono-accent">
            Trek Independen
          </span>
        </template>
      </div>

    </div>
  </div>
</template>
