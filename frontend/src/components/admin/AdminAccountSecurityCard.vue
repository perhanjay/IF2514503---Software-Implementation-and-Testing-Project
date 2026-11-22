<script setup>
import { computed } from 'vue'
import { ShieldAlert, Ban, CheckCircle2, LogOut, RotateCw } from 'lucide-vue-next'
import { getStatusBadgeMeta } from '../../utils/adminFormatters'

const props = defineProps({
  status: { type: String, required: true },
  statusReason: { type: String, default: '' },
  isSelf: { type: Boolean, default: false },
  statusLoading: { type: Boolean, default: false },
  revokeLoading: { type: Boolean, default: false }
})

const emit = defineEmits(['request-suspend', 'reactivate', 'request-revoke'])

const statusMeta = computed(() => getStatusBadgeMeta(props.status))
</script>

<template>
  <section
    aria-labelledby="account-security-heading"
    class="rounded-[18px] border-2 border-[#111111] bg-white/95 backdrop-blur-md shadow-[3px_4px_0_#111111] p-5 space-y-4 font-sans"
  >
    <div class="flex items-center justify-between gap-2 pb-3 border-b border-[#111111]/10">
      <div class="flex items-center gap-2">
        <span class="w-7 h-7 rounded-[8px] border-[1.5px] border-[#111111] bg-[#ffcae6] shadow-[1px_1.5px_0_#111111] flex items-center justify-center shrink-0">
          <ShieldAlert class="w-3.5 h-3.5 text-[#111111]" :stroke-width="2.2" />
        </span>
        <h3 id="account-security-heading" class="font-editorial font-bold text-base text-[#111111]">
          Keamanan &amp; Status Akun
        </h3>
      </div>

      <span
        :class="statusMeta.badgeClass"
        class="inline-flex items-center gap-1 rounded-full border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-2.5 py-0.5 text-[11px] font-bold leading-none"
      >
        <CheckCircle2 v-if="status === 'ACTIVE'" class="w-3 h-3 shrink-0" :stroke-width="2.2" />
        <Ban v-else class="w-3 h-3 shrink-0" :stroke-width="2.2" />
        <span>{{ statusMeta.label }}</span>
      </span>
    </div>

    <div
      v-if="status === 'SUSPENDED'"
      class="rounded-[12px] border-[1.5px] border-[#111111] bg-[#ffcae6]/55 p-3 space-y-1 text-xs text-[#111111]"
    >
      <div class="text-[10px] font-bold uppercase tracking-wider text-[#111111]/80">Alasan Penangguhan</div>
      <div class="font-medium leading-snug">{{ statusReason || 'Tidak ada alasan yang dicatat.' }}</div>
    </div>

    <div
      v-if="isSelf && status === 'ACTIVE'"
      class="rounded-[12px] border border-[#111111]/20 bg-[#f5f3eb] px-3 py-2 text-xs font-medium text-[#60605e]"
    >
      Akun Anda sendiri tidak dapat ditangguhkan.
    </div>

    <div class="flex flex-wrap items-center gap-2.5">
      <button
        v-if="status === 'ACTIVE'"
        type="button"
        :disabled="isSelf || statusLoading"
        @click="emit('request-suspend')"
        class="btn-keycap btn-keycap-sm btn-keycap-pink px-3.5 py-2 text-xs"
      >
        <Ban class="w-3.5 h-3.5 text-[#111111]" :stroke-width="2.2" />
        <span>Tangguhkan Akun</span>
      </button>

      <button
        v-else
        type="button"
        :disabled="statusLoading"
        @click="emit('reactivate')"
        class="btn-keycap btn-keycap-sm btn-keycap-green px-3.5 py-2 text-xs"
      >
        <RotateCw v-if="statusLoading" class="w-3.5 h-3.5 animate-spin text-[#111111]" :stroke-width="2.2" />
        <CheckCircle2 v-else class="w-3.5 h-3.5 text-[#111111]" :stroke-width="2.2" />
        <span>Aktifkan Kembali</span>
      </button>

      <button
        type="button"
        :disabled="revokeLoading"
        @click="emit('request-revoke')"
        class="btn-keycap btn-keycap-sm btn-keycap-white px-3.5 py-2 text-xs"
      >
        <RotateCw v-if="revokeLoading" class="w-3.5 h-3.5 animate-spin text-[#111111]" :stroke-width="2.2" />
        <LogOut v-else class="w-3.5 h-3.5 text-[#111111]" :stroke-width="2.2" />
        <span>Cabut Semua Sesi</span>
      </button>
    </div>
  </section>
</template>
