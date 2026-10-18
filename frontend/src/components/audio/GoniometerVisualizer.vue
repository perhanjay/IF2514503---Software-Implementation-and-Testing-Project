<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  getData: {
    type: Function,
    required: true
  },
  isPlaying: {
    type: Boolean,
    default: false
  },
  size: {
    type: Number,
    default: 220
  }
})

const canvasRef = ref(null)
const correlationValue = ref(1.0)
let animId = null

const bufferSize = 512
const leftBuffer = new Float32Array(bufferSize)
const rightBuffer = new Float32Array(bufferSize)

function draw() {
  if (!canvasRef.value) return
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  const width = canvas.width
  const height = canvas.height
  const halfW = width / 2
  const halfH = height / 2
  const radius = Math.min(halfW, halfH) - 16

  // 1. Semi-transparent clear untuk phosphor trail persistence
  ctx.fillStyle = 'rgba(10, 15, 29, 0.28)'
  ctx.fillRect(0, 0, width, height)

  // 2. Gambar Reticle / Graticule Studio (Grid Konsentris & Sumbu 45°)
  drawReticle(ctx, halfW, halfH, radius)

  // 3. Render Lissajous Audio Trace jika sedang playing
  if (props.isPlaying && props.getData) {
    const hasData = props.getData(leftBuffer, rightBuffer)
    if (hasData) {
      let sumLR = 0
      let sumLL = 0
      let sumRR = 0
      const SQRT2 = Math.SQRT2

      ctx.save()
      ctx.lineWidth = 1.2
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'

      // Hitung korelasi fase dan gambar titik/garis Lissajous
      ctx.beginPath()
      let hasValidPoints = false

      for (let i = 0; i < bufferSize; i += 2) {
        const l = leftBuffer[i]
        const r = rightBuffer[i]

        sumLR += l * r
        sumLL += l * l
        sumRR += r * r

        // Rotasi 45 derajat (Sumbu Mid/Side):
        // X = (L - R) / sqrt(2) -> Stereo width (Side)
        // Y = (L + R) / sqrt(2) -> Mono energy (Mid)
        const xRot = (l - r) / SQRT2
        const yRot = (l + r) / SQRT2

        // Skala ke canvas (Y dibalik karena canvas 0 ada di atas)
        const px = halfW + xRot * radius * 1.3
        const py = halfH - yRot * radius * 1.3

        if (i === 0) {
          ctx.moveTo(px, py)
        } else {
          ctx.lineTo(px, py)
        }
        hasValidPoints = true
      }

      // Hitung koefisien korelasi Pearson r [-1 s.d. +1]
      const denom = Math.sqrt(sumLL * sumRR)
      let rCorr = 1.0
      if (denom > 0.00001) {
        rCorr = Math.max(-1.0, Math.min(1.0, sumLR / denom))
      }
      correlationValue.value = rCorr

      // Warna dinamis fosfor:
      // rCorr >= 0.5: Emerald green neon (#10b981)
      // 0 <= rCorr < 0.5: Cyan / Sky (#38bdf8)
      // rCorr < 0: Warning Amber / Rose (#f43f5e)
      let traceColor = '#10b981'
      if (rCorr < 0) {
        traceColor = '#f43f5e'
      } else if (rCorr < 0.5) {
        traceColor = '#38bdf8'
      }

      ctx.strokeStyle = traceColor
      ctx.shadowColor = traceColor
      ctx.shadowBlur = 4
      ctx.stroke()
      ctx.restore()
    }
  } else {
    correlationValue.value = 1.0
    // Gambar titik idle di pusat
    ctx.beginPath()
    ctx.arc(halfW, halfH, 2, 0, Math.PI * 2)
    ctx.fillStyle = '#10b981'
    ctx.fill()
  }

  animId = requestAnimationFrame(draw)
}

function drawReticle(ctx, cx, cy, r) {
  ctx.save()

  // Lingkaran luar & konsentris
  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 1

  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.66, 0, Math.PI * 2)
  ctx.setLineDash([2, 4])
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.33, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  // Sumbu L (Kiri Atas ke Kanan Bawah) & Sumbu R (Kanan Atas ke Kiri Bawah)
  const diagOffset = r * 0.7071
  ctx.strokeStyle = '#334155'
  ctx.lineWidth = 0.8

  // Sumbu Mid (Vertikal)
  ctx.beginPath()
  ctx.moveTo(cx, cy - r)
  ctx.lineTo(cx, cy + r)
  ctx.stroke()

  // Sumbu Side (Horizontal)
  ctx.beginPath()
  ctx.moveTo(cx - r, cy)
  ctx.lineTo(cx + r, cy)
  ctx.stroke()

  // Sumbu 45 deg L & R
  ctx.setLineDash([1, 3])
  ctx.beginPath()
  ctx.moveTo(cx - diagOffset, cy - diagOffset)
  ctx.lineTo(cx + diagOffset, cy + diagOffset)
  ctx.moveTo(cx + diagOffset, cy - diagOffset)
  ctx.lineTo(cx - diagOffset, cy + diagOffset)
  ctx.stroke()
  ctx.setLineDash([])

  // Label sumbu
  ctx.fillStyle = '#64748b'
  ctx.font = '9px ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.fillText('+M', cx, cy - r - 8)
  ctx.fillText('S', cx + r + 8, cy)
  ctx.fillText('+L', cx - diagOffset - 6, cy - diagOffset - 6)
  ctx.fillText('+R', cx + diagOffset + 6, cy - diagOffset - 6)

  ctx.restore()
}

onMounted(() => {
  draw()
})

onUnmounted(() => {
  if (animId) {
    cancelAnimationFrame(animId)
    animId = null
  }
})
</script>

<template>
  <div class="flex flex-col items-center bg-slate-950 p-3 rounded-xl border border-slate-800 shadow-inner select-none">
    <!-- Visualizer Canvas -->
    <div class="relative">
      <canvas 
        ref="canvasRef" 
        :width="size" 
        :height="size" 
        class="rounded-lg shadow-[inset_0_0_12px_rgba(0,0,0,0.8)]"
      />
      <!-- Scope CRT Glass Overlay Glare -->
      <div class="pointer-events-none absolute inset-0 rounded-lg bg-radial from-transparent via-transparent to-black/30" />
    </div>

    <!-- Telemetry Correlation Bar -->
    <div class="w-full mt-2.5 pt-2 border-t border-slate-800/80 space-y-1">
      <div class="flex items-center justify-between text-[10px] font-mono-accent">
        <span class="text-slate-400 font-semibold tracking-wider uppercase">Fase Korelasi</span>
        <span 
          class="font-bold text-[11px] px-1.5 py-0.5 rounded"
          :class="correlationValue >= 0.5 
            ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/60' 
            : correlationValue >= 0 
              ? 'text-sky-400 bg-sky-950/60 border border-sky-800/60' 
              : 'text-rose-400 bg-rose-950/60 border border-rose-800/60 animate-pulse'">
          {{ correlationValue >= 0 ? '+' : '' }}{{ correlationValue.toFixed(2) }}
        </span>
      </div>

      <!-- Meter Visual Bar [-1 to +1] -->
      <div class="relative h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800 flex">
        <!-- Negative Zone (-1 to 0) -->
        <div class="w-1/2 h-full flex justify-end bg-rose-950/30 border-r border-slate-700">
          <div 
            v-if="correlationValue < 0" 
            class="h-full bg-rose-500 rounded-l transition-all duration-75"
            :style="{ width: `${Math.min(100, Math.abs(correlationValue) * 100)}%` }"
          />
        </div>
        <!-- Positive Zone (0 to +1) -->
        <div class="w-1/2 h-full flex justify-start bg-emerald-950/30">
          <div 
            v-if="correlationValue >= 0" 
            class="h-full rounded-r transition-all duration-75"
            :class="correlationValue >= 0.5 ? 'bg-emerald-500' : 'bg-sky-400'"
            :style="{ width: `${Math.min(100, correlationValue * 100)}%` }"
          />
        </div>
      </div>

      <div class="flex justify-between text-[8px] font-mono-accent text-slate-500 px-0.5 leading-none">
        <span class="text-rose-400">-1 (Out Phase)</span>
        <span>0</span>
        <span class="text-emerald-400">+1 (Mono)</span>
      </div>
    </div>
  </div>
</template>
