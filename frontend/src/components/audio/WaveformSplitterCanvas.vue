<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const MIN_REGION_DURATION_SEC = 0.05

const props = defineProps({
  peaks: {
    type: Array,
    default: () => []
  },
  durationSec: {
    type: Number,
    default: 0
  },
  regions: {
    type: Array,
    default: () => []
  },
  selectedRegionId: {
    type: String,
    default: null
  },
  toolMode: {
    type: String,
    default: 'select',
    validator: (v) => v === 'select' || v === 'split'
  },
  currentTimeSec: {
    type: Number,
    default: 0
  },
  isPlaying: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['seek', 'selectRegion', 'updateRegionBounds', 'splitRegionAt'])

const containerRef = ref(null)
const canvasRef = ref(null)
const canvasCssWidth = ref(0)
const canvasCssHeight = ref(0)
const hoverTarget = ref(null) // 'start' | 'end' | 'seek' | 'split-valid' | 'split-invalid' | null
const hoverSplit = ref({ valid: false, x: 0, timeSec: 0, regionId: null })

let resizeObserver = null
let dragMode = null // 'start' | 'end' | 'seek' | null
let dragRegionId = null
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

const sortedRegions = computed(() => {
  const dur = Number(props.durationSec) || 0
  if (!Array.isArray(props.regions) || dur <= 0) return []
  return props.regions
    .filter((r) => r && r.id != null)
    .map((r) => {
      const startSec = clamp(Number(r.startSec) || 0, 0, dur)
      const endSec = clamp(Number(r.endSec) || 0, startSec, dur)
      return {
        ...r,
        startSec,
        endSec
      }
    })
    .filter((r) => r.endSec > r.startSec)
    .sort((a, b) => a.startSec - b.startSec || a.endSec - b.endSec)
})

const selectedRegionIndex = computed(() => {
  if (!props.selectedRegionId) return -1
  return sortedRegions.value.findIndex((r) => r.id === props.selectedRegionId)
})

const selectedRegion = computed(() => {
  if (selectedRegionIndex.value < 0) return null
  return sortedRegions.value[selectedRegionIndex.value] || null
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

const bladeCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Cpath d='M10 1v18M5 6l5-5 5 5' stroke='%23111111' stroke-width='1.8' fill='none' stroke-linecap='round'/%3E%3Ccircle cx='10' cy='10' r='2.2' fill='%23db2777'/%3E%3C/svg%3E") 10 10, crosshair`

const cursorStyle = computed(() => {
  if ((Number(props.durationSec) || 0) <= 0) return 'default'
  if (props.toolMode === 'split') {
    return hoverTarget.value === 'split-valid' ? bladeCursor : 'crosshair'
  }
  if (dragMode === 'start' || dragMode === 'end' || hoverTarget.value === 'start' || hoverTarget.value === 'end') {
    return 'ew-resize'
  }
  return 'pointer'
})

function timeToX(timeSec, width, dur) {
  if (dur <= 0 || width <= 0) return 0
  return clamp((timeSec / dur) * width, 0, width)
}

function findRegionAtTime(timeSec) {
  for (const r of sortedRegions.value) {
    if (timeSec >= r.startSec && timeSec <= r.endSec) {
      return r
    }
  }
  return null
}

function drawRoundedRect(ctx, x, y, w, h, radius) {
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

  drawRoundedRect(ctx, boxX, y, tagW, tagH, 4)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#111111'
  ctx.font = '700 9px "JetBrains Mono", ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, boxX + tagW / 2, y + tagH / 2 + 0.5)
  ctx.restore()
}

function drawRegionBadge(ctx, boxX, boxY, boxW, label, isSelected) {
  const tagH = 16
  ctx.save()
  ctx.fillStyle = isSelected ? '#111111' : '#ffffff'
  ctx.strokeStyle = isSelected ? '#111111' : '#db2777'
  ctx.lineWidth = 1.1

  drawRoundedRect(ctx, boxX, boxY, boxW, tagH, 4)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = isSelected ? '#ffffff' : '#be185d'
  ctx.font = '700 9px "JetBrains Mono", ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, boxX + boxW / 2, boxY + tagH / 2 + 0.5)
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

  // 1. Light studio paper surface (#fcfcfb)
  ctx.fillStyle = '#fcfcfb'
  ctx.fillRect(0, 0, width, height)

  const topPad = 24
  const bottomPad = 12
  const waveTop = topPad
  const waveHeight = Math.max(20, height - topPad - bottomPad)
  const centerY = waveTop + waveHeight / 2
  const maxHalfH = waveHeight / 2

  // 2. Crisp light-paper grid lines
  ctx.strokeStyle = 'rgba(17, 17, 17, 0.08)'
  ctx.lineWidth = 1

  const hLines = [centerY, centerY - maxHalfH * 0.5, centerY + maxHalfH * 0.5, waveTop, waveTop + waveHeight]
  for (const ly of hLines) {
    ctx.beginPath()
    ctx.moveTo(0, Math.round(ly) + 0.5)
    ctx.lineTo(width, Math.round(ly) + 0.5)
    ctx.stroke()
  }

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
    ctx.fillStyle = '#60605e'
    ctx.font = '600 11px "JetBrains Mono", ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('MEMUAT SINYAL GELOMBANG...', width / 2, centerY - 12)
    ctx.restore()
    return
  }

  const regionSpans = sortedRegions.value.map((r, idx) => ({
    ...r,
    idx,
    label: String(idx + 1).padStart(2, '0'),
    startX: timeToX(r.startSec, width, dur),
    endX: timeToX(r.endSec, width, dur),
    isSelected: r.id === props.selectedRegionId
  }))

  // 3. Subtle tint behind selected region
  const activeSpan = regionSpans.find((r) => r.isSelected)
  if (activeSpan && activeSpan.endX - activeSpan.startX > 0.5) {
    ctx.fillStyle = 'rgba(2, 132, 199, 0.06)'
    ctx.fillRect(activeSpan.startX, 0, activeSpan.endX - activeSpan.startX, height)
  }

  // 4. Waveform amplitude bars (Signal Blue inside regions, dimmed in silence gaps)
  const barWidth = 2.5
  const barGap = 1.5
  const step = barWidth + barGap
  const barCount = Math.max(1, Math.floor(width / step))

  let spanCursor = 0
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
    while (spanCursor < regionSpans.length && regionSpans[spanCursor].endX < barCenterX) {
      spanCursor++
    }
    const inActiveRegion =
      spanCursor < regionSpans.length &&
      barCenterX >= regionSpans[spanCursor].startX &&
      barCenterX <= regionSpans[spanCursor].endX

    ctx.fillStyle = inActiveRegion ? '#0284c7' : 'rgba(2, 132, 199, 0.25)'

    const barH = Math.max(2, peakVal * waveHeight * 0.94)
    const barY = centerY - barH / 2
    drawRoundedRect(ctx, x, barY, barWidth, barH, 1.25)
    ctx.fill()
  }

  // 5. Pink silence shading outside & between regions
  ctx.fillStyle = 'rgba(255, 130, 194, 0.28)'
  if (regionSpans.length === 0) {
    ctx.fillRect(0, 0, width, height)
  } else {
    let cursorX = 0
    for (const span of regionSpans) {
      if (span.startX - cursorX > 0.5) {
        ctx.fillRect(cursorX, 0, span.startX - cursorX, height)
      }
      cursorX = Math.max(cursorX, span.endX)
    }
    if (width - cursorX > 0.5) {
      ctx.fillRect(cursorX, 0, width - cursorX, height)
    }
  }

  // 6. Dashed vertical region boundaries (#db2777)
  ctx.save()
  ctx.strokeStyle = '#db2777'
  ctx.setLineDash([5, 4])

  const drawBoundaryLine = (bx, lineWidth) => {
    const clampedBx = clamp(bx, 0.75, width - 0.75)
    ctx.lineWidth = lineWidth
    ctx.beginPath()
    ctx.moveTo(clampedBx, 0)
    ctx.lineTo(clampedBx, height)
    ctx.stroke()
  }

  for (const span of regionSpans) {
    const lw = span.isSelected ? 1.75 : 1.25
    drawBoundaryLine(span.startX, lw)
    drawBoundaryLine(span.endX, lw)
  }
  ctx.restore()

  // 7. Numbered region badge pills (anti-clutter: skip overlapping badges in dense timelines)
  let lastBadgeRight = -Infinity
  const selectedStartX = activeSpan ? activeSpan.startX : -1
  const selectedEndX = activeSpan ? activeSpan.endX : -1

  for (const span of regionSpans) {
    if (span.isSelected) continue
    const regionW = span.endX - span.startX
    if (regionW < 22) continue

    const badgeW = span.label.length > 2 ? 26 : 22
    const badgeX = clamp(span.startX + 4, 2, Math.max(2, width - badgeW - 2))
    const badgeRight = badgeX + badgeW

    // Avoid colliding with neighboring unselected badges or the active IN/OUT handle pills
    if (badgeX < lastBadgeRight + 3) continue
    if (activeSpan) {
      const inTagX = clamp(selectedStartX, 2, Math.max(2, width - 32))
      const outTagX = clamp(selectedEndX - 30, 2, Math.max(2, width - 32))
      if (
        (badgeX < inTagX + 32 && badgeRight > inTagX - 2) ||
        (badgeX < outTagX + 32 && badgeRight > outTagX - 2)
      ) {
        continue
      }
    }

    drawRegionBadge(ctx, badgeX, 4, badgeW, span.label, false)
    lastBadgeRight = badgeRight
  }

  // 8. Selected region draggable IN / OUT pink handle pills + active numbered badge
  if (activeSpan) {
    drawHandleTag(ctx, activeSpan.startX, width, 'IN', false)
    drawHandleTag(ctx, activeSpan.endX, width, 'OUT', true)

    const badgeW = activeSpan.label.length > 2 ? 26 : 22
    const activeW = activeSpan.endX - activeSpan.startX
    if (activeW >= 92) {
      const badgeX = clamp(activeSpan.startX + 33, 2, Math.max(2, width - badgeW - 2))
      drawRegionBadge(ctx, badgeX, 4, badgeW, activeSpan.label, true)
    } else {
      const badgeX = clamp(activeSpan.startX + 4, 2, Math.max(2, width - badgeW - 2))
      drawRegionBadge(ctx, badgeX, 24, badgeW, activeSpan.label, true)
    }
  }

  // 9. Blade hover preview guide in split mode
  if (props.toolMode === 'split' && hoverSplit.value.valid) {
    const gx = clamp(hoverSplit.value.x, 1, width - 1)
    ctx.save()
    ctx.strokeStyle = 'rgba(219, 39, 119, 0.78)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(gx, 0)
    ctx.lineTo(gx, height)
    ctx.stroke()

    ctx.setLineDash([])
    ctx.fillStyle = '#db2777'
    ctx.beginPath()
    ctx.moveTo(gx, 2)
    ctx.lineTo(gx + 4, 7)
    ctx.lineTo(gx, 12)
    ctx.lineTo(gx - 4, 7)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  // 10. Ember Orange Playhead Cursor (#ff5a2c)
  const playRatio = clamp((Number(props.currentTimeSec) || 0) / dur, 0, 1)
  const playheadX = clamp(playRatio * width, 1, width - 1)

  ctx.save()
  if (props.isPlaying) {
    ctx.shadowColor = 'rgba(255, 90, 44, 0.4)'
    ctx.shadowBlur = 5
  }
  ctx.strokeStyle = '#ff5a2c'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(playheadX, 0)
  ctx.lineTo(playheadX, height)
  ctx.stroke()

  ctx.fillStyle = '#ff5a2c'
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
  if (!canvas) return { x: 0, y: 0, width: 0 }
  const rect = canvas.getBoundingClientRect()
  return {
    x: clamp(e.clientX - rect.left, 0, rect.width),
    y: clamp(e.clientY - rect.top, 0, rect.height),
    width: rect.width
  }
}

function hitTestSelectedHandles(x, y) {
  if (props.toolMode !== 'select') return null
  const region = selectedRegion.value
  const dur = Number(props.durationSec) || 0
  const width = canvasCssWidth.value
  if (!region || dur <= 0 || width <= 0) return null

  const startX = timeToX(region.startSec, width, dur)
  const endX = timeToX(region.endSec, width, dur)
  const lineRadius = 10

  const inTopHandleBand = y <= 24
  const startTabX = clamp(startX, 2, Math.max(2, width - 32))
  const endTabX = clamp(endX - 30, 2, Math.max(2, width - 32))

  const hitStartTab = inTopHandleBand && x >= startTabX - 4 && x <= startTabX + 34
  const hitEndTab = inTopHandleBand && x >= endTabX - 4 && x <= endTabX + 34

  const distStart = Math.abs(x - startX)
  const distEnd = Math.abs(x - endX)

  const pickTie = () => {
    if (Math.abs(startX - endX) < 0.5) {
      if (x !== startX) return x > startX ? 'end' : 'start'
      return startX < width * 0.5 ? 'end' : 'start'
    }
    return distStart <= distEnd ? 'start' : 'end'
  }

  if (hitStartTab && hitEndTab) return pickTie()
  if (hitStartTab) return 'start'
  if (hitEndTab) return 'end'

  if (distStart <= lineRadius && distEnd <= lineRadius) return pickTie()
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

  if (dragMode === 'start' || dragMode === 'end') {
    const list = sortedRegions.value
    const idx = list.findIndex((r) => r.id === dragRegionId)
    if (idx < 0) return
    const region = list[idx]
    const prevRegion = idx > 0 ? list[idx - 1] : null
    const nextRegion = idx < list.length - 1 ? list[idx + 1] : null

    const prevEnd = prevRegion ? clamp(prevRegion.endSec, 0, dur) : 0
    const nextStart = nextRegion ? clamp(nextRegion.startSec, 0, dur) : dur

    if (dragMode === 'start') {
      const maxStart = Math.max(prevEnd, region.endSec - MIN_REGION_DURATION_SEC)
      const nextStartSec = roundTime(clamp(rawTime, prevEnd, maxStart))
      emit('updateRegionBounds', {
        id: region.id,
        startSec: nextStartSec,
        endSec: roundTime(region.endSec)
      })
    } else {
      const minEnd = Math.min(nextStart, region.startSec + MIN_REGION_DURATION_SEC)
      const nextEndSec = roundTime(clamp(rawTime, minEnd, nextStart))
      emit('updateRegionBounds', {
        id: region.id,
        startSec: roundTime(region.startSec),
        endSec: nextEndSec
      })
    }
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
  dragRegionId = null
  window.removeEventListener('pointermove', handleWindowPointerMove)
  window.removeEventListener('pointerup', stopDragging)
  window.removeEventListener('pointercancel', stopDragging)
}

function handlePointerDown(e) {
  if (typeof e.button === 'number' && e.button !== 0) return
  const dur = Number(props.durationSec) || 0
  if (dur <= 0) return
  const { x, y, width } = getLocalPoint(e)
  if (width <= 0) return

  const rawTime = (x / width) * dur

  if (props.toolMode === 'split') {
    const hitRegion = findRegionAtTime(rawTime)
    if (
      hitRegion &&
      rawTime >= hitRegion.startSec + MIN_REGION_DURATION_SEC &&
      rawTime <= hitRegion.endSec - MIN_REGION_DURATION_SEC
    ) {
      emit('splitRegionAt', {
        id: hitRegion.id,
        timeSec: roundTime(rawTime)
      })
    }
    return
  }

  const handle = hitTestSelectedHandles(x, y)
  if (handle && selectedRegion.value) {
    dragMode = handle
    dragRegionId = selectedRegion.value.id
    applyPointerDrag(e.clientX)
  } else {
    const hitRegion = findRegionAtTime(rawTime)
    if (hitRegion) {
      if (hitRegion.id !== props.selectedRegionId) {
        emit('selectRegion', hitRegion.id)
      }
    } else if (props.selectedRegionId !== null) {
      emit('selectRegion', null)
    }
    dragMode = 'seek'
    dragRegionId = null
    applyPointerDrag(e.clientX)
  }

  window.addEventListener('pointermove', handleWindowPointerMove)
  window.addEventListener('pointerup', stopDragging)
  window.addEventListener('pointercancel', stopDragging)
}

function handlePointerMove(e) {
  if (dragMode) return
  const dur = Number(props.durationSec) || 0
  if (dur <= 0) {
    hoverTarget.value = null
    if (hoverSplit.value.valid) {
      hoverSplit.value = { valid: false, x: 0, timeSec: 0, regionId: null }
      scheduleRender()
    }
    return
  }

  const { x, y, width } = getLocalPoint(e)
  if (width <= 0) return

  if (props.toolMode === 'split') {
    const rawTime = (x / width) * dur
    const hitRegion = findRegionAtTime(rawTime)
    const isValid = Boolean(
      hitRegion &&
      rawTime >= hitRegion.startSec + MIN_REGION_DURATION_SEC &&
      rawTime <= hitRegion.endSec - MIN_REGION_DURATION_SEC
    )

    hoverTarget.value = isValid ? 'split-valid' : 'split-invalid'
    hoverSplit.value = isValid
      ? { valid: true, x, timeSec: roundTime(rawTime), regionId: hitRegion.id }
      : { valid: false, x: 0, timeSec: 0, regionId: null }
    scheduleRender()
    return
  }

  if (hoverSplit.value.valid) {
    hoverSplit.value = { valid: false, x: 0, timeSec: 0, regionId: null }
    scheduleRender()
  }
  hoverTarget.value = hitTestSelectedHandles(x, y) || 'seek'
}

function handlePointerLeave() {
  if (!dragMode) {
    hoverTarget.value = null
  }
  if (hoverSplit.value.valid) {
    hoverSplit.value = { valid: false, x: 0, timeSec: 0, regionId: null }
    scheduleRender()
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
  () => [props.peaks, props.peaks?.length],
  () => {
    scheduleRender()
  }
)

watch(
  () => props.regions,
  () => {
    scheduleRender()
  },
  { deep: true }
)

watch(
  () => [
    props.durationSec,
    props.selectedRegionId,
    props.toolMode,
    props.currentTimeSec,
    props.isPlaying
  ],
  () => {
    if (props.toolMode !== 'split' && hoverSplit.value.valid) {
      hoverSplit.value = { valid: false, x: 0, timeSec: 0, regionId: null }
    }
    scheduleRender()
  }
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
    class="rounded-[14px] border-[1.5px] border-[#111111] bg-white/96 shadow-[2px_3px_0_#111111] p-3.5 sm:p-4 select-none"
    role="region"
    aria-label="Monitor Bentuk Gelombang Pemecah Aset Multi-Region"
  >
    <!-- Top JetBrains Mono Time Ruler Overlay -->
    <div class="relative h-5 border-b border-[#111111]/15 mb-2 flex items-end">
      <div
        v-for="(tick, idx) in rulerTicks"
        :key="idx"
        class="absolute bottom-1 font-telemetry text-[10px] font-bold leading-none text-[#60605e] tabular-nums pointer-events-none"
        :style="{
          left: `${tick.percent}%`,
          transform: idx === 0 ? 'translateX(0%)' : idx === rulerTicks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)'
        }"
      >
        {{ tick.label }}
      </div>
    </div>

    <!-- HiDPI Interactive Waveform Canvas -->
    <div ref="containerRef" class="relative w-full h-44 sm:h-52 overflow-hidden rounded-[10px] border-[1.5px] border-[#111111] bg-[#fcfcfb]">
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
    <div class="mt-3 pt-2.5 border-t border-[#111111]/12 flex flex-wrap items-center justify-between gap-2 text-[11px]">
      <div class="flex flex-wrap items-center gap-3">
        <span class="inline-flex items-center gap-1.5 text-[#60605e] font-medium">
          <span class="w-2.5 h-2.5 rounded-full bg-[#0284c7] border border-[#111111]/40"></span>
          <span>Segmen Aktif</span>
        </span>
        <span class="inline-flex items-center gap-1.5 text-[#60605e] font-medium">
          <span class="w-2.5 h-2.5 rounded-full bg-[#db2777] border border-[#111111]/40"></span>
          <span>Zona Dibuang / Batas</span>
        </span>
        <span class="inline-flex items-center gap-1.5 text-[#60605e] font-medium">
          <span class="w-2.5 h-2.5 rounded-full bg-[#ff5a2c] border border-[#111111]/40"></span>
          <span>Playhead</span>
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-3 font-telemetry font-bold tabular-nums text-[11px]">
        <span v-if="selectedRegion && durationSec > 0" class="text-[#be185d]">
          #{{ String(selectedRegionIndex + 1).padStart(2, '0') }} IN {{ formatTimecode(selectedRegion.startSec) }} – OUT {{ formatTimecode(selectedRegion.endSec) }}
        </span>
        <span v-else-if="durationSec > 0" class="text-[#60605e]">
          {{ sortedRegions.length }} Region
        </span>
        <span class="text-[#111111]">
          {{ formatTimecode(currentTimeSec) }} / {{ formatTimecode(durationSec) }}
        </span>
      </div>
    </div>
  </div>
</template>
