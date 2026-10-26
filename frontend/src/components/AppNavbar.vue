<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

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
          <button 
            type="button"
            @click="openSettingsModal('profile')"
            title="Buka Pengaturan Akun"
            class="hidden sm:flex flex-col text-right leading-tight cursor-pointer group px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">
            <span class="text-xs font-semibold text-slate-800 group-hover:text-[#0052FF] transition-colors flex items-center gap-1 justify-end">
              <span>{{ authStore.user?.name }}</span>
              <svg class="w-3 h-3 text-slate-400 group-hover:text-[#0052FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            <span class="text-[10px] text-slate-500 font-mono-accent">Pengaturan Akun</span>
          </button>
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
          <div class="px-3 py-1 flex items-center justify-between">
            <div>
              <span class="block text-xs font-semibold text-slate-800">{{ authStore.user?.name }}</span>
              <span class="text-[10px] text-slate-500 font-mono-accent">Pro Engineer</span>
            </div>
            <button 
              type="button"
              @click="openSettingsModal('profile')"
              class="text-xs text-[#0052FF] font-semibold hover:underline cursor-pointer">
              Pengaturan Akun
            </button>
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

    <!-- Modal Pengaturan Akun (UC-04: Ubah Profil & UC-05: Ubah Kata Sandi) -->
    <div 
      v-if="showSettingsModal" 
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div 
        class="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl relative"
        @click.stop>
        <!-- Modal Header -->
        <div class="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center font-bold text-sm">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h3 class="font-display text-lg font-semibold text-slate-900">Pengaturan Akun</h3>
              <p class="text-xs text-slate-500">Kelola identitas dan keamanan akun engineer Anda</p>
            </div>
          </div>
          <button 
            @click="closeSettingsModal" 
            type="button"
            class="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
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
            class="flex-1 py-1.5 text-xs font-semibold rounded-lg text-center transition-all cursor-pointer"
            :class="settingsTab === 'profile' ? 'bg-[#0052FF] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'">
            Profil Akun
          </button>
          <button 
            type="button"
            @click="settingsTab = 'security'"
            class="flex-1 py-1.5 text-xs font-semibold rounded-lg text-center transition-all cursor-pointer"
            :class="settingsTab === 'security' ? 'bg-[#0052FF] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'">
            Ubah Kata Sandi
          </button>
        </div>

        <!-- Tab 1: Ubah Profil (UC-04) -->
        <form v-if="settingsTab === 'profile'" @submit.prevent="handleUpdateProfile" class="space-y-4">
          <div v-if="profileError" class="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3 flex items-start gap-2">
            <svg class="w-4 h-4 text-rose-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span class="leading-relaxed">{{ profileError }}</span>
          </div>

          <div v-if="profileSuccess" class="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-3 flex items-start gap-2">
            <svg class="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span class="leading-relaxed">{{ profileSuccess }}</span>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 tracking-wide mb-1.5">Alamat Email</label>
            <input 
              :value="authStore.user?.email" 
              type="email" 
              disabled 
              class="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-500 cursor-not-allowed font-mono-accent"
            />
            <p class="text-[10px] text-slate-400 mt-1">Alamat email terdaftar bersifat permanen.</p>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 tracking-wide mb-1.5">Nama Lengkap / Tampilan</label>
            <input 
              v-model="profileName" 
              type="text" 
              required 
              placeholder="Masukkan nama lengkap"
              class="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/20 transition-all"
            />
          </div>

          <div class="flex items-center justify-end gap-2.5 pt-2">
            <button 
              type="button"
              @click="closeSettingsModal"
              class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
              Tutup
            </button>
            <button 
              type="submit" 
              :disabled="profileLoading"
              class="px-5 py-2.5 rounded-xl bg-[#0052FF] hover:bg-[#0043D6] disabled:opacity-50 text-white font-semibold text-xs shadow-accent transition-all cursor-pointer flex items-center gap-2">
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
          <div v-if="securityError" class="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3 flex items-start gap-2">
            <svg class="w-4 h-4 text-rose-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span class="leading-relaxed">{{ securityError }}</span>
          </div>

          <div v-if="securitySuccess" class="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-3 flex items-start gap-2">
            <svg class="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span class="leading-relaxed">{{ securitySuccess }}</span>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 tracking-wide mb-1">Kata Sandi Saat Ini</label>
            <input 
              v-model="currentPassword" 
              type="password" 
              required 
              placeholder="••••••••"
              class="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/20 transition-all"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 tracking-wide mb-1">Kata Sandi Baru</label>
            <input 
              v-model="newPassword" 
              type="password" 
              required 
              placeholder="Minimal 8 karakter kombinasi huruf &amp; angka"
              class="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/20 transition-all"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 tracking-wide mb-1">Konfirmasi Kata Sandi Baru</label>
            <input 
              v-model="confirmPassword" 
              type="password" 
              required 
              placeholder="Ketik ulang kata sandi baru"
              class="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/20 transition-all"
            />
          </div>

          <div class="flex items-center justify-end gap-2.5 pt-2">
            <button 
              type="button"
              @click="closeSettingsModal"
              class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
              Tutup
            </button>
            <button 
              type="submit" 
              :disabled="securityLoading"
              class="px-5 py-2.5 rounded-xl bg-[#0052FF] hover:bg-[#0043D6] disabled:opacity-50 text-white font-semibold text-xs shadow-accent transition-all cursor-pointer flex items-center gap-2">
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
  </header>
</template>
