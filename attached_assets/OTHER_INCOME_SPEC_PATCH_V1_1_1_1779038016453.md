# OTHER INCOME REASONING METHOD SPEC — RECONCILIATION PATCH v1.1 → v1.1.1

**Purpose:** Three surgical edits to Replit's reconstructed v1.1 to tighten three loose ends:
1. Method 4 (Owned-Portfolio Analog) lacks deterministic selection criteria
2. Method 4 is ambiguously framed as both standalone method and overlay within Method 3
3. Method 5's relationship to the Competitive Intelligence Engine is "backward-compat only" rather than an active integration path

**Type:** Reconciliation patch — preserves Replit's owned-portfolio-analog insight (which is a genuine improvement over my v1.0 draft), tightens the surrounding structure.

**Apply directly to the v1.1 file Replit produced.** No version churn beyond a minor bump to v1.1.1.

---

## Why this patch

Replit's reconstruction of v1.1 from the patch documentation produced a coherent spec with one structural improvement and three loose ends. The improvement: promoting owned-portfolio analog from a source-within-Method-3 to its own named method. The loose ends are mechanical issues that will create ambiguity at implementation time:

- The selection function returns `'method_1' | 'method_2' | 'method_3'` — Method 4 is described in Section 2 but unreachable from selection logic
- Section 2.4 says Method 4 is "typically combined with Method 3 to fill gaps" (overlay framing), but its standalone section status implies it's an alternative method (standalone framing)
- Section 6.3 (CIE integration) treats CIE as a parallel system that supersedes Method 5. The cleaner architecture has CIE as the engine that *powers* Method 5, with accepted findings flowing into the agent's next reasoning pass

Three edits resolve all three.

---

## EDIT 1 — Add Method 4 to selection logic

### Section 3.1 — Update the selection function

**Find the existing selectOtherIncomeMethod function (likely in Section 3.1).**

**Replace the return type and body with:**

```typescript
function selectOtherIncomeMethod(
  dealContext: DealContext,
  dataAvailability: DataAvailability,
): 'method_1' | 'method_2' | 'method_3' | 'method_4' {

  // Pre-stabilization deals — no operating history
  const isPreStabilization = dealContext.classification === 'development' ||
                              dealContext.classification === 'lease_up' ||
                              (dealContext.classification === 'redevelopment' &&
                               dealContext.scope === 'full_repositioning');

  if (isPreStabilization) {
    // Method 4 takes priority over Method 1 when sponsor has directly comparable
    // owned assets with the same ancillary program
    if (hasDirectlyComparableOwnedPortfolio(dataAvailability)) {
      return 'method_4';
    }
    return 'method_1';
  }

  // Stabilized acquisition with no operational lift — T-12 is sufficient
  const isStabilizedNoLift = dealContext.classification === 'acquisition_stabilized' &&
                              !dealContext.strategy.includes_other_income_lift;

  if (isStabilizedNoLift && dataAvailability.t12_quality === 'high') {
    return 'method_2';
  }

  // Value-add and stabilized-with-lift deals
  // Method 4 wins when sponsor has directly comparable owned assets
  if (hasDirectlyComparableOwnedPortfolio(dataAvailability)) {
    return 'method_4';
  }

  // Default: rent roll triangulation
  return 'method_3';
}

function hasDirectlyComparableOwnedPortfolio(
  dataAvailability: DataAvailability,
): boolean {
  return (
    dataAvailability.owned_portfolio_match_quality === 'high' &&
    dataAvailability.owned_portfolio_has_ancillary_program === true &&
    dataAvailability.owned_portfolio_comparable_count >= 2
  );
}
```

### Section 3.1 — Update the DataAvailability interface

**Find the existing DataAvailability interface.**

**Add these three fields:**

```typescript
interface DataAvailability {
  // ... existing fields (t12_present, t12_quality, rent_roll_ancillary_detail, etc.)

  // NEW for Method 4 selection
  owned_portfolio_match_quality: 'high' | 'medium' | 'low' | 'absent';
  owned_portfolio_has_ancillary_program: boolean;
  owned_portfolio_comparable_count: number;
}
```

### Section 3.2 — Add Method 4 to the deal-type defaults table

**Find the deal-type defaults section (likely Section 3.2).**

**Update the table:**

| Deal Type | Default Method | Method 4 Override Condition |
|---|---|---|
| Acquisition (value-add) | Method 3 | Sponsor has 2+ directly comparable owned-portfolio assets with the same ancillary program |
| Acquisition (stabilized, no lift) | Method 2 | Same as above |
| Acquisition (stabilized, with lift) | Method 3 | Same as above |
| Development | Method 1 | Same as above |
| Redevelopment (full repositioning) | Method 1 | Same as above |
| Redevelopment (partial) | Method 3 | Same as above |
| Lease-up | Method 1 | Same as above |

The Method 4 override applies across all deal types when the owned-portfolio criteria are met. Method 4 takes priority because the sponsor's own actuals are higher fidelity than archive cohort or fee schedule projections.

---

## EDIT 2 — Clarify Method 4 as standalone (not overlay)

### Section 2.4 — Rewrite the framing

**Find the existing Method 4 section (Section 2.4 — Owned-Portfolio Analog).**

**Replace the text with:**

```
### Method 4 — Owned-Portfolio Analog

**When applicable:**

When the sponsor has directly comparable owned assets that operate the same
ancillary program as the subject deal will operate post-stabilization. The
criteria are strict:
- 2 or more comparable owned-portfolio assets (n ≥ 2)
- Asset class match (Class A for Class A, etc.)
- Vintage band within ±10 years of subject
- Submarket match or comparable submarket
- The ancillary program structure matches: same fee categories, similar
  adoption patterns, similar unit composition

When these criteria are met, the sponsor's own actuals are the highest-fidelity
projection available. Archive cohort and fee schedule projections are lower
fidelity by comparison.

**Inputs:**

- Sponsor's owned-portfolio actuals via `fetch_owned_asset_actuals`
- Per-category revenue at the comparable assets (P25/P50/P75 across the sponsor's
  comparable portfolio)
- Market adjustment factors: submarket rent index differential between subject
  and sponsor's comparable assets (to scale fees to subject's market)
- Renovation scope adjustment: if subject is being renovated differently than
  the sponsor's comparable assets, apply scope-driven adjustments per category

**Derivation:**

For each ancillary category present in the sponsor's owned-portfolio comparable
assets:

```
subject_category_revenue =
  sponsor_owned_portfolio_p50_per_category
  × market_adjustment_factor
  × subject_unit_count_ratio
```

Where:
- `sponsor_owned_portfolio_p50_per_category` is the median annual category revenue
  per unit at the sponsor's comparable assets
- `market_adjustment_factor` scales for rent index differentials between markets
- `subject_unit_count_ratio` scales for property size differences

Sum across categories to produce stabilized year Other Income.

**Output shape:**

- Per-category dollar values
- Aggregate
- Each category's evidence narrative names the specific comparable owned-portfolio
  assets used as anchor, with attribution
- `source: 'agent_method_4'` per category

**Method 4 is a standalone alternative to Method 3, NOT an overlay.**

When Method 4 is selected, it replaces Method 3's rent-roll-triangulation
approach with sponsor-portfolio-anchored projections. The subject's rent roll
detail (via otherIncomeMonthly) is still consulted for current state, but the
*stabilized projection* is sponsor-portfolio-driven, not rent-roll-driven.

When Method 4 is NOT selected (criteria not met), Method 3 applies with
owned-portfolio data feeding into Method 3's source hierarchy at lower priority
(below rent roll, above archive cohort). This is the standard pattern across
all methods.

**Confidence:**

- High when n ≥ 3 comparable owned-portfolio assets with matching ancillary program
- Medium when n = 2 OR ancillary program partial match
- Low when n < 2 (fall back to Method 3)

When confidence drops to low, the agent should switch to Method 3 rather than
proceed with weak Method 4.
```

---

## EDIT 3 — Tighten the CIE integration

### Section 2.5 — Rewrite Method 5

**Find the existing Method 5 section (Section 2.5 — Archive Cohort Projection / CIE reference).**

**Replace the text with:**

```
### Method 5 — Competitive Intelligence Engine reference

Method 5 is not a standalone reasoning method. It is the active integration
point between Other Income reasoning and the platform-wide Competitive
Intelligence Engine (CIE).

**Backward compatibility:**

In v1.0 of this spec, Method 5 was "Archive Cohort Projection" — a standalone
method using archive cohort distributions when no other data was available.
That standalone usage has been retired. Evidence labels carrying
`method: 'method_5'` or `source: 'archive_cohort_projection'` from v1.0-era
deals are retained for audit-trail consistency but no new evidence is produced
with these labels.

**Active integration with CIE:**

The CIE produces opportunity findings across the revenue domain, including
three finding types specifically for Other Income:
- `missing_ancillary_category`: cohort presence ≥ 50%; subject has none
- `underpriced_ancillary_fee`: subject rate < cohort P25
- `low_ancillary_adoption_rate`: subject adoption < cohort P25

These findings are durable artifacts the sponsor reviews and accepts, declines,
or defers.

**Consumption path — accepted CIE findings flow into the agent's reasoning:**

When the agent runs Other Income reasoning, it reads existing CIE findings
from DealContext:

```typescript
const ciFindings = dealContext.ci_findings
  .filter(f => f.domain === 'revenue')
  .filter(f => f.sponsor_state === 'accepted')
  .filter(f =>
    f.finding_type === 'missing_ancillary_category' ||
    f.finding_type === 'underpriced_ancillary_fee' ||
    f.finding_type === 'low_ancillary_adoption_rate'
  );
```

For each accepted finding, the agent incorporates the recommended change into
its projection:

- **Accepted `missing_ancillary_category`** → adds the category to the
  stabilized year per-category breakdown using Method 1 logic (fee schedule ×
  adoption × applicable units). The category appears in the Pro Forma even
  though it's not in the current rent roll.

- **Accepted `underpriced_ancillary_fee`** → adjusts the category's rate to
  the cohort P50 (or sponsor's chosen positioning) in the stabilized year
  projection. The current rate is preserved in pre-stabilization year(s);
  the adjustment phases in.

- **Accepted `low_ancillary_adoption_rate`** → adjusts the category's
  adoption rate to cohort P50 in the stabilized year projection. Same
  phase-in pattern as rate adjustments.

Findings in `sponsor_state: 'unreviewed'` or `'deferred'` do NOT feed the
projection but are referenced in the evidence narrative as opportunities the
sponsor has not yet acted on.

Findings in `sponsor_state: 'declined'` are excluded entirely.

**This is the feedback loop:**

The agent produces the projection (Methods 1-4). CIE compares the projection
against cohort and surfaces findings. The sponsor reviews findings and decides.
Accepted findings flow back into the agent's next projection. Each cycle
progressively closes the gap between the subject deal's underwriting and the
comparable cohort's realized achievement.

**Method 5 is not selected via the selection function.** It is *always active*
when CIE findings exist. The selection function returns Method 1-4 for the
projection method; Method 5's findings are incorporated regardless of which
projection method is selected.

See `COMPETITIVE_INTELLIGENCE_ENGINE_SPEC.md` for full CIE coverage including
the universal finding shape, severity classification, and sponsor interaction
model.
```

### Section 6.3 — Replace with the bidirectional integration text

**Find Section 6.3 (With Competitive Intelligence Engine).**

**Replace the text with:**

```
### 6.3 With Competitive Intelligence Engine — bidirectional integration

The CIE is the platform-wide opportunity detection engine. For Other Income,
CIE produces three finding types covering categories the agent's underwriting
might miss or underprice.

**Bidirectional integration:**

1. **Agent → CIE:** The agent's stated Pro Forma value (via Methods 1-4) flows
   into CIE's comparison. CIE compares the projection against archive cohort
   distribution and produces findings where the agent's projection is
   structurally below cohort norm.

2. **CIE → Agent:** Sponsor-accepted CIE findings flow into the agent's next
   Other Income reasoning pass via Method 5 (the CIE reference). The agent's
   next projection incorporates the accepted findings.

This is a feedback loop. Each agent run + CIE pass progressively closes the
gap between the subject deal's underwriting and the comparable cohort's
realized achievement. The platform learns the deal's value-creation envelope
over time.

**Method 5 is the consumption side of the loop.** CIE produces findings;
Method 5 (referenced from whichever projection method is active) consumes
accepted findings. The two specs together describe the complete loop —
this spec covers the agent's consumption pattern; the CIE spec covers the
production pattern.
```

---

## CHANGELOG ADDITION

### Section 12 (Changelog) — add v1.1.1 entry at the top

```
**v1.1.1 (current)**
- Added Method 4 to the selection function with deterministic criteria
  (owned-portfolio match quality + ancillary program match + n ≥ 2 comparables)
- Added DataAvailability fields supporting Method 4 selection
- Clarified Method 4 as a standalone alternative to Method 3, not an overlay
- Rewrote Section 2.5 (Method 5) as the active CIE integration point rather
  than backward-compat-only
- Rewrote Section 6.3 to specify the bidirectional integration loop
- Each accepted CIE finding now has a documented consumption path in the agent's
  next reasoning pass
- No changes to Methods 1, 2, or 3
```

---

## VERIFICATION

After applying the three edits, verify:

1. The selection function returns Method 4 deterministically when criteria are met
2. The DataAvailability interface includes the three new fields
3. Section 2.4 reads as a standalone method (not an overlay)
4. Section 2.5 specifies CIE consumption logic (not just backward-compat)
5. Section 6.3 describes bidirectional integration with both directions clear
6. The deal-type defaults table has the Method 4 override condition column
7. No structural changes to Methods 1, 2, or 3

### Test the selection logic against three scenarios

**Scenario A:** Development deal, sponsor has 3 comparable owned-portfolio assets with same ancillary program
- Expected: Method 4 selected

**Scenario B:** Value-add deal, sponsor has 1 owned-portfolio asset with similar ancillary program
- Expected: Method 3 selected (n < 2 criteria fails)

**Scenario C:** Stabilized acquisition, no operational lift, T-12 quality high, sponsor has 5 owned-portfolio assets
- Expected: Method 2 selected (Method 4 override doesn't apply because deal type doesn't include lift; Method 2 wins on its criteria)

If any scenario produces an unexpected method, the selection logic needs further refinement.

---

## WHAT THIS PATCH PRESERVES

Replit's structural improvement — promoting owned-portfolio analog to a named method — is preserved. This is a genuine analytical insight that wasn't in my v1.0 draft and shouldn't be lost.

What this patch tightens:
- Method 4 is now selectable, not orphaned
- Method 4 is now clearly standalone, not ambiguously overlay
- Method 5 is now actively integrated with CIE, not just historical reference

Three surgical edits. The spec's architecture (five methods total) is unchanged. The mechanical clarity improves.

---

## APPLICATION ORDER

1. Apply Edit 1 (selection logic + DataAvailability interface + defaults table)
2. Apply Edit 2 (Method 4 standalone clarification)
3. Apply Edit 3 (Method 5 + Section 6.3 CIE integration)
4. Add v1.1.1 changelog entry
5. Run the three verification scenarios

Estimated effort: 20-30 minutes of editing. No new architecture.
