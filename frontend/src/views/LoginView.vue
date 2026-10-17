<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import SectionBadge from '../components/SectionBadge.vue'
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
  <div class="min-h-screen bg-[#FAFAFA] flex flex-col justify-center items-center p-6 relative overflow-hidden selection:bg-[#0052FF]/20 selection:text-[#0052FF]">
    <!-- Ambient Radial Glows -->
    <div class="radial-glow top-0 left-1/3 w-[500px] h-[500px]"></div>
    <div class="radial-glow bottom-0 right-10 w-[450px] h-[450px]"></div>

    <!-- Top Navigation Link -->
    <div class="w-full max-w-md flex justify-between items-center mb-6 z-10">
      <router-link to="/" class="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors">
        <span class="font-mono text-sm">←</span>
        <span>Kembali ke Beranda</span>
      </router-link>
      <router-link to="/dashboard" class="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0052FF] hover:underline font-mono-accent">
        <span>Studio Instan</span>
        <span>→</span>
      </router-link>
    </div>

    <!-- Main Card -->
    <div class="max-w-md w-full bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-10 shadow-xl relative z-10">
      <div class="text-center mb-8">
        <router-link to="/" class="inline-block">
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0052FF] to-[#4D7CFF] text-white flex items-center justify-center font-display text-2xl shadow-accent mx-auto mb-4 hover:scale-105 transition-transform">
            P
          </div>
        </router-link>
        <div class="flex justify-center mb-3">
          <SectionBadge label="Otentikasi Engineer" />
        </div>
        <h1 class="font-display text-2xl sm:text-3xl text-slate-900 tracking-tight">Masuk ke Studio</h1>
        <p class="text-xs sm:text-sm text-slate-500 mt-1">Platform Diagnostik & Perbaikan Sesi Multitrack Audio</p>
      </div>

      <div v-if="errorMsg" class="bg-rose-50 border border-rose-200/80 text-rose-700 text-xs rounded-xl p-3.5 mb-6 flex items-start gap-2.5">
        <span class="text-rose-500 font-bold">⚠️</span>
        <div class="leading-relaxed">{{ errorMsg }}</div>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 tracking-wide mb-1.5">Alamat Email</label>
          <input 
            v-model="email" 
            type="email" 
            required 
            placeholder="engineer@studio.com"
            class="w-full bg-slate-50/70 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/20 transition-all font-sans"
          />
        </div>

        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="block text-xs font-semibold text-slate-700 tracking-wide">Kata Sandi</label>
            <span class="text-[11px] text-slate-400 cursor-not-allowed">Lupa kata sandi?</span>
          </div>
          <input 
            v-model="password" 
            type="password" 
            required 
            placeholder="••••••••"
            class="w-full bg-slate-50/70 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/20 transition-all font-sans"
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
          class="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] text-white font-semibold text-sm shadow-accent hover:shadow-accent-lg hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer mt-2">
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
  </div>
</template>
