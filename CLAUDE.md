## Key Reference Files
- `jedi_re_module_wiring_blueprint.xlsx` — Module wiring blueprint with formulas, data flows, and implementation priorities
- See Sheet 7 (Implementation Priority) for build sequence

## Module Wiring System
- Source: `backend/src/services/module-wiring/`
- API routes: `backend/src/api/rest/module-wiring.routes.ts`
- Entry point: `backend/src/services/module-wiring/index.ts`

### Core Components
- **Module Registry** (`module-registry.ts`) — 25 modules (M01-M25) with typed definitions, dependencies, outputs
- **Formula Engine** (`formula-engine.ts`) — 35 formulas (F01-F35) as pure calculation functions
- **Data Flow Router** (`data-flow-router.ts`) — Cross-module data routing with caching and readiness checks
- **Module Event Bus** (`module-event-bus.ts`) — Real-time inter-module event propagation with debouncing
- **Strategy Arbitrage Engine** (`strategy-arbitrage-engine.ts`) — 4-strategy scoring (BTS/Flip/Rental/STR)
- **Module Wiring Orchestrator** (`module-wiring-orchestrator.ts`) — Cascade execution, pipeline management

## Tech Stack
- **Backend**: Node.js / Express / PostgreSQL with PostGIS
- **Frontend**: React 18 / Vite / TypeScript / Tailwind / Zustand
- **Database**: PostgreSQL with PostGIS for geospatial queries
- **AI**: Claude (Opus) via Anthropic SDK
