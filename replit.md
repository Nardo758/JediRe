# JEDI RE - Commercial Real Estate Intelligence Platform

## Overview
JEDI RE is a comprehensive commercial real estate intelligence platform with dual-mode functionality (Pipeline/Owned Assets), featuring 17 modules including AI Agent, Map View with Mapbox, real-time collaboration, PostGIS spatial queries, external integrations, Deal Capsule System with ML capabilities, property type strategy matrix (51 types x 4 strategies), custom strategy builder, regional market organization (61 US markets across 5 regions), 8-step deal creation workflow with document upload, Module Library System, Property Records Import System, and Market Intelligence module.

## Architecture
- **Frontend**: React + TypeScript + Vite + Tailwind CSS (port 5000)
- **Backend**: Express + TypeScript (port 4000)
- **Database**: PostgreSQL with PostGIS extensions
- **Map**: Mapbox GL JS via react-map-gl
- **State**: Zustand for client state
- **Build**: Vite with path alias `@/` -> `src/`

## Project Structure
```
frontend/          # React frontend
  src/
    components/    # UI components (layout, deal, auth, map, etc.)
    pages/         # Page components
    contexts/      # React contexts (Architecture, MapLayers)
    services/      # API service modules
    stores/        # Zustand stores
    lib/           # Shared utilities (api.ts)
    types/         # TypeScript type definitions
    hooks/         # Custom hooks
  vite.config.ts   # Vite config with @ alias and proxy to backend
  tailwind.config.js
  postcss.config.cjs

backend/           # Express backend
  src/
    api/rest/      # Route handlers (inline-*.routes.ts, market-intelligence, etc.)
    api/websocket/ # WebSocket handlers
    middleware/    # Auth (requireAuth/authenticateToken), error handler
    services/     # Business logic services
    database/     # DB connection pool, migrations
    config/       # Environment configuration
    auth/         # JWT utilities
    models/       # Data models
    utils/        # Utility functions
  
start.sh           # Startup script (runs backend + frontend)
```

## Key Files
- `backend/src/index.replit.ts` - Main backend entry point, route registration
- `backend/src/middleware/auth.ts` - JWT auth middleware (exports: requireAuth, authenticateToken, optionalAuth, requireRole, requireApiKey)
- `backend/src/database/connection.ts` - PostgreSQL connection pool (max: 20)
- `backend/src/config/environment.ts` - Environment config validator
- `frontend/src/App.tsx` - React router with all page routes
- `frontend/src/components/layout/MainLayout.tsx` - Main sidebar layout
- `frontend/vite.config.ts` - Vite config with @ alias, proxy to localhost:4000

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-set by Replit)
- `JWT_REFRESH_SECRET` - JWT refresh token secret
- `MICROSOFT_CLIENT_ID/SECRET/TENANT_ID` - Microsoft Graph API
- `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL` - Google OAuth
- `VITE_MAPBOX_TOKEN` - Mapbox access token
- `TOKEN_ENCRYPTION_KEY` - Token encryption
- `API_KEY_APARTMENT_LOCATOR` - Apartment locator API key

## Workflow
- Single workflow "JediRe" runs `bash start.sh`
- start.sh starts backend (ts-node on port 4000) and frontend (vite on port 5000) concurrently

## Recent Changes (2026-02-21)
- **Market Intelligence UI Upgraded to Production Quality** - All 9 pages rebuilt from skeleton to full design spec:
  - **My Markets Landing**: 6 market cards with 5-signal mini bars (D/S/M/P/R), sort controls (JEDI/Rent Growth/Pipeline%/Constraint/Traffic), grid/list/map view toggle, rich data (rent, jobs/apt, pipeline%, constraint score, AI one-liner)
  - **Overview Tab**: Split layout with 5-Signal Health Bar + AI Market Summary, data coverage bar, 3 alert cards with severity colors, dual-column Supply Snapshot (near-term S-outputs vs long-term DC-outputs with mini SVG supply wave chart)
  - **Market Data Tab**: Sortable property database table (8 columns), slide-out Property Flyout with Rent/Ownership/Traffic Intelligence/Trade Area sections, Demand-Supply Dashboard with verdicts, Rent by Vintage table, Ownership intelligence, Transaction History, Traffic & Demand Heatmap toggles, CSV/Excel export + clipboard copy, enhanced filters (units range, $/unit range)
  - **Submarkets Tab**: Choropleth map with 7 layer toggles, 14-column ranking table with DC/T columns, expandable submarket detail, comparison panel with bar charts, AI verdict
  - **Trends Tab**: Time range selector (3M-Max), 6 chart sections with descriptions (rent by vintage + DC-11 forecast, 2yr/10yr supply toggle with SVG bars, dual-axis demand, transactions scatter, concessions area, JEDI decomposition)
  - **Deals Tab**: AI opportunity cards with Traffic/Trade Area badges, opportunity algorithm transparency, 4-column Kanban pipeline, market deal activity table, strategy arbitrage leaderboard
  - **Compare Markets**: Market selector toggles, SVG radar chart (8 axes including DC/T), 25-row side-by-side metrics table, Entry Point Calculator with DC-11 forecasts, AI investment recommendation narratives
  - **Active Owners**: Seller/buyer activity dashboard, owner database with BUY/HOLD/SELL signals, expandable owner detail with portfolio/land positions/timeline/AI assessment, acquisition target generator with 6 filters
  - **Future Supply**: Enhanced scoreboard with capacity/constraint/overhang columns, Gantt delivery calendar with DC-06 ghost bars, 10-year SVG supply wave with phase labels, build economics monitor, developer land bank table
- **Market Research Consolidated into Market Intelligence** - Removed duplicate "Market Research" sidebar item; moved CSV/Excel/Clipboard export and enhanced filters (units range, $/unit range) into Market Data tab; old /market-data and /market-research routes redirect to /market-intelligence
- **Data Integration Phase 1** - Connected real Atlanta property data from database:
  - Backend: 4 new API endpoints (GET /properties, /properties/:id, /market-stats/:marketId, /submarket-stats/:marketId) with parameterized SQL, filtering, sorting, pagination
  - MarketDataTab: Fetches 1,028 real properties from DB with search/filter controls, property flyout loads real detail + sales history
  - OverviewTab: Coverage bar shows real counts (1,028 props, 249,964 units) with LIVE badge
  - MarketIntelligencePage: Atlanta card shows live property/unit counts from DB
  - SubmarketsTab: Merges real property counts with mock signal scores
  - Auth: Routes use optionalAuth so data endpoints work without login, LIVE badges distinguish real vs mock data
- **Previous**: Signal group architecture (signalGroups.ts with 89 outputs across 9 groups)
- Installed Node.js 20 module for proper PATH resolution in workflows
- Fixed root package.json (was empty, causing vite config load failure)
- Added JWT_REFRESH_SECRET environment variable
- Recovered ~250 emptied source files from git history (commit 4250d988 had accidentally emptied them)
- Fixed vite.config.ts: added `@` path alias for `src/` directory
- Fixed Microsoft routes import in index.replit.ts (factory function, not default export)
- Added `authenticateToken` alias export in auth middleware
- Both backend and frontend servers running successfully

## Database
- PostgreSQL with PostGIS extensions
- 1,028 Fulton County properties (249,964 units) imported
- 52 market trend records
- Connection pool max: 20 connections

## Known Issues
- LLM API key not configured (AI features disabled)

## Market Intelligence Module
- Navigation: Sidebar > Intelligence > Market Intelligence (expandable)
- Sub-pages: My Markets, Compare Markets, Active Owners, Future Supply
- Market Dashboard: 5 tabs (Overview, Market Data, Submarkets, Trends, Deals)
- Routes: /market-intelligence, /market-intelligence/markets/:marketId, /market-intelligence/compare, /market-intelligence/owners, /market-intelligence/supply
