# 🏗️ JEDI RE System Architecture

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Service Architecture](#service-architecture)
4. [Database Schema](#database-schema)
5. [API Structure](#api-structure)
6. [Data Flow](#data-flow)
7. [Security Architecture](#security-architecture)
8. [Scalability Considerations](#scalability-considerations)

---

## System Overview

JEDI RE is a full-stack commercial real estate intelligence platform built with:
- **Frontend:** React + TypeScript + Vite
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL
- **Cache:** Redis
- **Real-time:** Socket.IO (WebSockets)
- **Mapping:** Mapbox GL JS
- **AI/LLM:** Anthropic Claude / OpenAI

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  React Frontend (SPA)                                     │  │
│  │  - React Router (routing)                                │  │
│  │  - Zustand (state management)                           │  │
│  │  - Mapbox GL (mapping)                                   │  │
│  │  - Socket.IO Client (real-time)                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↕ HTTPS/WSS
┌─────────────────────────────────────────────────────────────────┐
│                         API LAYER                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Express.js Backend                                       │  │
│  │  ┌────────────┬────────────┬──────────────┬───────────┐ │  │
│  │  │  REST API  │  GraphQL   │  WebSocket   │  Auth     │ │  │
│  │  └────────────┴────────────┴──────────────┴───────────┘ │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐│  │
│  │  │  Business Logic Services                             ││  │
│  │  │  - Deal Management   - File Upload                  ││  │
│  │  │  - Property Data     - Traffic Tracking             ││  │
│  │  │  - Market Analysis   - LLM Integration              ││  │
│  │  └─────────────────────────────────────────────────────┘│  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                              │
│  ┌──────────────────┐  ┌───────────────┐  ┌──────────────────┐│
│  │  PostgreSQL      │  │  Redis        │  │  File Storage    ││
│  │  (Primary DB)    │  │  (Cache)      │  │  (S3/Local)      ││
│  └──────────────────┘  └───────────────┘  └──────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                            │
│  ┌──────────────┬──────────────┬──────────────┬─────────────┐ │
│  │  Mapbox API  │  Google APIs │  LLM APIs    │  Property   │ │
│  │              │  (Auth/Maps) │  (Claude/GPT)│  Data APIs  │ │
│  └──────────────┴──────────────┴──────────────┴─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend

| Technology | Purpose | Version |
|------------|---------|---------|
| React | UI Framework | 18.2+ |
| TypeScript | Type Safety | 5.2+ |
| Vite | Build Tool | 5.0+ |
| React Router | Routing | 6.20+ |
| Zustand | State Management | 4.4+ |
| Mapbox GL JS | Interactive Mapping | 3.0+ |
| Socket.IO Client | WebSockets | 4.8+ |
| TailwindCSS | Styling | 3.3+ |
| Axios | HTTP Client | 1.6+ |

### Backend

| Technology | Purpose | Version |
|------------|---------|---------|
| Node.js | Runtime | 18+ |
| Express.js | Web Framework | 4.18+ |
| TypeScript | Type Safety | 5.3+ |
| PostgreSQL | Database | 14+ |
| Redis | Caching | 7+ |
| Socket.IO | WebSockets | 4.6+ |
| Passport.js | Authentication | 0.6+ |
| JWT | Token Auth | 9.0+ |
| Winston | Logging | 3.11+ |
| Joi | Validation | 17.11+ |

### External Services

- **LLM:** Anthropic Claude 3.5 Sonnet / OpenAI GPT-4
- **Mapping:** Mapbox / Google Maps
- **Property Data:** Regrid API
- **Authentication:** Google OAuth 2.0
- **Email:** Gmail API (optional)

---

## Service Architecture

### Backend Services Structure

```
backend/src/
├── api/
│   ├── rest/              # REST API endpoints
│   │   ├── deals.routes.ts
│   │   ├── properties.routes.ts
│   │   ├── traffic.routes.ts
│   │   ├── health.routes.ts
│   │   └── ...
│   ├── graphql/           # GraphQL API (optional)
│   └── websocket/         # WebSocket handlers
│
├── services/
│   ├── deal.service.ts
│   ├── property.service.ts
│   ├── traffic.service.ts
│   ├── leasing-prediction.service.ts
│   ├── llm.service.ts
│   └── email-sync.service.ts
│
├── database/
│   ├── pool.ts            # PostgreSQL connection pool
│   └── queries/           # SQL queries
│
├── middleware/
│   ├── auth.ts            # JWT authentication
│   ├── validation.ts      # Request validation
│   ├── error-handler.ts   # Global error handling
│   └── rate-limit.ts      # Rate limiting
│
├── config/
│   └── environment.ts     # Environment configuration
│
├── models/                # TypeScript interfaces
├── types/                 # Type definitions
├── utils/                 # Utility functions
└── index.ts              # Application entry point
```

### Frontend Structure

```
frontend/src/
├── components/
│   ├── common/            # Reusable components
│   ├── deals/             # Deal-specific components
│   ├── map/               # Map components
│   ├── forms/             # Form components
│   └── ...
│
├── pages/
│   ├── Dashboard.tsx
│   ├── DealPage.tsx
│   ├── CreateDeal.tsx
│   └── ...
│
├── stores/
│   ├── authStore.ts       # Authentication state
│   ├── dealStore.ts       # Deal state
│   └── ...
│
├── services/
│   ├── api.ts             # API client
│   ├── websocket.ts       # WebSocket client
│   └── ...
│
├── hooks/                 # Custom React hooks
├── types/                 # TypeScript types
├── utils/                 # Utility functions
└── App.tsx               # Root component
```

---

## Database Schema

### Core Tables

#### Users
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Deals
```sql
CREATE TABLE deals (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  property_type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active',
  user_id INTEGER REFERENCES users(id),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Properties
```sql
CREATE TABLE properties (
  id SERIAL PRIMARY KEY,
  deal_id INTEGER REFERENCES deals(id),
  apn VARCHAR(100),
  parcel_id VARCHAR(100),
  address TEXT,
  property_data JSONB,
  zoning_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Digital Traffic
```sql
CREATE TABLE digital_traffic_events (
  id SERIAL PRIMARY KEY,
  deal_id INTEGER REFERENCES deals(id),
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  user_id INTEGER REFERENCES users(id),
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE digital_traffic_scores (
  id SERIAL PRIMARY KEY,
  deal_id INTEGER REFERENCES deals(id),
  score INTEGER NOT NULL,
  factors JSONB,
  calculated_at TIMESTAMP DEFAULT NOW()
);
```

#### Leasing Predictions
```sql
CREATE TABLE leasing_predictions (
  id SERIAL PRIMARY KEY,
  deal_id INTEGER REFERENCES deals(id),
  total_units INTEGER,
  units_leased INTEGER,
  prediction_date DATE,
  weekly_demand DECIMAL(10, 2),
  tour_conversion_rate DECIMAL(5, 4),
  close_rate DECIMAL(5, 4),
  seasonality_factor DECIMAL(5, 4),
  predicted_tours INTEGER,
  predicted_leases INTEGER,
  lease_up_weeks INTEGER,
  confidence_level VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Indexes

```sql
-- Performance indexes
CREATE INDEX idx_deals_user_id ON deals(user_id);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_created_at ON deals(created_at);
CREATE INDEX idx_properties_deal_id ON properties(deal_id);
CREATE INDEX idx_traffic_events_deal_id ON digital_traffic_events(deal_id);
CREATE INDEX idx_traffic_events_created_at ON digital_traffic_events(created_at);
CREATE INDEX idx_leasing_predictions_deal_id ON leasing_predictions(deal_id);

-- Geospatial indexes (if using PostGIS)
CREATE INDEX idx_deals_location ON deals USING GIST (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);
```

---

## API Structure

### REST API Endpoints

#### Authentication
```
POST   /api/v1/auth/register          # Register new user
POST   /api/v1/auth/login             # Login with email/password
POST   /api/v1/auth/google            # Google OAuth
POST   /api/v1/auth/refresh           # Refresh JWT token
POST   /api/v1/auth/logout            # Logout
GET    /api/v1/auth/me                # Get current user
```

#### Deals
```
GET    /api/v1/deals                  # List all deals
GET    /api/v1/deals/:id              # Get deal details
POST   /api/v1/deals                  # Create new deal
PUT    /api/v1/deals/:id              # Update deal
DELETE /api/v1/deals/:id              # Delete deal
GET    /api/v1/deals/:id/files        # Get deal files
POST   /api/v1/deals/:id/files        # Upload file
```

#### Properties
```
GET    /api/v1/properties/:dealId     # Get properties for deal
POST   /api/v1/properties/lookup      # Lookup property by address
GET    /api/v1/properties/county/:id  # Get county property records
```

#### Digital Traffic
```
POST   /api/v1/traffic/event          # Track traffic event
GET    /api/v1/traffic/score/:dealId  # Get traffic score
GET    /api/v1/traffic/events/:dealId # Get all events for deal
```

#### Leasing Predictions
```
POST   /api/v1/leasing/predict        # Generate prediction
GET    /api/v1/leasing/prediction/:id # Get prediction
GET    /api/v1/leasing/deal/:dealId   # Get predictions for deal
```

#### Health Checks
```
GET    /health                        # Basic health check
GET    /health/db                     # Database health
GET    /health/ready                  # Readiness check
GET    /health/live                   # Liveness check
```

### WebSocket Events

#### Client → Server
```javascript
// Authentication
{ event: 'authenticate', data: { token: 'jwt-token' } }

// Subscribe to deal updates
{ event: 'subscribe:deal', data: { dealId: 123 } }

// Unsubscribe
{ event: 'unsubscribe:deal', data: { dealId: 123 } }
```

#### Server → Client
```javascript
// Deal updated
{ event: 'deal:updated', data: { dealId: 123, changes: {...} } }

// New traffic event
{ event: 'traffic:new', data: { dealId: 123, event: {...} } }

// Prediction updated
{ event: 'prediction:updated', data: { dealId: 123, prediction: {...} } }
```

---

## Data Flow

### Deal Creation Flow

```
User (Frontend)
    ↓ POST /api/v1/deals
Express Router
    ↓
Auth Middleware (validates JWT)
    ↓
Validation Middleware (Joi schema)
    ↓
Deal Controller
    ↓
Deal Service
    ↓ INSERT INTO deals
PostgreSQL Database
    ↓
Response (deal object)
    ↓
Frontend Updates State
    ↓
WebSocket Broadcast (to subscribed clients)
```

### Leasing Prediction Flow

```
User Inputs (units, leased, date)
    ↓ POST /api/v1/leasing/predict
Leasing Service
    ↓
1. Fetch Historical Data (database)
2. Calculate Seasonality (from 5yr data)
3. Calculate Conversion Rates
4. Apply Machine Learning Model
5. Generate Confidence Score
    ↓ INSERT INTO leasing_predictions
Database
    ↓
Return Prediction
    ↓
Frontend Displays Results
```

### Real-time Traffic Tracking

```
User Views Deal Page
    ↓
Frontend Fires Event
    ↓ POST /api/v1/traffic/event
Traffic Service
    ↓ INSERT INTO digital_traffic_events
Database
    ↓
Calculate Traffic Score
    ↓ UPDATE digital_traffic_scores
Database
    ↓
WebSocket Broadcast
    ↓
All Connected Clients Receive Update
```

---

## Security Architecture

### Authentication Flow

```
1. User Login
   └→ POST /api/v1/auth/login
      └→ Validate credentials
         └→ Generate JWT access token (15min expiry)
         └→ Generate refresh token (30d expiry)
         └→ Return both tokens

2. API Request
   └→ Include JWT in Authorization header
      └→ JWT Middleware validates token
         └→ If valid: attach user to req.user
         └→ If expired: return 401 (client refreshes)

3. Token Refresh
   └→ POST /api/v1/auth/refresh
      └→ Validate refresh token
         └→ Generate new access token
         └→ Return new token
```

### Security Features

1. **Authentication:**
   - JWT-based (access + refresh tokens)
   - Google OAuth 2.0
   - Password hashing (bcrypt)

2. **Authorization:**
   - Role-based access control (RBAC)
   - Resource ownership validation
   - Middleware-based checks

3. **Input Validation:**
   - Joi schemas for all inputs
   - SQL injection prevention (parameterized queries)
   - XSS protection (sanitization)

4. **Rate Limiting:**
   - Per-IP rate limiting
   - Per-user rate limiting
   - Configurable thresholds

5. **CORS:**
   - Restricted to frontend domain
   - Credentials allowed
   - Preflight caching

6. **Headers:**
   - Helmet.js (security headers)
   - CSP (Content Security Policy)
   - HSTS (HTTP Strict Transport Security)

---

## Scalability Considerations

### Current Architecture (MVP)

- **Single instance backend**
- **Managed PostgreSQL** (vertically scalable)
- **Managed Redis** (caching)
- **Stateless API** (horizontally scalable)

### Scaling Strategy

#### Horizontal Scaling (Multiple Instances)

```
                Load Balancer
                      ↓
        ┌─────────────┼─────────────┐
        ↓             ↓             ↓
   Backend 1     Backend 2     Backend 3
        ↓             ↓             ↓
        └─────────────┼─────────────┘
                      ↓
              PostgreSQL (Primary)
                      ↓
              Redis (Shared Cache)
```

**Requirements:**
- Load balancer (Railway, Nginx, AWS ALB)
- Sticky sessions for WebSocket
- Shared Redis for session storage

#### Database Scaling

**Vertical Scaling (Short-term):**
- Increase CPU/RAM on database instance
- Railway: Scale up plan
- AWS RDS: Modify instance class

**Read Replicas (Medium-term):**
```
Backend → PostgreSQL Primary (writes)
Backend → PostgreSQL Replica 1 (reads)
Backend → PostgreSQL Replica 2 (reads)
```

**Sharding (Long-term):**
- Shard by geography (state/region)
- Shard by user cohort
- Requires application-level routing

#### Caching Strategy

**Current:**
- Redis for session storage
- In-memory caching for static data

**Future:**
- CDN for static assets
- Application-level caching (Redis)
- Database query caching
- API response caching

#### File Storage Scaling

**Current:** Local filesystem / Railway volumes

**Recommended:** 
- AWS S3 (unlimited, scalable)
- Cloudflare R2 (zero egress fees)
- DigitalOcean Spaces

---

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| API Response Time | < 200ms | ✅ |
| Database Query Time | < 50ms | ✅ |
| Frontend Load Time | < 2s | ✅ |
| WebSocket Latency | < 100ms | ✅ |
| Concurrent Users | 1,000+ | ✅ |
| Uptime | 99.9% | 🎯 |

---

## Technology Decisions

### Why PostgreSQL?
- ✅ ACID compliance (data integrity)
- ✅ JSONB support (flexible schemas)
- ✅ Geospatial support (PostGIS)
- ✅ Mature, battle-tested
- ✅ Great performance

### Why Redis?
- ✅ Fast in-memory caching
- ✅ Session storage
- ✅ Pub/sub for WebSockets
- ✅ Easy to scale

### Why Socket.IO?
- ✅ Real-time updates
- ✅ Automatic fallback (polling)
- ✅ Room-based broadcasting
- ✅ Reconnection handling

### Why Mapbox?
- ✅ High-quality maps
- ✅ Custom styling
- ✅ Vector tiles (fast)
- ✅ Drawing tools
- ✅ Great developer experience

---

## Future Enhancements

1. **Microservices:**
   - LLM service (separate container)
   - File processing service
   - Email sync service

2. **Message Queue:**
   - Bull Queue (Redis-backed)
   - Background job processing
   - Scheduled tasks

3. **Search:**
   - Elasticsearch for full-text search
   - Property search
   - Document search

4. **Analytics:**
   - Google Analytics
   - Mixpanel
   - Custom analytics dashboard

5. **CI/CD:**
   - GitHub Actions
   - Automated testing
   - Automated deployments

---

## Diagrams

### System Context Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      JEDI RE SYSTEM                     │
│                                                          │
│  ┌──────────┐      ┌───────────┐      ┌─────────────┐ │
│  │ Frontend │◄────►│  Backend  │◄────►│  Database   │ │
│  │  (React) │      │ (Node.js) │      │(PostgreSQL) │ │
│  └──────────┘      └───────────┘      └─────────────┘ │
│       ▲                  ▲                              │
│       │                  │                              │
└───────┼──────────────────┼──────────────────────────────┘
        │                  │
        ▼                  ▼
   ┌─────────┐      ┌──────────────┐
   │  Users  │      │   External   │
   │         │      │   Services   │
   └─────────┘      └──────────────┘
```

This architecture document serves as the technical blueprint for JEDI RE. For deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).
