<script setup>
import { computed } from 'vue'
import { CheckCircle2, AlertTriangle, AlertCircle, Coins } from 'lucide-vue-next'

const props = defineProps({
  balance: {
    type: Number,
    default: 0
  },
  transactions: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const statusMeta = computed(() => {
  if (props.balance <= 0) {
    return {
      label: 'Kuota Habis',
      pillClass: 'bg-[#ffcae6] text-[#111111]',
      icon: AlertCircle
    }
  }
  if (props.balance === 1) {
    return {
      label: 'Saldo Menipis',
      pillClass: 'bg-[#fff099] text-[#111111]',
      icon: AlertTriangle
    }
  }
  return {
    label: 'Siap Digunakan',
    pillClass: 'bg-[#d8f3dc] text-[#111111]',
    icon: CheckCircle2
  }
})

const ledgerSummary = computed(() => {
  const list = Array.isArray(props.transactions) ? props.transactions : []
  let totalCredit = 0
  let totalDebit = 0
  for (const tx of list) {
    const amt = Number(tx?.amount || 0)
    if (amt > 0) totalCredit += amt
    else if (amt < 0) totalDebit += Math.abs(amt)
  }
  return { totalCredit, totalDebit }
})
</script>

<template>
  <section
    aria-labelledby="wallet-balance-heading"
    class="rounded-[18px] border-2 border-[#111111] bg-white/95 backdrop-blur-md shadow-[3px_4px_0_#111111] p-5 sm:p-6 space-y-5"
  >
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-[#111111]/10">
      <div class="flex items-center gap-2.5">
        <span class="w-8 h-8 rounded-[10px] border-[1.5px] border-[#111111] bg-[#ffda40] shadow-[1px_1.5px_0_#111111] flex items-center justify-center shrink-0">
          <Coins class="w-4 h-4 text-[#111111]" :stroke-width="2.2" />
        </span>
        <h2
          id="wallet-balance-heading"
          class="font-editorial font-bold text-lg sm:text-xl text-[#111111] tracking-tight"
        >
          Saldo Kuota Studio
        </h2>
      </div>

      <span
        v-if="!loading"
        :class="statusMeta.pillClass"
        class="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-3 py-1 text-[11px] font-bold leading-none"
      >
        <component :is="statusMeta.icon" class="w-3.5 h-3.5 shrink-0" :stroke-width="2.2" />
        <span>{{ statusMeta.label }}</span>
      </span>
    </div>

    <!-- Loading Skeleton -->
    <div
      v-if="loading"
      aria-busy="true"
      aria-label="Memuat informasi saldo token"
      class="grid grid-cols-1 sm:grid-cols-12 gap-4"
    >
      <div class="sm:col-span-5 h-32 rounded-[14px] bg-[#eaeef4] animate-pulse border border-[#111111]/15" />
      <div class="sm:col-span-7 h-32 rounded-[14px] bg-[#eaeef4] animate-pulse border border-[#111111]/15" />
    </div>

    <!-- Balance & Studio Capacity Summary -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-12 gap-4 items-stretch">
      <!-- Primary Balance Plate -->
      <div class="sm:col-span-5 rounded-[14px] border-[1.5px] border-[#111111] bg-[#f5f3eb] p-4 sm:p-5 flex flex-col justify-between gap-3">
        <span class="text-[11px] font-bold uppercase tracking-wider text-[#60605e]">
          Saldo Kuota Aktif
        </span>
        <div class="flex items-baseline gap-2">
          <span class="font-editorial font-bold text-5xl sm:text-6xl text-[#111111] leading-none tabular-nums">
            {{ balance }}
          </span>
          <span class="text-sm font-bold text-[#60605e]">Token</span>
        </div>
        <p class="text-xs text-[#60605e] font-medium">
          Tersedia untuk pemrosesan perbaikan DSP
        </p>
      </div>

      <!-- Studio Quota Context Plate -->
      <div class="sm:col-span-7 rounded-[14px] border-[1.5px] border-[#111111]/20 bg-[#fcfcfb] px-4 py-3 sm:px-5 sm:py-4 flex flex-col justify-center divide-y divide-[#111111]/10 text-xs">
        <div class="py-2.5 flex items-center justify-between gap-3">
          <span class="text-[#60605e] font-medium">Nilai Tukar Studio</span>
          <span class="font-bold text-[#111111] tabular-nums">1 Token = 1 Perbaikan Sesi</span>
        </div>
        <div class="py-2.5 flex items-center justify-between gap-3">
          <span class="text-[#60605e] font-medium">Kapasitas Saat Ini</span>
          <span class="font-bold text-[#111111] tabular-nums">{{ balance }} Sesi Multitrack</span>
        </div>
        <div class="py-2.5 flex items-center justify-between gap-3">
          <span class="text-[#60605e] font-medium">Ringkasan Mutasi Terbaru</span>
          <div class="flex items-center gap-2.5 font-bold tabular-nums">
            <span class="text-emerald-800">+{{ ledgerSummary.totalCredit }} Masuk</span>
            <span class="text-[#111111]/25" aria-hidden="true">/</span>
            <span class="text-rose-800">-{{ ledgerSummary.totalDebit }} Terpakai</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
