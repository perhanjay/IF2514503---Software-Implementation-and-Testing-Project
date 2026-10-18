<script setup>
import { ref } from 'vue'

const props = defineProps({
  trackId: {
    type: [String, Number],
    required: true
  },
  initialMuted: {
    type: Boolean,
    default: false
  },
  initialSolo: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['toggle-mute', 'toggle-solo'])

const isMuted = ref(props.initialMuted)
const isSolo = ref(props.initialSolo)

function toggleMute() {
  isMuted.value = !isMuted.value
  emit('toggle-mute', { trackId: props.trackId, muted: isMuted.value })
}

function toggleSolo() {
  isSolo.value = !isSolo.value
  emit('toggle-solo', { trackId: props.trackId, solo: isSolo.value })
}
</script>

<template>
  <div class="inline-flex items-center gap-1 select-none" role="group" aria-label="Audio channel controls">
    <!-- Mute Button -->
    <button
      type="button"
      @click="toggleMute"
      :aria-pressed="isMuted"
      :title="isMuted ? 'Buka Mute Trek' : 'Mute Trek (Bungkam Suara)'"
      class="w-7 h-7 rounded border font-mono-accent text-[11px] font-bold transition-all flex items-center justify-center cursor-pointer active:translate-y-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
      :class="isMuted 
        ? 'bg-rose-600 text-white border-rose-700 shadow-xs ring-2 ring-rose-200' 
        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-300/90'">
      <span class="relative">
        M
        <!-- Tiny Tally Lamp Dot -->
        <span 
          v-if="isMuted"
          class="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_4px_#fff]"
        />
      </span>
    </button>

    <!-- Solo Button -->
    <button
      type="button"
      @click="toggleSolo"
      :aria-pressed="isSolo"
      :title="isSolo ? 'Matikan Solo Trek' : 'Solo Trek (Dengarkan Sendiri)'"
      class="w-7 h-7 rounded border font-mono-accent text-[11px] font-bold transition-all flex items-center justify-center cursor-pointer active:translate-y-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      :class="isSolo 
        ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-xs ring-2 ring-amber-200' 
        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-300/90'">
      <span class="relative">
        S
        <!-- Tiny Tally Lamp Dot -->
        <span 
          v-if="isSolo"
          class="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-slate-950"
        />
      </span>
    </button>
  </div>
</template>
