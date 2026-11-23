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
  MousePointer,
  Plus,
  Merge,
  Trash2,
  Archive,
  Tag,
  CheckCircle2
} from 'lucide-vue-next'
import WaveformSplitterCanvas from '../audio/WaveformSplitterCanvas.vue'
import RetroSelect from '../ui/RetroSelect.vue'
import { useWorkbenchStore, WORKBENCH_EXPORT_FORMATS } from '../../stores/workbench'

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024
const ALLOWED_EXT_REGEX = /\.(wav|flac|mp3)$/i
const PEAK_BIN_COUNT = 700
const FADE_OPTIONS_MS = [5, 15, 30]
const MIN_REGION_DURATION_SEC = 0.05
const MAX_REGIONS = 100

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
const decodeError = ref('')
const downloadingAssetKey = ref(null)

// Auto-detection parameters (parity with Python worker detect_active_regions)
const thresholdDb = ref(-45)
const minSilenceGapMs = ref(300)
const minAssetMs = ref(100)
const padMs = ref(50)
const fadeMs = ref(15)

// Canvas & region editing state
const toolMode = ref('select') // 'select' | 'split'
const regions = ref([])
const selectedRegionId = ref(null)
const hasManualOverrides = ref(false)
const batchPrefix = ref('')

// Waveform & playback state
const rawPeaks = ref([])
const rawDurationSec = ref(0)
const isPlaying = ref(false)
const playingRegionId = ref(null)
const currentTimeSec = ref(0)

// Server-sliced result inline <audio> preview state
const playingResultKey = ref(null)

// Web Audio & DOM media resources
let audioCtx = null
let activeSource = null
let activeGain = null
let rawBuffer = null
let rafId = null
let playbackStartedAtCtx = 0
let clipEndSec = null
let sourceLoadToken = 0
let regionUidCounter = 0
let resultAudioEl = null

const hasSource = computed(() => workbenchStore.hasSplitterSource)
const hasJobSource = computed(() => Boolean(workbenchStore.splitterSource.jobId))
const hasSplitResult = computed(() => Boolean(workbenchStore.splitResult))

const availableJobStems = computed(() => {
  if (!workbenchStore.hasCompletedJob) return []
  return workbenchStore.job?.stems || []
})

const sortedRegions = computed(() => {
  return [...regions.value].sort((a, b) => a.startSec - b.startSec || a.endSec - b.endSec)
})

const selectedRegion = computed(() => {
  if (!selectedRegionId.value) return null
  return sortedRegions.value.find((r) => r.id === selectedRegionId.value) || null
})

const splitPlayheadTarget = computed(() => {
  const t = Number(currentTimeSec.value) || 0
  const candidate =
    selectedRegion.value &&
    t >= selectedRegion.value.startSec + MIN_REGION_DURATION_SEC &&
    t <= selectedRegion.value.endSec - MIN_REGION_DURATION_SEC
      ? selectedRegion.value
      : sortedRegions.value.find(
          (r) =>
            t >= r.startSec + MIN_REGION_DURATION_SEC &&
            t <= r.endSec - MIN_REGION_DURATION_SEC
        )
  return candidate || null
})

const canSplitAtPlayhead = computed(() => Boolean(splitPlayheadTarget.value) && !isDecodingRaw.value)
const canAddManualRegion = computed(() => {
  if (!rawBuffer || rawDurationSec.value < MIN_REGION_DURATION_SEC || isDecodingRaw.value) return false
  if (sortedRegions.value.length >= MAX_REGIONS) return false
  return Boolean(findLargestAvailableGap())
})

const isOverRegionLimit = computed(() => sortedRegions.value.length > MAX_REGIONS)

const canExecuteSplit = computed(() => {
  return (
    hasSource.value &&
    !isDecodingRaw.value &&
    !workbenchStore.isSplitting &&
    sortedRegions.value.length >= 1 &&
    sortedRegions.value.length <= MAX_REGIONS
  )
})

function nextRegionId() {
  regionUidCounter += 1
  return `reg-${regionUidCounter}`
}

function roundTime(val) {
  return Math.round(Number(val) * 1000) / 1000
}

function sanitizePrefixSegment(raw) {
  if (typeof raw !== 'string') return ''
  const cleaned = raw
    .trim()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '')
  return cleaned
}

function getDefaultNamePrefix() {
  const custom = sanitizePrefixSegment(batchPrefix.value)
  if (custom) return custom

  const stemName = sanitizePrefixSegment(workbenchStore.splitterSource.stemName || '')
  if (stemName) return stemName

  const fileBase = sanitizePrefixSegment(workbenchStore.splitterSource.fileName || '')
  return fileBase || 'asset'
}

function formatRegionAssetName(prefix, index) {
  const safePrefix = sanitizePrefixSegment(prefix) || 'asset'
  return `${safePrefix}_${String(index + 1).padStart(2, '0')}`
}

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

/**
 * Mirrors worker/src/workbench/silence_trimmer.py `detect_active_regions`
 * using a 10 ms frame peak envelope, gap bridging, min-duration filtering,
 * and gap-midpoint clamped padding so regions never overlap.
 */
function detectRegionsFromBuffer(
  audioBuffer,
  {
    thresholdDb: thresh = -45,
    minSilenceGapMs: gapMs = 300,
    minAssetMs: minDurMs = 100,
    padMs: pad = 50,
    prefix = ''
  } = {}
) {
  if (!audioBuffer || audioBuffer.length === 0 || audioBuffer.sampleRate <= 0) {
    return []
  }

  const sampleRate = audioBuffer.sampleRate
  const totalSamples = audioBuffer.length
  const numChannels = audioBuffer.numberOfChannels
  const channelData = []
  for (let c = 0; c < numChannels; c++) {
    channelData.push(audioBuffer.getChannelData(c))
  }

  const winSize = Math.max(1, Math.round(0.01 * sampleRate))
  const thresholdAmp = Math.pow(10, Number(thresh) / 20)
  const nFull = Math.floor(totalSamples / winSize)
  const hasTail = totalSamples % winSize > 0
  const numFrames = nFull + (hasTail ? 1 : 0)

  const framePeaks = new Float32Array(numFrames)
  for (let f = 0; f < numFrames; f++) {
    const start = f * winSize
    const end = Math.min(totalSamples, start + winSize)
    let maxVal = 0
    for (let c = 0; c < numChannels; c++) {
      const ch = channelData[c]
      for (let s = start; s < end; s++) {
        const absVal = Math.abs(ch[s])
        if (absVal > maxVal) maxVal = absVal
      }
    }
    framePeaks[f] = maxVal
  }

  // Extract contiguous runs of active 10ms frames
  const rawRuns = []
  let runStart = -1
  for (let f = 0; f < numFrames; f++) {
    const isActive = framePeaks[f] >= thresholdAmp
    if (isActive && runStart === -1) {
      runStart = f
    } else if (!isActive && runStart !== -1) {
      rawRuns.push([runStart, f])
      runStart = -1
    }
  }
  if (runStart !== -1) {
    rawRuns.push([runStart, numFrames])
  }

  if (rawRuns.length === 0) {
    return []
  }

  // Bridge silence gaps shorter than minSilenceGapMs
  const minGapSamples = Math.max(0, Math.round((Math.max(0, Number(gapMs)) / 1000) * sampleRate))
  const bridgedRuns = [[rawRuns[0][0], rawRuns[0][1]]]
  for (let i = 1; i < rawRuns.length; i++) {
    const [startF, endF] = rawRuns[i]
    const prevRun = bridgedRuns[bridgedRuns.length - 1]
    const gapSamples = (startF - prevRun[1]) * winSize
    if (gapSamples < minGapSamples) {
      prevRun[1] = endF
    } else {
      bridgedRuns.push([startF, endF])
    }
  }

  // Filter short bursts < minAssetMs
  const minAssetSamples = Math.max(1, Math.round((Math.max(0, Number(minDurMs)) / 1000) * sampleRate))
  const filteredRuns = []
  for (const [startF, endF] of bridgedRuns) {
    const startSample = startF * winSize
    const endSample = Math.min(totalSamples, endF * winSize)
    if (endSample - startSample >= minAssetSamples) {
      filteredRuns.push([startSample, endSample])
    }
  }

  if (filteredRuns.length === 0) {
    return []
  }

  // Apply symmetric padding clamped at gap midpoints so adjacent regions never overlap
  const padSamples = Math.max(0, Math.round((Math.max(0, Number(pad)) / 1000) * sampleRate))
  const paddedBounds = filteredRuns.map(([rawS, rawE]) => [
    Math.max(0, rawS - padSamples),
    Math.min(totalSamples, rawE + padSamples),
    rawS,
    rawE
  ])

  for (let i = 0; i < paddedBounds.length - 1; i++) {
    if (paddedBounds[i][1] > paddedBounds[i + 1][0]) {
      const gapMid = Math.floor((paddedBounds[i][3] + paddedBounds[i + 1][2]) / 2)
      paddedBounds[i][1] = gapMid
      paddedBounds[i + 1][0] = gapMid
    }
  }

  const namePrefix = sanitizePrefixSegment(prefix) || 'asset'
  const durSec = audioBuffer.duration || totalSamples / sampleRate
  const detected = []

  for (let i = 0; i < paddedBounds.length; i++) {
    const [s, e] = paddedBounds[i]
    const startSec = Math.max(0, Math.min(durSec, roundTime(s / sampleRate)))
    const endSec = Math.max(startSec, Math.min(durSec, roundTime(e / sampleRate)))
    if (endSec - startSec < MIN_REGION_DURATION_SEC) continue
    if (detected.length > 0 && startSec < detected[detected.length - 1].endSec) {
      continue
    }
    detected.push({
      id: nextRegionId(),
      name: formatRegionAssetName(namePrefix, detected.length),
      startSec,
      endSec
    })
  }

  return detected
}

function runAutoDetection() {
  if (!rawBuffer) {
    regions.value = []
    selectedRegionId.value = null
    return
  }

  const detected = detectRegionsFromBuffer(rawBuffer, {
    thresholdDb: thresholdDb.value,
    minSilenceGapMs: minSilenceGapMs.value,
    minAssetMs: minAssetMs.value,
    padMs: padMs.value,
    prefix: getDefaultNamePrefix()
  })

  regions.value = detected
  hasManualOverrides.value = false

  if (detected.length > 0) {
    if (!detected.some((r) => r.id === selectedRegionId.value)) {
      selectedRegionId.value = detected[0].id
    }
  } else {
    selectedRegionId.value = null
  }
}

function handleResetAutoDetect() {
  if (playingRegionId.value) {
    stopMainPlayback(false)
  }
  runAutoDetection()
}

// =========================================================================
// Web Audio & Result Preview Lifecycle Management
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

function stopResultAudioPreview() {
  if (resultAudioEl) {
    try {
      resultAudioEl.pause()
      resultAudioEl.removeAttribute('src')
      resultAudioEl.load()
    } catch {
      // ignore
    }
    resultAudioEl.onended = null
    resultAudioEl.onerror = null
    resultAudioEl = null
  }
  playingResultKey.value = null
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

function stopMainPlayback(resetPosition = false) {
  stopActiveSource(0)
  isPlaying.value = false
  playingRegionId.value = null
  clipEndSec = null
  if (resetPosition) {
    currentTimeSec.value = 0
  }
}

function stopPlayback(resetPosition = false) {
  stopMainPlayback(resetPosition)
  stopResultAudioPreview()
}

function disposeAudio() {
  sourceLoadToken += 1
  stopPlayback(true)
  rawBuffer = null
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

function startRafLoop(endBoundSec, resetOnFinish = true) {
  stopRafLoop()
  const tick = () => {
    if (!isPlaying.value || !audioCtx) return
    const elapsed = Math.max(0, audioCtx.currentTime - playbackStartedAtCtx)
    if (endBoundSec > 0 && elapsed >= endBoundSec) {
      if (resetOnFinish) {
        stopMainPlayback(true)
      } else {
        stopMainPlayback(false)
        currentTimeSec.value = endBoundSec
      }
      return
    }
    currentTimeSec.value = Math.min(elapsed, endBoundSec || elapsed)
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

function startBufferAt(buffer, offsetSec, { endSec = null, regionId = null, fadeInSec = 0.005 } = {}) {
  if (!buffer) return
  stopResultAudioPreview()

  const ctx = ensureAudioContext()
  stopActiveSource(fadeInSec)

  const bufDur = buffer.duration || 0
  const targetEnd = endSec !== null ? Math.min(bufDur, Math.max(0, endSec)) : bufDur
  const safeOffset = Math.max(0, Math.min(offsetSec, Math.max(0, targetEnd - 0.01)))
  const playDuration = Math.max(0.01, targetEnd - safeOffset)
  const now = ctx.currentTime

  const source = ctx.createBufferSource()
  source.buffer = buffer

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(1.0, now + fadeInSec)

  source.connect(gain)
  gain.connect(ctx.destination)

  if (endSec !== null) {
    source.start(now, safeOffset, playDuration)
  } else {
    source.start(now, safeOffset)
  }

  activeSource = source
  activeGain = gain
  playbackStartedAtCtx = now - safeOffset
  clipEndSec = endSec !== null ? targetEnd : null
  playingRegionId.value = regionId
  currentTimeSec.value = safeOffset
  isPlaying.value = true

  startRafLoop(targetEnd, endSec === null)
}

function togglePlayPause() {
  if (!rawBuffer || isDecodingRaw.value) return
  if (isPlaying.value && !playingRegionId.value) {
    stopMainPlayback(false)
  } else {
    const dur = rawBuffer.duration || 0
    const startAt = currentTimeSec.value >= dur ? 0 : currentTimeSec.value
    startBufferAt(rawBuffer, startAt, { regionId: null, fadeInSec: 0.005 })
  }
}

function handleStopClick() {
  stopMainPlayback(true)
}

function handleSeek(targetSec) {
  const dur = rawDurationSec.value || 0
  const clamped = Math.max(0, Math.min(Number(targetSec) || 0, dur))
  currentTimeSec.value = clamped
  if (isPlaying.value && rawBuffer) {
    startBufferAt(rawBuffer, clamped, { regionId: null, fadeInSec: 0.005 })
  }
}

function toggleRegionClipPlay(region) {
  if (!rawBuffer || !region || isDecodingRaw.value) return
  if (isPlaying.value && playingRegionId.value === region.id) {
    stopMainPlayback(false)
    return
  }
  selectedRegionId.value = region.id
  startBufferAt(rawBuffer, region.startSec, {
    endSec: region.endSec,
    regionId: region.id,
    fadeInSec: 0.005
  })
}

function toggleResultAssetPreview(asset) {
  if (!asset?.audioUrl || !asset?.storageKey) return
  if (playingResultKey.value === asset.storageKey) {
    stopResultAudioPreview()
    return
  }

  stopMainPlayback(false)
  stopResultAudioPreview()

  const audio = new Audio(asset.audioUrl)
  audio.preload = 'auto'
  playingResultKey.value = asset.storageKey
  resultAudioEl = audio

  audio.onended = () => {
    if (resultAudioEl === audio) {
      playingResultKey.value = null
      resultAudioEl = null
    }
  }
  audio.onerror = () => {
    if (resultAudioEl === audio) {
      playingResultKey.value = null
      resultAudioEl = null
      localError.value = `Gagal memutar pratinjau aset ${asset.fileName || asset.name}.`
    }
  }

  audio.play().catch((err) => {
    if (resultAudioEl === audio) {
      playingResultKey.value = null
      resultAudioEl = null
      localError.value = err?.message || 'Gagal memulai pemutaran pratinjau aset.'
    }
  })
}

// =========================================================================
// Audio Source Decoding
// =========================================================================

async function loadRawSourceBuffer() {
  const token = ++sourceLoadToken
  stopPlayback(true)
  rawBuffer = null
  rawPeaks.value = []
  regions.value = []
  selectedRegionId.value = null
  batchPrefix.value = ''
  hasManualOverrides.value = false
  rawDurationSec.value = Number(workbenchStore.splitterSource.rawDurationSec || 0)
  decodeError.value = ''
  localError.value = ''

  const file = workbenchStore.splitterSource.file
  const rawUrl = workbenchStore.splitterSource.rawUrl
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
    workbenchStore.setSplitterDuration(decoded.duration)
    runAutoDetection()
  } catch (err) {
    if (token !== sourceLoadToken) return
    decodeError.value = err.message || 'Gagal mendekode berkas audio untuk deteksi region.'
  } finally {
    if (token === sourceLoadToken) {
      isDecodingRaw.value = false
    }
  }
}

watch(
  () => [
    workbenchStore.splitterSource.file,
    workbenchStore.splitterSource.rawUrl,
    workbenchStore.splitterSource.jobId,
    workbenchStore.splitterSource.stemName
  ],
  () => {
    loadRawSourceBuffer()
  },
  { immediate: true }
)

watch(
  () => [thresholdDb.value, minSilenceGapMs.value, minAssetMs.value, padMs.value],
  () => {
    if (rawBuffer && !isDecodingRaw.value) {
      if (playingRegionId.value) {
        stopMainPlayback(false)
      }
      runAutoDetection()
    }
  }
)

watch(
  () => workbenchStore.activeTab,
  (tab) => {
    if (tab !== 'splitter') {
      stopPlayback(false)
    }
  }
)

// =========================================================================
// Region Editing & Manual Overrides
// =========================================================================

function handleSelectRegion(regionId) {
  selectedRegionId.value = regionId
}

function handleUpdateRegionBounds({ id, startSec, endSec }) {
  const list = sortedRegions.value
  const idx = list.findIndex((r) => r.id === id)
  if (idx < 0) return

  const dur = rawDurationSec.value || 0
  const prevEnd = idx > 0 ? list[idx - 1].endSec : 0
  const nextStart = idx < list.length - 1 ? list[idx + 1].startSec : dur

  const clampedStart = roundTime(Math.max(prevEnd, Math.min(Number(startSec) || 0, nextStart - MIN_REGION_DURATION_SEC)))
  const clampedEnd = roundTime(Math.min(nextStart, Math.max(Number(endSec) || 0, clampedStart + MIN_REGION_DURATION_SEC)))

  if (clampedEnd - clampedStart < MIN_REGION_DURATION_SEC) return

  regions.value = regions.value.map((r) =>
    r.id === id ? { ...r, startSec: clampedStart, endSec: clampedEnd } : r
  )
  hasManualOverrides.value = true
}

function buildSplitRightName(leftName) {
  const clean = (leftName || 'asset').trim()
  const baseMatch = clean.match(/^(.*?)_part(\d+)$/i)
  if (baseMatch) {
    return `${baseMatch[1]}_part${Number(baseMatch[2]) + 1}`
  }
  return `${clean}_part2`
}

function handleSplitRegionAt({ id, timeSec }) {
  if (sortedRegions.value.length >= MAX_REGIONS) {
    localError.value = `Maksimal ${MAX_REGIONS} segmen per pemrosesan.`
    return
  }

  const target = regions.value.find((r) => r.id === id)
  if (!target) return

  const splitAt = roundTime(timeSec)
  if (
    splitAt < target.startSec + MIN_REGION_DURATION_SEC ||
    splitAt > target.endSec - MIN_REGION_DURATION_SEC
  ) {
    return
  }

  if (playingRegionId.value === id) {
    stopMainPlayback(false)
  }

  const rightId = nextRegionId()
  const leftRegion = {
    ...target,
    endSec: splitAt
  }
  const rightRegion = {
    id: rightId,
    name: buildSplitRightName(target.name),
    startSec: splitAt,
    endSec: target.endSec
  }

  regions.value = regions.value
    .flatMap((r) => (r.id === id ? [leftRegion, rightRegion] : [r]))
    .sort((a, b) => a.startSec - b.startSec)

  selectedRegionId.value = rightId
  hasManualOverrides.value = true
  localError.value = ''
}

function handleSplitAtPlayhead() {
  const target = splitPlayheadTarget.value
  if (!target) return
  handleSplitRegionAt({ id: target.id, timeSec: currentTimeSec.value })
}

function findLargestAvailableGap() {
  const dur = Number(rawDurationSec.value) || 0
  if (dur < MIN_REGION_DURATION_SEC) return null

  const list = sortedRegions.value
  if (list.length === 0) {
    return { startSec: 0, endSec: roundTime(dur) }
  }

  let bestGap = null
  let bestLen = 0
  let cursor = 0

  for (const r of list) {
    const gapLen = r.startSec - cursor
    if (gapLen >= MIN_REGION_DURATION_SEC && gapLen > bestLen) {
      bestLen = gapLen
      bestGap = { startSec: roundTime(cursor), endSec: roundTime(r.startSec) }
    }
    cursor = Math.max(cursor, r.endSec)
  }

  const tailLen = dur - cursor
  if (tailLen >= MIN_REGION_DURATION_SEC && tailLen > bestLen) {
    bestGap = { startSec: roundTime(cursor), endSec: roundTime(dur) }
  }

  return bestGap
}

function handleAddManualRegion() {
  if (!canAddManualRegion.value) return
  const gap = findLargestAvailableGap()
  if (!gap || gap.endSec - gap.startSec < MIN_REGION_DURATION_SEC) return

  const newId = nextRegionId()
  const nextIndex = sortedRegions.value.length
  const newRegion = {
    id: newId,
    name: formatRegionAssetName(getDefaultNamePrefix(), nextIndex),
    startSec: gap.startSec,
    endSec: gap.endSec
  }

  regions.value = [...regions.value, newRegion].sort((a, b) => a.startSec - b.startSec)
  selectedRegionId.value = newId
  hasManualOverrides.value = true
  localError.value = ''
}

function handleMergeWithNext(index) {
  const list = sortedRegions.value
  if (index < 0 || index >= list.length - 1) return

  const first = list[index]
  const second = list[index + 1]

  if (playingRegionId.value === first.id || playingRegionId.value === second.id) {
    stopMainPlayback(false)
  }

  const merged = {
    ...first,
    endSec: second.endSec
  }

  regions.value = list
    .filter((r) => r.id !== second.id)
    .map((r) => (r.id === first.id ? merged : r))

  selectedRegionId.value = merged.id
  hasManualOverrides.value = true
}

function handleDeleteRegion(regionId) {
  if (playingRegionId.value === regionId) {
    stopMainPlayback(false)
  }
  const list = sortedRegions.value
  const removedIdx = list.findIndex((r) => r.id === regionId)
  if (removedIdx < 0) return

  const nextList = list.filter((r) => r.id !== regionId)
  regions.value = nextList

  if (selectedRegionId.value === regionId) {
    const fallback = nextList[Math.min(removedIdx, nextList.length - 1)] || null
    selectedRegionId.value = fallback ? fallback.id : null
  }
  hasManualOverrides.value = true
}

function handleApplyBatchPrefix() {
  const prefix = sanitizePrefixSegment(batchPrefix.value) || getDefaultNamePrefix()
  const list = sortedRegions.value
  const nextNamesById = new Map()
  list.forEach((r, idx) => {
    nextNamesById.set(r.id, formatRegionAssetName(prefix, idx))
  })
  regions.value = regions.value.map((r) => ({
    ...r,
    name: nextNamesById.get(r.id) || r.name
  }))
  hasManualOverrides.value = true
}

// =========================================================================
// File Selection, Server Split & Export Downloads
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
  workbenchStore.loadLocalFileInSplitter(file)
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

async function handleExecuteSplit() {
  if (!canExecuteSplit.value) return
  localError.value = ''
  decodeError.value = ''
  stopPlayback(false)

  try {
    await workbenchStore.executeSplit({
      regions: sortedRegions.value.map((r, idx) => ({
        name: (r.name || '').trim() || formatRegionAssetName(getDefaultNamePrefix(), idx),
        startSec: r.startSec,
        endSec: r.endSec
      })),
      fadeMs: fadeMs.value
    })
  } catch {
    // Store error banner displays backend error message
  }
}

async function handleDownloadSingleAsset(asset) {
  if (!asset?.storageKey) return
  downloadingAssetKey.value = asset.storageKey
  try {
    await workbenchStore.downloadSplitAsset(asset, workbenchStore.downloadFormat)
  } catch {
    // Store error banner displays error
  } finally {
    downloadingAssetKey.value = null
  }
}

async function handleDownloadAllZip() {
  stopResultAudioPreview()
  try {
    await workbenchStore.downloadSplitZip(workbenchStore.downloadFormat)
  } catch {
    // Store error banner displays error
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
          Pemecah Aset Audio Multi-Region
        </h2>

        <!-- Quick Stem Switcher when Tab 1 stems are available -->
        <div v-if="availableJobStems.length > 0" class="flex flex-wrap items-center gap-1.5 shrink-0">
          <span class="text-[11px] font-bold text-[#60605e] mr-1">Stem Tab 01:</span>
          <button
            v-for="stem in availableJobStems"
            :key="stem.name"
            type="button"
            @click="workbenchStore.openStemInSplitter(stem)"
            :class="workbenchStore.splitterSource.jobId === workbenchStore.job?.jobId && workbenchStore.splitterSource.stemName === stem.name ? 'btn-keycap-blue' : 'btn-keycap-white'"
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
                  {{ workbenchStore.splitterSource.fileName }}
                </span>
                <span class="px-2 py-0.5 rounded-full bg-white border border-[#111111] text-[10px] font-bold text-[#111111]">
                  {{ hasJobSource ? 'Stem Pemisahan AI' : 'Berkas Lokal Mandiri' }}
                </span>
              </div>
              <p class="text-[11px] text-[#60605e] mt-0.5 font-telemetry tabular-nums">
                {{ isDecodingRaw ? 'Mendekode & menganalisis segmen audio...' : `Durasi sumber: ${formatDurationSeconds(rawDurationSec)}` }}
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
            Mendukung .wav, .flac, .mp3 (&le; 100 MB) atau pilih stem dari Tab 01 untuk dipecah menjadi beberapa aset.
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

    <!-- Multi-Region Waveform Monitor + Toolbar + Parameters + Region List + Results -->
    <template v-if="hasSource">
      <!-- Canvas Toolbar + Transport -->
      <section class="rounded-[14px] border-[1.5px] border-[#111111] bg-white/96 shadow-[2px_3px_0_#111111] p-4 sm:p-5 space-y-3.5">
        <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <!-- Mode Switcher & Split Actions -->
          <div class="flex flex-wrap items-center gap-2">
            <div class="inline-flex items-center gap-1.5" role="radiogroup" aria-label="Mode alat kanvas">
              <button
                type="button"
                role="radio"
                :aria-checked="toolMode === 'select'"
                @click="toolMode = 'select'"
                :class="toolMode === 'select' ? 'btn-keycap-yellow' : 'btn-keycap-white'"
                class="btn-keycap btn-keycap-sm px-3 py-1.5 text-xs"
              >
                <MousePointer class="w-3.5 h-3.5" :stroke-width="2.2" />
                <span>Pilih &amp; Scrub</span>
              </button>

              <button
                type="button"
                role="radio"
                :aria-checked="toolMode === 'split'"
                @click="toolMode = 'split'"
                :class="toolMode === 'split' ? 'btn-keycap-pink' : 'btn-keycap-white'"
                class="btn-keycap btn-keycap-sm px-3 py-1.5 text-xs"
              >
                <Scissors class="w-3.5 h-3.5" :stroke-width="2.2" />
                <span>Mode Belah</span>
              </button>
            </div>

            <button
              type="button"
              @click="handleSplitAtPlayhead"
              :disabled="!canSplitAtPlayhead"
              class="btn-keycap btn-keycap-sm btn-keycap-white px-3 py-1.5 text-xs"
              title="Belah segmen aktif tepat di posisi playhead"
            >
              <Scissors class="w-3.5 h-3.5" :stroke-width="2.2" />
              <span>Belah di Playhead</span>
            </button>

            <button
              type="button"
              @click="handleAddManualRegion"
              :disabled="!canAddManualRegion"
              class="btn-keycap btn-keycap-sm btn-keycap-white px-3 py-1.5 text-xs"
              title="Tambahkan segmen manual pada area kosong"
            >
              <Plus class="w-3.5 h-3.5" :stroke-width="2.2" />
              <span>Tambah Region Manual</span>
            </button>

            <button
              type="button"
              @click="handleResetAutoDetect"
              :disabled="!rawBuffer || isDecodingRaw"
              class="btn-keycap btn-keycap-sm btn-keycap-white px-3 py-1.5 text-xs"
              title="Hapus penyesuaian manual dan deteksi ulang otomatis"
            >
              <RotateCcw class="w-3.5 h-3.5" :stroke-width="2.2" />
              <span>Deteksi Ulang Otomatis</span>
            </button>
          </div>

          <!-- Transport & Active Region Count Badge -->
          <div class="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              @click="togglePlayPause"
              :disabled="!rawBuffer || isDecodingRaw"
              class="btn-keycap btn-keycap-sm btn-keycap-blue px-3.5 py-1.5 text-xs"
            >
              <Loader2 v-if="isDecodingRaw" class="w-3.5 h-3.5 animate-spin" :stroke-width="2.2" />
              <Pause v-else-if="isPlaying && !playingRegionId" class="w-3.5 h-3.5" :stroke-width="2.2" />
              <Play v-else class="w-3.5 h-3.5" :stroke-width="2.2" />
              <span>{{ isPlaying && !playingRegionId ? 'Jeda' : 'Putar Penuh' }}</span>
            </button>

            <button
              type="button"
              @click="handleStopClick"
              :disabled="!rawBuffer || isDecodingRaw"
              class="btn-keycap btn-keycap-sm btn-keycap-white px-2.5 py-1.5 text-xs"
              aria-label="Hentikan pratinjau penuh"
            >
              <Square class="w-3.5 h-3.5" :stroke-width="2.2" />
            </button>

            <div class="retro-telemetry-plate px-3 py-1.5 text-xs font-telemetry tabular-nums">
              {{ formatTimecode(currentTimeSec) }} / {{ formatTimecode(rawDurationSec) }}
            </div>

            <span class="px-2.5 py-1 rounded-full bg-[#fff099] border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] font-telemetry text-[11px] font-bold text-[#111111] tabular-nums">
              {{ sortedRegions.length }} Region
            </span>

            <span
              v-if="hasManualOverrides"
              class="px-2.5 py-1 rounded-full bg-[#ffcae6] border-[1.5px] border-[#111111] text-[10px] font-bold text-[#111111]"
            >
              Edit Manual
            </span>
          </div>
        </div>
      </section>

      <!-- HiDPI Interactive Multi-Region Waveform Canvas -->
      <WaveformSplitterCanvas
        :peaks="rawPeaks"
        :duration-sec="rawDurationSec"
        :regions="sortedRegions"
        :selected-region-id="selectedRegionId"
        :tool-mode="toolMode"
        :current-time-sec="currentTimeSec"
        :is-playing="isPlaying"
        @seek="handleSeek"
        @select-region="handleSelectRegion"
        @update-region-bounds="handleUpdateRegionBounds"
        @split-region-at="handleSplitRegionAt"
      />

      <!-- Auto-Detection Sliders & De-Clicker Controls -->
      <section class="rounded-[14px] border-[1.5px] border-[#111111] bg-white/96 shadow-[2px_3px_0_#111111] p-5 sm:p-6 space-y-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5">
          <!-- Silence Threshold -->
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <label for="splitter-threshold" class="text-xs font-bold text-[#111111]">
                Silence Threshold
              </label>
              <span class="retro-telemetry-plate px-2 py-0.5 text-[11px] font-telemetry font-bold">
                {{ thresholdDb }} dB
              </span>
            </div>
            <input
              id="splitter-threshold"
              v-model.number="thresholdDb"
              type="range"
              min="-60"
              max="-20"
              step="1"
              :disabled="isDecodingRaw"
              class="w-full"
            />
            <div class="flex justify-between text-[10px] font-telemetry text-[#60605e]">
              <span>-60 dB</span>
              <span>-40 dB</span>
              <span>-20 dB</span>
            </div>
          </div>

          <!-- Minimum Silence Gap -->
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <label for="splitter-gap" class="text-xs font-bold text-[#111111]">
                Jeda Pemisah Minimal
              </label>
              <span class="retro-telemetry-plate px-2 py-0.5 text-[11px] font-telemetry font-bold">
                {{ minSilenceGapMs }} ms
              </span>
            </div>
            <input
              id="splitter-gap"
              v-model.number="minSilenceGapMs"
              type="range"
              min="100"
              max="2000"
              step="50"
              :disabled="isDecodingRaw"
              class="w-full"
            />
            <div class="flex justify-between text-[10px] font-telemetry text-[#60605e]">
              <span>100 ms</span>
              <span>1000 ms</span>
              <span>2000 ms</span>
            </div>
          </div>

          <!-- Minimum Asset Duration -->
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <label for="splitter-min-asset" class="text-xs font-bold text-[#111111]">
                Durasi Aset Minimal
              </label>
              <span class="retro-telemetry-plate px-2 py-0.5 text-[11px] font-telemetry font-bold">
                {{ minAssetMs }} ms
              </span>
            </div>
            <input
              id="splitter-min-asset"
              v-model.number="minAssetMs"
              type="range"
              min="50"
              max="1000"
              step="25"
              :disabled="isDecodingRaw"
              class="w-full"
            />
            <div class="flex justify-between text-[10px] font-telemetry text-[#60605e]">
              <span>50 ms</span>
              <span>500 ms</span>
              <span>1000 ms</span>
            </div>
          </div>

          <!-- Safe Pad -->
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <label for="splitter-pad" class="text-xs font-bold text-[#111111]">
                Margin Aman
              </label>
              <span class="retro-telemetry-plate px-2 py-0.5 text-[11px] font-telemetry font-bold">
                {{ padMs }} ms
              </span>
            </div>
            <input
              id="splitter-pad"
              v-model.number="padMs"
              type="range"
              min="0"
              max="300"
              step="10"
              :disabled="isDecodingRaw"
              class="w-full"
            />
            <div class="flex justify-between text-[10px] font-telemetry text-[#60605e]">
              <span>0 ms</span>
              <span>150 ms</span>
              <span>300 ms</span>
            </div>
          </div>

          <!-- De-Clicker Micro-Fade -->
          <div class="space-y-2">
            <span class="block text-xs font-bold text-[#111111]">
              De-Clicker Micro-Fade
            </span>
            <div class="flex items-center gap-1.5" role="radiogroup" aria-label="Durasi micro-fade de-clicker">
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
              Mencegah letupan di awal &amp; akhir tiap klip.
            </p>
          </div>
        </div>
      </section>

      <!-- Editable Region List + Batch Rename + Process CTA -->
      <section class="rounded-[14px] border-[1.5px] border-[#111111] bg-white/96 shadow-[2px_3px_0_#111111] p-5 sm:p-6 space-y-4">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 class="font-editorial font-bold text-base sm:text-lg text-[#111111]">
              Daftar Region ({{ sortedRegions.length }})
            </h3>
            <p class="text-xs text-[#60605e] mt-0.5">
              Ubah nama, audisi per klip, gabungkan segmen berurutan, atau hapus segmen yang tidak diperlukan.
            </p>
          </div>

          <!-- Batch Prefix Rename Bar -->
          <div class="flex flex-wrap items-center gap-2 shrink-0">
            <div class="relative flex items-center">
              <Tag class="w-3.5 h-3.5 text-[#60605e] absolute left-2.5 pointer-events-none" :stroke-width="2" />
              <input
                v-model="batchPrefix"
                type="text"
                placeholder="Prefix nama batch (opsional)"
                aria-label="Prefix nama batch"
                class="w-48 sm:w-56 bg-white border-[1.5px] border-[#111111] rounded-[10px] pl-8 pr-3 py-1.5 text-xs font-medium text-[#111111] placeholder:text-[#60605e] focus:outline-none focus:ring-2 focus:ring-[#20afff]"
              />
            </div>
            <button
              type="button"
              @click="handleApplyBatchPrefix"
              :disabled="sortedRegions.length === 0"
              class="btn-keycap btn-keycap-sm btn-keycap-white px-3 py-1.5 text-xs"
            >
              <span>Terapkan Prefix</span>
            </button>
          </div>
        </div>

        <!-- Over-limit warning -->
        <div
          v-if="isOverRegionLimit"
          role="alert"
          class="retro-telemetry-plate border-rose-400 bg-rose-50/95 text-rose-900 px-3.5 py-2.5 text-xs font-medium"
        >
          Terdeteksi {{ sortedRegions.length }} segmen (batas maksimal {{ MAX_REGIONS }} aset per pemrosesan). Naikkan Silence Threshold / Jeda Pemisah Minimal atau gabungkan beberapa region.
        </div>

        <!-- Empty state -->
        <div
          v-if="sortedRegions.length === 0 && !isDecodingRaw"
          class="retro-telemetry-plate p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#60605e]"
        >
          <span>
            Tidak ada segmen aktif terdeteksi pada ambang batas {{ thresholdDb }} dB. Turunkan Silence Threshold atau tambahkan region secara manual.
          </span>
          <button
            type="button"
            @click="handleAddManualRegion"
            :disabled="!canAddManualRegion"
            class="btn-keycap btn-keycap-sm btn-keycap-yellow px-3 py-1.5 text-xs shrink-0"
          >
            <Plus class="w-3.5 h-3.5" :stroke-width="2.2" />
            <span>Tambah Region Manual</span>
          </button>
        </div>

        <!-- Per-Region Cards -->
        <div v-else class="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          <div
            v-for="(region, idx) in sortedRegions"
            :key="region.id"
            @click="handleSelectRegion(region.id)"
            :class="selectedRegionId === region.id
              ? 'border-[#111111] bg-[#87d7ff]/20 shadow-[2px_2.5px_0_#111111]'
              : 'border-[#111111]/25 bg-white hover:border-[#111111]/60'"
            class="rounded-[12px] border-[1.5px] p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 transition-all cursor-pointer"
          >
            <div class="flex flex-wrap sm:flex-nowrap items-center gap-2.5 flex-1 min-w-0">
              <!-- Ordinal Badge -->
              <span
                :class="selectedRegionId === region.id ? 'bg-[#111111] text-white' : 'bg-[#fff099] text-[#111111]'"
                class="px-2.5 py-1 rounded-full border border-[#111111] font-telemetry text-[11px] font-bold tabular-nums shrink-0"
              >
                {{ String(idx + 1).padStart(2, '0') }}
              </span>

              <!-- Editable Asset Name -->
              <div class="flex items-center gap-1 flex-1 min-w-[160px]" @click.stop>
                <input
                  v-model="region.name"
                  @input="hasManualOverrides = true"
                  type="text"
                  :aria-label="`Nama berkas aset ${idx + 1}`"
                  class="w-full bg-white border-[1.5px] border-[#111111]/40 focus:border-[#111111] rounded-[8px] px-2.5 py-1.5 text-xs font-bold text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#20afff]"
                />
                <span class="font-telemetry text-[11px] font-semibold text-[#60605e] shrink-0">.wav</span>
              </div>

              <!-- Telemetry Timestamps -->
              <div class="retro-telemetry-plate px-2.5 py-1 text-[11px] font-telemetry font-bold tabular-nums shrink-0">
                {{ formatTimecode(region.startSec) }} &ndash; {{ formatTimecode(region.endSec) }}
                <span class="text-[#60605e] ml-1">({{ (region.endSec - region.startSec).toFixed(2) }} dtk)</span>
              </div>
            </div>

            <!-- Region Action Buttons -->
            <div class="flex flex-wrap items-center gap-1.5 shrink-0" @click.stop>
              <button
                type="button"
                @click="toggleRegionClipPlay(region)"
                :disabled="!rawBuffer || isDecodingRaw"
                :class="isPlaying && playingRegionId === region.id ? 'btn-keycap-yellow' : 'btn-keycap-white'"
                class="btn-keycap btn-keycap-mini px-2.5 py-1 text-[11px]"
              >
                <Square v-if="isPlaying && playingRegionId === region.id" class="w-3 h-3" :stroke-width="2.4" />
                <Play v-else class="w-3 h-3" :stroke-width="2.4" />
                <span>{{ isPlaying && playingRegionId === region.id ? 'Hentikan' : 'Putar Klip' }}</span>
              </button>

              <button
                type="button"
                @click="handleMergeWithNext(idx)"
                :disabled="idx >= sortedRegions.length - 1"
                class="btn-keycap btn-keycap-mini btn-keycap-white px-2.5 py-1 text-[11px]"
                title="Gabungkan dengan segmen berikutnya"
              >
                <Merge class="w-3 h-3" :stroke-width="2.2" />
                <span>Gabung Berikutnya</span>
              </button>

              <button
                type="button"
                @click="handleDeleteRegion(region.id)"
                class="btn-keycap btn-keycap-mini btn-keycap-pink px-2.5 py-1 text-[11px]"
                :aria-label="`Hapus region ${idx + 1}`"
              >
                <Trash2 class="w-3 h-3" :stroke-width="2.2" />
                <span>Hapus</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Primary Split Execution CTA -->
        <div class="pt-3 border-t border-[#111111]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p class="text-xs text-[#60605e]">
            Setiap segmen akan dipotong secara presisi di server dengan fade-in/out {{ fadeMs }} ms beresolusi 24-bit PCM.
          </p>

          <button
            type="button"
            @click="handleExecuteSplit"
            :disabled="!canExecuteSplit"
            class="btn-keycap btn-keycap-blue px-5 py-2.5 text-xs shrink-0"
          >
            <Loader2 v-if="workbenchStore.isSplitting" class="w-4 h-4 animate-spin" :stroke-width="2.2" />
            <Scissors v-else class="w-4 h-4" :stroke-width="2.2" />
            <span>
              {{ workbenchStore.isSplitting
                ? 'Memotong & Mengunggah Aset...'
                : `Proses & Potong ${sortedRegions.length} Aset` }}
            </span>
          </button>
        </div>
      </section>

      <!-- Server-Sliced Assets Results Panel + Multi-Format Export -->
      <section
        v-if="hasSplitResult"
        class="rounded-[14px] border-[1.5px] border-[#111111] bg-white/96 shadow-[2px_3px_0_#111111] p-5 sm:p-6 space-y-4 animate-fade-in"
      >
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-7 h-7 rounded-[8px] border-[1.5px] border-[#111111] bg-[#d8f3dc] text-[#111111] flex items-center justify-center shrink-0">
              <CheckCircle2 class="w-4 h-4" :stroke-width="2.2" />
            </span>
            <div class="min-w-0">
              <h3 class="font-editorial font-bold text-base sm:text-lg text-[#111111] truncate">
                Hasil Pemecahan Aset ({{ workbenchStore.splitResult.totalAssets }} Berkas)
              </h3>
              <p class="text-xs text-[#60605e] truncate">
                Sumber: {{ workbenchStore.splitResult.sourceFileName }}
              </p>
            </div>
          </div>

          <span class="px-2.5 py-1 rounded-full bg-[#5ad363] border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] font-telemetry text-[11px] font-bold text-[#111111] shrink-0 self-start sm:self-center">
            Fade {{ workbenchStore.splitResult.fadeMs }} ms
          </span>
        </div>

        <!-- Sliced Assets List -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <div
            v-for="(asset, idx) in workbenchStore.splitResult.assets"
            :key="asset.storageKey || idx"
            class="retro-telemetry-plate p-3 flex items-center justify-between gap-2.5"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="px-2 py-0.5 rounded-full bg-white border border-[#111111] font-telemetry text-[10px] font-bold text-[#111111] shrink-0">
                {{ String(idx + 1).padStart(2, '0') }}
              </span>
              <div class="min-w-0">
                <p class="text-xs font-bold text-[#111111] truncate">{{ asset.fileName }}</p>
                <p class="text-[11px] font-telemetry text-[#60605e] tabular-nums">
                  {{ formatDurationSeconds(asset.durationSec) }}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                @click="toggleResultAssetPreview(asset)"
                :disabled="!asset.audioUrl"
                :class="playingResultKey === asset.storageKey ? 'btn-keycap-yellow' : 'btn-keycap-white'"
                class="btn-keycap btn-keycap-mini px-2.5 py-1 text-[11px]"
              >
                <Square v-if="playingResultKey === asset.storageKey" class="w-3 h-3" :stroke-width="2.4" />
                <Play v-else class="w-3 h-3" :stroke-width="2.4" />
                <span>{{ playingResultKey === asset.storageKey ? 'Hentikan' : 'Putar Hasil' }}</span>
              </button>

              <button
                type="button"
                @click="handleDownloadSingleAsset(asset)"
                :disabled="downloadingAssetKey === asset.storageKey"
                class="btn-keycap btn-keycap-mini btn-keycap-white px-2.5 py-1 text-[11px]"
              >
                <Loader2 v-if="downloadingAssetKey === asset.storageKey" class="w-3 h-3 animate-spin" :stroke-width="2.2" />
                <Download v-else class="w-3 h-3" :stroke-width="2.2" />
                <span>{{ downloadingAssetKey === asset.storageKey ? 'Mengunduh...' : 'Unduh' }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Multi-Format Batch ZIP Export Footer -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#111111]/10">
          <p class="text-xs text-[#60605e]">
            Pilih format ekspor (4 opsi) untuk mengunduh satuan atau mengemas seluruh aset ke dalam satu arsip ZIP.
          </p>

          <div class="flex flex-wrap items-center justify-end gap-2.5 shrink-0">
            <RetroSelect
              v-model="workbenchStore.downloadFormat"
              :options="WORKBENCH_EXPORT_FORMATS"
              :compact="true"
              :drop-up="true"
              aria-label="Pilih format ekspor hasil pemecahan aset"
            />

            <button
              type="button"
              @click="handleDownloadAllZip"
              :disabled="workbenchStore.isDownloadingZip"
              class="btn-keycap btn-keycap-yellow px-4 py-2.5 text-xs shrink-0"
            >
              <Loader2 v-if="workbenchStore.isDownloadingZip" class="w-4 h-4 animate-spin" :stroke-width="2" />
              <Archive v-else class="w-4 h-4" :stroke-width="2" />
              <span>{{ workbenchStore.isDownloadingZip ? 'Mengemas ZIP...' : 'Unduh Semua Aset (ZIP)' }}</span>
            </button>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
