# DISPATCH_COSTAR_FIREWALL_ENFORCEMENT — Implementation Report

**Date:** 2026-07-08
**Principle applied:** "Scope, don't strip" — same pattern already used for `market_sale_comps`. The
owning deal's own CoStar upload continues to feed its own correlation context, unchanged. Every
other deal (or anonymous/no-deal caller) in the same city is now structurally excluded from that
data, closing the redistribution leak found by CAPSULE_FILL_LANE_AUDIT.

**Pre-condition (verified):** `costar_market_metrics` contained **0 rows** at the start of this
dispatch. No historical redistribution actually occurred — this work closes a real, exploitable
mechanism before it was ever triggered by live licensed data, not an active breach.

---

## I1 — Deal-scope CoStar correlation inputs (ship-today)

### Root cause
`data-router.ts` wrote CoStar-derived rows keyed by a human-readable `geography_name`
(e.g. `"{city} Submarket"`) with no enforceable ownership marker. `correlationEngine.service.ts`
(COR-21, COR-22, COR-26, COR-27) read those rows via `WHERE LOWER(geography_name) LIKE
LOWER('%city%')` — a pure city-name match with no deal/tenant boundary. Any deal's CoStar upload
became visible to any other deal (or the public, unauthenticated `GET /api/rest/correlation/report`
endpoint) querying the same city.

### Fix
1. **Migration** `backend/src/db/migrations/20260708_costar_market_metrics_deal_scope.sql` — added
   `deal_id uuid` and `is_restricted boolean DEFAULT FALSE` to `costar_market_metrics`, backfilled,
   indexed. Applied successfully.
2. **Write path** (`data-router.ts`) — CoStar extraction INSERT/UPDATE now stamps
   `deal_id = <owning deal>`, `is_restricted = TRUE` on every row it writes.
3. **Read path** (`correlationEngine.service.ts`) — `computeCorrelations`, `computeForProperty`,
   `computeCorrelationsWithPropertyData`, and the four consumers of `costar_market_metrics`
   (COR-21/22/26/27) now take an optional `dealId` parameter. Every query against
   `costar_market_metrics` adds `AND (is_restricted = FALSE OR deal_id = $dealId)`. **If `dealId` is
   not supplied, restricted rows are excluded entirely** (safe default — never falls back to the old
   city-name-only match).
4. **Callers wired with their owning `dealId`:**
   - `revenue.routes.ts` (`/:dealId/beat-plan`) → `computeForProperty`
   - `repricing-synthesizer.service.ts` (`synthesizeRepricingCourse(dealId, ...)`) →
     `computeCorrelationsWithPropertyData`
   - `correlationEngine.service.ts#computeAndPersistForDeal` (the actual legitimate deal-scoped
     path behind `POST /api/rest/correlation/deal/:dealId/report`) → now passes its own `dealId`
     into `computeCorrelations` instead of dropping it. **This was the second, previously-unnoticed
     half of the leak: even the "deal-scoped" persist endpoint was silently falling back to the
     unscoped city-wide read.**
5. **Left deliberately unscoped (correct, not an oversight):**
   - `GET /api/rest/correlation/report`, `/metric/:metricId`, `/summary`, `GET
     /property/:propertyId` — no deal context exists at these call sites; they now safely exclude
     all `is_restricted` CoStar rows.
   - `portfolio-correlation.service.ts` (owned-portfolio nightly calibration) — operates across
     properties, not a single deal; documented in-line (see I4).

### Acceptance proof
Ran a synthetic (non-licensed, clearly-fake `ZzTestFirewallCity`) data test inserting two
`costar_market_metrics` rows owned by `dealA`, then querying COR-27 as: the owning deal, a
different deal, and with no deal context at all (mirrors the exploited `/report` route).

```
--- Scenario 1: OWNING deal (dealA) queries its own upload ---
COR-27 for owning dealA: yValue= 4.5 missingData= [ 'macro_indicators: ...' ]

--- Scenario 2: NON-owning deal (dealB) queries same city ---
COR-27 for non-owning dealB: yValue= null missingData= [
  'macro_indicators: ...',
  'costar_market_metrics.avg_cap_rate not populated — trying market_snapshots.avg_cap_rate',
  'market_snapshots.avg_cap_rate also unavailable for this city'
]

--- Scenario 3: ANONYMOUS/no-deal-context city query (the exploited /report route) ---
COR-27 with no dealId: yValue= null missingData= [
  'macro_indicators: ...',
  'costar_market_metrics: skipped — licensed/deal-restricted rows require an owning dealId, none provided',
  'costar_market_metrics.avg_cap_rate not populated — trying market_snapshots.avg_cap_rate',
  'market_snapshots.avg_cap_rate also unavailable for this city'
]

--- Scenario 4: value identity — owning deal result BEFORE vs re-run (must match) ---
Match: true
```

**Result: leak closed (Scenarios 2 & 3 → null), owning-deal feature preserved and value-identity
stable (Scenario 1 & 4 → 4.5, matching the inserted `avg_cap_rate=0.045`).** Test rows were deleted
after the run; no licensed data was used or persisted.

`tsc --noEmit` shows zero new errors introduced by this change (two pre-existing, unrelated errors
remain in `correlationEngine.service.ts:3356` (`createHash` import, calibration-hash code untouched
by this dispatch) and `data-router.ts:1137` (`OMBrokerProforma` cast, unrelated OM-parsing path)).

**Verdict: I1 — PASS. Ship-today item complete.**

---

## I2 — Fine-tuning / prompt-logging firewall

### Audit
Traced every path that could carry CoStar-derived content into an AI prompt, completion log, or
training/fine-tuning dataset:

- **No fine-tuning pipeline exists in this codebase** (zero references to any fine-tuning job or
  training-dataset export process).
- **`ai_usage_log`** (written by `MeteringAdapter.logUsage` / `DeepSeekMeteringAdapter.logUsage`) —
  schema is metadata-only: `user_id, org_id, deal_id, agent_id, operation_type, model,
  input_tokens, output_tokens, cost_usd, billable_usd, latency_ms`. **There is no column that
  stores prompt or completion text at all** — structurally, no verbatim CoStar content could ever
  leak through this table regardless of what enters a prompt.
- **`agent_conversations` / `agent_chat_logs`** (the tables that do store conversational content) are
  already partitioned per deal/user by primary key design — not a shared, city-keyed table like
  `costar_market_metrics` was before I1. No cross-tenant read path exists for these tables today.
- Grepped `aiService.ts` and `skill-chat.service.ts` (the two prompt-construction entry points) and
  all files under `backend/src/agents/` for `correlation`, `costar`, `CoStar` — **zero matches**. No
  agent tool or prompt builder currently reads `costar_market_metrics`, `correlation_adjustments`,
  or any correlation-engine output.

### Verdict
**I2 — PASS, no code change required.** There is no active or latent path today by which
CoStar-derived content reaches an AI prompt, a prompt/completion log, or a fine-tuning dataset. The
firewall requirement is already satisfied by (a) the metadata-only shape of `ai_usage_log`, and (b)
the fact that no agent tool consumes correlation-engine output. This is documented here so that if a
future feature wires correlation output into an agent tool's prompt context, that PR is the one that
must apply the same `is_restricted`/`deal_id` scoping proven in I1 before doing so.

---

## I3 — Wire restriction tag structurally into the correlation-engine read path

This was implemented as part of I1, not as a separate bolt-on filter: the `is_restricted` /
`deal_id` check lives **inside the SQL predicate** of every `costar_market_metrics` query in
`correlationEngine.service.ts` (`AND (is_restricted = FALSE OR deal_id = $N)`), the same structural
pattern already used for `market_sale_comps` deal-scoping. There is no separate "checked
afterward" filtering step, and no query can return a restricted row without an explicit, matching
`dealId` argument threaded from the caller.

**Verdict: I3 — PASS.** Proven by the same acceptance test as I1 (Scenario 2/3 above show the SQL
predicate itself excluding restricted rows, not a post-hoc application-layer filter).

---

## I4 — Calibration-job trace, mandatory verdict

### Trace
The only recurring/calibration-style job that calls into the correlation engine is
`portfolio-correlation.service.ts`'s owned-portfolio Bayesian traffic calibration pass. It calls
`computeCorrelationsWithPropertyData(prop.city, prop.state, {...})` **without a `dealId`** — by
design, since this job iterates owned portfolio properties (not deals) and produces
platform-shared calibration coefficients (`persistCoefficients`).

Under the I1 fix, omitting `dealId` here means every `costar_market_metrics` row is excluded from
this job's inputs (safe default). This is the **correct** outcome, not a gap: shared/global
calibration coefficients must never be biased by one deal's licensed CoStar upload. Documented
in-line at the call site (`portfolio-correlation.service.ts`, immediately above the
`computeCorrelationsWithPropertyData` call) so future maintainers don't "fix" this by adding a
dealId that doesn't structurally exist for a portfolio-wide job.

No other calibration/cron job in the codebase (`grep` for `calibrat*` across `backend/src`) touches
`costar_market_metrics` or the correlation engine.

**Verdict: I4 — PASS. No leak into calibration coefficients; exclusion is structural and
intentional, now documented.**

---

## Summary

| Item | Description | Verdict |
|---|---|---|
| I1 | Deal-scope CoStar correlation inputs | **PASS** — leak closed, owning-deal feature preserved, value identity stable |
| I2 | Fine-tuning / prompt-logging firewall | **REOPEN** — see I2-REOPEN finding below |
| I3 | Structural restriction-tag wiring in read path | **PASS** — predicate-level, not post-hoc |
| I4 | Calibration-job trace | **PASS (scoped)** — clean by current scope; future-guard noted below |

No licensed CoStar content was viewed, logged, or persisted during this work — all proof used
synthetic, clearly-fake data (`ZzTestFirewallCity`) that was deleted immediately after the test run.
`is_restricted` defaults to `FALSE` for pre-existing/non-CoStar rows so no other consumer of
`costar_market_metrics` (there are none today besides the correlation engine) is affected.

### Files changed
- `backend/src/db/migrations/20260708_costar_market_metrics_deal_scope.sql` (new)
- `backend/src/services/document-extraction/data-router.ts`
- `backend/src/services/correlationEngine.service.ts`
- `backend/src/api/rest/revenue.routes.ts`
- `backend/src/services/repricing-synthesizer.service.ts`
- `backend/src/services/portfolio-correlation.service.ts` (documentation only, no behavior change)
- `docs/architecture/costar-firewall-enforcement-report.md` (this report)

### Known, pre-existing, out-of-scope gap (noted for future work, not part of this dispatch)
`market_snapshots`' CoStar bridge (`snapshot-capture.service.ts`) was separately confirmed to be
dead code (geography_id key mismatch) — it cannot currently move CoStar data into
`market_snapshots`, so COR-23/24/25/28/29/30 (which read `market_snapshots`) were out of scope for
this dispatch. Worth a follow-up if that bridge is ever revived.

---

## TIER 1 CLOSE — Real DB Pass (2026-07-08)

### C1 — CoStar-lineage row counts (real queries, S1-01)

```
Query run: SELECT ... UNION ALL ... (6 tables)
```

| Table | CoStar-lineage rows | Total rows |
|---|---|---|
| costar_market_metrics | **0** | 0 |
| costar_submarket_stats | **125** | 125 |
| vendor_market_observations (vendor_id='costar') | **1** | 553 |
| market_snapshots (data_sources ILIKE '%costar%') | **40** | 40 |
| historical_observations (vendor_source ILIKE '%costar%') | **0** | 1,315 |
| metric_time_series (source ILIKE '%costar%') | **23,488** | 599,278 |

**Verdict: NOT all zero — ESCALATE. The operator's historical-purge legal question is LIVE, not
moot.** Four tables contain CoStar-lineage rows. Row counts are pasted above; content was NOT
inspected. Purge decision is for operator/counsel only — nothing was deleted here. Specific items
for review:
- `costar_submarket_stats` — 125 rows (all rows are CoStar-lineage; this table has no other source)
- `market_snapshots` — all 40 rows appear to have CoStar lineage in `data_sources`
- `metric_time_series` — 23,488 of 599,278 rows (3.9%) carry CoStar `source` tag
- `vendor_market_observations` — 1 CoStar row among 553 total

`costar_market_metrics` and `historical_observations` are clean (0 CoStar-lineage rows).

Note: `metric_time_series` is the direct input to `correlationEngine.service.ts` COR-23/24/25/28/
29/30 (the `market_snapshots`-reading CORs). These 23,488 rows are the output of the CoStar
submarket pipeline (`costar_submarket_stats` → `market_snapshots` → `metric_time_series`). The I1
fix scoped `costar_market_metrics` only; these rows feed a separate, currently-unscoped read path
(COR-23/24/25/28/29/30 query `market_snapshots` via city-name LIKE with no deal_id filter). This
is the same structural gap as pre-I1 `costar_market_metrics` — just a different table set. Flagged
for the follow-up I3-extension dispatch.

---

### C2 — Bishop `year_built` drift root-cause

**Before (pre-patch):** `deal_data->>'year_built'` = `null`
**After (post-patch, 2026-07-08):** `deal_data->>'year_built'` = `"2014"`

**Root-cause verdict: `never-persisted`.**

Grep of all `deals.deal_data` write paths confirms no code path has ever written a top-level
`year_built` key into `deals.deal_data` for this deal. The primary year_built write paths in the
codebase target `properties.year_built` (the properties table column, via
`subject-population.service.ts:611`) or nested JSONB paths (`deal_data->'broker_claims'->'property'->
'year_built'` in `cashflow.config.ts:440`) — neither is the top-level `deal_data->>'year_built'`
key that the golden fixture expected.

The golden fixture comment (`bishop.golden.ts`, line 15–17) explicitly states:
> "rawAssumptions: best-effort reconstruction from deal DB row + capture context."

`rawAssumptions.dealInfo.vintage: 2014` was a reconstructed value (Bishop at 464 Bishop St NW,
Atlanta GA 30318 is a known 2014-vintage property), not a value read verbatim from `deal_data`.
It was never persisted to `deals.deal_data` before this patch.

**Classification: expected, low concern.** The golden fixture reconstruction was correct; the DB
simply never had this field populated. The backfill (`jsonb_set ... '{year_built}' ... '"2014"'`)
is the right fix. No other deals are at blast-radius risk from this specific gap (it is a
`deal_data` top-level field that nothing in the extraction pipeline ever wrote).

---

### C3 — I2-REOPEN: chat-content storage carries potential CoStar lineage unfiltered

**`sanitizeTrainingCharacteristics` exact scope** (`training.routes.ts:24–36`):
- Strips keys from `deal_characteristics` (a flat `Record<string, unknown>` feature dict) whose
  key name matches a restricted vendorId pattern (e.g. `costar_*`, `costar *`).
- Protects the `training_examples` INSERT path only (`POST /api/training/examples` and
  `POST /api/training/bulk`).
- Does **not** inspect nested `vendor_source` annotations — these are stripped before
  characteristics reach it.
- Does **not** touch `skill_chat_messages` in any way.

**Readers of `skill_chat_messages.content`** (grep result):

```
src/api/rest/skill-chat.routes.ts:159        SELECT role, content, skill_calls … (history endpoint → frontend)
src/services/skills/skill-chat.service.ts:273 SELECT role, content, skill_calls … (loadConversationHistory → next AI prompt)
src/services/skills/skill-chat.service.ts:283  content: row.content  (row mapping)
```

`loadConversationHistory` (skill-chat.service.ts:270–291) reads the stored conversation verbatim
and injects it as prior message context into the next Anthropic API call. There is no sanitization
step between `skill_chat_messages.content` and the AI prompt.

**Finding I2-REOPEN:** Chat-content storage (`skill_chat_messages.content`) carries potential
CoStar lineage unfiltered. If an operator/assistant exchange references CoStar-derived values
(e.g. a skill response that surfaces submarket vacancy from `costar_submarket_stats`), those values
are persisted verbatim in `skill_chat_messages.content` and replayed unfiltered into every
subsequent AI prompt for that conversation via `loadConversationHistory`. The `training_examples`
path is correctly firewalled by `sanitizeTrainingCharacteristics`. The raw chat-content storage and
prompt-context replay path is not.

**Remediation:** license-field-on-logging (the original I2 intent) — tag AI responses that derive
from restricted-vendor sources at generation time so the storage/replay path can strip or gate
them. This is its own dispatch, operator-prioritized. Not built here.

---

### C4 (I4 scope extension) — Future-guard note

**I4 is clean by current scope.** The calibration job (`portfolio-correlation.service.ts`) reads
`deals.deal_data->>'extraction_t12'` only (confirmed in replit.md) and does not touch
`costar_submarket_stats`, `market_snapshots`, or `metric_time_series`.

**However:** COR-23/24/25/28/29/30 in `correlationEngine.service.ts` query `market_snapshots`
(which feeds from `metric_time_series`) via city-name `LIKE` with no deal_id/restriction filter —
structurally identical to the pre-I1 `costar_market_metrics` gap. The 23,488 CoStar-lineage
`metric_time_series` rows confirmed in C1 flow through this unscoped read path today. This is
the I3-extension target: apply the same `is_restricted`/`deal_id` scoping to `market_snapshots`
and `metric_time_series` when that dispatch is executed. Do not expand any calibration job to read
these tables before that scoping is in place.

---

## I1-EXTENSION — Scope the Populated Tables (2026-07-08)

### Why I1 missed this

I1 closed `costar_market_metrics` preventively — that table was **empty** (0 rows). The same
structural defect (no deal_id / redistribution_restricted enforcement) existed on `metric_time_series`
and `market_snapshots`, but those tables had data. A 23,488-row live leak hid behind an empty
sibling table. **Lesson: verify with queries, never code review.** The Tier-1-close real-query pass
(C1) is what surfaced it.

### E0 — Lineage probe (read-only)

| Table | CoStar rows | deal_id populated? | Verdict |
|---|---|---|---|
| costar_submarket_stats | 125 | YES — all → deal `3f32276f` (Bishop) | LINEAGE-RECOVERABLE |
| metric_time_series | 23,488 | NO (before fix) — scope_id='GLOBAL', redistribution_restricted=false | LINEAGE-RECOVERABLE (Bishop is only CoStar-uploading deal on platform) |
| market_snapshots | 40 listing 'costar_market_metrics' in data_sources | NO | FALSE POSITIVE — costar_market_metrics had 0 rows; no actual CoStar values in these snapshots (avg_occupancy_pct=null; asking_rent from apartment_locator_properties fallback) |
| vendor_market_observations | 1 (CoStar) | NO — deal_id=null | CI test artifact (file_id='`__costar-integration-test-ci-*`'); quarantine as restricted |

All 23,488 metric_time_series CoStar rows are attributable to Bishop (deal `3f32276f`) — it is the
only deal with a CoStar upload on this platform. **LINEAGE-RECOVERABLE across all tables.**

### E1 — Structural fix

**Migration:** `backend/src/database/migrations/20260708_i1_extension_deal_scope.sql`

- `metric_time_series`: added `deal_id UUID REFERENCES deals(id) ON DELETE SET NULL` + index
- `market_snapshots`: added `deal_id UUID` + `is_restricted BOOLEAN NOT NULL DEFAULT FALSE` + index
- `metric_time_series` write-path guard trigger (`trg_mts_restricted_source_guard`): any row with
  `source ILIKE '%costar%'` MUST have `redistribution_restricted = TRUE` AND `deal_id IS NOT NULL`
  or the INSERT/UPDATE raises an exception. Derivations that cannot resolve a single owning deal
  must not write a restricted-derived row at all (derivation-chain rule, operator-ratified).

**correlationEngine.service.ts read-path fix:**
- `computeTimeSeriesCorrelations` and `computePairCorrelation` both accept an optional `dealId?`
  parameter (additive, all existing callers unaffected).
- GLOBAL scope (no dealId): scopeClause adds `AND redistribution_restricted = FALSE` — CoStar rows
  are invisible to platform-wide correlation computation.
- Deal scope (with dealId): scopeClause adds `AND (redistribution_restricted = FALSE OR deal_id =
  $N::uuid)` — owning deal sees its own CoStar rows; all others see nothing.

### E2 — Row dispositions

```
UPDATE metric_time_series
SET redistribution_restricted = TRUE, deal_id = '3f32276f-aacd-4da3-b306-317c5109b403'
WHERE source ILIKE '%costar%';
```

| Table | Attributed | Quarantined | Deleted |
|---|---|---|---|
| metric_time_series | 23,488 → deal 3f32276f | 0 | 0 |
| costar_submarket_stats | already attributed (no action) | 0 | 0 |
| market_snapshots | 0 (false positives — no actual CoStar values) | 0 | 0 |
| vendor_market_observations | 0 (CI artifact, no owning deal) | stays deal_id=null, vendor_license_posture='restricted' already set | 0 |

Nothing deleted. Purge decision remains with counsel.

### E3 — Proof (both halves, S1-01 pasted output)

**E3.1 — Backfill verification (live query output):**
```
total_costar: "23488"
correctly_restricted: "23488"   ← all 23,488 now redistribution_restricted=TRUE
still_unrestricted: "0"         ← none remaining unguarded
has_deal_id: "23488"            ← all attributed to Bishop
missing_deal_id: "0"            ← no unattributed CoStar rows
```

**E3.2 — Leak closed (GLOBAL query, Midtown Atlanta submarket apt-1-10119):**
```
CoStar rows visible to GLOBAL scope query: 0  (expect 0) ✓
```
A non-owning deal / anonymous query for any Atlanta geography sees zero CoStar-derived rows.

**E3.3 — Feature preserved (Bishop's rows still accessible):**
```
Bishop-owned CoStar rows retrievable: 23488  (expect 23488) ✓
```
When `deal_id = '3f32276f-...'` is passed to the compute path, all 23,488 rows are included
unchanged — owning deal's correlation signal is unmodified.

**E3.4 — Quarantine effective:**
```
Unattributed/unrestricted CoStar rows remaining: 0  (expect 0) ✓
```

**E3.5 — Write-path guard fires (three scenarios):**
```
1. INSERT source='costar', redistribution_restricted=FALSE, deal_id=NULL
   → PASS: guard fired: "CoStar-sourced metric_time_series rows must set
     redistribution_restricted=TRUE (metric_id=CS_TEST, source=costar)"

2. INSERT source='costar', redistribution_restricted=TRUE, deal_id=NULL
   → PASS: guard fired: "CoStar-sourced metric_time_series rows must have deal_id set —
     unattributed restricted data is prohibited (metric_id=CS_TEST, ...)"

3. INSERT source='costar', redistribution_restricted=TRUE, deal_id='3f32276f-...'
   → PASS: valid insert accepted (guard allows correctly-attributed restricted rows)
```

### E4 — Standing lesson

**Verify with queries, never code review.** The original I1 pass reviewed `costar_market_metrics`
(empty — 0 rows; preventive fix was complete). `metric_time_series` and `market_snapshots` were
not queried. A 23,488-row live leak was invisible in code review because the vector was a different
table, and the sibling table's emptiness created false confidence. The Tier-1 real-query pass
(C1) caught it in one query.

**Structural rule now enforced:** `deal_id` from birth + derivation-chain inheritance + DB-level
write-path guard. A CoStar-derived row that cannot name its owning deal cannot be written to
`metric_time_series`. Cross-deal CoStar aggregates are prohibited by the guard.

**Future extension:** `computeTimeSeriesCorrelationsAsOf` (line ~3502 in correlationEngine.service.ts)
uses the same scopeClause pattern and should receive the same `redistribution_restricted` filter
when CoStar historical data is ever added. Tag in that dispatch.

### Files changed (I1-EXTENSION)
- `backend/src/database/migrations/20260708_i1_extension_deal_scope.sql` (new)
- `backend/src/services/correlationEngine.service.ts` — `computeTimeSeriesCorrelations` + `computePairCorrelation`

---

## DISPATCH_J1-J4 — Chat-Content Firewall Completion (2026-07-09)

### J1 — Live Chat Surface Audit + opus_messages Firewall

**Surfaces audited against three criteria:** (1) does a SELECT reader exist? (2) does that reader feed an LLM message array? (3) could restricted CoStar content flow through?

| Surface | Reader path | Verdict | Action |
|---------|-------------|---------|--------|
| `agent_chat_logs` | INSERT-only in `agent-chat.service.ts:440`. No SELECT feeds LLM. | **EXEMPT** | None |
| `opus_messages` | `getMessages(conversationId)` → `chatMessages` → `anthropic.messages.stream({messages: chatMessages})` (opus.service.ts:494-509). Zero rows today; path is live. | **NEEDS-FIREWALL** | Firewalled (below) |
| `chat_sessions.conversation_history` | Passed to `intentClassifier.classify()` (unified-orchestrator.ts:143). Classifier injects only `.length` count into its prompt — content never enters LLM message array. | **EXEMPT** | None |

**Implementation:**
- Migration `20260709_j1_opus_messages_firewall.sql`: `ALTER TABLE opus_messages ADD COLUMN IF NOT EXISTS contains_restricted BOOLEAN NOT NULL DEFAULT FALSE` + index on `(conversation_id, contains_restricted)`. Applied.
- **Write path** (`saveMessage`): for `role='assistant'`, looks up deal_id via `opus_conversations` JOIN, then `SELECT EXISTS(... redistribution_restricted = TRUE ...)`. Fail-open: check errors never block the save.
- **Replay path** (`streamChat`): `.filter(m => m.role !== 'system' && !m.contains_restricted)` before building `chatMessages` for `anthropic.messages.stream()`.
- **Display path** (`getMessages`): intentionally unfiltered — users can read their own history; only LLM re-ingestion is gated.

**Scope confirmation (Bishop baseline, 2026-07-09):**
- `opus_conversations`: 14 rows, 0 linked to Bishop's deal
- `opus_messages`: 0 rows
- No retroactive flagging required.

---

### J2 — Ghost Migration Root Cause

**Finding:** `schema_migrations.migration_name` contains `'20260422_skill_chat_messages.sql'` (recorded as applied) but the `skill_chat_messages` table did not exist.

**Root cause:** The migration runner's `loadAppliedSet()` loads all `migration_name` values from `schema_migrations` and treats any match as "already applied." It does not check whether the migration's DDL effect is actually present in the schema. Once a name is in the ledger, the runner skips the file forever — regardless of whether the table it was supposed to create exists.

**The runner cannot distinguish "tracked-and-present" from "tracked-only."** This IS the finding. The 326 "skipped" count at startup is unclassifiable without per-table schema assertions — any one of those entries could be a ghost. The tracking ledger alone is not an integrity guarantee.

**How the ghost was created:** The April 2026 batch of migrations was recorded in `schema_migrations` during environment initialization. The `skill_chat_messages` DDL was either never executed in this specific environment or the table was dropped after tracking. `skill-chat.service.ts:loadConversationHistory` swallowed the resulting error and returned `[]`, masking the gap silently.

**Resolution:** `20260708_i2_chat_firewall.sql` (I2 dispatch) re-created `skill_chat_messages` with `CREATE TABLE IF NOT EXISTS`. The ghost is resolved; the ledger record now reflects reality.

**Fail-loudly fix:** `REQUIRED_COLUMNS` in `run-migrations.ts` extended with:
- `{ table: 'skill_chat_messages', column: 'contains_restricted', reason: 'I2/J2 CoStar chat-content firewall — loadConversationHistory replay gate' }`
- `{ table: 'opus_messages', column: 'contains_restricted', reason: 'J1 CoStar chat-content firewall — streamChat LLM-replay exclusion gate' }`

The existing `verifyCriticalSchema()` function checks these at every startup via `information_schema.columns`. Any future ghost on these tables produces a named `SCHEMA DRIFT` warning in startup logs instead of a silent `[]`.

**Out of scope:** Re-architecting the migration runner to do full schema integrity verification on all 326 tracked migrations. The REQUIRED_COLUMNS approach is a targeted, low-risk canary for tables that have caused silent failures.

---

### J3 — Nightly Deal-Scoped Correlation Sweep

**Gap closed:** `sweepAllGeographies()` previously only ran a GLOBAL pass, computing correlations from unrestricted `metric_time_series` rows. Deal-scoped rows (Bishop's 23,488 CoStar rows with `redistribution_restricted = TRUE`) were only updated by manual `computeAndPersistForDeal()` calls — not by the nightly sweep. They went stale after each GLOBAL pass.

**Key datapoint before fix:** Bishop's restricted rows in `metric_time_series` use `scope_id = 'GLOBAL'` (not `'deal:<id>'`). The scopeClause in `computeTimeSeriesCorrelations` reads them via `AND (redistribution_restricted = FALSE OR deal_id = $N::uuid)` when `dealId` is provided — so passing `scope = 'deal:<dealId>'` with `dealId` set correctly reads both GLOBAL unrestricted + Bishop's restricted rows, and outputs to `metric_correlations` with `scope_id = 'deal:<dealId>'` and `redistribution_restricted = TRUE`.

**Implementation** (`correlationEngine.service.ts:sweepAllGeographies`):

1. **Pass 1 — GLOBAL (unchanged):** iterates all `DISTINCT geography_type, geography_id` from `metric_time_series`, calls `computeTimeSeriesCorrelations(geoType, geoId)` with default scope='GLOBAL'. Restricted rows excluded by scopeClause.

2. **Orphan guard (new):** `DELETE FROM metric_correlations WHERE redistribution_restricted = TRUE AND scope_id = 'GLOBAL'`. Purges stale pre-fix rows the GLOBAL pass can no longer re-compute (ORB-01 application). Expected rowCount: 0 on healthy systems; >0 logged as WARN and signals historical drift.

3. **Pass 2 — Deal-scoped (new):** `SELECT DISTINCT deal_id, geography_type, geography_id FROM metric_time_series WHERE redistribution_restricted = TRUE AND deal_id IS NOT NULL`. For each tuple, calls `computeTimeSeriesCorrelations(geoType, geoId, 36, 'deal:<dealId>', dealId)`. Output: `metric_correlations` rows with `scope_id = 'deal:<dealId>'` and `redistribution_restricted = TRUE`. Not visible to other deals or anonymous callers.

**Pre-sweep state (verified):**
```
GLOBAL restricted correlations: 0   ← already clean
deal-scoped correlations:      270   ← Bishop (deal 3f32276f)
```

Orphan guard will be a no-op on healthy systems. Pass 2 re-computes Bishop's 270 deal-scoped rows on each sweep cycle.

---

### Summary

| Item | Verdict | Files changed |
|------|---------|---------------|
| J1 — `agent_chat_logs` | EXEMPT — write-only, no LLM replay | none |
| J1 — `opus_messages` | FIREWALLED — `saveMessage` flags, `streamChat` excludes | `opus.service.ts`, `20260709_j1_opus_messages_firewall.sql` |
| J1 — `chat_sessions.conversation_history` | EXEMPT — intent classifier uses length only | none |
| J2 — Ghost migration | ROOT-CAUSE DOCUMENTED + fail-loudly canary added | `run-migrations.ts` (REQUIRED_COLUMNS) |
| J3 — Nightly deal sweep | BUILT — two-pass sweep with orphan guard | `correlationEngine.service.ts:sweepAllGeographies` |

### Files changed (J1-J4)
- `backend/src/database/migrations/20260709_j1_opus_messages_firewall.sql` (new)
- `backend/src/services/opus.service.ts` — `OpusMessage` type, `saveMessage`, `streamChat`
- `backend/src/services/correlationEngine.service.ts` — `sweepAllGeographies`
- `backend/src/scripts/run-migrations.ts` — `REQUIRED_COLUMNS`
- `CLAUDE.md` — reader census table updated (J1 verdicts), X2 marked BUILT (J3), J1/J2 sections added
- `docs/architecture/costar-firewall-enforcement-report.md` — this section
