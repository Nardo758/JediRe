# DebtTab Exit Strategy Integration — Handoff

## Overview

Add 3 new tabs to existing DebtTab.tsx (1,609 lines) without modifying any existing render functions.

**Current:** 5 tabs (stack | waterfall | debt | rates | metrics)
**After:** 8 tabs (stack | waterfall | debt | rates | exit | sensitivity | monitor | metrics)

## File Placement

```
frontend/src/components/deal/sections/
├── DebtTab.tsx                  ← MODIFY (4 surgical changes)
├── ExitStrategyTabs.tsx         ← NEW FILE (drop in)
```

---

## Change 1: Import (top of file)

```typescript
import {
  ExitWindowsTab,
  SensitivityTab,
  MonitorTab,
  type ExitStrategyConfig,
} from './ExitStrategyTabs';
```

## Change 2: Expand TabId + TABS (line 33-41)

Replace:
```typescript
type TabId = 'stack' | 'debt' | 'rates' | 'metrics' | 'waterfall';
```
With:
```typescript
type TabId = 'stack' | 'debt' | 'rates' | 'metrics' | 'waterfall' | 'exit' | 'sensitivity' | 'monitor';
```

Replace TABS array:
```typescript
const TABS: { id: TabId; label: string; icon: string; isNew?: boolean }[] = [
  { id: 'stack', label: 'Capital Stack', icon: '◈' },
  { id: 'waterfall', label: 'Equity Waterfall', icon: '▽' },
  { id: 'debt', label: 'Debt Products', icon: '◇' },
  { id: 'rates', label: 'Rate Strategy', icon: '◆' },
  { id: 'exit', label: 'Exit Windows', icon: '◉', isNew: true },
  { id: 'sensitivity', label: 'Sensitivity', icon: '∿', isNew: true },
  { id: 'monitor', label: 'Monitor', icon: '◎', isNew: true },
  { id: 'metrics', label: 'Key Metrics', icon: '⬡' },
];
```

## Change 3: Expand tabLoading (line 93)

Replace:
```typescript
{ stack: false, debt: false, rates: false, metrics: false, waterfall: false }
```
With:
```typescript
{ stack: false, debt: false, rates: false, metrics: false, waterfall: false, exit: false, sensitivity: false, monitor: false }
```

## Change 4: Tab Routing (line 1583-1605)

### 4a: Add NEW badge to tab buttons

Inside the TABS.map button, after `{tab.label}` add:
```tsx
{tab.isNew && (
  <span className="ml-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-blue-100 text-blue-600">NEW</span>
)}
```

### 4b: Add 3 new tab routes (after line 1604)

```tsx
{activeTab === 'exit' && (
  <ExitWindowsTab config={{
    baseNOI: financial?.noi || 1920000,
    equityInvested: stack.metrics?.totalEquity || 8000000,
    loanBalance: stack.metrics?.totalDebt || 19200000,
    dealStatus: dealStatus,
  }} />
)}
{activeTab === 'sensitivity' && (
  <SensitivityTab config={{
    baseNOI: financial?.noi || 1920000,
    equityInvested: stack.metrics?.totalEquity || 8000000,
    loanBalance: stack.metrics?.totalDebt || 19200000,
    dealStatus: dealStatus,
  }} />
)}
{activeTab === 'monitor' && (
  <MonitorTab dealStatus={dealStatus} />
)}
```

---

## Change Summary

| # | What | Where | Risk |
|---|------|-------|------|
| 1 | Import | Top of file | None — additive |
| 2 | TabId + TABS | Lines 33-41 | None — extends union |
| 3 | tabLoading | Line 93 | None — adds keys |
| 4a | NEW badge | Tab button | None — conditional |
| 4b | Tab routes | After line 1604 | None — additive branches |

**Zero changes to existing render functions.**

---

## Cross-Module Wiring

| Source | Feeds | Used By |
|--------|-------|---------|
| `financial.noi` | Base NOI from M09 | Projection, sensitivity |
| `stack.metrics.totalEquity` | Equity from layers | IRR/multiple calc |
| `stack.metrics.totalDebt` | Debt from senior+mezz | Net proceeds |
| `dealStatus` | Pipeline vs owned | Monitor visibility |

Capital stack changes → `capital-updated` event → ProForma recalculates → `financial.noi` updates → Exit/Sensitivity auto-recalculate.

---

## Future API Endpoints (when backend ready)

```
POST /api/v1/exit-strategy/projection
  { dealId, strategy, baseNOI, equity, debt, holdPeriod }
  → { annualModel, quarterlyModel, windows, events }

GET  /api/v1/exit-strategy/monitoring/:dealId
  → { currentRSS, drift, rssHistory, actuals, alerts, signals, scenarios }

POST /api/v1/exit-strategy/sensitivity
  { dealId, year, capRates[], rentGrowths[] }
  → { matrix: { cap, growth, irr }[] }
```

Follow existing lazy-load pattern with fetchedTabs ref.

---

## Testing Checklist

- [ ] All 5 existing tabs render unchanged
- [ ] Tab bar shows 8 tabs with NEW badges on exit/sensitivity/monitor
- [ ] Exit Windows: SVG timeline renders, year selector updates gauge + metrics
- [ ] Exit Windows: Window badges clickable, jump to correct year
- [ ] Sensitivity: Matrix renders with blue ring on base case
- [ ] Monitor (pipeline): Placeholder message
- [ ] Monitor (owned): RSS gauge, alerts, signals, scenario cards
- [ ] Capital stack changes → Exit Windows auto-recalculates
