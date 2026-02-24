# JEDI RE - Real Estate Intelligence Platform

## Overview

JEDI RE is an AI-powered B2B real estate intelligence platform designed to assist investors and developers with deal sourcing, zoning analysis, and market opportunity scoring. Its core innovation is a "map-agnostic" architecture, which reduces GIS infrastructure costs by allowing users to integrate their own maps while the platform focuses on intelligence processing. This workspace also contains secondary projects: Traveloure (AI-driven travel booking), an Apartment Locator AI, and an Agent Dashboard (real estate CRM). The overarching goal is to provide synthesized, actionable intelligence to overcome data overload in real estate investment.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### JEDI RE (Primary Project)

JEDI RE is built with an Express + GraphQL + WebSocket backend, integrating Python geospatial engines. The system is designed to be lightweight and map-agnostic.

-   **Backend:** Node.js/TypeScript with Express, GraphQL, and WebSockets. It supports running without a database for development flexibility.
-   **Python Integration:** A TypeScript-to-Python bridge facilitates GeoPandas analysis, PostGIS spatial queries, and processing of 245 zoning code definitions. Core engines include Signal Processing (Kalman filtering, FFT), Carrying Capacity, and Imbalance Detection.
-   **Frontend:** React with Mapbox integration, featuring components like MapBuilder, CreateDealModal, and various grid views.
-   **Database:** PostgreSQL with optional TimescaleDB, using Drizzle ORM for schema management and migrations.
-   **JEDI Score Engine:** A 5-signal scoring system (0-100) with demand integration, alerts, and score history.
-   **Map Layer System:** Photoshop-like layer architecture with five types, drag-and-drop reordering, and various rendering options (bubble, heatmap, choropleth).
-   **Deal Capsule Module:** Features a 6-group tab navigation system for comprehensive deal analysis, including modules for deal status, analysis, financial, operations, documents, and AI tools. Inter-module communication is managed via a `DealModuleProvider` context.
-   **Opus Pro Forma Builder:** An AI-powered financial modeling assistant using Anthropic Claude to generate pro forma models by leveraging cross-module context and data from the Data Library.
-   **Data Library:** A global file repository for historical property data, categorized for automatic matching of comparable files by Opus AI.
-   **Site Intelligence Module:** Provides comprehensive site analysis for development deals across six scored categories: Environmental, Infrastructure, Accessibility, Regulatory, Natural Hazards, and Market Context, with real-time overall scoring.
-   **Property Boundary Module:** Interactive map tools for defining site boundaries, calculating area/perimeter, and visualizing setbacks on Mapbox. Features Site Confirmation panel with reverse-geocoded address, municipality detection with "Zoning Data Available" badge, auto-populated zoning code details (permitted uses, conditional uses, development standards, setbacks from code, rezone targets). Read-only setback outputs populated from zoning code data.
-   **Zoning Intelligence Agent:** AI-powered zoning data retrieval service using Anthropic Claude (via Replit AI Integrations). When zoning detail data is missing from the municipal database, users can trigger the agent to research and retrieve regulations (permitted uses, density, FAR, height, setbacks, parking). Results are persisted to the database with `source='ai_retrieved'`. UI shows data source badges: "Verified" (green, from database) or "AI-Retrieved" (purple, from Claude). Service: `zoning-agent.service.ts`. Endpoint: `POST /api/v1/zoning-agent/retrieve`.
-   **Zoning & Capacity Module:** Multi-constraint analysis (density, FAR, height, parking) with density bonuses (affordable housing, TDR), unit mix distribution, and revenue projection. Integrates with Property Boundary module for buildable area. Two scenarios: By Right vs With Incentives.
-   **Municipal Zoning Database:** 43 municipalities across 13 SE + TX states. 10 verified ArcGIS REST API connectors (Atlanta, Charlotte, Dallas, Memphis, Miami-Dade, Nashville, New Orleans, Richmond, San Antonio, Tampa). 463 unique zoning districts imported via paginated ArcGIS queries. Houston marked non-viable (no traditional zoning). Tables: `municipalities`, `zoning_districts` (with both old and new column names for backward compat), `property_zoning_cache`. REST endpoints: `/api/v1/municipalities`, `/api/v1/zoning/lookup`, `/api/v1/zoning-districts/by-code`, `/api/v1/reverse-geocode`. CLI tools: `seed-municipalities.ts`, `seed-api-municipalities.ts`, `fetch-api-zoning.ts`. Service: `municipal-api-connectors.ts`.
-   **Data Tracker Admin Page:** Comprehensive data coverage monitoring at `/admin/data-tracker`. Backend endpoint: `GET /api/v1/admin/data-tracker` (requireAuth). Features: completeness score (0-100, weighted across 6 data sources), KPI cards, zoning data source breakdown (API/AI/Manual), state coverage grid, expandable municipality table with status filters, and data gaps alerts. Route: `data-tracker.routes.ts`.
-   **Building Envelope Service:** Universal calculation engine supporting 6 property types (multifamily, office, retail, industrial, mixed-use, hospitality) with type-specific density metrics, parking ratios, and revenue assumptions. Calculates buildable area after setbacks, max footprint, max GFA, capacity by constraint (density, FAR, height, parking), and identifies bottleneck. Includes Highest & Best Use analysis comparing all property types by estimated value (NOI/cap rate). Service: `building-envelope.service.ts`. Endpoint: `POST /api/v1/deals/:dealId/building-envelope`. Claude-powered optimization agent provides 3-5 actionable recommendations. Property type configs: multifamily 5% cap, office 7%, retail 6.5%, industrial 6%, hospitality 8%.
-   **Zoning Intelligence Agent (Phase 1):** Specialist AI agent architecture with dual-layer knowledge system. **Layer A (ZoningKnowledgeService):** Deterministic lookups from structured `district_profile` JSONB column — dimensional standards, use permissions, parking rules, cross-references, incentives, overlay districts. **Layer B (ZoningReasoningService):** Claude-powered reasoning with context injection (structured rules + precedents + parcel data). **QueryRouter:** Intent classifier routing to appropriate layer (lookup→A, calculation→A, reasoning→B, application→full pipeline). **8-Step Application Pipeline:** (1) Rule stack identification, (2) Base district application, (3) Overlay adjustments, (4) Capacity scenarios (By Right, Density Bonus, Variance, Rezone), (5) Incentive programs, (6) Entitlement path assessment with risk/probability scores, (7) Claude-generated strategy recommendation, (8) Confidence scoring with jurisdiction maturity levels (novice→competent→expert→authority). New DB tables: `zoning_agent_analyses`, `zoning_precedents`, `zoning_corrections`. Extended `zoning_districts` with `district_profile` JSONB, `confidence_score`, `jurisdiction_maturity`. API: `/api/v1/zoning-intelligence/query`, `/analyze`, `/profile/:code/:municipality`, `/extract-profile`, `/use-check`, `/parking-calc`, `/maturity/:municipality`, `/analyses`. Frontend: `ZoningIntelligencePanel` component integrated into ZoningCapacitySection with chat interface, quick questions, full analysis view with scenario cards, entitlement paths, incentive programs, confidence breakdowns, and citations.
-   **Zoning Intelligence Agent (Phase 2 - Boundary-Driven):** Property Boundary module is now the source of truth for zoning analysis. **PropertyBoundaryResolver** (`property-boundary-resolver.service.ts`): Auto-loads `property_boundaries` data (GeoJSON, area, setbacks, constraints, centroid) by dealId; reverse-geocodes from boundary centroid when deal city is missing (via `geocodingService`); resolves municipality + zoning context automatically. **Geometry-Based Setbacks:** Uses actual parcel GeoJSON bounding box with lat/lng projection for buildable footprint calculation (replaces square root approximation). Constraint adjustments: floodplain -15%, wetlands -20%, protected area -10%, easements -3% each. **Enhanced Confidence Scoring:** Factors in data source (property_boundary vs manual), buildable area presence, constraint flags, and boundary freshness (<30 days boost, >180 days penalty). **Auto-Populate on Save:** When boundary saved via `POST /boundary`, pipeline runs non-blocking and writes results (byRightUnits, byRightGFA, limitingFactor, confidence) to `deals.module_outputs.zoningIntelligence`. **DealId-Only Analysis:** `/analyze` endpoint accepts `dealId` without manual params — auto-fetches all data from boundary + deal records. **Constraint-Aware Incentives:** Floodplain triggers Flood Mitigation Credit; wetlands triggers Wetlands Mitigation Banking program. **Frontend Enhancements:** ZoningIntelligencePanel auto-fetches boundary resolution on mount, shows data completeness badge, constraint flags (floodplain/wetlands/protected), footprint source badges (Measured/GeoJSON Calculated/Estimated), and "From Boundary" source indicator. API additions: `GET /resolve/:dealId`, `GET /constraints/:dealId`.

### Agent Dashboard (CRM Module)

This module provides CRM functionalities for real estate agents, managing clients, deals, leads, and activities. It uses a Drizzle ORM schema with five dedicated tables.

### Traveloure (Travel Platform)

A travel booking platform with AI itinerary generation, using Django/Python for the backend and Anthropic Claude for AI. It includes a booking orchestrator, availability management, and affiliate link generation.

## External Dependencies

-   **PostgreSQL:** Primary database, configured with Drizzle ORM.
-   **Stripe:** Payment processing for marketplace transactions (Traveloure).
-   **Anthropic/Claude API:** AI capabilities for itinerary generation (Traveloure) and financial modeling (JEDI RE).
-   **Mapbox:** Frontend map rendering for JEDI RE.
-   **CoStar:** Integration for historical real estate market data.
-   **Census API:** Demographics data for market profiling.
-   **Google Trends:** Search demand data.
-   **Puppeteer:** Used for testing.
-   **Affiliate Partners:** Booking.com, Viator, GetYourGuide, OpenTable, Resy, Skyscanner (Traveloure).
-   **Python Libraries:** GeoPandas, NumPy, SciPy, pandas, openpyxl for data processing.