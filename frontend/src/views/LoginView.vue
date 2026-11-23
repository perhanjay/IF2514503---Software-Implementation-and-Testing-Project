<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LogIn
} from 'lucide-vue-next'
import ForgotPasswordModal from '../components/auth/ForgotPasswordModal.vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const rememberMe = ref(false)
const showPassword = ref(false)
const errorMsg = ref('')
const infoMsg = ref('')
const loading = ref(false)

const showResetModal = ref(false)

async function handleLogin() {
  errorMsg.value = ''
  infoMsg.value = ''
  loading.value = true
  try {
    const res = await axios.post('/api/v1/auth/login', {
      email: email.value,
      password: password.value,
      rememberMe: rememberMe.value
    })
    authStore.setAuth(res.data.user, res.data.token, res.data.wallet.balance)
    router.push(res.data.user?.role === 'ADMIN' ? '/admin/users' : '/dashboard')
  } catch (err) {
    errorMsg.value = err.response?.data?.error || 'Gagal login ke sistem'
  } finally {
    loading.value = false
  }
}

function handleResetComplete({ email: resetMail, message }) {
  showResetModal.value = false
  infoMsg.value = message
  if (resetMail) email.value = resetMail
  password.value = ''
}
</script>

<template>
  <div class="min-h-screen notebook-paper relative overflow-x-clip text-[#111111] flex flex-col justify-center items-center px-4 py-8 sm:p-6 selection:bg-[#ff82c2] selection:text-[#111111] font-sans">
    <!-- Ambient Pastel Halos -->
    <div aria-hidden="true" class="pointer-events-none fixed -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-[#20afff]/14 blur-[110px]"></div>
    <div aria-hidden="true" class="pointer-events-none fixed top-[35%] -right-28 w-[420px] h-[420px] rounded-full bg-[#ffda40]/16 blur-[120px]"></div>
    <div aria-hidden="true" class="pointer-events-none fixed -bottom-28 left-[18%] w-[380px] h-[380px] rounded-full bg-[#ff82c2]/12 blur-[120px]"></div>

    <div class="relative z-10 w-full max-w-md space-y-5">
      <!-- Top Studio Navigation -->
      <nav aria-label="Navigasi Autentikasi" class="flex flex-wrap items-center justify-between gap-2.5">
        <router-link
          to="/"
          class="btn-keycap btn-keycap-mini btn-keycap-white px-3 py-1.5 text-xs"
        >
          <ArrowLeft class="w-3.5 h-3.5" :stroke-width="2.2" />
          <span>Kembali ke Beranda</span>
        </router-link>

        <router-link
          to="/dashboard"
          class="btn-keycap btn-keycap-mini btn-keycap-yellow px-3 py-1.5 text-xs"
        >
          <span>Studio Instan</span>
          <ArrowRight class="w-3.5 h-3.5" :stroke-width="2.2" />
        </router-link>
      </nav>

      <!-- Main Studio Login Card -->
      <main class="rounded-[18px] border-2 border-[#111111] bg-white/95 backdrop-blur-md shadow-[3px_4px_0_#111111] p-6 sm:p-9">
        <div class="text-center mb-7">
          <router-link to="/" class="inline-block group focus-visible:outline-2 focus-visible:outline-[#111111] focus-visible:outline-offset-4 rounded-[12px]">
            <div class="w-11 h-11 rounded-[12px] border-2 border-[#111111] bg-[#ffda40] shadow-[2px_3px_0_#111111] text-[#111111] flex items-center justify-center font-editorial font-bold text-xl mx-auto mb-3.5 transition-transform group-hover:-translate-y-0.5">
              <span>P</span>
            </div>
          </router-link>
          <h1 class="font-editorial text-2xl sm:text-3xl font-bold text-[#111111] tracking-[-0.025em]">
            Masuk ke Studio
          </h1>
          <p class="text-xs sm:text-sm text-[#60605e] mt-1.5">
            Platform Diagnostik &amp; Perbaikan Multitrack Audio
          </p>
        </div>

        <!-- Error Banner -->
        <div
          v-if="errorMsg"
          role="alert"
          class="rounded-[14px] border-[1.5px] border-[#111111] bg-[#ffcae6]/55 text-[#111111] text-xs px-4 py-3 mb-5 flex items-start gap-2.5 font-medium"
        >
          <AlertTriangle class="w-4 h-4 text-rose-700 shrink-0 mt-0.5" :stroke-width="2.2" />
          <div class="leading-relaxed">{{ errorMsg }}</div>
        </div>

        <!-- Info / Password Reset Success Banner -->
        <div
          v-if="infoMsg"
          role="status"
          class="rounded-[14px] border-[1.5px] border-[#111111] bg-[#d8f3dc] text-[#111111] text-xs px-4 py-3 mb-5 flex items-start gap-2.5 font-medium"
        >
          <CheckCircle2 class="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" :stroke-width="2.2" />
          <div class="leading-relaxed">{{ infoMsg }}</div>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label for="login-email" class="block text-xs font-bold text-[#111111] mb-1.5">
              Alamat Email
            </label>
            <input
              id="login-email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              placeholder="engineer@studio.com"
              class="w-full rounded-[12px] border-[1.5px] border-[#111111]/25 bg-white px-4 py-3 text-sm text-[#111111] placeholder:text-[#60605e]/60 focus:outline-none focus:border-[#111111] focus:ring-2 focus:ring-[#20afff]/35 transition-colors"
            />
          </div>

          <div>
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <label for="login-password" class="block text-xs font-bold text-[#111111]">
                Kata Sandi
              </label>
              <button
                type="button"
                @click="showResetModal = true"
                class="text-xs font-semibold text-[#111111] underline decoration-[#111111]/40 underline-offset-4 hover:decoration-[#20afff] hover:text-[#0284c7] cursor-pointer focus-visible:outline-2 focus-visible:outline-[#111111] rounded-[4px]"
              >
                Lupa kata sandi?
              </button>
            </div>

            <div class="relative">
              <input
                id="login-password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="current-password"
                placeholder="••••••••"
                class="w-full rounded-[12px] border-[1.5px] border-[#111111]/25 bg-white pl-4 pr-11 py-3 text-sm text-[#111111] placeholder:text-[#60605e]/60 focus:outline-none focus:border-[#111111] focus:ring-2 focus:ring-[#20afff]/35 transition-colors"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                :aria-label="showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'"
                class="absolute inset-y-0 right-0 px-3.5 flex items-center text-[#60605e] hover:text-[#111111] cursor-pointer focus-visible:outline-2 focus-visible:outline-[#111111] rounded-r-[12px]"
              >
                <EyeOff v-if="showPassword" class="w-4 h-4" :stroke-width="2" />
                <Eye v-else class="w-4 h-4" :stroke-width="2" />
              </button>
            </div>
          </div>

          <div class="pt-0.5">
            <label for="remember-me" class="inline-flex items-center gap-2.5 text-xs font-medium text-[#60605e] hover:text-[#111111] cursor-pointer select-none">
              <input
                id="remember-me"
                v-model="rememberMe"
                type="checkbox"
                class="w-4 h-4 rounded-[4px] border-[1.5px] border-[#111111] accent-[#111111] cursor-pointer"
              />
              <span>Ingat Saya (30 Hari)</span>
            </label>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full btn-keycap btn-keycap-blue py-3.5 px-5 text-sm mt-1"
          >
            <Loader2 v-if="loading" class="w-4 h-4 animate-spin" :stroke-width="2.2" />
            <LogIn v-else class="w-4 h-4" :stroke-width="2.2" />
            <span>{{ loading ? 'Memverifikasi...' : 'Masuk ke Sistem' }}</span>
          </button>
        </form>

        <div class="text-center mt-7 pt-5 border-t border-[#111111]/10 text-xs text-[#60605e]">
          Belum memiliki akun permanen?
          <router-link
            to="/register"
            class="font-bold text-[#111111] underline underline-offset-4 hover:text-[#0284c7] ml-1 focus-visible:outline-2 focus-visible:outline-[#111111] rounded-[4px]"
          >
            Daftar (Dapat 5 Token)
          </router-link>
        </div>
      </main>
    </div>

    <ForgotPasswordModal
      :is-open="showResetModal"
      :initial-email="email"
      @close="showResetModal = false"
      @reset-complete="handleResetComplete"
    />
  </div>
</template>
