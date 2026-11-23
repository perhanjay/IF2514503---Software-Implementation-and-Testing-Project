# Audio Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the unified `/workbench` page (**Audio Workbench**) with two tabs — AI 4-Stem Separation (`Meta Demucs`) and Visual Smart Silence Trimmer & De-Clicker — seamlessly bridged to Polaris Studio Workspace while preserving zero-aligned multitrack integrity.

**Architecture:** Client browser renders interactive `<canvas>` waveforms inside dark `.retro-monitor` screens via Web Audio API for real-time dead-zone visualization and scrubbing. Node.js Express routes under `/api/v1/workbench` manage MinIO S3 storage (`workbench/{userId}/{jobId}/`), Redis job states (`workbench:job:{jobId}`), single-slot FIFO concurrency gating, and Studio Workspace session handoff. Python worker CLI commands (`--separate-stdin` and `--trim-stdin`) perform Demucs inference (plus `POLARIS_FAST_STEM_MODE=1` deterministic test fallback) and 32-bit float silence trimming with raised-cosine zero-crossing micro-fades.

**Tech Stack:** Vue 3.5 (`<script setup>`), Pinia 4.0, Tailwind CSS v4 (`DESIGN.md` v2 Retro Studio), Web Audio API, Node.js ESM + Express 4.21, Redis (`ioredis`), MinIO S3 (`@aws-sdk/client-s3`), Prisma ORM 6.4, Python 3.10+, NumPy, SciPy, SoundFile, PyTorch CPU-only, Torchaudio, Demucs (`htdemucs`), FFmpeg.

**Spec:** [`docs/superpowers/specs/2026-11-23-audio-workbench-design.md`](../specs/2026-11-23-audio-workbench-design.md)

## Global Constraints

- **Design System (`DESIGN.md` v2):** Canvas `.notebook-paper` (`#fcfcfb`), frosted glass `.retro-glass-card` (`rounded-[18px] border-2 border-[#111111] shadow-[3px_4px_0_#111111]`), tactile buttons `.btn-keycap` (`.btn-keycap-blue`, `.btn-keycap-white`, `.btn-keycap-yellow`), waveform/visualizer inside `.retro-monitor` (`#18181b`), headings `font-editorial font-bold`, UI controls `Plus Jakarta Sans`, telemetry `JetBrains Mono` / `tabular-nums`. Zero `--color-bone`, zero flat `rounded-none` cards, zero `UC-XX` visible labels.
- **Audio Standard:** All processed output stems and trimmed files must be valid stereo `48000 Hz` `float32`/`PCM_24` WAV via `soundfile`.
- **Token Policy & Access:** Workbench operations cost `0 Token`. Auth uses `authenticate` + `requireAudioEngineer`; `/workbench` auto-provisions `guest-session` on mount like `DashboardView.vue`; `ADMIN` role redirects to `/admin/users`.
- **Docker & Testing Constraint:** `backend/Dockerfile` uses CPU-only PyTorch wheels, installs `ffmpeg` and `demucs`, and pre-bakes `htdemucs` weights at build time; automated tests run fast without internet downloads via `POLARIS_FAST_STEM_MODE=1`.
- **Web Audio Lifecycle:** Disconnect/stop all `AudioBufferSourceNode`, `GainNode`, and close `AudioContext` on component `onUnmounted`.

## Review Focus

- Corrupt, 0-byte, or non-audio upload rejected cleanly with HTTP `400` / structured error rather than unhandled worker tracebacks or HTTP `500` HTML.
- Fully silent audio below `threshold_db` or invalid trim bounds (`manualStartSec >= manualEndSec`) returns clear error message without producing 0-sample audio files.
- Synced multi-stem trimming uses the combined energy union envelope across all 4 stems so a silent vocal intro never shifts `vocals.wav` forward on top of `drums.wav`.
- Concurrent `POST /api/v1/workbench/separate` requests serialize cleanly through the Redis/FIFO queue (`concurrency = 1`) without corrupting job statuses or OOM-crashing.
- Non-owner user accessing job status, ZIP download, trim, or `send-to-session` receives HTTP `403`, and invalid/mismatched-duration `stemNames` receives HTTP `400`.

---

### Task 1: Python Workbench DSP & AI Modules + Docker Packaging

**Files:**
- Create: `worker/src/workbench/__init__.py`
- Create: `worker/src/workbench/silence_trimmer.py`
- Create: `worker/src/workbench/stem_separator.py`
- Create: `worker/tests/test_workbench.py`
- Modify: `worker/src/worker.py:486-531`
- Modify: `worker/requirements.txt`
- Modify: `backend/Dockerfile:8-29`

**Interfaces:**
- Produces in `worker/src/workbench/silence_trimmer.py`:
  - `decode_audio_bytes(raw_bytes: bytes, file_name: str) -> tuple[np.ndarray, int]` (returns `float32` stereo `(N, 2)` at `48000 Hz`, using `ffmpeg` fallback for `.mp3`/unsupported containers)
  - `encode_wav_bytes(audio_data: np.ndarray, sample_rate: int = 48000) -> bytes`
  - `extract_waveform_peaks(audio_data: np.ndarray, num_bins: int = 200) -> list[float]`
  - `find_trim_sample_bounds(audio_data: np.ndarray, sample_rate: int, threshold_db: float = -45.0, pad_ms: float = 100.0, manual_start_sec: float | None = None, manual_end_sec: float | None = None) -> tuple[int, int]`
  - `trim_audio_silence(audio_data: np.ndarray, sample_rate: int, threshold_db: float = -45.0, pad_ms: float = 100.0, fade_ms: float = 15.0, manual_start_sec: float | None = None, manual_end_sec: float | None = None) -> dict` (keys: `trimmed_audio`, `sample_rate`, `start_sample`, `end_sample`, `original_duration_sec`, `trimmed_duration_sec`, `lead_in_removed_sec`, `tail_removed_sec`, `peaks`)
  - `compute_union_trim_bounds(stems_map: dict[str, np.ndarray], sample_rate: int, threshold_db: float = -45.0, pad_ms: float = 100.0, manual_start_sec: float | None = None, manual_end_sec: float | None = None) -> tuple[int, int]`
  - `slice_aligned_batch(stems_map: dict[str, np.ndarray], sample_rate: int, start_sample: int, end_sample: int, fade_ms: float = 15.0) -> dict[str, dict]`
- Produces in `worker/src/workbench/stem_separator.py`:
  - `STEM_ORDER = ("vocals", "drums", "bass", "other")`
  - `separate_audio_stems(audio_bytes: bytes, file_name: str, use_fast_fallback: bool | None = None) -> dict` (returns `{ "sample_rate": 48000, "duration_sec": float, "stems": { "vocals": bytes, "drums": bytes, "bass": bytes, "other": bytes } }`)
- Produces CLI modes in `worker/src/worker.py`:
  - `--separate-stdin`: stdin `{ jobId, userId, fileName, sourceStorageKey }`, outputs `{ status, durationSec, stems: [{ name, label, storageKey, durationSec }] }`
  - `--trim-stdin`: stdin `{ mode, sourceStorageKey?, targetKey?, stems?, thresholdDb, padMs, fadeMs, manualStartSec?, manualEndSec? }`, outputs `{ originalDurationSec, trimmedDurationSec, leadInRemovedSec, tailRemovedSec, trimmedPeaks, targetKey?, updatedStems? }`

- [ ] **Step 1: Write failing tests for Silence Trimmer, Union Envelope, & Stem Separator in `worker/tests/test_workbench.py`**

```python
import io
import os
import sys
import numpy as np
import soundfile as sf
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from workbench.silence_trimmer import (
    trim_audio_silence,
    compute_union_trim_bounds,
    slice_aligned_batch,
    decode_audio_bytes,
)
from workbench.stem_separator import separate_audio_stems, STEM_ORDER


def _make_sine(freq: float, duration_sec: float, sr: int = 48000, amp: float = 0.5) -> np.ndarray:
    t = np.linspace(0, duration_sec, int(sr * duration_sec), endpoint=False, dtype=np.float32)
    wave = amp * np.sin(2.0 * np.pi * freq * t)
    return np.column_stack([wave, wave]).astype(np.float32)


def test_silence_trimmer_strips_lead_and_tail():
    sr = 48000
    audio = np.vstack([
        np.zeros((3 * sr, 2), dtype=np.float32),
        _make_sine(440.0, 2.0, sr=sr, amp=0.5),
        np.zeros((4 * sr, 2), dtype=np.float32),
    ])
    res = trim_audio_silence(audio, sr, threshold_db=-45.0, pad_ms=100.0, fade_ms=15.0)
    assert 2.15 <= res["trimmed_duration_sec"] <= 2.30
    assert 2.85 <= res["lead_in_removed_sec"] <= 3.05
    assert 3.85 <= res["tail_removed_sec"] <= 4.05
    assert len(res["peaks"]) == 200


def test_silence_trimmer_applies_zero_crossing_fade():
    sr = 48000
    audio = _make_sine(220.0, 1.0, sr=sr, amp=0.8)
    # Force DC discontinuity at both edges using manual trim without silence pad
    res = trim_audio_silence(audio, sr, fade_ms=15.0, manual_start_sec=0.1, manual_end_sec=0.9)
    trimmed = res["trimmed_audio"]
    assert abs(float(trimmed[0, 0])) < 1e-4
    assert abs(float(trimmed[-1, 0])) < 1e-4


def test_silence_trimmer_rejects_full_silence_and_invalid_bounds():
    sr = 48000
    silent = np.zeros((2 * sr, 2), dtype=np.float32)
    with pytest.raises(ValueError, match="hening"):
        trim_audio_silence(silent, sr, threshold_db=-45.0)

    active = _make_sine(440.0, 2.0, sr=sr)
    with pytest.raises(ValueError, match="batas"):
        trim_audio_silence(active, sr, manual_start_sec=1.5, manual_end_sec=1.0)


def test_union_envelope_preserves_intro_drum_when_vocal_enters_late():
    sr = 48000
    # 2s total silence -> 2s drum intro (vocal still silent) -> 2s both active -> 2s end silence
    drums = np.vstack([
        np.zeros((2 * sr, 2), dtype=np.float32),
        _make_sine(100.0, 4.0, sr=sr, amp=0.6),
        np.zeros((2 * sr, 2), dtype=np.float32),
    ])
    vocals = np.vstack([
        np.zeros((4 * sr, 2), dtype=np.float32),
        _make_sine(800.0, 2.0, sr=sr, amp=0.6),
        np.zeros((2 * sr, 2), dtype=np.float32),
    ])
    stems = {"drums": drums, "vocals": vocals, "bass": drums.copy(), "other": vocals.copy()}
    start_idx, end_idx = compute_union_trim_bounds(stems, sr, threshold_db=-45.0, pad_ms=100.0)
    # Cut must happen around t=1.9s (keeping the 2s..4s drum intro intact)
    assert start_idx / sr <= 2.0
    assert end_idx / sr >= 6.0

    batch = slice_aligned_batch(stems, sr, start_idx, end_idx, fade_ms=15.0)
    lengths = {len(v["trimmed_audio"]) for v in batch.values()}
    assert len(lengths) == 1


def test_corrupt_audio_bytes_rejected_cleanly():
    with pytest.raises(ValueError, match="rusak|tidak didukung"):
        decode_audio_bytes(b"not-valid-audio-data", "corrupt.wav")


def test_stem_separator_produces_four_zero_aligned_stems_fast_mode():
    sr = 48000
    mix = _make_sine(80.0, 1.5, sr, amp=0.4) + _make_sine(1000.0, 1.5, sr, amp=0.4)
    buf = io.BytesIO()
    sf.write(buf, mix, sr, format="WAV", subtype="FLOAT")

    result = separate_audio_stems(buf.getvalue(), "test_mix.wav", use_fast_fallback=True)
    assert result["sample_rate"] == 48000
    assert set(result["stems"].keys()) == set(STEM_ORDER)
    durations = []
    for name, wav_bytes in result["stems"].items():
        data, stem_sr = sf.read(io.BytesIO(wav_bytes), dtype="float32")
        assert stem_sr == 48000
        assert data.ndim == 2 and data.shape[1] == 2
        durations.append(len(data))
    assert len(set(durations)) == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest worker/tests/test_workbench.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'workbench'`

- [ ] **Step 3: Implement `silence_trimmer.py` (`worker/src/workbench/__init__.py` and `worker/src/workbench/silence_trimmer.py`)**

Implement the exact signatures listed in `Interfaces`:
- `decode_audio_bytes`: read via `sf.read(io.BytesIO(raw_bytes), dtype='float32', always_2d=True)` with `ffmpeg` subprocess fallback to WAV tempfile when `libsndfile` fails (e.g., MP3/M4A); reject 0-byte or failed decodes with `ValueError("Berkas audio rusak atau format tidak didukung")`; convert mono `(N, 1)` to stereo `(N, 2)` and resample to `48000 Hz` via `scipy.signal.resample_poly`.
- `encode_wav_bytes`: write stereo `float32` WAV via `sf.write(..., format="WAV", subtype="FLOAT")`.
- `find_trim_sample_bounds`: slide 10 ms RMS window over stereo max-magnitude `np.max(np.abs(audio_data), axis=1)` to find first/last frame exceeding `10 ** (threshold_db / 20.0)`, apply `pad_ms` margin clamped to `[0, total_samples]`. If `manual_start_sec`/`manual_end_sec` provided, convert to samples and validate `0 <= start_idx < end_idx <= total_samples` (else raise `ValueError("Rentang batas pemangkasan tidak valid")`). If entire signal stays below threshold in auto mode, raise `ValueError("Audio sepenuhnya hening di bawah ambang batas yang dipilih")`.
- `trim_audio_silence`: slices `[start_idx:end_idx]`, applies raised-cosine (`0.5 * (1 - cos(pi * n / fade_samples))`) envelope on first and last `fade_samples` (clamped to `len(sliced) // 2`), returns dict matching interface.
- `compute_union_trim_bounds` & `slice_aligned_batch`: computes frame-wise `max` envelope across all stems in `stems_map` before calling `find_trim_sample_bounds`, then slices every stem at identical `(start_sample, end_sample)` with raised-cosine fade.

- [ ] **Step 4: Implement `stem_separator.py` (`worker/src/workbench/stem_separator.py`)**

Implement `separate_audio_stems(audio_bytes: bytes, file_name: str, use_fast_fallback: bool | None = None) -> dict`:
- Resolves `fast_mode = use_fast_fallback if use_fast_fallback is not None else os.getenv("POLARIS_FAST_STEM_MODE", "0") == "1"`.
- Decodes input using `decode_audio_bytes(audio_bytes, file_name)` to `48000 Hz` stereo float32 `(N, 2)`.
- Fast mode (CI/testing): splits signal deterministically via zero-phase Butterworth crossovers (`< 180 Hz` -> `bass`, `180–2500 Hz` -> `vocals`, high-frequency percussive energy -> `drums`, residual -> `other`), preserving exact length `N`.
- Production mode: imports `torch`, `demucs.pretrained.get_model`, and `demucs.apply.apply_model`, caches singleton `'htdemucs'` model in memory, resamples audio `(2, N)` to `model.samplerate` (44100 Hz) if needed, executes `apply_model(model, wav_tensor, shifts=1, split=True, overlap=0.25)`, maps outputs (`model.sources`) to `STEM_ORDER` (`vocals`, `drums`, `bass`, `other`), resamples back to `48000 Hz` with exact target sample count `N` (pad/trim 1 sample max to stay strictly zero-aligned), and encodes WAV bytes.

- [ ] **Step 5: Wire `--separate-stdin` and `--trim-stdin` into `worker/src/worker.py`**

Add `separate_workbench_audio(payload)` and `trim_workbench_audio(payload)` in `worker/src/worker.py` (downloading `sourceStorageKey` from `S3_BUCKET`, calling `stem_separator` / `silence_trimmer`, uploading output stems/trimmed WAV back to MinIO S3, updating optional Redis progress key if provided) and register CLI branches `--separate-stdin` and `--trim-stdin` in `__main__`.

- [ ] **Step 6: Run worker unit tests to verify they pass**

Run: `pytest worker/tests/ -v`
Expected: All existing 44 worker tests + 6 new workbench tests PASS.

- [ ] **Step 7: Update `worker/requirements.txt` and `backend/Dockerfile`**

Update `worker/requirements.txt` to include `torchaudio>=2.0.0` and `demucs>=4.0.0`.
Update `backend/Dockerfile`:
- Install `ffmpeg` in `apt-get install`.
- Install CPU-only PyTorch (`--index-url https://download.pytorch.org/whl/cpu`) + `torch` + `torchaudio` and `-r ./worker/requirements.txt`.
- Add `RUN python3 -c "from demucs.pretrained import get_model; get_model('htdemucs')"` to pre-bake `htdemucs` weights in the image.

- [ ] **Step 8: Commit Task 1**

```bash
git add worker/src/workbench/ worker/tests/test_workbench.py worker/src/worker.py worker/requirements.txt backend/Dockerfile
git commit -m "feat(worker): add Demucs stem separation and zero-aligned silence trimmer modules"
```

---

### Task 2: Backend Workbench API, Redis Concurrency Gate, & Integration Tests

**Files:**
- Create: `backend/src/services/workbenchService.js`
- Create: `backend/src/controllers/workbenchController.js`
- Create: `backend/src/routes/workbenchRoutes.js`
- Create: `backend/tests/13_audio_workbench.test.js`
- Modify: `backend/src/app.js:12-28`

**Interfaces:**
- Consumes from Task 1: `python3 -m worker.src.worker --separate-stdin` and `--trim-stdin`.
- Produces REST API under `/api/v1/workbench` (protected by `authenticate` + `requireAudioEngineer`):
  - `POST /separate` (`audio` file max `100 MB`) -> `202 { jobId, status: "QUEUED", fileName }`
  - `GET /jobs/:jobId` -> `200 { jobId, status, progress, stepMessage, stems: [{ name, label, storageKey, audioUrl, durationSec, isTrimmed }], error }`
  - `GET /jobs/:jobId/download-zip` -> `200 application/zip`
  - `POST /jobs/:jobId/send-to-session` (body: `{ title?, stemNames? }`) -> `201 { session, message }`
  - `POST /trim` (`audio` upload or body `{ jobId, stemName }`, plus `{ thresholdDb, padMs, fadeMs, manualStartSec?, manualEndSec?, syncAllStems }`) -> `200 { storageKey, audioUrl, originalDurationSec, trimmedDurationSec, leadInRemovedSec, tailRemovedSec, trimmedPeaks, updatedJobStems? }`

- [ ] **Step 1: Write failing backend integration tests in `backend/tests/13_audio_workbench.test.js`**

Test suite covering:
1. Auth & Role guards: `401` when unauthenticated; `403` when authenticated as `ADMIN`.
2. Invalid / non-existent jobId returns `404` JSON cleanly (no HTTP 500); corrupt/empty upload returns `400`.
3. `POST /api/v1/workbench/trim` on synthetic WAV with lead/tail silence returns `200` with `trimmedDurationSec < originalDurationSec`, valid presigned `audioUrl`, and S3 object key starting with `workbench/`.
4. `POST /api/v1/workbench/trim` on all-silent WAV returns `400` with descriptive error message.
5. Full workflow with `POLARIS_FAST_STEM_MODE=1`:
   - `POST /api/v1/workbench/separate` returns `202` with `jobId`.
   - Simultaneous 2nd `POST /separate` queues cleanly (`concurrency = 1` gate) and both reach `COMPLETED`.
   - `GET /api/v1/workbench/jobs/:jobId` returns `403` for User B (Anti-IDOR), `200` with 4 stems for User A.
   - `POST /api/v1/workbench/trim` with `{ jobId, stemName: 'vocals', syncAllStems: true }` updates all 4 stems in Redis with equal `durationSec`.
   - `GET /api/v1/workbench/jobs/:jobId/download-zip` returns valid ZIP (`PK` signature) containing 4 WAV files.
   - `POST /api/v1/workbench/jobs/:jobId/send-to-session` rejects invalid `stemNames` (`["invalid"]`) with `400`, rejects User B with `403`, and succeeds `201` for User A creating a `READY` `Session` with 4 `Track` rows in PostgreSQL.

- [ ] **Step 2: Run test to verify it fails**

Run: `POLARIS_FAST_STEM_MODE=1 node --test backend/tests/13_audio_workbench.test.js`
Expected: FAIL with 404 / missing routes or files.

- [ ] **Step 3: Implement `backend/src/services/workbenchService.js`**

Key responsibilities:
- Redis key `workbench:job:{jobId}` (TTL 86400s) storing `{ jobId, userId, fileName, sourceStorageKey, status, progress, stepMessage, stems, error, createdAt }`.
- In-process async FIFO queue (`enqueueSeparationTask`) limiting active `--separate-stdin` spawns to `1` concurrent child process (`timeout: 600000` ms) so concurrent users queue cleanly.
- Validation helpers: MIME/extension check (`.wav`, `.flac`, `.mp3`), `100 MB` max size, non-empty buffer check, UUID validation on `jobId`.
- `getJobStatus(jobId, userId)` attaches fresh presigned `GetObjectCommand` URLs via `s3PublicClient` (2-hour TTL).
- `trimAudio({ userId, file, jobId, stemName, thresholdDb, padMs, fadeMs, manualStartSec, manualEndSec, syncAllStems })`:
  - If `jobId` supplied, verifies ownership (`job.userId === userId`) and looks up active stem S3 key(s).
  - When `syncAllStems` is `true` and `jobId` exists, passes all 4 stem keys to `--trim-stdin` in synced mode, and updates `job.stems` in Redis with the new `storageKey`, `durationSec`, and `isTrimmed: true`.
  - When standalone (`file` uploaded or `syncAllStems === false`), trims only the single track into `workbench/{userId}/trim-{uuid}/TRIMMED_{safeName}.wav` and returns `audioUrl` without altering `job.stems`.
- `downloadJobZip(jobId, userId)`: packages current `job.stems` from S3 into `AdmZip`.
- `sendJobToSession(jobId, userId, { title, stemNames })`: validates `stemNames` subset of `["vocals", "drums", "bass", "other"]` (non-empty), enforces max duration drift `<= 0.1`s (HTTP `400` if mismatched), copies objects (`CopyObjectCommand`) into `sessions/{sessionId}/raw/...`, and creates `Session` (`READY`, `48000`, `24`) + `Track` records with instrument label mapping (`vocals -> "Vocals: Lead"`, `drums -> "Drums: Overhead"`, `bass -> "Bass"`, `other -> "Other"`).

- [ ] **Step 4: Implement `workbenchController.js`, `workbenchRoutes.js`, and mount in `backend/src/app.js`**

- Configure `multer` with `memoryStorage()` and `limits: { fileSize: 100 * 1024 * 1024 }` (single file `'audio'`), propagating clean HTTP `400` JSON errors for oversized or invalid files.
- Mount `app.use('/api/v1/workbench', workbenchRoutes);` in `backend/src/app.js`.

- [ ] **Step 5: Run workbench integration tests + full backend suite**

Run: `POLARIS_FAST_STEM_MODE=1 node --test backend/tests/13_audio_workbench.test.js`
Expected: All cases PASS (once PostgreSQL/Redis/MinIO Docker services are up).

- [ ] **Step 6: Commit Task 2**

```bash
git add backend/src/services/workbenchService.js backend/src/controllers/workbenchController.js backend/src/routes/workbenchRoutes.js backend/src/app.js backend/tests/13_audio_workbench.test.js
git commit -m "feat(api): add Audio Workbench backend routes, FIFO separation queue, and session bridge"
```

---

### Task 3: Frontend Store, Router, Navbar, & Retro Monitor Waveform Canvas

**Files:**
- Create: `frontend/src/stores/workbench.js`
- Create: `frontend/src/components/audio/WaveformTrimmerCanvas.vue`
- Create: `frontend/src/views/AudioWorkbenchView.vue` (minimal placeholder shell so route build passes cleanly before Task 4)
- Modify: `frontend/src/router/index.js:12-50`
- Modify: `frontend/src/components/AppNavbar.vue:234-248` (and mobile nav block)

**Interfaces:**
- Produces `useWorkbenchStore` in `frontend/src/stores/workbench.js`:
  - State: `activeTab` (`'separator' | 'trimmer'`), `job` (current separation job), `polling`, `trimmerSource` (`{ file, fileName, jobId, stemName, rawUrl, rawDurationSec, syncAllStems }`), `trimResult` (`{ storageKey, audioUrl, originalDurationSec, trimmedDurationSec, leadInRemovedSec, tailRemovedSec, trimmedPeaks }`).
  - Actions: `startSeparation(file)`, `pollJob(jobId)`, `openStemInTrimmer(stem)`, `loadLocalFileInTrimmer(file)`, `executeTrim(params)`, `sendToStudio(title, stemNames)`.
- Produces `WaveformTrimmerCanvas.vue` props & events:
  - Props: `peaks` (`Number[]`), `durationSec` (`Number`), `thresholdDb` (`Number`), `padMs` (`Number`), `manualStartSec` (`Number | null`), `manualEndSec` (`Number | null`), `currentTimeSec` (`Number`), `isPlaying` (`Boolean`), `isTrimmedPreview` (`Boolean`).
  - Emits: `seek(timeSec)`, `update:manualStartSec(val)`, `update:manualEndSec(val)`.

- [ ] **Step 1: Add `/workbench` route to `frontend/src/router/index.js`, placeholder `AudioWorkbenchView.vue`, & Admin redirect guard**

Create a minimal `<template><div /></template>` placeholder at `frontend/src/views/AudioWorkbenchView.vue` (completed in Task 4), add lazy route `/workbench` to `frontend/src/router/index.js`, and update the `user?.role === 'ADMIN'` redirect guard (`if (to.path === '/dashboard' || ... || to.path.startsWith('/workbench')) return next('/admin/users');`).

- [ ] **Step 2: Add `Audio Workbench` navigation link to `frontend/src/components/AppNavbar.vue`**

Add desktop link between `Studio Workspace` and `Dompet & Kuota` using exact `AppNavbar.vue` classes (`route.path === '/workbench' ? 'text-black font-semibold' : 'text-[#60605e] hover:text-black font-medium'`) plus matching mobile menu drawer entry.

- [ ] **Step 3: Create Pinia store `frontend/src/stores/workbench.js`**

Implement async job polling (`1500ms` interval, cleared cleanly on completion/failure/reset), `FormData` upload handling, single vs synced trim state updates, and `send-to-session` call.

- [ ] **Step 4: Build `frontend/src/components/audio/WaveformTrimmerCanvas.vue`**

Implement HiDPI `<canvas>` inside a `.retro-monitor` bezel (`#18181b` dark monitor screen, `JetBrains Mono` time ruler overlay):
- Draw grid lines (`rgba(255,255,255,0.06)`).
- Compute client-side preview cut boundaries from `peaks` + `thresholdDb` + `padMs` whenever `!isTrimmedPreview` and manual handles aren't overriding, shading lead-in and tail dead zones in translucent `#ff82c2` (Hot Pink) with dashed cut boundary lines.
- Draw active amplitude bars in `#20afff` (Signal Blue) and trimmed preview bars in `#5ad363` (Leaf Green).
- Render interactive playhead cursor (`#ffda40` Sun Yellow) and draggable start/end handles; emit `seek`, `update:manualStartSec`, `update:manualEndSec`.

- [ ] **Step 5: Verify Vite build succeeds**

Run: `cd frontend && npm run build`
Expected: Build compiles cleanly with 0 errors.

- [ ] **Step 6: Commit Task 3**

```bash
git add frontend/src/stores/workbench.js frontend/src/components/audio/WaveformTrimmerCanvas.vue frontend/src/views/AudioWorkbenchView.vue frontend/src/router/index.js frontend/src/components/AppNavbar.vue
git commit -m "feat(ui): add workbench store, navbar routing, and retro monitor waveform trimmer canvas"
```

---

### Task 4: Audio Workbench Dual-Tab View, Web Audio A/B Auditioning, & Blackbox Docs

**Files:**
- Create: `frontend/src/components/workbench/StemSeparatorTab.vue`
- Create: `frontend/src/components/workbench/SilenceTrimmerTab.vue`
- Create: `frontend/src/views/AudioWorkbenchView.vue`
- Modify: `docs/BLACKBOX_TESTING.md`

**Interfaces:**
- Consumes Task 3 `useWorkbenchStore` and `WaveformTrimmerCanvas.vue`.
- `AudioWorkbenchView.vue` mounts with `.notebook-paper` canvas, auto-initializes `guest-session` if `!authStore.isAuthenticated` (identical to `DashboardView.vue`), renders Folder Tabs (`01 AI Stem Separator`, `02 Smart Silence Trimmer`), and cleans up all `AudioContext` / `AudioBufferSourceNode` instances in `onUnmounted`.

- [ ] **Step 1: Build `frontend/src/components/workbench/StemSeparatorTab.vue`**

- `.retro-glass-card` dropzone accepting `.wav/.flac/.mp3` (`<= 100 MB`) with `.btn-keycap-blue` **"Mulai Pemisahan Stem"**.
- While `QUEUED`/`PROCESSING`: display `.retro-monitor` hardware progress readout with spinner/bar and status message.
- On `COMPLETED`: render 4 stem cards (`Vocals`, `Drums`, `Bass`, `Other`) using `.retro-glass-card` / `.retro-telemetry-plate`, synchronized Web Audio API multi-stem preview player with per-stem **Solo / Mute** buttons, badge `Tersinkron (Trimmed)` when trimmed, **"Buka di Trimmer"** `.btn-keycap-mini .btn-keycap-white`, and **"Unduh WAV"**.
- Footer bar with `.btn-keycap-blue` **"Kirim ke Studio Workspace"** (navigates to `/dashboard` on success) and `.btn-keycap-white` **"Unduh Semua Stem (ZIP)"**.

- [ ] **Step 2: Build `frontend/src/components/workbench/SilenceTrimmerTab.vue`**

- File selector bar showing either currently loaded stem from Tab 1 or local file dropzone.
- Embeds `WaveformTrimmerCanvas.vue` inside `.retro-monitor`.
- Parameter controls: `Silence Threshold (-60 to -20 dB)` slider, `Margin Aman (0 to 500 ms)` slider, `De-Clicker Micro-Fade (5 / 15 / 30 ms)` radio keycaps, **"Reset Handle Manual"** button.
- When `jobId` exists: default-checked checkbox **"Terapkan titik potong yang sama ke seluruh 4 stem agar tetap sinkron (Zero-Aligned)"**.
- Action & A/B controls: `.btn-keycap-blue` **"Terapkan Pemangkasan & De-Click"**, `.btn-keycap-yellow` / keycap toggle **Asli (Raw) vs Dipangkas (Trimmed)** with real-time Web Audio playback, telemetry cards (`Durasi Asli`, `Durasi Akhir`, `Hening Dibuang`), and **"Unduh WAV Hasil Trim"**.

- [ ] **Step 3: Build `frontend/src/views/AudioWorkbenchView.vue`**

- Outer `.notebook-paper` wrapper with title **`Audio Workbench`** (`font-editorial font-bold`), subtitle, folder tab switcher (`01 AI Stem Separator` | `02 Smart Silence Trimmer`), and error alert banner.
- Calls `guest-session` on `onMounted` if `!authStore.isAuthenticated`.

- [ ] **Step 4: Update `docs/BLACKBOX_TESTING.md` with Workbench test cases**

Document **Modul 10: Audio Workbench (AI Stem Separator & Smart Silence Trimmer)** covering file upload, concurrent Demucs queuing, real-time silence threshold preview, synced 4-stem trimming, and Studio Workspace session handoff.

- [ ] **Step 5: Run full verification suite (`npm run build`, `pytest`, and `node --test`)**

Run:
- `cd frontend && npm run build`
- `pytest worker/tests/ -v`
- `POLARIS_FAST_STEM_MODE=1 node --test backend/tests/13_audio_workbench.test.js` (if DB/Redis/MinIO containers active)
Expected: All builds and test suites PASS cleanly with 0 warnings/errors.

- [ ] **Step 6: Commit Task 4**

```bash
git add frontend/src/views/AudioWorkbenchView.vue frontend/src/components/workbench/ docs/BLACKBOX_TESTING.md
git commit -m "feat(ui): implement Audio Workbench tabs, Web Audio A/B trimmer, and blackbox test docs"
```
