# JEDI RE - API Inventory

**Last Updated:** 2026-02-27  
**Total APIs:** 119+ endpoints

---

## 📊 Market Intelligence APIs

### Market Deep Dive
**Base Path:** `/api/v1/markets`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/markets/:marketId/summary` | GET | Get market summary with all key metrics | ✅ Active |
| `/markets/:marketId` | GET | Market detail view | ✅ Active |
| `/markets` | GET | List all tracked markets | ✅ Active |

**Features:**
- 5 tabs: Overview, Market Data, Submarkets, Trends, Deals
- Real-time coverage percentages
- Output counts per category
- JEDI Score integration

**Frontend Component:** `MarketDeepDive.tsx`

---

## 🏢 Deal Management APIs

### Deals
**Base Path:** `/api/v1/deals`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/deals` | GET | List all deals | ✅ Active |
| `/deals` | POST | Create new deal | ✅ Active |
| `/deals/:id` | GET | Get deal details | ✅ Active |
| `/deals/:id` | PUT | Update deal | ✅ Active |
| `/deals/:id` | DELETE | Delete deal | ✅ Active |

**Related Files:**
- `inline-deals.routes.ts`
- `dealState.routes.ts`

---

## 🎯 JEDI Score APIs

### JEDI Score & Alerts
**Base Path:** `/api/v1/jedi`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/jedi/score/:dealId` | GET | Get current JEDI Score with breakdown | ✅ Active |
| `/jedi/score/:dealId/recalculate` | POST | Manually trigger score recalculation | ✅ Active |
| `/jedi/history/:dealId` | GET | Get JEDI Score history | ✅ Active |
| `/jedi/impact/:dealId` | GET | Get events impacting JEDI Score | ✅ Active |
| `/jedi/alerts` | GET | Get user's active alerts | ✅ Active |
| `/jedi/alerts/deal/:dealId` | GET | Get alerts for specific deal | ✅ Active |
| `/jedi/alerts/:id/read` | POST | Mark alert as read | ✅ Active |
| `/jedi/alerts/:id/dismiss` | POST | Dismiss alert | ✅ Active |
| `/jedi/alerts/settings` | GET | Get user's alert configuration | ✅ Active |
| `/jedi/alerts/settings` | PATCH | Update alert configuration | ✅ Active |
| `/jedi/recalculate-all` | POST | Recalculate all scores (admin) | ✅ Active |

**File:** `jedi.routes.ts`

---

## 🏗️ Zoning & Entitlement APIs

### Zoning Analysis
**Base Path:** `/api/v1/zoning`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/zoning/lookup` | GET | Zoning lookup by address | ✅ Active |
| `/zoning/capacity/:dealId` | GET | Get development capacity analysis | ✅ Active |
| `/zoning/profile/:dealId` | GET | Get zoning profile | ✅ Active |
| `/zoning/comparator` | GET | Compare zoning across sites | ✅ Active |
| `/zoning/verification` | POST | Verify zoning data | ✅ Active |
| `/zoning/intelligence` | GET | AI-powered zoning insights | ✅ Active |

**Related Files:**
- `zoning.routes.ts`
- `zoning-capacity.routes.ts`
- `zoning-profile.routes.ts`
- `zoning-comparator.routes.ts`
- `zoning-verification.routes.ts`
- `zoning-intelligence.routes.ts`
- `zoning-learning.routes.ts`

### Entitlements
**Base Path:** `/api/v1/entitlements`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/entitlements` | GET | List entitlements | ✅ Active |
| `/entitlements/kanban` | GET | Kanban view of entitlements | ✅ Active |
| `/entitlements/deal/:dealId` | GET | Get entitlements by deal | ✅ Active |

**File:** `entitlement.routes.ts`

---

## 🗺️ Geographic & Mapping APIs

### Property Boundaries
**Base Path:** `/api/v1/property-boundary`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/property-boundary/:dealId` | GET | Get property boundary data | ✅ Active |

**File:** `property-boundary.routes.ts`

### Maps
**Base Path:** `/api/v1/maps`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/maps/configs` | GET | Get map configurations | ✅ Active |
| `/maps/annotations` | GET/POST | Manage map annotations | ✅ Active |
| `/maps/layers` | GET | Get map layers | ✅ Active |

**Related Files:**
- `maps.routes.ts`
- `map-configs.routes.ts`
- `mapAnnotations.routes.ts`
- `layers.routes.ts`

### Trade Areas
**Base Path:** `/api/v1/trade-areas`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/trade-areas` | GET/POST | Manage trade areas | ✅ Active |

**File:** `trade-areas.routes.ts`

### Isochrones
**Base Path:** `/api/v1/isochrone`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/isochrone` | GET | Generate travel time polygons | ✅ Active |

**File:** `isochrone.routes.ts`

---

## 📈 Financial & Pro Forma APIs

### Financial Models
**Base Path:** `/api/v1/financial`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/financial/models` | GET/POST | Manage financial models | ✅ Active |
| `/financial/assumptions` | GET/POST | Manage financial assumptions | ✅ Active |

**Related Files:**
- `financial-models.routes.ts`
- `financial-assumptions.routes.ts`

### Pro Forma
**Base Path:** `/api/v1/proforma`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/proforma` | GET/POST | Manage pro forma models | ✅ Active |
| `/proforma/generator` | POST | Generate pro forma | ✅ Active |

**Related Files:**
- `proforma.routes.ts`
- `proforma-generator.routes.ts`

### Capital Structure
**Base Path:** `/api/v1/capital-structure`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/capital-structure` | GET/POST | Manage capital structure | ✅ Active |

**File:** `capital-structure.routes.ts`

---

## 📊 Market Research & Intelligence APIs

### Apartment Market Data
**Base Path:** `/api/v1/apartment-market`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/apartment-market/sync/pull` | POST | Pull apartment market data | ✅ Active |
| `/apartment-market/sync/status` | GET | Get sync status | ✅ Active |
| `/apartment-market/properties` | GET | Get apartment properties | ✅ Active |
| `/apartment-market/market-snapshots` | GET | Get market snapshots | ✅ Active |
| `/apartment-market/rent-comps` | GET | Get rent comparables | ✅ Active |
| `/apartment-market/supply-pipeline` | GET | Get supply pipeline | ✅ Active |
| `/apartment-market/trends` | GET | Get market trends | ✅ Active |
| `/apartment-market/submarkets` | GET | Get submarket data | ✅ Active |

**Related Files:**
- `apartmentMarket.routes.ts`
- `inline-apartment-sync.routes.ts`

### Competition Analysis
**Base Path:** `/api/v1/competition`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/competition` | GET | Get competition analysis | ✅ Active |

**File:** `competition.routes.ts`

### Demand Analysis
**Base Path:** `/api/v1/demand`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/demand` | GET | Get demand metrics | ✅ Active |

**File:** `demand.routes.ts`

### Supply Analysis
**Base Path:** `/api/v1/supply`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/supply` | GET | Get supply metrics | ✅ Active |

**File:** `supply.routes.ts`

---

## 🚦 Traffic & Leasing APIs

### Leasing Traffic
**Base Path:** `/api/v1/leasing-traffic`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/leasing-traffic` | GET/POST | Manage leasing traffic data | ✅ Active |
| `/leasing-traffic/predictions` | GET | Get traffic predictions | ✅ Active |

**Related Files:**
- `leasing-traffic.routes.ts`
- `leasingTraffic.routes.ts`
- `traffic-ai.routes.ts`
- `trafficPrediction.routes.ts`

---

## 📰 News & Research APIs

### News
**Base Path:** `/api/v1/news`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/news` | GET | Get news articles | ✅ Active |
| `/news/asset/:assetId` | GET | Get asset-specific news | ✅ Active |

**Related Files:**
- `news.routes.ts`
- `inline-news.routes.ts`
- `assetNews.routes.ts`

---

## 📝 Document Management APIs

### Files & Documents
**Base Path:** `/api/v1/files`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/files` | GET/POST | Manage files | ✅ Active |
| `/files/:id` | GET/DELETE | Get/delete specific file | ✅ Active |

**Related Files:**
- `files.routes.ts`
- `documentsFiles.routes.ts`

### Upload
**Base Path:** `/api/v1/upload`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/upload` | POST | Upload files | ✅ Active |
| `/upload/templates` | GET | Get upload templates | ✅ Active |

**Related Files:**
- `upload.routes.ts`
- `upload-templates.routes.ts`
- `data-upload.routes.ts`

---

## 👥 Team & Collaboration APIs

### Team Management
**Base Path:** `/api/v1/team`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/team` | GET/POST | Manage team members | ✅ Active |

**File:** `team-management.routes.ts`

### Tasks
**Base Path:** `/api/v1/tasks`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/tasks` | GET/POST | Manage tasks | ✅ Active |
| `/tasks/:id/complete` | POST | Complete task | ✅ Active |

**Related Files:**
- `tasks.routes.ts`
- `inline-tasks.routes.ts`
- `task-completion.routes.ts`

### Notifications
**Base Path:** `/api/v1/notifications`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/notifications` | GET | Get notifications | ✅ Active |

**File:** `notifications.routes.ts`

---

## 📧 Email & Communication APIs

### Email
**Base Path:** `/api/v1/email`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/email` | GET/POST | Manage emails | ✅ Active |
| `/email/extractions` | GET | Get email extractions | ✅ Active |

**Related Files:**
- `email.routes.ts`
- `email-extractions.routes.ts`
- `extractions.routes.ts`

### Gmail Integration
**Base Path:** `/api/v1/gmail`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/gmail` | GET/POST | Gmail integration | ✅ Active |

**File:** `gmail.routes.ts`

### Microsoft Integration
**Base Path:** `/api/v1/microsoft`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/microsoft` | GET/POST | Microsoft integration | ✅ Active |

**Related Files:**
- `microsoft.routes.ts`
- `inline-microsoft.routes.ts`

### Inbox
**Base Path:** `/api/v1/inbox`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/inbox` | GET | Get inbox items | ✅ Active |

**Related Files:**
- `inbox.routes.ts`
- `inline-inbox.routes.ts`

---

## 🔐 Authentication & User APIs

### Auth
**Base Path:** `/api/v1/auth`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/auth/login` | POST | User login | ✅ Active |
| `/auth/register` | POST | User registration | ✅ Active |
| `/auth/logout` | POST | User logout | ✅ Active |
| `/auth/refresh` | POST | Refresh token | ✅ Active |

**Related Files:**
- `auth.routes.ts`
- `inline-auth.routes.ts`

### User Preferences
**Base Path:** `/api/v1/preferences`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/preferences` | GET/PATCH | Manage user preferences | ✅ Active |

**Related Files:**
- `preferences.routes.ts`
- `userPreferences.routes.ts`

---

## 🤖 AI & Agent APIs

### Agent
**Base Path:** `/api/v1/agent`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/agent` | POST | AI agent interactions | ✅ Active |

**File:** `agent.routes.ts`

### LLM
**Base Path:** `/api/v1/llm`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/llm` | POST | LLM completions | ✅ Active |

**File:** `llm.routes.ts`

### Qwen
**Base Path:** `/api/v1/qwen`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/qwen` | POST | Qwen AI model | ✅ Active |

**File:** `qwen.routes.ts`

---

## 🗄️ Data Management APIs

### Data Library
**Base Path:** `/api/v1/data-library`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/data-library` | GET/POST | Manage data library | ✅ Active |

**File:** `data-library.routes.ts`

### Data Tracker
**Base Path:** `/api/v1/data-tracker`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/data-tracker` | GET | Track data changes | ✅ Active |

**File:** `data-tracker.routes.ts`

### Inline Data
**Base Path:** `/api/v1/inline-data`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/inline-data` | GET/POST | Inline data operations | ✅ Active |

**File:** `inline-data.routes.ts`

---

## 🏘️ Property-Specific APIs

### Property
**Base Path:** `/api/v1/property`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/property/:id` | GET | Get property details | ✅ Active |
| `/property/:id/metrics` | GET | Get property metrics | ✅ Active |
| `/property/:id/scoring` | GET | Get property score | ✅ Active |

**Related Files:**
- `property.routes.ts`
- `property-metrics.routes.ts`
- `property-scoring.routes.ts`
- `property-proxy.routes.ts`

### Neighboring Properties
**Base Path:** `/api/v1/neighboring-properties`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/neighboring-properties` | GET | Get neighboring properties | ✅ Active |

**File:** `neighboringProperties.routes.ts`

---

## 📋 Module & Strategy APIs

### Modules
**Base Path:** `/api/v1/modules`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/modules` | GET | List all modules | ✅ Active |
| `/modules/:id` | GET | Get module details | ✅ Active |

**Related Files:**
- `modules.routes.ts`
- `module-wiring.routes.ts`
- `module-libraries.routes.ts`

### Strategies
**Base Path:** `/api/v1/strategies`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/strategies` | GET/POST | Manage investment strategies | ✅ Active |
| `/strategies/analyses` | GET | Get strategy analyses | ✅ Active |

**Related Files:**
- `custom-strategies.routes.ts`
- `strategy-analyses.routes.ts`

---

## 🏗️ Development & Scenarios APIs

### Development Scenarios
**Base Path:** `/api/v1/scenarios`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/scenarios` | GET/POST | Manage development scenarios | ✅ Active |

**Related Files:**
- `scenarios.routes.ts`
- `development-scenarios.routes.ts`

### Building Envelope
**Base Path:** `/api/v1/building-envelope`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/building-envelope` | GET | Get building envelope analysis | ✅ Active |

**File:** `building-envelope.routes.ts`

---

## 📊 Analytics & Reporting APIs

### Dashboard
**Base Path:** `/api/v1/dashboard`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/dashboard` | GET | Get dashboard data | ✅ Active |

**File:** `dashboard.routes.ts`

### Analysis
**Base Path:** `/api/v1/analysis`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/analysis` | POST | Run analysis | ✅ Active |

**File:** `analysis.routes.ts`

### Grid
**Base Path:** `/api/v1/grid`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/grid` | GET | Get grid data | ✅ Active |

**File:** `grid.routes.ts`

---

## ⚙️ System & Admin APIs

### Health
**Base Path:** `/api/v1/health`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/health` | GET | System health check | ✅ Active |

**Related Files:**
- `health.routes.ts`
- `inline-health.routes.ts`

### Audit
**Base Path:** `/api/v1/audit`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/audit` | GET | Get audit logs | ✅ Active |

**File:** `audit.routes.ts`

### Errors
**Base Path:** `/api/v1/errors`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/errors` | GET | Get error logs | ✅ Active |

**File:** `errors.routes.ts`

---

## 🔗 External Integration APIs

### Benchmarks
**Base Path:** `/api/v1/benchmark`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/benchmark/timeline` | GET | Get benchmark timeline data | ✅ Active |

**File:** `benchmark-timeline.routes.ts`

### Municode
**Base Path:** `/api/v1/municode`

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/municode` | GET | Get municode data | ✅ Active |

**File:** `municode.routes.ts`

---

## 📝 Notes

- All endpoints require authentication unless marked otherwise
- Bearer token format: `Authorization: Bearer <token>`
- Most endpoints support pagination via `?limit=X&offset=Y`
- Date formats follow ISO 8601 standard

---

## 🚀 Adding New APIs

When adding a new API:

1. Create route file in `backend/src/api/rest/`
2. Add to this inventory with:
   - Base path
   - All endpoints with methods
   - Description
   - Status (✅ Active, 🚧 In Progress, 📋 Planned)
3. Document any authentication requirements
4. Update frontend types if needed

---

## 📚 Related Documentation

- [API Development Guide](./docs/API_DEVELOPMENT.md)
- [Authentication](./docs/AUTHENTICATION.md)
- [Database Schema](./docs/DATABASE.md)
