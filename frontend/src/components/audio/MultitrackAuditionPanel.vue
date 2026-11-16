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
  <div class="w-full space-y-5">
    
    <!-- Header: Studio Info & Format Badges (Flat, Seamless) -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone/60 pb-3">
      <div class="flex flex-wrap items-center gap-2">
        <h4 class="font-editorial text-sm sm:text-base font-bold text-ink-black tracking-tight">
          Pemutar Audisi A/B Komparatif
        </h4>
        <span class="font-mono-accent text-[11px] text-ink-black font-semibold uppercase tracking-wider">
          Sample-Accurate
        </span>
        <span class="text-stone font-mono-accent text-[11px]">/</span>
        <span class="font-mono-accent text-[11px] text-stone">
          48.0 kHz / 24-bit Float
        </span>
      </div>

      <div class="flex items-center gap-2 self-start sm:self-auto font-mono-accent text-xs">
        <button
          type="button"
          @click="loadAudioSources"
          :disabled="isFetchingSources || player.isLoading.value"
          title="Sinkronkan ulang audio dengan hasil perbaikan terbaru"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-paper-white hover:bg-bone text-ink-black border border-stone font-semibold cursor-pointer transition-all disabled:opacity-50">
          <svg 
            class="w-3.5 h-3.5 text-stone" 
            :class="{ 'animate-spin': isFetchingSources || player.isLoading.value }" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Sinkronkan Audio</span>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div 
      v-if="isFetchingSources || player.isLoading.value" 
      class="min-h-[220px] flex flex-col items-center justify-center p-8 space-y-3 bg-bone border border-stone">
      <div class="relative w-11 h-11">
        <div class="animate-spin rounded-full h-11 w-11 border-2 border-stone border-t-ink-black" />
        <div class="absolute inset-0 flex items-center justify-center text-[10px] font-mono-accent text-ink-black font-bold">
          {{ player.loadingProgress.value }}%
        </div>
      </div>
      <div class="text-center space-y-1">
        <p class="text-xs font-semibold text-ink-black">
          {{ isFetchingSources ? 'Mengambil lisensi streaming audio...' : 'Mendekode buffer stem multitrack ke memori...' }}
        </p>
        <p class="text-[11px] text-stone font-mono-accent">
          Menyiapkan perbandingan real-time audio asli vs hasil perbaikan
        </p>
      </div>
      <div class="w-56 h-2 bg-stone/20 border border-stone overflow-hidden">
        <div 
          class="h-full bg-ink-black transition-all duration-150"
          :style="{ width: `${player.loadingProgress.value}%` }"
        />
      </div>
    </div>

    <!-- Error State -->
    <div 
      v-else-if="fetchError || player.loadError.value" 
      class="min-h-[200px] flex flex-col items-center justify-center p-6 space-y-3 text-center bg-[#FFF1F2] border border-[#FDA4AF]">
      <div class="w-10 h-10 border border-[#FDA4AF] bg-white text-rose-700 flex items-center justify-center text-base font-bold font-mono-accent">
        !
      </div>
      <h5 class="text-xs font-bold text-rose-900 font-editorial">Gagal Memuat Sumber Audio Audisi</h5>
      <p class="text-xs text-rose-700 max-w-md font-mono-accent">
        {{ fetchError || player.loadError.value }}
      </p>
      <button 
        @click="loadAudioSources" 
        class="btn-ink-stamp text-xs py-2 px-4">
        Coba Muat Ulang
      </button>
    </div>

    <!-- Main Studio Console Workbench -->
    <div v-else class="space-y-4">
      
      <!-- Master Workbench (A/B, Waktu Pemutaran, Goniometer - Seamless Canvas) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-2">
        
        <!-- Left Column (lg:col-span-8): A/B Selector on top, Waktu Pemutaran & Transport underneath -->
        <div class="lg:col-span-8 space-y-4">
          
          <!-- 1. Komparasi Audisi A/B -->
          <div class="space-y-2.5">
            <!-- Big A / B Toggle Selector (Flat, No Subheaders) -->
            <div class="grid grid-cols-2 gap-3">
              <!-- Mode A (Raw) -->
              <button
                type="button"
                @click="player.setPlaybackMode('A')"
                :aria-pressed="player.playbackMode.value === 'A'"
                class="flex items-center justify-between p-2.5 sm:p-3 border text-left transition-all cursor-pointer"
                :class="player.playbackMode.value === 'A'
                  ? 'bg-ink-black border-ink-black text-paper-white'
                  : 'bg-paper-white border-stone text-stone hover:text-ink-black hover:bg-bone'">
                <span class="font-mono-accent text-xs font-black tracking-wider">A: AUDIO ASLI</span>
                <span 
                  v-if="player.playbackMode.value === 'A'"
                  class="w-2 h-2 bg-amber-400 shrink-0" 
                />
              </button>

              <!-- Mode B (Repaired) -->
              <button
                type="button"
                @click="player.setPlaybackMode('B')"
                :aria-pressed="player.playbackMode.value === 'B'"
                class="flex items-center justify-between p-2.5 sm:p-3 border text-left transition-all cursor-pointer"
                :class="player.playbackMode.value === 'B'
                  ? 'bg-[#0052FF] border-[#0052FF] text-white'
                  : 'bg-paper-white border-stone text-stone hover:text-ink-black hover:bg-bone'">
                <span class="font-mono-accent text-xs font-black tracking-wider">B: HASIL PERBAIKAN</span>
                <span 
                  v-if="player.playbackMode.value === 'B'"
                  class="w-2 h-2 bg-white shrink-0" 
                />
              </button>
            </div>

            <!-- Mono Check & Master Section -->
            <div class="flex flex-wrap items-center gap-3">
              <!-- Mono Check Button (FR-6.4) -->
              <button
                type="button"
                @click="player.toggleMonoCheck"
                :aria-pressed="player.isMonoCheck.value"
                class="px-3 py-1.5 border font-mono-accent text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:translate-y-[1px]"
                :class="player.isMonoCheck.value
                  ? 'bg-amber-400 text-ink-black border-2 border-ink-black'
                  : 'bg-paper-white hover:bg-bone text-ink-black border border-stone'">
                <span class="w-2 h-2 shrink-0" :class="player.isMonoCheck.value ? 'bg-ink-black' : 'bg-stone'" />
                <span>MONO CHECK (L+R)</span>
              </button>

              <!-- Master Volume -->
              <div class="flex-1 flex items-center gap-2 min-w-[130px]">
                <span class="text-[10px] font-mono-accent text-slate uppercase font-semibold">Master:</span>
                <input 
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.01"
                  :value="player.masterVolume.value"
                  @input="player.setMasterVolume(parseFloat($event.target.value))"
                  class="flex-1 accent-ink-black h-1.5 bg-stone/20 cursor-pointer"
                  title="Master Output Volume"
                />
                <span class="text-[10px] font-mono-accent text-ink-black font-bold w-9 text-right">
                  {{ Math.round(player.masterVolume.value * 100) }}%
                </span>
              </div>
            </div>
          </div>

          <!-- 2. Waktu Pemutaran (Dipindah ke bawah Komparasi A/B) -->
          <div class="space-y-2.5 pt-3 border-t border-stone/60">
            <div class="flex items-center justify-between font-mono-accent">
              <span class="text-[10px] text-slate uppercase font-bold tracking-wider">Waktu Pemutaran</span>
              <div class="flex items-center gap-1 text-sm font-bold">
                <span class="text-ink-black">{{ formatTime(player.currentTime.value) }}</span>
                <span class="text-stone">/</span>
                <span class="text-stone">{{ formatTime(player.duration.value) }}</span>
              </div>
            </div>

            <!-- Scrubber Track Slider -->
            <div>
              <input 
                type="range"
                min="0"
                :max="player.duration.value || 1"
                step="0.05"
                :value="player.currentTime.value"
                @input="player.seek(parseFloat($event.target.value))"
                class="w-full accent-ink-black h-2 bg-stone/20 border border-stone cursor-pointer"
              />
            </div>

            <!-- Transport Controls & Peak Meters -->
            <div class="flex items-center gap-3">
              <button 
                @click="player.stop"
                class="w-9 h-9 bg-paper-white hover:bg-bone text-ink-black border border-stone flex items-center justify-center cursor-pointer transition-colors active:translate-y-0.5"
                title="Hentikan & Reset">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" />
                </svg>
              </button>

              <button 
                @click="player.isPlaying.value ? player.pause() : player.play()"
                class="w-9 h-9 flex items-center justify-center text-paper-white border border-ink-black transition-all cursor-pointer active:translate-y-0.5"
                :class="player.isPlaying.value ? 'bg-amber-500 hover:bg-amber-600 text-ink-black' : 'bg-ink-black hover:bg-slate text-paper-white'"
                :title="player.isPlaying.value ? 'Jeda (Spasi)' : 'Putar Semua Trek (Spasi)'">
                <svg v-if="!player.isPlaying.value" class="w-4 h-4 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <svg v-else class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              </button>

              <!-- Peak Meter L/R -->
              <div class="flex-1 max-w-[160px] space-y-1 pl-2">
                <div class="flex items-center gap-1.5">
                  <span class="text-[8px] font-mono-accent text-stone font-bold w-3">L</span>
                  <div class="flex-1">
                    <LedPeakMeter :value="player.peakLeft.value" />
                  </div>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="text-[8px] font-mono-accent text-stone font-bold w-3">R</span>
                  <div class="flex-1">
                    <LedPeakMeter :value="player.peakRight.value" />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Right Column (lg:col-span-4): Goniometer Lissajous Phase Scope (Borderless) -->
        <div class="lg:col-span-4 flex flex-col items-center justify-center p-2 lg:border-l lg:border-stone/60">
          <div class="text-[10px] font-mono-accent text-slate font-bold mb-2 uppercase tracking-wider">
            Goniometer Fase (Lissajous)
          </div>
          <GoniometerVisualizer 
            :get-data="player.getGoniometerData"
            :is-playing="player.isPlaying.value"
            :size="150"
          />
        </div>

      </div>

      <!-- Multitrack Stem Channel Strips List (Flat, Seamless) -->
      <div>
        <div class="divide-y divide-stone/40 border-y border-stone/60 max-h-[440px] overflow-y-auto">
          <!-- Stem Row (Flat list row that blends into canvas background) -->
          <div 
            v-for="t in player.tracks.value" 
            :key="t.id"
            class="py-3 px-1 sm:px-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 hover:bg-bone/40 transition-colors">
            
            <!-- Stem Identity: Filename & Duration (Clean, No Clutter) -->
            <div class="min-w-[200px]">
              <div class="flex flex-wrap items-baseline gap-2">
                <h5 class="font-editorial text-sm font-bold text-ink-black truncate max-w-xs sm:max-w-md" :title="t.name || t.fileName">
                  {{ t.name || t.fileName || 'Trek Audio' }}
                </h5>
                <span class="text-[11px] text-stone font-mono-accent">
                  {{ formatTime(t.duration) }}
                </span>
              </div>
            </div>

            <!-- Channel Controls: Mute, Solo, Pan, Volume -->
            <div class="flex flex-wrap items-center gap-4 w-full md:w-auto">
              <!-- Mute / Solo Tally Buttons -->
              <TrackTallyButtons 
                :track-id="t.id"
                :initial-muted="t.isMuted"
                :initial-solo="t.isSolo"
                @toggle-mute="player.toggleTrackMute(t.id)"
                @toggle-solo="player.toggleTrackSolo(t.id)"
              />

              <!-- Panning Slider (Ergonomic Full Track) -->
              <div class="flex items-center gap-1.5 min-w-[130px]">
                <span class="text-[10px] font-mono-accent text-stone font-semibold">Pan:</span>
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
                  class="text-[10px] font-mono-accent text-ink-black font-semibold w-8 text-center cursor-pointer hover:underline"
                  title="Klik untuk reset Pan ke Center (0)">
                  {{ t.pan === 0 ? 'C' : t.pan < 0 ? `L${Math.round(Math.abs(t.pan)*100)}` : `R${Math.round(t.pan*100)}` }}
                </button>
              </div>

              <!-- Volume Fader -->
              <div class="flex items-center gap-2 min-w-[140px]">
                <span class="text-[10px] font-mono-accent text-stone font-semibold">Vol:</span>
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
                <span class="text-[10px] font-mono-accent text-ink-black font-bold w-9 text-right">
                  {{ Math.round(t.volume * 100) }}%
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- Studio Sub-Footer Bar with Shortcuts (Clean Hairline Separator) -->
      <div class="pt-3 border-t border-stone/60 flex flex-wrap items-center justify-between text-[11px] font-mono-accent text-stone gap-2">
        <div class="flex items-center gap-3">
          <span><kbd class="px-1.5 py-0.5 bg-bone text-ink-black border border-stone font-semibold">Spasi</kbd> Putar/Jeda</span>
          <span><kbd class="px-1.5 py-0.5 bg-bone text-ink-black border border-stone font-semibold">A</kbd> / <kbd class="px-1.5 py-0.5 bg-bone text-ink-black border border-stone font-semibold">B</kbd> Switch A/B</span>
          <span><kbd class="px-1.5 py-0.5 bg-bone text-ink-black border border-stone font-semibold">M</kbd> Mono Check</span>
        </div>
        <div>
          <span>POLARIS Audio Engine v1.0</span>
        </div>
      </div>

    </div>

  </div>
</template>
