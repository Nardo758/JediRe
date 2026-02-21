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
- **Market Intelligence Module Rebuilt** with signal group architecture:
  - Created signalGroups.ts with 89 outputs across 9 signal groups (Demand, Supply, Momentum, Position, Risk, Composite, Traffic Engine, Dev Capacity, Trade Area)
  - Built reusable OutputCard + OutputSection components with signal group color coding and hover tooltips
  - Rebuilt all 5 dashboard tabs: Overview (25 outputs), Market Data (44 outputs), Submarkets (36 outputs), Trends (23 outputs), Deals (26 outputs)
  - Rebuilt all 3 horizontal pages: Compare Markets (39 outputs, SVG radar chart), Active Owners (10 outputs), Future Supply (21 outputs)
  - Each section has proper skeleton placeholders, output count badges, and signal group highlighting
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
