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
  <div class="bg-black text-white rounded-none px-4 py-2.5 border border-black flex flex-wrap items-center justify-between gap-3 text-xs select-none">
    
    <!-- Left: Studio Clock & Engine Telemetry -->
    <div class="flex items-center gap-3">
      <!-- Static Studio Green Tally Light -->
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-none bg-emerald-400 inline-block" />
        <span class="font-mono-accent text-[11px] font-bold tracking-wider text-emerald-400 uppercase">
          DSP Engine Active
        </span>
      </div>

      <span class="text-[#60605e] hidden sm:inline">|</span>

      <!-- Sampling Rate & Bit Depth -->
      <div class="flex items-center gap-1.5 font-mono-accent text-[11px] text-white">
        <span class="text-[#60605e] uppercase text-[9px] tracking-wider">Clock:</span>
        <span class="font-bold">{{ sampleRateLabel }}</span>
        <span class="text-[#60605e]">/</span>
        <span>{{ bitDepthLabel }} PCM</span>
      </div>
    </div>

    <!-- Center/Right: Multitrack Channel Layout -->
    <div class="flex items-center gap-3 font-mono-accent text-[11px]">
      <div class="flex items-center gap-2 text-white">
        <span class="text-[#60605e] uppercase text-[9px] tracking-wider">Stems:</span>
        <span class="font-bold">{{ totalTracks }} Stems</span>
        <span class="text-[#60605e] text-[10px]">
          ({{ stereoCount }} Stereo, {{ monoCount }} Mono)
        </span>
      </div>

      <span class="text-[#60605e] hidden sm:inline">|</span>

      <!-- Compliance Standard Badge -->
      <div class="hidden md:flex items-center gap-1 text-[10px] text-[#c1c0bc]">
        <span class="w-1.5 h-1.5 rounded-none bg-white inline-block" />
        <span>ITU-R BS.1770-4</span>
      </div>
    </div>

  </div>
</template>
