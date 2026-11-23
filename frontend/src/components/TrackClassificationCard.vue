<script setup>
import { ref, computed, watch } from 'vue'
import { Play, Pause, Loader2, Pencil, Check, X, Link2 } from 'lucide-vue-next'
import { useStemAudioPlayer, formatTime } from '../composables/useStemAudioPlayer'
import RetroSelect from './ui/RetroSelect.vue'

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
  <div class="py-3.5 px-2 sm:px-3 rounded-[12px] hover:bg-white/60 transition-colors">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
      <!-- Left: Play Button + Track Name & Details -->
      <div class="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <!-- Leftmost Stem Audition Play/Pause Keycap -->
        <button
          type="button"
          @click="handlePlayToggle"
          :disabled="isLoadingThis"
          :aria-label="isPlayingThis ? `Pause stem ${track.fileName}` : `Play stem ${track.fileName}`"
          :title="isPlayingThis ? 'Pause Stem' : 'Play & Audition Stem'"
          class="btn-keycap btn-keycap-mini w-9 h-9 shrink-0 select-none"
          :class="isPlayingThis
            ? 'btn-keycap-blue'
            : isActiveThis
              ? 'btn-keycap-yellow'
              : 'btn-keycap-white'"
        >
          <Loader2 v-if="isLoadingThis" class="animate-spin w-4 h-4 text-[#111111]" :stroke-width="2.2" />
          <Pause v-else-if="isPlayingThis" class="w-4 h-4 fill-current text-[#111111]" :stroke-width="2" />
          <Play v-else class="w-4 h-4 fill-current ml-0.5 text-[#111111]" :stroke-width="2" />
        </button>

        <!-- Track Metadata & Classification -->
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-sans font-bold text-sm text-[#111111] truncate">{{ track.fileName }}</span>
            <span
              v-if="track.durationSec"
              class="inline-flex items-center rounded-full bg-[#f5f3eb] border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-2.5 py-1 font-telemetry text-[11px] font-bold text-[#111111] leading-none"
            >
              {{ track.durationSec.toFixed(1) }}s
            </span>
            <span
              v-if="isActiveThis"
              class="inline-flex items-center rounded-full border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-2.5 py-1 text-[11px] font-sans font-bold text-[#111111] leading-none"
              :class="isPlayingThis ? 'bg-[#87d7ff]' : 'bg-[#ffda40]'"
            >
              {{ isPlayingThis ? 'Playing' : 'Paused' }}
            </span>
          </div>

          <!-- Label & AI Confidence Status -->
          <div class="flex flex-wrap items-center gap-2">
            <template v-if="!isEditing">
              <span class="inline-flex items-center rounded-full bg-[#f5f3eb] border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-2.5 py-1 text-[11px] font-sans font-bold text-[#111111] leading-none">
                {{ track.instrumentLabel || track.detectedLabel || 'Belum Diberi Label' }}
              </span>

              <button
                type="button"
                @click="openEdit"
                class="btn-keycap btn-keycap-mini btn-keycap-white px-2.5 py-1 text-[11px] font-semibold"
              >
                <Pencil class="w-3 h-3" :stroke-width="2" />
                <span>Ubah</span>
              </button>
            </template>

            <template v-else>
              <div class="flex flex-wrap items-center gap-2">
                <RetroSelect
                  v-model="selectedLabel"
                  :options="instrumentCategories"
                  placeholder="Pilih kategori"
                  aria-label="Pilih kategori instrumen"
                  compact
                />
                <button
                  type="button"
                  @click="saveLabel"
                  class="btn-keycap btn-keycap-mini btn-keycap-blue px-3 py-1.5 text-xs"
                >
                  <Check class="w-3.5 h-3.5" :stroke-width="2.2" />
                  <span>Simpan</span>
                </button>
                <button
                  type="button"
                  @click="cancelEdit"
                  class="btn-keycap btn-keycap-mini btn-keycap-white px-3 py-1.5 text-xs"
                >
                  <span>Batal</span>
                </button>
              </div>
            </template>

            <!-- AI Confidence Pill (Uniform Retro Stamp) -->
            <span
              class="inline-flex items-center gap-1 rounded-full border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-2.5 py-1 text-[11px] font-sans font-bold text-[#111111] leading-none"
              :class="isNeedsReview ? 'bg-[#ffda40]' : 'bg-[#5ad363]'"
            >
              <span>AI:</span>
              <span class="font-telemetry">{{ confidenceScore }}%</span>
              <span v-if="isNeedsReview">(Perlu Peninjauan)</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Right: Pairing Status & Action -->
      <div class="flex items-center gap-3 shrink-0">
        <template v-if="pairedTrack">
          <div class="retro-telemetry-plate flex items-center gap-2.5 px-3 py-1.5">
            <Link2 class="w-3.5 h-3.5 text-[#20afff] shrink-0" :stroke-width="2.2" />
            <div class="leading-tight min-w-0">
              <span class="block font-sans text-[11px] font-bold text-[#111111] truncate max-w-[180px] sm:max-w-[220px]">
                Dipasangkan: {{ pairedTrack.fileName }}
              </span>
              <span class="block font-sans text-[10px] font-medium text-[#60605e]">
                Tipe: {{ pairInfo?.pairType || 'MIC_PAIR' }}
              </span>
            </div>
            <button
              type="button"
              @click="emit('unpair', pairInfo?.id)"
              title="Lepas Pasangan (Unpair)"
              aria-label="Lepas Pasangan (Unpair)"
              class="btn-keycap btn-keycap-mini btn-keycap-pink px-2 py-1 text-[11px] shrink-0"
            >
              <X class="w-3 h-3" :stroke-width="2.4" />
              <span class="sr-only sm:not-sr-only">Lepas</span>
            </button>
          </div>
        </template>

        <template v-else>
          <span class="inline-flex items-center rounded-full bg-white border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-2.5 py-1 text-[11px] font-sans font-bold text-[#111111] leading-none">
            Trek Independen
          </span>
        </template>
      </div>
    </div>

    <!-- Spawned Interactive Audio Bar & Time Scrubber -->
    <div
      v-if="isActiveThis"
      class="mt-3 p-2.5 sm:px-3.5 retro-telemetry-plate flex items-center gap-3 animate-fade-in select-none"
    >
      <div class="flex-1 flex items-center min-w-0">
        <input
          type="range"
          min="0"
          :max="trackDuration || 1"
          step="0.05"
          :value="player.currentTime.value"
          @input="handleSeek"
          class="w-full h-2 cursor-pointer"
          title="Geser / Klik untuk navigasi waktu stem"
          aria-label="Navigasi waktu stem"
        />
      </div>

      <!-- Time Telemetry inside Smoked Monitor Pill -->
      <div class="retro-monitor px-2.5 py-1 rounded-[8px] flex items-center gap-1 font-telemetry text-xs font-semibold shrink-0">
        <span class="text-[#20afff]">{{ formatTime(player.currentTime.value) }}</span>
        <span class="text-[#a1a1aa]">/</span>
        <span class="text-[#f5f3eb]">{{ formatTime(trackDuration) }}</span>
      </div>

      <!-- Dismiss Button -->
      <button
        type="button"
        @click="player.stop()"
        title="Tutup Pemutar Stem"
        aria-label="Tutup Pemutar Stem"
        class="btn-keycap btn-keycap-mini btn-keycap-white px-2 py-1 text-xs shrink-0"
      >
        <X class="w-3.5 h-3.5" :stroke-width="2.2" />
      </button>
    </div>

    <!-- Error display (if any) -->
    <div
      v-if="player.audioError.value && isActiveThis"
      class="mt-2 px-3 py-2 rounded-[10px] text-xs font-sans font-medium text-rose-900 bg-rose-50/95 border border-rose-300"
    >
      {{ player.audioError.value }}
    </div>
  </div>
</template>
