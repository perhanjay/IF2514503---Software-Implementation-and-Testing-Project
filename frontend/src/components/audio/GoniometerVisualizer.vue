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

  // 1. Semi-transparent clear untuk phosphor trail persistence di kanvas kertas studio
  ctx.fillStyle = 'rgba(252, 252, 251, 0.34)'
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

      // Warna trace berkonras tinggi pada kanvas kertas terang:
      // rCorr >= 0.5: Studio Green (#16a34a)
      // 0 <= rCorr < 0.5: Signal Blue (#0284c7)
      // rCorr < 0: Critical Red (#e11d48)
      let traceColor = '#16a34a'
      if (rCorr < 0) {
        traceColor = '#e11d48'
      } else if (rCorr < 0.5) {
        traceColor = '#0284c7'
      }

      ctx.strokeStyle = traceColor
      ctx.shadowColor = 'rgba(17, 17, 17, 0.12)'
      ctx.shadowBlur = 2
      ctx.stroke()
      ctx.restore()
    }
  } else {
    correlationValue.value = 1.0
    // Gambar titik idle di pusat
    ctx.beginPath()
    ctx.arc(halfW, halfH, 2.5, 0, Math.PI * 2)
    ctx.fillStyle = '#16a34a'
    ctx.fill()
  }

  animId = requestAnimationFrame(draw)
}

function drawReticle(ctx, cx, cy, r) {
  ctx.save()

  // Lingkaran luar & konsentris
  ctx.strokeStyle = 'rgba(17, 17, 17, 0.16)'
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
  ctx.strokeStyle = 'rgba(17, 17, 17, 0.22)'
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
  ctx.fillStyle = '#111111'
  ctx.font = '700 9px "JetBrains Mono", ui-monospace, monospace'
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
  <div class="rounded-[14px] border-[1.5px] border-[#111111] bg-[#fcfcfb] shadow-[2px_3px_0_#111111] p-4 flex flex-col items-center select-none w-full max-w-[244px]">
    <div class="w-full flex items-center justify-between mb-2.5">
      <span class="font-sans text-[11px] font-bold uppercase tracking-wider text-[#60605e]">
        Goniometer (Lissajous)
      </span>
    </div>

    <!-- Crisp Light Studio Scope Viewport -->
    <div class="relative rounded-[12px] border-[1.5px] border-[#111111] bg-[#fcfcfb] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <canvas 
        ref="canvasRef" 
        :width="size" 
        :height="size" 
        class="rounded-[10px] bg-[#fcfcfb] block"
      />
    </div>

    <!-- Telemetry Correlation Bar (Matches Phase 02 Audit Diagnostik Design) -->
    <div class="w-full mt-3.5 pt-3 border-t border-[#111111]/12 space-y-2">
      <div class="flex items-center justify-between text-xs">
        <span class="font-sans text-[11px] font-bold uppercase tracking-wider text-[#60605e]">Korelasi Fasa</span>
        <span 
          class="inline-flex items-center rounded-full border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-2.5 py-0.5 font-telemetry font-bold text-[11px] text-[#111111] leading-none"
          :class="correlationValue >= 0.4 
            ? 'bg-[#5ad363]' 
            : correlationValue >= 0 
              ? 'bg-[#ffda40]' 
              : 'bg-[#ff82c2]'">
          {{ correlationValue >= 0 ? '+' : '' }}{{ correlationValue.toFixed(2) }}
        </span>
      </div>

      <!-- Light Pink-to-Green Meter Visual Bar [-1 to +1] -->
      <div class="relative h-2.5 w-full bg-[#eaeef4] rounded-full overflow-hidden border-[1.5px] border-[#111111]/20 flex">
        <!-- Negative Zone (-1 to 0) -->
        <div class="w-1/2 h-full flex justify-end bg-[#ff82c2]/35 border-r border-[#111111]/40">
          <div 
            v-if="correlationValue < 0" 
            class="h-full bg-[#ff6138] rounded-l-full transition-all duration-75"
            :style="{ width: `${Math.min(100, Math.abs(correlationValue) * 100)}%` }"
          />
        </div>
        <!-- Positive Zone (0 to +1) -->
        <div class="w-1/2 h-full flex justify-start bg-[#5ad363]/35">
          <div 
            v-if="correlationValue >= 0" 
            class="h-full rounded-r-full transition-all duration-75"
            :class="correlationValue >= 0.4 ? 'bg-[#5ad363]' : 'bg-[#20afff]'"
            :style="{ width: `${Math.min(100, correlationValue * 100)}%` }"
          />
        </div>
      </div>

      <div class="flex justify-between text-[10px] text-[#60605e] px-0.5 leading-none">
        <span class="text-rose-800 font-bold">
          <span class="font-telemetry">-1</span> <span class="font-sans">(Batal)</span>
        </span>
        <span class="font-telemetry font-bold text-[#111111]">0</span>
        <span class="text-emerald-800 font-bold">
          <span class="font-telemetry">+1</span> <span class="font-sans">(Mono)</span>
        </span>
      </div>
    </div>
  </div>
</template>
