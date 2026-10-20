<div align="center">

# Polaris Audio

**Intelligent Multitrack Mixing Preparation & Deterministic DSP Diagnostics Workstation**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests Passing](https://img.shields.io/badge/Tests-112%20Passing%20(100%25)-emerald.svg)](#-testing--quality-assurance)
[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)](https://www.python.org)
[![Vue 3](https://img.shields.io/badge/Vue.js-v3.5%2B-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![MinIO](https://img.shields.io/badge/MinIO-S3%20Compatible-C72C48?logo=minio&logoColor=white)](https://min.io)

<p align="center">
  <a href="#-what-is-polaris-audio">Overview</a> •
  <a href="#-key-features--capabilities">Key Features</a> •
  <a href="#-system-architecture">Architecture</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-testing--quality-assurance">Testing</a> •
  <a href="#-documentation">Documentation</a> •
  <a href="#-contributing--license">Contributing & License</a>
</p>

</div>

---

## What is Polaris Audio?

**Polaris Audio** is a web-based, studio workstation built for sound engineers, music producers, regardless of their level of expertise, trying to bridge amateurs to professional. It solves one of the most tedious, repetitive bottlenecks in commercial audio production: **Session Preparation (Session Prep)**.

Before creative mixing can begin, audio engineers traditionally spend hours manually diagnosing technical flaws across dozens of multitrack audio stems—identifying inverted microphone polarities, comb filtering phase smearing, artificial "fake stereo" widening, DC offsets, sub-audible low frequency rumble, and inter-sample clipping.

Polaris Audio automates this entire diagnostic and remediation pipeline end-to-end using a **hybrid DSP (Digital Signal Processing) and AI architecture**:
1. **Ingests multitrack stems** (WAV/FLAC) via secure S3 presigned transfers with temporary retention protection.
2. **Classifies instrument stems** (Drums, Bass, Guitars, Vocals, Synths) and automatically detects multi-microphone pairs (Kick In/Out, Snare Top/Bottom, DI/Amp).
3. **Executes deterministic DSP diagnostics** conforming to the **ITU-R BS.1770-4** audio engineering standard.
4. **Calculates a deterministic 0–100 Mix Health Score** with actionable recommendations.
5. **Applies 1-Click Auto-Fix or Granular Audio Repairs** (phase inversion, Haas delay alignment, DC offset elimination, sub-rumble cut, and headroom staging to -3.0 dBFS).
6. **Delivers an instant Web Audio A/B Auditioning Console** with `< 50 ms` latency-free micro-crossfading and a 45° Lissajous Goniometer phase scope.

---

## Key Features & Capabilities

### Deterministic Audio Diagnostics Engine
- **ITU-R BS.1770-4 True-Peak Metering**: 4× oversampled inter-sample clipping detection to reveal hidden digital-to-analog converter (DAC) distortion exceeding `0.0 dBFS`.
- **Phase Inversion & Polarity Detection**: Pearson cross-correlation to detect destructive 180° out-of-phase signals between coincident microphone pairs.
- **Comb Filtering & Haas Effect Analysis**: Microsecond-delay cross-correlation identifying phase smearing across acoustic recordings (e.g., dual-mic drum overheads).
- **Stereo Field & Fake Stereo Detection**: Identifies mono stems artificially placed into dual-channel stereo tracks without genuine stereo width.
- **Sub-Audible Rumble Detection**: Isolates energy concentrated below 25 Hz that robs headroom from analog mixers and audio converters.
- **DC Offset Removal**: Flags asymmetrical signal biasing that causes early clipping and analog compressor distortion.
- **Mix Health Score (0–100)**: Quantitative health rating that categorizes issues into **Clean** (green), **Warning** (amber), and **Critical** (red).

### Automated & Granular DSP Audio Repair
- **1-Click Auto-Fix**: Instantly remedies all detected anomalies across the session in a single transaction.
- **Granular Custom Repairs**: Fine-grained per-track selection of DSP modules:
  - Polarity Flipping ($180^\circ$ phase inversion)
  - Inter-channel Delay Compensation (Haas alignment)
  - Fake Stereo Mono-Summing / Collapse
  - DC Offset Elimination via zero-phase IIR high-pass filtering
  - Butterworth High-Pass Sub-Rumble Filter ($< 25\text{ Hz}$)
  - Headroom Staging (normalized to $-3.0\text{ dBFS}$ Peak)

### Multitrack A/B Auditioning Studio Player
- **Zero-Latency Micro-Crossfade**: Seamless 5 ms gain ramping between **Mode A (Raw Audio)** and **Mode B (Repaired Audio)** without audible clicks, pops, or stream pauses.
- **Hardware-Style Goniometer (Phase Scope)**: Real-time 45° rotated Lissajous oscilloscope visualizer with dynamic Pearson phase correlation meter (`-1.0` to `+1.0`) and phosphor persistence.
- **Mono Check Summing ($L + R$)**: Instant mono summing matrix to audit phase cancellation in real time.
- **Full Multitrack Channel Strip**: Per-stem volume faders, stereo panning, solo/mute tally buttons, and dual-channel stereo LED peak meters.

### Virtual Token Economy & Studio Billing
- **Prepaid Token Model**: Transparent usage-based billing with zero recurring subscription locks.
- **Welcome Bonus**: 5 free tokens automatically granted upon registration.
- **Daily Faucet**: Daily claiming mechanism for free diagnostic sessions.
- **Instant Guest Mode**: Zero-friction trial access with 3 complimentary tokens without registration.
- **Midtrans Payment Gateway**: Full Snap API sandbox integration for instant top-up checkout.

---

## System Architecture

Polaris Audio uses a high-throughput, microservice-inspired decoupling between the user-facing web dashboard, asynchronous background compute workers, and distributed object storage.

```
                           ┌────────────────────────┐
                           │   Web Audio Browser    │
                           │  (Vue 3 + Tailwind v4) │
                           └───────────┬────────────┘
                                       │ HTTP / REST / Presigned S3
                                       │ WebSocket Telemetry
                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Node.js / Express API                           │
│  - Session Management    - Auth (JWT / bcrypt)    - Virtual Token Ledger│
│  - Storage Controller    - Presigned S3 URLs      - Midtrans Gateway   │
└──────────────┬───────────────────────┬─────────────────────────┬───────┘
               │                       │                         │
               ▼                       ▼                         ▼
      ┌─────────────────┐     ┌─────────────────┐       ┌─────────────────┐
      │  PostgreSQL 17  │     │     Redis 7     │       │    MinIO S3     │
      │  (Prisma ORM)   │     │ (BullMQ Queues) │       │ (Object Storage)│
      └─────────────────┘     └────────┬────────┘       └────────▲────────┘
                                       │                         │
                                       ▼                         │
                    ┌──────────────────────────────────────┐     │
                    │         Python Worker Engine         ├─────┘
                    │ - Mel Spectrogram AI Classifier      │
                    │ - Multitrack Pairing Detection       │
                    │ - Scipy / NumPy DSP Audio Engine     │
                    │ - ITU-R BS.1770-4 True-Peak Analyser │
                    │ - 24-bit Lossless Audio Repair Renderer
                    └──────────────────────────────────────┘
```

---

## Getting Started

Follow these instructions to run the entire Polaris Audio stack locally on your machine.

### Prerequisites

| Tool | Minimum Version | Purpose |
|---|---|---|
| **Docker & Docker Compose** | v24.0+ | PostgreSQL, Redis, and MinIO infrastructure |
| **Node.js** | v20.0+ (LTS) | Backend Express server & Frontend Vite build |
| **Python** | v3.10+ | DSP computation & AI inference engine |
| **Git** | Any | Source control |

---

### Step 1: Clone Repository & Configure Environment

Clone the repository and set up environment files:

```bash
git clone https://github.com/<your-username>/IF2514503---Software-Implementation-and-Testing-Project.git
cd IF2514503---Software-Implementation-and-Testing-Project

# Copy environment configuration
cp .env.example .env
```

Review `.env` to verify connection ports and credentials. The default configuration is ready for local development out-of-the-box:

```ini
# PostgreSQL
DATABASE_URL="postgresql://polaris:polaris_secret@localhost:5434/polaris_audio?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# MinIO S3
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET_NAME=polaris-audio-stems

# JWT & Application
PORT=5000
JWT_SECRET=super_secret_polaris_jwt_key_2026_ippl
CLIENT_URL=http://localhost:5173
```

---

### Step 2: Start Infrastructure Services (Docker)

Spin up PostgreSQL 17, Redis 7, and MinIO S3:

```bash
docker compose up -d
```

Verify all containers are healthy:
```bash
docker compose ps
```

> [!TIP]
> You can access the **MinIO Web Console** at [http://localhost:9001](http://localhost:9001) using username `minioadmin` and password `minioadmin`.

---

### Step 3: Set Up Backend & Database

Install Node.js dependencies, generate the Prisma ORM client, and apply database migrations:

```bash
cd backend
npm install

# Generate Prisma Client & apply migrations
npx prisma generate
npx prisma migrate dev --name init

# Start Backend API server (runs on http://localhost:5000)
npm run dev
```

---

### Step 4: Set Up Python DSP / AI Worker

In a new terminal, configure the Python virtual environment and launch the worker:

```bash
cd worker

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install audio engineering dependencies (numpy, scipy, soundfile, boto3, redis)
pip install -r requirements.txt

# Start the audio processing worker
python src/worker.py
```

---

### Step 5: Set Up Frontend Studio UI

In another terminal, install frontend dependencies and launch the Vite development server:

```bash
cd frontend
npm install

# Start Vite dev server (runs on http://localhost:5173)
npm run dev
```

Open your browser and navigate to **[http://localhost:5173](http://localhost:5173)**.

---

### Step 6: Generate Sample Stems for Testing (Optional)

The repository includes a stem generator script that creates synthetic multitrack WAV stems with calibrated audio anomalies (inter-sample clipping, polarity inversion, Haas delay, and DC bias):

```bash
python scripts/generate_sample_stems.py
```

This generates:
- `01_Kick_In.wav` & `02_Kick_Sub.wav` (Microphone Pair test)
- `03_Snare_Top.wav` (0.0 dBFS Peak / +1.8 dBFS True-Peak clipping)
- `04_Snare_Btm.wav` (180° inverted polarity for phase cancellation audit)
- `08_Guitar_Elec.wav` (Stereo tracking test)
- `polaris_multitrack_session_passed.zip` (Pre-packaged test multitrack session)

You can directly upload these files in the Polaris Audio dashboard to test the full pipeline!

---

## Testing & Quality Assurance

Polaris Audio enforces a strict automated quality gate across all layers of the stack.

### Running Backend API Integration Tests

The backend suite covers 68 automated integration tests including negative security tests, boundary conditions, token billing assertions, and S3 audio streaming endpoints:

```bash
cd backend
npm test
```

Expected output:
```text
✔ Phase 1 s.d. Phase 6 (Part 1) Integration Suite
ℹ tests 68
ℹ suites 22
ℹ pass 68
ℹ fail 0
```

### Running Python DSP & AI Worker Tests

The worker test suite verifies mel spectrogram classification, True-Peak detection, comb-filtering cross-correlation, and phase alignment across 44 unit tests:

```bash
cd worker
pytest tests/
```

Expected output:
```text
worker/tests/test_ai_engine.py (19 tests) ...... PASSED
worker/tests/test_dsp_engine.py (15 tests) ...... PASSED
worker/tests/test_repair_engine.py (10 tests) ... PASSED
============================== 44 passed ==============================
```

### Verifying Frontend Production Build

Ensure all Vue 3 components, Tailwind CSS styles, and Web Audio modules compile cleanly without type or bundling errors:

```bash
cd frontend
npm run build
```

---

## 📖 Documentation

Comprehensive software engineering specifications and technical documentation are available in the repository:

- 📋 **[Software Requirements Specification (SRS)](docs/SRS_11241056_Polaris-Audio_IPPL_B.md)**: Complete requirements specification (IEEE 830 standard), user stories, use case descriptions (UC-01 to UC-18), and non-functional requirements.
- 📐 **[Software Design Document (SDD)](docs/SDD_11241056_Polaris-Audio_IPPL_B.md)**: Architectural blueprint, Data Flow Diagrams (DFD Level 0 & Level 1), database relational schemas, and UML models.
- 🎨 **[Design System & Visual Direction](DESIGN.md)**: UI/UX design tokens, tactile workbench aesthetic, color contrast rationale (WCAG AA), and anti-slop guidelines.
- 🧪 **[Blackbox Testing Specification](docs/BLACKBOX_TESTING.md)**: Functional test matrix, test cases, and edge-case validation scenarios.
- 📊 **[UML Diagrams](docs/diagrams/)**: Activity and Sequence diagrams for every functional module in PlantUML and Mermaid formats.

---

## 🤝 Contributing & License

### Contributing

Contributions, bug reports, and feature requests are welcome! Please read our **[Contributing Guidelines](docs/CONTRIBUTING.md)** for details on our code of conduct, development workflow, branch naming conventions, and pull request checklist.

### Maintainer

- **Muhammad Iqbal Ferhan** ([@perhanjay](https://github.com/perhanjay))
  - *Institut Teknologi Kalimantan (ITK)*
  - *Course*: IF2514503 - Software Implementation and Testing Project (IPPL)

### License

This project is licensed under the **[MIT License](LICENSE)**. See the `LICENSE` file for full terms and copyright notices.
