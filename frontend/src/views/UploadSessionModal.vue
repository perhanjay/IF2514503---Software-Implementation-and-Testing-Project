<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import axios from 'axios'

const emit = defineEmits(['close', 'uploaded'])

const sessionTitle = ref('')
const selectedFiles = ref([])
const isDragging = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)
const errorMsg = ref('')

function handleKeyDown(e) {
  if (e.key === 'Escape' && !uploading.value) {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

function handleFileSelect(e) {
  const files = Array.from(e.target.files || [])
  if (files.length) {
    selectedFiles.value = files
  }
}

function handleDrop(e) {
  isDragging.value = false
  const files = Array.from(e.dataTransfer.files || [])
  if (files.length) {
    selectedFiles.value = files
  }
}

async function startUpload() {
  if (!selectedFiles.value.length) {
    errorMsg.value = 'Pilih minimal satu berkas audio (WAV/FLAC) atau arsip ZIP'
    return
  }

  errorMsg.value = ''
  uploading.value = true
  uploadProgress.value = 15

  try {
    const formData = new FormData()
    formData.append('title', sessionTitle.value || 'New Mixing Session')
    for (const f of selectedFiles.value) {
      formData.append('files', f)
    }

    uploadProgress.value = 60
    const res = await axios.post('/api/v1/sessions/upload-direct', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    uploadProgress.value = 100
    emit('uploaded', res.data.session)
  } catch (err) {
    errorMsg.value = err.response?.data?.error || 'Gagal mengunggah berkas sesi ke MinIO S3'
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div
    @click.self="!uploading && $emit('close')"
    class="fixed inset-0 z-50 bg-[#111111]/55 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      class="retro-glass-panel max-w-xl w-full p-6 sm:p-7 space-y-6 font-sans"
    >
      <!-- Modal Header -->
      <div class="flex items-start justify-between gap-4 border-b border-[#111111]/12 pb-4">
        <div>
          <span class="stamp-serrated inline-block px-3 py-0.5 text-[10px] bg-[#ffda40] text-[#111111] font-bold uppercase tracking-wider">
            Ingestion Studio
          </span>
          <h3 id="modal-title" class="text-xl sm:text-2xl font-editorial font-bold text-[#111111] mt-2 tracking-tight">
            Unggah Sesi Multitrack
          </h3>
          <p class="text-xs text-[#60605e] mt-0.5 font-normal">
            Mendukung berkas stem terpisah (WAV/FLAC) atau arsip .ZIP proyek DAW
          </p>
        </div>
        <button
          @click="$emit('close')"
          :disabled="uploading"
          type="button"
          aria-label="Tutup Dialog"
          class="btn-keycap btn-keycap-mini btn-keycap-white w-8 h-8 shrink-0"
        >
          <span aria-hidden="true" class="text-sm font-bold leading-none">✕</span>
        </button>
      </div>

      <div v-if="errorMsg" class="bg-rose-50/95 border border-rose-300 text-rose-900 text-xs p-3.5 rounded-[12px] font-medium">
        {{ errorMsg }}
      </div>

      <div class="space-y-4">
        <div>
          <label for="upload-session-title" class="block text-xs font-bold text-[#111111] mb-1.5">
            Judul Sesi / Nama Proyek
          </label>
          <input
            id="upload-session-title"
            v-model="sessionTitle"
            type="text"
            placeholder="Contoh: Echoes in the Night (Multitrack 24-bit)"
            class="w-full bg-white/90 border-[1.5px] border-[#111111]/20 rounded-[12px] px-4 py-3 text-sm text-[#111111] placeholder-[#60605e] focus:outline-none focus:border-[#111111] focus:bg-white transition-colors"
          />
        </div>

        <!-- Dropzone Area -->
        <div
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleDrop"
          :class="isDragging ? 'border-[#20afff] bg-[#20afff]/15' : 'border-[#111111]/25 bg-[#fcfcfb]/90 hover:border-[#111111]/45'"
          class="border-2 border-dashed rounded-[16px] p-8 text-center cursor-pointer transition-all relative group"
        >
          <input
            type="file"
            multiple
            accept=".wav,.flac,.zip,.mp3,.aiff"
            @change="handleFileSelect"
            class="absolute inset-0 opacity-0 cursor-pointer"
          />

          <div class="w-12 h-12 rounded-[14px] bg-[#18181b] text-white border-2 border-[#111111] shadow-[2px_3px_0_#111111] flex items-center justify-center mx-auto mb-3 group-hover:-translate-y-0.5 transition-transform">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
          </div>

          <p class="text-sm font-semibold text-[#111111]">
            Tarik &amp; jatuhkan stem ke sini, atau <span class="underline decoration-[#20afff] decoration-2 underline-offset-4">pilih berkas</span>
          </p>
          <p class="text-xs text-[#60605e] mt-1 font-normal">
            Maksimal <span class="font-telemetry font-semibold text-[#111111]">2 GB</span> per sesi multitrack &middot; Presisi <span class="font-telemetry font-semibold text-[#111111]">24/32-bit</span> float terjaga
          </p>
        </div>

        <!-- File selection summary -->
        <div v-if="selectedFiles.length" class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
          <span class="text-xs font-bold text-[#111111] block tabular-nums">
            {{ selectedFiles.length }} Berkas Siap Diunggah:
          </span>
          <div
            v-for="(f, i) in selectedFiles"
            :key="i"
            class="retro-telemetry-plate flex items-center justify-between px-3.5 py-2 text-xs text-[#111111]"
          >
            <span class="truncate max-w-xs font-medium">{{ f.name }}</span>
            <span class="text-[#60605e] font-telemetry text-[11px] shrink-0">{{ (f.size / (1024 * 1024)).toFixed(2) }} MB</span>
          </div>
        </div>

        <!-- Ingestion Progress bar -->
        <div v-if="uploading" class="retro-telemetry-plate p-3 space-y-2">
          <div class="flex justify-between text-xs text-[#111111] font-medium">
            <span>Mengunggah ke penyimpanan studio...</span>
            <span class="font-telemetry font-bold">{{ uploadProgress }}%</span>
          </div>
          <div class="w-full h-2.5 bg-[#eaeef4] border border-[#111111]/20 rounded-full overflow-hidden">
            <div class="h-full bg-[#20afff] transition-all duration-300 rounded-full" :style="{ width: uploadProgress + '%' }"></div>
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="flex justify-end gap-3 pt-3 border-t border-[#111111]/12">
        <button
          type="button"
          @click="$emit('close')"
          :disabled="uploading"
          class="btn-keycap btn-keycap-sm btn-keycap-white px-5 py-2.5 text-xs"
        >
          Batal
        </button>
        <button
          type="button"
          @click="startUpload"
          :disabled="uploading || !selectedFiles.length"
          class="btn-keycap btn-keycap-sm btn-keycap-blue px-6 py-2.5 text-xs"
        >
          {{ uploading ? 'Mengunggah & Mengekstrak...' : 'Mulai Transmisi Audio' }}
        </button>
      </div>
    </div>
  </div>
</template>
