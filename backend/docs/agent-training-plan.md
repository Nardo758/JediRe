# Agent Training Plan: Teaching Agents to Underwrite Deals

## Problem

Agents run `fetch_data_matrix` for market context but **ignore the extracted deal data** 
already in `deals.deal_data` (OM, T12, Rent Roll, Broker Claims).

Result: CashFlow agent said "estimated 20 units" for a 232-unit deal. Agents build proformas
from scratch instead of reading actual T12 NOI.

## Data Sources

### Budget Archive (loaded tonight)
| File | Property | Units | Market | Operator |
|---|---|---|---|---|
| CTR 2026 Budget | Citadel at Tech Ridge (p2107) | 308 | Austin, TX | Bell Partners/Myers |
| Keltonwood at Berewick | (p2015) | 230 | Charlotte, NC | Bell Partners |
| Exchange at Holly Springs | (p2071) | 316 | Raleigh, NC | Bell Partners |
| Symphony 2026 Draft 2 | — | — | — | Bell Partners |
| BPI p2107 (13mo actuals) | Citadel at Tech Ridge | 308 | Austin, TX | Bell Partners |

### Budget Anatomy (every Bell Partners budget)
```
Template Structure:
├── Control          — metadata, page mapping
├── Stat data        — property info (units, sqft, city, state, year built, owner, acquisition date)
├── Last closed month
├── Summary          — Full P&L: Prior Year × Current Forecast × Budget × Variance
│   ├── Gross Potential Rent
│   ├── Concessions (new lease + renewal)
│   ├── Vacancy Loss
│   ├── Rental Income (= Effective Rental Income)
│   ├── Other Income (utility, non-utility)
│   ├── Controllable Expenses (payroll, M&R, marketing, admin, landscaping, turnover, alarm)
│   ├── Non-Controllable (management fee, insurance, property taxes, licenses)
│   ├── Total OpEx
│   └── Net Operating Income
├── Budget            — 12-month line item detail with GL accounts
├── Unit Mix          — floor plans × units × market rent × occupied rent × total rentable sqft
├── Income Assumptions — monthly rent growth, turnover rate, occupancy %, lease expirations
└── CapEx             — line-item capital projects (appliances, carpet, HVAC, pool, parking, etc.)
```

### Key Ratios (from CTR/Austin — most comparable to 464 Bishop)
| Metric | CTR (308 u, 2019, Austin) | Holly Springs (316 u, 2020, Raleigh) |
|---|---|---|
| Avg rent/unit/mo | $1,428 | $1,580 |
| Physical occupancy | 92.8% | 93.9% |
| Economic occupancy | 84.8% | 91.6% |
| Concessions | 6.4% of GPR | 1.1% of GPR |
| Vacancy loss | 7.3% | 6.2% |
| Payroll/unit/yr | $1,655 | $1,580 |
| Payroll as % EGI | 10.2% | 9.1% |
| M&R/unit/yr | $311 | — |
| Marketing/unit/yr | $385 | — |
| Management fee | 3.1% | — |
| Insurance/unit/yr | $348 | — |
| Taxes/unit/yr | $4,678 | — |
| Total opex/unit/yr | $10,129 | — |
| NOI/unit/yr | $6,815 | — |
| CapEx/unit/yr | $842 | — |
| Staffing ratio | 1 FTE per ~100 units | same |

## Phase 1: Pipeline Fix (today)

### 1A. Enriched Agent Context
In `inline-deals.routes.ts`, before running agents, query deal_data and build:
```typescript
const deal = await pool.query('SELECT deal_data FROM deals WHERE id = $1', [dealId]);
const dealData = deal.rows[0]?.deal_data || {};

const enrichedCtx = {
  ...ctxBase,
  // Inject extracted deal data into context
  extractedT12: dealData.extraction_t12 || null,
  extractedRentRoll: dealData.extraction_rent_roll || null,
  extractedOM: dealData.extraction_om || null,
  brokerClaims: dealData.broker_claims || null,
  geographicContext: dealData.geographic_context || null,
};
```

### 1B. Update AgentRuntime to accept enriched ctx
- Add optional fields to `RunContext` type (`extractedT12`, etc.)
- Build a system message preamble from the extracted data
- Prepend to agent's system prompt so agent sees:
  ```
  ## EXTRACTED DEAL DATA
  Units: 232 | Occupancy: 80% | Avg Rent: $1,495/mo
  T12 GPR: $4.88M | T12 NOI: -$142K (lease-up) | 12 months captured
  Broker asking: $__M | Guidance cap: __% | Guidance $/unit: $__
  ```

### 1C. PostProcess Fix (already done for Commentary)
- CashFlow and Research need postProcess hooks too
- PostProcess validates and fills extracted data before schema validation

## Phase 2: Agent Training (ongoing)

### 2A. Build an "underwriting knowledge base"
From the budget archives, extract:
- Expense benchmarks by market (Austin vs Raleigh vs Atlanta)
- Operating margin by year-built cohort
- Staffing models (FTE per 100 units)
- CapEx patterns by age
- Tax rates by county

### 2B. Feed these into agent prompts
Currently the CashFlow prompt is v6 — it needs context-specific benchmarks:
```
PROPERTY TYPE: Garden-style, 2019 build
ATLANTA MSA BENCHMARKS:
  Avg operating expense: $9,500/unit/yr
  Avg property tax: $2,800/unit/yr (GA ≠ TX — CTR pays $4,678)
  Avg management fee: 3-4% of EGI
  Insurance: $300-400/unit/yr
```

### 2C. Eval loop (Cosmos Pattern 5)
After each pipeline run on a deal with a known budget:
1. Compare agent assumptions vs actual budget line items
2. Score accuracy (NOI margin, expense ratios, rent growth)
3. Feed scores into `learning_feedback` table
4. Adjust prompts when accuracy drops below threshold

## Phase 3: Terminal Markets → Pipeline Flow (after Phase 1)

### 3A. MSA Agent runs weekly
- Backend cron job refreshes MSA-level intelligence
- Populates `market_trends` and `knowledge_graph` with supply pipeline, rent trends, employment
- Supplements with `fetch_data_matrix` called proactively

### 3B. Pipeline agents read pre-baked MSA data
- Instead of calling `fetch_data_matrix` on every deal run
- Agents query the pre-populated MSA summary from KG
- This eliminates duplicated market research across deals in the same MSA

### 3C. Commentary becomes lighter
- Commentary reads:
  - Pre-baked MSA context (Phase 3)
  - Pre-baked per-deal data (Phase 1)
  - CashFlow proforma results from previous pipeline step
  - PostProcess fills any remaining gaps
  - v6 prompt with `firstToolCall: 'fetch_data_matrix'` should work with 20 steps
