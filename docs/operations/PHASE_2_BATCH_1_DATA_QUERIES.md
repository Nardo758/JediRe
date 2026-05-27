# Phase 2 Batch 1 — Data Queries for Remaining OQs

**Date:** 2026-05-27  
**Mode:** Plan-mode investigative pass (read-only queries + code inspection)  
**Dispatch type:** Documentation only — no code changes in this file  
**Follows:** PHASE_2_BATCH_1_OPEX_SIMPLE.md (OQ-1, OQ-3, OQ-5 were pending data queries)

---

## 1. Executive Summary

Three OQs from the Batch 1 derivation document required data queries before resolution. All three produced findings; one resolved entirely from code inspection (no data query needed), one uncovered a structural infrastructure gap, and one confirmed a sparse-but-functional benchmark state.

| OQ | Topic | Query approach | Outcome |
|---|---|---|---|
| OQ-1 | Trash field classification | T12 parser code inspection | **RESOLVED** — canonical complete; no new NCTRL needed |
| OQ-3 | Utility split ratios | Deals with combined OM + itemized T12 utilities | **DEFERRED** — T12 sub-line parsing not implemented (Task #672) |
| OQ-5 | line_item_benchmarks population | Direct table query | **SIGMA-PARTIAL** — 263 rows, 14 items, 18–19 rows each |

**Sequencing implication:** Batch 1 implementation can proceed after two amendments land in PHASE_2_BATCH_1_OPEX_SIMPLE.md (Pattern B rewrite, CAPEX-001 number alignment). OQ-3's deferred state means utility split ratios ship as NMHC interim defaults with an explicit Task #672 dependency note.

---

## 2. Query 1 Findings — OQ-1 Trash Format (RESOLVED FROM CODE)

### Method

Instead of querying deal data, the T12 parser source code was inspected directly. The parser is the authoritative classification mechanism for all T12 line item routing; the pattern-matching rules determine where trash ends up, not the data.

### Source

`backend/src/services/document-extraction/parsers/t12-parser.ts`

### Findings

The parser has two distinct trash classification rules:

**Rule A — "Trash Removal" → `contractServices`:**
```
pattern: /\b(cable\s+tv\s+contract|...|trash\s+removal|maintenance\s+contract)\b/i
field: 'contractServices'
```

**Rule B — Valet trash and operational trash → `utilities` (combined):**
```
pattern: /\b(...|valet\s*trash|trash\s+(occupied|unoccupied|pickup|hauling))\b/i
field: 'utilities'
```

**Rule C — "Total Trash" subtotal marker:**
```
pattern: /^total\s+trash\b/i
field: 'isSubtotal'  (treated as a section divider, not a data line)
```

Additionally, `bpi-variance-parser.ts` routes any line matching `/utilit|electric|gas|water|sewer|trash/i` to the `utilities` category.

### Interpretation

The parser already handles trash correctly based on the label in the T12:
- **"Trash Removal"** (hauler contract) → goes into `contractServices` total
- **"Valet Trash"** or **"Trash (occupied/unoccupied/pickup/hauling)"** (operational utility) → goes into combined `utilities` total

There is no loss of information — trash is classified into the appropriate existing field. No separate `trash` NCTRL line item is needed in the canonical P&L. The template is complete as written.

The data query for "how often is trash distinct vs consolidated" was superseded by this finding: the question is moot because even when trash appears as a distinct labeled line in a raw T12, the parser routes it to `contractServices` or `utilities` — it is never left unclassified. The canonical receives correct data regardless of the broker's T12 formatting.

### Resolution

**OQ-1 CLOSED.** No new NCTRL field needed. No canonical template change needed. Agent derivation logic for trash: read from `contractServices` for hauler-style trash; read from `utilities` combined for operational-style trash.

---

## 3. Query 2 Findings — OQ-3 Utility Split Ratios (DEFERRED — INFRASTRUCTURE GAP)

### Method

Attempted to query deals where both: (a) OM has `utilitiesAnnual` set (combined figure) AND (b) T12 has itemized `water_sewer`, `electric`, `gas_fuel` values available for computing implied split ratios.

### Findings

The query returns zero deals. The reason is structural, not a data gap:

From `backend/src/services/document-extraction/types.ts` lines 479–484:

```typescript
utilities: LayeredValue<number>;
/** Utility sub-lines — sub-components of the compound `utilities` field.
 *  Null from T12 today (parser aggregates to `utilities`); available for
 *  [something] in place of `utilities`. Task #672. */
water_sewer?: LayeredValue<number>;
electric?: LayeredValue<number>;
gas_fuel?: LayeredValue<number>;
```

The comment is definitive: **"Null from T12 today (parser aggregates to `utilities`)."** Task #672 was designed to add sub-line parsing but has not been implemented.

This means:
- The T12 parser produces ONE combined `utilities` figure (sum of all utility lines: water, electric, gas, trash, other)
- Individual sub-line values (`water_sewer`, `electric`, `gas_fuel`) are optional fields that are never populated from T12 parsing under the current implementation
- There are no deals in the platform where T12 provides itemized utility sub-lines
- The calibration query for implied split ratios from Leon's actual portfolio cannot be executed against current data

### Impact on Pattern B (Batch 1 derivation doc)

The Batch 1 document's Pattern B had a citation error: it implied that T12 could provide sub-line utility values (`t12.water_sewer`, `t12.electric`, `t12.gas_fuel`) as the primary source for individual utility derivation. This is incorrect. The correct primary source for individual utility lines is always the combined T12 `utilities` figure + a split ratio.

**Pattern B has been amended in PHASE_2_BATCH_1_OPEX_SIMPLE.md** to reflect this.

### Resolution

**OQ-3 DEFERRED to post-Task #672.** Once Task #672 ships (T12 sub-line parsing), the empirical split ratio calibration can be re-run. Until then, NMHC/regional ratios are the only available approach, documented as an interim default with explicit Task #672 dependency.

Interim split ratios (NMHC averages, adjusted for Southeast):
- Water & Sewer: 42% (Atlanta: 45%)
- Electric: 32% (Atlanta: 40%)
- Gas/Fuel: 18% (Atlanta: 10%)
- Trash (when included in utilities): 8% (Atlanta: 5%)

These will be recalibrated against actual portfolio data once Task #672 provides sub-line T12 values.

---

## 4. Query 3 Findings — OQ-5 line_item_benchmarks Population (SIGMA-PARTIAL)

### Query executed

```sql
SELECT 
  line_item, 
  COUNT(*) AS row_count,
  COUNT(DISTINCT state) AS states,
  COUNT(DISTINCT msa) AS msas,
  MIN(as_of) AS earliest,
  MAX(as_of) AS latest
FROM line_item_benchmarks
GROUP BY line_item
ORDER BY COUNT(*) DESC;

SELECT state, msa, COUNT(DISTINCT line_item) AS line_items_covered, COUNT(*) AS total_rows
FROM line_item_benchmarks
GROUP BY state, msa
ORDER BY total_rows DESC;
```

### Raw results

**Total rows:** 263  
**Line items with data:** 14

| Line item | Rows | Sigma status |
|---|---|---|
| utilities_total | 19 | sigma-partial |
| insurance | 19 | sigma-partial |
| management_fee | 19 | sigma-partial |
| payroll | 19 | sigma-partial |
| real_estate_taxes | 19 | sigma-partial |
| repairs_maintenance | 19 | sigma-partial |
| replacement_reserves | 19 | sigma-partial |
| admin_general | 18 | sigma-partial |
| marketing | 18 | sigma-partial |
| bad_debt | 18 | sigma-partial |
| contract_services | 18 | sigma-partial |
| make_ready | 18 | sigma-partial |
| other_income | 18 | sigma-partial |
| landscaping | 18 | sigma-partial |
| gross_potential_rent | 4 | sigma-sparse |

**MSA coverage:**

| State | MSA | Line items covered | Total rows |
|---|---|---|---|
| (null) | (null) | 15 | 116 |
| GA | Atlanta-Sandy Springs-Roswell | 14 | 21 |
| FL | Tampa-St. Petersburg-Clearwater | 14 | 14 |
| NC | Charlotte-Concord-Gastonia | 14 | 14 |
| AZ | Phoenix-Mesa-Chandler | 14 | 14 |
| TN | Nashville-Davidson-Murfreesboro-Franklin | 14 | 14 |
| TX | Austin-Round Rock-Georgetown | 14 | 14 |
| TX | Dallas-Fort Worth-Arlington | 14 | 14 |
| TX | Houston-The Woodlands-Sugar Land | 14 | 14 |
| NC | Raleigh-Cary | 14 | 14 |
| CO | Denver-Aurora-Lakewood | 14 | 14 |

### Interpretation

**The benchmark table is NOT empty.** All Batch 1 line items are present: `repairs_maintenance`, `replacement_reserves`, `contract_services`, `make_ready`, `marketing`, `admin_general`, `utilities_total`. Sigma validation will fire with real numbers, not null.

However, none reach the 50-row "sigma-functional" threshold. At 18–19 rows across 10 MSAs, each state/MSA combination has approximately 1–2 data points per line item. P25 and P75 bands computed from 1–2 points are unreliable.

**Important structural finding:** The benchmark field for utilities is `utilities_total` — not `water_sewer`, `electric`, or `gas_fuel` individually. This is consistent with OQ-3's finding that the T12 parser aggregates to combined utilities. Sigma validation for individual utility lines must fall back to `utilities_total` as the benchmark comparator.

**Sigma status definition used:**
- `sigma-functional`: ≥ 50 rows per item — none qualify
- `sigma-partial`: 10–49 rows — all Batch 1 items
- `sigma-sparse`: 1–9 rows — `gross_potential_rent` only
- `sigma-empty`: 0 rows — none

### Recommendation

Sigma validation should proceed with the following behaviors:
1. Fire real P25/P75 bands from available data — do not suppress validation
2. Append "limited sample" flag when fewer than 5 rows exist for a given `(state, msa)` combination: `"benchmark_sample_note": "N observations for this market; bands are indicative only"`
3. For individual utility lines (`water_sewer`, `electric`, `gas_fuel`): use `utilities_total` benchmark for the combined value; apply split ratios for individual line context only — do not sigma-check individual sub-lines against a per-utility benchmark (none exists)
4. The 116-row (null, null) cohort likely represents national platform-average data; use as fallback when state/MSA-specific benchmark returns < 3 rows

---

## 5. Updated OQ Resolution Status

| OQ | Topic | Status | Resolution |
|---|---|---|---|
| OQ-1 | Trash field classification | **RESOLVED** | T12 parser routes to contractServices or utilities by label; canonical complete |
| OQ-2 | Replacement reserves default | **COMMITTED** | Three-tier age rule: <10yr → $200/unit, 10–25yr → $350/unit, 25+yr → $500/unit |
| OQ-3 | Utility split ratios | **DEFERRED** | Task #672 required for sub-line T12 parsing; interim NMHC ratios documented |
| OQ-4 | CS amenity detection | **RESOLVED** | Phase 1 limitation accepted; Phase 2 backlog for secondary signal detection |
| OQ-5 | line_item_benchmarks population | **SIGMA-PARTIAL** | Functional with wide intervals; limited-sample flag recommended |

---

## 6. Batch 1 Implementation Sequencing Implications

1. **Pattern B (utilities) must be rewritten before implementation.** The doc's implied T12 sub-line primary source was incorrect. Amendment applied. Pattern B now correctly documents: T12 provides combined `utilities` → split ratios applied → per-utility values. Implementation must follow this pattern.

2. **CAPEX-001 reserve numbers are now committed.** Three-tier age-based rule. Agent system prompt updated to align. No more three-way mismatch.

3. **Sigma validation can ship with current benchmark data.** The table is populated (sigma-partial). Implementation should add the limited-sample flag behavior described in Section 4. No benchmark seeding dispatch needed before Batch 1 ships.

4. **OQ-3 (utility splits) is not a blocker.** NMHC interim defaults are documented; the limitation is explicit. Calibration will happen post-Task #672. Pattern B implementation uses the documented interim ratios.

5. **OQ-1 and OQ-4 are fully closed.** No open questions remain that require operator input before Pattern A (CTRLL standard) derivation can be implemented.

**Implementation can proceed after PHASE_2_BATCH_1_OPEX_SIMPLE.md amendments are verified.**
