<script setup>
import { ref, computed, watch } from 'vue'
import { useStemAudioPlayer, formatTime } from '../composables/useStemAudioPlayer'

const props = defineProps({
  track: {
    type: Object,
    required: true
  },
  sessionId: {
    type: String,
    default: ''
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

const player = useStemAudioPlayer()

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

function openEdit() {
  selectedLabel.value = props.track.instrumentLabel || props.track.detectedLabel || 'Other'
  isEditing.value = true
}

function cancelEdit() {
  selectedLabel.value = props.track.instrumentLabel || props.track.detectedLabel || 'Other'
  isEditing.value = false
}

watch(() => props.track.instrumentLabel, (newVal) => {
  if (!isEditing.value) {
    selectedLabel.value = newVal || props.track.detectedLabel || 'Other'
  }
})

const confidenceScore = computed(() => {
  const conf = props.track.waveformPeaksJson?.confidence ?? props.track.confidenceScore ?? props.track.confidence
  if (conf !== undefined && conf !== null) {
    return conf <= 1 ? Math.round(conf * 100) : Math.round(conf)
  }
  return props.track.detectedLabel ? 92 : 50
})

const isNeedsReview = computed(() => {
  return confidenceScore.value < 80
})

function saveLabel() {
  emit('update-label', { trackId: props.track.id, label: selectedLabel.value })
  isEditing.value = false
}

// Audio Player Computed Properties & Handlers
const isActiveThis = computed(() => player.currentPlayingTrackId.value === props.track.id)
const isPlayingThis = computed(() => isActiveThis.value && player.isPlaying.value)
const isLoadingThis = computed(() => isActiveThis.value && player.isLoading.value)

const trackDuration = computed(() => {
  if (player.duration.value && !isNaN(player.duration.value) && player.duration.value > 0) {
    return player.duration.value
  }
  return props.track.durationSec || 0
})

function handlePlayToggle() {
  const sId = props.sessionId || props.track.sessionId
  player.togglePlay(sId, props.track)
}

function handleSeek(e) {
  const val = parseFloat(e.target.value)
  player.seek(val)
}
</script>

<template>
  <div class="py-3 px-1 sm:px-2 hover:bg-bone/40 transition-colors">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
      
      <!-- Left: Play Button + Track Name & Details -->
      <div class="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <!-- Leftmost Stem Audition Play/Pause Button -->
        <button 
          type="button"
          @click="handlePlayToggle"
          :disabled="isLoadingThis"
          :aria-label="isPlayingThis ? `Pause stem ${track.fileName}` : `Play stem ${track.fileName}`"
          :title="isPlayingThis ? 'Pause Stem' : 'Play & Audition Stem'"
          class="w-9 h-9 shrink-0 flex items-center justify-center border transition-all cursor-pointer font-mono-accent text-xs select-none"
          :class="isPlayingThis 
            ? 'bg-ink-black text-paper-white border-ink-black shadow-sm' 
            : isActiveThis 
              ? 'bg-bone text-ink-black border-ink-black' 
              : 'bg-paper-white text-ink-black border-stone hover:border-ink-black hover:bg-bone'"
        >
          <!-- Loading Spinner -->
          <svg v-if="isLoadingThis" class="animate-spin w-4 h-4 text-current" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          <!-- Playing: Pause Icon -->
          <svg v-else-if="isPlayingThis" class="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
          <!-- Idle / Paused: Play Icon -->
          <svg v-else class="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>

        <!-- Track Metadata & Classification -->
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="font-bold text-sm text-ink-black truncate">{{ track.fileName }}</span>
            <span v-if="track.durationSec" class="font-mono-accent text-[10px] text-slate">
              {{ track.durationSec.toFixed(1) }}s
            </span>
            <span 
              v-if="isActiveThis"
              class="px-1.5 py-0.2 bg-bone border border-stone font-mono-accent text-[9px] uppercase tracking-wider text-ink-black font-semibold"
            >
              {{ isPlayingThis ? 'Playing' : 'Paused' }}
            </span>
          </div>

          <!-- Label & AI Confidence Status -->
          <div class="flex flex-wrap items-center gap-2 mt-0.5">
            <template v-if="!isEditing">
              <span class="text-xs font-bold text-ink-black uppercase tracking-wider font-mono-accent">
                {{ track.instrumentLabel || track.detectedLabel || 'Belum Diberi Label' }}
              </span>

              <button 
                @click="openEdit"
                class="text-[11px] text-slate hover:text-ink-black underline font-semibold cursor-pointer font-mono-accent">
                Ubah
              </button>
            </template>

            <template v-else>
              <div class="flex items-center gap-1.5">
                <select 
                  v-model="selectedLabel"
                  class="text-xs bg-paper-white border border-ink-black px-2 py-1 text-ink-black focus:outline-none font-mono-accent">
                  <option v-for="cat in instrumentCategories" :key="cat.value" :value="cat.value">
                    {{ cat.label }}
                  </option>
                </select>
                <button 
                  @click="saveLabel"
                  class="btn-ink-stamp px-2.5 py-1 text-xs font-bold cursor-pointer font-mono-accent">
                  Simpan
                </button>
                <button 
                  @click="cancelEdit"
                  class="btn-bone-secondary px-2.5 py-1 text-xs border border-stone cursor-pointer font-mono-accent">
                  Batal
                </button>
              </div>
            </template>

            <!-- AI Confidence Text -->
            <span 
              :class="isNeedsReview ? 'text-amber-700' : 'text-emerald-700'"
              class="text-xs font-mono-accent font-semibold">
              AI: {{ confidenceScore }}%<span v-if="isNeedsReview"> (Perlu Peninjauan)</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Right: Pairing Status & Action -->
      <div class="flex items-center gap-3 shrink-0">
        <template v-if="pairedTrack">
          <div class="flex items-center gap-2 bg-bone border border-stone px-2.5 py-1">
            <svg class="w-3.5 h-3.5 text-ink-black shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <div class="leading-tight">
              <span class="block text-[11px] font-bold text-ink-black">
                Dipasangkan: {{ pairedTrack.fileName }}
              </span>
              <span class="font-mono-accent text-[9px] text-slate uppercase">
                Tipe: {{ pairInfo?.pairType || 'MIC_PAIR' }}
              </span>
            </div>
            <button 
              @click="emit('unpair', pairInfo?.id)"
              title="Lepas Pasangan (Unpair)"
              class="ml-1 text-slate hover:text-rose-600 font-bold text-xs p-1 cursor-pointer font-mono-accent">
              ✕
            </button>
          </div>
        </template>

        <template v-else>
          <span class="text-[11px] text-slate font-mono-accent uppercase tracking-wider font-medium">
            Trek Independen
          </span>
        </template>
      </div>

    </div>

    <!-- Spawned Interactive Audio Bar & Time Scrubber -->
    <div 
      v-if="isActiveThis"
      class="mt-2.5 p-2 sm:p-2.5 bg-bone border border-stone flex items-center gap-3 animate-fade-in select-none"
    >
      <!-- Interactive Audio Scrubber Slider -->
      <div class="flex-1 flex items-center min-w-0">
        <input 
          type="range"
          min="0"
          :max="trackDuration || 1"
          step="0.05"
          :value="player.currentTime.value"
          @input="handleSeek"
          class="w-full h-2 accent-ink-black bg-paper-white border border-stone cursor-pointer"
          title="Geser / Klik untuk navigasi waktu stem"
        />
      </div>

      <!-- Time Telemetry: Current Time / Duration -->
      <div class="flex items-center gap-1 font-mono-accent text-xs font-bold shrink-0">
        <span class="text-ink-black">{{ formatTime(player.currentTime.value) }}</span>
        <span class="text-stone">/</span>
        <span class="text-slate">{{ formatTime(trackDuration) }}</span>
      </div>

      <!-- Dismiss Button -->
      <button 
        type="button"
        @click="player.stop()"
        title="Tutup Pemutar Stem"
        class="text-slate hover:text-ink-black text-xs font-bold px-1.5 py-0.5 border border-stone hover:border-ink-black bg-paper-white cursor-pointer font-mono-accent shrink-0"
      >
        ✕
      </button>
    </div>

    <!-- Error display (if any) -->
    <div v-if="player.audioError.value && isActiveThis" class="mt-1 text-xs text-rose-600 bg-rose-50 border border-rose-300 p-2 font-mono-accent">
      {{ player.audioError.value }}
    </div>
  </div>
</template>
