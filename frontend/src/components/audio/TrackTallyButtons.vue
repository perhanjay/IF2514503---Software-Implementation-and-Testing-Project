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
      class="w-7 h-7 rounded-none border font-mono-accent text-[11px] font-bold transition-colors flex items-center justify-center cursor-pointer focus:outline-none"
      :class="isMuted 
        ? 'bg-rose-700 text-white border-rose-900' 
        : 'bg-[#f1f0eb] hover:bg-[#e4d9cf] text-black border-[#c1c0bc]'">
      <span class="relative">
        M
      </span>
    </button>

    <!-- Solo Button -->
    <button
      type="button"
      @click="toggleSolo"
      :aria-pressed="isSolo"
      :title="isSolo ? 'Matikan Solo Trek' : 'Solo Trek (Dengarkan Sendiri)'"
      class="w-7 h-7 rounded-none border font-mono-accent text-[11px] font-bold transition-colors flex items-center justify-center cursor-pointer focus:outline-none"
      :class="isSolo 
        ? 'bg-[#ffda40] text-black border-black' 
        : 'bg-[#f1f0eb] hover:bg-[#e4d9cf] text-black border-[#c1c0bc]'">
      <span class="relative">
        S
      </span>
    </button>
  </div>
</template>
