<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const rememberMe = ref(false)
const errorMsg = ref('')
const infoMsg = ref('')
const loading = ref(false)

// UC-03: Modal Interaktif Pemulihan Kata Sandi
const showResetModal = ref(false)
const resetStep = ref(1) // 1: Input Email, 2: Input Token & New Password
const resetEmail = ref('')
const resetToken = ref('')
const resetNewPassword = ref('')
const resetConfirmPassword = ref('')
const resetLoading = ref(false)
const resetErrorMsg = ref('')
const resetSuccessMsg = ref('')

async function handleLogin() {
  errorMsg.value = ''
  infoMsg.value = ''
  loading.value = true
  try {
    const res = await axios.post('/api/v1/auth/login', {
      email: email.value,
      password: password.value,
      rememberMe: rememberMe.value
    })
    authStore.setAuth(res.data.user, res.data.token, res.data.wallet.balance)
    router.push('/dashboard')
  } catch (err) {
    errorMsg.value = err.response?.data?.error || 'Gagal login ke sistem'
  } finally {
    loading.value = false
  }
}

function handleForgotPassword() {
  resetStep.value = 1
  resetEmail.value = email.value || ''
  resetToken.value = ''
  resetNewPassword.value = ''
  resetConfirmPassword.value = ''
  resetErrorMsg.value = ''
  resetSuccessMsg.value = ''
  showResetModal.value = true
}

function closeResetModal() {
  showResetModal.value = false
  resetErrorMsg.value = ''
  resetSuccessMsg.value = ''
}

async function handleRequestReset() {
  resetErrorMsg.value = ''
  resetSuccessMsg.value = ''
  if (!resetEmail.value || !resetEmail.value.trim()) {
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
      // Beralih ke Step 2 otomatis
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
  if (!resetToken.value || !resetToken.value.trim()) {
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
    closeResetModal()
    infoMsg.value = res.data.message || 'Kata sandi berhasil diperbarui. Silakan login menggunakan kata sandi baru.'
    if (resetEmail.value) {
      email.value = resetEmail.value
    }
    password.value = ''
  } catch (err) {
    resetErrorMsg.value = err.response?.data?.error || 'Gagal mengatur ulang kata sandi'
  } finally {
    resetLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#FAFAFA] flex flex-col justify-center items-center p-6 selection:bg-[#0052FF]/20 selection:text-[#0052FF]">
    <!-- Top Navigation Links -->
    <div class="w-full max-w-md flex justify-between items-center mb-6">
      <router-link to="/" class="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors">
        <span>Kembali ke Beranda</span>
      </router-link>
      <router-link to="/dashboard" class="inline-flex items-center text-xs font-semibold text-[#0052FF] hover:underline font-mono-accent">
        <span>Studio Instan</span>
      </router-link>
    </div>

    <!-- Main Card -->
    <div class="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-sm">
      <div class="text-center mb-8">
        <router-link to="/" class="inline-block">
          <div class="w-12 h-12 rounded-2xl bg-[#0052FF] text-white flex items-center justify-center font-display text-2xl shadow-accent mx-auto mb-4 hover:bg-[#0043D6] transition-colors">
            P
          </div>
        </router-link>
        <h1 class="font-display text-2xl sm:text-3xl text-slate-900 tracking-tight">Masuk ke Studio</h1>
        <p class="text-xs sm:text-sm text-slate-500 mt-1">Platform Diagnostik &amp; Perbaikan Sesi Multitrack Audio</p>
      </div>

      <!-- Error State -->
      <div v-if="errorMsg" class="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3.5 mb-6 flex items-start gap-2.5">
        <svg class="w-4 h-4 text-rose-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div class="leading-relaxed">{{ errorMsg }}</div>
      </div>

      <!-- Info / Reset State -->
      <div v-if="infoMsg" class="bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-xl p-3.5 mb-6 flex items-start gap-2.5">
        <svg class="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div class="leading-relaxed">{{ infoMsg }}</div>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 tracking-wide mb-1.5">Alamat Email</label>
          <input 
            v-model="email" 
            type="email" 
            required 
            placeholder="engineer@studio.com"
            class="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/20 transition-all"
          />
        </div>

        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="block text-xs font-semibold text-slate-700 tracking-wide">Kata Sandi</label>
            <button 
              type="button"
              @click="handleForgotPassword"
              class="text-[11px] text-[#0052FF] hover:underline cursor-pointer">
              Lupa kata sandi?
            </button>
          </div>
          <input 
            v-model="password" 
            type="password" 
            required 
            placeholder="••••••••"
            class="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/20 transition-all"
          />
        </div>

        <div class="flex items-center justify-between text-xs pt-1">
          <label class="flex items-center text-slate-600 cursor-pointer select-none">
            <input v-model="rememberMe" type="checkbox" class="rounded border-slate-300 text-[#0052FF] focus:ring-[#0052FF]/20 mr-2" />
            Ingat Saya (30 Hari)
          </label>
        </div>

        <button 
          type="submit" 
          :disabled="loading"
          class="w-full py-3.5 rounded-xl bg-[#0052FF] hover:bg-[#0043D6] text-white font-semibold text-sm shadow-accent transition-all cursor-pointer mt-2">
          {{ loading ? 'Memverifikasi...' : 'Masuk ke Sistem' }}
        </button>
      </form>

      <div class="text-center mt-8 pt-6 border-t border-slate-100 text-xs text-slate-500">
        Belum memiliki akun permanen? 
        <router-link to="/register" class="text-[#0052FF] hover:underline font-semibold ml-1">
          Daftar (Dapat 5 Token)
        </router-link>
      </div>
    </div>

    <!-- Modal Interaktif Pemulihan Kata Sandi (UC-03) -->
    <div 
      v-if="showResetModal" 
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div 
        class="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl relative"
        @click.stop>
        <!-- Modal Header -->
        <div class="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center font-bold text-sm">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div>
              <h3 class="font-display text-lg font-semibold text-slate-900">Pemulihan Kata Sandi</h3>
              <p class="text-xs text-slate-500">Atur ulang akses akun studio Polaris Anda</p>
            </div>
          </div>
          <button 
            @click="closeResetModal" 
            type="button"
            class="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Step Indicator -->
        <div class="flex items-center gap-2 mb-5">
          <button 
            type="button"
            @click="resetStep = 1"
            class="flex-1 py-1.5 text-xs font-semibold rounded-lg text-center transition-all cursor-pointer"
            :class="resetStep === 1 ? 'bg-[#0052FF] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'">
            1. Minta Token
          </button>
          <button 
            type="button"
            @click="resetStep = 2"
            class="flex-1 py-1.5 text-xs font-semibold rounded-lg text-center transition-all cursor-pointer"
            :class="resetStep === 2 ? 'bg-[#0052FF] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'">
            2. Kata Sandi Baru
          </button>
        </div>

        <!-- Error Notification -->
        <div v-if="resetErrorMsg" class="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3 mb-4 flex items-start gap-2">
          <svg class="w-4 h-4 text-rose-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span class="leading-relaxed">{{ resetErrorMsg }}</span>
        </div>

        <!-- Success Notification -->
        <div v-if="resetSuccessMsg" class="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-3 mb-4 flex items-start gap-2">
          <svg class="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span class="leading-relaxed">{{ resetSuccessMsg }}</span>
        </div>

        <!-- Step 1: Input Email Form -->
        <form v-if="resetStep === 1" @submit.prevent="handleRequestReset" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 tracking-wide mb-1.5">Alamat Email Terdaftar</label>
            <input 
              v-model="resetEmail" 
              type="email" 
              required 
              placeholder="engineer@studio.com"
              class="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/20 transition-all"
            />
            <p class="text-[11px] text-slate-500 mt-1">Kami akan menerbitkan token pemulihan sementara (berlaku 1 jam).</p>
          </div>

          <div class="flex items-center justify-end gap-2.5 pt-2">
            <button 
              type="button"
              @click="closeResetModal"
              class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
              Batal
            </button>
            <button 
              type="submit" 
              :disabled="resetLoading"
              class="px-5 py-2.5 rounded-xl bg-[#0052FF] hover:bg-[#0043D6] disabled:opacity-50 text-white font-semibold text-xs shadow-accent transition-all cursor-pointer flex items-center gap-2">
              <svg v-if="resetLoading" class="animate-spin w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>{{ resetLoading ? 'Mengirim...' : 'Kirim Token Pemulihan' }}</span>
            </button>
          </div>
        </form>

        <!-- Step 2: Input Token & New Password Form -->
        <form v-else @submit.prevent="handleExecuteReset" class="space-y-3.5">
          <div>
            <label class="block text-xs font-semibold text-slate-700 tracking-wide mb-1">Token Pemulihan</label>
            <input 
              v-model="resetToken" 
              type="text" 
              required 
              placeholder="Masukkan 64-karakter token"
              class="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-xs font-mono-accent text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/20 transition-all"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 tracking-wide mb-1">Kata Sandi Baru</label>
            <input 
              v-model="resetNewPassword" 
              type="password" 
              required 
              placeholder="Minimal 8 karakter kombinasi huruf &amp; angka"
              class="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/20 transition-all"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 tracking-wide mb-1">Konfirmasi Kata Sandi Baru</label>
            <input 
              v-model="resetConfirmPassword" 
              type="password" 
              required 
              placeholder="Ketik ulang kata sandi baru"
              class="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/20 transition-all"
            />
          </div>

          <div class="flex items-center justify-between pt-2">
            <button 
              type="button"
              @click="resetStep = 1"
              class="text-xs text-[#0052FF] hover:underline font-semibold cursor-pointer">
              ← Kembali ke Langkah 1
            </button>
            <div class="flex items-center gap-2">
              <button 
                type="button"
                @click="closeResetModal"
                class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
                Batal
              </button>
              <button 
                type="submit" 
                :disabled="resetLoading"
                class="px-5 py-2.5 rounded-xl bg-[#0052FF] hover:bg-[#0043D6] disabled:opacity-50 text-white font-semibold text-xs shadow-accent transition-all cursor-pointer flex items-center gap-2">
                <svg v-if="resetLoading" class="animate-spin w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>{{ resetLoading ? 'Menyimpan...' : 'Perbarui Kata Sandi' }}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
