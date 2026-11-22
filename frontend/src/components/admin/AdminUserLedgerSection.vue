<script setup>
import { computed } from 'vue'
import { History, ArrowDownLeft, ArrowUpRight, Gift, RotateCcw, Coins } from 'lucide-vue-next'
import {
  getAdminTxMeta,
  formatDateTimeId,
  getTxAmountClass,
  formatTxSignedAmount
} from '../../utils/adminFormatters'

const props = defineProps({
  transactions: { type: Array, default: () => [] }
})

const TX_ICON_MAP = {
  TOPUP: ArrowDownLeft,
  DEDUCTION: ArrowUpRight,
  WELCOME_GRANT: Gift,
  REFUND: RotateCcw
}

const visibleTransactions = computed(() => {
  return Array.isArray(props.transactions) ? props.transactions.slice(0, 20) : []
})

function resolveTxIcon(type) {
  return (type && Object.hasOwn(TX_ICON_MAP, type)) ? TX_ICON_MAP[type] : Coins
}
</script>

<template>
  <section
    aria-labelledby="user-ledger-heading"
    class="rounded-[18px] border-2 border-[#111111] bg-white/95 backdrop-blur-md shadow-[3px_4px_0_#111111] p-5 space-y-3.5 font-sans"
  >
    <div class="flex items-center justify-between gap-2 pb-3 border-b border-[#111111]/10">
      <div class="flex items-center gap-2">
        <span class="w-7 h-7 rounded-[8px] border-[1.5px] border-[#111111] bg-[#eaeef4] shadow-[1px_1.5px_0_#111111] flex items-center justify-center shrink-0">
          <History class="w-3.5 h-3.5 text-[#111111]" :stroke-width="2.2" />
        </span>
        <h3 id="user-ledger-heading" class="font-editorial font-bold text-base text-[#111111]">
          Riwayat Transaksi
        </h3>
      </div>
      <span class="rounded-full border border-[#111111]/20 bg-[#f5f3eb] px-2.5 py-0.5 text-[11px] font-bold text-[#111111] tabular-nums">
        {{ visibleTransactions.length }} Mutasi
      </span>
    </div>

    <div class="max-h-64 overflow-y-auto rounded-[14px] border-[1.5px] border-[#111111]/20 bg-[#fcfcfb] divide-y divide-[#111111]/10">
      <div v-if="visibleTransactions.length === 0" class="p-8 text-center text-xs font-medium text-[#60605e]">
        Belum ada catatan riwayat transaksi untuk akun ini.
      </div>

      <div
        v-for="(tx, idx) in visibleTransactions"
        :key="tx.id || idx"
        class="p-3.5 hover:bg-[#f5f3eb]/60 transition-colors space-y-1.5"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-1.5 min-w-0">
            <span
              :class="getAdminTxMeta(tx.type).badgeClass"
              class="inline-flex items-center gap-1 rounded-full border border-[#111111] px-2 py-0.5 text-[10px] font-bold leading-none"
            >
              <component :is="resolveTxIcon(tx.type)" class="w-3 h-3 shrink-0" :stroke-width="2.2" />
              <span>{{ getAdminTxMeta(tx.type).label }}</span>
            </span>

            <span
              v-if="tx.referenceId"
              :title="tx.referenceId"
              class="rounded-md border border-[#111111]/20 bg-[#eaeef4] px-1.5 py-0.5 text-[10px] font-semibold text-[#111111] tabular-nums truncate max-w-[140px]"
            >
              {{ tx.referenceId }}
            </span>
          </div>

          <span :class="getTxAmountClass(tx)" class="text-xs font-bold tabular-nums shrink-0">
            {{ formatTxSignedAmount(tx) }} Token
          </span>
        </div>

        <p class="text-xs font-medium text-[#111111] leading-snug">
          {{ tx.description || getAdminTxMeta(tx.type).label }}
        </p>

        <div class="text-[11px] font-medium text-[#60605e] tabular-nums">
          {{ formatDateTimeId(tx.createdAt) }}
        </div>
      </div>
    </div>
  </section>
</template>
