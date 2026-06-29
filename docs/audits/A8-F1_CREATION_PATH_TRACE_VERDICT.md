# A8-F1 CREATION-PATH TRACE — VERDICT REPORT

> **Dispatch:** A8-F1 Creation-Path Trace (READ-ONLY)  
> **Repo:** `Nardo758/JediRe.git`  
> **Date:** 2026-07-16  
> **Mode:** READ-ONLY — evidence only, zero fixes  
> **Commit at HEAD:** (dispatch run against current working tree)

---

## ONE-LINE VERDICT

**LIVE user-reachable path** — The enum already includes `'portfolio'` and the frontend UI, payload, and validation all allow it, but the **active Express backend handler does not implement portfolio semantics** (status='PROSPECT', no pipeline skip). The only place portfolio semantics exist is in **unreachable NestJS dead code** (`deals.service.ts:87-90`). The real portfolio-creation path is the **organization handoff** (`acquisition_to_operations` → `organization.service.ts:371`).

---

## 6-HOP EVIDENCE TABLE

| Hop | Finding | File:Line / Evidence |
|-----|---------|----------------------|
| **1. UI exposure** | `'Portfolio'` is a selectable option in the deal creation flow alongside `'Pipeline'`. | `frontend/src/components/deal/CreateDealModal.tsx:319-344` — two buttons: "Portfolio (Properties you own or manage)" and "Pipeline (Deals you're prospecting)". Also `frontend/src/pages/CreateDealPage.tsx:83` — `type DealCategory = 'portfolio' \| 'pipeline'`. |
| **2. Request payload** | `deal_category` is sent as `'portfolio'` when the user selects it. | `frontend/src/pages/CreateDealPage.tsx:385-403` — `const dealPayload: any = { ..., deal_category: dealCategory!, ... }` where `dealCategory` is user-selected. `frontend/src/stores/dealStore.ts:691` — `apiClient.post('/api/v1/deals', payload)`. |
| **3. The gate** | `createDealSchema` accepts `'portfolio'`. | `backend/src/api/rest/validation.ts:41` — `deal_category: z.enum(['pipeline', 'portfolio']).optional()`. |
| **4. Service branch** | Portfolio branch exists in `deals.service.ts` (NestJS) but is **never reached**. The active Express route (`inline-deals.routes.ts`) handles the POST and **does not** implement portfolio semantics. | `backend/src/deals/deals.service.ts:87-90` — `if (dto.deal_category === 'portfolio')` → `UPDATE deals SET status = 'CLOSED_OWNED', acquisition_date = NOW()`. BUT: `backend/src/index.replit.ts` has **no `NestFactory` bootstrap** — `DealsModule` is never mounted. The frontend hits `backend/src/api/rest/inline-deals.routes.ts:372` (Express POST `/`), which hardcodes `status = 'PROSPECT'` at line 472 and does **not** skip the acquisition pipeline. |
| **5. Provenance** | Three writers of `status='CLOSED_OWNED'` found. The 3 existing portfolio assets were **manually seeded**, not created via the deals API. | (a) `backend/src/deals/deals.service.ts:88` — NestJS create (unreachable). (b) `backend/src/services/organization.service.ts:371` — handoff `acquisition_to_operations` → `UPDATE deals SET status = 'CLOSED_OWNED'`. (c) `backend/src/database/migrations/20260715_deal_status_enum.sql:45` — backfill `WHERE LOWER(status) IN ('portfolio', 'owned', 'closed', 'closed_won', 'won')`. The 3 assets (Frisco TX, McKinney TX, Duluth GA) were manually seeded per `20260531_deal_monthly_actuals_is_portfolio_asset.sql:37-39` with `source=manual` / `source=yardi`. |
| **6. Live DB** | Migration evidence confirms 3 portfolio properties with `deal_monthly_actuals.is_portfolio_asset = TRUE`. | `backend/src/database/migrations/20260531_deal_monthly_actuals_is_portfolio_asset.sql:37-39` — three properties: `a1000001-0000-0000-0000-000000000001` (Frisco TX, 18mo, manual), `a1000001-0000-0000-0000-000000000002` (McKinney TX, 18mo, manual), `7ea31caf-f070-43eb-9fd1-fe08f7123701` (Duluth GA, 13mo, yardi). Also `20260531_portfolio_properties_ownership_status.sql:6-12` — `UPDATE properties SET ownership_status = 'portfolio'`. *Note: live DB query not executed — no DB connection available in this session; migration files serve as authoritative historical snapshot.* |

---

## HOP 6 — MIGRATION EVIDENCE (Query Substitute)

The live DB query was not run (no DB connection in this session), but the following migrations contain authoritative backfill records that serve the same evidentiary purpose:

```sql
-- From 20260531_deal_monthly_actuals_is_portfolio_asset.sql:37-39
--   a1000001-0000-0000-0000-000000000001  — 4800 Spring Creek Pkwy, Frisco TX    (18 months, source=manual)
--   a1000001-0000-0000-0000-000000000002  — 1200 Eldorado Pkwy, McKinney TX      (18 months, source=manual)
--   7ea31caf-f070-43eb-9fd1-fe08f7123701  — 2789 Satellite Blvd, Duluth GA 30096 (13 months, source=yardi)
```

These 3 properties were **seeded manually** (not created via the `POST /api/v1/deals` API path under audit). Their `deal_category` is not recorded in the migration — the `is_portfolio_asset` flag and `ownership_status='portfolio'` were applied retroactively.

---

## REAL PORTFOLIO CREATION PATH

The enum expansion does not unblock the API creation path for portfolio semantics because the active Express handler lacks them. The **actual** path for marking a deal as portfolio/owned is:

1. **Organization handoff** (`acquisition_to_operations`): `backend/src/services/organization.service.ts:361-373` — completes a handoff checklist and transitions the deal to `CLOSED_OWNED`.
2. **Manual seeding / backfill**: The 3 existing assets were seeded via SQL/migration with `source=manual` or `source=yardi`.

---

## IMPLICATION

A user who selects "Portfolio" in the UI will create a deal with `deal_category='portfolio'` but `status='PROSPECT'` and a full acquisition pipeline — the backend treats it as a regular pipeline deal. The portfolio semantics (skip pipeline, set `CLOSED_OWNED`, bootstrap corpus) are only implemented in dead NestJS code that was never bootstrapped. This is a **functional gap**, not a vestigial path — the UI entry is live, but the backend implementation is split between a live (incomplete) Express route and a dead (complete) NestJS service.

---

*END OF REPORT — STOP. No fixes applied.*
