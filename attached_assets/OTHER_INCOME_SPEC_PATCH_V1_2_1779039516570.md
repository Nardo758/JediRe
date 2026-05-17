# OTHER INCOME REASONING METHOD SPEC — PATCH v1.1 → v1.2

**Purpose:** Replaces standalone Method 5 (Archive Cohort Projection) with reference to the platform-wide Competitive Intelligence Engine.
**Type:** Surgical patch — preserves Methods 1, 2, 3 unchanged; redefines Method 5 as a CIE reference; archives Method 4 because it was always intended as an archive cohort approach that's now subsumed by CIE.
**Apply after:** the prior v1.0 → v1.1 patch in `SPEC_TEXT_UPDATES_POST_AUDIT.md`

---

## Why this patch

The v1.0 spec defined Method 5 as "Archive Cohort Projection" for deals where Methods 1-3 didn't apply. That framing made sense when archive cohort was treated as a fallback within the Other Income spec.

The Competitive Intelligence Engine (CIE) generalizes archive cohort opportunity detection across all six platform domains. CIE produces structured findings for revenue (including Other Income), opex, capex, debt, operating model, and exit — same engine, different fields.

This means archive cohort comparison for Other Income is no longer an Other-Income-specific method. It's a CIE finding type. The Other Income spec should reference CIE rather than duplicate its logic.

The methods that remain in this spec are the **underwriting methods** — how the agent produces the stated Pro Forma value for Other Income. Opportunity detection (finding categories the agent's projection should include) is handled by CIE.

---

## Changes summary

| Section | Change |
|---|---|
| Section 2 | Methods 1, 2, 3 unchanged. Method 4 removed (was archive cohort projection; now handled by CIE). Method 5 redefined as reference to CIE. |
| Section 3 | Method selection logic simplified — no Method 4 branch needed. |
| Section 6 | Integration section already references CIE per v1.1 patch; tightening here. |
| Section 7 | Agent prompt update: no longer describes Method 5 inline; agent reads CIE findings via tool. |
| Section 10 | Open Questions Q5 (M22 calibration) updated to point at CIE's calibration loop. |

---

## Section 2.4 — Remove old Method 4 and replace with CIE reference

**Old text (Method 4 — Archive Cohort Projection):**

```
### Method 4 — Archive Cohort Projection
When the subject has no T-12, no rent roll detail, no fee schedule, and no
owned-portfolio reference. Use archive cohort P50 per category (or aggregate)
for similar deals. Lowest confidence; default to flag for user review.
```

**New text:**

```
### Method 4 — Removed in v1.2

Method 4 was archive cohort projection. It has been removed as a standalone
method because the platform-wide Competitive Intelligence Engine (CIE) now
handles archive cohort comparison across all domains, including Other Income.

When the subject has no T-12, no rent roll detail, no fee schedule, and no
owned-portfolio reference, the agent falls back to:
1. Method 1 with archive cohort adoption rates (rather than owned-portfolio)
2. Plus CIE findings for any per-category opportunities the cohort surfaces

This is functionally equivalent to the old Method 4 but uses the consistent
CIE framework rather than a special case within Other Income reasoning.
```

---

## Section 2.5 — Rename to "Method 5 — Competitive Intelligence Engine reference"

**Old text (if v1.0 defined Method 5 inline):**

```
### Method 5 — [whatever was here]
```

**New text:**

```
### Method 5 — Competitive Intelligence Engine reference

Method 5 is not a standalone reasoning method. It is a reference to the
platform-wide Competitive Intelligence Engine (CIE) which produces opportunity
findings across all six platform domains, including Other Income.

For Other Income specifically, CIE produces three types of findings:
- `missing_ancillary_category`: cohort presence ≥ 50%; subject has none
- `underpriced_ancillary_fee`: subject rate < cohort P25
- `low_ancillary_adoption_rate`: subject adoption < cohort P25

These findings appear in `deal_underwriting_snapshots.ci_findings` and are
surfaced in the F9 Pro Forma's opportunity panel below the Other Income row.

**How CIE findings flow into the Other Income agent reasoning:**

CIE findings are durable artifacts the sponsor reviews and accepts, declines,
or defers. When a sponsor *accepts* a CIE finding (e.g., "implement RUBS"),
the accepted category appears as an input to the agent's next Other Income
reasoning pass. Specifically:

1. Method 3 (Rent Roll + Fee Schedule + T-12 Reconciliation) consumes
   accepted CIE findings as new categories to project. For each accepted
   category, the agent applies Method 1 logic (fee × adoption × applicable
   units) to project that category's stabilized revenue.

2. Method 1 (Fee Schedule + Leasing Assumptions) consumes accepted CIE
   findings as additional fee categories beyond the sponsor's stated fee
   schedule.

3. Method 2 (T-12 Trailing Aggregate) does not directly consume CIE findings
   — Method 2 trusts T-12. If CIE surfaces opportunities while Method 2 is
   active, the sponsor's acceptance shifts the deal classification from
   "stabilized no lift" to "stabilized with lift," which triggers Method 3
   on the next run.

**CIE is NOT a substitute for the agent's reasoning.** The agent still produces
the stated Pro Forma value via Methods 1-3. CIE supplements by identifying
opportunities the agent's projection doesn't include. The two are
complementary, not redundant.

See `COMPETITIVE_INTELLIGENCE_ENGINE_SPEC.md` for full CIE coverage.
```

---

## Section 3.1 — Update selection logic to remove Method 4 branch

**Old text:**

```typescript
function selectOtherIncomeMethod(
  dealContext: DealContext,
  dataAvailability: DataAvailability,
): 'method_1' | 'method_2' | 'method_3' | 'method_4' {
  // ... old logic with Method 4 fallback ...
}
```

**New text:**

```typescript
function selectOtherIncomeMethod(
  dealContext: DealContext,
  dataAvailability: DataAvailability,
): 'method_1' | 'method_2' | 'method_3' {

  const isPreStabilization = dealContext.classification === 'development' ||
                              dealContext.classification === 'lease_up' ||
                              (dealContext.classification === 'redevelopment' &&
                               dealContext.scope === 'full_repositioning');

  if (isPreStabilization) {
    return 'method_1';
  }

  const isStabilizedNoLift = dealContext.classification === 'acquisition_stabilized' &&
                              !dealContext.strategy.includes_other_income_lift;

  if (isStabilizedNoLift && dataAvailability.t12_quality === 'high') {
    return 'method_2';
  }

  return 'method_3';
}
```

**Add this note immediately below:**

> **Note on Method 4:** When the subject has minimal data (no T-12, no rent roll, no fee schedule), the agent uses Method 1 with archive cohort adoption rates instead of owned-portfolio. CIE findings supplement the projection. There is no Method 4 path in the selection logic.

---

## Section 6.3 — Refine the CIE integration text

**Old text (from v1.1 patch):**

```
### 6.3 With Competitive Intelligence Engine (NEW v1.1)
Method 5 of this spec is superseded by the platform-wide Competitive
Intelligence Engine...
```

**New text:**

```
### 6.3 With Competitive Intelligence Engine

The CIE is the platform-wide opportunity detection engine. For Other Income,
CIE produces three finding types covering categories the agent's underwriting
might miss:

- `missing_ancillary_category`
- `underpriced_ancillary_fee`
- `low_ancillary_adoption_rate`

**Bidirectional integration:**

1. **Agent → CIE.** The agent's stated Pro Forma value flows into CIE's
   comparison: CIE compares the agent's projection against archive cohort
   distribution and produces findings where the agent's projection is
   structurally below cohort norm.

2. **CIE → Agent.** Sponsor-accepted CIE findings flow into the agent's
   next Other Income reasoning pass as additional categories to project
   (per Method 3 or Method 1 depending on whether the category exists in
   the current rent roll).

This is a feedback loop. Each agent run + CIE pass progressively closes
the gap between the subject deal's underwriting and the comparable cohort's
realized achievement. The platform learns the deal's value-creation envelope
over time.
```

---

## Section 7 — Update agent prompt instructions

**Old prompt addition (Section A.5 Other Income reasoning):**

```
Other Income is formulated by one of three methods:
- Method 1: Fee schedule + leasing assumptions
- Method 2: T-12 trailing aggregate
- Method 3: Rent roll + fee schedule + T-12 reconciliation

Selection is deterministic per OTHER_INCOME_REASONING_METHOD_SPEC.md Section 3.
[etc]
```

**Updated prompt addition:**

```
Other Income is formulated by one of three methods:
- Method 1: Fee schedule + leasing assumptions (development, lease-up)
- Method 2: T-12 trailing aggregate (stabilized existing, no lift)
- Method 3: Rent roll + fee schedule + T-12 reconciliation (value-add)

Selection is deterministic per OTHER_INCOME_REASONING_METHOD_SPEC.md Section 3.

**When CIE findings exist:** Before computing your Other Income projection,
read existing CIE findings from DealContext (`deal_context.ci_findings`
filtered to domain: 'revenue' and finding_type starting with 'ancillary' or
'missing_'). Findings in `sponsor_state: 'accepted'` are part of the deal's
stabilized strategy and must be included in your projection.

For each accepted CIE finding:
- If Method 3 is selected: add the category to your per-category breakdown
  using Method 1 logic (fee × adoption × applicable units)
- If Method 1 is selected: add the category to your fee schedule projection
- If Method 2 is selected: the acceptance shifts the deal to "stabilized
  with lift" — recompute method selection, likely Method 3

Findings in `sponsor_state: 'unreviewed'` or 'deferred' do not feed your
projection but should be acknowledged in your evidence narrative as
potential opportunities.

Findings in `sponsor_state: 'declined'` are excluded from your projection.

The unit convention is unchanged: all numeric values are total annual dollars,
not per-unit-per-month.
```

---

## Section 10 — Update Open Question Q5

**Old Q5:**

```
### Q5: M22 Post-Close feedback loop
Once M22 is live with `deal_monthly_actuals`, the platform learns which
Method 1 adoption rate projections actually matched reality...
```

**New Q5:**

```
### Q5: M22 Post-Close calibration via CIE

The CIE's calibration loop (per CIE spec Section 11 Phase 5) consumes M22
actuals to refine capex sourcing and adoption rate estimates for opportunity
findings. Once M22 has depth, CIE's "implement RUBS" finding shifts from
estimated capex to M22-actuals capex, dropping confidence flags and
tightening payback estimates.

For the agent's Other Income reasoning, M22 calibration appears indirectly
via CIE findings the sponsor accepts. The agent does not query M22 directly
for Other Income projections; it consumes the calibration through CIE's
findings.

**Recommendation:** the agent's prompt does not need to know about M22 for
Other Income. CIE handles M22 integration; agent reads CIE findings.
This keeps the agent's reasoning focused on projection and delegates
opportunity-detection to the platform.
```

---

## Section 12 — Update Changelog

**Add v1.2 entry at the top of the changelog:**

```
**v1.2 (current)**
- Method 4 (Archive Cohort Projection) removed — functionality absorbed into Method 1 + CIE
- Method 5 redefined as a reference to the Competitive Intelligence Engine
- Section 3 selection logic simplified — no Method 4 branch
- Section 6.3 expanded — bidirectional integration between Method 3 and CIE
- Section 7 agent prompt updated — agent reads CIE findings and incorporates accepted findings into projection
- Q5 updated — M22 calibration flows through CIE, not directly into Other Income reasoning
```

---

## Application order

1. v1.0 → v1.1 patch from `SPEC_TEXT_UPDATES_POST_AUDIT.md` (after unit mix PR 1 ships)
2. v1.1 → v1.2 patch (this document) (after CIE Phase 1 framework ships, even before all CIE finding types are implemented)

Both patches are independent — v1.2 doesn't depend on v1.1 being applied first; either order works.

---

## No structural changes to the three underwriting methods

Methods 1, 2, 3 are unchanged. Their selection logic is unchanged (modulo removing the Method 4 branch which was always a special case). The agent's job for producing the stated Pro Forma value is the same.

The change is purely about how opportunity detection is structured. v1.0 had it as Method 4/Method 5 inline. v1.2 has it as the CIE reference. This is the right separation of concerns: underwriting methods produce projections; CIE detects opportunities; the two interact via accepted findings flowing into the next projection.
