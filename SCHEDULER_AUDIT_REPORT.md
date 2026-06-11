# Scheduler Audit Report — JediRe Backend

**Date:** 2025-06-10  
**Scope:** All recurring job schedulers across `backend/src`  
**Systems Audited:** `node-cron`, `Inngest`, `BullMQ`, `setInterval`

---

## 1. Executive Summary

The backend runs **four scheduling mechanisms** simultaneously:

| Mechanism | Count | Where Defined |
|-----------|-------|---------------|
| **Inngest cron functions** | 31 | `inngest/functions/*.ts`, `services/agents/scheduled-jobs.ts`, `services/discovery/scheduled-discovery.ts` |
| **node-cron (in-process)** | 12 | `index.replit.ts` (2), `services/m28-scheduler.service.ts` (10) |
| **BullMQ workers** | 2 | `services/queue.service.ts` |
| **setInterval loops** | 2 | `index.replit.ts` (email sync, forecast regen drain) |

**Critical Finding:** Three job families have **direct overlaps** where the same data pipeline runs from two different schedulers, creating duplicate work and race-condition risk. Additionally, **node-cron uses America/New_York timezone** while **Inngest uses UTC**, meaning ET jobs shift by 1 hour seasonally and can collide with UTC jobs in unexpected ways.

---

## 2. Full Inventory

### 2.1 node-cron (in-process, `America/New_York`)

Defined in `services/m28-scheduler.service.ts` + `index.replit.ts`.

| # | Job | Schedule (ET) | What It Does |
|---|-----|---------------|--------------|
| 1 | Daily rate ingestion | `0 8 * * *` | `ingestRateData()` — FRED rates |
| 2 | Monthly leading indicators | `0 9 5 * *` | `ingestLeadingIndicators()` |
| 3 | Monthly cycle classification | `0 10 1 * *` | `classifyAllMarkets()` |
| 4 | Market metrics refresh | `0 */6 * * *` | `MarketMetricsAggregator.refreshMetricsSnapshot()` |
| 5 | Weekly correlation sweep | `0 3 * * 0` | `CorrelationEngineService.sweepAllGeographies()` |
| 6 | **M07 traffic calibration** | `0 2 * * *` | `TrafficCalibrationJob.run(24)` — **DAILY** |
| 7 | MSA economic data (BLS) | `30 8 * * *` | `ingestMsaData()` |
| 8 | Atlanta CRE news | `0 6 * * *` | `ingestAtlantaNews()` |
| 9 | **Apartment locator sync** | `30 3 * * *` | `apartmentLocatorSyncService.syncAtlanta()` — **ATLANTA ONLY** |
| 10 | **Georgia county ingestion** | `0 1 * * 6` | `georgiaOrchestrator.ingestAll()` + `promoteGeorgiaSales()` — **FULL INGEST + PROMOTE** |
| 11 | M35 monthly backtest | `0 1 1 * *` (UTC) | `runAllPendingBacktests()` |
| 12 | Property discovery | `0 4 * * *` (UTC) | Full discovery + AL sync + matching |

Also in `index.replit.ts`:
- **M35 divergence tracking** — `setTimeout` to 2:00 AM UTC daily
- **Forecast regen queue drain** — `setInterval` every 60 seconds

### 2.2 Inngest Cron Functions (UTC)

| # | Job | Schedule (UTC) | What It Does |
|---|-----|----------------|--------------|
| 1 | **Traffic calibration** | `0 2 * * 1` | `TrafficCalibrationJob.run(168)` — **WEEKLY** |
| 2 | Rolling correlation compute | `0 3 * * *` | `computeTimeSeriesCorrelations(12m + 36m)` |
| 3 | Nightly event extraction | `0 3 * * *` | Extract market events from news cache |
| 4 | **Apartment locator sync** | `0 4 * * *` | `syncAllMetros()` — **ALL METROS** |
| 5 | Calibration realization (M38) | `30 1 * * *` | Pair predictions ↔ realizations, drift detect |
| 6 | Macro signals monthly | `0 9 2 * *` | FRED + BLS → historical_observations |
| 7 | Planning applications (Atlanta DPCD + Fulton) | `0 1 * * *` | Poll ArcGIS + upsert |
| 8 | Accela planning (Gwinnett + DeKalb + Cobb) | `0 2 * * *` | Scrape Accela portals |
| 9 | Miami-Dade planning | `30 3 * * *` | BCC case tracker |
| 10 | **Georgia comp enrichment** | `0 2 * * 1` | `promoteGeorgiaSales()` + `enrichCapitalMarkets()` |
| 11 | **Georgia ArcGIS ingest** | `0 2 * * 0` | Fulton + Gwinnett ArcGIS → property_info_cache |
| 12 | Property reconciliation | `0 3 * * *` | Row-count parity + sample audit |
| 13 | Rate sheet staleness | `0 3 * * 0` | Find expiring tax rate sheets |
| 14 | Historical obs backfill | `0 3 * * *` | Backfill realized_* columns |
| 15 | Data corpus reminder | `0 12 1-3 * *` | Monthly gap reminders (1st business day) |
| 16 | Weekly corpus digest | `0 9 * * 1` | Portfolio-wide digest |
| 17 | Sentiment snapshot | `30 3 * * *` | Daily sentiment history write |
| 18 | Archive aggregation | `0 2 * * *` | Assumption benchmarks from snapshots |
| 19 | Monthly snapshot capture | `0 2 1 * *` | Atlanta MSA + submarket snapshots |
| 20 | MARTA GTFS sync | `0 3 1 1,4,7,10 *` | Quarterly transit stops |
| 21 | OSM POIs sync | `0 4 3 * *` | Monthly groceries/parks/hospitals |
| 22 | Atlanta PD crime | `0 5 * * 1` | Weekly crime stats by ZIP |
| 23 | Daily morning briefing | `0 7 * * *` | Per-user agent briefings |
| 24 | Daily compliance check | `0 8 * * *` | Insurance + permit expiry checks |
| 25 | Weekly portfolio review | `0 9 * * 1` | Per-user portfolio summary |
| 26 | Weekly market intelligence | `0 6 * * 1` | Per-MSA market intel |
| 27 | Hourly threshold monitor | `0 * * * *` | Occupancy threshold alerts |
| 28 | Hourly market discovery | `15 * * * *` | Rates + REIT prices |
| 29 | Daily news discovery | `0 6 * * *` | General real estate news |
| 30 | Daily deal news | `0 7 * * *` | Deal-specific news |
| 31 | Daily economic discovery | `0 8 * * *` | Interest rates + employment |
| 32 | CRE trade-press discovery | `0 */3 * * *` | RSS feed polling every 3 hours |
| 33 | Weekly market scan | `0 5 * * 0` | Deep scan 15 major markets |

### 2.3 Event-Driven Inngest Functions (non-cron)

These fire on events, not schedules — no collision risk:

- `researchOnDealCreated` — `deal.created`
- `zoningOnDealCreated` — `deal.created`
- `supplyOnDealCreated` — `deal.created`
- `cashflowOnDealCreated` — `deal.created`
- `cashflowOnResearchCompleted` — `research.completed`
- `cashflowOnWalkthroughRequested` — walkthrough event
- `commentaryOnResearchCompleted` — `research.completed`
- `emailIntakeFunction` — `gmail.message_received`
- `taxBillUploadedHandler` — `tax/bill.uploaded`
- `onDemandNewsDiscovery` — `discovery/news.requested`
- `onDemandWebSearch` — `discovery/web.search.requested`

### 2.4 BullMQ Workers (Redis-backed)

| Worker | Queue | Trigger |
|--------|-------|---------|
| Property search | `agents` | REST API / agent runtime |
| Strategy arbitrage | `agents` | REST API / agent runtime |

No cron schedules. Clean.

### 2.5 setInterval Loops

| Job | Interval | What It Does |
|-----|----------|--------------|
| Email sync | 15 minutes | `emailSyncScheduler` — Gmail/Microsoft polling |
| Forecast regen drain | 60 seconds | `processForecastRegenQueue()` — M35 queue worker |

---

## 3. Overlaps & Risks

### 🔴 CRITICAL — Same Pipeline, Two Schedulers

#### **Overlap 1: M07 Traffic Calibration**

| Scheduler | Cadence | Lookback | Time (UTC) |
|-----------|---------|----------|------------|
| node-cron | **Daily** | 24 hours | 6–7 AM UTC (ET 2 AM) |
| Inngest | **Weekly (Mon)** | 168 hours | 2 AM UTC |

**Risk:** Both call `TrafficCalibrationJob.run()` with different lookback windows. The daily node-cron job keeps posteriors fresh; the weekly Inngest job is redundant because the daily job already runs. If both execute, the weekly job on Monday will overwrite the daily job's output with a 7-day lookback, potentially smoothing over signals that the daily job had already captured. The Inngest file's own comment says *"Without this schedule, platform posteriors remain frozen"* — but they are **not** frozen because the node-cron runs daily.

**Recommendation:** **Retire the Inngest weekly job.** Keep the node-cron daily job. If durability/retries are needed, migrate the node-cron job to Inngest with the same daily schedule (`0 2 * * *` UTC) and 24h lookback.

---

#### **Overlap 2: Apartment Locator Sync**

| Scheduler | Cadence | Scope | Time (UTC) |
|-----------|---------|-------|------------|
| node-cron | Daily | **Atlanta only** | 7:30–8:30 AM UTC (ET 3:30 AM) |
| Inngest | Daily | **All metros** | 4:00 AM UTC |

**Risk:** Atlanta is synced **twice daily** — once by Inngest at 4 AM UTC (as part of all metros), and again by node-cron at ~7:30 AM UTC (Atlanta-only). The two runs are 3.5–4.5 hours apart. If the upstream API has rate limits or if the sync is non-idempotent, the second run could hit throttling or create duplicate rows.

**Recommendation:** **Remove the node-cron Atlanta-only sync.** The Inngest `syncAllMetros()` already covers Atlanta. If Atlanta needs special handling, make it a flag inside `syncAllMetros()` rather than a separate cron.

---

#### **Overlap 3: Georgia County Ingestion (Triple Overlap)**

| Scheduler | Day (UTC) | What It Does |
|-----------|-----------|--------------|
| node-cron | **Saturday 5 AM** | Full county ingest (all 4 counties) + promote + comp promotion |
| Inngest ArcGIS | **Sunday 2 AM** | ArcGIS ingest for Fulton + Gwinnett only |
| Inngest Comp Enrichment | **Monday 2 AM** | `promoteGeorgiaSales()` + `enrichCapitalMarkets()` |

**Risk:**
1. **ArcGIS ingestion runs twice:** Saturday node-cron does full county ingest (including ArcGIS), then Sunday Inngest does Fulton + Gwinnett ArcGIS again.
2. **Promotion runs twice:** Saturday node-cron promotes Georgia sales, then Monday Inngest promotes again.
3. Both promotion steps are idempotent (ON CONFLICT), but they waste compute and DB write capacity. The ArcGIS re-ingest is more dangerous because it re-fetches large GeoJSON layers and re-runs spatial joins.

**Recommendation:**
- **Consolidate to one canonical weekly job.**
- Preferred: **Inngest Sunday ArcGIS ingest** → keep as-is.
- **Move the Monday enrichment step to run AFTER the Sunday ingest** (e.g., Monday 4 AM) so it processes fresh data.
- **Remove the Saturday node-cron job entirely.** Its full-county ingest is superseded by the Sunday Inngest job. If the other two counties (Cobb, DeKalb) need ArcGIS coverage, extend the Sunday Inngest job rather than running a separate node-cron.

---

### 🟡 MODERATE — Complementary but Potentially Redundant

#### **Overlap 4: Correlation Compute**

| Scheduler | Cadence | Method | Time (UTC) |
|-----------|---------|--------|------------|
| node-cron | Weekly (Sun) | `sweepAllGeographies()` | 7 AM UTC (ET 3 AM) |
| Inngest | Daily | `computeTimeSeriesCorrelations(12m, 36m)` | 3 AM UTC |

**Risk:** The weekly sweep and daily rolling compute touch the same tables (`metric_time_series`, `correlation_history`) but use different methods. They are likely complementary, but if `sweepAllGeographies()` also writes to `correlation_history`, the daily job may overwrite or conflict with the weekly sweep's output.

**Recommendation:** Verify whether `sweepAllGeographies()` writes to `correlation_history`. If yes, either:
- Remove the weekly node-cron sweep (the daily Inngest job is more granular), OR
- Have the weekly sweep write to a different table/namespace.

---

#### **Overlap 5: News Ingestion**

| Scheduler | Cadence | Scope | Time (UTC) |
|-----------|---------|-------|------------|
| node-cron | Daily | Atlanta CRE news only | 10 AM UTC (ET 6 AM) |
| Inngest | Daily | General real estate news | 10 AM UTC |
| Inngest | Every 3 hours | CRE trade-press RSS | All day |

**Risk:** The node-cron Atlanta job and the Inngest daily news job both run at ~10 AM UTC. They likely use different sources, but if both ingest into `news_article_cache`, there could be duplicate articles about Atlanta markets.

**Recommendation:** Low risk if deduplication is solid. Verify that `news_article_cache` has a unique constraint on `(source_url)` or similar. If not, add one.

---

### 🟢 LOW — Timezone Collision Risk

**ET vs UTC Seasonal Shift:**

node-cron jobs use `{ timezone: 'America/New_York' }`. In summer, 2 AM ET = 6 AM UTC. In winter, 2 AM ET = 7 AM UTC. This means:

- M07 traffic calibration (node-cron 2 AM ET) shifts from 6 AM UTC to 7 AM UTC seasonally.
- The Inngest traffic calibration runs at 2 AM UTC (winter) or 2 AM UTC (summer) — fixed.

In **winter**, the node-cron runs at 7 AM UTC and the Inngest weekly job runs at 2 AM UTC — 5 hours apart.  
In **summer**, the node-cron runs at 6 AM UTC and the Inngest weekly job runs at 2 AM UTC — 4 hours apart.

This is manageable, but if you migrate jobs between schedulers, **standardize on UTC** to avoid seasonal surprises.

---

## 4. Canonical Scheduler Recommendations

| Job Family | Canonical Scheduler | Reason |
|------------|---------------------|--------|
| **M07 Traffic Calibration** | **Inngest** (migrate node-cron to Inngest daily) | Durability, retries, step-level observability |
| **Apartment Locator Sync** | **Inngest** (remove node-cron) | `syncAllMetros()` already covers Atlanta |
| **Georgia County Ingestion** | **Inngest** (consolidate to Sunday ArcGIS + Monday enrichment) | Better step isolation, 90m timeout for heavy spatial work |
| **Correlation Compute** | **Inngest** (remove node-cron if redundant) | Daily granularity beats weekly sweep |
| **Market Metrics Refresh** | **node-cron** (keep, no Inngest equivalent) | Lightweight, every 6 hours, no durability needed |
| **Rate / MSA / News Ingestion** | **node-cron** (keep) | Simple, reliable, no step-level complexity needed |
| **Agent Briefings / Compliance** | **Inngest** (already) | Per-user step isolation is perfect for Inngest |
| **Discovery Jobs** | **Inngest** (already) | Rate-limit sleeps, step retries, RSS backfill logic |
| **Planning / Crime / GTFS / OSM** | **Inngest** (already) | External API calls benefit from Inngest retries |
| **M35 Backtest / Divergence / Regen** | **node-cron / setInterval** (keep in-process) | Tight coupling to M35 service state, fast feedback loop |
| **BullMQ Workers** | **BullMQ** (keep) | Agent job queue needs Redis-backed concurrency |
| **Email Sync / Forecast Drain** | **setInterval** (keep) | Sub-minute latency requirements |

---

## 5. Action Items

### Immediate (this week)

1. **Disable Inngest `trafficCalibrationCron`** (`inngest/functions/trafficCalibrationCron.ts`) — the node-cron daily job is already running. Re-enable only if node-cron is removed.
2. **Disable node-cron apartment locator sync** in `m28-scheduler.service.ts` — Inngest `nightlyApartmentSyncCron` covers all metros including Atlanta.
3. **Disable node-cron Georgia county ingestion** in `m28-scheduler.service.ts` — superseded by Inngest Sunday + Monday jobs.

### Short-term (next 2 weeks)

4. **Audit `sweepAllGeographies()` vs `computeTimeSeriesCorrelations()`** — check if they write to the same table. If redundant, remove the weekly node-cron sweep.
5. **Standardize all cron expressions to UTC** — remove `timezone: 'America/New_York'` from node-cron and convert schedules to UTC equivalents. This eliminates seasonal shift surprises.
6. **Add `source_url` UNIQUE constraint** to `news_article_cache` if missing — prevents duplicate articles from overlapping news ingest jobs.

### Medium-term (next month)

7. **Migrate remaining node-cron jobs to Inngest** where durability matters: M35 backtest, property discovery. Keep simple data refreshes (rate ingest, market metrics) in node-cron.
8. **Add a single "scheduler registry" dashboard endpoint** (`GET /api/v1/admin/schedulers`) that lists all active cron jobs, their last run time, and next scheduled fire time — sourced from Inngest API + node-cron internal state.

---

## 6. Appendix: Quick-Reference Collision Matrix

| Time (UTC) | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday | Sunday |
|------------|--------|---------|-----------|----------|--------|----------|--------|
| 01:00 | Planning apps (Inngest) | Planning apps | Planning apps | Planning apps | Planning apps | Planning apps | Planning apps |
| 01:30 | M38 calibration (Inngest) | M38 calibration | M38 calibration | M38 calibration | M38 calibration | M38 calibration | M38 calibration |
| 02:00 | **M07 cal (Inngest)** + Accela planning | Accela planning | Accela planning | Accela planning | Accela planning | Accela planning | **ArcGIS ingest (Inngest)** |
| 03:00 | Correlation (Inngest) + Event extraction + Reconciliation | Correlation + Event extraction + Reconciliation | Correlation + Event extraction + Reconciliation | Correlation + Event extraction + Reconciliation | Correlation + Event extraction + Reconciliation | Correlation + Event extraction + Reconciliation | Correlation + Event extraction + Reconciliation |
| 03:30 | Miami-Dade planning (Inngest) | Miami-Dade planning | Miami-Dade planning | Miami-Dade planning | Miami-Dade planning | Miami-Dade planning | Miami-Dade planning |
| 04:00 | Apartment sync (Inngest) | Apartment sync | Apartment sync | Apartment sync | Apartment sync | Apartment sync | Apartment sync |
| 05:00 | Crime sync (Inngest) | — | — | — | — | — | — |
| 06:00 | Market intel (Inngest) | — | — | — | — | — | — |
| 07:00 | Morning briefing (Inngest) | Morning briefing | Morning briefing | Morning briefing | Morning briefing | Morning briefing | Morning briefing |
| 08:00 | Compliance (Inngest) + Economic discovery | Compliance + Economic discovery | Compliance + Economic discovery | Compliance + Economic discovery | Compliance + Economic discovery | Compliance + Economic discovery | Compliance + Economic discovery |
| 09:00 | Portfolio review (Inngest) + Corpus digest | — | — | — | — | — | Corpus digest |
| 12:00 | — | — | — | — | — | — | — |
| **Variable** | **M35 backtest (node-cron, 1st of month)** | — | — | — | — | **Georgia ingest (node-cron)** | — |

**Note:** node-cron ET jobs are not shown in this UTC matrix because their UTC equivalent shifts seasonally.
