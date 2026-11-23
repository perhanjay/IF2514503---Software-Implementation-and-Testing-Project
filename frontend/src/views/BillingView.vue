<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { Gift, ArrowRight, AlertTriangle, CheckCircle2, Info, X } from 'lucide-vue-next'
import AppNavbar from '../components/AppNavbar.vue'
import WalletBalanceCard from '../components/billing/WalletBalanceCard.vue'
import TokenPackageSelector from '../components/billing/TokenPackageSelector.vue'
import TokenLedgerCard from '../components/billing/TokenLedgerCard.vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const isGuest = computed(() => {
  return !authStore.user || authStore.user?.isGuest || authStore.user?.email === 'guest@polaris.audio'
})

const walletDetails = ref(null)
const loadingWallet = ref(true)
const walletError = ref('')

const claiming = ref(false)
const claimMsg = ref('')
const claimError = ref('')

const packages = ref([])
const loadingPackages = ref(true)
const packagesError = ref('')
const selectedPackage = ref('PKG-25')

const checkoutLoading = ref(false)
const simulatingPayment = ref(false)
const activeOrder = ref(null)

const notification = ref(null)
let notificationTimeout = null

function notify(message, type = 'info') {
  if (notificationTimeout) clearTimeout(notificationTimeout)
  notification.value = { message, type }
  notificationTimeout = setTimeout(() => {
    notification.value = null
  }, 5000)
}

function dismissNotification() {
  if (notificationTimeout) clearTimeout(notificationTimeout)
  notification.value = null
}

async function loadWallet() {
  loadingWallet.value = true
  walletError.value = ''
  try {
    const res = await axios.get('/api/v1/wallet/details')
    walletDetails.value = res.data
    authStore.updateBalance(res.data.balance)
  } catch (err) {
    console.warn('Wallet not loaded', err)
    walletError.value = err.response?.data?.error || 'Tidak dapat terhubung ke layanan dompet token.'
  } finally {
    loadingWallet.value = false
  }
}

async function loadPackages() {
  loadingPackages.value = true
  packagesError.value = ''
  try {
    const res = await axios.get('/api/v1/payments/packages')
    packages.value = res.data.packages || []
    if (packages.value.length && !packages.value.some(p => p.id === selectedPackage.value)) {
      selectedPackage.value = packages.value[0].id
    }
  } catch (err) {
    console.warn('Packages not loaded', err)
    packagesError.value = err.response?.data?.error || 'Tidak dapat mengambil daftar paket Midtrans.'
  } finally {
    loadingPackages.value = false
  }
}

async function handleClaimDaily() {
  if (isGuest.value) {
    notify('Silakan daftar akun atau masuk untuk mengklaim bonus token harian.', 'info')
    router.push('/register')
    return
  }

  claimMsg.value = ''
  claimError.value = ''
  claiming.value = true
  try {
    const res = await axios.post('/api/v1/wallet/claim-daily')
    claimMsg.value = res.data.message
    await loadWallet()
  } catch (err) {
    claimError.value = err.response?.data?.error || 'Gagal klaim token harian'
  } finally {
    claiming.value = false
  }
}

async function handleCheckout() {
  if (isGuest.value) {
    notify('Untuk melakukan pembelian paket token via Midtrans, silakan daftar atau masuk ke akun Anda terlebih dahulu.', 'info')
    router.push('/login')
    return
  }

  checkoutLoading.value = true
  activeOrder.value = null
  try {
    const res = await axios.post('/api/v1/payments/checkout', { packageId: selectedPackage.value })
    activeOrder.value = res.data
  } catch (err) {
    notify(err.response?.data?.error || 'Gagal memulai checkout Midtrans', 'error')
  } finally {
    checkoutLoading.value = false
  }
}

async function handleSimulatePayment() {
  if (!activeOrder.value || simulatingPayment.value) return
  simulatingPayment.value = true
  try {
    await axios.post('/api/v1/payments/webhook', {
      order_id: activeOrder.value.orderId,
      status_code: '200',
      gross_amount: String(activeOrder.value.package.priceIdr),
      transaction_status: 'settlement',
      payment_type: 'qris_sandbox'
    })
    notify('Pembayaran Midtrans berhasil dikonfirmasi. Token telah ditambahkan ke akun Anda.', 'success')
    activeOrder.value = null
    await loadWallet()
  } catch (err) {
    notify('Gagal simulasi konfirmasi webhook', 'error')
  } finally {
    simulatingPayment.value = false
  }
}

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    try {
      const res = await axios.post('/api/v1/auth/guest-session')
      authStore.setAuth(res.data.user, res.data.token, res.data.wallet.balance)
    } catch (err) {
      console.warn('Guest initialization failed', err)
    }
  } else {
    await authStore.fetchMe()
  }
  await Promise.all([loadWallet(), loadPackages()])
})
</script>

<template>
  <div class="min-h-screen notebook-paper relative overflow-x-clip text-[#111111] flex flex-col selection:bg-[#ff82c2] selection:text-[#111111] font-sans">
    <!-- Subtle Ambient Pastel Halos -->
    <div aria-hidden="true" class="pointer-events-none fixed -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-[#20afff]/12 blur-[110px]"></div>
    <div aria-hidden="true" class="pointer-events-none fixed top-[32%] -right-28 w-[420px] h-[420px] rounded-full bg-[#ffda40]/14 blur-[120px]"></div>
    <div aria-hidden="true" class="pointer-events-none fixed -bottom-28 left-[18%] w-[380px] h-[380px] rounded-full bg-[#ff82c2]/10 blur-[120px]"></div>

    <AppNavbar :fluid="true" />

    <main class="relative z-10 flex-1 w-full max-w-[1640px] mx-auto px-4 sm:px-6 md:px-10 lg:px-12 py-7 md:py-9 space-y-6">
      <!-- Inline System Notification -->
      <div
        v-if="notification"
        role="status"
        aria-live="polite"
        :class="[
          'rounded-[14px] border-[1.5px] px-4 py-3 flex items-center justify-between gap-3 text-xs font-medium backdrop-blur-md shadow-[0_8px_20px_rgba(0,0,0,0.06)] animate-fade-in',
          notification.type === 'error' ? 'bg-rose-50/95 border-rose-400 text-rose-950' :
          notification.type === 'success' ? 'bg-emerald-50/95 border-emerald-400 text-emerald-950' :
          'bg-white/95 border-[#111111]/25 text-[#111111]'
        ]"
      >
        <div class="flex items-center gap-2.5">
          <AlertTriangle v-if="notification.type === 'error'" class="w-4 h-4 text-rose-700 shrink-0" :stroke-width="2.2" />
          <CheckCircle2 v-else-if="notification.type === 'success'" class="w-4 h-4 text-emerald-700 shrink-0" :stroke-width="2.2" />
          <Info v-else class="w-4 h-4 text-[#20afff] shrink-0" :stroke-width="2.2" />
          <span>{{ notification.message }}</span>
        </div>
        <button
          type="button"
          @click="dismissNotification"
          class="text-[#60605e] hover:text-[#111111] p-1 rounded-[8px] transition-colors cursor-pointer"
          aria-label="Tutup pemberitahuan"
        >
          <X class="w-4 h-4" :stroke-width="2" />
        </button>
      </div>

      <!-- Page Header -->
      <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
        <h1 class="font-editorial font-bold text-3xl sm:text-4xl text-[#111111] tracking-[-0.03em] leading-none">
          Dompet &amp; Kuota Token
        </h1>

        <div class="flex flex-wrap items-center gap-3 w-full md:w-auto md:justify-end">
          <router-link
            v-if="authStore.user?.role === 'ADMIN'"
            to="/admin/users"
            class="btn-keycap btn-keycap-sm btn-keycap-white px-3.5 py-2 text-xs"
          >
            Admin Users
          </router-link>

          <button
            type="button"
            @click="handleClaimDaily"
            :disabled="claiming"
            class="btn-keycap btn-keycap-sm btn-keycap-yellow px-4 py-2 text-xs whitespace-nowrap"
          >
            <Gift class="w-4 h-4 shrink-0" :stroke-width="2.2" />
            <span>{{ claiming ? 'Mengklaim...' : 'Klaim Token Harian' }}</span>
          </button>

          <router-link
            to="/dashboard"
            class="btn-keycap btn-keycap-sm btn-keycap-blue px-4 py-2 text-xs whitespace-nowrap"
          >
            <span>Buka Studio Workspace</span>
            <ArrowRight class="w-4 h-4 shrink-0" :stroke-width="2.2" />
          </router-link>
        </div>
      </header>

      <!-- Guest Sticky-Note Banner -->
      <div
        v-if="isGuest"
        class="rounded-[16px] border-2 border-[#111111] bg-[#ffda40]/92 backdrop-blur-md shadow-[3px_4px_0_#111111] px-5 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
      >
        <div class="flex items-start sm:items-center gap-2.5 text-[#111111]">
          <span class="px-2 py-0.5 rounded-[6px] bg-[#111111] text-[#ffda40] text-[10px] font-bold uppercase tracking-wider shrink-0">
            Mode Tamu
          </span>
          <span class="leading-relaxed">
            Anda menggunakan <strong class="font-bold">Sesi Studio Instan</strong>. Daftar akun permanen untuk menyimpan saldo kuota dan riwayat mutasi tanpa batas waktu.
          </span>
        </div>
        <router-link
          to="/register"
          class="btn-keycap btn-keycap-mini btn-keycap-white px-3.5 py-1.5 text-xs whitespace-nowrap shrink-0"
        >
          <span>Daftar Akun Permanen</span>
          <ArrowRight class="w-3.5 h-3.5" :stroke-width="2.2" />
        </router-link>
      </div>

      <!-- Daily Claim Feedback -->
      <div v-if="claimMsg" role="status" class="retro-telemetry-plate border-emerald-500 bg-emerald-50/95 text-emerald-950 text-xs px-4 py-3 font-semibold">
        {{ claimMsg }}
      </div>
      <div v-if="claimError" role="alert" class="retro-telemetry-plate border-amber-500 bg-amber-50/95 text-amber-950 text-xs px-4 py-3 font-semibold">
        {{ claimError }}
      </div>

      <!-- Dual-Pane Studio Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
        <div class="lg:col-span-7 space-y-6">
          <WalletBalanceCard
            :balance="authStore.walletBalance"
            :transactions="walletDetails?.transactions || []"
            :loading="loadingWallet && !walletDetails"
          />

          <TokenPackageSelector
            v-model="selectedPackage"
            :packages="packages"
            :loading="loadingPackages"
            :error="packagesError"
            :checkout-loading="checkoutLoading"
            :simulating-payment="simulatingPayment"
            :active-order="activeOrder"
            :is-guest="isGuest"
            @checkout="handleCheckout"
            @simulate-payment="handleSimulatePayment"
            @cancel-order="activeOrder = null"
            @retry="loadPackages"
          />
        </div>

        <div class="lg:col-span-5">
          <TokenLedgerCard
            :transactions="walletDetails?.transactions || []"
            :loading="loadingWallet"
            :error="walletError"
            @refresh="loadWallet"
          />
        </div>
      </div>
    </main>
  </div>
</template>
