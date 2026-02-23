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
-   **Property Boundary Module:** Offers interactive map tools for defining site boundaries, calculating area/perimeter, and visualizing setbacks on a Mapbox interface.
-   **Zoning & Capacity Module:** Multi-constraint analysis (density, FAR, height, parking) with density bonuses (affordable housing, TDR), unit mix distribution, and revenue projection. Integrates with Property Boundary module for buildable area. Two scenarios: By Right vs With Incentives.
-   **Municipal Zoning Database:** 43 municipalities across 13 SE + TX states. 17 cities with API connectors (Socrata + ArcGIS), 26 cities ready for Municode data upload. Tables: `municipalities`, `zoning_districts` (with both old and new column names for backward compat), `property_zoning_cache`. REST endpoints: `/api/v1/municipalities`, `/api/v1/zoning/lookup`, `/api/v1/zoning-districts/lookup`. CLI tools: `seed-municipalities.ts`, `seed-api-municipalities.ts`, `fetch-api-zoning.ts`. Service: `municipal-api-connectors.ts`.

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