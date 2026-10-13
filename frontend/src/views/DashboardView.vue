<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import UploadSessionModal from './UploadSessionModal.vue'

const router = useRouter()
const authStore = useAuthStore()

const walletDetails = ref(null)
const claiming = ref(false)
const claimMsg = ref('')
const claimError = ref('')

const packages = ref([])
const selectedPackage = ref('PKG-25')
const checkoutLoading = ref(false)
const activeOrder = ref(null)

const sessions = ref([])
const showUploadModal = ref(false)
const verifyingSessionId = ref(null)
const verificationResult = ref(null)

async function loadWallet() {
  try {
    const res = await axios.get('/api/v1/wallet/details')
    walletDetails.value = res.data
    authStore.updateBalance(res.data.balance)
  } catch (err) {
    console.error('Failed to load wallet', err)
  }
}

async function loadPackages() {
  try {
    const res = await axios.get('/api/v1/payments/packages')
    packages.value = res.data.packages
  } catch (err) {
    console.error('Failed to load packages', err)
  }
}

async function loadSessions() {
  try {
    const res = await axios.get('/api/v1/sessions')
    sessions.value = res.data.sessions
  } catch (err) {
    console.error('Failed to load sessions', err)
  }
}

async function handleClaimDaily() {
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
  checkoutLoading.value = true
  activeOrder.value = null
  try {
    const res = await axios.post('/api/v1/payments/checkout', {
      packageId: selectedPackage.value
    })
    activeOrder.value = res.data
  } catch (err) {
    alert(err.response?.data?.error || 'Gagal memulai checkout Midtrans')
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
    alert('Pembayaran Midtrans Berhasil Dikonfirmasi! Token telah ditambahkan ke akun Anda.')
    activeOrder.value = null
    await loadWallet()
  } catch (err) {
    alert('Gagal simulasi konfirmasi webhook')
  }
}

async function handleVerify(session) {
  verifyingSessionId.value = session.id
  verificationResult.value = null
  try {
    const res = await axios.post(`/api/v1/sessions/${session.id}/verify-integrity`)
    verificationResult.value = {
      sessionId: session.id,
      ...res.data.verificationSummary
    }
  } catch (err) {
    alert(err.response?.data?.error || 'Gagal memverifikasi sinkronisasi sesi')
  } finally {
    verifyingSessionId.value = null
  }
}

function onSessionUploaded(newSession) {
  showUploadModal.value = false
  loadSessions()
}

function handleLogout() {
  authStore.logout()
  router.push('/login')
}

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    router.push('/login')
    return
  }
  await authStore.fetchMe()
  await loadWallet()
  await loadPackages()
  await loadSessions()
})
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
    <!-- Navbar -->
    <header class="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center border border-cyan-500/30">
          P
        </div>
        <div>
          <span class="font-bold text-base text-white tracking-tight">Polaris Audio</span>
          <span class="text-xs block text-slate-400">Audio Engineer Studio Hub</span>
        </div>
      </div>

      <div class="flex items-center space-x-4">
        <!-- Saldo Token Badge -->
        <div class="flex items-center bg-slate-950 border border-cyan-500/30 rounded-xl px-3.5 py-1.5 shadow-inner">
          <span class="text-xs text-slate-400 mr-2">Saldo Token:</span>
          <span class="text-cyan-400 font-bold text-sm font-mono">{{ authStore.walletBalance }} Token</span>
        </div>

        <div class="text-xs text-slate-300">
          {{ authStore.user?.name }}
        </div>

        <button 
          @click="handleLogout" 
          class="text-xs text-rose-400 hover:text-rose-300 hover:underline cursor-pointer">
          Keluar
        </button>
      </div>
    </header>

    <!-- Content -->
    <main class="flex-1 max-w-5xl w-full mx-auto p-6 space-y-6">
      <!-- Greeting Banner -->
      <div class="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 class="text-xl font-bold text-white">Selamat Datang, {{ authStore.user?.name }}</h2>
          <p class="text-xs text-slate-400 mt-1">Siapkan berkas sesi multitrack Anda untuk diagnostik fasa, fake stereo, dan perbaikan DSP.</p>
        </div>

        <div class="flex items-center gap-3">
          <button 
            @click="handleClaimDaily" 
            :disabled="claiming"
            class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors shadow-lg shadow-emerald-950">
            {{ claiming ? 'Mengklaim...' : '🎁 Klaim 2 Token Harian' }}
          </button>
        </div>
      </div>

      <!-- Notifikasi Claim -->
      <div v-if="claimMsg" class="bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs rounded-xl p-3">
        {{ claimMsg }}
      </div>
      <div v-if="claimError" class="bg-amber-950/50 border border-amber-800 text-amber-300 text-xs rounded-xl p-3">
        {{ claimError }}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Panel 1: Sesi Mixing (Fase 3 UC-10 & UC-11) -->
        <div class="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div class="flex justify-between items-center">
            <div>
              <h3 class="font-bold text-sm text-white uppercase tracking-wider">Sesi Multitrack Aktif</h3>
              <p class="text-xs text-slate-400 mt-0.5">Daftar rekaman multitrack yang siap dianalisis</p>
            </div>
            <button 
              @click="showUploadModal = true"
              class="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-lg shadow-cyan-950 flex items-center gap-2">
              <span>+ Unggah Sesi Baru</span>
            </button>
          </div>

          <!-- Empty State -->
          <div v-if="!sessions.length" class="border-2 border-dashed border-slate-800 rounded-xl p-10 text-center flex flex-col items-center justify-center">
            <div class="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center mb-3">
              🎵
            </div>
            <p class="text-sm font-semibold text-slate-300">Belum ada sesi audio yang diunggah</p>
            <p class="text-xs text-slate-500 mt-1 max-w-sm">
              Klik tombol "+ Unggah Sesi Baru" di atas untuk menambahkan berkas multitrack (WAV/FLAC/ZIP) ke MinIO S3 Storage.
            </p>
          </div>

          <!-- Session List Cards -->
          <div v-else class="space-y-3">
            <div 
              v-for="s in sessions" 
              :key="s.id" 
              class="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="text-sm font-bold text-white">{{ s.title }}</h4>
                  <span class="text-[11px] text-slate-400 font-mono">
                    {{ s.tracks?.length || 0 }} Stems Audio • Status: 
                    <span class="text-cyan-400 font-semibold">{{ s.status }}</span>
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <button 
                    @click="handleVerify(s)" 
                    :disabled="verifyingSessionId === s.id"
                    class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg cursor-pointer transition-colors">
                    {{ verifyingSessionId === s.id ? 'Memindai...' : '🔍 Verifikasi Sinkronisasi (UC-11)' }}
                  </button>
                </div>
              </div>

              <!-- Track list preview badges -->
              <div class="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/60">
                <span 
                  v-for="t in s.tracks" 
                  :key="t.id"
                  class="bg-slate-900 border border-slate-800 text-[10px] text-slate-300 px-2 py-0.5 rounded font-mono truncate max-w-xs">
                  {{ t.fileName }}
                </span>
              </div>

              <!-- Verification Result Alert -->
              <div 
                v-if="verificationResult && verificationResult.sessionId === s.id"
                :class="verificationResult.status === 'PASSED' ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-amber-950/40 border-amber-800 text-amber-300'"
                class="border rounded-xl p-3 text-xs space-y-1">
                <div class="font-bold flex items-center justify-between">
                  <span>Hasil Verifikasi Sesi: {{ verificationResult.status }}</span>
                  <span class="font-mono text-[10px]">{{ verificationResult.sampleRateConsistency }}</span>
                </div>
                <p class="text-[11px] opacity-90">{{ verificationResult.message }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Panel 2: Midtrans Token Top-up Gateway (UC-07) -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-sm text-white uppercase tracking-wider">Midtrans Gateway</h3>
            <span class="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded font-mono">SANDBOX</span>
          </div>

          <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center">
            <span class="text-xs text-slate-400 block mb-1">Saldo Tersedia</span>
            <span class="text-3xl font-extrabold text-cyan-400 font-mono">{{ authStore.walletBalance }}</span>
            <span class="text-xs text-slate-500 block mt-1">1 token = 1 sesi mixing</span>
          </div>

          <!-- Checkout Form -->
          <div class="space-y-3 pt-2 border-t border-slate-800">
            <label class="block text-xs text-slate-400 font-medium">Pilih Paket Token:</label>
            <div class="space-y-1.5">
              <label 
                v-for="pkg in packages" 
                :key="pkg.id" 
                :class="selectedPackage === pkg.id ? 'border-cyan-500 bg-cyan-950/20' : 'border-slate-800 bg-slate-950'"
                class="flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-colors text-xs">
                <div class="flex items-center space-x-2">
                  <input type="radio" v-model="selectedPackage" :value="pkg.id" class="text-cyan-500" />
                  <span class="font-semibold text-slate-200">{{ pkg.name }} ({{ pkg.tokens }} Tkn)</span>
                </div>
                <span class="font-mono text-cyan-400 font-bold">Rp {{ pkg.priceIdr.toLocaleString() }}</span>
              </label>
            </div>

            <button 
              @click="handleCheckout" 
              :disabled="checkoutLoading"
              class="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs font-bold text-white rounded-xl cursor-pointer transition-colors mt-2">
              {{ checkoutLoading ? 'Menghubungkan Midtrans...' : 'Beli Paket via Midtrans' }}
            </button>
          </div>

          <!-- Modal / Active Invoice Display -->
          <div v-if="activeOrder" class="p-4 bg-slate-950 border border-cyan-800/80 rounded-xl space-y-3">
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-400">Order ID:</span>
              <span class="font-mono text-slate-300 text-[11px]">{{ activeOrder.orderId }}</span>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-400">Total Tagihan:</span>
              <span class="font-bold text-white">Rp {{ activeOrder.package?.priceIdr?.toLocaleString() }}</span>
            </div>

            <div class="pt-2 border-t border-slate-800/80 flex flex-col gap-2">
              <button 
                @click="handleSimulatePayment" 
                class="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg cursor-pointer">
                Simulasi Bayar Berhasil (Webhook)
              </button>
              <span class="text-[10px] text-slate-500 text-center">
                Memicu webhook Midtrans instant settlement & kredit token
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Riwayat Transaksi Token -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 class="font-bold text-sm text-white uppercase tracking-wider mb-4">Riwayat Mutasi Saldo Token (Ledger)</h3>
        
        <div class="overflow-x-auto">
          <table class="w-full text-xs text-left">
            <thead class="text-slate-400 border-b border-slate-800">
              <tr>
                <th class="py-2.5">Waktu</th>
                <th class="py-2.5">Jenis Transaksi</th>
                <th class="py-2.5">Keterangan</th>
                <th class="py-2.5 text-right">Jumlah Token</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">
              <tr v-for="tx in walletDetails?.transactions" :key="tx.id" class="text-slate-300">
                <td class="py-3 text-slate-500 font-mono">{{ new Date(tx.createdAt).toLocaleDateString() }} {{ new Date(tx.createdAt).toLocaleTimeString() }}</td>
                <td class="py-3 font-semibold">
                  <span :class="tx.amount > 0 ? 'text-emerald-400' : 'text-rose-400'">
                    {{ tx.type }}
                  </span>
                </td>
                <td class="py-3 text-slate-400">{{ tx.description || '-' }}</td>
                <td class="py-3 text-right font-mono font-bold" :class="tx.amount > 0 ? 'text-emerald-400' : 'text-rose-400'">
                  {{ tx.amount > 0 ? '+' + tx.amount : tx.amount }}
                </td>
              </tr>
              <tr v-if="!walletDetails?.transactions?.length">
                <td colspan="4" class="py-4 text-center text-slate-500">Belum ada riwayat transaksi</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>

    <!-- Upload Modal -->
    <UploadSessionModal 
      v-if="showUploadModal" 
      @close="showUploadModal = false" 
      @uploaded="onSessionUploaded" 
    />
  </div>
</template>
