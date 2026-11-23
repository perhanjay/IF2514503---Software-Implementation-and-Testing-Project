# Polaris Audio: Design System & Visual Direction

> **Design Direction Contract (v2 — Retro Studio & Frosted Notebook)**
> High-precision audio engineering & DSP multitrack diagnostics workstation for sound engineers, producers, and post-production specialists.
> Aesthetic: **"Tactile Retro Studio on Ruled Notebook Paper"** — warm ruled paper canvas (`#fcfcfb`), frosted glassmorphism panels, mechanical 3D keycap controls (`.btn-keycap`), smoked hardware studio monitors (`#18181b`), and deliberate chromatic punctuation (`#20afff`, `#ffda40`, `#ff82c2`, `#5ad363`).
> Dials: **ENERGY 3 / RHYTHM 2 / MOTION 1**.

---

## 1. Product Identity & Purpose

**Polaris Audio** is an intelligent, web-based multitrack mixing preparation and deterministic DSP diagnostics workstation. It pairs empirical ITU-R BS.1770-4 measurement precision with an approachable, tactile analog-studio interface.

The interface follows four non-negotiable principles:
- **Trustworthy & Deterministic:** Every metric communicates an empirical audio measurement (`dBFS`, phase correlation `-1.00` to `+1.00`, `Hz`/`kHz`, `ms`, ITU-R BS.1770-4 headroom) presented inside high-contrast monitor bezels or crisp telemetry plates.
- **Tactile Paper & Hardware Craft:** A ruled `#fcfcfb` notebook spread with ambient pastel light halos, frosted glass surfaces, die-cut folder tabs (`01`, `02`, `03`), and pressable mechanical keycap buttons rather than sterile enterprise boxes.
- **High-Legibility Telemetry:** Translucent frosted glass is used for structural framing and chrome—never behind small numeric DSP measurements without an opaque/high-opacity backing or dark monitor screen.
- **Strictly Anti-Slop:** Zero perpetual pulsing dots (`rounded-full` status dots on idle UI), zero generic `ALL CAPS` screaming labels or monospace abuse on ordinary buttons/dropdowns, zero decorative unicode emojis pretending to be UI controls, and zero internal SRS codes (`UC-XX`) in visible text.

---

## 2. Dial Declarations

| Dial | Level | Implementation Definition |
|---|---|---|
| **ENERGY** | **3 (Tactile & Expressive)** | Tactile studio craft: ruled notebook paper, pastel chromatic accents, mechanical 3D keycap buttons, and smoked hardware monitor screens—held in check by crisp `#111111` ink outlines. |
| **RHYTHM** | **2 (Structured)** | Modular studio workbench: clean spatial hierarchy using die-cut folder tabs (`01`–`03`) and single-layer frosted surfaces instead of "boxes inside boxes". |
| **MOTION** | **1 (Calm)** | Mechanical keycap press physics (`translate`/`shadow` compression), subtle Polaroid tilt settles, and crisp view transitions (`<200ms`). Zero perpetual idle loops or pulsing status badges. |

---

## 3. Color System & Design Tokens

### A. Paper, Glass & Neutral Ink Tokens

| Token | CSS Variable | Value | Rationale & Role |
|---|---|---|---|
| **Notebook Paper** | `--color-notebook-paper` | `#fcfcfb` | Primary canvas surface with `32px` faint ruled horizontal lines (`.notebook-paper`). |
| **Paper White** | `--color-paper-white` | `#ffffff` | Pure highlight base, keycap top gradient, and Polaroid frames. |
| **Paper Warm** | `--color-paper-warm` | `#f5f3eb` | Warm off-white typography on dark studio surfaces and giant brand wordmark. |
| **Frosted Glass** | `--color-surface-glass` | `rgba(255, 255, 255, 0.72)` | Primary translucent surface for cards/containers (`backdrop-blur-md`). |
| **Frosted Panel (Strong)** | `--color-surface-glass-strong` | `rgba(255, 255, 255, 0.90)` | Modals, navbar dropdowns, and high-legibility overlays (`backdrop-blur-xl`). |
| **Frost** | `--color-frost` | `#cfd6e5` | Cool masking tape tint and soft highlight wash. |
| **Mist** | `--color-mist` | `#eaeef4` | Lower gradient of white keycaps and subtle pressed surface fill. |
| **Stone** | `--color-stone` | `#d4d4d0` | Subtle internal hairlines and faint dividers (prefer over heavy outer strokes). |
| **Slate** | `--color-slate` | `#60605e` | Secondary prose, helper descriptions, and muted metadata labels. |
| **Studio Ink** | `--color-ink-black` | `#111111` | Primary text, keycap 2px outlines, hard offset keycap shadows, and active strokes. |
| **Studio Dark** | `--color-studio-dark` | `#18161a` | Full-bleed footer shell and dark hardware chassis. |
| **Monitor Dark** | `--color-monitor-dark` | `#18181b` | Smoked studio monitor viewport (Goniometer, Peak Meter, Waveforms, Transport). |
| **Monitor Muted** | `--color-monitor-muted` | `#a1a1aa` | Subdued technical labels inside `.retro-monitor` dark screens. |

> **Deprecated Legacy Surface:** `--color-bone` (`#f1f0eb`) and flat `bg-bone` / `hover:bg-bone` fills are deprecated. Migrate workspace cards, banners, and hover states to `.notebook-paper`, `.retro-glass-card`, or `.btn-keycap-white`.

### B. Chromatic Studio Accents

| Token | CSS Variable | Hex | Rationale & Role |
|---|---|---|---|
| **Signal Blue** | `--color-signal-blue` | `#20afff` | Primary studio CTA keycap, Folder Tab `01`, ITU-R telemetry highlight, Mode B active state. |
| **Sun Yellow** | `--color-sun-yellow` | `#ffda40` | Sticky-note highlights, Folder Tab `02`, circular studio stamp, secondary keycap & mono-check accent. |
| **Hot Pink** | `--color-hot-pink` | `#ff82c2` | Editorial accent halo, stamp highlights, destructive/caution keycap variant. |
| **Leaf Green** | `--color-leaf-green` | `#5ad363` | Verified / non-destructive `FIXED_` indicator, Folder Tab `03`, clean compliance tag. |
| **Ember Orange** | `--color-ember-orange` | `#ff6138` | Critical polarity/phase alert tag (e.g. `180° INV`). |
| **Poster Orange** | `--color-poster-orange` | `#ff5a2c` | High-energy editorial poster card accent. |

### C. DSP Diagnostics Status Colors

| Token | CSS Variable | Hex | DSP Condition Meaning |
|---|---|---|---|
| **Status Clean** | `--status-clean` | `#10b981` | Emerald phosphor/text signaling phase-aligned headroom & ITU-R BS.1770-4 compliance. |
| **Status Warning** | `--status-warning` | `#f59e0b` | Amber warning signaling moderate comb filtering, Haas risk, or low crest factor. |
| **Status Critical** | `--status-critical` | `#ef4444` | Crimson alert signaling 180° inverted polarity, clipping, or severe phase cancellation. |

---

## 4. Typography Hierarchy & Contrast Rules

### A. Font Families & Strict Role Boundaries
- **Primary Interface, Headings, Buttons, Badges, Inputs & Folder Tabs:** `Plus Jakarta Sans` (`font-sans`, `font-editorial`, `font-display`).
  - **Display & Section Headings:** `font-editorial font-bold` (`tracking-[-0.025em]` to `-0.04em`).
  - **UI Controls, Buttons, Selects & Status Chips:** Always use `Plus Jakarta Sans` (`font-sans`). Prefer normal sentence/title case over heavy uppercase monospace blocks. Use `tabular-nums` (`font-variant-numeric: tabular-nums`) on ordinary counters (`2 Sesi`, `01 / 04`).
- **Numeric Audio Telemetry Only (`.font-telemetry` / `.font-mono-accent`):** `JetBrains Mono` (`tabular-nums`) is **strictly reserved** for empirical audio readings:
  - Phase correlation (`+0.98`, `-0.84`)
  - True-Peak & Loudness (`-3.0 dBFS`, `+1.2 dBFS`)
  - Crest Factor & Sub-Rumble Cutoff (`12.4 dB`, `25 Hz`, `48 kHz`)
  - Latency, Timecode & File Byte/Duration stamps (`00:12.4`, `< 50 ms`)

### B. Telemetry Legibility Contract over Frosted Glass
Because `.notebook-paper` features ruled horizontal lines (`rgba(0,0,0,0.05)`) and ambient pastel blurs, **small numeric telemetry must never sit directly on semi-transparent glass**:
1. **Dark Monitor Housing (`.retro-monitor`):** Render live meters, Goniometer readouts, transport timecodes, and waveform telemetry inside `bg-[#18181b]/95` using crisp `#ffffff`, `#20afff`, `#5ad363`, or `#ffda40` foreground text.
2. **High-Opacity Telemetry Plate (`.retro-telemetry-plate`):** On light surfaces (diagnostic summary rows, score gauges, track specs), place telemetry readouts on a high-opacity plate (`bg-white/94`, `rgba(255,255,255,0.94)`) with `#111111` ink text to preserve **>= 7:1 contrast**.

---

## 5. Geometry, Radius & Tactile Component Classes

### A. Modernized Radius Scale
Sharp `0px` (`rounded-none`) geometry is replaced by a warm, tactile studio radius hierarchy:
- **Mechanical Keycaps (`.btn-keycap`):** `12px` (`10px` for `.btn-keycap-sm`, `8px` for `.btn-keycap-mini`).
- **Frosted Cards & Folder Sheets (`.retro-glass-card`):** `16px`–`20px`.
- **Modals & Dialogs (`.retro-glass-panel`):** `20px`.
- **Dark Monitor Bezels (`.retro-monitor`):** `12px`–`16px`.
- **Form Inputs & Selects:** `10px`–`12px` (`border-[1.5px] border-[#111111]/25`, `focus:border-[#111111]`).
- **Badges & Circular Studio Stamps:** `9999px` (`rounded-full`) or `.stamp-serrated` perforated postage cutouts.
- **Polaroid Photo Cards:** Crisp `2px–4px` outer matte print frame is permitted for physical scrapbook Polaroids.

### B. Core Component Classes (`frontend/src/style.css`)

1. **Notebook Ruled Canvas (`.notebook-paper`):**
   Base workspace and landing spread (`#fcfcfb` + `32px` repeating `1px` rule lines).
2. **Mechanical Tactile Keycap (`.btn-keycap`):**
   - `2px solid #111111` outline, top inner specular rim (`rgba(255,255,255,0.85)`), bottom chamfer skirt (`inset 0 -5px 0 rgba(0,0,0,0.16)`), and solid ink offset shadow (`3px 4px 0 #111111`).
   - Variants: `.btn-keycap-white` (secondary/neutral), `.btn-keycap-blue` (primary studio action), `.btn-keycap-yellow` (warm CTA/highlight), `.btn-keycap-pink` (caution/destructive or editorial accent), `.btn-keycap-dark` (high-contrast studio trigger).
   - Sizes: default (`12px`), `.btn-keycap-sm` (`10px`), `.btn-keycap-mini` (`8px`).
   - Accessibility: includes `focus-visible` outline ring and clear `:disabled` attenuation without click depression.
3. **Frosted Glass Card (`.retro-glass-card`) & Panel (`.retro-glass-panel`):**
   Translucent glass sheet with top specular white border highlight and soft ambient depth—eliminating heavy nested borders.
4. **Smoked Studio Monitor (`.retro-monitor`):**
   `#18181b` dark instrumentation block for Goniometer, LED Peak Meters, Transport Bar, and Waveform previews.
5. **High-Contrast Telemetry Plate (`.retro-telemetry-plate`):**
   `94%` opaque white plate for numeric DSP tables inside frosted cards.
6. **Die-Cut Folder Tabs (`01`, `02`, `03`):**
   Horizontal SVG-tabbed switcher connecting chromatic step colors (`#20afff`, `#ffda40`, `#5ad363`) to a single unified frosted sheet—replacing stacked vertical accordions.

### C. Legacy Migration & Deprecation
The following v1 classes remain temporarily in `frontend/src/style.css` as `@deprecated` compatibility aliases while secondary views (`DashboardView`, `BillingView`, `LoginView`, `Admin*`) are progressively migrated:
- `.btn-ink-stamp` -> migrate to `.btn-keycap .btn-keycap-dark` or `.btn-keycap-blue`
- `.btn-bone-secondary` -> migrate to `.btn-keycap .btn-keycap-white`
- `.editorial-card` -> migrate to `.retro-glass-card` or `.retro-glass-panel`

---

## 6. UI Craftsmanship & Accessibility Rules

1. **Vector Icons Only:** Use `lucide-vue-next` or crisp inline SVGs. Emojis in buttons, headings, or badges are forbidden.
2. **Static Verifiable State Indicators:** Zero pulsing status dots (`w-1.5 h-1.5 rounded-full animate-pulse`). Communicate state via explicit labels, pill badges, serrated stamps, or active keycap press states.
3. **Single-Sheet Hierarchy (No "Boxes Inside Boxes"):** Never stack full-bordered cards inside full-bordered accordions inside full-bordered session cards. Use folder tabs + hairline dividers (`divide-y divide-[#111111]/10`) or `.retro-monitor` insets.
4. **WCAG 2.1 AA Contrast & Keyboard Navigation:**
   - All buttons, keycaps, and folder tabs must have visible `focus-visible` indicators and >= `44px` comfortable touch targets on mobile.
   - Dialogs must trap focus, darken backdrop (`bg-[#111111]/55 backdrop-blur-xs`), and dismiss on `Escape`.
5. **Responsive Discipline:** Layouts must adapt cleanly across `320px` (mobile), `768px` (tablet), `1024px`, and `1440px` without horizontal page overflow.
6. **No Technical Leakage in UI:** Never display internal SRS identifiers (`UC-01`, `FR-6.4`, etc.) in user-facing text.
