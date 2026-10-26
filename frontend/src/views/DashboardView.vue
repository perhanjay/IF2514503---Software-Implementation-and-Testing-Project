<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import AppNavbar from '../components/AppNavbar.vue'
import SectionBadge from '../components/SectionBadge.vue'
import UploadSessionModal from './UploadSessionModal.vue'
import TrackClassificationCard from '../components/TrackClassificationCard.vue'
import HealthScoreGauge from '../components/HealthScoreGauge.vue'
import DiagnosticTrackCard from '../components/DiagnosticTrackCard.vue'
import MultitrackAuditionPanel from '../components/audio/MultitrackAuditionPanel.vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const isGuest = computed(() => {
  return !authStore.user || authStore.user?.isGuest || authStore.user?.email === 'guest@polaris.audio'
})

const walletDetails = ref(null)
const claiming = ref(false)
const claimMsg = ref('')
const claimError = ref('')

const expandedSessions = ref({})
const classificationDetailsOpen = ref({})
const diagnosticDetailsOpen = ref({})

const classifyingSessionId = ref(null)
const pairTrackA = ref('')
const pairTrackB = ref('')
const pairType = ref('MIC_PAIR')
const isPairing = ref(false)
const finalizingSessionId = ref(null)

const diagnosingSessionId = ref(null)
const diagnosticResults = ref({})

const editingSessionId = ref(null)
const editTitleInput = ref('')
const isSavingTitle = ref(false)

const sessionToDelete = ref(null)
const isDeletingSession = ref(false)

const repairingSessionId = ref(null)
const showCustomRepairModal = ref(false)
const activeRepairSession = ref(null)
const customRepairSettings = ref({})

const auditionDetailsOpen = ref({})

const sessions = ref([])
const showUploadModal = ref(false)
const verifyingSessionId = ref(null)
const verificationResult = ref(null)

const notification = ref(null)
let notificationTimeout = null

function notify(message, type = 'info') {
  if (notificationTimeout) clearTimeout(notificationTimeout)
  notification.value = { message, type }
  notificationTimeout = setTimeout(() => {
    notification.value = null
  }, 5000)
}

function dismissNotification() {
  if (notificationTimeout) clearTimeout(notificationTimeout)
  notification.value = null
}

async function loadWallet() {
  try {
    const res = await axios.get('/api/v1/wallet/details')
    walletDetails.value = res.data
    authStore.updateBalance(res.data.balance)
  } catch (err) {
    console.warn('Wallet not loaded', err)
  }
}

async function loadSessions() {
  try {
    const res = await axios.get('/api/v1/sessions')
    sessions.value = res.data.sessions
  } catch (err) {
    console.warn('Sessions not loaded', err)
  }
}

async function handleClaimDaily() {
  if (isGuest.value) {
    notify('Silakan daftar akun atau masuk untuk mengklaim bonus token harian', 'info')
    router.push('/register')
    return
  }

  claimMsg.value = ''
  claimError.value = ''
  claiming.value = true
  try {
    const res = await axios.post('/api/v1/wallet/claim-daily')
    claimMsg.value = res.data.message
    await loadWallet()
  } catch (err) {
    claimError.value = err.response?.data?.error || 'Gagal klaim token harian'
  } finally {
    claiming.value = false
  }
}

async function handleVerify(session) {
  verifyingSessionId.value = session.id
  verificationResult.value = null
  try {
    const res = await axios.post(`/api/v1/sessions/${session.id}/verify-integrity`)
    verificationResult.value = {
      sessionId: session.id,
      ...res.data.verificationSummary
    }
  } catch (err) {
    notify(err.response?.data?.error || 'Gagal memverifikasi sinkronisasi sesi', 'error')
  } finally {
    verifyingSessionId.value = null
  }
}

function getTrackPairInfo(session, trackId) {
  if (!session?.trackPairs) return null
  return session.trackPairs.find(p => p.trackAId === trackId || p.trackBId === trackId)
}

function getPairedTrack(session, trackId) {
  const pair = getTrackPairInfo(session, trackId)
  if (!pair || !session.tracks) return null
  const otherId = pair.trackAId === trackId ? pair.trackBId : pair.trackAId
  return session.tracks.find(t => t.id === otherId)
}

function getTrackDiagnostic(session, track) {
  if (track?.diagnosticResult) return track.diagnosticResult
  const cached = diagnosticResults.value[session?.id]?.tracksDiagnostics
  if (!cached) return null
  return cached.find(t => t.trackId === track?.id) || null
}

async function handleClassify(session) {
  classifyingSessionId.value = session.id
  try {
    await axios.post(`/api/v1/sessions/${session.id}/classify`)
    expandedSessions.value[session.id] = true
    classificationDetailsOpen.value[session.id] = true
    await loadSessions()
  } catch (err) {
    notify(err.response?.data?.error || 'Gagal menjalankan klasifikasi AI', 'error')
  } finally {
    classifyingSessionId.value = null
  }
}

async function handleUpdateTrackLabel(sessionId, { trackId, label }) {
  try {
    await axios.patch(`/api/v1/sessions/${sessionId}/tracks/${trackId}/label`, { label })
    await loadSessions()
  } catch (err) {
    notify('Gagal memperbarui label trek', 'error')
  }
}

async function handleUnpair(sessionId, pairId) {
  if (!pairId) return
  try {
    await axios.delete(`/api/v1/sessions/${sessionId}/pairs/${pairId}`)
    await loadSessions()
  } catch (err) {
    notify('Gagal melepas pasangan trek', 'error')
  }
}

async function handleCreatePair(sessionId) {
  if (!pairTrackA.value || !pairTrackB.value) {
    notify('Pilih kedua trek audio yang ingin dihubungkan', 'info')
    return
  }
  if (pairTrackA.value === pairTrackB.value) {
    notify('Trek A dan Trek B tidak boleh sama', 'error')
    return
  }
  isPairing.value = true
  try {
    await axios.post(`/api/v1/sessions/${sessionId}/pairs`, {
      trackAId: pairTrackA.value,
      trackBId: pairTrackB.value,
      pairType: pairType.value
    })
    pairTrackA.value = ''
    pairTrackB.value = ''
    await loadSessions()
  } catch (err) {
    notify(err.response?.data?.error || 'Gagal membuat pasangan trek', 'error')
  } finally {
    isPairing.value = false
  }
}

async function handleFinalizeClassification(sessionId) {
  finalizingSessionId.value = sessionId
  try {
    await axios.post(`/api/v1/sessions/${sessionId}/finalize-classification`)
    classificationDetailsOpen.value[sessionId] = false
    const sessionObj = sessions.value.find(s => s.id === sessionId)
    if (sessionObj) {
      await handleDiagnose(sessionObj)
    } else {
      await loadSessions()
    }
  } catch (err) {
    notify('Gagal mengonfirmasi klasifikasi', 'error')
  } finally {
    finalizingSessionId.value = null
  }
}

async function handleDiagnose(session) {
  diagnosingSessionId.value = session.id
  try {
    const res = await axios.post(`/api/v1/sessions/${session.id}/diagnose`)
    diagnosticResults.value[session.id] = res.data
    expandedSessions.value[session.id] = true
    diagnosticDetailsOpen.value[session.id] = true
    await loadSessions()
  } catch (err) {
    notify(err.response?.data?.error || 'Gagal menjalankan pemindaian diagnostik DSP', 'error')
  } finally {
    diagnosingSessionId.value = null
  }
}

async function handleRepairAuto(session) {
  if (!session) return
  repairingSessionId.value = session.id
  try {
    const res = await axios.post(`/api/v1/sessions/${session.id}/repair-auto`)
    notify(res.data.message || 'Perbaikan otomatis DSP audio berhasil diterapkan!', 'success')
    
    // Update local reactive diagnostic and session state
    if (res.data.session) {
      const idx = sessions.value.findIndex(s => s.id === session.id)
      if (idx !== -1) sessions.value[idx] = res.data.session
    }
    if (diagnosticResults.value[session.id]) {
      diagnosticResults.value[session.id].sessionHealth = {
        health_score: res.data.session?.healthScore || res.data.sessionHealth?.health_score || 98,
        session_rating: 'EXCELLENT',
        rating_label: 'Optimal & Siap Mix',
        total_tracks: session.tracks?.length || 0,
        clean_tracks: session.tracks?.length || 0,
        warning_tracks: 0,
        critical_tracks: 0,
        estimated_tokens: 0
      }
      if (diagnosticResults.value[session.id].tracksDiagnostics) {
        for (const diag of diagnosticResults.value[session.id].tracksDiagnostics) {
          diag.healthStatus = 'Clean'
          diag.hasClipping = false
          diag.hasDcOffset = false
          diag.hasSubRumble = false
          diag.hasPolarityInvert = false
          diag.hasCombFiltering = false
          diag.hasFakeStereo = false
        }
      }
    }

    await loadSessions()
    await loadWallet()
  } catch (err) {
    notify(err.response?.data?.error || 'Gagal menerapkan perbaikan audio', 'error')
  } finally {
    repairingSessionId.value = null
  }
}

function openCustomRepairModal(session) {
  activeRepairSession.value = session
  const settings = {}
  for (const t of (session.tracks || [])) {
    const diag = getTrackDiagnostic(session, t) || {}
    settings[t.id] = {
      flipPolarity: Boolean(diag.hasPolarityInvert),
      alignDelay: Boolean(diag.hasCombFiltering),
      fixFakeStereo: Boolean(diag.hasFakeStereo),
      removeDcOffset: Boolean(diag.hasDcOffset),
      filterSubRumble: Boolean(diag.hasSubRumble),
      gainStaging: Boolean(diag.hasClipping || (diag.truePeakDbfs && diag.truePeakDbfs > -1.0))
    }
  }
  customRepairSettings.value = settings
  showCustomRepairModal.value = true
}

async function handleRepairCustom() {
  if (!activeRepairSession.value) return
  const sessionId = activeRepairSession.value.id
  repairingSessionId.value = sessionId
  try {
    const res = await axios.post(`/api/v1/sessions/${sessionId}/repair-custom`, {
      customSettings: customRepairSettings.value
    })
    notify(res.data.message || 'Perbaikan kustom DSP audio berhasil diterapkan!', 'success')
    showCustomRepairModal.value = false

    // Update local reactive diagnostic and session state
    if (res.data.session) {
      const idx = sessions.value.findIndex(s => s.id === sessionId)
      if (idx !== -1) sessions.value[idx] = res.data.session
    }
    if (diagnosticResults.value[sessionId]) {
      diagnosticResults.value[sessionId].sessionHealth = {
        health_score: res.data.session?.healthScore || res.data.sessionHealth?.health_score || 98,
        session_rating: 'EXCELLENT',
        rating_label: 'Optimal & Siap Mix',
        total_tracks: activeRepairSession.value.tracks?.length || 0,
        clean_tracks: activeRepairSession.value.tracks?.length || 0,
        warning_tracks: 0,
        critical_tracks: 0,
        estimated_tokens: 0
      }
      if (diagnosticResults.value[sessionId].tracksDiagnostics) {
        for (const diag of diagnosticResults.value[sessionId].tracksDiagnostics) {
          diag.healthStatus = 'Clean'
          diag.hasClipping = false
          diag.hasDcOffset = false
          diag.hasSubRumble = false
          diag.hasPolarityInvert = false
          diag.hasCombFiltering = false
          diag.hasFakeStereo = false
        }
      }
    }

    await loadSessions()
    await loadWallet()
  } catch (err) {
    notify(err.response?.data?.error || 'Gagal menerapkan perbaikan kustom', 'error')
  } finally {
    repairingSessionId.value = null
  }
}

// UC-17 & UC-18: Download ZIP & Report PDF Handlers
const downloadingZipId = ref(null)
const downloadingPdfId = ref(null)

async function handleDownloadZip(session) {
  if (!session) return
  downloadingZipId.value = session.id
  try {
    const res = await axios.get(`/api/v1/sessions/${session.id}/download`, {
      responseType: 'blob'
    })
    const blob = new Blob([res.data], { type: 'application/zip' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    
    let filename = `Polaris_Session_${(session.title || 'Session').replace(/[^a-zA-Z0-9_\-\.]/g, '_')}_Repaired.zip`
    const disposition = res.headers['content-disposition']
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/)
      if (match && match[1]) filename = match[1]
    }
    
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
    notify('Berkas arsip stem perbaikan (ZIP) berhasil diunduh.', 'success')
  } catch (err) {
    let errorMsg = 'Gagal mengunduh berkas ZIP hasil perbaikan'
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text()
        const parsed = JSON.parse(text)
        if (parsed.error) errorMsg = parsed.error
      } catch {}
    } else if (err.response?.data?.error) {
      errorMsg = err.response.data.error
    }
    notify(errorMsg, 'error')
  } finally {
    downloadingZipId.value = null
  }
}

async function handleDownloadReport(session) {
  if (!session) return
  downloadingPdfId.value = session.id
  try {
    const res = await axios.get(`/api/v1/sessions/${session.id}/report`, {
      responseType: 'blob'
    })
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    
    let filename = `Polaris_Audit_${(session.title || 'Session').replace(/[^a-zA-Z0-9_\-\.]/g, '_')}.pdf`
    const disposition = res.headers['content-disposition']
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/)
      if (match && match[1]) filename = match[1]
    }
    
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
    notify('Dokumen laporan audit PDF resmi berhasil diunduh.', 'success')
  } catch (err) {
    let errorMsg = 'Gagal mengunduh laporan audit PDF'
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text()
        const parsed = JSON.parse(text)
        if (parsed.error) errorMsg = parsed.error
      } catch {}
    } else if (err.response?.data?.error) {
      errorMsg = err.response.data.error
    }
    notify(errorMsg, 'error')
  } finally {
    downloadingPdfId.value = null
  }
}

const auditionInitialized = ref({})

function isAuditionDetailsOpen(sessionId) {
  return Boolean(auditionDetailsOpen.value[sessionId])
}

function toggleAuditionDetails(sessionId) {
  const willOpen = !isAuditionDetailsOpen(sessionId)
  auditionDetailsOpen.value[sessionId] = willOpen
  if (willOpen) {
    auditionInitialized.value[sessionId] = true
  }
}

function openAuditionSection(session) {
  if (!session) return
  expandedSessions.value[session.id] = true
  auditionDetailsOpen.value[session.id] = true
  auditionInitialized.value[session.id] = true
}

function countTrackChannels(session) {
  const stereo = session?.tracks?.filter(t => t.isStereo).length || 0
  const mono = session?.tracks?.filter(t => !t.isStereo).length || 0
  return { stereo, mono }
}

function isSessionExpanded(sessionId) {
  if (expandedSessions.value[sessionId] !== undefined) {
    return expandedSessions.value[sessionId]
  }
  return true
}

function toggleSession(sessionId) {
  expandedSessions.value[sessionId] = !isSessionExpanded(sessionId)
}

function isClassificationDetailsOpen(sessionId) {
  return Boolean(classificationDetailsOpen.value[sessionId])
}

function toggleClassificationDetails(sessionId) {
  classificationDetailsOpen.value[sessionId] = !isClassificationDetailsOpen(sessionId)
}

function isDiagnosticDetailsOpen(sessionId) {
  return Boolean(diagnosticDetailsOpen.value[sessionId])
}

function toggleDiagnosticDetails(sessionId) {
  diagnosticDetailsOpen.value[sessionId] = !isDiagnosticDetailsOpen(sessionId)
}

function startRename(session) {
  editingSessionId.value = session.id
  editTitleInput.value = session.title
}

function cancelRename() {
  editingSessionId.value = null
  editTitleInput.value = ''
}

async function saveRename(sessionId) {
  const trimmed = editTitleInput.value.trim()
  if (!trimmed) {
    notify('Judul sesi tidak boleh kosong', 'error')
    return
  }
  isSavingTitle.value = true
  try {
    await axios.patch(`/api/v1/sessions/${sessionId}/title`, { title: trimmed })
    const session = sessions.value.find(s => s.id === sessionId)
    if (session) session.title = trimmed
    editingSessionId.value = null
    notify('Judul sesi berhasil diperbarui', 'success')
  } catch (err) {
    notify(err.response?.data?.error || 'Gagal mengubah judul sesi', 'error')
  } finally {
    isSavingTitle.value = false
  }
}

function confirmDeleteSession(session) {
  sessionToDelete.value = session
}

async function handleDeleteSession() {
  if (!sessionToDelete.value) return
  isDeletingSession.value = true
  const id = sessionToDelete.value.id
  try {
    await axios.delete(`/api/v1/sessions/${id}`)
    notify('Sesi multitrack berhasil dihapus', 'success')
    sessionToDelete.value = null
    await loadSessions()
  } catch (err) {
    notify(err.response?.data?.error || 'Gagal menghapus sesi', 'error')
  } finally {
    isDeletingSession.value = false
  }
}

function getSessionHealthData(session) {
  if (session.status === 'REPAIRED') {
    const score = session.healthScore ?? 98
    let rating = 'EXCELLENT'
    let label = 'Optimal & Siap Mix'
    if (score < 65) {
      rating = 'CRITICAL'
      label = 'Kritis & Butuh Perbaikan Fasa'
    } else if (score < 90) {
      rating = 'WARNING'
      label = 'Perlu Penyesuaian'
    }

    const tracks = session.tracks || []
    return {
      health_score: score,
      session_rating: rating,
      rating_label: label,
      total_tracks: tracks.length,
      clean_tracks: tracks.length,
      warning_tracks: 0,
      critical_tracks: 0,
      estimated_tokens: 0
    }
  }

  const cached = diagnosticResults.value[session.id]?.sessionHealth
  if (cached) return cached

  const tracks = session.tracks || []
  const cleanCount = tracks.filter(t => t.diagnosticResult?.healthStatus === 'Clean').length
  const warningCount = tracks.filter(t => t.diagnosticResult?.healthStatus === 'Warning').length
  const criticalCount = tracks.filter(t => t.diagnosticResult?.healthStatus === 'Critical').length
  const score = session.healthScore ?? 100

  let rating = 'EXCELLENT'
  let label = 'Optimal & Siap Mix'
  if (score < 65) {
    rating = 'CRITICAL'
    label = 'Kritis & Butuh Perbaikan Fasa'
  } else if (score < 90) {
    rating = 'WARNING'
    label = 'Perlu Penyesuaian'
  }

  return {
    health_score: score,
    session_rating: rating,
    rating_label: label,
    total_tracks: tracks.length,
    clean_tracks: cleanCount,
    warning_tracks: warningCount,
    critical_tracks: criticalCount,
    estimated_tokens: session.estimatedTokens || 1
  }
}


function onSessionUploaded(newSession) {
  showUploadModal.value = false
  loadSessions()
}

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    try {
      const res = await axios.post('/api/v1/auth/guest-session')
      authStore.setAuth(res.data.user, res.data.token, res.data.wallet.balance)
    } catch (err) {
      console.warn('Guest initialization failed', err)
    }
  } else {
    await authStore.fetchMe()
  }
  await loadWallet()
  await loadSessions()
})
</script>

<template>
  <div class="min-h-screen bg-[#FAFAFA] text-slate-900 flex flex-col selection:bg-[#0052FF]/20 selection:text-[#0052FF]">
    <AppNavbar />

    <main class="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-8">
      
      <!-- Inline Toast / System Notification (R-27) -->
      <div 
        v-if="notification" 
        role="status" 
        aria-live="polite"
        :class="[
          'p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium transition-all shadow-sm',
          notification.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
          notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          'bg-blue-50 border-blue-200 text-blue-900'
        ]">
        <div class="flex items-center gap-2.5">
          <svg v-if="notification.type === 'error'" class="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <svg v-else-if="notification.type === 'success'" class="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg v-else class="w-4 h-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{{ notification.message }}</span>
        </div>
        <button 
          @click="dismissNotification"
          class="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors cursor-pointer"
          aria-label="Tutup pemberitahuan">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Studio Header / Banner -->
      <div class="bg-white border border-slate-200/90 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div class="space-y-1 max-w-2xl">
          <h1 class="font-display text-2xl sm:text-3xl text-slate-900">
            Studio Workspace
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-normal">
            Unggah stem multitrack, audit fasa multi-mikrofon, dan siapkan sesi mixing Anda.
          </p>
        </div>

        <div class="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full md:w-auto shrink-0">
          <button 
            @click="handleClaimDaily" 
            :disabled="claiming"
            class="h-10 px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap shrink-0">
            <svg class="w-4 h-4 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V4a2 2 0 114 0v4H8V4a2 2 0 114 0zm0 0H3.5a1.5 1.5 0 00-1.5 1.5v3A1.5 1.5 0 003.5 10H12m0-2h8.5a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5H12m0 0v11m-9-11h18" />
            </svg>
            <span>{{ claiming ? 'Mengklaim...' : 'Klaim Token Harian' }}</span>
          </button>

          <router-link 
            to="/billing"
            class="h-10 px-3.5 rounded-lg border border-slate-300 hover:border-[#0052FF] bg-white text-slate-800 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap shrink-0">
            <span class="font-mono-accent text-[#0052FF] font-bold">{{ authStore.walletBalance }} Token</span>
            <span class="text-slate-300">|</span>
            <span>Beli Kuota</span>
          </router-link>
          
          <button 
            @click="showUploadModal = true"
            class="h-10 px-4 rounded-lg bg-[#0052FF] hover:bg-[#0043D6] text-white text-xs font-semibold shadow-sm hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap shrink-0">
            <span class="text-base leading-none font-bold">+</span>
            <span>Unggah Sesi Baru</span>
          </button>
        </div>
      </div>

      <!-- Guest Upgrade Banner Warning (jika masih akun tamu) -->
      <div v-if="isGuest" class="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-2.5 text-blue-900">
          <svg class="w-4 h-4 text-[#0052FF] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Anda menggunakan <strong>Sesi Studio Instan</strong> (Jatah 3 Token Demo). Daftar akun gratis untuk menyimpan riwayat sesi secara permanen dan top-up kuota besar.</span>
        </div>
        <router-link to="/register" class="font-bold text-[#0052FF] hover:underline whitespace-nowrap">
          Daftar Akun Permanen
        </router-link>
      </div>

      <!-- Notifikasi Claim Feedback -->
      <div v-if="claimMsg" class="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-3.5 font-medium">
        {{ claimMsg }}
      </div>
      <div v-if="claimError" class="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-3.5 font-medium">
        {{ claimError }}
      </div>

      <!-- Sesi Multitrack Toolbar -->
      <div class="flex items-center justify-between px-1 pt-2">
        <div class="flex items-center gap-2.5">
          <h2 class="font-display text-lg text-slate-900">Sesi Multitrack</h2>
          <span class="font-mono-accent text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
            {{ sessions.length }} Sesi
          </span>
        </div>
        <button 
          @click="loadSessions"
          class="text-xs font-semibold text-[#0052FF] hover:underline cursor-pointer">
          Segarkan
        </button>
      </div>

      <!-- Empty State -->
      <div v-if="!sessions.length" class="border-2 border-dashed border-slate-200 bg-white rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
        <div class="w-14 h-14 rounded-2xl bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center">
          <svg class="w-7 h-7 text-[#0052FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12 0c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        <div class="space-y-1">
          <h3 class="font-display text-lg text-slate-800">Belum ada sesi multitrack</h3>
          <p class="text-xs text-slate-500 max-w-sm">
            Tarik berkas stem WAV atau ZIP rekaman DAW Anda untuk memulai proses verifikasi fasa otomatis.
          </p>
        </div>
        <button 
          @click="showUploadModal = true"
          class="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-xs shadow-sm hover:bg-slate-800 cursor-pointer transition-all mt-2">
          Unggah Stem Pertama
        </button>
      </div>

      <!-- Active Sessions Cards -->
      <div v-else class="space-y-4">
        <div 
          v-for="s in sessions" 
          :key="s.id"
          class="border border-slate-200 hover:border-slate-300 rounded-2xl p-5 sm:p-6 transition-all bg-white shadow-xs space-y-4">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="space-y-1">
                  <!-- Session Title with Inline Rename -->
                  <div v-if="editingSessionId === s.id" class="flex items-center gap-1.5 py-0.5">
                    <input 
                      v-model="editTitleInput" 
                      @keydown.enter="saveRename(s.id)"
                      @keydown.esc="cancelRename"
                      autofocus
                      class="font-display text-base sm:text-lg text-slate-900 bg-white border border-[#0052FF] rounded-lg px-2.5 py-1 focus:outline-none shadow-xs w-full max-w-xs"
                      placeholder="Nama judul sesi..."
                    />
                    <button 
                      @click="saveRename(s.id)"
                      :disabled="isSavingTitle"
                      class="p-2 rounded-lg bg-[#0052FF] hover:bg-[#0043D6] text-white transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                      title="Simpan Judul">
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button 
                      @click="cancelRename"
                      class="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer shrink-0"
                      title="Batal">
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div v-else class="flex items-center gap-2 group">
                    <h3 class="font-display text-lg text-slate-900">{{ s.title }}</h3>
                    <button 
                      @click="startRename(s)"
                      class="text-slate-400 hover:text-[#0052FF] p-1 rounded-md transition-colors cursor-pointer opacity-75 group-hover:opacity-100"
                      title="Ubah judul sesi">
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>

                  <!-- Subtitle Metadata: Stems breakdown with Stereo/Mono count -->
                  <div class="flex flex-wrap items-center gap-2 text-xs">
                    <span class="font-mono-accent text-[11px] text-slate-500">
                      {{ s.tracks?.length || 0 }} Stems Audio ({{ countTrackChannels(s).stereo }} Stereo, {{ countTrackChannels(s).mono }} Mono)
                    </span>
                    <span class="text-slate-300">•</span>
                    <span class="font-mono-accent text-[11px] px-2 py-0.5 rounded bg-[#0052FF]/10 text-[#0052FF] font-semibold">
                      {{ s.status }}
                    </span>
                    <span 
                      v-if="s.healthScore !== null"
                      :class="s.healthScore >= 90 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : (s.healthScore >= 65 ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-rose-100 text-rose-800 border-rose-300')"
                      class="font-mono-accent text-[11px] font-bold px-2 py-0.5 rounded-full border">
                      Mix Health: {{ Math.round(s.healthScore) }}/100
                    </span>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <button 
                    @click="handleVerify(s)"
                    :disabled="verifyingSessionId === s.id"
                    class="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:border-[#0052FF] text-slate-800 text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer">
                    <svg class="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span>{{ verifyingSessionId === s.id ? 'Memindai...' : 'Verifikasi Integritas' }}</span>
                  </button>

                  <button 
                    @click="handleClassify(s)"
                    :disabled="classifyingSessionId === s.id"
                    class="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:border-[#0052FF] text-slate-800 text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer">
                    <svg class="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>{{ classifyingSessionId === s.id ? 'AI Memproses...' : 'Deteksi Pasangan' }}</span>
                  </button>

                  <button 
                    @click="handleDiagnose(s)"
                    :disabled="diagnosingSessionId === s.id"
                    class="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#0052FF] hover:bg-[#0043D6] text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer">
                    <svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>{{ diagnosingSessionId === s.id ? 'DSP Menganalisis...' : 'Audit Fasa & DSP' }}</span>
                  </button>

                  <!-- UC-18: Unduh Laporan Audit PDF -->
                  <button 
                    v-if="s.healthScore !== null"
                    @click="handleDownloadReport(s)"
                    :disabled="downloadingPdfId === s.id"
                    title="Unduh dokumen laporan audit PDF resmi"
                    class="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:border-[#0052FF] text-slate-800 text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer">
                    <svg v-if="downloadingPdfId === s.id" class="animate-spin w-3.5 h-3.5 text-[#0052FF]" viewBox="0 0 24 24" fill="none">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <svg v-else class="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span>{{ downloadingPdfId === s.id ? 'Membuat PDF...' : 'Unduh Laporan Audit PDF' }}</span>
                  </button>

                  <!-- UC-17: Unduh Paket ZIP (Lossless) -->
                  <button 
                    v-if="s.status === 'REPAIRED'"
                    @click="handleDownloadZip(s)"
                    :disabled="downloadingZipId === s.id"
                    title="Unduh seluruh audio stem perbaikan dalam arsip ZIP lossless"
                    class="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer">
                    <svg v-if="downloadingZipId === s.id" class="animate-spin w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <svg v-else class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>{{ downloadingZipId === s.id ? 'Mengemas ZIP...' : 'Unduh Paket ZIP (Lossless)' }}</span>
                  </button>

                  <button 
                    v-if="s.status === 'REPAIRED'"
                    @click="openAuditionSection(s)"
                    class="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
                    title="Buka Studio Audisi Komparasi A/B">
                    <svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Audisi A/B</span>
                  </button>

                  <button 
                    @click="toggleSession(s.id)"
                    class="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer">
                    <span>{{ isSessionExpanded(s.id) ? 'Tutup Sesi' : 'Buka Sesi' }}</span>
                    <span class="text-[10px]">{{ isSessionExpanded(s.id) ? '▲' : '▼' }}</span>
                  </button>

                  <button 
                    @click="confirmDeleteSession(s)"
                    class="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-slate-300 hover:border-rose-300 text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer"
                    title="Hapus Sesi Multitrack">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Hapus Sesi</span>
                  </button>
                </div>
              </div>

              <!-- Expanded Session Content -->
              <div v-if="isSessionExpanded(s.id)" class="space-y-4 pt-2">

                <!-- Verification Result Card (Studio Workbench Theme) -->
                <div 
                  v-if="verificationResult && verificationResult.sessionId === s.id"
                  class="rounded-xl p-4 bg-slate-50/90 text-slate-900 border border-slate-200/90 space-y-2 animate-fade-in shadow-xs">
                  <div class="flex items-center justify-between">
                    <span class="font-mono-accent text-[11px] uppercase tracking-wider text-[#0052FF] font-bold">
                      Integritas Sesi: {{ verificationResult.status }}
                    </span>
                    <span class="font-mono-accent text-[10px] text-slate-500 font-semibold">
                      {{ verificationResult.sampleRateConsistency }}
                    </span>
                  </div>
                  <p class="text-xs text-slate-600 leading-relaxed font-normal">
                    {{ verificationResult.message }}
                  </p>
                </div>

                <!-- Step 1: Deteksi Pasangan & Klasifikasi Stem -->
                <div 
                  class="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 transition-all shadow-xs"
                  :class="{'space-y-4': !s.tracks?.some(t => t.detectedLabel) || isClassificationDetailsOpen(s.id)}">
                  <!-- Header -->
                  <div 
                    class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    :class="{'border-b border-slate-200/80 pb-3': !s.tracks?.some(t => t.detectedLabel) || isClassificationDetailsOpen(s.id)}">
                    <div class="flex items-center gap-2.5">
                      <div class="w-6 h-6 rounded-lg bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center font-bold text-xs shrink-0 font-mono-accent">
                        1
                      </div>
                      <div>
                        <h4 class="font-display text-base font-semibold text-slate-900">
                          Klasifikasi Stem & Deteksi Pasangan
                        </h4>
                      </div>
                    </div>

                    <!-- Status Badge & Action Controls -->
                    <div class="flex items-center gap-2 shrink-0">
                      <span 
                        v-if="s.tracks?.some(t => t.detectedLabel)"
                        class="font-mono-accent text-[11px] px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                        {{ s.trackPairs?.length || 0 }} Pasangan Terhubung
                      </span>
                      <span 
                        v-else 
                        class="font-mono-accent text-[11px] px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                        Belum Dijalankan
                      </span>

                      <!-- If unrun: action button -->
                      <button 
                        v-if="!s.tracks?.some(t => t.detectedLabel)"
                        @click="handleClassify(s)"
                        :disabled="classifyingSessionId === s.id"
                        class="px-3 py-1.5 rounded-lg bg-[#0052FF] hover:bg-[#0043D6] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5">
                        <svg v-if="classifyingSessionId === s.id" class="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                        </svg>
                        <span>{{ classifyingSessionId === s.id ? 'Memproses...' : 'Jalankan Deteksi AI' }}</span>
                      </button>

                      <!-- If run: toggle details button -->
                      <button 
                        v-else
                        @click="toggleClassificationDetails(s.id)"
                        class="px-3 py-1.5 rounded-lg border border-[#0052FF]/30 hover:border-[#0052FF] hover:bg-[#0052FF]/5 bg-white text-[#0052FF] text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5">
                        <span>{{ isClassificationDetailsOpen(s.id) ? 'Tutup' : 'Buka' }}</span>
                        <span class="text-[10px]">{{ isClassificationDetailsOpen(s.id) ? '▲' : '▼' }}</span>
                      </button>
                    </div>
                  </div>

                  <!-- Case 1: Unrun Empty Template -->
                  <div v-if="!s.tracks?.some(t => t.detectedLabel)" class="bg-white rounded-xl p-5 border border-dashed border-slate-200 text-center flex flex-col items-center justify-center space-y-2.5">
                    <div class="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12 0c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                    <div class="space-y-0.5 max-w-md">
                      <p class="text-xs font-semibold text-slate-800">Klasifikasi AI & Pasangan Belum Dijalankan</p>
                      <p class="text-[11px] text-slate-500 font-normal">
                        Model deep learning kami akan memprediksi kategori instrumen untuk tiap stem dan secara otomatis menghubungkan pasangan mikrofon yang rentan degradasi fasa.
                      </p>
                    </div>
                    <button 
                      @click="handleClassify(s)"
                      :disabled="classifyingSessionId === s.id"
                      class="mt-1 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer">
                      {{ classifyingSessionId === s.id ? 'Sedang Menganalisis Audio...' : 'Mulai Deteksi AI Sekarang' }}
                    </button>
                  </div>

                  <!-- Expanded Full Details -->
                  <div v-else-if="isClassificationDetailsOpen(s.id)" class="space-y-4 pt-1 animate-fade-in">
                    <!-- Stems List with TrackClassificationCard -->
                    <div class="space-y-2.5">
                      <TrackClassificationCard 
                        v-for="track in s.tracks" 
                        :key="track.id"
                        :track="track"
                        :paired-track="getPairedTrack(s, track.id)"
                        :pair-info="getTrackPairInfo(s, track.id)"
                        :available-tracks="s.tracks.filter(t => t.id !== track.id)"
                        @update-label="handleUpdateTrackLabel(s.id, $event)"
                        @unpair="handleUnpair(s.id, $event)"
                      />
                    </div>

                    <!-- Manual Pairing Form -->
                    <div class="bg-white border border-slate-200/90 rounded-xl p-4 space-y-3">
                      <span class="font-semibold text-xs text-slate-800 block">Hubungkan Pasangan Mikrofon Secara Manual</span>
                      <div class="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                        <select 
                          v-model="pairTrackA" 
                          class="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:border-[#0052FF]">
                          <option value="" disabled>Pilih Trek Pertama (A)</option>
                          <option v-for="t in s.tracks" :key="'a-' + t.id" :value="t.id">{{ t.fileName }}</option>
                        </select>
                        <select 
                          v-model="pairTrackB" 
                          class="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:border-[#0052FF]">
                          <option value="" disabled>Pilih Trek Kedua (B)</option>
                          <option v-for="t in s.tracks" :key="'b-' + t.id" :value="t.id">{{ t.fileName }}</option>
                        </select>
                        <select 
                          v-model="pairType" 
                          class="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:border-[#0052FF]">
                          <option value="MIC_PAIR">MIC_PAIR (Kick In/Sub)</option>
                          <option value="DRUM_TOP_BOTTOM">DRUM_TOP_BOTTOM (Snare Top/Bottom)</option>
                          <option value="BASS_DI_MIC">BASS_DI_MIC (Bass DI/Amp)</option>
                          <option value="STEREO_SPLIT">STEREO_SPLIT (L/R Split)</option>
                        </select>
                        <button 
                          @click="handleCreatePair(s.id)"
                          :disabled="isPairing || !pairTrackA || !pairTrackB"
                          class="py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5">
                          <span>Hubungkan</span>
                        </button>
                      </div>
                    </div>

                    <!-- Finalize CTA Button & Close Button -->
                    <div class="flex items-center justify-between pt-1">
                      <button 
                        @click="toggleClassificationDetails(s.id)"
                        class="text-xs text-[#0052FF] hover:underline font-semibold cursor-pointer">
                        Tutup ▲
                      </button>
                      <button 
                        @click="handleFinalizeClassification(s.id)"
                        :disabled="finalizingSessionId === s.id"
                        class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0052FF] hover:bg-[#0043D6] text-white font-semibold text-xs shadow-xs transition-all cursor-pointer">
                        <span>{{ finalizingSessionId === s.id ? 'Mengunci...' : 'Konfirmasi & Lanjut ke Audit Fasa' }}</span>
                        <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Step 2: Audit Diagnostik DSP & Kesehatan Fasa -->
                <div 
                  class="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 transition-all shadow-xs"
                  :class="{'space-y-4': (s.healthScore === null && !s.tracks?.some(t => t.diagnosticResult)) || isDiagnosticDetailsOpen(s.id)}">
                  <!-- Header -->
                  <div 
                    class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    :class="{'border-b border-slate-200/80 pb-3': (s.healthScore === null && !s.tracks?.some(t => t.diagnosticResult)) || isDiagnosticDetailsOpen(s.id)}">
                    <div class="flex items-center gap-2.5">
                      <div class="w-6 h-6 rounded-lg bg-emerald-600/10 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0 font-mono-accent">
                        2
                      </div>
                      <div>
                        <h4 class="font-display text-base font-semibold text-slate-900">
                          Audit Diagnostik DSP & Kesehatan Sesi
                        </h4>
                      </div>
                    </div>

                    <!-- Status Badge & Controls -->
                    <div class="flex items-center gap-2 shrink-0">
                      <span 
                        v-if="s.healthScore !== null"
                        :class="s.healthScore >= 90 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : (s.healthScore >= 65 ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-rose-50 text-rose-800 border-rose-200')"
                        class="font-mono-accent text-[11px] font-bold px-2.5 py-1 rounded-md border">
                        Mix Health: {{ Math.round(s.healthScore) }}/100
                      </span>
                      <span 
                        v-else 
                        class="font-mono-accent text-[11px] px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                        Belum Diaudit
                      </span>

                      <!-- If unrun: action button -->
                      <button 
                        v-if="s.healthScore === null && !s.tracks?.some(t => t.diagnosticResult)"
                        @click="handleDiagnose(s)"
                        :disabled="diagnosingSessionId === s.id"
                        class="px-3 py-1.5 rounded-lg bg-[#0052FF] hover:bg-[#0043D6] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5">
                        <svg v-if="diagnosingSessionId === s.id" class="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                        </svg>
                        <span>{{ diagnosingSessionId === s.id ? 'Menganalisis...' : 'Jalankan Audit DSP' }}</span>
                      </button>

                      <!-- If run: rescan + toggle details button -->
                      <div v-else class="flex items-center gap-2">
                        <button 
                          @click="handleDiagnose(s)"
                          :disabled="diagnosingSessionId === s.id"
                          class="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-700 text-xs font-medium cursor-pointer flex items-center gap-1.5 transition-all">
                          <svg class="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span class="hidden sm:inline">{{ diagnosingSessionId === s.id ? 'Memindai...' : 'Pindai Ulang' }}</span>
                        </button>

                        <button 
                          @click="toggleDiagnosticDetails(s.id)"
                          class="px-3 py-1.5 rounded-lg border border-[#0052FF]/30 hover:border-[#0052FF] hover:bg-[#0052FF]/5 bg-white text-[#0052FF] text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5">
                          <span>{{ isDiagnosticDetailsOpen(s.id) ? 'Tutup' : 'Buka' }}</span>
                          <span class="text-[10px]">{{ isDiagnosticDetailsOpen(s.id) ? '▲' : '▼' }}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Case 1: Unrun Empty Template -->
                  <div v-if="s.healthScore === null && !s.tracks?.some(t => t.diagnosticResult)" class="bg-white rounded-xl p-5 border border-dashed border-slate-200 text-center flex flex-col items-center justify-center space-y-2.5">
                    <div class="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div class="space-y-0.5 max-w-md">
                      <p class="text-xs font-semibold text-slate-800">Audit DSP & Fasa Belum Dilakukan</p>
                      <p class="text-[11px] text-slate-500 font-normal">
                        Jalankan audit diagnostik untuk mengidentifikasi pembatalan fasa multi-mikrofon, penumpukan frekuensi rendah (mud), dan true-peak clipping sebelum mixing.
                      </p>
                    </div>
                    <button 
                      @click="handleDiagnose(s)"
                      :disabled="diagnosingSessionId === s.id"
                      class="mt-1 px-4 py-2 rounded-lg bg-[#0052FF] hover:bg-[#0043D6] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer">
                      {{ diagnosingSessionId === s.id ? 'Sedang Memindai Audio...' : 'Jalankan Audit DSP Sekarang' }}
                    </button>
                  </div>

                  <!-- Expanded Full Details -->
                  <div v-else-if="isDiagnosticDetailsOpen(s.id)" class="space-y-5 pt-1 animate-fade-in">
                    <!-- Radial Gauge Meter Component -->
                    <HealthScoreGauge 
                      :score="getSessionHealthData(s).health_score"
                      :rating="getSessionHealthData(s).session_rating"
                      :rating-label="getSessionHealthData(s).rating_label"
                      :total-tracks="getSessionHealthData(s).total_tracks"
                      :clean-tracks="getSessionHealthData(s).clean_tracks"
                      :warning-tracks="getSessionHealthData(s).warning_tracks"
                      :critical-tracks="getSessionHealthData(s).critical_tracks"
                      :estimated-tokens="getSessionHealthData(s).estimated_tokens"
                    />

                    <!-- Stems Diagnostic Cards -->
                    <div class="space-y-3">
                      <div class="flex items-center justify-between">
                        <span class="font-display text-sm font-semibold text-slate-900">Stem Audio ({{ s.tracks?.length || 0 }})</span>
                      </div>

                      <DiagnosticTrackCard 
                        v-for="track in s.tracks" 
                        :key="'diag-' + track.id"
                        :track="track"
                        :diagnostic="getTrackDiagnostic(s, track)"
                        :paired-track="getPairedTrack(s, track.id)"
                        :pair-info="getTrackPairInfo(s, track.id)"
                      />
                    </div>

                    <!-- Action Panel: DSP Audio Fixer Engine -->
                    <div 
                      v-if="s.status === 'REPAIRED'"
                      class="rounded-xl p-5 bg-emerald-50 text-emerald-950 border border-emerald-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
                      <div class="space-y-1">
                        <div class="flex items-center gap-2">
                          <span class="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">✓</span>
                          <h5 class="font-display text-sm font-bold text-emerald-900">Perbaikan DSP Selesai Diterapkan</h5>
                          <span class="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold font-mono-accent">
                            Mix Ready
                          </span>
                        </div>
                        <p class="text-xs text-emerald-700 max-w-xl font-normal">
                          Seluruh anomali fasa, mikro-delay, DC offset, dan headroom clipping telah diperbaiki secara presisi dan lossless di MinIO S3.
                        </p>
                      </div>

                      <div class="flex items-center gap-2 shrink-0">
                        <button 
                          @click="openCustomRepairModal(s)"
                          class="px-3 py-2 rounded-lg bg-white hover:bg-emerald-100/50 text-emerald-800 border border-emerald-300 text-xs font-semibold shadow-2xs transition-all cursor-pointer">
                          Sesuaikan Ulang
                        </button>
                        <button 
                          @click="openAuditionSection(s)"
                          class="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5">
                          <svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Dengar Perbandingan A/B</span>
                        </button>
                      </div>
                    </div>

                    <div 
                      v-else
                      class="rounded-xl p-5 bg-white text-slate-900 border border-slate-200/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
                      <div class="space-y-1">
                        <div class="flex items-center gap-2">
                          <h5 class="font-display text-sm font-bold text-slate-900">Automated Audio Fixer</h5>
                          <span class="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-semibold font-mono-accent">
                            Siap Dijalankan
                          </span>
                        </div>
                        <p class="text-xs text-slate-500 max-w-xl font-normal">
                          Koreksi polaritas fasa 180°, penyelarasan micro-delay multi-mic, eliminasi DC offset, filter sub-rumble, dan normalisasi headroom -3 dBFS.
                        </p>
                      </div>

                      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                        <button 
                          @click="handleDownloadReport(s)"
                          :disabled="downloadingPdfId === s.id"
                          class="px-3.5 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5">
                          <svg class="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <span>{{ downloadingPdfId === s.id ? 'Membuat...' : 'Unduh Laporan PDF' }}</span>
                        </button>

                        <button 
                          v-if="s.status === 'REPAIRED'"
                          @click="handleDownloadZip(s)"
                          :disabled="downloadingZipId === s.id"
                          class="px-3.5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5">
                          <svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span>{{ downloadingZipId === s.id ? 'Mengemas...' : 'Unduh ZIP (Lossless)' }}</span>
                        </button>

                        <button 
                          @click="openCustomRepairModal(s)"
                          :disabled="repairingSessionId === s.id"
                          class="px-3.5 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer">
                          Kustomisasi Perbaikan
                        </button>

                        <button 
                          @click="handleRepairAuto(s)"
                          :disabled="repairingSessionId === s.id"
                          class="px-4 py-2.5 rounded-lg bg-[#0052FF] hover:bg-[#0043D6] disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2">
                          <svg v-if="repairingSessionId === s.id" class="animate-spin w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                          </svg>
                          <span>
                            {{ repairingSessionId === s.id ? 'Merender Audio DSP...' : `Terapkan Perbaikan (${getSessionHealthData(s).estimated_tokens} Token)` }}
                          </span>
                        </button>
                      </div>
                    </div>

                    <!-- Close Details Button at bottom of card -->
                    <div class="flex justify-end pt-1">
                      <button 
                        @click="toggleDiagnosticDetails(s.id)"
                        class="text-xs text-[#0052FF] hover:underline font-semibold cursor-pointer">
                        Tutup ▲
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Step 3: Studio Audisi Multitrack A/B & Analisis Fase -->
                <div 
                  class="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 transition-all shadow-xs"
                  :class="{'space-y-4': isAuditionDetailsOpen(s.id)}">
                  <!-- Header -->
                  <div 
                    class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    :class="{'border-b border-slate-200/80 pb-3': isAuditionDetailsOpen(s.id)}">
                    <div class="flex items-center gap-2.5">
                      <div class="w-6 h-6 rounded-lg bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center font-bold text-xs shrink-0 font-mono-accent">
                        3
                      </div>
                      <div>
                        <h4 class="font-display text-base font-semibold text-slate-900">
                          Studio Audisi Multitrack A/B & Analisis Fase
                        </h4>
                      </div>
                    </div>

                    <!-- Status Badge & Controls -->
                    <div class="flex items-center gap-2 shrink-0">
                      <span 
                        v-if="s.status === 'REPAIRED'"
                        class="font-mono-accent text-[11px] px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                        Komparasi A/B Tersedia
                      </span>
                      <span 
                        v-else 
                        class="font-mono-accent text-[11px] px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                        Mode Audio Mentah
                      </span>

                      <button 
                        @click="toggleAuditionDetails(s.id)"
                        class="px-3 py-1.5 rounded-lg border border-[#0052FF]/30 hover:border-[#0052FF] hover:bg-[#0052FF]/5 bg-white text-[#0052FF] text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5">
                        <span>{{ isAuditionDetailsOpen(s.id) ? 'Tutup' : 'Buka' }}</span>
                        <span class="text-[10px]">{{ isAuditionDetailsOpen(s.id) ? '▲' : '▼' }}</span>
                      </button>
                    </div>
                  </div>

                  <!-- Dropdown Content: Multitrack Audition Panel (Cached via v-show after first load) -->
                  <div v-if="auditionInitialized[s.id]" v-show="isAuditionDetailsOpen(s.id)" class="pt-2 space-y-3">
                    <MultitrackAuditionPanel :session="s" :is-open="isAuditionDetailsOpen(s.id)" />

                    <!-- Close Button at bottom of Step 3 -->
                    <div class="flex justify-end pt-1">
                      <button 
                        @click="toggleAuditionDetails(s.id)"
                        class="text-xs text-[#0052FF] hover:underline font-semibold cursor-pointer">
                        Tutup ▲
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
    </main>

    <!-- Upload Modal -->
    <UploadSessionModal 
      v-if="showUploadModal"
      @close="showUploadModal = false"
      @uploaded="onSessionUploaded"
    />

    <!-- Modal Konfirmasi Hapus Sesi -->
    <div 
      v-if="sessionToDelete" 
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
      @click.self="sessionToDelete = null">
      <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4">
        <div class="space-y-1">
          <h3 class="font-display text-lg font-bold text-slate-900">
            Apakah Anda Yakin
          </h3>
          <p class="text-xs text-slate-500 font-normal">
            Tindakan Ini Tidak Dapat Diulang
          </p>
        </div>

        <p class="text-xs text-slate-600 leading-relaxed font-normal">
          Sesi <span class="font-semibold text-slate-900 font-mono-accent">{{ sessionToDelete.name }}</span> beserta seluruh trek stem dan hasil analisisnya akan dihapus permanen.
        </p>

        <div class="flex items-center justify-end gap-2.5 pt-2">
          <button 
            @click="sessionToDelete = null"
            :disabled="isDeletingSession"
            class="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer">
            Batal
          </button>
          <button 
            @click="handleDeleteSession"
            :disabled="isDeletingSession"
            class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50">
            <svg v-if="isDeletingSession" class="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span>{{ isDeletingSession ? 'Menghapus...' : 'Ya' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Granular Custom Repair -->
    <div 
      v-if="showCustomRepairModal && activeRepairSession" 
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
      @click.self="showCustomRepairModal = false">
      <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <div>
            <h3 class="font-display text-lg font-bold text-slate-900">
              Kustomisasi Modul Perbaikan DSP
            </h3>
            <p class="text-xs text-slate-500 font-normal">
              Aktifkan atau nonaktifkan perbaikan spesifik per-track sesuai kebutuhan artistik mixing.
            </p>
          </div>
          <button 
            @click="showCustomRepairModal = false"
            class="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer">
            ✕
          </button>
        </div>

        <div class="space-y-4">
          <div 
            v-for="track in activeRepairSession.tracks" 
            :key="'custom-' + track.id"
            class="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <div class="flex items-center justify-between">
              <span class="font-mono-accent text-xs font-bold text-slate-900">{{ track.fileName }}</span>
              <span class="text-[11px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold font-mono-accent">
                {{ track.instrumentLabel || track.detectedLabel || 'Other' }}
              </span>
            </div>

            <div v-if="customRepairSettings[track.id]" class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              <label class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  v-model="customRepairSettings[track.id].flipPolarity"
                  class="rounded text-[#0052FF] focus:ring-0">
                <span>Invert Polaritas (180°)</span>
              </label>

              <label class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  v-model="customRepairSettings[track.id].alignDelay"
                  class="rounded text-[#0052FF] focus:ring-0">
                <span>Micro-Delay Align</span>
              </label>

              <label class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  v-model="customRepairSettings[track.id].fixFakeStereo"
                  class="rounded text-[#0052FF] focus:ring-0">
                <span>True Mono (Fake Stereo)</span>
              </label>

              <label class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  v-model="customRepairSettings[track.id].removeDcOffset"
                  class="rounded text-[#0052FF] focus:ring-0">
                <span>Buang DC Offset</span>
              </label>

              <label class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  v-model="customRepairSettings[track.id].filterSubRumble"
                  class="rounded text-[#0052FF] focus:ring-0">
                <span>Filter Sub-Rumble</span>
              </label>

              <label class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  v-model="customRepairSettings[track.id].gainStaging"
                  class="rounded text-[#0052FF] focus:ring-0">
                <span>Gain Staging (-3dB)</span>
              </label>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <button 
            @click="showCustomRepairModal = false"
            class="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer">
            Batal
          </button>
          <button 
            @click="handleRepairCustom"
            :disabled="repairingSessionId === activeRepairSession.id"
            class="px-4 py-2 bg-[#0052FF] hover:bg-[#0043D6] text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50">
            <svg v-if="repairingSessionId === activeRepairSession.id" class="animate-spin w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span>{{ repairingSessionId === activeRepairSession.id ? 'Memproses...' : 'Terapkan Perbaikan Kustom' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
