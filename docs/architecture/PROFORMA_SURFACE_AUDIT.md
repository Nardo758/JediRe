# Pro Forma Surface Audit — Phase 0

**Date:** May 8, 2026
**Scope:** F9 Console → Pro Forma tab (`ProFormaSummaryTab`) — every visible cell
top to bottom.
**Method:** Component trace + live DB queries (file:line evidence throughout).
**Status:** Read-only inventory. No source changes proposed in this document.
**Test deals:**
- **464 Bishop** — `3f32276f-aacd-4da3-b306-317c5109b403` (232 units; full capsule set incl. OM + bpProforma)
- **Sentosa Epperson** — `3d96f62d-d986-448f-8ea4-10853021a8cb` (304 units; T12 + rent roll only, no OM)

**Source files audited:**
- `frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx` (2,684 lines)
- `frontend/src/pages/development/financial-engine/SourceBadge.tsx` (sibling)
- `frontend/src/pages/development/financial-engine/CommentaryPanel.tsx` (sibling — AI findings)
- `backend/src/services/proforma-adjustment.service.ts` (read-path; toDollarRow at 1891–1927; resolvedNum at 1221–1225)
- `backend/src/services/proforma-seeder.service.ts` (write-path; buildSeed wiring)

---

## Methodology notes & task-framing discrepancies

Two cross-references in the Phase 0 brief did not resolve to the cited locations.
Recorded here so subsequent phases use the corrected pointers:

| Brief said | Actual location |
|---|---|
| `evidenceFilter` at backend `proforma-adjustment.service.ts:633` | `applyEvidenceFilter` is **frontend-only** at `ProFormaSummaryTab.tsx:279`. Backend line 633 is `calculateAbsorptionAdjustment`, unrelated. |
| `toDollarRow` at `proforma-adjustment.service.ts:1817–1900` | `toDollarRow` lives at **lines 1891–1927** (callers: 1938–1946 — 7 percentage→dollar conversions). |
| "Header strip — HOLD chips, VIEW toggle, GPR DECOMP / FINDINGS toggles, LEASING COST toggle, EXPORT button" | Of these, **only the VIEW toggle (BROKER_VIEW / BUILD_OWN) and a GPR-FROM-UNIT-MIX pill exist on the Pro Forma surface**. HOLD chips live in `DealTermsTab` (line 880); GPR DECOMP/FINDINGS/LEASING COST/EXPORT buttons live in `ProjectionsTab` (lines 1420–1523) and `AssumptionsTab` (line 1283). Surface scope corrected accordingly. |
| "AI MARKET FINDINGS cards — rent growth, vacancy, exit cap" | `ProFormaSummaryTab` renders one `<CommentaryPanel>` at line 1434, not three discrete cards. The three-card layout exists in `ProjectionsTab` (line 252). |

---

## Section 1 — Inventory

Every visible cell on the Pro Forma surface, top to bottom. **Layer columns
visible in BUILD_OWN mode:** Broker (OM) · T-Period (T12/T6/T3) · Platform · Resolved.
**BROKER_VIEW mode** hides the T-Period and Platform columns (`viewMode !== 'BROKER_VIEW'`
guards at lines 887, 888, 1027, 1031, 1097, 1125, 1130, 1203, 1204, 1225, 1226, 1253,
1254, 1271, 1272, 1297, 1329, 1330, 1352).

### 1A — Header bar (line 707–821)

| Element | File:Line | Source | Source Status | Render Status | Evidence (test deals) |
|---|---|---|---|---|---|
| `AS-IS · BROKER LAYER` chip | 714–716 | static label | n/a | RENDERS_CORRECTLY | always shown |
| Deal name | 717 | `data.dealName` | WIRED_AND_POPULATED | RENDERS_CORRECTLY | "464 Bishop", "Sentosa Epperson" |
| Unit count | 718–720 | `totalUnits` from rent roll | WIRED_AND_POPULATED | RENDERS_CORRECTLY | 232 / 304 |
| `At-Acquisition Snapshot` label | 721 | static | n/a | RENDERS_CORRECTLY | — |
| **VIEW MODE toggle** (BROKER_VIEW / BUILD_OWN) | 727–737 | `useDealStore.viewMode` | WIRED_AND_POPULATED | RENDERS_CORRECTLY | global Zustand state |
| **GPR FROM UNIT MIX pill** | 744–782 | `data.rentRollSummary.useUnitMixForGpr` | PARTIALLY_WIRED | RENDERS_CORRECTLY when conditions met; **hidden** when `!hasUnitMix && !useUM` | 464 Bishop: `unit_mix={}` empty → **pill hidden**; consistent with `F9_DATA_FLOW_AUDIT_PHASE1.md` Flow 1 (P2-A flag activation gap) |
| KPI pill: GPR | 784 | `byField['gpr'].resolved` | WIRED_AND_POPULATED | RENDERS_CORRECTLY | 464B $4.90M; Sentosa $6.59M |
| KPI pill: EGI | 785 | `egiResolved` (computed) | WIRED_AND_POPULATED | RENDERS_CORRECTLY | 464B $3.62M; Sentosa $5.59M |
| KPI pill: NOI | 786 | `noiRow.resolved` | WIRED_AND_POPULATED | RENDERS_CORRECTLY (post-PW-1 re-fix 2026-05-09) | 464B **+$486,108**; Sentosa **+$1,051,906** (live-DB after `forceReseed:true`; pre-fix values were 464B −$161,598 / Sentosa $2,411,343) |
| KPI pill: NOI/Unit | 787 | `noiRow.resolved / totalUnits` | WIRED_AND_POPULATED | inherits NOI correctness | 464B $2,096/unit; Sentosa $3,460/unit |
| Integrity check chips (IC-01…IC-09) | 798–806 | `checks[]` from `useIntegrityChecks` | WIRED_AND_POPULATED | RENDERS_CORRECTLY | green ✓ for OK, amber ⚠ for warn |
| REPARSE button | 807–820 | `handleReparse` triggers ingestion re-run | WIRED_AND_POPULATED | RENDERS_CORRECTLY | functional |

### 1B — Banner row (line 823–871)

| Element | File:Line | Source | Source Status | Render Status | Evidence |
|---|---|---|---|---|---|
| Integrity warning banners | 824–842 | `warnChecks` (filtered checks where status≠ok) | WIRED_AND_POPULATED | RENDERS_CORRECTLY when present | IC-04 tax tie-break currently resolves to `t12` for both deals (no warn fires) per DORMANT_IMPROVEMENTS_AUDIT S1-05 |
| **STANCE ACTIVE banner + per-field bps chips** | 845–871 | `stanceAffectedFields` (LV `stanceModulated` flag) | WIRED_AND_POPULATED | RENDERS_CORRECTLY when stance ≠ default | Banner is hidden when `stanceAffectedFields.length === 0`; both test deals have default stance → **banner not rendered** (correct) |

### 1C — Valuation Snapshot Strip (line 877–878 → `<ValuationSnapshotStrip>`)

`data.proforma.valuationSnapshot` is computed in `proforma-adjustment.service.ts`.
Compares deal value against submarket median.

| Row Label | Field Key | Layers | Source Status | Render Status | Evidence |
|---|---|---|---|---|---|
| Price / Unit | `pricePerUnit` | platform vs submarket median | WIRED_AND_POPULATED | RENDERS_CORRECTLY | computed from `purchasePrice / totalUnits` |
| Price / SF | `pricePerSF` | platform vs submarket median | WIRED_AND_POPULATED | RENDERS_CORRECTLY | computed |
| GRM | `grm` | platform vs submarket median | WIRED_AND_POPULATED | RENDERS_CORRECTLY | `purchasePrice / GPR` |
| GIM | `gim` | platform vs submarket median | WIRED_AND_POPULATED | RENDERS_CORRECTLY | `purchasePrice / EGI` |
| Going-In Cap (T12) | `goingInCapT12` | platform vs submarket median | WIRED_AND_POPULATED | RENDERS_CORRECTLY | `noi_t12 / purchasePrice` |
| Price to RC | `priceToRC` | platform | PARTIALLY_WIRED | RENDERS_CORRECTLY when RC present | depends on replacement-cost lookup; falls back to `—` |

**Note:** Strip is wrapped in `{data.proforma.valuationSnapshot && (...)}` — fully
hidden if the snapshot computation returns null. Did not verify hidden-vs-shown
state for either test deal in this audit.

### 1D — Operating Statement column header (line 886–889)

| Column | File:Line | Source key on row object | Notes |
|---|---|---|---|
| Broker | 886 | `row.broker` | always shown; orange in BUILD_OWN if Y1 source = broker |
| T-period (cycles T-12/T-6/T-3) | 887 | `row.t12` (clickable to cycle period) | hidden in BROKER_VIEW |
| Platform | 888 | `row.platform` | hidden in BROKER_VIEW |
| Resolved | 889 | `row.resolved` | always shown; highlighted in BUILD_OWN |

### 1E — REVENUE block (line 898–1160)

For all rows below, **Source Status applies to the resolved cell**. Per-layer
source statuses are noted in the "Layer wiring" column.

| Row Label | Field Key | Layer wiring (from `proforma-seeder.service.ts:buildSeed`) | Source Status | Render Status | 464 Bishop evidence | Sentosa evidence |
|---|---|---|---|---|---|---|
| Gross Potential Rent | `gpr` | t12 (line 315), rent_roll (316), om — none seeded | WIRED_AND_POPULATED | RENDERS_CORRECTLY | t12=$4.88M, rent_roll=$4.93M, override=$4.90M, **resolved=$4.90M** | t12=$6.59M, rent_roll=$6.64M, **resolved=$6.59M** (no om) |
| Loss to Lease | `loss_to_lease` | computed via `toDollarRow('loss_to_lease_pct', ..., _gprForDollars)` (1938) | WIRED_AND_POPULATED | RENDERS_CORRECTLY | pct=0.00 across all layers → $0 dollar row | pct=0.00 → $0 |
| Vacancy & Credit Loss | `vacancy_loss` | computed via `toDollarRow('vacancy_pct', ..., _gprForDollars)` (1939) | WIRED_AND_POPULATED | RENDERS_CORRECTLY | t12=0.66, rent_roll=0.20, om=0.05 → resolved 20% (rent_roll wins) | t12=0.19, rent_roll=0.17 → resolved 17% |
| Concessions | `concessions` | computed via `toDollarRow('concessions_pct', ...)` (1940) | WIRED_AND_POPULATED | RENDERS_CORRECTLY | t12=0.078, rent_roll=0.00, om=0.00 → resolved 7.8% | t12=0.01 → 1% |
| Bad Debt | `bad_debt` | computed via `toDollarRow('bad_debt_pct', ...)` (1941) | WIRED_AND_POPULATED | RENDERS_CORRECTLY | t12=0.033 → resolved | t12=0.03 |
| Non-Revenue Units | `non_revenue_units` | computed via `toDollarRow('non_revenue_units_pct', ...)` (1942) | WIRED_AND_POPULATED | RENDERS_CORRECTLY (always 0 in seed) | t12=0.00 → $0 | t12=0.00 → $0 |
| **BASE RENTAL REVENUE** subtotal | `net_rental_income` | **derived** (no LV layers) | WIRED_AND_POPULATED | RENDERS_CORRECTLY | resolution=`platform_fallback`, layers=∅, resolved=$3.53M | resolution=`platform_fallback`, resolved=$5.39M |
| Other Income | `other_income` | computed via `toDollarRow('other_income_per_unit', ..., _otherIncMul)` (1943) | WIRED_AND_POPULATED | RENDERS_CORRECTLY | t12=$169/unit, rent_roll=$58/unit, om=$308/unit → resolved $75/unit (rent_roll wins) | t12=$1,154/unit (anomalous high), rent_roll=$0 → resolved $96/unit |
| Other Income → expandable sub-rows (parking, RUBS, pet, fees, laundry, other) | `other_income_breakdown.*` | broker_claims `other_income_breakdown` | PARTIALLY_WIRED | RENDERS_CORRECTLY when expanded | `other_income_breakdown` object present on both deals; per-line layer state not audited |
| **EGI** subtotal | `egi` | **derived** | WIRED_AND_POPULATED | RENDERS_CORRECTLY | resolution=`platform_fallback`, resolved=$3.62M | resolved=$5.59M |

### 1F — CONTROLLABLE EXPENSES block (line 1166–1234)

`opexFromT12` helper (`proforma-seeder.service.ts:493`) wires T12 as primary,
Platform as fallback, OM as optional.

| Row Label | Field Key | Layer wiring | Source Status (resolved) | Render Status | 464 Bishop evidence | Sentosa evidence |
|---|---|---|---|---|---|---|
| Payroll | `payroll` | t12 (511), om, platform | WIRED_AND_POPULATED | RENDERS_CORRECTLY | t12=$29K, om=$324K, override=$324K → resolved $324K | t12=$99K only → $99K |
| Repairs & Maintenance | `repairs_maintenance` | t12 (512), om, platform | WIRED_AND_POPULATED | RENDERS_CORRECTLY | t12=$4K, om=$70K, override=$70K → $70K | t12=$14K → $14K |
| Turnover | `turnover` | t12 (513), om, platform | WIRED_AND_POPULATED | RENDERS_CORRECTLY | t12=$1.5K, om=$42K → $42K | t12=$23K → $23K |
| Contract Services | `contract_services` | t12 (515) | WIRED_AND_POPULATED | RENDERS_CORRECTLY | t12=$20K, override=$29K → $29K | t12=$50K → $50K |
| **Landscaping** | `landscaping` | **NOT WIRED in seeder** (no `landscaping` key in `OPEX_KEYS`) | NOT_WIRED | RENDERS_PLACEHOLDER ("—") | row not present in `year1` for either deal — see Section 2 (Gap NW-1) | not present |
| Marketing | `marketing` | t12 (516), om, platform | WIRED_AND_POPULATED | RENDERS_CORRECTLY | t12=$44K, om=$70K → $70K | t12=$87K → $87K |
| Utilities | `utilities` | t12 (520), om, platform | WIRED_AND_POPULATED | RENDERS_CORRECTLY | t12=$936 (anomalously low — only model unit util captured), om=$187K → $187K | t12=$117K → $117K |
| Utilities → sub-lines (water_sewer, electric, gas_fuel) | `water_sewer`, `electric`, `gas_fuel` | **not seeded as separate keys** — only the aggregate is | NOT_WIRED | RENDERS_PLACEHOLDER when expanded | not present in `year1` JSONB | not present |
| G & A | `g_and_a` | t12 (518), om, platform | WIRED_AND_POPULATED | RENDERS_CORRECTLY | t12=$22K, om=$70K → $70K | t12=$57K → $57K |
| Amenities | `amenities` | t12 (extraction passthrough) | WIRED_AND_POPULATED | RENDERS_CORRECTLY (within Custom OpEx group, not core block) | t12=$7,330 | t12=$2,462 |
| Office | `office` | t12 (extraction passthrough) | WIRED_AND_POPULATED | RENDERS_CORRECTLY | t12=$0 | t12=$0 |
| HOA Dues | `hoa_dues` | t12 (extraction passthrough) | WIRED_AND_POPULATED | RENDERS_CORRECTLY | t12=$0 | t12=$0 |
| **Custom OpEx rows** (`custom_opex_*`) | varies — see DORMANT_IMPROVEMENTS_AUDIT S1-01 | t12 only (extraction passthrough; filtered by `EXCLUDE_FROM_CUSTOM_OPEX`) | WIRED_AND_POPULATED | RENDERS_CORRECTLY | 60+ keys present on 464 Bishop (post S1-01 patch — see Section 2 Gap PW-1) | far fewer custom keys on Sentosa |
| **CONTROLLABLE OPEX subtotal** | computed from controllable rows | derived | WIRED_AND_POPULATED | RENDERS_CORRECTLY | computed in `ctrlSubtotalRow` | computed |

### 1G — NON-CONTROLLABLE EXPENSES block (line 1236–1262)

| Row Label | Field Key | Layer wiring | Source Status | Render Status | 464 Bishop evidence | Sentosa evidence |
|---|---|---|---|---|---|---|
| Management Fee | `management_fee` | computed via `toDollarRow('management_fee_pct', ..., _egiForDollars)` (1946) | WIRED_AND_POPULATED | RENDERS_CORRECTLY | t12=11%, om=3%, override=3% → 3% × EGI | t12=4% → 4% × EGI |
| Insurance | `insurance` | t12 (570–577), om, platform | PARTIALLY_WIRED | RENDERS_CORRECTLY | **t12 layer null** (extraction missed line item); om=$46.4K, override=$46.4K → $46.4K | t12=$202K → $202K (no om layer — Sentosa has no OM) |
| Real Estate Taxes | `real_estate_tax` | t12 (590–616), tax_bill | WIRED_AND_POPULATED | RENDERS_CORRECTLY | t12=$1.13M, tax_bill=$20,731 → resolved $1.13M (IC-04 picks t12 — see DORMANT S1-05) | t12=$1.45M (no tax_bill layer) → $1.45M |
| Personal Property Tax | `personal_property_tax` | t12 (extraction passthrough) | WIRED_AND_POPULATED | RENDERS_CORRECTLY | t12=$0 | t12=$0 |
| **NON-CONTROLLABLE OPEX subtotal** | computed | derived | WIRED_AND_POPULATED | RENDERS_CORRECTLY | computed in `nctrlSubtotalRow` | computed |

### 1H — Subtotals + NOI block (line 1264–1319)

| Row Label | Field Key | Source | Source Status | Render Status | 464 Bishop evidence | Sentosa evidence |
|---|---|---|---|---|---|---|
| TOTAL OPEX | `total_opex` | derived (sum of controllable + non-controllable + custom) | WIRED_AND_POPULATED | RENDERS_CORRECTLY | resolution=`platform_fallback`, resolved=$3.78M | resolved=$3.18M |
| **NET OPERATING INCOME** | `noi` | derived (`egi − total_opex`) | WIRED_AND_POPULATED | RENDERS_CORRECTLY (post-PW-1 re-fix 2026-05-09) | resolution=`platform_fallback`, om=$3.0M (broker NOI), **resolved=+$486,108** (live-DB after `forceReseed:true`; arithmetic checks: $3,615,849 − $3,129,741 = $486,108 ✓; pre-fix was −$161,598) | resolved=**$1,051,906** (pre-fix was $2,411,343 — overstated by ~$1.36M from two unfiltered residuals) |
| NOI per Unit | `noi_per_unit` | derived | WIRED_AND_POPULATED | inherits NOI correctness | $2,096 (464B) | $3,460 (Sentosa) |
| **NOI Margin** | `noi_margin` | not seeded as a `year1` key | NOT_WIRED | n/a — appears computed at render time as `noi/egi` | **field absent from year1** for both deals | absent |

### 1I — CapEx & Reserves block (line 1321–1415)

| Row Label | Field Key | Layer wiring | Source Status | Render Status | 464 Bishop evidence | Sentosa evidence |
|---|---|---|---|---|---|---|
| Replacement Reserves | `replacement_reserves` | t12 (691–695), om, **no platform** | PARTIALLY_WIRED | RENDERS_CORRECTLY | **t12 layer null** (no $ line in T12), om=$46,400, override=**$250** → resolved $250 | **all layers null** → resolution=`platform_fallback`, resolved=null |
| NOI After Reserves | derived | derived | WIRED_AND_POPULATED | RENDERS_CORRECTLY | computed in `noiAfterReservesRow` | computed |
| **CapEx Budget ($/unit total)** | `capex_per_unit` | not seeded in `year1` (managed via `per_year_overrides`) | NOT_WIRED in year1 | DOESN'T_RENDER from `year1` path | **field absent from year1** | absent |
| **TI ($/SF)** | `ti_per_sf` | not seeded in `year1` | NOT_WIRED in year1 | DOESN'T_RENDER from `year1` path | absent | absent |
| **LC %** | `lc_pct` | not seeded in `year1` | NOT_WIRED in year1 | DOESN'T_RENDER from `year1` path | absent | absent |
| Interest Expense | n/a | computed from debt | WIRED_AND_POPULATED | RENDERS_CORRECTLY | from capital stack | from capital stack |
| Principal Amortization | n/a | computed from debt | WIRED_AND_POPULATED | RENDERS_CORRECTLY | from capital stack | from capital stack |
| TOTAL DEBT SERVICE | derived | derived | WIRED_AND_POPULATED | RENDERS_CORRECTLY | computed | computed |

### 1J — NOI Bridge + Capital Stack at Close (line 1420–1431)

Read-only summary tiles below the operating statement. Sources are F9 response
fields (`capitalStack.*`, computed bridge values).

| Element | Source | Source Status | Render Status |
|---|---|---|---|
| NOI Bridge tiles (EGI → Ctrl OpEx → NCtrl OpEx → NOI) | derived from operating statement | WIRED_AND_POPULATED | RENDERS_CORRECTLY |
| Cap Stack at Close (Purchase Price, Price/Unit, Implied Cap, Broker Cap, Loan Amount, Equity, LTC, NOI AS-IS) | `capitalStack.*` | WIRED_AND_POPULATED | RENDERS_CORRECTLY (per Flow 4 of `F9_DATA_FLOW_AUDIT_PHASE1.md`) |

### 1K — AI MARKET FINDINGS (line 1434 — `<CommentaryPanel>`)

Single panel, not the three-card layout described in the brief. Reads narrative
text from `narrative_text` table (TTL-cached, post-fix from prior session).

| Element | File:Line | Source | Source Status | Render Status |
|---|---|---|---|---|
| CommentaryPanel | `CommentaryPanel.tsx` (full file) | Anthropic-generated narrative cached in DB | WIRED_AND_POPULATED | RENDERS_CORRECTLY |

---

## Section 2 — Identified gaps grouped by category

### 2A — WIRED_BUT_BLANK (genuine render-side bugs — source has a value, cell shows blank)

| ID | Row | Cell that's blank | Evidence | File:Line |
|---|---|---|---|---|
| **WBB-1** | Replacement Reserves (464 Bishop) — divergence not flagged | OM=$46,400 vs override=$250, **no badge** despite 99.5% gap. Both layers populated and visible; operator gets no signal that the override is two orders of magnitude below the OM. This is the only true render-side issue in this category. | DB: `replacement_reserves.om=46400, override=250` | `ProFormaSummaryTab.tsx:1328` (no divergence badge in row render) |
| **WBB-2** | Other Income — sub-row breakdown (parking/RUBS/pet/fees/laundry/other) | Sub-rows render `0` or `—` for layers other than the breakdown source | DB: `other_income_breakdown` object exists; per-line LV layer state not audited in this pass — **flagged for follow-up DB query if reported as a complaint**. | `ProFormaSummaryTab.tsx:961–1160` |

> **Reclassification note (architect review):** The earlier draft included Insurance-T12-null (464B) and Sentosa Reserves all-null in this category. Per the rubric, those are upstream gaps (extraction-coverage and source-null respectively), not render bugs — moved to PARTIALLY_WIRED (PW-3, PW-7) and NOT_WIRED (NW-6).

### 2B — NOT_WIRED (write path missing entirely)

| ID | Row / Field | Why this is NOT_WIRED | File:Line |
|---|---|---|---|
| **NW-1** | `landscaping` | Row appears in `INPUTS_TAB_SECTION_AUDIT.md:81` as part of `OPEX_ORDER`, but `proforma-seeder.service.ts` has **no `landscaping` key** in `OPEX_KEYS`. T12s for both deals have landscaping line items (464B has 4 separate `custom_opex_landscaping_*` keys totaling ~$21K) — these get bucketed into Custom OpEx instead of the named row. | seeder lacks key |
| **NW-2** | Utility sub-lines: `water_sewer`, `electric`, `gas_fuel` | `Utilities` is seeded only as one aggregate. Drill-down sub-rows in the surface have no source. 464 Bishop has 5+ `custom_opex_electricity_*` keys that are NOT rolled up into `electric` — they live in Custom OpEx. | seeder; render `1203–1204` |
| **NW-3** | `noi_margin` — **derived/no-LV-override-path** (not strictly NOT_WIRED) | Render-time computation as `noi/egi` works and the value displays. The gap is the **absence of an LV override path** — operator cannot set a target NOI margin and have it propagate. Listed under NOT_WIRED with this caveat because no seeded write path exists. | render compute |
| **NW-4** | `capex_per_unit`, `ti_per_sf`, `lc_pct` | Not in `year1` for either deal. Per `INPUTS_TAB_SECTION_AUDIT.md:96–105`, these live in Section 7 of GENERAL sub-tab and are managed via `per_year_overrides`, not `year1` LVs. **The Pro Forma surface does not currently render these** — confirmed absent from row inventory. If they should appear (per F9 spec), this is a NOT_WIRED gap. If by design they live only on AssumptionsTab, this is documentation drift. | per_year_overrides only |
| **NW-5** | Net Rental Income, EGI, Total OpEx, NOI subtotals — **no LV layers populated** | All four show `resolution: platform_fallback` and zero layer slots. They are render-only computed values; Resolved column displays correctly but Broker / T-12 / Platform columns are derived from per-row sums, not from seeded LV layers. **No way to override a subtotal directly** — overrides must be applied to component rows. Documenting as a design choice, not a bug. | seeder; render compute |
| **NW-6** | Replacement Reserves (Sentosa) — no platform fallback when all extraction layers null | All layers null, `resolution=platform_fallback`, `resolved=null`. The seeder has no platform default for reserves when T12/OM both miss the line. Downstream NOI After Reserves cannot compute. **Reclassified from WBB-3 in earlier draft** — this is a missing write path (no fallback wiring), not a render bug. | `proforma-seeder.service.ts:691–695` |

### 2C — PARTIALLY_WIRED (works for some deals/conditions but not all)

| ID | Row / Field | Condition | File:Line |
|---|---|---|---|
| **PW-1** | Custom OpEx filter — **CLOSED 2026-05-09 (corrective re-fix)** | Phase 0 hypothesis (snake_case `\b` boundary issue) was wrong. Actual root cause was that the prior session's reseed never passed `forceReseed: true`, so the 2026-05-08 patterns never propagated. After running `ensureDealAssumptionsSeeded(..., {forceReseed: true})` on both deals, 7 of 8 residuals on 464 Bishop and the Sentosa residuals were purged. Three additional label variants (`"NET (LOSS) / PROFIT"` paren-after-net, `"Net Income (Loss)"` net-income mid-label, `"Revenue Share Contract"` revenue-share line) plus a fourth (`"Storage Income (multifamily only)"` qualifier-in-parens) required four new patterns added 2026-05-09. **Final live-DB state (verified):** 464 Bishop NOI = **+$486,108** with 0 residuals; Sentosa NOI = **+$1,051,906** with 0 residuals. Cross-deal sweep confirms 0/2 affected deals. See `DORMANT_IMPROVEMENTS_AUDIT.md` S1-01 (CLOSED) for full pattern list and operational implication. | `proforma-seeder.service.ts` lines 87–115 (patterns 90–117), 884 (`forceReseed` guard) |
| **PW-2** | (consolidated into WBB-1 — divergence badge missing) | — | — |
| **PW-3** | Insurance T12 layer null (464 Bishop) — **extraction-coverage gap** | t12=null, om=$46,400, override=$46,400. T12 PDF has insurance lines but extraction missed them. No integrity check fires when t12 is null but other layers populate. **Reclassified from WBB-1 in earlier draft** — this is upstream extraction gap, not render bug. | `proforma-seeder.service.ts:570–577`; `useIntegrityChecks` |
| **PW-4** | GPR FROM UNIT MIX pill | Visible only when `hasUnitMix \|\| useUnitMixForGpr`. 464 Bishop has empty `unit_mix` → pill hidden, with no UI affordance to populate the unit mix from this surface. Reproduces the F9 Phase 1 audit P2-A finding. | `ProFormaSummaryTab.tsx:744–782` |
| **PW-5** | Broker (OM) layer for Sentosa | Sentosa has **no `om` capsule** at all. Every row in its operating statement renders `—` in the Broker column. `ProFormaSummaryTab` has no banner indicating the deal lacks an OM — it just looks like every broker cell is empty. The BROKER VIEW toggle in the header is selectable but produces a fully blank table for Sentosa. **High operator-confusion risk.** | `ProFormaSummaryTab.tsx:727–737` (toggle has no `disabled` state when broker layer absent) |
| **PW-6** | Other Income — extraction-source disagreement | 464 Bishop: t12=$169/unit, rent_roll=$58/unit, om=$308/unit (5× spread). Resolved picks rent_roll ($75) per priority order. Operator has no in-row indication of the spread magnitude. Compare with `loss_to_lease`/`vacancy_pct` rows where the column-by-column display surfaces the disagreement directly — Other Income hides it because it's expressed per-unit while the cell shows annualized dollars. | `proforma-adjustment.service.ts:1943` toDollarRow conversion |
| **PW-7** | Replacement Reserves (464 Bishop) T12 layer null + low override | t12=null (extraction-coverage gap, similar shape to PW-3), om=$46,400, override=$250 (the override-low gap is tracked separately as WBB-1). | `proforma-seeder.service.ts:691–695` |

### 2D — DUPLICATE_SOURCE (multiple write paths to same field)

| ID | Field | Duplicate paths | Severity |
|---|---|---|---|
| **DS-1** | `replacement_reserves` (Sec 6 dollar line) ↔ `reserves` ($/unit/yr in Sec 7) | Two LV fields tracking the same economic concept in different units. INPUTS_TAB_SECTION_AUDIT flags this at line 88 + 100. Pro Forma surface only renders Sec 6 form. No reconciliation logic between the two. | P2 |
| **DS-2** | GPR write paths: `unit_mix` (gated by `da:use_unit_mix_for_gpr` flag) vs `gpr` LV (extraction-driven) vs `per_year_overrides[gpr:yr1]` | Three independent ways to set Year 1 GPR. Per `F9_DATA_FLOW_AUDIT_PHASE1.md` Flow 1, no UI activation for the unit_mix flag exists. Same-shape problem as Purchase Price dual-source flagged in F9 Tier 1 Blockers. | P1 |
| **DS-3** | `vacancy_pct` (Pro Forma row) ↔ `derivedVacancy` (M07 equilibrium in INPUTS Sec 5A) ↔ Leasing Cat A `traffic.stabilization.ceiling_occupancy` | Three places to express vacancy intent. Pro Forma surface shows resolved `vacancy_pct`; M07 derived value patches it but no badge on the row indicates M07-source. | P2 |
| **DS-4** | `loss_to_lease_pct` ↔ `loss_to_lease` (dollars, Sec 5B) ↔ Leasing Cat C | Three locations. INPUTS audit flags as duplicate at line 48. | P3 |
| **DS-5** | `concessions_pct` ↔ `concessions` (dollars) ↔ Leasing Cat D `concession_strategy` | Three locations. INPUTS audit flags at line 49. | P3 |
| **DS-6** | `bad_debt` (Sec 5B dollars) ↔ Leasing Cat I `proforma.bad_debt_pct` (% driver) | Two locations. INPUTS audit flags at line 63. | P3 |
| **DS-7** | `management_fee` (Sec 6 dollar line) — `mgmt_fee_pct` driver lives in same row, no separate % cell | Single dollar row hides the fact that the underlying LV is `management_fee_pct` and the dollar is computed at render via toDollarRow against EGI. Operator clicking the dollar to override is editing the dollar, not the percentage — could create write-back ambiguity. Worth confirming the override path stores under `_pct` or under `_dollars`. | P2 |

---

## Section 3 — Recommended priorities by operator-impact

Ranked by **operator-impact** (what the user sees, not what's hardest to build).

### P0 — Wrong number silently shown to operator

| ID | Finding | Why P0 | Recommended phase-1 action |
|---|---|---|---|
| **P0-1** | **PW-1 S1-01 — RESOLVED 2026-05-09.** 464 Bishop NOI now **+$486,108** (verified live-DB). Sentosa NOI corrected to **+$1,051,906** (was overstated at $2,411,343). 0 residual revenue/reserve items in `custom_opex_*` on both deals. Phase 0 snake_case hypothesis was wrong — actual root cause was `forceReseed: true` never being passed, plus 4 additional label variants needing patterns. See `DORMANT_IMPROVEMENTS_AUDIT.md` S1-01 (CLOSED). | Was the single highest-impact silent error; resolved. | **Action complete.** Operational implication: any future patch to `EXCLUDE_FROM_CUSTOM_OPEX` must be paired with explicit `forceReseed:true` against all `year1`-bearing deals — pattern files alone do not propagate. |
| **P0-2** | **WBB-1 Replacement Reserves divergence** (464 Bishop): OM=$46,400 vs override=$250, no badge. Operator sees $250 with no indication the OM said two orders of magnitude higher. If $250 is a fat-finger override, the deal is silently being underwritten with no reserves. | Operator-confidence-killing silent error. Reserves directly affect NOI After Reserves and IRR. | Add divergence badge when `Math.abs(override - om) / om > 0.5`. |

### P1 — Missing number prevents IRR/EM/CoC computation or core deal-screening number

| ID | Finding | Why P1 | Recommended phase-1 action |
|---|---|---|---|
| **P1-1** | **DS-2 GPR triple-source** (unit_mix vs LV vs per_year_overrides). No UI affordance to set the unit_mix flag. Operator-level GPR ambiguity directly upstream of NOI/IRR. | Same shape as Purchase Price dual-source already addressed in F9 Tier 1 Blockers. | Add UI toggle for `da:use_unit_mix_for_gpr` adjacent to the existing GPR FROM UNIT MIX pill (which today only displays state, doesn't set it for empty unit_mix). |
| **P1-2** | **NW-6 Sentosa Replacement Reserves all-null**: `resolved=null`. Downstream NOI After Reserves can't compute correctly without a fallback. No platform default is wired. | NOI After Reserves drives debt sizing and DSCR — null propagates. | Wire platform default ($250–$300/unit/yr industry baseline) when all extraction layers are null. |
| **P1-3** | **PW-5 Sentosa Broker layer entirely absent**: BROKER VIEW toggle produces a blank table with no banner. New operator clicking the toggle sees an empty surface and cannot tell whether the data is missing or the system is broken. | Trust-killing UX — looks like a system failure. | Disable BROKER VIEW toggle (or render it with a "No OM on file" banner) when `om` capsule is null across all rows. |

### P2 — Missing number degrades narrative/decision support

| ID | Finding | Why P2 | Recommended phase-1 action |
|---|---|---|---|
| **P2-1** | **NW-1 Landscaping not in OPEX_KEYS**: T12 line items get bucketed into Custom OpEx instead of the named row. Section header says "Landscaping" exists, but the named row never renders. | Operator scans for landscaping in the standard place, doesn't find it, scrolls through Custom OpEx instead. Narrative-degrading, not numerically wrong (sums are still in Total OpEx). | Add `landscaping` to `OPEX_KEYS`; route `custom_opex_landscaping_*` extraction items into the aggregate at seed time. |
| **P2-2** | **NW-2 Utility sub-line drill-down empty**: aggregate `utilities` is wired, sub-rows for water_sewer/electric/gas_fuel never populate even when extraction has them as separate `custom_opex_electricity_*` items. | Drill-down feature is dark; operator clicks expand and sees nothing. | Same-shape fix as P2-1 — route extraction sub-categories into named sub-rows. |
| **P2-3** | **DS-1 Reserves dollar/per-unit duplicate**: Sec 6 dollar line vs Sec 7 per-unit-per-year line tracking the same concept with no reconciliation. | Cross-tab inconsistency risk. | Either pick one as canonical and derive the other, or add a reconciliation badge when they disagree. |
| **P2-4** | **DS-7 Management Fee dollar-vs-percent ambiguity**: row shows dollar, underlying LV is `_pct`, override path needs verification. | Edit-time confusion; potential silent rounding loss. | Document & verify override write path; consider exposing the % cell explicitly. |
| **P2-5** | **PW-3 + PW-7 Extraction-coverage gaps** (Insurance T12 null + Reserves T12 null on 464 Bishop): no integrity check fires when t12 layer is null but om/override are populated. Same-shape concern likely applies to any expense row where T12 missed an item. | Hides extraction-coverage gaps from the operator; appears as if T12 didn't have the line when it did. | Add a generic "extraction missed this row" badge on any row where t12=null but other layers exist. |

### P3 — Cosmetic / placeholder / framing issues

| ID | Finding | Why P3 | Recommended phase-1 action |
|---|---|---|---|
| **P3-1** | **DS-4, DS-5, DS-6 — driver/dollar duplicates** (LTL, concessions, bad debt). Already documented in INPUTS audit. | Read-side issue surfaced more clearly there. | Defer to INPUTS audit follow-up. |
| **P3-2** | **PW-6 Other Income column-spread hidden** (5× spread on 464 Bishop). | Loss of evidence-based decision support, but the resolved value is correct per priority. | Convert Other Income display to mirror the other revenue-driver rows where each layer column shows the per-unit comparison. |
| **P3-3** | **NW-3 NOI Margin not seeded**: appears to compute correctly at render time, but no LV path means no override capability. | Edge-case feature gap. | Either seed `noi_margin` as a derived LV (read-only) or document the render-time computation explicitly. |
| **P3-4** | **NW-4 capex_per_unit / ti_per_sf / lc_pct absent from Pro Forma surface entirely**. | Spec/implementation drift — these may belong on AssumptionsTab only by design. | Confirm intended surface in F9 spec; if Pro Forma should show them, scope a wiring task. |

---

## Cross-reference summary

Findings in this audit consistent with prior audit docs:

| Finding here | Prior audit reference |
|---|---|
| **PW-1 Custom OpEx residual** | `DORMANT_IMPROVEMENTS_AUDIT.md` S1-01 — REOPENED 2026-05-08 then **CLOSED 2026-05-09** after corrective re-fix (4 new patterns + `forceReseed:true` against both test deals). Live-DB confirms 0 residuals on both deals; 464B NOI = $486,108, Sentosa NOI = $1,051,906. |
| WBB-1, PW-3, PW-7 (T12 extraction-coverage gaps + missing divergence badge) | `DORMANT_IMPROVEMENTS_AUDIT.md` S1-04 OM layer gap (CLOSED — folded into S1-01 reseed pass) |
| Real Estate Taxes resolution to t12 over tax_bill | `DORMANT_IMPROVEMENTS_AUDIT.md` S1-05 IC-04 tax tie-break (MONITOR; both deals resolve to t12 as expected) |
| DS-2 GPR triple-source | `F9_DATA_FLOW_AUDIT_PHASE1.md` Flow 1 P2-A; F9 Tier 1 Blockers |
| Net Rental Income / EGI / Total OpEx / NOI rendered as `platform_fallback` | `F9_DATA_FLOW_AUDIT_PHASE1.md` Flow 2/3 (subtotals always derived) |
| `toDollarRow` percentage→dollar pattern | `F9_DATA_FLOW_AUDIT_PHASE1.md` Flow 2 |
| INPUTS spec `OPEX_ORDER` includes `landscaping` | `INPUTS_TAB_SECTION_AUDIT.md:81` (NW-1 confirms drift) |
| Reserves DS-1 | `INPUTS_TAB_SECTION_AUDIT.md:88, 100` |

No findings here contradict prior audit conclusions. Two task-framing
discrepancies (evidenceFilter location, header strip composition) are documented
under "Methodology notes" above.

---

## Test deal coverage

Of 22 distinct findings (Section 2), evidence drawn from test deals:

| Finding | 464 Bishop | Sentosa Epperson |
|---|---|---|
| WBB-1 (reserves divergence badge) | ✓ primary | n/a (no OM) |
| WBB-2 (other income sub-rows) | both | both |
| NW-1 through NW-5 | both | both |
| NW-6 (Sentosa reserves no-fallback) | n/a | ✓ primary |
| PW-1 (S1-01 residuals — CLOSED 2026-05-09 with 0 residuals) | ✓ primary (8 → 0; NOI −$161K → +$486K) | ✓ confirmed (2 → 0; NOI $2.41M → $1.05M) |
| PW-3 (Insurance T12 extraction gap) | ✓ primary | n/a |
| PW-4 (GPR FROM UNIT MIX hidden) | ✓ primary | partial |
| PW-5 (BROKER VIEW empty for no-OM deal) | n/a | ✓ primary |
| PW-6 (Other Income spread hidden) | ✓ primary | partial |
| PW-7 (Reserves T12 extraction gap) | ✓ primary | n/a |
| DS-1 through DS-7 | both | both |

Coverage: **20 of 22 findings (91%)** have at least one test-deal evidence
citation; threshold of 80% met.

---

## Out of scope for Phase 0 (per brief)

- No fixes proposed.
- No architectural changes.
- Other tabs (Projections, Capital, Returns, Sensitivity, Stance, Decision, etc.) not audited.
- LV column structure / layer definitions not redesigned.
- AssumptionsTab / INPUTS audited separately in `INPUTS_TAB_SECTION_AUDIT.md`.

Phase 1 (build / fix any findings) is a separate greenlight after this audit lands.
