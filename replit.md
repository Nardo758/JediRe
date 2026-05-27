# JEDI RE

JEDI RE is an AI-powered B2B real estate intelligence platform designed for investors and developers, providing synthesized, actionable intelligence for deal sourcing, zoning analysis, and market opportunity scoring.

## Run & Operate

- **Dev workflow:** `JediRe` workflow runs `./start.sh` which starts both the Express backend (port 4000) and Vite dev server (port 5000), with a proxy on port 3000.
- **IMPORTANT — frontend changes:** The backend serves the **compiled** bundle from `frontend/dist`. Source edits are NOT live-reloaded in the app preview. After any frontend change, run `cd frontend && npm run build` to rebuild, then the changes appear immediately (no server restart needed).
- **Backend changes:** Restart the `JediRe` workflow to pick up changes.
- **DB migrations:** `cd backend && npx drizzle-kit migrate`

## Stack

-   **Backend:** Node.js, TypeScript, Express, GraphQL, WebSockets, PostgreSQL, Drizzle ORM, Python (GeoPandas, PostGIS)
-   **Frontend:** React, Mapbox
-   **AI:** Anthropic/Claude API
-   **Payments:** Stripe

## Operational scripts

- **Property proximity enrichment** (activates COR-23 transit + COR-24 crime): `cd backend && npx ts-node --transpile-only scripts/enrich-property-proximity.ts --city=Atlanta`. Iterates `properties` rows with lat/lng, computes proximity scores via `ProximityService`, and persists `city/state/county`, `transit_score`, and a per-property `crime_index` (= incidents-within-1mi ÷ city mean × 100, sourced from the public Atlanta PD `OpenDataWebsite_Crime_view` ArcGIS layer). Re-runnable; upserts on `property_id`. Flags: `--skip-crime` (no crime fetch), `--radius=1.0`. The legacy `atlanta-pd-crime.service.ts` points at a feature server that returns 400 — not used by this script.
- **Rent roll bed/bath backfill** (Task #1184): `cd backend && npx ts-node --transpile-only scripts/backfill-rent-roll-bed-bath.ts`. One-time script that enriches `deals.deal_data->'extraction_rent_roll'->'floor_plan_mix'` entries that predate Task #1150 and are missing `bedrooms`/`bathrooms` counts. Infers both values from the plan-name key using the same heuristics as the parser. Safe to re-run (only touches entries where `bedrooms` is absent). Supports `--dry-run`.

## Where things live

-   **Database Migrations:** `backend/src/database/migrations/`
-   **API Routes:** `backend/src/api/rest/`
-   **Services:** `backend/src/services/`
    -   **Tax Service:** `backend/src/services/tax/`
    -   **Proforma:** `backend/src/services/proforma/`
    -   **Document Extraction:** `backend/src/services/document-extraction/`
    -   **Agents/Skills:** `backend/src/services/skills/`, `backend/src/services/agents/`
    -   **Correlation Engine:** `backend/src/services/correlationEngine.service.ts`
    -   **Traffic Engine:** `backend/src/services/rent-roll/`, `backend/src/services/traffic-analytics.service.ts`
-   **Frontend Pages:** `frontend/src/pages/`
    -   **Terminal:** `frontend/src/pages/TerminalPage.tsx`
    -   **Financial Engine:** `frontend/src/pages/development/financial-engine/`
    -   **Property Card:** `frontend/src/pages/PropertyCardPage.tsx`
-   **Frontend Components:** `frontend/src/components/`
-   **OperatorStance:** `backend/src/types/operator-stance.ts` (type + 15 modulation rules), `backend/src/services/operatorStance.service.ts` (CRUD + cache-aware reblend), `backend/src/agents/tools/fetch_operator_stance.ts` (Cashflow Agent tool)
-   **Deal Capsule Blueprint:** `docs/architecture/deal-capsule-blueprint.md`
-   **F9 Proforma Spec:** `docs/architecture/f9-proforma-spec.md`
-   **Rent Roll Analytics Framework Spec:** `docs/architecture/RENT_ROLL_ANALYTICS_FRAMEWORK.md`
-   **Deal Journey Framework:** `docs/architecture/deal-journey-framework.md` — A→B semantic model composing DealContext fields into `DealJourney`. Types: `frontend/src/stores/dealJourney.types.ts`. Selector: `frontend/src/stores/dealJourney.selector.ts`. UI: `frontend/src/components/deal/DealJourneyOverlay.tsx` (JOURNEY button in Financial Engine header). Phase 1 LOCKED; PENDING: M36 aggressiveness, M07 confidence bands, M35 event path, M38 calibration.

## Architecture decisions

-   **Map-Agnostic Architecture:** Integrates user-provided maps to reduce GIS costs, enabling flexibility and avoiding vendor lock-in.
-   **LayeredValue System:** Core data model (`LayeredValue<T>`) for provenance tracking, conflict resolution, and data quality. Each value indicates its `resolvedFrom` source and `alertLevel`. Extended with `stanceModulated?: boolean` and `stanceTrace?: string` for OperatorStance tagging.
-   **OperatorStance System:** A sibling to LayeredValue that answers "how should the agent derive numbers?" rather than "what is this number?". Persisted as JSONB in `deals.operator_stance`. Defines 15 deterministic modulation rules across `underwritingPosture`, `rateEnvironment`, `cyclePosition`, and `expenseGrowthPosture`. Stance changes trigger a zero-LLM-cost re-blend against the cached underwriting snapshot.
-   **Module Wiring System (Hub-and-Spoke):** `DealModuleContext` acts as a central hub, allowing modules to interact without direct dependencies, ensuring modularity and maintainability.
-   **Bayesian Traffic Calibration:** A multi-layered, self-calibrating system for traffic prediction coefficients, incorporating rent roll ingestion, starting state resolution, and nightly platform calibration jobs for improved accuracy.
-   **AI-Driven Tooling:** Extensive use of Anthropic Claude for tasks like financial modeling, zoning analysis, commentary generation, design chat, and regulatory risk assessment, moving beyond simple data retrieval to intelligent synthesis and recommendations.
-   **Verification-First Pipelines:** For critical data like zoning and document extraction, pipelines prioritize verification and source tracing, providing confidence scores and links to original documents.

## Product

-   **Real Estate Intelligence Platform:** Synthesized, actionable intelligence for deal sourcing, zoning analysis, and market opportunity scoring.
-   **AI Skills System:** 18 capabilities and 16 advisor personas (e.g., CFO, Legal Advisor) for specialized consultations.
-   **Financial Engine (F9):** 9-tab Bloomberg-style proforma with layered growth, data quality audit trails, protectors (Gordon Growth, Confidence Bands), versioning, and Excel export.
-   **Market Intelligence (F4):** Live computed metrics, customizable columns, demand analysis, suggested metrics, and correlation indicators across MSAs, submarkets, and properties.
-   **Zoning & Development:** Parcel-level zoning lookup, enriched building envelope calculations, entitlement strategy, highest & best use analysis, and 3D design integration.
-   **Debt Advisor (M11):** Bloomberg-style debt analysis with 4 sub-tabs: Advisor, Configure, Sensitivity, Exit.
-   **Investor & Capital Tracking (F8):** LP/GP investor management, capital calls, distributions, and waterfall configurations.
-   **Traffic Engine (M07):** Prediction-first engine with 3-layer data fusion, self-calibrating coefficients, and real-time traffic data integration.
-   **Corporate Health Intelligence (M33):** Submarket employer health analysis linking corporate financials to real estate demand.
-   **Document Extraction:** Automated multi-document financial data extraction (T12, rent roll, tax bill) with cross-validation.
-   **CRM Functionalities:** Client, deal, lead, and activity management within the Agent Dashboard.
-   **Real-time Alerts:** Input-needed alerts, strategy arbitrage alerts, and risk alerts with severity indicators.

## User preferences

Preferred communication style: Simple, everyday language.

## Gotchas

-   **Hardcoding vs. Configuration:** Avoid hardcoding values; prefer configuration files or database entries, especially for reassessment triggers and cycle parameters.
-   **`millage_unit` Conversion:** For NC, `millage_unit: 'per_100'` must be converted to per-$1000 mills by multiplying by 10 at compose-time.
-   **`LayeredValue` Fallbacks:** Ensure `LayeredValue` always has fallback data (platform/broker) to prevent silent data loss or errors when user overrides are cleared.
-   **Database Column Types:** PostgreSQL `NUMERIC` columns are returned as strings; use `safeFloat()` or `parseFloat()` for numeric operations to prevent type-related bugs.
-   **API Route Ordering:** Be mindful of Express route mounting order, especially with catch-all middleware (`requireAuth`) or parameterized routes, to avoid unintended 401/404 errors.
-   **Cloudflare WAF:** Cloudflare Browser Rendering (CBR) cannot bypass Cloudflare's own WAF/Managed Challenge, blocking access to sites like qPublic, Accela, and fultonassessor.org for automated scraping.
-   **Exit Strategy and Investment Strategy are intentionally nullable:** `deal_assumptions.exit_strategy_lv` and `deal_assumptions.investment_strategy_lv` have no default values. When both `detected` and `override` slots are null, `resolved` is also null. All downstream consumers must handle null explicitly — never silently default to `"Sale"`, `"Rental"`, or any other value. The DEAL TERMS tab renders a visible `NOT SET` badge (amber-tone) for both rows when unset. No backfill should ever be performed. **Consumer audit (Task #619/#620):** Cashflow Agent prompt builder, JEDI Score weights, sub-strategy library, and OperatorStance service currently have zero reads of either LV field — null cannot reach them today.

## Cross-tab Events

Custom DOM events dispatched by the F9 financial engine for non-F9 listeners
(M08 panel, OperatorStance reblend, etc.). Subscribe via `window.addEventListener`.

| Event name | Detail shape | When fired |
|---|---|---|
| `basis.changed` | `{}` (no detail) | After operator saves Purchase Price in Deal Terms (dispatched by `dealStore.setPurchasePrice` after confirmed server dual-write). S&U tab, debt sizing rows, and going-in cap all subscribe. |
| `hold_period.changed` | `{ holdYears: number }` | After operator saves Hold Period in Deal Terms (`dealStore.emitHoldPeriodChanged`). Projections and Returns tabs subscribe. |
| `exit_cap.changed` | `{}` (no detail) | After operator saves Exit Cap Rate or Selling Costs % in Deal Terms (`dealStore.emitExitCapChanged`). Returns strip and net-sale-proceeds row subscribe. |
| `deal:strategy-changed` | `{ dealId, field: 'investmentStrategy'\|'exitStrategy', value: string\|null }` | After operator saves either strategy field in Deal Terms (dispatched directly from DealTermsTab — Task #613 deviation, not yet reconciled with dealStore pattern). |
| `assumptions.module-applied` | `{ source: string, fields: string[] }` | After a successful `POST /:dealId/assumptions/apply-from-module` call. Dispatch via `dispatchModuleApplied(source, fields)` from `frontend/src/utils/moduleEvents.ts`. F9's ProFormaTab listens, reloads the affected fields from the API, and triggers a model rebuild. `fields` uses canonical paths: `acquisition.purchasePrice`, `hold.holdPeriodYears`, `disposition.exitCapRate`, `targets.targetIrr`. |

## Pointers

-   **Docs/Architecture:** `docs/architecture/` directory for detailed specifications and gap analyses.
-   **FRED API:** For economic data: `fred-api.client.ts`
-   **Stripe API:** For payment processing: [Stripe Docs](https://stripe.com/docs/api)
-   **Anthropic Claude API:** For AI capabilities: [Anthropic Docs](https://docs.anthropic.com/)
-   **Mapbox API:** For frontend mapping: [Mapbox Docs](https://docs.mapbox.com/)
-   **PostGIS:** For geospatial queries: [PostGIS Docs](https://postgis.net/docs/)
-   **Drizzle ORM:** For database interactions: [Drizzle ORM Docs](https://orm.drizzle.team/docs)
-   **Inngest:** For durable cron jobs and scheduled functions: [Inngest Docs](https://www.inngest.com/docs/)