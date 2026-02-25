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
-   **Database:** PostgreSQL with Drizzle ORM.
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