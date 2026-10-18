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
  <div class="bg-slate-900 text-slate-200 rounded-xl px-4 py-2.5 shadow-sm border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs select-none">
    
    <!-- Left: Studio Clock & Engine Telemetry -->
    <div class="flex items-center gap-3">
      <!-- Pulsing Studio Green Tally Light -->
      <div class="flex items-center gap-2">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span class="font-mono-accent text-[11px] font-bold tracking-wider text-emerald-400 uppercase">
          DSP Engine Active
        </span>
      </div>

      <span class="text-slate-600 hidden sm:inline">|</span>

      <!-- Sampling Rate & Bit Depth -->
      <div class="flex items-center gap-1.5 font-mono-accent text-[11px] text-slate-300">
        <span class="text-slate-500 uppercase text-[9px] tracking-wider">Clock:</span>
        <span class="font-bold text-white">{{ sampleRateLabel }}</span>
        <span class="text-slate-500">/</span>
        <span class="text-slate-300">{{ bitDepthLabel }} PCM</span>
      </div>
    </div>

    <!-- Center/Right: Multitrack Channel Layout -->
    <div class="flex items-center gap-3 font-mono-accent text-[11px]">
      <div class="flex items-center gap-2 text-slate-300">
        <span class="text-slate-500 uppercase text-[9px] tracking-wider">Stems:</span>
        <span class="font-bold text-white">{{ totalTracks }} Stems</span>
        <span class="text-slate-500 text-[10px]">
          ({{ stereoCount }} Stereo, {{ monoCount }} Mono)
        </span>
      </div>

      <span class="text-slate-700 hidden sm:inline">|</span>

      <!-- Compliance Standard Badge -->
      <div class="hidden md:flex items-center gap-1 text-[10px] text-slate-400">
        <span class="w-1.5 h-1.5 rounded-full bg-blue-400" />
        <span>ITU-R BS.1770-4</span>
      </div>
    </div>

  </div>
</template>
