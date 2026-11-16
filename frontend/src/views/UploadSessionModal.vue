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
    class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
    <div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      class="bg-white border-2 border-black max-w-xl w-full rounded-none p-7 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-6 animate-fade-in">
      
      <!-- Modal Header -->
      <div class="flex items-start justify-between border-b border-[#c1c0bc] pb-4">
        <div>
          <span class="badge-pill-stamp px-2.5 py-0.5 text-[10px] bg-black text-white font-medium inline-block">INGESTION STUDIO</span>
          <h3 id="modal-title" class="text-xl sm:text-2xl text-black font-medium mt-2 tracking-tight">Unggah Sesi Multitrack</h3>
          <p class="text-xs text-[#60605e] mt-0.5 font-normal">Mendukung berkas stem terpisah (WAV/FLAC) atau arsip .ZIP proyek DAW</p>
        </div>
        <button 
          @click="$emit('close')" 
          type="button"
          aria-label="Tutup Dialog"
          class="text-black hover:opacity-60 cursor-pointer text-xl font-normal p-1">
          ✕
        </button>
      </div>

      <div v-if="errorMsg" class="bg-rose-50 border border-rose-300 text-rose-800 text-xs p-3.5 rounded-none font-normal">
        {{ errorMsg }}
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-black uppercase tracking-wider mb-1.5 font-mono-accent">
            JUDUL SESI / NAMA PROYEK
          </label>
          <input 
            v-model="sessionTitle" 
            type="text" 
            placeholder="Contoh: Echoes in the Night (Multitrack 24-bit)"
            class="w-full bg-[#f1f0eb] border border-[#c1c0bc] rounded-none px-4 py-3 text-sm text-black placeholder-[#60605e] focus:outline-none focus:border-black focus:bg-white transition-colors"
          />
        </div>

        <!-- Dropzone Area -->
        <div 
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleDrop"
          :class="isDragging ? 'border-black bg-[#ff82c2]/20' : 'border-[#c1c0bc] bg-[#f1f0eb]/60'"
          class="border border-dashed rounded-none p-8 text-center cursor-pointer transition-all relative group">
          
          <input 
            type="file" 
            multiple 
            accept=".wav,.flac,.zip,.mp3,.aiff"
            @change="handleFileSelect" 
            class="absolute inset-0 opacity-0 cursor-pointer"
          />

          <div class="w-12 h-12 rounded-none bg-black text-white flex items-center justify-center mx-auto mb-3">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
          </div>

          <p class="text-sm font-medium text-black">
            Tarik &amp; jatuhkan stem ke sini, atau <span class="underline">pilih berkas</span>
          </p>
          <p class="text-xs text-[#60605e] mt-1 font-mono-accent font-normal">
            Maksimal 2 GB per sesi multitrack • Presisi 24/32-bit float terjaga
          </p>
        </div>

        <!-- File selection summary -->
        <div v-if="selectedFiles.length" class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
          <span class="text-xs font-medium text-black block font-mono-accent uppercase tracking-wider">
            {{ selectedFiles.length }} Berkas Siap Diunggah:
          </span>
          <div 
            v-for="(f, i) in selectedFiles" 
            :key="i" 
            class="flex items-center justify-between bg-[#f1f0eb] border border-[#c1c0bc] rounded-none px-3 py-2 text-xs text-black">
            <span class="truncate max-w-xs font-mono-accent text-[11px]">{{ f.name }}</span>
            <span class="text-[#60605e] font-mono text-[10px]">{{ (f.size / (1024 * 1024)).toFixed(2) }} MB</span>
          </div>
        </div>

        <!-- Ingestion Progress bar -->
        <div v-if="uploading" class="space-y-1.5 pt-2">
          <div class="flex justify-between text-xs text-black font-mono-accent font-normal">
            <span>Mengunggah ke MinIO S3 Storage...</span>
            <span class="font-medium">{{ uploadProgress }}%</span>
          </div>
          <div class="w-full h-2 bg-[#f1f0eb] border border-[#c1c0bc] rounded-none overflow-hidden">
            <div class="h-full bg-black transition-all duration-300" :style="{ width: uploadProgress + '%' }"></div>
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="flex justify-end gap-3 pt-3 border-t border-[#c1c0bc]">
        <button 
          @click="$emit('close')" 
          :disabled="uploading"
          class="btn-bone-secondary px-5 py-2.5 rounded-none border border-[#c1c0bc] text-xs uppercase tracking-wider cursor-pointer">
          Batal
        </button>
        <button 
          @click="startUpload" 
          :disabled="uploading || !selectedFiles.length"
          class="btn-ink-stamp px-6 py-2.5 rounded-none text-xs uppercase tracking-[0.1em] cursor-pointer disabled:opacity-50 transition-all">
          {{ uploading ? 'Mengunggah & Mengekstrak...' : 'Mulai Transmisi Audio' }}
        </button>
      </div>

    </div>
  </div>
</template>
