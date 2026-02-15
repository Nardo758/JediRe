# Migration 025: Actionable Property Data

**Created:** Feb 15, 2026 09:28 EST  
**File:** `backend/migrations/025_actionable_property_data.sql`  
**Size:** 25.4 KB  
**Status:** Ready to run  
**Philosophy:** Only data that changes underwriting decisions

---

## 🎯 What This Adds (5 Critical Tables)

### **1. `property_violations`** 🚨
**Why:** Red flags during due diligence  
**Impact:** Deal breakers, repair costs, NOI reduction

**Key Fields:**
- Violation type, severity, status
- Fine amounts & outstanding balances
- Estimated repair costs
- Affects occupancy? (critical!)
- Units affected (can't be rented)
- Abatement orders
- Daily penalties

**Example Impact:**
```
Property has 8 open violations:
- 3 Critical (structural) = $150K repair estimate
- 2 affect occupancy = 12 units offline = -$36K/mo lost rent
- $25K in outstanding fines
Total one-time cost: $175K + lost rent
```

---

### **2. `property_liens`** 💰
**Why:** Hidden debt that transfers with property  
**Impact:** Direct hit to purchase price + NOI

**Key Fields:**
- Lien type (tax, mechanic, HOA, utility, judgment)
- Lien holder & amount
- Priority position
- Foreclosure status
- Payment plans
- Requires payoff at closing?

**Example Impact:**
```
Active liens:
- Tax lien: $75K (payoff required at closing)
- Mechanic's lien: $28K (contractor dispute)
- Special assessment: $12K/year (ongoing)
Total: $103K one-time + $12K/year NOI hit
```

---

### **3. `special_districts`** 📊
**Why:** Ongoing annual costs NOT in tax records  
**Impact:** NOI reduction for 5-10+ years

**Key Fields:**
- District type (TIF, BID, CID, Mello-Roos, CFD)
- Annual assessment amount
- Assessment per unit
- Years remaining
- Sunset date
- Can be prepaid?
- Escalates annually?

**Example Impact:**
```
Property in BID (Business Improvement District):
- Annual assessment: $8,500
- Years remaining: 10 years
- Total obligation: $85K
- NPV @ 5%: $65,700
- Buyer discount: ~$70K off purchase price
```

---

### **4. `flood_zones`** 🌊
**Why:** Flood insurance can be $15K-50K+/year  
**Impact:** NOI reduction + financing risk

**Key Fields:**
- FEMA zone (A, AE, VE, X, etc.)
- In 100-year floodplain?
- Insurance required?
- Estimated annual premium
- Premium per unit
- Historical flood events
- Sea level rise risk

**Example Impact:**
```
Property in Zone AE (100-year floodplain):
- Flood insurance required by lender
- Estimated premium: $35,000/year
- 171 units = $205/unit/year
- 5-year NOI impact: $175,000
- At 5% cap: -$700K property value
```

---

### **5. `planned_developments`** 🏗️
**Why:** Future competition or value drivers  
**Impact:** Future NOI, exit strategy, market timing

**Key Fields:**
- Project type, size (units/sqft)
- Development stage (proposed → under construction)
- Estimated completion date
- Distance from subject
- Impact type (competition vs amenity)
- Developer, financing
- Is direct competition?
- Target rents & demographics

**Example Impact:**
```
3 competing projects within 2 miles:
- Project A: 350 units, delivering Q3 2026 (6 months)
- Project B: 280 units, delivering Q1 2027 (12 months)
- Project C: 420 units, delivering Q2 2027 (15 months)
Total new supply: 1,050 units (117% of subject)
Risk: High concessions, slower lease-up, rent pressure
Action: Negotiate purchase price down 10-15%
```

---

## 📊 New Views (5 Actionable Reports)

### **1. `critical_violations`**
Open violations requiring immediate attention:
- Critical/Major severity
- Affects occupancy
- Abatement orders
- Sorted by urgency

### **2. `active_liens_summary`**
Total lien burden per property:
- Total liens count
- Total amount due
- Tax liens (separate)
- Foreclosure risk amount

### **3. `special_district_impact`**
Special assessments with NOI impact:
- Annual cost
- Years remaining
- Total remaining obligation
- Impact per unit

### **4. `high_flood_risk_properties`**
Properties with significant flood exposure:
- In 100-year floodplain
- High risk designation
- Historical flood events
- Insurance costs

### **5. `competing_developments`**
Active competing projects:
- Delivery date (nearest first)
- Distance from subject
- Direct competition flag
- Target rents

---

## 🛠️ New Functions (2 Calculators)

### **1. `calculate_noi_impact(property_id)`**
Complete NOI impact from all sources:

**Returns:**
- Violations: Repair costs + fines
- Liens: Total payoff required
- Special districts: Annual assessment
- Flood insurance: Annual premium
- **Total one-time costs**
- **Total annual costs**
- **5-year NOI impact**

**Example:**
```sql
SELECT * FROM calculate_noi_impact('property-uuid');

-- Returns:
violations_repair_cost:  $150,000
violations_fines:         $25,000
active_liens_total:      $103,000
special_assessments:       $8,500/yr
flood_insurance:          $35,000/yr
-----------------------------------------
total_one_time_cost:     $278,000
total_annual_cost:        $43,500/yr
noi_impact_5yr:          $217,500
```

### **2. `get_nearby_developments(lat, lng, radius, type)`**
Find planned developments within radius:

**Example:**
```sql
SELECT * FROM get_nearby_developments(
  33.8490,  -- latitude
  -84.3880, -- longitude
  2,        -- 2 mile radius
  'Multifamily' -- filter
);

-- Returns competing projects sorted by distance
```

---

## 🚀 How to Run

**After running Migration 024:**

```bash
psql postgresql://postgres:password@helium/heliumdb?sslmode=disable \
  -f migrations/025_actionable_property_data.sql
```

**Time:** ~15 seconds

---

## ✅ Verification

```sql
-- Check new tables
SELECT table_name FROM information_schema.tables 
WHERE table_name IN (
  'property_violations',
  'property_liens',
  'special_districts',
  'flood_zones',
  'planned_developments'
);

-- Check new views
SELECT table_name FROM information_schema.views 
WHERE table_name LIKE '%violations%' 
   OR table_name LIKE '%liens%'
   OR table_name LIKE '%district%'
   OR table_name LIKE '%flood%'
   OR table_name LIKE '%development%';

-- Test NOI impact calculator
SELECT * FROM calculate_noi_impact('test-property-uuid');
```

---

## 📋 Sample Queries

### Get complete property risk profile:
```sql
WITH base AS (
  SELECT * FROM property_records WHERE id = 'property-uuid'
),
violations AS (
  SELECT COUNT(*) AS count, SUM(estimated_repair_cost) AS cost
  FROM property_violations
  WHERE property_record_id = (SELECT id FROM base)
  AND status = 'Open'
),
liens AS (
  SELECT COUNT(*) AS count, SUM(total_amount_due) AS amount
  FROM property_liens
  WHERE property_record_id = (SELECT id FROM base)
  AND status = 'Active'
),
noi AS (
  SELECT * FROM calculate_noi_impact((SELECT id FROM base))
)
SELECT 
  b.address,
  v.count AS open_violations,
  v.cost AS violation_costs,
  l.count AS active_liens,
  l.amount AS lien_amount,
  n.total_one_time_cost,
  n.total_annual_cost,
  n.noi_impact_5yr
FROM base b, violations v, liens l, noi n;
```

### Find competing developments:
```sql
SELECT * FROM get_nearby_developments(
  33.8490,  -- subject property lat
  -84.3880, -- subject property lng
  3,        -- 3 mile radius
  'Multifamily'
)
WHERE estimated_completion_date <= CURRENT_DATE + INTERVAL '18 months';
```

### Properties with multiple risk factors:
```sql
SELECT 
  pr.address,
  pr.city,
  (SELECT COUNT(*) FROM property_violations pv 
   WHERE pv.property_record_id = pr.id AND pv.status = 'Open') AS violations,
  (SELECT COUNT(*) FROM property_liens pl 
   WHERE pl.property_record_id = pr.id AND pl.status = 'Active') AS liens,
  (SELECT COUNT(*) FROM special_districts sd 
   WHERE sd.property_record_id = pr.id AND sd.status = 'Active') AS districts,
  (SELECT COUNT(*) FROM flood_zones fz 
   WHERE fz.property_record_id = pr.id AND fz.in_100_year_floodplain = TRUE) AS flood_risk
FROM property_records pr
WHERE 
  (SELECT COUNT(*) FROM property_violations pv WHERE pv.property_record_id = pr.id AND pv.status = 'Open') > 0
  OR (SELECT COUNT(*) FROM property_liens pl WHERE pl.property_record_id = pr.id AND pl.status = 'Active') > 0
  OR (SELECT COUNT(*) FROM special_districts sd WHERE sd.property_record_id = pr.id AND sd.status = 'Active') > 0
  OR (SELECT COUNT(*) FROM flood_zones fz WHERE fz.property_record_id = pr.id AND fz.in_100_year_floodplain = TRUE) > 0;
```

---

## 🎯 Decision Framework

**Include this data in underwriting if it affects:**
1. ✅ **Offer price** - Liens, violations, flood insurance
2. ✅ **NOI** - Special assessments, violations, insurance
3. ✅ **Deal viability** - Critical violations, foreclosure risk
4. ✅ **Exit strategy** - Competing supply, zoning limits
5. ✅ **Financing** - Liens, flood zones

**Example Underwriting Adjustment:**

```
Original offer:        $52,000,000
Less:
- Violations repair:      -$150,000
- Liens payoff:           -$103,000
- 5yr NOI impact:         -$217,500 / 0.05 = -$4,350,000
- Competition discount:   -$5,200,000 (10%)
                        ─────────────
Adjusted offer:        $42,197,000

Savings: $9.8M (18.8% discount!)
```

---

## 🔗 Integration Points

**Market Research Engine:**
- Query violations/liens/districts during deal analysis
- Calculate total NOI impact
- Include in JEDI Score risk factors

**Property Records Tab:**
- Display violations in "Risk Factors" section
- Show lien summary with payoff amounts
- Map nearby competing developments
- Flood zone badge with insurance costs

**Financial Model:**
- Auto-import special assessment costs
- Factor in flood insurance
- Adjust pro forma for violation repairs
- Include lien payoff in acquisition costs

---

## 📈 Data Sources

**Where to scrape this data:**

1. **Violations:** County building department, code enforcement
2. **Liens:** County clerk, recorder's office, tax collector
3. **Special Districts:** County/city finance department, special district websites
4. **Flood Zones:** FEMA Flood Map Service Center, county GIS
5. **Planned Developments:** City planning department, zoning board minutes

---

## 🎯 Next Steps

1. ✅ Run Migration 025
2. ⏳ Build scrapers for each data source
3. ⏳ Integrate with Market Research Engine
4. ⏳ Add to Property Records Tab UI
5. ⏳ Create underwriting adjustment calculator

---

**Status:** ✅ Ready to run  
**Est. Time:** ~15 seconds  
**Dependencies:** Migration 024 must be run first

**This migration adds the MOST ACTIONABLE municipal data available!** 🎯

