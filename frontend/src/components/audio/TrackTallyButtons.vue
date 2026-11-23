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
  <div class="inline-flex items-center gap-1.5 select-none" role="group" aria-label="Audio channel controls">
    <!-- Mute Button -->
    <button
      type="button"
      @click="toggleMute"
      :aria-pressed="isMuted"
      :title="isMuted ? 'Buka Mute Trek' : 'Mute Trek (Bungkam Suara)'"
      class="btn-keycap btn-keycap-mini w-8 h-8 text-[11px] font-sans font-bold flex items-center justify-center"
      :class="isMuted ? 'btn-keycap-pink' : 'btn-keycap-white'">
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
      class="btn-keycap btn-keycap-mini w-8 h-8 text-[11px] font-sans font-bold flex items-center justify-center"
      :class="isSolo ? 'btn-keycap-yellow' : 'btn-keycap-white'">
      <span class="relative">
        S
      </span>
    </button>
  </div>
</template>
