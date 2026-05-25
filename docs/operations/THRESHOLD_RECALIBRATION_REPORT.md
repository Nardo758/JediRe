# Threshold Recalibration Report — Phase 8 DQ Formula Change

Generated: 2026-05-25
Status: **AWAITING LEON'S APPROVAL — do not apply changes**

---

## Background

Phase 8 changed the DQ scoring formula:

| | Old formula | New formula |
|---|---|---|
| Base fields | 10 fields × 10 pts = 100 pts max | Same |
| Phase 8 bonus | none | narrative(5) + amenities(5) + photos(3) + reviews(5) + sentiment(3) + events(2) + regulatory(7) = 30 pts max |
| Denominator | 100 pts | 130 pts |
| Normalization | score = raw (0–100) | score = round(raw / 130 × 100) |

For assets with **no Phase 8 data** (all 299 assets at backfill time):
- Old formula score = base_pts
- New formula score = round(base_pts / 130 × 100) = base_pts × 0.769

For a fully-enriched asset (base + all Phase 8):
- Old max: 100 → new max: 100 (same scale, because 130/130 × 100 = 100)

The formula change compresses scores for non-enriched assets by ~23%.
As operators Apply enrichment, scores recover toward the 0–100 range.

---

## Current Distribution (299 assets, post-DQ backfill, pre-Places enrichment)

| Band | Count | % |
|---|---|---|
| 0 | 51 | 17.1% |
| 1–29 | 8 | 2.7% |
| 30 | 186 | 62.2% |
| 31–39 | 15 | 5.0% |
| 40–49 | 5 | 1.7% |
| 50–60 | 34 | 11.4% |
| **Total** | **299** | **100%** |

Mean: 28.4 · Min: 0 · Max: 60 · P25/P50/P75: 30/30/30

---

## Consumer 1: archive-benchmark-aggregator.ts:86 — comps pool filter

**Purpose:** Filters the comps pool for benchmark aggregation. Only assets scoring ≥ N contribute to market benchmarks.

**Current code:** `AND data_quality_score >= 50`

### Pass-count analysis

To reconstruct old-formula counts: old_score = new_score / 0.769 (reverse the compression).
Old threshold >= 50 → new equivalent: round(50 / 130 × 100) = 38.

| Metric | Count | % of 299 |
|---|---|---|
| Estimated old-formula pass count (≥ 50 old scale) | 39 | 13.0% |
| **Current new-formula pass count (≥ 50)** | **34** | **11.4%** |
| New formula at ≥ 38 (preserves old pass rate) | 39 | 13.0% |

**Rate shift:** −1.6 percentage points (34 vs 39 assets pass).

### Proposed threshold options

| Option | Threshold | Pass count | Rationale |
|---|---|---|---|
| A — Keep current | ≥ 50 | 34 (11.4%) | Stricter quality bar; fewer but higher-quality comps |
| B — Rate-preserving | ≥ 38 | 39 (13.0%) | Preserves pre-Phase-8 semantics exactly |
| C — Post-enrichment target | ≥ 50 | ~80–120 est. | After Places enrichment applied, scores will rise; threshold stays |

**Recommendation:** Option A (keep ≥ 50). Score compression is intentional — it reflects that non-enriched assets are genuinely less complete. Once operators Apply enrichment results, scores rise naturally. Lowering the threshold now would admit lower-quality assets into the benchmark pool.

---

## Consumer 2: archive-benchmark-aggregator.ts:579 — unit-count filter

**Purpose:** Filters for the per-unit financial metrics aggregation. Lower threshold than comps pool.

**Current code:** `AND data_quality_score >= 40`

### Pass-count analysis

Old threshold >= 40 → new equivalent: round(40 / 130 × 100) = 31.

| Metric | Count | % of 299 |
|---|---|---|
| Estimated old-formula pass count (≥ 40 old scale) | 54 | 18.1% |
| **Current new-formula pass count (≥ 40)** | **39** | **13.1%** |
| New formula at ≥ 31 (preserves old pass rate) | 54 | 18.1% |

**Rate shift:** −5.0 percentage points (39 vs 54 assets pass).

### Proposed threshold options

| Option | Threshold | Pass count | Rationale |
|---|---|---|---|
| A — Keep current | ≥ 40 | 39 (13.1%) | Stricter; fewer assets contribute |
| B — Rate-preserving | ≥ 31 | 54 (18.1%) | Restores pre-Phase-8 pass rate |
| C — Post-enrichment target | ≥ 40 | ~100–140 est. | After enrichment applied |

**Recommendation:** Option B (≥ 31) for this consumer. The unit-count aggregation is used for financial modeling benchmarks — having too few assets (39 vs the prior 54) could produce noisier per-unit estimates. Rate preservation here is more important than for the comps pool filter.

---

## Consumer 3: auto-enrichment.service.ts:601 — enrichment eligibility

**File:** `backend/src/services/property-enrichment/data-library/auto-enrichment.service.ts`
**Function:** `getAssetsNeedingEnrichment(userId, minScore=50, limit=50)`
**Purpose:** Selects assets to re-enrich (scores below threshold → need enrichment). This is inverted logic — assets BELOW the threshold are selected.

**Current code:** `WHERE data_quality_score IS NULL OR data_quality_score < $1` with default `minScore = 50`

### Pass-count analysis

This selects assets *needing* enrichment (score < threshold), so higher threshold = more assets selected.

| Metric | Count | % of 299 |
|---|---|---|
| Old formula: assets needing enrichment (< 50 old) | 260 | 87.0% |
| **New formula: assets needing enrichment (< 50)** | **265** | **88.6%** |
| New formula: assets needing enrichment (< 38) | 260 | 87.0% |

**Rate shift:** +1.6 percentage points — slightly more assets now qualify for auto-enrichment. This is correct behavior (the formula compression means previously-adequate scores now fall below threshold, correctly triggering enrichment).

### Proposed threshold

| Option | minScore default | Assets selected | Rationale |
|---|---|---|---|
| A — Keep current | 50 | 265 | Slightly more assets enriched; acceptable |
| B — Rate-preserving | 38 | 260 | Exactly preserves old eligibility |

**Recommendation:** Option A (keep default 50). The slight increase in eligible assets (265 vs 260) is the correct outcome — the new formula correctly identifies more assets as needing enrichment because they lack Phase 8 data. This is the system working as designed.

---

## Summary Table

| Consumer | Current threshold | Old-formula pass count | New-formula pass count | Rate shift | Proposed change | Rationale |
|---|---|---|---|---|---|---|
| archive-benchmark-aggregator.ts:86 | ≥ 50 | 39 (13.0%) | 34 (11.4%) | −1.6pp | **Keep ≥ 50** | Let enrichment lift scores naturally |
| archive-benchmark-aggregator.ts:579 | ≥ 40 | 54 (18.1%) | 39 (13.1%) | −5.0pp | **Lower to ≥ 31** | Financial benchmarks need broader pool |
| auto-enrichment.service.ts:601 | < 50 (default) | 260 eligible | 265 eligible | +1.6pp | **Keep < 50** | Correct behavior — more enrichment needed |

---

## DO NOT APPLY

No code changes should be made until Leon explicitly approves the proposed values above.

The only pending change (if approved) would be:
```sql
-- archive-benchmark-aggregator.ts:579
-- change: data_quality_score >= 40
-- to:     data_quality_score >= 31
```

All other thresholds are recommended unchanged.

---

---

## Phase 8 Backfill Results (2026-05-25)

All 298 archive properties have been run through the Google Places enrichment backfill.
Data staged in `pending_web` layer — visible in the Data Library review modal, not yet affecting DQ scores.

| Metric | Count | % of 298 |
|---|---|---|
| Reviews staged (pending_web) | 273 | 91.6% |
| Photos staged (pending_web) | 278 | 93.3% |
| Sentiment summary staged | 288 | 96.6% |
| No Places match (generic names) | 24 | 8.1% |
| Narrative staged (web search) | 0 | 0% — Tavily quota exhausted |
| Average reviews per property | 4.9 | — |
| Average Google rating | 4.22 / 5.0 | — |

**Narrative gap:** Tavily web search quota was exhausted during the backfill run. All 298 properties have 0 narrative words in pending_web. Narrative enrichment requires Tavily quota replenishment followed by a re-run with `--force --skip-places`. The NLP pass on reviews (Claude Haiku) was also skipped due to low credit balance — reviews use basic star-rating sentiment instead of entity extraction.

**Anthropic NLP gap:** Reviews were enriched without the NLP pass (low credit balance). `named_entities`, `hazard_mentions`, and `amenity_mentions` arrays are empty on all staged reviews. Once Anthropic credits are replenished, re-run with `--force --skip-places` to add NLP enrichment to existing reviews.

---

## Re-evaluation Trigger

This analysis is based on 299 assets with **Phase 8 data now staged in pending_web** but not yet applied. DQ scores have not yet changed. Once operators begin Applying enrichment:

- Mean DQ will rise from 28.4 toward 40–55 (estimated, based on Phase 8 bonus of up to 23 pts)
- Pass counts at all current thresholds will increase significantly
- A second threshold review is recommended after 80%+ of assets have had enrichment Applied

---

*Report generated per Task-1041 Step 2.3. Threshold changes require Leon's explicit approval before implementation.*
