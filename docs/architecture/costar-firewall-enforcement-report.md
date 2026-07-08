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
| I2 | Fine-tuning / prompt-logging firewall | **PASS** — no active/latent path found; documented for future feature work |
| I3 | Structural restriction-tag wiring in read path | **PASS** — predicate-level, not post-hoc |
| I4 | Calibration-job trace | **PASS** — correctly excludes restricted rows by design; documented |

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
