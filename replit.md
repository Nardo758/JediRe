# JEDI RE - Real Estate Intelligence Platform

## Overview

JEDI RE is an AI-powered B2B real estate intelligence platform for investors and developers, providing synthesized, actionable intelligence for deal sourcing, zoning analysis, and market opportunity scoring. Its core innovation is a "map-agnostic" architecture that integrates user-provided maps to reduce GIS costs. The platform aims to address data overload in real estate investment. Related projects include Traveloure (AI travel booking), an Apartment Locator AI, and an Agent Dashboard (real estate CRM).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### JEDI RE (Primary Project)

JEDI RE employs a lightweight, map-agnostic architecture.

-   **Backend:** Node.js/TypeScript with Express, GraphQL, and WebSockets.
-   **Frontend:** React with Mapbox integration.
-   **Database:** PostgreSQL with raw SQL queries and Drizzle ORM for schema definition.
-   **Python Integration:** TypeScript-to-Python bridge for geospatial processing (GeoPandas, PostGIS) and zoning code processing.
-   **JEDI Score Engine:** A 5-signal scoring system (0-100) with demand integration and alerts.
-   **Map Layer System:** Photoshop-like layer architecture supporting five types with drag-and-drop reordering.
-   **Deal Capsule Module:** A 6-group tab navigation for comprehensive deal analysis.
-   **Opus Pro Forma Builder:** AI-powered financial modeling using Anthropic Claude, integrating cross-module context and a Data Library.
-   **Data Library:** Global repository for historical property data, categorized for AI matching.
-   **Site Intelligence Module:** Comprehensive site analysis across six scored categories.
-   **Zoning Intelligence Agent:** AI-powered zoning data retrieval and analysis using Anthropic Claude, featuring a verification-first 6-step pipeline, dual-layer knowledge, professional correction, and confidence scoring. The `ZoningAgentChat` component lives at the `DealDetailPage` level as a collapsible right-side panel (360px), accessible from any deal module — not just zoning tabs. Suggested queries adapt based on the active deal section (overview, financials, market, zoning sub-tabs, etc.).
-   **Municode Deep-Linking Integration:** Automatic deep-linking of zoning citations to exact sections on `library.municode.com`. Includes `municode_section_map` table (migration 056), `municode-url.service.ts` URL builder with section/district/search/chapter resolution and 30-min municipality cache, REST API at `/api/v1/municode/`, and frontend `SourceCitation` component with Municode badge detection. AI prompts enforce `§{chapter}-{article}.{section}` format for parseable references. Citations resolved via `resolveCodeReference()` with recursive parent-section fallback.
-   **Dual Source Links:** Verification results show both county Planning & Zoning website links and Municode code links. `municipalities.planning_url` (migration 057) stores city planning department URLs. `SourceResolutionResult` includes `planningUrl`, `municodeUrl`, and `webSearchUrl` (Google search fallback). `VerificationCard` renders up to three link types with distinct styling: emerald for Planning & Zoning, violet for Municode, gray for web search fallback.
-   **Per-Rule Source Tracing (Phase 1):** Migration 058 adds per-category section columns (`dimensional_section`, `parking_section`, `density_section`, `height_section`, `setback_section`, `far_section`) to `zoning_districts`. Atlanta's 37 districts are fully mapped with `code_section`, `municode_node_id`, and per-rule section references. The `/zoning-districts/by-code` endpoint returns `source_rules[]` with per-field Municode URLs via `getDistrictRuleUrls()`. Atlanta's `municode_url` is populated (`https://library.municode.com/ga/atlanta/codes/code_of_ordinances`) with `zoning_chapter_path` (`?nodeId=PTIIICOOR_PT16LADECO`).
-   **Property & Zoning Module:** Embedded within the Deal Detail page, offering a 6-tab progressive workflow for zoning analysis: Boundary & Zoning, Dev Capacity (with 4-path selector), Highest & Best Use (standalone tab), Regulatory Risk, Zoning Comparator, and Time-to-Shovel.
-   **Source-Cited Values:** `SourceCitedValue` reusable component displays zoning values with inline §section links to Municode source code. `SourceCitation` component handles Municode badge detection and dual-link rendering. Both `BoundaryAndZoningTab` and `DevelopmentCapacityTab` use source citations on all parameters.
-   **Enriched Building Envelope Service (Phase 2):** `BuildingEnvelopeService.calculateEnvelope()` now returns `sources` (per-constraint citations with § references), `calculations` (step-by-step formula breakdowns), and `insights` (plain-English summaries for envelope, density, height, parking, controlling factor). Accepts optional `sourceRules` from `getDistrictRuleUrls()`. New endpoint `GET /api/v1/deals/:dealId/envelope-enrichment` exposes enriched data to frontend.
-   **Consolidated Rezone Analysis Service (Phase 2):** `backend/src/services/rezone-analysis.service.ts` replaces three duplicate features (Dev Capacity multipliers, Comparator MOCK_NEXT_BEST, Pipeline entitlementPaths multipliers). Uses real `rezoneTargets` from the database + `BuildingEnvelopeService` to calculate actual uplift (units, GFA, revenue) from target district data. Exposed via `GET /api/v1/deals/:dealId/rezone-analysis`. Dev Capacity, Comparator, and Pipeline all consume from this single canonical source.
-   **Zoning Verification Pipeline:** A verification-first architecture with dedicated tables and frontend components for source citation, verification, and user trust gating. Pipeline now includes per-value source citations, insights, and calculation breakdowns. Rezone entitlement path uses real district data from `RezoneAnalysisService`.
-   **Parcel-Level Zoning Lookup:** Automatic zoning code detection via ArcGIS, with Anthropic Claude AI and web search as fallbacks.
-   **Municipal API Connectors:** Configured via `CITY_APIS` for zoning and assessment APIs with city-specific field mappings.
-   **Base-District Fallback:** The `/zoning-districts/by-code` endpoint automatically inherits development standards from base districts.
-   **Municipal Zoning Database:** Covers 43 municipalities across 13 SE + TX states with verified ArcGIS REST API connectors.
-   **Building Envelope Service:** Universal calculation engine for 6 property types using a cascading GBA formula, including Highest & Best Use analysis and Claude-powered optimization.
-   **Split FAR & Zoning Nuances:** Enhanced `zoning_districts` table with `residential_far`, `nonresidential_far`, `density_method`, and height buffers.
-   **Zoning Intelligence Module (Constraint Set + Scenarios):** Stores resolved constraint sets in `deal_zoning_profiles` and user-defined development programs in `development_scenarios`.
-   **Highest & Best Use (HBU) Analysis:** Standalone tab (Tab 3) auto-loads and ranks 6 property types by estimated value. Shows rezone opportunity when a different district would unlock higher value. Endpoint: `GET /api/v1/deals/:dealId/scenarios/hbu`.
-   **Entitlement Strategy (By-Right/Variance/Rezone):** Consolidated into rezone analysis service. Rezone path uses real target district data; variance uses multiplier fallback. Recommendations endpoint enhanced to show data source indicators ("Real District Data" vs "Estimated").
-   **Asset Type Mapping Fix:** Ensures correct mapping of property type categories to `project_type`.
-   **Contact Sync / Import:** Allows importing contacts from Microsoft Outlook or Google accounts.
-   **Module Wiring System:** Cross-module orchestration infrastructure at `backend/src/services/module-wiring/`. Includes a Module Registry, Formula Engine, Data Flow Router, Module Event Bus, Strategy Arbitrage Engine, and Orchestrator for cascade execution and pipeline management across P0, P1, and P2 service adapters.
-   **Capital Structure Engine (M11):** Full capital stack design with a 7-tab frontend component, backend service, and 13 REST endpoints, featuring stack builder, debt sizing, product filtering, mismatch detection, rate analysis, equity waterfall, scenario comparison, and AI insights.
-   **Traffic Engine Module Wiring (M07):** Cross-module wiring connecting Traffic Engine to JEDI Score, Strategy Arbitrage, ProForma, Risk, and Deal Capsule.
-   **Traffic Engine v2:** Upgraded with a 7-metric leasing funnel, EMA learning loop, 10-year projections, and a 6-tab frontend.
-   **M07→M09 Traffic→ProForma Integration:** Translates traffic predictions into 3-layer pro forma assumptions (baseline/platform/override) with a 4-tab frontend for analysis.
-   **Data Pipeline Foundation (M24):** Core data infrastructure including `deal_monthly_actuals` (granular P&L), `data_uploads` + `upload_templates` (CSV/Excel upload tracking with format detection and fuzzy matching), `proforma_templates` + `proforma_snapshots` (reusable assumption sets), and a Comp Query Engine for property comparisons.
-   **Atlanta Benchmark Ingestion Pipeline:** Automated ingestion from Atlanta's public ArcGIS REST APIs (Fulton County Tax Parcels, Rezoning Cases, Special Use Permits, Admin Permits). Targets 100+ unit properties, spatial-joins parcels to rezoning cases to capture FROM_ZONE→TO_ZONE transitions, and links records to `zoning_districts` table via FK columns (`zoning_from_district_id`, `zoning_to_district_id`). Migration 060 adds zoning linkage, parcel details, docket/ordinance tracking columns. Ingestion endpoint: `POST /api/v1/benchmark-timeline/ingest/atlanta`. Service: `backend/src/services/atlanta-benchmark-ingestion.service.ts`.
-   **Municode Search URL Fallback:** `MunicodeUrlService.buildDistrictSearchUrl()` generates search-based Municode links (`?searchRequest={code}&searchType=all`) that always work regardless of stale nodeIds. Returned as `districtSearchUrl` from `getDistrictRuleUrls()` and exposed as `municode_search_url` in the `/zoning-districts/by-code` API response. Frontend prioritizes search URL in the Municipal Code link fallback chain.
-   **Rezoning Precedent in Zoning Details:** `/zoning-districts/by-code` response includes `rezone_precedent` summary (rezoned_from/to counts, approval rate, avg days, recent projects). New endpoint `GET /api/v1/zoning-districts/:districtId/rezone-history`. Frontend shows "Rezoning Precedent" section below zoning detail card with real data from `benchmark_projects`.
-   **Rezoning Evidence in Dev Capacity & Comparator:** `RezoneAnalysisService.getRezoneEvidence()` queries `benchmark_projects` for real rezonings matching from→to district pairs. Evidence (count, approval rate, avg/median days, recent examples with ordinance links) attached to each rezone opportunity. Dev Capacity rezone path shows real precedent data; Comparator table shows approval rate and timeline columns from real data.

### Agent Dashboard (CRM Module)

Provides CRM functionalities for client, deal, lead, and activity management using a Drizzle ORM schema.

### Traveloure (Travel Platform)

AI-driven travel booking platform for itinerary generation and booking orchestration, built with a Django/Python backend.

## External Dependencies

-   **PostgreSQL:** Primary database.
-   **Stripe:** Payment processing.
-   **Anthropic/Claude API:** AI capabilities.
-   **Mapbox:** Frontend map rendering.
-   **CoStar:** Historical real estate market data.
-   **Census API:** Demographics data.
-   **Google Trends:** Search demand data.
-   **Microsoft Graph API:** Contact import (Outlook).
-   **Google People API:** Contact import (Google accounts).
-   **Booking.com, Viator, GetYourGuide, OpenTable, Resy, Skyscanner:** Affiliate partners (for Traveloure).
-   **Python Libraries:** GeoPandas, NumPy, SciPy, pandas, openpyxl.