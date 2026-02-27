# JEDI RE - Real Estate Intelligence Platform

## Overview

JEDI RE is an AI-powered B2B real estate intelligence platform designed for investors and developers. It provides synthesized, actionable intelligence for deal sourcing, zoning analysis, and market opportunity scoring. The platform's core innovation is a "map-agnostic" architecture that integrates user-provided maps to reduce GIS costs, aiming to combat data overload in real estate investment.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Platform

JEDI RE employs a lightweight, map-agnostic architecture using Node.js/TypeScript with Express, GraphQL, and WebSockets for the backend, and React with Mapbox for the frontend. PostgreSQL is used for data storage, leveraging both raw SQL and Drizzle ORM. Python is integrated via a TypeScript-to-Python bridge for geospatial processing (GeoPandas, PostGIS) and zoning code processing.

Key features include:

-   **JEDI Score Engine:** A 5-signal scoring system (0-100) with demand integration and alerts.
-   **Map Layer System:** Photoshop-like layer architecture supporting five types with drag-and-drop reordering.
-   **Deal Capsule Module:** A 6-group tab navigation for comprehensive deal analysis.
-   **Opus Pro Forma Builder:** AI-powered financial modeling using Anthropic Claude, integrating cross-module context and a Data Library.
-   **Data Library:** Global repository for historical property data, categorized for AI matching.
-   **Site Intelligence Module:** Comprehensive site analysis across six scored categories.
-   **Zoning Intelligence Agent:** AI-powered zoning data retrieval and analysis using Anthropic Claude, featuring a verification-first 6-step pipeline, dual-layer knowledge, professional correction, and confidence scoring. This includes deep-linking to Municode citations, dual source links (planning department and Municode), and per-rule source tracing.
-   **Property & Zoning Module:** Embedded within the Deal Detail page, offering a 7-tab progressive workflow for zoning analysis: Boundary & Zoning, Dev Capacity, Highest & Best Use, Regulatory Risk, Zoning Comparator, Time-to-Shovel, and Confirmation Chain.
-   **Enriched Building Envelope Service:** Calculates property development potential, returning sources, calculations, and plain-English insights.
-   **Consolidated Rezone Analysis Service:** Unifies rezone analysis, calculating actual uplift (units, GFA, revenue) from target district data.
-   **Zoning Verification Pipeline:** A verification-first architecture providing per-value source citations, insights, and calculation breakdowns.
-   **Parcel-Level Zoning Lookup:** Automatic zoning code detection via ArcGIS, with AI and web search fallbacks.
-   **Municipal Zoning Database:** Integration with 32 ArcGIS REST API connectors across 13 states for zoning data.
-   **Building Envelope Service:** Universal calculation engine for 6 property types, including Highest & Best Use analysis and Claude-powered optimization.
-   **Zoning Intelligence Module (Constraint Set + Scenarios):** Manages resolved constraint sets and user-defined development programs, including rezone scenarios.
-   **Highest & Best Use (HBU) Analysis:** Auto-loads and ranks 6 property types by estimated value, showing rezone opportunities.
-   **Entitlement Strategy:** Consolidates by-right, variance, and rezone analysis, providing data-driven recommendations.
-   **Module Wiring System:** Cross-module orchestration infrastructure for data flow, event management, and strategy arbitrage.
-   **Capital Structure Engine:** Full capital stack design with a 7-tab frontend component, backend service, and 13 REST endpoints.
-   **Traffic Engine:** Upgraded with a 7-metric leasing funnel, EMA learning loop, 10-year projections, and a 6-tab frontend, integrated with the ProForma.
-   **Data Pipeline Foundation:** Core data infrastructure including granular P&L tracking, data uploads, proforma templates, and a Comp Query Engine.
-   **Benchmark Ingestion Pipelines:** Automated ingestion of rezoning and permit data from public ArcGIS REST APIs for Atlanta and various Florida counties.
-   **Rezoning Precedent & Evidence:** Integrates rezoning history and evidence into zoning details, development capacity, and comparator tools.
-   **Time-to-Shovel Real Data Pipeline:** Uses real benchmark project data for Monte Carlo timeline simulations, providing detailed step durations and jurisdiction comparisons.
-   **3D Building Design Editor:** Interactive Three.js/React Three Fiber viewport for building massing design, displaying zoning envelopes and scenario visualizations.
-   **Design Reference Library:** Manages design reference images with upload, AI analysis, and integration into the 3D viewport.
-   **Zoning Triangulation & Confirmation Chain:** Three-source zoning data reconciliation (County Parcel Records, County Zoning Categories, Municode Ordinance) with a 10-link confirmation chain that transforms raw zoning into investment decisions. Includes parcel ingestion service, jurisdiction calibration feedback loop, and a Confirmation Chain Plumbing UI for diagnostics.

### Agent Dashboard

Provides CRM functionalities for client, deal, lead, and activity management using a Drizzle ORM schema.

### Traveloure

AI-driven travel booking platform for itinerary generation and booking orchestration.

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