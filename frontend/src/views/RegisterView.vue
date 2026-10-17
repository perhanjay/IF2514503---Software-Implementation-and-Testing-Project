<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import SectionBadge from '../components/SectionBadge.vue'
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
  <div class="min-h-screen bg-[#FAFAFA] flex flex-col justify-center items-center p-6 relative overflow-hidden selection:bg-[#0052FF]/20 selection:text-[#0052FF]">
    <!-- Ambient Radial Glows -->
    <div class="radial-glow top-0 right-1/4 w-[500px] h-[500px]"></div>
    <div class="radial-glow bottom-0 left-10 w-[450px] h-[450px]"></div>

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
          <SectionBadge label="Registrasi Studio" />
        </div>
        <h1 class="font-display text-2xl sm:text-3xl text-slate-900 tracking-tight">Daftar Akun Baru</h1>
        <p class="text-xs sm:text-sm text-slate-500 mt-1">Dapatkan bonus 5 token gratis untuk menguji perbaikan stem sesi mixing Anda</p>
      </div>

      <div v-if="errorMsg" class="bg-rose-50 border border-rose-200/80 text-rose-700 text-xs rounded-xl p-3.5 mb-6 flex items-start gap-2.5">
        <span class="text-rose-500 font-bold">⚠️</span>
        <div class="leading-relaxed">{{ errorMsg }}</div>
      </div>

      <form @submit.prevent="handleRegister" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 tracking-wide mb-1.5">Nama Lengkap</label>
          <input 
            v-model="name" 
            type="text" 
            required 
            placeholder="Muhammad Iqbal Ferhan"
            class="w-full bg-slate-50/70 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/20 transition-all font-sans"
          />
        </div>

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
          <label class="block text-xs font-semibold text-slate-700 tracking-wide mb-1.5">Kata Sandi</label>
          <input 
            v-model="password" 
            type="password" 
            required 
            placeholder="Minimal 8 karakter alfanumerik"
            class="w-full bg-slate-50/70 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/20 transition-all font-sans"
          />
          <span class="text-[11px] text-slate-400 mt-1.5 block font-mono-accent">Min. 8 karakter (kombinasi huruf & angka)</span>
        </div>

        <button 
          type="submit" 
          :disabled="loading"
          class="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] text-white font-semibold text-sm shadow-accent hover:shadow-accent-lg hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer mt-3">
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
