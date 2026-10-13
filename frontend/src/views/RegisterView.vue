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
  <div class="min-h-screen bg-slate-950 flex items-center justify-center p-4">
    <div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-400 font-bold text-2xl border border-cyan-500/30 mb-3">
          P
        </div>
        <h1 class="text-2xl font-bold text-white tracking-tight">Daftar Akun Baru</h1>
        <p class="text-xs text-slate-400 mt-1">Dapatkan 5 token gratis untuk menguji perbaikan sesi multitrack Anda</p>
      </div>

      <div v-if="errorMsg" class="bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs rounded-xl p-3 mb-5">
        {{ errorMsg }}
      </div>

      <form @submit.prevent="handleRegister" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
          <input 
            v-model="name" 
            type="text" 
            required 
            placeholder="Muhammad Iqbal Ferhan"
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Alamat Email</label>
          <input 
            v-model="email" 
            type="email" 
            required 
            placeholder="engineer@studio.com"
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Kata Sandi</label>
          <input 
            v-model="password" 
            type="password" 
            required 
            placeholder="Minimal 8 karakter alfanumerik"
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
          />
          <span class="text-[11px] text-slate-500 mt-1 block">Min. 8 karakter, wajib kombinasi huruf dan angka.</span>
        </div>

        <button 
          type="submit" 
          :disabled="loading"
          class="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors cursor-pointer mt-4">
          {{ loading ? 'Mendaftarkan Akun...' : 'Daftar & Klaim 5 Token' }}
        </button>
      </form>

      <div class="text-center mt-6 text-xs text-slate-400">
        Sudah memiliki akun? 
        <router-link to="/login" class="text-cyan-400 hover:underline font-semibold ml-1">
          Masuk di sini
        </router-link>
      </div>
    </div>
  </div>
</template>
