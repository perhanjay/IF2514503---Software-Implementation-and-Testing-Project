<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const name = ref('')
const email = ref('')
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)

async function handleRegister() {
  errorMsg.value = ''
  loading.value = true
  try {
    const res = await axios.post('/api/v1/auth/register', {
      name: name.value,
      email: email.value,
      password: password.value
    })
    authStore.setAuth(res.data.user, res.data.token, res.data.wallet.balance)
    router.push('/dashboard')
  } catch (err) {
    errorMsg.value = err.response?.data?.error || 'Gagal mendaftar akun baru'
  } finally {
    loading.value = false
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
        <h1 class="font-display text-2xl sm:text-3xl text-slate-900 tracking-tight">Daftar Akun Baru</h1>
        <p class="text-xs sm:text-sm text-slate-500 mt-1">Dapatkan bonus 5 token gratis untuk menguji perbaikan stem sesi mixing Anda</p>
      </div>

      <div v-if="errorMsg" class="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3.5 mb-6 flex items-start gap-2.5">
        <svg class="w-4 h-4 text-rose-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div class="leading-relaxed">{{ errorMsg }}</div>
      </div>

      <form @submit.prevent="handleRegister" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 tracking-wide mb-1.5">Nama Lengkap</label>
          <input 
            v-model="name" 
            type="text" 
            required 
            placeholder="Nama Lengkap Engineer"
            class="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/20 transition-all"
          />
        </div>

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
          <label class="block text-xs font-semibold text-slate-700 tracking-wide mb-1.5">Kata Sandi</label>
          <input 
            v-model="password" 
            type="password" 
            required 
            placeholder="Minimal 8 karakter alfanumerik"
            class="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/20 transition-all"
          />
          <span class="text-[11px] text-slate-400 mt-1.5 block">Minimal 8 karakter (kombinasi huruf &amp; angka)</span>
        </div>

        <button 
          type="submit" 
          :disabled="loading"
          class="w-full py-3.5 rounded-xl bg-[#0052FF] hover:bg-[#0043D6] text-white font-semibold text-sm shadow-accent transition-all cursor-pointer mt-3">
          {{ loading ? 'Mendaftarkan Akun...' : 'Daftar & Klaim 5 Token' }}
        </button>
      </form>

      <div class="text-center mt-8 pt-6 border-t border-slate-100 text-xs text-slate-500">
        Sudah memiliki akun? 
        <router-link to="/login" class="text-[#0052FF] hover:underline font-semibold ml-1">
          Masuk di sini
        </router-link>
      </div>
    </div>
  </div>
</template>
