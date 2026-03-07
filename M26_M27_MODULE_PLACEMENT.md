# M26 Tax & M27 Comps - Deal Capsule Module Placement

**Status:** Module tabs added to deal capsule  
**Date:** March 4, 2026  
**Commit:** 6ecde664

---

## Updated Deal Capsule Structure

### Pipeline Deals (Active/In Progress)

```
1.  map
2.  overview
3.  ai-agent
4.  competition
5.  supply
6.  market
7.  comps          ← NEW: M27 Sale Comp Intelligence
8.  tax            ← NEW: M26 Tax Intelligence
9.  financial      (uses M26 tax data)
10. debt
11. strategy
12. due-diligence
13. team
14. documents
15. timeline
16. notes
17. files
18. exit
19. context
```

### Asset Deals (Owned/Closed)

```
1.  map
2.  overview
3.  ai-agent
4.  market
5.  comps          ← NEW: M27 Sale Comp Intelligence
6.  tax            ← NEW: M26 Tax Intelligence
7.  financial      (uses M26 tax data)
8.  strategy
9.  exit
10. team
11. documents
12. timeline
13. notes
14. files
15. context
```

---

## Module Positioning Rationale

### M27 "comps" → Position 7 (after "market")
**Why:**
- Both are market intelligence modules
- Comps provide transactional context for market data
- Natural flow: market fundamentals → actual transaction evidence

**What it shows:**
- Comparable sales grid (DocumentaryStamps → actual prices)
- Transaction patterns (velocity, price migration, buyer rotation)
- Cap rate intelligence (transaction-derived vs broker-quoted)

---

### M26 "tax" → Position 8 (BEFORE "financial")
**Why:**
- Tax is an INPUT to financial models
- Users need to see tax projection before ProForma
- ProForma automatically uses M26 data (opacity without visibility)
- Natural flow: understand tax burden → see impact in ProForma

**What it shows:**
- Tax summary (current vs projected, delta)
- 10-year tax projection (assessment cap trajectory)
- Municipal methodology (how this county assesses)
- Delinquency tracking (distress signals)

---

## Data Flow Through Modules

### Acquisition Workflow:

```
1. User creates deal (sets location)
   └─> M27 auto-generates comp set

2. User sets purchase price
   └─> M26 auto-calculates tax projection

3. User views "comps" tab
   └─> Sees transaction-derived cap rate (5.2%)

4. User views "tax" tab
   └─> Sees projected tax ($877K, +60% from seller's bill)

5. User goes to "financial" tab
   └─> ProForma already shows:
       • OpEx property_tax: $877K (from M26)
       • Exit cap rate: 5.2% (from M27)
       • No manual entry needed
```

---

## Frontend Module Routing

**Expected Routes:**

```typescript
// M27 Sale Comps
/deals/:dealId/comps
  /deals/:dealId/comps/grid           // Comp grid + map
  /deals/:dealId/comps/patterns       // Transaction patterns
  /deals/:dealId/comps/cap-rates      // Cap rate intelligence
  /deals/:dealId/comps/capital-flow   // 1031 tracking
  /deals/:dealId/comps/buyer-intel    // Entity analysis
  /deals/:dealId/comps/distress       // Distress monitor

// M26 Tax
/deals/:dealId/tax
  /deals/:dealId/tax/summary          // Current vs projected
  /deals/:dealId/tax/projection       // 10-year trajectory
  /deals/:dealId/tax/methodology      // County assessment rules
  /deals/:dealId/tax/history          // 5-10 year tax history
  /deals/:dealId/tax/delinquency      // Delinquency status
  /deals/:dealId/tax/comp-tax         // Tax burden vs comps
```

---

## Module Icon Suggestions

**M27 "comps":**
- Icon: `📊` or `💹` or `📈`
- Color: Green (#00D26A)
- Label: "Comps" or "Sale Comps" or "Transactions"

**M26 "tax":**
- Icon: `🏛️` or `💰` or `📋`
- Color: Amber (#F5A623)
- Label: "Tax" or "Tax Intel" or "Property Tax"

---

## API Endpoint Summary

**M27 Comps API:**
```
GET  /api/v1/deals/:dealId/comps
POST /api/v1/deals/:dealId/comps/generate
GET  /api/v1/deals/:dealId/comps/exit-cap-rate
GET  /api/v1/deals/:dealId/comps/summary
```

**M26 Tax API:**
```
GET  /api/v1/deals/:dealId/tax/projection
POST /api/v1/deals/:dealId/tax/projection
GET  /api/v1/deals/:dealId/tax/summary
```

---

## Frontend Implementation Notes

### Module Registration (Frontend)

**File:** (likely `frontend/src/constants/modules.ts` or similar)

```typescript
export const DEAL_MODULES = [
  // ... existing modules ...
  {
    id: 'comps',
    name: 'Sale Comps',
    icon: '📊',
    path: '/comps',
    description: 'Transaction intelligence and pattern detection',
    enabled: true,
    order: 7
  },
  {
    id: 'tax',
    name: 'Tax',
    icon: '🏛️',
    path: '/tax',
    description: 'Property tax intelligence and projections',
    enabled: true,
    order: 8
  },
  // ... financial module (order: 9) ...
];
```

### Module Component Structure

```
frontend/src/components/deals/modules/
  ├── comps/
  │   ├── CompsModule.tsx          // Main container
  │   ├── CompGrid.tsx              // DataGrid + map
  │   ├── PatternAlerts.tsx         // P1-P7 detection cards
  │   ├── CapRateIntel.tsx          // Cap rate charts
  │   └── ...
  └── tax/
      ├── TaxModule.tsx             // Main container
      ├── TaxSummary.tsx            // Current vs projected
      ├── TaxProjection.tsx         // 10-year table/chart
      ├── Methodology.tsx           // Assessment rules
      └── ...
```

---

## User Experience Flow

### First-Time User (New Deal)

1. **Create Deal**
   - Sets location (lat/lon or boundary)
   - Sets purchase price + units
   - System: M27 and M26 auto-trigger in background

2. **Navigates to "comps" tab (position 7)**
   - Sees: "Generating comp set..."
   - After 5-10 seconds: 12 comps appear
   - Learns: Actual sales in area, transaction-derived cap rate

3. **Navigates to "tax" tab (position 8)**
   - Sees: "Current tax: $548K | Projected: $877K | +60%"
   - Learns: Tax will increase significantly on acquisition
   - Can explore: Why? County reassesses to sale price

4. **Navigates to "financial" tab (position 9)**
   - Sees: ProForma already populated with M26/M27 data
   - OpEx line shows $877K tax (not $548K)
   - Exit assumptions show 5.2% cap (not 6.0%)
   - No confusion: Already saw these numbers in previous tabs

---

## Testing Module Visibility

```bash
# Get deal modules
curl https://jedire.replit.app/api/v1/deals/<DEAL_ID>/modules \
  -H "x-api-key: YOUR_KEY"

# Should return:
# [
#   { "module_name": "map", "is_enabled": true },
#   { "module_name": "overview", "is_enabled": true },
#   ...
#   { "module_name": "comps", "is_enabled": true },      ← NEW
#   { "module_name": "tax", "is_enabled": true },        ← NEW
#   { "module_name": "financial", "is_enabled": true },
#   ...
# ]
```

---

## Next Steps for Frontend

**Phase 2 - Week 6 (UI Implementation):**

1. **Module Registration:**
   - Add "comps" and "tax" to frontend module constants
   - Set icons, colors, display names
   - Configure routing

2. **Create Module Containers:**
   - `CompsModule.tsx` - Empty shell with sub-tabs
   - `TaxModule.tsx` - Empty shell with sub-tabs

3. **Build P0 Panels:**
   - `TaxSummary.tsx` - Current vs projected (4 hours)
   - `TaxProjection.tsx` - 10-year table (4 hours)
   - `CompGrid.tsx` - DataGrid + map (8 hours)

4. **Wire to APIs:**
   - Fetch M26 data on tab load
   - Fetch M27 data on tab load
   - Show loading states
   - Handle empty states gracefully

**Estimated Effort:** 16-20 hours for P0 UI

---

**Status:** Backend module registration complete ✅  
**Next:** Frontend implementation  
**Pushed to:** GitHub master (commit: 6ecde664)
