# JediRe - Real Estate Intelligence Platform

## Overview
JediRe is a full-stack real estate intelligence platform designed to provide comprehensive real estate intelligence. It offers address-based property analysis, zoning lookup, and development potential calculation. The platform aims to centralize data, automate insights, and facilitate collaborative deal management for real estate professionals. Its core capabilities include advanced mapping, property analysis, deal pipeline management, and integration with external data sources for a holistic view of market opportunities.

## User Preferences
No explicit user preferences were provided in the original `replit.md` file. The agent should assume standard development practices and focus on delivering a functional and well-structured codebase.

## System Architecture
JediRe is built with a React frontend, an Express and GraphQL backend, and a PostgreSQL database.

**Frontend (React + Vite):**
- **UI Components:** Includes dedicated components for authentication, maps, dashboards, and property details.
- **State Management:** Utilizes Zustand for managing application state, including properties, selected property, map state, filters, active modules, and collaborators.
- **UI/UX Decisions:**
    - Features a `FiltersBar` for strategy, score, timeline, and module filtering.
    - `AgentStatusBar` provides real-time agent confidence indicators.
    - `QuickInsights` displays actionable market intelligence.
    - `PropertyBubble` on the map is color-coded by strategy and sized by score, with a red ring indicating arbitrage opportunities.
    - `PropertyDetail` view includes `StrategyCard` for different investment strategies (Build-to-Sell, Flip, Rental, Airbnb) with ROI metrics, and `AgentInsights` with per-property agent analysis and confidence scores.
- **Collaboration:** Supports real-time collaboration features like `CollaboratorCursor` and `AnnotationSection` with WebSocket events for presence, cursor movement, property pinning, and annotation synchronization.

**Backend (Express + GraphQL):**
- **API:** Provides both RESTful and GraphQL endpoints for data access and manipulation.
- **Authentication:** Handles user authentication and authorization.
- **Services:** Key services include geocoding, zoning lookup, and analysis.
- **Module System:** A flexible module system allows toggling and purchasing features per deal.
- **Data Persistence:** Implemented with a deal-centric architecture using PostgreSQL, including tables for users, properties, deals, deal modules, annotations, and various intelligence data.
- **Zoning Intelligence:**
    - Address-based property analysis using Nominatim for geocoding.
    - Point-in-polygon zoning lookup using GeoJSON boundaries.
    - Development potential calculator (max units, GFA, opportunity score).

**Database (PostgreSQL):**
- **Schema:** Designed with a deal-centric approach.
    - **Core Tables:** `users`, `properties`, `deals`, `deal_modules`, `deal_properties`, `deal_emails`, `deal_annotations`, `deal_pipeline`, `deal_tasks`, `deal_activity`, `subscriptions`, `team_members`.
    - **Zoning Tables:** `zoning_districts`, `zoning_district_boundaries`.
    - **Geographic Hierarchy:** `msas`, `submarkets`, `geographic_relationships`, `trade_area_event_impacts`.
    - **Demand Signals:** `demand_event_types`, `demand_events`, `demand_projections`, `trade_area_demand_forecast`, `demand_phasing_templates`.
    - **JEDI Score:** `jedi_score_history`, `deal_alerts`, `alert_configurations`, `demand_signal_weights`.
    - **News Intelligence:** `news_events`, `news_event_geo_impacts`, `news_alerts`, `news_contact_credibility`, `news_sources`, `news_event_corroboration`.
    - **Email/Inbox:** `email_accounts`, `emails`, `email_attachments`, `email_labels`.
- **Spatial Data:** Utilizes PostGIS for geographical queries and spatial indexing.

## External Dependencies
- **PostgreSQL:** Primary database for all application data.
- **Nominatim API:** Used for geocoding addresses (free service).
- **Mapbox:** Utilized for geocoding autocomplete in the frontend.
- **Microsoft OAuth:** Integration for syncing emails and calendar events (e.g., Outlook, Gmail).
- **Google OAuth / Gmail API:** For Gmail integration, including connecting accounts, syncing emails, and managing mailboxes.