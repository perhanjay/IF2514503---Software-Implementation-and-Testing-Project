<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { X, AlertTriangle, CheckCircle2, RotateCw } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useDialogFocus } from '../../composables/useDialogFocus'
import { useUserSupportActions } from '../../composables/useUserSupportActions'
import AdminUserOverviewCard from './AdminUserOverviewCard.vue'
import AdminTokenAdjustmentForm from './AdminTokenAdjustmentForm.vue'
import AdminUserLedgerSection from './AdminUserLedgerSection.vue'
import AdminAccountSecurityCard from './AdminAccountSecurityCard.vue'
import AdminSecurityConfirmModals from './AdminSecurityConfirmModals.vue'

const props = defineProps({
  userId: { type: String, default: null },
  isOpen: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'user-updated'])
const authStore = useAuthStore()

const showSuspendModal = ref(false)
const showRevokeModal = ref(false)
const suspendReason = ref('')
const drawerRef = ref(null)

const {
  userData, loading, fetchError, notice, modalError,
  statusLoading, tokenLoading, revokeLoading, adjustmentFormRef,
  fetchUserDetail, confirmSuspend, reactivateAccount, adjustTokens,
  confirmRevokeSessions, invalidateRequests
} = useUserSupportActions(props, emit, {
  onSuspendSuccess: () => setSuspendModal(false),
  onRevokeSuccess: () => setRevokeModal(false)
})

const isSelf = computed(() => !!authStore.user?.id && authStore.user.id === userData.value?.id)
const isMutating = computed(() => statusLoading.value || revokeLoading.value || tokenLoading.value)

useDialogFocus(() => props.isOpen, drawerRef)

function closeModals() {
  showSuspendModal.value = false
  showRevokeModal.value = false
  modalError.value = ''
}

function setSuspendModal(open) {
  if (open && (isSelf.value || isMutating.value)) return
  modalError.value = ''
  if (open) suspendReason.value = ''
  showSuspendModal.value = open
}

function setRevokeModal(open) {
  if (open && isMutating.value) return
  modalError.value = ''
  showRevokeModal.value = open
}

function handleConfirmSuspend() {
  if (isSelf.value) return
  return confirmSuspend(suspendReason.value)
}

function requestClose() {
  if (!isMutating.value) emit('close')
}

function handleKeyDown(e) {
  if (e.key !== 'Escape') return
  if (showSuspendModal.value) { if (!statusLoading.value) setSuspendModal(false) }
  else if (showRevokeModal.value) { if (!revokeLoading.value) setRevokeModal(false) }
  else if (props.isOpen && !isMutating.value) emit('close')
}

function resetDrawerState() {
  window.removeEventListener('keydown', handleKeyDown)
  closeModals()
  invalidateRequests({ clearData: true })
}

watch(() => [props.isOpen, props.userId], ([open, id], [prevOpen, prevId] = [false, null]) => {
  if (!open) { if (prevOpen) resetDrawerState(); return }
  if (!prevOpen) window.addEventListener('keydown', handleKeyDown)
  if (!id) { invalidateRequests(); userData.value = null; return }
  if (!prevOpen || id !== prevId) {
    if (id !== prevId) { closeModals(); userData.value = null }
    fetchUserDetail()
  }
})

onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="drawer-headline">
      <div class="fixed inset-0 bg-[#111111]/45 backdrop-blur-xs transition-opacity cursor-pointer" aria-hidden="true" @click="requestClose" />
      <aside ref="drawerRef" tabindex="-1" class="fixed inset-y-0 right-0 w-full max-w-xl bg-[#fcfcfb] border-l-2 border-[#111111] shadow-[-6px_0_0_rgba(17,17,17,0.12)] z-50 overflow-y-auto flex flex-col font-sans selection:bg-[#ff82c2] selection:text-[#111111] focus:outline-none">
        <header class="sticky top-0 z-10 bg-[#f5f3eb] border-b-2 border-[#111111] px-6 py-4 flex items-center justify-between gap-3">
          <h2 id="drawer-headline" class="font-editorial font-bold text-lg tracking-tight text-[#111111]">Kelola Pengguna</h2>
          <button type="button" title="Tutup (Esc)" aria-label="Tutup panel" :disabled="isMutating" @click="requestClose" class="btn-keycap btn-keycap-mini btn-keycap-white w-8 h-8 shrink-0">
            <X class="w-4 h-4 text-[#111111]" :stroke-width="2.2" />
          </button>
        </header>

        <div v-if="notice" :role="notice.isError ? 'alert' : 'status'" :class="notice.isError ? 'bg-[#ffcae6]' : 'bg-[#d8f3dc]'" class="mx-6 mt-4 rounded-[14px] border-[1.5px] border-[#111111] px-3.5 py-2.5 text-xs font-bold text-[#111111] flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <AlertTriangle v-if="notice.isError" class="w-4 h-4 shrink-0" :stroke-width="2.2" />
            <CheckCircle2 v-else class="w-4 h-4 shrink-0" :stroke-width="2.2" />
            <span>{{ notice.text }}</span>
          </div>
          <button type="button" :aria-label="notice.isError ? 'Tutup pesan galat' : 'Tutup pesan sukses'" @click="notice = null" class="p-0.5 cursor-pointer"><X class="w-3.5 h-3.5" /></button>
        </div>

        <div class="p-6 space-y-5 flex-1">
          <div v-if="loading && !userData" aria-busy="true" aria-label="Memuat rincian pengguna" class="space-y-4">
            <div class="h-44 rounded-[18px] border-2 border-[#111111]/15 bg-[#eaeef4] animate-pulse" />
            <div class="h-56 rounded-[18px] border-2 border-[#111111]/15 bg-[#eaeef4] animate-pulse" />
            <div class="h-40 rounded-[18px] border-2 border-[#111111]/15 bg-[#eaeef4] animate-pulse" />
          </div>

          <div v-else-if="fetchError" role="alert" class="rounded-[18px] border-2 border-[#111111] bg-[#ffcae6]/55 shadow-[3px_4px_0_#111111] p-6 text-center space-y-3">
            <AlertTriangle class="w-6 h-6 text-[#111111] mx-auto" :stroke-width="2.2" />
            <p class="text-xs font-bold text-[#111111]">{{ fetchError }}</p>
            <button type="button" @click="fetchUserDetail()" class="btn-keycap btn-keycap-mini btn-keycap-white px-4 py-2 text-xs">
              <RotateCw class="w-3.5 h-3.5" :stroke-width="2.2" />
              <span>Coba Lagi</span>
            </button>
          </div>

          <template v-else-if="userData">
            <AdminUserOverviewCard :user="userData" />
            <AdminTokenAdjustmentForm ref="adjustmentFormRef" :balance="userData.wallet?.balance ?? 0" :loading="tokenLoading" @submit="adjustTokens" />
            <AdminUserLedgerSection :transactions="userData.transactions || []" />
            <AdminAccountSecurityCard :status="userData.status" :status-reason="userData.statusReason || ''" :is-self="isSelf" :status-loading="statusLoading" :revoke-loading="revokeLoading" @request-suspend="setSuspendModal(true)" @reactivate="reactivateAccount" @request-revoke="setRevokeModal(true)" />
          </template>
        </div>

        <footer class="sticky bottom-0 z-10 bg-[#f5f3eb] border-t-2 border-[#111111] px-6 py-3 flex items-center justify-end">
          <button type="button" :disabled="isMutating" @click="requestClose" class="btn-keycap btn-keycap-mini btn-keycap-white px-4 py-1.5 text-xs">Tutup</button>
        </footer>
      </aside>
    </div>
  </Teleport>

  <AdminSecurityConfirmModals :show-suspend="showSuspendModal" :show-revoke="showRevokeModal" v-model:suspend-reason="suspendReason" :user-name="userData?.name || ''" :status-loading="statusLoading" :revoke-loading="revokeLoading" :modal-error="modalError" @update:show-suspend="setSuspendModal" @update:show-revoke="setRevokeModal" @confirm-suspend="handleConfirmSuspend" @confirm-revoke="confirmRevokeSessions" />
</template>
