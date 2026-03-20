# CLAUDE.md — JEDI RE Architectural Context

> Drop this at repo root. Every Claude Code session starts here.

## What is JEDI RE?

Real estate deal intelligence platform — "The Operating System for Real Estate." Four-strategy simultaneous analysis (BTS / Flip / Rental / STR) with AI-powered scoring. Target markets: Florida (Tampa, Orlando, Miami, Jacksonville), Atlanta, Dallas.

**Core thesis:** Identify supply-demand imbalances and multi-strategy arbitrage opportunities through AI-powered analysis, surfacing insights that single-strategy analysis misses.

**Two-surface architecture:**
- Surface 1: Conversational chat (WhatsApp via Twilio + Telegram bot) — revenue launch surface
- Surface 2: Bloomberg Terminal-style web app — power users, deal-dense analytical environment

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, TypeScript, Mapbox GL JS, Zustand, Socket.io |
| Backend | Node.js, Express, TypeScript, Drizzle ORM |
| Database | PostgreSQL |
| Messaging | Kafka (agent communication), Redis |
| AI | Claude (via `@anthropic-ai/sdk`, wrapped by `@stripe/token-meter`) |
| Billing | Stripe Token Billing — credit-based, 40% margin |
| Design | Bloomberg Terminal dark theme. Teal-to-cyan gradient (`#00E5A0` → `#00B4D8`). JetBrains Mono + IBM Plex Sans. |

---

## Directory Structure

```
jedire/
├── backend/
│   └── src/
│       ├── api/rest/          # 80+ route files, mounted in index.ts
│       │   └── index.ts       # ALL route registration — check here first
│       ├── services/          # Business logic (100+ service files)
│       │   ├── module-wiring/ # 7,400 lines — formula engine, strategy arbitrage, event bus
│       │   ├── kafka/         # Consumers: alert, demand, jedi-score, proforma
│       │   └── ...
│       ├── database/
│       │   ├── schema.sql     # Master schema (currently empty — schema lives in migrations)
│       │   └── migrations/    # 20+ SQL migration files (020-099)
│       └── db/
│           ├── schema/
│           │   ├── dataPipeline.ts  # Drizzle ORM models (msas, submarkets, properties, etc.)
│           │   └── index.ts
│           └── migrations/    # Additional migrations (043-045)
├── frontend/
│   └── src/
│       ├── pages/             # 100+ page components
│       ├── components/
│       │   └── deal/
│       │       └── sections/  # 60+ deal section components
│       ├── stores/            # Zustand stores (12 stores)
│       ├── services/          # Frontend API services (25+ files)
│       │   └── api.client.ts  # Typed API client — check here for available methods
│       ├── data/              # ⚠️ 25 mock data files — THE WIRING BLOCKER
│       └── types/
│           └── deal.ts        # Core Deal interface
└── migrations/                # Root-level migrations (all empty — use jedire/backend/ ones)
```

---

## API Architecture

**Base path:** `/api/v1`
**Auth:** Bearer token via `localStorage.auth_token`
**API Client:** `frontend/src/services/api.client.ts` — typed methods under `api.deals.*`, `api.properties.*`, `api.analysis.*`

### Key Mounted Endpoints (from `backend/src/api/rest/index.ts`)

| Route Prefix | File | Key Endpoints | Status |
|-------------|------|---------------|--------|
| `/jedi` | `jedi.routes.ts` | `GET /score/:dealId`, `POST /score/:dealId/recalculate`, `GET /history/:dealId`, `GET /alerts`, `GET /alerts/deal/:dealId` | Has 748-line service |
| `/proforma` | `proforma.routes.ts` | `GET /:dealId`, `POST /:dealId/initialize`, `POST /:dealId/recalculate`, `PATCH /:dealId/override`, `GET /:dealId/comparison` | Has 1,620 lines across 3 services |
| `/demand` | `demand.routes.ts` | `GET /trade-area/:id`, `GET /submarket/:id`, `POST /calculate`, `GET /impact/:dealId` | Wired |
| `/supply` | `supply.routes.ts` | `GET /trade-area/:id`, `GET /trade-area/:id/risk`, `GET /competitive/:dealId`, `GET /timeline/:tradeAreaId` | Wired |
| `/risk` | `risk.routes.ts` | Risk scoring endpoints | Has service |
| `/rankings` | `rankings.routes.ts` | `GET /:marketId`, `GET /performance/:marketId`, `GET /pipeline/:marketId` | Has service |
| `/traffic-data` | `traffic-data.routes.ts` | `POST /adt/upload`, `GET /adt/stations`, `GET /adt/nearest`, `GET /context/:propertyId` | Wired |
| `/traffic-comps` | `traffic-comps.routes.ts` | Comp traffic analysis per deal | Wired |
| `/correlations` | `correlation.routes.ts` | `GET /report`, `GET /property/:propertyId`, `GET /summary` | Has service |
| `/zoning` | `zoning.routes.ts` | `GET /lookup`, `GET /capacity/:dealId`, `GET /profile/:dealId` | Multiple services |
| `/scenarios` | `scenarios.routes.ts` | Evidence-based scenario generation | Has service |
| `/kafka-events` | `kafka-events.routes.ts` | Kafka event bus monitoring | Has service |
| `/news` | `news.routes.ts` | News intelligence | Has service |
| `/deals` | Multiple files | CRUD + competition + market intel + building 3D + geographic context | Core |

### Endpoints NOT in api.client.ts (need to be added)

The frontend `api.client.ts` only has typed methods for `auth`, `deals`, `properties`, `analysis`. These backend routes exist but have **no frontend typed client**:

- `/api/v1/jedi/score/:dealId` — JEDI Score (service: 748 lines)
- `/api/v1/proforma/:dealId` — ProForma engine (service: 1,620 lines)
- `/api/v1/demand/*` — Demand signals
- `/api/v1/supply/*` — Supply pipeline
- `/api/v1/risk/*` — Risk scoring
- `/api/v1/rankings/*` — Performance rankings
- `/api/v1/traffic-data/*` — Traffic engine
- `/api/v1/correlations/*` — Market correlations
- `/api/v1/opportunity-engine/*` — Opportunity detection
- `/api/v1/strategy-analyses` — Strategy analyses

**Action item:** Add typed methods to `api.client.ts` for each of these before wiring frontend components.

---

## The Wiring Problem: Mock Data → Live APIs

### The Dam

25 mock data files in `frontend/src/data/` intercept data flow. Backend services exist and are mounted, but deal sections import from `*MockData.ts` instead of hitting live endpoints.

### Mock File → Importing Component → Replacement API

| Mock File | Imported By | Replace With |
|-----------|------------|--------------|
| `capitalStructureMockData.ts` | `CapitalStructureSection.tsx`, `DebtTab.tsx` | `/api/v1/proforma/:dealId` + capital structure fields |
| `enhancedOverviewMockData.ts` | `OverviewSection.tsx` | `/api/v1/jedi/score/:dealId` + `/api/v1/deals/:id` |
| `enhancedProFormaMockData.ts` | `ProFormaIntelligence.tsx` | `/api/v1/proforma/:dealId` |
| `enhancedStrategyMockData.ts` | `StrategySection.tsx` | `/api/v1/strategy-analyses` + module-wiring engine |
| `strategyMockData.ts` | `StrategySection.tsx` | `/api/v1/strategy-analyses` |
| `filesMockData.ts` | `FilesSection.tsx` | `/api/v1/deals/:id/files` (documentsFiles.routes.ts) |
| `debtMockData.ts` | `DebtSection.demo.tsx`, `DebtSection.legacy.tsx` | `/api/v1/proforma/:dealId` |
| `mockSubmarketData.ts` | `MarketDataPageV2.tsx` | `/api/v1/market/:marketId/summary` |
| `supplyMockData.ts` | `SUPPLY_SECTION_EXAMPLE.tsx` | `/api/v1/supply/trade-area/:id` |
| `timelineMockData.ts` | `TIMELINE_INTEGRATION_TEST.tsx` | `/api/v1/deal-timelines/:dealId` |
| Other 15 files | Not actively imported | Can be deleted or left dormant |

### Wiring Sequence (Priority Order)

1. **Add typed methods to `api.client.ts`** for jedi, proforma, demand, supply, risk, rankings, traffic
2. **Wire `OverviewSection.tsx`** → `/api/v1/jedi/score/:dealId` (replaces `enhancedOverviewMockData`)
3. **Wire `StrategySection.tsx`** → strategy-arbitrage-engine output (replaces `enhancedStrategyMockData` + `strategyMockData`)
4. **Wire `ProFormaIntelligence.tsx`** → `/api/v1/proforma/:dealId` (replaces `enhancedProFormaMockData`)
5. **Wire `CapitalStructureSection.tsx` + `DebtTab.tsx`** → proforma + capital structure (replaces `capitalStructureMockData`)
6. **Wire `MarketDataPageV2.tsx`** → `/api/v1/market/:marketId/summary` (replaces `mockSubmarketData`)

---

## Key Backend Services

### Module Wiring Infrastructure (`backend/src/services/module-wiring/`)

| File | Lines | Purpose |
|------|-------|---------|
| `formula-engine.ts` | 1,681 | F01-F64+ formula implementations |
| `p0-service-adapters.ts` | 561 | Priority 0 adapters (JEDI Score, Zoning→Strategy) |
| `p1-service-adapters.ts` | 777 | Priority 1 adapters (Market→ProForma chain) |
| `p2-service-adapters.ts` | 1,079 | Priority 2 adapters (News→Score, Traffic→Strategy) |
| `strategy-arbitrage-engine.ts` | 467 | 4-strategy scoring (BTS/Flip/Rental/STR) |
| `capital-structure-adapter.ts` | 476 | M09↔M11 circular dependency resolution |
| `module-event-bus.ts` | 217 | Cross-module event pub/sub |
| `data-flow-router.ts` | 557 | Routes data between modules |
| `module-wiring-orchestrator.ts` | 644 | Coordinates full pipeline execution |
| `module-registry.ts` | 791 | Module registration and dependency graph |

### Critical Services

| Service | Lines | Backend Route | Frontend Consumer |
|---------|-------|--------------|-------------------|
| `jedi-score.service.ts` | 748 | `/api/v1/jedi/*` | OverviewSection (currently mock) |
| `proforma-adjustment.service.ts` | 1,110 | `/api/v1/proforma/*` | ProFormaIntelligence (currently mock) |
| `proforma-generator.service.ts` | 367 | `/api/v1/proforma/*` | ProFormaTab (currently mock) |
| `capital-structure.service.ts` | 742 | Needs route | CapitalStructureSection (currently mock) |
| `risk-scoring.service.ts` | — | `/api/v1/risk/*` | RiskIntelligence (not wired) |
| `opportunity-engine.service.ts` | — | `/api/v1/opportunity-engine/*` | OpportunityEngineSection (not wired) |
| `supply-signal.service.ts` | — | `/api/v1/supply/*` | SupplyIntelligence (not wired) |
| `demand-signal.service.ts` | — | `/api/v1/demand/*` | MarketSection (not wired) |

---

## Zustand Stores (`frontend/src/stores/`)

| Store | File | Status |
|-------|------|--------|
| `dealStore.ts` | 185 lines | ✅ Wired to `api.deals.*` — fetches real deal data |
| `authStore.ts` | — | ✅ Working auth flow |
| `mapStore.ts` | — | ✅ Working with Mapbox |
| `mapDrawingStore.ts` | — | ✅ MapboxDraw integration |
| `tradeAreaStore.ts` | — | Exists, needs wiring |
| `zoningModuleStore.ts` | — | Exists, needs wiring |
| `propertyStore.ts` | — | Exists, needs wiring |
| `chatStore.ts` | — | Exists for AI chat |
| `agentStore.ts` | — | Exists for agent status |
| `design3d.store.ts` | — | 3D massing editor |
| `dealData.store.ts` | — | Supplementary deal data |
| `settings.store.ts` | — | User preferences |
| `DesignDashboardStore.ts` | — | Design dashboard state |

**Pattern:** All stores use Zustand `create<T>()`. dealStore is the reference implementation for the fetch→transform→set pattern.

---

## Frontend Routing (`frontend/src/App.tsx`)

### Primary Routes

| Route | Component | Context |
|-------|-----------|---------|
| `/dashboard` | `Dashboard` → redirects internally | Portfolio home |
| `/deals` | `DealsPage` | Pipeline grid |
| `/deals/create` | `CreateDealPage` | Deal creation |
| `/deals/:dealId/detail` | `DealDetailPage` (657 lines) | Canonical deal view |
| `/deals/:dealId/enhanced` | `DealPageEnhanced` (415 lines) | Enhanced deal view |
| `/deals/:dealId/design` | `Design3DPage` | 3D massing editor |
| `/deals/:id` | `DealView` | Deal view (catch-all) |
| `/market-intelligence` | `MarketIntelligencePage` | Market hub |
| `/competitive-intelligence/*` | CI sub-pages | Rankings, acquisition, comps, alerts |
| `/news-intel` | `NewsIntelligencePage` | News intelligence |
| `/assets-owned` | `AssetsOwnedPage` | Portfolio/owned assets |
| `/map` | `MapPage` | Full map view |

### Deal Page Variants (needs consolidation)

There are 5 deal page variants — this is tech debt:
- `DealDetailPage.tsx` (657 lines) — tabbed layout, most complete
- `DealPageEnhanced.tsx` (415 lines) — collapsible sections
- `CapsuleDetailPage.tsx` (804 lines) — Deal Capsule concept
- `DealPage.tsx` — Legacy
- `DealView.tsx` — Catch-all

**Recommendation:** `DealDetailPage` or `CapsuleDetailPage` should be the canonical surface. Others should redirect.

---

## Critical Data Chains (none fully wired in code)

### P0-1: JEDI Score Engine
```
Research Agent → M05 Market + M04 Supply + M14 Risk → M25 JEDI Score → Dashboard + Deal Overview
```
- Signal weights: Demand 30%, Supply 25%, Momentum 20%, Position 15%, Risk 10%
- Service: `jedi-score.service.ts` (748 lines)
- Formulas: F01-F06 in `formula-engine.ts`
- Kafka consumer: `jedi-score-consumer.ts`

### P0-3: Zoning → Dev Capacity → Strategy (Keystone Cascade)
```
M02 Zoning → M03 Dev Capacity → selectDevelopmentPath() → M08 Strategy Arbitrage
```
- `DevelopmentPath` is a first-class keystone concept — its selection rewrites all downstream
- Binding constraint: minimum across ALL zoning constraints (density, FAR, height, lot coverage)
- Setback deductions applied BEFORE buildable area computation

### P0-5: Strategy Arbitrage Engine
```
M02 + M04 + M05 + M06 + M07 → M08 Strategy Arbitrage → M09 ProForma
```
- Service: `strategy-arbitrage-engine.ts` (467 lines)
- Formulas: F23 (strategy scores), F24 (arbitrage detection)
- 4-strategy simultaneous scoring: BTS / Flip / Rental / STR

### P0-7: ProForma ↔ Capital Structure
```
M09 ProForma ↔ M11 Capital Structure → M25 JEDI Score
```
- Circular dependency resolved with event resolution order
- Service: `capital-structure-adapter.ts` (476 lines)
- **Current bug:** ProForma hardcodes `irr=15` because it has zero debt service input

---

## Kafka Event Bus

**Consumers** (`backend/src/services/kafka/consumers/`):
- `alert-consumer.ts` — processes alert events
- `demand-consumer.ts` — processes demand signal events
- `jedi-score-consumer.ts` — processes score update events
- `proforma-consumer.ts` — processes proforma recalculation events

**Event schemas** (`kafka/event-schemas.ts`): `NewsEventMessage`, `BaseEvent` with typed `eventType` enums.

**Producer:** `kafka-producer.service.ts`

---

## Design System (Bloomberg Terminal)

```
Colors:
  bg.terminal: #0A0E17    bg.panel: #0F1319    bg.header: #1A1F2E
  text.amber: #F5A623     text.green: #00D26A   text.red: #FF4757
  text.cyan: #00BCD4      text.purple: #A78BFA   text.secondary: #8B95A5
  border.subtle: #1E2538   border.medium: #2A3348

Fonts:
  mono: JetBrains Mono     display: IBM Plex Mono    label: IBM Plex Sans

Navigation:
  Portfolio Context: F1-F9 (Dashboard, Pipeline, Portfolio, Markets, Compete, News, Opps, Reports, Settings)
  Deal Context: F1-F12 (Overview/M01, Property/M02, Market/M05, Supply/M04, Strategy/M08,
                         ProForma/M09, Capital/M11, Risk/M14, Comps/M15, Traffic/M07, Docs/M18, Exit/M20)
  Command Palette: ⌘K or /
```

---

## Known Blockers

1. **20 empty migration files** at repo root `/migrations/` — these are stubs, real migrations are in `jedire/backend/src/database/migrations/`
2. **25 mock data files** in `frontend/src/data/` — see Mock File table above
3. **5 deal page variants** — need consolidation to one canonical surface
4. **`api.client.ts` missing typed methods** for jedi, proforma, demand, supply, risk, rankings, traffic, correlations
5. **M07 Traffic Engine** has route files mounted but migration files at root are empty stubs

---

## Module Numbering Reference

| Code | Module | Primary Service |
|------|--------|----------------|
| M01 | Deal Overview | `jedi-score.service.ts` |
| M02 | Property & Zoning | `zoning.service.ts` + 12 zoning-* services |
| M03 | Dev Capacity | `development-capacity.service.ts` + `building-envelope.service.ts` |
| M04 | Supply Pipeline | `supply-signal.service.ts` |
| M05 | Market Intelligence | `marketResearchEngine.ts` + `apartmentMarketService.ts` |
| M06 | Demand Intelligence | `demand-signal.service.ts` |
| M07 | Traffic Engine | `trafficPredictionEngine.ts` + 6 traffic-* services |
| M08 | Strategy Arbitrage | `strategy-arbitrage-engine.ts` |
| M09 | ProForma | `proforma-generator.service.ts` + `proforma-adjustment.service.ts` |
| M11 | Capital Structure | `capital-structure.service.ts` |
| M14 | Risk Assessment | `risk-scoring.service.ts` + `regulatory-risk-scoring.service.ts` |
| M15 | Comps | `comp-query.service.ts` + `comp-set-discovery.service.ts` |
| M18 | Documents | `documentsFiles.service.ts` |
| M20 | Exit Strategy | Needs service |
| M22 | Post-Close | Needs `deal_monthly_actuals` table |
| M25 | JEDI Score | `jedi-score.service.ts` + `formula-engine.ts` |
| M28 | Macro Cycle | Not started |

---

## Agent Architecture (Launch Config)

| Agent | Code | Service | Status |
|-------|------|---------|--------|
| Research Agent | - | Assembles `DealContext` JSON | Working |
| Zoning Agent | A03 | `zoning-agent.service.ts` | Working |
| Supply Agent | - | `supply-signal.service.ts` | Working |
| Cashflow Agent | - | `proforma-generator.service.ts` | Working |
| AI Coordinator | - | Claude orchestration | Active |

---

## Conventions

- **JSX pattern:** Named function components with explicit `return (...)`. Pre-compute variables outside JSX tree. Spaces after `return` before JSX.
- **Store pattern:** Zustand `create<T>()` with `set()`. See `dealStore.ts` for reference.
- **API pattern:** `api.client.ts` typed methods. Snake_case from backend → camelCase via `transformDeal()` pattern.
- **Module wiring:** Store acts as message bus. Modules subscribe to dealStore slices, not direct cross-module imports.
- **LayeredValue<T>:** Wraps mutable fields. Resolution order: `broker > platform > user`. User overrides stored separately.
- **DealContext cache:** 24-hour TTL on follow-up turns. Cuts Claude credit cost 60-70%.
