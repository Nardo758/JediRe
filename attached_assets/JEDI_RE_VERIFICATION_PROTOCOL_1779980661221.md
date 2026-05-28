# JEDI RE — VERIFICATION PROTOCOL

**Purpose:** Confirm that changes shipped by Replit (or any implementer) actually work — against the live database and real data, not just against the implementer's own claim of "done." Companion to `JEDI_RE_MASTER_PLAN_FOR_REPLIT.md`.

**Why this exists:** Implementers report "done" when code is written and structurally plausible. This session produced two failures that passed the implementer's own check but failed reality:
- The TN tax `assessmentRatio` was set to `0.25` (residential) instead of `0.40` (commercial) — wrong number inside complete-looking code.
- `mv_market_rent_benchmarks` was reported "shipped" but does not exist in the database — code referenced an object that was never materialized.

Both would have produced wrong platform behavior indefinitely. This protocol's entire job is to **test reality, not re-read the implementer's claims.**

---

## THE THREE LAYERS

Every change is confirmed in order. Stop at the first failure; don't proceed to the next layer until the current one passes.

| Layer | Question | Catches |
|---|---|---|
| **Layer 1 — Exists where it runs** | Does the thing physically exist in the runtime environment? | The "shipped but not real" class (missing mv view) |
| **Layer 2 — Correct on real data** | Does it produce correct values against an authoritative external reference? | The "complete but wrong" class (TN assessmentRatio) |
| **Layer 3 — Defensible end-to-end** | Does the full chain produce the right answer on a deal where we know the answer? | The "pieces work but integration is broken" class |

Layers 1–2 run per dispatch (this document). Layer 3 runs per wave (see `JEDI_RE_BACKTEST_HARNESS_SPEC.md`).

---

## THE GOVERNING PRINCIPLE

> **Confirmation tests reality, not the implementer's description of reality.**

Concretely, this means:
- "The migration file exists" is NOT confirmation. "The object exists in the database the app connects to" IS.
- "The route is defined" is NOT confirmation. "The endpoint returns HTTP 200 with a real payload" IS.
- "The function computes X" is NOT confirmation. "The computed value matches an authoritative external reference" IS.
- "The closing note says it works" is NEVER confirmation on its own.

When the implementer's description and the live state diverge, **the live state is authoritative.**

---

## LAYER 1 — EXISTS WHERE IT RUNS

Mechanical, fast. Run first. For each change, the check depends on type:

### Database objects (table, column, view, index, migration)
```sql
-- Confirm a table/view exists
SELECT table_name FROM information_schema.tables
WHERE table_name = '<object_name>';

-- Confirm a column exists on a table
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = '<table>' AND column_name = '<column>';

-- Confirm a materialized view exists AND has rows
SELECT COUNT(*) FROM <mv_name>;   -- errors if view absent; 0 rows is itself a finding
```
**Pass:** object exists in the database the application actually connects to (confirm the connection string / environment — dev vs staging vs prod divergence is a real failure mode).
**Fail:** "the migration file exists in the repo" — that is not Layer 1 pass.

### API endpoints
```bash
curl -i -H "Authorization: Bearer <token>" \
  https://<host>/api/v1/<endpoint>
```
**Pass:** HTTP 200 (or correct status) with a real, non-empty payload.
**Fail:** HTTP 500, route-not-found, or empty/placeholder response.

### Services / functions
- Grep for the call site — is the function actually invoked in the runtime path, or orphaned?
- Confirm it's registered (tool registry, route mount, config array) where registration is required.

**Fail:** function exists but nothing calls it; tool defined but not registered.

---

## LAYER 2 — CORRECT ON REAL DATA

For each change, identify the **authoritative external reference** and check output against it. Internal consistency ("the code agrees with itself") is not enough — the value must match reality.

### The reference hierarchy (what counts as authoritative)
1. **External published source** — county assessor rate, FRED series value, published cap rate index
2. **Operator ground truth** — you know the right comps, the actual units, the real sale price
3. **Cross-source agreement** — two independent platform sources produce the same value
4. **Sanity bounds** — value falls within a believable range for the domain (a 2% or 15% multifamily cap rate is a red flag)

### Required spot-check per change
At minimum, one numeric value per change is checked against an authoritative reference. Document:
- The value the change produced
- The authoritative reference value
- The delta
- Verdict: CONFIRMED / OFF-BY-X / CONTRADICTED

---

## PER-DISPATCH CHECKLISTS

Concrete Layer 1 + Layer 2 checks for the master plan's dispatches. Each is a contract: these checks must pass before the dispatch is APPROVED.

### D-DEAL-1 — Diagnose properties↔deals join
- **L1:** `SELECT COUNT(*), COUNT(deal_id) FROM properties;` returns real counts
- **L1:** join query for 464 Bishop returns a row (or confirms absence)
- **L2:** if a row exists, units/sqft/year_built match the OM or county record for 464 Bishop
- **Pass:** we know definitively whether the subject side has data and why

### D-DEAL-2 — Subject record population pipeline
- **L1:** after pipeline runs, `properties` row exists for the test deal with `deal_id` populated
- **L2:** units, sqft, year_built match authoritative source (county/OM) — spot-check each against the document
- **L2:** geocode (lat/lng) places the property at the correct physical location (eyeball on a map)
- **Pass:** subject characteristics are present AND correct, not just present

### D-COMP-1 — Comp relevance scoring
- **L1:** scoring endpoint returns a ranked comp list (HTTP 200, non-empty)
- **L2:** run on a deal you know — do the top-ranked comps match the comps you'd pick? Does it correctly *exclude* obviously-wrong comps (different class, stale, wrong submarket)?
- **L2:** sanity — are relevance scores monotonic with the inputs (closer/more-recent/better-class scores higher)?
- **Pass:** the ranking matches operator judgment on a known deal

### D-COMP-2 — Strategy-aware comp story selection
- **L1:** selection reads `investmentStrategy` and returns different comp sets for different strategies on the same subject
- **L2:** for a value-add deal, does it surface BOTH current-condition and renovated comps (the rent-ceiling gap)? For stabilized, does it emphasize cap-rate-convergence comps?
- **Pass:** the comp set tells the strategy's story, verified against the 2.4 matrix in the master plan

### D-COMP-3 — Geographic cascade
- **L2:** on a deal with thin trade-area comps, does it expand to submarket WITH an explicit flag? Does it stop at the first tier with ≥5 comps?
- **L2:** comp set labels each comp's geographic source (trade area / submarket / MSA)
- **Pass:** no silent tier-mixing; expansion is flagged and confidence-decayed

### D-COSTAR-1/2 — Upload + parser
- **L1:** uploaded CoStar file lands in the data library, tagged by type
- **L1:** parser produces rows in the target comp table
- **L2:** parsed values match the source file — spot-check 3 rows (sale price, date, units) against the CoStar export
- **L2:** `data_as_of` reflects CoStar's date, not the ingest date
- **Pass:** CoStar data is in the platform AND the values are faithful to the source

### D-COSTAR-3 — Dedup + reconciliation
- **L2:** ingest a CoStar comp that duplicates an existing platform comp — confirm it dedups (one record, both sources noted), doesn't double-count
- **L2:** comp set summary shows the platform/CoStar blend correctly
- **Pass:** no double-counting; provenance preserved

### D-MOD-1/2/3 — Module mapping, conflict resolution, reasoning order
- **L1:** the assumption→module mapping exists as a readable config (not hardcoded)
- **L2:** force a cross-module disagreement (e.g., M07 vs M28 on absorption) — confirm authoritative module wins, supporting module adjusts within band, material disagreement surfaces in evidence trail
- **L2:** agent reasoning follows the defined order; keystone cascade (M02→M03→M08→M09) is respected
- **Pass:** conflicts surface rather than silently resolving; order holds

### F9 Batch 3 — Capital Structure (audit M11 first)
- **L1:** confirm `capital-structure.service.ts` exists and what it computes (P9.B — reference, don't re-specify)
- **L2:** for a known deal, debt sizing (LTV, DSCR) matches what a lender would actually offer given the NOI and rate environment
- **L2:** agent prompt aligned to canonical in the same dispatch (P9.A)
- **Pass:** M11 referenced not duplicated; debt terms are realistic

### Valuation Grid — comp-anchored cap rate synthesis (Path B)
- **L1:** Cap×NOI method reads from the comp set, not from hardcoded defaults
- **L2:** synthesized NOI per comp is believable (revenue and OpEx per unit in normal range for the submarket/class)
- **L2:** implied cap rate per comp lands in a believable band (not 2%, not 15%)
- **L2:** the aggregate market cap rate matches published submarket cap rates for that asset class (±50bps sanity, not the acceptance bar)
- **Pass:** the synthesis produces realistic per-comp and aggregate values

---

## REUSABLE TEMPLATE (for any new dispatch)

```
DISPATCH: <name>

LAYER 1 — EXISTS WHERE IT RUNS
[ ] Database objects exist in the live DB (query information_schema)
[ ] Endpoints return HTTP 200 with real payloads (curl)
[ ] Services are wired into the call path, not orphaned (grep call sites)

LAYER 2 — CORRECT ON REAL DATA
[ ] Identify the authoritative reference for the key output
[ ] Spot-check ≥1 numeric value against that reference
[ ] Confirm output falls within sanity bounds for the domain
[ ] Document: produced value, reference value, delta, verdict

VERDICT: APPROVED / NEEDS AMENDMENT / NEEDS REWORK
- APPROVED: all L1 + L2 checks pass
- NEEDS AMENDMENT: minor gap, fixable inline (e.g., one wrong value, one rename)
- NEEDS REWORK: structural failure (object doesn't exist, logic produces nonsense)
```

---

## THE VERIFICATION DISPATCH PATTERN

This protocol runs as a **separate verification pass after the implementation dispatch**, not as part of it. Same discipline used throughout the session:

1. Implementer ships, reports "done" with a closing note
2. **Verification pass runs Layers 1–2** against the specific claims — querying the live DB, hitting endpoints, comparing to ground truth
3. Verdict appended to the dispatch's closing note
4. Only after APPROVED does the next dependent dispatch fire
5. Per wave, Layer 3 backtest confirms integration (separate spec)

The implementer verifying their own work is necessary but not sufficient — the verification pass is independent and adversarial: it tries to find where reality diverges from the claim.

---

## WHAT "NEEDS AMENDMENT" VS "NEEDS REWORK" MEANS

- **NEEDS AMENDMENT** — the change is structurally right but has a discrete, fixable defect. One wrong number, one column rename, one missing flag. Fix inline, re-verify the fixed item. (The TN assessmentRatio was a NEEDS AMENDMENT — wrong value, right structure.)
- **NEEDS REWORK** — the change fails structurally. The object doesn't exist, the logic produces nonsense, the approach is wrong. Back to the implementer with the diagnosis. (A missing mv view that the whole feature depends on is closer to REWORK.)

Default to AMENDMENT where the fix is bounded; reserve REWORK for genuine structural failure.
