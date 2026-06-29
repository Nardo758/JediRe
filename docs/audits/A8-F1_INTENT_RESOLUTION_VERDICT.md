# A8-F1 INTENT RESOLUTION TRACE — VERDICT REPORT

> **Dispatch:** A8-F1 Intent Resolution Trace (READ-ONLY)  
> **Repo:** `Nardo758/JediRe.git`  
> **Date:** 2026-07-16  
> **Mode:** READ-ONLY — evidence only, zero fixes  
> **Commit at HEAD:** `270645e659249194db0ed0db665da99b24f96d7f`

---

## ONE-LINE VERDICT

**INTENDED** — The commit that added the Portfolio option explicitly states the intent to create portfolio deals via the create-deal form, and a live frontend link (`Dashboard` → "Add Asset" button) still routes to it. However, a **second parallel path** (`F3PortfolioView` → inline modal → `POST /api/v1/portfolio/assets`) was later added and is now the de facto working path. The two paths create different entities (`deals` vs `properties`) and are **not reconciled** — this is a design ambiguity that needs human direction, but the original intent for the CreateDealPage path is unambiguous.

---

## 5-HOP EVIDENCE TABLE

| Hop | Finding | File:Line / Git / Evidence |
|-----|---------|---------------------------|
| **1. Provenance of the option** | The Portfolio option was added in commit `f6e384260` (2026-03-08) alongside an "Add Asset" button on the Assets Owned page. The commit message explicitly says: "Introduces an 'Add Asset' button on the Assets Owned page to create new portfolio deals and updates the Create Deal page to pre-select the portfolio category." The option was added as an **intended entry path**, not a placeholder. | `git show f6e384260 --stat` → `frontend/src/pages/CreateDealPage.tsx` (+6 lines), `frontend/src/pages/AssetsOwnedPage.tsx` (+14 lines). Commit subject: "Add navigation from assets to portfolio deals and update asset creation". |
| **2. Spec intent** | No governing spec (`CLAUDE.md`, `JEDI_RE_MASTER_SPEC_INDEX.md`) explicitly states that portfolio assets are created via the CreateDealPage form. The `HISTORICAL_OBSERVATIONS_SPEC.md` references `AddExistingPropertyForm.tsx` as a "direct entry of already-owned properties (skips Pipeline)" — but this component does **not exist** in the repo. The spec does NOT mention the CreateDealPage as a portfolio entry path. Absence is not proof, but it is a **vestige signal** corroborated by the fact that the later spec documents a different direct-entry form. | `docs/HISTORICAL_OBSERVATIONS_SPEC.md:583` — `AddExistingPropertyForm.tsx` — direct entry (skips Pipeline). `CLAUDE.md` / `JEDI_RE_MASTER_SPEC_INDEX.md` — no matches for portfolio+create-deal form. |
| **3. Org-handoff ownership** | The `acquisition_to_operations` handoff does **NOT** fully own portfolio creation. It only **transitions** an existing deal to `status='CLOSED_OWNED'` (`organization.service.ts:371`). It does NOT set `deal_category`, `is_portfolio_asset`, or `ownership_status`. It assumes a deal already exists. A separate entry path IS needed for creating portfolio deals from scratch. | `backend/src/services/organization.service.ts:361-373` — `UPDATE deals SET status = 'CLOSED_OWNED', acquisition_date = NOW() WHERE id = $1`. No `deal_category`, `is_portfolio_asset`, or `ownership_status` write. |
| **4. Live-DB provenance** | The 3 existing portfolio assets (Frisco TX, McKinney TX, Duluth GA) were **manually seeded** via migration `20260531_deal_monthly_actuals_is_portfolio_asset.sql`, not created via any API path. Their `properties` rows have `ownership_status='portfolio'` set by migration `20260531_portfolio_properties_ownership_status.sql`. No `deals` row with `deal_category='portfolio'` exists in the migration evidence. **No live DB connection available** in this environment (no `DATABASE_URL`, no `.env`, no `psql`). | `backend/src/database/migrations/20260531_deal_monthly_actuals_is_portfolio_asset.sql:37-39` — 3 seeded properties with `is_portfolio_asset=TRUE`. `backend/src/database/migrations/20260531_portfolio_properties_ownership_status.sql:6-12` — `UPDATE properties SET ownership_status='portfolio'`. |
| **5. Downstream expectation** | Two separate downstream universes exist, each reading different tables: <br> (a) **Property-based portfolio system** (`portfolio.routes.ts`, correlation engine, agent tools) reads `properties.ownership_status='portfolio'` and `deal_monthly_actuals.is_portfolio_asset=TRUE`. This is satisfied by `POST /api/v1/portfolio/assets` (the F3PortfolioView modal path). <br> (b) **Deal-based portfolio UI** (`Dashboard.tsx:327`, `useDealMode.ts:12`, `DealSidebar.tsx:68`) filters `deals` by `dealCategory === 'portfolio' && state === 'POST_CLOSE'`. This is **NOT satisfied by any API path** — no deal meets both criteria. The F3PortfolioView modal creates a `properties` row but **no `deals` row**, so the Dashboard's `portfolioAssets` filter is always empty for API-created assets. <br> **Conclusion:** The CreateDealPage path IS needed for the deal-based consumers, but the property-based path already works. | `frontend/src/pages/Dashboard.tsx:327` — `deals.filter(d => d.dealCategory === 'portfolio' && d.state === 'POST_CLOSE')`. `frontend/src/hooks/useDealMode.ts:12` — `deal.dealCategory === 'portfolio' || deal.state === 'POST_CLOSE'`. `backend/src/api/rest/portfolio.routes.ts:95-136` — portfolio listing reads `properties` + `deal_monthly_actuals`, not `deals`. |

---

## HOP 4 — LIVE-DB QUERY (SUBSTITUTE: MIGRATION EVIDENCE)

No live DB connection available. The following migration files serve as authoritative historical evidence of the portfolio asset provenance:

```sql
-- From 20260531_deal_monthly_actuals_is_portfolio_asset.sql:37-39
-- 3 seeded properties (manually inserted, not API-created):
--   a1000001-0000-0000-0000-000000000001  — 4800 Spring Creek Pkwy, Frisco TX    (18mo, source=manual)
--   a1000001-0000-0000-0000-000000000002  — 1200 Eldorado Pkwy, McKinney TX      (18mo, source=manual)
--   7ea31caf-f070-43eb-9fd1-fe08f7123701  — 2789 Satellite Blvd, Duluth GA 30096 (13mo, source=yardi)

-- From 20260531_portfolio_properties_ownership_status.sql:6-12
UPDATE properties SET ownership_status = 'portfolio' WHERE id IN (...3 UUIDs...);
```

No `deals` row with `deal_category='portfolio'` is mentioned in any migration. The `deals` table's `deal_category` column is not backfilled for these assets.

---

## THE PARALLEL PATH PROBLEM

The system now has **two un-reconciled portfolio entry paths** that create different entities:

| Path | Entry Point | API Endpoint | Creates | Status |
|------|-------------|------------|---------|--------|
| **Path A (deals-based)** | `Dashboard.tsx:128` → "Add Asset" button → `/deals/create` with `state={category:'portfolio'}` | `POST /api/v1/deals` (Express) | `deals` row with `deal_category='portfolio'` | **Broken** — stamps `status='PROSPECT'`, no portfolio semantics |
| **Path B (properties-based)** | `F3PortfolioView.tsx:224` → "Add Asset" modal → `POST /api/v1/portfolio/assets` | `POST /api/v1/portfolio/assets` | `properties` row with `ownership_status='portfolio'` | **Working** — but creates no `deals` row |

**Downstream split:**
- Path B feeds the **property-based portfolio system** (`GET /api/v1/portfolio/assets`, metrics, actuals, correlation engine) — ✅ works
- Path A would feed the **deal-based portfolio UI** (`Dashboard.tsx:327` filter, `useDealMode.ts`, `DealSidebar.tsx`) — ❌ broken, no deal ever matches the filter

This is not a simple "vestige vs intended" binary. It is a **design fork** — two paths were added at different times with different assumptions, and they diverged. The original intent (Path A, commit `f6e384260`) was to create portfolio deals via the standard deal creation flow. The later addition (Path B, F3PortfolioView modal) bypassed the deal flow entirely and created properties directly.

---

## PRESCRIPTION (READ-ONLY — NO CODE)

If the verdict is **INTENDED**, the live-handler insertion point is:

**Insertion point:** `backend/src/api/rest/inline-deals.routes.ts:466-491` (the `INSERT INTO deals` statement inside the `POST /` handler).

**Semantics owed:**
1. If `deal_category === 'portfolio'`: set `status = 'CLOSED_OWNED'` instead of `'PROSPECT'`
2. Skip the acquisition pipeline initialization (the `autoDiscoverComps`, `processDealDocuments`, and Inngest `deal.created` event emission should be gated or redirected for portfolio deals)
3. Create a linked `properties` row with `ownership_status = 'portfolio'` (mirroring the `POST /api/v1/portfolio/assets` behavior)
4. Set `is_portfolio_asset` context so the deal-based and property-based portfolio views converge

**Exact removal site if VESTIGE:**
- `frontend/src/components/deal/CreateDealModal.tsx:319-331` — the Portfolio button
- `frontend/src/pages/CreateDealPage.tsx:114, 428-430, 568-571` — the `dealCategory` state, the submit handler routing, and the category selection button
- `frontend/src/components/dashboard/AssetsSection.tsx:128` — the "Add Asset" button that navigates to `/deals/create` with `category:'portfolio'` — would need to redirect to the F3PortfolioView "Add Asset" modal or `POST /api/v1/portfolio/assets` directly

---

*END OF REPORT — STOP. No fixes applied. Human picks direction before any fix dispatch.*
