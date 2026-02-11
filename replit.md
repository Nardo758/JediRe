# JediRe - Real Estate Intelligence Platform

## Overview
JediRe is a full-stack real estate intelligence platform with React frontend, Express backend, GraphQL API, and PostgreSQL database.

## Project Structure
```
├── frontend/           # React + Vite frontend (port 5000)
│   ├── src/
│   │   ├── components/ # UI components (auth, map, dashboard, property)
│   │   ├── pages/      # Page components (AuthPage, MainPage)
│   │   ├── hooks/      # Custom hooks (useAuth, useWebSocket)
│   │   ├── services/   # API and WebSocket services
│   │   └── store/      # Zustand state management
│   └── vite.config.ts  # Vite configuration
├── backend/            # Express + GraphQL backend (port 3000)
│   ├── src/
│   │   ├── api/        # REST and GraphQL endpoints
│   │   ├── auth/       # Authentication logic
│   │   ├── database/   # Database connection
│   │   └── middleware/ # Express middleware
│   └── tsconfig.json
├── migrations/         # Database migrations
│   └── replit/         # Simplified migrations for Replit
├── agents/             # Supply agent (optional Python component)
└── start.sh            # Main startup script
```

## Running the Project
- Frontend runs on port 5000 (Vite dev server)
- Backend runs on port 3000 (Express)
- Database: PostgreSQL (via DATABASE_URL)

## Demo Credentials
- Email: demo@jedire.com
- Password: demo123

## API Endpoints
- Health check: http://localhost:3000/health
- REST API: http://localhost:3000/api/v1
- GraphQL: http://localhost:3000/graphql

## Environment Variables
Key variables are set automatically:
- DATABASE_URL - PostgreSQL connection string
- VITE_API_URL - Frontend API path (/api/v1)

## Zoning Intelligence Features
- Address-based property analysis (no full GIS/parcel data required)
- Geocoding via Nominatim API (free, no API key needed)
- Point-in-polygon zoning lookup using GeoJSON boundaries
- Development potential calculator (max units, GFA, opportunity score)
- Sample Austin zoning data: SF-3, MF-3, GR districts

## Key Services
- `backend/src/services/geocoding.ts` - Address geocoding
- `backend/src/services/zoning.ts` - Zoning lookup and analysis
- `frontend/src/components/property/PropertyAnalyzer.tsx` - Analysis UI

## Component Architecture
```
<App>
  <MainPage>
    <FiltersBar />              # Strategy, Score, Timeline, Modules filters
    <AgentStatusBar />          # Real-time agent confidence indicators
    <QuickInsights />           # Actionable market intelligence
    
    <PropertyAnalyzer />        # Zoning analysis sidebar (togglable)
    
    <MapView>
      <PropertyBubble />        # Color by strategy, size by score
      <CollaboratorCursor />    # Real-time collaboration
    </MapView>
    
    <PropertyDetail>
      <StrategyCard />          # Build-to-Sell, Flip, Rental, Airbnb
      <AgentInsights />         # Per-property agent analysis
      <ZoningPanel />           # Zoning module insights
      <SupplyPanel />           # Supply module insights
      <CashFlowPanel />         # Cash flow module insights
      <AnnotationSection />     # Collaborative annotations
    </PropertyDetail>
  </MainPage>
</App>
```

## State Management (Zustand)
- `properties` - Property list with coordinates, scores, zoning
- `selectedProperty` - Currently selected property
- `mapCenter/mapZoom` - Map viewport state
- `filters` - Active filter settings
- `activeModules` - Enabled analysis modules
- `collaborators` - Real-time collaboration users

## WebSocket Events
- `user_join/leave` - Collaboration presence
- `cursor_move` - Real-time cursor tracking
- `pin_property` - Property pinning sync
- `add_annotation` - Comment synchronization

## All Routes (50+ pages)
### Public Routes
- `/` - Landing page
- `/features` - Features overview
- `/pricing` - Pricing plans
- `/about` - About us
- `/contact` - Contact form
- `/blog` - Blog articles
- `/case-studies` - Case studies
- `/help` - Help center
- `/terms` - Terms of service
- `/privacy` - Privacy policy
- `/security` - Security practices
- `/careers` - Job listings
- `/docs` - API documentation
- `/status` - System status

### Utility Routes
- `/404` - Page not found
- `/verify-email` - Email verification
- `/reset-password` - Password reset
- `/payment` - Payment success/failure

### App Feature Routes
- `/compare` - Property comparison (side-by-side)
- `/pipeline` - Deal pipeline (Kanban board)
- `/calculators` - ROI, mortgage, cash flow, cap rate calculators
- `/analytics` - Portfolio analytics dashboard
- `/alerts` - Alert/watchlist management
- `/team` - Team management
- `/billing` - Payment methods and invoices
- `/integrations` - Integration connections

### Community Routes
- `/referral` - Referral program dashboard
- `/partner-portal` - Partner portal
- `/market-reports` - Market reports library
- `/academy` - Educational courses
- `/community` - Community forum
- `/webinars` - Webinars and events
- `/success-stories` - Customer success stories
- `/press` - Press and media kit
- `/partner-directory` - Partner directory
- `/integrations-marketplace` - Integrations marketplace
- `/investor-profile` - Investor profile questionnaire

### Legal/Utility Routes
- `/reviews` - Reviews aggregator
- `/changelog` - Product updates
- `/sitemap` - Site navigation
- `/cookies` - Cookie preferences
- `/accessibility` - Accessibility statement
- `/dmca` - DMCA notice
- `/unsubscribe` - Email preferences

### Protected Routes
- `/app` - Main dashboard
- `/settings` - User settings

## Database Schema - Deal-Centric Architecture
### Core Tables
- `users` - User accounts
- `properties` - Property listings with coordinates
- `deals` - Core deal entity with PostGIS boundary polygon
- `deal_modules` - Feature toggles per deal (supply, demand, zoning, etc.)
- `deal_properties` - Link properties to deals (auto or manual)
- `deal_emails` - Link emails to deals via AI confidence scoring
- `deal_annotations` - Map markers, notes, custom overlays with geometry
- `deal_pipeline` - Track deal progression through stages
- `deal_tasks` - To-do items per deal with priority/assignment
- `deal_activity` - Activity log for all deal events
- `subscriptions` - User tier management (basic/pro/enterprise)
- `team_members` - Multi-user access for enterprise

### Microsoft Integration Tables
- `microsoft_accounts` - OAuth connections (RLS protected)
- `emails` - Synced emails from Outlook
- `calendar_events` - Synced calendar events
- `email_attachments` - Email file attachments

### Helper Functions
- `get_deal_properties(deal_id)` - Find properties within deal boundary (PostGIS)
- `count_user_deals(user_id)` - Count active deals
- `can_create_deal(user_id)` - Check tier deal limit

### Zoning Tables
- `zoning_districts` - Zoning district definitions
- `zoning_district_boundaries` - GeoJSON boundaries for point-in-polygon lookup

### News Intelligence Tables
- `news_events` - Core intelligence extraction storage (employment, development, transactions, government, amenities)
- `news_event_geo_impacts` - Links events to deals/properties with distance and impact scores
- `news_alerts` - User notifications for high-impact events
- `news_contact_credibility` - Contact credibility tracking for email sources
- `news_sources` - Public source configuration and performance tracking
- `news_event_corroboration` - Track when events corroborate each other

### Email/Inbox Tables
- `email_accounts` - Email account connections
- `emails` - Synced emails with deal linking
- `email_attachments` - Email file attachments
- `email_labels` - Email label/folder system

## Recent Changes
- 2026-02-10: Google OAuth / Gmail integration wired up
  - Installed googleapis and google-auth-library packages
  - Gmail routes mounted at /api/v1/gmail (connect, callback, accounts, sync, emails, sync-logs)
  - GmailSyncService uses GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_GMAIL_CALLBACK_URL (fallback: GOOGLE_REDIRECT_URI / GOOGLE_CALLBACK_URL)
  - Created user_email_accounts and email_sync_logs DB tables
  - Sync service columns aligned with existing emails table schema
  - OAuth callback URL: https://jedi-re.replit.app/api/v1/gmail/callback
- 2026-02-09: Module System wiring (fully functional)
  - Created module_definitions (28 modules, 7 categories) and user_module_settings tables
  - Backend: GET /api/v1/modules (list), GET /api/v1/modules/enabled, PATCH /api/v1/modules/:slug/toggle, POST /api/v1/modules/:slug/purchase
  - Frontend: hasModule() utility with 60s cache + in-flight dedup, useModuleCheck() hook
  - DealPage wired to real GET /api/v1/deals/:dealId with loading/404 handling
  - FinancialAnalysisSection conditionally renders Basic vs Enhanced based on module state
  - ModulesPage toggles call API and invalidate cache for consistency
  - Auth: modules router uses requireAuth middleware, req.user.userId matches JWT payload
- 2026-02-09: Data persistence layer + Module Suggestion system
  - 3 new backend route files: financial-models, strategy-analyses, dd-checklists
  - 4 new DB tables: financial_models, strategy_analyses, dd_checklists, dd_tasks
  - 3 frontend services: financialModels.service, strategyAnalysis.service, ddChecklist.service
  - ModuleSuggestionModal: contextual module recommendations based on deal type + strategy
  - moduleSuggestions.ts: maps deal type/strategy combos to recommended modules
  - Added 'portfolio-dashboard' to ModuleName type union
- 2026-02-09: Fix Create Deal address autocomplete
  - Replaced Google Places API (no API key) with Mapbox geocoding autocomplete
  - Uses existing VITE_MAPBOX_TOKEN for address suggestions with debounced search
  - Keyboard navigation (arrow keys, enter, escape) and click-outside-to-close
  - Auto-advances to next step when address is selected from dropdown
- 2026-02-08: News Intelligence system integration
  - 6 backend endpoints: events (list/detail), dashboard, alerts (list/update), network intelligence
  - Mounted via newsRouter in index.replit.ts at /api/v1/news/*
  - 6 database tables with UUID foreign keys, GIN/GIST indexes
  - NewsIntelligencePage uses real API data (events, alerts, dashboard, network)
  - Resizable split-panel layout with map, category filters, severity badges
  - 6 sample events and 3 alerts seeded for demo user
- 2026-02-08: Email/Inbox system integration
  - 4 backend endpoints: list, stats, detail, update mounted in index.replit.ts
  - EmailPage at /dashboard/email with inbox stats, email list, flag/read toggle
  - 7 seeded emails with attachments and deal linking
- 2026-02-07: Critical bug fixes and infrastructure improvements
  - Fixed database connection to use DATABASE_URL instead of localhost:5432
  - Demo login now generates proper JWT tokens (was returning fake `demo-token-*`)
  - Fixed auth middleware race condition (double client release crash)
  - Added missing deal columns: deal_category, development_type, address, description, acres
  - Dashboard GeoJSON safety: filters invalid boundaries, validates coordinate arrays
  - Map fitBounds handles Polygon and Point geometry types
  - Backend port is 3000 (not 4000 as previously documented)
- 2026-02-06: Added deal-centric schema (10 new tables)
  - deals, deal_modules, deal_properties, deal_emails, deal_annotations
  - deal_pipeline, deal_tasks, subscriptions, team_members, deal_activity
  - 3 helper functions, PostGIS spatial indexes, auto-logging triggers
  - Seeded basic subscription for existing users
- 2026-02-05: Security hardening (architect-reviewed)
  - Fixed RLS context: uses shared pool with proper transactions and parameterized `set_config()`
  - Protected sensitive routes: alerts and Microsoft endpoints now require authentication
  - Alerts endpoint uses authenticated user ID instead of URL parameter
  - Hardened token encryption: validates key length at startup, no random fallback
  - Added `res.on('close')` handler for connection cleanup on aborted requests
- 2026-02-01: Added 31 new pages for complete website
  - Utility pages: 404, email verification, password reset, payment results
  - Core features: property comparison, deal pipeline, calculators, analytics, alerts, team, billing, integrations
  - Community: referral, partner portal, market reports, academy, forum, webinars, success stories, press, partner directory, integrations marketplace, investor profile
  - Legal/utility: reviews, changelog, sitemap, cookies, accessibility, DMCA, unsubscribe
- 2026-02-01: Updated UI to match wireframes
  - New header with search bar and user profile
  - FiltersBar: Strategy, Score, Timeline, Modules, Saved Searches filters
  - AgentStatusBar: Shows agent confidence levels (Supply, Demand, News, Debt, SF Strategy, Cash)
  - QuickInsights: Actionable market intelligence panel
  - PropertyBubble: Color-coded by strategy, sized by score, red ring for arbitrage opportunities
  - PropertyDetail: Strategy comparison cards (Build-to-Sell, Flip, Rental, Airbnb) with ROI metrics
  - AgentInsights: Per-property agent analysis with confidence scores
- 2026-02-01: Added zoning intelligence MVP
  - Created zoning schema (zoning_districts, zoning_district_boundaries tables)
  - Built geocoding and zoning lookup services
  - Added /api/v1/geocode, /api/v1/zoning/lookup, /api/v1/analyze endpoints
  - Created PropertyAnalyzer UI with tab integration in Dashboard
- 2026-02-01: Initial Replit setup
  - Configured frontend on port 5000 with allowedHosts
  - Configured backend on port 4000
  - Set up PostgreSQL database and migrations
  - Created unified start.sh script
