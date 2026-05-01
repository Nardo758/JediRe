# JediRE Project Tracker

## Phase: F9 Financial Engine — Renovation Data Pipeline & Full Model Flow

### Status: Deployed, fixing post-merge issues

---

## Architecture

### Data Flow (F9 Financial Engine)
```
FinancialEnginePage (parent)
  ├── fetchDeal() ──→ /api/v1/deals/:id → deal row (dealType, name, units, etc.)
  ├── fetchF9Financials() ──→ /api/v1/deals/:id/financials?hold=N
  │     └── financials-composer.service.ts
  │           ├── deals table → deal meta, purchase price, units
  │           ├── deal_assumptions table → year1 proforma JSON
  │           └── rent_roll table → unit mix, rent roll summary
  │
  ├── loadAssumptions() ──→ /api/v1/financial-model/:id/latest → ModelAssumptions
  │
  ├── handleBuildModel() ──→ POST /api/v1/financial-model/build → ModelResults
  │     └── Auto-fires on page load via useEffect (after financials + assumptions ready)
  │
  ├── f9Financials (props) → all tabs
  ├── assumptions (props) → AssumptionsTab, etc.
  └── modelResults (props) → ReturnsTab, ProjectionsTab, WaterfallTab, etc.
```

### Data Sources per Tab
| Tab | Data Source | Status |
|-----|-------------|--------|
| ProFormaSummaryTab | fetchF9Financials() via apiClient | ✅ Working |
| OverviewTab | f9Financials props | ✅ Working |
| UnitMixTab | f9Financials.rentRollSummary.unitMix | ✅ Structure |
| AssumptionsTab | f9Financials (model assumptions) + own section state | ✅ Working |
| DebtTab | f9Financials.capitalStack props | ✅ Null-safe |
| TaxesTab | f9Financials.taxes props (null → blank) | ✅ Null-safe |
| SourcesUsesTab | f9Financials props + own capex fetch | ✅ Working |
| ProjectionsTab | f9Financials.projections props (null → blank) | ✅ Null-safe |
| ReturnsTab | f9Financials.returns props (null → dashes) | ✅ Null-safe |
| WaterfallTab | f9Financials props | ✅ Null-safe |
| SensitivityTab | Likely static | ✅ |
| DecisionTab | f9Financials props | ✅ Null-safe |
| CompareTab | Likely static | ✅ |

### Backend Routes Created
| Route | File | Description |
|-------|------|-------------|
| `GET /:dealId/financials` | inline-deals.routes.ts | Full F9DealFinancials composer (3-table query) |
| `POST /:dealId/renovation/premium` | renovation.routes.ts | Premium tier override + ramp recalc |
| `POST /:dealId/renovation/capex-item` | renovation.routes.ts | CRUD for deal_capex_items |
| `GET /:dealId/renovation` | renovation.routes.ts | Full renovation data package |

### Key Components Created
| Component | Location | Description |
|-----------|----------|-------------|
| financials-composer.service.ts | backend/services | Composes full F9DealFinancials from DB |
| renovation.routes.ts | backend/api/rest | 3 endpoints for premium/capex/renovation |
| RenovationAssumptionsSection.tsx | frontend | Premium tier picker, ramp chart, capex items |
| CommentaryPanel.tsx | frontend/proforma | Collapsible AI commentary section |

## Active Issues

### Fixed (this session)
- ✅ **FinancialEnginePage.tsx TDZ crash** — auto-build useEffect was before handleBuildModel declaration. Fixed by Replit agent (Task #472), merged APPROVED.
- ✅ **`/:dealId/financials` no-op** — route handler was orphaned below route. Fixed by routing through financials-composer.service.ts.
- ✅ **Missing DealFinancials shape** — partial response didn't include rentRollSummary, assumptions, capitalStack. Fixed with composer.

### Open
- **F9 tabs show null data** for computed fields (returns, projections, waterfall) until model builds. Auto-build now fires on page load — should populate on first open.
- **`supply_analyses` table doesn't exist** — Supply pipeline DB writes failing with `relation "supply_analyses" does not exist`. Needs migration.
- **`cashflow_projections` table doesn't exist** — Cashflow DB writes failing. Needs migration.
- **`fetch_data_library_comps` SQL error** — column `a.created_at` missing in comps query. Column name mismatch or missing from schema.
- **Research pipeline crash** — `Cannot use 'in' operator to search for '_idmap' in undefined` — likely null return from agent call.

## Git Log (recent)
```
1a0f8ae4a — Auto-build model on F9 load + commentary panel in ProFormaSummaryTab
6d8917c30 — Update expense calculations (Leon)
506206ecb — Align proforma revenue fields (Leon)
327cfffc3 — Fix deal data retrieval (Leon)
543ee54db — Fix: /financials endpoint returns full DealFinancials shape
```

## Next Steps (from memory)
1. ✅ Fix `/:dealId/financials` no-op route → real handler
2. ✅ Add full F9DealFinancials composer
3. ✅ Auto-build model on page load
4. ✅ Add commentary panel
5. ⏳ Backfill missing DB tables — `supply_analyses`, `cashflow_projections`
6. ⏳ Fix comps query column (a.created_at)
7. ⏳ Fix research pipeline _idmap crash
8. ❌ [Deferred] Mapbox token env var
9. ❌ [Deferred] KB embeddings backfill (`POST /api/admin/kg/embeddings/backfill`)
10. ❌ [Deferred] F-tab completion → Inngest events for agent cascade
11. ❌ [Deferred] 3D Studio building view (needs Mapbox token)
