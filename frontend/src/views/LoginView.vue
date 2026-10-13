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
const loading = ref(false)

async function handleLogin() {
  errorMsg.value = ''
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
</script>

<template>
  <div class="min-h-screen bg-slate-950 flex items-center justify-center p-4">
    <div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-400 font-bold text-2xl border border-cyan-500/30 mb-3">
          P
        </div>
        <h1 class="text-2xl font-bold text-white tracking-tight">Masuk ke Polaris Audio</h1>
        <p class="text-xs text-slate-400 mt-1">Platform Diagnostik & Perbaikan Sesi Mixing Audio</p>
      </div>

      <div v-if="errorMsg" class="bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs rounded-xl p-3 mb-5">
        {{ errorMsg }}
      </div>

      <form @submit.prevent="handleLogin" class="space-y-4">
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
            placeholder="••••••••"
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div class="flex items-center justify-between text-xs">
          <label class="flex items-center text-slate-400 cursor-pointer">
            <input v-model="rememberMe" type="checkbox" class="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0 mr-2" />
            Ingat Saya
          </label>
          <span class="text-slate-500">Lupa kata sandi?</span>
        </div>

        <button 
          type="submit" 
          :disabled="loading"
          class="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors cursor-pointer mt-2">
          {{ loading ? 'Memverifikasi...' : 'Masuk ke Sistem' }}
        </button>
      </form>

      <div class="text-center mt-6 text-xs text-slate-400">
        Belum punya akun? 
        <router-link to="/register" class="text-cyan-400 hover:underline font-semibold ml-1">
          Daftar Akun Baru (Dapat 5 Token)
        </router-link>
      </div>
    </div>
  </div>
</template>
