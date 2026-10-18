<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import AppNavbar from '../components/AppNavbar.vue'
import SectionBadge from '../components/SectionBadge.vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const isGuest = computed(() => {
  return !authStore.user || authStore.user?.isGuest || authStore.user?.email === 'guest@polaris.audio'
})

const walletDetails = ref(null)
const claiming = ref(false)
const claimMsg = ref('')
const claimError = ref('')

const packages = ref([])
const selectedPackage = ref('PKG-25')
const checkoutLoading = ref(false)
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
  try {
    const res = await axios.get('/api/v1/wallet/details')
    walletDetails.value = res.data
    authStore.updateBalance(res.data.balance)
  } catch (err) {
    console.warn('Wallet not loaded', err)
  }
}

async function loadPackages() {
  try {
    const res = await axios.get('/api/v1/payments/packages')
    packages.value = res.data.packages
  } catch (err) {
    console.warn('Packages not loaded', err)
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
    const res = await axios.post('/api/v1/payments/checkout', {
      packageId: selectedPackage.value
    })
    activeOrder.value = res.data
  } catch (err) {
    notify(err.response?.data?.error || 'Gagal memulai checkout Midtrans', 'error')
  } finally {
    checkoutLoading.value = false
  }
}

async function handleSimulatePayment() {
  if (!activeOrder.value) return
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
  await loadWallet()
  await loadPackages()
})
</script>

<template>
  <div class="min-h-screen bg-[#FAFAFA] text-slate-900 flex flex-col selection:bg-[#0052FF]/20 selection:text-[#0052FF]">
    <AppNavbar />

    <main class="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-8">

      <!-- Inline Toast / System Notification -->
      <div 
        v-if="notification" 
        role="status" 
        aria-live="polite"
        :class="[
          'p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium transition-all shadow-sm',
          notification.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
          notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          'bg-blue-50 border-blue-200 text-blue-900'
        ]">
        <div class="flex items-center gap-2.5">
          <svg v-if="notification.type === 'error'" class="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <svg v-else-if="notification.type === 'success'" class="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg v-else class="w-4 h-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{{ notification.message }}</span>
        </div>
        <button 
          @click="dismissNotification"
          class="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors cursor-pointer"
          aria-label="Tutup pemberitahuan">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Header Section -->
      <div class="bg-white border border-slate-200/90 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div class="space-y-2 max-w-2xl">
          <SectionBadge label="Transaksi & Saldo Studio" />
          <h1 class="font-display text-2xl sm:text-3xl text-slate-900 mt-1">
            Dompet & Kuota Token
          </h1>
          <p class="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
            Kelola kuota pemrosesan sesi multitrack, lakukan top-up paket token via Midtrans Sandbox, dan pantau catatan transaksi mutasi akun.
          </p>
        </div>

        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <button 
            @click="handleClaimDaily" 
            :disabled="claiming"
            class="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2">
            <svg class="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V4a2 2 0 114 0v4H8V4a2 2 0 114 0zm0 0H3.5a1.5 1.5 0 00-1.5 1.5v3A1.5 1.5 0 003.5 10H12m0-2h8.5a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5H12m0 0v11m-9-11h18" />
            </svg>
            <span>{{ claiming ? 'Mengklaim...' : 'Klaim Token Harian' }}</span>
          </button>

          <router-link 
            to="/dashboard"
            class="px-5 py-3 rounded-xl bg-[#0052FF] hover:bg-[#0043D6] text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2">
            <span>Buka Studio Workspace</span>
          </router-link>
        </div>
      </div>

      <!-- Guest Upgrade Callout -->
      <div v-if="isGuest" class="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-2.5 text-blue-900">
          <svg class="w-4 h-4 text-[#0052FF] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Anda menggunakan <strong>Sesi Studio Instan</strong>. Daftar akun permanen untuk menyimpan saldo kuota dan riwayat mutasi tanpa batas waktu.</span>
        </div>
        <router-link to="/register" class="font-bold text-[#0052FF] hover:underline whitespace-nowrap">
          Daftar Akun Permanen
        </router-link>
      </div>

      <!-- Claim Feedback -->
      <div v-if="claimMsg" class="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-3.5 font-medium">
        {{ claimMsg }}
      </div>
      <div v-if="claimError" class="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-3.5 font-medium">
        {{ claimError }}
      </div>

      <!-- Main Content Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        <!-- Left / Top Column: Saldo & Top-Up Gateway (7 cols) -->
        <div class="lg:col-span-7 space-y-6">

          <!-- Current Balance Card -->
          <div class="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-sm space-y-4">
            <div class="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 class="font-display text-xl text-slate-900">Saldo Kuota Studio</h2>
                <span class="text-xs text-slate-500">Kuota operasional perbaikan fasa audio</span>
              </div>
              <span class="font-mono-accent text-[11px] bg-blue-50 text-[#0052FF] border border-blue-200/80 px-2.5 py-1 rounded-md font-semibold">
                1 Token = 1 Sesi Stems
              </span>
            </div>

            <div class="bg-[#F1F5F9] border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div class="space-y-1 text-center sm:text-left">
                <span class="font-mono-accent text-xs uppercase tracking-wider text-slate-500">Saldo Kuota Aktif</span>
                <div class="font-display text-5xl text-[#0052FF] leading-none">
                  {{ authStore.walletBalance }}
                </div>
                <span class="text-xs text-slate-500 font-mono-accent block">Token Tersedia</span>
              </div>

              <div class="text-xs text-slate-600 max-w-xs space-y-1 text-center sm:text-right">
                <p class="font-medium text-slate-800">Perhitungan Penggunaan</p>
                <p class="text-slate-500 leading-relaxed text-[11px]">
                  Diagnostik deterministik dan verifikasi fasa multitrack dipotong berdasarkan jumlah stem yang diproses.
                </p>
              </div>
            </div>
          </div>

          <!-- Purchase Packages Card -->
          <div class="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
            <div class="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 class="font-display text-xl text-slate-900">Beli Paket Token</h2>
                <span class="text-xs text-slate-500">Pembayaran instan via QRIS, GoPay, & Bank Transfer</span>
              </div>
              <span class="font-mono-accent text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded font-bold">
                MIDTRANS SANDBOX
              </span>
            </div>

            <!-- Packages Radio List -->
            <div class="space-y-3">
              <label 
                v-for="pkg in packages" 
                :key="pkg.id"
                :class="selectedPackage === pkg.id ? 'border-[#0052FF] bg-[#0052FF]/5 shadow-sm ring-1 ring-[#0052FF]' : 'border-slate-200 bg-white hover:border-slate-300'"
                class="flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all">
                <div class="flex items-center gap-3">
                  <input type="radio" v-model="selectedPackage" :value="pkg.id" class="text-[#0052FF] w-4 h-4" />
                  <div>
                    <span class="font-semibold text-slate-900 text-sm block">{{ pkg.name }}</span>
                    <span class="text-xs text-slate-500 font-mono-accent">{{ pkg.tokens }} Token Pemrosesan Sesi</span>
                  </div>
                </div>
                <div class="text-right">
                  <span class="font-mono-accent font-bold text-sm text-[#0052FF] block">
                    Rp {{ pkg.priceIdr.toLocaleString() }}
                  </span>
                  <span class="text-[10px] text-slate-400 font-mono-accent">
                    Rp {{ Math.round(pkg.priceIdr / pkg.tokens).toLocaleString() }} / token
                  </span>
                </div>
              </label>
            </div>

            <button 
              @click="handleCheckout"
              :disabled="checkoutLoading"
              class="w-full py-3.5 bg-[#0052FF] hover:bg-[#0043D6] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2">
              <span>{{ checkoutLoading ? 'Menghubungkan Midtrans Sandbox...' : (isGuest ? 'Daftar Akun untuk Beli Token' : 'Lanjutkan ke Pembayaran Midtrans') }}</span>
            </button>

            <!-- Invoice Simulation Preview -->
            <div v-if="activeOrder" class="p-5 bg-slate-900 text-white border border-slate-800 rounded-xl space-y-3 animate-fade-in">
              <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span class="font-mono-accent text-[11px] text-slate-400 uppercase tracking-wider">Simulasi Sandbox Midtrans</span>
                <span class="font-mono-accent text-xs text-cyan-400 font-bold">{{ activeOrder.orderId }}</span>
              </div>
              <div class="flex justify-between text-xs py-1">
                <span class="text-slate-400">Paket:</span>
                <span class="font-semibold text-white">{{ activeOrder.package?.name }} ({{ activeOrder.package?.tokens }} Token)</span>
              </div>
              <div class="flex justify-between text-xs py-1">
                <span class="text-slate-400">Total Pembayaran:</span>
                <span class="font-bold text-white font-mono-accent">Rp {{ activeOrder.package?.priceIdr?.toLocaleString() }}</span>
              </div>
              <div class="pt-2 border-t border-slate-800">
                <button 
                  @click="handleSimulatePayment"
                  class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-2">
                  <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Simulasi Webhook Pembayaran Berhasil</span>
                </button>
              </div>
            </div>

          </div>

        </div>

        <!-- Right Column: Transaction Mutation Ledger (5 cols) -->
        <div class="lg:col-span-5 space-y-6">
          <div class="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-sm space-y-4">
            <div class="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 class="font-display text-xl text-slate-900">Riwayat Mutasi Token</h3>
                <span class="text-xs text-slate-500">Catatan penambahan & pemakaian kuota</span>
              </div>
              <button 
                @click="loadWallet"
                class="text-xs font-semibold text-[#0052FF] hover:underline cursor-pointer">
                Segarkan
              </button>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-xs text-left">
                <thead class="text-slate-400 font-mono-accent border-b border-slate-100">
                  <tr>
                    <th class="py-2.5 font-medium">Waktu</th>
                    <th class="py-2.5 font-medium">Tipe</th>
                    <th class="py-2.5 text-right font-medium">Mutasi</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 font-mono-accent">
                  <tr v-for="tx in walletDetails?.transactions" :key="tx.id">
                    <td class="py-3 text-slate-500 text-[11px] whitespace-nowrap">
                      {{ new Date(tx.createdAt).toLocaleDateString() }}
                    </td>
                    <td class="py-3 font-semibold text-slate-800 text-[11px]">
                      {{ tx.type }}
                    </td>
                    <td class="py-3 text-right font-bold text-[11px]" :class="tx.amount > 0 ? 'text-[#0052FF]' : 'text-rose-500'">
                      {{ tx.amount > 0 ? '+' + tx.amount : tx.amount }}
                    </td>
                  </tr>
                  <tr v-if="!walletDetails?.transactions?.length">
                    <td colspan="3" class="py-12 text-center text-slate-500 text-xs">
                      <div class="space-y-1.5 max-w-xs mx-auto">
                        <p class="font-medium text-slate-700">Belum ada catatan mutasi</p>
                        <p class="text-[11px] text-slate-400 leading-relaxed">
                          Gunakan tombol Klaim Token Harian atau selesaikan pembelian paket via Midtrans untuk melihat riwayat mutasi kuota.
                        </p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        </div>

      </div>

    </main>
  </div>
</template>
