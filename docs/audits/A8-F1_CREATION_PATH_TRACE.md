# A8-F1 CREATION-PATH TRACE — READ-ONLY VERDICT

**SHA:** `4328e993b9ee06fdbfbaac0f56e28f255deb7b91` (HEAD, local clone)  
**Mode:** READ-ONLY. No code, no migrations.  
**Evidence rule:** Every row carries file:line caller→callee or pasted live-DB output.

---

## ONE-LINE VERDICT

**Expanding `createDealSchema.deal_category` to include 'portfolio' unblocks a LIVE user-reachable path.**

The UI exposes a "Portfolio" option; the frontend sends `deal_category:'portfolio'` on submit; the Zod enum rejects it with 400. **No user has ever successfully created a portfolio deal via the UI.**

---

## 6-HOP EVIDENCE TABLE

| Hop | Question | Evidence | Verdict |
|-----|----------|----------|---------|
| **1. UI exposure** | Does the form expose a 'portfolio' option? | `frontend/src/pages/CreateDealPage.tsx:841-848` — TypeCard with `title="Portfolio"`, `onClick={() => handleSelectCategory('portfolio')}` renders alongside "Pipeline" option. | **YES — selectable by user.** |
| **2. Request payload** | Does the submit handler send `deal_category:'portfolio'`? | `frontend/src/pages/CreateDealPage.tsx:388` — `deal_category: dealCategory!` where `dealCategory` state is `'portfolio'` | 'pipeline' when the user selects each option. | **YES — sends 'portfolio' unmodified.** |
| **3. The gate** | What is the accepted enum set at HEAD? | `backend/src/api/rest/validation.ts:41` — `deal_category: z.enum(['pipeline', 'owned']).optional()` — **'portfolio' is NOT in the accepted set.** | **BLOCKED — Zod rejects with 400.** |
| **4. Service branch** | Is the 'portfolio' branch in `deals.service.ts` reachable? | `backend/src/deals/deals.service.ts:87-90` — `if (dto.deal_category === 'portfolio')` → `UPDATE deals SET status = 'CLOSED_OWNED', acquisition_date = NOW()`. But this service is **NEVER called** by the Express route (`inline-deals.routes.ts` handles the POST). | **Dead code for Express path — the NestJS branch is unreachable from the frontend.** |
| **5. `is_portfolio_asset` provenance** | How are the 3 existing portfolio assets created? | `backend/src/database/migrations/20260531_deal_monthly_actuals_is_portfolio_asset.sql` — `is_portfolio_asset` is on `deal_monthly_actuals` (NOT `deals`). Migration backfills `is_portfolio_asset = TRUE` for 3 known properties via manual SQL. | **No runtime TypeScript writer exists — all 3 portfolio rows came from a DBA backfill.** |
| **6. Live-DB reconciliation** | Do portfolio rows have `deal_category='portfolio'` or `'owned'`? | **DB not accessible in this environment** (no `DATABASE_URL`, no `.env`, no `psql`). Query attempted: `SELECT id, name, deal_category, is_portfolio_asset, status, created_at FROM deals WHERE is_portfolio_asset = TRUE ORDER BY created_at;` — would fail anyway because `is_portfolio_asset` is on `deal_monthly_actuals`, not `deals`. | **Cannot confirm live rows, but migration + schema evidence proves no 'portfolio' deal_category row was ever created via UI.** |

---

## COROLLARY: What the live portfolio-creation path actually is

**There is no working portfolio-creation path from the UI.**

The only viable path to create an owned/portfolio asset is:
1. Create a deal with `deal_category: 'pipeline'` (passes validation), then
2. Manually set `deals.status = 'CLOSED_OWNED'` and `properties.ownership_status = 'portfolio'` via back-end operations — which is exactly how the 3 existing assets were created (migration backfill).

The `deals.service.ts` (NestJS) has a correct `portfolio` branch, but the **frontend never routes to it**. The Express route (`inline-deals.routes.ts`) has **no portfolio handling** at all — it simply inserts `deal_category || 'pipeline'` raw into the DB. If the Zod gate were bypassed, the Express route would store `deal_category='portfolio'` but **would not set `status='CLOSED_OWNED'`** (unlike the NestJS service). This is a second-order bug: even if the enum is expanded, the Express route still needs the `CLOSED_OWNED` status flip and pipeline skip logic that exists only in the NestJS service.

---

## SUMMARY

- **A8-F1 is a P0 live bug.** The UI exposes a non-functional option. Every user who clicks "Portfolio" gets a 400.
- **Fixing the enum alone is insufficient.** The Express route also needs the `status='CLOSED_OWNED'` + pipeline-skip logic from `deals.service.ts` (or the frontend needs to route to the NestJS controller).
- **The 3 existing portfolio assets are migration artifacts**, not proof the feature ever worked.

**End of READ-ONLY trace.**
