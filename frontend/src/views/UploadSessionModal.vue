<script setup>
import { ref } from 'vue'
import axios from 'axios'

const emit = defineEmits(['close', 'uploaded'])

const sessionTitle = ref('')
const selectedFiles = ref([])
const isDragging = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)
const errorMsg = ref('')

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
  uploadProgress.value = 10

  try {
    const formData = new FormData()
    formData.append('title', sessionTitle.value || 'New Mixing Session')
    for (const f of selectedFiles.value) {
      formData.append('files', f)
    }

    uploadProgress.value = 45
    const res = await axios.post('/api/v1/sessions/upload-direct', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    uploadProgress.value = 100
    emit('uploaded', res.data.session)
  } catch (err) {
    errorMsg.value = err.response?.data?.error || 'Gagal mengunggah berkas sesi'
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-800 max-w-xl w-full rounded-2xl p-6 shadow-2xl space-y-5">
      <div class="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h3 class="text-base font-bold text-white">Unggah Sesi Multitrack Baru (UC-10)</h3>
          <p class="text-xs text-slate-400 mt-0.5">Unggah berkas stem individual (WAV/FLAC) atau satu arsip ZIP proyek DAW</p>
        </div>
        <button @click="$emit('close')" class="text-slate-400 hover:text-white cursor-pointer text-lg font-bold">✕</button>
      </div>

      <div v-if="errorMsg" class="bg-rose-950/50 border border-rose-800 text-rose-300 text-xs p-3 rounded-xl">
        {{ errorMsg }}
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Judul Lagu / Sesi</label>
          <input 
            v-model="sessionTitle" 
            type="text" 
            placeholder="Contoh: Midnight Echoes (Rock Multitrack)"
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <!-- Dropzone -->
        <div 
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleDrop"
          :class="isDragging ? 'border-cyan-500 bg-cyan-950/20' : 'border-slate-800 bg-slate-950/60'"
          class="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors relative">
          
          <input 
            type="file" 
            multiple 
            accept=".wav,.flac,.zip,.mp3,.aiff"
            @change="handleFileSelect" 
            class="absolute inset-0 opacity-0 cursor-pointer"
          />

          <div class="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center mx-auto mb-3 text-xl">
            📁
          </div>

          <p class="text-xs font-semibold text-slate-200">
            Tarik & letakkan berkas audio ke sini, atau <span class="text-cyan-400 underline">pilih dari komputer</span>
          </p>
          <p class="text-[11px] text-slate-500 mt-1">
            Mendukung multiple WAV/FLAC hingga 2 GB atau arsip .ZIP (Auto-extract)
          </p>
        </div>

        <!-- Selected files list -->
        <div v-if="selectedFiles.length" class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
          <span class="text-[11px] font-semibold text-slate-400 block">Berkas Terpilih ({{ selectedFiles.length }} File):</span>
          <div 
            v-for="(f, i) in selectedFiles" 
            :key="i" 
            class="flex items-center justify-between bg-slate-950 border border-slate-800/80 px-3 py-1.5 rounded-lg text-xs text-slate-300">
            <span class="truncate max-w-xs font-mono text-[11px]">{{ f.name }}</span>
            <span class="text-slate-500 text-[10px]">{{ (f.size / (1024 * 1024)).toFixed(2) }} MB</span>
          </div>
        </div>

        <!-- Progress bar -->
        <div v-if="uploading" class="space-y-1.5">
          <div class="flex justify-between text-xs text-slate-400">
            <span>Mengunggah berkas ke MinIO S3...</span>
            <span class="font-mono">{{ uploadProgress }}%</span>
          </div>
          <div class="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
            <div class="h-full bg-cyan-500 transition-all duration-300" :style="{ width: uploadProgress + '%' }"></div>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-3 pt-3 border-t border-slate-800">
        <button 
          @click="$emit('close')" 
          :disabled="uploading"
          class="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer">
          Batal
        </button>
        <button 
          @click="startUpload" 
          :disabled="uploading || !selectedFiles.length"
          class="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-lg shadow-cyan-950">
          {{ uploading ? 'Memproses Transmisi...' : 'Mulai Unggah Sesi' }}
        </button>
      </div>
    </div>
  </div>
</template>
