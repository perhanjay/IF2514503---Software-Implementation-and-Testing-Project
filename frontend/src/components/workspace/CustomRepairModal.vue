<script setup>
import { onMounted, onUnmounted } from 'vue'
import { SlidersHorizontal, X } from 'lucide-vue-next'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  session: {
    type: Object,
    default: null
  },
  customSettings: {
    type: Object,
    required: true
  },
  isRepairing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'submit'])

function handleKeyDown(e) {
  if (e.key === 'Escape' && props.open && !props.isRepairing) {
    emit('close')
  }
}

onMounted(() => window.addEventListener('keydown', handleKeyDown))
onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && session"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111111]/55 backdrop-blur-xs animate-fade-in"
      @click.self="!isRepairing && emit('close')"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-repair-title"
        class="retro-glass-panel max-w-2xl w-full p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto font-sans"
      >
        <div class="flex items-start justify-between gap-4 border-b border-[#111111]/12 pb-4">
          <div class="space-y-1">
            <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#ffda40] text-[#111111] border border-[#111111]/20 text-[10px] font-bold uppercase tracking-wider">
              <SlidersHorizontal class="w-3 h-3" :stroke-width="2" />
              <span>DSP Customizer</span>
            </div>
            <h3 id="custom-repair-title" class="text-lg sm:text-xl font-editorial font-bold text-[#111111] tracking-tight pt-1">
              Kustomisasi Modul Perbaikan DSP
            </h3>
            <p class="text-xs text-[#60605e] font-normal">
              Aktifkan atau nonaktifkan perbaikan spesifik per-track sesuai kebutuhan artistik mixing.
            </p>
          </div>
          <button
            type="button"
            @click="emit('close')"
            :disabled="isRepairing"
            aria-label="Tutup dialog"
            class="btn-keycap btn-keycap-mini btn-keycap-white w-8 h-8 shrink-0"
          >
            <X class="w-4 h-4 text-[#111111]" :stroke-width="2" />
          </button>
        </div>

        <div class="space-y-3">
          <div
            v-for="track in session.tracks"
            :key="'custom-' + track.id"
            class="retro-telemetry-plate p-4 space-y-3"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-xs font-bold text-[#111111] truncate max-w-xs sm:max-w-md">{{ track.fileName }}</span>
              <span class="text-[11px] px-2.5 py-0.5 rounded-full border border-[#111111]/15 bg-[#eaeef4] text-[#111111] font-semibold">
                {{ track.instrumentLabel || track.detectedLabel || 'Other' }}
              </span>
            </div>

            <div v-if="customSettings[track.id]" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
              <label class="flex items-center gap-2 text-xs text-[#111111] cursor-pointer font-medium">
                <input
                  type="checkbox"
                  v-model="customSettings[track.id].flipPolarity"
                  class="accent-[#20afff] w-4 h-4 rounded cursor-pointer"
                />
                <span>Invert Polaritas (<span class="font-telemetry">180°</span>)</span>
              </label>

              <label class="flex items-center gap-2 text-xs text-[#111111] cursor-pointer font-medium">
                <input
                  type="checkbox"
                  v-model="customSettings[track.id].alignDelay"
                  class="accent-[#20afff] w-4 h-4 rounded cursor-pointer"
                />
                <span>Micro-Delay Align</span>
              </label>

              <label class="flex items-center gap-2 text-xs text-[#111111] cursor-pointer font-medium">
                <input
                  type="checkbox"
                  v-model="customSettings[track.id].fixFakeStereo"
                  class="accent-[#20afff] w-4 h-4 rounded cursor-pointer"
                />
                <span>True Mono (Fake Stereo)</span>
              </label>

              <label class="flex items-center gap-2 text-xs text-[#111111] cursor-pointer font-medium">
                <input
                  type="checkbox"
                  v-model="customSettings[track.id].removeDcOffset"
                  class="accent-[#20afff] w-4 h-4 rounded cursor-pointer"
                />
                <span>Buang DC Offset</span>
              </label>

              <label class="flex items-center gap-2 text-xs text-[#111111] cursor-pointer font-medium">
                <input
                  type="checkbox"
                  v-model="customSettings[track.id].filterSubRumble"
                  class="accent-[#20afff] w-4 h-4 rounded cursor-pointer"
                />
                <span>Filter Sub-Rumble</span>
              </label>

              <label class="flex items-center gap-2 text-xs text-[#111111] cursor-pointer font-medium">
                <input
                  type="checkbox"
                  v-model="customSettings[track.id].gainStaging"
                  class="accent-[#20afff] w-4 h-4 rounded cursor-pointer"
                />
                <span>Gain Staging (<span class="font-telemetry">-3 dBFS</span>)</span>
              </label>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-[#111111]/12">
          <button
            type="button"
            @click="emit('close')"
            :disabled="isRepairing"
            class="btn-keycap btn-keycap-sm btn-keycap-white px-4 py-2 text-xs"
          >
            Batal
          </button>
          <button
            type="button"
            @click="emit('submit')"
            :disabled="isRepairing"
            class="btn-keycap btn-keycap-sm btn-keycap-blue px-5 py-2 text-xs"
          >
            <svg v-if="isRepairing" class="animate-spin w-3.5 h-3.5 text-[#111111]" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span>{{ isRepairing ? 'Memproses...' : 'Terapkan Perbaikan Kustom' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
