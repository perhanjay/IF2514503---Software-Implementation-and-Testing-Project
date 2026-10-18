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
    @click.self="$emit('close')"
    class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      class="bg-white border border-slate-200 max-w-xl w-full rounded-2xl p-7 shadow-xl space-y-6 animate-fade-in">
      
      <!-- Modal Header -->
      <div class="flex items-start justify-between border-b border-slate-100 pb-4">
        <div>
          <span class="text-xs font-semibold text-[#0052FF] bg-blue-50 px-2 py-0.5 rounded">Ingestion Studio</span>
          <h3 id="modal-title" class="font-display text-2xl text-slate-900 mt-2">Unggah Sesi Multitrack</h3>
          <p class="text-xs text-slate-500 mt-0.5">Mendukung berkas stem terpisah (WAV/FLAC) atau arsip .ZIP proyek DAW</p>
        </div>
        <button 
          @click="$emit('close')" 
          type="button"
          aria-label="Tutup Dialog"
          class="text-slate-400 hover:text-slate-700 cursor-pointer text-xl font-bold p-1">
          ✕
        </button>
      </div>

      <div v-if="errorMsg" class="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3.5 rounded-xl">
        {{ errorMsg }}
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1.5 font-mono-accent">
            JUDUL SESI / NAMA PROYEK
          </label>
          <input 
            v-model="sessionTitle" 
            type="text" 
            placeholder="Contoh: Echoes in the Night (Multitrack 24-bit)"
            class="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0052FF]/20 focus:border-[#0052FF] transition-all"
          />
        </div>

        <!-- Dropzone Area with SVG Icon -->
        <div 
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleDrop"
          :class="isDragging ? 'border-[#0052FF] bg-blue-50/30' : 'border-slate-300 bg-[#FAFAFA]'"
          class="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all relative group">
          
          <input 
            type="file" 
            multiple 
            accept=".wav,.flac,.zip,.mp3,.aiff"
            @change="handleFileSelect" 
            class="absolute inset-0 opacity-0 cursor-pointer"
          />

          <div class="w-12 h-12 rounded-xl bg-blue-50 text-[#0052FF] border border-blue-200 flex items-center justify-center mx-auto mb-3">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
          </div>

          <p class="text-sm font-semibold text-slate-800">
            Tarik &amp; jatuhkan stem ke sini, atau <span class="text-[#0052FF] underline">pilih berkas</span>
          </p>
          <p class="text-xs text-slate-500 mt-1">
            Maksimal 2 GB per sesi multitrack • Bit-depth 24/32-bit float terjaga
          </p>
        </div>

        <!-- File selection summary -->
        <div v-if="selectedFiles.length" class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
          <span class="text-xs font-semibold text-slate-600 block font-mono-accent">
            {{ selectedFiles.length }} Berkas Siap Diunggah:
          </span>
          <div 
            v-for="(f, i) in selectedFiles" 
            :key="i" 
            class="flex items-center justify-between bg-[#F1F5F9] border border-slate-200 px-3 py-2 rounded-lg text-xs text-slate-700">
            <span class="truncate max-w-xs font-mono-accent text-[11px]">{{ f.name }}</span>
            <span class="text-slate-500 font-mono text-[10px]">{{ (f.size / (1024 * 1024)).toFixed(2) }} MB</span>
          </div>
        </div>

        <!-- Ingestion Progress bar -->
        <div v-if="uploading" class="space-y-1.5 pt-2">
          <div class="flex justify-between text-xs text-slate-600 font-mono-accent">
            <span>Mengunggah ke MinIO S3 Storage...</span>
            <span class="font-bold text-[#0052FF]">{{ uploadProgress }}%</span>
          </div>
          <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full bg-[#0052FF] transition-all duration-300" :style="{ width: uploadProgress + '%' }"></div>
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="flex justify-end gap-3 pt-3 border-t border-slate-100">
        <button 
          @click="$emit('close')" 
          :disabled="uploading"
          class="px-5 py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer">
          Batal
        </button>
        <button 
          @click="startUpload" 
          :disabled="uploading || !selectedFiles.length"
          class="px-6 py-2.5 bg-[#0052FF] hover:bg-[#0043D6] disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer shadow-accent transition-all">
          {{ uploading ? 'Mengunggah & Mengekstrak...' : 'Mulai Transmisi Audio' }}
        </button>
      </div>

    </div>
  </div>
</template>
