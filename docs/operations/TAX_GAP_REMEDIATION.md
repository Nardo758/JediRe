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
