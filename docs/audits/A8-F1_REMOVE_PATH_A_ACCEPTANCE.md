# A8-F1 REMOVE PATH A Fix — Acceptance Report

**Date:** 2025-07-08  
**Branch:** `claude/fix-a8f1-remove-path-a`  
**Commit Message:** `fix(portfolio): remove broken deal-based create path, repoint Add Asset to property-first (A8-F1)`

## Decision
Standardize portfolio creation on **Path B** (property-first, `POST /api/v1/portfolio/assets`). Eliminate the broken deal-based create path (Path A) that silently stamps `status='PROSPECT'` with no portfolio semantics.

## Moves Executed

### MOVE 1 — Disable Portfolio option in CreateDealPage.tsx
| File | Change |
|------|--------|
| `frontend/src/pages/CreateDealPage.tsx` | `type DealCategory = 'pipeline';` (was `'pipeline' \| 'portfolio'`) |
| `frontend/src/pages/CreateDealPage.tsx` | Removed Portfolio TypeCard from Category step; only Pipeline remains |
| `frontend/src/pages/CreateDealPage.tsx` | Removed dead portfolio navigation branch in `handleSubmit` |
| `frontend/src/pages/CreateDealPage.tsx` | Default dealCategory state initializer: `dealCategory \|\| 'pipeline'` |

**Result:** Users can no longer select "Portfolio" in the deal creation wizard. All new deals are created with `deal_category='pipeline'`.

### MOVE 2 — Repoint Dashboard "Add Asset" to F3PortfolioView modal
| File | Change |
|------|--------|
| `frontend/src/components/dashboard/AssetsSection.tsx` | Empty-state "Add Asset" button: navigates to `/terminal/portfolio` with `state: { openAddAsset: true }` (was `/deals/create` with portfolio state) |
| `frontend/src/pages/terminal/F3PortfolioView.tsx` | Added `useLocation` + `useEffect` to auto-open Add Asset modal when `location.state?.openAddAsset` is true |

**Result:** Dashboard "Add Asset" now routes to the Portfolio Terminal (Path B) where `POST /api/v1/portfolio/assets` creates a `properties` row with `ownership_status='portfolio'`. Actuals upload via `POST /api/v1/portfolio/assets/:propertyId/actuals` writes to `deal_monthly_actuals` with `property_id`, `deal_id = NULL`, `is_portfolio_asset = TRUE`.

### MOVE 3 — Guard: zero surviving 'portfolio' deal-category writers

#### Files Narrowed
| File | Change | Classification |
|------|--------|---------------|
| `frontend/src/components/agent/deals/DealForm.tsx` | Narrowed deal_category radio to `['pipeline']` only; removed Portfolio option | Active writer (fixed) |
| `backend/src/api/rest/validation.ts` | `createDealSchema.deal_category`: `z.enum(['pipeline']).optional()` (was `['pipeline', 'portfolio']`) | API validation (fixed) |
| `frontend/src/types/index.ts` | `deal_category?: 'pipeline'` (was `'pipeline' \| 'portfolio'`) | Type definition (fixed) |
| `frontend/src/components/deal/CreateDealModal.tsx` | Narrowed `DealCategory` type to `'pipeline'`; removed portfolio button; updated summary text | Deprecated writer (fixed for completeness) |

#### Remaining Hits (Classified — Not Writers)
| File | Line | Context | Classification |
|------|------|---------|---------------|
| `backend/src/api/rest/dashboard.routes.ts` | 480, 510, 626, 657 | SQL `WHERE d.deal_category = 'portfolio'` | **Reader** — queries existing data; will return empty for new deals |
| `backend/src/api/rest/grid.routes.ts` | 284, 329 | SQL `WHERE d.deal_category = 'portfolio'` | **Reader** — same as above |
| `backend/src/api/rest/portfolio.routes.ts` | 370, 457, 483, 494 | SQL `OR d.deal_category = 'portfolio'` | **Reader** — same as above |
| `backend/src/api/rest/rankings.routes.ts` | 566, 630 | SQL `= 'portfolio'` / `!= 'portfolio'` | **Reader** — same as above |
| `backend/src/deals/deals.service.ts` | 87, 96 | `if (dto.deal_category === 'portfolio')` / `!== 'portfolio'` | **Dead code** — NestJS service; NestJS app is **not bootstrapped** in current entry file |

#### Frontend Grep Clean
```bash
grep -rn "deal_category.*['\"]portfolio['\"]" frontend/src
# → No matches

grep -rn "setDealCategory\(['\"]portfolio['\"]\)|deal_category:\s*['\"]portfolio['\"]" frontend/src
# → No matches
```

**Result:** Zero surviving frontend writers. API validation rejects `deal_category='portfolio'` at the schema level. Any existing `deal_category='portfolio'` rows in the DB will remain readable by the SQL queries above, but no new rows can be created via the active frontend or Express API.

## Acceptance Checklist

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | UI: CreateDealPage shows only Pipeline option | ✅ | Verified in code |
| 2 | UI: DealForm (agent) shows only Pipeline option | ✅ | Verified in code |
| 3 | UI: Dashboard "Add Asset" routes to /terminal/portfolio | ✅ | Verified in code |
| 4 | UI: F3PortfolioView auto-opens Add Asset modal from location state | ✅ | Verified in code |
| 5 | API: `POST /api/v1/deals` rejects `deal_category='portfolio'` | ✅ | `z.enum(['pipeline'])` in validation.ts |
| 6 | API: `POST /api/v1/portfolio/assets` remains the canonical portfolio entry | ✅ | Path B unchanged |
| 7 | DB: No new `deal_category='portfolio'` rows created via frontend | ✅ | All frontend writers removed |
| 8 | DB: No new `deal_category='portfolio'` rows created via API | ✅ | Schema validation blocks it |
| 9 | Grep clean: zero frontend writers | ✅ | Confirmed |
| 10 | TypeScript compiles without errors | ⚠️ | Not verified in this session (no `tsc` available); no obvious type mismatches introduced |
| 11 | Existing portfolio deals remain readable | ✅ | Backend SQL readers preserved; no migration needed |
| 12 | No DB migration required | ✅ | Path B actuals already use `property_id` keying; no schema change needed |

## Notes
- **No DB migration required.** The dual-keyed `deal_monthly_actuals` table already supports `property_id`-keyed actuals without a `deal_id`. Path B (property-first) writes actuals with `deal_id = NULL` and `is_portfolio_asset = TRUE`. Existing `deal_category='portfolio'` rows in the `deals` table remain untouched.
- **No NestJS cleanup performed.** The `backend/src/deals/deals.service.ts` has portfolio logic but is part of an un-bootstrapped NestJS app. Since the active Express app has no portfolio writers, this is acceptable for the scope of this fix. If/when NestJS is bootstrapped, that service will need to be reconciled with the Path B standard.
- **TypeScript compilation not verified.** The session environment does not have `tsc` available. The changes are straightforward type narrowing and should not introduce compilation errors, but this should be verified in the developer's local environment before deployment.
