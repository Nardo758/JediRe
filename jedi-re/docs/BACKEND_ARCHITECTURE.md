# JEDI RE - Backend Architecture
**Complete system design: What we have vs what we need**

---

## Backend Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                 │
│                   (React/Next.js - TBD)                         │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP/REST
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API LAYER                                   │
│                    (FastAPI)                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Authentication & Authorization                           │  │
│  │ Rate Limiting                                            │  │
│  │ Request Validation                                       │  │
│  │ Response Formatting                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ENDPOINTS:                                                     │
│  • /submarkets        - List, search submarkets               │
│  • /properties        - Property details, search               │
│  • /signals           - Get signals for submarket/property     │
│  • /analysis          - Run analysis on demand                 │
│  • /deals             - User deal silos                        │
│  • /alerts            - Alert management                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  BUSINESS LOGIC LAYER                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              METHOD ENGINES                              │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ ✅ 1. Signal Processing (Kalman, Fourier)               │  │
│  │ ✅ 2. Carrying Capacity (Ecological)                     │  │
│  │ ✅ 3. Imbalance Detector (Synthesizer)                   │  │
│  │ 🔄 4. Game Theory (Nash, Concessions)                    │  │
│  │ 🔄 5. Contagion Model (Epidemiology)                     │  │
│  │ 🔄 6. Monte Carlo (Probabilistic)                        │  │
│  │ ⏳ 7. Behavioral Economics (Bias detection)              │  │
│  │ ⏳ 8. Capital Flow (Fluid dynamics)                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            SIGNAL SYNTHESIZERS                           │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ ✅ Supply-Demand Imbalance Signal                        │  │
│  │ 🔄 Position Signal (Game Theory + Network)               │  │
│  │ 🔄 Momentum Signal (Contagion + Monte Carlo)             │  │
│  │ ⏳ Risk Signal (Behavioral + Volatility)                 │  │
│  │ ⏳ JEDI Score (All signals → 0-100)                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DATA ACCESS LAYER                             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              DATA REPOSITORIES                           │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ • SubmarketRepository (CRUD + search)                    │  │
│  │ • PropertyRepository (CRUD + geo queries)                │  │
│  │ • RentTimeseriesRepository (TimescaleDB optimized)       │  │
│  │ • SupplyPipelineRepository (deliveries, permits)         │  │
│  │ • SignalRepository (cached signals)                      │  │
│  │ • UserRepository (auth, preferences)                     │  │
│  │ • DealSiloRepository (user deals)                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         PostgreSQL + TimescaleDB                         │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ ✅ Schema defined (database_schema.sql)                  │  │
│  │                                                           │  │
│  │ Tables:                                                   │  │
│  │ • submarkets, properties                                 │  │
│  │ • rents_timeseries (hypertable)                          │  │
│  │ • supply_pipeline                                        │  │
│  │ • traffic_proxies, search_trends                         │  │
│  │ • demand_signals, supply_signals                         │  │
│  │ • imbalance_signals                                      │  │
│  │ • users, deal_silos                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Redis Cache                                 │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ • Computed signals (TTL: 1 hour)                         │  │
│  │ • API rate limiting                                      │  │
│  │ • Session data                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                 DATA INGESTION LAYER                            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            Data Source Adapters                          │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ 🔄 CoStar API Adapter                                    │  │
│  │ 🔄 PM Software Adapters (AppFolio, Yardi, etc.)          │  │
│  │ 🔄 Census API Adapter                                    │  │
│  │ 🔄 Google Trends Adapter                                 │  │
│  │ 🔄 DOT Traffic Data Adapter                              │  │
│  │ ⏳ Manual Entry Interface                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Background Job Scheduler                       │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ • Daily: Sync external data sources                      │  │
│  │ • Hourly: Recalculate signals                            │  │
│  │ • Weekly: Generate reports                               │  │
│  │ • On-demand: User-triggered analysis                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## What We Have ✅

### Core Engines (Working Code)
1. **Signal Processing** (`src/signal_processing.py`)
   - Kalman filtering
   - Fourier decomposition
   - Confidence scoring
   - Growth rate calculation

2. **Carrying Capacity** (`src/carrying_capacity.py`)
   - Demand modeling
   - Saturation analysis
   - Equilibrium timeline
   - Supply verdicts

3. **Imbalance Detector** (`src/imbalance_detector.py`)
   - Demand + Supply synthesis
   - Composite scoring
   - Actionable verdicts
   - Risk identification

### Database Schema ✅
- Complete PostgreSQL + TimescaleDB schema
- All tables defined
- Optimized for timeseries queries

---

## What We Need to Build 🔄

### 1. API Layer (FastAPI)
**Priority: HIGH - Needed for frontend**

```python
# src/api/main.py
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="JEDI RE API", version="1.0.0")

# Endpoints needed:
@app.get("/submarkets")
async def list_submarkets(...)

@app.get("/submarkets/{submarket_id}/signals")
async def get_submarket_signals(...)

@app.get("/properties/{property_id}")
async def get_property_details(...)

@app.post("/analysis/run")
async def run_analysis(...)

# ... (detailed below)
```

### 2. Data Repositories (DAL)
**Priority: HIGH - API needs these**

```python
# src/repositories/submarket_repository.py
class SubmarketRepository:
    def get_by_id(self, submarket_id: int)
    def search(self, city: str, state: str)
    def get_latest_signals(self, submarket_id: int)

# src/repositories/property_repository.py
class PropertyRepository:
    def get_by_id(self, property_id: int)
    def search_by_submarket(self, submarket_id: int)
    def get_rent_history(self, property_id: int, weeks: int)
```

### 3. Additional Method Engines
**Priority: MEDIUM - Can add progressively**

#### Engine #4: Game Theory
```python
# src/game_theory.py
class GameTheoryEngine:
    def calculate_nash_equilibrium(self, competitors)
    def concession_strategy(self, market_conditions)
    def pricing_optimization(self, comps)
```

#### Engine #5: Contagion Model
```python
# src/contagion.py
class ContagionEngine:
    def calculate_r0(self, rent_increases)
    def predict_spread(self, origin, radius)
    def spread_timeline(self, submarket)
```

#### Engine #6: Monte Carlo
```python
# src/monte_carlo.py
class MonteCarloEngine:
    def run_scenarios(self, deal, iterations=10000)
    def calculate_irr_distribution(self, scenarios)
    def tail_risk_analysis(self, results)
```

### 4. Data Ingestion Adapters
**Priority: MEDIUM - Can start with one**

```python
# src/integrations/costar.py
class CoStarAdapter:
    def sync_properties(self)
    def sync_comps(self)
    def sync_supply_pipeline(self)

# src/integrations/census.py
class CensusAdapter:
    def get_demographics(self, zip_code)
    def get_employment(self, county)
```

### 5. Background Jobs
**Priority: MEDIUM - Needed for automation**

```python
# src/jobs/scheduler.py
from celery import Celery

@celery.task
def daily_data_sync():
    """Sync all external data sources"""
    
@celery.task  
def recalculate_signals(submarket_id):
    """Recalculate all signals for a submarket"""
```

### 6. Authentication & Users
**Priority: LOW - Can use later**

```python
# src/auth.py
from fastapi_users import FastAPIUsers

# JWT-based auth
# User registration/login
# API key management
```

---

## API Endpoints Specification

### Submarkets

```
GET    /api/v1/submarkets
GET    /api/v1/submarkets/{id}
GET    /api/v1/submarkets/{id}/signals
GET    /api/v1/submarkets/{id}/properties
POST   /api/v1/submarkets (admin only)
```

**Response Example:**
```json
{
  "id": 123,
  "name": "Buckhead, Atlanta",
  "city": "Atlanta",
  "state": "GA",
  "population": 48200,
  "latest_signal": {
    "verdict": "CAUTION",
    "composite_score": 38,
    "confidence": 0.78,
    "demand_signal": {
      "strength": "MODERATE",
      "score": 56,
      "rent_growth_rate": 0.028
    },
    "supply_signal": {
      "verdict": "OVERSUPPLIED",
      "saturation_pct": 113.5,
      "equilibrium_quarters": 23
    },
    "recommendation": "Exercise caution...",
    "calculated_at": "2026-02-02T21:00:00Z"
  }
}
```

### Properties

```
GET    /api/v1/properties
GET    /api/v1/properties/{id}
GET    /api/v1/properties/{id}/rents
GET    /api/v1/properties/{id}/comps
POST   /api/v1/properties (admin only)
```

**Response Example:**
```json
{
  "id": 456,
  "name": "Summit Ridge Apartments",
  "submarket_id": 123,
  "address": "123 Main St, Atlanta, GA",
  "total_units": 240,
  "vintage_class": "B+",
  "current_rent": {
    "one_bed_avg": 2100,
    "two_bed_avg": 2600,
    "occupancy_pct": 92.5,
    "concession_weeks": 6,
    "as_of": "2026-02-02"
  },
  "rent_history": [
    {"date": "2026-02-02", "weighted_avg": 2350},
    {"date": "2026-01-26", "weighted_avg": 2340},
    ...
  ]
}
```

### Analysis

```
POST   /api/v1/analysis/run
GET    /api/v1/analysis/{job_id}/status
GET    /api/v1/analysis/{job_id}/results
```

**Request Example:**
```json
{
  "submarket_id": 123,
  "analysis_type": "supply_demand_imbalance",
  "options": {
    "include_monte_carlo": false,
    "confidence_threshold": 0.7
  }
}
```

### User Deals

```
GET    /api/v1/deals
POST   /api/v1/deals
GET    /api/v1/deals/{id}
PUT    /api/v1/deals/{id}
DELETE /api/v1/deals/{id}
```

### Alerts

```
GET    /api/v1/alerts
POST   /api/v1/alerts/subscribe
DELETE /api/v1/alerts/{id}
```

---

## Data Flow Examples

### Example 1: Frontend Loads Submarket Dashboard

```
1. Frontend: GET /api/v1/submarkets?city=Atlanta
   
2. API Layer: Validate request → SubmarketRepository.search()
   
3. Repository: Query PostgreSQL submarkets table
   
4. Repository: Query latest signals from cache (Redis)
   - If not cached: Calculate using Imbalance Detector
   
5. API: Format response with:
   - Submarket details
   - Latest signal verdict
   - Key metrics
   
6. Frontend: Render dashboard with traffic light + score
```

### Example 2: User Clicks "Show Details"

```
1. Frontend: GET /api/v1/submarkets/123/signals?detail=full
   
2. API: SubmarketRepository.get_latest_signals(detail='full')
   
3. Repository: 
   - Fetch from demand_signals table
   - Fetch from supply_signals table
   - Fetch from imbalance_signals table
   
4. API: Return full breakdown:
   - Demand components
   - Supply components
   - Methodology details
   - Confidence intervals
   
5. Frontend: Render Level 2 disclosure (expandable sections)
```

### Example 3: Run Analysis on New Property

```
1. Frontend: POST /api/v1/analysis/run
   Request: { property_id: 789, analysis_type: "full" }
   
2. API: Create background job
   
3. Background Job:
   a. Fetch rent history (PropertyRepository)
   b. Fetch submarket data (SubmarketRepository)
   c. Run Signal Processing → clean rent trend
   d. Run Carrying Capacity → supply verdict
   e. Run Imbalance Detector → composite signal
   f. Store results in signals tables
   g. Update job status: "complete"
   
4. Frontend: Poll GET /api/v1/analysis/{job_id}/status
   
5. When complete: GET /api/v1/analysis/{job_id}/results
   
6. Frontend: Display results
```

---

## Technology Stack

### Core
- **Language:** Python 3.11+
- **API Framework:** FastAPI
- **Database:** PostgreSQL 15 + TimescaleDB 2.x
- **Cache:** Redis 7.x
- **Background Jobs:** Celery + Redis broker

### Libraries
```txt
# API & Web
fastapi==0.104.0
uvicorn==0.24.0
pydantic==2.5.0

# Database
psycopg2-binary==2.9.9
sqlalchemy==2.0.23
alembic==1.12.1  # Migrations

# Data Processing
numpy==1.26.0
scipy==1.11.0
pandas==2.1.0  # For data manipulation

# Background Jobs
celery==5.3.4
redis==5.0.1

# Auth (later)
fastapi-users==12.1.0
python-jose==3.3.0  # JWT

# Testing
pytest==7.4.0
pytest-asyncio==0.21.0
```

### Deployment
- **Container:** Docker + Docker Compose
- **Server:** Ubuntu 22.04 LTS
- **Reverse Proxy:** Nginx
- **Process Manager:** Supervisord or systemd

---

## File Structure

```
jedi-re/
├── src/
│   ├── api/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app
│   │   ├── dependencies.py      # Auth, DB session
│   │   └── routes/
│   │       ├── submarkets.py    🔄 Need to build
│   │       ├── properties.py    🔄 Need to build
│   │       ├── signals.py       🔄 Need to build
│   │       ├── analysis.py      🔄 Need to build
│   │       └── deals.py         🔄 Need to build
│   │
│   ├── repositories/
│   │   ├── __init__.py
│   │   ├── base.py              🔄 Need to build
│   │   ├── submarket.py         🔄 Need to build
│   │   ├── property.py          🔄 Need to build
│   │   ├── rent_timeseries.py   🔄 Need to build
│   │   └── signal.py            🔄 Need to build
│   │
│   ├── engines/
│   │   ├── __init__.py
│   │   ├── signal_processing.py      ✅ Done
│   │   ├── carrying_capacity.py      ✅ Done
│   │   ├── imbalance_detector.py     ✅ Done
│   │   ├── game_theory.py            🔄 Need to build
│   │   ├── contagion.py              🔄 Need to build
│   │   └── monte_carlo.py            🔄 Need to build
│   │
│   ├── integrations/
│   │   ├── __init__.py
│   │   ├── costar.py            🔄 Need to build
│   │   ├── census.py            🔄 Need to build
│   │   ├── google_trends.py     🔄 Need to build
│   │   └── pm_software/
│   │       ├── appfolio.py      ⏳ Future
│   │       └── yardi.py         ⏳ Future
│   │
│   ├── jobs/
│   │   ├── __init__.py
│   │   ├── scheduler.py         🔄 Need to build
│   │   ├── sync_data.py         🔄 Need to build
│   │   └── calculate_signals.py 🔄 Need to build
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── database.py          🔄 SQLAlchemy models
│   │   └── schemas.py           🔄 Pydantic schemas
│   │
│   └── utils/
│       ├── __init__.py
│       ├── cache.py             🔄 Redis helpers
│       └── config.py            🔄 Settings
│
├── tests/
│   ├── test_engines/
│   ├── test_api/
│   └── test_integrations/
│
├── alembic/                     🔄 Database migrations
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── database_schema.sql          ✅ Done
├── requirements.txt             ✅ Done
└── README.md                    ✅ Done
```

---

## Build Priority

### Phase 1: MVP Backend (Next 2 Weeks)

**Week 1:**
1. ✅ Core engines (DONE)
2. 🔄 SQLAlchemy models (map to schema)
3. 🔄 Basic repositories (CRUD operations)
4. 🔄 FastAPI endpoints (submarkets, properties, signals)
5. 🔄 Redis caching layer

**Week 2:**
6. 🔄 Data ingestion (at least one adapter - CoStar or Census)
7. 🔄 Background job scheduler
8. 🔄 API documentation (auto-generated by FastAPI)
9. 🔄 Docker setup for easy deployment

**Deliverable:** Working API that frontend can consume

### Phase 2: Enhanced Engines (Weeks 3-8)
10. Game Theory engine
11. Contagion engine
12. Monte Carlo engine
13. Position Signal synthesizer
14. Momentum Signal synthesizer

### Phase 3: Production Ready (Weeks 9-12)
15. Authentication & authorization
16. Rate limiting
17. Monitoring & logging
18. Load testing
19. Production deployment

---

## What Frontend Will Need

### Endpoints Frontend Will Call

**Dashboard:**
- `GET /api/v1/submarkets?city={city}` - List submarkets
- `GET /api/v1/submarkets/{id}/signals` - Get signal for traffic light

**Submarket Detail Page:**
- `GET /api/v1/submarkets/{id}` - Full submarket data
- `GET /api/v1/submarkets/{id}/properties` - Properties in submarket
- `GET /api/v1/submarkets/{id}/signals?detail=full` - Full breakdown

**Property Detail Page:**
- `GET /api/v1/properties/{id}` - Property details
- `GET /api/v1/properties/{id}/rents` - Rent history (for charts)
- `GET /api/v1/properties/{id}/comps` - Comparable properties

**Analysis Page:**
- `POST /api/v1/analysis/run` - Trigger analysis
- `GET /api/v1/analysis/{job_id}/status` - Check progress
- `GET /api/v1/analysis/{job_id}/results` - Get results

### Data Formats Frontend Expects

All responses will be JSON with this structure:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-02-02T21:00:00Z",
    "version": "1.0.0"
  }
}
```

Error responses:
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Submarket with id 999 not found"
  }
}
```

---

## Next Steps

1. **Review this architecture** - Does it cover what you need?
2. **I'll build the API layer** - FastAPI endpoints + repositories
3. **Then you'll know exactly** what data the frontend needs

Should I start building the API layer now?
