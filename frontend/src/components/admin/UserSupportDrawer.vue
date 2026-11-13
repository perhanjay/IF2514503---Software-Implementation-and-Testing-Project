<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import axios from 'axios'
import { 
  X, 
  AlertTriangle, 
  CheckCircle, 
  Shield, 
  Wallet, 
  RotateCw, 
  Ban, 
  LogOut, 
  Layers
} from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'

const props = defineProps({
  userId: {
    type: String,
    default: null
  },
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'user-updated'])

const authStore = useAuthStore()

// State
const userData = ref(null)
const loading = ref(false)
const fetchError = ref('')
const feedbackMessage = ref('')
const errorMessage = ref('')

// Action states
const statusLoading = ref(false)
const showSuspendModal = ref(false)
const suspendReason = ref('')

const tokenLoading = ref(false)
const tokenType = ref('TOPUP') // 'TOPUP' | 'REFUND' | 'DEDUCTION'
const tokenAmount = ref(1)
const tokenDescription = ref('')

const revokeLoading = ref(false)
const showRevokeModal = ref(false)

// Computed
const isSelf = computed(() => {
  return !!authStore.user?.id && authStore.user.id === userData.value?.id
})

const projectedBalance = computed(() => {
  const current = userData.value?.wallet?.balance ?? 0
  const amt = Math.floor(Number(tokenAmount.value)) || 0
  if (tokenType.value === 'DEDUCTION') {
    return current - amt
  }
  return current + amt
})

// Data fetching
async function fetchUserDetail() {
  if (!props.userId) return
  loading.value = true
  fetchError.value = ''
  feedbackMessage.value = ''
  errorMessage.value = ''
  try {
    const res = await axios.get(`/api/v1/admin/users/${props.userId}`)
    userData.value = res.data.user
  } catch (err) {
    console.error('Failed to fetch user detail:', err)
    fetchError.value = err.response?.data?.error || 'Gagal memuat rincian pengguna'
  } finally {
    loading.value = false
  }
}

// Actions
function openSuspendModal() {
  if (isSelf.value) return
  suspendReason.value = ''
  showSuspendModal.value = true
}

async function confirmSuspend() {
  if (isSelf.value) return
  statusLoading.value = true
  errorMessage.value = ''
  feedbackMessage.value = ''
  try {
    const res = await axios.patch(`/api/v1/admin/users/${props.userId}/status`, {
      status: 'SUSPENDED',
      reason: suspendReason.value.trim() || undefined
    })
    if (userData.value) {
      userData.value.status = res.data.user.status
      userData.value.statusReason = res.data.user.statusReason
    }
    showSuspendModal.value = false
    feedbackMessage.value = res.data.message || 'Akun pengguna berhasil ditangguhkan'
    emit('user-updated')
  } catch (err) {
    errorMessage.value = err.response?.data?.error || 'Gagal menangguhkan akun pengguna'
  } finally {
    statusLoading.value = false
  }
}

async function reactivateAccount() {
  statusLoading.value = true
  errorMessage.value = ''
  feedbackMessage.value = ''
  try {
    const res = await axios.patch(`/api/v1/admin/users/${props.userId}/status`, {
      status: 'ACTIVE'
    })
    if (userData.value) {
      userData.value.status = res.data.user.status
      userData.value.statusReason = null
    }
    feedbackMessage.value = res.data.message || 'Akun pengguna berhasil diaktifkan kembali'
    emit('user-updated')
  } catch (err) {
    errorMessage.value = err.response?.data?.error || 'Gagal mengaktifkan kembali akun pengguna'
  } finally {
    statusLoading.value = false
  }
}

async function adjustTokens() {
  const amt = Math.floor(Number(tokenAmount.value))
  if (!amt || amt <= 0) {
    errorMessage.value = 'Jumlah token harus berupa bilangan bulat positif lebih besar dari 0'
    return
  }
  if (!tokenDescription.value || tokenDescription.value.trim().length < 5) {
    errorMessage.value = 'Deskripsi penyesuaian token minimal 5 karakter'
    return
  }
  if (tokenType.value === 'DEDUCTION' && (userData.value?.wallet?.balance || 0) < amt) {
    errorMessage.value = 'Saldo token tidak mencukupi untuk pemotongan'
    return
  }

  tokenLoading.value = true
  errorMessage.value = ''
  feedbackMessage.value = ''
  try {
    const res = await axios.post(`/api/v1/admin/users/${props.userId}/tokens`, {
      amount: amt,
      type: tokenType.value,
      description: tokenDescription.value.trim()
    })
    feedbackMessage.value = res.data.message || 'Penyesuaian token berhasil diproses'
    tokenAmount.value = 1
    tokenDescription.value = ''
    await fetchUserDetail()
    emit('user-updated')
  } catch (err) {
    errorMessage.value = err.response?.data?.error || 'Gagal memproses penyesuaian token'
  } finally {
    tokenLoading.value = false
  }
}

async function confirmRevokeSessions() {
  revokeLoading.value = true
  errorMessage.value = ''
  feedbackMessage.value = ''
  try {
    const res = await axios.post(`/api/v1/admin/users/${props.userId}/revoke-sessions`)
    showRevokeModal.value = false
    feedbackMessage.value = res.data.message || 'Semua sesi pengguna telah berhasil dicabut'
    emit('user-updated')
  } catch (err) {
    errorMessage.value = err.response?.data?.error || 'Gagal mencabut sesi aktif pengguna'
  } finally {
    revokeLoading.value = false
  }
}

// Helpers
function formatNumber(val) {
  return new Intl.NumberFormat('id-ID').format(val || 0)
}

function formatDate(isoStr) {
  if (!isoStr) return '-'
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return isoStr
  }
}

function formatTimestamp(isoStr) {
  if (!isoStr) return '-'
  try {
    const d = new Date(isoStr)
    return d.toLocaleString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return isoStr
  }
}

// Watchers & Keyboard
function handleKeyDown(e) {
  if (e.key === 'Escape') {
    if (showSuspendModal.value) {
      showSuspendModal.value = false
    } else if (showRevokeModal.value) {
      showRevokeModal.value = false
    } else if (props.isOpen) {
      emit('close')
    }
  }
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    window.addEventListener('keydown', handleKeyDown)
    fetchUserDetail()
  } else {
    window.removeEventListener('keydown', handleKeyDown)
    showSuspendModal.value = false
    showRevokeModal.value = false
    feedbackMessage.value = ''
    errorMessage.value = ''
  }
})

watch(() => props.userId, (newId) => {
  if (props.isOpen && newId) {
    fetchUserDetail()
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <Teleport to="body">
    <div 
      v-if="isOpen" 
      class="fixed inset-0 z-50 overflow-hidden" 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="drawer-headline">
      
      <!-- Semi-transparent backdrop -->
      <div 
        class="fixed inset-0 bg-black/40 transition-opacity cursor-pointer" 
        @click="emit('close')" 
        aria-hidden="true" 
      />

      <!-- Slide-over Drawer Panel -->
      <aside 
        class="fixed inset-y-0 right-0 w-full max-w-xl bg-paper-white border-l-2 border-black z-50 overflow-y-auto flex flex-col shadow-2xl selection:bg-hot-pink selection:text-ink-black font-editorial">
        
        <!-- Drawer Header -->
        <div class="sticky top-0 z-10 bg-bone border-b border-stone px-6 py-4 flex items-center justify-between">
          <div>
            <div class="flex items-center gap-2 mb-0.5">
              <span class="text-[9px] font-bold uppercase tracking-[0.2em] text-slate bg-paper-white px-1.5 py-0.5 border border-stone">
                Support &amp; Ledger
              </span>
            </div>
            <h2 id="drawer-headline" class="font-editorial font-bold text-lg tracking-tight text-ink-black">
              USER DETAILS &amp; CONTROLS
            </h2>
          </div>

          <button 
            @click="emit('close')" 
            type="button" 
            title="Tutup (Esc)" 
            class="btn-bone-secondary border border-stone p-2 text-ink-black hover:border-black transition-colors cursor-pointer">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Inline Notification Feedback -->
        <div v-if="feedbackMessage" class="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-mono-accent flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <CheckCircle class="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{{ feedbackMessage }}</span>
          </div>
          <button @click="feedbackMessage = ''" class="text-emerald-700 hover:text-emerald-950 p-0.5 cursor-pointer" aria-label="Tutup pesan sukses">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>

        <div v-if="errorMessage" class="mx-6 mt-4 p-3 bg-rose-50 border border-rose-300 text-rose-950 text-xs font-mono-accent flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <AlertTriangle class="w-4 h-4 text-rose-600 shrink-0" />
            <span>{{ errorMessage }}</span>
          </div>
          <button @click="errorMessage = ''" class="text-rose-700 hover:text-rose-950 p-0.5 cursor-pointer" aria-label="Tutup pesan galat">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Drawer Body -->
        <div class="p-6 space-y-6 flex-1">
          <!-- Loading State -->
          <div v-if="loading && !userData" class="py-16 text-center text-slate font-mono-accent text-xs">
            <div class="flex justify-center items-center gap-2">
              <RotateCw class="w-4 h-4 animate-spin text-ink-black" />
              <span>Memuat data pengguna...</span>
            </div>
          </div>

          <!-- Fetch Error State -->
          <div v-else-if="fetchError" class="py-12 text-center text-rose-700 font-mono-accent text-xs">
            <div class="flex flex-col items-center gap-3">
              <AlertTriangle class="w-6 h-6 text-rose-600" />
              <p>{{ fetchError }}</p>
              <button 
                @click="fetchUserDetail" 
                class="btn-bone-secondary border border-stone px-3 py-1.5 text-xs font-semibold hover:border-black cursor-pointer">
                Coba Lagi
              </button>
            </div>
          </div>

          <!-- User Content -->
          <template v-else-if="userData">
            <!-- 1. User Overview Card -->
            <div class="bg-bone border border-stone p-5 rounded-none space-y-4">
              <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <h3 class="font-editorial font-bold text-xl text-ink-black leading-tight">
                    {{ userData.name }}
                  </h3>
                  <div class="font-mono-accent text-xs text-slate mt-0.5">
                    {{ userData.email }}
                  </div>
                  <div class="font-mono-accent text-[11px] text-slate/80 mt-1 flex items-center gap-1.5">
                    <span class="text-[9px] uppercase tracking-wider font-semibold bg-paper-white px-1 py-0.2 border border-stone/60">ID</span>
                    <span class="truncate max-w-xs">{{ userData.id }}</span>
                  </div>
                </div>

                <!-- Balance Display -->
                <div class="sm:text-right bg-paper-white sm:bg-transparent p-3 sm:p-0 border sm:border-0 border-stone">
                  <div class="text-[10px] font-semibold uppercase tracking-wider text-slate">
                    SALDO TOKEN
                  </div>
                  <div class="font-mono-accent text-2xl font-bold text-ink-black tracking-tight mt-0.5">
                    {{ formatNumber(userData.wallet?.balance ?? 0) }}
                    <span class="text-xs font-normal text-slate">Token</span>
                  </div>
                </div>
              </div>

              <!-- Session Statistics Strip -->
              <div class="pt-3 border-t border-stone grid grid-cols-3 gap-2 text-center">
                <div class="bg-paper-white p-2.5 border border-stone">
                  <div class="text-[9px] font-semibold uppercase tracking-wider text-slate">
                    TOTAL SESI
                  </div>
                  <div class="font-mono-accent text-lg font-bold text-ink-black mt-0.5">
                    {{ formatNumber(userData.sessionStats?.total ?? 0) }}
                  </div>
                </div>

                <div class="bg-paper-white p-2.5 border border-stone">
                  <div class="text-[9px] font-semibold uppercase tracking-wider text-slate">
                    BERHASIL
                  </div>
                  <div class="font-mono-accent text-lg font-bold text-emerald-600 mt-0.5">
                    {{ formatNumber(userData.sessionStats?.successful ?? 0) }}
                  </div>
                </div>

                <div class="bg-paper-white p-2.5 border border-stone">
                  <div class="text-[9px] font-semibold uppercase tracking-wider text-slate">
                    GAGAL
                  </div>
                  <div class="font-mono-accent text-lg font-bold text-rose-600 mt-0.5">
                    {{ formatNumber(userData.sessionStats?.failed ?? 0) }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 2. Role Information Section (Single Admin Policy) -->
            <div class="bg-paper-white border border-stone p-5 rounded-none space-y-3">
              <div class="flex items-center justify-between">
                <div class="text-xs font-bold uppercase tracking-wider text-ink-black flex items-center gap-2">
                  <Shield class="w-4 h-4 text-slate" />
                  <span>PERAN PENGGUNA</span>
                </div>
                <span class="badge-pill-stamp px-2.5 py-0.5 text-[10px] font-mono-accent font-semibold rounded-full bg-bone text-ink-black border border-stone uppercase">
                  {{ userData.role === 'ADMIN' ? 'System Administrator' : 'Audio Engineer' }}
                </span>
              </div>

              <p class="text-xs text-slate leading-relaxed">
                Platform beroperasi di bawah kebijakan administrator tunggal. Penugasan peran dikunci secara permanen dan tidak dapat dimodifikasi demi kepatuhan audit keamanan.
              </p>
            </div>

            <!-- 3. Account Status & Suspension Section -->
            <div class="bg-paper-white border border-stone p-5 rounded-none space-y-3">
              <div class="flex items-center justify-between">
                <div class="text-xs font-bold uppercase tracking-wider text-ink-black flex items-center gap-2">
                  <Ban class="w-4 h-4 text-slate" />
                  <span>STATUS AKUN &amp; PENANGGUHAN</span>
                </div>

                <!-- Status Badge -->
                <span 
                  v-if="userData.status === 'ACTIVE'"
                  class="badge-pill-stamp inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  ACTIVE
                </span>
                <span 
                  v-else
                  class="badge-pill-stamp inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-rose-50 text-rose-800 border border-rose-300">
                  <span class="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                  SUSPENDED
                </span>
              </div>

              <!-- Suspended Details Callout -->
              <div v-if="userData.status === 'SUSPENDED'" class="p-3 bg-rose-50 border border-rose-200 text-rose-950 text-xs rounded-none">
                <div class="font-semibold uppercase tracking-wider text-[10px] text-rose-800 mb-1">
                  Catatan Alasan Penangguhan:
                </div>
                <div class="font-mono-accent">
                  {{ userData.statusReason || 'Tidak ada catatan alasan yang disertakan.' }}
                </div>
              </div>

              <p class="text-xs text-slate">
                Penangguhan akan mencabut semua sesi token aktif dan mencegah pengguna masuk atau memproses audio.
              </p>

              <div v-if="isSelf && userData.status === 'ACTIVE'" class="p-2.5 bg-bone border border-stone text-xs text-slate font-mono-accent">
                Perlindungan Akun: Anda tidak dapat menangguhkan akun Anda sendiri.
              </div>

              <div class="pt-1 flex items-center gap-3">
                <!-- If Active: Suspend Button -->
                <button 
                  v-if="userData.status === 'ACTIVE'"
                  @click="openSuspendModal" 
                  :disabled="isSelf || statusLoading"
                  class="btn-bone-secondary border border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-600 px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  TANGGUHKAN AKUN
                </button>

                <!-- If Suspended: Reactivate Button -->
                <button 
                  v-else
                  @click="reactivateAccount" 
                  :disabled="statusLoading"
                  class="btn-ink-stamp px-4 py-2 text-xs font-bold border border-black cursor-pointer disabled:opacity-40 flex items-center gap-1.5">
                  <RotateCw v-if="statusLoading" class="w-3.5 h-3.5 animate-spin" />
                  <span>AKTIFKAN KEMBALI AKUN</span>
                </button>
              </div>
            </div>

            <!-- 4. Token Adjustment Section -->
            <div class="bg-paper-white border border-stone p-5 rounded-none space-y-4">
              <div class="flex items-center justify-between">
                <div class="text-xs font-bold uppercase tracking-wider text-ink-black flex items-center gap-2">
                  <Wallet class="w-4 h-4 text-slate" />
                  <span>PENYESUAIAN SALDO TOKEN</span>
                </div>
                <span class="font-mono-accent text-xs font-bold text-ink-black">
                  Saldo: {{ formatNumber(userData.wallet?.balance ?? 0) }}
                </span>
              </div>

              <div class="space-y-3">
                <!-- Adjustment Type Selector -->
                <div>
                  <label class="block text-[10px] font-semibold uppercase tracking-wider text-slate mb-1">
                    Tipe Mutasi
                  </label>
                  <div class="grid grid-cols-3 gap-2">
                    <button 
                      type="button" 
                      @click="tokenType = 'TOPUP'" 
                      :class="tokenType === 'TOPUP' ? 'bg-black text-white border-black font-bold' : 'bg-bone text-ink-black border-stone hover:border-black'" 
                      class="px-2.5 py-1.5 text-xs border rounded-none text-center cursor-pointer transition-colors">
                      Topup (+)
                    </button>
                    <button 
                      type="button" 
                      @click="tokenType = 'REFUND'" 
                      :class="tokenType === 'REFUND' ? 'bg-black text-white border-black font-bold' : 'bg-bone text-ink-black border-stone hover:border-black'" 
                      class="px-2.5 py-1.5 text-xs border rounded-none text-center cursor-pointer transition-colors">
                      Refund (+)
                    </button>
                    <button 
                      type="button" 
                      @click="tokenType = 'DEDUCTION'" 
                      :class="tokenType === 'DEDUCTION' ? 'bg-black text-white border-black font-bold' : 'bg-bone text-ink-black border-stone hover:border-black'" 
                      class="px-2.5 py-1.5 text-xs border rounded-none text-center cursor-pointer transition-colors">
                      Deduct (-)
                    </button>
                  </div>
                </div>

                <!-- Amount Input -->
                <div>
                  <label class="block text-[10px] font-semibold uppercase tracking-wider text-slate mb-1">
                    Jumlah Token
                  </label>
                  <input 
                    v-model.number="tokenAmount" 
                    type="number" 
                    min="1" 
                    step="1"
                    class="w-full px-3 py-2 text-xs font-mono-accent text-ink-black bg-paper-white border border-stone rounded-none focus:outline-none focus:border-ink-black"
                  />
                </div>

                <!-- Reason Input -->
                <div>
                  <label class="block text-[10px] font-semibold uppercase tracking-wider text-slate mb-1">
                    Alasan Penyesuaian (Wajib, Min. 5 Karakter)
                  </label>
                  <textarea 
                    v-model="tokenDescription" 
                    rows="2" 
                    placeholder="Contoh: Kompensasi gangguan pemrosesan multitrack sesi #312"
                    class="w-full px-3 py-2 text-xs text-ink-black bg-paper-white border border-stone rounded-none focus:outline-none focus:border-ink-black placeholder:text-slate"
                  ></textarea>
                </div>

                <!-- Balance Projection Strip -->
                <div class="p-3 bg-bone border border-stone text-xs flex items-center justify-between">
                  <span class="text-slate font-medium">Proyeksi Perubahan Saldo:</span>
                  <span 
                    class="font-mono-accent font-bold" 
                    :class="projectedBalance < 0 ? 'text-rose-600' : 'text-ink-black'">
                    {{ formatNumber(userData.wallet?.balance ?? 0) }} &rarr; {{ formatNumber(projectedBalance) }} Token
                  </span>
                </div>

                <div v-if="tokenType === 'DEDUCTION' && (userData.wallet?.balance ?? 0) < tokenAmount" class="text-xs text-rose-600 font-mono-accent">
                  Peringatan: Saldo saat ini tidak mencukupi untuk pemotongan sejumlah ini.
                </div>

                <!-- Submit Button -->
                <button 
                  @click="adjustTokens" 
                  :disabled="tokenLoading || !tokenAmount || tokenAmount <= 0 || !tokenDescription || tokenDescription.trim().length < 5 || (tokenType === 'DEDUCTION' && (userData.wallet?.balance ?? 0) < tokenAmount)"
                  class="w-full btn-ink-stamp py-2.5 text-xs font-bold border border-black cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  <RotateCw v-if="tokenLoading" class="w-3.5 h-3.5 animate-spin" />
                  <span>TERAPKAN PENYESUAIAN TOKEN</span>
                </button>
              </div>
            </div>

            <!-- 5. Transaction Ledger List -->
            <div class="bg-paper-white border border-stone p-5 rounded-none space-y-3">
              <div class="flex items-center justify-between">
                <div class="text-xs font-bold uppercase tracking-wider text-ink-black flex items-center gap-2">
                  <Layers class="w-4 h-4 text-slate" />
                  <span>BUKU BESAR TRANSAKSI (20 TERAKHIR)</span>
                </div>
                <span class="font-mono-accent text-[11px] text-slate">
                  {{ (userData.transactions || []).length }} Mutasi
                </span>
              </div>

              <!-- Scrollable Ledger -->
              <div class="max-h-64 overflow-y-auto border border-stone bg-paper-white divide-y divide-stone">
                <div v-if="!userData.transactions || userData.transactions.length === 0" class="p-8 text-center text-slate font-mono-accent text-xs">
                  Belum ada catatan riwayat transaksi untuk akun ini.
                </div>

                <div 
                  v-for="tx in userData.transactions" 
                  :key="tx.id" 
                  class="p-3 hover:bg-bone/40 transition-colors space-y-1">
                  
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <!-- Badge Type -->
                      <span 
                        v-if="tx.type === 'TOPUP'"
                        class="badge-pill-stamp px-2 py-0.5 text-[9px] rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                        TOPUP
                      </span>
                      <span 
                        v-else-if="tx.type === 'REFUND'"
                        class="badge-pill-stamp px-2 py-0.5 text-[9px] rounded-full bg-sky-50 text-sky-800 border border-sky-300">
                        REFUND
                      </span>
                      <span 
                        v-else-if="tx.type === 'DEDUCTION'"
                        class="badge-pill-stamp px-2 py-0.5 text-[9px] rounded-full bg-rose-50 text-rose-800 border border-rose-300">
                        DEDUCT
                      </span>
                      <span 
                        v-else
                        class="badge-pill-stamp px-2 py-0.5 text-[9px] rounded-full bg-purple-50 text-purple-800 border border-purple-300">
                        {{ tx.type }}
                      </span>

                      <!-- Reference ID -->
                      <span v-if="tx.referenceId" class="font-mono-accent text-[10px] text-slate bg-bone px-1.5 py-0.2 border border-stone truncate max-w-[140px]">
                        {{ tx.referenceId }}
                      </span>
                    </div>

                    <!-- Amount -->
                    <span 
                      class="font-mono-accent font-bold text-xs" 
                      :class="tx.type === 'DEDUCTION' || tx.amount < 0 ? 'text-rose-600' : 'text-emerald-600'">
                      {{ tx.type === 'DEDUCTION' || tx.amount < 0 ? '-' : '+' }}{{ formatNumber(Math.abs(tx.amount)) }} Token
                    </span>
                  </div>

                  <!-- Description -->
                  <div class="text-xs text-ink-black leading-snug">
                    {{ tx.description || 'Tidak ada deskripsi transaksi.' }}
                  </div>

                  <!-- Timestamp -->
                  <div class="font-mono-accent text-[10px] text-slate">
                    {{ formatTimestamp(tx.createdAt) }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 6. Security Actions -->
            <div class="bg-paper-white border border-stone p-5 rounded-none space-y-3">
              <div class="text-xs font-bold uppercase tracking-wider text-ink-black flex items-center gap-2">
                <LogOut class="w-4 h-4 text-slate" />
                <span>TINDAKAN KEAMANAN SESI</span>
              </div>

              <p class="text-xs text-slate">
                Cabut paksa semua token otentikasi aktif untuk akun ini. Pengguna akan segera dikeluarkan dari sesi login yang sedang berlangsung.
              </p>

              <button 
                @click="showRevokeModal = true" 
                :disabled="revokeLoading"
                class="btn-bone-secondary border border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-600 px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-40 transition-colors">
                CABUT SEMUA SESI AKTIF
              </button>
            </div>
          </template>
        </div>

        <!-- Drawer Footer -->
        <div class="sticky bottom-0 bg-bone border-t border-stone px-6 py-3 flex items-center justify-between text-xs text-slate font-mono-accent">
          <span>ID Pengguna: {{ userData?.id ? userData.id.slice(0, 13) + '...' : '-' }}</span>
          <button 
            @click="emit('close')" 
            class="btn-bone-secondary border border-stone px-3 py-1.5 text-xs font-semibold hover:border-black cursor-pointer">
            Tutup
          </button>
        </div>
      </aside>
    </div>

    <!-- Modal Konfirmasi Penangguhan Akun -->
    <div 
      v-if="showSuspendModal" 
      class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 overflow-y-auto"
      @click="showSuspendModal = false">
      <div 
        class="bg-paper-white border-2 border-black rounded-none p-6 sm:p-7 max-w-md w-full relative my-auto shadow-2xl space-y-4 font-editorial selection:bg-hot-pink selection:text-ink-black"
        @click.stop>
        
        <div class="flex items-center justify-between pb-3 border-b border-stone">
          <div class="flex items-center gap-2">
            <Ban class="w-5 h-5 text-rose-600" />
            <h3 class="font-editorial font-bold text-base text-ink-black">
              TANGGUHKAN AKUN PENGGUNA
            </h3>
          </div>
          <button 
            @click="showSuspendModal = false" 
            class="text-slate hover:text-ink-black p-1 cursor-pointer">
            <X class="w-4 h-4" />
          </button>
        </div>

        <p class="text-xs text-slate leading-relaxed">
          Apakah Anda yakin ingin menangguhkan akun <strong class="text-ink-black">{{ userData?.name }}</strong>? Pengguna tidak akan dapat mengakses workstation audio atau bertransaksi token hingga akun diaktifkan kembali.
        </p>

        <div>
          <label class="block text-[10px] font-semibold uppercase tracking-wider text-slate mb-1">
            Alasan Penangguhan (Opsional / Dicatat dalam Sistem):
          </label>
          <textarea 
            v-model="suspendReason" 
            rows="3" 
            placeholder="Tuliskan alasan penangguhan untuk referensi audit dan dukungan pelanggan..."
            class="w-full px-3 py-2 text-xs text-ink-black bg-paper-white border border-stone rounded-none focus:outline-none focus:border-ink-black placeholder:text-slate"
          ></textarea>
        </div>

        <div class="pt-2 flex items-center justify-end gap-2">
          <button 
            @click="showSuspendModal = false" 
            :disabled="statusLoading"
            class="btn-bone-secondary border border-stone px-4 py-2 text-xs font-semibold cursor-pointer">
            Batal
          </button>
          <button 
            @click="confirmSuspend" 
            :disabled="statusLoading"
            class="btn-ink-stamp bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs font-bold border border-rose-700 cursor-pointer disabled:opacity-40 flex items-center gap-1.5">
            <RotateCw v-if="statusLoading" class="w-3.5 h-3.5 animate-spin" />
            <span>KONFIRMASI PENANGGUHAN</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Konfirmasi Cabut Sesi Aktif -->
    <div 
      v-if="showRevokeModal" 
      class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 overflow-y-auto"
      @click="showRevokeModal = false">
      <div 
        class="bg-paper-white border-2 border-black rounded-none p-6 sm:p-7 max-w-md w-full relative my-auto shadow-2xl space-y-4 font-editorial selection:bg-hot-pink selection:text-ink-black"
        @click.stop>
        
        <div class="flex items-center justify-between pb-3 border-b border-stone">
          <div class="flex items-center gap-2">
            <LogOut class="w-5 h-5 text-rose-600" />
            <h3 class="font-editorial font-bold text-base text-ink-black">
              CABUT SELURUH SESI AKTIF
            </h3>
          </div>
          <button 
            @click="showRevokeModal = false" 
            class="text-slate hover:text-ink-black p-1 cursor-pointer">
            <X class="w-4 h-4" />
          </button>
        </div>

        <p class="text-xs text-slate leading-relaxed">
          Tindakan ini akan membatalkan seluruh token otentikasi JWT aktif untuk pengguna <strong class="text-ink-black">{{ userData?.name }}</strong>. Pengguna akan segera logout dari seluruh perangkat browser yang sedang aktif.
        </p>

        <div class="pt-2 flex items-center justify-end gap-2">
          <button 
            @click="showRevokeModal = false" 
            :disabled="revokeLoading"
            class="btn-bone-secondary border border-stone px-4 py-2 text-xs font-semibold cursor-pointer">
            Batal
          </button>
          <button 
            @click="confirmRevokeSessions" 
            :disabled="revokeLoading"
            class="btn-ink-stamp bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs font-bold border border-rose-700 cursor-pointer disabled:opacity-40 flex items-center gap-1.5">
            <RotateCw v-if="revokeLoading" class="w-3.5 h-3.5 animate-spin" />
            <span>CABUT SEMUA SESI</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
