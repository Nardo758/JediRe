# Phase 8 Final Closing Document

Status: **IN PROGRESS — awaiting Leon top-up confirmation before execution**
Generated: 2026-05-25

---

## Step 1 — Gap Inventory

Queried 2026-05-25 against live `property_descriptions` table (475 total rows).

### 1A. Narrative Coverage (Tavily-dependent)

| Metric | Count |
|---|---|
| Total archive properties | 298 |
| Total property_descriptions rows | 475 |
| Properties with narrative populated (any layer) | 0 |
| Properties missing narrative entirely (NULL) | 474 |
| Properties with narrative struct but no web layer | 1 (The Village at Westland Cove — OM-sourced only) |
| Properties with narrative in pending_web | **0** |

**Failure mode:** Tavily quota was exhausted before a single narrative was written. This is a
clean zero — no partial writes, no properties that succeeded. All 298 archive properties need
Tavily enrichment.

Target: **298 × 4 = 1,192 Tavily searches** to complete narrative coverage.

### 1B. NLP Review Pass Coverage (DeepSeek-dependent)

| Metric | Count |
|---|---|
| Total reviews staged in pending_web | **1,350** |
| Properties with reviews in pending_web | 275 |
| Average reviews per property | 4.9 |
| Average review text length | 657 chars ≈ 164 tokens |
| Reviews with named_entities populated | **0** |
| Reviews with hazard_mentions populated | **0** |
| Reviews with amenity_mentions populated | **0** |
| Reviews needing NLP pass | **1,350 (100%)** |

**Failure mode:** The original backfill used Anthropic Haiku for NLP extraction. Anthropic credits
were exhausted before the NLP pass ran — all reviews were written with empty arrays. Migrating
to DeepSeek (`deepseek-chat`) for the completion run eliminates the Anthropic dependency.

Note: 3 properties had Places matches with reviews that appear to be wrong-business matches
(e.g., "Artistry" matched a lash studio). These will still receive NLP extraction — the array
content will simply be accurate to whatever text is in the review. No manual curation is
in scope.

---

## Step 2 — Cost Estimates

### 2A. Tavily (narrative enrichment)

Pricing sourced from tavily.com/pricing — verify before committing as rates may change.

| Item | Value |
|---|---|
| Searches needed | 1,192 (298 properties × 4 queries each) |
| Tavily Basic plan | 1,000 credits/month free |
| Tavily Pro plan | ~$49/mo for 10,000 credits |
| Estimated cost at Pro rate ($0.0049/search) | ≈ **$5.84** |
| Recommended top-up | **$50** (one Pro month — covers all 1,192 with ~8× buffer) |
| **IMPORTANT** | Verify current pricing at tavily.com/pricing before committing |

### 2B. DeepSeek NLP pass (replaces Anthropic)

Rates from `DeepSeekMeteringAdapter.ts` `COST_PER_MTK` table (sourced 2026-04):
`deepseek-chat`: $0.27/M input, $0.07/M cached input, $1.10/M output.

| Item | Value |
|---|---|
| Reviews | 1,350 |
| Input tokens/review | ~314 (164 chars review text + 150 system/instruction prompt) |
| Output tokens/review | ~40 (3 JSON arrays, mostly short extractions) |
| Total input tokens | 424,000 (~0.424M) |
| Total output tokens | 54,000 (~0.054M) |
| Input cost (cache miss) | 0.424M × $0.27 = $0.114 |
| Output cost | 0.054M × $1.10 = $0.059 |
| **Total estimated cost** | **≈ $0.17** |
| Recommended top-up | **$5** (minimum to cover cost with margin; actual spend negligible) |

**Combined:** ≈ **$6** real cost. Recommend **$50 Tavily + $5 DeepSeek** for comfortable margin.

---

## Step 3 — Top-Up Confirmation

**Status: PENDING LEON CONFIRMATION**

- [ ] Tavily top-up confirmed
- [ ] DeepSeek top-up confirmed (if balance < $1)
- Confirmation timestamp: _not yet received_

Do not run Steps 4–6 (narrative backfill, NLP pass, verification) until Leon confirms.

---

## Step 4 — Narrative Backfill Execution Results

**Status: NOT YET RUN** (awaiting top-up confirmation)

Command to run:
```
cd backend && npx ts-node --transpile-only src/scripts/backfill-phase8-research.ts --force --skip-places
```

| Metric | Target | Actual |
|---|---|---|
| Properties processed | 298 | — |
| Narratives written to pending_web | 298 | — |
| Properties with no Tavily result | — | — |
| Actual Tavily searches consumed | ~1,192 | — |
| Run timestamp | — | — |

---

## Step 5 — NLP Review Pass Execution Results

**Status: NOT YET RUN** (awaiting top-up confirmation)

Command to run:
```
cd backend && npx ts-node --transpile-only src/scripts/nlp-review-backfill.ts
```

| Metric | Target | Actual |
|---|---|---|
| Reviews processed | 1,350 | — |
| Reviews with named_entities populated | 1,350 | — |
| Reviews with hazard_mentions populated | ~800 est. | — |
| Reviews with amenity_mentions populated | ~600 est. | — |
| Actual DeepSeek cost (from ai_usage_log) | ~$0.17 | — |
| Run timestamp | — | — |

---

## Step 6 — Paired-Read Verification

**Status: NOT YET RUN** (awaiting Steps 4–5 completion)

Verification protocol:
- 5 sample properties with mixed sentiment (not all-5-star)
- Confirm narrative populated in pending_web
- Confirm ≥3 reviews per property have named_entities/hazard_mentions
- Spot-check: each extracted hazard_mention must appear literally in the review text

| Property | Narrative OK | NLP arrays populated | Hazard literal-match check | Pass/Fail |
|---|---|---|---|---|
| TBD | — | — | — | — |
| TBD | — | — | — | — |
| TBD | — | — | — | — |
| TBD | — | — | — | — |
| TBD | — | — | — | — |

NLP quality spot-check findings: _not yet recorded_

---

## Appendix — NLP Script

Script location: `backend/src/scripts/nlp-review-backfill.ts`

Flags:
- `--dry-run` — print what would be sent; no API calls, no DB writes
- `--limit N` — process at most N reviews (for spot-check validation)
- `--concurrency N` — parallel DeepSeek calls (default: 5)

The script uses `triggered_by: 'cron'` metadata — cost is platform-absorbed, not charged to
any user. All extractions are literal-only (prompt explicitly forbids synthesis or inference).

---

---

## Threshold Recalibration — Approved Values (2026-05-25)

Leon approved the DQ threshold recalibration per `docs/operations/THRESHOLD_RECALIBRATION_REPORT.md`.

| Consumer | File | Previous | Approved | Status |
|---|---|---|---|---|
| Consumer 1 — comps pool filter | `archive-benchmark-aggregator.ts:86` | ≥ 50 | **≥ 50 (unchanged)** | No change |
| Consumer 2 — financial benchmarks filter | `archive-benchmark-aggregator.ts:579` | ≥ 40 | **≥ 31 (changed)** | Applied 2026-05-25 |
| Consumer 3 — enrichment eligibility | `auto-enrichment.service.ts:601` | < 50 (default) | **< 50 (unchanged)** | No change |

**Post-change verification:** Consumer 2 with ≥ 31 returns 54 assets (restored from 39 — matches pre-Phase-8 count exactly).

### Re-Evaluation Trigger

Re-evaluate all three thresholds when 80%+ of archive properties have a resolved DQ score ≥ 50 (i.e., enrichment has been Applied to the majority of assets). Expected trigger date: TBD based on operator Apply velocity.

---

*This document will be updated after each execution step.*
