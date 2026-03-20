# Strategy Module Wiring — Claude Code Prompts

═══════════════════════════════════════════════════════════════════
SESSION SW1: FIX API PREFIX BUG + ROUTE CONSOLIDATION
═══════════════════════════════════════════════════════════════════

There is a critical bug breaking all strategy frontend API calls.

Read these files:
1. `frontend/src/services/api.ts` — note that `baseURL` is set to `/api/v1`
2. `frontend/src/pages/StrategyBuilderPage.tsx` — note it imports `api` from `../services/api` and calls `api.get('/api/v1/strategies')` on line 121
3. `frontend/src/components/layout/CommandPanel.tsx` — note it imports `api` from `../../lib/api` (which re-exports from services/api) and calls `api.get('/api/v1/strategies')` on line 81

THE BUG: Since `api` has `baseURL: '/api/v1'`, every call like `api.get('/api/v1/strategies')` actually hits `/api/v1/api/v1/strategies` — a double prefix that 404s. Every strategy API call on the frontend fails silently because of this. The pages render but show empty data.

Fix in StrategyBuilderPage.tsx — change ALL api calls:
  `api.get('/api/v1/strategies')` → `api.get('/strategies')`
  `api.get('/api/v1/metrics/catalog')` → `api.get('/metrics/catalog')`
  `api.post('/api/v1/strategies/preview', ...)` → `api.post('/strategies/preview', ...)`
  `api.put('/api/v1/strategies/${strategyId}', ...)` → `api.put('/strategies/${strategyId}', ...)`
  `api.post('/api/v1/strategies', ...)` → `api.post('/strategies', ...)`
  `api.delete('/api/v1/strategies/${strategyId}')` → `api.delete('/strategies/${strategyId}')`
  `api.post('/api/v1/strategies/${id}/run')` → `api.post('/strategies/${id}/run')`

Fix in CommandPanel.tsx — change ALL api calls:
  `api.get('/api/v1/strategies')` → `api.get('/strategies')`
  `api.post('/api/v1/strategies/${strategyId}/run')` → `api.post('/strategies/${strategyId}/run')`

Now fix the ROUTE CONFLICT. There are two overlapping route files:
- `backend/src/api/rest/strategies.routes.ts` — mounted at `/api/v1/strategies`
- `backend/src/api/rest/strategy-definitions.routes.ts` — mounted at `/api/v1/strategy-definitions`

Both serve CRUD on the `strategy_definitions` table. The frontend calls `/strategies` for everything. But some endpoints only exist on one file:

Read both files. Check which endpoints each has:

strategies.routes.ts has:
  GET /           — list strategies
  POST /          — create strategy
  POST /preview   — preview (run without saving)
  PUT /:id        — update
  DELETE /:id     — delete

strategy-definitions.routes.ts has:
  POST /          — create
  GET /           — list
  GET /:id        — get one
  PUT /:id        — update
  DELETE /:id     — delete
  POST /:id/run   — EXECUTE strategy (this is missing from strategies.routes.ts!)
  POST /preview   — preview
  GET /:id/results — get cached results
  POST /score-deal/:dealId — score a deal

The frontend calls `/strategies/:id/run` but that endpoint only exists on strategy-definitions.routes.ts at `/strategy-definitions/:id/run`.

FIX: Add the missing endpoints to `strategies.routes.ts` so the frontend's calls to `/strategies/*` all work:

1. Add `POST /:id/run` to strategies.routes.ts — copy the implementation from strategy-definitions.routes.ts line 357 (calls strategyExecutionService.executeStrategy)
2. Add `GET /:id` to strategies.routes.ts — single strategy fetch
3. Add `GET /:id/results` to strategies.routes.ts — cached results
4. Add `POST /score-deal/:dealId` to strategies.routes.ts — deal scoring

The execution service is already imported in strategy-definitions.routes.ts as:
  `import { StrategyExecutionService } from '../../services/strategyExecution.service';`
Add the same import to strategies.routes.ts and instantiate it.

Build and verify:
  - Open /strategies page — it should load strategies and metrics catalog (no more empty state)
  - Open the CommandPanel (Ctrl+K) — strategies list should populate
  - Click "Run" on a strategy — should call /:id/run and return results


═══════════════════════════════════════════════════════════════════
SESSION SW2: ENSURE TABLES EXIST + SEED DATA CHECK
═══════════════════════════════════════════════════════════════════

Status from SW1: API calls reach the backend. But they may fail if tables don't exist.

The strategy engine requires these tables:
- metric_time_series
- strategy_definitions  
- strategy_runs
- metric_correlations
- geographies

There is NO migration .sql file that creates these tables. They were likely created during a Claude Code session via direct SQL but there's no guarantee they exist on every environment.

Step 1: Create a proper migration file. Look at the numbering in `backend/src/db/migrations/` — the last file is `128_startup_query_indexes.sql`. Create `backend/src/db/migrations/130_strategy_engine_tables.sql`:

```sql
-- Strategy Engine Tables (Sessions 1-4)

CREATE TABLE IF NOT EXISTS geographies (
  id VARCHAR(50) PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  parent_id VARCHAR(50),
  state VARCHAR(2),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS metric_time_series (
  id BIGSERIAL PRIMARY KEY,
  metric_id VARCHAR(50) NOT NULL,
  geography_type VARCHAR(20) NOT NULL,
  geography_id VARCHAR(50) NOT NULL,
  geography_name VARCHAR(255),
  period_date DATE NOT NULL,
  period_type VARCHAR(10) NOT NULL DEFAULT 'monthly',
  value DOUBLE PRECISION NOT NULL,
  source VARCHAR(50) NOT NULL,
  confidence REAL DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mts_unique 
  ON metric_time_series(metric_id, geography_type, geography_id, period_date);
CREATE INDEX IF NOT EXISTS idx_mts_metric_geo 
  ON metric_time_series(metric_id, geography_type);
CREATE INDEX IF NOT EXISTS idx_mts_geo_period 
  ON metric_time_series(geography_id, period_date);
CREATE INDEX IF NOT EXISTS idx_mts_latest 
  ON metric_time_series(metric_id, geography_type, period_date DESC);

CREATE TABLE IF NOT EXISTS strategy_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) DEFAULT 'custom',
  scope VARCHAR(20) DEFAULT 'submarket',
  conditions JSONB NOT NULL DEFAULT '[]',
  combinator VARCHAR(5) DEFAULT 'AND',
  signal_weights JSONB,
  sort_by VARCHAR(50),
  sort_direction VARCHAR(4) DEFAULT 'desc',
  max_results INTEGER DEFAULT 50,
  asset_classes TEXT[] DEFAULT '{}',
  deal_types TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  run_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS strategy_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategy_definitions(id) ON DELETE CASCADE,
  user_id UUID,
  scope VARCHAR(20),
  result_count INTEGER,
  results JSONB,
  execution_ms INTEGER,
  run_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metric_correlations (
  id BIGSERIAL PRIMARY KEY,
  metric_a VARCHAR(50) NOT NULL,
  metric_b VARCHAR(50) NOT NULL,
  geography_type VARCHAR(20) NOT NULL,
  geography_id VARCHAR(50) NOT NULL,
  window_months INTEGER NOT NULL,
  correlation_r REAL NOT NULL,
  lead_lag_months INTEGER,
  p_value REAL,
  sample_size INTEGER,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mc_unique 
  ON metric_correlations(metric_a, metric_b, geography_type, geography_id, window_months);
```

All statements use IF NOT EXISTS so it's safe to run even if some tables already exist.

Step 2: Run the migration. Connect to the database and execute the SQL.

Step 3: Check if preset strategies exist:
```sql
SELECT COUNT(*) FROM strategy_definitions WHERE type = 'preset';
```

If 0, seed the 5 presets. Read `strategy-engine-architecture.md` in the repo root for the exact preset definitions. Insert them with user_id=NULL and type='preset'.

Step 4: Check if metric_time_series has data:
```sql
SELECT metric_id, COUNT(*) FROM metric_time_series GROUP BY metric_id ORDER BY COUNT(*) DESC LIMIT 10;
```

If empty, the ingestion services need to run. Log the status but don't run ingestion here — that's a separate step requiring data files.

Step 5: Check if geographies has data:
```sql
SELECT type, COUNT(*) FROM geographies GROUP BY type;
```

If empty, run the Florida geographies seed: check if `backend/src/scripts/seed-florida-geographies.ts` exists and run it, or create a seed SQL that inserts Florida's 67 counties and major MSAs.

Build. Verify: hit GET /api/v1/strategies — should return the 5 preset strategies (or empty array if no presets, but NO table-not-found error).


═══════════════════════════════════════════════════════════════════
SESSION SW3: WIRE M08 STRATEGY TAB + FIX MOCK FALLBACK
═══════════════════════════════════════════════════════════════════

Status from SW2: Tables exist, routes work, strategies API returns data.

Read `frontend/src/components/deal/sections/StrategySection.tsx` (1,602 lines).

This component has 4 sub-tabs: scores, heatmap, roi, custom. It imports ALL mock data from `enhancedStrategyMockData.ts` and `strategyMockData.ts` (lines 15-37). It makes a real API call to `/strategy-analyses/:dealId` (line 217) using `apiClient` (not `api`), which is correct since `apiClient` has no baseURL prefix.

The problem: when the API call fails (which it does if no strategy analysis exists for the deal), it falls back to mock data on line 317: `setIsLiveData(false)`. The user sees convincing-looking scores that are completely fake with no indication.

Step 1: Fix the mock fallback. When using mock data, show a clear banner at the top of the section:

After line 442 where `{isLiveData ? (` check exists, add a banner for the mock data case:

```tsx
{!isLiveData && (
  <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
    <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
    <span className="text-xs text-amber-700">Showing sample data — strategy scores will update when market intelligence modules are connected.</span>
  </div>
)}
```

Step 2: Also fix the API call. Line 217 calls:
  `apiClient.get('/api/v1/strategy-analyses/${dealId}')`

Check that this endpoint exists on the backend. Read `backend/src/api/rest/strategy-analyses.routes.ts` — verify it has a GET `/:dealId` endpoint. If it does, this call is correct. If it returns empty/error because no analysis has been run, that's expected — the mock fallback is correct behavior for now.

Step 3: Fix the Custom Screen tab. Line 331 fetches strategies:
  `apiClient.get('/api/v1/strategies')`
And line 346 scores the deal:
  `apiClient.post('/api/v1/strategy-definitions/score-deal/${deal.id}')`

The strategies fetch uses `apiClient` (no baseURL prefix) so the path `/api/v1/strategies` is correct.

But the score-deal call goes to `/api/v1/strategy-definitions/score-deal/:dealId` — this endpoint is on `strategy-definitions.routes.ts`. After SW1, we added it to `strategies.routes.ts` too. Change this call to use the canonical path:
  `apiClient.post('/api/v1/strategies/score-deal/${deal.id}')`

Step 4: In the CustomScreenTab component (frontend/src/components/deal/sections/CustomScreenTab.tsx), check its API call pattern. It likely also has path issues. Read the file and fix any double-prefix or wrong-path calls.

Step 5: The scores/heatmap/roi sub-tabs use data from the strategy-analyses endpoint which returns pre-computed scores. If no scores exist, these show mock data (which is OK for now since the scoring engine needs market data to compute real scores). BUT the custom sub-tab should show REAL data — it fetches the user's saved strategies and runs them against the deal's geography. This works independently of the scoring engine.

Build and verify:
  - Open a deal's Strategy tab — should show the mock data banner if no live data
  - Click the Custom Screen sub-tab — should show saved strategies (or "No custom strategies" prompt)
  - If a strategy exists, it should show pass/fail against the deal's metrics


═══════════════════════════════════════════════════════════════════
SESSION SW4: STRATEGY BUILDER LIVE PREVIEW + SAVE FLOW
═══════════════════════════════════════════════════════════════════

Status from SW3: API prefix fixed, routes consolidated, M08 tab shows data.

Read `frontend/src/pages/StrategyBuilderPage.tsx` (1,096 lines).

The page has three tabs: Library, Builder, Deal Scoring. After SW1's API prefix fix, the data fetches should work. But there are likely issues with the save flow and live preview.

Step 1: Test the data fetch. The page loads strategies + metrics on mount (line 117-140). After the prefix fix from SW1, these should work. If the metrics catalog returns empty, check that `backend/src/api/rest/metrics-catalog.routes.ts` actually returns the catalog from `backend/src/services/metricsCatalog.service.ts`. Read the service file and verify it exports a `METRICS_CATALOG` array.

Step 2: Test the live preview. When the user adds conditions and the preview fires (line 163), it calls `POST /strategies/preview` with conditions, scope, and sort parameters. Read the backend `strategies.routes.ts` preview endpoint. It queries `metric_time_series` — if no data has been ingested, it returns empty results. This is correct but the frontend should show "No matching results — ingest market data to enable scanning" instead of just an empty list.

In StrategyBuilderPage, find where preview results are rendered. Add a fallback when results are empty:

```tsx
{previewResults.length === 0 && !previewLoading && conditions.length > 0 && (
  <div className="text-center py-6">
    <p className="text-xs text-gray-500">No matching geographies found.</p>
    <p className="text-[10px] text-gray-400 mt-1">Ensure market data has been ingested for the selected scope.</p>
  </div>
)}
```

Step 3: Test the save flow. Creating a strategy calls `POST /strategies` with the definition. Check that the payload matches what the backend expects. Read the backend POST endpoint — it expects: name, description, scope, conditions (JSONB), combinator, sort_by, sort_direction, max_results, asset_classes, deal_types, tags.

Verify the frontend sends these correctly. Look at the save handler in StrategyBuilderPage (around line 230-245). Check that conditions are serialized as a JSON array where each element has: metricId, operator, value, weight, required, label.

Step 4: Test the run flow. Running a saved strategy calls `POST /strategies/:id/run`. After SW1 this endpoint exists. Check that the response shape matches what the frontend expects. The frontend likely expects `{ results: [...], result_count, execution_ms }`. Read the backend run endpoint and the frontend handler to ensure they match.

Step 5: Fix the "Edit" flow on the Library tab. When a user clicks "Edit" on a strategy card, it should load that strategy's conditions into the Builder tab. Check how the StrategyBuilderPage handles the `:id` route parameter. It should:
  - Read the strategy ID from URL params
  - Fetch the strategy definition: `GET /strategies/:id`
  - Populate the builder form with the strategy's name, description, scope, and conditions
  - Change the save button to "Update" instead of "Create"

If this isn't implemented, add it. Use `useParams` to get the ID, fetch on mount if present, and pre-populate the form state.

Build and verify:
  - /strategies page shows the Library tab with preset strategies
  - Click "Edit" on a preset → opens Builder tab with conditions pre-loaded
  - Add a condition → live preview fires (may return empty if no data)
  - Click Save → strategy is created in the database
  - Navigate back to Library → new strategy appears
  - Click Run → execution fires (may return empty if no data)
