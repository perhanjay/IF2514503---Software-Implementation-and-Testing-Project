<script setup>
import { ref, toRef, watch, onUnmounted } from 'vue'
import axios from 'axios'
import { KeyRound, X, AlertTriangle, CheckCircle2, ArrowLeft, Loader2 } from 'lucide-vue-next'
import { useDialogFocus } from '../../composables/useDialogFocus'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  initialEmail: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'reset-complete'])

const dialogRef = ref(null)
const resetStep = ref(1)
const resetEmail = ref('')
const resetToken = ref('')
const resetNewPassword = ref('')
const resetConfirmPassword = ref('')
const resetLoading = ref(false)
const resetErrorMsg = ref('')
const resetSuccessMsg = ref('')

useDialogFocus(toRef(props, 'isOpen'), dialogRef)

function handleKeyDown(e) {
  if (e.key === 'Escape' && props.isOpen && !resetLoading.value) {
    emit('close')
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      resetStep.value = 1
      resetEmail.value = props.initialEmail || ''
      resetToken.value = ''
      resetNewPassword.value = ''
      resetConfirmPassword.value = ''
      resetErrorMsg.value = ''
      resetSuccessMsg.value = ''
      window.addEventListener('keydown', handleKeyDown)
    } else {
      window.removeEventListener('keydown', handleKeyDown)
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

function requestClose() {
  if (resetLoading.value) return
  emit('close')
}

async function handleRequestReset() {
  resetErrorMsg.value = ''
  resetSuccessMsg.value = ''
  if (!resetEmail.value.trim()) {
    resetErrorMsg.value = 'Alamat email wajib diisi'
    return
  }
  resetLoading.value = true
  try {
    const res = await axios.post('/api/v1/auth/forgot-password', {
      email: resetEmail.value.trim()
    })
    resetSuccessMsg.value = res.data.message || 'Tautan pemulihan telah dikirim.'
    if (res.data.resetToken) {
      resetToken.value = res.data.resetToken
      resetStep.value = 2
    }
  } catch (err) {
    resetErrorMsg.value = err.response?.data?.error || 'Gagal memproses permintaan reset kata sandi'
  } finally {
    resetLoading.value = false
  }
}

async function handleExecuteReset() {
  resetErrorMsg.value = ''
  resetSuccessMsg.value = ''
  if (!resetToken.value.trim()) {
    resetErrorMsg.value = 'Token pemulihan wajib diisi'
    return
  }
  if (!resetNewPassword.value || resetNewPassword.value.length < 8 || !/(?=.*[a-zA-Z])(?=.*[0-9])/.test(resetNewPassword.value)) {
    resetErrorMsg.value = 'Kata sandi baru minimal 8 karakter dan harus mengandung kombinasi huruf serta angka'
    return
  }
  if (resetNewPassword.value !== resetConfirmPassword.value) {
    resetErrorMsg.value = 'Konfirmasi kata sandi baru tidak cocok'
    return
  }
  resetLoading.value = true
  try {
    const res = await axios.post('/api/v1/auth/reset-password', {
      token: resetToken.value.trim(),
      newPassword: resetNewPassword.value,
      confirmPassword: resetConfirmPassword.value
    })
    emit('reset-complete', {
      email: resetEmail.value.trim(),
      message: res.data.message || 'Kata sandi berhasil diperbarui. Silakan masuk menggunakan kata sandi baru.'
    })
  } catch (err) {
    resetErrorMsg.value = err.response?.data?.error || 'Gagal mengatur ulang kata sandi'
  } finally {
    resetLoading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111111]/55 backdrop-blur-xs overflow-y-auto"
      @click="requestClose"
    >
      <div
        ref="dialogRef"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-modal-title"
        class="retro-glass-panel bg-white/98 p-6 sm:p-7 max-w-md w-full my-auto space-y-5 focus:outline-none"
        @click.stop
      >
        <!-- Header -->
        <div class="flex items-start justify-between gap-3 pb-3.5 border-b border-[#111111]/12">
          <div class="flex items-center gap-3">
            <span class="w-9 h-9 rounded-[10px] border-[1.5px] border-[#111111] bg-[#ffda40] shadow-[1px_1.5px_0_#111111] flex items-center justify-center shrink-0">
              <KeyRound class="w-4 h-4 text-[#111111]" :stroke-width="2.2" />
            </span>
            <div>
              <h2 id="reset-modal-title" class="font-editorial font-bold text-lg text-[#111111] tracking-tight">
                Pemulihan Kata Sandi
              </h2>
              <p class="text-xs text-[#60605e]">Atur ulang akses akun studio Anda</p>
            </div>
          </div>

          <button
            type="button"
            @click="requestClose"
            :disabled="resetLoading"
            class="btn-keycap btn-keycap-mini btn-keycap-white w-8 h-8"
            aria-label="Tutup pemulihan kata sandi"
          >
            <X class="w-4 h-4" :stroke-width="2.2" />
          </button>
        </div>

        <!-- Step Switcher -->
        <div role="tablist" aria-label="Tahap pemulihan kata sandi" class="grid grid-cols-2 gap-2">
          <button
            type="button"
            role="tab"
            :aria-selected="resetStep === 1"
            @click="resetStep = 1"
            :class="resetStep === 1
              ? 'bg-[#111111] text-white border-[#111111]'
              : 'bg-[#f5f3eb] text-[#60605e] border-[#111111]/25 hover:border-[#111111] hover:text-[#111111]'"
            class="py-2 px-3 rounded-[10px] border-[1.5px] text-xs font-bold transition-colors cursor-pointer"
          >
            1. Minta Token
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="resetStep === 2"
            @click="resetStep = 2"
            :class="resetStep === 2
              ? 'bg-[#111111] text-white border-[#111111]'
              : 'bg-[#f5f3eb] text-[#60605e] border-[#111111]/25 hover:border-[#111111] hover:text-[#111111]'"
            class="py-2 px-3 rounded-[10px] border-[1.5px] text-xs font-bold transition-colors cursor-pointer"
          >
            2. Kata Sandi Baru
          </button>
        </div>

        <!-- Feedback Banners -->
        <div
          v-if="resetErrorMsg"
          role="alert"
          class="rounded-[12px] border-[1.5px] border-[#111111] bg-[#ffcae6]/60 text-[#111111] p-3 text-xs font-medium flex items-start gap-2"
        >
          <AlertTriangle class="w-4 h-4 text-rose-700 shrink-0 mt-0.5" :stroke-width="2.2" />
          <span class="leading-relaxed">{{ resetErrorMsg }}</span>
        </div>

        <div
          v-if="resetSuccessMsg"
          role="status"
          class="rounded-[12px] border-[1.5px] border-[#111111] bg-[#d8f3dc] text-[#111111] p-3 text-xs font-medium flex items-start gap-2"
        >
          <CheckCircle2 class="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" :stroke-width="2.2" />
          <span class="leading-relaxed">{{ resetSuccessMsg }}</span>
        </div>

        <!-- Step 1 Form -->
        <form v-if="resetStep === 1" @submit.prevent="handleRequestReset" class="space-y-4">
          <div>
            <label for="reset-email" class="block text-xs font-bold text-[#111111] mb-1.5">
              Alamat Email Terdaftar
            </label>
            <input
              id="reset-email"
              v-model="resetEmail"
              type="email"
              required
              autocomplete="email"
              placeholder="engineer@studio.com"
              class="w-full rounded-[12px] border-[1.5px] border-[#111111]/25 bg-white px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#60605e]/60 focus:outline-none focus:border-[#111111] focus:ring-2 focus:ring-[#20afff]/35 transition-colors"
            />
            <p class="text-[11px] text-[#60605e] mt-1.5">
              Token pemulihan sementara berlaku selama 1 jam.
            </p>
          </div>

          <div class="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              @click="requestClose"
              :disabled="resetLoading"
              class="btn-keycap btn-keycap-sm btn-keycap-white px-4 py-2 text-xs"
            >
              Batal
            </button>
            <button
              type="submit"
              :disabled="resetLoading"
              class="btn-keycap btn-keycap-sm btn-keycap-blue px-4 py-2 text-xs"
            >
              <Loader2 v-if="resetLoading" class="w-3.5 h-3.5 animate-spin" :stroke-width="2.2" />
              <span>{{ resetLoading ? 'Mengirim...' : 'Kirim Token Pemulihan' }}</span>
            </button>
          </div>
        </form>

        <!-- Step 2 Form -->
        <form v-else @submit.prevent="handleExecuteReset" class="space-y-3.5">
          <div>
            <label for="reset-token" class="block text-xs font-bold text-[#111111] mb-1.5">
              Token Pemulihan
            </label>
            <input
              id="reset-token"
              v-model="resetToken"
              type="text"
              required
              placeholder="Masukkan token pemulihan 64 karakter"
              class="w-full rounded-[12px] border-[1.5px] border-[#111111]/25 bg-white px-4 py-2.5 text-xs font-mono tabular-nums text-[#111111] placeholder:text-[#60605e]/60 focus:outline-none focus:border-[#111111] focus:ring-2 focus:ring-[#20afff]/35 transition-colors"
            />
          </div>

          <div>
            <label for="reset-new-password" class="block text-xs font-bold text-[#111111] mb-1.5">
              Kata Sandi Baru
            </label>
            <input
              id="reset-new-password"
              v-model="resetNewPassword"
              type="password"
              required
              autocomplete="new-password"
              placeholder="Minimal 8 karakter huruf &amp; angka"
              class="w-full rounded-[12px] border-[1.5px] border-[#111111]/25 bg-white px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#60605e]/60 focus:outline-none focus:border-[#111111] focus:ring-2 focus:ring-[#20afff]/35 transition-colors"
            />
          </div>

          <div>
            <label for="reset-confirm-password" class="block text-xs font-bold text-[#111111] mb-1.5">
              Konfirmasi Kata Sandi Baru
            </label>
            <input
              id="reset-confirm-password"
              v-model="resetConfirmPassword"
              type="password"
              required
              autocomplete="new-password"
              placeholder="Ketik ulang kata sandi baru"
              class="w-full rounded-[12px] border-[1.5px] border-[#111111]/25 bg-white px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#60605e]/60 focus:outline-none focus:border-[#111111] focus:ring-2 focus:ring-[#20afff]/35 transition-colors"
            />
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button
              type="button"
              @click="resetStep = 1"
              class="inline-flex items-center gap-1 text-xs font-bold text-[#111111] hover:text-[#0284c7] underline underline-offset-4 cursor-pointer"
            >
              <ArrowLeft class="w-3.5 h-3.5" :stroke-width="2.2" />
              <span>Langkah 1</span>
            </button>

            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="requestClose"
                :disabled="resetLoading"
                class="btn-keycap btn-keycap-sm btn-keycap-white px-4 py-2 text-xs"
              >
                Batal
              </button>
              <button
                type="submit"
                :disabled="resetLoading"
                class="btn-keycap btn-keycap-sm btn-keycap-blue px-4 py-2 text-xs"
              >
                <Loader2 v-if="resetLoading" class="w-3.5 h-3.5 animate-spin" :stroke-width="2.2" />
                <span>{{ resetLoading ? 'Menyimpan...' : 'Perbarui Kata Sandi' }}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
