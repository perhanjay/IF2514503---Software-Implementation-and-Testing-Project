<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const mobileMenuOpen = ref(false)

const isGuest = computed(() => {
  return !authStore.user || authStore.user?.isGuest || authStore.user?.email === 'guest@polaris.audio'
})

function handleLogout() {
  authStore.logout()
  mobileMenuOpen.value = false
  router.push('/login')
}
</script>

<template>
  <header class="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md transition-all">
    <div class="max-w-6xl mx-auto px-6 h-18 flex items-center justify-between">
      <!-- Logo Branding -->
      <router-link to="/" class="flex items-center gap-3 group">
        <div class="w-10 h-10 rounded-xl bg-[#0052FF] text-white flex items-center justify-center font-bold text-xl shadow-accent group-hover:bg-[#0043D6] transition-colors">
          <span class="font-display">P</span>
        </div>
        <div class="leading-none">
          <span class="font-display text-xl text-slate-900 tracking-tight block">Polaris Audio</span>
          <span class="text-xs text-slate-500 block mt-0.5">Session Prep Engine</span>
        </div>
      </router-link>

      <!-- Center Desktop Navigation -->
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
          class="transition-colors">
          Studio Workspace
        </router-link>
        <router-link 
          to="/billing" 
          :class="route.path === '/billing' || route.path === '/wallet' ? 'text-[#0052FF] font-semibold' : 'hover:text-slate-900'"
          class="transition-colors">
          Dompet & Kuota
        </router-link>
      </nav>

      <!-- Right Actions & Token Pill -->
      <div class="flex items-center gap-3">
        <!-- Saldo Token Badge -->
        <router-link 
          to="/billing"
          title="Kelola saldo dan beli paket token"
          class="flex items-center gap-2 bg-[#F1F5F9] hover:bg-slate-200 border border-slate-300/80 rounded-xl px-3.5 py-2 transition-all">
          <span class="w-2 h-2 rounded-full bg-[#0052FF]" />
          <span class="font-mono-accent text-xs text-slate-600">Kuota:</span>
          <span class="font-mono-accent text-xs font-bold text-[#0052FF]">{{ authStore.walletBalance }} Token</span>
        </router-link>

        <!-- Auth States (Desktop) -->
        <template v-if="authStore.isAuthenticated && !isGuest">
          <div class="hidden sm:flex flex-col text-right leading-tight">
            <span class="text-xs font-semibold text-slate-800">{{ authStore.user?.name }}</span>
            <span class="text-[10px] text-slate-500 font-mono-accent">Pro Engineer</span>
          </div>
          <button 
            @click="handleLogout"
            class="hidden sm:inline-flex text-xs font-medium text-slate-500 hover:text-rose-600 px-3 py-2 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer">
            Keluar
          </button>
        </template>

        <template v-else>
          <router-link 
            to="/login"
            class="hidden sm:inline-flex text-xs font-semibold text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-xl transition-colors">
            Masuk
          </router-link>
          <router-link 
            to="/register"
            class="hidden sm:inline-flex items-center justify-center text-xs font-semibold text-white px-4 py-2.5 rounded-xl bg-[#0052FF] hover:bg-[#0043D6] shadow-accent hover:shadow-accent-lg transition-all cursor-pointer">
            Daftar Akun
          </router-link>
        </template>

        <!-- Mobile Menu Hamburger Button (R-03) -->
        <button 
          @click="mobileMenuOpen = !mobileMenuOpen"
          type="button"
          aria-label="Navigasi Menu"
          :aria-expanded="mobileMenuOpen"
          class="md:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer">
          <svg v-if="!mobileMenuOpen" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Mobile Drawer Menu (R-03) -->
    <div v-if="mobileMenuOpen" class="md:hidden border-t border-slate-200 bg-white px-6 py-4 space-y-3 animate-fade-in">
      <router-link 
        to="/" 
        @click="mobileMenuOpen = false"
        :class="route.path === '/' ? 'text-[#0052FF] font-semibold bg-blue-50/60' : 'text-slate-700 hover:bg-slate-50'"
        class="block px-3 py-2 rounded-lg text-sm transition-colors">
        Beranda
      </router-link>
      <router-link 
        to="/dashboard" 
        @click="mobileMenuOpen = false"
        :class="route.path === '/dashboard' ? 'text-[#0052FF] font-semibold bg-blue-50/60' : 'text-slate-700 hover:bg-slate-50'"
        class="block px-3 py-2 rounded-lg text-sm transition-colors">
        Studio Workspace
      </router-link>
      <router-link 
        to="/billing" 
        @click="mobileMenuOpen = false"
        :class="route.path === '/billing' || route.path === '/wallet' ? 'text-[#0052FF] font-semibold bg-blue-50/60' : 'text-slate-700 hover:bg-slate-50'"
        class="block px-3 py-2 rounded-lg text-sm transition-colors">
        Dompet & Kuota Token
      </router-link>

      <div class="pt-3 border-t border-slate-100 flex flex-col gap-2">
        <template v-if="authStore.isAuthenticated && !isGuest">
          <div class="px-3 py-1">
            <span class="block text-xs font-semibold text-slate-800">{{ authStore.user?.name }}</span>
            <span class="text-[10px] text-slate-500 font-mono-accent">Pro Engineer</span>
          </div>
          <button 
            @click="handleLogout"
            class="text-left w-full text-xs font-medium text-rose-600 px-3 py-2 rounded-lg hover:bg-rose-50 transition-colors">
            Keluar Akun
          </button>
        </template>
        <template v-else>
          <router-link 
            to="/login"
            @click="mobileMenuOpen = false"
            class="block px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50">
            Masuk ke Studio
          </router-link>
          <router-link 
            to="/register"
            @click="mobileMenuOpen = false"
            class="block text-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#0052FF] hover:bg-[#0043D6]">
            Daftar Akun Baru
          </router-link>
        </template>
      </div>
    </div>
  </header>
</template>
