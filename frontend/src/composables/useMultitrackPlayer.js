import { ref, reactive, computed, onUnmounted } from 'vue'

/**
 * Composable useMultitrackPlayer
 * Menyediakan sample-accurate synchronized playback untuk multitrack audio stems,
 * instant A/B switching (5ms micro-crossfade), per-channel strip controls,
 * mono check summing, dan telemetry stereo analyser untuk visualisasi goniometer.
 */
export function useMultitrackPlayer() {
  let audioCtx = null
  let masterBus = null
  let monoSplitter = null
  let monoSumGain = null
  let monoMerger = null
  let stereoDirectGain = null
  let monoDirectGain = null
  let masterGain = null
  let analyserSplitter = null
  let analyserL = null
  let analyserR = null

  let animFrameId = null
  let playbackStartTime = 0
  let pausedAtTime = 0

  const isInitialized = ref(false)
  const isLoading = ref(false)
  const loadingProgress = ref(0)
  const loadError = ref(null)

  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const playbackMode = ref('B') // 'A' (Raw Audio) vs 'B' (Repaired DSP Audio)
  const isMonoCheck = ref(false) // FR-6.4 Mono Summing Check
  const masterVolume = ref(1.0)

  // Real-time Peak telemetry (dBFS)
  const peakLeft = ref(-60)
  const peakRight = ref(-60)

  // Tracks array reactive
  const tracks = ref([])

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      audioCtx = new AudioContextClass()
      setupMasterBus()
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
    return audioCtx
  }

  function setupMasterBus() {
    if (masterBus) return

    masterBus = audioCtx.createGain()

    // Setup Mono Check Matrix (FR-6.4)
    monoSplitter = audioCtx.createChannelSplitter(2)
    monoSumGain = audioCtx.createGain()
    monoSumGain.gain.value = 0.5
    monoMerger = audioCtx.createChannelMerger(2)

    stereoDirectGain = audioCtx.createGain()
    stereoDirectGain.gain.value = 1.0

    monoDirectGain = audioCtx.createGain()
    monoDirectGain.gain.value = 0.0

    masterGain = audioCtx.createGain()
    masterGain.gain.value = masterVolume.value

    // Dual-channel Analysers untuk Goniometer & Peak Meter (FR-6.3)
    analyserSplitter = audioCtx.createChannelSplitter(2)
    analyserL = audioCtx.createAnalyser()
    analyserR = audioCtx.createAnalyser()
    analyserL.fftSize = 1024
    analyserR.fftSize = 1024
    analyserL.smoothingTimeConstant = 0.3
    analyserR.smoothingTimeConstant = 0.3

    // Routing Graph:
    // 1. Stereo Direct path
    masterBus.connect(stereoDirectGain)
    stereoDirectGain.connect(masterGain)

    // 2. Mono Summing path
    masterBus.connect(monoSplitter)
    monoSplitter.connect(monoSumGain, 0)
    monoSplitter.connect(monoSumGain, 1)
    monoSumGain.connect(monoMerger, 0, 0)
    monoSumGain.connect(monoMerger, 0, 1)
    monoMerger.connect(monoDirectGain)
    monoDirectGain.connect(masterGain)

    // 3. Master Gain ke Analyser dan Destination (Speakers)
    masterGain.connect(analyserSplitter)
    analyserSplitter.connect(analyserL, 0)
    analyserSplitter.connect(analyserR, 1)

    masterGain.connect(audioCtx.destination)
  }

  /**
   * Mengunduh dan men-decode audio buffer dari URL
   */
  async function fetchAndDecode(ctx, url) {
    if (!url) return null
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Gagal mengunduh audio (${response.status} ${response.statusText})`)
    }
    const arrayBuffer = await response.arrayBuffer()
    return await ctx.decodeAudioData(arrayBuffer)
  }

  /**
   * Inisialisasi dan load stems dari data API audio-sources
   */
  async function loadSessionAudio(tracksData) {
    if (!tracksData || tracksData.length === 0) return

    stop()
    isLoading.value = true
    loadError.value = null
    loadingProgress.value = 0

    const ctx = getAudioContext()
    const newTracks = []
    let maxDur = 0
    let totalLoadedSteps = 0
    const totalSteps = tracksData.length * 2

    try {
      for (const t of tracksData) {
        let rawBuffer = null
        try {
          rawBuffer = await fetchAndDecode(ctx, t.rawAudioUrl)
        } catch (err) {
          console.warn(`Gagal memuat raw buffer untuk stem ${t.name}:`, err)
        }
        totalLoadedSteps++
        loadingProgress.value = Math.round((totalLoadedSteps / totalSteps) * 100)

        let repairedBuffer = null
        if (t.repairedAudioUrl) {
          try {
            repairedBuffer = await fetchAndDecode(ctx, t.repairedAudioUrl)
          } catch (err) {
            console.warn(`Gagal memuat repaired buffer untuk stem ${t.name}, fallback ke raw:`, err)
            repairedBuffer = rawBuffer
          }
        } else {
          repairedBuffer = rawBuffer
        }
        totalLoadedSteps++
        loadingProgress.value = Math.round((totalLoadedSteps / totalSteps) * 100)

        const trackDuration = Math.max(
          rawBuffer ? rawBuffer.duration : 0,
          repairedBuffer ? repairedBuffer.duration : 0
        )
        if (trackDuration > maxDur) {
          maxDur = trackDuration
        }

        newTracks.push({
          id: t.id,
          name: t.name,
          label: t.label || 'Trek',
          isStereo: t.isStereo,
          rawAudioUrl: t.rawAudioUrl,
          repairedAudioUrl: t.repairedAudioUrl,
          rawBuffer,
          repairedBuffer,
          duration: trackDuration,
          volume: 1.0,
          pan: 0.0,
          isMuted: false,
          isSolo: false,
          nodes: null
        })
      }

      tracks.value = newTracks
      duration.value = maxDur
      currentTime.value = 0
      pausedAtTime = 0
      isInitialized.value = true
    } catch (err) {
      console.error('Error saat decode audio multitrack:', err)
      loadError.value = err.message || 'Gagal memproses berkas audio'
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Membangun audio graph per-track dan memulai playback sinkron
   */
  function startPlaybackNodes(offsetSeconds = 0) {
    const ctx = getAudioContext()
    const now = ctx.currentTime

    const hasSolo = tracks.value.some(t => t.isSolo)

    tracks.value.forEach(t => {
      if (t.nodes) {
        try {
          t.nodes.sourceA.stop()
          t.nodes.sourceB.stop()
        } catch (_) {}
      }

      const sourceA = ctx.createBufferSource()
      const sourceB = ctx.createBufferSource()

      sourceA.buffer = t.rawBuffer
      sourceB.buffer = t.repairedBuffer

      const gainA = ctx.createGain()
      const gainB = ctx.createGain()

      const isModeA = playbackMode.value === 'A'
      gainA.gain.setValueAtTime(isModeA ? 1.0 : 0.0, now)
      gainB.gain.setValueAtTime(isModeA ? 0.0 : 1.0, now)

      const chGain = ctx.createGain()
      chGain.gain.setValueAtTime(t.volume, now)

      let panner = null
      if (ctx.createStereoPanner) {
        panner = ctx.createStereoPanner()
        panner.pan.setValueAtTime(t.pan, now)
      }

      const soloMuteGain = ctx.createGain()
      let trackAudible = true
      if (t.isMuted) {
        trackAudible = false
      } else if (hasSolo && !t.isSolo) {
        trackAudible = false
      }
      soloMuteGain.gain.setValueAtTime(trackAudible ? 1.0 : 0.0, now)

      sourceA.connect(gainA)
      sourceB.connect(gainB)
      gainA.connect(chGain)
      gainB.connect(chGain)

      if (panner) {
        chGain.connect(panner)
        panner.connect(soloMuteGain)
      } else {
        chGain.connect(soloMuteGain)
      }

      soloMuteGain.connect(masterBus)

      t.nodes = {
        sourceA,
        sourceB,
        gainA,
        gainB,
        chGain,
        panner,
        soloMuteGain
      }

      if (t.rawBuffer && offsetSeconds < t.rawBuffer.duration) {
        sourceA.start(now, offsetSeconds)
      }
      if (t.repairedBuffer && offsetSeconds < t.repairedBuffer.duration) {
        sourceB.start(now, offsetSeconds)
      }
    })

    playbackStartTime = now - offsetSeconds
    startTelemetryLoop()
  }

  function play() {
    if (!isInitialized.value || tracks.value.length === 0) return
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    if (currentTime.value >= duration.value) {
      currentTime.value = 0
      pausedAtTime = 0
    }

    startPlaybackNodes(currentTime.value)
    isPlaying.value = true
  }

  function pause() {
    if (!isPlaying.value) return
    stopAllSourceNodes()
    pausedAtTime = currentTime.value
    isPlaying.value = false
    stopTelemetryLoop()
  }

  function stop() {
    stopAllSourceNodes()
    currentTime.value = 0
    pausedAtTime = 0
    isPlaying.value = false
    stopTelemetryLoop()
    peakLeft.value = -60
    peakRight.value = -60
  }

  function seek(targetSeconds) {
    const clamped = Math.max(0, Math.min(targetSeconds, duration.value))
    currentTime.value = clamped
    pausedAtTime = clamped

    if (isPlaying.value) {
      stopAllSourceNodes()
      startPlaybackNodes(clamped)
    }
  }

  function stopAllSourceNodes() {
    tracks.value.forEach(t => {
      if (t.nodes) {
        try {
          t.nodes.sourceA.stop()
        } catch (_) {}
        try {
          t.nodes.sourceB.stop()
        } catch (_) {}
        t.nodes = null
      }
    })
  }

  /**
   * Beralih antara Mode 'A' (Raw Audio) dan Mode 'B' (Repaired DSP)
   * Menggunakan 5ms micro-crossfade gain ramping untuk switching instan tanpa latency & tanpa click.
   */
  function setPlaybackMode(mode) {
    if (playbackMode.value === mode) return
    playbackMode.value = mode

    if (!audioCtx) return
    const now = audioCtx.currentTime
    const crossfadeDuration = 0.005 // 5 milidetik

    const isA = mode === 'A'

    tracks.value.forEach(t => {
      if (t.nodes) {
        const { gainA, gainB } = t.nodes
        gainA.gain.cancelScheduledValues(now)
        gainB.gain.cancelScheduledValues(now)

        gainA.gain.setValueAtTime(gainA.gain.value, now)
        gainA.gain.linearRampToValueAtTime(isA ? 1.0 : 0.0, now + crossfadeDuration)

        gainB.gain.setValueAtTime(gainB.gain.value, now)
        gainB.gain.linearRampToValueAtTime(isA ? 0.0 : 1.0, now + crossfadeDuration)
      }
    })
  }

  function togglePlaybackMode() {
    setPlaybackMode(playbackMode.value === 'A' ? 'B' : 'A')
  }

  /**
   * Toggle Mono Check (FR-6.4)
   * Menjumlahkan L + R secara real-time untuk mengecek phase cancellation
   */
  function toggleMonoCheck() {
    isMonoCheck.value = !isMonoCheck.value
    if (!audioCtx) return

    const now = audioCtx.currentTime
    const ramp = 0.008

    if (isMonoCheck.value) {
      stereoDirectGain.gain.setValueAtTime(stereoDirectGain.gain.value, now)
      stereoDirectGain.gain.linearRampToValueAtTime(0.0, now + ramp)

      monoDirectGain.gain.setValueAtTime(monoDirectGain.gain.value, now)
      monoDirectGain.gain.linearRampToValueAtTime(1.0, now + ramp)
    } else {
      stereoDirectGain.gain.setValueAtTime(stereoDirectGain.gain.value, now)
      stereoDirectGain.gain.linearRampToValueAtTime(1.0, now + ramp)

      monoDirectGain.gain.setValueAtTime(monoDirectGain.gain.value, now)
      monoDirectGain.gain.linearRampToValueAtTime(0.0, now + ramp)
    }
  }

  function setTrackVolume(trackId, val) {
    const t = tracks.value.find(tr => tr.id === trackId)
    if (!t) return
    t.volume = Math.max(0, Math.min(val, 1.5))
    if (t.nodes && audioCtx) {
      t.nodes.chGain.gain.setTargetAtTime(t.volume, audioCtx.currentTime, 0.01)
    }
  }

  function setTrackPan(trackId, val) {
    const t = tracks.value.find(tr => tr.id === trackId)
    if (!t) return
    t.pan = Math.max(-1.0, Math.min(val, 1.0))
    if (t.nodes?.panner && audioCtx) {
      t.nodes.panner.pan.setTargetAtTime(t.pan, audioCtx.currentTime, 0.01)
    }
  }

  function toggleTrackMute(trackId) {
    const t = tracks.value.find(tr => tr.id === trackId)
    if (!t) return
    t.isMuted = !t.isMuted
    recalculateAllSoloMuteStates()
  }

  function toggleTrackSolo(trackId) {
    const t = tracks.value.find(tr => tr.id === trackId)
    if (!t) return
    t.isSolo = !t.isSolo
    recalculateAllSoloMuteStates()
  }

  function recalculateAllSoloMuteStates() {
    if (!audioCtx) return
    const now = audioCtx.currentTime
    const hasSolo = tracks.value.some(t => t.isSolo)

    tracks.value.forEach(t => {
      let audible = true
      if (t.isMuted) {
        audible = false
      } else if (hasSolo && !t.isSolo) {
        audible = false
      }

      if (t.nodes?.soloMuteGain) {
        t.nodes.soloMuteGain.gain.setTargetAtTime(audible ? 1.0 : 0.0, now, 0.01)
      }
    })
  }

  function setMasterVolume(val) {
    masterVolume.value = Math.max(0, Math.min(val, 1.5))
    if (masterGain && audioCtx) {
      masterGain.gain.setTargetAtTime(masterVolume.value, audioCtx.currentTime, 0.01)
    }
  }

  function startTelemetryLoop() {
    stopTelemetryLoop()

    const timeDomainL = new Float32Array(analyserL.fftSize)
    const timeDomainR = new Float32Array(analyserR.fftSize)

    function loop() {
      if (!isPlaying.value || !audioCtx) return

      const elapsed = audioCtx.currentTime - playbackStartTime
      currentTime.value = Math.min(elapsed, duration.value)

      if (elapsed >= duration.value && duration.value > 0) {
        stop()
        return
      }

      analyserL.getFloatTimeDomainData(timeDomainL)
      analyserR.getFloatTimeDomainData(timeDomainR)

      let maxL = 0
      let maxR = 0
      for (let i = 0; i < timeDomainL.length; i++) {
        const absL = Math.abs(timeDomainL[i])
        const absR = Math.abs(timeDomainR[i])
        if (absL > maxL) maxL = absL
        if (absR > maxR) maxR = absR
      }

      const dbL = maxL > 0.0001 ? 20 * Math.log10(maxL) : -60
      const dbR = maxR > 0.0001 ? 20 * Math.log10(maxR) : -60

      peakLeft.value = Math.max(-60, Math.min(3, dbL))
      peakRight.value = Math.max(-60, Math.min(3, dbR))

      animFrameId = requestAnimationFrame(loop)
    }

    animFrameId = requestAnimationFrame(loop)
  }

  function stopTelemetryLoop() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId)
      animFrameId = null
    }
  }

  function getGoniometerData(bufferL, bufferR) {
    if (!analyserL || !analyserR) return false
    analyserL.getFloatTimeDomainData(bufferL)
    analyserR.getFloatTimeDomainData(bufferR)
    return true
  }

  function dispose() {
    stop()
    if (audioCtx) {
      try {
        audioCtx.close()
      } catch (_) {}
      audioCtx = null
    }
    masterBus = null
    masterGain = null
    analyserL = null
    analyserR = null
    isInitialized.value = false
    tracks.value = []
  }

  onUnmounted(() => {
    dispose()
  })

  return {
    isInitialized,
    isLoading,
    loadingProgress,
    loadError,
    isPlaying,
    currentTime,
    duration,
    playbackMode,
    isMonoCheck,
    masterVolume,
    peakLeft,
    peakRight,
    tracks,

    loadSessionAudio,
    play,
    pause,
    stop,
    seek,
    setPlaybackMode,
    togglePlaybackMode,
    toggleMonoCheck,
    setTrackVolume,
    setTrackPan,
    toggleTrackMute,
    toggleTrackSolo,
    setMasterVolume,
    getGoniometerData,
    dispose
  }
}
