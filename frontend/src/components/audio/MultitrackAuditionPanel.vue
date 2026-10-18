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

// Auto-pause bila panel ditutup (v-show = false)
watch(() => props.isOpen, (open) => {
  if (!open && player.isPlaying.value) {
    player.pause()
  }
})

const isFetchingSources = ref(false)
const fetchError = ref(null)

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
    const res = await axios.get(`/api/v1/sessions/${props.session.id}/audio-sources`)
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
  <div class="w-full bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-5 transition-all">
    
    <!-- Header: Studio Info & Format Badges (Selaras dengan DiagnosticTrackCard) -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0052FF] shrink-0">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h4 class="font-display text-sm sm:text-base font-bold text-slate-900">
              Pemutar Audisi A/B Komparatif
            </h4>
            <span class="font-mono-accent text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
              Sample-Accurate
            </span>
            <span class="font-mono-accent text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
              48.0 kHz / 24-bit Float
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-0.5 font-mono-accent">
            Bandingkan kondisi audio mentah (A) vs hasil penataan DSP (B) secara instan tanpa jeda
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 self-start sm:self-auto font-mono-accent text-xs">
        <span class="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
          {{ player.tracks.value.length }} Stems Dimuat
        </span>
      </div>
    </div>

    <!-- Loading State -->
    <div 
      v-if="isFetchingSources || player.isLoading.value" 
      class="min-h-[220px] flex flex-col items-center justify-center p-8 space-y-3 bg-slate-50/60 rounded-xl border border-slate-200/80">
      <div class="relative w-11 h-11">
        <div class="animate-spin rounded-full h-11 w-11 border-2 border-slate-200 border-t-[#0052FF]" />
        <div class="absolute inset-0 flex items-center justify-center text-[10px] font-mono-accent text-[#0052FF] font-bold">
          {{ player.loadingProgress.value }}%
        </div>
      </div>
      <div class="text-center space-y-1">
        <p class="text-xs font-semibold text-slate-800">
          {{ isFetchingSources ? 'Mengambil lisensi streaming audio...' : 'Mendekode buffer stem multitrack ke memori...' }}
        </p>
        <p class="text-[11px] text-slate-500 font-mono-accent">
          Menyiapkan perbandingan real-time audio asli vs hasil perbaikan
        </p>
      </div>
      <div class="w-56 h-1.5 bg-slate-200 rounded-full overflow-hidden border border-slate-300/60">
        <div 
          class="h-full bg-[#0052FF] transition-all duration-150"
          :style="{ width: `${player.loadingProgress.value}%` }"
        />
      </div>
    </div>

    <!-- Error State -->
    <div 
      v-else-if="fetchError || player.loadError.value" 
      class="min-h-[200px] flex flex-col items-center justify-center p-6 space-y-3 text-center bg-rose-50/60 rounded-xl border border-rose-200">
      <div class="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-base font-bold">
        !
      </div>
      <h5 class="text-xs font-bold text-rose-800">Gagal Memuat Sumber Audio Audisi</h5>
      <p class="text-xs text-rose-600 max-w-md font-normal">
        {{ fetchError || player.loadError.value }}
      </p>
      <button 
        @click="loadAudioSources" 
        class="px-4 py-2 mt-1 rounded-lg bg-[#0052FF] hover:bg-[#0043D6] text-white text-xs font-semibold shadow-xs cursor-pointer">
        Coba Muat Ulang
      </button>
    </div>

    <!-- Main Studio Console Workbench -->
    <div v-else class="space-y-4">
      
      <!-- Top Grid: Master Strip (A/B, Transport, Goniometer) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        
        <!-- Column 1 (lg:col-span-5): Instant A/B Switcher & Mono Check -->
        <div class="lg:col-span-5 bg-slate-50/80 border border-slate-200/90 rounded-xl p-4 flex flex-col justify-between space-y-3.5 shadow-2xs">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-[10px] font-mono-accent uppercase tracking-wider text-slate-500 font-bold">
                Komparasi Audisi A/B (Instant Micro-Crossfade)
              </span>
              <span class="text-[9px] font-mono-accent text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                Latensi &lt; 50ms
              </span>
            </div>

            <!-- Big A / B Toggle Selector -->
            <div class="grid grid-cols-2 gap-2 p-1 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
              <!-- Mode A (Raw) -->
              <button
                type="button"
                @click="player.setPlaybackMode('A')"
                :aria-pressed="player.playbackMode.value === 'A'"
                class="flex flex-col items-start p-2.5 rounded-lg border text-left transition-all cursor-pointer relative"
                :class="player.playbackMode.value === 'A'
                  ? 'bg-slate-100/90 border-slate-400 text-slate-900 shadow-xs ring-1 ring-slate-400/30'
                  : 'bg-transparent border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'">
                <div class="flex items-center justify-between w-full mb-1">
                  <span class="font-mono-accent text-xs font-black tracking-wider">A: AUDIO ASLI</span>
                  <span 
                    v-if="player.playbackMode.value === 'A'"
                    class="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]" 
                  />
                </div>
                <span class="text-[10px] text-slate-500 font-normal leading-tight">
                  Sebelum diproses (Kondisi Mentah)
                </span>
              </button>

              <!-- Mode B (Repaired) -->
              <button
                type="button"
                @click="player.setPlaybackMode('B')"
                :aria-pressed="player.playbackMode.value === 'B'"
                class="flex flex-col items-start p-2.5 rounded-lg border text-left transition-all cursor-pointer relative"
                :class="player.playbackMode.value === 'B'
                  ? 'bg-blue-50/90 border-blue-400 text-[#0052FF] shadow-xs ring-1 ring-blue-400/30'
                  : 'bg-transparent border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'">
                <div class="flex items-center justify-between w-full mb-1">
                  <span class="font-mono-accent text-xs font-black tracking-wider text-[#0052FF]">B: HASIL PERBAIKAN</span>
                  <span 
                    v-if="player.playbackMode.value === 'B'"
                    class="w-2 h-2 rounded-full bg-[#0052FF] shadow-[0_0_6px_rgba(0,82,255,0.6)]" 
                  />
                </div>
                <span class="text-[10px] text-blue-700/80 font-normal leading-tight">
                  Penyelarasan fasa, DC, & headroom
                </span>
              </button>
            </div>
          </div>

          <!-- Mono Check & Master Section -->
          <div class="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200/80">
            <!-- Mono Check Button (FR-6.4) -->
            <button
              type="button"
              @click="player.toggleMonoCheck"
              :aria-pressed="player.isMonoCheck.value"
              class="px-3 py-1.5 rounded-lg border font-mono-accent text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:translate-y-[1px]"
              :class="player.isMonoCheck.value
                ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs ring-2 ring-amber-200'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-2xs'">
              <span class="w-2 h-2 rounded-full" :class="player.isMonoCheck.value ? 'bg-slate-950' : 'bg-slate-400'" />
              <span>MONO CHECK (L+R)</span>
            </button>

            <!-- Master Volume -->
            <div class="flex-1 flex items-center gap-2 min-w-[130px]">
              <span class="text-[10px] font-mono-accent text-slate-500 uppercase font-semibold">Master:</span>
              <input 
                type="range"
                min="0"
                max="1.5"
                step="0.01"
                :value="player.masterVolume.value"
                @input="player.setMasterVolume(parseFloat($event.target.value))"
                class="flex-1 accent-[#0052FF] h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                title="Master Output Volume"
              />
              <span class="text-[10px] font-mono-accent text-slate-700 font-bold w-9 text-right">
                {{ Math.round(player.masterVolume.value * 100) }}%
              </span>
            </div>
          </div>
        </div>

        <!-- Column 2 (lg:col-span-4): Transport Playback Controls & Scrubber -->
        <div class="lg:col-span-4 bg-slate-50/80 border border-slate-200/90 rounded-xl p-4 flex flex-col justify-between space-y-3.5 shadow-2xs">
          <div class="flex items-center justify-between font-mono-accent">
            <span class="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Waktu Pemutaran</span>
            <div class="flex items-center gap-1 text-sm font-bold">
              <span class="text-slate-900">{{ formatTime(player.currentTime.value) }}</span>
              <span class="text-slate-400">/</span>
              <span class="text-slate-500">{{ formatTime(player.duration.value) }}</span>
            </div>
          </div>

          <div class="space-y-1">
            <input 
              type="range"
              min="0"
              :max="player.duration.value || 1"
              step="0.05"
              :value="player.currentTime.value"
              @input="player.seek(parseFloat($event.target.value))"
              class="w-full accent-[#0052FF] h-2 bg-slate-200 rounded-lg cursor-pointer shadow-inner border border-slate-300/40"
            />
          </div>

          <div class="flex items-center justify-center gap-3 pt-1">
            <button 
              @click="player.stop"
              class="w-9 h-9 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 flex items-center justify-center cursor-pointer shadow-2xs transition-colors active:scale-95"
              title="Hentikan & Reset">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1.5" />
              </svg>
            </button>

            <button 
              @click="player.isPlaying.value ? player.pause() : player.play()"
              class="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-xs transition-all cursor-pointer active:scale-95"
              :class="player.isPlaying.value ? 'bg-amber-600 hover:bg-amber-500' : 'bg-[#0052FF] hover:bg-[#0043D6]'"
              :title="player.isPlaying.value ? 'Jeda (Space)' : 'Putar Semua Trek (Space)'">
              <svg v-if="!player.isPlaying.value" class="w-5 h-5 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            </button>

            <!-- Peak Meter L/R -->
            <div class="flex-1 max-w-[130px] space-y-1 pl-2">
              <div class="flex items-center gap-1.5">
                <span class="text-[8px] font-mono-accent text-slate-500 font-bold w-3">L</span>
                <div class="flex-1">
                  <LedPeakMeter :value="player.peakLeft.value" />
                </div>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-[8px] font-mono-accent text-slate-500 font-bold w-3">R</span>
                <div class="flex-1">
                  <LedPeakMeter :value="player.peakRight.value" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Column 3 (lg:col-span-3): Goniometer Lissajous Phase Scope -->
        <div class="lg:col-span-3 bg-slate-50/80 border border-slate-200/90 rounded-xl p-3 flex flex-col items-center justify-center shadow-2xs">
          <div class="text-[10px] font-mono-accent text-slate-500 font-bold mb-1 uppercase tracking-wider">
            Goniometer Fase (Lissajous)
          </div>
          <GoniometerVisualizer 
            :get-data="player.getGoniometerData"
            :is-playing="player.isPlaying.value"
            :size="140"
          />
        </div>

      </div>

      <!-- Multitrack Stem Channel Strips List (Selaras dengan Card Gambar 2) -->
      <div class="space-y-2.5">
        <div class="flex items-center justify-between text-xs text-slate-500 font-mono-accent font-semibold px-1">
          <span>DAFTAR TREK STEM & PENGATURAN KANAL</span>
          <span>TOTAL {{ player.tracks.value.length }} STEMS</span>
        </div>

        <div class="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
          <!-- Stem Row (White Card dengan Border Slate-200 persis seperti DiagnosticTrackCard) -->
          <div 
            v-for="t in player.tracks.value" 
            :key="t.id"
            class="bg-white border border-slate-200/90 hover:border-slate-300 rounded-xl p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs transition-all">
            
            <!-- Stem Identity & Explicit Track Filename & Label -->
            <div class="flex items-center gap-3 min-w-[240px]">
              <div class="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                <svg v-if="t.isStereo" class="w-5 h-5 text-[#0052FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <svg v-else class="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                </svg>
              </div>

              <div class="space-y-0.5 min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <!-- Explicit Track Filename -->
                  <h5 class="font-display text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md" :title="t.name || t.fileName">
                    {{ t.name || t.fileName || 'Trek Audio' }}
                  </h5>
                  <!-- Detected/Assigned Instrument Label -->
                  <span class="font-mono-accent text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                    {{ t.label || t.instrumentLabel || 'Audio' }}
                  </span>
                  <!-- Stereo / Mono Badge -->
                  <span v-if="t.isStereo" class="font-mono-accent text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200 shrink-0">
                    STEREO
                  </span>
                  <span v-else class="font-mono-accent text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold border border-slate-200 shrink-0">
                    MONO
                  </span>
                </div>
                <div class="text-[11px] text-slate-400 font-mono-accent">
                  Durasi: {{ formatTime(t.duration) }}
                </div>
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

              <!-- Panning Slider -->
              <div class="flex items-center gap-1.5 min-w-[110px]">
                <span class="text-[10px] font-mono-accent text-slate-500 font-semibold">Pan:</span>
                <input 
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  :value="t.pan"
                  @input="player.setTrackPan(t.id, parseFloat($event.target.value))"
                  class="w-16 accent-slate-500 h-1.5 bg-slate-200 rounded cursor-pointer"
                  :title="`Pan: ${t.pan === 0 ? 'Center' : t.pan < 0 ? `L ${Math.round(Math.abs(t.pan)*100)}%` : `R ${Math.round(t.pan*100)}%`}`"
                />
                <span class="text-[10px] font-mono-accent text-slate-600 w-6 text-center">
                  {{ t.pan === 0 ? 'C' : t.pan < 0 ? `L${Math.round(Math.abs(t.pan)*100)}` : `R${Math.round(t.pan*100)}` }}
                </span>
              </div>

              <!-- Volume Fader -->
              <div class="flex items-center gap-2 min-w-[130px]">
                <span class="text-[10px] font-mono-accent text-slate-500 font-semibold">Vol:</span>
                <input 
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.01"
                  :value="t.volume"
                  @input="player.setTrackVolume(t.id, parseFloat($event.target.value))"
                  class="w-20 accent-[#0052FF] h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  title="Stem Channel Volume"
                />
                <span class="text-[10px] font-mono-accent text-slate-700 font-bold w-9 text-right">
                  {{ Math.round(t.volume * 100) }}%
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- Studio Sub-Footer Bar with Shortcuts (Clean Light Tone) -->
      <div class="px-4 py-2.5 bg-slate-50/80 border border-slate-200/80 rounded-xl flex flex-wrap items-center justify-between text-[11px] font-mono-accent text-slate-500 gap-2">
        <div class="flex items-center gap-3">
          <span><kbd class="px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200 shadow-2xs font-semibold">Spasi</kbd> Putar/Jeda</span>
          <span><kbd class="px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200 shadow-2xs font-semibold">A</kbd> / <kbd class="px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200 shadow-2xs font-semibold">B</kbd> Switch A/B</span>
          <span><kbd class="px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200 shadow-2xs font-semibold">M</kbd> Mono Check</span>
        </div>
        <div>
          <span>POLARIS Audio Engine v1.0</span>
        </div>
      </div>

    </div>

  </div>
</template>
