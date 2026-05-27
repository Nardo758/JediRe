# Phase 2 — Batch 2: Tax Module Audit

**Status:** Audit Complete — Gaps Surfaced  
**Date:** 2026-06-20  
**Scope:** Audit ONLY. Do NOT modify Tax module or re-specify math. Reference module as authoritative. Surface gaps for operator review; remediation is a separate dispatch.

---

## 1. Module Reference

The Tax module is the authoritative platform for property tax derivation. Its entry point is `taxService.forecast()` at `backend/src/services/tax/taxService.ts`. The agent accesses it through three tools:

| Tool | File | Purpose |
|---|---|---|
| `fetch_jurisdiction_tax_forecast` | `tools/fetch_jurisdiction_tax_forecast.ts` | Year-by-year post-acquisition property tax schedule (thin wrapper over `taxService.forecast()`) |
| `fetch_county_tax_rules` | `tools/fetch_county_tax_rules.ts` | Assessment methodology, reassessment cycle, millage rates, caps — the RULES, not computed amounts |
| `fetch_tax_intel` | `tools/fetch_tax_intel.ts` | Full tax intelligence layer including transfer taxes, TPP, depreciation, Section C |

The agent prompt also registers `fetch_tax_intel` (line 1013 of system.ts) as "tax intelligence layer" and instructs the agent to call it for property tax math (system.ts §Tax Math, line 688–722).

**Math re-specification prohibited.** All tax arithmetic — millage application, assessment ratio, SOH cap, transfer tax formula, bonus depreciation, cost seg — is implemented in `taxService.forecast()` and its rulesets. This document does not re-specify any formula.

---

## 2. Jurisdiction Coverage Map

### State Rulesets (implement `TaxRuleset` interface)

Registered in `resolver.ts` `STATE_RULESETS`:

| State | Ruleset File | Rate Sheet | Status |
|---|---|---|---|
| FL | `rulesets/fl.ruleset.ts` | `rateSheets/fl-2026.json` | **GREEN** — full implementation |
| TX | `rulesets/tx.ruleset.ts` | `rateSheets/tx-2026.json` | **GREEN** — full implementation |
| GA | `rulesets/ga.ruleset.ts` | `rateSheets/ga-2026.json` | **GREEN** — full implementation |
| DEFAULT | `rulesets/default.ruleset.ts` | (none) | FALLBACK — `jurisdictionMapped: false`, confidence: `low` |
| FEDERAL | `rulesets/federal.ruleset.ts` | `rateSheets/federal-2026.json` | Applied to all jurisdictions (Section C) |

### County Overlay Rulesets (implement `CountyOverlayRuleset` interface)

Registered in `resolver.ts` `COUNTY_RULESETS`:

| Key | Ruleset File | Rate Sheet | Status |
|---|---|---|---|
| `FL-Miami-Dade` | `rulesets/fl-miami-dade.ruleset.ts` | `rateSheets/fl-miami-dade-2026.json` | **GREEN** — county surtax + millage override |
| `FL-Broward` | `rulesets/fl-broward.ruleset.ts` | `rateSheets/fl-broward-2026.json` | **GREEN** |
| `FL-Palm Beach` | `rulesets/fl-palm-beach.ruleset.ts` | `rateSheets/fl-palm-beach-2026.json` | **GREEN** |
| `GA-Fulton` | `rulesets/ga-fulton.ruleset.ts` | `rateSheets/ga-fulton-2026.json` | **GREEN** |
| `TX-Harris` | `rulesets/tx-harris.ruleset.ts` | `rateSheets/tx-harris-2026.json` | **GREEN** |

### Confidence Tier Assignment (from `taxService.forecast()`)

```
jurisdictionMapped=false       → confidence: 'low'
jurisdictionMapped=true, no county overlay → confidence: 'medium'
jurisdictionMapped=true, county overlay present → confidence: 'high'
```

---

## 3. Agent Prompt Coverage — Existing Alignment

system.ts currently provides (lines 688–722):
- Instruction to call `fetch_tax_intel` for every deal
- Step-by-step protocol: call with dealId, state, county, purchasePrice, loanAmount, units
- Delta analysis: T12 tax vs fetch_tax_intel year1 → explain delta in commentary
- Reference to `tips[]` for jurisdiction-specific rules

system.ts tool sequence (Phase 4):
- Item 20: `fetch_jurisdiction_tax_forecast` (mandatory)
- Item 22: `fetch_county_tax_rules`
- Item 23: `fetch_tax_intel`

---

## 4. Gaps Identified

### GAP-TAX-01 — Tool Overlap: `fetch_jurisdiction_tax_forecast` vs `fetch_tax_intel`

**Observation:** Both tools wrap `taxService.forecast()`. `fetch_jurisdiction_tax_forecast` (Tier 3 wrapper, ~150 lines) returns a year-by-year schedule. `fetch_tax_intel` returns a "full tax intelligence layer." The agent currently receives instructions to call both (system.ts item 20 + item 23) but there is no documented protocol distinguishing WHEN to call each vs using only one.

**Risk:** Agent may make two taxService calls for the same deal without a clear purpose distinction, consuming budget unnecessarily. Or the agent may skip one because it assumes the other covers it.

**Status:** OPEN — requires operator review. Remediation: document in system.ts whether the tools are complementary (year-by-year schedule from `fetch_jurisdiction_tax_forecast` + acquisition/depreciation context from `fetch_tax_intel`) or whether one is superseded.

---

### GAP-TAX-02 — Unsupported States Fall to Default Ruleset (No Warning in Prompt)

**Observation:** Deals in NC, TN, CA, NY, IL, LA, AZ receive `jurisdictionMapped: false` and `confidence: 'low'` from `taxService.forecast()`. `fetch_county_tax_rules` DOES cover these states (methodology map in `STATE_METHODOLOGIES`) but the agent prompt has no instruction about what to do when `fetch_jurisdiction_tax_forecast` returns `jurisdictionMapped: false`.

**Risk:** Agent may present a tax number with no confidence qualifier, or not call `fetch_county_tax_rules` as a complement when the state ruleset is missing.

**States affected:** NC, TN, CA, NY, IL, LA, AZ (and any others not in `STATE_RULESETS`)

**Status:** OPEN — requires operator review. Remediation: add a system.ts instruction that when `fetch_jurisdiction_tax_forecast` returns `confidence: 'low'` or `jurisdictionMapped: false`, the agent MUST call `fetch_county_tax_rules` for the state and disclose the methodology limitation in commentary.

---

### GAP-TAX-03 — GA Assessment Ratio Agent Trap (Known, Undocumented in Prompt)

**Observation:** `fetch_county_tax_rules` documents this trap in `STATE_METHODOLOGIES.GA.probes`: "GA 40% assessment ratio — agents often apply millage directly to purchase price, overestimating taxes by 2.5x. The taxService applies millage to the FULL purchase price as a workaround." However, system.ts has no corresponding warning. If the agent reasons about GA tax numbers from first principles (instead of trusting the tool output), it may produce incorrect reasoning.

**Status:** OPEN — low-priority. The math lives in the module; the risk is agent commentary, not the computed number. Remediation: add a GA-specific callout in the system.ts tax section referencing the 2.5× trap.

---

### GAP-TAX-04 — No TN Ruleset (Market Expansion Risk)

**Observation:** TN (Nashville) is a plausible expansion market. No `tn.ruleset.ts` exists and TN is not in `STATE_METHODOLOGIES` in `fetch_county_tax_rules`. If a TN deal is underwritten, it will receive `jurisdictionMapped: false` and the agent has no methodology map to fall back on.

**Status:** OPEN — pre-emptive. Remediation: add TN to `fetch_county_tax_rules.ts` `STATE_METHODOLOGIES` and `DEFAULT_MILLAGE` as minimum coverage before the next TN deal is processed.

---

### GAP-TAX-05 — Agent Prompt References `fetch_tax_intel` as Primary but Tool Is Secondary

**Observation:** system.ts §Tax Math (line 688) says "For EVERY deal, call fetch_tax_intel" and treats it as the primary tax tool. But `fetch_tax_intel` is tool item 23 in the Phase 4 sequence, listed AFTER `fetch_jurisdiction_tax_forecast` (item 20). The tool registration order and the prose instruction conflict on which tool is authoritative for property tax Year 1 computation.

**Status:** OPEN — prompt coherence gap. Remediation: clarify in system.ts whether `fetch_jurisdiction_tax_forecast` or `fetch_tax_intel` is the primary property tax derivation path. Confirm whether both are always required or whether one triggers only in specific conditions.

---

## 5. What Is Confirmed Working

| Area | Assessment |
|---|---|
| FL, TX, GA property tax computation | Fully implemented with county overlays |
| Transfer tax calculation | State-level (doc stamps, intangible) + Miami-Dade county surtax |
| TPP (Tangible Personal Property) | FL-specific, covered by fl.ruleset |
| Federal depreciation (Section C) | Bonus depreciation pct by year, cost seg, income tax rate |
| Provenance / LayeredValue tagging | All outputs are tagged with source, formula, confidence, inputs |
| Confidence tier emission | `jurisdictionMapped` flag correctly propagates to confidence level |
| Reassessment-on-sale modeling | Implemented in GA/FL/TX rulesets |
| Annual assessment cap | FL (10% non-homestead), TX (10% residential only), GA (none) |

---

## 6. Recommended Next Dispatch (Remediation)

Open items in priority order:

1. **GAP-TAX-01** (Tool overlap clarification) — system.ts prompt fix; no code change
2. **GAP-TAX-04** (TN methodology map) — add TN to `fetch_county_tax_rules.ts`; no ruleset required
3. **GAP-TAX-02** (Low-confidence fallback protocol) — system.ts prompt addition
4. **GAP-TAX-05** (Primary tool clarification) — system.ts prompt fix
5. **GAP-TAX-03** (GA trap warning) — system.ts addition; low priority

Items 1, 3, 4, 5 are prompt-only changes. Item 2 (TN) is a small code addition to `fetch_county_tax_rules.ts`. None of these require changes to `taxService.ts` or any ruleset.
