# CORRELATION & TERMINAL MARKETS — DATA-SCOPE SPEC (v3 addendum)

**Governing principle:** the platform is the engine; users bring the oil.
The shared corpus (`GLOBAL` scope) holds only Lane-A data the platform may redistribute
(open/gov/platform-licensed). The signal that makes the Correlation Engine and Terminal
Markets valuable comes from each user's own licensed data (Lane B), computed in a
**per-user scope** that is never readable by another user and never promoted to `GLOBAL`.

Same engine code, different fuel. A correlation run is parameterized by a **scope set**;
the only thing that changes between two users looking at the same geography is which
`metric_time_series` rows are in scope.

This addendum supersedes nothing in v2; it adds the scope dimension the v2 blueprint
(`Data Contracts`, `Recomputation Cascade`) assumed but never modeled.

---

## 0. Scope model

```
scope_id  TEXT  NOT NULL  DEFAULT 'GLOBAL'
  'GLOBAL'        → Lane A only. redistribution_restricted = FALSE. Cron-computed. Readable by all.
  'user:<uuid>'   → GLOBAL ∪ that user's Lane-B series. redistribution_restricted = TRUE.
                    On-demand/on-upload compute. Readable ONLY by that user. Never promoted.
```

Resolution at read time for user X:
- **Input series** for a user-scope run = `WHERE scope_id IN ('GLOBAL', 'user:X')`.
  GLOBAL is the base; the user's oil enriches it. Where the same metric/geography exists
  in both, the user row wins (it is the richer, oil-fed observation).
- **Result rows** are written to `scope_id = 'user:X'` ONLY. The GLOBAL DELETE/INSERT path
  is untouched by user runs.

Invariants (hard):
1. A user-scope compute MUST NOT write, delete, or update any `scope_id = 'GLOBAL'` row.
2. A user-scope result MUST NOT be returned to any caller other than that user.
3. No path promotes `user:*` rows to `GLOBAL`. Lane-B enrichment of the shared corpus is forbidden.
4. Any derived row whose input series included a `redistribution_restricted = TRUE` leaf
   inherits `redistribution_restricted = TRUE` (taint propagation).

---

## 1. Schema changes (additive, backfill-safe)

Add `scope_id` to the three corpus tables and re-key the unique indexes so scopes coexist.

### 1a. `metric_time_series` (ingest target)
```sql
ALTER TABLE metric_time_series
  ADD COLUMN IF NOT EXISTS scope_id TEXT NOT NULL DEFAULT 'GLOBAL',
  ADD COLUMN IF NOT EXISTS redistribution_restricted BOOLEAN NOT NULL DEFAULT FALSE;

-- existing rows are Lane A → stay GLOBAL/FALSE (DEFAULT handles backfill)
CREATE INDEX IF NOT EXISTS idx_mts_scope
  ON metric_time_series (scope_id, geography_type, geography_id);
```

### 1b. `metric_correlations` (result table)
Re-key `idx_mc_unique` (today: `metric_a, metric_b, geography_type, COALESCE(geography_id,'__AGG__'), window_months`)
to prepend `scope_id`:
```sql
ALTER TABLE metric_correlations
  ADD COLUMN IF NOT EXISTS scope_id TEXT NOT NULL DEFAULT 'GLOBAL',
  ADD COLUMN IF NOT EXISTS redistribution_restricted BOOLEAN NOT NULL DEFAULT FALSE;

DROP INDEX IF EXISTS idx_mc_unique;
CREATE UNIQUE INDEX idx_mc_unique
  ON metric_correlations
     (scope_id, metric_a, metric_b, geography_type, COALESCE(geography_id,'__AGG__'), window_months);
```

### 1c. `correlation_history` (append-only sparkline source)
```sql
ALTER TABLE correlation_history
  ADD COLUMN IF NOT EXISTS scope_id TEXT NOT NULL DEFAULT 'GLOBAL';

DROP INDEX IF EXISTS idx_corr_hist_daily_unique;
CREATE UNIQUE INDEX idx_corr_hist_daily_unique
  ON correlation_history
     (scope_id, metric_a, metric_b, geography_type, COALESCE(geography_id,''), window_months, computed_date);
```

---

## 2. Correlation Engine changes

File: `backend/src/services/correlationEngine.service.ts`.
Current write path (≈L521–535) is scope-blind:
```
DELETE FROM metric_correlations WHERE metric_a=$1 AND metric_b=$2 AND geography_type=$3 AND geography_id=$4 AND window_months=$5
INSERT INTO metric_correlations (...) VALUES (...)
```

### 2a. Thread `scope` through the run
- Add `scope: string` (default `'GLOBAL'`) to the run/compute entrypoints
  (the geography iterator at ≈L842 and the pair compute that owns L521).
- **Input query** (the `metric_time_series` reads at ≈L416/483/789): add
  `AND scope_id IN ('GLOBAL', :scope)` when `:scope <> 'GLOBAL'`, else `AND scope_id = 'GLOBAL'`.
  When both GLOBAL and user rows exist for the same `(metric, geography, period)`, prefer the
  user row (e.g. `DISTINCT ON (... period) ... ORDER BY ..., (scope_id <> 'GLOBAL') DESC`).
- **DELETE** becomes `... AND scope_id = :scope`. A user run deletes only its own namespace.
- **INSERT** sets `scope_id = :scope` and `redistribution_restricted = (:scope <> 'GLOBAL')`.
- `correlation_history` insert sets `scope_id = :scope` (ON CONFLICT key now includes it).

### 2b. Triggering
- **GLOBAL**: existing nightly cron, unchanged behavior, `scope='GLOBAL'`, Lane-A only.
- **`user:<id>`**: on-demand. Fire on (a) user uploads/links Lane-B data for a geography in their
  scope, (b) user opens a Correlation view for a geography their oil touches. Recompute only the
  pairs/geographies the new oil affects, not the full matrix. Cache under the user namespace.
- Emit a scoped Kafka topic so v2's Recomputation Cascade can subscribe:
  `correlation.recomputed` with payload `{ scope_id, geography_type, geography_id, pairs[] }`.

### 2c. Read API
- `GET /api/v1/correlations/...` resolves `scope = 'user:' + req.user.id`, reads
  `WHERE scope_id IN ('GLOBAL', :scope)`, user row wins on collision. Anonymous/Lane-A-only
  callers read `scope_id = 'GLOBAL'`.
- Response tags each correlation with `source_scope: 'global' | 'user'` so the UI can badge
  oil-fed signal.

---

## 3. Terminal Markets changes

File: `backend/src/services/market-metrics-aggregator.service.ts` (+ `metricsCatalog`, `catalog-metrics-wiring`).

- **Base tiles** aggregate `scope_id = 'GLOBAL'` — identical for every viewer.
- **Overlay**: when user X views a market their oil touches, recompute the affected tiles over
  `scope_id IN ('GLOBAL','user:X')` at read time (or from the user-scope cache). Never persist
  overlay results to GLOBAL aggregate tables.
- Each tile carries provenance: `{ source_scope, redistribution_restricted, uplift_from_user }`.
  Oil-fed tiles render with a visible "your data" badge; they are private to X.
- A user with no Lane-B data for that market sees pure GLOBAL — no empty states, graceful base.

---

## 4. Redistribution guards on shared-layer writers

These three services currently have **no `redistribution_restricted` filter** and can leak a
restricted leaf into a shared/cross-user artifact. Add a hard guard: a writer targeting a shared
(non-user-scoped) artifact MUST exclude `redistribution_restricted = TRUE` inputs.

- `comp-query.service.ts` / `compQueryEngine.ts`
- `competitive-set.service.ts`
- `market-metrics-aggregator.service.ts`

Primitive already exists: `dataLibrary.service.ts` excludes `redistribution_restricted = FALSE`
from corpus queries; `document-to-corpus.ts` sets the flag on ingest. Extend the same predicate
to these three. For a user-scoped read, restricted rows are allowed but the result is stamped
`redistribution_restricted = TRUE` and scoped to that user.

---

## 5. Test harness — your account as `user:<leon-id>`

**Goal:** prove GLOBAL stays clean while a user scope lights up, before any second user exists.

Seed:
- Your account id → first non-GLOBAL scope `user:<leon-id>`.
- Oil: ingest your owned-portfolio actuals (Frisco TX, McKinney TX, Duluth GA, Highlands) and any
  licensed third-party series you hold into `metric_time_series` as
  `scope_id='user:<leon-id>', redistribution_restricted=TRUE`.
- Keep GLOBAL as whatever thin Lane-A data exists today.

Acceptance checks (all must pass; STOP if any fails):
1. **GLOBAL purity** — run the GLOBAL cron; every `metric_correlations` / `metric_time_series` row
   it writes has `scope_id='GLOBAL'` and `redistribution_restricted=FALSE`. Zero user rows touched.
2. **Oil lights up** — run `scope='user:<leon-id>'` for a geography your oil covers; the scoped
   correlation differs from GLOBAL for at least one pair, and those result rows carry
   `scope_id='user:<leon-id>', redistribution_restricted=TRUE`.
3. **No overwrite** — re-run your user scope twice; GLOBAL row count and values for that geography
   are byte-identical before/after (scoped DELETE only hit `user:<leon-id>`).
4. **No cross-tenant leak** — a second test account (`user:<test2>`, no oil) reading the same
   geography sees GLOBAL only; never a `user:<leon-id>` row. Direct query asserts isolation.
5. **Terminal overlay** — Terminal Markets for that geography renders base (GLOBAL) for `test2`
   and base+overlay with "your data" badges for you; the GLOBAL aggregate tables are unchanged
   by your view.
6. **Taint** — a comp set / market tile built for a shared artifact excludes your restricted leaves;
   a comp set built in your scope includes them and is stamped restricted.

---

## 6. Dispatch sequencing (Claude Code)

1. Migrations §1 (additive, DEFAULT 'GLOBAL' backfill). Verify existing rows read as GLOBAL.
2. Engine §2a/§2b/§2c behind `scope` param defaulting to `'GLOBAL'` → zero behavior change until called with a user scope. **STOP — checkpoint: GLOBAL regression test green.**
3. Guards §4 on the three writers. **STOP — checkpoint: shared artifacts exclude restricted leaves.**
4. Test harness §5 with your account. Run checks 1–4. **STOP — review before any UI.**
5. Terminal overlay §3 + read API badges. Run checks 5–6.
6. Hand UI badge/overlay rendering to Replit with the v5 Bloomberg tokens.

QA tags per task: WIRED / UNWIRED / MOCK / NEW-BACKEND. Do not mark a phase complete without the
named acceptance check passing against the DB (not unit-test-only — recall the S1-01 seed-skip
incident: assert the production-shaped rows, use `forceReseed: true` explicitly).

---

## Open decisions for you
- **Scope key format**: `user:<uuid>` vs a dedicated `data_scope` table with FK. String prefix is
  simplest and index-friendly; FK gives referential cleanup on account delete. Lean string now.
- **User-scope cache TTL**: align with the 24h DealContext cache, or shorter for oil that changes
  on every upload. Recommend event-invalidated (invalidate on new Lane-B ingest) rather than TTL.
- **GLOBAL ∪ user collision rule**: "user row wins" assumes the user's oil is more authoritative
  than the platform's Lane-A proxy for the same cell. Confirm — vs. keeping both as separate series.
