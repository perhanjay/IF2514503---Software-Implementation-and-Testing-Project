# Polaris Audio: Design System & Visual Direction

> **Design Direction Contract**
> Reading this as: High-precision audio engineering & DSP multitrack diagnostics studio tool for sound engineers, producers, and post-production specialists, in a clean, tactile modern workstation aesthetic, dial **ENERGY 2 / RHYTHM 2 / MOTION 1**.

---

## 1. Product Identity & Purpose

Polaris Audio is an audio workstation tool designed for multitrack mixing preparation and deterministic DSP diagnostics (ITU-R BS.1770-4 compliance, phase alignment, DC offset elimination, inter-sample clipping prevention, and stem classification).

The interface must feel like a precision audio tool:
- **Trustworthy & Deterministic:** Every metric communicates an empirical audio measurement (dBFS, degrees phase correlation, millisecond latency, sample rate consistency).
- **Legible & Tactile:** Clear contrast, purposeful hierarchy, and zero superficial decoration that distracts from critical audio diagnostics.
- **Never AI-Slop:** No floating pastel orbs, no generic blue-purple mesh gradients, no endless pulsing dots, no fake terminal windows, no decorative unicode emojis pretending to be UI controls.

---

## 2. Dial Declarations

| Dial | Level | Implementation Definition |
|---|---|---|
| **ENERGY** | **2 (Balanced)** | Professional audio workstation: clean canvas with bold, deliberate primary interactions. Restrained and purposeful. |
| **RHYTHM** | **2 (Structured)** | Modular studio workbench: clear grouping of multitrack session cards, DSP meters, and controls with intentional whitespace. |
| **MOTION** | **1 (Calm)** | Hover states, smooth focus indicators, and dialog fade transitions only. Zero perpetual loops, zero floating bobs, zero rotating rings. |

---

## 3. Color System & Rationale (R-31)

| Token | Value | Rationale |
|---|---|---|
| `--bg-canvas` | `#FAFAFA` | Neutral, high-clarity workbench canvas that prevents eye fatigue during extended listening and editing sessions. |
| `--fg-text` | `#0F172A` | Deep slate offering optimal WCAG AA contrast (> 12:1) against the canvas for long-form diagnostic readouts. |
| `--accent` | `#0052FF` | Studio Electric Blue: a deliberate, single accent color reserved strictly for primary focal CTAs, active tab states, and key interactive highlights. |
| `--accent-hover` | `#0043D6` | Deepened blue for tactile hover feedback on interactive primary elements. |
| `--surface-card` | `#FFFFFF` | Crisp solid surface that elevates diagnostic cards with clear 1px borders rather than exaggerated drop-shadows. |
| `--surface-dark` | `#0F172A` | Studio console dark slate used selectively for hardware-style meter readouts (Lissajous, phase correlation, and True-Peak meters). |
| `--border-color` | `#E2E8F0` | Structural delineation for cards, tables, and inputs that maintains order without visual noise. |
| `--status-clean` | `#10B981` | Emerald green signaling phase-aligned, clean headroom (ITU-R BS.1770-4 compliant). |
| `--status-warning` | `#F59E0B` | Amber orange signaling moderate comb filtering, Haas effect risk, or low crest factor requiring review. |
| `--status-critical` | `#EF4444` | Crimson red signaling 180° inverted phase polarity, destructive comb filtering, or inter-sample clipping. |

---

## 4. Typography Hierarchy & Roles

- **Display & Section Headers:** `Inter` (Bold, -0.025em letter-spacing) — High-precision technical display sans-serif providing tight, professional clarity aligned with digital audio workstation (DAW) and DSP utility standards.
- **Interface & Prose:** `Inter`, system-ui, sans-serif — Clean, neutral, and readable across all breakpoints for labels, instructions, navigation, and form inputs.
- **Measurements & Data Readouts Only:** `JetBrains Mono`, monospace — Strictly reserved for actual numeric telemetry: dBFS, %, Hz, kHz, sample counts, and timestamps. Never applied decoratively to prose headings.

---

## 5. UI Craftsmanship Rules

1. **Icons:** Use proper SVG vector icons (`lucide-vue-next` or inline SVGs). Literal unicode emojis in button labels, headings, and status chips are forbidden.
2. **Status Indicators:** Status dots must be static and reflect verifiable system state (e.g., connected vs. disconnected). Perpetual pulsing animations on idle elements are forbidden.
3. **Resilient Feedback:** Replace blocking browser `alert()` popups with accessible inline banners or toast notifications.
4. **Modals & Dialogs:** All modals must trap focus, support dismissal via the `Escape` key, and render accessible ARIA tags (`role="dialog"`).
5. **Mobile First:** All navigation routes must be fully accessible on mobile devices via a responsive drawer or menu toggle.
6. **Honest Content:** Every preview graphic must carry an explicit `[PREVIEW]` or `[MOCKUP]` label if live session data is not bound.
