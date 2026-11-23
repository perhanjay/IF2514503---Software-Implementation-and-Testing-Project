<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  peaks: {
    type: Array,
    default: () => []
  },
  durationSec: {
    type: Number,
    default: 0
  },
  thresholdDb: {
    type: Number,
    default: -45
  },
  padMs: {
    type: Number,
    default: 100
  },
  manualStartSec: {
    type: Number,
    default: null
  },
  manualEndSec: {
    type: Number,
    default: null
  },
  currentTimeSec: {
    type: Number,
    default: 0
  },
  isPlaying: {
    type: Boolean,
    default: false
  },
  isTrimmedPreview: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['seek', 'update:manualStartSec', 'update:manualEndSec'])

const containerRef = ref(null)
const canvasRef = ref(null)
const canvasCssWidth = ref(0)
const canvasCssHeight = ref(0)
const hoverTarget = ref(null) // 'start' | 'end' | 'seek' | null

let resizeObserver = null
let dragMode = null // 'start' | 'end' | 'seek' | null
let rafId = null

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max)
}

function roundTime(val) {
  return Math.round(val * 1000) / 1000
}

function formatTimecode(seconds) {
  const safe = Math.max(0, Number(seconds) || 0)
  const mins = Math.floor(safe / 60)
  const secs = Math.floor(safe % 60)
  const tenths = Math.floor((safe % 1) * 10)
  return `${mins}:${String(secs).padStart(2, '0')}.${tenths}`
}

const thresholdAmp = computed(() => Math.pow(10, Number(props.thresholdDb) / 20))

const computedBounds = computed(() => {
  const dur = Number(props.durationSec) || 0
  const peaks = Array.isArray(props.peaks) ? props.peaks : []

  if (dur <= 0 || peaks.length === 0) {
    return { startSec: 0, endSec: dur, hasSignal: false }
  }

  if (props.isTrimmedPreview) {
    return { startSec: 0, endSec: dur, hasSignal: true }
  }

  const thresh = thresholdAmp.value
  let firstIdx = -1
  let lastIdx = -1

  for (let i = 0; i < peaks.length; i++) {
    if (Number(peaks[i]) > thresh) {
      if (firstIdx === -1) firstIdx = i
      lastIdx = i
    }
  }

  let autoStartSec = 0
  let autoEndSec = dur
  let hasSignal = true

  if (firstIdx === -1) {
    hasSignal = false
    autoStartSec = 0
    autoEndSec = 0
  } else {
    const firstActiveSec = (firstIdx / peaks.length) * dur
    const lastActiveSec = ((lastIdx + 1) / peaks.length) * dur
    const padSec = Math.max(0, (Number(props.padMs) || 0) / 1000)
    autoStartSec = clamp(firstActiveSec - padSec, 0, dur)
    autoEndSec = clamp(lastActiveSec + padSec, 0, dur)
  }

  let startSec = props.manualStartSec !== null && props.manualStartSec !== undefined
    ? clamp(Number(props.manualStartSec), 0, dur)
    : autoStartSec

  let endSec = props.manualEndSec !== null && props.manualEndSec !== undefined
    ? clamp(Number(props.manualEndSec), 0, dur)
    : autoEndSec

  if (startSec > endSec) {
    if (props.manualStartSec !== null && props.manualStartSec !== undefined && (props.manualEndSec === null || props.manualEndSec === undefined)) {
      endSec = startSec
    } else if (props.manualEndSec !== null && props.manualEndSec !== undefined && (props.manualStartSec === null || props.manualStartSec === undefined)) {
      startSec = endSec
    } else {
      const mid = (startSec + endSec) / 2
      startSec = mid
      endSec = mid
    }
  }

  return { startSec, endSec, hasSignal }
})

const rulerTicks = computed(() => {
  const dur = Number(props.durationSec) || 0
  const count = 5
  const ticks = []
  for (let i = 0; i <= count; i++) {
    const ratio = i / count
    ticks.push({
      percent: ratio * 100,
      label: formatTimecode(dur * ratio)
    })
  }
  return ticks
})

const cursorStyle = computed(() => {
  if (dragMode === 'start' || dragMode === 'end' || hoverTarget.value === 'start' || hoverTarget.value === 'end') {
    return 'ew-resize'
  }
  if ((Number(props.durationSec) || 0) > 0) {
    return 'pointer'
  }
  return 'default'
})

function getCanvasMetrics() {
  const width = canvasCssWidth.value
  const height = canvasCssHeight.value
  const dur = Number(props.durationSec) || 0
  const { startSec, endSec } = computedBounds.value
  const startX = dur > 0 ? (startSec / dur) * width : 0
  const endX = dur > 0 ? (endSec / dur) * width : width
  return { width, height, dur, startX, endX }
}

function drawRoundedBar(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fill()
}

function drawHandleTag(ctx, x, canvasWidth, label, alignRight = false) {
  const tagW = 30
  const tagH = 16
  const y = 4
  let boxX = alignRight ? x - tagW : x
  boxX = clamp(boxX, 2, Math.max(2, canvasWidth - tagW - 2))

  ctx.save()
  ctx.fillStyle = '#ff82c2'
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = 1.25

  drawRoundedBar(ctx, boxX, y, tagW, tagH, 4)
  ctx.stroke()

  ctx.fillStyle = '#111111'
  ctx.font = '700 9px "JetBrains Mono", ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, boxX + tagW / 2, y + tagH / 2 + 0.5)
  ctx.restore()
}

function renderCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  const width = canvasCssWidth.value
  const height = canvasCssHeight.value
  if (width <= 0 || height <= 0) return

  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  const targetW = Math.round(width * dpr)
  const targetH = Math.round(height * dpr)
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW
    canvas.height = targetH
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  // 1. Dark monitor surface
  ctx.fillStyle = '#18181b'
  ctx.fillRect(0, 0, width, height)

  const topPad = 24
  const bottomPad = 12
  const waveTop = topPad
  const waveHeight = Math.max(20, height - topPad - bottomPad)
  const centerY = waveTop + waveHeight / 2
  const maxHalfH = waveHeight / 2

  // 2. Grid lines (rgba(255,255,255,0.06))
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
  ctx.lineWidth = 1

  // Horizontal amplitude lines
  const hLines = [centerY, centerY - maxHalfH * 0.5, centerY + maxHalfH * 0.5, waveTop, waveTop + waveHeight]
  for (const ly of hLines) {
    ctx.beginPath()
    ctx.moveTo(0, Math.round(ly) + 0.5)
    ctx.lineTo(width, Math.round(ly) + 0.5)
    ctx.stroke()
  }

  // Vertical time grid lines aligned with 5-interval ruler
  const gridCols = 5
  for (let i = 1; i < gridCols; i++) {
    const gx = Math.round((i / gridCols) * width) + 0.5
    ctx.beginPath()
    ctx.moveTo(gx, 0)
    ctx.lineTo(gx, height)
    ctx.stroke()
  }

  const dur = Number(props.durationSec) || 0
  const peaks = Array.isArray(props.peaks) ? props.peaks : []

  if (peaks.length === 0 || dur <= 0) {
    ctx.fillStyle = '#a1a1aa'
    ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('MEMUAT SINYAL GELOMBANG...', width / 2, centerY - 12)
    ctx.restore()
    return
  }

  const { startX, endX } = getCanvasMetrics()

  // 3. Threshold horizontal reference guides when previewing cut zones
  if (!props.isTrimmedPreview) {
    const threshOffset = clamp(thresholdAmp.value, 0, 1) * maxHalfH
    if (threshOffset >= 1.5) {
      ctx.save()
      ctx.strokeStyle = 'rgba(255, 130, 194, 0.28)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 4])
      ctx.beginPath()
      ctx.moveTo(0, centerY - threshOffset)
      ctx.lineTo(width, centerY - threshOffset)
      ctx.moveTo(0, centerY + threshOffset)
      ctx.lineTo(width, centerY + threshOffset)
      ctx.stroke()
      ctx.restore()
    }
  }

  // 4. Waveform amplitude bars
  const barWidth = 2.5
  const barGap = 1.5
  const step = barWidth + barGap
  const barCount = Math.max(1, Math.floor(width / step))

  for (let i = 0; i < barCount; i++) {
    const x = i * step
    const binStart = Math.floor((i / barCount) * peaks.length)
    const binEnd = Math.max(binStart + 1, Math.floor(((i + 1) / barCount) * peaks.length))

    let peakVal = 0
    for (let j = binStart; j < binEnd && j < peaks.length; j++) {
      const val = Math.abs(Number(peaks[j]) || 0)
      if (val > peakVal) peakVal = val
    }
    peakVal = clamp(peakVal, 0, 1)

    const barCenterX = x + barWidth / 2
    const inDeadZone = !props.isTrimmedPreview && (barCenterX < startX || barCenterX > endX)

    if (props.isTrimmedPreview) {
      ctx.fillStyle = '#5ad363'
    } else if (inDeadZone) {
      ctx.fillStyle = 'rgba(32, 175, 255, 0.32)'
    } else {
      ctx.fillStyle = '#20afff'
    }

    const barH = Math.max(2, peakVal * waveHeight * 0.94)
    const barY = centerY - barH / 2
    drawRoundedBar(ctx, x, barY, barWidth, barH, 1.25)
  }

  // 5. Shaded dead zones + dashed cut boundary lines + draggable handle tabs
  if (!props.isTrimmedPreview) {
    // Lead-in shaded dead zone
    if (startX > 0.5) {
      ctx.fillStyle = 'rgba(255, 130, 194, 0.22)'
      ctx.fillRect(0, 0, startX, height)
    }

    // Tail shaded dead zone
    if (endX < width - 0.5) {
      ctx.fillStyle = 'rgba(255, 130, 194, 0.22)'
      ctx.fillRect(endX, 0, width - endX, height)
    }

    // Dashed cut boundary lines
    ctx.save()
    ctx.strokeStyle = '#ff82c2'
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 4])

    const drawBoundaryLine = (bx) => {
      const clampedBx = clamp(bx, 0.75, width - 0.75)
      ctx.beginPath()
      ctx.moveTo(clampedBx, 0)
      ctx.lineTo(clampedBx, height)
      ctx.stroke()
    }

    drawBoundaryLine(startX)
    drawBoundaryLine(endX)
    ctx.restore()

    // Draggable handle tags
    drawHandleTag(ctx, startX, width, 'IN', false)
    drawHandleTag(ctx, endX, width, 'OUT', true)
  }

  // 6. Sun Yellow Playhead Cursor (#ffda40)
  const playRatio = clamp((Number(props.currentTimeSec) || 0) / dur, 0, 1)
  const playheadX = clamp(playRatio * width, 1, width - 1)

  ctx.save()
  if (props.isPlaying) {
    ctx.shadowColor = 'rgba(255, 218, 64, 0.65)'
    ctx.shadowBlur = 6
  }
  ctx.strokeStyle = '#ffda40'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(playheadX, 0)
  ctx.lineTo(playheadX, height)
  ctx.stroke()

  // Playhead cap triangle
  ctx.fillStyle = '#ffda40'
  ctx.beginPath()
  ctx.moveTo(playheadX - 5, 0)
  ctx.lineTo(playheadX + 5, 0)
  ctx.lineTo(playheadX, 7)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  ctx.restore()
}

function scheduleRender() {
  if (rafId !== null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    renderCanvas()
  })
}

function getLocalPoint(e) {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  return {
    x: clamp(e.clientX - rect.left, 0, rect.width),
    y: clamp(e.clientY - rect.top, 0, rect.height)
  }
}

function hitTestHandle(x, y) {
  if (props.isTrimmedPreview || (Number(props.durationSec) || 0) <= 0) {
    return null
  }
  const { width, startX, endX } = getCanvasMetrics()
  const lineRadius = 10

  const inTopHandleBand = y <= 24
  const startTabX = clamp(startX, 2, Math.max(2, width - 32))
  const endTabX = clamp(endX - 30, 2, Math.max(2, width - 32))

  const hitStartTab = inTopHandleBand && x >= startTabX - 4 && x <= startTabX + 34
  const hitEndTab = inTopHandleBand && x >= endTabX - 4 && x <= endTabX + 34

  const distStart = Math.abs(x - startX)
  const distEnd = Math.abs(x - endX)

  if (hitStartTab && hitEndTab) {
    return distStart <= distEnd ? 'start' : 'end'
  }
  if (hitStartTab) return 'start'
  if (hitEndTab) return 'end'

  if (distStart <= lineRadius && distEnd <= lineRadius) {
    return distStart <= distEnd ? 'start' : 'end'
  }
  if (distStart <= lineRadius) return 'start'
  if (distEnd <= lineRadius) return 'end'

  return null
}

function applyPointerDrag(clientX) {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const width = rect.width
  const dur = Number(props.durationSec) || 0
  if (width <= 0 || dur <= 0) return

  const x = clamp(clientX - rect.left, 0, width)
  const rawTime = (x / width) * dur
  const minGap = Math.min(0.05, dur * 0.01)

  if (dragMode === 'start') {
    const maxStart = Math.max(0, computedBounds.value.endSec - minGap)
    const nextStart = roundTime(clamp(rawTime, 0, maxStart))
    emit('update:manualStartSec', nextStart)
  } else if (dragMode === 'end') {
    const minEnd = Math.min(dur, computedBounds.value.startSec + minGap)
    const nextEnd = roundTime(clamp(rawTime, minEnd, dur))
    emit('update:manualEndSec', nextEnd)
  } else if (dragMode === 'seek') {
    emit('seek', roundTime(clamp(rawTime, 0, dur)))
  }
}

function handleWindowPointerMove(e) {
  if (!dragMode) return
  applyPointerDrag(e.clientX)
}

function stopDragging() {
  dragMode = null
  window.removeEventListener('pointermove', handleWindowPointerMove)
  window.removeEventListener('pointerup', stopDragging)
  window.removeEventListener('pointercancel', stopDragging)
}

function handlePointerDown(e) {
  if ((Number(props.durationSec) || 0) <= 0) return
  const { x, y } = getLocalPoint(e)
  const handle = hitTestHandle(x, y)
  dragMode = handle || 'seek'
  applyPointerDrag(e.clientX)

  window.addEventListener('pointermove', handleWindowPointerMove)
  window.addEventListener('pointerup', stopDragging)
  window.addEventListener('pointercancel', stopDragging)
}

function handlePointerMove(e) {
  if (dragMode) return
  const { x, y } = getLocalPoint(e)
  hoverTarget.value = hitTestHandle(x, y) || ((Number(props.durationSec) || 0) > 0 ? 'seek' : null)
}

function handlePointerLeave() {
  if (!dragMode) {
    hoverTarget.value = null
  }
}

function updateCanvasSize() {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  canvasCssWidth.value = Math.max(0, Math.floor(rect.width))
  canvasCssHeight.value = Math.max(0, Math.floor(rect.height))
  scheduleRender()
}

watch(
  () => [
    props.peaks,
    props.durationSec,
    props.thresholdDb,
    props.padMs,
    props.manualStartSec,
    props.manualEndSec,
    props.currentTimeSec,
    props.isPlaying,
    props.isTrimmedPreview
  ],
  () => {
    scheduleRender()
  },
  { deep: true }
)

onMounted(() => {
  updateCanvasSize()
  if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateCanvasSize()
    })
    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
  stopDragging()
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
})
</script>

<template>
  <div
    class="retro-monitor p-3 sm:p-4 select-none"
    role="region"
    aria-label="Monitor Bentuk Gelombang Pemangkas Hening"
  >
    <!-- Top JetBrains Mono Time Ruler Overlay -->
    <div class="relative h-5 border-b border-white/10 mb-1.5 flex items-end">
      <div
        v-for="(tick, idx) in rulerTicks"
        :key="idx"
        class="absolute bottom-1 font-telemetry text-[10px] leading-none text-[#a1a1aa] tabular-nums pointer-events-none"
        :style="{
          left: `${tick.percent}%`,
          transform: idx === 0 ? 'translateX(0%)' : idx === rulerTicks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)'
        }"
      >
        {{ tick.label }}
      </div>
    </div>

    <!-- HiDPI Interactive Waveform Canvas -->
    <div ref="containerRef" class="relative w-full h-44 sm:h-52 overflow-hidden rounded-[8px]">
      <canvas
        ref="canvasRef"
        class="block w-full h-full touch-none"
        :style="{ cursor: cursorStyle }"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerleave="handlePointerLeave"
      />
    </div>

    <!-- Bottom Telemetry Readout Strip -->
    <div class="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px]">
      <div class="flex flex-wrap items-center gap-3">
        <span v-if="!isTrimmedPreview" class="inline-flex items-center gap-1.5 text-[#a1a1aa]">
          <span class="w-2 h-2 rounded-full bg-[#20afff]"></span>
          <span>Sinyal Aktif</span>
        </span>
        <span v-else class="inline-flex items-center gap-1.5 text-[#5ad363] font-semibold">
          <span class="w-2 h-2 rounded-full bg-[#5ad363]"></span>
          <span>Pratinjau Hasil Pangkas</span>
        </span>
        <span v-if="!isTrimmedPreview" class="inline-flex items-center gap-1.5 text-[#a1a1aa]">
          <span class="w-2 h-2 rounded-full bg-[#ff82c2]"></span>
          <span>Zona Hening (Dibuang)</span>
        </span>
        <span class="inline-flex items-center gap-1.5 text-[#a1a1aa]">
          <span class="w-2 h-2 rounded-full bg-[#ffda40]"></span>
          <span>Playhead</span>
        </span>
      </div>

      <div class="flex items-center gap-3 font-telemetry tabular-nums text-[11px]">
        <span v-if="!isTrimmedPreview && durationSec > 0" class="text-[#ff82c2]">
          IN {{ formatTimecode(computedBounds.startSec) }} – OUT {{ formatTimecode(computedBounds.endSec) }}
        </span>
        <span class="text-[#ffda40]">
          {{ formatTimecode(currentTimeSec) }} / {{ formatTimecode(durationSec) }}
        </span>
      </div>
    </div>
  </div>
</template>
