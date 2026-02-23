# JEDI RE - Real Estate Intelligence Platform

## Overview

This is Leon D's development workspace containing multiple projects, with **JEDI RE** as the primary active project. JEDI RE is a B2B real estate intelligence platform that uses AI-powered analysis engines to help investors and developers source deals, analyze zoning, and score market opportunities. The platform uses a "map-agnostic" architecture that avoids expensive GIS infrastructure by letting users bring their own maps while the system focuses on intelligence processing.

Secondary projects in this workspace include **Traveloure** (travel booking platform with AI itinerary generation), an **Apartment Locator AI** (consumer search platform), and an **Agent Dashboard** (real estate agent CRM with client management).

The workspace also contains an AI assistant persona called "RocketMan" that maintains continuity through markdown-based memory files.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### JEDI RE (Primary Project)

**Problem:** Real estate investors are overwhelmed with data but lack synthesized, actionable intelligence.

**Architecture:** Express + GraphQL + WebSocket backend with Python geospatial engines, designed as a lightweight map-agnostic system.

- **Backend (99% complete):** Node.js/TypeScript with Express, GraphQL resolvers, WebSocket handlers, and 15+ REST route modules (~6,315 lines TypeScript across 47 files). The backend intentionally supports running without a database for development flexibility.
- **Python Integration:** Seamless TypeScript-to-Python bridge (<200ms latency) powering GeoPandas analysis, PostGIS spatial queries, and 245 zoning code definitions. Core engines include Signal Processing (Kalman filtering, FFT), Carrying Capacity (ecological supply analysis), and Imbalance Detection.
- **Frontend (40-65% complete):** React with Mapbox integration. 164+ components defined including MapBuilder with drawing tools, CreateDealModal wizard, three-panel layout, and grid views. Components are partially wired to backend APIs.
- **Database:** PostgreSQL with optional TimescaleDB. Schema uses Drizzle ORM (config at `drizzle.config.ts`, schema at `shared/schema.ts`). 13+ migrations covering map layers, configurations, agent dashboard tables. Database is intentionally optional for dev mode.
- **JEDI Score Engine:** 5-signal scoring system (0-100) with demand integration, alert system (Green/Yellow/Red), and score history tracking.
- **Map Layer System:** Photoshop-like layer architecture with 5 layer types, drag-drop reordering, War Maps composer, bubble/heatmap/choropleth renderers.
- **CoStar Integration:** 26 years of historical market timeseries data parsed and fed through signal processing pipeline.

**Key Design Decision:** Map-agnostic approach reduces infrastructure costs from $50-100K/year to $5-10K/year by storing only zoning rules and intelligence data, not full parcel geometries.

**Deal Capsule Module Architecture (Feb 2026):**
Each deal ("capsule") uses a 6-group tab navigation system in `DealDetailPage.tsx`:

| Group | Modules (Tab IDs) | Component |
|-------|-------------------|-----------|
| **DEAL STATUS** | Overview (`overview`), 3D Building Design (`3d-design`), Deal Lifecycle (`deal-status`), Context Tracker (`context-tracker`) | OverviewSection, Design3DPageEnhanced, DealStatusSection, ContextTrackerSection |
| **ANALYSIS** | Market Intelligence (`market-intelligence`), Competition (`competition`), Supply Pipeline (`supply`), Trends (`trends`), Traffic Engine (`traffic`) | MarketAnalysisPage, CompetitionPage, SupplyPipelinePage, TrendsAnalysisSection, TrafficAnalysisSection |
| **FINANCIAL** | Financial Model (`financial-model`), Debt & Financing (`debt`), Exit Strategy (`exit`) | FinancialModelingSection, DebtSection, ExitSection |
| **OPERATIONS** | Due Diligence (`due-diligence`), Project Timeline (`timeline`), Project Management (`project-management`), Zoning & Entitlements (`zoning`) | DueDiligencePage, ProjectTimelinePage, ProjectManagementSection, ZoningEntitlementsSection |
| **DOCUMENTS** | Documents (`documents`), Files & Assets (`files`), Notes (`notes`) | DocumentsSection, FilesSection, NotesSection |
| **AI TOOLS** | Opus AI Agent (`ai-agent`), AI Recommendations (`ai-recommendations`) | OpusAISection, AIRecommendationsSection |

**Inter-Module Communication:** `DealModuleProvider` context in `contexts/DealModuleContext.tsx` shares design3D, financial, and market state between modules. Modules can emit events and navigate to other tabs programmatically via `useDealModule()` hook.

**Canonical Module Sources:** Development pages (`pages/development/`) are the canonical versions for Market, Competition, Supply, Due Diligence, and Timeline. Section components (`components/deal/sections/`) house all other modules. Duplicate/legacy components archived in `sections/_archive/`.

**Recent Code Quality Improvements (Feb 2026):**
- **Route extraction complete:** `index.replit.ts` reduced from 1,874 → 268 lines (86% reduction). 45 inline route handlers extracted into 9 dedicated router modules under `api/rest/inline-*.routes.ts`:
  - `inline-health.routes.ts` — health check + DB status
  - `inline-auth.routes.ts` — login (JWT) + user profile
  - `inline-data.routes.ts` — supply, markets, properties, alerts
  - `inline-deals.routes.ts` — 11 deal routes (CRUD + modules/properties/activity/timeline/key-moments/lease-analysis)
  - `inline-tasks.routes.ts` — task CRUD + stats (in-memory store)
  - `inline-inbox.routes.ts` — email inbox CRUD + stats
  - `inline-zoning-analyze.routes.ts` — geocode, zoning lookup, districts, property analysis
  - `inline-apartment-sync.routes.ts` — 10 apartment data sync routes (factory function)
  - `inline-microsoft.routes.ts` — Microsoft OAuth routes (factory function)
- **Zod input validation** on all critical POST/PATCH endpoints: login, create/update deal, create/update task, update email, geocode, analyze, apartment-sync pull. Schemas in `api/rest/validation.ts`
- Auth middleware (`requireAuth`) applied to all 27+ user-scoped routes
- CORS origin validation (not wildcard) for REST and Socket.IO
- Single database pool via `database/connection.ts` with `getPool()` accessor (typed, null-checked)
- Entry point: `index.replit.ts` (active, 268 lines), `index.legacy.ts` (deprecated)
- Dead code removed: `notification.service.ts`
- Property Records: 1,028 Fulton County properties imported via `scripts/import-fulton-properties.ts`
- **Market Intelligence ↔ Property Data Integration:** MI Market Data tab now queries actual `property_records` table via `MARKET_COUNTY_MAP` (maps market IDs like 'atlanta' → Fulton/DeKalb/Cobb/Gwinnett counties). Backend endpoint: `GET /api/v1/market-intelligence/:marketId/properties` with server-side pagination, search, sort. 20 US markets pre-mapped to counties.

- **Module Library System:** Upload historical data (Excel, PDF, CSV) for Opus AI to learn patterns, formulas, and assumptions. 3 module libraries (Financial, Market, Due Diligence) with file upload, parsing status tracking, pattern detection, and template learning. Backend: `moduleLibrary.service.ts` + `module-libraries.routes.ts` (7 REST endpoints with multer). Frontend: `ModuleLibrariesPage.tsx` + `ModuleLibraryDetailPage.tsx` under `/settings/module-libraries`. DB: `module_library_files`, `opus_learned_patterns`, `opus_template_structures` tables.

- **Property Intelligence Layer (Feb 2026):** Real metrics replace placeholder wireframes across 6 deal capsule modules. Two data sources: 1,028 Atlanta multifamily properties (`property_records` table) and 18 West Palm Beach rent comps (`rent_comps` table with 29 columns: rents by unit type, occupancy, concessions, distance, neighborhood).
  - Backend: `propertyMetrics.service.ts` (8 methods: property metrics, density, neighborhood benchmarks, submarket comparison, top owners, owner search, rent comps, market summary) + `property-metrics.routes.ts` (8 REST endpoints at `/api/v1/property-metrics/*`, auth-protected)
  - Frontend: `propertyMetrics.service.ts` API client service
  - **Enhanced Modules:**
    - `OverviewSection.tsx` — Property Intelligence Dashboard: submarket comparison table, top owners, market summary stats
    - `CompetitionSection.tsx` — Sortable rent comp table, CSS scatter plot (rent/SF vs occupancy), unit mix breakdown, effective rent analysis
    - `TrendsAnalysisSection.tsx` — Rent by vintage analysis, occupancy by building age, neighborhood value comparison, concession analysis
    - `ZoningEntitlementsSection.tsx` — Density intelligence dashboard: density tiers, land utilization, zoning insight
    - `RiskManagementSection.tsx` — Market risk dashboard: supply pipeline, occupancy distribution, owner concentration, submarket risk heatmap
    - `ExitSection.tsx` — Exit pricing benchmarks ($/unit by neighborhood), buyer universe (top owners), rent comp exit support (implied value at cap rates)

### Agent Dashboard (CRM Module)

- **Schema:** 5 Drizzle ORM tables — `agent_clients`, `agent_deals`, `agent_leads`, `agent_activities`, `agent_commission_templates`
- **Frontend:** 5 React components (AgentDashboard, ClientList, ClientCard, ClientFilters, AddClientForm) totaling ~1,550 LOC
- **Backend:** REST API routes for financial models, strategy analyses, and due diligence checklists

### Traveloure (Travel Platform)

- **Backend:** Django/Python with Django REST Framework
- **AI:** Claude/Anthropic API for itinerary generation
- **Payments:** Stripe Connect marketplace with provider splits
- **Services:** BookingBot orchestrator, availability management, pricing engine, affiliate link generation
- **Frontend:** React with planning modals, itinerary views, expert registration

### Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Backend Runtime | Node.js + Express (JEDI RE), Django (Traveloure) |
| API Layer | REST + GraphQL + WebSocket |
| Database | PostgreSQL (Drizzle ORM), optional TimescaleDB |
| ORM/Migrations | Drizzle Kit with `shared/schema.ts` |
| Python Engines | GeoPandas, NumPy/SciPy (signal processing), PostGIS |
| Frontend | React + TypeScript + Mapbox |
| Payments | Stripe Connect |
| AI | Claude/Anthropic API |
| Testing | Puppeteer (E2E for Traveloure), manual testing elsewhere |

## External Dependencies

- **PostgreSQL** — Primary database. Drizzle ORM configured in `drizzle.config.ts` pointing to `shared/schema.ts`. Connection via `DATABASE_URL` environment variable. TimescaleDB extension used for time-series data in JEDI RE.
- **Stripe** — Payment processing via Stripe Connect for marketplace payments (Traveloure). Requires `STRIPE_SECRET_KEY` environment variable.
- **Anthropic/Claude API** — AI itinerary generation for Traveloure. Requires `ANTHROPIC_API_KEY` environment variable.
- **Mapbox** — Map rendering for JEDI RE frontend. Requires Mapbox access token.
- **CoStar** — Real estate market data (26 years of Atlanta timeseries integrated via Excel parser). API access pending.
- **Census API** — Demographics data (population, income, employment) for submarket profiling.
- **Google Trends** — Search demand proxy via pytrends library.
- **Puppeteer** — Browser automation for testing (listed in root `package.json`).
- **Affiliate Partners** — Booking.com, Viator, GetYourGuide, OpenTable, Resy, Skyscanner (Traveloure affiliate links).
- **Python Dependencies** — GeoPandas, NumPy, SciPy, pandas, openpyxl for data processing engines.