# Multi-Region Asset Splitter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Tab 2 (`Smart Silence Trimmer`) in `/workbench` with **Multi-Region Asset Splitter** featuring real-time automatic multi-region detection, full canvas/list manual overrides (boundary drag, blade split, merge adjacent regions, delete, custom asset names, per-clip Web Audio preview), and batch/single multi-format export while preserving the light-paper `#fcfcfb` waveform visual aesthetic.

**Architecture:** Browser computes a `10 ms` RMS envelope locally on decoded `AudioBuffer` data so threshold/gap/min-asset/padding sliders recalculate `regions[]` at 60fps in `WaveformSplitterCanvas.vue` with `#0284c7` bars, `#ff82c2` silence zones, `#db2777` cuts/`IN`/`OUT` pills on the selected region, and `#ff5a2c` playhead. Express `/api/v1/workbench/split` and `/splits/:splitId/download-zip` invoke Python worker `--split-stdin` to slice all confirmed regions (`PCM_24`, 48 kHz, Hann raised-cosine fade), persist a Redis manifest (`workbench:split:{splitId}`), and reuse `audio_exporter.py` for 4-format downloads. Obsolete `/trim` and `syncAllStems` code paths are cleanly removed.

**Tech Stack:** Vue 3.5 (`<script setup>`), Pinia 4.0, Tailwind CSS v4 (`DESIGN.md` v2 + light-paper canvas), Web Audio API, Node.js ESM + Express 4.21, Redis (`ioredis`), MinIO S3 (`@aws-sdk/client-s3`), Python 3.10+, NumPy, SciPy, SoundFile, FFmpeg.

**Spec:** [`docs/superpowers/specs/2026-11-23-asset-splitter-design.md`](../specs/2026-11-23-asset-splitter-design.md)

## Global Constraints

- **Visual Canvas Styling:** Keep the exact `#fcfcfb` light-paper waveform surface, `border-[1.5px] border-[#111111]` frame, `#0284c7` active bars, `#ff82c2/28` pink shaded silence zones, `#db2777` dashed cut boundaries & active `IN`/`OUT` handle tags (drawn full only on `selectedRegionId`; subtle `01`, `02`, ... tags on others), and `#ff5a2c` Ember Orange playhead cursor.
- **Design System & Export Labels:** `DESIGN.md` v2 (`RetroSelect`, `.btn-keycap*`, `.retro-telemetry-plate`, `font-editorial font-bold`, `font-telemetry tabular-nums`), zero `UC-XX` visible labels. Export dropdown keeps exact labels `"Sesuai File Asli"`, `"FLAC 24-bit"`, `"WAV 24-bit PCM"`, `"MP3 320 kbps"`.
- **No Dead Code:** Remove obsolete `/api/v1/workbench/trim`, `--trim-stdin`, `syncAllStems`, `SilenceTrimmerTab.vue`, and `WaveformTrimmerCanvas.vue` cleanly upon replacement.
- **Audio & System Bounds:** Internal split outputs are `48000 Hz` stereo `PCM_24` WAV with Hann raised-cosine `fadeMs` (`15 ms` default). Split request bounds: `1 <= regions.length <= 100`, `duration >= 0.01s` per region, `<= 100 MB` input audio.
- **Security & Web Audio Lifecycle:** Enforce `authenticate`, `requireAudioEngineer`, `split.userId === req.user.id` (`403` Anti-IDOR), `workbench/${userId}/` prefix guard on `/export`, and clean disposal of all `AudioBufferSourceNode`, `GainNode`, `AudioContext`, `requestAnimationFrame`, and `ResizeObserver` on unmount/source change.

## Review Focus

- Adjacent padded regions when silence gap `< 2 * padMs` must clamp at gap midpoint without overlapping (`prev.endSec <= next.startSec`) or duplicating audio.
- Submitting `0` regions, `> 100` regions, inverted bounds (`startSec >= endSec`), or `< 0.01s` region must fail cleanly with HTTP `400` / `ValueError` without creating 0-sample WAVs.
- Duplicate or unsafe asset names (`"../etc"`, `"sfx"`, `"sfx"`) must sanitize and deduplicate cleanly (`sfx`, `sfx_1`) across both S3 keys and ZIP entries.
- Clicking **Mode Belah** outside any active region or `< 0.05s` from region edge must safely no-op/guard instead of producing broken sliver regions.
- Cross-user `GET /splits/:splitId/download-zip` or `POST /split` using another user's `jobId` returns `403`, and invalid/missing `splitId` returns `404` JSON cleanly.

---

### Task 1: Python Worker Multi-Region Auto-Detector & Slicing Engine

**Files:**
- Modify: `worker/src/workbench/silence_trimmer.py` (replace trim/sync helpers with `detect_active_regions` & `split_audio_by_regions`, keep shared `decode_audio_bytes`, `encode_wav_bytes`, `_slice_and_fade`, `extract_waveform_peaks`)
- Modify: `worker/src/worker.py` (replace `trim_workbench_audio` / `--trim-stdin` with `split_workbench_audio` / `--split-stdin`)
- Modify: `worker/tests/test_workbench.py` (update tests to cover multi-region detection, gap bridging, noise filtering, anti-overlap pad clamping, manual override splitting, `PCM_24` encoding, dedup filenames, and `--split-stdin`)

**Interfaces:**
- Produces in `worker/src/workbench/silence_trimmer.py`:
  - `detect_active_regions(audio_data: np.ndarray, sample_rate: int, threshold_db: float = -45.0, min_silence_gap_ms: float = 300.0, min_asset_ms: float = 100.0, pad_ms: float = 50.0) -> list[dict]` (each dict: `{ "start_sec": float, "end_sec": float, "duration_sec": float }`)
  - `split_audio_by_regions(audio_data: np.ndarray, sample_rate: int, regions: list[dict], fade_ms: float = 15.0) -> list[dict]` (where each input dict has `{ "name": str, "start_sec": float, "end_sec": float }`; returns `[{ "name": str, "file_name": str, "wav_bytes": bytes, "start_sec": float, "end_sec": float, "duration_sec": float }]`)
  - Retains: `TARGET_SAMPLE_RATE = 48000`, `decode_audio_bytes`, `encode_wav_bytes`, `extract_waveform_peaks`
- Produces CLI mode in `worker/src/worker.py`:
  - `--split-stdin`: stdin `{ splitId, userId, sourceStorageKey, fileName, regions: [{ name, startSec, endSec }], fadeMs }`, outputs `{ splitId, durationSec, assets: [{ name, fileName, storageKey, durationSec }] }`

- [ ] **Step 1: Write failing tests for Multi-Region Detection & Splitting in `worker/tests/test_workbench.py`**

Replace old `trim_audio_silence` / `compute_union_trim_bounds` / `slice_aligned_batch` unit tests while preserving `decode_audio_bytes`, `ffmpeg`, `stem_separator`, and `audio_exporter` tests. Add tests verifying:
1. `test_detect_active_regions_bridges_short_gaps_and_clamps_overlap_padding`: signal with burst 1 (`0.5s`), short internal silence gap (`80ms` < `min_silence_gap_ms=300`), burst 2 (`0.5s`), long silence gap (`600ms`), burst 3 (`0.5s`), and narrow gap (`40ms` < `2*pad_ms` with `min_silence_gap_ms=20`) ensures gap `< min_silence_gap_ms` bridges into 1 region while distinct regions clamp adjacent padding cleanly (`r[i]["end_sec"] <= r[i+1]["start_sec"]`).
2. `test_detect_active_regions_filters_short_noise_and_rejects_full_silence`: `20ms` burst ignored when `min_asset_ms=100`; pure silence raises `ValueError("hening")`.
3. `test_split_audio_by_regions_slices_pcm24_with_zero_crossing_fade_and_dedup_names`: custom region list `[{ "name": "../sfx", "start_sec": 0.2, "end_sec": 0.9 }, { "name": "sfx", "start_sec": 1.2, "end_sec": 1.8 }]` produces sanitized deduplicated names (`sfx.wav`, `sfx_1.wav`), valid `48000 Hz` `PCM_24` WAV bytes, raised-cosine `~0.0` edges, and rejects empty/invalid/over-100/`<0.01s` regions with `ValueError`.
4. `test_worker_split_workbench_audio_uploads_assets_to_s3`: mocks `get_s3_client`, runs `split_workbench_audio`, confirms all N regions uploaded cleanly under `workbench/{userId}/split-{splitId}/`.

- [ ] **Step 2: Run worker tests to observe RED failure**

Run: `cd worker && python3 -m pytest tests/test_workbench.py -v`
Expected: FAIL with `ImportError` (`cannot import name 'detect_active_regions'`)

- [ ] **Step 3: Implement `detect_active_regions` & `split_audio_by_regions` in `worker/src/workbench/silence_trimmer.py` and remove obsolete trim helpers**

Implement 10 ms frame peak envelope analysis, boolean run gap-bridging (`gap_frames < min_silence_gap_frames`), min-duration filtering (`dur_frames >= min_asset_frames`), midpoint-clamped symmetric padding, strict bounds/count guards (`1 <= len(regions) <= 100`, finite bounds, `duration >= 0.01s`), sanitized deduplicated asset names, and Hann raised-cosine `_slice_and_fade` encoding `PCM_24` WAV bytes.

- [ ] **Step 4: Replace `--trim-stdin` with `split_workbench_audio` / `--split-stdin` in `worker/src/worker.py`**

Update imports from `workbench.silence_trimmer`, remove `trim_workbench_audio`, `_default_trim_target_key`, and `--trim-stdin`, and implement `split_workbench_audio(payload)` + `--split-stdin` returning `{ splitId, durationSec, assets }`.

- [ ] **Step 5: Run full worker test suite to verify GREEN**

Run: `cd worker && python3 -m pytest tests/ -v`
Expected: All worker tests PASS cleanly with 0 failures.

- [ ] **Step 6: Commit Task 1**

```bash
git add worker/src/workbench/silence_trimmer.py worker/src/worker.py worker/tests/test_workbench.py
git commit -m "feat(worker): replace single trim with multi-region asset detector and batch splitter"
```

---

### Task 2: Backend `/split` & `/splits/:splitId/download-zip` API Replacement

**Files:**
- Modify: `backend/src/services/workbenchService.js`
- Modify: `backend/src/controllers/workbenchController.js`
- Modify: `backend/src/routes/workbenchRoutes.js`
- Modify: `backend/tests/13_audio_workbench.test.js`

**Interfaces:**
- Consumes from Task 1: `python3 -m worker.src.worker --split-stdin`.
- Replaces `POST /api/v1/workbench/trim` with:
  - `POST /api/v1/workbench/split`: `multipart/form-data` (`audio` file) OR JSON `{ jobId, stemName }`, plus `regions` (JSON array/string `[{ name, startSec, endSec }]`, `1..100` items), `fadeMs` (default `15`). Returns `200`: `{ splitId, sourceFileName, sourceFormat, fadeMs, totalAssets, assets: [{ name, fileName, storageKey, audioUrl, durationSec }] }`.
  - `GET /api/v1/workbench/splits/:splitId/download-zip?format=auto|flac24|wav24|mp3_320`: packages all split assets in requested format (reusing `resolveExportSpec` & `transcodeStorageItems`), verifies `split.userId === req.user.id` (`403`) or `404` if missing.
  - Existing `GET /api/v1/workbench/export` handles single asset downloads cleanly in all 4 formats.

- [ ] **Step 1: Update `backend/tests/13_audio_workbench.test.js` with failing `/split` & `/download-zip` tests**

Replace old Section 3 (`Standalone Silence Trimmer`) and synced-trim assertions with:
1. Input validation on `POST /api/v1/workbench/split`: rejects empty/missing `regions` (`400`), `> 100` regions (`400`), inverted `startSec >= endSec` (`400`), `< 0.01s` duration (`400`), and corrupt audio (`400`).
2. Standalone multi-region split on synthetic WAV containing 2 bursts (`[0.2..0.7]` and `[1.2..1.7]`) with custom names (`["sfx_hit", "sfx_jump"]`): returns `200`, `totalAssets: 2`, valid `splitId`, distinct presigned `audioUrl`s, and `sfx_hit.wav`/`sfx_jump.wav` in S3.
3. ZIP download (`GET /splits/:splitId/download-zip`) in `wav24`, `flac24`, and `mp3_320`: validates ZIP contains `sfx_hit.<ext>` and `sfx_jump.<ext>`, rejects invalid format (`400`), rejects User B (`403` Anti-IDOR), rejects non-existent UUID (`404`).
4. Split from separated Tab 1 stem (`{ jobId: job1Id, stemName: 'vocals', regions: [...] }`) returns `200` with `sourceFormat`, and `GET /export` single-asset download respects format + Anti-IDOR (`403`).

- [ ] **Step 2: Run workbench integration test to verify RED**

Run: `cd backend && NODE_ENV=test POLARIS_FAST_STEM_MODE=1 node --test tests/13_audio_workbench.test.js`
Expected: FAIL (`POST /api/v1/workbench/split` 404)

- [ ] **Step 3: Implement `splitAudio` & `downloadSplitZip` in `workbenchService.js`, `workbenchController.js`, and `workbenchRoutes.js`**

- Store Redis manifest under `workbench:split:{splitId}` (TTL `86400`s) containing `{ splitId, userId, sourceFileName, sourceFormat, assets: [{ name, fileName, storageKey, durationSec }] }`.
- Parse & validate `regions` JSON/Array (`1..100`, finite bounds, `endSec - startSec >= 0.01`) before spawning `--split-stdin`.
- Reuse existing `resolveExportSpec`, `transcodeStorageItems`, `validateUploadedAudio`, `signStorageUrl`, and `getJobRecord` cleanly.
- Remove obsolete `trimAudio` and `/trim` route/controller method cleanly.

- [ ] **Step 4: Run workbench integration test and full backend suite to verify GREEN**

Run:
- `cd backend && NODE_ENV=test POLARIS_FAST_STEM_MODE=1 node --test tests/13_audio_workbench.test.js`
- `cd backend && POLARIS_FAST_STEM_MODE=1 npm test`
Expected: All tests PASS with 0 failures and clean process exit without `--test-force-exit`.

- [ ] **Step 5: Commit Task 2**

```bash
git add backend/src/services/workbenchService.js backend/src/controllers/workbenchController.js backend/src/routes/workbenchRoutes.js backend/tests/13_audio_workbench.test.js
git commit -m "feat(api): replace /trim with multi-region /split and batch multi-format ZIP download"
```

---

### Task 3: Frontend Pinia Store (`useWorkbenchStore`) & `WaveformSplitterCanvas.vue`

**Files:**
- Modify: `frontend/src/stores/workbench.js`
- Create: `frontend/src/components/audio/WaveformSplitterCanvas.vue`
*(Note: Keep `WaveformTrimmerCanvas.vue` until Task 4 removes `SilenceTrimmerTab.vue` together so Task 3 passes `npm run build` cleanly.)*

**Interfaces:**
- Produces in `frontend/src/stores/workbench.js`:
  - State: `activeTab: 'separator' | 'splitter'`, `job`, `polling`, `isUploading`, `isSplitting`, `isDownloadingZip`, `isSendingToStudio`, `downloadFormat: 'auto'`, `error`, `splitterSource: { file, fileName, jobId, stemName, rawUrl, rawDurationSec }`, `splitResult: { splitId, sourceFormat, fadeMs, totalAssets, assets }`
  - Actions: `setActiveTab`, `openStemInSplitter(stem)`, `loadLocalFileInSplitter(file)`, `executeSplit({ regions, fadeMs })`, `downloadSplitZip(format)`, `downloadSplitAsset(asset, format)` (alongside intact Tab 1 actions `startSeparation`, `pollJob`, `downloadZip`, `downloadStem`, `sendToStudio`, `reset`).
- Produces `WaveformSplitterCanvas.vue`:
  - Props: `peaks` (`Number[]`), `durationSec` (`Number`), `regions` (`Array<{ id, name, startSec, endSec }>`), `selectedRegionId` (`String | null`), `toolMode` (`'select' | 'split'`), `currentTimeSec` (`Number`), `isPlaying` (`Boolean`)
  - Emits: `seek(timeSec)`, `selectRegion(id | null)`, `updateRegionBounds({ id, startSec, endSec })`, `splitRegionAt({ id, timeSec })`

- [ ] **Step 1: Update `frontend/src/stores/workbench.js` to replace trim state/actions with Asset Splitter**

Switch `activeTab` valid values to `'separator' | 'splitter'`. Replace `trimmerSource`/`trimResult`/`isTrimming`/`executeTrim`/`downloadTrimmedExport` with `splitterSource`, `splitResult`, `isSplitting`, `openStemInSplitter(stem)`, `loadLocalFileInSplitter(file)`, `executeSplit({ regions, fadeMs })`, `downloadSplitZip(format)`, and `downloadSplitAsset(asset, format)`. Ensure `openStemInSplitter` reuses `stem.audioUrl` cleanly.

- [ ] **Step 2: Create `WaveformSplitterCanvas.vue` (keeping exact light-paper styling)**

Build HiDPI canvas preserving `#fcfcfb` light paper grid, `#0284c7` bars (dimmed outside regions), translucent pink `#ff82c2/28` silence shading outside/between regions, `#db2777` dashed vertical boundaries + numbered badge pills (`01`, `02`, ...) at top-left of each region, full draggable `#ff82c2` `IN`/`OUT` handle tags exclusively on `selectedRegionId`, and `#ff5a2c` Ember Orange playhead cursor.
Interaction rules:
- In `select` mode: dragging `IN`/`OUT` clamps `startSec` within `[prevEnd, endSec - 0.05]` and `endSec` within `[startSec + 0.05, nextStart]`; clicking inside a region selects it and seeks playhead; clicking a gap seeks playhead and keeps selection clean.
- In `split` mode: hovering inside an active region renders a faint split preview line; clicking inside an active region at least `0.05s` from both edges emits `splitRegionAt({ id, timeSec })` (ignoring clicks outside active regions or `< 0.05s` from edges).
- Proper `ResizeObserver` and pointer listener cleanup in `onUnmounted`.

- [ ] **Step 3: Verify Vite build succeeds**

Run: `cd frontend && npm run build`
Expected: Compiles cleanly with 0 errors (`SilenceTrimmerTab.vue` + `WaveformTrimmerCanvas.vue` remain intact until Task 4 swaps them atomically).

- [ ] **Step 4: Commit Task 3**

```bash
git add frontend/src/stores/workbench.js frontend/src/components/audio/WaveformSplitterCanvas.vue
git commit -m "feat(ui): update workbench store for Asset Splitter and build multi-region waveform canvas"
```

---

### Task 4: `AssetSplitterTab.vue`, Tab 1 Bridge, `AudioWorkbenchView.vue`, & Blackbox Docs

**Files:**
- Create: `frontend/src/components/workbench/AssetSplitterTab.vue`
- Delete: `frontend/src/components/workbench/SilenceTrimmerTab.vue` & `frontend/src/components/audio/WaveformTrimmerCanvas.vue`
- Modify: `frontend/src/components/workbench/StemSeparatorTab.vue` (`Buka di Trimmer` -> `Pecah di Splitter` calling `workbenchStore.openStemInSplitter`)
- Modify: `frontend/src/views/AudioWorkbenchView.vue` (Tab 2 `02 Asset Splitter`, `id: 'splitter'`, mounts `AssetSplitterTab`)
- Modify: `docs/BLACKBOX_TESTING.md` (update Modul 10 test scenarios for Multi-Region Asset Splitter & 4-format export)

**Interfaces:**
- Consumes Task 3 `useWorkbenchStore` and `WaveformSplitterCanvas.vue`.
- Client detection helper `detectRegionsFromBuffer(audioBuffer, { thresholdDb, minSilenceGapMs, minAssetMs, padMs })` computes `10 ms` RMS envelope (mirroring Python `detect_active_regions` algorithm for 100% real-time parity) and produces high-resolution canvas `peaks` (e.g., `600` bins).

- [ ] **Step 1: Build `frontend/src/components/workbench/AssetSplitterTab.vue`**

Implement full Multi-Region Asset Splitter workflow:
1. Source selector bar (local audio dropzone + quick switcher buttons for Tab 1 completed stems).
2. Auto-detection engine from local `AudioBuffer` (`detectRegionsFromBuffer`) triggered on load, slider changes (`Silence Threshold -60..-20 dB`, `Jeda Pemisah 100..2000 ms`, `Durasi Aset Minimal 50..1000 ms`, `Margin Pad 0..300 ms`), and **"Deteksi Ulang Otomatis"** button (resets manual overrides cleanly).
3. Canvas Toolbar above `WaveformSplitterCanvas.vue`:
   - Mode toggle keycaps: **`Pilih & Scrub`** (`select`) vs **`Mode Belah`** (`split`)
   - **`Belah di Playhead`** button (enabled when playhead falls `>= 0.05s` inside `selectedRegionId`)
   - De-Clicker Micro-Fade keycaps (`5 ms`, `15 ms`, `30 ms`)
   - Play/Stop full preview button + total active region count badge.
4. Editable **Daftar Region (`regions[]`)** below canvas:
   - Batch prefix rename bar (optional prefix input + `"Terapkan Prefix"` button naming `prefix_01`, `prefix_02`, ...).
   - Per-region card/row: numbered tag (`01`), editable asset filename input, `start – end (duration)` in `font-telemetry tabular-nums`, **▶ Putar Klip** / Stop button (plays exact `[startSec..endSec]` via Web Audio `source.start(0, startSec, clipDur)`), **Gabung Berikutnya** button (merges `[i.startSec, (i+1).endSec]`, disabled/omitted on last item), and **✕ Hapus** button.
5. Process & Multi-Format Export bar:
   - `"Proses & Potong N Aset"` `.btn-keycap-blue` calling `workbenchStore.executeSplit({ regions, fadeMs })`.
   - Split results card displaying generated `assets[]` with **▶ Putar Hasil**, satuan **Unduh** (`workbenchStore.downloadSplitAsset(asset)`), plus `<RetroSelect v-model="workbenchStore.downloadFormat" :options="WORKBENCH_EXPORT_FORMATS" :compact="true" :drop-up="true" />` and **"Unduh Semua Aset (ZIP)"** (`workbenchStore.downloadSplitZip`).
6. Full cleanup in `onUnmounted` + exposed `stopPlayback` for tab switch.

- [ ] **Step 2: Update `StemSeparatorTab.vue` & `AudioWorkbenchView.vue` and delete `SilenceTrimmerTab.vue` + `WaveformTrimmerCanvas.vue`**

- In `StemSeparatorTab.vue`: switch `handleOpenInTrimmer` -> `handleOpenInSplitter` calling `workbenchStore.openStemInSplitter(stem)` and update button label to **"Pecah di Splitter"**.
- In `AudioWorkbenchView.vue`: replace `SilenceTrimmerTab` import with `AssetSplitterTab`, set Folder Tab 2 `{ id: 'splitter', num: '02', label: 'Asset Splitter', ... }`, wire `ref` stopPlayback cleanly.
- Delete `frontend/src/components/workbench/SilenceTrimmerTab.vue` and `frontend/src/components/audio/WaveformTrimmerCanvas.vue`.

- [ ] **Step 3: Update `docs/BLACKBOX_TESTING.md` Modul 10**

Update `TC-WB-03` & `TC-WB-04` to document Multi-Region Asset Splitter scenarios (auto-detection sliders, manual drag/split/merge/rename overrides, clip preview, and 4-format ZIP export).

- [ ] **Step 4: Run complete verification suite**

Run inside root repo:
- `cd frontend && npm run build`
- `cd worker && python3 -m pytest tests/ -v`
- `cd backend && POLARIS_FAST_STEM_MODE=1 npm test`
Expected: Frontend build 0 errors, Worker 100% pass, Backend 100% pass.

- [ ] **Step 5: Commit Task 4**

```bash
git add frontend/src/components/workbench/AssetSplitterTab.vue frontend/src/components/workbench/StemSeparatorTab.vue frontend/src/views/AudioWorkbenchView.vue docs/BLACKBOX_TESTING.md
git rm frontend/src/components/workbench/SilenceTrimmerTab.vue frontend/src/components/audio/WaveformTrimmerCanvas.vue
git commit -m "feat(ui): replace silence trimmer with Multi-Region Asset Splitter tab and override editor"
```
