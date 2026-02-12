# Deal Tracking Grids Specification

**Created:** 2026-02-08 21:18 EST  
**Purpose:** Comprehensive grid view tracking for Pipeline (pre-acquisition) and Owned Deals (post-acquisition)

---

## Overview

Two major tracking grids with deep metrics:
1. **Pipeline Grid** - Deals moving through DISCOVER → RESEARCH → ANALYZE → MODEL → EXECUTE
2. **Owned Deals Grid** - Post-acquisition performance tracking (TRACK phase)

Both grids should support:
- Sortable columns
- Filterable data
- Export to CSV/Excel
- Drill-down to deal details
- Alert indicators for issues

---

## 1. Pipeline Tab (Pre-Acquisition Tracking)

### Purpose
Track deals moving through acquisition pipeline stages with opportunity scoring and strategy analysis.

### Pipeline Stages
1. **Sourced** - Initial lead identified
2. **Under Review** - Team evaluating opportunity
3. **LOI** - Letter of Intent submitted
4. **Under Contract** - PSA executed
5. **Due Diligence** - Active DD period
6. **Closing** - Final closing process

### Grid Columns (Grouped)

#### A. Deal Identity & Status
| Column | Data Type | Description |
|--------|-----------|-------------|
| Property Name | Text | Deal name/identifier |
| Address | Text | Full property address |
| Asset Type | Enum | Multifamily, Office, Retail, Industrial, Mixed-Use |
| Unit Count / SF | Number | Size metric (units for MF, SF for commercial) |
| Pipeline Stage | Enum | Current stage (6 options above) |
| Days in Stage | Number | Days since stage change (⚠️ alert if >30) |
| AI Opportunity Score | 0-100 | Strategy Arbitrage confidence score |

#### B. Financial Snapshot
| Column | Data Type | Description |
|--------|-----------|-------------|
| Ask Price | Currency | Broker/seller asking price |
| Price per Unit/SF | Currency | Normalized pricing metric |
| JEDI Adjusted Price | Currency | AI-recommended price (e.g., $38-40M vs $45M ask) |
| Going-in Cap Rate (Broker) | Percentage | Seller's pro forma cap rate |
| Going-in Cap Rate (JEDI) | Percentage | AI-adjusted cap rate |
| Projected IRR (Broker) | Percentage | Seller's projected IRR |
| Projected IRR (JEDI) | Percentage | AI-realistic IRR range |
| Pro Forma NOI | Currency | Broker's NOI projection |
| JEDI Adjusted NOI | Currency | AI-adjusted NOI |
| Equity Required | Currency | Down payment needed |
| Target DSCR | Ratio | Debt service coverage ratio |

#### C. Strategy Arbitrage Indicators
| Column | Data Type | Description |
|--------|-----------|-------------|
| Best Strategy | Enum | Build-to-Sell, Flip, Rental, Airbnb |
| Confidence Score | 0-100 | Confidence in best strategy |
| Strategy Spread | Currency | Delta between best/worst strategy returns |
| Arbitrage Signal Strength | 0-100 | Hidden ROI vs single-strategy analysis |

#### D. Market Context
| Column | Data Type | Description |
|--------|-----------|-------------|
| Supply Risk Flag | Boolean | ⚠️ if high competing supply (e.g., 1,240 units in 1.5mi) |
| Competing Units | Number | Units delivering in trade area |
| Submarket Absorption Rate | Number | Units absorbed per month |
| Rent Growth Forecast | Percentage | 12-month rent growth projection |
| Imbalance Score | 0-100 | Supply-demand balance (Imbalance Detector) |

#### E. Deal Velocity Metrics
| Column | Data Type | Description |
|--------|-----------|-------------|
| Source | Enum | Broker, Off-Market, Network Intel, News Signal |
| Competing Offers | Number | Known competing bids (if available) |
| LOI Deadline | Date | Deadline for letter of intent |
| Inspection Period End | Date | DD inspection period deadline |
| Closing Date | Date | Target closing date |
| DD Checklist % | Percentage | Due diligence completion (0-100%) |

### Visual Indicators

**Status Badges:**
- 🟢 On Track - progressing normally
- 🟡 Attention - approaching deadline or stalled
- 🔴 Risk - missed deadline or critical issue
- ⭐ High Confidence - AI score >85

**Alert Icons:**
- ⚠️ Supply Risk - high competing supply
- 🚨 Stalled - >30 days in stage
- 💰 Value Gap - JEDI price significantly below ask
- 🎯 Strong Arbitrage - high strategy spread

---

## 2. Deals Owned Tab (Post-Acquisition Tracking)

### Purpose
Track actual performance vs underwriting for owned assets (TRACK phase).

### Grid Columns (Grouped)

#### A. Deal Identity
| Column | Data Type | Description |
|--------|-----------|-------------|
| Property Name | Text | Asset name |
| Address | Text | Full property address |
| Asset Type | Enum | Property type |
| Acquisition Date | Date | Date purchased |
| Hold Period | Number | Months since acquisition |

#### B. Performance vs Underwriting
| Column | Data Type | Description |
|--------|-----------|-------------|
| Actual NOI | Currency | Current trailing 12-month NOI |
| Pro Forma NOI | Currency | Underwritten NOI at acquisition |
| NOI Variance | Percentage | (Actual - Pro Forma) / Pro Forma |
| Actual Occupancy | Percentage | Current occupancy rate |
| Projected Occupancy | Percentage | Underwritten occupancy |
| Occupancy Variance | Percentage | Actual - Projected |
| Actual Rent/Unit | Currency | Current average rent |
| Underwritten Rent/Unit | Currency | Pro forma rent |
| Rent Variance | Percentage | (Actual - Pro Forma) / Pro Forma |
| Actual Concessions | Currency | Current concessions per unit |
| Projected Concessions | Currency | Underwritten concessions |
| Actual Cap Rate | Percentage | Current NOI / Current Value |
| Going-in Cap Rate | Percentage | Acquisition cap rate |

#### C. Returns Tracking
| Column | Data Type | Description |
|--------|-----------|-------------|
| Current IRR | Percentage | Current internal rate of return |
| Projected IRR | Percentage | Underwritten IRR at acquisition |
| IRR Variance | Percentage | Current - Projected |
| Cash-on-Cash Return | Percentage | Current period CoC |
| Equity Multiple | Ratio | Current equity multiple |
| Projected Exit Multiple | Ratio | Underwritten exit multiple |
| Total Distributions | Currency | Cumulative distributions to date |
| Unrealized Gain/Loss | Currency | Current market value - basis |

#### D. Operational Health
| Column | Data Type | Description |
|--------|-----------|-------------|
| Occupancy Trend (3mo) | Percentage | 3-month occupancy average |
| Occupancy Trend (6mo) | Percentage | 6-month occupancy average |
| Occupancy Trend (12mo) | Percentage | 12-month occupancy average |
| Rent Growth Achieved | Percentage | Actual rent growth vs forecast |
| Rent Growth Forecast | Percentage | Original underwritten growth |
| Operating Expense Ratio | Percentage | Opex / Gross Revenue |
| Budget Opex Ratio | Percentage | Underwritten opex ratio |
| Capex Spend | Currency | Actual capex to date |
| Capex Budget | Currency | Underwritten capex |
| Capex Timeline % | Percentage | Capex schedule completion |
| Lease Renewal Rate | Percentage | % of leases renewed (trailing 12mo) |

#### E. Market Position (Ongoing Intelligence)
| Column | Data Type | Description |
|--------|-----------|-------------|
| Current AI Score | 0-100 | Updated Strategy Arbitrage score |
| Updated Supply Pipeline | Number | Current competing units in trade area |
| Comp Rent Position | Enum | Above/At/Below market |
| Property Concessions | Currency | Your current concessions |
| Comp Concessions | Currency | Market average concessions |

#### F. Value-Add Progress (if applicable)
| Column | Data Type | Description |
|--------|-----------|-------------|
| Renovation % Complete | Percentage | Value-add completion |
| Renovation Budget Variance | Percentage | Actual spend vs budget |
| Renovated Unit Rent | Currency | Avg rent for renovated units |
| Unrenovated Unit Rent | Currency | Avg rent for unrenovated units |
| Rent Premium Achieved | Percentage | (Renovated - Unrenovated) / Unrenovated |
| Timeline Variance | Number | Days ahead/behind schedule |

#### G. Risk Monitoring
| Column | Data Type | Description |
|--------|-----------|-------------|
| Loan Maturity Date | Date | Debt maturity date |
| Months to Maturity | Number | Months until refi needed |
| Refi Risk Flag | Boolean | ⚠️ if <12 months to maturity |
| Interest Rate Sensitivity | Percentage | Impact of +1% rate increase |
| Market Risk Signals | Number | Count of negative news signals |
| Portfolio Concentration | Percentage | % of portfolio in this submarket |

### Visual Indicators

**Performance Badges:**
- 🟢 Outperforming - beating underwriting
- 🟡 On Track - within 5% of pro forma
- 🔴 Underperforming - >10% below pro forma
- ⭐ Value-Add Success - achieving renovation premiums

**Alert Icons:**
- ⚠️ Refi Risk - approaching loan maturity
- 🚨 Underperforming - significant variance
- 💰 Value-Add Opportunity - market shift detected
- 🎯 Exit Window - favorable exit conditions

---

## 3. Technical Implementation

### Database Schema Updates

**Pipeline Deals (deals table - extend):**
- Add columns: days_in_stage, ai_opportunity_score, jedi_adjusted_price, jedi_adjusted_noi, jedi_adjusted_cap_rate, best_strategy, strategy_confidence, strategy_spread, arbitrage_signal_strength, supply_risk_flag, competing_units, absorption_rate, rent_growth_forecast, imbalance_score, source, competing_offers, loi_deadline, inspection_period_end, dd_checklist_pct

**Owned Deals (new table: deal_performance):**
```sql
CREATE TABLE deal_performance (
  id UUID PRIMARY KEY,
  deal_id UUID REFERENCES deals(id),
  period_start DATE,
  period_end DATE,
  
  -- Actuals
  actual_noi NUMERIC(15,2),
  actual_occupancy NUMERIC(5,2),
  actual_avg_rent NUMERIC(10,2),
  actual_concessions NUMERIC(10,2),
  actual_opex_ratio NUMERIC(5,2),
  actual_capex NUMERIC(15,2),
  renewal_rate NUMERIC(5,2),
  
  -- Pro Forma (from acquisition)
  proforma_noi NUMERIC(15,2),
  proforma_occupancy NUMERIC(5,2),
  proforma_rent NUMERIC(10,2),
  proforma_concessions NUMERIC(10,2),
  proforma_opex_ratio NUMERIC(5,2),
  proforma_capex NUMERIC(15,2),
  
  -- Returns
  current_irr NUMERIC(5,2),
  projected_irr NUMERIC(5,2),
  coc_return NUMERIC(5,2),
  equity_multiple NUMERIC(5,2),
  total_distributions NUMERIC(15,2),
  unrealized_gain_loss NUMERIC(15,2),
  
  -- Market Position
  current_ai_score INTEGER,
  competing_supply INTEGER,
  comp_rent_position TEXT,
  comp_concessions NUMERIC(10,2),
  
  -- Value-Add
  renovation_pct_complete NUMERIC(5,2),
  renovation_budget_variance NUMERIC(5,2),
  renovated_unit_rent NUMERIC(10,2),
  unrenovated_unit_rent NUMERIC(10,2),
  
  -- Risk
  loan_maturity_date DATE,
  refi_risk_flag BOOLEAN,
  interest_rate_sensitivity NUMERIC(5,2),
  market_risk_signals INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deal_performance_deal ON deal_performance(deal_id);
CREATE INDEX idx_deal_performance_period ON deal_performance(period_start, period_end);
```

### API Endpoints

**Pipeline:**
- GET `/api/v1/deals/pipeline/grid` - Full pipeline grid data with all metrics
- GET `/api/v1/deals/:id/strategy-arbitrage` - Detailed strategy analysis
- GET `/api/v1/deals/:id/market-context` - Supply risk, absorption, imbalance

**Owned:**
- GET `/api/v1/deals/owned/grid` - Full owned deals grid with performance
- GET `/api/v1/deals/:id/performance` - Performance vs underwriting
- GET `/api/v1/deals/:id/returns` - Returns tracking
- GET `/api/v1/deals/:id/operational-health` - Opex, capex, renewals
- POST `/api/v1/deals/:id/performance` - Update actuals

### Frontend Components

**1. DataGrid Component (Reusable)**
```typescript
interface DataGridProps {
  columns: ColumnDef[];
  data: any[];
  sortable?: boolean;
  filterable?: boolean;
  exportable?: boolean;
  onRowClick?: (row) => void;
}
```

**Features:**
- Column sorting (asc/desc)
- Column filtering (text, number ranges, dates)
- Row selection
- Export to CSV/Excel
- Pagination (50/100/250/All rows)
- Column visibility toggle
- Column reordering (drag-drop)
- Responsive (horizontal scroll on mobile)

**2. Page Updates**

**DealsPage (Pipeline):**
- Add "Grid View" / "Kanban View" toggle
- Grid View: DataGrid with all pipeline columns
- Kanban View: Current drag-drop board

**AssetsOwnedPage:**
- Add "Grid View" / "Map View" toggle
- Grid View: DataGrid with all performance columns
- Map View: Current asset markers

### Data Flow

```
1. User loads Pipeline/Grid
2. Frontend calls /api/v1/deals/pipeline/grid
3. Backend queries:
   - deals table (core data)
   - deal_analysis table (Strategy Arbitrage)
   - deal_trade_areas table (Market Context)
   - properties table (supply risk calculations)
4. Backend aggregates and calculates metrics
5. Returns formatted grid data
6. Frontend renders DataGrid component
7. User can sort, filter, export
8. Click row → navigate to deal detail page
```

---

## 4. Implementation Phases

### Phase 1: Database & Backend (8 hours)
- [x] Extend deals table schema
- [ ] Create deal_performance table
- [ ] Build 8 new API endpoints
- [ ] Add calculation logic for all metrics
- [ ] Write data aggregation queries

### Phase 2: DataGrid Component (6 hours)
- [ ] Build reusable DataGrid component
- [ ] Add sorting functionality
- [ ] Add filtering functionality
- [ ] Add export (CSV/Excel)
- [ ] Style with Tailwind
- [ ] Add responsive mobile view

### Phase 3: Pipeline Grid (4 hours)
- [ ] Define 30+ column definitions
- [ ] Wire to API endpoints
- [ ] Add toggle Grid/Kanban view
- [ ] Add visual indicators (badges, alerts)
- [ ] Add drill-down to deal details

### Phase 4: Owned Deals Grid (4 hours)
- [ ] Define 40+ column definitions
- [ ] Wire to performance APIs
- [ ] Add toggle Grid/Map view
- [ ] Add variance highlighting (red/green)
- [ ] Add drill-down to deal details

### Phase 5: Polish & Testing (4 hours)
- [ ] Performance optimization (virtualization for 100+ deals)
- [ ] Export testing
- [ ] Responsive testing
- [ ] Documentation

**Total Estimate:** 26 hours (1 sprint)

---

## 5. UI/UX Design

### Grid Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Pipeline / Grid View          [Toggle: Grid | Kanban]      │
│  [Export CSV] [Filters ▼] [Columns ▼]                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Grouped Column Headers:                                     │
│  ┌────────────┬───────────┬────────────┬──────────┬───────┐ │
│  │ Identity & │ Financial │ Strategy   │ Market   │ Velocity│ │
│  │ Status     │ Snapshot  │ Arbitrage  │ Context  │        │ │
│  ├────────────┼───────────┼────────────┼──────────┼───────┤ │
│  │ Name       │ Ask Price │ Best       │ Supply   │ Source│ │
│  │ Address    │ JEDI Price│ Strategy   │ Risk     │ LOI   │ │
│  │ Type       │ IRR (B)   │ Confidence │ Absorb   │ Close │ │
│  │ Units      │ IRR (J)   │ Spread     │ Imbalance│ DD %  │ │
│  │ Stage      │ NOI       │            │          │       │ │
│  │ Days       │           │            │          │       │ │
│  │ AI Score   │           │            │          │       │ │
│  └────────────┴───────────┴────────────┴──────────┴───────┘ │
│                                                              │
│  Row Data with badges and alerts:                           │
│  ───────────────────────────────────────────────────────────│
│  🟢 Midtown Plaza  | $45M → $38M | Build-to-Sell (92) | ⚠️  │
│     123 Peach St   | IRR: 18% → 22% | Spread: $4.2M   | 240u│
│     Multifamily    | NOI: $3.2M     | Signal: 88      | 🚨  │
│     450u | LOI | 12d | ⭐ 94                                 │
│  ───────────────────────────────────────────────────────────│
│  🟡 Buckhead Tower | ...                                     │
│  ───────────────────────────────────────────────────────────│
│                                                              │
│  Showing 1-50 of 127 deals | [< 1 2 3 4 5 >]              │
└─────────────────────────────────────────────────────────────┘
```

### Column Groups (Collapsible)
- Click group header to expand/collapse entire section
- Saves screen space
- Progressive disclosure

### Filters Panel (Slide-out)
- Stage filter (multiselect)
- Price range slider
- AI Score range
- Days in stage range
- Asset type multiselect
- Source filter
- Supply risk toggle

### Export Options
- CSV (all columns)
- Excel (with formatting)
- PDF (current view only)

---

## 6. Success Metrics

**Pipeline Grid:**
- Track deals across 6 stages
- Identify stalled deals (>30 days)
- Surface high-confidence opportunities (AI score >85)
- Highlight strategy arbitrage plays (high spread)
- Flag supply risk properties

**Owned Deals Grid:**
- Monitor variance vs underwriting (NOI, occupancy, rent)
- Track returns vs projections (IRR, CoC, equity multiple)
- Identify underperforming assets
- Surface value-add opportunities
- Monitor refinance risk

---

## 7. Future Enhancements

**Phase 2 (Future):**
- [ ] Bulk actions (update stage, assign owner)
- [ ] Saved views / custom column sets
- [ ] Conditional formatting rules
- [ ] Chart overlays (trend sparklines)
- [ ] Email alerts on metric thresholds
- [ ] Integration with accounting systems (actual financials)
- [ ] Benchmark comparisons (portfolio avg, market avg)

---

**Status:** Specification complete, ready for implementation  
**Priority:** High - core functionality for deal tracking  
**Estimated Effort:** 26 hours (1 sprint)  
**Dependencies:** Strategy Arbitrage Agent, Imbalance Detector, Market Intelligence
