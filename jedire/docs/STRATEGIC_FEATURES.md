# JEDI RE - Strategic Features Roadmap

## Zoning Optimization Features
**Added:** 2026-02-03
**Priority:** HIGH
**Status:** Planned (after development capacity integration completes)

---

## Feature 1: Optimal Zoning Recommender
**Goal:** Tell users the best zoning code to achieve their development goals

### User Input:
- Current property details (lot size, location, current zoning)
- Development goal:
  - Maximize units
  - Maximize square footage
  - Minimize parking requirements
  - Maximize height
  - Minimize setbacks
  - Optimize FAR

### Analysis Process:
1. Load property details
2. Identify all feasible zoning codes for that location
3. Calculate outcomes for each zoning code:
   - Max buildable units
   - Max square footage
   - Parking spaces required
   - Height allowed
   - Buildable area (after setbacks)
4. Rank by user's priority
5. Show trade-offs (e.g., MR-6 = 200 units but 150 parking spaces)

### Example Output:
```
Property: 25,000 sqft lot, Buckhead, currently MR-4A
Goal: Maximize units

RECOMMENDATIONS (Ranked by units):

1. MR-6 (High-rise multifamily)
   - Max Units: 205 units
   - Height: No limit
   - Parking Required: 130 spaces
   - FAR: 6.40
   - Rezoning Feasibility: MODERATE (major corridor location)
   - Trade-offs: High parking demand, expensive construction
   
2. MRC-3 (Mixed-use high-density)
   - Max Units: 180 units (+ 20,000 sqft retail)
   - Height: 225 ft
   - Parking Required: 110 spaces
   - FAR: 7.20 combined (3.2 residential)
   - Rezoning Feasibility: HIGH (commercial corridor)
   - Trade-offs: Must include ground-floor retail
   
3. MR-5A (15-story multifamily)
   - Max Units: 130 units
   - Height: 150 ft
   - Parking Required: 65 spaces
   - FAR: 3.20
   - Rezoning Feasibility: MODERATE
   - Trade-offs: Lower density than MR-6

CURRENT ZONING (MR-4A):
   - Max Units: 60 units
   - Height: 80 ft
   - You're leaving 145 units on the table!

STRATEGY: Apply for rezoning to MR-6 or MRC-3 to unlock maximum potential.
```

### Technical Implementation:
- Function: `recommend_optimal_zoning(property, goal, constraints)`
- Uses all Atlanta zoning rules we've extracted
- Considers:
  - Location-based feasibility (corridor vs residential area)
  - Existing nearby zoning patterns
  - Rezoning probability (based on area character)
- API endpoint: `POST /api/v1/properties/{id}/zoning-recommendations`

---

## Feature 2: Strategic Parcel Recommender
**Goal:** Identify which parcels to acquire to achieve development goals

### User Input:
- Target submarket (e.g., Buckhead)
- Development goal:
  - Target: "Build 500 units"
  - Budget: "$50M land acquisition"
  - Timeline: "18 months to start construction"
- Preferences:
  - Preferred zoning types
  - Minimum/maximum parcel sizes
  - Location constraints (near transit, major roads)

### Analysis Process:
1. Scan all available/developable parcels in submarket
2. Calculate development capacity for each
3. Identify assemblage opportunities (combine adjacent parcels)
4. Score parcels by:
   - Development capacity (units achievable)
   - Rezoning feasibility
   - Location quality (transit access, visibility)
   - Acquisition probability (vacant vs occupied)
   - Cost efficiency (units per dollar)
5. Recommend acquisition strategy

### Example Output:
```
Goal: Build 500 units in Buckhead
Budget: $50M land acquisition

RECOMMENDED STRATEGY: Multi-parcel assemblage

OPTION A: Lenox Corridor Play (HIGHEST POTENTIAL)
├─ Parcel 1: 3350 Lenox Rd (1.03 acres, MR-6)
│  Current: Vacant commercial
│  Capacity: 288 units
│  Est. Cost: $18M ($17.5M/acre)
│  Feasibility: HIGH (vacant, seller motivated)
│
├─ Parcel 2: 3400 Lenox Rd (0.8 acres, MR-5A)
│  Current: Parking lot
│  Capacity: 112 units
│  Est. Cost: $12M ($15M/acre)
│  Feasibility: MODERATE (corporate owner)
│
└─ Parcel 3: 3450 Lenox Rd (0.6 acres, MRC-3)
   Current: Single-story retail
   Capacity: 120 units + retail
   Est. Cost: $10M ($16.7M/acre)
   Feasibility: HIGH (lease expiring)

TOTAL: 520 units, $40M land cost
TIMELINE: 6 months for acquisition, 24 months to deliver
ROI PROJECTION: 18% annualized (based on submarket rents)
RISK LEVEL: MODERATE

OPTION B: Piedmont Road Assemblage (LOWER COST)
[Additional options...]

KEY INSIGHTS:
✓ Lenox corridor offers best unit density
✓ All parcels within 0.3 miles = unified development possible
✓ 20 units above target allows for design optimization
✓ Under budget by $10M = construction cost buffer

NEXT STEPS:
1. Contact broker for 3350 Lenox Rd (highest priority)
2. Request zoning verification for assemblage feasibility
3. Model pro forma with $40M land + $120M construction
```

### Technical Implementation:
- Function: `recommend_parcels(submarket_id, goal, budget, preferences)`
- Requires:
  - Parcel database (property ownership, size, current use)
  - Market value estimates ($/acre by zone)
  - Development capacity calculations
  - Adjacency analysis (identify assemblage opportunities)
- Advanced features:
  - Path-finding algorithm to find optimal parcel combinations
  - Risk scoring (occupied vs vacant, zoning vs rezoning needed)
  - Financial modeling (land + construction + time = ROI)
- API endpoint: `POST /api/v1/submarkets/{id}/parcel-recommendations`

---

## Data Requirements

### For Optimal Zoning Recommender:
- ✅ All Atlanta zoning rules (already have)
- ⚠️ Rezoning probability data (need historical rezoning approvals)
- ⚠️ Location-based feasibility rules (corridor vs residential)

### For Parcel Recommender:
- ⚠️ Parcel ownership database
- ⚠️ Market land values ($/acre by zone)
- ⚠️ Current use/occupancy status
- ⚠️ Parcel adjacency/geometry data (for assemblages)
- ✅ Development capacity calculations (have)

---

## Implementation Plan

### Phase 1: Optimal Zoning Recommender (Week 2)
**Estimated Time:** 2-3 hours
- [ ] Build zoning comparison engine
- [ ] Create ranking algorithm for each goal type
- [ ] Add rezoning feasibility scoring
- [ ] API endpoint + tests
- [ ] UI component showing recommendations

### Phase 2: Basic Parcel Recommender (Week 3)
**Estimated Time:** 4-6 hours
- [ ] Create parcel database schema
- [ ] Load sample parcel data (Buckhead area)
- [ ] Build parcel scoring algorithm
- [ ] Single-parcel recommendations
- [ ] API endpoint + tests

### Phase 3: Advanced Assemblage Logic (Week 4)
**Estimated Time:** 6-8 hours
- [ ] Adjacency detection
- [ ] Combination optimizer (find best N parcels)
- [ ] Financial modeling integration
- [ ] Risk assessment
- [ ] Timeline projections

---

## Example Use Cases

### Use Case 1: Developer Maximizing ROI
**Scenario:** Developer owns 2-acre lot in Buckhead, zoned R-4 (single-family)
**Question:** "What zoning gives me the most units?"
**Answer:** Rezone to MR-6 → 400 units vs 2 units currently
**Action:** File rezoning application, show economic benefit to city

### Use Case 2: Value-Add Acquisition
**Scenario:** Investor looking for under-valued properties
**Question:** "Show me properties where current use doesn't match zoning potential"
**Answer:** 
- 3400 Roswell Rd: Parking lot zoned MRC-2, could be 150-unit tower
- Gap between current income ($0) and potential ($4.5M/year rent)
**Action:** Approach owner with development partnership proposal

### Use Case 3: Land Assembly Strategy
**Scenario:** Institutional developer wants 500+ unit project
**Question:** "Where can I build 500 units in Buckhead for under $50M land cost?"
**Answer:** Lenox Corridor assemblage (3 parcels, 520 units, $40M)
**Action:** Engage brokers for all 3 parcels simultaneously

---

## Success Metrics

### Optimal Zoning Recommender:
- Accuracy: Do recommendations actually increase buildable units/SF?
- Adoption: % of users who request zoning analysis
- Conversion: % who pursue rezoning after recommendation

### Parcel Recommender:
- Relevance: Do recommended parcels meet user goals?
- Actionability: Are recommendations realistic (price, availability)?
- ROI: Do users successfully acquire recommended parcels?

---

## Next Steps

1. ✅ Complete current development capacity integration
2. 🔄 Build Optimal Zoning Recommender (2-3 hours)
3. ⏳ Gather parcel data for Buckhead (manual or automated)
4. ⏳ Build Parcel Recommender (4-6 hours)
5. ⏳ User testing with real scenarios

**Total Time to Complete Both Features:** ~10-15 hours of focused development

---

**Created:** 2026-02-03
**Target Launch:** Week 2-3 of JEDI RE development
**Dependencies:** Development capacity analyzer (completing now)
