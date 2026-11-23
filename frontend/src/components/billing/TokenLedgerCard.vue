<script setup>
import { ref, computed } from 'vue'
import {
  History,
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  Sparkles,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-vue-next'

const props = defineProps({
  transactions: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['refresh'])

const activeFilter = ref('all') // 'all' | 'credit' | 'debit'
const showAll = ref(false)
const INITIAL_VISIBLE = 6

const filterTabs = [
  { id: 'all', label: 'Semua' },
  { id: 'credit', label: 'Token Masuk' },
  { id: 'debit', label: 'Pemakaian' }
]

const filteredTransactions = computed(() => {
  const list = Array.isArray(props.transactions) ? props.transactions : []
  if (activeFilter.value === 'credit') {
    return list.filter(tx => Number(tx.amount) > 0)
  }
  if (activeFilter.value === 'debit') {
    return list.filter(tx => Number(tx.amount) < 0)
  }
  return list
})

const visibleTransactions = computed(() => {
  if (showAll.value) return filteredTransactions.value
  return filteredTransactions.value.slice(0, INITIAL_VISIBLE)
})

const hasOverflow = computed(() => filteredTransactions.value.length > INITIAL_VISIBLE)

function setFilter(filterId) {
  activeFilter.value = filterId
  showAll.value = false
}

function getTxMeta(tx) {
  const desc = tx?.description || ''
  if (tx?.type === 'TOPUP') {
    return {
      label: 'Top-Up Paket',
      badgeClass: 'bg-[#d8f3dc]',
      icon: ArrowDownLeft
    }
  }
  if (tx?.type === 'WELCOME_GRANT') {
    if (desc.includes('Klaim Harian') || desc === 'DAILY_FREE_CLAIM') {
      return {
        label: 'Klaim Harian',
        badgeClass: 'bg-[#fff099]',
        icon: Gift
      }
    }
    return {
      label: 'Bonus Selamat Datang',
      badgeClass: 'bg-[#87d7ff]',
      icon: Sparkles
    }
  }
  if (tx?.type === 'REFUND') {
    return {
      label: 'Pengembalian Token',
      badgeClass: 'bg-[#fff099]',
      icon: RotateCcw
    }
  }
  return {
    label: 'Pemrosesan Sesi',
    badgeClass: 'bg-[#ffcae6]',
    icon: ArrowUpRight
  }
}

function cleanDescription(tx) {
  const raw = (tx?.description || '').trim()
  if (!raw || raw === 'DAILY_FREE_CLAIM') {
    return getTxMeta(tx).label
  }
  return raw.replace(/^\[Klaim Harian\]\s*/i, '')
}

function formatDateTime(isoDate) {
  if (!isoDate) return '-'
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}
</script>

<template>
  <section
    aria-labelledby="ledger-heading"
    class="rounded-[18px] border-2 border-[#111111] bg-white/95 backdrop-blur-md shadow-[3px_4px_0_#111111] p-5 sm:p-6 space-y-4"
  >
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-[#111111]/10">
      <div class="flex items-center gap-2.5">
        <span class="w-8 h-8 rounded-[10px] border-[1.5px] border-[#111111] bg-[#f5f3eb] shadow-[1px_1.5px_0_#111111] flex items-center justify-center shrink-0">
          <History class="w-4 h-4 text-[#111111]" :stroke-width="2.2" />
        </span>
        <h2
          id="ledger-heading"
          class="font-editorial font-bold text-lg sm:text-xl text-[#111111] tracking-tight"
        >
          Riwayat Mutasi Token
        </h2>
      </div>

      <div class="flex items-center gap-2">
        <span class="inline-flex items-center rounded-full border-[1.5px] border-[#111111] bg-[#f5f3eb] shadow-[1px_1.5px_0_#111111] px-2.5 py-1 text-[11px] font-bold text-[#111111] leading-none tabular-nums">
          {{ filteredTransactions.length }} Mutasi
        </span>
        <button
          type="button"
          @click="emit('refresh')"
          :disabled="loading"
          class="btn-keycap btn-keycap-mini btn-keycap-white px-3 py-1.5 text-xs"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" :stroke-width="2.2" />
          <span>Segarkan</span>
        </button>
      </div>
    </div>

    <!-- Filter Tabs -->
    <div
      role="tablist"
      aria-label="Filter tipe mutasi token"
      class="flex flex-wrap items-center gap-2"
    >
      <button
        v-for="tab in filterTabs"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="activeFilter === tab.id"
        @click="setFilter(tab.id)"
        :class="activeFilter === tab.id
          ? 'bg-[#111111] text-white border-[#111111]'
          : 'bg-[#fcfcfb] text-[#60605e] border-[#111111]/25 hover:border-[#111111] hover:text-[#111111]'"
        class="rounded-full border-[1.5px] px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#111111] focus-visible:outline-offset-2"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Loading Skeleton -->
    <div
      v-if="loading && !transactions.length"
      aria-busy="true"
      aria-label="Memuat riwayat mutasi token"
      class="space-y-2.5 pt-1"
    >
      <div v-for="i in 4" :key="i" class="h-14 rounded-[12px] bg-[#eaeef4] animate-pulse border border-[#111111]/10" />
    </div>

    <!-- Error State -->
    <div
      v-else-if="error && !transactions.length"
      role="alert"
      class="rounded-[14px] border-[1.5px] border-[#111111] bg-[#fff5f7] p-6 text-center space-y-3"
    >
      <AlertTriangle class="w-5 h-5 text-rose-700 mx-auto" :stroke-width="2.2" />
      <div class="space-y-1">
        <p class="text-sm font-bold text-[#111111]">Gagal memuat riwayat mutasi</p>
        <p class="text-xs text-[#60605e]">{{ error }}</p>
      </div>
      <button
        type="button"
        @click="emit('refresh')"
        class="btn-keycap btn-keycap-mini btn-keycap-white px-4 py-2 text-xs"
      >
        <RefreshCw class="w-3.5 h-3.5" :stroke-width="2.2" />
        <span>Coba Lagi</span>
      </button>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="!filteredTransactions.length"
      class="rounded-[14px] border border-dashed border-[#111111]/35 bg-[#fcfcfb] p-7 text-center space-y-2"
    >
      <p class="text-sm font-bold text-[#111111]">
        {{ activeFilter === 'all' ? 'Belum ada catatan mutasi' : 'Tidak ada mutasi pada filter ini' }}
      </p>
      <p class="text-xs text-[#60605e] max-w-xs mx-auto leading-relaxed">
        {{ activeFilter === 'all'
          ? 'Gunakan tombol Klaim Token Harian atau selesaikan pembelian paket via Midtrans untuk melihat riwayat mutasi kuota.'
          : 'Pilih tab Semua untuk melihat seluruh aktivitas keluar masuk token pada akun Anda.' }}
      </p>
    </div>

    <!-- Ledger List -->
    <template v-else>
      <ul role="list" class="divide-y divide-[#111111]/10">
        <li
          v-for="tx in visibleTransactions"
          :key="tx.id"
          class="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-3"
        >
          <div class="flex items-start gap-3 min-w-0">
            <span
              :class="getTxMeta(tx).badgeClass"
              class="mt-0.5 w-8 h-8 rounded-[10px] border-[1.5px] border-[#111111] flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <component :is="getTxMeta(tx).icon" class="w-4 h-4 text-[#111111]" :stroke-width="2.2" />
            </span>

            <div class="min-w-0 space-y-0.5">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span class="text-xs font-bold text-[#111111]">
                  {{ getTxMeta(tx).label }}
                </span>
                <span class="text-[11px] text-[#60605e] tabular-nums">
                  {{ formatDateTime(tx.createdAt) }}
                </span>
              </div>
              <p class="text-xs text-[#60605e] truncate" :title="cleanDescription(tx)">
                {{ cleanDescription(tx) }}
              </p>
            </div>
          </div>

          <div
            class="text-right shrink-0 pt-0.5 tabular-nums"
            :class="Number(tx.amount) > 0 ? 'text-emerald-800' : 'text-rose-800'"
          >
            <span class="text-sm font-bold">
              {{ Number(tx.amount) > 0 ? `+${tx.amount}` : tx.amount }}
            </span>
            <span class="block text-[10px] font-semibold uppercase tracking-wide text-[#60605e]">
              Token
            </span>
          </div>
        </li>
      </ul>

      <!-- Expand / Collapse Button (without count number per user request) -->
      <div v-if="hasOverflow" class="pt-2 border-t border-[#111111]/10">
        <button
          type="button"
          @click="showAll = !showAll"
          class="w-full btn-keycap btn-keycap-mini btn-keycap-white py-2.5 px-4 text-xs"
        >
          <ChevronUp v-if="showAll" class="w-3.5 h-3.5" :stroke-width="2.3" />
          <ChevronDown v-else class="w-3.5 h-3.5" :stroke-width="2.3" />
          <span>{{ showAll ? 'Tampilkan Lebih Sedikit' : 'Tampilkan Semua' }}</span>
        </button>
      </div>
    </template>
  </section>
</template>
