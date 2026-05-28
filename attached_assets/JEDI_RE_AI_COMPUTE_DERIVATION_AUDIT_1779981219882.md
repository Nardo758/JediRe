# JEDI RE — AI-COMPUTE → DERIVATION MIGRATION AUDIT

**Purpose:** Identify where the platform currently uses **AI compute** (the agent generating a value in its JSON output) for something that should be a **deterministic derivation** (the engine computing it by formula). Produce the conversion list. Companion to `JEDI_RE_F9_CALCULATIONS_VS_ASSUMPTIONS.md`.

**What this document is:** An audit *instrument*, not a completed audit. The verdict column ("currently produced by") must be filled by inspecting the actual code — it cannot be filled from documentation alone, and filling it from assumption would repeat the spec-against-unverified-state errors that have bitten this project (the missing mv view, the asset_class column, the unverified 22/14 count). Per CLAUDE.md P8: state-verify before concluding.

**Who runs it:** Replit's agent (or whoever has codebase access), following the inspection procedure below.

---

## WHY THIS AUDIT EXISTS — THE SMOKING GUN

There is a documented tension in the platform's own specs:

- **CLAUDE.md agent roster** describes the CashFlow Agent's purpose as: *"NOI, IRR, proforma projections"* with output tables `cashflow_projection`, `deal_financials`.
- **The two-layer model (P7)** and `JEDI_RE_F9_CALCULATIONS_VS_ASSUMPTIONS.md` say NOI (`EGR − OpEx`) and IRR (Newton-Raphson on the cash-flow vector) are **deterministic ENGINE calculations**, not agent outputs.

These cannot both be clean. Either:
- (a) The agent is producing NOI/IRR in its JSON — **AI compute doing a derivation's job** → conversion target, or
- (b) The roster description is loose shorthand and the agent only sets assumptions while the engine computes NOI/IRR — **already correct**, the doc just reads ambiguously.

**The audit determines which.** This is not theoretical: if the agent generates NOI directly, two runs on the same deal can produce different NOI (non-determinism), the number isn't verifiable by formula (no audit trail), and every NOI burns Claude credits unnecessarily.

---

## THE PRINCIPLE BEING ENFORCED

> **AI compute is for judgment under uncertainty. Derivation is for arithmetic. If a value is a pure function of other values, the engine computes it — the agent never should.**

Three reasons a calculation must not be AI compute:
1. **Determinism** — `NOI = EGR − OpEx` returns the same answer every run; a generated NOI can drift.
2. **Auditability** — a formula is verifiable by inspection; a generated number is a black box.
3. **Cost + speed** — arithmetic is free and instant; AI compute costs credits and adds latency.

The platform already honors this in places: tax and insurance go through deterministic services (`taxService.forecast`, `insuranceService.forecast`) via tools, not agent guesswork. The spec explicitly says *"do not let the agent invent cap-ex reserves or insurance premiums when the ruleset service exists."* **The audit extends that existing discipline to every calculated field.**

---

## THE THREE CLASSIFICATIONS

Every field gets one verdict:

| Verdict | Meaning | Action |
|---|---|---|
| **KEEP-AI** | Legitimately requires judgment under uncertainty | No change — this is what AI compute is for |
| **CONVERT** | Currently AI compute, but is a pure function of other fields | Migrate to engine derivation |
| **ALREADY-DETERMINISTIC** | Already computed by engine/service, not the agent | No change — confirm and document |

The dividing question, applied to each field:
> *Can this value be written as a formula using only other fields (assumptions or other calculations)?*
> - **Yes** → it must be ALREADY-DETERMINISTIC or CONVERT (never KEEP-AI)
> - **No, it requires reasoning from evidence** → KEEP-AI (it's an assumption, not a calculation)

---

## INSPECTION PROCEDURE (this is the work)

For each field, the auditor inspects three places and answers one question.

### The three files to read

| File | Tells you |
|---|---|
| `src/agents/prompts/cashflow/output-schema.ts` | **What the agent's JSON actually contains** (the Zod `UnderwritingOutput` schema). If a calculated field appears here as an agent output, it's AI compute. |
| `proforma-generator.service.ts` / `proforma-adjustment.service.ts` | **What the engine computes.** If the field is computed here from other fields, it's deterministic. |
| `formula-engine.ts` (F01–F72+) | **The deterministic formula library.** If a formula ID exists for the field, the deterministic path exists — confirm the agent isn't bypassing it. |

### The determination, per field

```
1. Does the field appear in output-schema.ts as an agent-produced value?
   NO  → agent doesn't produce it. Check it's computed by the engine → ALREADY-DETERMINISTIC
   YES → continue

2. Is the field a pure function of other fields (formula exists or is trivial)?
   NO  → it's a genuine assumption requiring judgment → KEEP-AI (it belongs in output-schema)
   YES → continue

3. The agent produces a value that should be a formula. → CONVERT
      The engine should compute it from the agent's assumptions;
      the field should be REMOVED from the agent's output schema.
```

### What CONVERT actually changes

When a field is CONVERT:
1. **Remove it from `output-schema.ts`** — the agent stops producing it
2. **Confirm/add the engine computation** in `proforma-generator.service.ts` (likely already exists per the formula library)
3. **Update the system prompt** (P9.A) — instruct the agent it sets the inputs, not this output
4. **Add a guard** — if a `source: agent:*` value ever lands on this field, flag it (boundary violation, per the calc-vs-assumption doc)

---

## THE AUDIT TABLE (verdict column to be filled by inspection)

Calculated fields from `JEDI_RE_F9_CALCULATIONS_VS_ASSUMPTIONS.md`, each a CONVERT candidate. The auditor fills "In output-schema?" and "Verdict" by running the procedure. The "Prime suspect?" column flags where the smoking gun points.

| Field | Formula (if deterministic) | Prime suspect? | In output-schema? | Verdict |
|---|---|---|---|---|
| Gross Potential Rent | `rent × units × 12 × growth` | — | ? | ? |
| Vacancy Loss $ | `GPR × vacancy_rate` | — | ? | ? |
| Concessions $ | `GPR × concessions_pct` | — | ? | ? |
| Bad Debt $ | `GPR × bad_debt_pct` | — | ? | ? |
| Base Rental Revenue | `GPR − losses` | — | ? | ? |
| Each ancillary line $ | `per_unit × units × 12 × growth` | — | ? | ? |
| Total Other Income | `Σ ancillary` | — | ? | ? |
| **Effective Gross Revenue** | `Base Rental + Other Income` | YES | ? | ? |
| Each OpEx line $ | `per_unit × units × growth` | — | ? | ? |
| **Total Operating Expenses** | `Σ OpEx lines` | YES | ? | ? |
| OpEx Ratio | `Total OpEx / EGR` | — | ? | ? |
| **Net Operating Income** | `EGR − Total OpEx` | **YES (roster names it)** | ? | ? |
| NOI Margin | `NOI / EGR` | — | ? | ? |
| Annual Debt Service | f(loan, rate, amort, IO) | — | ? | ? |
| Cash Flow After Debt | `NOI − Debt Service` | — | ? | ? |
| DSCR | `NOI / Debt Service` | YES | ? | ? |
| Cash-on-Cash | `BTCF / equity` | — | ? | ? |
| Exit NOI | `Year N forward-12 NOI` | — | ? | ? |
| Gross Sale Price | `Exit NOI / exit_cap` | — | ? | ? |
| Selling Costs $ | `Sale × selling_pct` | — | ? | ? |
| Net Disposition Proceeds | `Sale − Costs − Payoff` | — | ? | ? |
| **IRR** | Newton-Raphson on CF vector | **YES (roster names it)** | ? | ? |
| **Equity Multiple** | `Total Dist / Equity` | YES | ? | ? |
| Cumulative Return | running sum CF + exit | — | ? | ? |
| Market cap rate (going-in) | `aggregate(comp implied caps)` | YES (Path B) | ? | ? |
| Each Valuation Grid method value | per-method formula | YES | ? | ? |

**Prime suspects** are flagged because the roster explicitly names NOI and IRR as CashFlow Agent outputs, and the Valuation Grid / cap-rate fields are new enough that their derivation path may not be wired. Start the inspection there.

---

## FIELDS THAT SHOULD STAY KEEP-AI (do not convert)

For contrast — these legitimately require AI compute and must remain agent-produced. They are NOT calculations:

| Field | Why it's AI compute |
|---|---|
| Each assumption value (rent, vacancy, OpEx per-unit, growth, exit cap) | Requires reasoning across evidence tiers — not a formula |
| Evidence reasoning / alternatives_considered | Natural-language judgment |
| Collision detection narrative | Comparative reasoning + explanation |
| Comp selection / story framing | Strategy-aware judgment |
| Synthesized per-comp NOI (the inputs to cap rate) | Requires judgment about each comp's operating profile from partial data |
| Confidence ratings | Judgment about evidence quality |

Note the subtlety on cap rate: **synthesizing each comp's NOI** may legitimately need AI judgment (partial comp data), but **aggregating implied caps to P25/P50/P75** is pure statistics → deterministic. The audit must split these.

---

## THE EXISTING CORRECT PATTERN (replicate this)

Tax and insurance already do it right — the model for every CONVERT:

```
Agent does NOT compute property tax.
Agent calls fetch_jurisdiction_tax_forecast → taxService.forecast(deal)
                                               ↑ deterministic ruleset service
Agent receives the computed value, wraps it as a LayeredValue with source.
```

The spec's existing rule: *"Do not let the agent invent cap-ex reserves or insurance premiums when the ruleset service exists. Always call the service."*

**Generalize it:** for every CONVERT field, the agent should either (a) let the engine compute it downstream from the assumptions, or (b) call a deterministic service/tool that computes it — never generate the number itself.

---

## PER-FINDING CONVERSION DISPATCH TEMPLATE

For each field the audit verdicts as CONVERT:

```
CONVERT DISPATCH — <field name>

STATE VERIFICATION (P8):
1. Confirm <field> appears in output-schema.ts as agent output
2. Confirm the deterministic computation exists (formula-engine F-id, or
   proforma-generator path) OR specify what must be built
3. Confirm no other consumer depends on the agent producing this field

SCOPE:
A. Remove <field> from output-schema.ts (agent stops producing it)
B. Confirm/wire engine computation in proforma-generator.service.ts
C. Update cashflow system prompt (P9.A): agent sets <input assumptions>,
   engine computes <field>
D. Add boundary guard: flag if source:agent:* lands on <field>
E. Regression: run agent on a known deal, confirm <field> still appears
   in final proforma (now engine-computed) with correct value

VERIFY (per Verification Protocol):
- L1: <field> no longer in agent output schema; present in engine output
- L2: engine-computed <field> matches hand-calc from the assumptions
      (e.g., NOI equals EGR − OpEx to the dollar)

DO NOT:
- Change the assumption inputs that feed <field>
- Alter the formula (only move WHO computes it)
- "While I'm here" cleanups
```

---

## DELIVERABLE (what the audit produces)

`docs/operations/AI_COMPUTE_DERIVATION_AUDIT.md`:

1. **Executive summary** — counts: KEEP-AI / CONVERT / ALREADY-DETERMINISTIC
2. **The smoking-gun resolution** — does the agent produce NOI/IRR? (the headline finding)
3. **Completed audit table** — verdict + "in output-schema?" filled for every field
4. **CONVERT list** — prioritized; prime suspects first
5. **Per-field conversion dispatches** — one per CONVERT finding, using the template
6. **KEEP-AI confirmation** — the fields correctly left as AI compute
7. **Cost/determinism impact** — estimated credit savings + determinism gains from the conversions

---

## WHY THIS MATTERS FOR THE BACKTEST

The backtest (`JEDI_RE_BACKTEST_HARNESS_SPEC.md`) depends on this. If the agent is generating NOI/IRR non-deterministically, running the same deal twice could produce different valuations — making the ±5% / ±25bps bars meaningless (you can't hit a precision target with a non-deterministic engine). **Converting AI-compute calculations to deterministic derivations is a prerequisite for a meaningful backtest.** Sequence this audit + its conversions before the backtest is trusted.

---

## RELATIONSHIP TO THE OTHER DOCUMENTS

| Document | Role |
|---|---|
| `JEDI_RE_F9_CALCULATIONS_VS_ASSUMPTIONS.md` | Defines the *target* boundary (what should be which) |
| **This document** | Audits the *current* state to find where AI compute violates that boundary, and lists the conversions |
| `JEDI_RE_VERIFICATION_PROTOCOL.md` | Confirms each conversion landed (L1/L2) |
| `JEDI_RE_BACKTEST_HARNESS_SPEC.md` | Depends on conversions being done (determinism prerequisite) |

The calc-vs-assumption doc says *where the line should be*. This doc finds *where the line is actually crossed today* and fixes it.
