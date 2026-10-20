# Polaris Audio - Workspace Guidelines & AI Agent Rules

**Polaris Audio** is an intelligent, web-based multitrack mixing preparation and deterministic DSP diagnostics workstation. It automates audio session preparation by combining a hybrid Digital Signal Processing (DSP) engine conforming to ITU-R BS.1770-4 with AI-assisted stem classification and microphone pairing detection.

---

## Tech Stack

| Layer | Technologies & Runtimes |
|---|---|
| **Backend API** | Node.js (v20+ LTS, ES Modules `"type": "module"`), Express.js 4.21, Prisma ORM 6.4 |
| **Worker / Engine** | Python 3.10+, NumPy, SciPy (Signal/FFT), SoundFile (24/32-bit float audio I/O), Boto3 |
| **Frontend UI** | Vue 3.5 (Composition API `<script setup>`), Vite 8.3, Pinia 4.0, Tailwind CSS v4, Lucide Icons |
| **Audio Processing** | Web Audio API (Micro-crossfade $<50\text{ ms}$, 45° Lissajous Goniometer, $L+R$ Mono Summing Matrix) |
| **Datastores & Infra** | PostgreSQL 17 (DB), Redis 7 (BullMQ async job queues), MinIO S3 (Object Storage) |
| **Third-Party APIs** | Midtrans Client 1.4 (Snap Sandbox API for virtual token top-up) |

---

## ⚡ Essential Commands

### 1. Infrastructure (Docker)
```bash
# Start all supporting services (PostgreSQL on :5434, Redis on :6379, MinIO on :9000/:9001)
docker compose up -d

# Check service status & health
docker compose ps

# Stop containers
docker compose down
```

### 2. Backend (Node.js & Prisma)
```bash
cd backend

# Install dependencies
npm install

# Database schema & migrations
npx prisma generate
npx prisma migrate dev

# Start development server (http://localhost:5000)
npm run dev

# Start production server
npm start

# Run full backend automated integration test suite (68 tests)
npm test

# Run a single test file
node --test tests/06_audition_player_uc16.test.js
```

### 3. Worker (Python DSP & AI)
```bash
cd worker

# Setup virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run background processing worker
python src/worker.py

# Run all worker tests (44 tests)
pytest tests/

# Run a specific worker test file or test case
pytest tests/test_dsp_engine.py
pytest tests/test_dsp_engine.py -k "test_true_peak_detection"
```

### 4. Frontend (Vue 3 & Vite)
```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server (http://localhost:5173)
npm run dev

# Verify production build
npm run build

# Preview production build
npm run preview
```

### 5. Synthetic Stem Generation (Testing Data)
```bash
# Generates calibrated WAV multitrack stems and test ZIP sessions with known audio anomalies
python scripts/generate_sample_stems.py
```

---

## Architecture & Directory Layout

```text
├── backend/                  # Node.js Express API & Business Logic
│   ├── prisma/               # Database schema (schema.prisma) & migrations
│   ├── src/
│   │   ├── controllers/      # HTTP request controllers (thin, validated)
│   │   ├── services/         # Domain services (Prisma, S3, BullMQ, Token Ledger)
│   │   ├── routes/           # REST route definitions (/auth, /sessions, /wallet)
│   │   ├── middlewares/      # JWT auth guard, error handler, Multer S3 upload
│   │   └── server.js         # Express app, Socket.IO server, and HTTP bootstrap
│   └── tests/                # Automated API & integration test suites
│
├── worker/                   # Python DSP & AI Asynchronous Processing Service
│   ├── src/
│   │   ├── ai/               # Mel spectrogram extraction, instrument classifier, mic pairing
│   │   ├── dsp/              # Phase correlation, True-Peak, DC offset, rumble, repair engine
│   │   ├── storage/          # S3/MinIO Boto3 file handling
│   │   └── worker.py         # Redis BullMQ worker listener and pipeline orchestrator
│   └── tests/                # Pytest suites for AI, DSP, and Repair modules
│
├── frontend/                 # Vue 3 Single Page Application
│   ├── src/
│   │   ├── views/            # Main application views (Landing, Auth, Studio Dashboard)
│   │   ├── components/       # UI cards, modals, tables, and dialogs
│   │   │   └── audio/        # MultitrackAuditionPanel, GoniometerVisualizer, LedPeakMeter
│   │   ├── composables/      # useMultitrackPlayer.js (Web Audio routing graph)
│   │   └── stores/           # Pinia stores (authStore, sessionStore)
│   └── index.html            # Vite entry point
│
├── sample-stems/             # Calibrated test stems (Kick, Snare, Bass, Guitars, Inverted phase)
├── scripts/                  # Utility & test automation scripts
└── docs/                     # Specifications (SRS, SDD, Blackbox Matrix, UML Diagrams)
```

---

## Coding Conventions & Guidelines

### Backend & API
- **ES Modules**: Always use native ES Module `import`/`export`.
- **Layer Separation**: Keep route controllers thin; encapsulate database operations, business policies, and storage calls in `backend/src/services/`.
- **Token Ledger Integrity**: Token deductions and top-ups must be atomic transactions in Prisma with corresponding `TokenTransaction` records.
- **Presigned URLs**: Audio files must never be served directly through Express memory buffers. Always generate presigned S3 URLs (`GetObjectCommand`, 2-hour TTL).

### Worker & Audio Signal Processing (DSP)
- **Deterministic Mathematics**: Use vectorised NumPy and SciPy algorithms. Avoid nondeterministic operations in DSP metrics.
- **Audio Standards**:
  - Sample-rate compliance: Always resample or verify 48 kHz standard.
  - True-Peak calculation must use $\ge 4\times$ oversampling conforming to ITU-R BS.1770-4.
  - Headroom staging targets $-3.0\text{ dBFS}$ Peak.
  - Sub-rumble high-pass cutoff is $25\text{ Hz}$ (Butterworth).
- **Non-Destructive Processing**: Raw original stems in S3 (`originalStorageKey`) are immutable. Repaired audio must always be saved as separate files under `repairedStorageKey` with `FIXED_` prefix.

### Frontend & Web Audio
- **Vue 3 Composition API**: Use `<script setup>` exclusively.
- **Design System (`DESIGN.md`)**:
  - Palette: `#FAFAFA` canvas, `#0F172A` deep slate text, `#0052FF` Polaris Electric Blue accent.
  - Typography: `Inter` for interface display, `JetBrains Mono` strictly for telemetry readouts (dBFS, Hz, %, ms).
  - No generic AI-slop: Avoid floating orbs, decorative unicode emojis in buttons/chips, and perpetual pulsing dots on idle components.
  - UI clean from internal labeling: Do NOT display `UC-[NUMBER]` codes in visible user-facing text.
- **Web Audio Lifecycle**: Always disconnect and stop `AudioBufferSourceNode`, `GainNode`, and `AnalyserNode` when components unmount to prevent browser audio context memory leaks.
- **Reactive Cache-Busting**: When fetching streaming sources, pass a cache-buster query parameter `?_t=${Date.now()}` and watch session status changes (`REPAIRED`) to ensure fresh audio buffers are loaded.

---

## Rules & Constraints

1. **Never edit Prisma migrations directly**: Always generate migrations via `npx prisma migrate dev`.
2. **Never commit secrets**: Keep all credentials, tokens, and keys in `.env` (gitignored). Update `.env.example` when adding new configuration variables.
3. **Preserve Audio Test Coverage**: Any change to DSP calculations or API routes must maintain 100% pass status across both backend tests (`npm test` in `backend/`) and python worker tests (`pytest` in `worker/`).
4. **Reference Existing Documentation & Artifacts**:
   - Software Requirements: [`docs/SRS_11241056_Polaris-Audio_IPPL_B.md`](docs/SRS_11241056_Polaris-Audio_IPPL_B.md)
   - Software Architecture & Design: [`docs/SDD_11241056_Polaris-Audio_IPPL_B.md`](docs/SDD_11241056_Polaris-Audio_IPPL_B.md)
   - Blackbox Test Matrix: [`docs/BLACKBOX_TESTING.md`](docs/BLACKBOX_TESTING.md)
   - Design System Contract: [`DESIGN.md`](DESIGN.md)
   - Contributing Guidelines: [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)
