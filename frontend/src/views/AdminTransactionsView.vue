<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import axios from 'axios'
import AppNavbar from '../components/AppNavbar.vue'
import UserSupportDrawer from '../components/admin/UserSupportDrawer.vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

// State
const transactions = ref([])
const metrics = ref({
  totalInCirculation: 0,
  totalPurchased: 0,
  totalBurned: 0,
  totalGrants: 0
})
const pagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1
})
const loading = ref(false)
const error = ref('')

// Filters
const searchQuery = ref('')
const selectedType = ref('ALL')
const currentPage = ref(1)

// User Support Drawer Bridge
const selectedUserId = ref(null)
const isDrawerOpen = ref(false)

let searchTimeout = null

onBeforeUnmount(() => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
})

const typeFilterOptions = [
  { id: 'ALL', label: 'Semua' },
  { id: 'TOPUP', label: 'TOPUP' },
  { id: 'DEDUCTION', label: 'DEDUCTION' },
  { id: 'WELCOME_GRANT', label: 'WELCOME_GRANT' },
  { id: 'REFUND', label: 'REFUND' }
]

async function fetchTransactions() {
  loading.value = true
  error.value = ''
  try {
    const params = {
      page: currentPage.value,
      limit: 20
    }
    if (searchQuery.value && searchQuery.value.trim()) {
      params.q = searchQuery.value.trim()
    }
    if (selectedType.value && selectedType.value !== 'ALL') {
      params.type = selectedType.value
    }

    const res = await axios.get('/api/v1/admin/transactions', { params })
    transactions.value = res.data.transactions || []
    pagination.value = res.data.pagination || {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1
    }
    metrics.value = res.data.metrics || {
      totalInCirculation: 0,
      totalPurchased: 0,
      totalBurned: 0,
      totalGrants: 0
    }
  } catch (err) {
    console.error('Failed to fetch admin transactions:', err)
    error.value = err.response?.data?.error || 'Gagal memuat rekam jejak transaksi token'
  } finally {
    loading.value = false
  }
}

// Watchers
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    fetchTransactions()
  }, 300)
})

watch(selectedType, () => {
  currentPage.value = 1
  fetchTransactions()
})

watch(currentPage, () => {
  fetchTransactions()
})

function goToPage(page) {
  if (page >= 1 && page <= pagination.value.totalPages) {
    currentPage.value = page
  }
}

function selectType(typeId) {
  selectedType.value = typeId
}

function openUserDrawer(userId) {
  if (!userId) return
  selectedUserId.value = userId
  isDrawerOpen.value = true
}

function handleUserUpdated() {
  fetchTransactions()
}

function formatNumber(val) {
  return new Intl.NumberFormat('id-ID').format(val || 0)
}

function formatDateTime(isoStr) {
  if (!isoStr) return '-'
  try {
    const d = new Date(isoStr)
    const dateStr = d.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
    const timeStr = d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    return `${dateStr}, ${timeStr}`
  } catch {
    return isoStr
  }
}

function getTypeBadgeStyle(type) {
  switch (type) {
    case 'TOPUP':
      return {
        badge: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        dot: 'bg-emerald-600',
        label: 'Top-Up'
      }
    case 'DEDUCTION':
      return {
        badge: 'bg-rose-50 text-rose-800 border-rose-300',
        dot: 'bg-rose-600',
        label: 'Deduction'
      }
    case 'WELCOME_GRANT':
      return {
        badge: 'bg-amber-50 text-amber-800 border-amber-300',
        dot: 'bg-amber-600',
        label: 'Welcome Grant'
      }
    case 'REFUND':
      return {
        badge: 'bg-sky-50 text-sky-800 border-sky-300',
        dot: 'bg-sky-600',
        label: 'Refund'
      }
    default:
      return {
        badge: 'bg-bone text-ink-black border-stone',
        dot: 'bg-slate',
        label: type || '-'
      }
  }
}

onMounted(() => {
  fetchTransactions()
})
</script>

<template>
  <div class="min-h-screen bg-bone text-ink-black flex flex-col selection:bg-hot-pink selection:text-ink-black font-editorial">
    <AppNavbar :fluid="true" />

    <main class="flex-1 w-full max-w-[1800px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-6 md:py-8 space-y-6">

      <!-- Error Toast Notification -->
      <div 
        v-if="error" 
        role="alert" 
        class="p-4 border border-rose-300 bg-rose-50 text-rose-950 flex items-center justify-between gap-3 text-xs font-mono-accent rounded-none">
        <div class="flex items-center gap-2.5">
          <svg class="w-4 h-4 text-rose-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{{ error }}</span>
        </div>
        <button 
          @click="error = ''" 
          class="text-rose-700 hover:text-rose-950 p-1 transition-colors cursor-pointer"
          aria-label="Tutup notifikasi">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Header Section -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-2 px-1">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="text-[10px] font-bold uppercase tracking-[0.2em] text-slate bg-paper-white px-2 py-0.5 border border-stone">
              System Administration
            </span>
          </div>
          <h1 class="font-editorial font-bold text-2xl tracking-tight text-ink-black">
            Audit Transaksi Token
          </h1>
          <p class="text-xs text-slate mt-0.5">
            Rekam jejak mutasi token dan peredaran kredit platform real-time.
          </p>
        </div>

        <button 
          @click="fetchTransactions" 
          :disabled="loading"
          class="btn-bone-secondary border border-stone h-10 px-4 text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50 hover:border-ink-black transition-colors">
          <svg class="w-4 h-4 text-ink-black" :class="{ 'animate-spin': loading }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{{ loading ? 'Memperbarui...' : 'Segarkan Data' }}</span>
        </button>
      </div>

      <!-- Sub-navigation Tabs -->
      <div class="flex items-center gap-6 border-b border-stone">
        <router-link 
          to="/admin/users" 
          class="pb-3 text-sm font-medium text-slate hover:text-ink-black transition-colors">
          Pengguna
        </router-link>
        <router-link 
          to="/admin/transactions" 
          class="pb-3 text-sm font-semibold text-ink-black border-b-2 border-black -mb-px">
          Audit Transaksi
        </router-link>
      </div>

      <!-- Macro Metric Cards Ribbon (Grid of 4) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- 1. Total Beredar -->
        <div class="bg-paper-white border border-stone p-5 rounded-none flex flex-col justify-between">
          <div>
            <div class="text-[10px] font-semibold uppercase tracking-wider text-slate mb-1.5 flex items-center justify-between">
              <span>TOTAL BEREDAR</span>
              <span class="inline-block w-2 h-2 rounded-full bg-[#20AFFF]"></span>
            </div>
            <div class="font-mono-accent text-2xl font-bold text-ink-black tracking-tight">
              {{ formatNumber(metrics.totalInCirculation) }}
              <span class="text-xs font-semibold text-slate font-sans ml-1">Token</span>
            </div>
          </div>
          <div class="text-[11px] text-slate mt-2 font-mono-accent">
            Saldo dompet aktif seluruh engineer
          </div>
        </div>

        <!-- 2. Total Pembelian (Top-Up) -->
        <div class="bg-paper-white border border-stone p-5 rounded-none flex flex-col justify-between">
          <div>
            <div class="text-[10px] font-semibold uppercase tracking-wider text-slate mb-1.5 flex items-center justify-between">
              <span>TOTAL PEMBELIAN</span>
              <span class="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>
            <div class="font-mono-accent text-2xl font-bold text-ink-black tracking-tight">
              {{ formatNumber(metrics.totalPurchased) }}
              <span class="text-xs font-semibold text-slate font-sans ml-1">Token</span>
            </div>
          </div>
          <div class="text-[11px] text-slate mt-2 font-mono-accent">
            Akumulasi top-up via Midtrans &amp; Admin
          </div>
        </div>

        <!-- 3. Total Konsumsi DSP -->
        <div class="bg-paper-white border border-stone p-5 rounded-none flex flex-col justify-between">
          <div>
            <div class="text-[10px] font-semibold uppercase tracking-wider text-slate mb-1.5 flex items-center justify-between">
              <span>TOTAL KONSUMSI DSP</span>
              <span class="inline-block w-2 h-2 rounded-full bg-rose-500"></span>
            </div>
            <div class="font-mono-accent text-2xl font-bold text-ink-black tracking-tight">
              {{ formatNumber(metrics.totalBurned) }}
              <span class="text-xs font-semibold text-slate font-sans ml-1">Token</span>
            </div>
          </div>
          <div class="text-[11px] text-slate mt-2 font-mono-accent">
            Token terpakai untuk isolasi &amp; repair stem
          </div>
        </div>

        <!-- 4. Total Hibah Gratis -->
        <div class="bg-paper-white border border-stone p-5 rounded-none flex flex-col justify-between">
          <div>
            <div class="text-[10px] font-semibold uppercase tracking-wider text-slate mb-1.5 flex items-center justify-between">
              <span>TOTAL HIBAH GRATIS</span>
              <span class="inline-block w-2 h-2 rounded-full bg-[#FF82C2]"></span>
            </div>
            <div class="font-mono-accent text-2xl font-bold text-ink-black tracking-tight">
              {{ formatNumber(metrics.totalGrants) }}
              <span class="text-xs font-semibold text-slate font-sans ml-1">Token</span>
            </div>
          </div>
          <div class="text-[11px] text-slate mt-2 font-mono-accent">
            Bonus sambutan pendaftaran akun engineer
          </div>
        </div>
      </div>

      <!-- Search & Filter Controls Strip -->
      <div class="bg-paper-white border border-stone p-4 rounded-none flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        <!-- Search Input -->
        <div class="relative flex-1">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="w-4 h-4 text-slate" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Cari nama, email, deskripsi, ID order/sesi..." 
            class="w-full pl-9 pr-9 py-2 text-xs text-ink-black bg-paper-white border border-stone rounded-none focus:outline-none focus:border-ink-black focus:ring-1 focus:ring-ink-black placeholder:text-slate"
          />
          <button 
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate hover:text-ink-black cursor-pointer"
            aria-label="Bersihkan pencarian">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Type Filter Tabs/Pills -->
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-slate mr-1">
            Filter Tipe:
          </span>
          <button 
            v-for="opt in typeFilterOptions" 
            :key="opt.id"
            @click="selectType(opt.id)"
            :class="selectedType === opt.id 
              ? 'bg-ink-black text-white border-ink-black font-bold' 
              : 'bg-paper-white text-slate border-stone hover:text-ink-black hover:border-slate font-medium'"
            class="px-3 py-1.5 text-xs rounded-none border transition-colors cursor-pointer">
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- Transactions Ledger Table -->
      <div class="border border-stone bg-paper-white rounded-none overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-bone border-b border-stone text-[11px] font-semibold uppercase tracking-wider text-slate">
                <th class="py-3 px-4">WAKTU</th>
                <th class="py-3 px-4">PENGGUNA</th>
                <th class="py-3 px-4">TIPE</th>
                <th class="py-3 px-4">JUMLAH</th>
                <th class="py-3 px-4">KETERANGAN</th>
                <th class="py-3 px-4">REFERENSI</th>
                <th class="py-3 px-4 text-right">AKSI</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone bg-paper-white text-xs">
              <!-- Loading Skeleton -->
              <tr v-if="loading && transactions.length === 0">
                <td colspan="7" class="py-12 text-center text-slate font-mono-accent text-xs">
                  Memuat rekam jejak transaksi...
                </td>
              </tr>

              <!-- Empty State -->
              <tr v-else-if="transactions.length === 0">
                <td colspan="7" class="py-12 text-center text-slate font-mono-accent text-xs">
                  Tidak ada transaksi yang cocok dengan kriteria pencarian.
                </td>
              </tr>

              <!-- Transaction Rows -->
              <tr 
                v-for="tx in transactions" 
                :key="tx.id" 
                class="hover:bg-bone/40 transition-colors">
                <!-- WAKTU -->
                <td class="py-3.5 px-4 whitespace-nowrap font-mono-accent text-xs text-[#60605e]">
                  {{ formatDateTime(tx.createdAt) }}
                </td>

                <!-- PENGGUNA -->
                <td class="py-3.5 px-4">
                  <template v-if="tx.user">
                    <button 
                      @click="openUserDrawer(tx.user.id)"
                      class="text-left group cursor-pointer focus:outline-none">
                      <div class="font-semibold text-ink-black group-hover:underline leading-tight">
                        {{ tx.user.name }}
                      </div>
                      <div class="font-mono-accent text-[11px] text-slate mt-0.5">
                        {{ tx.user.email }}
                      </div>
                    </button>
                  </template>
                  <template v-else>
                    <span class="text-slate italic text-[11px] font-mono-accent">
                      Pengguna Tidak Tersedia
                    </span>
                  </template>
                </td>

                <!-- TIPE -->
                <td class="py-3.5 px-4 whitespace-nowrap">
                  <span 
                    :class="getTypeBadgeStyle(tx.type).badge"
                    class="badge-pill-stamp inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border">
                    <span :class="getTypeBadgeStyle(tx.type).dot" class="w-1.5 h-1.5 rounded-full"></span>
                    {{ getTypeBadgeStyle(tx.type).label }}
                  </span>
                </td>

                <!-- JUMLAH -->
                <td class="py-3.5 px-4 whitespace-nowrap">
                  <span 
                    :class="{
                      'text-emerald-700': tx.amount > 0,
                      'text-rose-700': tx.amount < 0,
                      'text-slate': tx.amount === 0
                    }"
                    class="font-mono-accent font-bold text-sm">
                    {{ tx.amount > 0 ? `+${formatNumber(tx.amount)}` : formatNumber(tx.amount) }}
                  </span>
                  <span class="font-mono-accent text-[11px] text-slate ml-1">Token</span>
                </td>

                <!-- KETERANGAN -->
                <td class="py-3.5 px-4 text-ink-black text-xs max-w-xs break-words">
                  {{ tx.description || '-' }}
                </td>

                <!-- REFERENSI -->
                <td class="py-3.5 px-4 whitespace-nowrap">
                  <span 
                    v-if="tx.referenceId"
                    :title="tx.referenceId"
                    class="font-mono-accent text-xs text-[#60605e] bg-bone px-2 py-0.5 border border-stone inline-block max-w-[160px] truncate">
                    {{ tx.referenceId }}
                  </span>
                  <span v-else class="text-slate font-mono-accent text-xs">-</span>
                </td>

                <!-- AKSI -->
                <td class="py-3.5 px-4 text-right whitespace-nowrap">
                  <button 
                    v-if="tx.user"
                    @click="openUserDrawer(tx.user.id)" 
                    class="btn-bone-secondary border border-stone px-3 py-1.5 text-xs font-semibold hover:border-ink-black transition-colors cursor-pointer">
                    Detail Pengguna
                  </button>
                  <span v-else class="text-slate font-mono-accent text-xs">-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination Controls Footer -->
        <div class="bg-bone border-t border-stone px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div class="font-mono-accent text-slate text-[11px]">
            Menampilkan <span class="font-semibold text-ink-black">{{ transactions.length }}</span> dari <span class="font-semibold text-ink-black">{{ formatNumber(pagination.total) }}</span> mutasi
          </div>

          <div class="flex items-center gap-3">
            <span class="font-mono-accent text-slate text-[11px]">
              Halaman {{ pagination.page }} dari {{ pagination.totalPages }}
            </span>

            <div class="flex items-center gap-1.5">
              <button 
                @click="goToPage(currentPage - 1)" 
                :disabled="currentPage <= 1 || loading"
                class="btn-bone-secondary border border-stone px-3 py-1.5 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:border-ink-black transition-colors cursor-pointer">
                Sebelumnya
              </button>
              <button 
                @click="goToPage(currentPage + 1)" 
                :disabled="currentPage >= pagination.totalPages || loading"
                class="btn-bone-secondary border border-stone px-3 py-1.5 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:border-ink-black transition-colors cursor-pointer">
                Berikutnya
              </button>
            </div>
          </div>
        </div>
      </div>

    </main>

    <!-- User Support Drawer -->
    <UserSupportDrawer 
      :user-id="selectedUserId" 
      :is-open="isDrawerOpen" 
      @close="isDrawerOpen = false" 
      @user-updated="handleUserUpdated" 
    />
  </div>
</template>
