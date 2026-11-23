<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import {
  ChevronDown,
  User,
  Settings,
  KeyRound,
  LogOut,
  Coins,
  ShieldCheck,
  Menu,
  X,
  ArrowUpRight
} from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const props = defineProps({
  fluid: {
    type: Boolean,
    default: true
  }
})

const isFluid = computed(() => {
  if (props.fluid !== null && props.fluid !== undefined) return props.fluid
  return true
})

const mobileMenuOpen = ref(false)
const accountMenuOpen = ref(false)
const accountMenuRef = ref(null)
const accountTriggerRef = ref(null)

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

watch(() => route.fullPath, () => {
  accountMenuOpen.value = false
  mobileMenuOpen.value = false
})

function toggleAccountMenu() {
  accountMenuOpen.value = !accountMenuOpen.value
}

function closeAccountMenu(restoreFocus = false) {
  accountMenuOpen.value = false
  if (restoreFocus) {
    accountTriggerRef.value?.focus()
  }
}

function handleDocumentClick(e) {
  if (accountMenuOpen.value && accountMenuRef.value && !accountMenuRef.value.contains(e.target)) {
    accountMenuOpen.value = false
  }
}

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
  accountMenuOpen.value = false
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
  if (e.key !== 'Escape') return
  if (showSettingsModal.value) {
    closeSettingsModal()
  } else if (accountMenuOpen.value) {
    closeAccountMenu(true)
  } else if (mobileMenuOpen.value) {
    mobileMenuOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('click', handleDocumentClick)
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
  accountMenuOpen.value = false
  mobileMenuOpen.value = false
  router.push('/login')
}
</script>

<template>
  <header class="sticky top-0 z-40 w-full bg-white/75 backdrop-blur-lg transition-all">
    <div
      :class="isFluid ? 'w-full max-w-[1800px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12' : 'max-w-[1200px] mx-auto px-6'"
      class="h-16 grid grid-cols-[1fr_auto] md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4"
    >
      <!-- Left: Logo Branding (Text only) -->
      <router-link
        :to="authStore.user?.role === 'ADMIN' ? '/admin/users' : '/'"
        class="justify-self-start inline-flex items-center shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black"
      >
        <span class="font-editorial font-bold text-base text-black tracking-tight whitespace-nowrap">Polaris Audio</span>
      </router-link>

      <!-- Center: Primary Navigation (Strictly centered, no underlines) -->
      <nav aria-label="Navigasi Utama" class="hidden md:flex items-center justify-center gap-6 lg:gap-8 justify-self-center text-xs">
        <template v-if="authStore.user?.role === 'ADMIN'">
          <router-link
            to="/admin/users"
            :class="route.path === '/admin/users' ? 'text-black font-semibold' : 'text-[#60605e] hover:text-black font-medium'"
            class="py-1 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black"
          >
            Admin: Pengguna
          </router-link>
          <router-link
            to="/admin/transactions"
            :class="route.path === '/admin/transactions' ? 'text-black font-semibold' : 'text-[#60605e] hover:text-black font-medium'"
            class="py-1 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black"
          >
            Audit Transaksi
          </router-link>
        </template>
        <template v-else>
          <router-link
            to="/"
            :class="route.path === '/' ? 'text-black font-semibold' : 'text-[#60605e] hover:text-black font-medium'"
            class="py-1 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black"
          >
            Beranda
          </router-link>
          <router-link
            to="/dashboard"
            :class="route.path === '/dashboard' ? 'text-black font-semibold' : 'text-[#60605e] hover:text-black font-medium'"
            class="py-1 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black"
          >
            Studio Workspace
          </router-link>
          <router-link
            to="/billing"
            :class="route.path === '/billing' || route.path === '/wallet' ? 'text-black font-semibold' : 'text-[#60605e] hover:text-black font-medium'"
            class="py-1 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black"
          >
            Dompet & Kuota
          </router-link>
        </template>
      </nav>

      <!-- Right: Account Dropdown (Desktop) & Hamburger (Mobile) -->
      <div class="justify-self-end flex items-center gap-2">
        <!-- Desktop Authenticated / Guest Account Dropdown -->
        <div v-if="authStore.isAuthenticated" ref="accountMenuRef" class="hidden md:block relative">
          <button
            ref="accountTriggerRef"
            type="button"
            @click="toggleAccountMenu"
            aria-haspopup="menu"
            :aria-expanded="accountMenuOpen"
            aria-controls="navbar-account-menu"
            class="inline-flex items-center gap-2 px-2 py-1.5 rounded-none text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black"
            :class="accountMenuOpen ? 'text-black' : 'text-[#60605e] hover:text-black'"
          >
            <User class="w-3.5 h-3.5 shrink-0" :stroke-width="1.75" />
            <span class="font-medium text-black truncate max-w-[110px] lg:max-w-[160px]">
              {{ isGuest ? 'Sesi Tamu' : authStore.user?.name }}
            </span>
            <ChevronDown
              class="w-3.5 h-3.5 transition-transform duration-150 shrink-0"
              :class="{ 'rotate-180 text-black': accountMenuOpen }"
              :stroke-width="1.75"
            />
          </button>

          <!-- Dropdown Menu Panel (Frosted Retro Glass) -->
          <div
            v-if="accountMenuOpen"
            id="navbar-account-menu"
            role="menu"
            aria-label="Menu Akun"
            class="absolute right-0 mt-2 w-64 bg-white/85 backdrop-blur-xl border-2 border-[#111111] shadow-[4px_4px_0px_0px_rgba(17,17,17,1),inset_0_1px_0_rgba(255,255,255,0.9)] rounded-none z-50 animate-fade-in"
          >
            <!-- Identity Header -->
            <div class="px-4 py-3 bg-white/50 border-b border-[#c1c0bc]">
              <template v-if="isGuest">
                <p class="text-xs font-semibold text-black truncate">Sesi Studio Instan</p>
                <p class="text-[11px] text-[#60605e] truncate mt-0.5">Akun Tamu Sementara</p>
              </template>
              <template v-else>
                <p class="text-xs font-semibold text-black truncate">{{ authStore.user?.name }}</p>
                <p class="text-[11px] text-[#60605e] truncate mt-0.5">{{ authStore.user?.email }}</p>
                <span
                  v-if="authStore.user?.role === 'ADMIN'"
                  class="inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 bg-white border border-[#c1c0bc] text-[10px] font-sans font-semibold uppercase tracking-wider text-black"
                >
                  <ShieldCheck class="w-3 h-3" :stroke-width="1.75" />
                  <span>Admin Operator</span>
                </span>
              </template>
            </div>

            <!-- Token Quota Row (Non-Admin) -->
            <router-link
              v-if="authStore.user?.role !== 'ADMIN'"
              to="/billing"
              role="menuitem"
              @click="closeAccountMenu()"
              class="flex items-center justify-between px-4 py-2.5 border-b border-[#c1c0bc] border-l-2 border-l-transparent hover:border-l-black transition-colors group"
            >
              <span class="flex items-center gap-2 text-xs text-[#60605e] group-hover:text-black">
                <Coins class="w-3.5 h-3.5 shrink-0" :stroke-width="1.75" />
                <span>{{ isGuest ? 'Kuota Demo' : 'Kuota Token' }}</span>
              </span>
              <span class="flex items-center gap-1.5 font-sans tabular-nums text-xs font-semibold text-black">
                <span>{{ authStore.walletBalance }} Token</span>
                <ArrowUpRight class="w-3 h-3 text-[#60605e] group-hover:text-black" :stroke-width="1.75" />
              </span>
            </router-link>

            <!-- Menu Actions -->
            <div class="py-1">
              <template v-if="!isGuest">
                <button
                  type="button"
                  role="menuitem"
                  @click="openSettingsModal('profile')"
                  class="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-[#60605e] hover:text-black border-l-2 border-transparent hover:border-l-black transition-colors text-left cursor-pointer"
                >
                  <Settings class="w-3.5 h-3.5 shrink-0" :stroke-width="1.75" />
                  <span>Pengaturan Akun</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  @click="openSettingsModal('security')"
                  class="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-[#60605e] hover:text-black border-l-2 border-transparent hover:border-l-black transition-colors text-left cursor-pointer"
                >
                  <KeyRound class="w-3.5 h-3.5 shrink-0" :stroke-width="1.75" />
                  <span>Ubah Kata Sandi</span>
                </button>
                <div class="my-1 border-t border-[#c1c0bc]"></div>
                <button
                  type="button"
                  role="menuitem"
                  @click="handleLogout"
                  class="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-700 border-l-2 border-transparent hover:border-l-rose-700 transition-colors text-left cursor-pointer"
                >
                  <LogOut class="w-3.5 h-3.5 shrink-0" :stroke-width="1.75" />
                  <span>Keluar</span>
                </button>
              </template>
              <template v-else>
                <router-link
                  to="/login"
                  role="menuitem"
                  @click="closeAccountMenu()"
                  class="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-[#60605e] hover:text-black border-l-2 border-transparent hover:border-l-black transition-colors"
                >
                  <User class="w-3.5 h-3.5 shrink-0" :stroke-width="1.75" />
                  <span>Masuk ke Akun</span>
                </router-link>
                <router-link
                  to="/register"
                  role="menuitem"
                  @click="closeAccountMenu()"
                  class="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-black border-l-2 border-transparent hover:border-l-black transition-colors"
                >
                  <ArrowUpRight class="w-3.5 h-3.5 text-[#60605e] shrink-0" :stroke-width="1.75" />
                  <span>Daftar Akun Permanen</span>
                </router-link>
                <div class="my-1 border-t border-[#c1c0bc]"></div>
                <button
                  type="button"
                  role="menuitem"
                  @click="handleLogout"
                  class="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-700 border-l-2 border-transparent hover:border-l-rose-700 transition-colors text-left cursor-pointer"
                >
                  <LogOut class="w-3.5 h-3.5 shrink-0" :stroke-width="1.75" />
                  <span>Akhiri Sesi Tamu</span>
                </button>
              </template>
            </div>
          </div>
        </div>

        <!-- Desktop Unauthenticated Actions -->
        <div v-else class="hidden md:flex items-center gap-4">
          <router-link
            to="/login"
            class="inline-flex items-center text-xs font-medium text-[#60605e] hover:text-black px-2 py-1.5 transition-colors whitespace-nowrap"
          >
            Masuk
          </router-link>
          <router-link
            to="/register"
            class="inline-flex items-center justify-center text-xs font-medium uppercase tracking-[0.08em] text-white px-4 py-1.5 rounded-none bg-black hover:bg-[#292c33] transition-colors whitespace-nowrap"
          >
            Daftar Akun
          </router-link>
        </div>

        <!-- Mobile Menu Hamburger Button -->
        <button
          @click="mobileMenuOpen = !mobileMenuOpen"
          type="button"
          aria-label="Navigasi Menu"
          :aria-expanded="mobileMenuOpen"
          class="md:hidden p-2 rounded-none text-black hover:opacity-75 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black"
        >
          <Menu v-if="!mobileMenuOpen" class="w-5 h-5" :stroke-width="1.75" />
          <X v-else class="w-5 h-5" :stroke-width="1.75" />
        </button>
      </div>
    </div>

    <!-- Mobile Drawer Menu -->
    <div v-if="mobileMenuOpen" class="md:hidden border-t border-[#c1c0bc] bg-white px-6 py-4 space-y-2 animate-fade-in">
      <template v-if="authStore.user?.role === 'ADMIN'">
        <router-link
          to="/admin/users"
          @click="mobileMenuOpen = false"
          :class="route.path === '/admin/users' ? 'text-black font-semibold border-l-2 border-black' : 'text-[#60605e] hover:text-black border-l-2 border-transparent'"
          class="block px-3 py-2 rounded-none text-sm transition-colors"
        >
          Admin: Pengguna
        </router-link>
        <router-link
          to="/admin/transactions"
          @click="mobileMenuOpen = false"
          :class="route.path === '/admin/transactions' ? 'text-black font-semibold border-l-2 border-black' : 'text-[#60605e] hover:text-black border-l-2 border-transparent'"
          class="block px-3 py-2 rounded-none text-sm transition-colors"
        >
          Audit Transaksi
        </router-link>
      </template>
      <template v-else>
        <router-link
          to="/"
          @click="mobileMenuOpen = false"
          :class="route.path === '/' ? 'text-black font-semibold border-l-2 border-black' : 'text-[#60605e] hover:text-black border-l-2 border-transparent'"
          class="block px-3 py-2 rounded-none text-sm transition-colors"
        >
          Beranda
        </router-link>
        <router-link
          to="/dashboard"
          @click="mobileMenuOpen = false"
          :class="route.path === '/dashboard' ? 'text-black font-semibold border-l-2 border-black' : 'text-[#60605e] hover:text-black border-l-2 border-transparent'"
          class="block px-3 py-2 rounded-none text-sm transition-colors"
        >
          Studio Workspace
        </router-link>
        <router-link
          to="/billing"
          @click="mobileMenuOpen = false"
          :class="route.path === '/billing' || route.path === '/wallet' ? 'text-black font-semibold border-l-2 border-black' : 'text-[#60605e] hover:text-black border-l-2 border-transparent'"
          class="block px-3 py-2 rounded-none text-sm transition-colors"
        >
          Dompet & Kuota Token
        </router-link>
      </template>

      <div class="pt-3 border-t border-[#c1c0bc] flex flex-col gap-2">
        <template v-if="authStore.isAuthenticated && !isGuest">
          <router-link
            v-if="authStore.user?.role !== 'ADMIN'"
            to="/billing"
            @click="mobileMenuOpen = false"
            class="flex items-center justify-between px-3 py-2 bg-white border border-[#c1c0bc] hover:border-black text-xs transition-colors"
          >
            <span class="text-[#60605e]">Kuota Token</span>
            <span class="font-sans tabular-nums font-semibold text-black">
              {{ authStore.walletBalance }} Token
            </span>
          </router-link>
          <div class="px-3 py-1 flex items-center justify-between">
            <div>
              <span class="block text-xs font-medium text-black">{{ authStore.user?.name }}</span>
              <span class="text-[11px] text-[#60605e] font-sans">
                {{ authStore.user?.role === 'ADMIN' ? 'Admin Operator' : 'Pro Engineer' }}
              </span>
            </div>
            <button
              type="button"
              @click="openSettingsModal('profile')"
              class="text-xs text-black font-medium underline cursor-pointer"
            >
              Pengaturan Akun
            </button>
          </div>
          <button
            @click="handleLogout"
            class="text-left w-full text-xs font-normal text-rose-700 px-3 py-2 rounded-none border-l-2 border-transparent hover:border-l-rose-700 transition-colors cursor-pointer"
          >
            Keluar Akun
          </button>
        </template>
        <template v-else-if="authStore.isAuthenticated && isGuest">
          <router-link
            to="/billing"
            @click="mobileMenuOpen = false"
            class="flex items-center justify-between px-3 py-2 bg-white border border-[#c1c0bc] hover:border-black text-xs transition-colors"
          >
            <span class="text-[#60605e]">Kuota Demo</span>
            <span class="font-sans tabular-nums font-semibold text-black">
              {{ authStore.walletBalance }} Token
            </span>
          </router-link>
          <router-link
            to="/login"
            @click="mobileMenuOpen = false"
            class="block px-3 py-2 rounded-none text-sm text-black bg-white border border-[#c1c0bc] hover:border-black font-medium uppercase tracking-[0.05em] transition-colors"
          >
            Masuk ke Studio
          </router-link>
          <router-link
            to="/register"
            @click="mobileMenuOpen = false"
            class="block text-center px-4 py-2.5 rounded-none text-sm font-medium uppercase tracking-[0.1em] text-white bg-black hover:bg-[#292c33]"
          >
            Daftar Akun Permanen
          </router-link>
        </template>
        <template v-else>
          <router-link
            to="/login"
            @click="mobileMenuOpen = false"
            class="block px-3 py-2 rounded-none text-sm text-black bg-white border border-[#c1c0bc] hover:border-black font-medium uppercase tracking-[0.05em] transition-colors"
          >
            Masuk ke Studio
          </router-link>
          <router-link
            to="/register"
            @click="mobileMenuOpen = false"
            class="block text-center px-4 py-2.5 rounded-none text-sm font-medium uppercase tracking-[0.1em] text-white bg-black hover:bg-[#292c33]"
          >
            Daftar Akun Baru
          </router-link>
        </template>
      </div>
    </div>
  </header>

  <!-- Modal Pengaturan Akun -->
  <Teleport to="body">
    <div 
      v-if="showSettingsModal" 
      class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#111111]/55 backdrop-blur-xs overflow-y-auto animate-fade-in"
      @click="closeSettingsModal">
      <div 
        role="dialog"
        aria-modal="true"
        aria-label="Pengaturan Akun"
        class="retro-glass-panel p-6 sm:p-7 max-w-md w-full relative my-auto max-h-[90vh] overflow-y-auto font-sans"
        @click.stop>
        <!-- Modal Header -->
        <div class="flex items-center justify-between pb-4 border-b border-[#111111]/12 mb-5">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-[10px] bg-[#ffda40] border-2 border-[#111111] shadow-[2px_2.5px_0_#111111] text-[#111111] flex items-center justify-center font-medium text-sm shrink-0">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h3 class="font-display text-base font-bold text-[#111111]">Pengaturan Akun</h3>
              <p class="text-xs text-[#60605e]">Kelola identitas dan keamanan akun engineer Anda</p>
            </div>
          </div>
          <button 
            @click="closeSettingsModal" 
            type="button"
            title="Tutup (Esc)"
            aria-label="Tutup dialog pengaturan"
            class="btn-keycap btn-keycap-mini btn-keycap-white w-8 h-8 shrink-0">
            <svg class="w-4 h-4 text-[#111111]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Tab Controls -->
        <div class="flex items-center gap-2.5 mb-5">
          <button 
            type="button"
            @click="settingsTab = 'profile'"
            class="btn-keycap btn-keycap-sm flex-1 py-2 text-xs text-center"
            :class="settingsTab === 'profile' ? 'btn-keycap-blue' : 'btn-keycap-white opacity-80 hover:opacity-100'">
            Profil Akun
          </button>
          <button 
            type="button"
            @click="settingsTab = 'security'"
            class="btn-keycap btn-keycap-sm flex-1 py-2 text-xs text-center"
            :class="settingsTab === 'security' ? 'btn-keycap-blue' : 'btn-keycap-white opacity-80 hover:opacity-100'">
            Ubah Kata Sandi
          </button>
        </div>

        <!-- Tab 1: Ubah Profil -->
        <form v-if="settingsTab === 'profile'" @submit.prevent="handleUpdateProfile" class="space-y-4">
          <div v-if="profileError" class="bg-rose-50 border border-rose-300 text-rose-800 text-xs rounded-[12px] p-3 flex items-start gap-2">
            <svg class="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span class="leading-relaxed">{{ profileError }}</span>
          </div>

          <div v-if="profileSuccess" class="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-[12px] p-3 flex items-start gap-2">
            <svg class="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span class="leading-relaxed">{{ profileSuccess }}</span>
          </div>

          <div>
            <label class="block text-xs font-bold text-[#111111] mb-1.5">Alamat Email</label>
            <input 
              :value="authStore.user?.email" 
              type="email" 
              disabled 
              class="w-full bg-[#eaeef4]/80 border border-[#111111]/15 rounded-[10px] px-4 py-2.5 text-xs text-[#60605e] cursor-not-allowed font-medium"
            />
            <p class="text-[11px] text-[#60605e] mt-1 font-normal">Alamat email terdaftar bersifat permanen.</p>
          </div>

          <div>
            <label class="block text-xs font-bold text-[#111111] mb-1.5">Nama Lengkap / Tampilan</label>
            <input 
              v-model="profileName" 
              type="text" 
              required 
              placeholder="Masukkan nama lengkap"
              class="w-full bg-white border-[1.5px] border-[#111111]/20 rounded-[10px] px-4 py-2.5 text-sm text-[#111111] placeholder-[#60605e] focus:outline-none focus:border-[#111111] transition-all"
            />
          </div>

          <div class="flex items-center justify-end gap-2.5 pt-2">
            <button 
              type="button"
              @click="closeSettingsModal"
              class="btn-keycap btn-keycap-sm btn-keycap-white px-4 py-2 text-xs">
              Tutup
            </button>
            <button 
              type="submit" 
              :disabled="profileLoading"
              class="btn-keycap btn-keycap-sm btn-keycap-dark px-5 py-2 text-xs">
              <svg v-if="profileLoading" class="animate-spin w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>{{ profileLoading ? 'Menyimpan...' : 'Simpan Profil' }}</span>
            </button>
          </div>
        </form>

        <!-- Tab 2: Ubah Kata Sandi -->
        <form v-else @submit.prevent="handleChangePassword" class="space-y-3.5">
          <div v-if="securityError" class="bg-rose-50 border border-rose-300 text-rose-800 text-xs rounded-[12px] p-3 flex items-start gap-2">
            <svg class="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span class="leading-relaxed">{{ securityError }}</span>
          </div>

          <div v-if="securitySuccess" class="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-[12px] p-3 flex items-start gap-2">
            <svg class="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span class="leading-relaxed">{{ securitySuccess }}</span>
          </div>

          <div>
            <label class="block text-xs font-bold text-[#111111] mb-1">Kata Sandi Saat Ini</label>
            <input 
              v-model="currentPassword" 
              type="password" 
              required 
              placeholder="••••••••"
              class="w-full bg-white border-[1.5px] border-[#111111]/20 rounded-[10px] px-4 py-2 text-sm text-[#111111] placeholder-[#60605e] focus:outline-none focus:border-[#111111] transition-all"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-[#111111] mb-1">Kata Sandi Baru</label>
            <input 
              v-model="newPassword" 
              type="password" 
              required 
              placeholder="Minimal 8 karakter kombinasi huruf &amp; angka"
              class="w-full bg-white border-[1.5px] border-[#111111]/20 rounded-[10px] px-4 py-2 text-sm text-[#111111] placeholder-[#60605e] focus:outline-none focus:border-[#111111] transition-all"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-[#111111] mb-1">Konfirmasi Kata Sandi Baru</label>
            <input 
              v-model="confirmPassword" 
              type="password" 
              required 
              placeholder="Ketik ulang kata sandi baru"
              class="w-full bg-white border-[1.5px] border-[#111111]/20 rounded-[10px] px-4 py-2 text-sm text-[#111111] placeholder-[#60605e] focus:outline-none focus:border-[#111111] transition-all"
            />
          </div>

          <div class="flex items-center justify-end gap-2.5 pt-2">
            <button 
              type="button"
              @click="closeSettingsModal"
              class="btn-keycap btn-keycap-sm btn-keycap-white px-4 py-2 text-xs">
              Tutup
            </button>
            <button 
              type="submit" 
              :disabled="securityLoading"
              class="btn-keycap btn-keycap-sm btn-keycap-dark px-5 py-2 text-xs">
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
