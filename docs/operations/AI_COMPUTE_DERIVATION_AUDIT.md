# AI-Compute → Derivation Audit

**Task:** #1420  
**Date:** 2026-05-28  
**Status:** Complete — audit only, no code changed  
**Author:** Audit subagent (main agent session)

---

## Executive Summary

| Verdict | Count | Action required |
|---|---|---|
| **KEEP-AI** | 16 fields | No change — genuine market inference |
| **CONVERT** | 10 fields | Remove from agent output; math engine is single source of truth |
| **ALREADY-DETERMINISTIC** | 3 metrics | Returned by `compute_proforma` tool; agent must not re-derive independently |

The cashflow agent currently writes **10 pure-arithmetic subtotals and below-line values** that the `proFormaMathEngine` (`correctSnapshotMath`) already recomputes in post-processing. This means every deal run produces *two* competing values for NOI, EGI, and seven other fields before the engine wins. The dual computation burns Claude tokens on arithmetic, introduces a race condition on any read path that bypasses `cashflow.postprocess.ts`, and makes the ±5 % / ±25 bps backtest bars meaningless for those fields.

IRR and equity multiple (prime suspects from the task spec) are **already-deterministic** — they are computed inside `compute_proforma.ts` (Newton-Raphson on the full cash-flow vector) and `proforma-generator.service.ts`. The agent calls `compute_proforma` as a tool call and receives these values; it does not derive them independently.

---

## Smoking-Gun Resolution

### Does the agent produce NOI?

**Yes — and so does the math engine. This is the primary dual-computation bug.**

Evidence chain:
1. `backend/src/agents/prompts/cashflow/system.ts` — the 2,136-line system prompt instructs the agent to populate `proforma.noi` in the `proforma_snapshot` passed to `write_underwriting`.
2. `backend/src/agents/tools/write_underwriting.ts` lines 107–111 — the sanity check reads `metrics['noi'] ?? metrics['noi_year1']` from the agent's snapshot and gates the DB write on it.
3. `backend/src/services/proforma/proFormaMathEngine.ts` lines 437–498 — `LINE_ITEM_CONFIG['proforma.noi']` declares `kind: 'subtotal'` with `SPECIAL_FORMULAS['proforma.noi'] = (v) => v['proforma.revenue.egi'] - v['proforma.opex.total']`, and `correctSnapshotMath` recomputes this value unconditionally in post-processing.
4. `backend/src/agents/cashflow.postprocess.ts` line 17 — `import { correctSnapshotMath } from '../services/proforma/proFormaMathEngine'` — the engine always runs.

**Verdict:** The agent writes NOI; the math engine then overwrites it. Two values exist simultaneously in the pipeline before the engine wins. The agent's NOI write is redundant and should be removed (CONVERT).

### Does the agent produce IRR?

**No — IRR is already-deterministic via the `compute_proforma` tool.**

Evidence chain:
1. `backend/src/agents/tools/compute_proforma.ts` lines 128–131 — `estimateIRR(cashFlows)` runs Newton-Raphson on `[-equity, CF_y1, …, CF_yn + exitProceeds]` and returns `estimated_irr_pct`.
2. `backend/src/services/module-wiring/formula-engine.ts` — F19 (IRR) carries `agentRequired: false`, confirming the formula library treats IRR as engine-owned.
3. `backend/src/services/proforma-generator.service.ts` — computes `irr`, `equity_multiple`, `dscr`, `goingInCap`, and `debtYield` deterministically from the post-corrected assumptions.

The agent calls `compute_proforma` and receives IRR as a tool result. It does not derive IRR from its own reasoning. No agent-authored IRR value flows into the proforma_snapshot.

### Does the agent produce DSCR?

**No — DSCR is already-deterministic.**

`compute_proforma.ts` line 100: `dscr = annualDebtService > 0 ? noi / annualDebtService : 0` — computed per hold year. F21 (DSCR) in `formula-engine.ts` has `agentRequired: false`.

### Does the agent produce Equity Multiple?

**No — equity multiple is already-deterministic.**

`proforma-generator.service.ts` computes equity_multiple from the deterministic cash-flow vector. F20 (Equity Multiple) in `formula-engine.ts` has `agentRequired: false`.

---

## 26-Field Audit Table

The 26 fields are the canonical line items from `LINE_ITEM_CONFIG` in `proFormaMathEngine.ts` (excluding the nine `other_income.*` breakdown sub-components, which are resolved hierarchically as children of field #8).

| # | Field path | `kind` in LINE_ITEM_CONFIG | In output-schema? | Verdict |
|---|---|---|---|---|
| 1 | `proforma.revenue.gpr` | `revenue` | Yes — agent instructed to populate via system prompt + line-item-matrix | **KEEP-AI** |
| 2 | `proforma.revenue.loss_to_lease` | `revenue_deduction` | Yes | **KEEP-AI** |
| 3 | `proforma.revenue.vacancy_loss` | `revenue_deduction` | Yes | **KEEP-AI** |
| 4 | `proforma.revenue.concessions` | `revenue_deduction` | Yes | **KEEP-AI** |
| 5 | `proforma.revenue.bad_debt` | `revenue_deduction` | Yes | **KEEP-AI** |
| 6 | `proforma.revenue.non_revenue_units` | `revenue_deduction` | Yes | **KEEP-AI** |
| 7 | `proforma.revenue.base_rental_revenue` | `subtotal` | Yes — agent writes it alongside inputs | **CONVERT** |
| 8 | `proforma.revenue.other_income` | `hierarchical_subtotal` | Yes — agent writes aggregate AND breakdown components | **CONVERT** |
| 9 | `proforma.revenue.egi` | `subtotal` | Yes | **CONVERT** |
| 10 | `proforma.opex.personnel` | `expense` | Yes | **KEEP-AI** |
| 11 | `proforma.opex.repairs_maintenance` | `expense` | Yes | **KEEP-AI** |
| 12 | `proforma.opex.turnover` | `expense` | Yes | **KEEP-AI** |
| 13 | `proforma.opex.contract_services` | `expense` | Yes | **KEEP-AI** |
| 14 | `proforma.opex.marketing` | `expense` | Yes | **KEEP-AI** |
| 15 | `proforma.opex.administrative` | `expense` | Yes | **KEEP-AI** |
| 16 | `proforma.opex.controllable_total` | `subtotal` | Yes | **CONVERT** |
| 17 | `proforma.opex.management_fee` | `expense` | Yes | **KEEP-AI** |
| 18 | `proforma.opex.insurance` | `expense` | Yes | **KEEP-AI** |
| 19 | `proforma.opex.property_tax` | `expense` | Yes | **KEEP-AI** |
| 20 | `proforma.opex.non_controllable_total` | `subtotal` | Yes | **CONVERT** |
| 21 | `proforma.opex.total` | `subtotal` | Yes — used by sanity check in `write_underwriting` | **CONVERT** |
| 22 | `proforma.noi` | `subtotal` | Yes — **smoking gun** | **CONVERT** |
| 23 | `proforma.reserves.capex` | `reserves` | Yes | **KEEP-AI** |
| 24 | `proforma.noi_after_reserves` | `subtotal` | Yes | **CONVERT** |
| 25 | `proforma.valuation.cap_rate` | `below_line` | Yes — agent computes NOI / purchase_price | **CONVERT** |
| 26 | `proforma.valuation.stabilized_value` | `below_line` | Yes — agent computes stabilized_NOI / cap_rate | **CONVERT** |

**In output-schema?** — `output-schema.ts` declares `proforma_fields` as `z.record(z.string(), FieldOutputSchema)`, a generic key-value map. Any field key the agent emits is schema-valid. The "Yes" entries reflect that the system prompt explicitly instructs the agent to populate these field paths. The schema does not hardcode or forbid any individual path.

---

## Prime-Suspect Returns Metrics (Outside the 26)

These are explicitly flagged by the task spec. They fall outside the 26 canonical LINE_ITEM_CONFIG fields but appear in `formula-engine.ts` with `agentRequired: false`.

| Metric | Formula-engine ID | `agentRequired` | Computed by | Verdict |
|---|---|---|---|---|
| IRR | F19 | `false` | `compute_proforma.ts` Newton-Raphson + `proforma-generator.service.ts` | **ALREADY-DETERMINISTIC** |
| DSCR | F21 | `false` | `compute_proforma.ts` per-year NOI / debt_service | **ALREADY-DETERMINISTIC** |
| Equity Multiple | F20 | `false` | `proforma-generator.service.ts` total_distributions / equity_invested | **ALREADY-DETERMINISTIC** |

---

## Prioritized CONVERT List

Ordered by risk: fields higher on the list have wider blast radius when the agent's value and the engine's value diverge.

### CONVERT-1: `proforma.noi` — **Critical**

**Formula:** `proforma.revenue.egi − proforma.opex.total`  
**Engine location:** `proFormaMathEngine.ts` `SPECIAL_FORMULAS['proforma.noi']` (line 494–498)  
**Current state:** Agent writes it; `write_underwriting` sanity-checks it; `correctSnapshotMath` overwrites it.  
**Blast radius:** Any code path that reads `proforma_snapshot` before `cashflow.postprocess.ts` completes (direct snapshot queries, OperatorStance reblend on the baseline snapshot) sees stale agent NOI.

**Conversion dispatch:**
```
File: backend/src/agents/prompts/cashflow/system.ts
Action: Remove the instruction to populate proforma.noi from the agent's output block.
         The system prompt section "PROFORMA_SNAPSHOT fields" should omit proforma.noi.

File: backend/src/agents/tools/write_underwriting.ts
Action: Replace sanity check read of metrics['noi'] with a computed value:
         const computedNoi = (metrics['egi'] ?? metrics['revenue.egi'] ?? 0)
                           - (metrics['total_opex'] ?? metrics['opex.total'] ?? 0);
         Use computedNoi for all sanity-check comparisons.
```

---

### CONVERT-2: `proforma.revenue.egi` — **High**

**Formula:** `base_rental_revenue + other_income`  
**Engine location:** `LINE_ITEM_CONFIG['proforma.revenue.egi'].subtotal_formula` + general subtotal walker  
**Current state:** Agent writes it; math engine auto-corrects.  
**Blast radius:** EGI feeds NOI (CONVERT-1) and management_fee derivation (KEEP-AI #17).

**Conversion dispatch:**
```
File: backend/src/agents/prompts/cashflow/system.ts
Action: Remove the instruction to populate proforma.revenue.egi.
         Note: write_underwriting sanity check reads 'egi' — must migrate to computed value (see CONVERT-1 dispatch).
```

---

### CONVERT-3: `proforma.opex.total` — **High**

**Formula:** `controllable_total + non_controllable_total`  
**Engine location:** `LINE_ITEM_CONFIG['proforma.opex.total'].subtotal_formula`  
**Current state:** Agent writes it; sanity-checked; math engine auto-corrects.  
**Blast radius:** Direct input to NOI. Also consumed by `write_underwriting` opex-ratio check (opex/egi > 1.0 blocker).

**Conversion dispatch:**
```
File: backend/src/agents/prompts/cashflow/system.ts
Action: Remove the instruction to populate proforma.opex.total.
         migrate write_underwriting opex check to: controllable_total + non_controllable_total.
```

---

### CONVERT-4: `proforma.revenue.base_rental_revenue` — **Medium**

**Formula:** `gpr − (loss_to_lease + vacancy_loss + concessions + bad_debt + non_revenue_units)`  
**Engine location:** `LINE_ITEM_CONFIG['proforma.revenue.base_rental_revenue'].subtotal_formula`

**Conversion dispatch:**
```
File: backend/src/agents/prompts/cashflow/system.ts
Action: Remove the instruction to populate proforma.revenue.base_rental_revenue.
```

---

### CONVERT-5: `proforma.revenue.other_income` — **Medium**

**Formula:** Σ `other_income.{parking, pet, storage, washer_dryer, rubs, fees, insurance_admin, cable, other}`  
**Engine location:** `resolveHierarchicalSubtotal` in `proFormaMathEngine.ts`  
**Note:** The agent already writes both the aggregate and the breakdown components. After conversion, the agent keeps writing the breakdown components (KEEP-AI sub-fields via the system prompt). The engine derives the aggregate.

**Conversion dispatch:**
```
File: backend/src/agents/prompts/cashflow/system.ts
Action: Remove the instruction to populate the aggregate proforma.revenue.other_income.
         Keep instructions for each proforma.revenue.other_income.* breakdown sub-field.
```

---

### CONVERT-6: `proforma.opex.controllable_total` — **Medium**

**Formula:** `Σ personnel + repairs_maintenance + turnover + contract_services + marketing + administrative`  
**Engine location:** `LINE_ITEM_CONFIG['proforma.opex.controllable_total'].subtotal_formula`

**Conversion dispatch:**
```
File: backend/src/agents/prompts/cashflow/system.ts
Action: Remove the instruction to populate proforma.opex.controllable_total.
```

---

### CONVERT-7: `proforma.opex.non_controllable_total` — **Medium**

**Formula:** `management_fee + insurance + property_tax`  
**Engine location:** `LINE_ITEM_CONFIG['proforma.opex.non_controllable_total'].subtotal_formula`

**Conversion dispatch:**
```
File: backend/src/agents/prompts/cashflow/system.ts
Action: Remove the instruction to populate proforma.opex.non_controllable_total.
```

---

### CONVERT-8: `proforma.noi_after_reserves` — **Medium**

**Formula:** `noi − reserves.capex`  
**Engine location:** `SPECIAL_FORMULAS['proforma.noi_after_reserves']` (line 500–504)

**Conversion dispatch:**
```
File: backend/src/agents/prompts/cashflow/system.ts
Action: Remove the instruction to populate proforma.noi_after_reserves.
```

---

### CONVERT-9: `proforma.valuation.cap_rate` — **Low**

**Formula:** `proforma.noi / deal.purchase_price`  
**Engine location:** `proforma-generator.service.ts` `goingInCap` computation; `LINE_ITEM_CONFIG['proforma.valuation.cap_rate']` (below_line, required)  
**Note:** `purchase_price` comes from `deal_assumptions`, not from agent output, so the computation is deterministic once NOI is engine-owned.

**Conversion dispatch:**
```
File: backend/src/agents/prompts/cashflow/system.ts
Action: Remove the instruction to populate proforma.valuation.cap_rate.
         The value is derived post-correction in proforma-generator.service.ts.
```

---

### CONVERT-10: `proforma.valuation.stabilized_value` — **Low**

**Formula:** `stabilized_noi / proforma.valuation.cap_rate` (where cap_rate is the stabilized going-in cap, not exit cap)  
**Engine location:** `SPECIAL_FORMULAS['proforma.valuation.stabilized_value']` (line 506–511)

**Conversion dispatch:**
```
File: backend/src/agents/prompts/cashflow/system.ts
Action: Remove the instruction to populate proforma.valuation.stabilized_value.
```

---

## KEEP-AI Confirmation

The following 16 fields require genuine market judgment, source triangulation, or contextual reasoning. The math engine has no basis to derive these — they are the agent's core contribution.

| Field path | Why AI must produce this |
|---|---|
| `proforma.revenue.gpr` | Floor-plan × market-rent benchmark × rent-roll walk; requires comp set analysis, loss-to-lease triangulation, and archive cohort P50 |
| `proforma.revenue.loss_to_lease` | In-place rents vs market rents per floor-plan type; requires rent roll + benchmark data |
| `proforma.revenue.vacancy_loss` | Market vacancy trajectory from M07 submarket; archive cohort; forward-looking assumptions |
| `proforma.revenue.concessions` | Concession market from comp set; rate environment; posture modulation |
| `proforma.revenue.bad_debt` | T-12 TTM actuals cleaned of one-time items; archive cohort |
| `proforma.revenue.non_revenue_units` | T-12 actuals or rent roll; operator/management unit designations |
| `proforma.opex.personnel` | T-12 TTM ± archive P50; staffing model vs unit count |
| `proforma.opex.repairs_maintenance` | T-12 TTM with capital/one-time exclusions; vintage/age-band adjustment |
| `proforma.opex.turnover` | T-12 TTM; seasonality correction; market vacancy state |
| `proforma.opex.contract_services` | T-12 TTM; amenity-driven adjustments |
| `proforma.opex.marketing` | T-12 TTM; occupancy state and lease-up trajectory |
| `proforma.opex.administrative` | T-12 TTM with one-time exclusions |
| `proforma.opex.management_fee` | Negotiated % of EGI; requires operator context and override |
| `proforma.opex.insurance` | `fetch_jurisdiction_insurance_forecast` + T-12 anchor + market escalation |
| `proforma.opex.property_tax` | `fetch_jurisdiction_tax_forecast` + `fetch_county_tax_rules` + reassessment triggers |
| `proforma.reserves.capex` | Age-band rule ($200/$350/$500/unit/yr) + operator override + cap-ex backlog signals |

The 9 `other_income.*` breakdown sub-fields (parking, pet, storage, washer_dryer, rubs, fees, insurance_admin, cable, other) are also KEEP-AI and are not counted among the 26 primary fields. They are resolved hierarchically by the `proFormaMathEngine` into the aggregate `other_income` (CONVERT-5).

Growth assumptions, posture fields, and diagnostics (listed in the architecture audit at `docs/architecture/ai-compute-derivation-audit.md`) are all KEEP-AI and outside the 26-field scope.

---

## Estimated Cost / Determinism Impact

| Impact dimension | Current state | After CONVERT dispatches |
|---|---|---|
| Token waste per run | Agent produces ~10 redundant arithmetic results, writes them to snapshot, and narrates them in evidence | Zero redundant arithmetic; agent output shrinks by ~800–1,200 tokens/run |
| Backtest reliability | NOI, EGI, opex.total differ between agent version and engine version until postprocess runs | Single source of truth; backtests on snapshot fields are deterministic |
| Race condition window | Any snapshot read between `write_underwriting` tool call and `cashflow.postprocess.ts` completion sees stale subtotals | No stale subtotals — engine is the only writer |
| Sanity check integrity | `write_underwriting` sanity checks consume agent-written aggregates (circular) | Sanity checks consume computed-from-inputs values (GAP-2 per architecture audit) |

---

## Gaps Carried Forward

| ID | Severity | Description |
|---|---|---|
| GAP-1 | Medium | Dual subtotal computation — agent and math engine both write NOI, EGI, opex.total. Resolution: CONVERT dispatches above. Follow-on task required. |
| GAP-2 | Low | `write_underwriting` sanity checks depend on agent-written aggregates; must be migrated to `computeFromInputs()` helper when CONVERT dispatches land. |
| GAP-3 | Medium | `compute_proforma` returns IRR/DSCR/equity_multiple to the agent as tool output, but no enforced persistence path writes these to `deal_underwriting_snapshots.returns_json`. A `write_returns_metrics` step in `cashflow.postprocess.ts` is needed. |
| GAP-4 | Low | All rows in `mv_market_rent_benchmarks` have `asset_class = 'C'` because `apartment_locator_properties.year_built` is NULL. `fetch_market_rent_benchmark` always returns Class C benchmarks. Backfill `year_built` from ApartmentIQ sync. |

---

## Files Audited

| File | Role in audit |
|---|---|
| `backend/src/agents/prompts/cashflow/output-schema.ts` | Confirmed: `proforma_fields` is generic `z.record` — all field keys are schema-valid |
| `backend/src/agents/prompts/cashflow/system.ts` | 2,136-line system prompt — confirmed agent is instructed to populate all 26 fields |
| `backend/src/agents/prompts/cashflow/line-item-matrix.ts` | 14 non-GPR cells with exact output slot paths |
| `backend/src/agents/prompts/cashflow/variants/existing.ts` | Stabilized deal protocol — confirmed same field set |
| `backend/src/agents/tools/compute_proforma.ts` | Deterministic IRR (Newton-Raphson), DSCR, cash flow, exit proceeds — fully engine-owned |
| `backend/src/agents/tools/write_underwriting.ts` | Sanity checks (gpr, egi, noi, opex.total) — confirmed circular dependency on agent aggregates |
| `backend/src/agents/cashflow.postprocess.ts` | Confirmed `correctSnapshotMath` import and call on every run |
| `backend/src/services/proforma/proFormaMathEngine.ts` | LINE_ITEM_CONFIG (26 canonical fields), SPECIAL_FORMULAS, subtotal_formula for all CONVERT fields |
| `backend/src/services/proforma-generator.service.ts` | Deterministic NOI / IRR / equity_multiple / DSCR / goingInCap / debtYield |
| `backend/src/services/module-wiring/formula-engine.ts` | F16 NOI, F17 CapRate, F19 IRR, F20 EM, F21 DSCR — all `agentRequired: false` |
| `backend/src/services/proforma-adjustment.service.ts` | Assumption adjustment layer — does not derive new field values, bridges assumptions |
| `backend/src/services/deterministic/proforma-assumptions-bridge.ts` | Bridges ProFormaAssumptions → ModelAssumptions for deterministic runner |
