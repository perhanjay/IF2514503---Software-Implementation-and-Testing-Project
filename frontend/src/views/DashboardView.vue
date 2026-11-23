<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import {
  Plus,
  RefreshCw,
  Pencil,
  Check,
  X,
  Trash2,
  FileText,
  Download,
  PlayCircle,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Music2,
  Activity,
  Headphones
} from 'lucide-vue-next'
import AppNavbar from '../components/AppNavbar.vue'
import UploadSessionModal from './UploadSessionModal.vue'
import TrackClassificationCard from '../components/TrackClassificationCard.vue'
import HealthScoreGauge from '../components/HealthScoreGauge.vue'
import DiagnosticTrackCard from '../components/DiagnosticTrackCard.vue'
import MultitrackAuditionPanel from '../components/audio/MultitrackAuditionPanel.vue'
import DeleteSessionModal from '../components/workspace/DeleteSessionModal.vue'
import CustomRepairModal from '../components/workspace/CustomRepairModal.vue'
import RetroSelect from '../components/ui/RetroSelect.vue'
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
const activeStepTab = ref({})
const classificationDetailsOpen = ref({})
const diagnosticDetailsOpen = ref({})

const classifyingSessionId = ref(null)
const pairTrackA = ref('')
const pairTrackB = ref('')
const pairType = ref('MIC_PAIR')
const isPairing = ref(false)
const finalizingSessionId = ref(null)

const pairTypeOptions = [
  { label: 'Pasangan Mic (Kick In/Sub)', value: 'MIC_PAIR' },
  { label: 'Snare Top / Bottom', value: 'DRUM_TOP_BOTTOM' },
  { label: 'Bass DI / Amp', value: 'BASS_DI_MIC' },
  { label: 'Stereo Split (L/R)', value: 'STEREO_SPLIT' }
]

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

function isSessionClassified(session) {
  return Boolean(session?.tracks?.some(t => t.detectedLabel))
}

function isSessionAudited(session) {
  return !(session?.healthScore === null && !session?.tracks?.some(t => t.diagnosticResult))
}

function getActiveStepTab(session) {
  const saved = activeStepTab.value[session.id]
  if (saved) return saved
  return isSessionAudited(session) ? 2 : 1
}

function scrollSessionToTop(sessionId) {
  nextTick(() => {
    const el = document.getElementById(`session-card-${sessionId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  })
}

function setActiveStepTab(sessionId, step) {
  activeStepTab.value[sessionId] = step
  if (step === 1) {
    classificationDetailsOpen.value[sessionId] = true
  } else if (step === 2) {
    diagnosticDetailsOpen.value[sessionId] = true
  } else if (step === 3) {
    auditionInitialized.value[sessionId] = true
    auditionDetailsOpen.value[sessionId] = true
  }
}

async function handleClassify(session) {
  classifyingSessionId.value = session.id
  try {
    await axios.post(`/api/v1/sessions/${session.id}/classify`)
    expandedSessions.value[session.id] = true
    setActiveStepTab(session.id, 1)
    await loadSessions()
    scrollSessionToTop(session.id)
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
    setActiveStepTab(sessionId, 2)
    scrollSessionToTop(sessionId)
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
    setActiveStepTab(session.id, 2)
    await loadSessions()
    scrollSessionToTop(session.id)
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
    scrollSessionToTop(session.id)
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
    scrollSessionToTop(sessionId)
  } catch (err) {
    notify(err.response?.data?.error || 'Gagal menerapkan perbaikan kustom', 'error')
  } finally {
    repairingSessionId.value = null
  }
}

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

function openAuditionSection(session) {
  if (!session) return
  expandedSessions.value[session.id] = true
  setActiveStepTab(session.id, 3)
  scrollSessionToTop(session.id)
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

const sessionFolderTabs = [
  {
    step: 1,
    num: '01',
    label: 'Klasifikasi & Pasangan',
    glassBg: 'rgba(32, 175, 255, 0.86)'
  },
  {
    step: 2,
    num: '02',
    label: 'Audit Diagnostik DSP',
    glassBg: 'rgba(255, 218, 64, 0.90)'
  },
  {
    step: 3,
    num: '03',
    label: 'Studio Audisi A/B',
    glassBg: 'rgba(90, 211, 99, 0.86)'
  }
]

function getActiveFolderMeta(session) {
  const step = getActiveStepTab(session)
  return sessionFolderTabs.find(t => t.step === step) || sessionFolderTabs[0]
}

function handleFolderTabKeyDown(e, sessionId, currentStep) {
  let targetStep = null
  if (e.key === 'ArrowRight') {
    targetStep = currentStep === 3 ? 1 : currentStep + 1
  } else if (e.key === 'ArrowLeft') {
    targetStep = currentStep === 1 ? 3 : currentStep - 1
  } else if (e.key === 'Home') {
    targetStep = 1
  } else if (e.key === 'End') {
    targetStep = 3
  }
  if (!targetStep) return
  e.preventDefault()
  setActiveStepTab(sessionId, targetStep)
  const el = document.getElementById(`session-tab-${sessionId}-${targetStep}`)
  if (el) el.focus()
}

function getSessionStatusPill(session) {
  if (session.status === 'REPAIRED') {
    return {
      label: 'Siap Mixing',
      classes: 'bg-[#5ad363] text-[#111111] border-[#111111] shadow-[1px_1.5px_0_#111111]'
    }
  }
  if (isSessionAudited(session)) {
    const score = getSessionHealthData(session).health_score
    return {
      label: `Audit ${Math.round(score)}/100`,
      classes: score >= 90
        ? 'bg-[#5ad363] text-[#111111] border-[#111111] shadow-[1px_1.5px_0_#111111]'
        : score >= 65
          ? 'bg-[#ffda40] text-[#111111] border-[#111111] shadow-[1px_1.5px_0_#111111]'
          : 'bg-[#ff82c2] text-[#111111] border-[#111111] shadow-[1px_1.5px_0_#111111]'
    }
  }
  if (isSessionClassified(session)) {
    return {
      label: 'Terklasifikasi',
      classes: 'bg-[#87d7ff] text-[#111111] border-[#111111] shadow-[1px_1.5px_0_#111111]'
    }
  }
  return {
    label: 'Sesi Baru',
    classes: 'bg-white text-[#111111] border-[#111111] shadow-[1px_1.5px_0_#111111]'
  }
}

function onSessionUploaded() {
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
  <div class="min-h-screen notebook-paper relative overflow-x-clip text-[#111111] flex flex-col selection:bg-[#ff82c2] selection:text-[#111111] font-sans">
    <!-- Subtle Ambient Pastel Halos (matching Beranda atmospheric lighting) -->
    <div aria-hidden="true" class="pointer-events-none fixed -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-[#20afff]/12 blur-[110px]"></div>
    <div aria-hidden="true" class="pointer-events-none fixed top-[32%] -right-28 w-[420px] h-[420px] rounded-full bg-[#ffda40]/14 blur-[120px]"></div>
    <div aria-hidden="true" class="pointer-events-none fixed -bottom-28 left-[18%] w-[380px] h-[380px] rounded-full bg-[#ff82c2]/10 blur-[120px]"></div>

    <AppNavbar :fluid="true" />

    <main class="relative z-10 flex-1 w-full max-w-[1640px] mx-auto px-4 sm:px-6 md:px-10 lg:px-12 py-7 md:py-9 space-y-7">
      <!-- Inline System Notification -->
      <div
        v-if="notification"
        role="status"
        aria-live="polite"
        :class="[
          'rounded-[14px] border-[1.5px] px-4 py-3 flex items-center justify-between gap-3 text-xs font-medium backdrop-blur-md shadow-[0_8px_20px_rgba(0,0,0,0.06)] transition-all animate-fade-in',
          notification.type === 'error' ? 'bg-rose-50/95 border-rose-400 text-rose-950' :
          notification.type === 'success' ? 'bg-emerald-50/95 border-emerald-400 text-emerald-950' :
          'bg-white/90 border-[#111111]/20 text-[#111111]'
        ]"
      >
        <div class="flex items-center gap-2.5">
          <svg v-if="notification.type === 'error'" class="w-4 h-4 text-rose-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <svg v-else-if="notification.type === 'success'" class="w-4 h-4 text-emerald-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg v-else class="w-4 h-4 text-[#20afff] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{{ notification.message }}</span>
        </div>
        <button
          type="button"
          @click="dismissNotification"
          class="text-[#60605e] hover:text-[#111111] p-1 rounded-[8px] transition-colors cursor-pointer"
          aria-label="Tutup pemberitahuan"
        >
          <X class="w-4 h-4" :stroke-width="2" />
        </button>
      </div>

      <!-- Studio Workspace Header -->
      <header class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
        <h1 class="font-editorial font-bold text-3xl sm:text-4xl text-[#111111] tracking-[-0.03em] leading-none">
          Studio Workspace
        </h1>

        <div class="flex flex-wrap items-center gap-3 shrink-0">
          <router-link
            v-if="authStore.user?.role === 'ADMIN'"
            to="/admin/users"
            class="btn-keycap btn-keycap-sm btn-keycap-white px-3.5 py-2 text-xs"
          >
            Admin Users
          </router-link>
          <button
            type="button"
            @click="showUploadModal = true"
            class="btn-keycap btn-keycap-blue px-5 py-2.5 text-xs whitespace-nowrap"
          >
            <Plus class="w-4 h-4" :stroke-width="2.5" />
            <span>Unggah Sesi Baru</span>
          </button>
        </div>
      </header>

      <!-- Guest Sticky-Note Upgrade Banner -->
      <div
        v-if="isGuest"
        class="rounded-[16px] border-2 border-[#111111] bg-[#ffda40]/92 backdrop-blur-md shadow-[3px_4px_0_#111111] px-5 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
      >
        <div class="flex items-start sm:items-center gap-2.5 text-[#111111]">
          <span class="px-2 py-0.5 rounded-[6px] bg-[#111111] text-[#ffda40] text-[10px] font-bold uppercase tracking-wider shrink-0">
            Mode Tamu
          </span>
          <span class="leading-relaxed">
            Anda menggunakan <strong class="font-bold">Sesi Studio Instan</strong> (jatah <span class="tabular-nums font-bold">3</span> token demo). Daftar akun gratis untuk menyimpan riwayat sesi dan top-up kuota.
          </span>
        </div>
        <router-link
          to="/register"
          class="btn-keycap btn-keycap-mini btn-keycap-white px-3.5 py-1.5 text-xs whitespace-nowrap shrink-0"
        >
          <span>Daftar Akun Permanen</span>
          <ArrowRight class="w-3.5 h-3.5" :stroke-width="2.2" />
        </router-link>
      </div>

      <!-- Claim Token Feedback -->
      <div v-if="claimMsg" class="retro-telemetry-plate border-emerald-400 bg-emerald-50/95 text-emerald-950 text-xs px-4 py-3 font-medium">
        {{ claimMsg }}
      </div>
      <div v-if="claimError" class="retro-telemetry-plate border-amber-400 bg-amber-50/95 text-amber-950 text-xs px-4 py-3 font-medium">
        {{ claimError }}
      </div>

      <!-- Sesi Multitrack Toolbar -->
      <div class="flex items-center justify-between px-1 pt-1">
        <div class="flex items-center gap-3">
          <h2 class="font-editorial font-bold text-lg sm:text-xl text-[#111111] tracking-tight">
            Sesi Multitrack
          </h2>
          <span class="px-2.5 py-1 rounded-full bg-white border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] text-[11px] font-bold text-[#111111] leading-none tabular-nums">
            {{ sessions.length }} Sesi
          </span>
        </div>
        <button
          type="button"
          @click="loadSessions"
          class="btn-keycap btn-keycap-mini btn-keycap-white px-3 py-1.5 text-xs"
        >
          <RefreshCw class="w-3.5 h-3.5 text-[#111111]" :stroke-width="2" />
          <span>Segarkan</span>
        </button>
      </div>

      <!-- Empty State (Notebook Dropzone Card) -->
      <div
        v-if="!sessions.length"
        class="rounded-[18px] border-2 border-dashed border-[#111111]/45 bg-white/92 backdrop-blur-md shadow-[3px_4px_0_#111111] p-10 sm:p-16 text-center flex flex-col items-center justify-center space-y-5"
      >
        <div class="w-14 h-14 rounded-[16px] bg-[#18181b] text-[#20afff] border-2 border-[#111111] shadow-[3px_4px_0_#111111] flex items-center justify-center">
          <Music2 class="w-6 h-6" :stroke-width="2" />
        </div>
        <div class="space-y-1.5 max-w-md">
          <h3 class="font-editorial font-bold text-lg sm:text-xl text-[#111111] tracking-tight">
            Belum ada sesi multitrack
          </h3>
          <p class="text-xs sm:text-sm text-[#60605e] font-normal leading-relaxed">
            Unggah berkas stem WAV/FLAC atau arsip ZIP rekaman DAW Anda untuk memulai klasifikasi instrumen dan audit fasa otomatis.
          </p>
        </div>
        <button
          type="button"
          @click="showUploadModal = true"
          class="btn-keycap btn-keycap-blue px-6 py-2.5 text-xs"
        >
          <Plus class="w-4 h-4" :stroke-width="2.5" />
          <span>Unggah Stem Pertama</span>
        </button>
      </div>

      <!-- Active Sessions List (Uniform Ink-Outlined Session Cards + Folder Tabs) -->
      <div v-else class="space-y-6">
        <article
          v-for="s in sessions"
          :key="s.id"
          :id="'session-card-' + s.id"
          class="rounded-[18px] border-2 border-[#111111] bg-white/95 backdrop-blur-md shadow-[3px_4px_0_#111111] scroll-mt-20 transition-all overflow-visible"
        >
          <!-- Session Top Bar -->
          <div
            @click="toggleSession(s.id)"
            class="px-5 py-4 sm:px-6 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-[#fcfcfb] transition-colors"
            :class="isSessionExpanded(s.id) ? 'border-b border-[#111111]/15 rounded-t-[16px]' : 'rounded-[16px]'"
          >
            <div class="space-y-1 min-w-0">
              <!-- Inline Rename Form -->
              <div v-if="editingSessionId === s.id" @click.stop class="flex items-center gap-2 py-0.5">
                <input
                  v-model="editTitleInput"
                  @keydown.enter="saveRename(s.id)"
                  @keydown.esc="cancelRename"
                  autofocus
                  class="text-base sm:text-lg font-bold text-[#111111] bg-white border-[1.5px] border-[#111111] rounded-[10px] px-3 py-1.5 focus:outline-none w-full max-w-xs"
                  placeholder="Nama judul sesi..."
                />
                <button
                  type="button"
                  @click="saveRename(s.id)"
                  :disabled="isSavingTitle"
                  class="btn-keycap btn-keycap-mini btn-keycap-blue w-8 h-8 shrink-0"
                  title="Simpan Judul"
                >
                  <Check class="w-3.5 h-3.5" :stroke-width="2.5" />
                </button>
                <button
                  type="button"
                  @click="cancelRename"
                  class="btn-keycap btn-keycap-mini btn-keycap-white w-8 h-8 shrink-0"
                  title="Batal"
                >
                  <X class="w-3.5 h-3.5" :stroke-width="2" />
                </button>
              </div>

              <!-- Title + Quick Pills -->
              <div v-else class="flex flex-wrap items-center gap-2.5 group">
                <h3 class="font-editorial font-bold text-lg sm:text-xl text-[#111111] tracking-tight truncate max-w-full">
                  {{ s.title }}
                </h3>
                <button
                  type="button"
                  @click.stop="startRename(s)"
                  class="text-[#60605e] hover:text-[#111111] p-1.5 rounded-[8px] hover:bg-white/80 transition-colors cursor-pointer"
                  title="Ubah judul sesi"
                  aria-label="Ubah judul sesi"
                >
                  <Pencil class="w-3.5 h-3.5" :stroke-width="2" />
                </button>
                <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#f5f3eb] border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] text-[#111111] leading-none tabular-nums">
                  {{ s.tracks?.length || 0 }} Stem
                </span>
                <span
                  :class="getSessionStatusPill(s).classes"
                  class="px-2.5 py-1 rounded-full text-[11px] font-bold border-[1.5px] leading-none tabular-nums"
                >
                  {{ getSessionStatusPill(s).label }}
                </span>
              </div>
            </div>

            <!-- Right Controls -->
            <div class="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                @click.stop="toggleSession(s.id)"
                class="btn-keycap btn-keycap-mini btn-keycap-white px-3 py-1.5 text-xs"
              >
                <span>{{ isSessionExpanded(s.id) ? 'Tutup Sesi' : 'Buka Sesi' }}</span>
                <ChevronUp v-if="isSessionExpanded(s.id)" class="w-3.5 h-3.5" :stroke-width="2" />
                <ChevronDown v-else class="w-3.5 h-3.5" :stroke-width="2" />
              </button>

              <button
                type="button"
                @click.stop="confirmDeleteSession(s)"
                class="btn-keycap btn-keycap-mini btn-keycap-white px-3 py-1.5 text-xs text-rose-700 hover:text-rose-800"
                title="Hapus Sesi Multitrack"
              >
                <Trash2 class="w-3.5 h-3.5 text-rose-700" :stroke-width="2" />
                <span>Hapus</span>
              </button>
            </div>
          </div>

          <!-- Expanded Single-Sheet Session Body -->
          <div v-if="isSessionExpanded(s.id)" class="p-4 sm:p-6 space-y-5">
            <!-- Integrity Verification Banner (if triggered) -->
            <div
              v-if="verificationResult && verificationResult.sessionId === s.id"
              class="rounded-[14px] border-[1.5px] border-[#111111] bg-white shadow-[2px_3px_0_#111111] p-4 space-y-1.5 animate-fade-in"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-xs font-bold text-[#111111]">
                  Integritas Sesi: {{ verificationResult.status }}
                </span>
                <span class="font-telemetry text-xs text-[#60605e]">
                  {{ verificationResult.sampleRateConsistency }}
                </span>
              </div>
              <p class="text-xs text-[#60605e] leading-relaxed">
                {{ verificationResult.message }}
              </p>
            </div>

            <!-- Frosted Acrylic Retro Die-Cut Folder Stack (01 Blue / 02 Yellow / 03 Green) -->
            <div class="w-full relative pt-1">
              <!-- Back Translucent Folder Layers Peeking Behind -->
              <div aria-hidden="true" class="hidden sm:block mx-6 h-2.5 rounded-t-[10px] bg-[#ff82c2]/50 backdrop-blur-sm border-t border-x border-white/60"></div>
              <div aria-hidden="true" class="hidden sm:block mx-8 h-1 bg-white/85 backdrop-blur-xs"></div>
              <div aria-hidden="true" class="hidden sm:block mx-4 h-2.5 rounded-t-[10px] bg-[#ffda40]/55 backdrop-blur-sm border-t border-x border-white/60"></div>
              <div aria-hidden="true" class="hidden sm:block mx-6 h-1 bg-white/85 backdrop-blur-xs"></div>

              <!-- Seamless Trapezoid SVG Die-Cut Folder Tabs (01 · 02 · 03) -->
              <div
                role="tablist"
                aria-label="Tahap persiapan sesi"
                class="relative z-30 flex items-end pl-2 sm:pl-5 overflow-x-auto no-scrollbar"
              >
                <button
                  v-for="(tab, idx) in sessionFolderTabs"
                  :key="tab.step"
                  :id="`session-tab-${s.id}-${tab.step}`"
                  type="button"
                  role="tab"
                  :aria-selected="getActiveStepTab(s) === tab.step"
                  :aria-controls="`session-tabpanel-${s.id}`"
                  @click="setActiveStepTab(s.id, tab.step)"
                  @keydown="handleFolderTabKeyDown($event, s.id, tab.step)"
                  :class="[
                    idx > 0 ? '-ml-3' : '',
                    getActiveStepTab(s) === tab.step ? 'z-30 h-10 opacity-100' : 'z-10 h-9 opacity-80 hover:opacity-100'
                  ]"
                  class="group relative min-w-[148px] sm:min-w-[205px] px-4 sm:px-5 pr-7 flex items-center justify-start gap-2 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] transition-all"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 200 40"
                    preserveAspectRatio="none"
                    class="absolute inset-0 w-full h-full pointer-events-none"
                  >
                    <path
                      d="M0,40 L0,10 Q0,0 10,0 L172,0 Q180,0 185,10 L200,40 Z"
                      :fill="tab.glassBg"
                    />
                    <path
                      d="M1,39 L1,10 Q1,1 10,1 L172,1 Q179,1 184,10 L198,39"
                      fill="none"
                      stroke="#ffffff"
                      stroke-opacity="0.65"
                      stroke-width="1.2"
                    />
                  </svg>
                  <span class="relative z-10 font-sans text-xs font-extrabold text-[#111111] tabular-nums">
                    {{ tab.num }}
                  </span>
                  <span class="relative z-10 font-sans text-[11px] sm:text-xs font-bold text-[#111111] truncate">
                    {{ tab.label }}
                  </span>
                </button>
              </div>

              <!-- Active Frosted Folder Body Colored to Match Active Tab -->
              <div
                :id="`session-tabpanel-${s.id}`"
                role="tabpanel"
                :aria-labelledby="`session-tab-${s.id}-${getActiveStepTab(s)}`"
                :style="{ backgroundColor: getActiveFolderMeta(s).glassBg }"
                :class="getActiveStepTab(s) === 1 ? 'rounded-b-[14px] rounded-tr-[14px] rounded-tl-none sm:rounded-tl-[14px]' : 'rounded-[14px]'"
                class="relative z-20 backdrop-blur-md border border-white/65 text-[#111111] transition-colors duration-200 shadow-[0_14px_36px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.75)] p-3.5 sm:p-5 overflow-visible"
              >
                <!-- Dotted Fold Score Line inside Colored Folder -->
                <div class="border-t border-dotted border-[#111111]/30 pt-4 sm:pt-5">
                  <!-- TAB 1: Klasifikasi Stem & Pasangan Mikrofon (Blue Folder) -->
                  <div v-show="getActiveStepTab(s) === 1" class="space-y-4 animate-fade-in">
                    <!-- Unrun Classification State -->
                    <div
                      v-if="!isSessionClassified(s)"
                      class="rounded-[14px] border-2 border-dashed border-[#111111]/35 bg-white/95 p-6 sm:p-8 text-center flex flex-col items-center justify-center space-y-3 shadow-[2px_3px_0_#111111]"
                    >
                      <div class="w-11 h-11 rounded-[12px] bg-[#20afff] border-2 border-[#111111] shadow-[2px_3px_0_#111111] text-[#111111] flex items-center justify-center">
                        <Music2 class="w-5 h-5" :stroke-width="2" />
                      </div>
                      <div class="space-y-1 max-w-md">
                        <p class="text-sm font-bold text-[#111111]">Klasifikasi Stem &amp; Pasangan Belum Dijalankan</p>
                        <p class="text-xs text-[#60605e] font-normal leading-relaxed">
                          Sistem akan memprediksi kategori instrumen untuk tiap stem dan otomatis memasangkan mikrofon yang berpotensi mengalami pembatalan fasa.
                        </p>
                      </div>
                      <button
                        type="button"
                        @click="handleClassify(s)"
                        :disabled="classifyingSessionId === s.id"
                        class="btn-keycap btn-keycap-sm btn-keycap-blue px-5 py-2.5 text-xs"
                      >
                        <svg v-if="classifyingSessionId === s.id" class="animate-spin w-3.5 h-3.5 text-[#111111]" viewBox="0 0 24 24" fill="none">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                        </svg>
                        <span>{{ classifyingSessionId === s.id ? 'Menganalisis Audio...' : 'Mulai Deteksi AI Sekarang' }}</span>
                      </button>
                    </div>

                    <!-- Classified Stems List & Manual Pair Creator -->
                    <template v-else>
                      <div class="flex flex-wrap items-center justify-between gap-2 px-1">
                        <div>
                          <h4 class="font-editorial text-sm sm:text-base font-extrabold text-[#111111]">Daftar Stem &amp; Pasangan Mikrofon</h4>
                          <p class="text-xs font-medium text-[#111111]/80">Verifikasi label instrumen dan pasangan fasa sebelum audit DSP.</p>
                        </div>
                        <span class="px-3 py-1 rounded-full bg-white border-[1.5px] border-[#111111] shadow-[1.5px_2px_0_#111111] text-[11px] font-bold text-[#111111] leading-none tabular-nums">
                          {{ s.trackPairs?.length || 0 }} Pasangan Terdeteksi
                        </span>
                      </div>

                      <div class="rounded-[14px] border-[1.5px] border-[#111111] bg-white/96 shadow-[2px_3px_0_#111111] divide-y divide-[#111111]/12 p-2 sm:p-3 overflow-visible">
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

                      <!-- Manual Pairing Form (Retro Selectors + Keycap CTA) -->
                      <div class="rounded-[14px] border-[1.5px] border-[#111111] bg-white/96 shadow-[2px_3px_0_#111111] p-4 sm:p-5 space-y-3 overflow-visible">
                        <span class="font-editorial font-bold text-xs sm:text-sm text-[#111111] block">
                          Hubungkan Pasangan Mikrofon Secara Manual
                        </span>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
                          <RetroSelect
                            v-model="pairTrackA"
                            :options="(s.tracks || []).map(t => ({ label: t.fileName, value: t.id }))"
                            placeholder="Pilih Trek Pertama (A)"
                            aria-label="Pilih Trek Pertama (A)"
                          />
                          <RetroSelect
                            v-model="pairTrackB"
                            :options="(s.tracks || []).map(t => ({ label: t.fileName, value: t.id }))"
                            placeholder="Pilih Trek Kedua (B)"
                            aria-label="Pilih Trek Kedua (B)"
                          />
                          <RetroSelect
                            v-model="pairType"
                            :options="pairTypeOptions"
                            placeholder="Pilih Tipe Pasangan"
                            aria-label="Pilih Tipe Pasangan"
                          />
                          <button
                            type="button"
                            @click="handleCreatePair(s.id)"
                            :disabled="isPairing || !pairTrackA || !pairTrackB"
                            class="btn-keycap btn-keycap-sm btn-keycap-yellow py-2.5 px-4 text-xs"
                          >
                            {{ isPairing ? 'Menghubungkan...' : 'Hubungkan' }}
                          </button>
                        </div>
                      </div>

                      <!-- Finalize Step 1 -> Step 2 -->
                      <div class="flex items-center justify-end pt-1">
                        <button
                          type="button"
                          @click="handleFinalizeClassification(s.id)"
                          :disabled="finalizingSessionId === s.id"
                          class="btn-keycap btn-keycap-sm btn-keycap-white px-5 py-2.5 text-xs"
                        >
                          <span>{{ finalizingSessionId === s.id ? 'Mengunci & Memindai...' : 'Konfirmasi & Lanjut ke Audit Fasa' }}</span>
                          <ArrowRight class="w-4 h-4" :stroke-width="2" />
                        </button>
                      </div>
                    </template>
                  </div>

                  <!-- TAB 2: Audit Diagnostik DSP & Perbaikan (Yellow Folder) -->
                  <div v-show="getActiveStepTab(s) === 2" class="space-y-4 animate-fade-in">
                    <!-- Unaudited State -->
                    <div
                      v-if="!isSessionAudited(s)"
                      class="rounded-[14px] border-2 border-dashed border-[#111111]/35 bg-white/95 p-6 sm:p-8 text-center flex flex-col items-center justify-center space-y-3 shadow-[2px_3px_0_#111111]"
                    >
                      <div class="w-11 h-11 rounded-[12px] bg-[#ffda40] border-2 border-[#111111] shadow-[2px_3px_0_#111111] text-[#111111] flex items-center justify-center">
                        <Activity class="w-5 h-5" :stroke-width="2" />
                      </div>
                      <div class="space-y-1 max-w-md">
                        <p class="text-sm font-bold text-[#111111]">Audit DSP &amp; Kesehatan Fasa Belum Dilakukan</p>
                        <p class="text-xs text-[#60605e] font-normal leading-relaxed">
                          Pindai tiap stem untuk mendeteksi pembalikan polaritas, comb filtering, fake stereo, DC offset, sub-rumble, serta klip inter-sample.
                        </p>
                      </div>
                      <button
                        type="button"
                        @click="handleDiagnose(s)"
                        :disabled="diagnosingSessionId === s.id"
                        class="btn-keycap btn-keycap-sm btn-keycap-yellow px-5 py-2.5 text-xs"
                      >
                        <svg v-if="diagnosingSessionId === s.id" class="animate-spin w-3.5 h-3.5 text-[#111111]" viewBox="0 0 24 24" fill="none">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                        </svg>
                        <span>{{ diagnosingSessionId === s.id ? 'Memindai Audio DSP...' : 'Jalankan Audit DSP Sekarang' }}</span>
                      </button>
                    </div>

                    <!-- Audited Health Score + Track Diagnostic Cards + Fixer -->
                    <template v-else>
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

                      <div class="rounded-[14px] border-[1.5px] border-[#111111] bg-white/96 shadow-[2px_3px_0_#111111] divide-y divide-[#111111]/12 p-2 sm:p-3">
                        <DiagnosticTrackCard
                          v-for="track in s.tracks"
                          :key="'diag-' + track.id"
                          :track="track"
                          :diagnostic="getTrackDiagnostic(s, track)"
                          :paired-track="getPairedTrack(s, track.id)"
                          :pair-info="getTrackPairInfo(s, track.id)"
                        />
                      </div>

                      <!-- Repaired Confirmation & Quick Jump to Audition -->
                      <div
                        v-if="s.status === 'REPAIRED'"
                        class="rounded-[14px] border-[1.5px] border-[#111111] bg-white/96 shadow-[2px_3px_0_#111111] p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                      >
                        <div class="inline-flex items-center gap-2.5 text-[#111111]">
                          <span class="w-7 h-7 rounded-[8px] bg-[#5ad363] border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] text-[#111111] flex items-center justify-center shrink-0">
                            <Check class="w-4 h-4" :stroke-width="2.5" />
                          </span>
                          <span class="text-xs sm:text-sm font-bold">Perbaikan DSP Selesai Diterapkan (Non-Destruktif)</span>
                        </div>

                        <div class="flex flex-wrap items-center gap-2.5 shrink-0">
                          <button
                            type="button"
                            @click="openCustomRepairModal(s)"
                            class="btn-keycap btn-keycap-sm btn-keycap-white px-4 py-2 text-xs"
                          >
                            <SlidersHorizontal class="w-3.5 h-3.5" :stroke-width="2" />
                            <span>Sesuaikan Ulang</span>
                          </button>
                          <button
                            type="button"
                            @click="openAuditionSection(s)"
                            class="btn-keycap btn-keycap-sm btn-keycap-dark px-4 py-2 text-xs"
                          >
                            <PlayCircle class="w-4 h-4 text-[#5ad363]" :stroke-width="2" />
                            <span>Dengar Perbandingan A/B</span>
                          </button>
                        </div>
                      </div>

                      <!-- Repair Triggers (Unrepaired Session) -->
                      <div
                        v-else
                        class="pt-1 flex flex-wrap items-center justify-end gap-3"
                      >
                        <button
                          type="button"
                          @click="openCustomRepairModal(s)"
                          :disabled="repairingSessionId === s.id"
                          class="btn-keycap btn-keycap-sm btn-keycap-white px-4 py-2 text-xs"
                        >
                          <SlidersHorizontal class="w-3.5 h-3.5" :stroke-width="2" />
                          <span>Kustomisasi Perbaikan</span>
                        </button>

                        <button
                          type="button"
                          @click="handleRepairAuto(s)"
                          :disabled="repairingSessionId === s.id"
                          class="btn-keycap btn-keycap-sm btn-keycap-blue px-5 py-2 text-xs"
                        >
                          <svg v-if="repairingSessionId === s.id" class="animate-spin w-3.5 h-3.5 text-[#111111]" viewBox="0 0 24 24" fill="none">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                          </svg>
                          <span>
                            {{ repairingSessionId === s.id ? 'Merender Audio DSP...' : `Terapkan Perbaikan (${getSessionHealthData(s).estimated_tokens} Token)` }}
                          </span>
                        </button>
                      </div>
                    </template>
                  </div>

                  <!-- TAB 3: Studio Audisi Multitrack A/B & Analisis Fase (Green Folder) -->
                  <div v-if="auditionInitialized[s.id]" v-show="getActiveStepTab(s) === 3" class="animate-fade-in">
                    <MultitrackAuditionPanel :session="s" :is-open="isSessionExpanded(s.id) && getActiveStepTab(s) === 3" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Session Deliverables Bar -->
            <div class="pt-3 border-t border-[#111111]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="flex flex-wrap items-center gap-2 text-xs text-[#60605e]">
                <span class="font-semibold text-[#111111]">Ringkasan Stem:</span>
                <span class="inline-flex items-center rounded-full bg-[#f5f3eb] border-[1.5px] border-[#111111] shadow-[1px_1.5px_0_#111111] px-2.5 py-1 text-[11px] font-bold text-[#111111] leading-none tabular-nums">
                  {{ countTrackChannels(s).stereo }} Stereo &middot; {{ countTrackChannels(s).mono }} Mono
                </span>
              </div>

              <div class="flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  @click="handleDownloadReport(s)"
                  :disabled="downloadingPdfId === s.id"
                  class="btn-keycap btn-keycap-sm btn-keycap-white px-4 py-2 text-xs"
                  title="Unduh ringkasan audit audio DSP dalam format dokumen PDF"
                >
                  <FileText class="w-3.5 h-3.5 text-rose-700" :stroke-width="2" />
                  <span>{{ downloadingPdfId === s.id ? 'Membuat PDF...' : 'Unduh Laporan PDF' }}</span>
                </button>

                <button
                  v-if="s.status === 'REPAIRED'"
                  type="button"
                  @click="handleDownloadZip(s)"
                  :disabled="downloadingZipId === s.id"
                  class="btn-keycap btn-keycap-sm btn-keycap-dark px-4 py-2 text-xs"
                  title="Unduh seluruh audio stem perbaikan dalam arsip ZIP lossless"
                >
                  <svg v-if="downloadingZipId === s.id" class="animate-spin w-3.5 h-3.5 text-[#5ad363]" viewBox="0 0 24 24" fill="none">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <Download v-else class="w-3.5 h-3.5 text-[#5ad363]" :stroke-width="2" />
                  <span>{{ downloadingZipId === s.id ? 'Mengemas ZIP...' : 'Unduh Paket ZIP (Lossless)' }}</span>
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>
    </main>

    <!-- Upload Modal -->
    <UploadSessionModal
      v-if="showUploadModal"
      @close="showUploadModal = false"
      @uploaded="onSessionUploaded"
    />

    <!-- Delete Confirmation Modal -->
    <DeleteSessionModal
      :session="sessionToDelete"
      :is-deleting="isDeletingSession"
      @close="sessionToDelete = null"
      @confirm="handleDeleteSession"
    />

    <!-- Custom Repair Modal -->
    <CustomRepairModal
      :open="showCustomRepairModal"
      :session="activeRepairSession"
      :custom-settings="customRepairSettings"
      :is-repairing="Boolean(activeRepairSession && repairingSessionId === activeRepairSession.id)"
      @close="showCustomRepairModal = false"
      @submit="handleRepairCustom"
    />
  </div>
</template>
