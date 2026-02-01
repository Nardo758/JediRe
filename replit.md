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
├── backend/            # Express + GraphQL backend (port 4000)
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
- Backend runs on port 4000 (Express)
- Database: PostgreSQL (via DATABASE_URL)

## Demo Credentials
- Email: demo@jedire.com
- Password: demo123

## API Endpoints
- Health check: http://localhost:4000/health
- REST API: http://localhost:4000/api/v1
- GraphQL: http://localhost:4000/graphql

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

## Recent Changes
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
