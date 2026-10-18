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
  }
})

const emit = defineEmits(['close'])

const player = useMultitrackPlayer()

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
  <div class="w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-md overflow-hidden text-slate-100 transition-all">
    
    <!-- Top Telemetry Header -->
    <div class="flex flex-wrap items-center justify-between px-5 py-3 bg-slate-950/90 border-b border-slate-800/90 gap-3">
      <div class="flex items-center gap-3">
        <div class="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-display text-sm font-bold text-white tracking-tight">
            Pemutar Audisi A/B Komparatif
          </span>
          <span class="text-[10px] font-mono-accent uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/80 font-semibold">
            Sinkronisasi Sample-Accurate
          </span>
        </div>
      </div>

      <div class="flex items-center gap-3 text-xs text-slate-400 font-mono-accent">
        <span>{{ player.tracks.value.length }} Stems Dimuat</span>
        <span class="text-slate-600">•</span>
        <span>48.0 kHz / 24-bit Float</span>
      </div>
    </div>

    <!-- Loading / Buffering State -->
    <div 
      v-if="isFetchingSources || player.isLoading.value" 
      class="min-h-[260px] flex flex-col items-center justify-center p-8 space-y-4">
      <div class="relative w-12 h-12">
        <div class="animate-spin rounded-full h-12 w-12 border-2 border-slate-700 border-t-[#0052FF]" />
        <div class="absolute inset-0 flex items-center justify-center text-[10px] font-mono-accent text-blue-400 font-bold">
          {{ player.loadingProgress.value }}%
        </div>
      </div>
      <div class="text-center space-y-1">
        <p class="text-sm font-semibold text-slate-200">
          {{ isFetchingSources ? 'Mengambil lisensi streaming audio...' : 'Mendekode buffer stem multitrack ke memori audio...' }}
        </p>
        <p class="text-xs text-slate-500 font-mono-accent">
          Menyiapkan perbandingan real-time audio asli vs hasil perbaikan
        </p>
      </div>
      <!-- Progress Bar -->
      <div class="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
        <div 
          class="h-full bg-[#0052FF] transition-all duration-150"
          :style="{ width: `${player.loadingProgress.value}%` }"
        />
      </div>
    </div>

    <!-- Error State -->
    <div 
      v-else-if="fetchError || player.loadError.value" 
      class="min-h-[220px] flex flex-col items-center justify-center p-8 space-y-3 text-center">
      <div class="w-10 h-10 rounded-full bg-rose-950/60 border border-rose-800 text-rose-400 flex items-center justify-center text-lg font-bold">
        !
      </div>
      <h5 class="text-sm font-bold text-rose-300">Gagal Memuat Sumber Audio Audisi</h5>
      <p class="text-xs text-slate-400 max-w-md font-normal">
        {{ fetchError || player.loadError.value }}
      </p>
      <button 
        @click="loadAudioSources" 
        class="px-4 py-2 mt-2 rounded-lg bg-[#0052FF] hover:bg-[#0043D6] text-white text-xs font-semibold shadow-xs cursor-pointer">
        Coba Muat Ulang
      </button>
    </div>

    <!-- Loaded Studio Rack -->
    <div v-else class="flex flex-col">
      
      <!-- Top Studio Controls Rack: A/B, Transport, Goniometer -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 sm:p-5 bg-slate-950/50 border-b border-slate-800/80">
        
        <!-- Column 1 (lg:col-span-5): Instant A/B Switcher & Mono Check -->
        <div class="lg:col-span-5 flex flex-col justify-between space-y-3">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-[11px] font-mono-accent uppercase tracking-wider text-slate-400 font-bold">
                Komparasi Audisi A/B (Micro-Crossfade)
              </span>
              <span class="text-[9px] font-mono-accent text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                Latensi &lt; 50ms
              </span>
            </div>

            <!-- Big A / B Toggle Selector -->
            <div class="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <!-- Mode A (Raw) -->
              <button
                type="button"
                @click="player.setPlaybackMode('A')"
                :aria-pressed="player.playbackMode.value === 'A'"
                class="flex flex-col items-start p-3 rounded-lg border text-left transition-all cursor-pointer relative"
                :class="player.playbackMode.value === 'A'
                  ? 'bg-slate-800/90 border-slate-600 text-white shadow-sm ring-1 ring-slate-400/50'
                  : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'">
                <div class="flex items-center justify-between w-full mb-1">
                  <span class="font-mono-accent text-xs font-black tracking-wider">A: AUDIO ASLI</span>
                  <span 
                    v-if="player.playbackMode.value === 'A'"
                    class="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" 
                  />
                </div>
                <span class="text-[10px] text-slate-400 font-normal leading-tight">
                  Kondisi mentah sebelum perbaikan DSP
                </span>
              </button>

              <!-- Mode B (Repaired) -->
              <button
                type="button"
                @click="player.setPlaybackMode('B')"
                :aria-pressed="player.playbackMode.value === 'B'"
                class="flex flex-col items-start p-3 rounded-lg border text-left transition-all cursor-pointer relative"
                :class="player.playbackMode.value === 'B'
                  ? 'bg-[#0052FF]/20 border-blue-500/80 text-white shadow-sm ring-1 ring-blue-500/50'
                  : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'">
                <div class="flex items-center justify-between w-full mb-1">
                  <span class="font-mono-accent text-xs font-black tracking-wider text-blue-400">B: HASIL PERBAIKAN</span>
                  <span 
                    v-if="player.playbackMode.value === 'B'"
                    class="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_6px_#60a5fa]" 
                  />
                </div>
                <span class="text-[10px] text-blue-300/80 font-normal leading-tight">
                  Penyelarasan fasa, DC, & headroom
                </span>
              </button>
            </div>
          </div>

          <!-- Mono Check & Master Section -->
          <div class="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/80">
            <!-- Mono Check Button (FR-6.4) -->
            <button
              type="button"
              @click="player.toggleMonoCheck"
              :aria-pressed="player.isMonoCheck.value"
              class="px-3 py-2 rounded-lg border font-mono-accent text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:translate-y-[1px]"
              :class="player.isMonoCheck.value
                ? 'bg-amber-500 text-slate-950 border-amber-400 ring-2 ring-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                : 'bg-slate-800 hover:bg-slate-700/80 text-slate-300 border-slate-700'">
              <span class="w-2 h-2 rounded-full" :class="player.isMonoCheck.value ? 'bg-slate-950' : 'bg-slate-500'" />
              <span>MONO CHECK (L+R)</span>
            </button>

            <!-- Master Volume -->
            <div class="flex-1 flex items-center gap-2 min-w-[140px]">
              <span class="text-[10px] font-mono-accent text-slate-400 uppercase font-semibold">Master:</span>
              <input 
                type="range"
                min="0"
                max="1.5"
                step="0.01"
                :value="player.masterVolume.value"
                @input="player.setMasterVolume(parseFloat($event.target.value))"
                class="flex-1 accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                title="Master Output Volume"
              />
              <span class="text-[10px] font-mono-accent text-slate-300 w-10 text-right">
                {{ Math.round(player.masterVolume.value * 100) }}%
              </span>
            </div>
          </div>
        </div>

        <!-- Column 2 (lg:col-span-4): Transport Playback Controls & Scrubber -->
        <div class="lg:col-span-4 flex flex-col justify-between space-y-3 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80">
          <div class="flex items-center justify-between font-mono-accent">
            <span class="text-xs text-slate-400 uppercase font-semibold">Waktu Pemutaran</span>
            <div class="flex items-center gap-1 text-sm font-bold">
              <span class="text-white">{{ formatTime(player.currentTime.value) }}</span>
              <span class="text-slate-600">/</span>
              <span class="text-slate-400">{{ formatTime(player.duration.value) }}</span>
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
              class="w-full accent-blue-500 h-2 bg-slate-800 rounded-lg cursor-pointer shadow-inner"
            />
          </div>

          <div class="flex items-center justify-center gap-3 pt-1">
            <button 
              @click="player.stop"
              class="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors active:scale-95"
              title="Hentikan & Reset">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1.5" />
              </svg>
            </button>

            <button 
              @click="player.isPlaying.value ? player.pause() : player.play()"
              class="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md transition-all cursor-pointer active:scale-95"
              :class="player.isPlaying.value ? 'bg-amber-600 hover:bg-amber-500' : 'bg-[#0052FF] hover:bg-[#0043D6]'"
              :title="player.isPlaying.value ? 'Jeda (Space)' : 'Putar Semua Trek (Space)'">
              <svg v-if="!player.isPlaying.value" class="w-6 h-6 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <svg v-else class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            </button>

            <!-- Peak Meter L/R -->
            <div class="flex-1 max-w-[130px] space-y-1 pl-2">
              <div class="flex items-center gap-1.5">
                <span class="text-[8px] font-mono-accent text-slate-400 font-bold w-3">L</span>
                <div class="flex-1">
                  <LedPeakMeter :value="player.peakLeft.value" />
                </div>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-[8px] font-mono-accent text-slate-400 font-bold w-3">R</span>
                <div class="flex-1">
                  <LedPeakMeter :value="player.peakRight.value" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Column 3 (lg:col-span-3): Goniometer Lissajous Phase Scope -->
        <div class="lg:col-span-3 flex flex-col items-center justify-center">
          <div class="text-[10px] font-mono-accent text-slate-400 font-semibold mb-1 uppercase tracking-wider">
            Goniometer Fase (Lissajous)
          </div>
          <GoniometerVisualizer 
            :get-data="player.getGoniometerData"
            :is-playing="player.isPlaying.value"
            :size="150"
          />
        </div>

      </div>

      <!-- Multitrack Stem Channel Strips List -->
      <div class="p-4 sm:p-5 space-y-2.5 max-h-[420px] overflow-y-auto">
        <div class="flex items-center justify-between text-xs text-slate-400 font-mono-accent font-semibold px-2 mb-1">
          <span>DAFTAR TREK STEM & PENGATURAN KANAL</span>
          <span>TOTAL {{ player.tracks.value.length }} STEMS</span>
        </div>

        <!-- Stem Row -->
        <div 
          v-for="t in player.tracks.value" 
          :key="t.id"
          class="bg-slate-950/70 border border-slate-800/80 hover:border-slate-700/80 rounded-xl p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition-colors">
          
          <!-- Stem Identity & Explicit Track Filename & Label -->
          <div class="flex items-center gap-3 min-w-[240px]">
            <div class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-mono-accent text-xs font-bold text-slate-300 shrink-0">
              {{ t.isStereo ? 'ST' : 'M' }}
            </div>
            <div class="space-y-0.5 min-w-0">
              <div class="flex items-center gap-2">
                <!-- Explicit Track Filename -->
                <h6 class="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-[280px]" :title="t.name || t.fileName">
                  {{ t.name || t.fileName || 'Trek Audio' }}
                </h6>
                <!-- Detected/Assigned Instrument Label -->
                <span class="text-[9px] font-mono-accent px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                  {{ t.label || t.instrumentLabel || 'Other' }}
                </span>
              </div>
              <div class="text-[10px] text-slate-500 font-mono-accent">
                Durasi: {{ formatTime(t.duration) }}
              </div>
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
            <div class="flex items-center gap-1.5 min-w-[110px]">
              <span class="text-[9px] font-mono-accent text-slate-400 font-semibold">Pan:</span>
              <input 
                type="range"
                min="-1"
                max="1"
                step="0.05"
                :value="t.pan"
                @input="player.setTrackPan(t.id, parseFloat($event.target.value))"
                class="w-16 accent-slate-400 h-1 bg-slate-800 rounded cursor-pointer"
                :title="`Pan: ${t.pan === 0 ? 'Center' : t.pan < 0 ? `L ${Math.round(Math.abs(t.pan)*100)}%` : `R ${Math.round(t.pan*100)}%`}`"
              />
              <span class="text-[9px] font-mono-accent text-slate-400 w-6 text-center">
                {{ t.pan === 0 ? 'C' : t.pan < 0 ? `L${Math.round(Math.abs(t.pan)*100)}` : `R${Math.round(t.pan*100)}` }}
              </span>
            </div>

            <!-- Volume Fader -->
            <div class="flex items-center gap-2 min-w-[130px]">
              <span class="text-[9px] font-mono-accent text-slate-400 font-semibold">Vol:</span>
              <input 
                type="range"
                min="0"
                max="1.5"
                step="0.01"
                :value="t.volume"
                @input="player.setTrackVolume(t.id, parseFloat($event.target.value))"
                class="w-20 accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                title="Stem Channel Volume"
              />
              <span class="text-[10px] font-mono-accent text-slate-300 w-8 text-right">
                {{ Math.round(t.volume * 100) }}%
              </span>
            </div>
          </div>

        </div>
      </div>

      <!-- Studio Sub-Footer Bar with Shortcuts -->
      <div class="px-5 py-2.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between text-[11px] font-mono-accent text-slate-500 gap-2">
        <div class="flex items-center gap-3">
          <span><kbd class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Spasi</kbd> Putar/Jeda</span>
          <span><kbd class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">A</kbd> / <kbd class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">B</kbd> Switch A/B</span>
          <span><kbd class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">M</kbd> Mono Check</span>
        </div>
        <div>
          <span>POLARIS Audio Engine v1.0</span>
        </div>
      </div>

    </div>

  </div>
</template>
