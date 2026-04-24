# JediRe as a Neural Network: Gap Analysis

## The Metaphor

Think of JediRe as a brain that processes information to make underwriting decisions:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         JEDI RE NEURAL ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   DECISIONS     │
                              │   (Outputs)     │
                              │                 │
                              │ • Underwrite?   │
                              │ • At what price?│
                              │ • What risks?   │
                              │ • What strategy?│
                              └────────┬────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
           ┌────────▼────────┐ ┌───────▼───────┐ ┌───────▼───────┐
           │   REASONING     │ │   SYNTHESIS   │ │   EXECUTION   │
           │   (Cortex)      │ │   (Corpus     │ │   (Motor      │
           │                 │ │    Callosum)  │ │    Cortex)    │
           │ • Agents        │ │               │ │               │
           │ • Skills        │ │ • Proforma    │ │ • Reforecast  │
           │ • Collaboration │ │ • Scenarios   │ │ • Disposition │
           │ • Commentary    │ │ • Risk Score  │ │ • Debt Track  │
           └────────┬────────┘ └───────┬───────┘ └───────┬───────┘
                    │                  │                  │
     ┌──────────────┼──────────────────┼──────────────────┼──────────────┐
     │              │                  │                  │              │
┌────▼────┐   ┌─────▼─────┐    ┌───────▼───────┐   ┌──────▼──────┐   ┌──▼──┐
│ MARKET  │   │ PROPERTY  │    │   FINANCIAL   │   │ OPERATIONAL │   │MACRO│
│ SIGNALS │   │ IDENTITY  │    │     DATA      │   │    DATA     │   │DATA │
│         │   │           │    │               │   │             │   │     │
│•Comps   │   │•Municipal │    │•T12/BS/RR     │   │•Traffic     │   │•BLS │
│•CoStar  │   │•Discovery │    │•Debt Terms    │   │•Occupancy   │   │•Fed │
│•Rent    │   │•Matching  │    │•Cap Rates     │   │•Leasing     │   │•CPI │
│•Supply  │   │•Enrichment│    │•NOI           │   │•Renewals    │   │•Jobs│
└────┬────┘   └─────┬─────┘    └───────┬───────┘   └──────┬──────┘   └──┬──┘
     │              │                  │                  │              │
     └──────────────┼──────────────────┼──────────────────┼──────────────┘
                    │                  │                  │
           ┌────────▼──────────────────▼──────────────────▼────────┐
           │                     INGESTION                         │
           │                     (Sensory)                         │
           │                                                       │
           │  • Documents (OM, T12, RR, BS, Debt)                  │
           │  • Emails (Gmail sync, newsletter parsing)            │
           │  • APIs (Municipal, CoStar, Apartments.com)           │
           │  • Archives (Historical deals)                        │
           │  • Manual Entry (Data Library)                        │
           └───────────────────────────────────────────────────────┘
```

---

## Current Pathways (What's Connected)

### ✅ STRONG CONNECTIONS

| From | To | Pathway |
|------|-----|---------|
| Documents | Financial Data | `extraction-pipeline.ts` → `t12-parser.ts` → `data-router.ts` |
| Municipal APIs | Property Info | `property-enrichment/` → `property_info_cache` |
| Rent Scrapers | Market Signals | `rent-scraper.service.ts` → `apartments-com-provider.ts` |
| Archives | Learning | `archive-ingestion.service.ts` → `learning-feedback.service.ts` |
| Traffic | Proforma | `trafficToProFormaService.ts` → `proforma-adjustment.service.ts` |
| Agents | Platform | `agent-orchestrator.ts` → `platform-hooks.ts` |
| Discovery | Matching | `property-discovery.service.ts` → `property-matcher.service.ts` |

### ⚠️ WEAK CONNECTIONS (Need Strengthening)

| From | To | Gap |
|------|-----|-----|
| **Georgia Ingestion** | Property Discovery | Services built, not wired to DB |
| **Property Sales** | Comp Analysis | 927K Cobb sales not flowing to `saleComps/` |
| **Matched Properties** | Data Library | Auto-enrichment stubs not implemented |
| **News** | Deal Alerts | `news.service.ts` → `deal-alert.service.ts` (partial) |
| **Tax Projection** | Proforma | `taxProjection.service.ts` exists but limited state coverage |

### ❌ MISSING CONNECTIONS (Gaps)

| Gap | Impact | Priority |
|-----|--------|----------|
| **1. Sale Comps ↔ Georgia Sales** | 927K sales not available for comp analysis | HIGH |
| **2. Building Permits → Year Built** | DeKalb CO dates not flowing to proforma | HIGH |
| **3. Municipal Zoning → Zoning Service** | `property_info_cache.zoning` not used by `zoning.service.ts` | MEDIUM |
| **4. Owner Name → Contact Database** | Can't track sellers across deals | MEDIUM |
| **5. Market Rent → Rent Growth Assumptions** | Apt Locator data not informing projections | HIGH |
| **6. News Sentiment → Risk Scoring** | Articles don't affect `risk-scoring.service.ts` | MEDIUM |
| **7. Permit Pipeline → Supply Signal** | Building permits = future supply, not tracked | HIGH |
| **8. Tax Assessment → Value Validation** | County values not cross-checked vs. asking price | MEDIUM |
| **9. Historical Sales → Price/SF Trends** | Time-series not built from sales data | HIGH |
| **10. Matched Properties → Competitive Set** | Apt Locator matches not feeding `competitive-set.service.ts` | HIGH |

---

## Gap Details & Solutions

### Gap 1: Sale Comps ↔ Georgia Sales
**Problem**: Cobb has 927K sales back to 2002, but `saleComps/` service doesn't query them.

**Solution**:
```typescript
// In saleComps/compService.ts
async getSaleComps(parcelId: string, county: string, state: string, radius: number) {
  // Query property_sales table
  const sales = await db.query(`
    SELECT ps.*, pic.latitude, pic.longitude, pic.number_of_units
    FROM property_sales ps
    JOIN property_info_cache pic ON ps.parcel_id = pic.parcel_id 
      AND ps.county = pic.county AND ps.state = pic.state
    WHERE ps.county = $1 AND ps.state = $2
      AND ps.sale_date > NOW() - INTERVAL '3 years'
      AND ps.sale_price > 1000000  -- Filter out non-arms-length
    ORDER BY ps.sale_date DESC
  `, [county, state]);
  
  // Filter by distance, calculate $/unit, $/SF
  return this.rankByRelevance(sales, targetProperty);
}
```

### Gap 2: Building Permits → Year Built
**Problem**: DeKalb uses CO permits for year built, but this doesn't flow to deal assumptions.

**Solution**:
```typescript
// In deal-assumptions or proforma-seeder
async resolveYearBuilt(address: string, city: string, state: string) {
  // Check property_info_cache first
  const cached = await this.propertyInfoCache.get(address, city, state);
  if (cached?.yearBuilt) return cached.yearBuilt;
  
  // For DeKalb, query permits directly
  if (cached?.county === 'DeKalb') {
    const permit = await this.dekalbService.searchPermitsByAddress(address);
    if (permit?.cooIssuedDateTime) {
      return new Date(permit.cooIssuedDateTime).getFullYear();
    }
  }
}
```

### Gap 5: Market Rent → Rent Growth Assumptions
**Problem**: Apartment Locator AI rent data exists but doesn't inform rent growth projections.

**Solution**:
```typescript
// In proforma-adjustment.service.ts or rent-growth.service.ts
async calibrateRentGrowth(dealId: string) {
  const deal = await this.getDeal(dealId);
  
  // Get matched Apartment Locator property
  const alProperty = await db.query(`
    SELECT al.* 
    FROM apartment_locator_properties al
    JOIN property_matches pm ON pm.apartment_locator_id = al.id
    WHERE pm.status IN ('confirmed', 'auto_matched')
      AND pm.discovered_property_id IN (
        SELECT id FROM discovered_properties 
        WHERE address ILIKE $1 AND city ILIKE $2
      )
  `, [deal.address, deal.city]);
  
  if (alProperty) {
    // Compare deal assumptions vs. market
    const marketRent = alProperty.avg_asking_rent;
    const dealRent = deal.assumptions.rentPerUnit;
    const delta = (marketRent - dealRent) / dealRent;
    
    // If deal rent is 10%+ below market, flag as upside
    if (delta > 0.10) {
      await this.flagRentUpside(dealId, delta, marketRent);
    }
  }
}
```

### Gap 7: Permit Pipeline → Supply Signal
**Problem**: Building permits represent future supply but aren't tracked.

**Solution**:
```typescript
// New service: permit-supply-signal.service.ts
async getSupplyPipeline(county: string, state: string, submarket?: string) {
  // Query permits from last 24 months
  const permits = await db.query(`
    SELECT 
      DATE_TRUNC('quarter', issue_date) as quarter,
      SUM(number_of_units) as units_permitted,
      COUNT(*) as projects
    FROM building_permits
    WHERE county = $1 AND state = $2
      AND permit_type IN ('NEW', 'MULTIFAMILY')
      AND issue_date > NOW() - INTERVAL '24 months'
    GROUP BY quarter
    ORDER BY quarter
  `, [county, state]);
  
  // Estimate delivery (18-24 months after permit)
  return permits.map(p => ({
    ...p,
    estimated_delivery: addMonths(p.quarter, 20)
  }));
}
```

### Gap 9: Historical Sales → Price/SF Trends
**Problem**: Sales data exists but not aggregated into time-series trends.

**Solution**:
```typescript
// New service: market-trend.service.ts
async getPriceTrends(county: string, state: string, propertyType: string) {
  return db.query(`
    SELECT 
      DATE_TRUNC('quarter', ps.sale_date) as quarter,
      AVG(ps.sale_price / NULLIF(pic.number_of_units, 0)) as avg_price_per_unit,
      AVG(ps.sale_price / NULLIF(pic.living_area_sqft, 0)) as avg_price_per_sf,
      COUNT(*) as transaction_count,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ps.sale_price) as median_price
    FROM property_sales ps
    JOIN property_info_cache pic ON ps.parcel_id = pic.parcel_id
    WHERE ps.county = $1 AND ps.state = $2
      AND pic.property_type = $3
      AND ps.sale_date > NOW() - INTERVAL '5 years'
    GROUP BY quarter
    ORDER BY quarter
  `, [county, state, propertyType]);
}
```

### Gap 10: Matched Properties → Competitive Set
**Problem**: Apartment Locator matches have rent data but don't feed comp set analysis.

**Solution**:
```typescript
// In competitive-set.service.ts
async buildCompSet(dealId: string) {
  const deal = await this.getDeal(dealId);
  
  // Get nearby Apartment Locator properties (already matched)
  const alComps = await db.query(`
    SELECT al.*, 
      ST_Distance(
        ST_SetSRID(ST_MakePoint(al.longitude, al.latitude), 4326),
        ST_SetSRID(ST_MakePoint($3, $4), 4326)
      ) * 111000 as distance_meters
    FROM apartment_locator_properties al
    WHERE al.state = $1
      AND al.total_units BETWEEN $5 * 0.5 AND $5 * 2  -- Similar size
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(al.longitude, al.latitude), 4326),
        ST_SetSRID(ST_MakePoint($3, $4), 4326),
        0.05  -- ~5km
      )
    ORDER BY distance_meters
    LIMIT 10
  `, [deal.state, deal.city, deal.longitude, deal.latitude, deal.units]);
  
  return this.rankAndSelectComps(alComps, deal);
}
```

---

## Cross-Domain Connections Needed

### A. Learning Feedback Loop (Partially Built)
```
Archive Deals → Assumption Benchmarks → New Deal Defaults → Performance Tracking
      ↑                                                              │
      └──────────────── Actual vs. Projected Variance ───────────────┘
```
**Status**: `archive-benchmark-aggregator.ts` + `learning-feedback.service.ts` exist but need actuals ingestion.

### B. Market Intelligence Loop (Gap)
```
News Articles → Sentiment Analysis → Market Risk Score → Deal Risk Adjustment
      ↓                                                          ↑
  Regulatory Changes ────────────────────────────────────────────┘
```
**Gap**: `news.service.ts` doesn't feed `risk-scoring.service.ts`.

### C. Property Identity Resolution (Partially Built)
```
Municipal Parcel → Discovered Property → Matched Apt Locator → Enriched Deal
       │                  │                     │                    │
       └──────────────────┴─────────────────────┴────────────────────┘
                           Property Identity Graph
```
**Gap**: Georgia ingestion → Database not wired.

### D. Supply-Demand Intelligence (Gap)
```
Building Permits → Future Supply → Absorption Model → Rent Growth Forecast
       │                              ↑
Job Growth Data ──────────────────────┘
```
**Gap**: `supply-signal.service.ts` exists but doesn't have permit feed.

---

## Priority Matrix

| Gap | Business Impact | Technical Effort | Priority |
|-----|-----------------|------------------|----------|
| Georgia → DB wiring | Foundation for everything | Medium | P0 |
| Sales → Comp Analysis | Better valuations | Low | P0 |
| Market Rent → Projections | Validate assumptions | Low | P1 |
| Matched → Comp Set | Automated comp sets | Low | P1 |
| Permits → Supply Signal | Market forecasting | Medium | P1 |
| Sales → Price Trends | Time-series analytics | Medium | P2 |
| News → Risk Scoring | Market awareness | Medium | P2 |
| Zoning → Property Cache | Unified property profile | Low | P2 |
| Owner → Contact DB | Relationship tracking | Medium | P3 |

---

## Recommended Wiring Order

### Phase 1: Complete Foundation (This Week)
1. ✅ Georgia ingestion services built
2. ⏳ Wire `saveProperty()` / `saveSales()` to database
3. ⏳ Connect sales data to `saleComps/` service
4. ⏳ Connect matched properties to `competitive-set.service.ts`

### Phase 2: Intelligence Loops (Next Week)
5. Create `market-trend.service.ts` for price/SF time-series
6. Wire Apartment Locator rent data to rent growth calibration
7. Create `permit-supply-signal.service.ts`

### Phase 3: Risk & Learning (Following Week)
8. Connect news sentiment to risk scoring
9. Wire actuals back to learning feedback
10. Build owner/contact relationship graph

---

## The Fully Connected Vision

```
                              ┌─────────────────┐
                              │   DEAL DECISION │
                              │   "Go at $45M"  │
                              └────────┬────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
    ┌─────────▼─────────┐    ┌─────────▼─────────┐    ┌─────────▼─────────┐
    │ AGENT CONSENSUS   │    │ FINANCIAL MODEL   │    │ RISK ASSESSMENT   │
    │ "Acquisition says │    │ IRR: 15.2%        │    │ Score: 72/100     │
    │  buy, CFO says    │    │ MOIC: 1.8x        │    │ - Supply risk: 🟡 │
    │  stretch debt"    │    │ CoC Y1: 6.1%      │    │ - Rate risk: 🟢   │
    └─────────┬─────────┘    └─────────┬─────────┘    └─────────┬─────────┘
              │                        │                        │
    ┌─────────▼─────────────────────────────────────────────────▼─────────┐
    │                         SYNTHESIS LAYER                             │
    │  • Archive benchmarks: Similar deals averaged 14.8% IRR             │
    │  • Learning adjustment: +0.4% for this sponsor type                 │
    │  • Market trend: Rents up 3.2% YoY in submarket                    │
    │  • Supply pipeline: 800 units delivering in 18 months               │
    └───────────────────────────────────┬─────────────────────────────────┘
                                        │
    ┌───────────────────────────────────┼───────────────────────────────┐
    │                                   │                               │
┌───▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐
│PROPERTY│ │ RENT  │ │ SALES │ │PERMITS│ │ NEWS  │ │ MACRO │ │ARCHIVE│
│  INFO  │ │ DATA  │ │ COMPS │ │SUPPLY │ │SIGNAL │ │ ECON  │ │DEALS  │
│        │ │       │ │       │ │       │ │       │ │       │ │       │
│ Year:  │ │ Avg:  │ │$/Unit:│ │ 800   │ │"Major │ │Jobs:  │ │IRR:   │
│ 2005   │ │$1,450 │ │$125K  │ │ units │ │ emp-  │ │+2.1%  │ │14.8%  │
│Units:  │ │Occ:   │ │$/SF:  │ │in 18  │ │ loyer │ │CPI:   │ │Hold:  │
│ 240    │ │ 94%   │ │ $185  │ │months │ │moving"│ │+3.4%  │ │5.2 yr │
└───┬────┘ └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘
    │          │         │         │         │         │         │
    └──────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │      DATA INGESTION         │
                    │  Municipal │ Scrapers │ APIs │
                    │  Documents │ Email   │ News  │
                    └─────────────────────────────┘
```

Every input should trace a path to every decision. That's the fully connected neural network.
