<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { AlertTriangle, ArrowDownLeft, Coins, Flame, Gift, RefreshCw, Search, X } from 'lucide-vue-next'
import AppNavbar from '../components/AppNavbar.vue'
import AdminTransactionsDirectory from '../components/admin/AdminTransactionsDirectory.vue'
import UserSupportDrawer from '../components/admin/UserSupportDrawer.vue'
import { formatNumberId } from '../utils/adminFormatters'

const TYPE_FILTER_OPTIONS = [
  { id: 'ALL', label: 'Semua' },
  { id: 'TOPUP', label: 'Top-Up' },
  { id: 'DEDUCTION', label: 'Pemakaian' },
  { id: 'WELCOME_GRANT', label: 'Bonus & Klaim' },
  { id: 'REFUND', label: 'Pengembalian' }
]

const transactions = ref([])
const metrics = ref({ totalInCirculation: 0, totalPurchased: 0, totalBurned: 0, totalGrants: 0 })
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 1 })
const loading = ref(false)
const error = ref('')
const searchQuery = ref('')
const selectedType = ref('ALL')
const currentPage = ref(1)
const selectedUserId = ref(null)
const isDrawerOpen = ref(false)
let searchTimeout = null
let skipNextSearchWatch = false
let fetchRequestId = 0

const kpiCards = computed(() => [
  { key: 'circulation', label: 'Total Beredar', value: metrics.value.totalInCirculation, icon: Coins, iconBg: 'bg-[#87d7ff]' },
  { key: 'purchased', label: 'Total Pembelian', value: metrics.value.totalPurchased, icon: ArrowDownLeft, iconBg: 'bg-[#d8f3dc]' },
  { key: 'burned', label: 'Total Konsumsi DSP', value: metrics.value.totalBurned, icon: Flame, iconBg: 'bg-[#ffcae6]' },
  { key: 'grants', label: 'Hibah & Bonus', value: metrics.value.totalGrants, icon: Gift, iconBg: 'bg-[#fff099]' }
])

async function fetchTransactions() {
  const reqId = ++fetchRequestId
  loading.value = true
  error.value = ''
  try {
    const params = { page: currentPage.value, limit: 20 }
    if (searchQuery.value.trim()) params.q = searchQuery.value.trim()
    if (selectedType.value !== 'ALL') params.type = selectedType.value
    const res = await axios.get('/api/v1/admin/transactions', { params })
    if (reqId !== fetchRequestId) return
    transactions.value = res.data.transactions || []
    pagination.value = res.data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 }
    metrics.value = res.data.metrics || { totalInCirculation: 0, totalPurchased: 0, totalBurned: 0, totalGrants: 0 }
  } catch (err) {
    if (reqId !== fetchRequestId) return
    console.error('Failed to fetch admin transactions:', err)
    error.value = err.response?.data?.error || 'Gagal memuat rekam jejak transaksi token'
  } finally {
    if (reqId === fetchRequestId) loading.value = false
  }
}

watch(searchQuery, () => {
  if (skipNextSearchWatch) { skipNextSearchWatch = false; return }
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => { currentPage.value = 1; fetchTransactions() }, 300)
})

function selectType(typeId) {
  if (selectedType.value === typeId) return
  clearTimeout(searchTimeout)
  selectedType.value = typeId
  currentPage.value = 1
  fetchTransactions()
}

function goToPage(page) {
  if (page >= 1 && page <= (pagination.value.totalPages || 1) && page !== currentPage.value) {
    currentPage.value = page
    fetchTransactions()
  }
}

function clearFilters() {
  clearTimeout(searchTimeout)
  const hadSearch = searchQuery.value !== ''
  if (!hadSearch && selectedType.value === 'ALL' && currentPage.value === 1) return
  if (hadSearch) skipNextSearchWatch = true
  searchQuery.value = ''
  selectedType.value = 'ALL'
  currentPage.value = 1
  fetchTransactions()
}

function openUserDrawer(userId) {
  if (!userId) return
  selectedUserId.value = userId
  isDrawerOpen.value = true
}

onMounted(fetchTransactions)
onBeforeUnmount(() => clearTimeout(searchTimeout))
</script>

<template>
  <div class="min-h-screen notebook-paper relative overflow-x-clip text-[#111111] flex flex-col selection:bg-[#ff82c2] selection:text-[#111111] font-sans">
    <div aria-hidden="true" class="pointer-events-none fixed -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-[#20afff]/12 blur-[110px]"></div>
    <div aria-hidden="true" class="pointer-events-none fixed top-[32%] -right-28 w-[420px] h-[420px] rounded-full bg-[#ffda40]/14 blur-[120px]"></div>
    <div aria-hidden="true" class="pointer-events-none fixed -bottom-28 left-[18%] w-[380px] h-[380px] rounded-full bg-[#ff82c2]/10 blur-[120px]"></div>

    <AppNavbar :fluid="true" />

    <main class="relative z-10 flex-1 w-full max-w-[1640px] mx-auto px-4 sm:px-6 md:px-10 lg:px-12 py-7 md:py-9 space-y-6">
      <div
        v-if="error && transactions.length > 0"
        role="alert"
        class="rounded-[14px] border-[1.5px] border-rose-400 bg-rose-50/95 px-4 py-3 flex items-center justify-between gap-3 text-xs font-semibold text-rose-950 shadow-[2px_3px_0_#111111]"
      >
        <div class="flex items-center gap-2.5">
          <AlertTriangle class="w-4 h-4 text-rose-700 shrink-0" :stroke-width="2.2" />
          <span>{{ error }}</span>
        </div>
        <button type="button" @click="error = ''" class="p-1 text-rose-700 hover:text-rose-950 cursor-pointer" aria-label="Tutup notifikasi">
          <X class="w-4 h-4" :stroke-width="2.2" />
        </button>
      </div>

      <header class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
        <h1 class="font-editorial font-bold text-3xl sm:text-4xl text-[#111111] tracking-[-0.03em] leading-none">
          Audit Transaksi Token
        </h1>
        <button type="button" @click="fetchTransactions" :disabled="loading" class="btn-keycap btn-keycap-sm btn-keycap-white px-4 py-2 text-xs">
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" :stroke-width="2.2" />
          <span>{{ loading ? 'Memperbarui...' : 'Segarkan Data' }}</span>
        </button>
      </header>

      <section aria-label="Ringkasan Transaksi Token" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="card in kpiCards"
          :key="card.key"
          class="rounded-[18px] border-2 border-[#111111] bg-white/95 backdrop-blur-md shadow-[3px_4px_0_#111111] p-5 flex items-center justify-between gap-4"
        >
          <div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-[#60605e]">{{ card.label }}</div>
            <div class="mt-1.5 font-editorial font-bold text-2xl sm:text-3xl text-[#111111] tracking-tight tabular-nums leading-none">
              {{ formatNumberId(card.value) }}
              <span class="text-xs font-sans font-semibold text-[#60605e] ml-0.5">Token</span>
            </div>
          </div>
          <span :class="card.iconBg" class="w-11 h-11 rounded-[12px] border-[1.5px] border-[#111111] shadow-[1.5px_2px_0_#111111] flex items-center justify-center shrink-0">
            <component :is="card.icon" class="w-5 h-5 text-[#111111]" :stroke-width="2.2" />
          </span>
        </div>
      </section>

      <div class="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between">
        <div class="relative flex-1">
          <Search class="w-4 h-4 text-[#60605e] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" :stroke-width="2.2" />
          <input
            v-model="searchQuery"
            type="text"
            aria-label="Cari transaksi token"
            placeholder="Cari nama, email, deskripsi, ID order/sesi..."
            class="w-full h-10 pl-10 pr-10 text-xs sm:text-sm font-medium text-[#111111] bg-white border-[1.5px] border-[#111111] rounded-[12px] shadow-[1.5px_2px_0_#111111] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20afff] placeholder:text-[#60605e]/80"
          />
          <button
            v-if="searchQuery"
            type="button"
            @click="searchQuery = ''"
            aria-label="Bersihkan pencarian"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-[8px] text-[#60605e] hover:text-[#111111] cursor-pointer"
          >
            <X class="w-3.5 h-3.5" :stroke-width="2.2" />
          </button>
        </div>

        <div role="group" aria-label="Filter tipe transaksi" class="flex flex-wrap items-center gap-2">
          <button
            v-for="opt in TYPE_FILTER_OPTIONS"
            :key="opt.id"
            type="button"
            :aria-pressed="selectedType === opt.id"
            @click="selectType(opt.id)"
            :class="selectedType === opt.id ? 'bg-[#111111] text-white' : 'bg-white text-[#111111] hover:bg-[#f5f3eb]'"
            class="h-10 px-3.5 rounded-full border-[1.5px] border-[#111111] shadow-[1.5px_2px_0_#111111] text-xs font-bold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#111111] focus-visible:outline-offset-2"
          >{{ opt.label }}</button>
        </div>
      </div>

      <AdminTransactionsDirectory
        :transactions="transactions" :loading="loading" :error="error" :pagination="pagination" :current-page="currentPage"
        :has-active-filters="Boolean(searchQuery || selectedType !== 'ALL')"
        @open-user="openUserDrawer" @page-change="goToPage" @retry="fetchTransactions" @clear-filters="clearFilters"
      />
    </main>

    <UserSupportDrawer :user-id="selectedUserId" :is-open="isDrawerOpen" @close="isDrawerOpen = false" @user-updated="fetchTransactions" />
  </div>
</template>
