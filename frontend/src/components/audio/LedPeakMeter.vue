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
    
    // Color mapping by zone
    // 0 to 6 (<= -3 dBFS): Safe green
    // 7 & 8 (-1.5 to -0.5 dBFS): Caution amber
    // 9 (>= 0 dBFS): Danger / Clipping Red
    let activeClass = 'bg-emerald-500'
    if (idx >= 7 && idx <= 8) {
      activeClass = 'bg-amber-400'
    } else if (idx === 9) {
      activeClass = 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]'
    }

    return {
      threshold: thresh,
      isLit,
      activeClass,
      inactiveClass: 'bg-slate-200/80'
    }
  })
})
</script>

<template>
  <div 
    class="w-full space-y-1 select-none"
    role="meter"
    :aria-valuenow="value !== null ? value : -60"
    aria-valuemin="-60"
    aria-valuemax="3"
    :aria-label="`True Peak Level: ${value !== null ? value.toFixed(1) : '-'} dBFS`">
    
    <!-- LED Segment Bar -->
    <div class="flex items-center gap-[2px] h-2 w-full bg-slate-100/90 p-[2px] rounded border border-slate-200/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]">
      <div 
        v-for="(seg, idx) in segments" 
        :key="idx"
        class="h-full flex-1 rounded-[1px] transition-colors duration-150"
        :class="seg.isLit ? seg.activeClass : seg.inactiveClass"
        :title="`${seg.threshold} dBFS`"
      />
    </div>

    <!-- Tick Scale Labels -->
    <div class="flex justify-between items-center text-[8px] font-mono-accent text-slate-400 px-0.5 leading-none">
      <span>-36</span>
      <span>-18</span>
      <span>-6</span>
      <span>0 dB</span>
    </div>
  </div>
</template>
