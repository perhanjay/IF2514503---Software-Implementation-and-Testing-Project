import { ref } from 'vue'
import axios from 'axios'

/**
 * Encapsulate admin user support drawer fetching, mutations, and stale-response guards.
 */
export function useUserSupportActions(props, emit, { onSuspendSuccess, onRevokeSuccess } = {}) {
  const userData = ref(null)
  const loading = ref(false)
  const fetchError = ref('')
  const notice = ref(null)
  const modalError = ref('')
  const statusLoading = ref(false)
  const tokenLoading = ref(false)
  const revokeLoading = ref(false)
  const adjustmentFormRef = ref(null)
  let fetchRequestId = 0

  async function fetchUserDetail({ clearNotice = true } = {}) {
    const targetId = props.userId
    if (!targetId) return
    const reqId = ++fetchRequestId
    loading.value = true
    fetchError.value = ''
    if (clearNotice) notice.value = null
    try {
      const res = await axios.get(`/api/v1/admin/users/${targetId}`)
      if (reqId !== fetchRequestId || !props.isOpen || props.userId !== targetId) return
      userData.value = res.data.user
    } catch (err) {
      if (reqId !== fetchRequestId || !props.isOpen || props.userId !== targetId) return
      fetchError.value = err.response?.data?.error || 'Gagal memuat rincian pengguna'
    } finally {
      if (reqId === fetchRequestId) loading.value = false
    }
  }

  async function runAction(loadingRef, fallbackErr, fn, { useModalError = false } = {}) {
    const targetUserId = props.userId
    if (!targetUserId) return
    const isActiveTarget = () => props.isOpen && props.userId === targetUserId
    loadingRef.value = true
    if (useModalError) modalError.value = ''
    else notice.value = null
    try {
      await fn(targetUserId, isActiveTarget)
      emit('user-updated')
    } catch (err) {
      if (isActiveTarget()) {
        const msg = err.response?.data?.error || fallbackErr
        if (useModalError) modalError.value = msg
        else notice.value = { isError: true, text: msg }
      }
    } finally {
      loadingRef.value = false
    }
  }

  function updateUserStatus(payload, okMsg, failMsg, { isSuspend = false } = {}) {
    return runAction(statusLoading, failMsg, async (id, isActiveTarget) => {
      const res = await axios.patch(`/api/v1/admin/users/${id}/status`, payload)
      if (!isActiveTarget()) return
      if (userData.value) {
        Object.assign(userData.value, {
          status: res.data.user.status,
          statusReason: res.data.user.statusReason ?? null
        })
      }
      if (isSuspend) onSuspendSuccess?.()
      notice.value = { isError: false, text: res.data.message || okMsg }
    }, { useModalError: isSuspend })
  }

  function confirmSuspend(reason) {
    return updateUserStatus(
      { status: 'SUSPENDED', reason: reason.trim() || undefined },
      'Akun pengguna berhasil ditangguhkan',
      'Gagal menangguhkan akun pengguna',
      { isSuspend: true }
    )
  }

  function reactivateAccount() {
    return updateUserStatus(
      { status: 'ACTIVE' },
      'Akun pengguna berhasil diaktifkan kembali',
      'Gagal mengaktifkan kembali akun pengguna'
    )
  }

  function adjustTokens(payload) {
    const targetUserId = props.userId
    if (!targetUserId) return
    return runAction(tokenLoading, 'Gagal memproses penyesuaian token', async (id, isActiveTarget) => {
      const res = await axios.post(`/api/v1/admin/users/${id}/tokens`, payload)
      if (!isActiveTarget()) return
      adjustmentFormRef.value?.resetForm()
      await fetchUserDetail({ clearNotice: false })
      if (isActiveTarget()) {
        notice.value = { isError: false, text: res.data.message || 'Penyesuaian token berhasil diproses' }
      }
    })
  }

  function confirmRevokeSessions() {
    return runAction(revokeLoading, 'Gagal mencabut sesi aktif pengguna', async (id, isActiveTarget) => {
      const res = await axios.post(`/api/v1/admin/users/${id}/revoke-sessions`)
      if (!isActiveTarget()) return
      onRevokeSuccess?.()
      notice.value = { isError: false, text: res.data.message || 'Semua sesi pengguna telah berhasil dicabut' }
    }, { useModalError: true })
  }

  function invalidateRequests({ clearData = false } = {}) {
    ++fetchRequestId
    loading.value = false
    if (clearData) {
      modalError.value = ''
      notice.value = null
      fetchError.value = ''
      userData.value = null
    }
  }

  return {
    userData,
    loading,
    fetchError,
    notice,
    modalError,
    statusLoading,
    tokenLoading,
    revokeLoading,
    adjustmentFormRef,
    fetchUserDetail,
    confirmSuspend,
    reactivateAccount,
    adjustTokens,
    confirmRevokeSessions,
    invalidateRequests
  }
}
