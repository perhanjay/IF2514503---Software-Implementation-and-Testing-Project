<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import {
  Upload,
  Play,
  Pause,
  Square,
  RotateCcw,
  Scissors,
  Download,
  FileAudio,
  Loader2,
  Check
} from 'lucide-vue-next'
import WaveformTrimmerCanvas from '../audio/WaveformTrimmerCanvas.vue'
import RetroSelect from '../ui/RetroSelect.vue'
import { useWorkbenchStore, WORKBENCH_EXPORT_FORMATS } from '../../stores/workbench'

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024
const ALLOWED_EXT_REGEX = /\.(wav|flac|mp3)$/i
const PEAK_BIN_COUNT = 200
const FADE_OPTIONS_MS = [5, 15, 30]

const STEM_DISPLAY_NAMES = {
  vocals: 'Vocals',
  drums: 'Drums',
  bass: 'Bass',
  other: 'Other'
}

const workbenchStore = useWorkbenchStore()

const isDragging = ref(false)
const localError = ref('')
const isDecodingRaw = ref(false)
const isDecodingTrimmed = ref(false)
const decodeError = ref('')
const isDownloadingWav = ref(false)

// Trimmer parameters
const thresholdDb = ref(-45)
const padMs = ref(100)
const fadeMs = ref(15)
const manualStartSec = ref(null)
const manualEndSec = ref(null)
const syncAllStems = ref(true)

// Waveform & A/B Playback state
const rawPeaks = ref([])
const rawDurationSec = ref(0)
const abMode = ref('raw') // 'raw' | 'trimmed'
const isPlaying = ref(false)
const currentTimeSec = ref(0)

// Web Audio API resources
let audioCtx = null
let activeSource = null
let activeGain = null
let rawBuffer = null
let trimmedBuffer = null
let rafId = null
let playbackStartedAtCtx = 0
let sourceLoadToken = 0
let trimmedLoadToken = 0

const hasSource = computed(() => workbenchStore.hasTrimmerSource)
const hasJobSource = computed(() => Boolean(workbenchStore.trimmerSource.jobId))
const hasTrimResult = computed(() => Boolean(workbenchStore.trimResult))
const isTrimmedView = computed(() => abMode.value === 'trimmed' && hasTrimResult.value)

const availableJobStems = computed(() => {
  if (!workbenchStore.hasCompletedJob) return []
  return workbenchStore.job?.stems || []
})

const activePeaks = computed(() => {
  if (isTrimmedView.value) {
    return workbenchStore.trimResult?.trimmedPeaks || []
  }
  return rawPeaks.value
})

const activeDurationSec = computed(() => {
  if (isTrimmedView.value) {
    return Number(workbenchStore.trimResult?.trimmedDurationSec || trimmedBuffer?.duration || 0)
  }
  return Number(rawDurationSec.value || workbenchStore.trimmerSource.rawDurationSec || 0)
})

const canPlayActiveMode = computed(() => {
  if (isTrimmedView.value) {
    return Boolean(trimmedBuffer) && !isDecodingTrimmed.value
  }
  return Boolean(rawBuffer) && !isDecodingRaw.value
})

const totalSilenceRemovedSec = computed(() => {
  if (!workbenchStore.trimResult) return 0
  const lead = Number(workbenchStore.trimResult.leadInRemovedSec || 0)
  const tail = Number(workbenchStore.trimResult.tailRemovedSec || 0)
  return Math.max(0, lead + tail)
})

const hasManualBounds = computed(() => {
  return manualStartSec.value !== null || manualEndSec.value !== null
})

function formatTimecode(seconds) {
  const safe = Math.max(0, Number(seconds) || 0)
  const mins = Math.floor(safe / 60)
  const secs = Math.floor(safe % 60)
  const tenths = Math.floor((safe % 1) * 10)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`
}

function formatDurationSeconds(seconds) {
  const safe = Math.max(0, Number(seconds) || 0)
  return `${safe.toFixed(2)} dtk`
}

function extractPeaks(audioBuffer, binCount = PEAK_BIN_COUNT) {
  if (!audioBuffer || audioBuffer.length === 0) return []
  const channels = audioBuffer.numberOfChannels
  const totalSamples = audioBuffer.length
  const samplesPerBin = Math.max(1, Math.floor(totalSamples / binCount))
  const channelData = []
  for (let c = 0; c < channels; c++) {
    channelData.push(audioBuffer.getChannelData(c))
  }

  const peaks = new Array(binCount).fill(0)
  for (let i = 0; i < binCount; i++) {
    const start = i * samplesPerBin
    const end = i === binCount - 1 ? totalSamples : Math.min(totalSamples, start + samplesPerBin)
    let maxVal = 0
    // Sample stride keeps decoding snappy even on long 48kHz stereo files
    const stride = Math.max(1, Math.floor((end - start) / 512))
    for (let s = start; s < end; s += stride) {
      for (let c = 0; c < channels; c++) {
        const v = Math.abs(channelData[c][s])
        if (v > maxVal) maxVal = v
      }
    }
    peaks[i] = Math.min(1, maxVal)
  }
  return peaks
}

// =========================================================================
// Web Audio Lifecycle Management
// =========================================================================

function ensureAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    audioCtx = new AudioContextClass()
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

function stopActiveSource(fadeOutSec = 0) {
  stopRafLoop()
  if (activeSource) {
    const srcToStop = activeSource
    const gainToStop = activeGain
    activeSource = null
    activeGain = null

    if (fadeOutSec > 0 && audioCtx && gainToStop) {
      try {
        const now = audioCtx.currentTime
        gainToStop.gain.cancelScheduledValues(now)
        gainToStop.gain.setValueAtTime(gainToStop.gain.value, now)
        gainToStop.gain.linearRampToValueAtTime(0, now + fadeOutSec)
        srcToStop.stop(now + fadeOutSec + 0.002)
      } catch {
        try {
          srcToStop.stop()
        } catch {
          // ignore
        }
      }
      setTimeout(() => {
        try {
          srcToStop.disconnect()
        } catch {
          // ignore
        }
        try {
          gainToStop.disconnect()
        } catch {
          // ignore
        }
      }, Math.ceil((fadeOutSec + 0.02) * 1000))
    } else {
      try {
        srcToStop.onended = null
        srcToStop.stop()
      } catch {
        // ignore
      }
      try {
        srcToStop.disconnect()
      } catch {
        // ignore
      }
      if (gainToStop) {
        try {
          gainToStop.disconnect()
        } catch {
          // ignore
        }
      }
    }
  }
}

function stopPlayback(resetPosition = false) {
  stopActiveSource(0)
  isPlaying.value = false
  if (resetPosition) {
    currentTimeSec.value = 0
  }
}

function disposeAudio() {
  sourceLoadToken += 1
  trimmedLoadToken += 1
  stopPlayback(true)
  rawBuffer = null
  trimmedBuffer = null
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

function getActiveBuffer() {
  return isTrimmedView.value ? trimmedBuffer : rawBuffer
}

function startRafLoop(bufferDuration) {
  stopRafLoop()
  const tick = () => {
    if (!isPlaying.value || !audioCtx) return
    const elapsed = Math.max(0, audioCtx.currentTime - playbackStartedAtCtx)
    if (bufferDuration > 0 && elapsed >= bufferDuration) {
      stopPlayback(true)
      return
    }
    currentTimeSec.value = Math.min(elapsed, bufferDuration || elapsed)
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

function startBufferAt(buffer, offsetSec, fadeInSec = 0.005) {
  if (!buffer) return
  const ctx = ensureAudioContext()
  stopActiveSource(fadeInSec)

  const dur = buffer.duration || 0
  const safeOffset = Math.max(0, Math.min(offsetSec, Math.max(0, dur - 0.01)))
  const now = ctx.currentTime

  const source = ctx.createBufferSource()
  source.buffer = buffer

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(1.0, now + fadeInSec)

  source.connect(gain)
  gain.connect(ctx.destination)
  source.start(now, safeOffset)

  activeSource = source
  activeGain = gain
  playbackStartedAtCtx = now - safeOffset
  currentTimeSec.value = safeOffset
  isPlaying.value = true
  startRafLoop(dur)
}

function togglePlayPause() {
  const buf = getActiveBuffer()
  if (!buf) return
  if (isPlaying.value) {
    stopPlayback(false)
  } else {
    const startAt = currentTimeSec.value >= (buf.duration || 0) ? 0 : currentTimeSec.value
    startBufferAt(buf, startAt, 0.005)
  }
}

function handleStopClick() {
  stopPlayback(true)
}

function handleSeek(targetSec) {
  const dur = activeDurationSec.value
  const clamped = Math.max(0, Math.min(Number(targetSec) || 0, dur))
  currentTimeSec.value = clamped
  if (isPlaying.value) {
    const buf = getActiveBuffer()
    if (buf) {
      startBufferAt(buf, clamped, 0.005)
    }
  }
}

function switchAbMode(nextMode) {
  if (nextMode === abMode.value) return
  if (nextMode === 'trimmed' && (!hasTrimResult.value || !trimmedBuffer)) return
  if (nextMode === 'raw' && !rawBuffer) return

  const wasPlaying = isPlaying.value
  const prevTime = currentTimeSec.value
  const leadIn = Number(workbenchStore.trimResult?.leadInRemovedSec || 0)

  // Map timecode across raw <-> trimmed timelines so A/B stays aligned on audio content
  let mappedTime = prevTime
  if (abMode.value === 'raw' && nextMode === 'trimmed') {
    mappedTime = Math.max(0, prevTime - leadIn)
  } else if (abMode.value === 'trimmed' && nextMode === 'raw') {
    mappedTime = prevTime + leadIn
  }

  abMode.value = nextMode
  const nextBuf = getActiveBuffer()
  const nextDur = nextBuf?.duration || activeDurationSec.value || 0
  const clampedTime = Math.max(0, Math.min(mappedTime, Math.max(0, nextDur - 0.01)))
  currentTimeSec.value = clampedTime

  if (wasPlaying && nextBuf) {
    startBufferAt(nextBuf, clampedTime, 0.008)
  }
}

// =========================================================================
// Audio Source Decoding
// =========================================================================

async function loadRawSourceBuffer() {
  const token = ++sourceLoadToken
  stopPlayback(true)
  rawBuffer = null
  trimmedBuffer = null
  rawPeaks.value = []
  rawDurationSec.value = Number(workbenchStore.trimmerSource.rawDurationSec || 0)
  abMode.value = 'raw'
  manualStartSec.value = null
  manualEndSec.value = null
  decodeError.value = ''

  if (workbenchStore.trimmerSource.jobId) {
    syncAllStems.value = true
  }

  const file = workbenchStore.trimmerSource.file
  const rawUrl = workbenchStore.trimmerSource.rawUrl
  if (!file && !rawUrl) {
    return
  }

  isDecodingRaw.value = true
  try {
    const ctx = ensureAudioContext()
    let arrayBuffer
    if (file) {
      arrayBuffer = await file.arrayBuffer()
    } else {
      const res = await fetch(rawUrl, { cache: 'no-store' })
      if (!res.ok) {
        throw new Error(`Gagal mengambil audio sumber (HTTP ${res.status})`)
      }
      arrayBuffer = await res.arrayBuffer()
    }

    const decoded = await ctx.decodeAudioData(arrayBuffer)
    if (token !== sourceLoadToken) return

    rawBuffer = decoded
    rawDurationSec.value = decoded.duration
    rawPeaks.value = extractPeaks(decoded, PEAK_BIN_COUNT)
    workbenchStore.setTrimmerDuration(decoded.duration)
  } catch (err) {
    if (token !== sourceLoadToken) return
    decodeError.value = err.message || 'Gagal mendekode berkas audio untuk pratinjau gelombang.'
  } finally {
    if (token === sourceLoadToken) {
      isDecodingRaw.value = false
    }
  }
}

async function loadTrimmedAudioBuffer(audioUrl) {
  const token = ++trimmedLoadToken
  trimmedBuffer = null
  if (!audioUrl) return

  isDecodingTrimmed.value = true
  try {
    const ctx = ensureAudioContext()
    const res = await fetch(audioUrl, { cache: 'no-store' })
    if (!res.ok) {
      throw new Error(`Gagal memuat audio hasil pangkas (HTTP ${res.status})`)
    }
    const arrayBuffer = await res.arrayBuffer()
    const decoded = await ctx.decodeAudioData(arrayBuffer)
    if (token !== trimmedLoadToken) return
    trimmedBuffer = decoded
  } catch (err) {
    if (token !== trimmedLoadToken) return
    decodeError.value = err.message || 'Gagal memuat pratinjau audio hasil pemangkasan.'
  } finally {
    if (token === trimmedLoadToken) {
      isDecodingTrimmed.value = false
    }
  }
}

watch(
  () => [
    workbenchStore.trimmerSource.file,
    workbenchStore.trimmerSource.rawUrl,
    workbenchStore.trimmerSource.jobId,
    workbenchStore.trimmerSource.stemName
  ],
  () => {
    loadRawSourceBuffer()
  },
  { immediate: true }
)

watch(
  () => workbenchStore.activeTab,
  (tab) => {
    if (tab !== 'trimmer' && isPlaying.value) {
      stopPlayback(false)
    }
  }
)

// =========================================================================
// File Selection & Trim Execution
// =========================================================================

function validateLocalFile(file) {
  if (!file) return 'Pilih berkas audio terlebih dahulu.'
  if (!ALLOWED_EXT_REGEX.test(file.name || '')) {
    return 'Format berkas tidak didukung. Gunakan .wav, .flac, atau .mp3.'
  }
  if (file.size <= 0) {
    return 'Berkas audio kosong (0 byte).'
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'Ukuran berkas melebihi batas maksimal 100 MB.'
  }
  return ''
}

function handleLocalFileAssign(file) {
  localError.value = ''
  const err = validateLocalFile(file)
  if (err) {
    localError.value = err
    return
  }
  stopPlayback(true)
  workbenchStore.loadLocalFileInTrimmer(file)
}

function handleFileInputChange(e) {
  const file = e.target.files?.[0]
  if (file) {
    handleLocalFileAssign(file)
  }
  if (e.target) {
    e.target.value = ''
  }
}

function handleDrop(e) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) {
    handleLocalFileAssign(file)
  }
}

function resetManualHandles() {
  manualStartSec.value = null
  manualEndSec.value = null
}

async function handleExecuteTrim() {
  if (!hasSource.value) return
  localError.value = ''
  decodeError.value = ''
  stopPlayback(true)

  try {
    const result = await workbenchStore.executeTrim({
      thresholdDb: thresholdDb.value,
      padMs: padMs.value,
      fadeMs: fadeMs.value,
      manualStartSec: manualStartSec.value,
      manualEndSec: manualEndSec.value,
      syncAllStems: hasJobSource.value ? syncAllStems.value : false
    })

    if (result?.audioUrl) {
      await loadTrimmedAudioBuffer(result.audioUrl)
      abMode.value = 'trimmed'
      currentTimeSec.value = 0
    }
  } catch {
    // Store error banner displays backend error message
  }
}

async function handleDownloadTrimmedWav() {
  if (!workbenchStore.trimResult?.storageKey) return
  isDownloadingWav.value = true
  try {
    await workbenchStore.downloadTrimmedExport(workbenchStore.downloadFormat)
  } catch {
    // Store error banner displays error
  } finally {
    isDownloadingWav.value = false
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
    <!-- Source Selector Bar + Local Dropzone -->
    <section class="rounded-[14px] border-[1.5px] border-[#111111] bg-white/96 shadow-[2px_3px_0_#111111] p-5 sm:p-6 space-y-4">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <h2 class="font-editorial font-bold text-lg sm:text-xl text-[#111111] tracking-tight">
          Pemangkas Hening Pintar &amp; De-Clicker
        </h2>

        <!-- Quick Stem Switcher when Tab 1 stems are available -->
        <div v-if="availableJobStems.length > 0" class="flex flex-wrap items-center gap-1.5 shrink-0">
          <span class="text-[11px] font-bold text-[#60605e] mr-1">Stem Tab 01:</span>
          <button
            v-for="stem in availableJobStems"
            :key="stem.name"
            type="button"
            @click="workbenchStore.openStemInTrimmer(stem)"
            :class="workbenchStore.trimmerSource.jobId === workbenchStore.job?.jobId && workbenchStore.trimmerSource.stemName === stem.name ? 'btn-keycap-blue' : 'btn-keycap-white'"
            class="btn-keycap btn-keycap-mini px-2.5 py-1 text-[11px]"
          >
            {{ STEM_DISPLAY_NAMES[stem.name] || stem.name }}
          </button>
        </div>
      </div>

      <!-- Active Source Banner OR Standalone File Dropzone -->
      <div
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
        :class="isDragging ? 'border-[#20afff] bg-[#20afff]/12' : 'border-[#111111]/25 bg-white/85'"
        class="relative border-2 border-dashed rounded-[14px] p-4 sm:p-5 transition-colors"
      >
        <div v-if="hasSource" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-[12px] bg-[#fff099] text-[#111111] border-[1.5px] border-[#111111] shadow-[1.5px_2px_0_#111111] flex items-center justify-center shrink-0">
              <FileAudio class="w-5 h-5" :stroke-width="2" />
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-xs sm:text-sm font-bold text-[#111111] truncate">
                  {{ workbenchStore.trimmerSource.fileName }}
                </span>
                <span class="px-2 py-0.5 rounded-full bg-white border border-[#111111] text-[10px] font-bold text-[#111111]">
                  {{ hasJobSource ? 'Stem Pemisahan AI' : 'Berkas Lokal Mandiri' }}
                </span>
              </div>
              <p class="text-[11px] text-[#60605e] mt-0.5 font-telemetry tabular-nums">
                {{ isDecodingRaw ? 'Mendekode sinyal gelombang...' : `Durasi sumber: ${formatDurationSeconds(rawDurationSec)}` }}
              </p>
            </div>
          </div>

          <label class="btn-keycap btn-keycap-sm btn-keycap-white px-3.5 py-2 text-xs shrink-0 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#111111] has-[:focus-visible]:outline-offset-2">
            <Upload class="w-3.5 h-3.5" :stroke-width="2" />
            <span>Ganti Berkas Lokal</span>
            <input
              type="file"
              accept=".wav,.flac,.mp3,audio/wav,audio/flac,audio/mpeg"
              @change="handleFileInputChange"
              class="sr-only"
            />
          </label>
        </div>

        <label v-else class="flex flex-col items-center justify-center text-center py-5 cursor-pointer rounded-[10px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#111111] has-[:focus-visible]:outline-offset-2">
          <input
            type="file"
            accept=".wav,.flac,.mp3,audio/wav,audio/flac,audio/mpeg"
            @change="handleFileInputChange"
            class="sr-only"
          />
          <div class="w-11 h-11 rounded-[12px] bg-[#ffda40] text-[#111111] border-[1.5px] border-[#111111] shadow-[2px_3px_0_#111111] flex items-center justify-center mb-2.5">
            <Upload class="w-5 h-5" :stroke-width="2" />
          </div>
          <p class="text-sm font-bold text-[#111111]">
            Tarik &amp; jatuhkan berkas audio ke sini, atau <span class="underline decoration-[#20afff] decoration-2 underline-offset-4">pilih berkas mandiri</span>
          </p>
          <p class="text-xs text-[#60605e] mt-1">
            Mendukung .wav, .flac, .mp3 (&le; 100 MB) atau pilih stem dari Tab 01.
          </p>
        </label>
      </div>

      <div
        v-if="localError || decodeError"
        role="alert"
        class="retro-telemetry-plate border-rose-400 bg-rose-50/95 text-rose-900 px-3.5 py-2.5 text-xs font-medium"
      >
        {{ localError || decodeError }}
      </div>
    </section>

    <!-- Waveform Monitor + Controls + A/B Auditioning -->
    <template v-if="hasSource">
      <!-- Embedded HiDPI Waveform Canvas inside light v2 monitor card -->
      <WaveformTrimmerCanvas
        :peaks="activePeaks"
        :duration-sec="activeDurationSec"
        :threshold-db="thresholdDb"
        :pad-ms="padMs"
        :manual-start-sec="manualStartSec"
        :manual-end-sec="manualEndSec"
        :current-time-sec="currentTimeSec"
        :is-playing="isPlaying"
        :is-trimmed-preview="isTrimmedView"
        @seek="handleSeek"
        @update:manual-start-sec="manualStartSec = $event"
        @update:manual-end-sec="manualEndSec = $event"
      />

      <!-- Transport & A/B Auditioning Bar -->
      <section class="rounded-[14px] border-[1.5px] border-[#111111] bg-white/96 shadow-[2px_3px_0_#111111] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            @click="togglePlayPause"
            :disabled="!canPlayActiveMode"
            class="btn-keycap btn-keycap-sm btn-keycap-blue px-4 py-2 text-xs"
          >
            <Loader2 v-if="isDecodingRaw || isDecodingTrimmed" class="w-3.5 h-3.5 animate-spin" :stroke-width="2.2" />
            <Pause v-else-if="isPlaying" class="w-3.5 h-3.5" :stroke-width="2.2" />
            <Play v-else class="w-3.5 h-3.5" :stroke-width="2.2" />
            <span>{{ isPlaying ? 'Jeda' : 'Putar Pratinjau' }}</span>
          </button>

          <button
            type="button"
            @click="handleStopClick"
            :disabled="!canPlayActiveMode"
            class="btn-keycap btn-keycap-sm btn-keycap-white px-3 py-2 text-xs"
            aria-label="Hentikan pratinjau"
          >
            <Square class="w-3.5 h-3.5" :stroke-width="2.2" />
          </button>

          <div class="retro-telemetry-plate px-3 py-1.5 text-xs font-telemetry tabular-nums">
            {{ formatTimecode(currentTimeSec) }} / {{ formatTimecode(activeDurationSec) }}
          </div>
        </div>

        <!-- A/B Switcher: Asli (Raw) vs Dipangkas (Trimmed) -->
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-bold text-[#60605e] mr-1">Audisi A/B:</span>
          <button
            type="button"
            @click="switchAbMode('raw')"
            :disabled="!rawBuffer || isDecodingRaw"
            :aria-pressed="abMode === 'raw'"
            :class="abMode === 'raw' ? 'btn-keycap-yellow' : 'btn-keycap-white'"
            class="btn-keycap btn-keycap-sm px-3.5 py-2 text-xs"
          >
            Asli (Raw)
          </button>
          <button
            type="button"
            @click="switchAbMode('trimmed')"
            :disabled="!hasTrimResult || !trimmedBuffer || isDecodingTrimmed"
            :aria-pressed="abMode === 'trimmed'"
            :class="abMode === 'trimmed' ? 'btn-keycap-green' : 'btn-keycap-white'"
            class="btn-keycap btn-keycap-sm px-3.5 py-2 text-xs"
          >
            Dipangkas (Trimmed)
          </button>
        </div>
      </section>

      <!-- Trimmer Parameter Controls -->
      <section class="rounded-[14px] border-[1.5px] border-[#111111] bg-white/96 shadow-[2px_3px_0_#111111] p-5 sm:p-6 space-y-5">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
          <!-- Silence Threshold Slider -->
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <label for="trimmer-threshold" class="text-xs font-bold text-[#111111]">
                Silence Threshold
              </label>
              <span class="retro-telemetry-plate px-2 py-0.5 text-[11px] font-telemetry font-bold">
                {{ thresholdDb }} dB
              </span>
            </div>
            <input
              id="trimmer-threshold"
              v-model.number="thresholdDb"
              type="range"
              min="-60"
              max="-20"
              step="1"
              :disabled="isTrimmedView"
              class="w-full"
            />
            <div class="flex justify-between text-[10px] font-telemetry text-[#60605e]">
              <span>-60 dB</span>
              <span>-40 dB</span>
              <span>-20 dB</span>
            </div>
          </div>

          <!-- Margin Aman (Pad ms) Slider -->
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <label for="trimmer-pad" class="text-xs font-bold text-[#111111]">
                Margin Aman
              </label>
              <span class="retro-telemetry-plate px-2 py-0.5 text-[11px] font-telemetry font-bold">
                {{ padMs }} ms
              </span>
            </div>
            <input
              id="trimmer-pad"
              v-model.number="padMs"
              type="range"
              min="0"
              max="500"
              step="10"
              :disabled="isTrimmedView"
              class="w-full"
            />
            <div class="flex justify-between text-[10px] font-telemetry text-[#60605e]">
              <span>0 ms</span>
              <span>250 ms</span>
              <span>500 ms</span>
            </div>
          </div>

          <!-- De-Clicker Micro-Fade Radio Keycaps -->
          <div class="space-y-2">
            <span class="block text-xs font-bold text-[#111111]">
              De-Clicker Micro-Fade
            </span>
            <div class="flex items-center gap-2" role="radiogroup" aria-label="Durasi micro-fade de-clicker">
              <button
                v-for="ms in FADE_OPTIONS_MS"
                :key="ms"
                type="button"
                role="radio"
                :aria-checked="fadeMs === ms"
                @click="fadeMs = ms"
                :class="fadeMs === ms ? 'btn-keycap-yellow' : 'btn-keycap-white'"
                class="btn-keycap btn-keycap-mini flex-1 py-2 text-xs font-telemetry"
              >
                {{ ms }} ms
              </button>
            </div>
            <p class="text-[11px] text-[#60605e]">
              Mencegah klik/letupan pada titik awal &amp; akhir potongan.
            </p>
          </div>
        </div>

        <!-- Reset Manual Handles + Sync 4 Stems Checkbox -->
        <div class="pt-4 border-t border-[#111111]/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              @click="resetManualHandles"
              :disabled="!hasManualBounds || isTrimmedView"
              class="btn-keycap btn-keycap-mini btn-keycap-white px-3 py-1.5 text-xs"
            >
              <RotateCcw class="w-3.5 h-3.5" :stroke-width="2" />
              <span>Reset Handle Manual</span>
            </button>

            <span v-if="hasManualBounds" class="font-telemetry text-[11px] text-[#60605e]">
              Override manual aktif
            </span>
          </div>

          <label
            v-if="hasJobSource"
            class="inline-flex items-start sm:items-center gap-2.5 cursor-pointer select-none text-xs font-semibold text-[#111111]"
          >
            <input
              v-model="syncAllStems"
              type="checkbox"
              class="sr-only peer"
            />
            <span
              :class="syncAllStems ? 'bg-[#5ad363] text-[#111111]' : 'bg-white text-transparent'"
              class="w-5 h-5 rounded-[6px] border-2 border-[#111111] shadow-[1.5px_2px_0_#111111] flex items-center justify-center shrink-0 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#111111] peer-focus-visible:ring-offset-2"
            >
              <Check class="w-3.5 h-3.5" :stroke-width="3" />
            </span>
            <span>Terapkan titik potong yang sama ke seluruh 4 stem agar tetap sinkron (Zero-Aligned)</span>
          </label>
        </div>

        <!-- Primary Trim Execution CTA -->
        <div class="flex flex-wrap items-center justify-end gap-3 pt-1">
          <button
            type="button"
            @click="handleExecuteTrim"
            :disabled="workbenchStore.isTrimming || isDecodingRaw"
            class="btn-keycap btn-keycap-blue px-5 py-2.5 text-xs"
          >
            <Loader2 v-if="workbenchStore.isTrimming" class="w-4 h-4 animate-spin" :stroke-width="2.2" />
            <Scissors v-else class="w-4 h-4" :stroke-width="2.2" />
            <span>{{ workbenchStore.isTrimming ? 'Memangkas & De-Click...' : 'Terapkan Pemangkasan & De-Click' }}</span>
          </button>
        </div>
      </section>

      <!-- Trim Telemetry Cards & WAV Download -->
      <section v-if="hasTrimResult" class="rounded-[14px] border-[1.5px] border-[#111111] bg-white/96 shadow-[2px_3px_0_#111111] p-5 sm:p-6 space-y-4 animate-fade-in">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="retro-telemetry-plate p-3.5 space-y-1">
            <span class="block text-[11px] font-bold text-[#60605e]">Durasi Asli</span>
            <span class="block font-telemetry text-lg font-bold text-[#111111] tabular-nums">
              {{ formatDurationSeconds(workbenchStore.trimResult.originalDurationSec) }}
            </span>
          </div>

          <div class="retro-telemetry-plate p-3.5 space-y-1">
            <span class="block text-[11px] font-bold text-[#60605e]">Durasi Akhir</span>
            <span class="block font-telemetry text-lg font-bold text-[#111111] tabular-nums">
              {{ formatDurationSeconds(workbenchStore.trimResult.trimmedDurationSec) }}
            </span>
          </div>

          <div class="retro-telemetry-plate p-3.5 space-y-1">
            <span class="block text-[11px] font-bold text-[#60605e]">Hening Dibuang</span>
            <span class="block font-telemetry text-lg font-bold text-[#111111] tabular-nums">
              {{ formatDurationSeconds(totalSilenceRemovedSec) }}
            </span>
            <span class="block font-telemetry text-[10px] text-[#60605e] tabular-nums">
              Awal {{ Number(workbenchStore.trimResult.leadInRemovedSec || 0).toFixed(2) }}s &middot; Akhir {{ Number(workbenchStore.trimResult.tailRemovedSec || 0).toFixed(2) }}s
            </span>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#111111]/10">
          <p class="text-xs text-[#60605e]">
            {{ hasJobSource && syncAllStems
              ? 'Keempat stem telah disinkronkan dengan titik potong identik dan siap dikirim ke Studio Workspace.'
              : 'Audio hasil pemangkasan siap diaudisi A/B atau diunduh sesuai format pilihan.' }}
          </p>

          <div class="flex flex-wrap items-center justify-end gap-2.5 shrink-0">
            <RetroSelect
              v-model="workbenchStore.downloadFormat"
              :options="WORKBENCH_EXPORT_FORMATS"
              :compact="true"
              :drop-up="true"
              aria-label="Pilih format unduhan hasil trim"
            />

            <button
              type="button"
              @click="handleDownloadTrimmedWav"
              :disabled="isDownloadingWav"
              class="btn-keycap btn-keycap-yellow px-4 py-2.5 text-xs shrink-0"
            >
              <Loader2 v-if="isDownloadingWav" class="w-4 h-4 animate-spin" :stroke-width="2" />
              <Download v-else class="w-4 h-4" :stroke-width="2" />
              <span>{{ isDownloadingWav ? 'Mengunduh...' : 'Unduh Hasil Trim' }}</span>
            </button>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
