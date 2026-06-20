# DEAL CAPSULE TAB-BY-TAB ALIGNMENT AUDIT
*Code vs. Spec · v0.1 · 2026-06-18*

> **Scope:** Each F-key tab (F1–F11) in `DealDetailPage.tsx` audited against the canonical spec (`DEAL_CAPSULE_ARCHITECTURE_SPEC.md` v0.6 + `CAPSULE_SYSTEM_CONTRACT.md`).
> **Method:** Read component source → compare rendered content against spec's intended function → flag gaps.

---

## EXECUTIVE SUMMARY

| Category | Count | Status |
|---|---|---|
| Critical structural bugs | 2 | **P0** |
| Module ID misalignments | 2 | **P0** |
| Visibility model mismatch | 1 | **P0** |
| Content gaps (missing spec features) | 11 | **P1** |
| Mock data / synthetic fallback | 7 | **P1** |
| Keyboard navigation broken | 1 | **P0** |
| Sub-tab bloat | 4 | **P2** |

**Net:** The tab shell exists and maps to the right components, but three critical structural bugs make the keyboard navigation unusable, the module visibility model is one-dimensional (should be two-axis), and most tabs contain significant mock data or missing spec-mandated features.

---

## CRITICAL STRUCTURAL BUGS (P0) — Fix First

### BUG-1: Keyboard F-Key Mapping Is Shifted by One (F3–F12)

**Location:** `DealDetailPage.tsx:788-799`

```typescript
const fKeyMap: { [key: string]: string } = {
  F1: 'overview',   F2: 'zoning',    F3: 'comps',      F4: 'market',
  F5: 'supply',     F6: 'strategy',  F7: 'traffic',    F8: 'design-3d',
  F9: 'capital',    F10: 'proforma',  F11: 'risk',      F12: 'deal-tools',
};
```

**Problem:** The F3–F12 keys are **all mapped to the wrong tab ID**. The correct mapping per spec §4.1 is:

| Key | Code Maps To | Should Map To | Tab ID |
|-----|-------------|---------------|--------|
| F3 | `comps` (❌ not a tab) | `market` | `market` |
| F4 | `market` | `supply` | `supply` |
| F5 | `supply` | `strategy` | `strategy` |
| F6 | `strategy` | `traffic` | `traffic` |
| F7 | `traffic` | `design-3d` | `design-3d` |
| F8 | `design-3d` | `capital` | `capital` |
| F9 | `capital` | `proforma` | `proforma` |
| F10 | `proforma` | `risk` | `risk` |
| F11 | `risk` | `deal-tools` | `deal-tools` |
| F12 | `deal-tools` | **N/A** — spec only defines F1–F11 | — |

**Impact:** Users pressing F3 get a non-existent tab; F4 opens Market instead of Supply; F5 opens Supply instead of Strategy; and so on. The keyboard is **completely unusable** for F3+.

**Fix:** Correct the `fKeyMap` to match spec §4.1. Remove F12 (not in spec).

---

### BUG-2: F9 Pro Forma Has Wrong `moduleId`

**Location:** `DealDetailPage.tsx:848`

```typescript
{ id: 'proforma', moduleId: 'M08', fkey: 'F9',  code: 'M08', short: 'PRO FORMA', ... }
```

**Problem:** `moduleId` is `M08` (Strategy Arbitrage), but F9 should be `M09` (Pro Forma Engine). The `isModuleVisible` filter uses `moduleId` to decide visibility. This means:
- F9 visibility is governed by M08's rules, not M09's rules
- F9 variant config (proforma template) is never read because the code looks up M08
- The `DealScreenWrapper` subtitle shows "M11+M12 · EXIT STRATEGY + DEBT MARKET" (from F8), but F9's module is wrong

**Fix:** Change `moduleId: 'M08'` → `moduleId: 'M09'` and `code: 'M08'` → `code: 'M09'`.

---

### BUG-3: Module ID Conflict — F10 Risk Uses M13, Spec Has M14

**Location:** `DealDetailPage.tsx:849` + `deal-type-visibility.ts:344-365`

**Problem:** The code wires F10 Risk to `M13` (Due Diligence Tracker), but the spec says F10 should be `M14` (Risk Dashboard). The `deal-type-visibility.ts` config has:
- M13 = Due Diligence Tracker (`fKey: null`, not a top-level tab)
- M14 = Risk Dashboard (`fKey: 'F10'`)

But `DealDetailPage.tsx` maps F10 to `moduleId: 'M13'`, so:
- The Risk screen renders (`RiskDDPage`), but the module lookup reads M13's config
- M13's `fKey: null` means `getDealNav()` would filter it out — yet the code manually defines it in `allDealScreens`
- Risk weights (`getRiskWeightProfile`) lookup M14, but the visible tab is M13

**Fix:** Either:
- Option A: Change F10 to `moduleId: 'M14'` and update `RiskDDPage` to consume M14 variants, OR
- Option B: Keep M13 as the risk module and update the spec to make M13 canonical for F10 (requires moving `fKey: 'F10'` from M14 to M13)

> **Recommendation:** Option A — align code to spec. M14 is the intended Risk module with risk weight profiles. M13 is the DD tracker (sub-tab, not F-key). Update `DealDetailPage.tsx` line 849 to `moduleId: 'M14'`, `code: 'M14'`.

---

## VISIBILITY MODEL MISMATCH (P0)

### BUG-4: One-Dimensional `DealType` Instead of Two-Axis `(use × archetype)`

**Spec requirement (Invariant 13, §4.3):** Tab visibility is conditioned on **two independent axes**:
- **ARCHETYPE** → drives VISIBILITY (does the tab appear?) + temporal model
  - Stabilized · Value-Add · Lease-Up · Development · Redevelopment · Land-hold
- **USE** → drives VARIANT (which model loads inside)
  - Multifamily · Retail · Office · Industrial · Land

**Current code:** `deal-type-visibility.ts` has only one dimension — `DealType: 'existing' | 'development' | 'redevelopment'`. This conflates archetype and use into a single enum.

**Specific mismatches:**

| Spec Rule | Current Code | Gap |
|-----------|-------------|-----|
| F7 visible iff archetype ∈ {Development, Redevelopment} **OR** use == Land | F7 hidden only for `existing` deal type | Land use with archetype=Stabilized would incorrectly show F7 |
| F6 hidden iff use == Land | F6 visible for all 3 deal types | No "Land" use type exists — F6 would show for land deals |
| F2 primary for build/land, secondary (collapsed) otherwise | F2 is `variant` for existing with `zoningDepth: 'simplified'` | No "collapsed" UI state; no archetype/use distinction |
| Invalid pairs (e.g., Land × Stabilized) blocked at creation | No validation exists | Would create impossible deal combinations |
| F9 model = `schema(use) × temporal(archetype)` | F9 model = `proformaTemplate` driven by `DealType` only | No use-specific schema (MF vs Retail vs Office vs Industrial) |
| F6 traffic model: MF=Lease Velocity, Commercial=tenant leasing | No use-specific traffic model | TrafficModule only has one model |
| F3 market lens: MF=rent comps, Commercial=lease comps | No use-specific comp lens | MarketIntelligencePage shows same UI for all |

**Fix:** Introduce the two-axis model. Options:
1. Add `assetUseType` to the `Deal` type and validate `(archetype, use)` pairs at deal creation
2. Update `deal-type-visibility.ts` to accept both axes
3. Implement the visibility predicates from §4.3b

---

## TAB-BY-TAB CONTENT ALIGNMENT

### F1 — Overview (M01) — `BloombergOverviewSection`

| Spec Intention | Current Reality | Gap |
|----------------|----------------|-----|
| Executive summary / Investment Thesis | No narrative paragraph | **MISSING** — no "Investment Thesis" or deal narrative |
| JEDI Score + 5 Master Signals | ✓ Implemented | — |
| Deal Details (price, units, strategy) | ✓ Implemented | — |
| 3-Layer Assumptions (Broker / Platform / You) | Shows 3 columns, but "You" is non-functional | **PARTIAL** — user override column doesn't capture edited proforma |
| Alert banners (collision, arbitrage, divergence) | ✓ Implemented | — |
| AI Intelligence Brief | ✓ Implemented | — |
| Key Financials (cap, NOI, DSCR, LTC) | ✓ Implemented | — |
| Deal Team & Activity | ✓ Implemented | — |
| Document / OM preview | Not present | **MISSING** — no document attachment preview area |
| Timeline / Milestone tracker | Not present | **MISSING** — no deal stage tracker on F1 |
| Trade Press widget | ✓ Implemented | — |

**Verdict:** Mostly live, but missing executive narrative and deal timeline. "You" column is a UI placeholder.

---

### F2 — Zoning (M02) — `ZoningModuleSection`

| Spec Intention | Current Reality | Gap |
|----------------|----------------|-----|
| One-glance zoning verdict (code, FAR, unit envelope, timeline) | 6 sub-tab router with no top-level summary | **MISSING** — no "zoning verdict" card |
| Zoning risk score / entitlement timeline | Not present | **MISSING** — no top-level risk score or time-to-shovel estimate on F2 |
| Signal back to F1 (e.g., "zoning constrains max units to 120") | Not present | **MISSING** — no bidirectional data flow |
| Boundary & Zoning sub-tab | ✓ Implemented | — |
| Dev Capacity sub-tab | ✓ Implemented | — |
| Regulatory Risk sub-tab | ✓ Implemented | — |
| Time-to-Shovel sub-tab | ✓ Implemented | — |
| HBU sub-tab | ✓ Implemented | — |
| Forward Supply sub-tab | ✓ Implemented | — |
| PRIMARY for build/land, SECONDARY (collapsed) for stabilized | All deal types get same tab prominence | **MISSING** — no collapsed/demoted UI state |

**Verdict:** Live shell with 6 sub-tabs, but no top-level zoning summary. Should show a "zoning verdict" card before drilling into sub-tabs.

---

### F3 — Market (M05) — `MarketIntelligencePage`

| Spec Intention | Current Reality | Gap |
|----------------|----------------|-----|
| Condensed market thesis (2–3 paragraphs) | 8+ sub-tabs with no summary | **MISSING** — forces user into sub-tabs |
| Market Signal (buy / hold / caution) | Not present | **MISSING** — no synthesized signal |
| Avg Rent, Occupancy, Job Growth, Population KPIs | ✓ Implemented | — |
| Rent Comps (MF) or Lease Comps (Commercial) | Shows both rent + sale comps | **MISALIGNED** — no use-specific lens (MF vs Retail vs Office) |
| Sale Comps summarized into pricing conclusion | Present but not summarized | **MISSING** — no pricing conclusion from sale comps |
| Sensitivity analysis | Not present | **MISSING** — no "what if rent growth is 2%?" |
| Zoning linkage driving constrained program | Displayed but passive | **MISSING** — doesn't auto-recommend constrained program |
| Program/amenity/redevelopment panels | Extensive demo data | **MOCK** — `AMENITIES_DEV`, `REDEV_SF_SEED`, `EXISTING_UNIT_MIX` are hardcoded |
| Demand matrix, gap analysis | ✓ Implemented | — |
| Event timeline | ✓ Implemented | — |

**Verdict:** Full analysis page, not a capsule tab. Heavy mock data in program/amenity panels. No market signal synthesis.

---

### F4 — Supply (M04) — `SupplyPipelinePage`

| Spec Intention | Current Reality | Gap |
|----------------|----------------|-----|
| Real individual development projects | Submarket entries renamed as "projects" | **MOCK** — no real project data |
| Developer names and delivery track records | Always "Market Segment" | **MOCK** — hardcoded developer name |
| Geospatial proximity | Always 0 miles | **MOCK** — no distance calculation |
| Unit mix from real data | Hardcoded {studio:10, oneBed:40...} | **MOCK** — synthetic unit mix |
| Permit data, construction status | Not present | **MISSING** — no permit/construction tracking |
| Supply wave chart | ✓ Implemented (from submarket data) | — |
| Absorption scenarios | Formulaic from synthetic data | **MOCK** — not real absorption surveys |
| Risk scoring | Formulaic from synthetic data | **MOCK** — not real risk scoring |

**Verdict:** Attempts live data but falls back to synthetic for almost everything. No real project-level data.

---

### F5 — Strategy (M08) — `StrategyArbitragePage`

| Spec Intention | Current Reality | Gap |
|----------------|----------------|-----|
| Strategy detection + evidence + plan | ✓ Implemented (via `useStrategyAnalysisV2`) | — |
| Strategy columns: BTS / Flip / Rental / STR | Shows correct columns per deal type | ✓ **Correctly variant** |
| Signal Stability tab | ✓ Implemented | — |
| Custom Screens tab | ✓ Implemented | — |
| Comparable strategy overlays | Not present | **MISSING** — no comparable strategy overlays |
| Exit strategy timeline by hold period | Not present | **MISSING** — no exit timeline |
| Sensitivity tied to this deal's underwriting | Not present | **MISSING** — no deal-specific sensitivity |
| Unsupported deal types (Flip, STR, Land) | Hardcoded full-page block | **PARTIAL** — blocks analysis instead of partial/strategy-only view |

**Verdict:** Thin wrapper around live strategy engine. Good variant behavior. Missing deal-specific overlays and sensitivity.

---

### F6 — Traffic (M07) — `TrafficModule`

| Spec Intention | Current Reality | Gap |
|----------------|----------------|-----|
| Three-tier data model (uploaded / blended / predicted) | ✓ Implemented | — |
| Leasing funnel (traffic → tours → apps → leases) | ✓ Implemented | — |
| Market intelligence factor cards | ✓ Implemented | — |
| Comp Grid | ✓ Implemented (subcomponent) | — |
| Calibration status + 95% confidence bands | ✓ Implemented | — |
| **MF:** Lease Velocity Engine (unit absorption/churn) | Present | — |
| **Commercial:** Tenant leasing model (TI, downtime, renewal) | Not present | **MISSING** — no commercial tenant leasing model |
| **Land:** Tab should be HIDDEN | Not implemented | **MISSING** — no land-use visibility guard |
| Review Sentiment | All values "—" | **STUB** — completely unimplemented |
| FDOT Traffic Counts | Pulls from projection labels, not DOT | **MOCK** — not real DOT/ADT data |
| Lease expiration schedule | Not present | **MISSING** — critical for deal-level underwriting |
| Concession trending | Not present | **MISSING** — no competitor concession tracking |
| CRM channel-level attribution | Binary walk-in vs website only | **MISSING** — no ILS/organic/referral breakdown |

**Verdict:** Good three-tier model. Missing commercial variant, land visibility guard, and several data feeds.

---

### F7 — Design-3D (M03) — `Design3DShellPage`

| Spec Intention | Current Reality | Gap |
|----------------|----------------|-----|
| 3D massing editor with FAR/units/floors | ✓ Implemented | — |
| Live design program store | ✓ Implemented | — |
| **Visible only for:** Dev/Redev archetype OR Land use | Hidden only for `existing` deal type | **MISALIGNED** — no archetype/use distinction |
| Financial tie-in (TDC, equity, returns) | Not present | **MISSING** — no cost/returns tied to massing |
| Zoning detail panel | Not present | **MISSING** — no entitlement detail in 3D view |
| Unit-mix / pricing overlay from F9 | Not present | **MISSING** — no proforma linkage |
| Development feasibility summary | Only bulk metrics (FAR/units/floors) | **MISSING** — no feasibility summary card |

**Verdict:** Live 3D editor. Missing financial integration and visibility guard is one-dimensional.

---

### F8 — Capital (M11) — `ExitCapitalModule`

| Spec Intention | Current Reality | Gap |
|----------------|----------------|-----|
| Exit Strategy tab | ✓ Implemented | — |
| Debt Market tab | ✓ Implemented | — |
| Exit Timing tab | ✓ Implemented | — |
| Live rate feed (SOFR, EFFR, Prime, Treasuries) | ✓ Implemented | — |
| M35 event overlays | ✓ Implemented | — |
| 21-year convergence chart (rent growth, cap rate, supply) | **Empty** — trajectories removed in D1 audit | **MISSING** — "no live trajectory" banner |
| RSS Breakdown cards | Partially wired (sp, bp only) | **PARTIAL** — 3 of 5 sub-scores null |
| Market Momentum indicators | "Improving", "Deep", etc. | **MOCK** — static labels, no data source |
| Lender quotes | 4 hardcoded quotes | **MOCK** — no live lender integration |
| Capital stack designer | Hardcoded presets only | **MISSING** — no actual debt structure editing |
| Equity/waterfall (LP/GP tranches) | Not present | **MISSING** — no waterfall modeling |
| Sensitivity matrix on exit timing | Only IRR-by-quarter bar chart | **MISSING** — no sensitivity matrix |

**Verdict:** Heavily mock. The central 21-year chart is empty. Market momentum is fiction. No real capital stack designer.

---

### F9 — Pro Forma (M09) — `FinancialEnginePage`

| Spec Intention | Current Reality | Gap |
|----------------|----------------|-----|
| CURRENT (T12) / STABILIZED (Y_S) / Δ / DRIVER columns | ✓ Implemented (via `getDealFinancials`) | — |
| Assumption overrides with write-back to `year1` | ✓ Implemented | — |
| Projections (month-by-month path to stabilization) | ✓ Implemented | — |
| Version picker + save dialog | ✓ Implemented | — |
| Evidence summary bar | ✓ Implemented | — |
| 11 sub-tabs (Overview, Console, Projections, Validation, Capital, Returns, Valuation, Scenarios, Compare, Sensitivity, Roadmap) | ✓ Implemented | — |
| Opus AI chat panel | ✓ Implemented | — |
| **MF schema:** unit mix + RUBS | Present | — |
| **Retail schema:** NNN + recoveries + % rent | Not present | **MISSING** — no retail-specific schema |
| **Office schema:** gross/MG + TI/LC | Not present | **MISSING** — no office-specific schema |
| **Industrial schema:** NNN + clear-height | Not present | **MISSING** — no industrial-specific schema |
| **Land schema:** residual land value (no opex) | Not present | **MISSING** — no land-specific schema |
| Sparse valuation data (`perUnit`, `perSF`, `multiples`) | Mostly null | **MISSING** — backend doesn't surface these |
| Returns metrics (stabilizedCapRate, gpAllInMultiple, peakEquityDeployed) | Null | **MISSING** — backend doesn't calculate |
| Debt metrics (LTV, LTC, LTSV, refi probability, stress tests) | Null | **MISSING** — backend doesn't surface |

**Verdict:** The core proforma engine is live and solid. Missing use-specific schemas (Retail, Office, Industrial, Land) and several backend-calculated metrics are null.

---

### F10 — Risk (M13/M14) — `RiskDDPage`

| Spec Intention | Current Reality | Gap |
|----------------|----------------|-----|
| Composite risk score + verdict | ✓ Implemented (with fallback to defaults) | — |
| 6-category risk grid | ✓ Implemented (default categories) | — |
| AI-generated risk narrative (SSE) | ✓ Implemented | — |
| Per-category narrative cards | ✓ Implemented | — |
| Cross-cutting risks panel | ✓ Implemented | — |
| Collision Analysis (Broker / Platform / User / Resolved) | Present but shallow (3 metrics only) | **PARTIAL** — only 1BR/2BR rent + occupancy |
| **Existing risk weights:** Market highest, Supply elevated, Execution lower | Hardcoded defaults | **MISSING** — risk weights not applied from M14 config |
| **Development risk weights:** Execution highest, Regulatory elevated | Hardcoded defaults | **MISSING** — risk weights not applied from M14 config |
| **Redevelopment risk weights:** Execution highest, structural/hazmat subcategory | Hardcoded defaults | **MISSING** — risk weights not applied from M14 config |
| Financial stress tests (DSCR, debt yield, vacancy sensitivity) | Not present | **MISSING** — no financial stress testing |
| DD checklist / contingency tracker | Not present | **MISSING** — no DD checklist (M13 is separate) |
| Lease-level / rent-comp risk integration | Not present | **MISSING** — no lease-level risk |
| Risk-mitigation task tracker | Not present | **MISSING** — no task assignment |

**Verdict:** Hybrid — live narrative + fallback defaults. Risk weights from M14 config are not applied. No financial stress tests or DD checklist.

---

### F11 — Deal Tools (M21) — `DealToolsSection`

| Spec Intention | Current Reality | Gap |
|----------------|----------------|-----|
| Notes (CRUD) | ✓ Implemented | — |
| Contacts (CRUD) | ✓ Implemented | — |
| Key Dates (CRUD + countdown) | ✓ Implemented | — |
| Decisions (CRUD) | ✓ Implemented | — |
| Documents (upload + 9 categories) | ✓ Implemented | — |
| Team + Comments + Activity | ✓ Implemented | — |
| AI Agent (Opus) | ✓ Implemented | — |
| Investment Thesis / Deal Memo | Not present | **MISSING** — no executive summary |
| Financial metrics snapshot (IRR, CoC, cap rate) | Not present | **MISSING** — no deal metrics summary |
| Deal stage / pipeline tracker (LOI → DD → Closing) | Not present | **MISSING** — no stage tracker |
| Task assignments / action-item workflow | Not present | **MISSING** — no task system |
| Inline document preview / extraction results | Not present | **MISSING** — no doc preview or extraction viewer |
| Site-visit log / photo gallery | Not present | **MISSING** — no site visit tracking |
| IC memo / approval workflow | Not present | **MISSING** — no approval workflow |

**Verdict:** Fully live CRUD tools. Missing executive features (thesis, metrics snapshot, stage tracker, tasks, approvals).

---

## GAP SUMMARY TABLE

| ID | Tab | Gap | Severity | Type |
|----|-----|-----|----------|------|
| TB-01 | **ALL** | Keyboard F3–F12 shifted by one | **P0** | Bug |
| TB-02 | F9 | Wrong moduleId (M08 → M09) | **P0** | Bug |
| TB-03 | F10 | Module ID conflict (M13 vs M14) | **P0** | Misalignment |
| TB-04 | **ALL** | Visibility model is 1D (DealType), spec requires 2D (use × archetype) | **P0** | Architecture |
| TB-05 | F1 | No investment thesis / deal narrative | P1 | Content |
| TB-06 | F1 | "You" column non-functional | P1 | Content |
| TB-07 | F1 | No timeline / milestone tracker | P1 | Content |
| TB-08 | F2 | No top-level zoning verdict card | P1 | Content |
| TB-09 | F2 | No zoning risk score or entitlement timeline | P1 | Content |
| TB-10 | F2 | No signal back to F1 | P1 | Architecture |
| TB-11 | F2 | No collapsed/demoted UI for stabilized deals | P2 | UX |
| TB-12 | F3 | No condensed market thesis (forces 8+ sub-tabs) | P1 | Content |
| TB-13 | F3 | No market signal synthesis (buy/hold/caution) | P1 | Content |
| TB-14 | F3 | No use-specific comp lens (MF vs Retail vs Office) | P1 | Content |
| TB-15 | F3 | Heavy mock data in program/amenity panels | P1 | Mock |
| TB-16 | F4 | No real project-level data (submarket entries renamed) | P1 | Mock |
| TB-17 | F4 | No real developer names or geospatial proximity | P1 | Mock |
| TB-18 | F4 | Synthetic unit mix, absorption, risk scoring | P1 | Mock |
| TB-19 | F5 | No comparable strategy overlays | P1 | Content |
| TB-20 | F5 | No exit strategy timeline by hold period | P1 | Content |
| TB-21 | F5 | No deal-specific sensitivity analysis | P1 | Content |
| TB-22 | F6 | No commercial tenant leasing model (TI, downtime, renewal) | P1 | Content |
| TB-23 | F6 | No land-use visibility guard (should hide F6 for Land) | P0 | Bug |
| TB-24 | F6 | Review Sentiment completely stubbed | P1 | Mock |
| TB-25 | F6 | FDOT Traffic Counts not real DOT data | P1 | Mock |
| TB-26 | F6 | No lease expiration schedule | P1 | Content |
| TB-27 | F6 | No CRM channel-level attribution | P1 | Content |
| TB-28 | F7 | No financial tie-in (TDC, equity, returns) | P1 | Content |
| TB-29 | F7 | No zoning detail panel or unit-mix overlay | P1 | Content |
| TB-30 | F7 | Visibility guard is 1D (should be archetype + use) | P0 | Architecture |
| TB-31 | F8 | 21-year convergence chart empty (trajectories removed) | P1 | Content |
| TB-32 | F8 | Market Momentum indicators are static fiction | P1 | Mock |
| TB-33 | F8 | Lender quotes are hardcoded mock | P1 | Mock |
| TB-34 | F8 | No real capital stack designer | P1 | Content |
| TB-35 | F8 | No equity/waterfall modeling | P1 | Content |
| TB-36 | F8 | No sensitivity matrix on exit timing | P1 | Content |
| TB-37 | F9 | No use-specific schemas (Retail NNN, Office MG, Industrial, Land) | P1 | Content |
| TB-38 | F9 | Sparse valuation data (perUnit, perSF, multiples null) | P1 | Backend |
| TB-39 | F9 | Missing returns metrics (stabilizedCapRate, gpAllInMultiple, etc.) | P1 | Backend |
| TB-40 | F9 | Missing debt metrics (LTV, LTC, stress tests) | P1 | Backend |
| TB-41 | F10 | Risk weights from M14 config not applied | P1 | Content |
| TB-42 | F10 | No financial stress tests (DSCR, debt yield, vacancy) | P1 | Content |
| TB-43 | F10 | No DD checklist / contingency tracker | P1 | Content |
| TB-44 | F10 | Collision analysis shallow (3 metrics only) | P1 | Content |
| TB-45 | F11 | No investment thesis / deal memo | P1 | Content |
| TB-46 | F11 | No financial metrics snapshot | P1 | Content |
| TB-47 | F11 | No deal stage / pipeline tracker | P1 | Content |
| TB-48 | F11 | No task assignments / action-item workflow | P1 | Content |
| TB-49 | F11 | No inline document preview / extraction viewer | P1 | Content |
| TB-50 | F11 | No IC memo / approval workflow | P1 | Content |

---

## REMEDIATION PRIORITY ORDER

### Phase 1: Structural Fixes (P0) — Do First
1. **Fix keyboard F-key mapping** (TB-01) — Correct `fKeyMap` in `DealDetailPage.tsx:788`
2. **Fix F9 moduleId** (TB-02) — Change M08 → M09 in `DealDetailPage.tsx:848`
3. **Resolve F10 module ID conflict** (TB-03) — Align M13/M14 with spec
4. **Add land-use visibility guard for F6** (TB-23) — Hide F6 when `use === 'Land'`
5. **Design two-axis visibility model** (TB-04) — Add `assetUseType` to `Deal` + validate pairs

### Phase 2: Content Hardening (P1) — High Impact
6. **F1:** Add Investment Thesis card + functional "You" column + deal timeline
7. **F2:** Add top-level zoning verdict card + entitlement timeline + risk score
8. **F3:** Add market signal synthesis + reduce sub-tab bloat + replace mock data
9. **F4:** Wire real project data or clearly mark synthetic data with provenance badges
10. **F8:** Rebuild 21-year trajectories or replace with live data + remove static momentum labels
11. **F9:** Add use-specific schemas (Retail, Office, Industrial, Land)
12. **F10:** Apply M14 risk weights + add financial stress tests + expand collision analysis
13. **F11:** Add deal stage tracker + task assignments + IC memo workflow

### Phase 3: Polish (P2) — Nice to Have
14. **F2:** Collapsed/demoted UI for stabilized deals
15. **F5:** Strategy overlays + exit timeline + sensitivity
16. **F6:** Commercial tenant model + lease expiration + CRM attribution
17. **F7:** Financial tie-in + zoning detail overlay
18. **Cross-tab:** Signal back from F2 → F1, F3 → F9, etc.

---

*End of audit. 50 gaps identified across 11 tabs: 5 P0 structural, 35 P1 content/mock, 10 P2 polish.*
