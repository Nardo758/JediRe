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
-   **Property Boundary Module:** Interactive map tools for defining site boundaries, calculating area/perimeter, visualizing setbacks, and auto-populating zoning details.
-   **Zoning Intelligence Agent:** AI-powered zoning data retrieval and analysis service using Anthropic Claude. It features a dual-layer knowledge system (deterministic lookups and Claude-powered reasoning), an 8-step application pipeline, professional correction and precedent learning systems, and robust confidence scoring. This module evolves from property boundary-driven analysis to a self-improving engine with user credibility scoring and outcome tracking.
-   **Zoning & Entitlements Module:** Embedded inside the Deal Detail page (`/deals/:dealId/detail` → sidebar → "Zoning & Entitlements") via `ZoningModuleSection` wrapper component. Features 6 sub-tabs (Zoning Lookup, Entitlement Tracker, Dev Capacity, Regulatory Risk, Zoning Comparator, Time-to-Shovel) with light theme, professional card layouts, descriptive risk levels (no numeric scores), action buttons, AI callout boxes, and a bottom AI chat drawer (`ZoningAgentChat`). State managed by `zoningModuleStore` (Zustand). Backend: 5 services, 4 API route files, 5 DB tables (migration 049). Tab components in `frontend/src/components/zoning/tabs/`.
-   **Municipal Zoning Database:** Covers 43 municipalities across 13 SE + TX states with verified ArcGIS REST API connectors for major cities.
-   **Data Tracker Admin Page:** Monitors data coverage and completeness with KPIs and alerts.
-   **Building Envelope Service:** Universal calculation engine for 6 property types, determining buildable area, GFA, capacity by constraint, and performing Highest & Best Use analysis. Includes Claude-powered optimization recommendations.

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