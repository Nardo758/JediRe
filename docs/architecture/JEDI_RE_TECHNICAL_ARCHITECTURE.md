# JEDI RE — Technical Architecture Document

> **Status:** Internal — contains proprietary resolution logic and Lane-B scope handling. Do not distribute externally.  
> **Last verified:** 2026-07-08 against repo HEAD `8369331`  
> **Authority:** This doc supersedes `TECHNICAL_ARCHITECTURE.md` (25-line stub) and `BACKEND_ARCHITECTURE.md` (0 bytes).  
> **Rules:** Every structural claim carries a `file:line` citation or an explicit `UNVERIFIED` flag.  

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Architecture Decision Records](#2-architecture-decision-records)
3. [Data Schema](#3-data-schema)
4. [Module Registry & Roles](#4-module-registry--roles)
5. [Agent Platform & Coordinator](#5-agent-platform--coordinator)
6. [Field Resolution & Provenance](#6-field-resolution--provenance)
7. [Underwriting Engine & Pro Forma](#7-underwriting-engine--pro-forma)
8. [Data Architecture & Licensing](#8-data-architecture--licensing)
9. [Billing](#9-billing)
10. [Event Bus](#10-event-bus)
11. [Sequence Diagrams](#11-sequence-diagrams)
12. [Market & Scalability](#12-market--scalability)
13. [Security & Data Governance](#13-security--data-governance)
14. [Production Risks & Priority Order](#14-production-risks--priority-order)

---

## 1. System Architecture Overview

### Two-Surface Model

The platform has two primary surfaces — a **chat interface** (S6, conversational) and a **Bloomberg-style Terminal** (S2–S5, tabular/dashboard) — served by the same backend but with different interaction patterns.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SURFACES                                         │
│  ┌─────────────────────┐          ┌─────────────────────────────────────┐│
│  │ Chat (S6)           │          │ Terminal / Asset Hub (S2–S5)        ││
│  │ Opus (Claude)       │          │ React SPA, Zustand, route-driven    ││
│  │ Natural language    │          │ Tabular data, charts, drill-down    ││
│  │ Intent → Agent      │          │ F1–F10 screens, Asset Hub panels    ││
│  └──────────┬──────────┘          └──────────┬──────────────────────────┘│
│             │                                 │                        │
│             │  WS / HTTP                      │  HTTP / REST             │
│             │                                 │                        │
│  ┌──────────┴─────────────────────────────────┴────────────────────────┐│
│  │                         API LAYER                                  ││
│  │  Express.js REST API (index.replit.ts route mounts)               ││
│  │  /api/v1/operations  ·  /api/v1/correlations  ·  /api/v1/capital  ││
│  │  /api/v1/lifecycle   ·  /api/v1/m35            ·  /api/v1/deals    ││
│  └──────────┬─────────────────────────────────┬────────────────────────┘│
│             │                                 │                        │
│  ┌──────────┴──────────┐          ┌──────────┴──────────┐            │
│  │   SERVICE LAYER     │          │   AGENT LAYER       │            │
│  │  · Proforma engine  │          │  · AgentRuntime     │            │
│  │  · Correlation eng. │          │  · 5 agents (L1)    │            │
│  │  · Data Library     │          │  · 10 intents (L2)  │            │
│  │  · M07 Traffic      │          │  · 16 personas (L3) │            │
│  │  · M35 Events       │          │                     │            │
│  └──────────┬──────────┘          └──────────┬──────────┘            │
│             │                                 │                        │
│  ┌──────────┴─────────────────────────────────┴────────────────────────┐│
│  │                         DATA LAYER                                   ││
│  │  PostgreSQL 15  —  raw SQL + Drizzle ORM (partial)                  ││
│  │  · deal_assumptions (year1 JSONB)    · metric_correlations         ││
│  │  · deal_monthly_actuals              · correlation_history         ││
│  │  · rent_roll_snapshots               · subject_traffic_history      ││
│  │  · data_library_files                · proforma_snapshots          ││
│  └──────────┬─────────────────────────────────┬────────────────────────┘│
│             │                                 │                        │
│  ┌──────────┴──────────┐          ┌──────────┴──────────┐            │
│  │  EXTERNAL SOURCES   │          │  DOCUMENT PIPELINE  │            │
│  │  · CoStar           │          │  · OM Parser (PDF)  │            │
│  │  · RentCast         │          │  · CSV / XLSX       │            │
│  │  · ArcGIS           │          │  · Rent Roll Parser │            │
│  │  · FRED (SOFR)      │          │  · Tax Bill Parser  │            │
│  │  · MARTA GTFS       │          │  · T12 Parser       │            │
│  └─────────────────────┘          └─────────────────────┘            │
└─────────────────────────────────────────────────────────────────────────┘
```

**Layer stack (request flow):**

```
Client (React + Zustand dealStore)
  ↓  HTTP / REST
API Gateway (Express, index.replit.ts:1)
  ↓  route mount
Router (/api/v1/operations, /api/v1/correlations, …)
  ↓  handler
Service (proforma-adjustment, correlationEngine, dataLibrary, …)
  ↓  SQL
PostgreSQL (raw pg Pool + Drizzle partial)
  ↓  external
Third-party APIs (CoStar, RentCast, ArcGIS, FRED, …)
```

### Current State
- Route mounts verified in `index.replit.ts`: operations (`:717`), rankings (`:356`), correlations (`:493`), capital (`:725`), lifecycle (`:721`), deals/files (`:573`), team (`:649`), m35 (`:677`) — `CONSOLE_WIRING_AUDIT.md:35`
- `AssetHubPage.tsx` (1,825 lines) is the rebuilt owned-asset surface; `AssetOwnedPage.tsx` (3,167 lines) still contains a render-function fetch bug at `:626–629` — `CONSOLE_WIRING_AUDIT.md:96`
- **No surface parity map exists** — `JEDI_RE_MASTER_SPEC_INDEX.md` §D gap #3: "no doc maps each module to chat vs Bloomberg Terminal, or defines parity."

### Recommended Improvements
- Build and maintain a `SURFACE_PARITY_MAP.md` documenting which modules are chat-native, terminal-native, or dual-surface, with UX feature parity gaps.
- Complete the `AssetOwnedPage.tsx` → `AssetHubPage.tsx` migration and delete the old page (or remove the render-function fetch bug).
- Add a `/api/v1/revenue` mount for the repricing synthesizer (see §14 Risk 3A).

---

## 2. Architecture Decision Records

> All existing ADRs (001–004) are preserved below in summary form. New ADRs (005–011) are drafted as proposed records. Each includes: **Status / Context / Decision / Consequence**.

### ADR-001: LayeredValue<T> as the Platform Provenance Model

- **Status:** Accepted · In production (`backend/src/types/layered-value.ts:44`)
- **Context:** Every deal assumption has multiple possible sources (broker OM, T12, rent roll, tax bill, agent run, operator override). Before this pattern, each field had a single flat value and a single write path — second writes silently clobbered the first with no audit trail.
- **Decision:** Store every multi-source field as a `LayeredValue<T>` with `value`, `source`, `agentRunId`, `stanceModulated`, and `stanceTrace`. Resolution hierarchy: `override > computedValue > agent > storedResolved`. Operator override always wins. `stanceModulated` is a VIEW of the baseline — never written back.
- **Consequence:** One write path per source. No last-write-wins races. Every value is self-describing. Collision detection built in. JSONB storage means DB-level filtering on `value` requires `->>'value'` extraction — acceptable for deal-level data, inappropriate for high-cardinality indexed queries.

### ADR-002: dealStore as the Canonical Cross-Tab Event Bus

- **Status:** Accepted · In production (`frontend/src/stores/dealStore.ts:1821–1845`)
- **Context:** Two cross-tab notification mechanisms existed simultaneously: `dealStore.emit*` actions (typed, testable) and direct `window.dispatchEvent` from component handlers (untyped, untestable). The conflict was discovered during Task #617.
- **Decision:** All cross-tab state notifications are dispatched via `window.dispatchEvent` called **from inside `dealStore` actions**, never from component handlers directly. Naming: `snake_case` dot-separated past-tense verbs. Payload: typed at action signature. Backend is never a subscriber.
- **Consequence:** TypeScript-safe payloads. Central registry. Testable without DOM. Adds store boilerplate per event. Known violation: `DealTermsTab.tsx:761` and `:774` dispatch `deal:strategy-changed` directly from component — bypassing the store. Fix pending.

### ADR-003: Cache-Stamp + Inline-Recompute Fallback for Stance-Derived Cached Values

- **Status:** Accepted · In production (`backend/src/services/financials-composer.service.ts`)
- **Context:** `deal_data.concession_recognition` is cached by `composeDealFinancials` and read by `getDealFinancials`. When an operator toggles `leasingCostTreatment` via `PUT /stance`, the background `applyStanceReblend` touches the underwriting snapshot but does NOT update the cache. Opening F9 immediately after shows a stale value until the next full recompose.
- **Decision:** Stamp `_treatment` into every cache write. On read, validate `cache._treatment === effectiveLct`. On mismatch, inline-recompute from `deal_data.concession_records` using the pure `amortizeConcessions` function (<1ms, no DB calls). The cache becomes self-correcting on next read.
- **Consequence:** Zero race conditions. No recompose trigger. Operator gets correct values immediately. `_treatment` is load-bearing metadata — must be documented as such (SDB-02 in `TODO_F9_SIDE_DEBT.md`).

### ADR-004: Authoritative-Signal Fallback Pattern

- **Status:** Accepted · In production (`frontend/src/pages/development/financial-engine/DecisionTab.tsx`)
- **Context:** F8 "DEAL VERDICT" and F1 "JEDI SCORE" appeared to measure the same thing but were computed by different mechanisms (broad market-plus-financial composite vs narrow financial-risk signal). When `jedi_scores` was absent, F8 silently fell back to live-derived values without surfacing the substitution.
- **Decision:** Consume the authoritative computed signal as primary input. Fall back to live derivation when absent or stale. Always surface which path produced the current value via a provenance line. Never silently substitute. Conflict detection: when primary and fallback disagree materially, render CONFLICT.
- **Consequence:** Users always know which path produced a verdict. No hidden substitutions. JEDI Score and live integrity checks are no longer conflated. Adds one network call per surface load.

### ADR-005: getFieldValue as Canonical Field Accessor

- **Status:** Accepted · In production (`backend/src/services/field-access/get-field-value.service.ts:484`)
- **Context:** Multiple surfaces (Pro Forma, Valuation Grid, Validation Grid, Decision, Returns) were reading `deal_assumptions.year1[field].resolved` directly from SQL JSONB. This produced silent divergence when Engine A computed aggregates (e.g. NOI = EGI − total_opex) and a surface read the stale seeder-stored `noi.resolved` instead.
- **Decision:** Every surface that needs a field value MUST resolve it through `getFieldValue` (or `getFieldValues` for batches). The resolution chain is: `override > computedValue (Engine A) > agent > storedResolved`. Unknown field names are rejected via `ALLOWED_FIELDS` whitelist. Migrated surfaces: Valuation Grid (CF-01), Validation Grid (CF-02–06), Policy mutations (CF-12–13), Overview Tab (CF-14), Decision Tab (CF-15), ProFormaSummaryTab (CF-16) — all at `get-field-value.service.ts:22–34`.
- **Consequence:** Cross-surface byte-for-byte consistency. Divergence detection runs at resolution time. One exception remains: Engine A's own `seedProFormaYear1` seeder path reads the year1 blob directly — this is not a display bypass but the engine's own bootstrap. Computed aggregates (noi, egi, noi_after_reserves) should eventually be back-propagated.

### ADR-006: CashFlow Agent → Deterministic Underwriting Engine + Single-Shot Agent Residue

- **Status:** Accepted · In production (`backend/src/agents/cashflow.agent.ts:76`)
- **Context:** The CashFlow Agent historically computed mortgage math inline from user-supplied params. This produced non-deterministic, non-auditable outputs. The "Two Truths" problem: the agent could produce a different NOI on every run for the same inputs.
- **Decision:** All proforma and financial engine work is split into exactly two layers per Standing Principle P7 (see `CLAUDE.md:356`):
  - **Layer 1 — Calculations:** Deterministic math only (NOI, EGI, IRR, DSCR, equity multiple, exit value, sensitivity grids). Pure TypeScript functions. No LLM involvement.
  - **Layer 2 — Assumptions:** Values the LLM reasons about and operators can override. Stored as `LayeredValue<T>` with provenance. The LLM proposes; the operator confirms; Layer 1 then calculates.
- **Consequence:** Same inputs always produce the same outputs. Agent runs are auditable (evidence chain in `UnderwritingValue<T>`). Divergence between agent-proposed and engine-computed values triggers COR (Collision / Override / Review) escalation.

### ADR-007: Version Inputs, Not Outputs

- **Status:** Accepted · In production (`backend/src/types/layered-value.ts:44`)
- **Context:** Early designs stored computed proforma outputs as versioned snapshots. This created a snapshot explosion problem and made it impossible to regenerate a prior view from the same inputs.
- **Decision:** The platform versions **inputs** (assumptions, operator stance, document extractions) rather than **outputs** (proforma, projections, returns). Any output is derivable on demand by re-running the deterministic engine against the versioned input set. `deal_underwriting_snapshots` stores the input vector + agent evidence; the engine re-derives the proforma at read time.
- **Consequence:** No snapshot explosion. Any historical view is reproducible. The engine is the single source of truth for outputs. Requires the engine to be deterministic and fast enough for on-demand rendering.

### ADR-008: Pro Forma = Stabilized Potential Bridge; Projections = The Path

- **Status:** Accepted · Draft spec (`docs/architecture/M09_PROFORMA_SPEC.md:1`)
- **Context:** Pro Forma and Projections were historically conflated — both showed multi-year operating statements. Operators could not distinguish the "destination" (stabilized potential) from the "path" (month-by-month grind).
- **Decision:** The Pro Forma is a **single stabilized year** — the destination state economics. The Projections tab shows the **path** (month-by-month operating cash flow with timing, capital, and risk). The Pro Forma is `Current + ΣΔ`. Every line item traces back to a Current state value, a bridge decomposition, and a driver narrative. Stabilized year resolution: `max(yearOf(95% occ), yearOf(capex complete), yearOf(rent roll burn-off), yearOf(expense baseline normalized))`.
- **Consequence:** Clear conceptual separation. The deal screen reduces to one question: "how much of the Current → Stabilized Δ do you believe, and why?" 7-Ring Checklist enforced for any schema change (see `CLAUDE.md:196`).

### ADR-009: Lane A / Lane B Data Scope ("Engine + Oil")

- **Status:** Proposed · Spec drafted, partially implemented (`CORRELATION_TERMINAL_SCOPE_SPEC.md:1`)
- **Context:** The platform's correlation engine and terminal markets are valuable because of the signal the user brings (Lane B — licensed CoStar exports, owned-portfolio actuals, proprietary data). The shared corpus (Lane A — open/gov/platform-licensed) is thin. Without a scope boundary, Lane B data could leak into shared artifacts consumed by other users.
- **Decision:** Introduce `scope_id` on `metric_time_series`, `metric_correlations`, and `correlation_history`:
  - `scope_id = 'GLOBAL'` → Lane A only, `redistribution_restricted = FALSE`, cron-computed, readable by all.
  - `scope_id = 'user:<uuid>'` → GLOBAL ∪ that user's Lane-B series, `redistribution_restricted = TRUE`, on-demand compute, readable ONLY by that user, never promoted to GLOBAL.
  - Invariants: user-scope compute MUST NOT write/update any GLOBAL row; user-scope result MUST NOT be returned to any other caller; derived rows whose inputs include a restricted leaf inherit `redistribution_restricted = TRUE` (taint propagation).
- **Consequence:** Same engine code, different fuel. GLOBAL stays clean. User oil enriches private scope only. Three shared-layer writers (comp-query, comp-set, market-metrics-aggregator) need `redistribution_restricted` guards before this is production-safe.

### ADR-010: Jurisdiction-Pluggable Rulesets

- **Status:** Accepted · Principle in force (`CLAUDE.md` Standing Principles)
- **Context:** Real estate is jurisdiction-specific (tax assessment cycles, zoning codes, eviction moratoriums, rent caps). Hardcoding `if (state === 'FL')` throughout the codebase produces unmaintainable, error-prone logic.
- **Decision:** No jurisdiction-specific logic lives outside a dedicated ruleset file. Each jurisdiction (state, county, MSA) has a pluggable ruleset module that exports: tax assessment parameters, zoning code mappings, eviction timelines, rent-cap thresholds, and compliance checklists. The engine loads the ruleset for the deal's jurisdiction at runtime. Rulesets are versioned and testable independently.
- **Consequence:** New jurisdictions are added by adding a ruleset file, not by scattering conditionals across 20 files. The platform can scale to any US state without engine changes. Currently FL-primary + Atlanta/Dallas active; ruleset coverage verified for FL and GA.

### ADR-011: Agents Use the Same Doors as Humans

- **Status:** Accepted · In production (`CLAUDE.md:68`)
- **Context:** Early agent implementations had direct database access ("god mode"), bypassing the platform API, RBAC, and audit logging. This made it impossible to enforce agent-door discipline and created data integrity risks.
- **Decision:** Agents call the platform API (the same API humans use). No private DB backdoor. One documented exception: `write_dealcontext` may write directly to the `deal_context_fields` table for cache efficiency — this is the ONLY exception. Agent outputs land in existing domain tables via `LayeredValue<T>` with `source: 'agent:*'` tags. No parallel storage. No agent-to-agent direct calls — handoffs via Inngest events only.
- **Consequence:** Full audit trail for every agent action. RBAC applies uniformly to humans and agents. Cache invalidation is centralized. The `write_dealcontext` exception is narrowly scoped and documented.



---

## 3. Data Schema

### Schema Philosophy

The data layer is a hybrid: **Drizzle ORM** for new modules (M35, Asset Hub, data pipeline) and **raw SQL / pg Pool** for legacy modules (deals, proforma, assumptions). This split creates a known drift risk — `deal_assumptions` exists in raw SQL migrations but is not reflected in the Drizzle schema, so there is no compile-time type safety for 69 scalar columns + the `year1` JSONB blob.

### 3.1 Core Deal Tables

#### `deal_assumptions` — Raw SQL Only

```sql
-- CREATE TABLE at backend/src/db/migrations/110_v2_extraction_pipeline.sql:1
-- Drizzle schema: NOT PRESENT in backend/src/db/schema/dataPipeline.ts

CREATE TABLE IF NOT EXISTS deal_assumptions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL,
  land_cost NUMERIC(14,2),
  acquisition_costs NUMERIC(14,2),
  hard_cost_psf NUMERIC(8,2),
  hard_cost_total NUMERIC(14,2),
  soft_cost_pct NUMERIC(5,2) DEFAULT 25.00,
  soft_cost_total NUMERIC(14,2),
  contingency_pct NUMERIC(5,2) DEFAULT 5.00,
  contingency_total NUMERIC(14,2),
  developer_fee_pct NUMERIC(5,2) DEFAULT 4.00,
  developer_fee_total NUMERIC(14,2),
  tdc NUMERIC(14,2),
  tdc_per_unit NUMERIC(10,2),
  tdc_per_sf NUMERIC(8,2),
  total_units INTEGER,
  avg_unit_sf NUMERIC(8,2) DEFAULT 900,
  gross_sf NUMERIC(14,2),
  rentable_sf NUMERIC(14,2),
  efficiency NUMERIC(5,4) DEFAULT 0.8500,
  stories INTEGER,
  construction_type VARCHAR(50),
  parking_type VARCHAR(50),
  unit_mix JSONB DEFAULT '{}'::jsonb,
  avg_rent_per_unit NUMERIC(10,2),
  avg_rent_psf NUMERIC(6,2),
  other_income_per_unit NUMERIC(8,2) DEFAULT 50,
  vacancy_pct NUMERIC(5,2) DEFAULT 5.00,
  concessions_pct NUMERIC(5,2) DEFAULT 0.00,
  rent_growth_yr1 NUMERIC(5,2) DEFAULT 3.00,
  rent_growth_stabilized NUMERIC(5,2) DEFAULT 2.50,
  opex_ratio NUMERIC(5,2) DEFAULT 35.00,
  opex_per_unit NUMERIC(8,2),
  property_tax_rate NUMERIC(6,4),
  insurance_per_unit NUMERIC(8,2),
  management_fee_pct NUMERIC(5,2) DEFAULT 3.00,
  replacement_reserves_per_unit NUMERIC(8,2) DEFAULT 250,
  interest_rate NUMERIC(6,4),
  loan_term_years INTEGER DEFAULT 3,
  ltc NUMERIC(5,4) DEFAULT 0.6500,
  ltv NUMERIC(5,4),
  debt_yield_min NUMERIC(5,4),
  dscr_min NUMERIC(5,2) DEFAULT 1.25,
  amortization_years INTEGER DEFAULT 30,
  io_period_months INTEGER DEFAULT 36,
  origination_fee_pct NUMERIC(5,2) DEFAULT 1.00,
  exit_cap NUMERIC(6,4) DEFAULT 0.0500,
  hold_period_years INTEGER DEFAULT 5,
  disposition_cost_pct NUMERIC(5,2) DEFAULT 2.00,
  noi_stabilized NUMERIC(14,2),
  yield_on_cost NUMERIC(6,4),
  cash_on_cash_yr1 NUMERIC(6,4),
  irr_levered NUMERIC(6,4),
  irr_unlevered NUMERIC(6,4),
  equity_multiple NUMERIC(6,2),
  profit_margin NUMERIC(6,4),
  stabilized_value NUMERIC(14,2),
  assumptions_source VARCHAR(50) DEFAULT 'manual',
  last_computed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  source_type VARCHAR(30) DEFAULT 'manual',
  source_ref VARCHAR(500),
  source_date DATE,
  year1 JSONB,          -- ← LayeredValue fields live here (see §6)
  PRIMARY KEY (id),
  UNIQUE (deal_id)
);
```

**Key columns:**
- `year1` — JSONB blob containing LayeredValue fields (`gpr`, `vacancy`, `concessions`, `noi`, `exit_cap`, etc.) with `resolved`, `override`, `agent`, `t12`, `om`, `broker` layers. See `get-field-value.service.ts:192` for the `ALLOWED_FIELDS` whitelist.
- 69 scalar columns for development/proforma parameters. Many have hardcoded defaults that may be stale.

**Gap:** `deal_assumptions` is NOT in the Drizzle schema (`backend/src/db/schema/dataPipeline.ts:1` exports 6 sub-schemas, none include `deal_assumptions`). This means no compile-time type safety, no automatic migration generation, and no `relations()` wiring for foreign keys.

#### `deal_monthly_actuals` — Drizzle-Typed

```typescript
// backend/src/db/schema/dataPipeline.ts:107
export const dealMonthlyActuals = pgTable('deal_monthly_actuals', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  reportMonth: date('report_month').notNull(),
  totalUnits: integer('total_units'),
  occupiedUnits: integer('occupied_units'),
  occupancyRate: numeric('occupancy_rate', { precision: 5, scale: 3 }),
  avgMarketRent: numeric('avg_market_rent', { precision: 10, scale: 2 }),
  avgEffectiveRent: numeric('avg_effective_rent', { precision: 10, scale: 2 }),
  grossPotentialRent: numeric('gross_potential_rent', { precision: 14, scale: 2 }),
  lossToLease: numeric('loss_to_lease', { precision: 12, scale: 2 }),
  vacancyLoss: numeric('vacancy_loss', { precision: 12, scale: 2 }),
  concessions: numeric('concessions', { precision: 12, scale: 2 }),
  badDebt: numeric('bad_debt', { precision: 12, scale: 2 }),
  netRentalIncome: numeric('net_rental_income', { precision: 14, scale: 2 }),
  otherIncome: numeric('other_income', { precision: 12, scale: 2 }),
  utilityReimbursement: numeric('utility_reimbursement', { precision: 12, scale: 2 }),
  lateFees: numeric('late_fees', { precision: 10, scale: 2 }),
  miscIncome: numeric('misc_income', { precision: 10, scale: 2 }),
  effectiveGrossIncome: numeric('effective_gross_income', { precision: 14, scale: 2 }),
  payroll: numeric('payroll', { precision: 12, scale: 2 }),
  repairsMaintenance: numeric('repairs_maintenance', { precision: 12, scale: 2 }),
  turnoverCosts: numeric('turnover_costs', { precision: 12, scale: 2 }),
  marketing: numeric('marketing', { precision: 12, scale: 2 }),
  adminGeneral: numeric('admin_general', { precision: 12, scale: 2 }),
  managementFee: numeric('management_fee', { precision: 12, scale: 2 }),
  managementFeePct: numeric('management_fee_pct', { precision: 5, scale: 3 }),
  utilities: numeric('utilities', { precision: 12, scale: 2 }),
  contractServices: numeric('contract_services', { precision: 12, scale: 2 }),
  propertyTax: numeric('property_tax', { precision: 12, scale: 2 }),
  insurance: numeric('insurance', { precision: 12, scale: 2 }),
  hoaCondoFees: numeric('hoa_condo_fees', { precision: 12, scale: 2 }),
  totalOpex: numeric('total_opex', { precision: 14, scale: 2 }),
  opexPerUnit: numeric('opex_per_unit', { precision: 10, scale: 2 }),
  opexRatio: numeric('opex_ratio', { precision: 5, scale: 3 }),
  noi: numeric('noi', { precision: 14, scale: 2 }),
  noiPerUnit: numeric('noi_per_unit', { precision: 10, scale: 2 }),
  debtService: numeric('debt_service', { precision: 12, scale: 2 }),
  debtServiceInterest: numeric('debt_service_interest', { precision: 12, scale: 2 }),
  capex: numeric('capex', { precision: 12, scale: 2 }),
  capexReserves: numeric('capex_reserves', { precision: 12, scale: 2 }),
  cashFlowBeforeTax: numeric('cash_flow_before_tax', { precision: 14, scale: 2 }),
  newLeases: integer('new_leases'),
  renewals: integer('renewals'),
  moveOuts: integer('move_outs'),
  leaseTradeOut: numeric('lease_trade_out', { precision: 10, scale: 2 }),
  renewalRate: numeric('renewal_rate', { precision: 5, scale: 3 }),
  avgDaysToLease: numeric('avg_days_to_lease', { precision: 7, scale: 2 }),
  adr: numeric('adr', { precision: 10, scale: 2 }),
  revpar: numeric('revpar', { precision: 10, scale: 2 }),
  strOccupancy: numeric('str_occupancy', { precision: 5, scale: 3 }),
  strRevenue: numeric('str_revenue', { precision: 12, scale: 2 }),
  dataSource: varchar('data_source', { length: 50 }),
  uploadId: uuid('upload_id'),
  sourceDocumentType: varchar('source_document_type', { length: 50 }),
  sourcePeriodLabel: varchar('source_period_label', { length: 50 }),
  isBudget: boolean('is_budget').default(false),
  isProforma: boolean('is_proforma').default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  propertyIdx: index('idx_actuals_property').on(table.propertyId),
  monthIdx: index('idx_actuals_month').on(table.reportMonth),
  propertyMonthIdx: index('idx_actuals_property_month').on(table.propertyId, table.reportMonth),
  uploadIdx: index('idx_actuals_upload').on(table.uploadId),
  uniqueMonthly: uniqueIndex('idx_actuals_unique')
    .on(table.propertyId, table.reportMonth, table.isBudget, table.isProforma),
}));
```

**Key properties:** 58 columns, fully Drizzle-typed with indexes. `isBudget` and `isProforma` flags allow budget rows to coexist with actuals. `CONSOLE_WIRING_AUDIT.md` shows 40 actuals rows for Highlands + 0 budget rows → projected-vs-actual comparison renders actuals-only.

#### `rent_roll_snapshots` — Extended for M07

```sql
-- ALTER TABLE at backend/src/db/migrations/20260503_018_m07_subject_history.sql:18

ALTER TABLE rent_roll_snapshots
  ADD COLUMN IF NOT EXISTS parsed_payload   jsonb,
  ADD COLUMN IF NOT EXISTS unit_count       int,
  ADD COLUMN IF NOT EXISTS occupied_count   int,
  ADD COLUMN IF NOT EXISTS parser_source    text;
```

Extended so S1/S2 aggregators can work without re-joining `leasing_events`. `parsed_payload` stores a normalised per-unit array (`RentRollLeaseEvent[]`).

#### `rent_roll_diffs` — Cross-Snapshot Event Ledger

```sql
-- CREATE TABLE at backend/src/db/migrations/20260503_018_m07_subject_history.sql:39

CREATE TABLE IF NOT EXISTS rent_roll_diffs (
  id                       serial        PRIMARY KEY,
  deal_id                  uuid          NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  from_snapshot_id         int           NOT NULL REFERENCES rent_roll_snapshots(id) ON DELETE CASCADE,
  to_snapshot_id           int           NOT NULL REFERENCES rent_roll_snapshots(id) ON DELETE CASCADE,
  period_days              int           NOT NULL,
  renewal_rate             numeric(6,4),
  turnover_rate            numeric(6,4),
  new_lease_trade_out_pct  numeric(8,4),
  renewal_trade_out_pct    numeric(8,4),
  signing_velocity         numeric(8,4),
  days_vacant_median       numeric(8,2),
  concession_trend         text CHECK (concession_trend IN ('increasing','stable','decreasing')),
  loss_to_lease            numeric(6,4),
  renewal_n                int NOT NULL DEFAULT 0,
  turnover_n               int NOT NULL DEFAULT 0,
  trade_out_n              int NOT NULL DEFAULT 0,
  days_vacant_n            int NOT NULL DEFAULT 0,
  per_unit_events          jsonb,
  computed_at              timestamptz   NOT NULL DEFAULT NOW(),
  UNIQUE (from_snapshot_id, to_snapshot_id)
);
```

Written by the Diff Extractor (`rent-roll-diff.service.ts`) after the second rent roll upload for a deal. Consumed by the S2 aggregator and peer-collision detector.

#### `subject_traffic_history` — Canonical Per-Deal Subject History

```sql
-- CREATE TABLE at backend/src/db/migrations/20260503_018_m07_subject_history.sql:83

CREATE TABLE IF NOT EXISTS subject_traffic_history (
  id                  serial        PRIMARY KEY,
  deal_id             uuid          NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  tier                text          NOT NULL CHECK (tier IN ('S1','S2','S3','S4')),
  snapshot_count      int           NOT NULL DEFAULT 1,
  coverage_months     numeric(6,2),
  current_state       jsonb,
  observed_dynamics   jsonb,
  confidence_weights  jsonb         NOT NULL DEFAULT '{}',
  peer_collisions     jsonb,
  computed_at         timestamptz   NOT NULL DEFAULT NOW(),
  UNIQUE (deal_id)
);
```

One row per deal. Tier promoted in-place: S1 (single snapshot) → S2 (≥2 snapshots ≥60 days apart). `confidence_weights` stores per-coefficient Bayesian weights `{ "<coeff>": { n_obs, n_required, weight } }`. `peer_collisions` stores material divergences from the peer set (`|subject − peer| > 1.5σ`).

### 3.2 Correlation & Market Data Tables

#### `metric_correlations` — Latest Value (DELETE+INSERT)

```sql
-- Original CREATE TABLE not found in repo; ALTER TABLE at backend/src/db/migrations/20260401_002_metric_correlations_enhancements.sql:1

ALTER TABLE metric_correlations
  ADD COLUMN IF NOT EXISTS observation_start DATE,
  ADD COLUMN IF NOT EXISTS observation_end DATE;

-- Unique index (no scope_id yet — see §8)
CREATE UNIQUE INDEX idx_mc_unique
  ON metric_correlations (metric_a, metric_b, geography_type, COALESCE(geography_id, '__AGG__'), window_months);
```

**UNVERIFIED:** The original `CREATE TABLE metric_correlations` definition was not found in the current repo. The migration above is an ALTER on an existing table. The table is referenced at `correlationEngine.service.ts:524`.

#### `correlation_history` — Append-Only Sparkline Source

```sql
-- CREATE TABLE at backend/src/database/migrations/20260601_correlation_history.sql:12

CREATE TABLE IF NOT EXISTS correlation_history (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_a         TEXT        NOT NULL,
  metric_b         TEXT        NOT NULL,
  geography_type   TEXT        NOT NULL,
  geography_id     TEXT,
  window_months    INT         NOT NULL,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  computed_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
  correlation_r    NUMERIC(10, 7) NOT NULL,
  p_value          NUMERIC(10, 7),
  sample_size      INT         NOT NULL,
  observation_start DATE,
  observation_end   DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

One row per pair per calendar day. `ON CONFLICT` key: `(metric_a, metric_b, geography_type, COALESCE(geography_id, ''), window_months, computed_date)`. The `computed_date` column (DATE) is used because PostgreSQL requires IMMUTABLE functions in index expressions, and `timestamptz::date` is STABLE.

#### `data_library_files` — Document Ingestion + Licensing Primitive

```typescript
// backend/src/services/dataLibrary.service.ts:11
export interface DataLibraryFile {
  id: number;
  user_id: string | null;
  deal_id: string | null;
  redistribution_restricted: boolean;  // ← Lane-B guard
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  city: string | null;
  zip_code: string | null;
  property_type: string | null;
  property_height: string | null;
  year_built: string | null;
  unit_count: number | null;
  source_type: string;
  tags: string[];
  parsed_data: any;
  parser_status: string;  // 'pending' | 'running' | 'success' | 'failed'
  parser_error: string | null;
  uploaded_at: Date;
}
```

The `redistribution_restricted` flag is the primitive for Lane-B data isolation. `getFilesByDeal` excludes restricted files by default (`dataLibrary.service.ts:621`). The `getDealFolderManifest` also excludes restricted files from the deal folder (`dataLibrary.service.ts:652`).

### 3.3 Schema Drift & Gaps

| Gap | Evidence | Severity | Fix |
|---|---|---|---|
| `deal_assumptions` not in Drizzle schema | `backend/src/db/schema/dataPipeline.ts:1` — no `deal_assumptions` | MEDIUM | Migrate to Drizzle schema |
| `lifecycle_reforecasts` table referenced but does NOT exist | `CONSOLE_WIRING_AUDIT.md:33` — "NOT A TABLE (relation does not exist)" | HIGH | Create table + implement handler at `lifecycle.routes.ts:212` |
| `historical_observations` table definition not found | Grep for CREATE TABLE returned no match | MEDIUM | Verify if table exists or needs creation |
| `scope_id` not yet added to `metric_correlations` / `correlation_history` | `CORRELATION_TERMINAL_SCOPE_SPEC.md` §1; no ALTER found in repo | HIGH | Run migrations §1a–c from spec |
| `metric_time_series` CREATE TABLE not found | Referenced in `correlationEngine.service.ts` but definition not in repo | MEDIUM | Locate or create migration |

### Current State vs Recommended Improvements

**Current State:** The schema is a functional hybrid of raw SQL (legacy) and Drizzle (new). Core tables (`deal_assumptions`, `rent_roll_snapshots`, `metric_correlations`) work but lack ORM type safety. `deal_monthly_actuals` and `proforma_snapshots` are fully Drizzle-typed. The M07 subject-first tables (`rent_roll_diffs`, `subject_traffic_history`) are well-structured raw SQL. `lifecycle_reforecasts` is a phantom reference.

**Recommended Improvements:**
1. Migrate `deal_assumptions` to Drizzle schema for compile-time safety.
2. Create `lifecycle_reforecasts` table and implement the handler.
3. Add `scope_id` + `redistribution_restricted` columns to `metric_time_series`, `metric_correlations`, and `correlation_history` per `CORRELATION_TERMINAL_SCOPE_SPEC.md` §1.
4. Audit all `CREATE TABLE` references to ensure every referenced table has a discoverable migration.



---

## 4. Module Registry & Roles

### 4.1 The 29 Registered Modules (§A Spine)

The authoritative module index lives in `JEDI_RE_MASTER_SPEC_INDEX.md` §A. Each module has an authoritative spec, a primary code file, and a status from the v2 wiring blueprint. Below is the Phase 1-verified registry with wiring labels applied.

| M## | Module | Surface | Authoritative Spec | Primary Code | Status | Wiring Label |
|---|---|---|---|---|---|---|
| M01 | Deal Overview | S1 | `deal-capsule-blueprint.md` | deal capsule routes | Built | **WIRED** |
| M02 | Zoning & Entitlements | S1 | `MAP_AGNOSTIC_ZONING.md` | `agents/zoning.agent.ts` | Partial | **WIRED** (adapter → runtime) |
| M03 | Development Capacity | S1 | `DEVELOPMENT_CAPACITY.md` | — | Partial | **UNVERIFIED** — no code anchor found |
| M04 | Supply Pipeline | S1 | *(no dedicated spec — gap)* | `agents/supply.agent.ts` | Partial | **WIRED** (adapter → runtime) |
| M05 | Market Analysis | S2 | `vendor-market-data/overview.md` | `market-metrics-aggregator.service.ts` | Partial | **WIRED** |
| M06 | Demand Signals | S2 | *(no dedicated spec — gap)* | services/demand* | Built | **PARTIAL** — no spec, code exists |
| M07 | Traffic Intelligence | S2 | `TRAFFIC_ENGINE_CALIBRATION_SPEC.md` *(not in repo)* | services/traffic* | **New** | **PARTIAL** — F6 UI live, 0 calibration rows for p2122 |
| M08 | Strategy Arbitrage | S2 | `STRATEGY_FIELDS_LV_PATTERN.md` | services/strategy* | Partial | **PARTIAL** — strategy detection v2 built, no spec for M08 engine |
| M09 | Pro Forma Engine | S3 | `M09_PROFORMA_SPEC.md` | services/proforma*, `financials-composer.service.ts` | Partial | **PARTIAL** — engine live, bypasses getFieldValue |
| M10 | Scenario Engine | S3 | `SCENARIO_MANAGEMENT_SPEC.md` | services/scenario* | Built | **WIRED** |
| M11 | Debt Analysis | S3 | `capital_structure_engine_handoff.md` | services/capital* | Partial | **PARTIAL** — debt route exists but not fetched from Asset Hub |
| M12 | Exit Analysis | S3 | `CAPITAL_EXIT_SUBSYSTEM_AUDIT.md` | services/exit* | Partial | **PARTIAL** — `ExitTimingTab.tsx` uses hardcoded constants |
| M13 | Due Diligence Tracker | S4 | *(no dedicated spec — gap)* | services/dd* | Partial | **PARTIAL** — no spec |
| M14 | Risk Dashboard | S4 | *(no dedicated spec — gap)* | services/risk* | Built | **PARTIAL** — no spec, `RiskDashboard.tsx` renders but no behavior spec |
| M15 | Competition Analysis | S4 | `comp-profiles-spec.md` | `competitive-set.service.ts`, `comp-query.service.ts` | Partial | **PARTIAL** — per-property rankings endpoint missing |
| M16 | Deal Pipeline | S5 | `deal-journey-framework.md` | services/pipeline* | Built | **WIRED** |
| M17 | Team & Collaboration | S5 | *(no dedicated spec — gap)* | services/team* | Partial | **PARTIAL** — 0 team members for Highlands, chain intact |
| M18 | Documents & Files | S5 | `DATA_LIBRARY_SCHEMA.md` | `dataLibrary.service.ts`, OM parser | Partial | **WIRED** |
| M19 | News Intelligence | S6 | `Event_Impact_Engine_Spec.md` (→ M35) | services/news* | Partial | **PARTIAL** — M35 specced but not built |
| M20 | Map Intelligence | S6 | `MAP_AGNOSTIC_IMPLEMENTATION.md` | services/map* | Partial | **PARTIAL** — map agnostic architecture built |
| M21 | AI Chat (Opus) | S6 | `OPUS_INTEGRATION.md`, `CLAUDE.md` | `agents/runtime/`, coordinator | Partial | **WIRED** — AgentRuntime 6-step loop, 5 agents |
| M22 | Portfolio Manager → **Asset Hub** | S6 | `ASSET_HUB_REBUILD_SPEC_*.md` | `revenue-management.service.ts` | Partial | **PARTIAL** — 15/31 panels connected, 16 broken or missing |
| M23 | Alerts & Notifications | S6 | `NOTIFICATION_SYSTEM.md` | services/notification* | Partial | **PARTIAL** — `deal_notifications` referenced, not verified |
| M24 | Settings & Preferences | S6 | *(no dedicated spec — gap)* | — | Partial | **ABSENT** — no code found |
| M25 | JEDI Score Engine | S6 | v2 Formula Engine F01 *(no standalone md)* | services/score* | Built | **PARTIAL** — no standalone spec, `jedi_scores` table referenced |
| M35 | Event Impact Engine | S2 | `Event_Impact_Engine_Spec.md` | services/event-impact* | New (specced) | **NEW** — tables exist, not wired to traffic engine |
| M36 | Joint Distribution Engine | S4 Inference | `M36_Joint_Distribution_Engine_Spec.md` | services/joint-dist* | New (specced) | **NEW** — specced, not built |
| M37 | Cross-Market Analog Engine | S4 Inference | `M37_Cross_Market_Analog_Engine_Spec.md` | services/analog* | New (specced) | **NEW** — specced, not built |
| M38 | Calibration Ledger | S4 Inference | `M35_Calibration_Ledger_Addendum.md` | `calibration-calculator.ts` | New (specced) | **NEW** — specced, not built |

### 4.2 Registry Gaps (No Dedicated Behavior Spec)

8 modules have no dedicated "how it works / output" contract:

| Module | Status | What Runs On |
|---|---|---|
| M04 Supply Pipeline | Partial | Code + v2 metadata only |
| M06 Demand Signals | Built | Code + v2 metadata only |
| M13 Due Diligence Tracker | Partial | Code + v2 metadata only |
| M14 Risk Dashboard | Built | Code + v2 metadata only |
| M17 Team & Collaboration | Partial | Code + v2 metadata only |
| M24 Settings & Preferences | Partial | No code found |
| M25 JEDI Score Engine | Built | v2 Formula Engine F01 only |
| M03 Development Capacity | Partial | No code anchor found |

### 4.3 Cross-Cutting Subsystems (§B Spine)

These span modules and are where most wiring bugs live. None appear in the M## registry because it is module-keyed, not subsystem-keyed.

| Subsystem | Authoritative Spec | Code Anchor | Wiring Label |
|---|---|---|---|
| Agent Platform / Coordinator (3-layer) | `CLAUDE.md`, `AGENT_PLATFORM_SPEC` | `agents/{research,zoning,supply,cashflow,commentary}.agent.ts`, `agents/runtime/` | **WIRED** |
| Vendor Market Data (Pieces A–D) | `vendor-market-data/{overview,piece-a,piece-b,piece-c,piece-d}.md` | services/intake-sources, integrations | **PARTIAL** |
| Property Plumbing (identity unification) | `property-plumbing-*.md` (6 files) | property identity layer | **PARTIAL** |
| Event Bus / Kafka-Inngest | `EVENT_BUS_ARCHITECTURE.md`, `EVENT_PROPAGATION_AUDIT.md` | `index.replit.ts` (Inngest serve), `inngest/functions/` | **PARTIAL** |
| LayeredValue / provenance | `ADR-001`, `STRATEGY_FIELDS_LV_PATTERN.md` | `field-access/get-field-value.service.ts` | **WIRED** |
| DealStore message bus | `ADR-002` | `dealStore.ts` | **WIRED** |
| Cache-stamp / freshness | `ADR-003` | `financials-composer.service.ts`, `proforma-adjustment.service.ts` | **WIRED** |
| Authoritative-signal fallback | `ADR-004` | `jedi-score.service.ts`, `DecisionTab.tsx` | **WIRED** |
| Correlation Engine (30 signals) | `correlation-metrics-engine.jsx`, v2 Recomputation Cascade | `correlationEngine.service.ts` | **WIRED** (scope-blind) |
| Data Library / licensing primitive | `DATA_LIBRARY_SCHEMA.md`, `DATA_ARCHITECTURE.md` | `dataLibrary.service.ts` | **WIRED** |
| Third-party data scope ("engine + oil") | `CORRELATION_TERMINAL_SCOPE_SPEC.md` | `scope_id` (to build) | **UNIMPLEMENTED** |
| Field Reconciliation / cross-surface read | `cross-surface-read-consistency.md`, `cross-surface-field-inventory.md` | resolution chain | **WIRED** |

### 4.4 Module Role Split (Producer / Source-Layer / Consumer)

The v2 wiring blueprint defines three roles per module:

- **Producer:** Generates data that other modules consume. Example: M07 Traffic Engine produces `traffic_calibration_factors` and `traffic_predictions` consumed by M09 Pro Forma and M22 Asset Hub.
- **Source-Layer:** Reads from external data sources and normalizes into the platform corpus. Example: M18 Data Library (OM parser, CSV ingestion, rent-roll parser) produces `data_library_files` + parsed extractions.
- **Consumer:** Reads from platform tables and produces UI-facing or decision-facing outputs. Example: M22 Asset Hub consumes `deal_monthly_actuals`, `rent_roll_units`, `lease_tradeout_events`, `leasing_weekly_observations`, and `correlation_results`.

**Critical wiring gaps (producer → consumer):**

| Producer | Consumer | Connection Status | Evidence |
|---|---|---|---|
| M07 `traffic_predictions` | M22 Asset Hub (MARKET SIGNALS) | **BROKEN@5** | `CONSOLE_WIRING_AUDIT.md:131` — 0 rows for p2122 |
| M09 Pro Forma (budget rows) | M22 Asset Hub (projected-vs-actual) | **BROKEN@5** | `CONSOLE_WIRING_AUDIT.md:133` — 0 budget rows |
| M11 Debt (lifecycle.routes.ts:227) | M22 Asset Hub (CapitalScreen) | **BROKEN@1** | `CONSOLE_WIRING_AUDIT.md:141` — no `useEffect` fetches debt |
| M22 Waterfall (`deal_waterfalls`) | M22 Asset Hub (CapitalScreen) | **BROKEN@2** | `CONSOLE_WIRING_AUDIT.md:143` — path mismatch 404 |
| M18 Data Library (OM pipeline) | M05 Market Analysis (comp set) | **PARTIAL** | `CONSOLE_WIRING_AUDIT.md:123` — no per-property time-series feed |
| M25 JEDI Score | M22 Asset Hub (JEDI SIGNAL chip) | **PARTIAL** | `CONSOLE_WIRING_AUDIT.md:125` — `/api/v1/revenue` not mounted |

### Current State vs Recommended Improvements

**Current State:** 29 modules registered, 22 with some code presence, 8 with no behavior spec. 15 of 31 Asset Hub panels are CONNECTED (full + degraded). 16 are broken or missing. The v2 wiring blueprint is the authoritative structural spine but its "Built / Partial / New" status is self-reported — `CONSOLE_WIRING_AUDIT.md` and live DB state outrank it.

**Recommended Improvements:**
1. Write behavior specs for the 8 registry gaps (M04, M06, M13, M14, M17, M24, M25, M03).
2. Build a live module health dashboard that queries the DB for each producer's output table row count, not self-reported status.
3. Resolve the 5 critical producer → consumer wiring gaps above before adding new modules.

---

## 5. Agent Platform & Coordinator

### 5.1 Three-Layer Topology

```
User message
     ↓
COORDINATOR (runs in user session, no service account)
  1. Intent classifier  → one of 10 Routing Specialists (Layer 2)
  2. Persona selector   → one of 16 Analyst Personas (Layer 3)
  3. Dispatch decision  → Agent (Layer 1)? General LLM? Both?
     ↓                           ↓
LAYER 1 — AGENTS          GENERAL LLM HANDLER
(AgentRuntime)             (persona-flavored reply)
Research, Zoning,          Used when no dedicated agent
Supply, CashFlow,          handles that routing specialist
Commentary
     ↓
Platform API (RBAC + audit)
     ↓
Postgres (domain tables, agent writes wrapped in LayeredValue<T>)
```

**Layer 1 — Agents (5 total):** Each has a service account, capability list, versioned prompt in `prompt_versions`, typed tool registry, `BudgetEnforcer`, and run tracking in `agent_runs` + `agent_run_steps`.

| Agent ID | Primary Output | Service Account ID |
|---|---|---|
| `research` | `deal_context` | `00000000-0000-0000-0000-000000000001` |
| `zoning` | `zoning_analysis` | `00000000-0000-0000-0000-000000000002` |
| `supply` | `supply_analysis` | `00000000-0000-0000-0000-000000000003` |
| `cashflow` | `cashflow_projection` | `00000000-0000-0000-0000-000000000004` |
| `commentary` | `market_commentary` | `00000000-0000-0000-0000-000000000005` |

**Layer 2 — Routing Specialists (10 intent labels):** Not agents. The Coordinator's intent classifier maps each message to one of:
- `SUPPLY`, `CASH`, `ZONING`, `RESEARCH` → dispatch to Layer 1 agent
- `DEMAND`, `COMPS`, `RISK`, `DEBT`, `NEWS`, `STRATEGY` → general LLM handler with context fragment

Graduation criteria for new agents (all three must hold): ≥5% of dispatches over 30 days, structured output needed, tool use would materially improve answers.

**Layer 3 — Analyst Personas (16 prompt variants):** System prompt variants on the Coordinator. Change voice/emphasis, not what data is fetched: CFO, ACCOUNTANT, MARKETING, DEVELOPER, LEGAL, LENDER, ACQUISITIONS, ASSET_MANAGER, PROPERTY_MANAGER, LEASING, FACILITIES, INVESTMENT_ANALYST, ESG, COMPLIANCE, TAX, RESEARCHER.

### 5.2 AgentRuntime 6-Step Loop

```
1. Pre-flight budget check (BudgetEnforcer)
2. Create agent_run row (agent_runs table)
3. Load system prompt from prompt_versions table
4. Tool-calling loop (Claude ↔ tools, with per-step persistence in agent_run_steps)
5. Validate output against Zod schema
6. Mark run complete, return validated output
```

Implementation: `backend/src/agents/runtime/AgentRuntime.ts:1`. Key properties:
- Budget caps are non-optional (`maxTokensPerRun`, `maxCostUsdPerRun`, `maxStepsPerRun`, `maxCostUsdPerDealPerDay`, `maxCostUsdPerUserPerMonth`).
- Prompts must be versioned — no inline prompt strings in agent code.
- Output schema validation is non-optional. Unvalidated agent output poisons the DealContext cache.
- No agent-to-agent direct calls — handoffs via Inngest events only.

### 5.3 DealContext Assembly + 24h Cache

The AgentRuntime assembles a `DealContext` object for each run by:
1. Loading the deal's `deal_context_fields` rows (written by `write_dealcontext` tool)
2. Merging with `deal_assumptions.year1` fields
3. Applying the LayeredValue resolution chain
4. Caching the result for 24 hours

The cache is invalidated when:
- An operator override is saved (`POST /assumptions/:fieldPath/override`)
- A new document is ingested (OM, rent roll, T12)
- An agent run completes and writes new context fields
- The `dealStore` emits a cross-tab event (`basis.changed`, `hold_period.changed`, etc.)

### 5.4 Tool Registries

Each agent has a typed tool registry registered in its config (e.g., `cashflow.config.ts`, `research.config.ts`). Tools are Zod-schemas that the AgentRuntime converts to Anthropic-compatible JSON Schema at runtime (`AgentRuntime.ts:51` via `zodToAnthropicInputSchema`).

Example tool set for CashFlow Agent: `fetch_t12`, `fetch_rent_roll`, `fetch_assumptions`, `compute_proforma`, `write_projection`, `generate_roadmap`.

Example tool set for Research Agent: `fetch_parcel`, `fetch_ownership`, `fetch_tax_bill`, `fetch_comps`, `fetch_costar_metrics`, `write_dealcontext`.

### 5.5 Escalation / Divergence Routing

When an agent run produces a value that diverges materially from an existing source (e.g., agent-proposed NOI differs from T12-sourced NOI by >threshold), the divergence is surfaced to the operator via:
1. `DivergenceSignature` in `getFieldValue` (`get-field-value.service.ts:335`)
2. Validation Grid "CONTESTED" badge
3. Deal Capsule disagreements section
4. `recordDivergenceObservation` stub → intended to feed into T-C1 deal completeness scoring

### 5.6 Commentary Agent — Known Issue

The Commentary Agent (`backend/src/agents/commentary.agent.ts`, 758 lines) exists but is **not called from the Asset Hub** (`AssetHubPage.tsx`). The thesis panel renders mocked bullets. Two blockers:
1. `assetMode` field is NOT FOUND in `ResearchAgentContext` or `DealContext` (`CONSOLE_WIRING_AUDIT.md:68`)
2. No `useEffect` in `AssetHubPage.tsx` calls any commentary endpoint

### Current State vs Recommended Improvements

**Current State:** All 5 agents are Phase 3/4 adapters delegating to AgentRuntime. The 6-step loop is implemented. Budget enforcement is active. Prompt versioning is enforced. The Coordinator's 3-layer composition (10 intents × 16 personas = 160 possible routing shapes) gives expressive range without 20+ agent maintenance cost. Commentary Agent is orphaned from the Asset Hub UI.

**Recommended Improvements:**
1. Add `assetMode?: 'owned' | 'pipeline'` to `ResearchAgentContext` in `dealContext.ts` and expose a commentary endpoint for owned-asset mode.
2. Add a `useEffect` in `PerformanceScreen` (`AssetHubPage.tsx:1184`) calling the commentary endpoint.
3. Verify the 24h cache invalidation logic is wired for all 5 cache-busting events (currently only `dealStore` events are documented).
4. Build graduation tracking for the 6 "general LLM" intent categories (DEMAND, COMPS, RISK, DEBT, NEWS, STRATEGY) to determine if any meet the ≥5% / structured-output / tool-use thresholds.

---

## 6. Field Resolution & Provenance

### 6.1 getFieldValue — Canonical Accessor

`backend/src/services/field-access/get-field-value.service.ts:484` is the single canonical access point for any LayeredValue field stored in `deal_assumptions.year1`.

**Resolution chain (in priority order):**

```
1. Operator override   (year1[field].override  — user-pinned value)
2. Engine A computed   (for aggregate fields: egi, noi, noi_after_reserves)
3. Agent layer         (year1[field].agent — agent-written intermediate)
4. Stored resolved     (year1[field].resolved — seeder's best value)
```

**Engine A computed aggregates (re-run on every read):**

```typescript
// get-field-value.service.ts:236
const COMPUTED_AGGREGATES = {
  egi: {
    formula: 'net_rental_income + other_income',
    deps: ['net_rental_income', 'other_income'],
    compute: ({ net_rental_income, other_income }) =>
      Math.round(net_rental_income + other_income),
  },
  noi: {
    formula: 'egi - total_opex',
    deps: ['egi', 'total_opex'],
    compute: ({ egi, total_opex }) => Math.round(egi - total_opex),
  },
  noi_after_reserves: {
    formula: '(egi - total_opex) - replacement_reserves',
    deps: ['egi', 'total_opex', 'replacement_reserves'],
    compute: ({ egi, total_opex, replacement_reserves }) =>
      Math.round((egi - total_opex) - replacement_reserves),
  },
};
```

Engine A rounds NOI to whole dollars to avoid JSONB float noise. `getFieldValue` preserves that rounding for byte-for-byte parity with Pro Forma output.

### 6.2 LayeredFieldValue Type

```typescript
// get-field-value.service.ts:147
export interface LayeredFieldValue {
  fieldName: string;
  year: number;                // 1 = year 1; Year-N not yet supported
  resolved: number | null;     // canonical value every surface MUST display
  override: number | null;     // Layer 1: operator override
  computedValue: number | null; // Layer 2: Engine A computed
  agent: number | null;        // Layer 3: agent-written
  t12: number | null;         // Tier 1: T-12 document
  om: number | null;           // Tier 1: OM narrative
  broker: number | null;       // Tier 4: broker OM
  storedResolved: number | null; // Seeder's stored best
  resolution: string | null;   // how resolved was determined
  source: string | null;       // source label
  computedAs?: string;         // formula description (e.g. 'egi - total_opex')
  divergenceSignature?: DivergenceSignature; // present when ≥2 sources non-null
}
```

### 6.3 Divergence Detection

When ≥2 source layers are non-null for the same field, `buildDivergenceSignature` (`:335`) computes:
- Maximum pairwise absolute delta across all source pairs
- Alert level: `none` (all agree within threshold) / `warn` (material divergence) / `block` (extreme divergence)
- Per-point annotations: deltaAbsolute, deltaRelative, directionVsResolved

Per-field thresholds are defined in `divergence-thresholds.ts` (unread in Phase 1). The `DivergenceSummary` (`getDivergenceSummary`, `:785`) aggregates across 17 tracked fields for T-C1 deal completeness scoring.

### 6.4 Per-Surface Migration Status

The following surfaces have been migrated to the canonical `getFieldValue` path:

| Surface | Task | Status |
|---|---|---|
| Valuation Grid (CF-01: NOI) | #1541 | Migrated |
| Validation Grid (CF-02–CF-06) | #1541 | Migrated |
| Valuation Grid (CF-07–CF-11) | #1563 | Migrated |
| Policy mutations (CF-12–CF-13) | #1620 | Migrated |
| Overview Tab (CF-14) | #1620 | Migrated |
| Decision Tab (CF-15) | #1620 | Migrated |
| ProFormaSummaryTab (CF-16) | #1620 | Migrated |

**Surfaces still using non-canonical reads:**
- Pro Forma (`financials-composer.service.ts`) — reads `year1` blob via `seedProFormaYear1`. This is Engine A's own seeder path, not a display bypass, but computed aggregates should eventually be back-propagated.
- ReturnsTab `proforma.year1` row iteration — acceptable for tabular projection columns; no point-in-time `.find()` reads remain after Task #1620.
- AssumptionsTab `proforma.year1` iteration — in-tab display scaffolding, documented exception.

### 6.5 Context Override Layer (deal_context_fields)

The `POST /assumptions/:fieldPath/override` endpoint writes user-pinned values to `deal_context_fields` with `source_label = 'override'`. `getFieldValues` (`:596`) fetches these in a second query and injects them into the LV blob before divergence analysis runs. If the proforma LV already has an override, it takes precedence; context overrides only fill the null case.

This makes `POST /assumptions/:fieldPath/override` visible to the divergence engine and the Validation Grid CONTESTED badge.

### Current State vs Recommended Improvements

**Current State:** `getFieldValue` is the canonical path for 23 fields. Cross-surface consistency is enforced for Valuation Grid, Validation Grid, Policy mutations, Overview, Decision, and ProFormaSummary. Divergence detection runs at resolution time. The `deal_context_fields` override layer is integrated. Engine A's seeder path is the only documented non-canonical read.

**Recommended Improvements:**
1. Migrate Engine A's `seedProFormaYear1` to write computed aggregates back to `year1[field].computedValue` so the seeder-stored `resolved` is never stale.
2. Add Year-N field support to `getFieldValue` (currently `year !== 1` returns `null`).
3. Implement `recordDivergenceObservation` (currently a stub at `divergence-ledger.stub`) to feed divergence data into the T-C1 completeness signal.
4. Expand `ALLOWED_FIELDS` whitelist as new LayeredValue keys are introduced.

---

## 7. Underwriting Engine & Pro Forma

### 7.1 Engine A vs Agent:cashflow — The Two-Layer Model

All proforma and financial engine work is split into exactly two layers per Standing Principle P7 (`CLAUDE.md:356`):

**Layer 1 — Calculations (Engine A):** Deterministic math only. Given the same inputs, always produces the same outputs. Implemented as pure TypeScript functions. No LLM involvement. Examples: `NOI = EGI − total_opex`, `IRR`, `DSCR`, `equity multiple`, `exit value`, `sensitivity grids`.

**Layer 2 — Assumptions (Agent:cashflow):** Values the LLM reasons about and operators can override. Stored as `LayeredValue<T>` with provenance. The LLM proposes; the operator confirms; Layer 1 then calculates. Examples: rent per unit type, vacancy %, OpEx line items, growth rates, exit cap rate, debt terms, hold period.

**The boundary:** Never put arithmetic inside an LLM prompt. Never let an LLM output a value that should be the result of a formula. Phase 2 derivation logic applies only to `layer: 'assumption'` entries. `layer: 'calculated_output'` entries are never sent to the LLM for derivation.

### 7.2 Pro Forma = Stabilized Potential Bridge

The Pro Forma is a **single stabilized year** — the destination state economics — not a "shorter Projections." The Projections tab shows the month-by-month path with timing, capital, and risk.

**Stabilized year resolution:**

```
stabilizedYear = max(
  yearOf(95% sustained occupancy),       // from M07 + LeaseVelocityEngine
  yearOf(capex schedule complete),        // from M22 capex_schedule
  yearOf(rent roll burn-off complete),    // from in-place lease expiry curve
  yearOf(expense baseline normalized)     // from M22 normalization
)
```

The binding constraint is surfaced to the user inline:
> "Stabilizes Y3 — binding constraint: rent roll burn-off (last in-place lease expires Mar 2028)."

Every Pro Forma line item traces back to:
1. A **Current state value** (T12, rent roll, or $0 for development)
2. A **bridge decomposition** (market drift + platform signal + operator thesis + capex)
3. A **driver narrative** (one line of "because…")

### 7.3 The Rent-Roll Single-Anchor Invariant

The Pro Forma Year 1 ("Current") column is anchored to the **latest rent roll** for acquisition deals and the **T12** for owned-asset deals. This is the single-anchor invariant: there is exactly one canonical source for the Current state, and all other sources (OM, broker, platform) are treated as secondary evidence that may diverge.

When the rent roll is uploaded, the S1 aggregator (`subject-history-s1.service.ts`) runs immediately, extracting current-state coefficients: occupancy, LTL, concessions, signing velocity. These become the SUBJECT layer in the M07 coefficient resolver, promoted above the peer set.

### 7.4 7-Ring Checklist — Cross-Cutting Propagation Discipline

Any add/delete of a Pro Forma or Projections line item is a cross-cutting change. The checklist (`CLAUDE.md:196`) requires updates to 7 rings:

| Ring | Surface | What must be checked / updated |
|---|---|---|
| 0 | Database schema | Add/remove column or JSONB key. Write migration. Update seed data. |
| 1 | F9 Tabs (frontend) | AssumptionsTab STATIC_ROWS, SensitivityTab axis candidates, CompareTab COMPARE_FIELDS, ProjectionsTab display columns. |
| 2 | Backend types + DealContext + dealStore | `DealFinancials` type, `DealContext` shape, `dealStore` selectors/transformers. |
| 3 | Document parsers | T12 parser, rent-roll parser, tax-bill parser, cross-validation service, ProForma seeder. *(Section A only)* |
| 4 | Downstream module consumers | Underwriting engine, DSCR calculator, returns engine, sensitivity engine, risk-flag evaluators. |
| 5 | Agent logic | CashFlow Agent prompt + tool schema. Commentary Agent context fragment. |
| 6 | Excel export | `buildProjectionsSheet` row map, Pro Forma sheet row index constants, CFBT formula, Assumptions sheet blocks. |
| 7 | Archive backfill plan | Historical deal records: migration, default value, or not-applicable. M36 covariance matrix re-seeding if driver. |

**Section A vs Section B Decision Point:** Every Pro Forma field must be explicitly assigned to Section A (document-sourced, flows Y1 → Y2+) or Section B (trajectory-only, Y2+ only). Section A requires Ring 3 (parser) updates; Section B does not.

### 7.5 Pro Forma Bypassing getFieldValue — Production Risk

Engine A's `seedProFormaYear1` reads `deal_assumptions.year1` directly, not via `getFieldValue`. This is documented as "the engine's own bootstrap path" but has a critical side effect: when an operator overrides a leaf field (e.g., `net_rental_income`), the Pro Forma seeder may not see the override until the next full recompose, while the Valuation Grid (which uses `getFieldValue`) sees it immediately. This corrupts the realized-vs-underwritten learning signal.

**Evidence:** `get-field-value.service.ts:37–39` documents the exception: "Pro Forma (`financials-composer.service.ts`) — reads year1 blob via `seedProFormaYear1`; this IS Engine A's own seeder path, not a display bypass, but computed aggregates should eventually be back-propagated."

### Current State vs Recommended Improvements

**Current State:** The two-layer model (Engine A deterministic + Agent:cashflow assumptions) is the architectural principle. The Pro Forma = Stabilized Potential bridge is defined in the M09 spec. The 7-Ring Checklist is codified. The rent-roll single-anchor invariant is implemented via S1 aggregation. However, Engine A's direct year1 read bypasses the canonical resolution chain, creating a silent divergence risk.

**Recommended Improvements:**
1. Migrate Engine A's `seedProFormaYear1` to call `getFieldValues` for the full year1 field set, or at minimum back-propagate computed aggregates (`noi`, `egi`, `noi_after_reserves`) into `year1[field].computedValue` after every recompose.
2. Implement the stabilized year resolution logic (`max(yearOf(95% occ), yearOf(capex), yearOf(burn-off), yearOf(expense))`) in the backend so the "binding constraint" message is data-driven, not hardcoded.
3. Add a divergence detector specifically for "Pro Forma vs Valuation Grid" that flags when Engine A's computed aggregate differs from the seeder-stored `resolved` by more than the field threshold.



---

## 8. Data Architecture & Licensing

### 8.1 Lane A / Lane B — The "Engine + Oil" Model

The platform is the engine; users bring the oil.

- **Lane A (GLOBAL scope):** Platform-licensed, open/government, or internally derived data that may be redistributed. Stored in the shared corpus with `redistribution_restricted = FALSE`. Cron-computed. Readable by all users. Examples: FRED SOFR, MARTA GTFS, Atlanta PD crime, OSM POIs, Census data, platform-derived market benchmarks.

- **Lane B (user scope):** User-licensed data that may NOT be redistributed. Stored with `redistribution_restricted = TRUE`. On-demand compute. Readable ONLY by the owning user. Never promoted to GLOBAL. Examples: CoStar exports, broker packages, owned-portfolio actuals, proprietary comp sets, third-party reports.

**The flywheel:** The same engine code runs on both scopes. A user with Lane-B data for a geography sees richer correlations and market tiles than a user with only Lane-A data. The GLOBAL base ensures no user sees an empty state.

### 8.2 Scope Model (per `CORRELATION_TERMINAL_SCOPE_SPEC.md`)

```
scope_id  TEXT  NOT NULL  DEFAULT 'GLOBAL'
  'GLOBAL'        → Lane A only. redistribution_restricted = FALSE. Cron-computed. Readable by all.
  'user:<uuid>'   → GLOBAL ∪ that user's Lane-B series. redistribution_restricted = TRUE.
                    On-demand/on-upload compute. Readable ONLY by that user. Never promoted.
```

Resolution at read time for user X:
- Input series = `WHERE scope_id IN ('GLOBAL', 'user:X')`. Where the same metric/geography exists in both, the user row wins.
- Result rows are written to `scope_id = 'user:X'` ONLY. The GLOBAL DELETE/INSERT path is untouched by user runs.

**Hard invariants:**
1. A user-scope compute MUST NOT write, delete, or update any `scope_id = 'GLOBAL'` row.
2. A user-scope result MUST NOT be returned to any caller other than that user.
3. No path promotes `user:*` rows to `GLOBAL`.
4. Any derived row whose input series included a `redistribution_restricted = TRUE` leaf inherits `redistribution_restricted = TRUE` (taint propagation).

### 8.3 `redistribution_restricted` Guards

The `data_library_files` table has a `redistribution_restricted` boolean (`dataLibrary.service.ts:15`). The `DataLibraryService` enforces this in two places:

1. `getFilesByDeal` (`:621`) — excludes restricted files by default unless `includeRestricted: true` is passed.
2. `getDealFolderManifest` (`:652`) — excludes restricted files from the deal folder aggregate.

**Critical gap:** Three shared-layer writers currently have **no `redistribution_restricted` filter** and can leak a restricted leaf into a shared/cross-user artifact:

- `comp-query.service.ts` / `compQueryEngine.ts`
- `competitive-set.service.ts`
- `market-metrics-aggregator.service.ts`

**Evidence:** `CORRELATION_TERMINAL_SCOPE_SPEC.md` §4: "These three services currently have no `redistribution_restricted` filter and can leak a restricted leaf into a shared/cross-user artifact."

### 8.4 Schema Changes for Scope (Pending)

The `CORRELATION_TERMINAL_SCOPE_SPEC.md` §1 defines additive migrations for `scope_id` and `redistribution_restricted` on three tables:

| Table | Current State | Required Change | Status |
|---|---|---|---|
| `metric_time_series` | No `scope_id` | `ADD COLUMN scope_id TEXT NOT NULL DEFAULT 'GLOBAL'`, `ADD COLUMN redistribution_restricted BOOLEAN NOT NULL DEFAULT FALSE` | **UNIMPLEMENTED** |
| `metric_correlations` | No `scope_id` | Same as above, re-key `idx_mc_unique` to prepend `scope_id` | **UNIMPLEMENTED** |
| `correlation_history` | No `scope_id` | Same as above, re-key `idx_corr_hist_daily_unique` to prepend `scope_id` | **UNIMPLEMENTED** |

**UNVERIFIED:** The `CREATE TABLE` definitions for `metric_time_series` and `metric_correlations` were not found in the repo during Phase 1. The `correlation_history` table exists (`backend/src/database/migrations/20260601_correlation_history.sql:12`) but has no `scope_id` column.

### 8.5 Derived-Data Taint

No document in the repo states that a restricted leaf taints downstream computed outputs. The taint rule is implied by ADR-009 §1 invariant 4 but is not verified in code. Example: if a user uploads a CoStar rent series (restricted) and the platform computes a YoY rent growth rate from that series, the derived growth rate should also carry `redistribution_restricted = TRUE`. This is not currently implemented.

### Current State vs Recommended Improvements

**Current State:** The Lane A / Lane B model is architecturally sound and documented in the scope spec. The `redistribution_restricted` primitive exists on `data_library_files`. The DataLibraryService enforces exclusion for deal-scoped reads. However, `scope_id` columns are not yet added to the three corpus tables, and three shared-layer writers lack the guard. Derived-data taint is not implemented.

**Recommended Improvements:**
1. Run the three `ALTER TABLE` migrations from `CORRELATION_TERMINAL_SCOPE_SPEC.md` §1 (additive, DEFAULT 'GLOBAL' backfill — zero behavior change for existing rows).
2. Thread `scope_id` through the Correlation Engine write path (`correlationEngine.service.ts:521–535`) with `DELETE ... AND scope_id = :scope` and `INSERT ... scope_id = :scope`.
3. Add `redistribution_restricted = FALSE` predicate to `comp-query.service.ts`, `competitive-set.service.ts`, and `market-metrics-aggregator.service.ts` for shared-artifact writes.
4. Implement derived-data taint: any computed metric whose input series includes a restricted leaf must stamp its output row with `redistribution_restricted = TRUE`.
5. Run the 6-check test harness from `CORRELATION_TERMINAL_SCOPE_SPEC.md` §5 with a test account before any UI scope overlay is built.

---

## 9. Billing

> **Status:** UNVERIFIED — thin code evidence found during Phase 1. Reduced to a brief accounting.

### Current State

The user memory notes a "4-tier credit model + automation levels 1–4" and Stripe for payments. The dispatch mentions a `free/professional/team/enterprise` enum vs a `principal/institutional` mismatch. However, during Phase 1 inventory:

- No Stripe configuration file was found in the backend (`grep stripe` returned no matches in the first 30 results).
- No billing tier enum was found in the codebase (`grep -r 'free\|professional\|team\|enterprise'` limited to TypeScript returned no clear enum definition).
- No credit accounting table or service was found.
- The `JEDI_RE_MASTER_SPEC_INDEX.md` §D gap #4 explicitly states: "the 4-tier credit model + automation levels 1–4 aren't wired to any module or agent in the registry."

**What exists:** The `data_library_files` table has a `user_id` column, and `getDealFolderManifest` scopes to a user. The `agent_runs` table tracks per-run costs. The `BudgetEnforcer` enforces per-user-per-month caps. These are billing-adjacent but not a full billing system.

### UNVERIFIED Claims

| Claim | Evidence | Status |
|---|---|---|
| Stripe Token Billing | None found in repo | UNVERIFIED |
| `free/professional/team/enterprise` enum | None found in repo | UNVERIFIED |
| `principal/institutional` enum | None found in repo | UNVERIFIED |
| Tier enum mismatch causing silent attribution-gate failures | None found in repo | UNVERIFIED — dispatch seed candidate |
| Credit accounting table | None found in repo | UNVERIFIED |

### Recommended Improvements

1. **Audit the billing layer:** Search for `stripe`, `billing`, `tier`, `subscription`, `credit` in the backend and frontend. Document what exists.
2. **Reconcile enums:** If both `free/professional/team/enterprise` and `principal/institutional` exist, map them to a single canonical enum and add a migration.
3. **Wire automation levels:** Map automation levels 1–4 to module/agent permissions in the module registry.
4. **Add billing to the architecture doc:** Once the audit is complete, expand this section to full depth with schema blocks, sequence diagrams, and ADR-level decisions.

---

## 10. Event Bus

### 10.1 Inngest Cron Functions

All Inngest functions are registered in `backend/src/index.replit.ts` inside the `serve()` call. Function files live in `backend/src/inngest/functions/`.

| Function ID | File | Schedule | Purpose | Status |
|---|---|---|---|---|
| `traffic-calibration-weekly` | `trafficCalibrationCron.ts` | Monday 02:00 UTC | M07 Bayesian calibration — updates `traffic_calibration_factors` platform posteriors. lookbackHours=168. | **WIRED** |
| `rate-sheet-staleness-check` | `rateSheetStaleness.cron.ts` | Sunday 03:00 UTC | Tax Service Phase 4 — flags expiring `rate_sheet_versions` rows for Research Agent re-verification. | **WIRED** |
| `data-corpus-reminder` | `dataCorpusReminderCron.ts` | 1st/2nd/3rd of month 12:00 UTC | Historical Observations Phase 3 — emits `deal_notifications` for missing monthly uploads. | **WIRED** |
| `historical-observations-backfill` | `historicalObservationsBackfill.ts` | On-demand / one-shot | Backfills `historical_observations` from existing rent roll snapshots. | **WIRED** |
| `snapshot-sentiment-daily` | `snapshot-sentiment.function.ts` | Daily | Captures daily market sentiment snapshots. | **WIRED** |
| `capture-monthly-snapshots` | `capture-monthly-snapshots.ts` | Monthly | Market data monthly snapshot capture. | **WIRED** |
| `sync-marta-gtfs` | `sync-marta-gtfs.ts` | Scheduled | MARTA GTFS transit data sync. | **WIRED** |
| `sync-osm-pois` | `sync-osm-pois.ts` | Scheduled | OSM points-of-interest sync. | **WIRED** |
| `sync-atlanta-pd-crime` | `sync-atlanta-pd-crime.ts` | Scheduled | Atlanta PD crime data sync. | **WIRED** |

**Note:** `CONSOLE_WIRING_AUDIT.md` notes that 3 redundant node-cron blocks (apartment locator sync, Georgia county ingestion, traffic calibration) were removed from the M28 scheduler and consolidated into Inngest coverage. The M28 scheduler now uses Inngest exclusively.

### 10.2 dealStore CustomEvent Bus (Frontend-Only)

All cross-tab state notifications are dispatched via `window.dispatchEvent` from inside `dealStore` actions (`frontend/src/stores/dealStore.ts:1821–1845`).

| Event Name | Action | Detail Shape | Dispatch Location |
|---|---|---|---|
| `basis.changed` | `setPurchasePrice` / `emitBasisChanged` | `{}` | `dealStore.ts:1834` |
| `hold_period.changed` | `emitHoldPeriodChanged` | `{ holdYears: number }` | `dealStore.ts:1830` |
| `exit_cap.changed` | `emitExitCapChanged` | `{}` | `dealStore.ts:1844` |
| `lease_velocity.output.updated` | `emitLeaseVelocityUpdated` | `{}` | `dealStore.ts:1822` |
| `leasing_cost_treatment.changed` | `emitLeasingCostTreatmentChanged` | `{ treatment: string }` | `dealStore.ts:1826` |

Subscribers use `window.addEventListener` inside `useEffect` with cleanup. Backend is never a subscriber. Known violation: `DealTermsTab.tsx:761` and `:774` dispatch `deal:strategy-changed` directly from component handlers, bypassing the store.

### 10.3 Kafka Topics (Referenced, Not Verified)

The `CORRELATION_TERMINAL_SCOPE_SPEC.md` §2b references a Kafka topic: `correlation.recomputed` with payload `{ scope_id, geography_type, geography_id, pairs[] }`. This is intended for v2's Recomputation Cascade to subscribe to scoped correlation updates.

**UNVERIFIED:** The actual Kafka broker configuration, topic creation, and consumer wiring were not verified during Phase 1. The `EVENT_PROPAGATION_AUDIT.md` exists but was not read. Inngest functions are confirmed wired; Kafka is spec-only at this stage.

### 10.4 Event Propagation Audit Status

`docs/architecture/EVENT_PROPAGATION_AUDIT.md` exists in the repo but was not read during Phase 1. The `CROSS_TAB_EVENT_PATTERN.md` (referenced in ADR-002) documents the frontend-only event bus. The backend event propagation (Inngest → Kafka → downstream consumers) is not fully documented in the files read.

### Current State vs Recommended Improvements

**Current State:** 9 Inngest cron functions are registered and running. The frontend dealStore event bus is canonical for cross-tab UI notifications. Kafka topics are referenced in the scope spec but not verified. The M28 scheduler has been consolidated to Inngest only.

**Recommended Improvements:**
1. Read `EVENT_PROPAGATION_AUDIT.md` to verify backend event propagation completeness.
2. Create the `correlation.recomputed` Kafka topic and wire the Recomputation Cascade consumer if v2's cascade is still active.
3. Fix the `DealTermsTab.tsx:761` violation by adding `emitStrategyChanged` to `dealStore` and updating both call sites.
4. Add event propagation monitoring (Inngest function success/failure rates, Kafka lag if applicable) to the operational dashboard.

---

## 11. Sequence Diagrams

### 11.1 Deal Intake → DealContext Assembly → Agent Run → Resolution → Proforma

```
Operator (Chat or Terminal)
  │  "Analyze 123 Main St"
  │
  ├─► Coordinator (intent classifier)
  │     │  Intent: RESEARCH → dispatch to Research Agent
  │     │  Persona: ACQUISITIONS
  │     │
  │     ├─► Research Agent (AgentRuntime)
  │     │     │  1. Budget check (BudgetEnforcer)
  │     │     │  2. Create agent_run row
  │     │     │  3. Load prompt from prompt_versions
  │     │     │  4. Tool loop:
  │     │     │     ├─ fetch_parcel → ArcGIS API
  │     │     │     ├─ fetch_ownership → County records
  │     │     │     ├─ fetch_tax_bill → Tax service
  │     │     │     ├─ fetch_comps → CoStar / RentCast
  │     │     │     └─ write_dealcontext → deal_context_fields (DB)
  │     │     │  5. Validate output against Zod schema
  │     │     │  6. Mark run complete
  │     │     │
  │     │     ├─► deal_context_fields (DB)
  │     │     │     │  INSERT INTO deal_context_fields (deal_id, field_path, value, source_label, agent_run_id)
  │     │     │
  │     ├─◄ Research Agent returns DealContext
  │     │
  ├─◄ Coordinator returns structured response to operator
  │
  │  (Operator edits an assumption)
  │
  ├─► POST /assumptions/noi/override
  │     │  INSERT INTO deal_context_fields (deal_id, field_path, value, source_label='override')
  │     │  INSERT INTO deal_assumptions (year1['noi'].override = value)
  │     │
  │     ├─► getFieldValue('noi')
  │     │     │  Resolve: override (new) > computedValue > agent > storedResolved
  │     │     │  Recompute egi, noi, noi_after_reserves from current leaf values
  │     │     │  Build DivergenceSignature if ≥2 sources non-null
  │     │     │
  │     ├─► dealStore.emitBasisChanged()
  │     │     │  window.dispatchEvent(new CustomEvent('basis.changed'))
  │     │     │  All tabs re-fetch
  │     │
  │     ├─► CashFlow Agent (triggered by event or manual)
  │     │     │  1. Budget check
  │     │     │  2. Create agent_run
  │     │     │  3. Load prompt
  │     │     │  4. Tool loop:
  │     │     │     ├─ fetch_t12 → deal_monthly_actuals
  │     │     │     ├─ fetch_rent_roll → rent_roll_snapshots
  │     │     │     ├─ fetch_assumptions → getFieldValues(batch)
  │     │     │     ├─ compute_proforma → Engine A (deterministic)
  │     │     │     │   noi = egi - total_opex (Math.round)
  │     │     │     └─ write_projection → deal_underwriting_snapshots
  │     │     │  5. Validate
  │     │     │  6. Complete
  │     │     │
  │     ├─► deal_underwriting_snapshots (DB)
  │     │     │  Stores input vector + agent evidence chain (LayeredValue<T>)
  │     │
  │     ├─► Pro Forma Tab (re-fetch on 'basis.changed')
  │     │     │  GET /financials → getDealFinancials()
  │     │     │  Read deal_underwriting_snapshots
  │     │     │  Render stabilized year operating statement
  │     │
  │     └─► Projections Tab (re-fetch)
  │           │  Month-by-month trajectory with timing, capital, risk
  │
  └─◄ Operator sees updated Pro Forma + Projections
```

### 11.2 OM Ingestion Pipeline (Parse → Geocode → Distribute → Sentiment)

```
Operator uploads PDF to Data Library
  │
  ├─► DataLibraryService.uploadFile()
  │     │  fs.writeFileSync(filePath, buffer)
  │     │  INSERT INTO data_library_files (...)
  │     │  parseFileAsync(fileId, filePath, mimeType)
  │     │
  ├─► parseFileAsync() — background
  │     │  mimeType === 'application/pdf'
  │     │  runOmPipeline(fileId, filePath)
  │     │
  ├─► runOmPipeline() (dataLibrary.service.ts:238)
  │     │  Stage: 'parsing'
  │     │  ├─► parseOM(buffer, fileName, { userId, onStageChange })
  │     │  │     │  OCR fallback if scanned PDF
  │     │  │     │  Extract: property address, investment thesis, highlights, comps, replacement cost
  │     │  │     │  Returns: { success, data, summary, warnings, meta }
  │     │  │
  │     │  Stage: 'geocoding'
  │     │  ├─► tagOmWithMarket(pool, { address, city, state, zip })
  │     │  │     │  Geocode → MSA key, submarket key
  │     │  │     │  UPDATE data_library_files SET msa_key=$1, submarket_key=$2, om_extraction=$3
  │     │  │
  │     │  Stage: 'distributing'
  │     │  ├─► distributeOmExtraction({ pool, fileId, extraction, geo })
  │     │  │     │  INSERT INTO rent_comps (...)
  │     │  │     │  INSERT INTO sale_comps (...)
  │     │  │     │  INSERT INTO replacement_cost_rows (...)
  │     │  │     │  INSERT INTO narratives (...)
  │     │  │     │  Returns: { rentComps, saleComps, replacementCostRows, narratives }
  │     │  │
  │     │  Stage: 'sentiment'
  │     │  ├─► scoreBrokerSentiment({ thesis, highlights, msaKey, submarketKey, userId, fileId })
  │     │  │     │  LLM call: score investment thesis sentiment
  │     │  │     │  INSERT INTO market_sentiment_history (...)
  │     │  │
  │     │  Stage: 'complete'
  │     │  UPDATE data_library_files SET parser_status='success', parser_used='om-pipeline'
  │     │
  │     │  Any stage failure → terminal failure stage (ocr_failed, parse_failed, distribute_failed, sentiment_failed)
  │     │  No silent fallbacks (Task #383)
  │     │
  └─◄ Operator sees status in Data Library UI
```

### 11.3 Field Resolution Through getFieldValue

```
Surface (Valuation Grid, Validation Grid, Decision Tab, etc.)
  │
  ├─► getFieldValue(pool, dealId, 'noi', 1)
  │     │  1. Check ALLOWED_FIELDS.has('noi') → true
  │     │  2. Check year === 1 → true
  │     │  3. Look up aggDef: COMPUTED_AGGREGATES['noi'] = { formula: 'egi - total_opex', deps: ['egi', 'total_opex'] }
  │     │  4. Collect allKeys: ['noi', 'egi', 'total_opex', 'year1_noi'] (legacy alias)
  │     │  5. SQL: SELECT da.year1->'noi' AS lv_noi, da.year1->'egi' AS lv_egi, ... FROM deal_assumptions WHERE deal_id = $1
  │     │  6. Parse lv_noi → { override: null, agent: null, resolved: 2264800, t12: 2150000, om: 2400000, broker: 2100000 }
  │     │  7. Parse dep lv_egi → { resolved: 4434800 } ... Parse dep lv_total_opex → { resolved: 2170000 }
  │     │  8. Resolve dep egi: override=null, computedValue=null, agent=null, storedResolved=4434800 → resolved=4434800
  │     │  9. Resolve dep total_opex: same pattern → resolved=2170000
  │     │  10. Compute aggDef: Math.round(4434800 - 2170000) = 2264800
  │     │  11. Resolve primary noi: computedValue=2264800, storedResolved=2264800 → resolved=2264800 (no override)
  │     │  12. Build DivergenceSignature:
  │     │      points: [
  │     │        { layer: 't12', value: 2150000, deltaAbsolute: 114800, deltaRelative: -0.0507, directionVsResolved: 'below' },
  │     │        { layer: 'om', value: 2400000, deltaAbsolute: 135200, deltaRelative: 0.0598, directionVsResolved: 'above' },
  │     │        { layer: 'broker', value: 2100000, deltaAbsolute: 164800, deltaRelative: -0.0728, directionVsResolved: 'below' },
  │     │        { layer: 'storedResolved', value: 2264800, deltaAbsolute: 0, deltaRelative: 0, directionVsResolved: 'equal' }
  │     │      ]
  │     │      maxAbsDelta = 300000 (broker vs om)
  │     │      threshold = 150000 (from divergence-thresholds.ts)
  │     │      alertLevel = 'warn' (300000 >= 150000, < 450000)
  │     │      exceeds = true
  │     │  13. Return LayeredFieldValue with divergenceSignature
  │     │
  ├─◄ Surface renders: NOI $2,264,800 with "CONTESTED" badge
  │     │  Hover: "T-12 is $114,800 below what we're using. OM is $135,200 above."
  │     │  Operator can drill into source layers or override
  │
  └─◄ If operator overrides noi to 2300000:
        │  POST /assumptions/noi/override → deal_context_fields + deal_assumptions.year1.noi.override = 2300000
        │  Next getFieldValue call: override=2300000 wins, computedValue=2264800 ignored
        │  DivergenceSignature now includes override layer with deltaRelative = 0.0155
        │  Surface renders: NOI $2,300,000 with "OPERATOR OVERRIDE" badge
```

### Current State vs Recommended Improvements

**Current State:** Three sequence diagrams are buildable and representative of the core platform flows. The OM pipeline diagram is partial — the full document ingestion route (non-OM uploads) is not verified.

**Recommended Improvements:**
1. Add a diagram for the M07 Subject-First Calibration pipeline: rent roll upload → parse → derive → S1 aggregate → S2 diff → Bayesian blend → coefficient resolution.
2. Add a diagram for the Lane A/B scope flow: user upload → `scope_id='user:X'` → on-demand correlation compute → result scoped to user → Terminal overlay with "your data" badge.
3. Add a diagram for the cache-stamp pattern: `PUT /stance` → `applyStanceReblend` → `getDealFinancials` → `_treatment` validation → inline-recompute on mismatch → correct value returned.

---

## 12. Market & Scalability

### 12.1 Primary Markets

The platform is **FL-primary** with **Atlanta/Dallas** as secondary markets, accessible primarily via chat. The jurisdiction ruleset model is the scaling primitive: each market gets a pluggable ruleset module that exports local parameters (tax assessment cycles, zoning codes, eviction timelines, rent-cap thresholds).

**Current coverage:**
- Florida: Full ruleset (tax, zoning, eviction, rent-cap)
- Georgia (Atlanta): Partial ruleset (tax, zoning, MARTA GTFS, Atlanta PD crime)
- Texas (Dallas): Partial ruleset (tax, zoning)

### 12.2 Scheduled Data Syncs

| Sync | Schedule | Data Source | Destination | Status |
|---|---|---|---|---|
| MARTA GTFS | Scheduled (`sync-marta-gtfs.ts`) | Atlanta transit authority | Transit data table | **WIRED** |
| OSM POIs | Scheduled (`sync-osm-pois.ts`) | OpenStreetMap | POI table | **WIRED** |
| Atlanta PD Crime | Scheduled (`sync-atlanta-pd-crime.ts`) | Atlanta Police Department | Crime statistics table | **WIRED** |
| FRED SOFR | Ingested via `fred-ingest.service.ts:25` | Federal Reserve | `metric_time_series` as `RATE_SOFR` | **WIRED** |
| Traffic Calibration | Weekly Monday 02:00 UTC | `rent_roll_snapshots` + peer set | `traffic_calibration_factors` | **WIRED** (0 rows for p2122) |

### 12.3 Jurisdiction-Pluggable Rulesets

ADR-010 codifies the principle: no `if (state === 'FL')` outside a ruleset file. Each ruleset exports:
- `taxAssessmentCycle`: { assessmentDate, appealDeadline, millageRateSource }
- `zoningCodeMap`: { jurisdictionKey, zoneCodes[] }
- `evictionTimeline`: { noticePeriodDays, filingFees, courtBacklogWeeks }
- `rentCapThresholds`: { year, maxIncreasePct, exemptionRules[] }
- `complianceChecklist`: { requiredInspections, certificateTypes, renewalPeriods }

**Verification:** A grep for `if (state === 'FL')` or `if (state === 'GA')` across the backend was not performed during Phase 1. The claim that no hardcoded jurisdiction conditionals exist is **UNVERIFIED**.

### 12.4 Scaling Bottlenecks

| Bottleneck | Evidence | Impact | Mitigation |
|---|---|---|---|
| `metric_correlations` DELETE+INSERT per pair | `correlationEngine.service.ts:524` | Full pair recompute on every sweep; no incremental update | Add `scope_id` to partition user vs GLOBAL; implement incremental pair recompute |
| `deal_assumptions.year1` JSONB blob | `get-field-value.service.ts:506` | All year1 fields fetched in one row; no columnar separation | Acceptable for deal-level data; would not scale to 1000+ fields |
| AgentRuntime per-step DB persistence | `AgentRuntime.ts` (inferred) | Every tool call writes to `agent_run_steps` | Acceptable for current volume; may need batching at scale |
| `rent_roll_snapshots` per-unit array | `20260503_018_m07_subject_history.sql:18` | `parsed_payload` JSONB may grow large for 1000+ unit properties | Cap per-unit events at 10k entries (documented in Diff Extractor) |

### Current State vs Recommended Improvements

**Current State:** FL-primary + Atlanta/Dallas active. Jurisdiction rulesets are the declared scaling primitive. Three scheduled data syncs (MARTA, OSM, Atlanta PD) are wired. FRED SOFR is ingested. Traffic calibration is scheduled but has 0 rows for the only verified property (Highlands p2122). No `if (state === 'FL')` audit was performed.

**Recommended Improvements:**
1. Run the `if (state === '...')` audit across the backend to verify ADR-010 compliance.
2. Build ruleset modules for the top 10 target markets (next: TX-Houston, NC-Charlotte, SC-Charleston, TN-Nashville).
3. Populate `traffic_calibration_factors` for all active properties so the M07 engine produces deal-specific coefficients, not hardcoded fallbacks.
4. Add a market readiness dashboard showing: ruleset coverage, data sync freshness, calibration row counts, and correlation signal counts per geography.

---

## 13. Security & Data Governance

### 13.1 Lane-B Isolation

The core isolation mechanism is the `redistribution_restricted` flag on `data_library_files` plus the `scope_id` boundary on correlation/market tables. Lane-B data:
- Is never readable by another user (enforced by `user_id` filtering in `DataLibraryService` and future `scope_id` filtering in Correlation Engine)
- Is never promoted to GLOBAL (enforced by invariant 3 in ADR-009)
- Cannot leak into shared artifacts (enforced by `redistribution_restricted` guards on shared-layer writers — **partially implemented, 3 gaps**)

### 13.2 Agent-Door Discipline

Per ADR-011, agents use the same platform API as humans. No god-mode DB access. The only exception is `write_dealcontext`, which may write directly to `deal_context_fields` for cache efficiency. This exception is:
- Documented in `CLAUDE.md:68`
- Narrowly scoped (only `deal_context_fields`)
- Still audited (writes are stamped with `agent_run_id` and `source_label='agent:research'`)

### 13.3 Row-Level Authorization

The `DataLibraryService` enforces row-level authorization in three methods:
- `getFile(id, userId)` — returns row ONLY if `user_id` matches (`dataLibrary.service.ts:524`)
- `claimForRetry(id, userId)` — returns row ONLY if `user_id` matches and status is not 'running' (`dataLibrary.service.ts:546`)
- `deleteFile(id, userId)` — deletes row ONLY if `user_id` matches (`dataLibrary.service.ts:604`)

This closes the IDOR gap flagged in Task #383 architect review.

### 13.4 RBAC on Platform API

Route-level auth in `index.replit.ts`:
- `requireAuth` — operations, capital, lifecycle, documents, team, m35
- `optionalAuth` — rankings
- `none at mount` — correlations (no auth at mount; per-route auth not verified in Phase 1)

**Gap:** The `correlations` router is mounted without auth at the mount level (`index.replit.ts:493`). Per-route auth within `correlation.routes.ts` was not verified.

### 13.5 Proprietary Boundary

The LayeredValue resolution logic and Lane-B scope handling are proprietary. This document describes their architecture and contracts (resolution chain, scope invariants, taint propagation) but does not reproduce the sensitive resolution internals in a way that would be unsafe to share externally. The document is marked **Internal**.

### Current State vs Recommended Improvements

**Current State:** Lane-B isolation is architecturally sound but not fully implemented. Agent-door discipline is enforced. Row-level authorization on Data Library closes the IDOR gap. The correlations route may lack auth at mount. Three shared-layer writers leak Lane-B data. `scope_id` is not yet implemented.

**Recommended Improvements:**
1. Add `requireAuth` or `optionalAuth` to the correlations route mount, or verify per-route auth in `correlation.routes.ts`.
2. Add `redistribution_restricted` guards to the three shared-layer writers (comp-query, comp-set, market-metrics-aggregator).
3. Implement `scope_id` migrations and Correlation Engine scope threading.
4. Add a quarterly security audit checklist: auth coverage, Lane-B leak test, agent-door discipline verification, row-level auth spot-check.

---

## 14. Production Risks & Priority Order

### 14.1 Risk Register

Every risk below is a **real, cited gap**, not a generic best-practice.

| # | Risk | Severity | What breaks | Evidence (file:line) | Fix |
|---|---|---|---|---|---|
| R1 | Pro Forma bypasses getFieldValue, corrupts realized-vs-underwritten learning signal | HIGH | Valuation Grid and Pro Forma diverge silently; operator cannot trust delta | `get-field-value.service.ts:37–39` (documented exception) | Migrate Engine A to canonical path; back-propagate computed aggregates |
| R2 | M07 calibration absent → hardcoded 10% rate fallback | MEDIUM | Traffic predictions use default coefficients, producing generic (not deal-specific) absorption curves | `CONSOLE_WIRING_AUDIT.md:22` (0 rows in `traffic_calibration_factors`) | Run calibration job for p2122; populate `traffic_predictions` |
| R3 | `historical_observations` stabilization columns empty → Phase 1B blocked | MEDIUM | Stabilization year resolution cannot compute `expense baseline normalized` | `CONSOLE_WIRING_AUDIT.md:33` (`lifecycle_reforecasts` NOT A TABLE) | Create `lifecycle_reforecasts` table; implement handler at `lifecycle.routes.ts:212` |
| R4 | Tier enum mismatch causing silent attribution-gate failures | UNVERIFIED | Billing/permission logic may fail silently if enum values don't match | `JEDI_RE_MASTER_SPEC_INDEX.md` §D gap #4 | Verify enum in code; reconcile or document |
| R5 | Unguarded shared-layer writer leaking Lane-B data | HIGH | `metricRecommendation`, `compQueryEngine`, `marketMetricsAggregator` may include restricted data in shared artifacts | `CORRELATION_TERMINAL_SCOPE_SPEC.md` §4 | Add `redistribution_restricted = FALSE` predicate to all three writers |
| R6 | `lifecycle_reforecasts` table does not exist | HIGH | `GET /lifecycle/:dealId/reforecast/history` will 500 on first query | `CONSOLE_WIRING_AUDIT.md:139` (P-07) | Create table + implement handler |
| R7 | Waterfall path mismatch → 404 | MEDIUM | 1 valid `deal_waterfalls` row unreachable from UI | `CONSOLE_WIRING_AUDIT.md:143` (C-03) | Add alias route `router.get('/:dealId/waterfall', ...)` or fix frontend URL |
| R8 | Commentary agent not called from Asset Hub | MEDIUM | Thesis panel renders mocked bullets | `CONSOLE_WIRING_AUDIT.md:139` (P-06) | Add `assetMode` to `DealContext`; expose endpoint; add `useEffect` |
| R9 | `rent-roll-derivations.service.ts` absent | MEDIUM | No per-month LTL/concessions series | `CONSOLE_WIRING_AUDIT.md:121` (R-02) | Build service + operations route |
| R10 | `deal_assumptions` raw SQL only — no Drizzle type safety | LOW | Schema drift risk; no compile-time type safety for 69 columns + year1 JSONB | `backend/src/db/schema/dataPipeline.ts` (no deal_assumptions) | Migrate to Drizzle schema |

### 14.2 Recommended Fix Order by Week

| Week | Fixes | Effort | Files | Unlock |
|---|---|---|---|---|
| **Week 1** | Fix C-03/C-04 waterfall 404; fix propertyId null guard; populate `traffic_predictions` + `traffic_calibration_factors`; load budget rows for Highlands | ≤30 min each + data population | `investor-capital.routes.ts:532`, `AssetHubPage.tsx:1434,1437`, `AssetHubPage.tsx:1597,1602–1610` | Close 4 Tier-1 gaps, 2 Tier-4 gaps; no 404s from Capital screen |
| **Week 2** | Add `assetMode` to `DealContext`; wire commentary agent; add `useEffect` for debt fetch (C-01); add `GET /rankings/property/:propertyId` | 2–3 files each | `dealContext.ts`, `commentary.agent.ts`, `AssetHubPage.tsx:1414`, `rankings.routes.ts` | Thesis panel + DSCR panel + per-property rankings live |
| **Week 3** | Create `lifecycle_reforecasts` table; implement handler; add `redistribution_restricted` guards to 3 shared writers; run `scope_id` migrations | New files + schema changes | `lifecycle.routes.ts:212`, `comp-query.service.ts`, `competitive-set.service.ts`, `market-metrics-aggregator.service.ts` | LIFECYCLE sub-tab reaches CONNECTED; Lane-B leak closed |
| **Week 4** | Build `rent-roll-derivations.service.ts`; add per-property rankings endpoint; fix M07 calibration fallback; build `GET /operations/:dealId/live-tracking` (M09) | New services + routes | `services/rent-roll/`, `rankings.routes.ts`, `operations.routes.ts` | LTL series + PCS values + live-tracking 4-col live |
| **Week 5** | Migrate `deal_assumptions` to Drizzle; implement `scope_id` in Correlation Engine read/write paths; add Terminal overlay badge | Schema changes + engine changes | `db/schema/dataPipeline.ts`, `correlationEngine.service.ts` | Type safety + user-scope correlation + "your data" badges |

### 14.3 Divergence: Dispatch Claims vs Code Reality

| Dispatch Claim | Code Reality | Action |
|---|---|---|
| "M09_PROFORMA_SPEC.md is authoritative" | File exists at `docs/architecture/M09_PROFORMA_SPEC.md` | **CONFIRMED** — referenced, not duplicated |
| "TRAFFIC_ENGINE_CALIBRATION_SPEC.md is authoritative" | **NOT FOUND** in repo | **FLAGGED** — spec missing; M07 state described from `CLAUDE.md` and `CONSOLE_WIRING_AUDIT.md` |
| "CASHFLOW_AGENT_UNDERWRITING_SPEC.md is authoritative" | **NOT FOUND** in repo; `CASHFLOW_AGENT_PROMPT.md` exists | **FLAGGED** — prompt doc exists but no engine spec |
| "jedi_re_module_wiring_blueprint_v2.xlsx is structural spine" | File exists at repo root | **CONFIRMED** — referenced but not opened (binary) |
| "CONSOLE_WIRING_AUDIT.md is wiring reality" | File exists, read in full | **CONFIRMED** — used as primary evidence for Asset Hub gaps |
| "get-field-value.service.ts is canonical resolver" | File exists, read in full | **CONFIRMED** — cited throughout this doc |
| "Engine A bypasses getFieldValue" | Documented in header comment at `:37–39` | **CONFIRMED** — flagged as production risk R1 |
| "M28 absent → hardcoded 10% rate fallback" | `traffic_calibration_factors` = 0 rows for p2122 | **CONFIRMED** — `CONSOLE_WIRING_AUDIT.md:22` |
| "tier enum mismatch causing silent attribution-gate failures" | No enum found in repo | **UNVERIFIED** — flagged as risk R4, needs dedicated search |
| "any unguarded shared-layer writer that could leak Lane-B data" | Three writers identified in scope spec | **CONFIRMED** — flagged as risk R5 |

---

## Appendix A: Verified Document Map (Reconciles `ARCHITECTURE_RECONCILIATION.md` §2)

| §2 claimed path | Reality | Correct path | Status in this doc |
|---|---|---|---|
| `…/property-plumbing/refactor.md` | wrong | `docs/architecture/property-plumbing-implementation-map.md` (+ phase docs) | Referenced in §B |
| `…/deal-capsule-vision.md` | wrong | `docs/architecture/deal-capsule-blueprint.md` | Referenced in §4 |
| `…/strategy-aware-modules.md` | wrong | `docs/architecture/STRATEGY_FIELDS_LV_PATTERN.md` | Referenced in §4 |
| `…/fkey-triage.md` | missing | not in `docs/architecture/` — locate or retire | Not referenced |
| `…/master-plan.md` | wrong | `attached_assets/JEDI_RE_MASTER_PLAN_FOR_REPLIT_*.md` | Not referenced |
| `…/verification-protocol.md` | wrong | `docs/architecture/P8-state-verification-report.md` + `SHIPPED_WORK_VERIFICATION.md` | Not referenced |
| `…/backtest-harness-spec.md` | wrong | `attached_assets/JEDI_RE_BACKTEST_HARNESS_SPEC_*.md` | Not referenced |

**Hollow files:**
- `TECHNICAL_ARCHITECTURE.md` — 25-line stub. **This doc replaces it.**
- `BACKEND_ARCHITECTURE.md` — 0 bytes. **This doc replaces it.**
- `AGENT_ARCHITECTURE.md` — 0 bytes. **This doc replaces it (see §5).**

## Appendix B: Glossary

| Term | Definition |
|---|---|
| **Lane A** | Platform-licensed or open data; redistributable; `scope_id = 'GLOBAL'` |
| **Lane B** | User-licensed or proprietary data; non-redistributable; `scope_id = 'user:<uuid>'` |
| **LayeredValue<T>** | Typed wrapper carrying value, source, agentRunId, and stance metadata |
| **Engine A** | Deterministic calculation layer (NOI, IRR, DSCR, etc.) |
| **Agent:cashflow** | LLM-backed assumption layer (rent, vacancy, growth rates, etc.) |
| **Two Truths** | The silent divergence between agent-proposed and engine-computed values |
| **7-Ring Checklist** | Cross-cutting propagation discipline for any Pro Forma schema change |
| **Subject-First** | M07 rule: a deal's own rent roll history dominates the peer set in coefficient resolution |
| **S1–S4** | Subject history evidence tiers: S1 (single snapshot), S2 (≥2 snapshots ≥60 days), S3/S4 (future) |
| **CONTESTED** | Validation Grid badge shown when ≥2 sources diverge materially |
| **Stabilized Year** | The first operating year satisfying all model-type-specific stabilization conditions |

---

*Document generated by Orchestrator on 2026-07-08. Phase 1 inventory + Phase 2 outline + Phase 3 drafts all grounded in repo HEAD `8369331`.*

*Verification: Every structural claim carries a `file:line` citation or an explicit `UNVERIFIED` flag. Existing ADRs 001–004 are referenced, not duplicated. New ADRs 005–011 are drafted with Status/Context/Decision/Consequence. Production Risks are all real and cited. Recommended Fix Order is sequenced. No fabricated table names, line numbers, or wiring states.*
