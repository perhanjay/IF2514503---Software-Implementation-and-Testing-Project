<script setup>
import { ref, computed } from 'vue'
import { Coins, RotateCw, AlertTriangle } from 'lucide-vue-next'
import { formatNumberId } from '../../utils/adminFormatters'

const props = defineProps({
  balance: { type: Number, default: 0 },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['submit'])

const TYPE_OPTIONS = [
  { value: 'TOPUP', label: 'Top-Up (+)', activeClass: 'bg-[#d8f3dc] text-[#111111] shadow-[1.5px_2px_0_#111111]' },
  { value: 'REFUND', label: 'Refund (+)', activeClass: 'bg-[#87d7ff] text-[#111111] shadow-[1.5px_2px_0_#111111]' },
  { value: 'DEDUCTION', label: 'Potong (-)', activeClass: 'bg-[#ffcae6] text-[#111111] shadow-[1.5px_2px_0_#111111]' }
]

const type = ref('TOPUP')
const amount = ref(1)
const description = ref('')

const parsedAmount = computed(() => Number(amount.value))
const isAmountValid = computed(() => Number.isInteger(parsedAmount.value) && parsedAmount.value >= 1)
const isDescriptionValid = computed(() => description.value.trim().length >= 5)
const isInsufficientBalance = computed(() => {
  return type.value === 'DEDUCTION' && Number.isFinite(parsedAmount.value) && parsedAmount.value > props.balance
})

const projectedBalance = computed(() => {
  const delta = isAmountValid.value ? parsedAmount.value : 0
  return type.value === 'DEDUCTION' ? props.balance - delta : props.balance + delta
})

const canSubmit = computed(() => {
  return !props.loading && isAmountValid.value && isDescriptionValid.value && !isInsufficientBalance.value
})

function resetForm() {
  amount.value = 1
  description.value = ''
}

function handleSubmit() {
  if (!canSubmit.value) return
  emit('submit', {
    amount: parsedAmount.value,
    type: type.value,
    description: description.value.trim()
  })
}

defineExpose({ resetForm })
</script>

<template>
  <section
    aria-labelledby="token-adjustment-heading"
    class="rounded-[18px] border-2 border-[#111111] bg-white/95 backdrop-blur-md shadow-[3px_4px_0_#111111] p-5 space-y-4 font-sans"
  >
    <div class="flex items-center justify-between gap-2 pb-3 border-b border-[#111111]/10">
      <div class="flex items-center gap-2">
        <span class="w-7 h-7 rounded-[8px] border-[1.5px] border-[#111111] bg-[#ffda40] shadow-[1px_1.5px_0_#111111] flex items-center justify-center shrink-0">
          <Coins class="w-3.5 h-3.5 text-[#111111]" :stroke-width="2.2" />
        </span>
        <h3 id="token-adjustment-heading" class="font-editorial font-bold text-base text-[#111111]">
          Penyesuaian Saldo Token
        </h3>
      </div>
      <span class="text-xs font-bold text-[#111111] tabular-nums">{{ formatNumberId(balance) }} Token</span>
    </div>

    <form class="space-y-3.5" @submit.prevent="handleSubmit">
      <div class="space-y-1.5">
        <span class="block text-[11px] font-bold uppercase tracking-wider text-[#60605e]">Tipe Mutasi</span>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="opt in TYPE_OPTIONS"
            :key="opt.value"
            type="button"
            :aria-pressed="type === opt.value"
            :disabled="loading"
            @click="type = opt.value"
            :class="type === opt.value ? opt.activeClass : 'bg-[#f5f3eb] text-[#60605e] hover:text-[#111111]'"
            class="rounded-[10px] border-[1.5px] border-[#111111] px-2.5 py-2 text-xs font-bold text-center transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="space-y-1.5">
        <label for="admin-token-amount" class="block text-[11px] font-bold uppercase tracking-wider text-[#60605e]">
          Jumlah Token
        </label>
        <input
          id="admin-token-amount"
          v-model.number="amount"
          type="number"
          min="1"
          step="1"
          :disabled="loading"
          class="w-full rounded-[10px] border-[1.5px] border-[#111111] bg-[#fcfcfb] px-3 py-2 text-sm font-bold text-[#111111] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#20afff] disabled:opacity-60"
        />
      </div>

      <div class="space-y-1.5">
        <label for="admin-token-desc" class="block text-[11px] font-bold uppercase tracking-wider text-[#60605e]">
          Alasan Penyesuaian (Min. 5 Karakter)
        </label>
        <textarea
          id="admin-token-desc"
          v-model="description"
          rows="2"
          :disabled="loading"
          placeholder="Contoh: Kompensasi gangguan pemrosesan sesi"
          class="w-full rounded-[10px] border-[1.5px] border-[#111111] bg-[#fcfcfb] px-3 py-2 text-xs font-medium text-[#111111] placeholder:text-[#60605e]/70 focus:outline-none focus:ring-2 focus:ring-[#20afff] disabled:opacity-60"
        />
      </div>

      <div class="rounded-[14px] border-[1.5px] border-[#111111]/20 bg-[#f5f3eb] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
        <span class="font-medium text-[#60605e]">Proyeksi Saldo:</span>
        <span :class="projectedBalance < 0 ? 'text-[#be123c]' : 'text-[#111111]'" class="font-bold tabular-nums">
          {{ formatNumberId(balance) }} &rarr; {{ formatNumberId(projectedBalance) }} Token
        </span>
      </div>

      <div
        v-if="isInsufficientBalance"
        role="alert"
        class="rounded-[12px] border-[1.5px] border-[#111111] bg-[#ffcae6] px-3 py-2 flex items-center gap-2 text-xs font-bold text-[#111111]"
      >
        <AlertTriangle class="w-4 h-4 shrink-0" :stroke-width="2.2" />
        <span>Saldo saat ini tidak mencukupi untuk pemotongan sebesar {{ formatNumberId(parsedAmount) }} Token.</span>
      </div>

      <button type="submit" :disabled="!canSubmit" class="btn-keycap btn-keycap-sm btn-keycap-blue w-full py-2.5 px-4 text-xs">
        <RotateCw v-if="loading" class="w-3.5 h-3.5 animate-spin text-[#111111]" :stroke-width="2.2" />
        <span>Terapkan Penyesuaian Token</span>
      </button>
    </form>
  </section>
</template>
