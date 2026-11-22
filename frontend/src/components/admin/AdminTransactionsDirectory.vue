<script setup>
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Coins, Gift, RotateCcw, RotateCw, SearchX } from 'lucide-vue-next'
import { formatDateTimeId, formatNumberId, getAdminTxMeta } from '../../utils/adminFormatters'

defineProps({
  transactions: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  pagination: { type: Object, default: () => ({ page: 1, limit: 20, total: 0, totalPages: 1 }) },
  currentPage: { type: Number, default: 1 }
})

const emit = defineEmits(['open-user', 'page-change', 'retry', 'clear-filters'])

const PILL_CLS = 'inline-flex items-center gap-1 rounded-full border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-2.5 py-0.5 text-[10px] font-bold leading-none'
const TX_ICON_MAP = { TOPUP: ArrowDownLeft, DEDUCTION: ArrowUpRight, WELCOME_GRANT: Gift, REFUND: RotateCcw }

function resolveTxIcon(type) {
  return (type && Object.hasOwn(TX_ICON_MAP, type)) ? TX_ICON_MAP[type] : Coins
}

function isDebit(tx) {
  return tx?.type === 'DEDUCTION' || Number(tx?.amount || 0) < 0
}

function amountColorClass(tx) {
  const raw = Number(tx?.amount || 0)
  if (raw === 0) return 'text-[#60605e]'
  return isDebit(tx) ? 'text-[#be123c]' : 'text-[#15803d]'
}

function formatAmount(tx) {
  const raw = Number(tx?.amount || 0)
  if (raw === 0) return '0'
  return `${isDebit(tx) ? '-' : '+'}${formatNumberId(Math.abs(raw))}`
}
</script>

<template>
  <section aria-label="Direktori Transaksi Token" class="rounded-[18px] border-2 border-[#111111] bg-white/95 backdrop-blur-md shadow-[3px_4px_0_#111111] overflow-hidden">
    <div v-if="loading && transactions.length === 0" aria-busy="true" aria-live="polite" class="p-5 space-y-3">
      <div v-for="n in 5" :key="n" class="h-14 rounded-[12px] border border-[#111111]/10 bg-[#f5f3eb] animate-pulse"></div>
    </div>

    <div v-else-if="error && transactions.length === 0" role="alert" class="px-6 py-12 text-center space-y-3">
      <div class="w-11 h-11 mx-auto rounded-[12px] border-[1.5px] border-[#111111] bg-[#ffcae6] shadow-[1.5px_2px_0_#111111] flex items-center justify-center">
        <AlertTriangle class="w-5 h-5 text-[#111111]" :stroke-width="2.2" />
      </div>
      <p class="text-sm font-bold text-[#111111]">{{ error }}</p>
      <button type="button" @click="emit('retry')" class="btn-keycap btn-keycap-sm btn-keycap-white px-4 py-2 text-xs">
        <RotateCw class="w-3.5 h-3.5" :stroke-width="2.2" />
        <span>Coba Lagi</span>
      </button>
    </div>

    <div v-else-if="transactions.length === 0" class="px-6 py-12 text-center space-y-3">
      <div class="w-11 h-11 mx-auto rounded-[12px] border-[1.5px] border-[#111111] bg-[#fff099] shadow-[1.5px_2px_0_#111111] flex items-center justify-center">
        <SearchX class="w-5 h-5 text-[#111111]" :stroke-width="2.2" />
      </div>
      <p class="text-sm font-bold text-[#111111]">Tidak ada transaksi ditemukan</p>
      <button type="button" @click="emit('clear-filters')" class="btn-keycap btn-keycap-sm btn-keycap-yellow px-4 py-2 text-xs">
        <span>Reset Filter</span>
      </button>
    </div>

    <template v-else>
      <div class="hidden lg:block overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-[#f5f3eb] border-b-2 border-[#111111]/15 text-[11px] font-bold uppercase tracking-wider text-[#60605e]">
              <th class="py-3.5 px-4">Waktu</th>
              <th class="py-3.5 px-4">Pengguna</th>
              <th class="py-3.5 px-4">Tipe</th>
              <th class="py-3.5 px-4">Jumlah</th>
              <th class="py-3.5 px-4">Keterangan</th>
              <th class="py-3.5 px-4">Referensi</th>
              <th class="py-3.5 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#111111]/10 text-xs">
            <tr v-for="tx in transactions" :key="tx.id" class="hover:bg-[#f5f3eb]/60 transition-colors">
              <td class="py-3.5 px-4 whitespace-nowrap text-xs font-medium text-[#60605e] tabular-nums">
                {{ formatDateTimeId(tx.createdAt) }}
              </td>
              <td class="py-3.5 px-4">
                <button
                  v-if="tx.user"
                  type="button"
                  @click="emit('open-user', tx.user.id)"
                  class="text-left group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20afff] rounded-[8px]"
                >
                  <div class="font-bold text-sm text-[#111111] group-hover:underline leading-snug">{{ tx.user.name }}</div>
                  <div class="text-xs font-medium text-[#60605e] mt-0.5">{{ tx.user.email }}</div>
                </button>
                <span v-else class="text-xs italic font-medium text-[#60605e]">Pengguna Tidak Tersedia</span>
              </td>
              <td class="py-3.5 px-4 whitespace-nowrap">
                <span :class="[PILL_CLS, getAdminTxMeta(tx.type).badgeClass]">
                  <component :is="resolveTxIcon(tx.type)" class="w-3 h-3 shrink-0" :stroke-width="2.2" />
                  <span>{{ getAdminTxMeta(tx.type).label }}</span>
                </span>
              </td>
              <td class="py-3.5 px-4 whitespace-nowrap">
                <span :class="amountColorClass(tx)" class="font-bold text-sm tabular-nums">{{ formatAmount(tx) }}</span>
                <span class="text-xs font-medium text-[#60605e] ml-1">Token</span>
              </td>
              <td class="py-3.5 px-4 text-xs font-medium text-[#111111] max-w-xs break-words">
                {{ tx.description || '-' }}
              </td>
              <td class="py-3.5 px-4 whitespace-nowrap">
                <span
                  v-if="tx.referenceId"
                  :title="tx.referenceId"
                  class="rounded-md border border-[#111111]/20 bg-[#eaeef4] px-2 py-0.5 text-[11px] font-semibold text-[#111111] tabular-nums inline-block max-w-[160px] truncate align-middle"
                >
                  {{ tx.referenceId }}
                </span>
                <span v-else class="text-xs font-medium text-[#60605e]">-</span>
              </td>
              <td class="py-3.5 px-4 text-right whitespace-nowrap">
                <button
                  v-if="tx.user"
                  type="button"
                  @click="emit('open-user', tx.user.id)"
                  class="btn-keycap btn-keycap-mini btn-keycap-white px-3 py-1.5 text-xs"
                >
                  Detail Pengguna
                </button>
                <span v-else class="text-xs font-medium text-[#60605e]">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="lg:hidden divide-y divide-[#111111]/10">
        <div v-for="tx in transactions" :key="tx.id" class="p-4 space-y-2.5">
          <div class="flex items-start justify-between gap-3">
            <button
              v-if="tx.user"
              type="button"
              @click="emit('open-user', tx.user.id)"
              class="min-w-0 text-left group cursor-pointer focus:outline-none"
            >
              <div class="font-bold text-sm text-[#111111] group-hover:underline truncate">{{ tx.user.name }}</div>
              <div class="text-xs font-medium text-[#60605e] truncate">{{ tx.user.email }}</div>
            </button>
            <span v-else class="text-xs italic font-medium text-[#60605e]">Pengguna Tidak Tersedia</span>
            <div class="text-right shrink-0 whitespace-nowrap">
              <span :class="amountColorClass(tx)" class="font-bold text-sm tabular-nums">{{ formatAmount(tx) }}</span>
              <span class="text-xs font-medium text-[#60605e] ml-1">Token</span>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-1.5">
            <span :class="[PILL_CLS, getAdminTxMeta(tx.type).badgeClass]">
              <component :is="resolveTxIcon(tx.type)" class="w-3 h-3 shrink-0" :stroke-width="2.2" />
              <span>{{ getAdminTxMeta(tx.type).label }}</span>
            </span>
            <span
              v-if="tx.referenceId"
              :title="tx.referenceId"
              class="rounded-md border border-[#111111]/20 bg-[#eaeef4] px-2 py-0.5 text-[10px] font-semibold text-[#111111] tabular-nums max-w-[160px] truncate"
            >
              {{ tx.referenceId }}
            </span>
          </div>

          <p class="text-xs font-medium text-[#111111] leading-snug break-words">{{ tx.description || '-' }}</p>

          <div class="flex items-center justify-between gap-2 pt-0.5">
            <span class="text-[11px] font-medium text-[#60605e] tabular-nums">{{ formatDateTimeId(tx.createdAt) }}</span>
            <button
              v-if="tx.user"
              type="button"
              @click="emit('open-user', tx.user.id)"
              class="btn-keycap btn-keycap-mini btn-keycap-white px-3 py-1.5 text-xs shrink-0"
            >
              Detail Pengguna
            </button>
          </div>
        </div>
      </div>

      <div class="bg-[#f5f3eb] border-t-2 border-[#111111]/15 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div class="font-medium text-[#60605e]">
          Menampilkan <strong class="text-[#111111] tabular-nums">{{ formatNumberId(transactions.length) }}</strong> dari
          <strong class="text-[#111111] tabular-nums">{{ formatNumberId(pagination.total) }}</strong> mutasi
        </div>
        <div class="flex items-center gap-3">
          <span class="font-medium text-[#60605e] tabular-nums">
            Halaman <strong class="text-[#111111]">{{ pagination.page }}</strong> dari <strong class="text-[#111111]">{{ pagination.totalPages || 1 }}</strong>
          </span>
          <div class="flex items-center gap-2">
            <button type="button" @click="emit('page-change', currentPage - 1)" :disabled="currentPage <= 1 || loading" class="btn-keycap btn-keycap-mini btn-keycap-white px-3 py-1.5 text-xs">
              <ChevronLeft class="w-3.5 h-3.5" :stroke-width="2.2" />
              <span>Sebelumnya</span>
            </button>
            <button type="button" @click="emit('page-change', currentPage + 1)" :disabled="currentPage >= (pagination.totalPages || 1) || loading" class="btn-keycap btn-keycap-mini btn-keycap-white px-3 py-1.5 text-xs">
              <span>Berikutnya</span>
              <ChevronRight class="w-3.5 h-3.5" :stroke-width="2.2" />
            </button>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
