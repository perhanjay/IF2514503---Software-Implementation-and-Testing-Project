# Contributing to Polaris Audio

Thank you for your interest in contributing to **Polaris Audio**! This document provides guidelines for contributing to this hybrid DSP & AI audio session preparation workstation.

---

## Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for everyone. Please be respectful and constructive in all discussions and code reviews.

---

## Development Workflow

### 1. Prerequisites
Ensure you have the following installed locally:
- **Node.js**: v20 or v22+
- **Python**: v3.10+
- **Docker & Docker Compose**: For PostgreSQL 17, Redis 7, and MinIO S3
- **Git**

### 2. Fork and Branching
1. Fork the repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/IF2514503---Software-Implementation-and-Testing-Project.git
   cd IF2514503---Software-Implementation-and-Testing-Project
   ```
3. Create a feature or bugfix branch following conventional naming:
   - `feat/feature-name` (e.g., `feat/lufs-integrated-meter`)
   - `fix/bug-description` (e.g., `fix/audio-buffer-sync`)
   - `perf/optimization`
   - `test/test-case-name`

---

## Coding & Architecture Standards

### Backend (Node.js / Express)
- Use standard ES Modules (`import`/`export`).
- Keep business logic inside `backend/src/services/` and routing controllers inside `backend/src/controllers/`.
- Never commit hardcoded secrets; use environment variables from `.env`.
- Ensure all Prisma migrations are tracked via `npx prisma migrate dev`.

### Worker (Python / DSP / AI)
- Keep DSP algorithms deterministic and vectorised using `numpy` and `scipy.signal`.
- Strictly adhere to audio standards (ITU-R BS.1770-4 for True-Peak, 48kHz standard, 24-bit/32-bit float).
- Write unit tests in `worker/tests/` for any new DSP filter or classifier heuristics.

### Frontend (Vue 3 / Web Audio)
- Use Vue 3 Composition API with `<script setup>`.
- Follow the design system defined in `DESIGN.md` (Polaris Electric Blue `#0052FF`, slate contrast, Inter & JetBrains Mono typography).
- Ensure Web Audio API nodes are properly disconnected and disposed on component unmount to prevent audio memory leaks.
- Avoid generic UI cliches or decorative emojis; maintain a professional audio workstation feel.

---

## Testing Guidelines

Before opening a pull request, all automated test suites must pass:

1. **Backend Integration Tests**:
   ```bash
   cd backend
   npm test
   ```
2. **Python Worker Tests**:
   ```bash
   cd worker
   pytest tests/
   ```
3. **Frontend Production Build**:
   ```bash
   cd frontend
   npm run build
   ```

---

## Submitting Pull Requests

1. Commit your changes using [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat(dsp): add oversampled true-peak limiter threshold"
   ```
2. Push to your branch and submit a Pull Request to the `master` branch.
3. Provide a clear description of changes, rationale, and steps to verify.

---

## Need Help?
If you have questions, please open an Issue or review the technical documentation in `docs/SRS_11241056_Polaris-Audio_IPPL_B.md` and `docs/SDD_11241056_Polaris-Audio_IPPL_B.md`.
