# Opportunity Code Audit

**Scope:** All opportunity-finding code in JediRE — email-to-deal classifiers, profile fit scorers,
submarket opportunity detection, OppGrid bridge, deal triage, and JEDI scoring.  
**Purpose:** Read-only trace of data flows, connection state classification, and what would move
each component to CONNECTED.  
**No fixes were made.** This is a diagnostic document only.  
**Date:** 2026-05-25  
**Companion doc:** `docs/operations/DATA_LIBRARY_INVENTORY.md` (G1/G2/G7 gap definitions)

---

## Quick Reference: Connection States

| Code | Meaning |
|------|---------|
| **A** | Fully connected — fires automatically, tables populated, output consumed downstream |
| **B** | Structurally connected — all code paths exist, blocked by missing config or empty tables |
| **C** | Partially connected — one side of a bridge populated, other side empty |
| **D** | Broken — missing table/schema; code will throw at runtime |
| **E** | Not wired — code exists but no route, trigger, or scheduled job connects it |

---

## Component Inventory

| # | Component | File(s) | State | Blocking gap |
|---|-----------|---------|-------|-------------|
| OPP-1 | Email → Deal Classifier | `classify_as_deal_opportunity.ts` | **B** | Gmail OAuth not active for any user |
| OPP-2 | Profile Fit Scorer | `score_fit_against_profile.ts` | **B** | `user_acquisition_preferences` = 0 rows |
| OPP-3 | OpportunityEngine (F40 submarket) | `opportunity-engine.service.ts` | **A\*** | Manual-only; no cron; Atlanta-only data |
| OPP-4 | OppGrid Bridge (ApartmentIQ) | `oppgrid.routes.ts` | **C** | `opp_signals` + `growth_trajectories` = 0 rows |
| OPP-5 | Deal Triage | `DealTriageService.ts` | **A\*** | Output siloed; no downstream opportunity surfacing |
| OPP-6 | JEDI Score Service | `jedi-score.service.ts` | **D** | `jedi_scores` table does not exist |
| OPP-7 | Morning Brief | `morning-brief.routes.ts` | **A** | Consumer only; not a detector |

\* "A" with reservations — component runs and produces output but is not fully automated or consumed.

---

## Database State (as of audit date)

```
oppgrid_demand_signals      1,044 rows   ← live ApartmentIQ push
oppgrid_market_economics       53 rows   ← live ApartmentIQ push
oppgrid_opportunity_signals     0 rows   ← ApartmentIQ NOT sending
oppgrid_growth_trajectories     0 rows   ← ApartmentIQ NOT sending
apartment_trends                3 rows   ← sparse (Atlanta only)
apartment_submarkets            3 rows   ← sparse (Atlanta only)
apartment_user_analytics       10 rows   ← limited coverage
apartment_market_snapshots     40 rows   ← populated
user_acquisition_preferences    0 rows   ← no user profiles defined
deal_notifications              1 row    ← sparse
deal_alerts                     0 rows
jedi_scores                  TABLE DOES NOT EXIST (migration never ran)
agent_alerts                 TABLE DOES NOT EXIST
```

---

## OPP-1: Email → Deal Classifier

### What it does
`classifyAsDealOpportunity(subject, body_text, from_address)` sends a single Claude Haiku prompt
and returns `{ is_deal: boolean, confidence: number, asset_class_hint, reason }`.
No database reads. Stateless LLM call.

### Data flow

```
Gmail Inbox
    │
    ▼ (OAuth poll, gmail-sync.service.ts)
gmail.message_received  ──── Inngest event ────►  email-intake.function.ts
                                                        │
                                                   Step 1: tier gate
                                                   (users table, subscription_tier)
                                                        │ pass (professional/enterprise/principal)
                                                   Step 2: dedupe
                                                   (deals.deal_data->>'gmail_message_id')
                                                        │ not seen
                                                   Step 3: broker filter
                                                   (users.notification_preferences->broker_sender_domains)
                                                        │ allowed
                                                   Step 4: readGmailThread
                                                        │
                                                   Step 5: classifyAsDealOpportunity  ◄── OPP-1
                                                        │ is_deal=true, confidence≥0.7
                                                   Step 6: OCR attachments (ocrDocument)
                                                   Step 7: extractDealFields
                                                   Step 8: scoreFitAgainstProfile      ◄── OPP-2
                                                   Step 9: createDealDraft
                                                   Step 10: deal.created event → Research Agent
                                                   Step 11: deal_notifications INSERT
                                                   Step 12: audit_log INSERT
```

**Alternative trigger paths:**
- **Research Agent tool** — `classifyAsDealOpportunityTool` registered in `research.config.ts`.
  The Research Agent can call it mid-conversation when a user pastes email text.
- **Manual HTTP** — `email.routes.ts` lines 469/484 expose a test endpoint that calls
  `classifyAsDealOpportunity` then `scoreFitAgainstProfile` inline (no Inngest).

### State: B — Structurally Connected

All code compiles. The Inngest pipeline is fully wired (12 steps). The blocking conditions:

1. **Gmail OAuth not active for any dev user.** `gmail-sync.service.ts` requires per-user OAuth
   tokens. Without a connected Gmail account the `gmail.message_received` event is never emitted.
   The Inngest Dev Server is running but has no events to process.

2. **Inngest Dev Server runs in isolated dev mode.** The `--no-discovery` flag is set. In
   production this must fire via Inngest Cloud against the deployed `/api/inngest` route.

3. **Tier gate:** Only `professional`, `enterprise`, `principal`, `institutional` users reach step 5.
   Operator/Scout users are skipped by design.

### What would move it to A

- One dev user connects Gmail OAuth and receives a broker email → event fires, full pipeline executes.
- Or: call the manual HTTP endpoint on `email.routes.ts` with a synthetic payload to exercise
  steps 5–8 without Gmail.

---

## OPP-2: Profile Fit Scorer

### What it does
`scoreFitAgainstProfile(fields: ExtractedDealFields, user_id: string)` is a **pure deterministic
function** — no LLM. It reads `user_acquisition_preferences` for the user, then scores the
extracted deal fields against preferred asset classes, markets, price ranges, and unit counts.
Returns `{ fit_score: number (0–1), deal_fits: boolean, fit_breakdown: {…}, disqualifiers: [] }`.

### Data flow

```
ExtractedDealFields (address, asset_class, price, unit_count, …)
    +
user_id
    │
    ▼
SELECT * FROM user_acquisition_preferences WHERE user_id = $1
    │
    ├─ rows found → deterministic scoring against 8 preference fields
    │
    └─ 0 rows → returns { fit_score: 0.5, deal_fits: true, fit_breakdown: {}, disqualifiers: [] }
                 (neutral "no preference defined" result)
```

### Callers

| Caller | Path | Note |
|--------|------|------|
| `email-intake.function.ts` | Step 8 | Called after extractDealFields on every qualifying email |
| `email.routes.ts` | Line 484 | Manual test endpoint |
| `research.config.ts` | Tool registration | Research Agent can call it via tool call |

### State: B — Structurally Connected (but silently degraded)

`user_acquisition_preferences` has **0 rows**. Every deal scores `fit_score=0.5`, `deal_fits=true`
with empty breakdown. The result is written into `deals.deal_data` via `createDealDraft` so it
persists — but it carries no information until users define profiles.

No error is thrown. This is a silent no-op.

### What would move it to A

- Insert at least one row into `user_acquisition_preferences` for a user.
  This table needs to be populated from a UI screen (no such screen observed in this audit —
  it may be missing entirely from the frontend).

---

## OPP-3: OpportunityEngine (F40 Submarket Scoring)

### What it does
`OpportunityEngineService.detectOpportunities(city)` computes an opportunity score for each
submarket in a city. It composes two signals:

1. **F40 market score** via `F40PerformanceScoreService.calculateMarketF40(city, state)` — reads
   `apartment_submarkets`, `apartment_trends`, `apartment_market_snapshots`.
2. **Demand data** via `OpportunityEngineService.getDemandData(city)` — reads `apartment_user_analytics`.

The two signals are merged per submarket to produce `OpportunityScore[]` with `opportunityScore`,
`estimatedUpsidePercent`, `estimatedUpsideDollar`, `strategy`, and `signals[]`.

### F40 Scoring detail

`F40PerformanceScoreService.calculateMarketF40`:
- Queries `apartment_submarkets` (latest snapshot for city) — expects `data` column with
  `{ submarkets: [{ name, avg_rent, vacancy_rate, rent_growth_30d, properties_count,
  total_units, vintage_avg_year, sqft_avg }] }`.
- Queries `apartment_trends` (latest for city) — expects `{ observations: [{ date, avg_rent }] }`.
- Queries `apartment_market_snapshots` (latest for city+state) — used for macro context.
- Scores 4 dimensions: `rentPosition` (30%), `occupancyStrength` (30%), `pricingPower` (20%),
  `vintagePhysical` (20%). Normalizes each metric against min/max within the peer group.

### Data flow

```
GET /api/opportunity-engine/detect?city=Atlanta
    │
    ▼
OpportunityEngineService.detectOpportunities('Atlanta')
    │
    ├── F40PerformanceScoreService.calculateMarketF40('Atlanta', 'GA')
    │       ├── apartment_submarkets  (3 rows, Atlanta)
    │       ├── apartment_trends      (3 rows, Atlanta)
    │       └── apartment_market_snapshots (40 rows)
    │
    └── OpportunityEngineService.getDemandData('Atlanta')
            └── apartment_user_analytics (10 rows, mixed city/null)

    ▼ merge per submarket
OpportunityScore[] → JSON response

Frontend: opportunityStore.ts
    └── fetchOpportunities(city) → GET /api/opportunity-engine/detect?city=…
        └── cache TTL = 5 min (in-memory Zustand cache)
```

**Rankings endpoint:** `GET /api/opportunity-engine/rankings` calls `detectOpportunities` then
re-sorts by `opportunityScore` DESC.

**Demand intelligence endpoint:** `GET /api/demand-intelligence` calls `getDemandData` only —
does not run F40 scoring.

### State: A* — Functionally Connected (manual, Atlanta-only)

The pipeline runs today: tables are populated (3 submarkets, 3 trend snapshots, 40 market
snapshots), the math computes, the frontend store hooks in.

**Reservations:**

1. **Manual-only.** No Inngest function, no cron job, no nightly recalculation. Scores are
   stale until a user hits the endpoint.
2. **Atlanta-only data.** All three `apartment_submarkets` rows are for Atlanta. Requests for
   any other city return `{ avgScore: 0, submarketScores: [], marketGrade: 'N/A' }`.
3. **Thin trend history.** `apartment_trends` has 3 rows. F40's `trendDirection` logic requires
   ≥4 observations to fire; it always returns `'stable'` with current data.
4. **Peer normalization degrades at N=3.** With only 3 submarkets the min/max normalization
   spreads scores across the full 0–100 range regardless of absolute market quality —
   one submarket always scores near 100 even in a weak market.

### What would move it to A (fully automated)

- Add an Inngest cron function on nightly cadence calling `detectOpportunities` for each city
  in scope and persisting results to a `opportunity_scores` table.
- Ingest submarket data for additional cities (beyond Atlanta).
- Accumulate ≥4 trend observations per city so `trendDirection` becomes meaningful.

---

## OPP-4: OppGrid Bridge (ApartmentIQ ↔ JediRE)

### What it does
`oppgrid.routes.ts` is a bidirectional REST bridge. ApartmentIQ pushes data into JediRE via
POST/PUT webhooks; JediRE reads combined signals for opportunity ranking.

### Tables and population state

| Table | Rows | Populated by | Consumed by |
|-------|------|-------------|------------|
| `oppgrid_demand_signals` | **1,044** | ApartmentIQ POST `/api/oppgrid/demand-signals` | `GET /rankings` merger |
| `oppgrid_market_economics` | **53** | ApartmentIQ POST `/api/oppgrid/market-economics` | `GET /rankings` merger |
| `oppgrid_opportunity_signals` | **0** | ApartmentIQ POST `/api/oppgrid/opportunity-signals` (UPSERT at line 529) | `GET /rankings` opp score join |
| `oppgrid_growth_trajectories` | **0** | ApartmentIQ POST `/api/oppgrid/growth-trajectories` (UPSERT at line 597) | `GET /rankings` growth join |

### Data flow

```
ApartmentIQ platform
    │
    ├── POST /api/oppgrid/demand-signals      → oppgrid_demand_signals      [ACTIVE]
    ├── POST /api/oppgrid/market-economics    → oppgrid_market_economics     [ACTIVE]
    ├── POST /api/oppgrid/opportunity-signals → oppgrid_opportunity_signals  [SILENT — 0 rows]
    └── POST /api/oppgrid/growth-trajectories → oppgrid_growth_trajectories  [SILENT — 0 rows]

GET /api/oppgrid/rankings
    ├── JOIN oppgrid_demand_signals      (1,044 rows — contributes)
    ├── JOIN oppgrid_market_economics    (53 rows — contributes)
    ├── LEFT JOIN oppgrid_opportunity_signals  (0 rows — nulls out opp scores)
    └── LEFT JOIN oppgrid_growth_trajectories  (0 rows — nulls out growth scores)
    ▼
Ranking output missing opportunity_score and growth_score dimensions
```

### State: C — Partially Connected

The ingest side works: demand signals and market economics flow in from ApartmentIQ and are
stored. The scoring side is empty: ApartmentIQ is not sending `opportunity_signals` or
`growth_trajectories` payloads. Every ranking row has NULL for the two highest-signal dimensions.

This is likely an ApartmentIQ platform configuration issue, not a JediRE code issue. The UPSERT
endpoints exist at lines 529 and 597 of `oppgrid.routes.ts` and are correctly structured.

### What would move it to A

- Confirm with ApartmentIQ that the opportunity-signals and growth-trajectories push jobs are
  enabled and pointed at this environment's `/api/oppgrid/*` routes.
- If ApartmentIQ has delayed rollout of those endpoints, a fallback internal job could
  compute preliminary opportunity scores from `oppgrid_demand_signals` +
  `oppgrid_market_economics` directly, bypassing the missing push.

---

## OPP-5: Deal Triage

### What it does
`DealTriageService.triageDeal(dealId)` runs a synchronous scoring pass over a newly-created deal.
It reads deal fields from the `deals` row, pulls trade area geometry from `trade_areas`, finds
nearby properties within that boundary from `properties`, and computes a triage score (0–50)
across several factors (completeness, market presence, property density, etc.).

Output is written back to the originating `deals` row:
- `deals.triage_result` (JSONB) — full breakdown
- `deals.triage_status` — `'complete'`, `'partial'`, `'insufficient_data'`, etc.
- `deals.triage_score` — numeric 0–50

### Data flow

```
deals.service.ts: createDeal()
    │
    └── line 99: this.autoTriageDeal(deal.id).catch(…)  ← fire-and-forget
            │
            ▼
    DealTriageService.triageDeal(dealId)
            ├── SELECT * FROM deals WHERE id = $1
            ├── SELECT * FROM trade_areas WHERE deal_id = $1  (if lat/lng present)
            │       └── ST_Contains geometry intersection → nearby_properties count
            └── writes:
                deals.triage_result = { score, status, factors, recommendations }
                deals.triage_status = 'complete' | 'partial' | 'insufficient_data'
                deals.triage_score  = 0–50
```

**Manual trigger:** `POST /deals/:id/triage` via `deals.controller.ts` → `deals.service.ts:triageDeal`.

**Read path:** `GET /deals/:id/triage` → `deals.service.ts:getTriageResult` reads back the JSONB.

**Other consumers:**
- `signal-adapters.service.ts` line 706: reads `deal.triage_result || {}` (fallback to empty).
- `m08-strategies.service.ts` line 186: SELECT includes `d.triage_result` in deal list queries.

### State: A* — Auto-fires, but output is siloed

`autoTriageDeal` fires fire-and-forget on every deal creation. The triage scores do persist.

**Reservations:**

1. **No downstream opportunity surfacing.** Triage results sit in `deals.triage_result`. No
   component reads them to surface "this deal looks like a strong opportunity" alerts to the
   user or to another agent. The `signal-adapters.service.ts` consumer reads the JSONB but
   uses it for strategy signals, not opportunity discovery.

2. **No cross-deal ranking.** The triage score is per-deal only. There is no component that
   reads all triage scores and ranks them to surface the highest-scoring new arrivals.

3. **`trade_areas` dependency.** Deals without a geometry in `trade_areas` (most newly
   created email-intake deals) skip the property density factor, reducing the max achievable
   score. The triage still completes but with a lower ceiling.

### What would move it to A (fully utilized)

- Add a consumer that reads `triage_score` across recent deals and surfaces the top N as
  "recommended opportunities" in the dashboard or Morning Brief.
- Wire triage score into the OppGrid rankings as a JediRE-native signal to supplement the
  ApartmentIQ data.

---

## OPP-6: JEDI Score Service

### What it does
`JEDIScoreService` computes a 5-dimension deal score (Demand 30%, Supply 25%, Momentum 20%,
Position 15%, Risk 10%). It reads market event signals from trade areas, submarket data,
and `market_events` to produce a `JEDIScore` struct with per-dimension breakdowns.

The score is designed to change over time as market signals arrive (triggered by
`news_event`, `market_update`, `manual_recalc`, `periodic`).

### Registered trigger paths

| Path | Location | Trigger |
|------|----------|---------|
| `POST /wire/jedi-score/:dealId` | `module-wiring.routes.ts:352` | Manual API call |
| Deal context routes | `deal-context.routes.ts` | On deal context load |
| Kafka consumer | `jedi-score-consumer.ts` | `jedi-score-requested` topic |

### State: D — Broken (missing table)

`jedi_scores` does not exist in the database. `executeSql` against it returned an error.
Any code path that reads or writes this table — including the module-wiring endpoint, the
deal-context loader, and the Kafka consumer — will throw a PostgreSQL error at runtime.

The service file (`jedi-score.service.ts`, 965 lines) is fully implemented. The only missing
piece is the migration.

**Secondary issue:** `agent_alerts` also does not exist. This table is referenced for alert
emission after score changes.

### What would move it to D → A

1. Write and run the migration creating `jedi_scores`:
   ```sql
   CREATE TABLE jedi_scores (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
     total_score NUMERIC,
     demand_score NUMERIC,
     supply_score NUMERIC,
     momentum_score NUMERIC,
     position_score NUMERIC,
     risk_score NUMERIC,
     demand_contribution NUMERIC,
     supply_contribution NUMERIC,
     momentum_contribution NUMERIC,
     position_contribution NUMERIC,
     risk_contribution NUMERIC,
     calculation_method TEXT,
     trigger_event_id UUID,
     trigger_type TEXT,
     previous_score NUMERIC,
     score_delta NUMERIC,
     market_snapshot JSONB,
     demand_factors JSONB,
     supply_factors JSONB,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   ```
2. Run migration for `agent_alerts` (schema to be determined from service code).
3. Verify `JEDIScoreService.calculateAndSaveScore` writes correctly.

---

## OPP-7: Morning Brief

### What it does
`morning-brief.routes.ts` generates an AI-synthesized daily summary. It is a **consumer** of
opportunity data, not a detector. It pulls:
- Portfolio status changes overnight (deals table)
- Urgent items (deadlines, expirations, alerts)
- Market insights (synthesized by Claude from available deal/alert data)
- Agent activity
- Tasks due today/this week

It does **not** call OpportunityEngine, OppGrid, or JEDI Score directly. Market insights are
synthesized by Claude from whatever deal and alert data is already present.

### State: A — Connected as consumer

The route works today. Quality of market insights is proportional to data richness in
`deal_alerts`, `agent_alerts`, and deals pipeline — all of which are sparse (0 rows in alerts).
Morning Brief will return generic insights until alert tables are populated.

---

## Cross-Cutting Analysis

### Why scoring components are sparse

All five scoring components share a common upstream blockage:

```
No Gmail OAuth → No email-intake events → No classifyAsDealOpportunity calls
                                       → No scoreFitAgainstProfile calls
                                       → No deal_notifications rows
                                       → No deal_alerts rows
```

The downstream scoring and opportunity surfaces (JEDI Score, Morning Brief market insights,
triage cross-deal ranking) are all built on top of deal volume and alert richness.
With no automated ingest path firing, the system is in a cold-start state.

### user_acquisition_preferences = 0 rows

This is the most consequential silent gap. `scoreFitAgainstProfile` always returns `fit_score=0.5`
until at least one user defines their investment profile. There is no UI surface in this
codebase (visible during this audit) that populates this table. It is likely an unbuilt feature.

### The Research Agent carries both classify and score tools

`research.config.ts` registers `classifyAsDealOpportunityTool` and `scoreFitAgainstProfileTool`
in the Research Agent's tool list. This means a user who starts a Research Agent session and
pastes in email text can trigger the classify → score → createDealDraft pipeline manually,
without Gmail OAuth. This is currently the only interactive path available for testing OPP-1/OPP-2.

### OppGrid is the richest live source (1,044 demand signals)

`oppgrid_demand_signals` has 1,044 rows — the most populated opportunity-related table. The
signals are consumed by `GET /api/oppgrid/rankings` but that route returns degraded results
because the corresponding `oppgrid_opportunity_signals` join returns nulls. The demand signal
data is effectively warehoused but not scored.

### JEDI Score is the highest-priority fix

OPP-6 is the only **D** (broken) state component. It blocks:
- `POST /wire/jedi-score/:dealId` (module-wiring)
- Deal context load when JEDI Score is requested
- Kafka consumer (runtime error on every message)

This is a single missing migration — the lowest-effort fix with the highest connectivity gain.

---

## Fix Path Summary (ordered by effort)

| Priority | Component | Fix | Effort |
|----------|-----------|-----|--------|
| 1 | OPP-6 JEDI Score | Run migration to create `jedi_scores` + `agent_alerts` | XS — migration only |
| 2 | OPP-4 OppGrid | Enable ApartmentIQ push for opportunity_signals + growth_trajectories | XS — config/vendor |
| 3 | OPP-2 Fit Scorer | Build UI to populate `user_acquisition_preferences`; or seed test data | S — new UI screen |
| 4 | OPP-1 Email Classifier | Connect one user's Gmail OAuth; or use Research Agent manual path | S — OAuth flow |
| 5 | OPP-5 Triage | Add consumer reading triage_score across deals for opportunity surfacing | M — new service |
| 6 | OPP-3 Opp Engine | Add Inngest cron for nightly detectOpportunities; ingest multi-city data | M — cron + data |

---

## Files Referenced

```
backend/src/agents/tools/classify_as_deal_opportunity.ts
backend/src/agents/tools/score_fit_against_profile.ts
backend/src/agents/tools/create_deal_draft.ts
backend/src/agents/tools/extract_deal_fields.ts
backend/src/agents/research.config.ts
backend/src/inngest/functions/email-intake.function.ts
backend/src/services/opportunity-engine.service.ts
backend/src/services/f40-performance-score.service.ts
backend/src/services/DealTriageService.ts
backend/src/services/jedi-score.service.ts
backend/src/services/gmail-sync.service.ts
backend/src/api/rest/oppgrid.routes.ts
backend/src/api/rest/opportunity-engine.routes.ts
backend/src/api/rest/demand-intelligence.routes.ts
backend/src/api/rest/morning-brief.routes.ts
backend/src/api/rest/email.routes.ts
backend/src/api/rest/jedi.routes.ts
backend/src/api/rest/module-wiring.routes.ts
backend/src/deals/deals.service.ts          (autoTriageDeal, triageDeal)
backend/src/deals/deals.controller.ts
backend/src/services/kafka/consumers/jedi-score-consumer.ts
frontend/src/stores/opportunityStore.ts
```
