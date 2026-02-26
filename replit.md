# JEDI RE - Real Estate Intelligence Platform

## Overview

JEDI RE is an AI-powered B2B real estate intelligence platform designed for investors and developers. Its primary purpose is to provide synthesized, actionable intelligence for deal sourcing, zoning analysis, and market opportunity scoring, addressing data overload in real estate investment. A key innovation is its "map-agnostic" architecture, which integrates user-provided maps to reduce GIS costs. The platform also includes related projects such as Traveloure (AI-driven travel booking), an Apartment Locator AI, and an Agent Dashboard (real estate CRM).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### JEDI RE (Primary Project)

JEDI RE utilizes a lightweight, map-agnostic architecture.

-   **Backend:** Node.js/TypeScript with Express, GraphQL, and WebSockets.
-   **Frontend:** React with Mapbox integration for map building and deal management.
-   **Database:** PostgreSQL with raw SQL queries via `query()` from `backend/src/database/connection.ts`. Drizzle ORM schema at `backend/src/db/schema/dataPipeline.ts` provides TypeScript types (`DealMonthlyActual`, `ProformaTemplate`, `Property`, etc.) for type safety — but queries remain raw SQL.
-   **Python Integration:** TypeScript-to-Python bridge for geospatial engines (GeoPandas, PostGIS) and zoning code processing.
-   **JEDI Score Engine:** A 5-signal scoring system (0-100) with demand integration and alerts.
-   **Map Layer System:** Photoshop-like layer architecture supporting five types with drag-and-drop reordering.
-   **Deal Capsule Module:** A 6-group tab navigation for comprehensive deal analysis.
-   **Opus Pro Forma Builder:** AI-powered financial modeling using Anthropic Claude, leveraging cross-module context and a Data Library.
-   **Data Library:** A global repository for historical property data, categorized for AI matching.
-   **Site Intelligence Module:** Comprehensive site analysis across six scored categories: Environmental, Infrastructure, Accessibility, Regulatory, Natural Hazards, and Market Context.
-   **Zoning Intelligence Agent:** AI-powered zoning data retrieval and analysis using Anthropic Claude. It features a verification-first 6-step pipeline (Source Resolution → Verify & Confirm → Rule Stack Assembly → Calculate Capacity → Entitlement Path Analysis → Strategy Synthesis) with dual-layer knowledge (deterministic lookups and Claude reasoning), professional correction, and confidence scoring.
-   **Property & Zoning Module:** Embedded within the Deal Detail page, this module offers a 7-tab progressive workflow for zoning analysis: Property Boundary, Confirm Zoning, Entitlement Tracker, Dev Capacity, Regulatory Risk, Zoning Comparator, and Time-to-Shovel. Tabs unlock progressively based on completion.
-   **Zoning Verification Pipeline:** A verification-first architecture with tables for `jurisdiction_source_map`, `zoning_source_citation`, and `zoning_verification`. The frontend components facilitate source citation, verification, and user trust gating.
-   **Parcel-Level Zoning Lookup:** Automatic zoning code detection via ArcGIS spatial query, with Anthropic Claude AI and web search as a fallback for unverified areas. Displays data source and confidence levels.
-   **Municipal API Connectors:** Configured via `CITY_APIS` to distinguish between zoning and assessment APIs. Includes specific field mappings for cities like Atlanta.
-   **Base-District Fallback:** The `/zoning-districts/by-code` endpoint automatically inherits development standards from base districts for conditional variants.
-   **Municipal Zoning Database:** Covers 43 municipalities across 13 SE + TX states with verified ArcGIS REST API connectors.
-   **Building Envelope Service:** Universal calculation engine for 6 property types using a cascading GBA formula, including Highest & Best Use analysis and Claude-powered optimization. The Dev Capacity tab displays headline cards, charts, GBA breakdown, and zoning standards.
-   **Split FAR & Zoning Nuances:** Enhanced `zoning_districts` table with `residential_far`, `nonresidential_far`, `density_method`, and height buffers. Building envelope service selects FAR based on deal type.
-   **Zoning Intelligence Module (Constraint Set + Scenarios):** Stores resolved constraint sets in `deal_zoning_profiles` and user-defined development programs in `development_scenarios`. `ZoningProfileService` automatically assembles profiles. The `DevelopmentCapacityTab` is refactored for a scenario-driven UI.
-   **Highest & Best Use (HBU) Analysis:** An endpoint calculates and ranks 6 property types by estimated value based on zoning constraints. The frontend displays capacity, GFA, revenue, NOI, value, and limiting factors.
-   **Entitlement Strategy (By-Right/Variance/Rezone):** An endpoint calculates three entitlement paths (By-Right, Variance, Rezone) with associated risk, success rate, timeline, and cost. The frontend displays these strategies in a card layout with risk badges.
-   **Asset Type Mapping Fix:** Ensures correct mapping of property type categories to `project_type` during deal creation and updates.
-   **Contact Sync / Import:** Allows importing contacts from Microsoft Outlook or Google accounts using Microsoft Graph API and Google People API.
-   **Module Wiring System:** Cross-module orchestration infrastructure at `backend/src/services/module-wiring/`. API: `/api/v1/module-wiring`. Components:
    -   **Module Registry** (`module-registry.ts`): 25 modules (M01-M25) with typed definitions, dependencies, outputs, build status, and priority.
    -   **Formula Engine** (`formula-engine.ts`): 62 formulas (F01-F35, F40-F66) as pure calculation functions (JEDI Score, NOI, Cap Rate, IRR, debt sizing, WACC, waterfall, rate analysis, etc.).
    -   **Data Flow Router** (`data-flow-router.ts`): Cross-module data routing with caching and readiness checks.
    -   **Module Event Bus** (`module-event-bus.ts`): Real-time inter-module event propagation with debouncing.
    -   **Strategy Arbitrage Engine** (`strategy-arbitrage-engine.ts`): 4-strategy scoring (Build-to-Sell, Flip, Rental, STR) with arbitrage detection.
    -   **Module Wiring Orchestrator** (`module-wiring-orchestrator.ts`): Cascade execution, pipeline management, P0/P1/P2 priority ordering.
    -   **P0 Service Adapters** (`p0-service-adapters.ts`): Connects existing services (JEDI Score, Demand Signal, Supply Signal, Risk Scoring) to the wiring infrastructure. 5 wiring chains: P0-1 (M25→M01), P0-2 (M19→M06+M04), P0-3 (M02→M03→M08), P0-4 (M04+M06→M14), P0-5 (Strategy Arbitrage). API endpoints at `/wire/*`.
    -   **P1 Service Adapters** (`p1-service-adapters.ts`): Wires Pro Forma (M09), Scenarios (M10), Competition (M05), and Debt (M11). Chains: P1-1 (M09 Pro Forma sync/init), P1-2 (M10 Scenario generation), P1-3 (M05→M07 Competition→Market), P1-4 (M11 Debt Analysis). API endpoints at `/wire/proforma/*`, `/wire/scenarios/*`, `/wire/competition/*`, `/wire/debt/*`.
    -   **P2 Service Adapters** (`p2-service-adapters.ts`): Wires Traffic (M16), Exit (M12), and Portfolio (M22). Chains: P2-1 (M16 Traffic Intelligence/Forecast), P2-2 (M12 Exit Analysis), P2-3 (M22 Portfolio Performance). API endpoints at `/wire/traffic/*`, `/wire/exit/*`, `/wire/portfolio`.
    -   **Capital Structure Adapter** (`capital-structure-adapter.ts`): Wires Capital Structure Engine (M11) with stack, waterfall, scenarios, rate analysis, and full pipeline. Cross-module subscriptions: M09→M11, M08→M11. API endpoints at `/wiring/capital-structure/*`.
-   **Capital Structure Engine (M11):** Full capital stack design with 7-tab frontend component, backend service (`capital-structure.service.ts`), and 13 REST endpoints (`/api/v1/capital-structure/*`). Features: stack builder, debt sizing, product filtering, mismatch detection, rate analysis, equity waterfall, scenario comparison, and AI insights. M11 upgraded from "Debt Analysis" with 29 formulas (F21-F22, F40-F66) and 13 outputs.
-   **Traffic Engine Module Wiring (M07):** Cross-module wiring connecting Traffic Engine to JEDI Score (M25), Strategy Arbitrage (M08), ProForma (M09), Risk (M14), and Deal Capsule. Backend services: `traffic-correlation.service.ts` (T-04 correlation signal, T-07 trajectory, T-09 competitive share) and `traffic-module-wiring.ts`. Database: 8 traffic tables across 3 migrations (021, 028, 032).
-   **Traffic Engine v2:** Upgraded with 7-metric leasing funnel (traffic→tours→apps→net_leases→occupancy→eff_rent→closing_ratio), EMA learning loop (`trafficLearningService.ts`), 10-year projections (`tenYearProjectionService.ts`), and 6-tab frontend (`TrafficEngineV2Section.tsx`). Database: migration 043 adds `traffic_learned_rates`, `traffic_upload_history`, `traffic_projections` tables.
-   **Opus Pro Forma Builder:** AI-powered financial modeling using Anthropic Claude, leveraging cross-module context and a Data Library.
-   **M07→M09 Traffic→ProForma Integration:** `trafficToProFormaService.ts` translates traffic predictions into 3-layer pro forma assumptions (baseline/platform/override). 4-tab frontend (`ProFormaWithTrafficSection.tsx`): Translation Pipes, 3-Layer Assumptions, 10-Year Income Statement, Returns Comparison. API endpoints: `GET /proforma/:dealId/traffic-integration`, `POST /proforma/:dealId/traffic-refresh`. `proforma-adjustment.service.ts` extended with `updatePlatformLayer()` method.
-   **Data Pipeline Foundation (M24):** Core data infrastructure with 5 tables, 3 views, and 2 trigger functions:
    -   **`deal_monthly_actuals`**: Granular P&L table (45+ columns) covering revenue, expenses, NOI, debt service, capex, leasing metrics, and STR metrics. Auto-calculates derived fields (occupancy_rate, opex_ratio, noi, noi_per_unit, cash_flow_before_tax, renewal_rate) via `fn_calculate_actuals_derived` trigger.
    -   **`data_uploads` + `upload_templates`**: CSV/Excel upload tracking with column mapping. 3 seeded templates (Manual, AppFolio, Yardi). Service: `data-upload.service.ts` (raw SQL, actuals queries) + `uploadService.ts` (Drizzle ORM, file parsing/upload with SheetJS, PM format detection for AppFolio/Yardi/RealPage, fuzzy column matching, bulk upsert). Drizzle DB wrapper: `database/drizzle.ts`.
    -   **`proforma_templates` + `proforma_snapshots`**: Reusable assumption sets (30+ fields) and generated 3-layer proforma results. Service: `proforma-template.service.ts` (CRUD), `proforma-generator.service.ts` (3-layer generator with F16-F22 return calculations).
    -   **Comp Query Engine**: `comp-query.service.ts` queries `v_comp_search` view with 5-factor scoring (type 40pts, proximity 25pts, vintage 15pts, scale 10pts, recency 10pts). All queries fully parameterized. `compQueryEngine.ts` adds paginated search with aggregate stats (median rent, NOI ranges), F27 Rent Comp Analysis (Haversine distance + rent premium/discount), and F26 Submarket Stats. API: `POST /comps/search/v2`, `GET /comps/property/:id/rent-comps`, `GET /comps/submarket/:id/stats`.
    -   **Views**: `v_latest_actuals`, `v_actual_vs_budget`, `v_comp_search` (trailing-12 averages with geographic joins).
    -   **API endpoints**: `POST /properties/:id/actuals/upload`, `POST /properties/:id/actuals/detect-columns`, `GET /properties/:id/actuals`, `GET /upload-templates/:format`, `POST /comps/search`, `GET /comps/property/:id`, `POST /properties/:id/proforma/generate`, `GET /properties/:id/proforma/snapshots`, CRUD `/properties/templates`.
    -   **Two-Step Upload Flow** (`upload.routes.ts`): `POST /uploads/preview` (file parse + format detection + column mapping preview with in-memory cache), `POST /uploads/process` (confirm mapping → Drizzle bulk upsert into `deal_monthly_actuals` with property access check and failure-safe upload record updates), `GET /uploads/templates` (Drizzle query), `GET /uploads/history/:propertyId` (Drizzle query with access check).
    -   **Seed data**: 2 DFW properties (Parkway 290 Frisco, Cedar Hills McKinney) with 18 months of monthly actuals each. 1 system proforma template (Garden Value-Add DFW 2024).

### Agent Dashboard (CRM Module)

Provides CRM functionalities including client, deal, lead, and activity management, using a Drizzle ORM schema.

### Traveloure (Travel Platform)

An AI-driven travel booking platform featuring itinerary generation and booking orchestration, built with a Django/Python backend.

## External Dependencies

-   **PostgreSQL:** Primary database.
-   **Stripe:** Payment processing.
-   **Anthropic/Claude API:** AI capabilities.
-   **Mapbox:** Frontend map rendering.
-   **CoStar:** Historical real estate market data.
-   **Census API:** Demographics data.
-   **Google Trends:** Search demand data.
-   **Puppeteer:** Testing.
-   **Affiliate Partners:** Booking.com, Viator, GetYourGuide, OpenTable, Resy, Skyscanner (for Traveloure).
-   **Python Libraries:** GeoPandas, NumPy, SciPy, pandas, openpyxl.