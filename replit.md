# JEDI RE

JEDI RE is an AI-powered B2B real estate intelligence platform providing synthesized, actionable intelligence for deal sourcing, zoning analysis, and market opportunity scoring.

## Run & Operate

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run type-checking
npm run typecheck

# Generate Drizzle migrations
drizzle-kit generate

# Push DB schema changes
drizzle-kit push
```

**Required Environment Variables:**
- `VITE_MAPBOX_TOKEN`
- `CLOUDFLARE_BR_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY`
- `JEDIRE_AGENT_API_KEY`
- `APARTMENT_LOCATOR_API_URL`
- `APARTMENT_LOCATOR_API_KEY`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `FRED_API_KEY`

## Stack

- **Frameworks**: Node.js, Express, React
- **Language**: TypeScript
- **Database**: PostgreSQL (with PostGIS extension)
- **ORM**: Drizzle ORM
- **Validation**: _Populate as you build_
- **Build Tool**: Vite (for frontend)
- **AI/ML**: Anthropic Claude, Python (GeoPandas, NumPy, SciPy, pandas)
- **Mapping**: Mapbox
- **Payments**: Stripe

## Where things live

- **`backend/`**: Node.js/TypeScript backend services, API routes, database interactions.
- **`frontend/`**: React/TypeScript frontend application.
- **`backend/src/db/schema/`**: Database schema definitions (Drizzle).
- **`backend/src/db/migrations/`**: Database migration files.
- **`backend/src/api/rest/`**: REST API route definitions.
- **`backend/src/services/`**: Core business logic and service implementations.
- **`backend/src/agents/`**: AI agent definitions and orchestration.
- **`frontend/src/pages/`**: Top-level frontend pages.
- **`frontend/src/components/`**: Reusable React components.
- **`frontend/src/stores/`**: Zustand stores for frontend state management.
- **`docs/architecture/`**: Architectural documentation, including `RENT_ROLL_ANALYTICS_FRAMEWORK.md`, `f9-proforma-spec.md`.
- **`attached_assets/`**: External specification documents like `TAX_SERVICE_SPEC.md`.

## Architecture decisions

-   **Map-Agnostic Core**: Integrates user-provided maps to reduce GIS costs, avoiding hard dependency on a single GIS provider.
-   **Layered Value System**: Critical data points use `LayeredValue<T>` to track provenance (broker, platform, user) and confidence, enabling auditability and AI-driven data quality assessments.
-   **Hub-and-Spoke Module Wiring (`DealModuleContext`)**: Modules communicate via a central context, ensuring loose coupling and clear data flow without direct module-to-module dependencies.
-   **Verification-First AI Agents**: AI agents (e.g., Zoning, Opus Pro Forma) are designed with multi-step pipelines including confidence scoring, dual-layer knowledge, and professional correction to ensure reliable outputs.
-   **Bloomberg Terminal UX Paradigm**: Frontend design adopts a dark-themed, data-dense, keyboard-navigable interface for efficiency, inspired by Bloomberg Terminal.

## Product

-   **AI-Powered Deal Sourcing**: Identify and evaluate potential real estate investment opportunities.
-   **Comprehensive Zoning Analysis**: Automate zoning code interpretation, development capacity calculations, and regulatory risk assessment.
-   **Market Opportunity Scoring**: Quantify market attractiveness and identify optimal investment strategies.
-   **Financial Pro Forma Modeling**: AI-assisted financial projections with multi-scenario analysis and Excel export.
-   **Real-time Market Intelligence**: Access economic indicators, property data, sales comps, and demographic trends.
-   **Durable Agent System**: Autonomous AI agents perform research, analysis, and generate insights, persisting their work in activity feeds.
-   **CRM & Collaboration**: Manage clients, deals, and leads with RBAC, team collaboration features, and activity logging.
-   **Document Intelligence**: Automated extraction and cross-validation of data from financial documents.

## User preferences

Preferred communication style: Simple, everyday language.

## Gotchas

-   **Cloudflare WAF Blockages**: Many public ArcGIS servers and assessor sites (qPublic, Accela) use Cloudflare's WAF, which often blocks automated access from Replit IPs, even with Cloudflare Browser Rendering.
-   **PostgreSQL NUMERIC as String**: PostgreSQL `NUMERIC` columns are returned as strings by default; ensure `parseFloat()` or similar is used for calculations to avoid type errors.
-   **ArcGIS FeatureServer Inconsistencies**: Field names and data types can vary significantly between different county ArcGIS FeatureServers; schema adaptation is often required.
-   **ArcGIS Spatial Joins**: Linking data across different ArcGIS layers (e.g., parcels to building footprints) often requires spatial joins by geometry intersection, which can be complex to implement efficiently.
-   **Legacy Agent Workforce vs. AI Skills System**: Avoid confusing the deprecated frontend "18 agents" abstraction with the current `backend/src/services/agents/` system. The latter powers `MorningBriefWidget` and `/agents` REST routes.

## Pointers

-   **Drizzle ORM Documentation**: [https://orm.drizzle.team/docs/overview](https://orm.drizzle.team/docs/overview)
-   **Anthropic Claude API**: [https://docs.anthropic.com/claude/reference/getting-started](https://docs.anthropic.com/claude/reference/getting-started)
-   **Mapbox GL JS Documentation**: [https://docs.mapbox.com/mapbox-gl-js/api/](https://docs.mapbox.com/mapbox-gl-js/api/)
-   **PostGIS Documentation**: [https://postgis.net/documentation/](https://postgis.net/documentation/)
-   **Stripe API Documentation**: [https://stripe.com/docs/api](https://stripe.com/docs/api)
-   **Inngest Documentation**: [https://www.inngest.com/docs](https://www.inngest.com/docs)
-   **JEDI RE Rent Roll Analytics Framework**: `docs/architecture/RENT_ROLL_ANALYTICS_FRAMEWORK.md`
-   **JEDI RE F9 Pro Forma Spec**: `docs/architecture/f9-proforma-spec.md`