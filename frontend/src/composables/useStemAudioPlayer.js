import { ref } from 'vue'
import axios from 'axios'

// Singleton audio player state shared across all TrackClassificationCard instances
const currentPlayingTrackId = ref(null)
const isPlaying = ref(false)
const isLoading = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1.0)
const audioError = ref(null)

// Cache presigned URLs per sessionId to prevent redundant network fetches
const sourcesCache = new Map()

let audioInstance = null

function getAudioElement() {
  if (!audioInstance && typeof window !== 'undefined') {
    audioInstance = new Audio()
    audioInstance.preload = 'metadata'

    audioInstance.ontimeupdate = () => {
      currentTime.value = audioInstance.currentTime
    }

    audioInstance.onloadedmetadata = () => {
      if (audioInstance.duration && !isNaN(audioInstance.duration)) {
        duration.value = audioInstance.duration
      }
      isLoading.value = false
    }

    audioInstance.onplaying = () => {
      isLoading.value = false
      isPlaying.value = true
    }

    audioInstance.onwaiting = () => {
      isLoading.value = true
    }

    audioInstance.onpause = () => {
      isPlaying.value = false
    }

    audioInstance.onended = () => {
      isPlaying.value = false
      currentTime.value = 0
      if (audioInstance) {
        audioInstance.currentTime = 0
      }
    }

    audioInstance.onerror = () => {
      audioError.value = 'Gagal memuat streaming audio stem.'
      isLoading.value = false
      isPlaying.value = false
    }
  }
  return audioInstance
}

/**
 * Format seconds to high-precision mm:ss.tenths (DAW style)
 */
export function formatTime(sec) {
  if (isNaN(sec) || sec < 0) return '00:00.0'
  const mins = Math.floor(sec / 60)
  const secs = Math.floor(sec % 60)
  const tenths = Math.floor((sec % 1) * 10)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`
}

export function useStemAudioPlayer() {
  async function togglePlay(sessionId, track) {
    const audio = getAudioElement()
    if (!audio) return

    const sId = sessionId || track.sessionId

    // Case 1: Toggle play/pause for the CURRENT track
    if (currentPlayingTrackId.value === track.id) {
      if (isPlaying.value) {
        audio.pause()
      } else {
        audioError.value = null
        try {
          await audio.play()
        } catch (err) {
          console.error('[StemPlayer] Playback resume error:', err)
          audioError.value = 'Tidak dapat memutar audio: ' + (err.message || 'Error')
        }
      }
      return
    }

    // Case 2: Switch to a NEW track
    audio.pause()
    currentPlayingTrackId.value = track.id
    currentTime.value = 0
    duration.value = track.durationSec || 0
    isLoading.value = true
    audioError.value = null

    try {
      if (!sId) {
        throw new Error('ID Sesi tidak ditemukan untuk stem ini.')
      }

      // Check or fetch presigned audio URLs
      let sources = sourcesCache.get(sId)
      if (!sources) {
        const res = await axios.get(`/api/v1/sessions/${sId}/audio-sources`, {
          params: { _t: Date.now() }
        })
        sources = res.data?.tracks || []
        sourcesCache.set(sId, sources)
      }

      const trackSource = sources.find(t => t.id === track.id)
      const audioUrl = trackSource?.rawAudioUrl || trackSource?.repairedAudioUrl || track.rawAudioUrl

      if (!audioUrl) {
        throw new Error('URL streaming audio tidak tersedia untuk stem ini.')
      }

      // Reset and load fresh audio source
      audio.src = audioUrl
      audio.currentTime = 0
      audio.volume = volume.value

      await audio.play()
    } catch (err) {
      console.error('[StemPlayer] Error loading stem audio:', err)
      audioError.value = err.response?.data?.error || err.message || 'Gagal memuat stem audio'
      isPlaying.value = false
    } finally {
      isLoading.value = false
    }
  }

  function seek(timeSec) {
    const audio = getAudioElement()
    if (!audio) return
    const target = Math.max(0, Math.min(duration.value || 1, timeSec))
    audio.currentTime = target
    currentTime.value = target
  }

  function nudge(deltaSec) {
    const audio = getAudioElement()
    if (!audio) return
    const target = Math.max(0, Math.min(duration.value || 1, audio.currentTime + deltaSec))
    audio.currentTime = target
    currentTime.value = target
  }

  function setVolume(val) {
    const clamped = Math.max(0, Math.min(1, val))
    volume.value = clamped
    const audio = getAudioElement()
    if (audio) {
      audio.volume = clamped
    }
  }

  function pause() {
    const audio = getAudioElement()
    if (audio) {
      audio.pause()
    }
    isPlaying.value = false
  }

  function stop() {
    const audio = getAudioElement()
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    currentPlayingTrackId.value = null
    isPlaying.value = false
    currentTime.value = 0
    audioError.value = null
  }

  function invalidateCache(sessionId) {
    if (sessionId) {
      sourcesCache.delete(sessionId)
    } else {
      sourcesCache.clear()
    }
  }

  function cleanup() {
    stop()
  }

  return {
    currentPlayingTrackId,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    audioError,
    formatTime,
    togglePlay,
    seek,
    nudge,
    setVolume,
    pause,
    stop,
    invalidateCache,
    cleanup
  }
}
