# DISPATCH — TIER 1 CLOSE: Real Queries + Drift Root-Cause + I2 Reopen (Short DB Pass)

**Purpose:** Tier 1 came back 80% — T1-B done, but three items need a genuinely-DB pass to close: the empty-tables confirm was code-review-only (can't confirm empty without querying), Bishop's `year_built` drift needs a root-cause before the paste, and I2 is a reopen not a documentation item. Small pass, mostly queries. On green, Tier 1 CLOSES and D3-W2 dispatches.
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000. **REQUIRES real DATABASE_URL** — if the session lacks DB access, STOP and say so (do not code-review-substitute; that's the exact gap this pass fixes).
**Standing rules:** S1-01 — pasted `SELECT` output, not code inference · no licensed-data content in report.

## C1 · Empty-tables confirm — REAL queries (the purge question hinges on this)
Run and paste actual row counts. Code review cannot confirm a table is empty; only the query can.
```sql
SELECT 'costar_market_metrics' t, count(*) FROM costar_market_metrics
UNION ALL SELECT 'costar_submarket_stats', count(*) FROM costar_submarket_stats
UNION ALL SELECT 'vendor_market_observations_costar', count(*) FROM vendor_market_observations WHERE vendor_id='costar'
UNION ALL SELECT 'market_snapshots_costar', count(*) FROM market_snapshots WHERE source_path ILIKE '%costar%' OR source ILIKE '%costar%'
UNION ALL SELECT 'historical_observations_costar', count(*) FROM historical_observations WHERE source_signals::text ILIKE '%costar%'
UNION ALL SELECT 'metric_time_series_costar', count(*) FROM metric_time_series WHERE source ILIKE '%costar%';
```
(Adjust column names to actual schema — the intent is: any CoStar-lineage rows in any restricted-capable table.)
- **All zero** → the operator's historical-purge legal question is MOOT. State it explicitly: "no CoStar-lineage rows exist platform-wide; future-blocking (I1/I3) is the complete fix; nothing to purge."
- **Any nonzero** → list the table + row count (NOT the content) for operator/counsel review. Do NOT delete anything — purge is a counsel decision.

## C2 · Bishop `year_built` drift — root-cause BEFORE the paste
The value (2014) is in the golden fixture (captured from a live /build snapshot 2026-07-05) but missing from `deal_data` now. This is potential persisted-field-drift — the "mechanism correct, data not persisted/overwritten" bug class. Answer before pasting:
1. Was `year_built` EVER written to Bishop's `deal_data`? Check: does the create/extraction path write it, or was the fixture's 2014 captured from a transient build-time computed value that never persisted? (grep the write path for `year_built` persistence.)
2. If it was written and later removed → what overwrote it? (any UPDATE that rewrites `deal_data` wholesale rather than merging — the jsonb-clobber risk.)
3. **Verdict:** `never-persisted` (fixture captured a computed value — expected, low concern, just backfill) OR `persisted-then-dropped` (a real drift bug — LOG AS FINDING: "deal_data field drift, root cause X, blast radius: which other fields/deals at risk"). Then apply the paste:
```sql
UPDATE deals SET deal_data = jsonb_set(COALESCE(deal_data,'{}'::jsonb),'{year_built}','"2014"'::jsonb)
WHERE id = '3f32276f-aacd-4da3-b306-317c5109b403';
```
Paste the before/after `deal_data->>'year_built'`.

## C3 · I2 reopen — log the finding correctly (no build here)
The Tier-1 report's "document as acceptable" is wrong: `skill_chat_messages.content` stores raw prompt content that CAN carry CoStar-derived values, and `sanitizeTrainingCharacteristics` only protects the `training_examples` path (it strips deal_characteristics — NOT CoStar values from stored chat content). So chat content with CoStar lineage sits unfiltered in the DB; only one downstream consumer is firewalled.
1. Confirm the precise scope: what exactly does `sanitizeTrainingCharacteristics` strip, and does ANY path read `skill_chat_messages.content` into a training/fine-tuning corpus other than the sanitized `training_examples` route? (grep readers of `skill_chat_messages.content`.)
2. Record as a scoped finding in `docs/architecture/costar-firewall-enforcement-report.md`: **"I2-REOPEN: chat-content storage carries potential CoStar lineage unfiltered; training_examples path is firewalled but raw skill_chat_messages.content is not; license-field-on-logging (original firewall I2) remains the durable fix — scoped for a follow-up dispatch, not built here."**
3. Also log **I4** as: "clean by current scope (calibration reads deals.deal_data->extraction_t12 only), UNGUARDED against future expansion into restricted tables — extend the I3 read-path filter to any future job reading historical_observations/metric_time_series."
No code build in C3 — findings only. The I2 remediation is its own dispatch if/when the operator prioritizes it.

## ACCEPTANCE / TIER 1 CLOSE
- C1: pasted row counts + the moot-or-escalate verdict on the purge question.
- C2: root-cause verdict (never-persisted vs drift-bug-logged) + before/after paste.
- C3: I2-reopen + I4-scope findings logged in the firewall report; grep of skill_chat_messages.content readers pasted.
**On green: TIER 1 CLOSES.** Open findings tracked: I2 remediation (follow-up dispatch, operator-prioritized), I4 future-guard (fold into I3 filter when touched), year_built drift (if it was a real bug — blast-radius noted). D3-W2/W3 dispatches next (rulings pre-encoded: no auto-prune / base-scope agent writes, scenario_id=NULL).

## OUT OF SCOPE
D3-W2/W3 execution · I2 remediation BUILD (scoped follow-up) · deleting historical rows (counsel only) · FREE-WINS/Zoning/T2.
