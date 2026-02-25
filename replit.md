# JEDI RE - Real Estate Intelligence Platform

## Overview

JEDI RE is an AI-powered B2B real estate intelligence platform for investors and developers, focusing on deal sourcing, zoning analysis, and market opportunity scoring. Its key innovation is a "map-agnostic" architecture that integrates user-provided maps, reducing GIS costs. The platform aims to provide synthesized, actionable intelligence to combat data overload in real estate investment. The workspace also includes secondary projects: Traveloure (AI-driven travel booking), an Apartment Locator AI, and an Agent Dashboard (real estate CRM).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### JEDI RE (Primary Project)

JEDI RE features a lightweight, map-agnostic architecture with a Node.js/TypeScript backend, integrating Python geospatial engines.

-   **Backend:** Node.js/TypeScript with Express, GraphQL, and WebSockets.
-   **Frontend:** React with Mapbox integration, including components for map building and deal management.
-   **Database:** PostgreSQL with optional TimescaleDB, managed by Drizzle ORM.
-   **Python Integration:** TypeScript-to-Python bridge for GeoPandas, PostGIS, and processing zoning code definitions. Core engines include Signal Processing, Carrying Capacity, and Imbalance Detection.
-   **JEDI Score Engine:** A 5-signal scoring system (0-100) with demand integration and alerts.
-   **Map Layer System:** Photoshop-like layer architecture supporting five types with drag-and-drop reordering.
-   **Deal Capsule Module:** A 6-group tab navigation system for comprehensive deal analysis, managed by a `DealModuleProvider` context.
-   **Opus Pro Forma Builder:** AI-powered financial modeling assistant using Anthropic Claude, leveraging cross-module context and data from the Data Library.
-   **Data Library:** A global file repository for historical property data, categorized for AI matching.
-   **Site Intelligence Module:** Comprehensive site analysis across six scored categories: Environmental, Infrastructure, Accessibility, Regulatory, Natural Hazards, and Market Context.
-   **Zoning Intelligence Agent:** AI-powered zoning data retrieval and analysis service using Anthropic Claude. Features a verification-first 6-step pipeline: Source Resolution → Verify & Confirm → Rule Stack Assembly → Calculate Capacity → Entitlement Path Analysis → Strategy Synthesis. Includes a dual-layer knowledge system (deterministic lookups and Claude-powered reasoning), professional correction and precedent learning systems, and robust confidence scoring.
-   **Property & Zoning Module:** Merged module embedded in the Deal Detail page (`/deals/:dealId/detail` → sidebar → "Property & Zoning") via `ZoningModuleSection`. Features a 7-tab progressive workflow: (1) Property Boundary → (2) Confirm Zoning → (3) Entitlement Tracker → (4) Dev Capacity → (5) Regulatory Risk → (6) Zoning Comparator → (7) Time-to-Shovel. Tabs unlock progressively: Tab 1 always open, Tab 2 unlocks after boundary saved, Tabs 3-7 unlock after zoning confirmed. `PropertyBoundarySection` renders with `embedded={true}` to suppress its own header inside the module. Deal type (BTS/Rental/Flip/STR) flows from deal capsule → backend analysis. Migration 051 adds `deal_zoning_confirmations` table. Light theme, professional card layouts, descriptive risk levels (no numeric scores), AI chat drawer (`ZoningAgentChat`). Backend: 6 services, 5 API route files, 9 DB tables (migrations 049-051). Tab components in `frontend/src/components/zoning/tabs/`.
-   **Zoning Verification Pipeline:** Verification-first architecture (migration 050) with 3 new tables: `jurisdiction_source_map` (43 seeded municipalities with Municode/municipal_direct/county source tiers), `zoning_source_citation` (code section citations with URLs and cached text), `zoning_verification` (per-parcel verification records with trust gate). Backend service: `zoning-verification.service.ts` + `zoning-verification.routes.ts` (7 endpoints). Frontend: reusable components `SourceCitation.tsx`, `SourceSidePanel.tsx`, `VerificationCard.tsx`, `UserTrustGate.tsx`, `CalculationBreakdown.tsx` — all in `frontend/src/components/zoning/`. Tab 1 (Zoning Lookup) restructured into 4 sections: Verification → Confirmed Rules → Capacity Analysis → AI Recommendation, with Sections B-D gated behind user trust confirmation.
-   **Parcel-Level Zoning Lookup:** Automatic zoning code detection via ArcGIS spatial query when a property boundary is saved. Endpoint `GET /api/v1/zoning/parcel-lookup?lat=&lng=&address=` uses a three-tier cascade: (1) Direct ArcGIS spatial query with `inSR=4326` against verified city GIS APIs (~1-2 seconds, 95% confidence), (2) Claude AI with web search tool as fallback — searches county/city property assessor websites to find the exact zoning code (85% confidence). Both `PropertyBoundarySection` (Boundary tab sidebar) and `ZoningConfirmTab` call parcel-lookup with 90s timeout. Frontend shows the data source with confidence-appropriate styling (green checkmark for ArcGIS, blue "AI-verified" for web search). Configured via `CITY_APIS` in `municipal-api-connectors.ts`. The sidebar distinguishes "Zoning Designation" (from county assessor) vs "Definition" (from Municode).
-   **Municipal API Connectors:** `CITY_APIS` in `municipal-api-connectors.ts` now distinguishes `apiType: 'zoning'` (city GIS with zoning codes) from `apiType: 'assessment'` (county assessor with property data). Fulton County (`services1.arcgis.com/.../Tax_Parcels_2025/FeatureServer`) and DeKalb County assessor APIs registered with verified URLs. Atlanta City GIS field mapping corrected: `ZONING_CLASSIFICATION` (code) and `ZONINGCODE` (description name, not the URL field `ZONEDESC`).
-   **Base-District Fallback:** The `/zoning-districts/by-code` endpoint automatically inherits development standards from the base district when a conditional variant (e.g., MRC-2-C) has null values. Strips the last suffix (regex `^(.+)-[A-Z]{1,2}$`) to find the base (MRC-2), then merges max density, FAR, height, stories, setbacks, parking, description, and permitted uses. Also sanitizes any `district_name` values that are URLs (moves to `source_url`).
-   **Municipal Zoning Database:** Covers 43 municipalities across 13 SE + TX states with verified ArcGIS REST API connectors for major cities.
-   **Data Tracker Admin Page:** Monitors data coverage and completeness with KPIs and alerts.
-   **Building Envelope Service:** Universal calculation engine for 6 property types using cascading GBA (Gross Buildable Area) formula: Max Footprint = MIN(lot after setbacks, lot × lot coverage %), then GBA = MIN(footprint × stories, lot × FAR). Includes Highest & Best Use analysis and Claude-powered optimization. Dev Capacity tab (tab 4) via `GET /api/v1/deals/:dealId/development-capacity` pulls saved boundary `buildable_area_sf` from `property_boundaries` (turf.js polygon-buffered), confirmed zoning from `deal_zoning_confirmations`, district standards from `zoning_districts` (with per-field base-district fallback including `max_lot_coverage` for conditional variants like MRC-2-C → MRC-2). Frontend shows headline cards (Max Units, GBA with governing factor, Stories, Parking), Capacity by Constraint chart, GBA Breakdown (lot area → setbacks → coverage cap → footprint → GBA by height vs FAR → actual GBA → net leasable at ~85% efficiency), and Zoning Standards Applied grid. Auto-loads on tab open.
-   **Chapter 34 Research (Pending Implementation):** Confirmed via Municode (§16-34.027) that Atlanta MRC-2 uses split FAR: Residential 1.49, Nonresidential 2.50, Combined 3.196 (on net lot area). Current DB stores blended `max_far = 3.20`. For primarily residential projects, residential FAR of 1.49 governs — cuts GBA roughly in half. Height: 52 ft only within 150 ft of R-1 through R-5/R-G/MR/PD-H districts; beyond that buffer, 225 ft (up to ~20 stories). No units/acre density cap — MRC-2 is FAR-driven, unit count = net leasable ÷ avg unit size. The "-C" conditional ordinance from Council may impose additional restrictions on height, uses, density, or site plan elements — must be pulled before locking numbers. FAR denominator uses net lot area (after dedications/easements/ROW); residential uses get open space bonus to calculate on gross. Density bonuses: +0.5× FAR for affordable housing (≥20%), +2 SF residential per 1 SF ground-floor retail, +2 SF per 1 SF open space above minimum, civic bonus. Open space: 20% of net lot area for sites > 0.5 acre. Parking: eating/drinking 1/300 SF, office no minimum (max 2.5/1,000 SF), no surface parking between building and street, 5% carpool reserved. **Future implementation needs:** new DB columns `residential_far` and `nonresidential_far`, deal-type-aware FAR selection in building envelope service, adjacency-based height logic, FAR-derived unit counts replacing density cap.
-   **Contact Sync / Import:** Team members can be imported from connected Microsoft Outlook or Google accounts. Backend service `contacts-sync.service.ts` fetches contacts via Microsoft Graph API (`/me/contacts`, `/me/people`) and Google People API. Routes in `contacts-sync.routes.ts`: `GET /contacts/status`, `GET /contacts/microsoft`, `GET /contacts/google`, `POST /deals/:dealId/team/members/import`. Frontend: `ContactImportModal.tsx` with provider selection, search, multi-select, and bulk import. Leverages existing OAuth tokens from `microsoft_accounts` and `user_email_accounts` tables.

### Agent Dashboard (CRM Module)

Provides CRM functionalities for real estate agents, managing clients, deals, leads, and activities, using a Drizzle ORM schema with five dedicated tables.

### Traveloure (Travel Platform)

An AI-driven travel booking platform with itinerary generation, built with a Django/Python backend. It includes booking orchestration, availability management, and affiliate link generation.

## External Dependencies

-   **PostgreSQL:** Primary database.
-   **Stripe:** Payment processing.
-   **Anthropic/Claude API:** AI capabilities for JEDI RE and Traveloure.
-   **Mapbox:** Frontend map rendering.
-   **CoStar:** Historical real estate market data.
-   **Census API:** Demographics data.
-   **Google Trends:** Search demand data.
-   **Puppeteer:** Testing.
-   **Affiliate Partners:** Booking.com, Viator, GetYourGuide, OpenTable, Resy, Skyscanner (for Traveloure).
-   **Python Libraries:** GeoPandas, NumPy, SciPy, pandas, openpyxl for data processing.