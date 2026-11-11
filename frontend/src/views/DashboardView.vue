<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
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
import { useStemAudioPlayer } from '../composables/useStemAudioPlayer'

const router = useRouter()
const authStore = useAuthStore()
const stemPlayer = useStemAudioPlayer()

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

onUnmounted(() => {
  stemPlayer.cleanup()
})
</script>

<template>
  <div class="min-h-screen bg-bone text-ink-black flex flex-col selection:bg-hot-pink selection:text-ink-black font-editorial">
    <AppNavbar :fluid="true" />

    <main class="flex-1 w-full max-w-[1800px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-6 md:py-8 space-y-8">
      
      <!-- Inline Toast / System Notification (R-27) -->
      <div 
        v-if="notification" 
        role="status" 
        aria-live="polite"
        :class="[
          'p-4 border-2 flex items-center justify-between gap-3 text-xs font-semibold font-mono-accent transition-all',
          notification.type === 'error' ? 'bg-[#FFF1F2] border-[#FDA4AF] text-rose-950' :
          notification.type === 'success' ? 'bg-[#ECFDF5] border-[#6EE7B7] text-emerald-950' :
          'bg-paper-white border-ink-black text-ink-black'
        ]">
        <div class="flex items-center gap-2.5">
          <svg v-if="notification.type === 'error'" class="w-4 h-4 text-rose-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <svg v-else-if="notification.type === 'success'" class="w-4 h-4 text-emerald-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg v-else class="w-4 h-4 text-ink-black shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{{ notification.message }}</span>
        </div>
        <button 
          @click="dismissNotification"
          class="text-stone hover:text-ink-black p-1 transition-colors cursor-pointer"
          aria-label="Tutup pemberitahuan">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Studio Header / Banner (Seamless, blends into background) -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-2 px-1">
        <div>
          <h1 class="font-editorial text-2xl sm:text-3xl font-bold text-ink-black tracking-tight">
            Studio Workspace
          </h1>
        </div>

        <div class="flex items-center gap-2.5 shrink-0">
          <router-link
            v-if="authStore.user?.role === 'ADMIN'"
            to="/admin/users"
            class="text-xs font-semibold uppercase tracking-wider text-slate hover:text-ink-black transition-colors"
          >
            Admin: Users
          </router-link>
          <button 
            @click="showUploadModal = true"
            class="btn-ink-stamp h-10 px-5 text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap shrink-0">
            <span class="text-base leading-none font-bold">+</span>
            <span>Unggah Sesi Baru</span>
          </button>
        </div>
      </div>

      <!-- Guest Upgrade Banner Warning (jika masih akun tamu) -->
      <div v-if="isGuest" class="bg-paper-white border-2 border-stone p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-2.5 text-ink-black">
          <svg class="w-4 h-4 text-[#0052FF] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Anda menggunakan <strong>Sesi Studio Instan</strong> (Jatah 3 Token Demo). Daftar akun gratis untuk menyimpan riwayat sesi secara permanen dan top-up kuota besar.</span>
        </div>
        <router-link to="/register" class="font-bold text-ink-black underline underline-offset-4 hover:text-[#0052FF] whitespace-nowrap font-mono-accent">
          Daftar Akun Permanen →
        </router-link>
      </div>

      <!-- Notifikasi Claim Feedback -->
      <div v-if="claimMsg" class="bg-[#ECFDF5] border border-[#6EE7B7] text-emerald-950 text-xs p-3.5 font-semibold font-mono-accent">
        {{ claimMsg }}
      </div>
      <div v-if="claimError" class="bg-amber-50 border border-amber-300 text-amber-950 text-xs p-3.5 font-semibold font-mono-accent">
        {{ claimError }}
      </div>

      <!-- Sesi Multitrack Toolbar -->
      <div class="flex items-center justify-between px-1 pt-2">
        <div class="flex items-center gap-2.5">
          <h2 class="font-editorial text-xl font-bold text-ink-black tracking-tight">Sesi Multitrack</h2>
          <span class="font-mono-accent text-[11px] px-2 py-0.5 border border-stone bg-paper-white text-ink-black font-semibold">
            {{ sessions.length }} Sesi
          </span>
        </div>
        <button 
          @click="loadSessions"
          class="text-xs font-mono-accent font-bold text-ink-black hover:underline cursor-pointer">
          Segarkan
        </button>
      </div>

      <!-- Empty State -->
      <div v-if="!sessions.length" class="border-2 border-dashed border-stone bg-paper-white p-12 text-center flex flex-col items-center justify-center space-y-4">
        <div class="w-14 h-14 bg-bone border border-stone text-ink-black flex items-center justify-center">
          <svg class="w-7 h-7 text-ink-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12 0c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        <div class="space-y-1">
          <h3 class="font-editorial text-lg font-bold text-ink-black">Belum ada sesi multitrack</h3>
          <p class="text-xs text-stone max-w-sm">
            Tarik berkas stem WAV atau ZIP rekaman DAW Anda untuk memulai proses verifikasi fasa otomatis.
          </p>
        </div>
        <button 
          @click="showUploadModal = true"
          class="btn-ink-stamp px-6 py-2.5 text-xs font-semibold cursor-pointer transition-all mt-2">
          Unggah Stem Pertama
        </button>
      </div>

      <!-- Active Sessions Cards -->
      <div v-else class="space-y-4">
        <div 
          v-for="s in sessions" 
          :key="s.id"
          class="border border-stone hover:border-ink-black transition-all bg-paper-white overflow-hidden">
          
          <!-- Session Header: Always covers 100% of the top or the closed card -->
          <div 
            @click="toggleSession(s.id)"
            class="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-bone/40 transition-colors"
            :class="{'border-b border-stone/60': isSessionExpanded(s.id)}">
            <div class="space-y-1">
              <!-- Session Title with Inline Rename -->
              <div v-if="editingSessionId === s.id" @click.stop class="flex items-center gap-1.5 py-0.5">
                <input 
                  v-model="editTitleInput" 
                  @keydown.enter="saveRename(s.id)"
                  @keydown.esc="cancelRename"
                  autofocus
                  class="font-editorial text-base sm:text-lg font-bold text-ink-black bg-paper-white border-2 border-ink-black px-2.5 py-1 focus:outline-none w-full max-w-xs"
                  placeholder="Nama judul sesi..."
                />
                <button 
                  @click="saveRename(s.id)"
                  :disabled="isSavingTitle"
                  class="p-2 bg-ink-black hover:bg-slate text-paper-white transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                  title="Simpan Judul">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button 
                  @click="cancelRename"
                  class="p-2 border border-stone hover:bg-bone text-stone transition-colors cursor-pointer shrink-0"
                  title="Batal">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div v-else class="flex items-center gap-2 group">
                <h3 class="font-editorial text-lg sm:text-xl font-bold text-ink-black tracking-tight">{{ s.title }}</h3>
                <button 
                  @click.stop="startRename(s)"
                  class="text-stone hover:text-ink-black p-1 transition-colors cursor-pointer opacity-75 group-hover:opacity-100"
                  title="Ubah judul sesi">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button 
                @click.stop="toggleSession(s.id)"
                class="inline-flex items-center gap-1.5 px-3 py-2 bg-bone hover:bg-stone/20 text-ink-black border border-stone text-xs font-semibold transition-all cursor-pointer font-mono-accent">
                <span>{{ isSessionExpanded(s.id) ? 'Tutup Sesi' : 'Buka Sesi' }}</span>
                <span class="text-[10px]">{{ isSessionExpanded(s.id) ? '▲' : '▼' }}</span>
              </button>

              <button 
                @click.stop="confirmDeleteSession(s)"
                class="inline-flex items-center gap-1.5 px-3 py-2 bg-paper-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-stone hover:border-rose-400 text-xs font-semibold transition-all cursor-pointer font-mono-accent"
                title="Hapus Sesi Multitrack">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Hapus Sesi</span>
              </button>
            </div>
          </div>

          <!-- Expanded Session Content -->
          <div v-if="isSessionExpanded(s.id)" class="p-5 sm:p-6 space-y-4 pt-4">

                <!-- Verification Result Card (Studio Workbench Theme) -->
                <div 
                  v-if="verificationResult && verificationResult.sessionId === s.id"
                  class="p-4 bg-bone text-ink-black border border-stone space-y-2 animate-fade-in">
                  <div class="flex items-center justify-between">
                    <span class="font-mono-accent text-[11px] uppercase tracking-wider text-ink-black font-bold">
                      Integritas Sesi: {{ verificationResult.status }}
                    </span>
                    <span class="font-mono-accent text-[10px] text-stone font-semibold">
                      {{ verificationResult.sampleRateConsistency }}
                    </span>
                  </div>
                  <p class="text-xs text-ink-black leading-relaxed font-mono-accent">
                    {{ verificationResult.message }}
                  </p>
                </div>

                <!-- Step 1: Deteksi Pasangan & Klasifikasi Stem -->
                <div 
                  class="border border-stone bg-paper-white transition-all overflow-hidden">
                  <!-- Header -->
                  <div 
                    @click="s.tracks?.some(t => t.detectedLabel) && toggleClassificationDetails(s.id)"
                    class="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none"
                    :class="[
                      {'border-b border-stone/60': !s.tracks?.some(t => t.detectedLabel) || isClassificationDetailsOpen(s.id)},
                      s.tracks?.some(t => t.detectedLabel) ? 'cursor-pointer hover:bg-bone/40 transition-colors' : ''
                    ]">
                    <div class="flex items-center gap-2.5">
                      <div class="w-6 h-6 bg-ink-black text-paper-white flex items-center justify-center font-bold text-xs shrink-0 font-mono-accent">
                        1
                      </div>
                      <div>
                        <h4 class="font-editorial text-base font-bold text-ink-black tracking-tight">
                          Klasifikasi Stem & Deteksi Pasangan
                        </h4>
                      </div>
                    </div>

                    <!-- Status Badge & Action Controls -->
                    <div class="flex items-center gap-2 shrink-0">
                      <span 
                        v-if="!s.tracks?.some(t => t.detectedLabel)" 
                        class="font-mono-accent text-[11px] px-2.5 py-1 bg-bone text-stone border border-stone font-medium">
                        Belum Dijalankan
                      </span>

                      <!-- If unrun: action button -->
                      <button 
                        v-if="!s.tracks?.some(t => t.detectedLabel)"
                        @click.stop="handleClassify(s)"
                        :disabled="classifyingSessionId === s.id"
                        class="btn-ink-stamp text-xs px-3 py-1.5 flex items-center gap-1.5 font-mono-accent">
                        <svg v-if="classifyingSessionId === s.id" class="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                        </svg>
                        <span>{{ classifyingSessionId === s.id ? 'Memproses...' : 'Jalankan Deteksi AI' }}</span>
                      </button>

                      <!-- If run: toggle details button -->
                      <button 
                        v-else
                        @click.stop="toggleClassificationDetails(s.id)"
                        class="px-3 py-1.5 border border-stone hover:border-ink-black bg-paper-white text-ink-black text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 font-mono-accent">
                        <span>{{ isClassificationDetailsOpen(s.id) ? 'Tutup' : 'Buka' }}</span>
                        <span class="text-[10px]">{{ isClassificationDetailsOpen(s.id) ? '▲' : '▼' }}</span>
                      </button>
                    </div>
                  </div>

                  <!-- Case 1: Unrun Empty Template -->
                  <div v-if="!s.tracks?.some(t => t.detectedLabel)" class="m-5 bg-bone p-5 border border-dashed border-stone text-center flex flex-col items-center justify-center space-y-2.5">
                    <div class="w-10 h-10 bg-paper-white border border-stone text-ink-black flex items-center justify-center">
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12 0c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                    <div class="space-y-0.5 max-w-md">
                      <p class="text-xs font-bold text-ink-black font-editorial">Klasifikasi AI & Pasangan Belum Dijalankan</p>
                      <p class="text-[11px] text-stone font-normal">
                        Model deep learning kami akan memprediksi kategori instrumen untuk tiap stem dan secara otomatis menghubungkan pasangan mikrofon yang rentan degradasi fasa.
                      </p>
                    </div>
                    <button 
                      @click="handleClassify(s)"
                      :disabled="classifyingSessionId === s.id"
                      class="btn-ink-stamp text-xs px-4 py-2 mt-1 font-mono-accent">
                      {{ classifyingSessionId === s.id ? 'Sedang Menganalisis Audio...' : 'Mulai Deteksi AI Sekarang' }}
                    </button>
                  </div>

                  <!-- Expanded Full Details -->
                  <div v-else-if="isClassificationDetailsOpen(s.id)" class="p-5 space-y-4 pt-4 animate-fade-in">
                    <!-- Stems List with TrackClassificationCard (Unified Seamless List) -->
                    <div class="divide-y divide-stone/40 border-b border-stone/60">
                      <TrackClassificationCard 
                        v-for="track in s.tracks" 
                        :key="track.id"
                        :track="track"
                        :session-id="s.id"
                        :paired-track="getPairedTrack(s, track.id)"
                        :pair-info="getTrackPairInfo(s, track.id)"
                        :available-tracks="s.tracks.filter(t => t.id !== track.id)"
                        @update-label="handleUpdateTrackLabel(s.id, $event)"
                        @unpair="handleUnpair(s.id, $event)"
                      />
                    </div>

                    <!-- Manual Pairing Form (Seamless, Borderless) -->
                    <div class="pt-2 space-y-2">
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-xs text-ink-black font-editorial">Hubungkan Pasangan Mikrofon Secara Manual</span>
                      </div>
                      <div class="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                        <select 
                          v-model="pairTrackA" 
                          class="text-xs bg-paper-white border border-stone px-2.5 py-2 text-ink-black focus:outline-none focus:border-ink-black font-mono-accent">
                          <option value="" disabled>Pilih Trek Pertama (A)</option>
                          <option v-for="t in s.tracks" :key="'a-' + t.id" :value="t.id">{{ t.fileName }}</option>
                        </select>
                        <select 
                          v-model="pairTrackB" 
                          class="text-xs bg-paper-white border border-stone px-2.5 py-2 text-ink-black focus:outline-none focus:border-ink-black font-mono-accent">
                          <option value="" disabled>Pilih Trek Kedua (B)</option>
                          <option v-for="t in s.tracks" :key="'b-' + t.id" :value="t.id">{{ t.fileName }}</option>
                        </select>
                        <select 
                          v-model="pairType" 
                          class="text-xs bg-paper-white border border-stone px-2.5 py-2 text-ink-black focus:outline-none focus:border-ink-black font-mono-accent">
                          <option value="MIC_PAIR">MIC_PAIR (Kick In/Sub)</option>
                          <option value="DRUM_TOP_BOTTOM">DRUM_TOP_BOTTOM (Snare Top/Bottom)</option>
                          <option value="BASS_DI_MIC">BASS_DI_MIC (Bass DI/Amp)</option>
                          <option value="STEREO_SPLIT">STEREO_SPLIT (L/R Split)</option>
                        </select>
                        <button 
                          @click="handleCreatePair(s.id)"
                          :disabled="isPairing || !pairTrackA || !pairTrackB"
                          class="btn-ink-stamp text-xs py-2 px-3 flex items-center justify-center font-mono-accent disabled:opacity-50">
                          <span>Hubungkan</span>
                        </button>
                      </div>
                    </div>

                    <!-- Finalize CTA Button -->
                    <div class="flex items-center justify-end pt-1">
                      <button 
                        @click="handleFinalizeClassification(s.id)"
                        :disabled="finalizingSessionId === s.id"
                        class="btn-ink-stamp text-xs px-5 py-2.5 flex items-center gap-2 font-mono-accent">
                        <span>{{ finalizingSessionId === s.id ? 'Mengunci...' : 'Konfirmasi & Lanjut ke Audit Fasa' }}</span>
                        <svg class="w-4 h-4 text-paper-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Step 2: Audit Diagnostik DSP & Kesehatan Fasa -->
                <div 
                  class="border border-stone bg-paper-white transition-all overflow-hidden">
                  <!-- Header -->
                  <div 
                    @click="!(s.healthScore === null && !s.tracks?.some(t => t.diagnosticResult)) && toggleDiagnosticDetails(s.id)"
                    class="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none"
                    :class="[
                      {'border-b border-stone/60': (s.healthScore === null && !s.tracks?.some(t => t.diagnosticResult)) || isDiagnosticDetailsOpen(s.id)},
                      !(s.healthScore === null && !s.tracks?.some(t => t.diagnosticResult)) ? 'cursor-pointer hover:bg-bone/40 transition-colors' : ''
                    ]">
                    <div class="flex items-center gap-2.5">
                      <div class="w-6 h-6 bg-ink-black text-paper-white flex items-center justify-center font-bold text-xs shrink-0 font-mono-accent">
                        2
                      </div>
                      <div>
                        <h4 class="font-editorial text-base font-bold text-ink-black tracking-tight">
                          Audit Diagnostik DSP & Kesehatan Sesi
                        </h4>
                      </div>
                    </div>

                    <!-- Status Badge & Controls -->
                    <div class="flex items-center gap-2 shrink-0">
                      <span 
                        v-if="s.healthScore === null && !s.tracks?.some(t => t.diagnosticResult)" 
                        class="font-mono-accent text-[11px] px-2.5 py-1 bg-bone text-stone border border-stone font-medium">
                        Belum Diaudit
                      </span>

                      <!-- If unrun: action button -->
                      <button 
                        v-if="s.healthScore === null && !s.tracks?.some(t => t.diagnosticResult)"
                        @click.stop="handleDiagnose(s)"
                        :disabled="diagnosingSessionId === s.id"
                        class="btn-ink-stamp text-xs px-3 py-1.5 flex items-center gap-1.5 font-mono-accent">
                        <svg v-if="diagnosingSessionId === s.id" class="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                        </svg>
                        <span>{{ diagnosingSessionId === s.id ? 'Menganalisis...' : 'Jalankan Audit DSP' }}</span>
                      </button>

                      <!-- If run: toggle details button -->
                      <button 
                        v-else
                        @click.stop="toggleDiagnosticDetails(s.id)"
                        class="px-3 py-1.5 border border-stone hover:border-ink-black bg-paper-white text-ink-black text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 font-mono-accent">
                        <span>{{ isDiagnosticDetailsOpen(s.id) ? 'Tutup' : 'Buka' }}</span>
                        <span class="text-[10px]">{{ isDiagnosticDetailsOpen(s.id) ? '▲' : '▼' }}</span>
                      </button>
                    </div>
                  </div>

                  <!-- Case 1: Unrun Empty Template -->
                  <div v-if="s.healthScore === null && !s.tracks?.some(t => t.diagnosticResult)" class="m-5 bg-bone p-5 border border-dashed border-stone text-center flex flex-col items-center justify-center space-y-2.5">
                    <div class="w-10 h-10 bg-paper-white border border-stone text-ink-black flex items-center justify-center">
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div class="space-y-0.5 max-w-md">
                      <p class="text-xs font-bold text-ink-black font-editorial">Audit DSP & Fasa Belum Dilakukan</p>
                      <p class="text-[11px] text-stone font-normal">
                        Jalankan audit diagnostik untuk mengidentifikasi pembatalan fasa multi-mikrofon, penumpukan frekuensi rendah (mud), dan true-peak clipping sebelum mixing.
                      </p>
                    </div>
                    <button 
                      @click="handleDiagnose(s)"
                      :disabled="diagnosingSessionId === s.id"
                      class="btn-ink-stamp text-xs px-4 py-2 mt-1 font-mono-accent">
                      {{ diagnosingSessionId === s.id ? 'Sedang Memindai Audio...' : 'Jalankan Audit DSP Sekarang' }}
                    </button>
                  </div>

                  <!-- Expanded Full Details -->
                  <div v-else-if="isDiagnosticDetailsOpen(s.id)" class="p-5 space-y-5 pt-4 animate-fade-in">
                    <!-- Score Component with Integrated Rescan Button -->
                    <HealthScoreGauge 
                      :score="getSessionHealthData(s).health_score"
                      :rating="getSessionHealthData(s).session_rating"
                      :rating-label="getSessionHealthData(s).rating_label"
                      :total-tracks="getSessionHealthData(s).total_tracks"
                      :clean-tracks="getSessionHealthData(s).clean_tracks"
                      :warning-tracks="getSessionHealthData(s).warning_tracks"
                      :critical-tracks="getSessionHealthData(s).critical_tracks"
                      :estimated-tokens="getSessionHealthData(s).estimated_tokens"
                      :is-rescanning="diagnosingSessionId === s.id"
                      @rescan="handleDiagnose(s)"
                    />

                    <!-- Stems Diagnostic Cards (Flat, Seamless) -->
                    <div class="divide-y divide-stone/40 border-y border-stone/60">
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
                      class="pt-3 border-t border-stone/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div class="space-y-1">
                        <div class="flex items-center gap-2">
                          <span class="w-6 h-6 bg-emerald-700 text-white flex items-center justify-center text-xs font-bold font-mono-accent">✓</span>
                          <h5 class="font-editorial text-sm font-bold text-ink-black">Perbaikan DSP Selesai Diterapkan</h5>
                        </div>
                      </div>

                      <div class="flex items-center gap-2 shrink-0">
                        <button 
                          @click="openCustomRepairModal(s)"
                          class="px-3 py-2 bg-paper-white hover:bg-bone text-ink-black border border-stone text-xs font-semibold transition-all cursor-pointer font-mono-accent">
                          Sesuaikan Ulang
                        </button>
                        <button 
                          @click="openAuditionSection(s)"
                          class="px-3.5 py-2 bg-ink-black hover:bg-slate text-paper-white text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 font-mono-accent border border-ink-black">
                          <svg class="w-3.5 h-3.5 text-paper-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Dengar Perbandingan A/B</span>
                        </button>
                      </div>
                    </div>

                    <div 
                      v-else
                      class="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                      <button 
                        @click="openCustomRepairModal(s)"
                        :disabled="repairingSessionId === s.id"
                        class="px-3.5 py-2.5 border border-stone hover:border-ink-black hover:bg-bone bg-paper-white text-ink-black text-xs font-semibold transition-all cursor-pointer font-mono-accent">
                        Kustomisasi Perbaikan
                      </button>

                      <button 
                        @click="handleRepairAuto(s)"
                        :disabled="repairingSessionId === s.id"
                        class="btn-ink-stamp text-xs px-5 py-2.5 flex items-center justify-center gap-2 font-mono-accent">
                        <svg v-if="repairingSessionId === s.id" class="animate-spin w-3.5 h-3.5 text-paper-white" viewBox="0 0 24 24" fill="none">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                        </svg>
                        <span>
                          {{ repairingSessionId === s.id ? 'Merender Audio DSP...' : `Terapkan Perbaikan (${getSessionHealthData(s).estimated_tokens} Token)` }}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Step 3: Studio Audisi Multitrack A/B & Analisis Fase -->
                <div 
                  class="border border-stone bg-paper-white transition-all overflow-hidden">
                  <!-- Header -->
                  <div 
                    @click="toggleAuditionDetails(s.id)"
                    class="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-bone/40 transition-colors"
                    :class="{'border-b border-stone/60': isAuditionDetailsOpen(s.id)}">
                    <div class="flex items-center gap-2.5">
                      <div class="w-6 h-6 bg-ink-black text-paper-white flex items-center justify-center font-bold text-xs shrink-0 font-mono-accent">
                        3
                      </div>
                      <div>
                        <h4 class="font-editorial text-base font-bold text-ink-black tracking-tight">
                          Studio Audisi Multitrack A/B & Analisis Fase
                        </h4>
                      </div>
                    </div>

                    <!-- Section Toggle Button -->
                    <div class="flex items-center gap-2 shrink-0">
                      <button 
                        @click.stop="toggleAuditionDetails(s.id)"
                        class="px-3 py-1.5 border border-stone hover:border-ink-black bg-paper-white text-ink-black text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 font-mono-accent">
                        <span>{{ isAuditionDetailsOpen(s.id) ? 'Tutup' : 'Buka' }}</span>
                        <span class="text-[10px]">{{ isAuditionDetailsOpen(s.id) ? '▲' : '▼' }}</span>
                      </button>
                    </div>
                  </div>

                  <!-- Dropdown Content: Multitrack Audition Panel (Cached via v-show after first load) -->
                  <div v-if="auditionInitialized[s.id]" v-show="isAuditionDetailsOpen(s.id)" class="p-5 pt-3 space-y-3">
                    <MultitrackAuditionPanel :session="s" :is-open="isAuditionDetailsOpen(s.id)" />
                  </div>
                </div>

                <!-- Deliverables Actions Bar: Unduh Laporan PDF & Unduh Paket ZIP (Lossless) -->
                <div class="flex flex-wrap items-center justify-end gap-3 pt-1">
                  <button 
                    @click="handleDownloadReport(s)"
                    :disabled="downloadingPdfId === s.id"
                    class="px-4 py-2.5 border border-stone hover:border-ink-black hover:bg-bone bg-paper-white text-ink-black text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 font-mono-accent"
                    title="Unduh ringkasan audit audio DSP dalam format dokumen PDF">
                    <svg class="w-3.5 h-3.5 text-rose-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span>{{ downloadingPdfId === s.id ? 'Membuat...' : 'Unduh Laporan PDF' }}</span>
                  </button>

                  <button 
                    v-if="s.status === 'REPAIRED'"
                    @click="handleDownloadZip(s)"
                    :disabled="downloadingZipId === s.id"
                    class="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 font-mono-accent border border-emerald-800"
                    title="Unduh seluruh audio stem perbaikan dalam arsip ZIP lossless">
                    <svg v-if="downloadingZipId === s.id" class="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <svg v-else class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>{{ downloadingZipId === s.id ? 'Mengemas ZIP...' : 'Unduh Paket ZIP (Lossless)' }}</span>
                  </button>
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
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-black/60 backdrop-blur-xs animate-fade-in"
      @click.self="sessionToDelete = null">
      <div class="bg-paper-white border-2 border-ink-black max-w-sm w-full p-6 space-y-4">
        <div class="space-y-1">
          <h3 class="font-editorial text-lg font-bold text-ink-black tracking-tight">
            Apakah Anda Yakin
          </h3>
          <p class="text-xs text-stone font-normal">
            Tindakan Ini Tidak Dapat Diulang
          </p>
        </div>

        <p class="text-xs text-ink-black leading-relaxed font-normal">
          Sesi <span class="font-bold text-ink-black font-mono-accent">{{ sessionToDelete.title || sessionToDelete.name }}</span> beserta seluruh trek stem dan hasil analisisnya akan dihapus permanen.
        </p>

        <div class="flex items-center justify-end gap-2.5 pt-2">
          <button 
            @click="sessionToDelete = null"
            :disabled="isDeletingSession"
            class="px-4 py-2 bg-paper-white hover:bg-bone text-ink-black border border-stone text-xs font-semibold transition-all cursor-pointer font-mono-accent">
            Batal
          </button>
          <button 
            @click="handleDeleteSession"
            :disabled="isDeletingSession"
            class="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 font-mono-accent border border-rose-800">
            <svg v-if="isDeletingSession" class="animate-spin w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span>{{ isDeletingSession ? 'Menghapus...' : 'Ya, Hapus' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Granular Custom Repair -->
    <div 
      v-if="showCustomRepairModal && activeRepairSession" 
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-black/60 backdrop-blur-xs animate-fade-in"
      @click.self="showCustomRepairModal = false">
      <div class="bg-paper-white border-2 border-ink-black max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b border-stone/60 pb-3">
          <div>
            <h3 class="font-editorial text-xl font-bold text-ink-black tracking-tight">
              Kustomisasi Modul Perbaikan DSP
            </h3>
            <p class="text-xs text-stone font-normal">
              Aktifkan atau nonaktifkan perbaikan spesifik per-track sesuai kebutuhan artistik mixing.
            </p>
          </div>
          <button 
            @click="showCustomRepairModal = false"
            class="text-stone hover:text-ink-black text-base font-bold p-1 cursor-pointer font-mono-accent">
            ✕
          </button>
        </div>

        <div class="space-y-4">
          <div 
            v-for="track in activeRepairSession.tracks" 
            :key="'custom-' + track.id"
            class="p-4 border border-stone bg-bone space-y-3">
            <div class="flex items-center justify-between">
              <span class="font-mono-accent text-xs font-bold text-ink-black">{{ track.fileName }}</span>
              <span class="text-[11px] px-2 py-0.5 border border-stone bg-paper-white text-ink-black font-semibold font-mono-accent">
                {{ track.instrumentLabel || track.detectedLabel || 'Other' }}
              </span>
            </div>

            <div v-if="customRepairSettings[track.id]" class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              <label class="flex items-center gap-2 text-xs text-ink-black cursor-pointer font-mono-accent font-medium">
                <input 
                  type="checkbox" 
                  v-model="customRepairSettings[track.id].flipPolarity"
                  class="accent-ink-black cursor-pointer">
                <span>Invert Polaritas (180°)</span>
              </label>

              <label class="flex items-center gap-2 text-xs text-ink-black cursor-pointer font-mono-accent font-medium">
                <input 
                  type="checkbox" 
                  v-model="customRepairSettings[track.id].alignDelay"
                  class="accent-ink-black cursor-pointer">
                <span>Micro-Delay Align</span>
              </label>

              <label class="flex items-center gap-2 text-xs text-ink-black cursor-pointer font-mono-accent font-medium">
                <input 
                  type="checkbox" 
                  v-model="customRepairSettings[track.id].fixFakeStereo"
                  class="accent-ink-black cursor-pointer">
                <span>True Mono (Fake Stereo)</span>
              </label>

              <label class="flex items-center gap-2 text-xs text-ink-black cursor-pointer font-mono-accent font-medium">
                <input 
                  type="checkbox" 
                  v-model="customRepairSettings[track.id].removeDcOffset"
                  class="accent-ink-black cursor-pointer">
                <span>Buang DC Offset</span>
              </label>

              <label class="flex items-center gap-2 text-xs text-ink-black cursor-pointer font-mono-accent font-medium">
                <input 
                  type="checkbox" 
                  v-model="customRepairSettings[track.id].filterSubRumble"
                  class="accent-ink-black cursor-pointer">
                <span>Filter Sub-Rumble</span>
              </label>

              <label class="flex items-center gap-2 text-xs text-ink-black cursor-pointer font-mono-accent font-medium">
                <input 
                  type="checkbox" 
                  v-model="customRepairSettings[track.id].gainStaging"
                  class="accent-ink-black cursor-pointer">
                <span>Gain Staging (-3dB)</span>
              </label>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-stone/60">
          <button 
            @click="showCustomRepairModal = false"
            class="px-4 py-2 bg-paper-white hover:bg-bone text-ink-black border border-stone text-xs font-semibold transition-all cursor-pointer font-mono-accent">
            Batal
          </button>
          <button 
            @click="handleRepairCustom"
            :disabled="repairingSessionId === activeRepairSession.id"
            class="btn-ink-stamp text-xs px-5 py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 font-mono-accent">
            <svg v-if="repairingSessionId === activeRepairSession.id" class="animate-spin w-3.5 h-3.5 text-paper-white" viewBox="0 0 24 24" fill="none">
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
