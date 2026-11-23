<script setup>
import { computed } from 'vue'
import { CreditCard, Check, Loader2, Receipt, RefreshCw, X, AlertTriangle } from 'lucide-vue-next'

const props = defineProps({
  packages: {
    type: Array,
    default: () => []
  },
  modelValue: {
    type: String,
    default: 'PKG-25'
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  },
  checkoutLoading: {
    type: Boolean,
    default: false
  },
  simulatingPayment: {
    type: Boolean,
    default: false
  },
  activeOrder: {
    type: Object,
    default: null
  },
  isGuest: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'checkout', 'simulate-payment', 'cancel-order', 'retry'])

const bestValuePackageId = computed(() => {
  if (!props.packages.length) return null
  let best = props.packages[0]
  let lowestPerToken = best.priceIdr / best.tokens
  for (const pkg of props.packages) {
    const unitPrice = pkg.priceIdr / pkg.tokens
    if (unitPrice < lowestPerToken) {
      lowestPerToken = unitPrice
      best = pkg
    }
  }
  return best.id
})

function formatIdr(amount) {
  return Number(amount || 0).toLocaleString('id-ID')
}

function getBadgeMeta(pkg) {
  if (pkg.id === bestValuePackageId.value && props.packages.length > 1) {
    return { label: 'Paling Hemat', cls: 'bg-[#d8f3dc]' }
  }
  if (pkg.id === 'PKG-25') {
    return { label: 'Populer', cls: 'bg-[#87d7ff]' }
  }
  return null
}
</script>

<template>
  <section
    aria-labelledby="packages-heading"
    class="rounded-[18px] border-2 border-[#111111] bg-white/95 backdrop-blur-md shadow-[3px_4px_0_#111111] p-5 sm:p-6 space-y-5"
  >
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-[#111111]/10">
      <div class="flex items-center gap-2.5">
        <span class="w-8 h-8 rounded-[10px] border-[1.5px] border-[#111111] bg-[#87d7ff] shadow-[1px_1.5px_0_#111111] flex items-center justify-center shrink-0">
          <CreditCard class="w-4 h-4 text-[#111111]" :stroke-width="2.2" />
        </span>
        <h2
          id="packages-heading"
          class="font-editorial font-bold text-lg sm:text-xl text-[#111111] tracking-tight"
        >
          Beli Paket Token
        </h2>
      </div>

      <span class="inline-flex items-center rounded-full border-[1.5px] border-[#111111] bg-[#d8f3dc] shadow-[1px_1.5px_0_#111111] px-3 py-1 text-[11px] font-bold text-[#111111] leading-none">
        Midtrans Sandbox
      </span>
    </div>

    <!-- Loading Skeleton -->
    <div
      v-if="loading && !packages.length"
      aria-busy="true"
      aria-label="Memuat paket token"
      class="space-y-3"
    >
      <div v-for="i in 3" :key="i" class="h-20 rounded-[14px] bg-[#eaeef4] animate-pulse border border-[#111111]/15" />
    </div>

    <!-- Error State -->
    <div
      v-else-if="error && !packages.length"
      role="alert"
      class="rounded-[14px] border-[1.5px] border-[#111111] bg-[#fff5f7] p-5 text-center space-y-3"
    >
      <AlertTriangle class="w-5 h-5 text-rose-700 mx-auto" :stroke-width="2.2" />
      <div class="space-y-1">
        <p class="text-sm font-bold text-[#111111]">Gagal memuat daftar paket token</p>
        <p class="text-xs text-[#60605e]">{{ error }}</p>
      </div>
      <button
        type="button"
        @click="emit('retry')"
        class="btn-keycap btn-keycap-mini btn-keycap-white px-4 py-2 text-xs"
      >
        <RefreshCw class="w-3.5 h-3.5" :stroke-width="2.2" />
        <span>Muat Ulang Paket</span>
      </button>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="!packages.length"
      class="rounded-[14px] border border-dashed border-[#111111]/35 bg-[#fcfcfb] p-6 text-center text-xs text-[#60605e]"
    >
      Belum ada paket token yang tersedia saat ini.
    </div>

    <!-- Accessible Package Radio Group -->
    <div
      v-else
      role="radiogroup"
      aria-labelledby="packages-heading"
      class="space-y-3"
    >
      <label
        v-for="pkg in packages"
        :key="pkg.id"
        :class="modelValue === pkg.id
          ? 'border-2 border-[#111111] bg-[#fff9db] shadow-[2px_3px_0_#111111]'
          : 'border-[1.5px] border-[#111111]/25 bg-white hover:border-[#111111]'"
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-[14px] cursor-pointer transition-all focus-within:ring-2 focus-within:ring-[#111111] focus-within:ring-offset-2"
      >
        <input
          type="radio"
          name="token-package"
          :value="pkg.id"
          :checked="modelValue === pkg.id"
          @change="emit('update:modelValue', pkg.id)"
          class="sr-only"
        />

        <div class="flex items-start gap-3 min-w-0">
          <!-- Custom Tactile Radio Indicator -->
          <span
            aria-hidden="true"
            :class="modelValue === pkg.id ? 'bg-[#ffda40]' : 'bg-white'"
            class="mt-0.5 w-5 h-5 rounded-full border-2 border-[#111111] flex items-center justify-center shrink-0 transition-colors"
          >
            <span
              v-if="modelValue === pkg.id"
              class="w-2.5 h-2.5 rounded-full bg-[#111111]"
            />
          </span>

          <div class="space-y-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-bold text-sm text-[#111111]">{{ pkg.name }}</span>
              <span
                v-if="getBadgeMeta(pkg)"
                :class="getBadgeMeta(pkg).cls"
                class="inline-flex items-center rounded-full border-[1.5px] border-[#111111] px-2 py-0.5 text-[10px] font-bold text-[#111111] leading-none"
              >
                {{ getBadgeMeta(pkg).label }}
              </span>
            </div>
            <p class="text-xs text-[#60605e] leading-snug">
              <span class="font-semibold text-[#111111] tabular-nums">{{ pkg.tokens }} Token</span>
              <template v-if="pkg.description"> &middot; {{ pkg.description }}</template>
            </p>
          </div>
        </div>

        <div class="sm:text-right pl-8 sm:pl-0 shrink-0">
          <div class="font-editorial font-bold text-base text-[#111111] tabular-nums">
            Rp {{ formatIdr(pkg.priceIdr) }}
          </div>
          <div class="text-[11px] font-medium text-[#60605e] tabular-nums">
            Rp {{ formatIdr(Math.round(pkg.priceIdr / pkg.tokens)) }} / token
          </div>
        </div>
      </label>
    </div>

    <!-- Primary Checkout Keycap CTA -->
    <button
      v-if="packages.length"
      type="button"
      @click="emit('checkout')"
      :disabled="checkoutLoading"
      class="w-full btn-keycap btn-keycap-blue py-3.5 px-5 text-xs sm:text-sm"
    >
      <Loader2 v-if="checkoutLoading" class="w-4 h-4 animate-spin" :stroke-width="2.2" />
      <CreditCard v-else class="w-4 h-4" :stroke-width="2.2" />
      <span>
        {{ checkoutLoading
          ? 'Menghubungkan Midtrans Sandbox...'
          : (isGuest ? 'Daftar atau Masuk untuk Beli Token' : 'Lanjutkan ke Pembayaran Midtrans') }}
      </span>
    </button>

    <!-- Active Order Sandbox Receipt -->
    <div
      v-if="activeOrder"
      class="rounded-[14px] border-[1.5px] border-[#111111] bg-[#f5f3eb] p-4 sm:p-5 space-y-3.5 animate-fade-in"
    >
      <div class="flex items-center justify-between gap-2 pb-2.5 border-b border-[#111111]/15">
        <div class="flex items-center gap-2 min-w-0">
          <Receipt class="w-4 h-4 text-[#111111] shrink-0" :stroke-width="2.2" />
          <span class="text-xs font-bold uppercase tracking-wider text-[#111111]">
            Simulasi Sandbox Midtrans
          </span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="inline-flex items-center rounded-full border border-[#111111] bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#111111] tabular-nums">
            {{ activeOrder.orderId }}
          </span>
          <button
            type="button"
            @click="emit('cancel-order')"
            class="p-1 rounded-[8px] text-[#60605e] hover:text-[#111111] hover:bg-white/80 transition-colors cursor-pointer"
            aria-label="Tutup pratinjau pesanan"
          >
            <X class="w-4 h-4" :stroke-width="2.2" />
          </button>
        </div>
      </div>

      <div class="space-y-1.5 text-xs">
        <div class="flex items-center justify-between gap-3">
          <span class="text-[#60605e] font-medium">Paket Dipilih</span>
          <span class="font-bold text-[#111111] tabular-nums">
            {{ activeOrder.package?.name }} ({{ activeOrder.package?.tokens }} Token)
          </span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-[#60605e] font-medium">Total Pembayaran</span>
          <span class="font-editorial font-bold text-sm text-[#111111] tabular-nums">
            Rp {{ formatIdr(activeOrder.package?.priceIdr) }}
          </span>
        </div>
      </div>

      <div class="pt-1">
        <button
          type="button"
          @click="emit('simulate-payment')"
          :disabled="simulatingPayment"
          class="w-full btn-keycap btn-keycap-sm btn-keycap-green py-3 px-4 text-xs"
        >
          <Loader2 v-if="simulatingPayment" class="w-4 h-4 animate-spin" :stroke-width="2.4" />
          <Check v-else class="w-4 h-4" :stroke-width="2.5" />
          <span>{{ simulatingPayment ? 'Memverifikasi Pembayaran...' : 'Simulasi Konfirmasi Pembayaran' }}</span>
        </button>
      </div>
    </div>
  </section>
</template>
