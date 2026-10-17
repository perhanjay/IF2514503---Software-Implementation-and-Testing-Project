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

const classifyingSessionId = ref(null)
const openClassificationSessionId = ref(null)
const pairTrackA = ref('')
const pairTrackB = ref('')
const pairType = ref('MIC_PAIR')
const isPairing = ref(false)
const finalizingSessionId = ref(null)

const diagnosingSessionId = ref(null)
const openDiagnosticSessionId = ref(null)
const diagnosticResults = ref({})

const packages = ref([])
const selectedPackage = ref('PKG-25')
const checkoutLoading = ref(false)
const activeOrder = ref(null)

const sessions = ref([])
const showUploadModal = ref(false)
const verifyingSessionId = ref(null)
const verificationResult = ref(null)

async function loadWallet() {
  try {
    const res = await axios.get('/api/v1/wallet/details')
    walletDetails.value = res.data
    authStore.updateBalance(res.data.balance)
  } catch (err) {
    console.warn('Wallet not loaded', err)
  }
}

async function loadPackages() {
  try {
    const res = await axios.get('/api/v1/payments/packages')
    packages.value = res.data.packages
  } catch (err) {
    console.warn('Packages not loaded', err)
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
    alert('Silakan daftar akun atau masuk untuk mengklaim bonus token harian')
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

async function handleCheckout() {
  if (isGuest.value) {
    alert('Untuk melakukan pembelian paket token via Midtrans, silakan daftar atau masuk ke akun Anda terlebih dahulu.')
    router.push('/login')
    return
  }

  checkoutLoading.value = true
  activeOrder.value = null
  try {
    const res = await axios.post('/api/v1/payments/checkout', {
      packageId: selectedPackage.value
    })
    activeOrder.value = res.data
  } catch (err) {
    alert(err.response?.data?.error || 'Gagal memulai checkout Midtrans')
  } finally {
    checkoutLoading.value = false
  }
}

async function handleSimulatePayment() {
  if (!activeOrder.value) return
  try {
    await axios.post('/api/v1/payments/webhook', {
      order_id: activeOrder.value.orderId,
      status_code: '200',
      gross_amount: String(activeOrder.value.package.priceIdr),
      transaction_status: 'settlement',
      payment_type: 'qris_sandbox'
    })
    alert('Pembayaran Midtrans Berhasil Dikonfirmasi! Token telah ditambahkan ke akun Anda.')
    activeOrder.value = null
    await loadWallet()
  } catch (err) {
    alert('Gagal simulasi konfirmasi webhook')
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
    alert(err.response?.data?.error || 'Gagal memverifikasi sinkronisasi sesi')
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
    openClassificationSessionId.value = session.id
    await loadSessions()
  } catch (err) {
    alert(err.response?.data?.error || 'Gagal menjalankan klasifikasi AI')
  } finally {
    classifyingSessionId.value = null
  }
}

async function handleUpdateTrackLabel(sessionId, { trackId, label }) {
  try {
    await axios.patch(`/api/v1/sessions/${sessionId}/tracks/${trackId}/label`, { label })
    await loadSessions()
  } catch (err) {
    alert('Gagal memperbarui label trek')
  }
}

async function handleUnpair(sessionId, pairId) {
  if (!pairId) return
  try {
    await axios.delete(`/api/v1/sessions/${sessionId}/pairs/${pairId}`)
    await loadSessions()
  } catch (err) {
    alert('Gagal melepas pasangan trek')
  }
}

async function handleCreatePair(sessionId) {
  if (!pairTrackA.value || !pairTrackB.value) {
    alert('Pilih kedua trek audio yang ingin dihubungkan')
    return
  }
  if (pairTrackA.value === pairTrackB.value) {
    alert('Trek A dan Trek B tidak boleh sama')
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
    alert(err.response?.data?.error || 'Gagal membuat pasangan trek')
  } finally {
    isPairing.value = false
  }
}

async function handleFinalizeClassification(sessionId) {
  finalizingSessionId.value = sessionId
  try {
    await axios.post(`/api/v1/sessions/${sessionId}/finalize-classification`)
    const sessionObj = sessions.value.find(s => s.id === sessionId)
    if (sessionObj) {
      await handleDiagnose(sessionObj)
    } else {
      await loadSessions()
    }
  } catch (err) {
    alert('Gagal mengonfirmasi klasifikasi')
  } finally {
    finalizingSessionId.value = null
  }
}

async function handleDiagnose(session) {
  diagnosingSessionId.value = session.id
  try {
    const res = await axios.post(`/api/v1/sessions/${session.id}/diagnose`)
    diagnosticResults.value[session.id] = res.data
    openDiagnosticSessionId.value = session.id
    await loadSessions()
  } catch (err) {
    alert(err.response?.data?.error || 'Gagal menjalankan pemindaian diagnostik DSP')
  } finally {
    diagnosingSessionId.value = null
  }
}

function getSessionHealthData(session) {
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
  await loadPackages()
  await loadSessions()
})
</script>

<template>
  <div class="min-h-screen bg-[#FAFAFA] text-slate-900 flex flex-col selection:bg-[#0052FF]/20 selection:text-[#0052FF]">
    <AppNavbar />

    <main class="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-8">
      
      <!-- Studio Header / Banner -->
      <div class="bg-white border border-slate-200/90 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div class="radial-glow top-0 right-0 w-[300px] h-[300px]"></div>

        <div class="space-y-2 z-10 max-w-2xl">
          <SectionBadge :label="isGuest ? 'Mode Studio Instan (Tamu)' : 'Konsol Studio Terverifikasi'" />
          <h1 class="font-display text-2xl sm:text-3xl text-slate-900 mt-1">
            Studio Workspace & Session Prep
          </h1>
          <p class="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
            Unggah stem multitrack, jalankan verifikasi keselarasan waktu, dan periksa kesehatan fasa sesi mixing sebelum produksi kreatif dimulai.
          </p>
        </div>

        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 z-10 w-full md:w-auto">
          <button 
            @click="handleClaimDaily" 
            :disabled="claiming"
            class="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2">
            <span>🎁</span>
            <span>{{ claiming ? 'Mengklaim...' : 'Klaim Token Harian' }}</span>
          </button>
          
          <button 
            @click="showUploadModal = true"
            class="px-6 py-3 rounded-xl bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] text-white text-xs font-bold shadow-accent hover:shadow-accent-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2">
            <span class="text-base leading-none">+</span>
            <span>Unggah Sesi Baru</span>
          </button>
        </div>
      </div>

      <!-- Guest Upgrade Banner Warning (jika masih akun tamu) -->
      <div v-if="isGuest" class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-2.5 text-blue-900">
          <span class="text-base">💡</span>
          <span>Anda menggunakan <strong>Sesi Studio Instan</strong> (Jatah 3 Token Demo). Daftar akun gratis untuk menyimpan riwayat sesi secara permanen dan top-up kuota besar.</span>
        </div>
        <router-link to="/register" class="font-bold text-[#0052FF] hover:underline whitespace-nowrap">
          Daftar Akun Permanen →
        </router-link>
      </div>

      <!-- Notifikasi Claim Feedback -->
      <div v-if="claimMsg" class="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-3.5 font-medium">
        {{ claimMsg }}
      </div>
      <div v-if="claimError" class="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-3.5 font-medium">
        {{ claimError }}
      </div>

      <!-- Main Layout Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8">
        
        <!-- Column 1: Sesi Multitrack Aktif -->
        <div class="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
          <div class="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 class="font-display text-xl text-slate-900">Daftar Sesi Multitrack</h2>
              <span class="font-mono-accent text-xs text-slate-500">Total {{ sessions.length }} Sesi Aktif</span>
            </div>
            <button 
              @click="loadSessions"
              class="text-xs font-semibold text-[#0052FF] hover:underline cursor-pointer">
              Segarkan
            </button>
          </div>

          <!-- Empty State -->
          <div v-if="!sessions.length" class="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
            <div class="w-14 h-14 rounded-2xl bg-[#0052FF]/5 text-[#0052FF] flex items-center justify-center text-2xl font-display">
              🎵
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
              class="border border-slate-200 hover:border-[#0052FF]/40 rounded-2xl p-5 transition-all bg-[#FAFAFA] space-y-4">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 class="font-display text-lg text-slate-900">{{ s.title }}</h3>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="font-mono-accent text-[11px] text-slate-500">
                      {{ s.tracks?.length || 0 }} Stems Audio
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
                    class="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:border-[#0052FF] text-slate-800 text-xs font-semibold rounded-xl shadow-sm hover:shadow-accent transition-all cursor-pointer">
                    <span>{{ verifyingSessionId === s.id ? 'Memindai...' : '🔍 Verifikasi (UC-11)' }}</span>
                  </button>

                  <button 
                    @click="handleClassify(s)"
                    :disabled="classifyingSessionId === s.id"
                    class="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:border-[#0052FF] text-slate-800 text-xs font-semibold rounded-xl shadow-sm hover:shadow-accent transition-all cursor-pointer">
                    <span>{{ classifyingSessionId === s.id ? 'AI Memproses...' : '🤖 AI Pairing (UC-12)' }}</span>
                  </button>

                  <button 
                    @click="handleDiagnose(s)"
                    :disabled="diagnosingSessionId === s.id"
                    class="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] text-white text-xs font-semibold rounded-xl shadow-accent hover:shadow-accent-lg transition-all cursor-pointer">
                    <span>{{ diagnosingSessionId === s.id ? 'DSP Menganalisis...' : '🔬 Diagnostik DSP (UC-13)' }}</span>
                  </button>

                  <button 
                    v-if="s.healthScore !== null || s.tracks?.some(t => t.diagnosticResult)"
                    @click="openDiagnosticSessionId = (openDiagnosticSessionId === s.id ? null : s.id)"
                    class="px-2.5 py-2 text-xs font-bold text-[#0052FF] hover:underline cursor-pointer">
                    {{ openDiagnosticSessionId === s.id ? 'Tutup Audit DSP ▲' : 'Buka Audit DSP ▼' }}
                  </button>
                  <button 
                    v-else-if="s.tracks?.some(t => t.detectedLabel)"
                    @click="openClassificationSessionId = (openClassificationSessionId === s.id ? null : s.id)"
                    class="px-2.5 py-2 text-xs font-medium text-slate-500 hover:text-[#0052FF] cursor-pointer">
                    {{ openClassificationSessionId === s.id ? 'Tutup Panel ▲' : 'Buka Panel ▼' }}
                  </button>
                </div>
              </div>

              <!-- Badges list of stems -->
              <div class="flex flex-wrap gap-1.5 pt-3 border-t border-slate-200/60">
                <span 
                  v-for="t in s.tracks" 
                  :key="t.id"
                  class="font-mono-accent text-[10px] bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-md truncate max-w-xs">
                  {{ t.fileName }}
                </span>
              </div>

              <!-- Verification Result Card (Inverted Deep Slate Theme) -->
              <div 
                v-if="verificationResult && verificationResult.sessionId === s.id"
                class="rounded-xl p-4 bg-[#0F172A] text-white border border-slate-800 space-y-2 animate-fade-in">
                <div class="flex items-center justify-between">
                  <span class="font-mono-accent text-[11px] uppercase tracking-wider text-cyan-400 font-bold">
                    Integritas Sesi: {{ verificationResult.status }}
                  </span>
                  <span class="font-mono-accent text-[10px] text-slate-400">
                    {{ verificationResult.sampleRateConsistency }}
                  </span>
                </div>
                <p class="text-xs text-slate-300 leading-relaxed font-normal">
                  {{ verificationResult.message }}
                </p>
              </div>

              <!-- UC-12 Classification & Pairing Panel -->
              <div 
                v-if="openClassificationSessionId === s.id || s.tracks?.some(t => t.detectedLabel)"
                class="rounded-2xl p-5 bg-white border border-slate-200/90 shadow-md space-y-5 animate-fade-in">
                
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="w-2 h-2 rounded-full bg-[#0052FF]" />
                      <h4 class="font-display text-base text-slate-900">Hasil Klasifikasi Audio CNN & Deteksi Pasangan</h4>
                    </div>
                    <p class="text-xs text-slate-500 mt-0.5">
                      Tinjau tebakan instrumen AI dan relasi pasangan mikrofon sebelum masuk ke analisis diagnostik fasa.
                    </p>
                  </div>

                  <span class="font-mono-accent text-[11px] px-2.5 py-1 rounded bg-slate-100 text-slate-600 font-semibold self-start sm:self-auto">
                    {{ s.trackPairs?.length || 0 }} Pasangan Terhubung
                  </span>
                </div>

                <!-- Stems List with TrackClassificationCard -->
                <div class="space-y-3">
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
                <div class="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="font-semibold text-xs text-slate-800">Hubungkan Pasangan Mikrofon Baru Secara Manual</span>
                    <span class="font-mono-accent text-[10px] text-slate-400">UC-12 Pairing Form</span>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <select 
                      v-model="pairTrackA" 
                      class="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:border-[#0052FF]">
                      <option value="" disabled>Pilih Trek Pertama (A)</option>
                      <option v-for="t in s.tracks" :key="'a-' + t.id" :value="t.id">
                        {{ t.fileName }}
                      </option>
                    </select>

                    <select 
                      v-model="pairTrackB" 
                      class="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:border-[#0052FF]">
                      <option value="" disabled>Pilih Trek Kedua (B)</option>
                      <option v-for="t in s.tracks" :key="'b-' + t.id" :value="t.id">
                        {{ t.fileName }}
                      </option>
                    </select>

                    <select 
                      v-model="pairType" 
                      class="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:border-[#0052FF]">
                      <option value="MIC_PAIR">MIC_PAIR (Kick In/Sub)</option>
                      <option value="DRUM_TOP_BOTTOM">DRUM_TOP_BOTTOM (Snare Top/Bottom)</option>
                      <option value="BASS_DI_MIC">BASS_DI_MIC (Bass DI/Amp)</option>
                      <option value="STEREO_SPLIT">STEREO_SPLIT (L/R Split)</option>
                    </select>

                    <button 
                      @click="handleCreatePair(s.id)"
                      :disabled="isPairing || !pairTrackA || !pairTrackB"
                      class="py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5">
                      <span>🔗 Hubungkan</span>
                    </button>
                  </div>
                </div>

                <!-- Finalize CTA Button -->
                <div class="pt-2 flex justify-end">
                  <button 
                    @click="handleFinalizeClassification(s.id)"
                    :disabled="finalizingSessionId === s.id"
                    class="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] text-white font-semibold text-xs shadow-accent hover:shadow-accent-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer">
                    <span>{{ finalizingSessionId === s.id ? 'Mengunci...' : 'Konfirmasi & Lanjut ke Diagnostik Fasa (UC-13)' }}</span>
                    <span class="font-mono text-sm">→</span>
                  </button>
                </div>

              </div>

              <!-- UC-13 DSP Diagnostics & Mix Health Audit Panel -->
              <div 
                v-if="openDiagnosticSessionId === s.id || (s.healthScore !== null && s.tracks?.some(t => t.diagnosticResult))"
                class="rounded-2xl p-5 sm:p-6 bg-white border border-slate-200/90 shadow-md space-y-6 animate-fade-in">

                <!-- Header -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <h4 class="font-display text-base sm:text-lg text-slate-900">Audit Diagnostik DSP & Kesehatan Sesi (UC-13)</h4>
                    </div>
                    <p class="text-xs text-slate-500 mt-0.5">
                      Laporan deterministik ITU-R BS.1770-4: korelasi stereo & multi-mic, clipping inter-sample, DC offset, dan sub-rumble.
                    </p>
                  </div>

                  <div class="flex items-center gap-2">
                    <button 
                      @click="handleDiagnose(s)"
                      :disabled="diagnosingSessionId === s.id"
                      class="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 cursor-pointer flex items-center gap-1.5 transition-all">
                      <span>🔄</span>
                      <span>{{ diagnosingSessionId === s.id ? 'Memindai Ulang...' : 'Pindai Ulang DSP' }}</span>
                    </button>
                  </div>
                </div>

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
                    <span class="font-display text-sm text-slate-900">Rincian Audit per Stem Audio</span>
                    <span class="font-mono-accent text-xs text-slate-500">{{ s.tracks?.length || 0 }} Stems Terverifikasi</span>
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

                <!-- Banner CTA for Auto-Repair (UC-14/15) -->
                <div class="rounded-2xl p-5 bg-gradient-to-r from-slate-900 to-[#0F172A] text-white border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md">
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <span class="font-mono-accent text-[11px] uppercase tracking-wider text-cyan-400 font-bold">
                        Tahap Berikutnya: Automated Fixer (UC-14 & UC-15)
                      </span>
                      <span class="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold font-mono-accent">
                        Siap Eksekusi
                      </span>
                    </div>
                    <h5 class="font-display text-base sm:text-lg text-white">
                      Perbaiki Anomali Fasa & Headroom Secara Deterministik
                    </h5>
                    <p class="text-xs text-slate-400 max-w-xl font-normal leading-relaxed">
                      Engine akan membalik polaritas fasa terbalik, menyelaraskan micro-delay milidetik, membersihkan DC offset, dan menerapkan true-peak gain staging tanpa mengubah tone musikal.
                    </p>
                  </div>

                  <button 
                    @click="alert('Fitur Perbaikan Batch Otomatis (UC-14/15) akan diaktifkan pada milestone berikutnya!')"
                    class="px-6 py-3 rounded-xl bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] text-white font-bold text-xs shadow-accent hover:shadow-accent-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 shrink-0">
                    <span>🛠️</span>
                    <span>Perbaiki Sesi ({{ getSessionHealthData(s).estimated_tokens }} Token)</span>
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>

        <!-- Column 2: Dompet Virtual & Midtrans Top-up Gateway -->
        <div class="space-y-6">
          <div class="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
            <div class="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 class="font-display text-xl text-slate-900">Dompet & Pembelian</h2>
              <span class="font-mono-accent text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                MIDTRANS SANDBOX
              </span>
            </div>

            <!-- Current Balance Display -->
            <div class="bg-[#F1F5F9] border border-slate-200 rounded-2xl p-6 text-center space-y-1">
              <span class="font-mono-accent text-xs uppercase tracking-wider text-slate-500">Saldo Kuota Tersedia</span>
              <div class="font-display text-5xl text-[#0052FF] leading-tight">
                {{ authStore.walletBalance }}
              </div>
              <span class="text-xs text-slate-500 font-mono-accent block">Token Perbaikan Sesi</span>
            </div>

            <!-- Package Selection Form -->
            <div class="space-y-3 pt-2">
              <label class="block font-mono-accent text-xs font-semibold uppercase tracking-wider text-slate-600">
                Pilih Paket Token:
              </label>

              <div class="space-y-2">
                <label 
                  v-for="pkg in packages" 
                  :key="pkg.id"
                  :class="selectedPackage === pkg.id ? 'border-[#0052FF] bg-[#0052FF]/5 shadow-sm' : 'border-slate-200 bg-white'"
                  class="flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all text-xs">
                  <div class="flex items-center gap-2.5">
                    <input type="radio" v-model="selectedPackage" :value="pkg.id" class="text-[#0052FF]" />
                    <span class="font-semibold text-slate-800">{{ pkg.name }} ({{ pkg.tokens }} Token)</span>
                  </div>
                  <span class="font-mono-accent font-bold text-[#0052FF]">Rp {{ pkg.priceIdr.toLocaleString() }}</span>
                </label>
              </div>

              <button 
                @click="handleCheckout"
                :disabled="checkoutLoading"
                class="w-full py-3 bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] hover:brightness-110 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-accent hover:shadow-accent-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer mt-2">
                {{ checkoutLoading ? 'Menghubungkan Midtrans...' : (isGuest ? 'Daftar untuk Beli Token' : 'Beli Paket via Midtrans') }}
              </button>
            </div>

            <!-- Invoice Card Modal Preview -->
            <div v-if="activeOrder" class="p-4 bg-slate-900 text-white border border-slate-800 rounded-xl space-y-3">
              <div class="flex justify-between text-xs">
                <span class="text-slate-400 font-mono-accent">Invoice ID:</span>
                <span class="font-mono-accent text-cyan-400 font-bold">{{ activeOrder.orderId }}</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-slate-400 font-mono-accent">Total Pembayaran:</span>
                <span class="font-bold">Rp {{ activeOrder.package?.priceIdr?.toLocaleString() }}</span>
              </div>
              <div class="pt-2 border-t border-slate-800">
                <button 
                  @click="handleSimulatePayment"
                  class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer transition-all">
                  Simulasi Bayar Berhasil (Webhook)
                </button>
              </div>
            </div>
          </div>

          <!-- Ledger Table -->
          <div class="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 class="font-display text-base text-slate-900">Riwayat Mutasi Token</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-xs text-left">
                <thead class="text-slate-400 font-mono-accent border-b border-slate-100">
                  <tr>
                    <th class="py-2">Waktu</th>
                    <th class="py-2">Tipe</th>
                    <th class="py-2 text-right">Mutasi</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 font-mono-accent">
                  <tr v-for="tx in walletDetails?.transactions" :key="tx.id">
                    <td class="py-2.5 text-slate-500 text-[11px]">{{ new Date(tx.createdAt).toLocaleDateString() }}</td>
                    <td class="py-2.5 font-semibold text-slate-800 text-[11px]">{{ tx.type }}</td>
                    <td class="py-2.5 text-right font-bold text-[11px]" :class="tx.amount > 0 ? 'text-[#0052FF]' : 'text-rose-500'">
                      {{ tx.amount > 0 ? '+' + tx.amount : tx.amount }}
                    </td>
                  </tr>
                  <tr v-if="!walletDetails?.transactions?.length">
                    <td colspan="3" class="py-4 text-center text-slate-400 text-xs">Belum ada mutasi</td>
                  </tr>
                </tbody>
              </table>
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
  </div>
</template>
