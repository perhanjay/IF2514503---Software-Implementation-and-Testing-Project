<script setup>
import { computed } from 'vue'
import { Shield, CheckCircle2, Ban, Coins } from 'lucide-vue-next'
import {
  formatNumberId,
  getRoleBadgeMeta,
  getStatusBadgeMeta
} from '../../utils/adminFormatters'

const props = defineProps({
  user: {
    type: Object,
    required: true
  }
})

const roleMeta = computed(() => getRoleBadgeMeta(props.user?.role))
const statusMeta = computed(() => getStatusBadgeMeta(props.user?.status))
const balance = computed(() => props.user?.wallet?.balance ?? 0)
const stats = computed(() => ({
  total: props.user?.sessionStats?.total ?? 0,
  successful: props.user?.sessionStats?.successful ?? 0,
  failed: props.user?.sessionStats?.failed ?? 0
}))
</script>

<template>
  <section
    aria-label="Ringkasan Pengguna"
    class="rounded-[18px] border-2 border-[#111111] bg-white/95 backdrop-blur-md shadow-[3px_4px_0_#111111] p-5 space-y-4 font-sans"
  >
    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
      <div class="min-w-0 space-y-2">
        <div>
          <h3 class="font-editorial font-bold text-xl text-[#111111] tracking-tight leading-snug truncate">
            {{ user.name || '-' }}
          </h3>
          <p class="text-xs font-medium text-[#60605e] truncate mt-0.5">
            {{ user.email || '-' }}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <span
            :class="roleMeta.badgeClass"
            class="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-2.5 py-0.5 text-[11px] font-bold leading-none"
          >
            <Shield class="w-3 h-3 shrink-0" :stroke-width="2.2" />
            <span>{{ roleMeta.label }}</span>
          </span>

          <span
            :class="statusMeta.badgeClass"
            class="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-2.5 py-0.5 text-[11px] font-bold leading-none"
          >
            <CheckCircle2 v-if="user.status === 'ACTIVE'" class="w-3 h-3 shrink-0" :stroke-width="2.2" />
            <Ban v-else class="w-3 h-3 shrink-0" :stroke-width="2.2" />
            <span>{{ statusMeta.label }}</span>
          </span>
        </div>
      </div>

      <div class="rounded-[14px] border-[1.5px] border-[#111111] bg-[#f5f3eb] px-4 py-3 shrink-0 sm:min-w-[148px]">
        <div class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#60605e]">
          <Coins class="w-3.5 h-3.5 text-[#111111] shrink-0" :stroke-width="2.2" />
          <span>Saldo Token</span>
        </div>
        <div class="mt-1 flex items-baseline gap-1.5">
          <span class="font-editorial font-bold text-2xl text-[#111111] leading-none tabular-nums">
            {{ formatNumberId(balance) }}
          </span>
          <span class="text-xs font-bold text-[#60605e]">Token</span>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-2.5 pt-1">
      <div class="rounded-[14px] border-[1.5px] border-[#111111]/20 bg-[#fcfcfb] p-3 text-center">
        <div class="text-[10px] font-bold uppercase tracking-wider text-[#60605e]">
          Total Sesi
        </div>
        <div class="mt-1 font-editorial font-bold text-lg text-[#111111] tabular-nums leading-none">
          {{ formatNumberId(stats.total) }}
        </div>
      </div>

      <div class="rounded-[14px] border-[1.5px] border-[#111111]/20 bg-[#d8f3dc]/50 p-3 text-center">
        <div class="text-[10px] font-bold uppercase tracking-wider text-[#60605e]">
          Berhasil
        </div>
        <div class="mt-1 font-editorial font-bold text-lg text-[#111111] tabular-nums leading-none">
          {{ formatNumberId(stats.successful) }}
        </div>
      </div>

      <div class="rounded-[14px] border-[1.5px] border-[#111111]/20 bg-[#ffcae6]/50 p-3 text-center">
        <div class="text-[10px] font-bold uppercase tracking-wider text-[#60605e]">
          Gagal
        </div>
        <div class="mt-1 font-editorial font-bold text-lg text-[#111111] tabular-nums leading-none">
          {{ formatNumberId(stats.failed) }}
        </div>
      </div>
    </div>
  </section>
</template>
