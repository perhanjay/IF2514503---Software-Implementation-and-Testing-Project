<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import axios from 'axios'
import { useMultitrackPlayer } from '../../composables/useMultitrackPlayer'
import GoniometerVisualizer from './GoniometerVisualizer.vue'
import LedPeakMeter from './LedPeakMeter.vue'
import TrackTallyButtons from './TrackTallyButtons.vue'

const props = defineProps({
  session: {
    type: Object,
    required: true
  },
  isOpen: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['close'])

const player = useMultitrackPlayer()

// Auto-pause bila panel ditutup (v-show = false) & auto-reload jika dibuka kembali dan ada perbaikan baru
watch(() => props.isOpen, (open) => {
  if (!open && player.isPlaying.value) {
    player.pause()
  } else if (open) {
    const hasPendingRepaired = player.tracks.value.some(t => !t.hasRepairedAudio)
    if (props.session?.status === 'REPAIRED' && hasPendingRepaired && !isFetchingSources.value && !player.isLoading.value) {
      loadAudioSources()
    }
  }
})

// Watcher: jika status sesi berubah menjadi REPAIRED atau data sesi di-update dari luar (repair auto/custom)
watch(
  [() => props.session?.status, () => props.session?.updatedAt],
  ([newStatus, newUpdated], [oldStatus, oldUpdated]) => {
    if (newStatus === 'REPAIRED' && (oldStatus !== 'REPAIRED' || newUpdated !== oldUpdated)) {
      loadAudioSources()
    }
  }
)

const isFetchingSources = ref(false)
const fetchError = ref(null)

const hasAnyRepairedAudio = computed(() => {
  return player.tracks.value.some(t => t.hasRepairedAudio)
})

// Format waktu mm:ss.ms
function formatTime(sec) {
  if (isNaN(sec) || sec < 0) return '00:00.0'
  const mins = Math.floor(sec / 60)
  const secs = Math.floor(sec % 60)
  const tenths = Math.floor((sec % 1) * 10)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`
}

async function loadAudioSources() {
  isFetchingSources.value = true
  fetchError.value = null
  try {
    const res = await axios.get(`/api/v1/sessions/${props.session.id}/audio-sources`, {
      params: { _t: Date.now() }
    })
    const tracksData = res.data.tracks || []
    if (tracksData.length === 0) {
      throw new Error('Tidak ada stem audio yang tersedia pada sesi ini.')
    }
    await player.loadSessionAudio(tracksData)
  } catch (err) {
    console.error('Gagal mengambil audio sources:', err)
    fetchError.value = err.response?.data?.error || err.message || 'Gagal memuat sumber audio'
  } finally {
    isFetchingSources.value = false
  }
}

function handleKeydown(e) {
  if (!props.isOpen) return
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return

  if (e.code === 'Space') {
    e.preventDefault()
    if (player.isPlaying.value) {
      player.pause()
    } else {
      player.play()
    }
  } else if (e.key === 'a' || e.key === 'A') {
    player.setPlaybackMode('A')
  } else if (e.key === 'b' || e.key === 'B') {
    player.setPlaybackMode('B')
  } else if (e.key === 'm' || e.key === 'M') {
    player.toggleMonoCheck()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  loadAudioSources()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  player.dispose()
})
</script>

<template>
  <div class="w-full space-y-4">
    <!-- Loading State (Unified White Card matching Design System) -->
    <div 
      v-if="isFetchingSources || player.isLoading.value" 
      class="rounded-[14px] border-[1.5px] border-[#111111] bg-white/96 shadow-[2px_3px_0_#111111] min-h-[220px] flex flex-col items-center justify-center p-8 space-y-4">
      <div class="w-11 h-11 rounded-[12px] border-[1.5px] border-[#111111] bg-[#ffda40] shadow-[1.5px_2px_0_#111111] text-[#111111] flex items-center justify-center">
        <svg class="animate-spin w-5 h-5 text-[#111111]" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
          <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"></path>
        </svg>
      </div>
      <div class="text-center space-y-1.5">
        <div class="flex flex-wrap items-center justify-center gap-2">
          <p class="font-editorial text-sm font-bold text-[#111111]">
            {{ isFetchingSources ? 'Mengambil lisensi streaming audio...' : 'Mendekode buffer stem multitrack ke memori...' }}
          </p>
          <span class="inline-flex items-center rounded-full bg-[#87d7ff] border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-2.5 py-0.5 font-telemetry text-[11px] font-bold text-[#111111] leading-none">
            {{ player.loadingProgress.value }}%
          </span>
        </div>
        <p class="font-sans text-xs text-[#60605e]">
          Menyiapkan perbandingan real-time audio asli vs hasil perbaikan
        </p>
      </div>
      <div class="w-60 h-3 rounded-full bg-[#eaeef4] border-[1.5px] border-[#111111] overflow-hidden">
        <div 
          class="h-full bg-[#20afff] rounded-full transition-all duration-150"
          :style="{ width: `${Math.max(8, player.loadingProgress.value)}%` }"
        />
      </div>
    </div>

    <!-- Error State (Unified White Card) -->
    <div 
      v-else-if="fetchError || player.loadError.value" 
      class="rounded-[14px] border-[1.5px] border-[#111111] bg-white/96 shadow-[2px_3px_0_#111111] min-h-[200px] flex flex-col items-center justify-center p-6 space-y-3 text-center">
      <div class="w-10 h-10 rounded-[10px] border-[1.5px] border-[#111111] bg-[#ff82c2] shadow-[1.5px_2px_0_#111111] text-[#111111] flex items-center justify-center text-base font-bold font-sans">
        !
      </div>
      <h5 class="text-sm font-bold text-[#111111] font-editorial">Gagal Memuat Sumber Audio Audisi</h5>
      <p class="text-xs text-[#60605e] max-w-md font-sans">
        {{ fetchError || player.loadError.value }}
      </p>
      <button 
        type="button"
        @click="loadAudioSources" 
        class="btn-keycap btn-keycap-sm btn-keycap-pink text-xs py-2 px-4">
        Coba Muat Ulang
      </button>
    </div>

    <!-- Main Studio Console Workbench (2 Unified White Cards matching Phase 02 Rhythm) -->
    <div v-else class="space-y-4">
      
      <!-- CARD 1: Unified Master Audition Console (Header + A/B + Transport + Goniometer) -->
      <div class="rounded-[14px] border-[1.5px] border-[#111111] bg-white/96 shadow-[2px_3px_0_#111111] p-4 sm:p-5 space-y-4">
        <!-- Console Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-dashed border-[#111111]/15 pb-3.5">
          <div class="flex flex-wrap items-center gap-2">
            <h4 class="font-editorial text-sm sm:text-base font-bold text-[#111111] tracking-tight">
              Pemutar Audisi A/B Komparatif
            </h4>
            <span class="inline-flex items-center rounded-full bg-[#87d7ff] border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-2.5 py-1 font-sans text-[11px] font-bold text-[#111111] leading-none">
              Sample-Accurate
            </span>
            <span class="inline-flex items-center gap-1 rounded-full bg-[#f5f3eb] border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-2.5 py-1 text-[11px] font-bold text-[#111111] leading-none">
              <span class="font-telemetry">48.0 kHz</span>
              <span class="text-[#60605e]">/</span>
              <span class="font-telemetry">24-bit</span>
              <span class="font-sans">Float</span>
            </span>
          </div>

          <div class="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              @click="loadAudioSources"
              :disabled="isFetchingSources || player.isLoading.value"
              title="Sinkronkan ulang audio dengan hasil perbaikan terbaru"
              class="btn-keycap btn-keycap-sm btn-keycap-white px-3.5 py-1.5 text-xs font-sans font-bold">
              <svg 
                class="w-3.5 h-3.5 text-[#111111]" 
                :class="{ 'animate-spin': isFetchingSources || player.isLoading.value }" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                stroke-width="2.2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Sinkronkan Audio</span>
            </button>
          </div>
        </div>

        <!-- Master Workbench Grid (A/B + Transport Left, Goniometer Right) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          
          <!-- Left Column (lg:col-span-8): A/B Keycaps on top, Transport Deck underneath -->
          <div class="lg:col-span-8 space-y-4">
            
            <!-- 1. Komparasi Audisi A/B -->
            <div class="space-y-3">
              <!-- Tactile Keycap A / B Selector -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <!-- Mode A (Raw) -->
                <button
                  type="button"
                  @click="player.setPlaybackMode('A')"
                  :aria-pressed="player.playbackMode.value === 'A'"
                  class="btn-keycap btn-keycap-sm flex items-center justify-between px-3.5 py-2.5 text-left text-xs"
                  :class="player.playbackMode.value === 'A' ? 'btn-keycap-dark' : 'btn-keycap-white'">
                  <span class="font-sans font-bold">A: Audio Asli</span>
                  <span 
                    v-if="player.playbackMode.value === 'A'"
                    class="px-2 py-0.5 rounded-full bg-[#ffda40] text-[#111111] text-[10px] font-bold shrink-0" 
                  >Aktif</span>
                </button>

                <!-- Mode B (Repaired) -->
                <button
                  type="button"
                  @click="player.setPlaybackMode('B')"
                  :aria-pressed="player.playbackMode.value === 'B'"
                  class="btn-keycap btn-keycap-sm flex items-center justify-between px-3.5 py-2.5 text-left text-xs"
                  :class="player.playbackMode.value === 'B' ? 'btn-keycap-blue' : 'btn-keycap-white'">
                  <span class="font-sans font-bold">B: Hasil Perbaikan</span>
                  <span 
                    v-if="player.playbackMode.value === 'B'"
                    class="px-2 py-0.5 rounded-full bg-[#111111] text-white text-[10px] font-bold shrink-0" 
                  >Aktif</span>
                </button>
              </div>

              <!-- Mono Check & Master Section -->
              <div class="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  @click="player.toggleMonoCheck"
                  :aria-pressed="player.isMonoCheck.value"
                  class="btn-keycap btn-keycap-sm px-3.5 py-2 text-xs font-sans font-bold flex items-center gap-2"
                  :class="player.isMonoCheck.value ? 'btn-keycap-yellow' : 'btn-keycap-white'">
                  <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h8m-8 10h8M5 12h14" />
                  </svg>
                  <span>Mono Check (L+R)</span>
                </button>

                <!-- Master Volume -->
                <div class="rounded-[12px] border-[1.5px] border-[#111111] bg-[#fcfcfb] shadow-[1.5px_2px_0_#111111] px-3.5 py-2 flex-1 flex items-center gap-3 min-w-[160px]">
                  <span class="text-xs font-sans text-[#60605e] font-bold uppercase tracking-wider">Master</span>
                  <input 
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.01"
                    :value="player.masterVolume.value"
                    @input="player.setMasterVolume(parseFloat($event.target.value))"
                    class="flex-1 h-1.5 cursor-pointer"
                    title="Master Output Volume"
                  />
                  <span class="inline-flex items-center rounded-full bg-[#f5f3eb] border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-2.5 py-0.5 text-[11px] font-telemetry text-[#111111] font-bold leading-none">
                    {{ Math.round(player.masterVolume.value * 100) }}%
                  </span>
                </div>
              </div>
            </div>

            <!-- 2. Waktu Pemutaran, Transport & Peak Meters Sub-Card -->
            <div class="rounded-[14px] border-[1.5px] border-[#111111] bg-[#fcfcfb] shadow-[2px_3px_0_#111111] p-4 space-y-3.5">
              <div class="flex items-center justify-between gap-2">
                <span class="font-sans text-[11px] text-[#60605e] font-bold uppercase tracking-wider">Waktu Pemutaran</span>
                <div class="inline-flex items-center gap-1 rounded-full bg-[#f5f3eb] border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-3 py-1 font-telemetry text-xs font-bold leading-none text-[#111111]">
                  <span>{{ formatTime(player.currentTime.value) }}</span>
                  <span class="text-[#60605e]">/</span>
                  <span class="text-[#60605e]">{{ formatTime(player.duration.value) }}</span>
                </div>
              </div>

              <div>
                <input 
                  type="range"
                  min="0"
                  :max="player.duration.value || 1"
                  step="0.05"
                  :value="player.currentTime.value"
                  @input="player.seek(parseFloat($event.target.value))"
                  class="w-full h-2 cursor-pointer"
                />
              </div>

              <div class="flex flex-wrap sm:flex-nowrap items-center gap-3 pt-1">
                <button 
                  type="button"
                  @click="player.stop"
                  class="btn-keycap btn-keycap-sm btn-keycap-white w-10 h-10 shrink-0"
                  title="Hentikan & Reset">
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="1.5" />
                  </svg>
                </button>

                <button 
                  type="button"
                  @click="player.isPlaying.value ? player.pause() : player.play()"
                  class="btn-keycap btn-keycap-sm w-10 h-10 shrink-0"
                  :class="player.isPlaying.value ? 'btn-keycap-yellow' : 'btn-keycap-blue'"
                  :title="player.isPlaying.value ? 'Jeda (Spasi)' : 'Putar Semua Trek (Spasi)'">
                  <svg v-if="!player.isPlaying.value" class="w-4 h-4 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <svg v-else class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                </button>

                <div class="flex-1 min-w-[160px] space-y-2 sm:pl-2">
                  <div class="flex items-center gap-2">
                    <span class="inline-flex items-center justify-center w-5 h-5 rounded-[6px] border-[1.5px] border-[#111111] bg-[#f5f3eb] text-[10px] font-telemetry text-[#111111] font-bold shrink-0">L</span>
                    <div class="flex-1">
                      <LedPeakMeter :value="player.peakLeft.value" />
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="inline-flex items-center justify-center w-5 h-5 rounded-[6px] border-[1.5px] border-[#111111] bg-[#f5f3eb] text-[10px] font-telemetry text-[#111111] font-bold shrink-0">R</span>
                    <div class="flex-1">
                      <LedPeakMeter :value="player.peakRight.value" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- Right Column (lg:col-span-4): Goniometer Lissajous Sub-Card -->
          <div class="lg:col-span-4 flex flex-col items-center lg:items-end justify-center lg:border-l lg:border-dashed lg:border-[#111111]/15 lg:pl-5">
            <GoniometerVisualizer 
              :get-data="player.getGoniometerData"
              :is-playing="player.isPlaying.value"
              :size="155"
            />
          </div>

        </div>
      </div>

      <!-- CARD 2: Unified Stem Channel Strips & Shortcuts Card -->
      <div class="rounded-[14px] border-[1.5px] border-[#111111] bg-white/96 shadow-[2px_3px_0_#111111] overflow-hidden">
        <div class="divide-y divide-[#111111]/12 max-h-[440px] overflow-y-auto p-1 sm:p-2">
          <!-- Stem Row -->
          <div 
            v-for="t in player.tracks.value" 
            :key="t.id"
            class="py-3 px-3 sm:px-4 rounded-[10px] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 hover:bg-[#fcfcfb] transition-colors">
            
            <!-- Stem Identity: Filename & Duration Pill -->
            <div class="min-w-[200px]">
              <div class="flex flex-wrap items-center gap-2">
                <h5 class="font-editorial text-sm font-bold text-[#111111] truncate max-w-xs sm:max-w-md" :title="t.name || t.fileName">
                  {{ t.name || t.fileName || 'Trek Audio' }}
                </h5>
                <span class="inline-flex items-center rounded-full bg-[#f5f3eb] border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-2 py-0.5 text-[11px] font-bold text-[#111111] font-telemetry leading-none">
                  {{ formatTime(t.duration) }}
                </span>
              </div>
            </div>

            <!-- Channel Controls: Mute, Solo, Pan, Volume -->
            <div class="flex flex-wrap items-center gap-4 w-full md:w-auto">
              <TrackTallyButtons 
                :track-id="t.id"
                :initial-muted="t.isMuted"
                :initial-solo="t.isSolo"
                @toggle-mute="player.toggleTrackMute(t.id)"
                @toggle-solo="player.toggleTrackSolo(t.id)"
              />

              <!-- Panning Slider -->
              <div class="flex items-center gap-2 min-w-[145px]">
                <span class="text-xs font-sans text-[#60605e] font-bold">Pan:</span>
                <input 
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  v-model.number="t.pan"
                  @input="player.setTrackPan(t.id, t.pan)"
                  @dblclick="t.pan = 0; player.setTrackPan(t.id, 0)"
                  class="w-20 shrink-0 h-1.5 cursor-pointer"
                  :title="`Pan: ${t.pan === 0 ? 'Center' : t.pan < 0 ? `L ${Math.round(Math.abs(t.pan)*100)}%` : `R ${Math.round(t.pan*100)}%`} (Klik dua kali untuk Center)`"
                />
                <button 
                  type="button"
                  @click="t.pan = 0; player.setTrackPan(t.id, 0)"
                  class="btn-keycap btn-keycap-mini btn-keycap-white px-2 py-0.5 text-[11px] font-telemetry font-bold min-w-[40px]"
                  title="Klik untuk reset Pan ke Center (0)">
                  {{ t.pan === 0 ? 'C' : t.pan < 0 ? `L${Math.round(Math.abs(t.pan)*100)}` : `R${Math.round(t.pan*100)}` }}
                </button>
              </div>

              <!-- Volume Fader -->
              <div class="flex items-center gap-2 min-w-[150px]">
                <span class="text-xs font-sans text-[#60605e] font-bold">Vol:</span>
                <input 
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.01"
                  v-model.number="t.volume"
                  @input="player.setTrackVolume(t.id, t.volume)"
                  class="w-20 shrink-0 h-1.5 cursor-pointer"
                  title="Stem Channel Volume"
                />
                <span class="inline-flex items-center justify-center rounded-full bg-[#f5f3eb] border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-2 py-0.5 text-[11px] font-telemetry text-[#111111] font-bold min-w-[44px] leading-none">
                  {{ Math.round(t.volume * 100) }}%
                </span>
              </div>
            </div>

          </div>
        </div>

        <!-- Integrated Shortcuts Footer Bar -->
        <div class="border-t border-[#111111]/12 bg-[#fcfcfb] px-4 py-3 flex flex-wrap items-center justify-between text-xs font-sans text-[#60605e] gap-3">
          <div class="flex flex-wrap items-center gap-3">
            <span class="inline-flex items-center gap-1.5">
              <kbd class="px-1.5 py-0.5 text-[11px] font-sans font-bold text-[#111111] rounded-[6px] bg-white border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111]">Spasi</kbd>
              <span class="font-medium text-[#111111]">Putar/Jeda</span>
            </span>
            <span class="inline-flex items-center gap-1.5">
              <kbd class="px-1.5 py-0.5 text-[11px] font-sans font-bold text-[#111111] rounded-[6px] bg-white border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111]">A</kbd>
              <span>/</span>
              <kbd class="px-1.5 py-0.5 text-[11px] font-sans font-bold text-[#111111] rounded-[6px] bg-white border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111]">B</kbd>
              <span class="font-medium text-[#111111]">Switch A/B</span>
            </span>
            <span class="inline-flex items-center gap-1.5">
              <kbd class="px-1.5 py-0.5 text-[11px] font-sans font-bold text-[#111111] rounded-[6px] bg-white border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111]">M</kbd>
              <span class="font-medium text-[#111111]">Mono Check</span>
            </span>
          </div>
          <div>
            <span class="font-sans font-bold text-[#111111]">Polaris Audio Engine <span class="font-telemetry">v1.0</span></span>
          </div>
        </div>
      </div>

    </div>

  </div>
</template>
