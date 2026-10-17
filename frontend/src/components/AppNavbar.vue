<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const isGuest = computed(() => {
  return !authStore.user || authStore.user?.isGuest || authStore.user?.email === 'guest@polaris.audio'
})

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <header class="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md transition-all">
    <div class="max-w-6xl mx-auto px-6 h-18 flex items-center justify-between">
      <!-- Logo Branding -->
      <router-link to="/" class="flex items-center gap-3 group">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0052FF] to-[#4D7CFF] text-white flex items-center justify-center font-bold text-xl shadow-accent group-hover:scale-105 transition-transform">
          <span class="font-display">P</span>
        </div>
        <div class="leading-none">
          <span class="font-display text-xl text-slate-900 tracking-tight block">Polaris Audio</span>
          <span class="font-mono-accent text-[10px] text-slate-500 uppercase tracking-widest mt-0.5 block">Session Prep Engine</span>
        </div>
      </router-link>

      <!-- Center Navigation -->
      <nav class="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
        <router-link 
          to="/" 
          :class="route.path === '/' ? 'text-[#0052FF] font-semibold' : 'hover:text-slate-900'"
          class="transition-colors">
          Beranda
        </router-link>
        <router-link 
          to="/dashboard" 
          :class="route.path === '/dashboard' ? 'text-[#0052FF] font-semibold' : 'hover:text-slate-900'"
          class="transition-colors flex items-center gap-1.5">
          <span>Studio Workspace</span>
          <span class="px-1.5 py-0.5 text-[10px] font-mono-accent bg-emerald-100 text-emerald-800 rounded font-bold">LIVE</span>
        </router-link>
      </nav>

      <!-- Right Actions & Token Pill -->
      <div class="flex items-center gap-3">
        <!-- Saldo Token Badge -->
        <router-link 
          to="/dashboard"
          class="flex items-center gap-2 bg-[#F1F5F9] hover:bg-slate-200 border border-slate-300/80 rounded-xl px-3.5 py-2 transition-all">
          <span class="w-2 h-2 rounded-full bg-[#0052FF] animate-pulse-dot" />
          <span class="font-mono-accent text-xs text-slate-600">Kuota:</span>
          <span class="font-mono-accent text-xs font-bold text-[#0052FF]">{{ authStore.walletBalance }} Token</span>
        </router-link>

        <!-- Auth States -->
        <template v-if="authStore.isAuthenticated && !isGuest">
          <div class="hidden sm:flex flex-col text-right leading-tight">
            <span class="text-xs font-semibold text-slate-800">{{ authStore.user?.name }}</span>
            <span class="text-[10px] text-slate-500 font-mono-accent">Pro Engineer</span>
          </div>
          <button 
            @click="handleLogout"
            class="text-xs font-medium text-slate-500 hover:text-rose-600 px-3 py-2 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer">
            Keluar
          </button>
        </template>

        <template v-else>
          <router-link 
            to="/login"
            class="text-xs font-semibold text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-xl transition-colors">
            Masuk
          </router-link>
          <router-link 
            to="/register"
            class="hidden sm:inline-flex items-center justify-center text-xs font-semibold text-white px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] shadow-accent hover:shadow-accent-lg hover:-translate-y-0.5 transition-all cursor-pointer">
            Daftar Akun
          </router-link>
        </template>
      </div>
    </div>
  </header>
</template>
