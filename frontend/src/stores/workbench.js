import { defineStore } from 'pinia';
import axios from 'axios';

const POLL_INTERVAL_MS = 1500;
const MAX_CONSECUTIVE_POLL_ERRORS = 5;

export const WORKBENCH_EXPORT_FORMATS = [
  { value: 'auto', label: 'Sesuai File Asli' },
  { value: 'flac24', label: 'FLAC 24-bit' },
  { value: 'wav24', label: 'WAV 24-bit PCM' },
  { value: 'mp3_320', label: 'MP3 320 kbps' },
];

async function extractBlobError(err, fallbackMsg) {
  if (err?.response?.data instanceof Blob) {
    try {
      const text = await err.response.data.text();
      const parsed = JSON.parse(text);
      if (parsed?.error) return parsed.error;
    } catch {
      // keep fallback message
    }
  } else if (err?.response?.data?.error) {
    return err.response.data.error;
  }
  return err?.message || fallbackMsg;
}

async function fetchAndTriggerBlobDownload(url, fallbackName) {
  const res = await axios.get(url, { responseType: 'blob' });
  const filename = extractFilenameFromHeader(res.headers?.['content-disposition'], fallbackName);
  const blobUrl = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  return filename;
}

let pollTimer = null;
let isPollingRequest = false;
let consecutivePollErrors = 0;
let activePollToken = 0;

function createEmptySplitterSource() {
  return {
    file: null,
    fileName: '',
    jobId: null,
    stemName: null,
    rawUrl: null,
    rawDurationSec: 0,
  };
}

function revokeBlobUrl(url) {
  if (typeof url === 'string' && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

function extractFilenameFromHeader(disposition, fallbackName) {
  if (!disposition || typeof disposition !== 'string') {
    return fallbackName;
  }
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return utf8Match[1].trim();
    }
  }
  const asciiMatch = disposition.match(/filename="?([^";]+)"?/i);
  if (asciiMatch && asciiMatch[1]) {
    return asciiMatch[1].trim();
  }
  return fallbackName;
}

export const useWorkbenchStore = defineStore('workbench', {
  state: () => ({
    activeTab: 'separator', // 'separator' | 'splitter'
    job: null,
    polling: false,
    isUploading: false,
    isSplitting: false,
    isDownloadingZip: false,
    isSendingToStudio: false,
    downloadFormat: 'auto',
    error: null,
    splitterSource: createEmptySplitterSource(),
    splitResult: null,
  }),

  getters: {
    hasCompletedJob: (state) => state.job?.status === 'COMPLETED' && Array.isArray(state.job?.stems) && state.job.stems.length > 0,
    isJobRunning: (state) => state.job?.status === 'QUEUED' || state.job?.status === 'PROCESSING',
    hasSplitterSource: (state) => Boolean(state.splitterSource.file || (state.splitterSource.jobId && state.splitterSource.stemName)),
  },

  actions: {
    setActiveTab(tab) {
      if (tab === 'separator' || tab === 'splitter') {
        this.activeTab = tab;
      }
    },

    clearError() {
      this.error = null;
    },

    stopPolling() {
      activePollToken += 1;
      if (pollTimer !== null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      isPollingRequest = false;
      consecutivePollErrors = 0;
      this.polling = false;
    },

    async startSeparation(file) {
      if (!file) {
        const msg = 'Berkas audio wajib dipilih sebelum memulai pemisahan stem';
        this.error = msg;
        throw new Error(msg);
      }

      this.stopPolling();
      this.error = null;
      this.isUploading = true;

      try {
        const formData = new FormData();
        formData.append('audio', file);

        const res = await axios.post('/api/v1/workbench/separate', formData);
        const { jobId, status, fileName } = res.data;

        this.job = {
          jobId,
          fileName: fileName || file.name,
          status: status || 'QUEUED',
          progress: 0,
          stepMessage: 'Menunggu antrean pemrosesan',
          stems: [],
          error: null,
        };

        this.pollJob(jobId);
        return res.data;
      } catch (err) {
        const msg = err.response?.data?.error || err.message || 'Gagal memulai pemisahan stem audio';
        this.error = msg;
        throw err;
      } finally {
        this.isUploading = false;
      }
    },

    async fetchJobStatus(jobId) {
      if (!jobId || isPollingRequest) return null;
      const token = activePollToken;
      isPollingRequest = true;

      try {
        const res = await axios.get(`/api/v1/workbench/jobs/${jobId}`);
        if (token !== activePollToken || !this.job || this.job.jobId !== jobId) {
          return null;
        }
        consecutivePollErrors = 0;

        const data = res.data;
        this.job = {
          jobId: data.jobId,
          fileName: data.fileName || this.job?.fileName || '',
          sourceFormat: data.sourceFormat || this.job?.sourceFormat || null,
          status: data.status,
          progress: data.progress ?? 0,
          stepMessage: data.stepMessage || '',
          stems: Array.isArray(data.stems) ? data.stems : [],
          error: data.error || null,
        };

        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
          this.stopPolling();
          if (data.status === 'FAILED' && data.error) {
            this.error = data.error;
          }
        }

        return this.job;
      } catch (err) {
        if (token !== activePollToken || !this.job || this.job.jobId !== jobId) {
          return null;
        }
        consecutivePollErrors += 1;
        const status = err.response?.status;
        if (status === 401 || status === 403 || status === 404 || consecutivePollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
          this.error = err.response?.data?.error || 'Gagal memantau status pemisahan stem';
          this.stopPolling();
        }
        return null;
      } finally {
        if (token === activePollToken) {
          isPollingRequest = false;
        }
      }
    },

    pollJob(jobId) {
      if (!jobId) return;
      this.stopPolling();
      activePollToken += 1;
      this.polling = true;

      // Trigger immediate check, then poll every 1500ms
      void this.fetchJobStatus(jobId);
      pollTimer = setInterval(() => {
        void this.fetchJobStatus(jobId);
      }, POLL_INTERVAL_MS);
    },

    openStemInSplitter(stem) {
      if (!stem) return;
      revokeBlobUrl(this.splitterSource.rawUrl);
      this.error = null;
      this.splitResult = null;
      this.splitterSource = {
        file: null,
        fileName: stem.label ? `${stem.label} (${stem.name}.wav)` : `${stem.name}.wav`,
        jobId: this.job?.jobId || null,
        stemName: stem.name,
        rawUrl: stem.audioUrl || null,
        rawDurationSec: Number(stem.durationSec ?? 0),
      };
      this.activeTab = 'splitter';
    },

    loadLocalFileInSplitter(file, durationSec = 0) {
      if (!file) return;
      revokeBlobUrl(this.splitterSource.rawUrl);
      const rawUrl = URL.createObjectURL(file);

      this.error = null;
      this.splitResult = null;
      this.splitterSource = {
        file,
        fileName: file.name,
        jobId: null,
        stemName: null,
        rawUrl,
        rawDurationSec: Number(durationSec || 0),
      };
      this.activeTab = 'splitter';
    },

    setSplitterDuration(durationSec) {
      const parsed = Number(durationSec);
      if (Number.isFinite(parsed) && parsed > 0) {
        this.splitterSource.rawDurationSec = parsed;
      }
    },

    async executeSplit({ regions = [], fadeMs = 15 } = {}) {
      if (!this.splitterSource.file && !(this.splitterSource.jobId && this.splitterSource.stemName)) {
        const msg = 'Pilih stem atau unggah berkas audio terlebih dahulu';
        this.error = msg;
        throw new Error(msg);
      }

      if (!Array.isArray(regions) || regions.length === 0) {
        const msg = 'Tambahkan minimal 1 segmen region sebelum mengekspor aset';
        this.error = msg;
        throw new Error(msg);
      }

      const normalizedRegions = regions.map((region) => ({
        name: typeof region.name === 'string' ? region.name : '',
        startSec: Number(region.startSec),
        endSec: Number(region.endSec),
      }));

      this.isSplitting = true;
      this.error = null;

      try {
        let res;
        if (this.splitterSource.file) {
          const formData = new FormData();
          formData.append('audio', this.splitterSource.file);
          formData.append('regions', JSON.stringify(normalizedRegions));
          formData.append('fadeMs', String(fadeMs));

          res = await axios.post('/api/v1/workbench/split', formData);
        } else {
          res = await axios.post('/api/v1/workbench/split', {
            jobId: this.splitterSource.jobId,
            stemName: this.splitterSource.stemName,
            regions: normalizedRegions,
            fadeMs,
          });
        }

        const data = res.data;
        this.splitResult = {
          splitId: data.splitId,
          sourceFileName: data.sourceFileName || this.splitterSource.fileName || '',
          sourceFormat: data.sourceFormat || this.job?.sourceFormat || null,
          fadeMs: data.fadeMs ?? fadeMs,
          totalAssets: data.totalAssets ?? (Array.isArray(data.assets) ? data.assets.length : 0),
          assets: Array.isArray(data.assets) ? data.assets : [],
        };

        return this.splitResult;
      } catch (err) {
        const msg = err.response?.data?.error || err.message || 'Gagal memecah segmen audio';
        this.error = msg;
        throw err;
      } finally {
        this.isSplitting = false;
      }
    },

    async downloadZip(jobId = this.job?.jobId, format = this.downloadFormat) {
      if (!jobId) {
        const msg = 'Tidak ada pekerjaan workbench yang tersedia untuk diunduh';
        this.error = msg;
        throw new Error(msg);
      }

      this.isDownloadingZip = true;
      this.error = null;

      try {
        const fallbackName = this.job?.fileName
          ? `Polaris_Workbench_${this.job.fileName.replace(/\.[^.]+$/, '')}_Stems.zip`
          : 'Polaris_Workbench_Stems.zip';
        return await fetchAndTriggerBlobDownload(
          `/api/v1/workbench/jobs/${jobId}/download-zip?format=${encodeURIComponent(format || 'auto')}`,
          fallbackName
        );
      } catch (err) {
        this.error = await extractBlobError(err, 'Gagal mengunduh arsip ZIP stem');
        throw err;
      } finally {
        this.isDownloadingZip = false;
      }
    },

    async downloadStem(stemName, format = this.downloadFormat) {
      const jobId = this.job?.jobId;
      if (!jobId || !stemName) {
        const msg = 'Stem tidak tersedia untuk diunduh';
        this.error = msg;
        throw new Error(msg);
      }

      this.error = null;
      try {
        return await fetchAndTriggerBlobDownload(
          `/api/v1/workbench/jobs/${jobId}/stems/${encodeURIComponent(stemName)}/download?format=${encodeURIComponent(format || 'auto')}`,
          `${stemName}.wav`
        );
      } catch (err) {
        this.error = await extractBlobError(err, 'Gagal mengunduh berkas stem audio');
        throw err;
      }
    },

    async downloadSplitZip(format = this.downloadFormat) {
      const splitId = this.splitResult?.splitId;
      if (!splitId) {
        const msg = 'Hasil pemecahan aset belum tersedia untuk diunduh';
        this.error = msg;
        throw new Error(msg);
      }

      this.isDownloadingZip = true;
      this.error = null;

      try {
        const baseSource = this.splitResult?.sourceFileName || this.splitterSource.fileName;
        const fallbackName = baseSource
          ? `Polaris_Workbench_${baseSource.replace(/\.[^.]+$/, '')}_Assets.zip`
          : 'Polaris_Workbench_Assets.zip';
        return await fetchAndTriggerBlobDownload(
          `/api/v1/workbench/splits/${splitId}/download-zip?format=${encodeURIComponent(format || 'auto')}`,
          fallbackName
        );
      } catch (err) {
        this.error = await extractBlobError(err, 'Gagal mengunduh arsip ZIP aset audio');
        throw err;
      } finally {
        this.isDownloadingZip = false;
      }
    },

    async downloadSplitAsset(asset, format = this.downloadFormat) {
      const storageKey = asset?.storageKey;
      if (!storageKey) {
        const msg = 'Berkas aset audio belum tersedia';
        this.error = msg;
        throw new Error(msg);
      }

      this.error = null;
      try {
        const targetFileName = asset.fileName || (asset.name ? `${asset.name}.wav` : 'asset.wav');
        const params = new URLSearchParams({
          storageKey,
          format: format || 'auto',
          fileName: targetFileName,
        });
        const srcFmt = this.splitResult?.sourceFormat;
        if (srcFmt?.targetFormat) {
          params.set('sourceTargetFormat', srcFmt.targetFormat);
        }
        if (srcFmt?.bitrateKbps) {
          params.set('sourceBitrateKbps', String(srcFmt.bitrateKbps));
        }
        return await fetchAndTriggerBlobDownload(
          `/api/v1/workbench/export?${params.toString()}`,
          targetFileName
        );
      } catch (err) {
        this.error = await extractBlobError(err, 'Gagal mengunduh berkas aset audio');
        throw err;
      }
    },

    async sendToStudio(title, stemNames) {
      const jobId = this.job?.jobId;
      if (!jobId) {
        const msg = 'Tidak ada pekerjaan pemisahan stem yang aktif';
        this.error = msg;
        throw new Error(msg);
      }

      this.isSendingToStudio = true;
      this.error = null;

      try {
        const payload = {};
        if (typeof title === 'string' && title.trim()) {
          payload.title = title.trim();
        }
        if (Array.isArray(stemNames) && stemNames.length > 0) {
          payload.stemNames = stemNames;
        }

        const res = await axios.post(`/api/v1/workbench/jobs/${jobId}/send-to-session`, payload);
        return res.data;
      } catch (err) {
        const msg = err.response?.data?.error || err.message || 'Gagal mengirim stem ke Studio Workspace';
        this.error = msg;
        throw err;
      } finally {
        this.isSendingToStudio = false;
      }
    },

    reset() {
      this.stopPolling();
      revokeBlobUrl(this.splitterSource.rawUrl);
      this.activeTab = 'separator';
      this.job = null;
      this.isUploading = false;
      this.isSplitting = false;
      this.isDownloadingZip = false;
      this.isSendingToStudio = false;
      this.error = null;
      this.splitterSource = createEmptySplitterSource();
      this.splitResult = null;
    },
  },
});
