# STRATEGY MODULE — UX DENSITY & INFORMATION HIERARCHY INVESTIGATION

**Date:** 2026-05-26  
**Preceded by:** `STRATEGY_MODULE_INVESTIGATION.md` (component map, field inventory, complexity heat map)  
**Scope:** Visual surface, information hierarchy, density analysis, redesign recommendations. No code changes.

---

## TABLE OF CONTENTS

1. [Visual Inventory by Sub-Tab](#1-visual-inventory-by-sub-tab)
2. [Information Hierarchy Analysis](#2-information-hierarchy-analysis)
3. [Density Hotspot Analysis](#3-density-hotspot-analysis)
4. [Navigation and Flow](#4-navigation-and-flow)
5. [Redesign Recommendations](#5-redesign-recommendations)
6. [Open Questions for Leon's Design Input](#6-open-questions-for-leons-design-input)

---

## 1. Visual Inventory by Sub-Tab

### 1.1 Header — Always Visible

**PanelHeader:**
```
STRATEGY INTELLIGENCE                          [STATUS BADGE]
M08 v2 · DETECTION-FIRST ARCHITECTURE
[DETECT] [SCORE] [EVIDENCE] [PLAN]
```
- 4 pipeline-stage labels rendered in the header but not interactive (labels only, no click action)
- Status badge: one of COMPUTING M08 v2... | ANALYZED | ERROR | NOT LOADED
- Visual weight: LOW — thin amber border, two text lines, 4 labels

**SubTabBar:**
```
[M08 v2 ANALYSIS]  [SIGNAL MATRIX]  [CUSTOM SCREENS]
```
- 3 tabs, no badge counts, no loading indicators per-tab
- First-glance information count: **3 labels** — not cognitive load

---

### 1.2 Tab 0 — M08 v2 ANALYSIS

This is the primary, most complex tab. The full block rendering order after the gate is unlocked:

| # | Block | Component | Visual Weight | Interactive Elements |
|---|---|---|---|---|
| 1 | Detection Banner | `DetectionBanner` | MEDIUM (always rendered) | CONFIRM, ADJUST (panel), OVERRIDE (modal), ▼ SIGNALS (expand) |
| 2 | Sub-Strategy Comparison | `SubStrategyComparison` | HIGH | Cards scrollable horizontally; no click-to-expand |
| 3 | Signal × Strategy Heatmap | `SignalHeatmap` | MEDIUM | Cell hover tooltip; cell click → navigate to source module tab; column click → scroll to evidence |
| 4a | Evidence — Primary Sub-Strategy | `EvidenceReportBlock` | VERY HIGH (expanded by default) | Expand/collapse header; row hover → sparkline drawer; row click → detail drawer; math trail sourceRef → scroll; "Collapse" button |
| 4b | Evidence — Alternate Sub-Strategies | `EvidenceReportBlock` × N | HIGH (collapsed by default) | Same as 4a, but starts collapsed |
| 5 | Correlation Timing | `CorrelationTimingPanel` | HIGH | No interactivity beyond data display |
| 6 | Investment Plan | `PlanDocument` | HIGH | 3 "APPLY TO PRO FORMA" buttons (ENTRY, VALUE CREATION, EXIT); editable inputs throughout; PIVOT NOW buttons; value creation action row hover |
| 7 | Monitoring Dashboard | `MonitoringDashboard` | MEDIUM | "CRITICAL THRESHOLD — DECIDE NOW" button per critical item |
| 8 | AI Coordinator Narrative | `AICoordinatorNarrative` | LOW | None — read-only |

**Total interactive elements in M08 v2 ANALYSIS (unlocked state):**
- Persistent: CONFIRM, ADJUST, ▼ SIGNALS, OVERRIDE
- Per sub-strategy card: none (read-only)
- Per heatmap cell: hover + click (5 signals × N sub-strategies)
- Per evidence block: expand/collapse, per-row hover drawer, per-row click drawer, sourceRef buttons, "APPLY TO PRO FORMA" × 3 (stub)
- Plan inputs: 3 text inputs (targetQuarter, priceCeiling, debtStructure) + N timing inputs + N expectedImpact inputs + PIVOT NOW × M
- Monitoring: DECIDE NOW × critical-count

**First-glance information count at page load (without scrolling):**
Assuming a 1080px viewport height, the operator sees:
1. Panel header (2 lines of text, 4 labels, 1 badge)
2. SubTabBar (3 labels)
3. Detection Banner — assetClass, dealType, subStrategy slug, CONF%, optional confirmation badge (5 data points + 4 buttons)
4. Top edge of SubStrategyComparison — first 1-2 cards partially visible

**Estimated first-glance count: ~12 data points + 5 interactive elements** before any scroll.

This is manageable, but the user must scroll immediately to see the most important financial output.

---

### 1.3 Detection Banner — Gated vs Confirmed

**Locked state (confidence < 70%, no confirmation):**
- Modal gate appears immediately on mount — full-screen overlay with 3 choices
- Modal contains: detected classification, confidence %, 3 action buttons
- Dismissing the modal leaves the page behind a "DETECTION GATE LOCKED" placeholder — no scoring or evidence visible
- Operator cannot proceed at all without resolving the gate

**Confirmed state:**
```
DETECTED  [MULTIFAMILY · VALUE ADD]  [mf_value_add_standard]  CONF [87%]  [✓ CONFIRMED]
                                          [✓ CONFIRM] [ADJUST] [▼ SIGNALS] [OVERRIDE CLASSIFICATION]
```
- Single horizontal band, ~44px tall
- 4 action buttons in the right edge (visible even in confirmed state — ADJUST and OVERRIDE always available)
- The ADJUST button reveals an inline input panel (free-text sub-strategy key entry, no dropdown)

---

### 1.4 Sub-Strategy Comparison

```
SUB-STRATEGY COMPARISON ─────────────────────────────────────────
[⚡ ARBITRAGE DETECTED] narrative text  Δ N.N pts    [scrolls right →]
 
[VALUE ADD STD]   [CORE PLUS]   [DISTRESSED]   [LEASE UP]   [...]
 ⚡ QUALIFIED       QUALIFIED     DISQUAL         QUALIFIED
 [ScoreRing: 78]  [ScoreRing: 62] [ScoreRing: 31] [ScoreRing: 55]
  IRR   12.1%       IRR  9.4%     IRR  —           IRR  10.8%
  CoC   7.8%        CoC  5.2%     CoC  —           CoC  6.1%
  EM    1.6x         EM  1.4x     EM   —            EM  1.5x
  EXIT  5.50%       EXIT 5.80%   EXIT  —           EXIT 5.40%
  HOLD  60mo        HOLD 48mo    HOLD  —           HOLD 54mo
  BASE 68.3 × 1.12 + ADJ 0
```

- Horizontally scrollable — cards off-screen to the right are not visible
- Each card: 180px wide, 5 data rows + score + formula footnote
- Estimated card count for multifamily: 7-8 sub-strategies visible = ~40 data cells + 8 score rings
- Arbitrage banner appears above if detected
- **The highest-value summary (which sub-strategy "wins" and by how much) is in the arbitrage banner** — but only appears conditionally

**Operator's question:** "Which strategy should I pursue?" → Partially answered by the ⚡ primary badge and arbitrage banner, but the operator must look across all cards to compare.

---

### 1.5 Signal × Strategy Heatmap

```
SIGNAL × STRATEGY HEATMAP ─────────────────────────────────────
SIGNAL    VALUE ADD STD   CORE PLUS   DISTRESSED   LEASE UP
          (→evid)          (→evid)     (→evid)      (→evid)
DEMAND 72   [87]            [72]         [58]         [99]
              w=0.30         w=0.25       w=0.20       w=0.35
SUPPLY 63   [75]            [63]         [48]         [89]
MOMENTUM 55 [55]            [55]         [43]         [55]
POSITION 81 [61]            [81]         [65]         [41]
RISK 44     [44]            [44]         [88]         [44]
──────────────────────────────────────────────────────────────
≥80 STRONG  50-79 WATCH  <50 WEAK     hover=formula · click=jump
```

- 5 rows × N columns + header + legend
- Each cell: hover shows formula tooltip; click navigates to source module tab
- Column headers: truncated sub-strategy name + "→ evid" link
- Row label: signal name + raw signal score below (two lines per row)
- **This is pure analyst content** — it explains WHY each sub-strategy scored the way it did

---

### 1.6 Evidence Report Blocks

One block per sub-strategy. Primary is expanded by default; alternates are collapsed.

**Collapsed state (alternate sub-strategies):**
```
▶ EVIDENCE — CORE PLUS                             [single row, clickable]
```

**Expanded state (primary sub-strategy):**
```
▼ EVIDENCE — VALUE ADD STANDARD   ⚡ DETECTED PRIMARY    [COLLAPSE]

BLOCK B — THESIS PROMPT
  Headline: [one-sentence thesis]
  Rationale: [paragraph]
  Key Drivers: [bullet 1] [bullet 2] [bullet 3]
  Risk Factors: [bullet 1] [bullet 2]
  AI Coordinator Context: [sentence]

BLOCK A — METRIC STACK
  LABEL            SUBJECT    BENCHMARK  DELTA  $ IMPACT  SOURCE  QUALITY
  Loss to Lease    12.3%      8.0%       +4.3%  +$127K    T12     live
  Occupancy        91%        94%        -3.0%  -$45K     T12     live
  Rent/Unit        $1,420     $1,380     +2.9%  +$38K     mkt     live
  ... (N rows)
  [hover row → EvidenceDrawer slides in from right]

BLOCK C — COMP EVIDENCE
  [TRADE-AREA COMPS scatter]  [LIKE-KIND COMPS scatter]

BLOCK D — MATH TRAIL
  1. [step]                                    [value]  [→sourceRef]
  2. [subtotal step - amber]                   [value]
  ... (M steps)

EXPECTED RETURN
  IRR [12.1%]   EM [1.6x]   HOLD [60mo]   EXIT CAP [5.50%]
```

**Per-block data point count for a fully-populated evidence block:**
- Block B: ~5-7 data points (thesis, rationale, 2-3 drivers, 1-2 risks)
- Block A: 5-8 metric rows × 6 columns = 30-48 data cells
- Block C: 2 scatter plots (data points depend on comp count)
- Block D: 4-12 math trail steps
- Expected Return: 4 numbers

**Total per expanded evidence block: ~45-70 data points**

With the primary block expanded and 3 alternates collapsed, the operator is looking at ~50 data points before reaching Correlation Timing.

---

### 1.7 Correlation Timing Panel

```
CORRELATION TIMING ──────────────────────────────────────────────
GOLDEN CHAIN — Phase Description          | ACTIVE CORRELATION ALERTS
● DISCOV → ● SIGNAL → ◎ ENTRY → ... → ... | COR-07 [CRITICAL] label → planDim
  ◆ Active signal 1                       | COR-12 [WARNING] label → planDim
  ◆ Active signal 2                       |
─────────────────────────────────────────────────────────────────
LEADING INDICATORS    | CONCURRENT         | LAGGING
▲ Cap Rate  5.4%      | ▲ Rent Gr  3.1%   | ◆ Absorption  280
▼ Permits   450       | ◆ Vacancy  5.2%   | ▲ Employment  2.3%
```

- 2 columns (Golden Chain | Alerts) + 3-column indicator strip below
- Golden Chain: 8 step dots + up to 3-4 active signal bullets
- Alerts: N rows
- Indicators: 3 × 2-3 rows = 6-9 data points
- **No interactivity** — read-only display

---

### 1.8 Investment Plan Document

```
INVESTMENT PLAN DOCUMENT ────────────────────────────────────────
┃ENTRY         [APPLY TO PRO FORMA]
  TARGET QUARTER: [editable input]
  PRICE CEILING:  [editable input]
  DEBT STRUCTURE: [editable input]
  Rationale: [italic text]

┃VALUE CREATION  [APPLY TO PRO FORMA]
  PH1 [action description]  ⏱ [timing input]  IMPACT → [impact input]
  PH2 [action description]  ⏱ [timing input]  §evidenceRef COR-07
  ... (N actions)

  HOLD STRUCTURE
  TARGET HOLD: 60mo
  ◆ Exit Window ...
  ◆ Exit Window ...

┃EXIT            [APPLY TO PRO FORMA]
  TARGET QUARTER: Q3 2028
  BUYER TYPE: Value-Add REIT
  EXIT CAP: 5.50%
  IRR RANGE: 11.2–13.8%
  ◆ Buyer name 1
  ◆ Buyer name 2

  MONITORING TRIGGERS
  [INFO]  [metric]  NOW: val  ▲ threshold
  [WARNING] [metric] NOW: val ▲ threshold

  PIVOT CONDITIONS
  [PIVOT NOW] TRIGGER: [condition]
              → pivotTo
              rationale
```

- 7 distinct sections: ENTRY, VALUE CREATION, HOLD, EXIT, MONITORING, PIVOT CONDITIONS
- All visible simultaneously (no collapse-by-section)
- 3 "APPLY TO PRO FORMA" buttons (stub — non-functional)
- Editable inputs throughout (target quarter, price ceiling, debt structure, action timing, expected impact) — all locally stateful, no persistence
- "PIVOT NOW" button per pivot condition: shows amber alert on click but takes no actual action

---

### 1.9 Tab 1 — SIGNAL MATRIX

```
[BULLISH: 12] [BEARISH: 4] [NEUTRAL: 8] [INSUFF: 6]

SIGNAL STABILITY · 36M ROLLING            [STABLE / MODERATE / VOLATILE]
████████░░  82%
4 pairs · 36 observations

TRACKED METRIC PAIRS · 36M WINDOW         N pairs
METRIC A           METRIC B          r     STABILITY  PTS
rent_growth_yoy    absorption_rate   0.63  STABLE     12pt
permits            vacancy_pct       -0.44 MODERATE   10pt
...

COR-01–30 · Atlanta, GA · 22/30 computed · [timestamp]  [PIN]
```

- 4 counters + 1 stability bar + pair table (up to 20 rows × 5 columns)
- Fallback: "Nightly job seeds history · first run pending" when no history
- First-glance information count: **~5 items** (4 counters + 1 status) — significantly lighter than Tab 0

---

### 1.10 Tab 2 — CUSTOM SCREENS

Not fully read, but based on the `CustomScreenTab` import and the strategy-definitions backend: allows operators to define and run screening conditions against the deal or property universe. Lighter density than Tab 0.

---

## 2. Information Hierarchy Analysis

### 2.1 What Operators Most Need to Know

In order of priority for a typical operator arriving at the Strategy tab:

| Priority | Question | Desired answer format |
|---|---|---|
| 1 | What strategy should I pursue? | 1-2 word label + "detected" or "recommended" |
| 2 | How confident is the system in this? | HIGH/MED/LOW + one qualifier |
| 3 | What are the headline numbers? | IRR, hold period, equity multiple |
| 4 | Why this strategy? | 1-3 facts |
| 5 | What risks should I know about? | 1-3 warnings |
| 6 | What should I do? (action plan) | Entry conditions, value creation priorities, exit target |
| 7 | What should I watch? | 2-3 monitoring triggers |
| 8 | What's the detailed evidence? | Full metric stack, comps, math trail |
| 9 | How does this compare to alternates? | Sub-strategy comparison grid |
| 10 | What are the correlation dynamics? | Golden Chain, leading indicators |

### 2.2 Current Visual Hierarchy vs. Operator Priority

| Operator Priority | Current Position | Buried or Visible? |
|---|---|---|
| Strategy name | Position 1 (DetectionBanner) | ✓ Visible at top |
| Confidence | Position 1 (DetectionBanner) | ✓ Visible at top |
| Headline numbers (IRR, hold, EM) | Position 2 (SubStrategyComparison cards) | ⚠ Visible after slight scroll — horizontally hidden for alternates |
| 1-line why | Position 4a (EvidenceReportBlock, Block B, thesis) | ✗ Buried — after SubStrategyComparison + SignalHeatmap |
| Risks/concerns | Position 4a (Block B, riskFactors) | ✗ Buried — same |
| Entry conditions (action) | Position 6 (PlanDocument, ENTRY section) | ✗ Deep scroll — after all evidence blocks |
| Value creation plan (action) | Position 6 (PlanDocument) | ✗ Deep scroll |
| Monitoring triggers | Position 7 (MonitoringDashboard) | ✗ Deepest — after full plan |
| Detailed evidence | Position 4a (EvidenceReportBlock) | ✓ Evidence is prominent — appropriate for depth |
| Alternate comparison | Position 2 (SubStrategyComparison) | ✓ Visible after scroll — correctly positioned |

### 2.3 Evidence Depth Tier Mapping

**Definition:**
- **TIER 1** (headline): Immediately visible; answers the key operator question in 1 glance
- **TIER 2** (operator review): Visible with minimal scroll; operator reviews before acting
- **TIER 3** (analyst depth): Available on demand; not default-visible
- **TIER 4** (deep dive): Sub-tab or deliberate expand required

**Where blocks currently live vs. where they should be:**

| Block | Current Tier | Target Tier | Status |
|---|---|---|---|
| Strategy name + confidence | TIER 1 (DetectionBanner) | TIER 1 | ✓ Correct |
| Confidence detail (5-dimension breakdown) | TIER 3 (▼ SIGNALS expand) | TIER 3 | ✓ Correct |
| Financial summary: IRR, hold, EM of primary strategy | TIER 2 (SubStrategyComparison cards) | TIER 1 | ✗ Should be in the DetectionBanner alongside strategy name |
| Thesis (1-line "why this strategy") | TIER 3 (EvidenceReportBlock Block B) | TIER 1 | ✗ Should be in the DetectionBanner or immediately below it |
| Risk factors (top 1-2) | TIER 3 (EvidenceReportBlock Block B) | TIER 2 | ✗ Not surfaced without opening evidence |
| Sub-strategy comparison (N cards) | TIER 2 (SubStrategyComparison) | TIER 2 | ✓ Correct tier, ⚠ horizontal scroll hides alternates |
| Signal heatmap | TIER 2 (between comparison and evidence) | TIER 3 | ✗ Interrupts flow from comparison to evidence; analyst-depth content |
| Evidence Block B (thesis prompt) | TIER 2-3 (expanded block) | TIER 2 (collapsed block) → TIER 3 (detail) | ✗ Over-prominent when block is expanded by default |
| Evidence Block A (metric stack) | TIER 2-3 (expanded block) | TIER 3 | ✗ 6-column table is analyst content |
| Evidence Block C (comps scatter) | TIER 3 (inside expanded block) | TIER 3 | ✓ Correct if block is collapsed by default |
| Evidence Block D (math trail) | TIER 3 (inside expanded block) | TIER 4 | ✗ Math derivation is deep-dive content |
| Expected Return tile | TIER 3 (bottom of evidence block) | TIER 1 | ✗ The IRR/EM/hold is the most important output; buried at bottom of each block |
| Correlation Timing (Golden Chain + alerts) | TIER 3 (after all evidence) | TIER 3 | ✓ Correct |
| PlanDocument: ENTRY | TIER 3 (deep scroll) | TIER 2 | ✗ Entry conditions are the primary action item — should be near the top |
| PlanDocument: VALUE CREATION actions | TIER 3 (deep scroll) | TIER 2 | ✗ Actionable content |
| PlanDocument: MONITORING + PIVOT | TIER 3 (deep scroll) | TIER 3 | ✓ Correct |
| MonitoringDashboard | TIER 4 (bottom) | TIER 3 | ⚠ Slightly deep |
| AI Coordinator Narrative | TIER 4 (bottom) | TIER 2 | ✗ Should be near the top — it's the plain-language summary of everything |
| Signal Matrix tab | TIER 4 (separate tab) | TIER 4 | ✓ Correct |
| Custom Screens tab | TIER 4 (separate tab) | TIER 4 | ✓ Correct |

### 2.4 Click/Scroll Count to Answer Key Questions

| Question | Current click/scroll count |
|---|---|
| What's the recommended strategy? | 0 — visible in DetectionBanner |
| What's the confidence? | 0 — visible in DetectionBanner |
| What's the IRR for the recommended strategy? | 1 small scroll — first card in SubStrategyComparison |
| What's the 1-line thesis (why this strategy)? | 2 scrolls + 1 click (expand evidence, find Block B) |
| What are the top risks? | 2 scrolls + 1 click (same as thesis) |
| What's the plan entry (what to do first)? | 5+ scrolls (through comparison + heatmap + all evidence blocks + timing panel) |
| What's the monitoring trigger to watch? | 7+ scrolls |

**Assessment:** Priority 6 (entry conditions / what to do) requires 5+ scrolls to reach. This is the clearest hierarchy problem: the actionable output (the investment plan) is at the bottom of an evidence-heavy page.

---

## 3. Density Hotspot Analysis

### 3.1 Hotspot 1 — EvidenceReportBlock (Multi-Block Stack)

**Density profile:**
- For a multifamily deal, 7-8 sub-strategies exist
- Default state: primary block expanded (50-70 data points), 6-7 blocks collapsed (1 row each)
- Expanded block contains: Block B (7-10 items), Block A (30-48 cells), Block C (2 scatter plots), Block D (4-12 steps), Expected Return (4 numbers)
- A single fully-populated evidence block is the equivalent of a Bloomberg terminal screen worth of data

**Is the density essential or accidental?**
- Block A (metric stack): Essential for analysts; accidental for operators who just want the thesis
- Block B (thesis + keyDrivers): Essential — this should be the headline
- Block C (comp scatter): Useful context but analyst-depth
- Block D (math trail): Analyst-depth; derivation steps are for verification, not decision-making
- Expected Return tile: Essential — but positioned at the bottom of the block, below the analyst content

**Minimum density to preserve purpose:**
- Tier 1 summary line: thesis headline + Expected Return (IRR/EM/hold) = 5 data points
- Tier 2 expandable: Block A metric stack (top 3 metrics by dollar impact) + Block B (keyDrivers + riskFactors)
- Tier 3 expandable: Full Block A, Block C comps, Block D math trail

**Current density vs. minimum: 10× too dense at default expansion.**

---

### 3.2 Hotspot 2 — PlanDocument (7 Sections Simultaneously)

**Density profile:**
- 7 sections visible at once: ENTRY, VALUE CREATION (N actions), HOLD, EXIT, MONITORING, PIVOT CONDITIONS
- All editable inputs are always visible (targetQuarter, priceCeiling, debtStructure, N×timing, N×expectedImpact)
- 3 "APPLY TO PRO FORMA" buttons visible (all stubs)
- N "PIVOT NOW" buttons visible

**Is the density essential or accidental?**
- ENTRY + EXIT: Essential — the two anchor decisions for the deal
- VALUE CREATION: Essential in summary; full action list is analyst-depth
- HOLD STRUCTURE: Supplementary — the hold target is already shown in SubStrategyComparison
- MONITORING TRIGGERS: Operator-relevance varies; most are Tier 3
- PIVOT CONDITIONS: Tier 3 — decision support, not primary view

**Simplification opportunity:**
Collapsing MONITORING + PIVOT CONDITIONS by default would cut ~30% of the plan's visible area without removing any content.

---

### 3.3 Hotspot 3 — CorrelationTimingPanel

**Density profile:**
- 2-column layout (Golden Chain | Alerts) + 3-column indicator strip
- Golden Chain: 8 steps + step labels + active signal bullets
- Alerts: 0-N rows (each with correlationId, label, drivesPlanDimension)
- Indicators: 3 categories × 2-3 items each = 6-9 data points

**Is the density essential?**
- Golden Chain: Useful orientation but 8-step chain with labels is compact; the current rendering (dots + labels + arrows) is appropriately minimal
- Correlation alerts: Essential for operators — these directly affect strategy validity
- Indicators: Analyst-depth at this zoom level

**Simplification opportunity:**
Move the 3 indicator lists (leading/concurrent/lagging) to a collapsed section or to the Signal Matrix tab, keeping only the Golden Chain + active alerts in the primary view.

---

### 3.4 Hotspot 4 — Signal × Strategy Heatmap

**Position problem:** The heatmap is positioned between SubStrategyComparison and EvidenceReportBlock. This interrupts the natural flow from "which strategy?" (comparison) to "why?" (evidence). An operator who wants to understand the recommendation must scroll past a 5×N table of weighted scores — analyst content — before reaching the evidence that explains the strategy.

**Is it in the right position?**
- No. The heatmap explains scoring weights, which is Tier 3 content. It is positioned in Tier 2 space.
- It belongs after the evidence blocks or inside an expandable "SCORING DETAIL" section within SubStrategyComparison.

---

## 4. Navigation and Flow

### 4.1 Typical Operator Workflow

**When a deal arrives on the strategy tab, an operator's mental flow is:**

```
1. "What strategy did the system recommend?" → DetectionBanner: answered immediately
2. "How confident?" → DetectionBanner: answered immediately
3. "What does that mean financially?" → SubStrategyComparison: requires scroll
4. "Why this strategy?" → EvidenceReportBlock Block B: requires 2 scrolls + click
5. "What do I do?" → PlanDocument: requires 5+ scrolls
6. "What's the arbitrage opportunity?" → Arbitrage banner in SubStrategyComparison: visible if detected
7. "Anything to watch?" → Monitoring Dashboard: deepest
```

**Problem:** Steps 4 and 5 (the why and the what-to-do) are out of order with operator priority. Evidence comes before action, when operators typically want action first and evidence on demand.

**Current page order:** Detect → Compare → Heatmap (analyst) → Evidence (analyst) → Timing → Plan (action)

**Preferred operator order:** Detect + Financial Summary + Thesis → Compare → Plan (action) → Evidence (on-demand) → Timing → Monitoring

### 4.2 Sub-Tab Usage

**M08 v2 ANALYSIS:** The primary operator surface. All evidence and planning live here.

**SIGNAL MATRIX:** Pure analyst depth. The 4 COR counters (bullish/bearish/neutral/insufficient), stability score, and pair stability table are useful for understanding market context but are not actionable decisions. The label "SIGNAL MATRIX" correctly signals its analytical nature.

**CUSTOM SCREENS:** Operational — screening workflow. Lighter density.

**Relabeling opportunity:** "M08 v2 ANALYSIS" could be "STRATEGY ANALYSIS" for clarity — the "M08 v2" label is system-internal nomenclature that operators don't need to see. "SIGNAL MATRIX" could be "MARKET SIGNALS" for the same reason.

### 4.3 Relationship to Other Modules

**Should strategy headline be visible from F9?**
The F9 Financial Engine (ProForma) is the primary operator workspace. The Strategy Module's recommended strategy (sub-strategy slug + confidence + IRR summary) should be visible from F9 as a persistent annotation or deal summary, not requiring navigation to the Strategy tab. Currently there is no cross-module strategy headline visible in F9.

The "APPLY TO PRO FORMA" stub buttons in the PlanDocument are the intended integration mechanism, but they don't work. Even if they worked, the direction is wrong: the operator would have to navigate to the Strategy tab, find the button, click it, and return to F9. A better design surfaces the strategy headline persistently inside F9's Deal Summary header.

---

## 5. Redesign Recommendations

### 5.1 Information Hierarchy Restructure

**Recommended block order and tier assignments:**

**TIER 1 — Strategy Intelligence Summary (new, always-visible sticky header or top block):**

A new compact summary row immediately below the DetectionBanner, collapsing what are currently buried data points:

```
┌─ STRATEGY INTELLIGENCE SUMMARY ──────────────────────────────────────────────┐
│ RECOMMENDED  [MF VALUE ADD STANDARD]  ⚡ DETECTED     IRR [12.1%]  EM [1.6x] │
│ CONF [87%]   60mo HOLD   EXIT CAP [5.50%]   ENTRY: Q2 2026   PRICE ≤ $18.5M │
│ WHY: Loss-to-lease 12.3% (benchmark 8%) · Occupancy recovery thesis in place │
│ RISK: Occupancy below 93% — not core-qualified until stabilization achieved  │
└───────────────────────────────────────────────────────────────────────────────┘
```

This single row (or 4-line block) answers priorities 1-5 without a single scroll. All underlying data already exists in the M08 v2 contract:
- Strategy name: `detection.detectedSubStrategy` (display name)
- Confidence: `detection.confidence`
- IRR, EM, hold: `subStrategies[primary].financialPreview`
- Entry target: `plan.entry.targetQuarter` + `plan.entry.priceCeiling`
- 1-line thesis: `subStrategies[primary].evidenceReport.thesis`
- Top risk: `subStrategies[primary].evidenceReport.thesisPrompt.riskFactors[0]`

**TIER 2 — Operator Review:**

After the summary, in this order:
1. SubStrategyComparison (card grid) — operator chooses whether to proceed with recommended or select an alternate
2. PlanDocument: ENTRY + VALUE CREATION (summary view) — actionable decisions
3. PlanDocument: EXIT — actionable

**TIER 3 — Analyst Depth (collapsed by default, expand on demand):**

4. Signal × Strategy Heatmap (moved from between comparison and evidence)
5. EvidenceReportBlock per sub-strategy (collapsed for all including primary, but with 1-line headline visible: thesis + IRR)
6. CorrelationTimingPanel: Golden Chain + alerts (full) + indicators (collapsed by default)
7. PlanDocument: HOLD STRUCTURE, MONITORING TRIGGERS, PIVOT CONDITIONS (collapsed)

**TIER 4 — Deep Dive:**

8. SIGNAL MATRIX tab (as-is — correctly placed)
9. CUSTOM SCREENS tab (as-is)

---

### 5.2 Density Reduction Per Hotspot

**Evidence blocks:**
- Default collapse all evidence blocks, including the primary
- Each collapsed block shows a single-line headline: `[EVIDENCE] VALUE ADD STANDARD  ⚡  IRR 12.1%  EM 1.6x  CONF 87%`
- On expand: show Block B (thesis + top 3 drivers + top 2 risks) + Expected Return tile
- Block A (metric stack), Block C (comps), Block D (math trail) move behind a secondary "FULL DETAIL" expand inside the opened block
- Effect: initial scroll depth reduced from ~2000px to ~300px before reaching the plan

**PlanDocument:**
- Default: show ENTRY + VALUE CREATION + EXIT sections only
- HOLD STRUCTURE: collapsed by default (data already in SubStrategyComparison card)
- MONITORING TRIGGERS: collapsed, with count badge ("3 monitors set")
- PIVOT CONDITIONS: collapsed, with count badge ("2 pivot conditions set")
- APPLY TO PRO FORMA buttons: either removed (stub) or replaced with a single "PUSH ENTRY TO F9" button with correct endpoint

**CorrelationTimingPanel:**
- Remove the 3 indicator lists from the primary panel — move to Signal Matrix tab
- Keep only: Golden Chain steps + active alerts
- Effect: panel height reduced by ~40%

**Signal Heatmap:**
- Move below all evidence blocks — after the analyst has engaged with evidence, the heatmap provides scoring context
- Or: convert to a collapsible section inside SubStrategyComparison (each card could have a "▼ SIGNAL WEIGHTS" expand showing that card's row from the heatmap)

---

### 5.3 Visual Treatment (Using Existing Bloomberg Tokens)

**Strategy Intelligence Summary block:**
- Background: `BT.bg.panelAlt` (slightly differentiated from panel)
- Border: left `3px solid BT.text.amber` (amber = strategy module color)
- IRR value: `BT.text.green` (positive financial metric)
- Confidence: `confColor(conf)` — existing helper (green ≥ 85%, amber 70-85%, red < 70%)
- Thesis line: `BT.text.secondary`, font-style italic
- Risk line: `BT.text.amber`, prefix `⚠`

**Evidence block collapsed headline:**
- Border accent: `BT.text.amber` for primary, `BT.border.medium` for alternates
- IRR in collapsed headline: `BT.met.financial` (existing financial metric color)
- "DISQUALIFIED" badge: `BT.text.red` visible in collapsed state (operators should know immediately which alternates are disqualified without expanding)

**Collapsed sections in PlanDocument:**
- Collapsed header shows a count badge: `Bd c={BT.border.medium}` with item count
- Expand with `▼`/`▶` chevron using existing pattern

---

### 5.4 Patterns from Other Modules

**F9 (ProForma) pattern:** F9 uses a 9-tab bar at the top to shard density by domain — each tab is a focused surface (Assumptions, Revenue, Expenses, etc.). No single tab overwhelms. The Strategy Module has no equivalent sharding; it puts all content in one scrollable column with a shallow sub-tab bar.

**F3 (Market Analysis):** Uses metric selector tabs within the chart panel to control which metric is shown — progressive disclosure of data rather than all-at-once. The Signal Matrix tab uses a similar 4-counter header. The main analysis tab does not use this pattern.

**F7 / M11 (Debt Advisor):** Uses 4 sub-tabs (Advisor, Configure, Sensitivity, Exit) to isolate concerns. The Strategy Module's 3 sub-tabs could be expanded to 4-5 to shard content: Summary | Evidence | Plan | Signals | Custom.

**M07 (Traffic Engine):** Prediction-first → the headline prediction is visible immediately at the top, with data fusion layers accessible below. This is the correct hierarchy model for the Strategy Module: recommendation first, evidence below.

---

## 6. Open Questions for Leon's Design Input

**OQ-UX-1 — Analysis-first vs. Recommendation-first?**

The current design is analysis-first: evidence leads, plan follows. The alternative (recommendation-first) puts the plan entry conditions at the top, with evidence accessible on demand. Which mental model fits your operators' typical workflow? Do they want to validate evidence before seeing the recommendation, or do they want the recommendation immediately and drill into evidence only when they question it?

**OQ-UX-2 — Strategy Summary block placement?**

The proposed "Strategy Intelligence Summary" block (TIER 1) could live:
- A: Immediately below the DetectionBanner (top of the analysis tab)
- B: As a persistent sticky element at the top of the scroll container
- C: As a card in the F9 Deal Summary header visible across all F9 tabs

Which placement fits the operator's workflow? Option C would be the highest-impact but requires cross-module integration.

**OQ-UX-3 — Evidence block default state?**

Currently: primary sub-strategy block is expanded by default.
Proposed: all blocks collapsed by default, with a 1-line headline visible.

Does your typical operator want to read the evidence immediately, or do they want to find the recommendation first and then optionally drill into evidence?

**OQ-UX-4 — Signal Heatmap: keep or move?**

The Signal × Strategy Heatmap is visually interesting and technically accurate, but it interrupts the flow from "which strategy" to "why" by inserting analyst-level scoring detail between them. Options:
- A: Move it below evidence blocks (current position is wrong, deeper is better)
- B: Collapse it into a "SCORING DETAIL" accordion inside SubStrategyComparison
- C: Move it to the Signal Matrix tab entirely

**OQ-UX-5 — Sub-tab sharding?**

The single "M08 v2 ANALYSIS" tab currently contains everything from detection through plan. A 4-tab design could be:
- SUMMARY (DetectionBanner + IntelligenceSummary + SubStrategyComparison)
- EVIDENCE (all EvidenceReportBlocks)
- PLAN (PlanDocument + MonitoringDashboard)
- SIGNALS (SignalHeatmap + CorrelationTimingPanel + AICoordinatorNarrative)

Does this level of sharding feel right, or does it create too many navigation hops for the operators you have in mind?

**OQ-UX-6 — "APPLY TO PRO FORMA" button priority?**

Once the stub is resolved (implemented or removed — see STRATEGY_MODULE_INVESTIGATION.md OQ-M8-3), what is the right visual treatment? The current amber button is prominent. If the endpoint is never implemented, remove it. If implemented, should it:
- Show a confirmation dialog (field mapping is non-trivial: priceCeiling → purchasePrice, targetHoldMonths → holdPeriod)
- Show a conflict dialog if the operator has already set those fields manually
- Auto-apply silently and show a toast confirmation
