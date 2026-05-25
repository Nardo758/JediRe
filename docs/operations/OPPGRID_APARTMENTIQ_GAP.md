# OppGrid ApartmentIQ Payload Gap

**Produced:** 2026-05-25  
**Updated:** 2026-05-25 (corrected per Leon — OppGrid is a separate project; endpoints are built correctly)  
**Scope:** Root-cause investigation of why `oppgrid_opportunity_signals` and `oppgrid_growth_trajectories` have 0 rows despite receiving endpoints existing on the platform. Investigation only — no code changes made.  
**Status:** Planned integration awaiting OppGrid-side work. No JediRE-side changes are needed or should be made.

---

## Summary

The zero-row gap is **not a silent failure**. The two missing tables are populated by a **different data source and a different flow direction** than ApartmentIQ. ApartmentIQ never sends data to these tables; OppGrid is the designated sender, and OppGrid has never been configured to call the back-channel endpoints on JediRE.

---

## Architecture: Four Flows, Two Sources

The route file (`backend/src/api/rest/oppgrid.routes.ts`, header comment line 8) states:

```
Flow: ApartmentIQ (Leon's PC) -> JediRE (this) -> OppGrid
```

The code implements two distinct push directions:

| Direction | Endpoint | Table populated | Status |
|---|---|---|---|
| ApartmentIQ → JediRE | `POST /api/v1/oppgrid/sync-demand` | `oppgrid_demand_signals` | ✅ 1,044 rows |
| ApartmentIQ → JediRE | `POST /api/v1/oppgrid/sync-economics` | `oppgrid_market_economics` | ✅ 53 rows |
| **OppGrid → JediRE** | `POST /api/v1/oppgrid/sync-signals` | `oppgrid_opportunity_signals` | ❌ 0 rows — **never called** |
| **OppGrid → JediRE** | `POST /api/v1/oppgrid/sync-trajectory` | `oppgrid_growth_trajectories` | ❌ 0 rows — **never called** |

The code comment at line 497–499 makes the intended direction explicit:

```typescript
// RECEIVE ENDPOINTS (OppGrid → JediRE)
// These endpoints receive signals from OppGrid for use in Strategy Builder
```

ApartmentIQ has **no code path** for `/sync-signals` or `/sync-trajectory`. There is no ApartmentIQ-side sender for these data types anywhere in `backend/src/`.

---

## Endpoint Specifications

### `POST /api/v1/oppgrid/sync-signals`

Receives opportunity signals **from OppGrid** and stores them in `oppgrid_opportunity_signals`.

**Expected payload shape:**
```json
{
  "city": "atlanta",
  "state": "GA",
  "source": "oppgrid",
  "signals": [
    {
      "signal_type": "retail_demand",
      "score": 82.5,
      "confidence": 0.78,
      "category": "consumer",
      "trend": "rising",
      "metadata": {}
    }
  ]
}
```

**Validation:**  
- `city`, `state`, `signals` (array) are required — missing any returns `400`  
- Each signal element must have `signal_type`; items without one are silently skipped (but not rejected)

**Conflict constraint:** `UNIQUE (city, state, signal_type, source)` — safe to re-POST without duplication

**Auth:** `Authorization: Bearer <OPPGRID_SYNC_TOKEN>` or `CLAWDBOT_AUTH_TOKEN`. In dev mode (no token env var set), all traffic passes through.

---

### `POST /api/v1/oppgrid/sync-trajectory`

Receives a market growth trajectory **from OppGrid** and stores it in `oppgrid_growth_trajectories`.

**Expected payload shape:**
```json
{
  "city": "atlanta",
  "state": "GA",
  "source": "oppgrid",
  "growth_score": 74.2,
  "growth_category": "high",
  "population_growth_rate": 2.1,
  "job_growth_rate": 3.4,
  "income_growth_rate": 1.8,
  "business_formation_rate": 4.1,
  "net_migration_rate": 1.5,
  "opportunity_signal_count": 42,
  "avg_opportunity_score": 68.3,
  "signal_density_percentile": 88.0
}
```

**Validation:**  
- `city` and `state` are required — missing returns `400`  
- All numeric fields default to `null` via `|| null` guards — no minimum data required  

**Conflict constraint:** `UNIQUE (city, state, source)` — one row per city/state/source combination

**Auth:** Same as `/sync-signals`.

---

## DB Schema Confirmation

Both tables exist, are structurally correct, and have proper indexes. The schemas match the INSERT statements in the code exactly — no column mismatch exists.

**`oppgrid_opportunity_signals`** key columns:
```
id          uuid         NOT NULL  (default: gen_random_uuid())
city        text         NOT NULL
state       text         NOT NULL
source      text         NOT NULL  (default: 'oppgrid')
signal_type text         NOT NULL
score       numeric      nullable
confidence  numeric      nullable
category    text         nullable
trend       text         nullable  (default: 'stable')
metadata    jsonb        nullable
```

**`oppgrid_growth_trajectories`** key columns:
```
id                         uuid     NOT NULL
city                       text     NOT NULL
state                      text     NOT NULL
source                     text     NOT NULL  (default: 'oppgrid')
growth_score               numeric  nullable
growth_category            text     nullable
population_growth_rate     numeric  nullable
job_growth_rate            numeric  nullable
income_growth_rate         numeric  nullable
business_formation_rate    numeric  nullable
net_migration_rate         numeric  nullable
opportunity_signal_count   integer  nullable
avg_opportunity_score      numeric  nullable
signal_density_percentile  numeric  nullable
```

---

## Root Cause Classification

**Category: Planned integration — OppGrid sending side not yet wired**

The JediRE endpoints are fully implemented, deployed, and reachable at `POST /api/v1/oppgrid/sync-signals` and `POST /api/v1/oppgrid/sync-trajectory`. The insert code (lines 529 and 597 in `oppgrid.routes.ts`) is correct. The DB tables and indexes are healthy. The endpoints were built correctly for their intended caller.

The tables are empty because **OppGrid (a separate project) has not yet been wired to post to these endpoints**. This is not a bug in JediRE — it is work that lives on the OppGrid side and has not been done yet. There are no error logs, no rejected payloads, and no silent drops — simply zero inbound requests.

**Context:**

1. **Separate project** — OppGrid is Leon's separate project. The JediRE endpoints represent the receiving half of a planned OppGrid → JediRE integration; the sending half (OppGrid making the outbound calls) has not been built yet on the OppGrid side.

2. **No token configured in production** — `OPPGRID_SYNC_TOKEN` is not listed as a configured secret in the environment. The auth middleware allows all traffic in dev mode (no token set), but production deployments will require explicit token agreement before OppGrid can post successfully.

3. **Health monitoring blind spot** — the `/health` endpoint (line 435–464) counts only `demand_signals` and `market_economics`. The two empty tables are invisible to monitoring; their zero-row state generates no alert.

---

## What ApartmentIQ Actually Sends

ApartmentIQ (running on Leon's PC) sends two payload types:

| Payload type | Endpoint | Field set |
|---|---|---|
| Demand signals | `/sync-demand` | `city, state, signals[]` where each signal has `amenity_type, demand_pct, avg_frequency, priority_weight, sample_size, trend` |
| Market economics | `/sync-economics` | `city, state, avg_rent_1br, avg_rent_2br, avg_rent_3br, median_rent, vacancy_rate, rent_trend, yoy_change, sample_size` |

ApartmentIQ sends **no opportunity signal or growth trajectory data**. This is consistent with the designed architecture: those are OppGrid's computed outputs, not ApartmentIQ's raw inputs.

---

## What Needs to Happen

**All work is on the OppGrid side. No JediRE changes are needed or should be made.**

When OppGrid is ready to push its computed outputs to JediRE, the OppGrid project needs to be given:

- JediRE endpoint base URL (e.g. `https://jedi-re.replit.app/api/v1/oppgrid`)
- `OPPGRID_SYNC_TOKEN` secret agreed between both operators — set as an env var in production on both sides
- OppGrid-side logic to POST computed opportunity signals to `/sync-signals` after processing
- OppGrid-side logic to POST growth trajectory summaries to `/sync-trajectory` after computing city-level scores

The JediRE receiving endpoints, validation, DB tables, and conflict-resolution logic are already complete. No JediRE-side development is required to activate this integration.

---

## Affected Files

| File | Role |
|---|---|
| `backend/src/api/rest/oppgrid.routes.ts` | All OppGrid/ApartmentIQ integration logic (969 lines); no separate service file exists |
| `backend/src/index.replit.ts:300` | Mounts `oppgridRouter` at `/api/v1/oppgrid` |

No other files reference `oppgrid_opportunity_signals` or `oppgrid_growth_trajectories`.

---

## Working Pipelines — Confirmed Healthy

The `sync-demand` and `sync-economics` pipelines were not touched during this investigation and remain healthy:
- `oppgrid_demand_signals`: 1,044 rows
- `oppgrid_market_economics`: 53 rows

Their endpoints, validation, and conflict-resolution logic are structurally identical to the missing-data endpoints and serve as a proven reference implementation for any fix work.
