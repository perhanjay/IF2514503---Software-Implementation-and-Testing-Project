<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Upload,
  Play,
  Pause,
  Square,
  Download,
  Scissors,
  ArrowRight,
  Archive,
  Music2,
  Loader2,
  CheckCircle2,
  FileAudio,
  X
} from 'lucide-vue-next'
import { useWorkbenchStore } from '../../stores/workbench'

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024
const ALLOWED_EXT_REGEX = /\.(wav|flac|mp3)$/i

const STEM_DISPLAY_NAMES = {
  vocals: 'Vocals',
  drums: 'Drums',
  bass: 'Bass',
  other: 'Other'
}

const router = useRouter()
const workbenchStore = useWorkbenchStore()

const fileInputRef = ref(null)
const selectedFile = ref(null)
const isDragging = ref(false)
const localError = ref('')
const downloadingStemName = ref(null)

// Synchronized Web Audio Multi-Stem Player state
const isLoadingBuffers = ref(false)
const bufferError = ref('')
const isPlaying = ref(false)
const currentTimeSec = ref(0)
const durationSec = ref(0)
const stemStates = ref({}) // { [stemName]: { muted: boolean, solo: boolean } }

let audioCtx = null
let masterGain = null
let stemBuffers = new Map() // stemName -> AudioBuffer
let activeNodes = new Map() // stemName -> { source: AudioBufferSourceNode, gain: GainNode }
let rafId = null
let playbackStartedAtCtx = 0
let pausedOffsetSec = 0
let loadToken = 0

const hasCompleted = computed(() => workbenchStore.hasCompletedJob)
const isBusy = computed(() => workbenchStore.isUploading || workbenchStore.isJobRunning)
const stems = computed(() => workbenchStore.job?.stems || [])

const progressPercent = computed(() => {
  const val = Number(workbenchStore.job?.progress ?? 0)
  return Math.max(0, Math.min(100, Math.round(val)))
})

const hasAnySolo = computed(() => {
  return Object.values(stemStates.value).some((s) => s?.solo)
})

function formatTimecode(seconds) {
  const safe = Math.max(0, Number(seconds) || 0)
  const mins = Math.floor(safe / 60)
  const secs = Math.floor(safe % 60)
  const tenths = Math.floor((safe % 1) * 10)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`
}

function formatFileSizeMb(bytes) {
  return (Number(bytes || 0) / (1024 * 1024)).toFixed(2)
}

function validateFile(file) {
  if (!file) return 'Pilih berkas audio terlebih dahulu.'
  if (!ALLOWED_EXT_REGEX.test(file.name || '')) {
    return 'Format berkas tidak didukung. Gunakan format .wav, .flac, atau .mp3.'
  }
  if (file.size <= 0) {
    return 'Berkas audio kosong (0 byte).'
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'Ukuran berkas melebihi batas maksimal 100 MB.'
  }
  return ''
}

function assignSelectedFile(file) {
  localError.value = ''
  workbenchStore.clearError()
  const err = validateFile(file)
  if (err) {
    localError.value = err
    selectedFile.value = null
    return
  }
  selectedFile.value = file
}

function handleFileSelect(e) {
  const file = e.target.files?.[0]
  if (file) {
    assignSelectedFile(file)
  }
  if (e.target) {
    e.target.value = ''
  }
}

function handleDrop(e) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) {
    assignSelectedFile(file)
  }
}

function clearSelectedFile() {
  selectedFile.value = null
  localError.value = ''
}

async function handleStartSeparation() {
  if (!selectedFile.value) {
    localError.value = 'Pilih berkas audio (.wav, .flac, atau .mp3) sebelum memulai.'
    return
  }
  const err = validateFile(selectedFile.value)
  if (err) {
    localError.value = err
    return
  }

  localError.value = ''
  stopPlayback()
  try {
    await workbenchStore.startSeparation(selectedFile.value)
  } catch {
    // Store captures and displays error
  }
}

// =========================================================================
// Web Audio API Synchronized Multi-Stem Preview Engine
// =========================================================================

function ensureAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    audioCtx = new AudioContextClass()
    masterGain = audioCtx.createGain()
    masterGain.gain.value = 1.0
    masterGain.connect(audioCtx.destination)
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

function stopRafLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

function disconnectActiveNodes() {
  for (const { source, gain } of activeNodes.values()) {
    try {
      source.onended = null
      source.stop()
    } catch {
      // already stopped
    }
    try {
      source.disconnect()
    } catch {
      // ignore
    }
    try {
      gain.disconnect()
    } catch {
      // ignore
    }
  }
  activeNodes.clear()
}

function stopPlayback(resetPosition = true) {
  disconnectActiveNodes()
  stopRafLoop()
  isPlaying.value = false
  if (resetPosition) {
    pausedOffsetSec = 0
    currentTimeSec.value = 0
  }
}

function disposeAudio() {
  loadToken += 1
  stopPlayback(true)
  stemBuffers.clear()
  if (masterGain) {
    try {
      masterGain.disconnect()
    } catch {
      // ignore
    }
    masterGain = null
  }
  if (audioCtx) {
    try {
      if (audioCtx.state !== 'closed') {
        audioCtx.close()?.catch?.(() => {})
      }
    } catch {
      // ignore
    }
    audioCtx = null
  }
}

function getEffectiveStemGain(stemName) {
  const st = stemStates.value[stemName] || { muted: false, solo: false }
  if (st.muted) return 0.0
  if (hasAnySolo.value && !st.solo) return 0.0
  return 1.0
}

function updateLiveStemGains() {
  if (!audioCtx) return
  const now = audioCtx.currentTime
  for (const [stemName, nodes] of activeNodes.entries()) {
    const target = getEffectiveStemGain(stemName)
    nodes.gain.gain.cancelScheduledValues(now)
    nodes.gain.gain.setTargetAtTime(target, now, 0.01)
  }
}

function startRafLoop() {
  stopRafLoop()
  const tick = () => {
    if (!isPlaying.value || !audioCtx) return
    const elapsed = Math.max(0, audioCtx.currentTime - playbackStartedAtCtx)
    if (durationSec.value > 0 && elapsed >= durationSec.value) {
      stopPlayback(true)
      return
    }
    currentTimeSec.value = Math.min(elapsed, durationSec.value || elapsed)
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

function startNodesAt(offsetSec) {
  const ctx = ensureAudioContext()
  disconnectActiveNodes()

  const now = ctx.currentTime
  const safeOffset = Math.max(0, Math.min(offsetSec, Math.max(0, durationSec.value - 0.01)))

  for (const stem of stems.value) {
    const buf = stemBuffers.get(stem.name)
    if (!buf || safeOffset >= buf.duration) continue

    const source = ctx.createBufferSource()
    source.buffer = buf

    const gain = ctx.createGain()
    const targetGain = getEffectiveStemGain(stem.name)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(targetGain, now + 0.005)

    source.connect(gain)
    gain.connect(masterGain)
    source.start(now, safeOffset)

    activeNodes.set(stem.name, { source, gain })
  }

  playbackStartedAtCtx = now - safeOffset
  pausedOffsetSec = safeOffset
  currentTimeSec.value = safeOffset
  isPlaying.value = true
  startRafLoop()
}

function togglePlayPause() {
  if (isLoadingBuffers.value || stemBuffers.size === 0) return
  if (isPlaying.value) {
    pausedOffsetSec = currentTimeSec.value
    stopPlayback(false)
  } else {
    const startAt = currentTimeSec.value >= durationSec.value ? 0 : currentTimeSec.value
    startNodesAt(startAt)
  }
}

function handleStopClick() {
  stopPlayback(true)
}

function handleSeekInput(e) {
  const next = Number(e.target.value)
  if (!Number.isFinite(next)) return
  const clamped = Math.max(0, Math.min(next, durationSec.value || 0))
  currentTimeSec.value = clamped
  pausedOffsetSec = clamped
  if (isPlaying.value) {
    startNodesAt(clamped)
  }
}

function toggleStemMute(stemName) {
  const current = stemStates.value[stemName] || { muted: false, solo: false }
  stemStates.value = {
    ...stemStates.value,
    [stemName]: { ...current, muted: !current.muted }
  }
  updateLiveStemGains()
}

function toggleStemSolo(stemName) {
  const current = stemStates.value[stemName] || { muted: false, solo: false }
  stemStates.value = {
    ...stemStates.value,
    [stemName]: { ...current, solo: !current.solo }
  }
  updateLiveStemGains()
}

async function loadAllStemBuffers(stemsList) {
  const token = ++loadToken
  stopPlayback(true)
  stemBuffers.clear()
  bufferError.value = ''

  if (!Array.isArray(stemsList) || stemsList.length === 0) {
    durationSec.value = 0
    return
  }

  // Preserve or initialize Solo/Mute states
  const nextStates = {}
  for (const s of stemsList) {
    nextStates[s.name] = stemStates.value[s.name] || { muted: false, solo: false }
  }
  stemStates.value = nextStates

  isLoadingBuffers.value = true
  try {
    const ctx = ensureAudioContext()
    const entries = await Promise.all(
      stemsList.map(async (stem) => {
        if (!stem.audioUrl) return [stem.name, null]
        const res = await fetch(stem.audioUrl, { cache: 'no-store' })
        if (!res.ok) {
          throw new Error(`Gagal memuat stem ${stem.name} (HTTP ${res.status})`)
        }
        const arr = await res.arrayBuffer()
        const decoded = await ctx.decodeAudioData(arr)
        return [stem.name, decoded]
      })
    )

    if (token !== loadToken) return

    let maxDur = 0
    for (const [name, buf] of entries) {
      if (buf) {
        stemBuffers.set(name, buf)
        if (buf.duration > maxDur) maxDur = buf.duration
      }
    }
    if (maxDur === 0) {
      maxDur = Math.max(0, ...stemsList.map((s) => Number(s.durationSec || 0)))
    }
    durationSec.value = maxDur
  } catch (err) {
    if (token !== loadToken) return
    bufferError.value = err.message || 'Gagal memuat pratinjau audio stem.'
  } finally {
    if (token === loadToken) {
      isLoadingBuffers.value = false
    }
  }
}

watch(
  () => [
    workbenchStore.job?.jobId,
    workbenchStore.job?.status,
    (workbenchStore.job?.stems || []).map((s) => `${s.name}:${s.storageKey}:${s.isTrimmed}`).join('|')
  ],
  ([jobId, status]) => {
    if (jobId && status === 'COMPLETED' && stems.value.length > 0) {
      loadAllStemBuffers(stems.value)
    } else if (!jobId) {
      disposeAudio()
    }
  },
  { immediate: true }
)

watch(
  () => workbenchStore.activeTab,
  (tab) => {
    if (tab !== 'separator' && isPlaying.value) {
      pausedOffsetSec = currentTimeSec.value
      stopPlayback(false)
    }
  }
)

function handleOpenInTrimmer(stem) {
  stopPlayback(false)
  workbenchStore.openStemInTrimmer(stem)
}

async function handleDownloadSingleStem(stem) {
  if (!stem?.audioUrl) return
  downloadingStemName.value = stem.name
  const filename = `${stem.isTrimmed ? 'TRIMMED_' : ''}${stem.name}.wav`
  try {
    const res = await fetch(stem.audioUrl, { cache: 'no-store' })
    if (!res.ok) throw new Error('HTTP error')
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  } catch {
    const link = document.createElement('a')
    link.href = stem.audioUrl
    link.download = filename
    link.target = '_blank'
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    downloadingStemName.value = null
  }
}

async function handleDownloadZip() {
  stopPlayback(false)
  try {
    await workbenchStore.downloadZip()
  } catch {
    // Store displays error
  }
}

async function handleSendToStudio() {
  stopPlayback(false)
  try {
    await workbenchStore.sendToStudio()
    router.push('/dashboard')
  } catch {
    // Store displays error
  }
}

onUnmounted(() => {
  disposeAudio()
})

defineExpose({
  stopPlayback: () => stopPlayback(false)
})
</script>

<template>
  <div class="space-y-5">
    <!-- Upload Dropzone Card -->
    <section class="retro-glass-card p-5 sm:p-6 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 class="font-editorial font-bold text-lg sm:text-xl text-[#111111] tracking-tight">
            Pemisah Stem Audio AI
          </h2>
          <p class="text-xs sm:text-sm text-[#60605e] mt-0.5">
            Unggah lagu campuran (stereo mixdown) untuk dipisahkan otomatis menjadi 4 stem terpisah: Vocals, Drums, Bass, dan Other.
          </p>
        </div>
        <span class="self-start sm:self-center px-3 py-1 rounded-full bg-white border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] text-[11px] font-bold text-[#111111] font-telemetry tabular-nums shrink-0">
          WAV &middot; FLAC &middot; MP3 &le; 100 MB
        </span>
      </div>

      <!-- Dropzone -->
      <div
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
        :class="isDragging ? 'border-[#20afff] bg-[#20afff]/12' : 'border-[#111111]/30 bg-white/80 hover:border-[#111111]/55'"
        class="relative border-2 border-dashed rounded-[16px] p-6 sm:p-8 text-center transition-colors cursor-pointer"
      >
        <input
          ref="fileInputRef"
          type="file"
          accept=".wav,.flac,.mp3,audio/wav,audio/flac,audio/mpeg"
          :disabled="isBusy"
          @change="handleFileSelect"
          class="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
          aria-label="Pilih berkas audio untuk pemisahan stem"
        />

        <div class="w-12 h-12 rounded-[14px] bg-[#18181b] text-[#20afff] border-2 border-[#111111] shadow-[2px_3px_0_#111111] flex items-center justify-center mx-auto mb-3">
          <Upload class="w-5 h-5" :stroke-width="2" />
        </div>

        <p class="text-sm font-bold text-[#111111]">
          Tarik &amp; jatuhkan berkas audio ke sini, atau <span class="underline decoration-[#20afff] decoration-2 underline-offset-4">pilih dari perangkat</span>
        </p>
        <p class="text-xs text-[#60605e] mt-1">
          Mendukung berkas stereo 16/24/32-bit hingga <span class="font-telemetry font-semibold text-[#111111]">100 MB</span>
        </p>
      </div>

      <!-- Selected File Telemetry Strip & Trigger CTA -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          v-if="selectedFile"
          class="retro-telemetry-plate px-3.5 py-2.5 flex items-center justify-between gap-3 flex-1 min-w-0"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <FileAudio class="w-4 h-4 text-[#20afff] shrink-0" :stroke-width="2" />
            <span class="text-xs font-bold text-[#111111] truncate">{{ selectedFile.name }}</span>
            <span class="font-telemetry text-[11px] text-[#60605e] shrink-0">
              {{ formatFileSizeMb(selectedFile.size) }} MB
            </span>
          </div>
          <button
            type="button"
            :disabled="isBusy"
            @click="clearSelectedFile"
            class="p-1 text-[#60605e] hover:text-[#111111] rounded-[6px] cursor-pointer disabled:opacity-50"
            aria-label="Hapus pilihan berkas"
          >
            <X class="w-3.5 h-3.5" :stroke-width="2.2" />
          </button>
        </div>
        <div v-else class="text-xs text-[#60605e]">
          Belum ada berkas audio dipilih.
        </div>

        <button
          type="button"
          @click="handleStartSeparation"
          :disabled="!selectedFile || isBusy"
          class="btn-keycap btn-keycap-blue px-5 py-2.5 text-xs shrink-0"
        >
          <Loader2 v-if="isBusy" class="w-4 h-4 animate-spin" :stroke-width="2.2" />
          <Music2 v-else class="w-4 h-4" :stroke-width="2.2" />
          <span>{{ workbenchStore.isUploading ? 'Mengunggah Audio...' : workbenchStore.isJobRunning ? 'Memisahkan Stem...' : 'Mulai Pemisahan Stem' }}</span>
        </button>
      </div>

      <!-- Local Validation Error -->
      <div
        v-if="localError"
        role="alert"
        class="retro-telemetry-plate border-rose-400 bg-rose-50/95 text-rose-900 px-3.5 py-2.5 text-xs font-medium"
      >
        {{ localError }}
      </div>
    </section>

    <!-- Active Queue / Processing Hardware Monitor -->
    <section
      v-if="workbenchStore.isJobRunning"
      class="retro-monitor p-5 sm:p-6 space-y-4 animate-fade-in"
      aria-live="polite"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-[10px] bg-[#20afff]/15 border border-[#20afff]/40 text-[#20afff] flex items-center justify-center shrink-0">
            <Loader2 class="w-5 h-5 animate-spin" :stroke-width="2.2" />
          </div>
          <div class="min-w-0">
            <p class="text-xs font-bold text-white truncate">
              {{ workbenchStore.job?.fileName || 'Berkas Audio' }}
            </p>
            <p class="text-[11px] text-[#a1a1aa] mt-0.5">
              {{ workbenchStore.job?.stepMessage || 'Memproses pemisahan stem...' }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2.5 shrink-0">
          <span class="px-2.5 py-1 rounded-full bg-[#27272a] border border-white/15 text-[11px] font-bold text-[#ffda40]">
            {{ workbenchStore.job?.status === 'QUEUED' ? 'Dalam Antrean' : 'Sedang Diproses' }}
          </span>
          <span class="font-telemetry text-sm font-bold text-[#20afff] tabular-nums">
            {{ progressPercent }}%
          </span>
        </div>
      </div>

      <div class="w-full h-2.5 bg-[#27272a] rounded-full overflow-hidden border border-white/10">
        <div
          class="h-full bg-[#20afff] transition-all duration-300 rounded-full"
          :style="{ width: `${progressPercent}%` }"
        ></div>
      </div>
    </section>

    <!-- Completed Stems Results & Multi-Stem Preview -->
    <section v-if="hasCompleted" class="space-y-4 animate-fade-in">
      <!-- Synchronized Multi-Stem Preview Transport Monitor -->
      <div class="retro-monitor p-4 sm:p-5 space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 class="w-4 h-4 text-[#5ad363] shrink-0" :stroke-width="2.2" />
            <span class="text-xs sm:text-sm font-bold text-white truncate">
              Pratinjau Sinkron 4 Stem &mdash; {{ workbenchStore.job?.fileName }}
            </span>
          </div>

          <div class="flex items-center gap-2 font-telemetry text-xs text-[#ffda40] tabular-nums shrink-0">
            <span>{{ formatTimecode(currentTimeSec) }}</span>
            <span class="text-[#a1a1aa]">/</span>
            <span class="text-[#a1a1aa]">{{ formatTimecode(durationSec) }}</span>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              @click="togglePlayPause"
              :disabled="isLoadingBuffers || Boolean(bufferError)"
              class="btn-keycap btn-keycap-sm btn-keycap-blue px-4 py-2 text-xs"
            >
              <Loader2 v-if="isLoadingBuffers" class="w-3.5 h-3.5 animate-spin" :stroke-width="2.2" />
              <Pause v-else-if="isPlaying" class="w-3.5 h-3.5" :stroke-width="2.2" />
              <Play v-else class="w-3.5 h-3.5" :stroke-width="2.2" />
              <span>{{ isLoadingBuffers ? 'Memuat...' : isPlaying ? 'Jeda' : 'Putar Semua' }}</span>
            </button>

            <button
              type="button"
              @click="handleStopClick"
              :disabled="isLoadingBuffers"
              class="btn-keycap btn-keycap-sm btn-keycap-white px-3 py-2 text-xs"
              aria-label="Hentikan pemutaran"
            >
              <Square class="w-3.5 h-3.5" :stroke-width="2.2" />
            </button>
          </div>

          <input
            type="range"
            min="0"
            :max="durationSec || 1"
            step="0.05"
            :value="currentTimeSec"
            :disabled="isLoadingBuffers || durationSec <= 0"
            @input="handleSeekInput"
            aria-label="Scrubber waktu pratinjau multitrack"
            class="flex-1"
          />
        </div>

        <div v-if="bufferError" class="text-xs text-rose-300 flex items-center justify-between gap-2 pt-1">
          <span>{{ bufferError }}</span>
          <button
            type="button"
            @click="loadAllStemBuffers(stems)"
            class="underline text-[#20afff] cursor-pointer shrink-0"
          >
            Muat Ulang
          </button>
        </div>
      </div>

      <!-- 4 Stem Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <article
          v-for="stem in stems"
          :key="stem.name"
          class="retro-glass-card p-4 sm:p-5 flex flex-col justify-between gap-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="font-editorial font-bold text-base sm:text-lg text-[#111111]">
                  {{ STEM_DISPLAY_NAMES[stem.name] || stem.name }}
                </h3>
                <span
                  v-if="stem.isTrimmed"
                  class="px-2.5 py-0.5 rounded-full bg-[#5ad363] text-[#111111] border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] text-[10px] font-bold leading-tight"
                >
                  Tersinkron (Trimmed)
                </span>
              </div>
              <p class="text-xs text-[#60605e] truncate">
                {{ stem.label || STEM_DISPLAY_NAMES[stem.name] || stem.name }}
              </p>
            </div>

            <div class="retro-telemetry-plate px-2.5 py-1 text-[11px] font-telemetry font-semibold shrink-0">
              {{ Number(stem.durationSec || 0).toFixed(2) }} dtk
            </div>
          </div>

          <!-- Stem Solo / Mute & Action Controls -->
          <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#111111]/10">
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                @click="toggleStemSolo(stem.name)"
                :aria-pressed="Boolean(stemStates[stem.name]?.solo)"
                :class="stemStates[stem.name]?.solo ? 'btn-keycap-yellow' : 'btn-keycap-white'"
                class="btn-keycap btn-keycap-mini px-2.5 py-1 text-[11px]"
                title="Solo stem ini"
              >
                Solo
              </button>
              <button
                type="button"
                @click="toggleStemMute(stem.name)"
                :aria-pressed="Boolean(stemStates[stem.name]?.muted)"
                :class="stemStates[stem.name]?.muted ? 'btn-keycap-pink' : 'btn-keycap-white'"
                class="btn-keycap btn-keycap-mini px-2.5 py-1 text-[11px]"
                title="Bisukan stem ini"
              >
                Mute
              </button>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                @click="handleOpenInTrimmer(stem)"
                class="btn-keycap btn-keycap-mini btn-keycap-white px-3 py-1.5 text-xs"
              >
                <Scissors class="w-3.5 h-3.5" :stroke-width="2" />
                <span>Buka di Trimmer</span>
              </button>

              <button
                type="button"
                @click="handleDownloadSingleStem(stem)"
                :disabled="downloadingStemName === stem.name"
                class="btn-keycap btn-keycap-mini btn-keycap-white px-3 py-1.5 text-xs"
              >
                <Download class="w-3.5 h-3.5" :stroke-width="2" />
                <span>{{ downloadingStemName === stem.name ? 'Mengunduh...' : 'Unduh WAV' }}</span>
              </button>
            </div>
          </div>
        </article>
      </div>

      <!-- Footer Action Bar -->
      <footer class="retro-glass-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p class="text-xs text-[#60605e] leading-relaxed">
          Kirim keempat stem langsung ke <strong class="font-bold text-[#111111]">Studio Workspace</strong> untuk audit fasa &amp; perbaikan DSP otomatis, atau unduh seluruh stem dalam satu arsip ZIP.
        </p>

        <div class="flex flex-wrap items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            @click="handleDownloadZip"
            :disabled="workbenchStore.isDownloadingZip || workbenchStore.isSendingToStudio"
            class="btn-keycap btn-keycap-white px-4 py-2.5 text-xs"
          >
            <Loader2 v-if="workbenchStore.isDownloadingZip" class="w-4 h-4 animate-spin" :stroke-width="2" />
            <Archive v-else class="w-4 h-4" :stroke-width="2" />
            <span>{{ workbenchStore.isDownloadingZip ? 'Mengemas ZIP...' : 'Unduh Semua Stem (ZIP)' }}</span>
          </button>

          <button
            type="button"
            @click="handleSendToStudio"
            :disabled="workbenchStore.isSendingToStudio || workbenchStore.isDownloadingZip"
            class="btn-keycap btn-keycap-blue px-5 py-2.5 text-xs"
          >
            <Loader2 v-if="workbenchStore.isSendingToStudio" class="w-4 h-4 animate-spin" :stroke-width="2.2" />
            <span>{{ workbenchStore.isSendingToStudio ? 'Mengirim ke Studio...' : 'Kirim ke Studio Workspace' }}</span>
            <ArrowRight v-if="!workbenchStore.isSendingToStudio" class="w-4 h-4" :stroke-width="2.2" />
          </button>
        </div>
      </footer>
    </section>
  </div>
</template>
