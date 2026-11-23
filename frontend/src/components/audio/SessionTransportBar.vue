<script setup>
import { computed } from 'vue'

const props = defineProps({
  session: {
    type: Object,
    required: true
  }
})

const stereoCount = computed(() => {
  return props.session.tracks?.filter(t => t.isStereo).length || 0
})

const monoCount = computed(() => {
  return props.session.tracks?.filter(t => !t.isStereo).length || 0
})

const totalTracks = computed(() => {
  return props.session.tracks?.length || 0
})

const sampleRateLabel = computed(() => {
  const firstTrack = props.session.tracks?.[0]
  if (firstTrack?.sampleRate) {
    return `${(firstTrack.sampleRate / 1000).toFixed(1)} kHz`
  }
  return '48.0 kHz'
})

const bitDepthLabel = computed(() => {
  const firstTrack = props.session.tracks?.[0]
  return firstTrack?.bitDepth ? `${firstTrack.bitDepth}-bit` : '24-bit'
})
</script>

<template>
  <div class="retro-monitor px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs select-none">
    
    <!-- Left: Studio Clock & Engine Telemetry -->
    <div class="flex flex-wrap items-center gap-3">
      <!-- Static Studio Green Tally Pill -->
      <div class="inline-flex items-center gap-1.5 rounded-full bg-[#10b981]/15 border border-[#10b981]/40 px-2.5 py-0.5 font-sans text-[11px] font-bold text-[#5ad363]">
        <svg class="w-3 h-3 text-[#5ad363] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span>DSP Engine Active</span>
      </div>

      <span class="text-[#a1a1aa]/40 hidden sm:inline">|</span>

      <!-- Sampling Rate & Bit Depth -->
      <div class="flex items-center gap-1.5 text-xs">
        <span class="font-sans text-[#a1a1aa] font-medium">Clock:</span>
        <span class="font-telemetry font-bold text-[#ffffff]">{{ sampleRateLabel }}</span>
        <span class="text-[#a1a1aa]/60">/</span>
        <span class="font-telemetry font-semibold text-[#f5f3eb]">{{ bitDepthLabel }}</span>
        <span class="font-sans text-[#a1a1aa]">PCM</span>
      </div>
    </div>

    <!-- Center/Right: Multitrack Channel Layout -->
    <div class="flex flex-wrap items-center gap-3 text-xs">
      <div class="flex items-center gap-1.5">
        <span class="font-sans text-[#a1a1aa] font-medium">Stems:</span>
        <span class="font-telemetry font-bold text-[#20afff]">{{ totalTracks }}</span>
        <span class="font-sans font-semibold text-[#f5f3eb]">Stems</span>
        <span class="font-sans text-[#a1a1aa] text-[11px]">
          (<span class="font-telemetry text-[#f5f3eb]">{{ stereoCount }}</span> Stereo, <span class="font-telemetry text-[#f5f3eb]">{{ monoCount }}</span> Mono)
        </span>
      </div>

      <span class="text-[#a1a1aa]/40 hidden md:inline">|</span>

      <!-- Compliance Standard Badge -->
      <div class="hidden md:inline-flex items-center gap-1.5 rounded-full bg-white/8 border border-white/15 px-2.5 py-0.5 font-sans text-[11px] font-medium text-[#f5f3eb]">
        <span>ITU-R <span class="font-telemetry font-semibold text-[#20afff]">BS.1770-4</span></span>
      </div>
    </div>

  </div>
</template>
