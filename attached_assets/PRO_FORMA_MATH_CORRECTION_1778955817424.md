# PRO FORMA MATH CORRECTION v1.1 — INCLUDES OTHER INCOME

**Supersedes:** v1.0
**Changes from v1.0:**
- Adds Other Income as a hierarchical subtotal with breakdown components
- Adds breakdown-vs-aggregate reconciliation for mixed-source subtotals
- New finding type: `breakdown_aggregate_mismatch` (separate from `subtotal_mismatch`)
- Source resolution rule: Rent Roll > OM > T-12 aggregate > platform fallback
- Updated screenshot analysis includes the second screenshot's Other Income page

---

## 1. WHAT THE SECOND SCREENSHOT REVEALED

The Other Income breakdown view shows the same structural bug class as the main Pro Forma — subtotals not matching their components — but with an additional dimension: **the value can come from either breakdown components or an aggregate source, depending on what's available**.

### Bug — Other Income breakdown vs aggregate mismatch

The breakdown rows sum to one value; the header row shows another:

```
Parking / Garage         --
Pet                      $8,648
Storage                  $4,920
Washer / Dryer           --
Utility Reimbursements   $15,936
Fees                     --
Insurance Admin          --
Other                    $158,884
Cable                    $139,200
─────────────────────────────────
Breakdown sum:           $327,588
Header / TOTAL row:      $319,500
Delta:                   $8,088 (~2.5%)
```

The platform is showing both, sourced differently: the breakdown is sourced from Rent Roll/OM where per-category detail exists; the header/aggregate is sourced from T-12, which publishes Other Income as a single number.

### Why this is structurally different from the v1.0 bugs

The v1.0 bugs were "subtotal computed from wrong formula" — pure math errors. This is different. Both the $327,588 and the $319,500 are correct numbers in their respective sources. The problem is:

1. **The platform doesn't choose between them with a documented rule** — currently showing both, which confuses the user.
2. **The platform doesn't flag the delta as a reconciliation finding** — the user has to spot it manually.
3. **The downstream math (EGI, NOI) is unclear about which value it uses** — different runs may pick differently, causing the EGI to swing $8k+ on the same deal.

This is a real, common pattern in real estate underwriting: aggregate sources and breakdown sources coexist and rarely tie perfectly. The platform's job is to resolve them deterministically and surface the reconciliation transparently.

---

## 2. THE FIX — HIERARCHICAL SUBTOTAL HANDLING

The math engine v1.1 introduces `hierarchical_subtotal` as a new line item kind, distinct from regular `subtotal`. The Other Income config:

```typescript
'proforma.revenue.other_income': {
  kind: 'hierarchical_subtotal',
  hierarchical_config: {
    breakdown_paths: [
      'proforma.revenue.other_income.parking',
      'proforma.revenue.other_income.pet',
      'proforma.revenue.other_income.storage',
      // ... 9 total breakdown components
    ],
    aggregate_sources: ['t12'],            // T-12 publishes single number
    breakdown_sources: ['rent_roll', 'om'], // Rent Roll + OM publish detail
    source_priority: ['rent_roll', 'om', 't12', 'platform_fallback'],
    reconciliation_tolerance_pct: 0.05,    // 5% tolerance band
    reconciliation_tolerance_dollars: 5000,
  },
}
```

The engine applies this config at validation time:

1. **Check what sources are available.** If breakdown components are present with Rent Roll or OM sources, the breakdown source wins (per priority). If only T-12 is present, the aggregate value is used.

2. **Compute the resolved value.** Either the sum of breakdown components or the T-12 aggregate, based on priority.

3. **Reconcile if both available.** Compute `breakdown_sum - aggregate_value`. If within tolerance, mark `within_tolerance` and proceed quietly. If outside tolerance, surface as `minor_mismatch` or `major_mismatch` finding.

4. **Use the resolved value in downstream subtotals.** EGI and NOI consume the resolved value, not the raw stored aggregate. This eliminates the "EGI flips by $8k depending on which source the engine picked" problem.

---

## 3. APPLIED TO THE SCREENSHOT

The Other Income row in the Resolved column with the engine v1.1 produces:

```
RESOLUTION FOR proforma.revenue.other_income:
  Breakdown sum (from Rent Roll + OM):  $327,588
  T-12 aggregate:                        $319,500
  Reconciliation delta:                  +$8,088 (+2.53%)
  Reconciliation status:                 MINOR_MISMATCH (within ~2.5% but above 5000 dollar tolerance)
  Resolution method:                     breakdown_sum
  Resolution source:                     rent_roll (highest priority)
  RESOLVED VALUE:                        $327,588
```

What this means for the displayed Pro Forma:

- The Resolved column's Other Income changes from $319,500 to **$327,588**
- The minor_mismatch finding surfaces in the validation report with both values shown for transparency
- The UI should display the resolved value as primary with a small reconciliation chip: "Reconciled from Rent Roll detail; T-12 aggregate $319,500 within 2.5% tolerance"

Then EGI recomputes:

```
Base Rental Revenue (corrected from v1.0):   $3,567,362
Other Income (corrected in v1.1):            $327,588
─────────────────────────────────────────────────────
EGI:                                          $3,894,950
```

Compared to the original $3,808,352, EGI is now higher by **$86,598** — the combination of the v1.0 Base Rental fix ($77k) plus the v1.1 Other Income fix ($8k).

And NOI recomputes:

```
EGI:           $3,894,950
- Total OpEx:  $1,873,015
─────────────────
NOI:           $2,021,935
```

Compared to the corrected v1.0 NOI of $2,013,847, now $2,021,935. Compared to the original broken $673,798, the total error was $1.35M understatement of NOI.

---

## 4. UI RECOMMENDATIONS FOR HIERARCHICAL VIEW

The Other Income breakdown view in the screenshot has some good elements and some that should change:

### What's working
- The breakdown rows are visible — sponsor can see what comprises Other Income
- The source pills (rent_roll, om, platform_fallback) are present
- The column structure (Broker / T-12 / Platform / Resolved) is consistent with the rest of the platform

### What needs changing

**1. The TOTAL OTHER INCOME row at the bottom should reflect the resolved value, with a reconciliation badge.**

Currently shows $319,500 in Resolved (which is the T-12 aggregate). After the engine v1.1 runs, this should show:

```
TOTAL OTHER INCOME:  $327,588  ⓘ Reconciled (Rent Roll detail vs T-12 aggregate +$8,088 / +2.5%)
```

The badge is clickable; opens a panel showing the reconciliation detail.

**2. The Other Income header row at the top (above the breakdown expand) should reflect the same resolved value.**

Currently shows $319,500. Should show $327,588 with the same reconciliation badge.

**3. The reconciliation status should be color-coded.**

- `within_tolerance` (≤5% delta, ≤$5k): no badge, just resolved value
- `minor_mismatch` (5-25% delta or $5k-$25k): yellow info badge
- `major_mismatch` (>25% delta or >$25k): red warning badge with mandatory user acknowledgment before proceeding

**4. The breakdown rows should distinguish their source visibility.**

When a category exists in Rent Roll but not in T-12 (e.g., Pet, Storage), the source pill should make this clear. The current pills (rent_roll, om, platform_fallback) work but they could be more explicit about "this came from breakdown source, not aggregate."

**5. The footnote text "Resolution priority per category: Rent Roll → OM → T-12 only publishes an aggregate (no per-category breakdown). Override + custom lines persist to deal_assumptions and flow into NOI."**

This is actually a really good explanation — keep it, but tie it visually to the reconciliation badge. When user hovers over the badge, this text should be the primary content of the tooltip.

---

## 5. PATTERN GENERALIZATION

Other Income is the first hierarchical subtotal but won't be the last. The same pattern applies to:

- **Concessions** — T-12 publishes a single number; Rent Roll might publish per-unit concession detail
- **Vacancy Loss** — T-12 publishes a single number; Rent Roll publishes per-unit vacancy
- **Repairs & Maintenance** — T-12 may publish single number; broker OM may publish detail by category (HVAC, plumbing, etc.)
- **Property Tax** — typically single-source (T-12 + jurisdiction forecast), but in mixed-use properties may have per-component breakdown

For each of these, the same pattern applies:
1. Define the breakdown components in `LINE_ITEM_CONFIG` with `parent_subtotal` pointing to the hierarchical subtotal
2. Configure the hierarchical subtotal with `aggregate_sources`, `breakdown_sources`, `source_priority`, and tolerance bands
3. The engine handles resolution and reconciliation automatically

The architectural cost of this pattern is small (one config entry per hierarchical line item) but the analytical value is high — it eliminates the "which value is the platform using" ambiguity for every mixed-source subtotal.

---

## 6. SOURCE METADATA — NEW DATA SHAPE REQUIREMENT

For the engine to apply source priority correctly, the agent's output needs to include source metadata per field. The shape:

```typescript
agentOutput.source_metadata: {
  [columnName]: {
    [fieldPath]: SourceType   // 'rent_roll' | 'om' | 't12' | 'platform_fallback' | 'user_override'
  }
}
```

Example:

```json
{
  "source_metadata": {
    "resolved": {
      "proforma.revenue.other_income.parking": "platform_fallback",
      "proforma.revenue.other_income.pet": "rent_roll",
      "proforma.revenue.other_income.storage": "rent_roll",
      "proforma.revenue.other_income.cable": "om",
      "proforma.revenue.other_income.other": "om",
      "proforma.revenue.other_income": "t12"
    }
  }
}
```

The Cash Flow Agent already has this signal — every evidence object carries a source label per the canonical evidence schema. The post-processor extracts source labels and assembles the `source_metadata` map before passing to the math engine.

**One-line agent prompt update:** "Every numeric value you emit carries a source label in its evidence object. The platform's math engine uses these source labels to resolve mixed-source subtotals correctly. Do not omit source labels — they are not optional metadata; they are critical for math integrity."

---

## 7. INTEGRATION STEPS (updated for v1.1)

### Step 1 — Replace v1.0 engine with v1.1
Save the new `proFormaMathEngine.ts` over the v1.0 version. Backward compatible — all v1.0 functions still work; v1.1 adds the hierarchical handling.

### Step 2 — Update post-processor to pass source_metadata
The post-processor already extracts evidence per field. Extend it to assemble the `source_metadata` map and pass to `correctSnapshotMath`. Roughly 5 lines of code in `cashflowPostProcess.ts`.

### Step 3 — Add the breakdown paths to the agent's output schema
The agent should emit per-category Other Income values in addition to (or instead of) the aggregate. The output schema is extended:

```typescript
proforma.revenue.other_income.parking: number | null
proforma.revenue.other_income.pet: number | null
proforma.revenue.other_income.storage: number | null
proforma.revenue.other_income.washer_dryer: number | null
proforma.revenue.other_income.rubs: number | null
proforma.revenue.other_income.fees: number | null
proforma.revenue.other_income.insurance_admin: number | null
proforma.revenue.other_income.cable: number | null
proforma.revenue.other_income.other: number | null
proforma.revenue.other_income: number                    // aggregate or null if breakdown-only
```

When the agent only has T-12 data, it emits the aggregate and leaves breakdowns null. When it has Rent Roll data, it emits breakdowns. The engine handles both cases.

### Step 4 — UI rendering updates
Per Section 4. The Other Income view should:
- Show the resolved value as primary
- Show the reconciliation badge with status
- Make the breakdown rows expand/collapse cleanly
- Use color coding for status severity

### Step 5 — Database schema (same as v1.0)
The `math_validation_report` JSONB column already holds the per-column validation results; v1.1 just adds more finding types and the hierarchical_resolutions field. No schema migration needed beyond what v1.0 specified.

### Step 6 — Unit tests
The test sketches at the bottom of `proFormaMathEngine.ts` v1.1 include the new hierarchical resolution cases:
- Breakdown sum computation
- Reconciliation finding on mismatch
- Source priority resolution (breakdown source wins over aggregate source)
- Fallback to aggregate when breakdown not available

---

## 8. WHAT THE FULLY CORRECTED PRO FORMA LOOKS LIKE

Combining v1.0 and v1.1 fixes:

| Line Item                        | Before (broken) | After v1.0      | After v1.1 (current) |
|----------------------------------|-----------------|-----------------|----------------------|
| GPR                              | $4,980,000      | $4,980,000      | $4,980,000           |
| Loss to Lease                    | ($17,142)       | ($17,142)       | ($17,142)            |
| Vacancy & Credit Loss            | ($971,829)      | ($971,829)      | ($971,829)           |
| Concessions                      | ($381,395)      | ($381,395)      | ($381,395)           |
| Bad Debt                         | ($42,272)       | ($42,272)       | ($42,272)            |
| Non-Revenue Units                | $0              | $0              | $0                   |
| **Base Rental Revenue**          | **$3,490,000**  | **$3,567,362**  | **$3,567,362**       |
| Other Income (resolved)          | $319,500        | $319,500        | **$327,588**         |
|   - Parking                      | —               | —               | $0                   |
|   - Pet                          | —               | —               | $8,648               |
|   - Storage                      | —               | —               | $4,920               |
|   - Washer/Dryer                 | —               | —               | $0                   |
|   - RUBS                         | —               | —               | $15,936              |
|   - Fees                         | —               | —               | $0                   |
|   - Insurance Admin              | —               | —               | $0                   |
|   - Cable                        | —               | —               | $139,200             |
|   - Other                        | —               | —               | $158,884             |
| **EGI**                          | **$3,808,352**  | **$3,886,862**  | **$3,894,950**       |
| **Controllable OpEx**            | **$604,940**    | **$604,280**    | **$604,280**         |
| **Non-Controllable OpEx**        | **$1,268,735**  | **$1,268,735**  | **$1,268,735**       |
| **Total OpEx**                   | **$3,134,554**  | **$1,873,015**  | **$1,873,015**       |
| **NOI**                          | **$673,798**    | **$2,013,847**  | **$2,021,935**       |
| Replacement Reserves             | ($58,000)       | ($58,000)       | ($58,000)            |
| **NOI After Reserves**           | **$615,798**    | **$1,955,847**  | **$1,963,935**       |

**Total NOI correction across all bugs: +$1,348,137** (from the original broken $673,798 to the corrected $2,021,935).

At a 5.65% stabilized cap rate, the property's stabilized value moves from $11.9M (broken) to $35.8M (corrected) — a $24M error fully resolved.

---

## 9. WHY HIERARCHICAL HANDLING MATTERS LONG-TERM

The Other Income pattern — mixed-source subtotal with breakdown components — is endemic in real estate underwriting. T-12 financial statements publish aggregates because that's the accounting convention; rent rolls publish detail because that's what operators actually track. Broker OMs sit between, sometimes aggregate, sometimes detail.

A platform that doesn't handle this duality cleanly produces math errors *by design* — there's no formula that correctly handles "aggregate source for one cell, breakdown source for the breakdown rows" without an explicit reconciliation rule.

The engine v1.1 makes this duality a first-class concept. Every mixed-source line item in the platform now has a place to live and a deterministic resolution path. Adding new hierarchical subtotals (Concessions, R&M, etc.) is a config-only change going forward — no new code, no new validators, no new finding types. The architecture pays compounding returns each time the pattern recurs.

---

## 10. ACCEPTANCE CRITERIA (v1.1)

All v1.0 criteria, plus:

11. Other Income breakdown components are defined in `LINE_ITEM_CONFIG` with `parent_subtotal` references
12. Other Income hierarchical config specifies breakdown_sources, aggregate_sources, source_priority, tolerance bands
13. `resolveHierarchicalSubtotal` correctly applies source priority (Rent Roll > OM > T-12 > fallback)
14. Reconciliation findings surface when breakdown sum and aggregate value differ beyond tolerance
15. Finding type `breakdown_aggregate_mismatch` is distinct from `subtotal_mismatch` in the validation report
16. Source metadata is collected by the post-processor and passed to the validator
17. The UI Other Income view displays the resolved value with the reconciliation badge
18. On the screenshot's specific data, the resolved Other Income is $327,588 (breakdown sum from Rent Roll/OM) with a minor_mismatch chip showing the $8,088 delta to the T-12 aggregate
19. Total NOI on the corrected snapshot is $2,021,935 (v1.1) or $2,013,847 (v1.0 only), not the original $673,798

---

## 11. ON THE PHRASE "T-12 PUBLISHES AN AGGREGATE (NO PER-CATEGORY BREAKDOWN)"

The footnote text in the screenshot is genuinely accurate and worth preserving. It captures a real structural fact about T-12 financial statements: they're produced by accounting systems that summarize Other Income to a single line, while rent roll systems track per-category fees individually.

The math engine v1.1 honors this fact rather than trying to work around it. The footnote should remain in the UI as the canonical explanation of why both values exist and why one is sometimes preferred over the other.

The added intelligence is that the platform now **chooses deterministically and reconciles transparently**. The user no longer has to wonder "which number is right" — both are correct in their respective sources, and the platform tells them which one it's using and why.
