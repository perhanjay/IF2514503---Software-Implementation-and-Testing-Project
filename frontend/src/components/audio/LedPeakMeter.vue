<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: {
    type: Number,
    default: null
  },
  isClipped: {
    type: Boolean,
    default: false
  },
  segmentsCount: {
    type: Number,
    default: 10
  }
})

// Segment calibration thresholds (in dBFS)
// -36, -24, -18, -12, -9, -6, -3, -1.5, -0.5, 0 (Clip)
const thresholds = [-36, -24, -18, -12, -9, -6, -3, -1.5, -0.5, 0]

const segments = computed(() => {
  const currentVal = props.value !== null ? props.value : -60

  return thresholds.map((thresh, idx) => {
    const isLit = currentVal >= thresh || (idx === 9 && props.isClipped)
    
    // Color mapping by zone (high-contrast on light studio meter slot)
    // 0 to 6 (<= -3 dBFS): Safe crisp green
    // 7 & 8 (-1.5 to -0.5 dBFS): Caution amber
    // 9 (>= 0 dBFS): Danger / Clipping Crimson
    let activeClass = 'bg-[#22c55e] border border-[#111111]/35'
    if (idx >= 7 && idx <= 8) {
      activeClass = 'bg-[#ffda40] border border-[#111111]/45'
    } else if (idx === 9) {
      activeClass = 'bg-[#ef4444] border border-[#111111]/45 shadow-[0_0_5px_rgba(239,68,68,0.45)]'
    }

    return {
      threshold: thresh,
      isLit,
      activeClass,
      inactiveClass: 'bg-[#d4d4d0]/75'
    }
  })
})
</script>

<template>
  <div 
    class="w-full bg-[#f5f3eb] border-[1.5px] border-[#111111] rounded-[10px] px-2.5 py-2 space-y-1.5 select-none shadow-[1px_1.5px_0_#111111]"
    role="meter"
    :aria-valuenow="value !== null ? value : -60"
    aria-valuemin="-60"
    aria-valuemax="3"
    :aria-label="`True Peak Level: ${value !== null ? value.toFixed(1) : '-'} dBFS`">
    
    <!-- LED Segment Bar -->
    <div class="flex items-center gap-[3px] h-3 w-full bg-[#eaeef4] p-[2.5px] rounded-[6px] border border-[#111111]/25">
      <div 
        v-for="(seg, idx) in segments" 
        :key="idx"
        class="h-full flex-1 rounded-[2.5px] transition-colors duration-150"
        :class="seg.isLit ? seg.activeClass : seg.inactiveClass"
        :title="`${seg.threshold} dBFS`"
      />
    </div>

    <!-- Tick Scale Labels -->
    <div class="flex justify-between items-center text-[9px] font-telemetry font-bold text-[#60605e] px-0.5 leading-none">
      <span>-36</span>
      <span>-18</span>
      <span>-6</span>
      <span>0 dB</span>
    </div>
  </div>
</template>
