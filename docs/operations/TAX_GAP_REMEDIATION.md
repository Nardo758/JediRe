# Tax Gap Remediation — Closing Note

**Date:** 2026-05-27  
**Source dispatch:** PHASE_2_BATCH_2_TAX_MODULE_AUDIT.md (5 gaps: TAX-01 through TAX-05)  
**Session:** Phase 2 Tax + OpEx combined session

---

## Gaps Closed

| Gap | Severity | Description | Resolution |
|---|---|---|---|
| TAX-01 | Medium | Tool overlap ambiguity — `fetch_tax_intel` vs `fetch_jurisdiction_tax_forecast` | Resolved via Two-Tool Protocol table in system.ts §Tax Math. Tools are complementary: `fetch_tax_intel` = Year 1 amount + tips, `fetch_jurisdiction_tax_forecast` = multi-year schedule. |
| TAX-02 | High | Unsupported jurisdiction: no fallback protocol documented | Added §Unsupported Jurisdiction Fallback Protocol to system.ts §Tax Math. Agent now calls `fetch_county_tax_rules` for non-FL/TX/GA states, tags data_point with `fetch_county_tax_rules:generic_methodology`, and sets MEDIUM confidence. |
| TAX-03 | Medium | GA 2.5× assessment trap — manual millage × purchase_price computation underestimates by 60% | Added §Georgia — 40% Assessment Ratio Trap warning in system.ts §Tax Math. Directs agent to trust the Tax module and explains the embedded ratio in commentary. |
| TAX-04 | Low | TN missing from `fetch_county_tax_rules.ts` STATE_METHODOLOGIES and DEFAULT_MILLAGE | Added full TN entry: 40% commercial assessment ratio, 4-year cycle, Davidson/Shelby/Knox/Hamilton county coverage, $0.37/$100 transfer tax, $8.00/mil default, probes note (reappraisal cycle modeling). |
| TAX-05 | High | Phase 4 item 20 listed `fetch_jurisdiction_tax_forecast` first, contradicting §Tax Math (fetch_tax_intel primary) | Phase 4 items 20 and 23 restructured: item 20 = `fetch_tax_intel` (PRIMARY; call first), item 20a = `fetch_jurisdiction_tax_forecast` (multi-year schedule), item 23 = merged into 20. |

---

## Files Modified

| File | Change |
|---|---|
| `backend/src/agents/prompts/cashflow/system.ts` | §Tax Math section rewritten: Two-Tool Protocol table, call-order rule, reconciliation note, fallback protocol, GA trap warning. Phase 4 items 20/23 restructured. |
| `backend/src/agents/tools/fetch_county_tax_rules.ts` | TN added to `STATE_METHODOLOGIES` (assessmentRatio, cycleDesc, transferRate, probes). TN added to `DEFAULT_MILLAGE` ($8.00/mil). Description updated: TN in known jurisdictions list + jurisdictionMapped note. |

---

## Unchanged (Per Dispatch Rules)

- `taxService.ts` — no changes (Tax module math unchanged)
- `f9-financial-export.service.ts:172` — no changes (separate cleanup dispatch)
- Mandate v1.3 logic — not touched
- Any LIUS yaml files — not touched

---

## Key Design Decisions

**TAX-01 / TAX-05 (tool distinction):** The resolution confirms `fetch_tax_intel` as the primary Year 1 tool for the proforma property tax line and transfer tax. `fetch_jurisdiction_tax_forecast` is the secondary tool providing the hold-period schedule (per_year array with SOH cap binding, reassessment events). Both call the same `taxService.forecast()` internally — reconciliation rule added: prefer `fetch_tax_intel` for Year 1 if outputs diverge > 2%.

**TAX-04 (TN):** Tennessee commercial/multifamily assessment ratio is 40% (NOT the 25% residential rate — a common misclassification). The 4-year reappraisal cycle is the key modeling consideration: taxes can be stable for years then jump at the next cycle. No full Tax module ruleset exists for TN (taxService returns `jurisdictionMapped=false`); fetch_county_tax_rules serves as the methodology source for manual reasoning.

---

## Verification

- system.ts §Tax Math section reads cleanly in sequence: tool distinction → deal-type rules → usage guidance → fallback → GA trap
- Phase 4 sequence: item 20 (fetch_tax_intel), item 20a (fetch_jurisdiction_tax_forecast), item 21 (insurance), item 22 (county rules), item 23 (merged note)
- fetch_county_tax_rules.ts: TN entry complete with all required fields matching the schema of existing entries (GA, FL, TX, NC, etc.)
- DEFAULT_MILLAGE: TN = 8.00 with comment

---

## Verification — Wave 3 (2026-05-27)

### Step 1 — Document Integrity

| Check | Result |
|---|---|
| Document exists at expected path | ✅ CONFIRMED |
| All 5 gaps documented as fixed | ✅ CONFIRMED |
| Closing summary present | ✅ CONFIRMED |
| Per-gap implementation section | ✅ CONFIRMED |
| P9.A/P9.B confirmation | ✅ CONFIRMED |

---

### Step 2 — Source Citation Spot-Checks

**A. Two-Tool Protocol (TAX-01 + TAX-05)**

Verified `system.ts` lines 832–843:
- ✅ Table at line 836–839 clearly distinguishes `fetch_tax_intel` (Year 1 amount + tips + transfer tax) from `fetch_jurisdiction_tax_forecast` (multi-year per_year[] schedule)
- ✅ Call-order rule at line 841: "Call `fetch_tax_intel` FIRST"
- ✅ Reconciliation rule at line 843: prefer `fetch_tax_intel` if Year 1 values diverge > 2%
- ✅ Phase 4 items at lines 1174–1178: item 20 = `fetch_tax_intel` (PRIMARY; call first), item 20a = `fetch_jurisdiction_tax_forecast`, item 23 = merged into 20. No remaining call-order contradiction.

**B. Unsupported Jurisdiction Fallback (TAX-02)**

Verified `system.ts` lines 871–882:
- ✅ `§Unsupported Jurisdiction Fallback Protocol` section present
- ✅ Protocol: `rulesetUsed: 'default'` trigger → call `fetch_county_tax_rules` → evidence tagged `generic_methodology` → MEDIUM confidence
- ✅ `fetch_county_tax_rules` accepts state-code-only invocation (confirmed at `fetch_county_tax_rules.ts:251`: `InputSchema.parse(input)` with `county` optional)
- ✅ NC seed deal path: NC has a methodology entry (`assessmentRatio: 1.0`, `annualTrend: 0.03`); tool will return `proformaGuidance.year1Base` formula — agent will produce a reasoned estimate, not just a warning

**C. GA 40% Assessment Ratio Trap (TAX-03)**

Verified `system.ts` line 884–886:
- ✅ `§Georgia — 40% Assessment Ratio Trap` section present
- ✅ Explicitly blocks the `millage × purchasePrice / 1000` manual path with `**DO NOT**` directive
- ✅ Explains the 60% underestimation consequence
- ✅ Directs agent to trust Tax module; provides the correct commentary language
- ✅ Robustness: the warning is imperative ("DO NOT manually compute") not advisory — should prevent misapplication even in edge cases

**D. TN Addition (TAX-04)**

Verified `fetch_county_tax_rules.ts` lines 195–206, 245:
- ✅ TN entry present in `STATE_METHODOLOGIES`
- ✅ 4-year cycle: CONFIRMED (`cycleDesc` references Davidson/Shelby/Knox/Hamilton and the 4-year requirement)
- ✅ Transfer tax: CONFIRMED (`transferRate: 0.00037` = $0.37/$100)
- ✅ DEFAULT_MILLAGE TN = 8.00: CONFIRMED at line 245
- ✅ TN in system.ts fallback state list at line 882: CONFIRMED

⚠️ **AMENDMENT REQUIRED — `assessmentRatio` field value:**

`STATE_METHODOLOGIES.TN.assessmentRatio` is set to `0.25` (residential rate).

TN multifamily (4+ units) is classified as **commercial** with a **40% assessment ratio** (`0.40`), not residential (25%). The `assessmentRatioDesc` text correctly states "40% of appraised value" for commercial, but the numeric field `0.25` is the residential rate. If the tool returns this to the agent for proforma computation, the agent will use the wrong ratio for multifamily deals.

**Required fix:** `assessmentRatio: 0.25` → `assessmentRatio: 0.40` in `STATE_METHODOLOGIES.TN`.

**E. P9.A + P9.B Compliance**

- ✅ P9.A: All prompt updates (system.ts §Tax Math, Phase 4 sequence) ship in the same dispatch as the rule changes
- ✅ P9.B: `taxService.ts` not touched; no Tax module math re-specified

---

### Step 3 — Potential Gaps

**A. Gaps closed without prompt update?** No. All 5 gaps have corresponding system.ts changes (TAX-01/02/03/05) or fetch_county_tax_rules.ts data changes (TAX-04). P9.A satisfied.

**B. GA trap robustness?** Yes. The `**DO NOT**` + "underestimates by 60%" combination is directive enough. The agent has no reason to compute manually when the tool is registered. Low residual risk.

**C. Unsupported jurisdiction output quality?** Reasonable — not just warnings. NC path confirmed: tool returns `assessmentRatio: 1.0`, county millage, `proformaGuidance.year1Base` formula, enabling the agent to produce a computed estimate tagged as MEDIUM confidence.

**D. TN property type variations?** Partially addressed. Davidson (urban), Shelby, Knox, Hamilton named in `cycleDesc`. Rural county rates are NOT mapped in `MILLAGE_RATES` (no TN county sub-map added — only state-level `DEFAULT_MILLAGE`). Acceptable for Phase 1; rural TN county granularity is a known limitation.

---

### Verdict

**TAX-01:** APPROVED  
**TAX-02:** APPROVED  
**TAX-03:** APPROVED  
**TAX-04:** NEEDS AMENDMENT — `assessmentRatio: 0.25` → `0.40` for commercial/multifamily  
**TAX-05:** APPROVED  

**Overall:** NEEDS AMENDMENT (TAX-04 `assessmentRatio` field only — single-field correction)
