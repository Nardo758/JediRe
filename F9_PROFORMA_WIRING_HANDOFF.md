# Replit Agent — Implementation Prompt: F9 ProForma Data Flow Wiring

## Context

You are wiring the M09 ProForma module so that the F9 ProForma tab renders live data from the existing backend services instead of the three mock files currently intercepting the data path. This is the single biggest unblocker on the critical path — five downstream modules (M01 Overview, M10 Scenario, M11 Debt, M12 Exit, M14 Risk) currently render zeros or mocks because M09 has no live frontend client and an unresolved circular dependency with M11.

**Authoritative reference documents (read in full before writing any code):**

1. **`CLAUDE.md`** — The single biggest blocker is identified explicitly: *"ProForma hardcodes `irr=15` because it has zero debt service input."* The Mock File table lists the three files to remove. The Wiring Sequence at the end of the file is the priority order.
2. **`CASHFLOW_AGENT_UNDERWRITING_SPEC.md`** — Authoritative for the per-field UX contract (source badges, evidence panel, collision reports, Reasoning Walkthrough). This is what the F9 tab is building toward.
3. **`AGENT_PLATFORM_SPEC.md`** — Authoritative for the `LayeredValue<T>` extension already drafted. Do not redefine the type — extend it.
4. **`jedi_re_module_wiring_blueprint.xlsx`** — Sheet 2 (Data Flow Matrix) defines exactly which modules feed M09. Sheet 5 (Wireframe Specs) row M09 defines what F9 displays. Sheet 7 row P1-1 is this exact task.
5. **`FEATURE_EXPANSION.md`** — F6 PROFORMA (M09) section enumerates the five P0/P1 features. M09↔M11 circular dependency resolution is P0.

**All five documents are in the project knowledge / repo root. Do not start implementation until you have read all five end-to-end.**

---

## Ground Rules (Non-Negotiable)

These are architectural constraints. Do not violate them without explicit written approval from Leon:

1. **Do not redefine `LayeredValue<T>`.** It exists at `src/types/layered-value.ts` per `AGENT_PLATFORM_SPEC.md`. Extend the source enum and the `agent_run_id` field. Do not create a parallel `LayeredFinancialValue` or `ProFormaValue` wrapper.

2. **Do not write a new ProForma engine.** The backend service exists at `backend/src/services/proforma-adjustment.service.ts` (1,110 lines) and is mounted at `/api/v1/proforma/:dealId`. Your job is to add the typed frontend client, not to reimplement the math.

3. **Do not write a new Capital Structure engine.** It exists at `backend/src/services/capital-structure-adapter.ts` (476 lines) and `capital-structure.service.ts` (742 lines). The M09↔M11 circular dependency is resolved by event ordering through the existing Kafka producer — wire the events, don't reimplement the resolver.

4. **Do not delete the mock files.** Mark them as deprecated by renaming to `*.mock.deprecated.ts` and updating the import path comment. The 25-file mock dam needs a paper trail per CLAUDE.md. Deletion happens after one full sprint of green production.

5. **dealStore is the message bus.** No direct imports between F9 sub-tabs. All cross-tab updates flow through `dealStore.ts`. The store is the single source of truth — see `userMemories` build principles.

6. **Bloomberg Terminal design tokens only.** Use the `T` token system (exact hex values per `CLAUDE.md` Design System block). JetBrains Mono primary, IBM Plex Sans secondary, max 2px border radius, no shadows, no gradients, min 9px font size. No Tailwind color classes.

7. **Detection before scoring.** The proforma variant (Existing / Value-Add / Lease-Up / Development / Redevelopment) is selected by `resolveProjectType(deal)` before any assumption derivation runs. Do not hardcode a variant.

8. **JSX rendering rules.** Space required after every `return` before JSX. No `React.Fragment` with keys inside CSS grids. No IIFE patterns inside JSX. Named function components with explicit returns and pre-computed variables outside the JSX tree. `return<JSX>` without space causes `returnReact is not defined` and will be flagged in review.

---

## Files to Create

```
frontend/src/
├── types/
│   ├── proforma.types.ts                  # NEW — ProForma, Assumptions, Evidence
│   ├── capital-structure.types.ts         # NEW — DebtTerms, DebtSchedule, CapStack
│   └── layered-value.ts                   # MODIFY — extend source enum
├── lib/
│   └── api.client.ts                      # MODIFY — add proforma + capitalStructure blocks
├── stores/
│   └── dealStore.ts                       # MODIFY — add proforma slice + event subscriptions
├── components/
│   ├── primitives/
│   │   ├── SourceBadge.tsx                # NEW (or extend existing per agent spec)
│   │   ├── ConfidenceBadge.tsx            # NEW
│   │   └── EvidencePanel.tsx              # NEW — side panel on field click
│   └── deal/financial/
│       ├── ProFormaTab.tsx                # MODIFY — replace mock import
│       ├── AssumptionsTab.tsx             # MODIFY — replace mock import
│       ├── DebtTab.tsx                    # MODIFY — replace mock import
│       └── CollisionCounter.tsx           # NEW — header summary widget
└── data/
    ├── enhancedProFormaMockData.mock.deprecated.ts   # RENAME (was enhancedProFormaMockData.ts)
    ├── capitalStructureMockData.mock.deprecated.ts   # RENAME
    └── debtMockData.mock.deprecated.ts               # RENAME

backend/src/
├── routes/
│   └── proforma.routes.ts                 # VERIFY — endpoints below are mounted
└── services/kafka/
    └── consumers/proforma-consumer.ts     # MODIFY — close the M09↔M11 loop
```

---

## Type Definitions

### `frontend/src/types/layered-value.ts` (MODIFY — extend existing)

```typescript
// EXISTING file. Extend the source enum and add evidence wrapper.
// Per AGENT_PLATFORM_SPEC.md, agent:* sources are already added.
// This task adds the financial-specific tier sources from CASHFLOW_AGENT_UNDERWRITING_SPEC.md.

export type LayeredValueSource =
  | 'platform'              // default/fallback values (Tier 3 generic)
  | 't12'                   // Tier 1 — uploaded T12 operating statement
  | 'rent_roll'             // Tier 1 — uploaded rent roll
  | 'tax_bill'              // Tier 1 — uploaded tax bill
  | 'tier2:owned_asset'     // Tier 2 — user's portfolio actuals (NEW)
  | 'tier3:platform'        // Tier 3 — platform market intelligence (NEW)
  | 'tier4:broker'          // Tier 4 — broker OM (reference only, NEW)
  | 'override'              // user edit
  | 'agent:research'
  | 'agent:zoning'
  | 'agent:supply'
  | 'agent:cashflow'
  | 'agent:commentary';

export interface LayeredValue<T> {
  value: T;
  source: LayeredValueSource;
  agent_run_id?: string;
  set_at: string;
  set_by?: string;
  confidence?: 'high' | 'medium' | 'low';
  evidence?: Evidence;        // NEW — populated when source starts with 'agent:' or 'tier'
}

export interface Evidence {
  primary_tier: 1 | 2 | 3;
  data_points: EvidencePoint[];
  reasoning: string;                          // plain-English narrative, 3-5 sentences
  alternatives_considered: Alternative[];
  collision?: CollisionReport;                // populated when broker value diverges
}

export interface EvidencePoint {
  source_type: 't12' | 'rent_roll' | 'tax_bill' | 'owned_asset' | 'submarket_ttm' | 'comp' | 'archive';
  source_id: string;                          // e.g. 'asset:westshore-park-200', 'submarket:tampa-westshore'
  source_label: string;                       // human-readable for the evidence panel
  value: number | string;
  as_of: string;                              // ISO date
  weight: number;                             // 0-1, sums to 1.0 across all data_points
}

export interface Alternative {
  candidate_value: number | string;
  rationale: string;
  rejected_because: string;
}

export interface CollisionReport {
  broker_value: number | string;
  agent_value: number | string;
  delta_pct: number;
  delta_magnitude_usd?: number;               // for fields with monetary impact
  severity: 'minor' | 'material' | 'severe';
  narrative: string;                          // plain-English explanation
}
```

### `frontend/src/types/proforma.types.ts` (NEW)

```typescript
import { LayeredValue } from './layered-value';

export type ProjectType = 'existing' | 'value_add' | 'lease_up' | 'development' | 'redevelopment';
export type AssetClass = 'multifamily' | 'sfr' | 'retail' | 'office' | 'industrial' | 'hospitality';

// ──────────────────────────────────────────────────────────────────
// Top-level ProForma — what /api/v1/proforma/:dealId returns
// ──────────────────────────────────────────────────────────────────

export interface ProForma {
  deal_id: string;
  project_type: ProjectType;
  asset_class: AssetClass;
  hold_years: number;
  as_of: string;                              // ISO timestamp
  agent_run_id?: string;                      // populated when CashFlow Agent generated this run

  assumptions: ProFormaAssumptions;
  computed: ProFormaComputed;
  summary: ProFormaSummary;

  // Deal-level metadata for the F9 header per CASHFLOW_AGENT_UNDERWRITING_SPEC
  collision_count: { minor: number; material: number; severe: number };
  confidence_distribution: { high: number; medium: number; low: number };
  tier_distribution: { tier1: number; tier2: number; tier3: number };
  archive_percentile?: number;                // 0-100, conservativeness vs platform archive
}

// ──────────────────────────────────────────────────────────────────
// Assumptions — every mutable field is a LayeredValue<T>
// ──────────────────────────────────────────────────────────────────

export interface ProFormaAssumptions {
  // Property & acquisition
  units: LayeredValue<number>;
  avg_rent_per_unit: LayeredValue<number>;
  purchase_price: LayeredValue<number>;
  closing_cost_pct: LayeredValue<number>;

  // Revenue
  rent_growth_y1: LayeredValue<number>;
  rent_growth_terminal: LayeredValue<number>;
  vacancy_baseline: LayeredValue<number>;
  vacancy_ramp: LayeredValue<number[]>;       // per-year vacancy when applicable
  other_income_per_unit: LayeredValue<number>;
  concessions_pct: LayeredValue<number>;
  bad_debt_pct: LayeredValue<number>;

  // Operating expenses
  opex_per_unit: LayeredValue<number>;
  opex_growth: LayeredValue<number>;
  property_tax: LayeredValue<number>;         // jurisdiction-aware via tax math service (Task 6.5)
  insurance: LayeredValue<number>;            // jurisdiction-aware via insurance service (Task 6.10)
  management_fee_pct: LayeredValue<number>;
  capex_reserve_per_unit: LayeredValue<number>;

  // Disposition
  exit_cap_rate: LayeredValue<number>;
  selling_cost_pct: LayeredValue<number>;
  hold_years: LayeredValue<number>;

  // Variant-specific (populated only when project_type matches)
  value_add?: ValueAddAssumptions;
  lease_up?: LeaseUpAssumptions;
  development?: DevelopmentAssumptions;
  redevelopment?: RedevelopmentAssumptions;
}

export interface ValueAddAssumptions {
  reno_units_per_month: LayeredValue<number>;
  reno_cost_per_unit: LayeredValue<number>;
  rent_premium_per_unit: LayeredValue<number>;
  premium_ramp_months: LayeredValue<number>;
}

export interface LeaseUpAssumptions {
  absorption_curve_24mo: LayeredValue<number[]>;   // from M07 Traffic Engine per TRAFFIC_ENGINE_CALIBRATION_SPEC.md §4.4
  pre_leased_units: LayeredValue<number>;
  stabilized_occupancy: LayeredValue<number>;
  tco_date: LayeredValue<string>;
}

export interface DevelopmentAssumptions {
  hard_costs_psf: LayeredValue<number>;
  soft_costs_pct: LayeredValue<number>;
  contingency_pct: LayeredValue<number>;
  construction_months: LayeredValue<number>;
  land_basis: LayeredValue<number>;
}

export interface RedevelopmentAssumptions {
  units_under_reno: LayeredValue<number>;
  reno_phases: LayeredValue<number>;
  partial_t12_units: LayeredValue<number>;
}

// ──────────────────────────────────────────────────────────────────
// Computed — read-only outputs from the engine
// ──────────────────────────────────────────────────────────────────

export interface ProFormaComputed {
  annual: AnnualLine[];                       // length === hold_years + 1 (year 0 + N hold years)
  monthly?: MonthlyLine[];                    // populated only for Year 1 + on-demand
  returns: ReturnsBlock;
  metrics: MetricsBlock;
  sources_uses: SourcesAndUses;
}

export interface AnnualLine {
  year: number;                               // 0 = closing year
  // Revenue
  gpr: number;                                // Gross Potential Rent
  vacancy_loss: number;
  concessions: number;
  bad_debt: number;
  other_income: number;
  egi: number;                                // Effective Gross Income
  // Expenses
  property_tax: number;
  insurance: number;
  management: number;
  utilities: number;
  repairs_maintenance: number;
  payroll: number;
  marketing: number;
  general_admin: number;
  other_opex: number;
  total_opex: number;
  // NOI & below
  noi: number;
  capex_reserve: number;
  noi_after_reserves: number;
  debt_service: number;                       // SOURCED FROM M11 — see Backend Wiring
  cash_flow: number;
  // Metrics on this row
  dscr: number;
  occupancy: number;
  expense_ratio: number;
}

export interface MonthlyLine {
  year: number;
  month: number;
  // Same structure as AnnualLine, monthly granularity
  // (define equivalent fields — abbreviated here for spec brevity)
  noi: number;
  debt_service: number;
  cash_flow: number;
  occupancy: number;
}

export interface ReturnsBlock {
  irr: number;                                // F19 — formerly hardcoded to 15
  equity_multiple: number;                    // F20
  cash_on_cash_y1: number;                    // F18
  cash_on_cash_avg: number;
  yield_on_cost: number;                      // F25 — BTS variant
  total_distributions: number;
  total_equity_invested: number;
  exit_proceeds: number;
}

export interface MetricsBlock {
  going_in_cap_rate: number;                  // F17
  exit_cap_rate: number;
  noi_yr1: number;
  noi_stabilized: number;
  debt_yield: number;                         // F22
  ltv: number;
  ltc: number;
  break_even_occupancy: number;
}

export interface SourcesAndUses {
  sources: { senior_debt: number; mezz_debt: number; lp_equity: number; gp_equity: number; preferred_equity?: number };
  uses: { purchase_price: number; closing_costs: number; reno_budget?: number; dev_budget?: number; reserves: number; financing_fees: number };
}

// ──────────────────────────────────────────────────────────────────
// Summary — top-line values for screening (the F9 Pro Forma tab summary)
// ──────────────────────────────────────────────────────────────────

export interface ProFormaSummary {
  irr: number;
  equity_multiple: number;
  cash_on_cash_y1: number;
  going_in_cap_rate: number;
  noi_yr1: number;
  dscr_yr1: number;
  total_equity: number;
  exit_value: number;
}

// ──────────────────────────────────────────────────────────────────
// Update payload — what the frontend sends to /api/v1/proforma/:dealId
// ──────────────────────────────────────────────────────────────────

export type AssumptionPath =
  | `assumptions.${keyof ProFormaAssumptions}`
  | `assumptions.value_add.${keyof ValueAddAssumptions}`
  | `assumptions.lease_up.${keyof LeaseUpAssumptions}`
  | `assumptions.development.${keyof DevelopmentAssumptions}`
  | `assumptions.redevelopment.${keyof RedevelopmentAssumptions}`;

export interface ProFormaUpdate {
  deal_id: string;
  changes: Array<{
    path: AssumptionPath;
    value: number | string | number[];
    source: 'override';
    reason?: string;
  }>;
}

export interface OverridePayload {
  field_path: AssumptionPath;
  value: number | string | number[];
  reason?: string;
}

// ──────────────────────────────────────────────────────────────────
// Scenarios — feeds the F9 Sensitivity & Decision tabs
// ──────────────────────────────────────────────────────────────────

export interface ScenarioBundle {
  base: ProFormaSummary;
  bull: ProFormaSummary;
  bear: ProFormaSummary;
  stress: ProFormaSummary;
  probabilities: { bull: number; base: number; bear: number; stress: number };
  expected_irr: number;                       // F31 — probability-weighted
  expected_equity_multiple: number;
}
```

### `frontend/src/types/capital-structure.types.ts` (NEW)

```typescript
import { LayeredValue } from './layered-value';

export interface CapitalStructure {
  deal_id: string;
  active_loan_id: string;
  loans: LoanOption[];
  equity: EquityStructure;
  computed: CapitalStructureComputed;
  as_of: string;
}

export interface LoanOption {
  id: string;
  lender_name: string;
  loan_type: 'permanent' | 'bridge' | 'construction' | 'agency';
  principal: LayeredValue<number>;
  interest_rate: LayeredValue<number>;        // can be from rate-index.service.ts feed
  amortization_years: LayeredValue<number>;
  term_years: LayeredValue<number>;
  io_period_months: LayeredValue<number>;
  rate_type: 'fixed' | 'floating';
  spread_bps?: LayeredValue<number>;          // floating only
  index?: 'sofr' | 'treasury' | 'prime';
  origination_fee_pct: LayeredValue<number>;
  exit_fee_pct: LayeredValue<number>;
}

export interface EquityStructure {
  lp_equity: LayeredValue<number>;
  gp_equity: LayeredValue<number>;
  pref_return: LayeredValue<number>;
  promote_tiers: PromoteTier[];
}

export interface PromoteTier {
  irr_hurdle: number;
  lp_split: number;
  gp_split: number;
}

export interface CapitalStructureComputed {
  ltv: number;
  ltc: number;
  dscr_yr1: number;                           // F21
  debt_yield: number;                         // F22
  annual_debt_service_yr1: number;            // ← THIS is what M09 needs
  amortization_schedule: AmortRow[];
  rate_sensitivity: RateSensitivityCell[];
}

export interface AmortRow {
  year: number;
  month: number;
  beginning_balance: number;
  interest: number;
  principal: number;
  payment: number;
  ending_balance: number;
  is_io: boolean;
}

export interface RateSensitivityCell {
  rate_delta_bps: number;                     // -200 to +200 in 25bps steps
  dscr: number;
  payment: number;
  ltv: number;
}
```

---

## `api.client.ts` Additions

### Block to add at `frontend/src/lib/api.client.ts`

```typescript
import type {
  ProForma,
  ProFormaUpdate,
  OverridePayload,
  ScenarioBundle,
  AssumptionPath,
} from '@/types/proforma.types';
import type { CapitalStructure, LoanOption } from '@/types/capital-structure.types';
import type { LayeredValue, Evidence } from '@/types/layered-value';

// ──────────────────────────────────────────────────────────────────
// ProForma API — backed by /api/v1/proforma/:dealId
// Service: proforma-adjustment.service.ts (1,110 lines)
// ──────────────────────────────────────────────────────────────────

export const proformaApi = {
  /**
   * Fetch the current ProForma for a deal. Returns the full assumptions +
   * computed projections + summary metrics. Backed by 24h DealContext cache;
   * cuts credit cost 60-70% on re-runs.
   */
  get: (dealId: string): Promise<ProForma> =>
    request(`/api/v1/proforma/${dealId}`),

  /**
   * Apply a batch of assumption changes. Each change is recorded as a
   * LayeredValue with source='override' and triggers a recompute. The
   * response is the recomputed ProForma. The changes are also published
   * to the Kafka 'proforma.assumptions.updated' topic, which M11 consumes
   * to resize the loan if DSCR sizing is enabled.
   */
  update: (payload: ProFormaUpdate): Promise<ProForma> =>
    request(`/api/v1/proforma/${payload.deal_id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  /**
   * Override a single field. Sets the LayeredValue source to 'override'
   * and persists with optional reason for audit_log. Returns the new
   * LayeredValue (not a full ProForma — caller must refetch if computed
   * fields are needed). User overrides survive path switches per the
   * LayeredValue<T> design.
   */
  override: (dealId: string, payload: OverridePayload): Promise<LayeredValue<unknown>> =>
    request(`/api/v1/proforma/${dealId}/override`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /**
   * Revert an override back to the underlying agent/platform value.
   * The override row is preserved in audit_log but no longer the active
   * value. Returns the resolved LayeredValue post-revert.
   */
  revertOverride: (dealId: string, fieldPath: AssumptionPath): Promise<LayeredValue<unknown>> =>
    request(`/api/v1/proforma/${dealId}/override/${encodeURIComponent(fieldPath)}`, {
      method: 'DELETE',
    }),

  /**
   * Fetch the Bull/Base/Bear/Stress scenario bundle. Backed by
   * scenario-generation.service.ts. Probabilities default to
   * Bull=20% / Base=50% / Bear=25% / Stress=5% per F31.
   */
  scenarios: (dealId: string): Promise<ScenarioBundle> =>
    request(`/api/v1/proforma/${dealId}/scenarios`),

  /**
   * Fetch the full Evidence object for a single field. Drives the
   * Evidence side panel per CASHFLOW_AGENT_UNDERWRITING_SPEC §
   * "Evidence panel (per-field drill-down)".
   */
  evidence: (dealId: string, fieldPath: AssumptionPath): Promise<Evidence> =>
    request(`/api/v1/proforma/${dealId}/evidence/${encodeURIComponent(fieldPath)}`),

  /**
   * Trigger a CashFlow Agent run to (re)derive assumptions. Async;
   * returns an agent_run_id to poll. Only available on Operator+ tiers.
   * Blocked by per-deal-per-day budget cap in BudgetEnforcer.
   */
  underwrite: (dealId: string): Promise<{ agent_run_id: string; status: 'running' }> =>
    request(`/api/agents/cashflow/underwrite`, {
      method: 'POST',
      body: JSON.stringify({ deal_id: dealId, trigger: 'user' }),
    }),

  /**
   * Long-form narrative summary written by the Commentary Agent at the
   * end of a CashFlow run. Drives the F9 "Reasoning Walkthrough" sub-tab.
   */
  walkthrough: (dealId: string, focus?: string): Promise<{ narrative: string; agent_run_id: string }> =>
    request(`/api/deals/${dealId}/underwriting/walkthrough`, {
      method: 'POST',
      body: JSON.stringify({ focus }),
    }),

  /**
   * Generate a fresh .xlsx workbook using excel-export.service.ts.
   * Returns a signed download URL. Workbook is institutional-grade with
   * formulas, blue-input/black-formula color coding, multi-sheet
   * (Summary / Assumptions / Pro Forma / Debt / Sensitivity / Waterfall).
   */
  exportExcel: (dealId: string): Promise<{ download_url: string; expires_at: string }> =>
    request(`/api/v1/proforma/${dealId}/export/excel`, { method: 'POST' }),
};

// ──────────────────────────────────────────────────────────────────
// Capital Structure API — backed by /api/v1/capital-structure/:dealId
// Service: capital-structure.service.ts (742 lines) +
//          capital-structure-adapter.ts (476 lines)
// ──────────────────────────────────────────────────────────────────

export const capitalStructureApi = {
  get: (dealId: string): Promise<CapitalStructure> =>
    request(`/api/v1/capital-structure/${dealId}`),

  /**
   * Switch the active loan. Triggers a recompute of debt service and
   * publishes 'capital_structure.debt_service.updated' to Kafka, which
   * M09 consumes to refinalize CF/IRR/CoC/EM. This is the second half
   * of the M09↔M11 circular dependency resolution.
   */
  setActiveLoan: (dealId: string, loanId: string): Promise<CapitalStructure> =>
    request(`/api/v1/capital-structure/${dealId}/active-loan`, {
      method: 'PATCH',
      body: JSON.stringify({ loan_id: loanId }),
    }),

  addLoan: (dealId: string, loan: Omit<LoanOption, 'id'>): Promise<CapitalStructure> =>
    request(`/api/v1/capital-structure/${dealId}/loans`, {
      method: 'POST',
      body: JSON.stringify(loan),
    }),

  updateLoan: (dealId: string, loanId: string, updates: Partial<LoanOption>): Promise<CapitalStructure> =>
    request(`/api/v1/capital-structure/${dealId}/loans/${loanId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  rateSensitivity: (dealId: string): Promise<CapitalStructure['computed']['rate_sensitivity']> =>
    request(`/api/v1/capital-structure/${dealId}/rate-sensitivity`),
};

// Existing `request()` helper assumed — preserves auth headers, retries on 5xx.
// Do NOT add a new fetch wrapper. Use the existing one.
```

---

## Backend Wiring — Closing the M09↔M11 Loop

The circular dependency is resolved by Kafka event ordering. Both services already exist; only the consumer needs to be modified to close the loop.

### Event flow

```
1. User edits a ProForma assumption (e.g. rent_growth_y1)
   └─> PATCH /api/v1/proforma/:dealId
       └─> proforma.service.update() recomputes NOI without debt service
           └─> emits 'proforma.noi.updated' to Kafka
               { deal_id, noi_yr1, noi_stabilized, agent_run_id? }

2. capital-structure-adapter consumes 'proforma.noi.updated'
   └─> if active loan has DSCR-based sizing, resize principal
       └─> recompute amortization schedule
           └─> emits 'capital_structure.debt_service.updated' to Kafka
               { deal_id, annual_debt_service_yr1, amortization_schedule }

3. proforma-consumer consumes 'capital_structure.debt_service.updated'
   └─> proforma.service.finalize() with debt_service value
       └─> compute CF, DSCR per row, IRR (F19), EM (F20), CoC (F18)
       └─> persist final ProForma + emit 'proforma.finalized'

4. Frontend dealStore subscribes to 'proforma.finalized' via WebSocket
   └─> updates the ProForma slice
       └─> all F9 sub-tabs re-render from a single store update
```

### `backend/src/services/kafka/consumers/proforma-consumer.ts` (MODIFY)

```typescript
// EXISTING file. Add the second handler that closes the loop.
// The handler for 'demand.event.classified' and 'supply.event.classified'
// already exists for F32/F33 News-Adjusted formulas — DO NOT REMOVE.

import { proformaService } from '../../proforma-adjustment.service';
import { kafkaProducer } from '../kafka-producer.service';

export const proformaConsumer = {
  topics: [
    'demand.event.classified',           // EXISTING — F33 News-Adjusted Vacancy
    'supply.event.classified',            // EXISTING — F32 News-Adjusted Rent Growth
    'capital_structure.debt_service.updated',  // NEW — closes M09↔M11 loop
  ],

  async handle(event: KafkaEvent) {
    switch (event.type) {
      case 'capital_structure.debt_service.updated': {
        const { deal_id, annual_debt_service_yr1, amortization_schedule } = event.payload;
        const finalized = await proformaService.finalize({
          deal_id,
          debt_service: annual_debt_service_yr1,
          amortization: amortization_schedule,
        });
        await kafkaProducer.emit('proforma.finalized', { deal_id, summary: finalized.summary });
        break;
      }
      // ... existing handlers
    }
  },
};
```

### `backend/src/routes/proforma.routes.ts` (VERIFY)

These endpoints must be mounted. CLAUDE.md confirms the service exists; verify the routes file points at the typed methods above. Do not stub anything that's missing — fail loudly so the gap is visible.

```
GET    /api/v1/proforma/:dealId
PATCH  /api/v1/proforma/:dealId
POST   /api/v1/proforma/:dealId/override
DELETE /api/v1/proforma/:dealId/override/:fieldPath
GET    /api/v1/proforma/:dealId/scenarios
GET    /api/v1/proforma/:dealId/evidence/:fieldPath
POST   /api/v1/proforma/:dealId/export/excel

GET    /api/v1/capital-structure/:dealId
PATCH  /api/v1/capital-structure/:dealId/active-loan
POST   /api/v1/capital-structure/:dealId/loans
PATCH  /api/v1/capital-structure/:dealId/loans/:loanId
GET    /api/v1/capital-structure/:dealId/rate-sensitivity
```

---

## dealStore Integration

The store is the single source of truth and the only message bus between F9 sub-tabs.

### `frontend/src/stores/dealStore.ts` (MODIFY — add proforma slice)

```typescript
import { proformaApi, capitalStructureApi } from '@/lib/api.client';
import type { ProForma } from '@/types/proforma.types';
import type { CapitalStructure } from '@/types/capital-structure.types';

interface ProFormaSlice {
  proforma: ProForma | null;
  capitalStructure: CapitalStructure | null;
  proformaLoading: boolean;
  proformaError: string | null;

  // Actions
  loadProForma: (dealId: string) => Promise<void>;
  updateAssumption: (dealId: string, path: AssumptionPath, value: number | string) => Promise<void>;
  overrideField: (dealId: string, path: AssumptionPath, value: number | string, reason?: string) => Promise<void>;
  revertOverride: (dealId: string, path: AssumptionPath) => Promise<void>;
  switchActiveLoan: (dealId: string, loanId: string) => Promise<void>;
  triggerUnderwrite: (dealId: string) => Promise<string>;          // returns agent_run_id

  // WebSocket subscription handler — called on 'proforma.finalized' events
  _onProFormaFinalized: (payload: { deal_id: string; summary: ProForma['summary'] }) => void;
}

export const proformaSlice: StateCreator<ProFormaSlice> = (set, get) => ({
  proforma: null,
  capitalStructure: null,
  proformaLoading: false,
  proformaError: null,

  loadProForma: async (dealId) => {
    set({ proformaLoading: true, proformaError: null });
    try {
      const [proforma, capitalStructure] = await Promise.all([
        proformaApi.get(dealId),
        capitalStructureApi.get(dealId),
      ]);
      set({ proforma, capitalStructure, proformaLoading: false });
    } catch (err) {
      set({ proformaError: (err as Error).message, proformaLoading: false });
    }
  },

  updateAssumption: async (dealId, path, value) => {
    const updated = await proformaApi.update({
      deal_id: dealId,
      changes: [{ path, value, source: 'override' }],
    });
    set({ proforma: updated });
    // M11 will react via Kafka and emit 'proforma.finalized' which _onProFormaFinalized handles
  },

  overrideField: async (dealId, path, value, reason) => {
    await proformaApi.override(dealId, { field_path: path, value, reason });
    // Refetch — single fetch is cheaper than reconciling partial updates
    await get().loadProForma(dealId);
  },

  revertOverride: async (dealId, path) => {
    await proformaApi.revertOverride(dealId, path);
    await get().loadProForma(dealId);
  },

  switchActiveLoan: async (dealId, loanId) => {
    const capitalStructure = await capitalStructureApi.setActiveLoan(dealId, loanId);
    set({ capitalStructure });
    // M09 will react via Kafka and emit 'proforma.finalized' which _onProFormaFinalized handles
  },

  triggerUnderwrite: async (dealId) => {
    const { agent_run_id } = await proformaApi.underwrite(dealId);
    return agent_run_id;
  },

  _onProFormaFinalized: ({ deal_id, summary }) => {
    const current = get().proforma;
    if (current && current.deal_id === deal_id) {
      set({ proforma: { ...current, summary } });
    }
  },
});
```

---

## Build Order — Mandatory Sequencing

Execute phases in order. Do not start a phase until the previous phase is fully merged, tested, and reviewed by Leon.

### Phase 1 — Types & API Client (no UI changes)

**Goal:** The frontend can fetch and validate ProForma + Capital Structure data, but no UI yet renders it.

**Deliverables:**

1. `frontend/src/types/layered-value.ts` — extend source enum + add `Evidence` types per spec above
2. `frontend/src/types/proforma.types.ts` — full type module per spec above
3. `frontend/src/types/capital-structure.types.ts` — full type module per spec above
4. `frontend/src/lib/api.client.ts` — add `proformaApi` and `capitalStructureApi` blocks per spec above
5. Type-only unit tests using a fixture deal: round-trip a `ProForma` object through `JSON.parse(JSON.stringify(...))` and verify TypeScript types narrow correctly

**Phase 1 Acceptance Criteria:**

- TypeScript compilation passes with `--strict` and `--noUncheckedIndexedAccess`
- All `LayeredValueSource` enum values render correctly in `SourceBadge` Storybook (or equivalent)
- Calling `proformaApi.get('test-deal-1')` against a running backend returns a valid `ProForma` (or a typed error if the deal doesn't exist)
- Calling `capitalStructureApi.get('test-deal-1')` returns a valid `CapitalStructure`
- No mock files have been touched yet — production still renders mocks

**STOP. Review checkpoint with Leon before proceeding to Phase 2.**

---

### Phase 2 — Backend Loop Closure (no UI changes)

**Goal:** The M09↔M11 circular dependency is resolved end-to-end via Kafka. IRR is no longer hardcoded. Verifiable via direct API calls without any UI involvement.

**Deliverables:**

1. `backend/src/services/kafka/consumers/proforma-consumer.ts` — add `capital_structure.debt_service.updated` handler per spec
2. Verify `backend/src/services/capital-structure-adapter.ts` emits `capital_structure.debt_service.updated` on active loan change (already exists per CLAUDE.md — confirm wiring)
3. Verify all 13 routes in the Backend Wiring section above are mounted in `proforma.routes.ts` and `capital-structure.routes.ts`. Stub none. Fail loudly on missing handlers.
4. Integration test: hit `PATCH /api/v1/proforma/:dealId` with a rent_growth_y1 change → verify `proforma.finalized` is emitted within 2 seconds → verify the resulting `ProForma.computed.returns.irr` is no longer 15 (unless the math actually computes 15)

**Phase 2 Acceptance Criteria:**

- Direct `curl` test on a seeded deal: `GET /api/v1/proforma/:dealId` returns IRR computed from real cash flows
- `PATCH` an assumption → re-fetch → IRR has changed (proves recompute fired)
- `PATCH` `/api/v1/capital-structure/:dealId/active-loan` with a different loan → re-fetch ProForma → DSCR has changed
- Kafka topic `proforma.finalized` shows entries in the broker UI (or via CLI consumer) for every PATCH
- The hardcoded `irr=15` line in the legacy code is removed; `git grep "irr.*=.*15"` returns nothing in `proforma-adjustment.service.ts`

**STOP. Review checkpoint with Leon before proceeding to Phase 3.**

---

### Phase 3 — Frontend Wiring (the visible change)

**Goal:** F9 ProForma tab renders live data from the backend. Three mock files are deprecated. Source badges appear on every assumption.

**Deliverables:**

1. `frontend/src/stores/dealStore.ts` — add ProForma slice per spec above
2. `frontend/src/data/enhancedProFormaMockData.ts` → rename to `*.mock.deprecated.ts`; same for `capitalStructureMockData.ts` and `debtMockData.ts`
3. `ProFormaTab.tsx`, `AssumptionsTab.tsx`, `DebtTab.tsx` — replace mock import with `useDealStore` selectors
4. `SourceBadge.tsx` rendered on every `LayeredValue<T>` field (one badge per assumption row)
5. `EvidencePanel.tsx` opens on field click — fetches `proformaApi.evidence(dealId, fieldPath)` lazily
6. `CollisionCounter.tsx` in the F9 tab header reads from `proforma.collision_count`
7. WebSocket subscription wired: incoming `proforma.finalized` events trigger `_onProFormaFinalized`

**Phase 3 Acceptance Criteria:**

- F9 tab on a real seeded deal renders without any mock import. `git grep -r "MockData" frontend/src/components/deal/financial/` returns no results.
- Editing an assumption in `AssumptionsTab` triggers a `PATCH` and the resulting IRR/EM/CoC values update in the F9 header within 3 seconds (round-trip Kafka)
- Switching the active loan in `DebtTab` updates DSCR in the F9 header without a page reload
- Source badges (`PLATFORM`, `T12`, `OWNED`, `MARKET`, `EDIT`, `AGENT`) render with correct colors per the T-token system
- Clicking a field opens `EvidencePanel` showing reasoning, evidence points, and alternatives considered
- The F9 header `CollisionCounter` shows accurate counts; clicking it filters the assumption list to colliding fields only
- All visual rules from the Bloomberg Terminal design system pass review (no shadows, max 2px radius, JetBrains Mono numerics, etc.)

**STOP. Review checkpoint with Leon. Phase 4 is deferrable behind feature flag if needed.**

---

### Phase 4 — Upstream Subscriptions (Optional / Sequenced)

**Goal:** M09 receives primary signals (●) from M02, M04, M05, M06, M07, M08 per the Data Flow Matrix. Each is a Zustand subscription firing `proformaApi.update()` with `source='platform'`.

This phase is sequenced behind individual upstream module readiness. Implement one subscription at a time and ship each independently.

**Subscription order (lowest risk first):**

1. **M05 Market → rent_growth + vacancy_baseline** (data exists, formula F32/F33 already built per Formula Engine sheet)
2. **M04 Supply → vacancy_ramp adjustment** (depends on M04 being wired separately)
3. **M08 Strategy → variant + variant-specific assumption block** (depends on Strategy Arbitrage Engine wiring — separate P0 task)
4. **M07 Traffic → absorption_curve_24mo** (Lease-Up variant only; depends on M07 stable API endpoints)
5. **M02 Zoning → zoning-bound revenue ceiling** (Development variant only; depends on Zoning Agent live)
6. **M06 Demand → demand-adjusted rent growth** (depends on M19 News pipeline live)

Each subscription is a small PR. Do not bundle. Each ships behind a feature flag (`enableM05ProFormaSync`, etc.) and graduates to default-on after one sprint of green production.

**Phase 4 Acceptance Criteria (per subscription):**

- The relevant assumption field on the F9 tab updates when its upstream module updates
- Source badge correctly reads `PLATFORM` (or `MARKET` for tier3) on auto-synced fields
- User overrides on those fields are preserved across upstream updates (LayeredValue merge order)
- A toggle in F9 settings allows the user to disable auto-sync for the field

---

### Phase 5 — CashFlow Agent Integration (deferrable)

**Goal:** F9 fields can be populated by the CashFlow Agent per `CASHFLOW_AGENT_UNDERWRITING_SPEC.md`. The "Reasoning Walkthrough" sub-tab renders.

This phase requires the agent runtime from `REPLIT_AGENT_IMPLEMENTATION_PROMPT.md` to be live. Do not start until that build is in production.

**Deliverables:**

1. `proformaApi.underwrite(dealId)` wired to the runtime (Phase 1 already added the type)
2. New F9 sub-tab `ReasoningWalkthrough.tsx` — calls `proformaApi.walkthrough(dealId)`
3. Source badge `AGENT` rendering with agent_run_id tooltip
4. Evidence panel "Alternatives Considered" tab populated from `Evidence.alternatives_considered`
5. Collision Reports show in `CollisionPanel` when `Evidence.collision` is present

**Phase 5 Acceptance Criteria:**

- Triggering the CashFlow Agent on a seeded deal completes within 90 seconds
- Every assumption field has a populated `Evidence` object with `primary_tier`, `data_points`, `reasoning`, `alternatives_considered`
- The Reasoning Walkthrough narrative renders as institutional-quality prose, not bullet points or fragmented sentences
- All five `LayeredValueSource` agent values (`agent:research|zoning|supply|cashflow|commentary`) render correctly in `SourceBadge`

---

## What NOT to Do

- **Do not write a new ProForma engine.** `proforma-adjustment.service.ts` (1,110 lines) is the engine. Frontend wires to it; nothing more.
- **Do not delete the mock files in this PR series.** Rename them to `*.mock.deprecated.ts`. Deletion is a follow-up after one full sprint of production stability.
- **Do not stub missing endpoints.** If a route in the Backend Wiring section isn't mounted, fail loudly in CI. Silent stubs cause the next round of "why is this still showing zeros" debugging.
- **Do not bypass dealStore.** Every cross-tab data flow goes through the store. No imports between F9 sub-tab components.
- **Do not bundle Phase 4 subscriptions.** Each upstream subscription is its own PR. Bundling them turns a small, safe change into an unrelated regression risk.
- **Do not put assumption defaults in the frontend.** Defaults live in the backend `proforma-adjustment.service.ts` per project type. The frontend only renders what the backend returns.
- **Do not use Tailwind color classes.** Use the `T` token object exclusively. JetBrains Mono for numerics, IBM Plex Sans for labels, max 2px border radius, no shadows.
- **Do not introduce `useEffect` for data fetching in F9 components.** Fetching happens in the dealStore slice; components subscribe via selectors. This is a Zustand pattern — no SWR, no React Query in F9.

---

## Files to Reference

| Document | Why |
|----------|-----|
| `CLAUDE.md` | Lists the 25 mock files, the IRR=15 bug, the wiring sequence priority order |
| `CASHFLOW_AGENT_UNDERWRITING_SPEC.md` | Authoritative for Evidence types, source badge values, F9 UX contract, Walkthrough tab content |
| `AGENT_PLATFORM_SPEC.md` | Authoritative for the `LayeredValue<T>` extension; do not redefine |
| `FEATURE_EXPANSION.md` | F6 PROFORMA section (M09) lists the five P0/P1 features and their backend services |
| `jedi_re_module_wiring_blueprint.xlsx` | Sheet 2 (Data Flow Matrix), Sheet 5 row M09 (Wireframe Specs), Sheet 7 row P1-1 (Implementation Priority) |
| `TRAFFIC_ENGINE_CALIBRATION_SPEC.md` | §4.4 defines the absorption_curve_24mo shape for the Lease-Up variant |
| `REPLIT_AGENT_IMPLEMENTATION_PROMPT.md` | Phase ordering style this document follows; Phase 5 of this build depends on that build being live |

---

## Final Note

The fastest visible win is **Phase 1 + Phase 2 + the `enhancedProFormaMockData` swap from Phase 3**. That single delivery unbroken-IRR's the deal page, makes M14 Risk's financial inputs flow, and unblocks M10 Scenario from rendering zeros. Everything else layers on top of that base. Do not let perfect be the enemy of shipped — get the loop closed first, then add evidence panels, then add upstream subscriptions, then add the agent.
