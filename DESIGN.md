# Polaris Audio: Design System & Visual Direction

> **Design Direction Contract**
> High-precision audio engineering & DSP multitrack diagnostics studio tool for sound engineers, producers, and post-production specialists.
> Aesthetic: **"Boutique liner notes on sunlit paper"** — warm paper white canvas, confident ink-black typography, deliberate editorial punctuation (Hot Pink & Signal Blue), and tactile 0px sharp geometry.
> Dials: **ENERGY 2 / RHYTHM 2 / MOTION 1**.

---

## 1. Product Identity & Purpose

**Polaris Audio** is an intelligent, web-based multitrack mixing preparation and deterministic DSP diagnostics workstation. It bridges technical precision with tactile craftsmanship.

The interface embodies the feeling of an authoritative physical music print piece:
- **Trustworthy & Deterministic:** Every metric communicates an empirical audio measurement (dBFS, degrees phase correlation, millisecond latency, sample rate consistency conforming to ITU-R BS.1770-4).
- **Tactile & Editorial:** A warm off-white spread with confident sans-serif typography, tactile 0px ink-stamp buttons, and deliberate editorial punctuation rather than scattered decoration.
- **Strictly Anti-Slop:** Zero floating pastel orbs, zero generic purple mesh gradients, zero perpetual pulsing dots on idle components, and zero decorative unicode emojis pretending to be UI controls.

---

## 2. Dial Declarations

| Dial | Level | Implementation Definition |
|---|---|---|
| **ENERGY** | **2 (Balanced)** | Professional audio workstation: clean paper canvas with bold, deliberate primary interactions. Restrained, authoritative, and purposeful. |
| **RHYTHM** | **2 (Structured)** | Modular studio workbench: clear grouping of multitrack session cards, DSP meters, and controls with intentional whitespace and hairline dividers. |
| **MOTION** | **1 (Calm)** | Hover states, smooth focus indicators, and dialog fade transitions only. Zero perpetual loops, zero floating bobs, zero rotating rings. |

---

## 3. Color System & Design Tokens

### A. Core Neutral Palette (Paper & Ink)

| Token | CSS Variable | Hex | Rationale & Role |
|---|---|---|---|
| **Paper White** | `--color-paper-white` | `#ffffff` | Primary canvas surface. Clean, luminous paper surface that avoids eye fatigue. |
| **Bone** | `--color-bone` | `#f1f0eb` | Warm secondary surface for technical cards, accordion panels, and subtle section separation. |
| **Mist** | `--color-mist` | `#efefef` | Neutral cool surface for subtle hover states and secondary elements. |
| **Stone** | `--color-stone` | `#c1c0bc` | Mid-tone divider, hairline border, and subtle container outline. Eliminates heavy drop-shadows. |
| **Slate** | `--color-slate` | `#60605e` | Secondary body text, captions, and muted telemetri labels. High legibility without harshness. |
| **Charcoal** | `--color-charcoal` | `#292c33` | Dark neutral surface and active button press states. |
| **Ink Black** | `--color-ink-black` | `#000000` | Primary text, primary CTA buttons (`.btn-ink-stamp`), and authoritative logo mark. |

### B. Editorial Chromatic Accents (Punctuation)

| Token | CSS Variable | Hex | Rationale & Role |
|---|---|---|---|
| **Hot Pink** | `--color-hot-pink` | `#ff82c2` | Signature brand editorial punctuation: top announcement bar and tactile feature highlight block. Used full-bleed or for inline emphasis. |
| **Signal Blue** | `--color-signal-blue` | `#20afff` | Technical compliance highlight (ITU-R BS.1770-4 block) and active state indicator for comparative A/B multitrack audition mode. |
| **Sun Yellow** | `--color-sun-yellow` | `#ffda40` | Accent highlight wash and decorative status badge fill. |

### C. DSP Diagnostics Status Colors

| Token | CSS Variable | Hex | DSP Condition Meaning |
|---|---|---|---|
| **Status Clean** | `--status-clean` | `#10b981` | Emerald green signaling phase-aligned, clean headroom, and ITU-R BS.1770-4 compliant tracks. |
| **Status Warning** | `--status-warning` | `#f59e0b` | Amber orange signaling moderate comb filtering, Haas effect risk, or low crest factor requiring review. |
| **Status Critical** | `--status-critical` | `#ef4444` | Crimson red signaling 180° inverted phase polarity, destructive comb filtering, or inter-sample clipping. |

---

## 4. Typography Hierarchy & Roles

- **Primary Interface & Display:** `Plus Jakarta Sans`, sans-serif (Weights: 400 Regular, 500 Medium, 600 SemiBold, 700 Bold, 800 ExtraBold).
  - **Display & Headings:** `font-editorial font-bold` (`-0.035em` letter-spacing) — Confident, tightly-spaced headlines giving an authoritative liner-notes cadence.
  - **Labels & Form Controls:** Uppercase tracking (`text-xs font-semibold uppercase tracking-wider`).
  - **Body Prose:** Clean, highly readable line-heights (`leading-relaxed` / `1.56`).
- **Telemetry & Data Readouts Only:** `JetBrains Mono`, monospace — Strictly reserved for numeric audio measurements:
  - Phase correlation values (`+1.00` to `-1.00`)
  - True-Peak (`-0.1 dBFS`, `+1.2 dBFS`)
  - Crest Factor (`12.4 dB`)
  - Frequency Cutoffs (`25 Hz`, `48 kHz`)
  - Latency & Microdelays (`< 1 Sample`, `< 50 ms`)
  - Monospace tabular values in token pricing and wallet mutation tables.

---

## 5. Geometry, Radius & Tactile Components

### A. Strict 0px Border-Radius Standard
In alignment with the editorial print aesthetic, standard rounded corners are eliminated in favor of clean architectural rectangles:
- **Cards & Containers:** `rounded-none` (`border border-stone` or `border-2 border-black`).
- **Buttons:** `rounded-none`.
- **Form Inputs:** `rounded-none` (`border border-stone focus:border-black focus:ring-1 focus:ring-black`).
- **Modals & Dialogs:** `rounded-none` (`border-2 border-black shadow-none`).
- **Accordion Rows & Tables:** `rounded-none`.
- **Exception (Pill Badges Only):** `rounded-full` (`9999px`) is strictly reserved for small status capsule badges (`BARU`, `PREVIEW`, `BARU`).

### B. Standard Component Classes

1. **Ink Stamp Primary Button (`.btn-ink-stamp`):**
   ```css
   .btn-ink-stamp {
     background-color: #000000;
     color: #ffffff;
     border-radius: 0px;
     font-weight: 700;
     letter-spacing: 0.1em;
     text-transform: uppercase;
     transition: background-color 150ms ease, transform 100ms ease;
   }
   .btn-ink-stamp:hover {
     background-color: #292c33;
   }
   .btn-ink-stamp:active {
     transform: scale(0.99);
   }
   ```
2. **Bone Secondary Button (`.btn-bone-secondary`):**
   ```css
   .btn-bone-secondary {
     background-color: #f1f0eb;
     color: #000000;
     border: 1px solid #c1c0bc;
     border-radius: 0px;
     font-weight: 600;
   }
   .btn-bone-secondary:hover {
     background-color: #e4d9cf;
     border-color: #000000;
   }
   ```
3. **Pill Stamp Badge (`.badge-pill-stamp`):**
   ```css
   .badge-pill-stamp {
     border-radius: 9999px;
     padding: 2px 10px;
     font-size: 10px;
     font-weight: 700;
     letter-spacing: 0.05em;
     text-transform: uppercase;
   }
   ```

---

## 6. UI Craftsmanship Rules

1. **Icons:** Use vector SVG icons (`lucide-vue-next` or inline SVGs). Emojis in labels, headings, or status badges are forbidden.
2. **Status Indicators:** Status indicators must remain static and reflect verifiable system state. Perpetual pulsing animations on idle components are prohibited.
3. **Flat Open Hierarchies:** Avoid "boxes inside boxes" (nested cards). Prefer flat bone rows with hairline stone dividers (`divide-y divide-stone/40`).
4. **Modals & Focus:** All dialogs must be accessible, trap focus, and dismiss on `Escape`.
5. **No Technical Leakage in UI:** Do not display internal SRS codes (e.g. `UC-01`, `UC-16`) in end-user facing text.
