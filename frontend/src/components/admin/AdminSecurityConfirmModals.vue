<script setup>
import { computed, ref } from 'vue'
import { AlertTriangle, Ban, LogOut, RotateCw, X } from 'lucide-vue-next'
import { useDialogFocus } from '../../composables/useDialogFocus'

const props = defineProps({
  showSuspend: { type: Boolean, default: false },
  showRevoke: { type: Boolean, default: false },
  userName: { type: String, default: '' },
  suspendReason: { type: String, default: '' },
  statusLoading: { type: Boolean, default: false },
  revokeLoading: { type: Boolean, default: false },
  modalError: { type: String, default: '' }
})

const emit = defineEmits([
  'update:showSuspend',
  'update:showRevoke',
  'update:suspendReason',
  'confirm-suspend',
  'confirm-revoke'
])

const activeDialogRef = ref(null)

const activeDialog = computed(() => {
  const target = props.userName || 'pengguna'
  const list = [
    {
      key: 'suspend',
      visible: props.showSuspend,
      titleId: 'suspend-user-modal-title',
      badge: 'Penangguhan Akun',
      title: `Tangguhkan akun ${target}?`,
      impact: 'Seluruh sesi aktif dicabut dan pengguna tidak dapat masuk atau memproses audio hingga diaktifkan kembali.',
      icon: Ban,
      loading: props.statusLoading,
      closeLabel: 'Tutup modal penangguhan',
      confirmLabel: props.statusLoading ? 'Memproses...' : 'Ya, Tangguhkan',
      closeEvent: 'update:showSuspend',
      confirmEvent: 'confirm-suspend',
      hasReason: true
    },
    {
      key: 'revoke',
      visible: props.showRevoke,
      titleId: 'revoke-sessions-modal-title',
      badge: 'Keamanan Sesi',
      title: `Cabut semua sesi ${target}?`,
      impact: 'Semua token autentikasi aktif akan dibatalkan sehingga pengguna langsung keluar dari seluruh perangkat.',
      icon: LogOut,
      loading: props.revokeLoading,
      closeLabel: 'Tutup modal cabut sesi',
      confirmLabel: props.revokeLoading ? 'Mencabut...' : 'Cabut Semua Sesi',
      closeEvent: 'update:showRevoke',
      confirmEvent: 'confirm-revoke',
      hasReason: false
    }
  ]
  return list.find((dialog) => dialog.visible) || null
})

const isModalOpen = computed(() => Boolean(activeDialog.value))
useDialogFocus(isModalOpen, activeDialogRef)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="activeDialog"
      :key="activeDialog.key"
      class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#111111]/55 backdrop-blur-xs animate-fade-in"
      @click.self="!activeDialog.loading && emit(activeDialog.closeEvent, false)"
    >
      <div
        ref="activeDialogRef"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        :aria-labelledby="activeDialog.titleId"
        class="retro-glass-panel rounded-[20px] border-2 border-[#111111] shadow-[4px_5px_0_#111111] max-w-md w-full p-6 space-y-4 font-sans focus:outline-none"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1">
            <span class="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#111111] bg-[#ffcae6] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#111111]">
              <component :is="activeDialog.icon" class="w-3 h-3" :stroke-width="2.2" />
              <span>{{ activeDialog.badge }}</span>
            </span>
            <h3 :id="activeDialog.titleId" class="text-lg font-editorial font-bold text-[#111111] tracking-tight pt-1">
              {{ activeDialog.title }}
            </h3>
          </div>
          <button
            type="button"
            :disabled="activeDialog.loading"
            :aria-label="activeDialog.closeLabel"
            @click="emit(activeDialog.closeEvent, false)"
            class="btn-keycap btn-keycap-mini btn-keycap-white w-8 h-8 shrink-0"
          >
            <X class="w-4 h-4 text-[#111111]" :stroke-width="2" />
          </button>
        </div>

        <p class="rounded-[12px] border border-[#111111]/15 bg-[#f5f3eb] p-3 text-xs text-[#111111] leading-relaxed">
          {{ activeDialog.impact }}
        </p>

        <div v-if="activeDialog.hasReason" class="space-y-1.5">
          <label for="suspend-reason-input" class="block text-[11px] font-bold uppercase tracking-wider text-[#60605e]">
            Alasan Penangguhan (Opsional)
          </label>
          <textarea
            id="suspend-reason-input"
            :value="suspendReason"
            rows="3"
            :disabled="activeDialog.loading"
            placeholder="Tuliskan alasan penangguhan untuk catatan audit..."
            @input="emit('update:suspendReason', $event.target.value)"
            class="w-full rounded-[10px] border-[1.5px] border-[#111111] bg-[#fcfcfb] px-3 py-2 text-xs font-medium text-[#111111] placeholder:text-[#60605e]/70 focus:outline-none focus:ring-2 focus:ring-[#20afff] disabled:opacity-60"
          />
        </div>

        <div
          v-if="modalError"
          role="alert"
          class="rounded-[14px] border-[1.5px] border-[#111111] bg-[#ffcae6] px-3.5 py-2.5 flex items-center gap-2 text-xs font-bold text-[#111111]"
        >
          <AlertTriangle class="w-4 h-4 shrink-0" :stroke-width="2.2" />
          <span>{{ modalError }}</span>
        </div>

        <div class="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            :disabled="activeDialog.loading"
            @click="emit(activeDialog.closeEvent, false)"
            class="btn-keycap btn-keycap-sm btn-keycap-white px-4 py-2 text-xs"
          >
            Batal
          </button>
          <button
            type="button"
            :disabled="activeDialog.loading"
            @click="emit(activeDialog.confirmEvent)"
            class="btn-keycap btn-keycap-sm btn-keycap-pink px-4 py-2 text-xs"
          >
            <RotateCw v-if="activeDialog.loading" class="w-3.5 h-3.5 animate-spin text-[#111111]" :stroke-width="2.2" />
            <component :is="activeDialog.icon" v-else class="w-3.5 h-3.5 text-[#111111]" :stroke-width="2.2" />
            <span>{{ activeDialog.confirmLabel }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
