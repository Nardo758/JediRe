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

## Recent Changes
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
