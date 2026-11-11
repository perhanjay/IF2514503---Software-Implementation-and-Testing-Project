<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const props = defineProps({
  fluid: {
    type: Boolean,
    default: null
  }
})

const isFluid = computed(() => {
  if (props.fluid !== null) return props.fluid
  return route.path === '/dashboard' || route.path.startsWith('/dashboard') || route.path === '/billing' || route.path === '/wallet' || route.path.startsWith('/admin')
})

const mobileMenuOpen = ref(false)

// UC-04 & UC-05: Modal Pengaturan Akun
const showSettingsModal = ref(false)
const settingsTab = ref('profile') // 'profile' | 'security'

const profileName = ref('')
const profileLoading = ref(false)
const profileError = ref('')
const profileSuccess = ref('')

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const securityLoading = ref(false)
const securityError = ref('')
const securitySuccess = ref('')

const isGuest = computed(() => {
  return !authStore.user || authStore.user?.isGuest || authStore.user?.email === 'guest@polaris.audio'
})

function openSettingsModal(tab = 'profile') {
  settingsTab.value = tab
  profileName.value = authStore.user?.name || ''
  profileError.value = ''
  profileSuccess.value = ''
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  securityError.value = ''
  securitySuccess.value = ''
  mobileMenuOpen.value = false
  showSettingsModal.value = true
}

function closeSettingsModal() {
  showSettingsModal.value = false
  profileError.value = ''
  profileSuccess.value = ''
  securityError.value = ''
  securitySuccess.value = ''
}

function handleKeyDown(e) {
  if (e.key === 'Escape' && showSettingsModal.value) {
    closeSettingsModal()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

async function handleUpdateProfile() {
  profileError.value = ''
  profileSuccess.value = ''
  if (!profileName.value || !profileName.value.trim()) {
    profileError.value = 'Nama lengkap wajib diisi'
    return
  }
  profileLoading.value = true
  try {
    const res = await axios.patch('/api/v1/auth/profile', {
      name: profileName.value.trim()
    })
    if (authStore.user) {
      authStore.user.name = res.data.user.name
      localStorage.setItem('polaris_user', JSON.stringify(authStore.user))
    }
    profileSuccess.value = res.data.message || 'Profil berhasil diperbarui'
  } catch (err) {
    profileError.value = err.response?.data?.error || 'Gagal memperbarui profil'
  } finally {
    profileLoading.value = false
  }
}

async function handleChangePassword() {
  securityError.value = ''
  securitySuccess.value = ''
  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    securityError.value = 'Seluruh kolom kata sandi wajib diisi'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    securityError.value = 'Konfirmasi kata sandi baru tidak cocok'
    return
  }
  if (newPassword.value.length < 8 || !/(?=.*[a-zA-Z])(?=.*[0-9])/.test(newPassword.value)) {
    securityError.value = 'Kata sandi baru minimal 8 karakter dan mengandung kombinasi huruf serta angka'
    return
  }
  securityLoading.value = true
  try {
    const res = await axios.post('/api/v1/auth/change-password', {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
      confirmPassword: confirmPassword.value
    })
    securitySuccess.value = (res.data.message || 'Kata sandi berhasil diperbarui') + '. Mengalihkan ke login...'
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    setTimeout(() => {
      handleLogout()
    }, 1500)
  } catch (err) {
    securityError.value = err.response?.data?.error || 'Gagal memperbarui kata sandi'
  } finally {
    securityLoading.value = false
  }
}

function handleLogout() {
  authStore.logout()
  mobileMenuOpen.value = false
  router.push('/login')
}
</script>

<template>
  <header class="sticky top-0 z-40 w-full border-b border-[#c1c0bc] bg-white transition-all">
    <div :class="isFluid ? 'w-full max-w-[1800px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12' : 'max-w-[1200px] mx-auto px-6'" class="h-18 flex items-center justify-between">
      <!-- Logo Branding -->
      <router-link to="/" class="flex items-center gap-3 group">
        <div class="w-9 h-9 rounded-none bg-black text-white flex items-center justify-center font-bold text-lg transition-transform group-hover:scale-105">
          <span>P</span>
        </div>
        <div class="leading-tight">
          <span class="font-editorial text-lg text-black tracking-tight block">Polaris Audio</span>
          <span class="text-[10px] font-medium tracking-[0.1em] uppercase text-[#60605e] block">Session Prep Engine</span>
        </div>
      </router-link>

      <!-- Center Desktop Navigation -->
      <nav class="hidden md:flex items-center gap-8 text-sm font-medium">
        <router-link 
          to="/" 
          :class="route.path === '/' ? 'text-black font-semibold border-b-2 border-black pb-0.5' : 'text-[#60605e] hover:text-black'"
          class="transition-colors">
          Beranda
        </router-link>
        <router-link 
          to="/dashboard" 
          :class="route.path === '/dashboard' ? 'text-black font-semibold border-b-2 border-black pb-0.5' : 'text-[#60605e] hover:text-black'"
          class="transition-colors">
          Studio Workspace
        </router-link>
        <router-link 
          to="/billing" 
          :class="route.path === '/billing' || route.path === '/wallet' ? 'text-black font-semibold border-b-2 border-black pb-0.5' : 'text-[#60605e] hover:text-black'"
          class="transition-colors">
          Dompet & Kuota
        </router-link>
        <router-link 
          v-if="authStore.user?.role === 'ADMIN'"
          to="/admin/users" 
          :class="route.path.startsWith('/admin') ? 'text-black font-semibold border-b-2 border-black pb-0.5' : 'text-[#60605e] hover:text-black'"
          class="transition-colors">
          Admin: Pengguna
        </router-link>
      </nav>

      <!-- Right Actions & Token Pill -->
      <div class="flex items-center gap-3">
        <!-- Saldo Token Badge -->
        <router-link 
          to="/billing"
          title="Kelola saldo dan beli paket token"
          class="flex items-center gap-2 bg-[#f1f0eb] hover:bg-[#e4d9cf] border border-[#c1c0bc] rounded-none px-3.5 py-2 transition-all">
          <span class="w-2 h-2 rounded-full bg-black" />
          <span class="font-mono-accent text-xs text-[#60605e]">Kuota:</span>
          <span class="font-mono-accent text-xs font-bold text-black">{{ authStore.walletBalance }} Token</span>
        </router-link>

        <!-- Auth States (Desktop) -->
        <template v-if="authStore.isAuthenticated && !isGuest">
          <button 
            type="button"
            @click="openSettingsModal('profile')"
            title="Buka Pengaturan Akun"
            class="hidden sm:flex flex-col text-right leading-tight cursor-pointer group px-2 py-1 rounded-none hover:bg-[#f1f0eb] transition-colors">
            <span class="text-xs font-semibold text-black group-hover:underline transition-colors flex items-center gap-1 justify-end">
              <span>{{ authStore.user?.name }}</span>
              <svg class="w-3 h-3 text-[#60605e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            <span class="text-[10px] text-[#60605e] font-mono-accent">Pengaturan Akun</span>
          </button>
          <button 
            @click="handleLogout"
            class="hidden sm:inline-flex text-xs font-medium text-[#60605e] hover:text-rose-600 px-3 py-2 rounded-none hover:bg-rose-50 transition-colors cursor-pointer">
            Keluar
          </button>
        </template>

        <template v-else>
          <router-link 
            to="/login"
            class="hidden sm:inline-flex text-xs font-semibold uppercase tracking-[0.05em] text-black bg-[#f1f0eb] hover:bg-[#e4d9cf] px-4 py-2.5 rounded-none transition-colors">
            Masuk
          </router-link>
          <router-link 
            to="/register"
            class="hidden sm:inline-flex items-center justify-center text-xs font-semibold uppercase tracking-[0.1em] text-white px-5 py-2.5 rounded-none bg-black hover:bg-[#292c33] transition-all cursor-pointer">
            Daftar Akun
          </router-link>
        </template>

        <!-- Mobile Menu Hamburger Button (R-03) -->
        <button 
          @click="mobileMenuOpen = !mobileMenuOpen"
          type="button"
          aria-label="Navigasi Menu"
          :aria-expanded="mobileMenuOpen"
          class="md:hidden p-2 rounded-none border border-[#c1c0bc] text-black hover:bg-[#f1f0eb] cursor-pointer">
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
    <div v-if="mobileMenuOpen" class="md:hidden border-t border-[#c1c0bc] bg-white px-6 py-4 space-y-2 animate-fade-in">
      <router-link 
        to="/" 
        @click="mobileMenuOpen = false"
        :class="route.path === '/' ? 'text-black font-semibold bg-[#f1f0eb]' : 'text-[#60605e] hover:bg-[#f1f0eb]/60'"
        class="block px-3 py-2 rounded-none text-sm transition-colors">
        Beranda
      </router-link>
      <router-link 
        to="/dashboard" 
        @click="mobileMenuOpen = false"
        :class="route.path === '/dashboard' ? 'text-black font-semibold bg-[#f1f0eb]' : 'text-[#60605e] hover:bg-[#f1f0eb]/60'"
        class="block px-3 py-2 rounded-none text-sm transition-colors">
        Studio Workspace
      </router-link>
      <router-link 
        to="/billing" 
        @click="mobileMenuOpen = false"
        :class="route.path === '/billing' || route.path === '/wallet' ? 'text-black font-semibold bg-[#f1f0eb]' : 'text-[#60605e] hover:bg-[#f1f0eb]/60'"
        class="block px-3 py-2 rounded-none text-sm transition-colors">
        Dompet & Kuota Token
      </router-link>
      <router-link 
        v-if="authStore.user?.role === 'ADMIN'"
        to="/admin/users" 
        @click="mobileMenuOpen = false"
        :class="route.path.startsWith('/admin') ? 'text-black font-semibold bg-[#f1f0eb]' : 'text-[#60605e] hover:bg-[#f1f0eb]/60'"
        class="block px-3 py-2 rounded-none text-sm transition-colors">
        Admin: Pengguna
      </router-link>

      <div class="pt-3 border-t border-[#c1c0bc] flex flex-col gap-2">
        <template v-if="authStore.isAuthenticated && !isGuest">
          <div class="px-3 py-1 flex items-center justify-between">
            <div>
              <span class="block text-xs font-semibold text-black">{{ authStore.user?.name }}</span>
              <span class="text-[10px] text-[#60605e] font-mono-accent">Pro Engineer</span>
            </div>
            <button 
              type="button"
              @click="openSettingsModal('profile')"
              class="text-xs text-black font-semibold underline cursor-pointer">
              Pengaturan Akun
            </button>
          </div>
          <button 
            @click="handleLogout"
            class="text-left w-full text-xs font-medium text-rose-600 px-3 py-2 rounded-none hover:bg-rose-50 transition-colors">
            Keluar Akun
          </button>
        </template>
        <template v-else>
          <router-link 
            to="/login"
            @click="mobileMenuOpen = false"
            class="block px-3 py-2 rounded-none text-sm text-black bg-[#f1f0eb] hover:bg-[#e4d9cf] font-semibold uppercase tracking-[0.05em]">
            Masuk ke Studio
          </router-link>
          <router-link 
            to="/register"
            @click="mobileMenuOpen = false"
            class="block text-center px-4 py-2.5 rounded-none text-sm font-semibold uppercase tracking-[0.1em] text-white bg-black hover:bg-[#292c33]">
            Daftar Akun Baru
          </router-link>
        </template>
      </div>
    </div>

  </header>

  <!-- Modal Pengaturan Akun (UC-04: Ubah Profil & UC-05: Ubah Kata Sandi) -->
  <Teleport to="body">
    <div 
      v-if="showSettingsModal" 
      class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 overflow-y-auto"
      @click="closeSettingsModal">
      <div 
        class="bg-white border-2 border-black rounded-none p-6 sm:p-8 max-w-md w-full relative my-auto max-h-[90vh] overflow-y-auto"
        @click.stop>
        <!-- Modal Header -->
        <div class="flex items-center justify-between pb-4 border-b border-[#c1c0bc] mb-5">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-none bg-[#f1f0eb] text-black flex items-center justify-center font-bold text-sm shrink-0">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h3 class="font-display text-lg font-bold text-black">Pengaturan Akun</h3>
              <p class="text-xs text-[#60605e]">Kelola identitas dan keamanan akun engineer Anda</p>
            </div>
          </div>
          <button 
            @click="closeSettingsModal" 
            type="button"
            title="Tutup (Esc)"
            class="text-[#60605e] hover:text-black p-1.5 rounded-none hover:bg-[#f1f0eb] transition-colors cursor-pointer">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Tab Controls -->
        <div class="flex items-center gap-2 mb-5">
          <button 
            type="button"
            @click="settingsTab = 'profile'"
            class="flex-1 py-2 text-xs font-semibold rounded-none uppercase tracking-[0.05em] text-center transition-all cursor-pointer"
            :class="settingsTab === 'profile' ? 'bg-black text-white' : 'bg-[#f1f0eb] text-[#60605e] hover:bg-[#e4d9cf] hover:text-black'">
            Profil Akun
          </button>
          <button 
            type="button"
            @click="settingsTab = 'security'"
            class="flex-1 py-2 text-xs font-semibold rounded-none uppercase tracking-[0.05em] text-center transition-all cursor-pointer"
            :class="settingsTab === 'security' ? 'bg-black text-white' : 'bg-[#f1f0eb] text-[#60605e] hover:bg-[#e4d9cf] hover:text-black'">
            Ubah Kata Sandi
          </button>
        </div>

        <!-- Tab 1: Ubah Profil (UC-04) -->
        <form v-if="settingsTab === 'profile'" @submit.prevent="handleUpdateProfile" class="space-y-4">
          <div v-if="profileError" class="bg-rose-50 border border-rose-300 text-rose-800 text-xs rounded-none p-3 flex items-start gap-2">
            <svg class="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span class="leading-relaxed">{{ profileError }}</span>
          </div>

          <div v-if="profileSuccess" class="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-none p-3 flex items-start gap-2">
            <svg class="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span class="leading-relaxed">{{ profileSuccess }}</span>
          </div>

          <div>
            <label class="block text-xs font-semibold text-black uppercase tracking-wider mb-1.5">Alamat Email</label>
            <input 
              :value="authStore.user?.email" 
              type="email" 
              disabled 
              class="w-full bg-[#f1f0eb] border border-[#c1c0bc] rounded-none px-4 py-2.5 text-xs text-[#60605e] cursor-not-allowed font-mono-accent"
            />
            <p class="text-[10px] text-[#60605e] mt-1">Alamat email terdaftar bersifat permanen.</p>
          </div>

          <div>
            <label class="block text-xs font-semibold text-black uppercase tracking-wider mb-1.5">Nama Lengkap / Tampilan</label>
            <input 
              v-model="profileName" 
              type="text" 
              required 
              placeholder="Masukkan nama lengkap"
              class="w-full bg-white border border-[#c1c0bc] rounded-none px-4 py-2.5 text-sm text-black placeholder-[#60605e] focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
            />
          </div>

          <div class="flex items-center justify-end gap-2.5 pt-2">
            <button 
              type="button"
              @click="closeSettingsModal"
              class="px-4 py-2 rounded-none text-xs font-semibold uppercase tracking-[0.05em] text-black bg-[#f1f0eb] hover:bg-[#e4d9cf] transition-colors cursor-pointer">
              Tutup
            </button>
            <button 
              type="submit" 
              :disabled="profileLoading"
              class="px-5 py-2.5 rounded-none bg-black hover:bg-[#292c33] disabled:opacity-50 text-white font-semibold text-xs uppercase tracking-[0.1em] transition-all cursor-pointer flex items-center gap-2">
              <svg v-if="profileLoading" class="animate-spin w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>{{ profileLoading ? 'Menyimpan...' : 'Simpan Profil' }}</span>
            </button>
          </div>
        </form>

        <!-- Tab 2: Ubah Kata Sandi (UC-05) -->
        <form v-else @submit.prevent="handleChangePassword" class="space-y-3.5">
          <div v-if="securityError" class="bg-rose-50 border border-rose-300 text-rose-800 text-xs rounded-none p-3 flex items-start gap-2">
            <svg class="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span class="leading-relaxed">{{ securityError }}</span>
          </div>

          <div v-if="securitySuccess" class="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-none p-3 flex items-start gap-2">
            <svg class="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span class="leading-relaxed">{{ securitySuccess }}</span>
          </div>

          <div>
            <label class="block text-xs font-semibold text-black uppercase tracking-wider mb-1">Kata Sandi Saat Ini</label>
            <input 
              v-model="currentPassword" 
              type="password" 
              required 
              placeholder="••••••••"
              class="w-full bg-white border border-[#c1c0bc] rounded-none px-4 py-2 text-sm text-black placeholder-[#60605e] focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-black uppercase tracking-wider mb-1">Kata Sandi Baru</label>
            <input 
              v-model="newPassword" 
              type="password" 
              required 
              placeholder="Minimal 8 karakter kombinasi huruf &amp; angka"
              class="w-full bg-white border border-[#c1c0bc] rounded-none px-4 py-2 text-sm text-black placeholder-[#60605e] focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-black uppercase tracking-wider mb-1">Konfirmasi Kata Sandi Baru</label>
            <input 
              v-model="confirmPassword" 
              type="password" 
              required 
              placeholder="Ketik ulang kata sandi baru"
              class="w-full bg-white border border-[#c1c0bc] rounded-none px-4 py-2 text-sm text-black placeholder-[#60605e] focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
            />
          </div>

          <div class="flex items-center justify-end gap-2.5 pt-2">
            <button 
              type="button"
              @click="closeSettingsModal"
              class="px-4 py-2 rounded-none text-xs font-semibold uppercase tracking-[0.05em] text-black bg-[#f1f0eb] hover:bg-[#e4d9cf] transition-colors cursor-pointer">
              Tutup
            </button>
            <button 
              type="submit" 
              :disabled="securityLoading"
              class="px-5 py-2.5 rounded-none bg-black hover:bg-[#292c33] disabled:opacity-50 text-white font-semibold text-xs uppercase tracking-[0.1em] transition-all cursor-pointer flex items-center gap-2">
              <svg v-if="securityLoading" class="animate-spin w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>{{ securityLoading ? 'Menyimpan...' : 'Perbarui Kata Sandi' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
