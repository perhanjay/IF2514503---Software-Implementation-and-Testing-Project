<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import axios from 'axios'
import { X, AlertTriangle, CheckCircle2, RotateCw } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
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

const userData = ref(null)
const loading = ref(false)
const fetchError = ref('')
const notice = ref(null)
const statusLoading = ref(false)
const tokenLoading = ref(false)
const revokeLoading = ref(false)
const showSuspendModal = ref(false)
const showRevokeModal = ref(false)
const suspendReason = ref('')
const adjustmentFormRef = ref(null)

const isSelf = computed(() => !!authStore.user?.id && authStore.user.id === userData.value?.id)

async function fetchUserDetail({ clearNotice = true } = {}) {
  if (!props.userId) return
  loading.value = true
  fetchError.value = ''
  if (clearNotice) notice.value = null
  try {
    const res = await axios.get(`/api/v1/admin/users/${props.userId}`)
    userData.value = res.data.user
  } catch (err) {
    fetchError.value = err.response?.data?.error || 'Gagal memuat rincian pengguna'
  } finally {
    loading.value = false
  }
}

async function runAction(loadingRef, fallbackErr, fn) {
  loadingRef.value = true
  notice.value = null
  try {
    await fn()
    emit('user-updated')
  } catch (err) {
    notice.value = { isError: true, text: err.response?.data?.error || fallbackErr }
  } finally {
    loadingRef.value = false
  }
}

function openSuspendModal() {
  if (isSelf.value) return
  suspendReason.value = ''
  showSuspendModal.value = true
}

function confirmSuspend() {
  if (isSelf.value) return
  return runAction(statusLoading, 'Gagal menangguhkan akun pengguna', async () => {
    const res = await axios.patch(`/api/v1/admin/users/${props.userId}/status`, {
      status: 'SUSPENDED',
      reason: suspendReason.value.trim() || undefined
    })
    if (userData.value) Object.assign(userData.value, { status: res.data.user.status, statusReason: res.data.user.statusReason })
    showSuspendModal.value = false
    notice.value = { isError: false, text: res.data.message || 'Akun pengguna berhasil ditangguhkan' }
  })
}

function reactivateAccount() {
  return runAction(statusLoading, 'Gagal mengaktifkan kembali akun pengguna', async () => {
    const res = await axios.patch(`/api/v1/admin/users/${props.userId}/status`, { status: 'ACTIVE' })
    if (userData.value) Object.assign(userData.value, { status: res.data.user.status, statusReason: null })
    notice.value = { isError: false, text: res.data.message || 'Akun pengguna berhasil diaktifkan kembali' }
  })
}

function adjustTokens(payload) {
  return runAction(tokenLoading, 'Gagal memproses penyesuaian token', async () => {
    const res = await axios.post(`/api/v1/admin/users/${props.userId}/tokens`, payload)
    adjustmentFormRef.value?.resetForm()
    await fetchUserDetail({ clearNotice: false })
    notice.value = { isError: false, text: res.data.message || 'Penyesuaian token berhasil diproses' }
  })
}

function confirmRevokeSessions() {
  return runAction(revokeLoading, 'Gagal mencabut sesi aktif pengguna', async () => {
    const res = await axios.post(`/api/v1/admin/users/${props.userId}/revoke-sessions`)
    showRevokeModal.value = false
    notice.value = { isError: false, text: res.data.message || 'Semua sesi pengguna telah berhasil dicabut' }
  })
}

function handleBackdropClick() {
  if (statusLoading.value || revokeLoading.value) return
  emit('close')
}

function handleKeyDown(e) {
  if (e.key !== 'Escape') return
  if (showSuspendModal.value) {
    if (!statusLoading.value) showSuspendModal.value = false
  } else if (showRevokeModal.value) {
    if (!revokeLoading.value) showRevokeModal.value = false
  } else if (props.isOpen && !statusLoading.value && !revokeLoading.value) {
    emit('close')
  }
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    window.addEventListener('keydown', handleKeyDown)
    fetchUserDetail()
  } else {
    window.removeEventListener('keydown', handleKeyDown)
    showSuspendModal.value = false
    showRevokeModal.value = false
    notice.value = null
    fetchError.value = ''
    userData.value = null
  }
})

watch(() => props.userId, (newId) => {
  if (props.isOpen && newId) fetchUserDetail()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="drawer-headline">
      <div class="fixed inset-0 bg-[#111111]/45 backdrop-blur-xs transition-opacity cursor-pointer" aria-hidden="true" @click="handleBackdropClick" />
      <aside class="fixed inset-y-0 right-0 w-full max-w-xl bg-[#fcfcfb] border-l-2 border-[#111111] shadow-[-6px_0_0_rgba(17,17,17,0.12)] z-50 overflow-y-auto flex flex-col font-sans selection:bg-[#ff82c2] selection:text-[#111111]">
        <header class="sticky top-0 z-10 bg-[#f5f3eb] border-b-2 border-[#111111] px-6 py-4 flex items-center justify-between gap-3">
          <h2 id="drawer-headline" class="font-editorial font-bold text-lg tracking-tight text-[#111111]">Kelola Pengguna</h2>
          <button type="button" title="Tutup (Esc)" aria-label="Tutup panel" @click="emit('close')" class="btn-keycap btn-keycap-mini btn-keycap-white w-8 h-8 shrink-0">
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
            <AdminAccountSecurityCard :status="userData.status" :status-reason="userData.statusReason || ''" :is-self="isSelf" :status-loading="statusLoading" :revoke-loading="revokeLoading" @request-suspend="openSuspendModal" @reactivate="reactivateAccount" @request-revoke="showRevokeModal = true" />
          </template>
        </div>

        <footer class="sticky bottom-0 z-10 bg-[#f5f3eb] border-t-2 border-[#111111] px-6 py-3 flex items-center justify-end">
          <button type="button" @click="emit('close')" class="btn-keycap btn-keycap-mini btn-keycap-white px-4 py-1.5 text-xs">Tutup</button>
        </footer>
      </aside>
    </div>
  </Teleport>

  <AdminSecurityConfirmModals v-model:show-suspend="showSuspendModal" v-model:show-revoke="showRevokeModal" v-model:suspend-reason="suspendReason" :user-name="userData?.name || ''" :status-loading="statusLoading" :revoke-loading="revokeLoading" @confirm-suspend="confirmSuspend" @confirm-revoke="confirmRevokeSessions" />
</template>
