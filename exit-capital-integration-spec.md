# Exit & Capital Module (M11+M12) — Integration Spec for Claude Code

## Overview

This module replaces the current `DebtTab.tsx` (1,107 lines) and its sub-components
(`ExitDrivesCapital.tsx`, `ExitStrategyTabs.tsx`, `DebtCycleChart.tsx`, `DebtProductsChart.tsx`).

**Visual spec:** See `exit-capital-v3-preview.html` for the rendered prototype.
Use it as a VISUAL REFERENCE — do NOT copy-paste the HTML. Rebuild in your
existing React/TypeScript patterns using the architecture below.

---

## 1. DEFAULT SELECTIONS (no user interaction required)

When the module loads, these values are pre-populated. The user can override any of them.

### Exit Quarter Default
```typescript
// Platform recommends the quarter with highest RSS in the forward window
const optimalExitQuarter = useMemo(() => {
  let bestIdx = 0;
  forwardQuarters.forEach((q, i) => {
    if (q.rss > forwardQuarters[bestIdx].rss) bestIdx = i;
  });
  return bestIdx;
}, [forwardQuarters]);

// User's selection starts at the optimal — overridden on click
const [selectedExitQuarter, setSelectedExitQuarter] = useState<number | null>(null);
const activeExitQuarter = selectedExitQuarter ?? optimalExitQuarter;
```

### Exit Strategy Default (by deal type)
```typescript
const DEFAULT_EXIT_STRATEGY: Record<DealType, string> = {
  existing: 'sell-stabilized',        // Value-add → sell at compressed cap
  development: 'sell-stabilized',     // Stabilize & sell (most common merchant build exit)
  redevelopment: 'sell-stabilized',   // Sell at completion
};
```

### Capital Stack Default (by exit strategy)
The STACK_PRESETS object auto-configures debt structure when the exit strategy is selected.
No manual input needed. User can override individual layers.

### Push-to-ProForma on Load
When the module mounts, it immediately pushes defaults to the dealStore:
```typescript
useEffect(() => {
  const returns = computeExitReturns(activeExitQuarter, dealType);
  const stack = STACK_PRESETS[selectedExitStrategy];
  
  dealStore.setState({
    financial: {
      ...dealStore.getState().financial,
      assumptions: {
        ...dealStore.getState().financial.assumptions,
        holdPeriod: { value: returns.holdYears, source: 'platform', confidence: 0.7 },
        exitCapRate: { value: returns.exitCap / 100, source: 'platform', confidence: 0.6 },
      },
    },
    capital: {
      ...dealStore.getState().capital,
      seniorDebt: {
        rate: stack.senior.rate / 100,
        ltv: stack.senior.pct / 100,
        term: stack.senior.term,
        ioPeriod: stack.senior.io,
        annualDebtService: computeAnnualDS(totalBasis, stack),
      },
    },
  });
}, [activeExitQuarter, selectedExitStrategy, dealType]);
```

---

## 2. FED RATE PATH — FOMC Schedule & Dot Plot

The Debt Market tab and Exit Strategy convergence chart should overlay the Fed's
communicated rate path. This is what debt brokers use to price forward.

### Data Structure
```typescript
interface FOMCMeeting {
  date: string;           // "2026-03-19"
  quarter: string;        // "Q1'26"  
  absQuarterIdx: number;  // index into the 84-quarter array
  currentTarget: number;  // 4.25 (upper bound of target range)
  dotPlotMedian: number;  // median of FOMC participants' projections
  marketImplied: number;  // Fed funds futures implied rate
  action: 'hold' | 'cut_25' | 'cut_50' | 'hike_25' | null;  // consensus expectation
}

// 2026 FOMC schedule (8 meetings per year)
const FOMC_MEETINGS_2026: FOMCMeeting[] = [
  { date: '2026-01-28', quarter: "Q1'26", absQuarterIdx: 40, currentTarget: 4.25, dotPlotMedian: 3.75, marketImplied: 4.10, action: 'cut_25' },
  { date: '2026-03-18', quarter: "Q1'26", absQuarterIdx: 40, currentTarget: 4.00, dotPlotMedian: 3.75, marketImplied: 3.90, action: 'cut_25' },
  { date: '2026-05-06', quarter: "Q2'26", absQuarterIdx: 41, currentTarget: 3.75, dotPlotMedian: 3.50, marketImplied: 3.70, action: 'hold' },
  { date: '2026-06-17', quarter: "Q2'26", absQuarterIdx: 41, currentTarget: 3.75, dotPlotMedian: 3.50, marketImplied: 3.60, action: 'cut_25' },
  { date: '2026-07-29', quarter: "Q3'26", absQuarterIdx: 42, currentTarget: 3.50, dotPlotMedian: 3.25, marketImplied: 3.45, action: 'hold' },
  { date: '2026-09-16', quarter: "Q3'26", absQuarterIdx: 42, currentTarget: 3.50, dotPlotMedian: 3.25, marketImplied: 3.35, action: 'cut_25' },
  { date: '2026-11-04', quarter: "Q4'26", absQuarterIdx: 43, currentTarget: 3.25, dotPlotMedian: 3.00, marketImplied: 3.20, action: 'hold' },
  { date: '2026-12-16', quarter: "Q4'26", absQuarterIdx: 43, currentTarget: 3.25, dotPlotMedian: 3.00, marketImplied: 3.10, action: 'cut_25' },
];

// Summary of expected path (for the next 3 years of dot plot)
const FED_DOT_PLOT = {
  current: 4.25,       // as of NOW
  endOf2026: 3.25,     // 4 cuts expected
  endOf2027: 3.00,     // 1 more cut
  longerRun: 3.00,     // neutral rate
  lastUpdated: '2025-12-18',  // last SEP (Summary of Economic Projections)
};
```

### Display in Convergence Chart
On the 21-year convergence chart, FOMC meetings appear as small diamond markers
on the SOFR/rates line. Color-coded: green diamond = expected cut, red = expected hike,
gray = hold. The dot plot median path is drawn as a thin dashed line diverging from
the SOFR projection — showing where the Fed says it's going vs where the market
prices it.

### Display in Debt Market Tab
A "Fed Watch" card at the top shows:
- Next FOMC meeting date and countdown
- Current target range
- Market-implied probability of cut/hold/hike (from futures)
- Dot plot median for year-end 2026, 2027, longer-run
- A mini step-chart showing the expected path of cuts

### Impact on Exit Strategy
The rate path directly affects:
1. **Buyer affordability** — lower rates = more buyers can get financing = higher exit prices
2. **Cap rate trajectory** — rates declining → cap rates compress → sell into the compression
3. **Refinance windows** — falling rates create refi opportunities that enhance hold strategy returns
4. **Construction loan cost** — for development, each cut reduces carrying cost during construction

The RSS formula's Rate Environment component (25% weight) uses the forward rate path
to score each exit quarter. Quarters where rates are expected to be lower score higher
because buyer affordability improves.

---

## 3. PUSH-TO-PROFORMA FIELD MAPPING

| Exit Module Selection | ProForma Field | Store Path | Trigger |
|---|---|---|---|
| Exit quarter click | Hold period (years) | `financial.assumptions.holdPeriod` | On quarter select |
| Exit quarter click | Exit cap rate (%) | `financial.assumptions.exitCapRate` | On quarter select |
| Exit quarter click | Projection columns | `financial.assumptions.projectionYears` | On quarter select |
| Exit strategy card | Disposition strategy | `strategy.selectedExitStrategy` | On card click |
| Capital stack senior | Loan rate | `capital.seniorDebt.rate` | On strategy select |
| Capital stack senior | LTV/LTC | `capital.seniorDebt.ltv` | On strategy select |
| Capital stack senior | IO period | `capital.seniorDebt.ioPeriod` | On strategy select |
| Capital stack senior | Annual debt service | `capital.seniorDebt.annualDS` | Computed on change |
| Capital stack mezz | Mezz rate | `capital.mezzDebt.rate` | On strategy select |
| Capital stack mezz | Mezz amount | `capital.mezzDebt.amount` | On strategy select |

### Resolution Order (circular dependency)
1. ProForma computes operating cash flows (revenue → expenses → NOI)
2. Exit module READS NOI to compute disposition returns
3. Exit module WRITES hold period + exit cap + debt terms back to ProForma
4. ProForma re-renders with updated assumptions
5. Sensitivity tab reads from the same ProForma engine

The store handles this with a debounced update — Exit writes, ProForma reacts
on next render cycle. No infinite loop because Exit reads NOI (which doesn't change
when debt terms change) and writes exit/debt assumptions (which don't feed back to NOI).

---

## 4. COMPONENT ARCHITECTURE

```
ExitCapitalModule.tsx (main export, replaces DebtTab)
├── ExitStrategyTab.tsx
│   ├── ConvergenceChart21Y.tsx (21-year SVG, interactive)
│   │   ├── FOMCMarkers (diamond overlays on rate line)
│   │   └── DotPlotPath (thin dashed divergence line)
│   ├── RSSBreakdownCards.tsx (5 sub-score cards)
│   └── ExitStrategyCards.tsx (3 cards per deal type)
├── CapitalStackTab.tsx
│   ├── StackVisualizer.tsx (proportional layer bars)
│   └── DebtProductComparison.tsx (6-product table)
├── DebtMarketTab.tsx
│   ├── RateHeroCards.tsx (5 current rate cards)
│   ├── RateChart21Y.tsx (21-year multi-line chart)
│   ├── FedWatchCard.tsx (FOMC schedule + dot plot)
│   ├── SpreadChart.tsx (horizontal bar comparison)
│   └── LenderQuotesTable.tsx (email-extracted quotes)
├── ExitTimingTab.tsx
│   ├── IRRBarChart.tsx (44 clickable quarterly bars)
│   └── SelectionVsOptimalComparison.tsx (side-by-side cards)
├── SensitivityTab.tsx
│   └── IRRHeatmap.tsx (7x7 grid, shared calc engine)
└── PushToProFormaBanner.tsx (blue bar, always visible)
```

### Props Interface
```typescript
interface ExitCapitalModuleProps {
  dealType: DealType;              // from useDealTypeConfig()
  productType?: ProductType;       // for product-specific debt products
  dealId: string;                  // for API calls
}
```

---

## 5. DATA SOURCES (what's mock vs what should be live)

| Data | Current Source | Target Source | Priority |
|---|---|---|---|
| SOFR rate | Hardcoded | FRED API (daily) | P0 |
| Treasury 10Y | Hardcoded | FRED API (daily) | P0 |
| Agency/CMBS/Bridge spreads | Hardcoded | Email-extracted lender quotes | P1 |
| Cap rate trajectory | Hardcoded model | M05 market data + M15 comp sales | P1 |
| Rent growth forward | Hardcoded model | M05 rent trend + M06 demand events | P1 |
| Supply pipeline | Hardcoded | M04 supply agent output | P1 |
| Lender quotes | Mock data | Gmail intelligence extraction | P2 |
| FOMC schedule | Hardcoded | Federal Reserve API / web scrape | P2 |
| Fed dot plot | Hardcoded | Fed SEP releases (quarterly) | P2 |
| Historical rates (10yr) | Hardcoded anchors | FRED API bulk historical | P2 |

---

## 6. FILES TO DELETE AFTER INTEGRATION

These are replaced by the new module:
- `frontend/src/components/deal/sections/DebtTab.tsx` (1,107 lines)
- `frontend/src/components/deal/sections/ExitDrivesCapital.tsx` (636 lines)
- `frontend/src/components/deal/sections/ExitStrategyTabs.tsx` (923 lines)
- `frontend/src/components/deal/sections/DebtCycleChart.tsx` (347 lines)
- `frontend/src/components/deal/sections/DebtProductsChart.tsx` (252 lines)
- `frontend/src/data/capitalStructureMockData.ts` (move useful data to new module)

Total removed: ~3,265 lines replaced by ~1,200 lines of cleaner, typed code.
