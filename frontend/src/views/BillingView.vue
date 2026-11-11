<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import AppNavbar from '../components/AppNavbar.vue'
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
  <div class="min-h-screen bg-paper-white text-ink-black flex flex-col selection:bg-black selection:text-white">
    <AppNavbar :fluid="true" />

    <main class="flex-1 w-full max-w-[1800px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-6 md:py-8 space-y-8">

      <!-- Inline Toast / System Notification -->
      <div 
        v-if="notification" 
        role="status" 
        aria-live="polite"
        :class="[
          'p-4 border flex items-center justify-between gap-3 text-xs font-medium transition-all rounded-none',
          notification.type === 'error' ? 'bg-rose-50 border-rose-300 text-rose-900' :
          notification.type === 'success' ? 'bg-[#ECFDF5] border-[#6EE7B7] text-emerald-950 font-mono-accent' :
          'bg-bone border-stone text-ink-black'
        ]">
        <div class="flex items-center gap-2.5">
          <svg v-if="notification.type === 'error'" class="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <svg v-else-if="notification.type === 'success'" class="w-4 h-4 text-emerald-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg v-else class="w-4 h-4 text-ink-black shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{{ notification.message }}</span>
        </div>
        <button 
          @click="dismissNotification"
          class="text-slate hover:text-ink-black p-1 transition-colors cursor-pointer rounded-none"
          aria-label="Tutup pemberitahuan">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Header Section (Seamless, blends into background) -->
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 py-2 px-1">
        <div>
          <h1 class="font-editorial text-2xl sm:text-3xl font-bold text-ink-black tracking-tight">
            Dompet & Kuota Token
          </h1>
        </div>

        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <router-link
            v-if="authStore.user?.role === 'ADMIN'"
            to="/admin/users"
            class="text-xs font-semibold uppercase tracking-wider text-slate hover:text-ink-black transition-colors self-center"
          >
            Admin: Users
          </router-link>
          <button 
            @click="handleClaimDaily" 
            :disabled="claiming"
            class="btn-bone-secondary border border-stone h-10 px-5 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
            <svg class="w-4 h-4 text-ink-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V4a2 2 0 114 0v4H8V4a2 2 0 114 0zm0 0H3.5a1.5 1.5 0 00-1.5 1.5v3A1.5 1.5 0 003.5 10H12m0-2h8.5a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5H12m0 0v11m-9-11h18" />
            </svg>
            <span>{{ claiming ? 'Mengklaim...' : 'Klaim Token Harian' }}</span>
          </button>

          <router-link 
            to="/dashboard"
            class="btn-ink-stamp h-10 px-5 text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap">
            <span>Buka Studio Workspace →</span>
          </router-link>
        </div>
      </div>

      <!-- Guest Upgrade Callout -->
      <div v-if="isGuest" class="bg-paper-white border-2 border-stone p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs rounded-none">
        <div class="flex items-center gap-2.5 text-ink-black">
          <svg class="w-4 h-4 text-[#0052FF] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Anda menggunakan <strong>Sesi Studio Instan</strong>. Daftar akun permanen untuk menyimpan saldo kuota dan riwayat mutasi tanpa batas waktu.</span>
        </div>
        <router-link to="/register" class="font-bold text-ink-black underline underline-offset-4 hover:text-[#0052FF] whitespace-nowrap font-mono-accent">
          Daftar Akun Permanen →
        </router-link>
      </div>

      <!-- Claim Feedback -->
      <div v-if="claimMsg" class="bg-[#ECFDF5] border border-[#6EE7B7] text-emerald-950 text-xs p-3.5 font-semibold font-mono-accent rounded-none">
        {{ claimMsg }}
      </div>
      <div v-if="claimError" class="bg-amber-50 border border-amber-300 text-amber-950 text-xs p-3.5 font-semibold font-mono-accent rounded-none">
        {{ claimError }}
      </div>

      <!-- Main Content Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        <!-- Left Column: Saldo & Top-Up Gateway (7 cols) -->
        <div class="lg:col-span-7 space-y-8">

          <!-- Current Balance Section -->
          <div class="space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-stone/60">
              <h2 class="font-editorial text-xl font-bold text-ink-black tracking-tight">Saldo Kuota Studio</h2>
              <span class="font-mono-accent text-[11px] bg-paper-white text-ink-black border border-stone px-2.5 py-1 font-semibold rounded-none">
                1 Token = 1 Sesi Stems
              </span>
            </div>

            <div class="bg-bone border border-stone p-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-none">
              <div class="space-y-1 text-center sm:text-left">
                <span class="font-mono-accent text-xs uppercase tracking-wider text-slate">Saldo Kuota Aktif</span>
                <div class="font-mono-accent text-5xl font-bold text-ink-black leading-none">
                  {{ authStore.walletBalance }}
                </div>
                <span class="text-xs text-slate font-mono-accent block">Token Tersedia</span>
              </div>
            </div>
          </div>

          <!-- Purchase Packages Section -->
          <div class="space-y-5">
            <div class="flex items-center justify-between pb-3 border-b border-stone/60">
              <h2 class="font-editorial text-xl font-bold text-ink-black tracking-tight">Beli Paket Token</h2>
              <span class="font-mono-accent text-[10px] bg-bone text-emerald-800 border border-stone px-2.5 py-1 font-bold rounded-none">
                MIDTRANS SANDBOX
              </span>
            </div>

            <!-- Packages Radio List -->
            <div class="space-y-2.5">
              <label 
                v-for="pkg in packages" 
                :key="pkg.id"
                :class="selectedPackage === pkg.id ? 'border-2 border-black bg-bone' : 'border border-stone bg-paper-white hover:border-black'"
                class="flex items-center justify-between p-4 cursor-pointer transition-all rounded-none">
                <div class="flex items-center gap-3">
                  <input 
                    type="radio" 
                    v-model="selectedPackage" 
                    :value="pkg.id" 
                    class="w-4 h-4 accent-black cursor-pointer" />
                  <div>
                    <span class="font-semibold text-ink-black text-sm block">{{ pkg.name }}</span>
                    <span class="text-xs text-slate font-mono-accent">{{ pkg.tokens }} Token Pemrosesan Sesi</span>
                  </div>
                </div>
                <div class="text-right">
                  <span class="font-mono-accent font-bold text-sm text-ink-black block">
                    Rp {{ pkg.priceIdr.toLocaleString() }}
                  </span>
                  <span class="text-[10px] text-slate font-mono-accent">
                    Rp {{ Math.round(pkg.priceIdr / pkg.tokens).toLocaleString() }} / token
                  </span>
                </div>
              </label>
            </div>

            <button 
              @click="handleCheckout"
              :disabled="checkoutLoading"
              class="w-full btn-ink-stamp py-3.5 text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
              <span>{{ checkoutLoading ? 'Menghubungkan Midtrans Sandbox...' : (isGuest ? 'Daftar Akun untuk Beli Token' : 'Lanjutkan ke Pembayaran Midtrans') }}</span>
            </button>

            <!-- Invoice Simulation Preview (Opsi B: Panel flat bone, serasi dengan kanvas kertas) -->
            <div v-if="activeOrder" class="p-5 bg-bone text-ink-black border border-stone rounded-none space-y-3 animate-fade-in">
              <div class="flex items-center justify-between border-b border-stone pb-2.5">
                <span class="font-mono-accent text-[11px] text-slate uppercase tracking-wider font-semibold">Simulasi Sandbox Midtrans</span>
                <span class="font-mono-accent text-xs text-ink-black font-bold">{{ activeOrder.orderId }}</span>
              </div>
              <div class="flex justify-between text-xs py-1">
                <span class="text-slate">Paket:</span>
                <span class="font-semibold text-ink-black">{{ activeOrder.package?.name }} ({{ activeOrder.package?.tokens }} Token)</span>
              </div>
              <div class="flex justify-between text-xs py-1">
                <span class="text-slate">Total Pembayaran:</span>
                <span class="font-bold text-ink-black font-mono-accent">Rp {{ activeOrder.package?.priceIdr?.toLocaleString() }}</span>
              </div>
              <div class="pt-2 border-t border-stone">
                <button 
                  @click="handleSimulatePayment"
                  class="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-none cursor-pointer transition-all flex items-center justify-center gap-2">
                  <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Simulasi Konfirmasi Pembayaran</span>
                </button>
              </div>
            </div>

          </div>

        </div>

        <!-- Right Column: Transaction Mutation Ledger (5 cols) -->
        <div class="lg:col-span-5 space-y-6">
          <div class="space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-stone/60">
              <h3 class="font-editorial text-xl font-bold text-ink-black tracking-tight">Riwayat Mutasi Token</h3>
              <button 
                @click="loadWallet"
                class="text-xs font-mono-accent font-bold text-ink-black hover:underline cursor-pointer">
                Segarkan
              </button>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-xs text-left">
                <thead class="text-slate font-mono-accent border-b border-stone/60 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th class="py-2.5 font-medium">Waktu</th>
                    <th class="py-2.5 font-medium">Tipe</th>
                    <th class="py-2.5 text-right font-medium">Mutasi</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-stone/40 font-mono-accent">
                  <tr v-for="tx in walletDetails?.transactions" :key="tx.id" class="hover:bg-bone/40 transition-colors">
                    <td class="py-3 text-slate text-[11px] whitespace-nowrap">
                      {{ new Date(tx.createdAt).toLocaleDateString() }}
                    </td>
                    <td class="py-3 font-semibold text-ink-black text-[11px]">
                      {{ tx.type }}
                    </td>
                    <td class="py-3 text-right font-bold text-[11px]" :class="tx.amount > 0 ? 'text-emerald-700' : 'text-rose-700'">
                      {{ tx.amount > 0 ? '+' + tx.amount : tx.amount }}
                    </td>
                  </tr>
                  <tr v-if="!walletDetails?.transactions?.length">
                    <td colspan="3" class="py-12 text-center text-slate text-xs">
                      <div class="border border-dashed border-stone p-6 bg-paper-white space-y-1.5 max-w-sm mx-auto">
                        <p class="font-medium text-ink-black">Belum ada catatan mutasi</p>
                        <p class="text-[11px] text-slate leading-relaxed">
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
