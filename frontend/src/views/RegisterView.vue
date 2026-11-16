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
  <div class="min-h-screen bg-paper-white text-ink-black flex flex-col justify-center items-center p-6 selection:bg-black selection:text-white">
    <!-- Top Navigation Links -->
    <div class="w-full max-w-md flex justify-between items-center mb-6 font-mono-accent">
      <router-link to="/" class="inline-flex items-center text-xs font-semibold text-slate hover:text-ink-black transition-colors">
        <span>← Kembali ke Beranda</span>
      </router-link>
      <router-link to="/dashboard" class="inline-flex items-center text-xs font-bold text-ink-black hover:underline underline-offset-4">
        <span>Studio Instan →</span>
      </router-link>
    </div>

    <!-- Main Card -->
    <div class="max-w-md w-full bg-paper-white border-2 border-black rounded-none p-8 sm:p-10 shadow-none">
      <div class="text-center mb-8">
        <router-link to="/" class="inline-block group">
          <div class="w-10 h-10 rounded-none bg-black text-white flex items-center justify-center font-bold text-xl mx-auto mb-3 transition-transform group-hover:scale-105">
            <span>P</span>
          </div>
        </router-link>
        <h1 class="font-editorial text-2xl sm:text-3xl font-bold text-ink-black tracking-tight">Daftar Akun Baru</h1>
        <p class="text-xs sm:text-sm text-slate mt-1.5 font-normal">Dapatkan kuota 5 token awal untuk verifikasi fasa &amp; perbaikan stem audio</p>
      </div>

      <!-- Error Banner -->
      <div v-if="errorMsg" class="bg-rose-50 border border-rose-300 text-rose-900 text-xs rounded-none p-3.5 mb-6 flex items-start gap-2.5 font-medium">
        <svg class="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div class="leading-relaxed">{{ errorMsg }}</div>
      </div>

      <form @submit.prevent="handleRegister" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-ink-black uppercase tracking-wider mb-1.5">Nama Lengkap</label>
          <input 
            v-model="name" 
            type="text" 
            required 
            placeholder="Nama Lengkap Engineer"
            class="w-full bg-paper-white border border-stone rounded-none px-4 py-3 text-sm text-ink-black placeholder:text-slate/60 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-ink-black uppercase tracking-wider mb-1.5">Alamat Email</label>
          <input 
            v-model="email" 
            type="email" 
            required 
            placeholder="engineer@studio.com"
            class="w-full bg-paper-white border border-stone rounded-none px-4 py-3 text-sm text-ink-black placeholder:text-slate/60 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-ink-black uppercase tracking-wider mb-1.5">Kata Sandi</label>
          <input 
            v-model="password" 
            type="password" 
            required 
            placeholder="Minimal 8 karakter alfanumerik"
            class="w-full bg-paper-white border border-stone rounded-none px-4 py-3 text-sm text-ink-black placeholder:text-slate/60 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
          />
          <span class="text-[11px] font-mono-accent text-slate mt-1.5 block">Minimal 8 karakter (kombinasi huruf &amp; angka)</span>
        </div>

        <button 
          type="submit" 
          :disabled="loading"
          class="w-full py-3.5 btn-ink-stamp text-xs font-bold tracking-widest uppercase cursor-pointer disabled:opacity-50 mt-3 transition-all">
          {{ loading ? 'Mendaftarkan Akun...' : 'Daftar & Klaim 5 Token' }}
        </button>
      </form>

      <div class="text-center mt-8 pt-6 border-t border-stone/60 text-xs text-slate">
        Sudah memiliki akun? 
        <router-link to="/login" class="font-bold text-ink-black underline underline-offset-4 hover:text-[#0052FF] font-mono-accent ml-1">
          Masuk di sini
        </router-link>
      </div>
    </div>
  </div>
</template>
