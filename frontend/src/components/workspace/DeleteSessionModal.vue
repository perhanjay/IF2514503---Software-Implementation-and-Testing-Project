<script setup>
import { onMounted, onUnmounted } from 'vue'
import { Trash2 } from 'lucide-vue-next'

const props = defineProps({
  session: {
    type: Object,
    default: null
  },
  isDeleting: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'confirm'])

function handleKeyDown(e) {
  if (e.key === 'Escape' && props.session && !props.isDeleting) {
    emit('close')
  }
}

onMounted(() => window.addEventListener('keydown', handleKeyDown))
onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="session"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111111]/55 backdrop-blur-xs animate-fade-in"
      @click.self="!isDeleting && emit('close')"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-session-title"
        class="retro-glass-panel max-w-sm w-full p-6 space-y-4 font-sans"
      >
        <div class="space-y-1.5">
          <span class="stamp-serrated inline-block px-3 py-1 bg-[#ff82c2] text-[#111111] text-[10px] font-bold uppercase tracking-wider">
            Konfirmasi Hapus
          </span>
          <h3 id="delete-session-title" class="text-lg font-editorial font-bold text-[#111111] tracking-tight pt-1">
            Hapus sesi multitrack?
          </h3>
          <p class="text-xs text-[#60605e] font-normal">
            Tindakan ini bersifat permanen dan tidak dapat dibatalkan.
          </p>
        </div>

        <div class="retro-telemetry-plate p-3.5 text-xs text-[#111111] leading-relaxed">
          Sesi <span class="font-bold text-[#111111]">{{ session.title || session.name }}</span> beserta seluruh trek stem dan hasil analisis DSP akan dihapus permanen.
        </div>

        <div class="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            @click="emit('close')"
            :disabled="isDeleting"
            class="btn-keycap btn-keycap-sm btn-keycap-white px-4 py-2 text-xs"
          >
            Batal
          </button>
          <button
            type="button"
            @click="emit('confirm')"
            :disabled="isDeleting"
            class="btn-keycap btn-keycap-sm btn-keycap-pink px-4 py-2 text-xs"
          >
            <svg v-if="isDeleting" class="animate-spin w-3.5 h-3.5 text-[#111111]" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <Trash2 v-else class="w-3.5 h-3.5 text-[#111111]" :stroke-width="2" />
            <span>{{ isDeleting ? 'Menghapus...' : 'Ya, Hapus' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
