# Overview Section Redesign - Development vs Existing Properties

**Date:** February 22, 2026  
**Purpose:** Create two distinct Overview experiences based on deal type

---

## 🏗️ DEVELOPMENT DEALS - Overview & Setup

### Module 1: Site Overview (NEW - replaces "Deal Overview")

**Purpose:** Essential site information for ground-up development

**Data to Show:**

**A. Site Identification**
- **Address/Location** (street, city, zip)
- **Parcel ID(s)** (if multiple parcels for assemblage)
- **Legal Description**
- **Coordinates** (lat/long for mapping)

**B. Site Characteristics**
- **Parcel Size:** X.X acres / X,XXX SF
- **Current Use:** Vacant land / Existing structures to demolish
- **Access:** Street frontage, ingress/egress points
- **Topography:** Flat / Sloped / Mixed (% grade)
- **Utilities Available:** Water, sewer, electric, gas (Yes/No for each)

**C. Acquisition Details**
- **Asking Price:** $X,XXX,XXX ($X/acre or $X/SF)
- **Seller:** Name, type (individual, institution, etc.)
- **Seller Motivation:** High / Medium / Low (from propensity score)
- **Days on Market:** X days
- **Comparable Land Sales:** Recent sales within 1 mile

**D. Development Vision (User Input)**
- **Intended Use:** Multifamily / Mixed-Use / Senior Housing / Student / etc.
- **Target Unit Count:** XXX units (user enters preliminary goal)
- **Target Density:** XX units/acre
- **Development Timeline:** X months (estimated)
- **Total Budget:** $XX,XXX,XXX (rough estimate)

**E. Quick Metrics Dashboard**
```
┌─────────────────────────────────────────┐
│ SITE SNAPSHOT                           │
├─────────────────────────────────────────┤
│ 📍 8.2 acres (357,672 SF)               │
│ 🏗️ Target: 450 units (55 u/acre)       │
│ 💰 $12.5M asking ($1.52M/acre)          │
│ 🎯 Development Budget: ~$85M            │
│ ⏱️ Timeline: 24 months                   │
└─────────────────────────────────────────┘
```

---

### Module 2: Property Boundary & Site Plan (NEW - critical for development!)

**Purpose:** Define exact site boundaries for zoning analysis and 3D design

**Features:**

**A. Interactive Map (Mapbox/Google Maps)**
- Draw property boundary polygon
- Mark points of interest:
  - Existing structures to demolish
  - Easements
  - Setback lines
  - Protected areas (wetlands, floodplain)
  - Access points (driveways, entry)
  - Neighboring parcels (for assemblage consideration)

**B. Boundary Data Capture**
- **Polygon Coordinates:** Array of lat/long points
- **Parcel Area:** Auto-calculated from polygon (acres/SF)
- **Perimeter:** Auto-calculated (linear feet)
- **Upload Survey:** PDF/CAD file upload for reference

**C. Site Constraints Overlay**
- **Zoning Boundaries:** Overlay zoning map
- **Setbacks:** Front/side/rear setback lines
- **Height Planes:** Shadow studies, view corridors
- **Utility Lines:** Water, sewer, electric mains
- **Environmental:** Floodplain, wetlands, steep slopes

**D. Neighboring Context**
- **Adjacent Parcels:** Show owner, current use, size
- **Assemblage Opportunities:** Flag parcels for acquisition
- **Nearby Landmarks:** Parks, schools, transit, retail

**E. Export Formats**
- **GeoJSON:** For 3D Design Builder import
- **DXF/CAD:** For architect/engineer handoff
- **PDF Site Plan:** Printable with measurements

**Visual Mockup:**
```
┌─────────────────────────────────────────┐
│ 🗺️ PROPERTY BOUNDARY EDITOR             │
├─────────────────────────────────────────┤
│  [Map View - Satellite/Street Toggle]  │
│                                          │
│  Tools: [✏️ Draw] [📍 Point] [📏 Measure]│
│         [🗑️ Clear] [💾 Save]             │
│                                          │
│  Boundary Status: ✅ Defined             │
│  Area: 8.2 acres (357,672 SF)           │
│  Perimeter: 2,480 LF                    │
│                                          │
│  Layers:                                 │
│  ☑️ Property Line                        │
│  ☑️ Setbacks (Front 25', Side 15')      │
│  ☐ Zoning Overlay                       │
│  ☐ Floodplain                           │
│  ☑️ Neighboring Parcels                  │
│                                          │
│  [Upload Survey PDF] [Export GeoJSON]   │
└─────────────────────────────────────────┘
```

**Data Output to Other Modules:**
- → **Zoning & Entitlements:** Boundary polygon, setbacks, constraints
- → **3D Design Builder:** GeoJSON boundary, buildable area, height limits
- → **Financial Model:** Parcel size for land cost, developable area

---

### Module 3: Zoning & Entitlements (Enhanced)

**Purpose:** Analyze zoning constraints and development capacity

**Data to Show (using boundary from Module 2):**

**A. Zoning Summary**
- **Current Zoning:** R-5 Residential / Mixed-Use / etc.
- **Allowed Uses:** Multifamily (by-right or conditional)
- **Density Limits:**
  - Max Units/Acre: XX
  - Max FAR (Floor Area Ratio): X.X
  - Max Building Coverage: XX%
- **Height Limits:**
  - Max Stories: X
  - Max Feet: XXX ft
  - Any step-backs or transitions required

**B. Setback Requirements**
- **Front:** XX feet
- **Side:** XX feet (each side)
- **Rear:** XX feet
- **From Adjacent Properties:** XX feet

**C. Buildable Area Calculation**
```
Parcel Size: 8.2 acres (357,672 SF)
- Front Setback (25'): -X SF
- Side Setbacks (15' each): -X SF
- Rear Setback (20'): -X SF
= BUILDABLE AREA: 6.8 acres (296,208 SF) [83% of parcel]

Max Density: 60 units/acre
× Buildable Area: 6.8 acres
= MAX UNITS ALLOWED: 408 units

Max FAR: 2.5
× Parcel Size: 357,672 SF
= MAX BUILDING SF: 894,180 SF
```

**D. Development Capacity (by-right vs with variances)**
```
BY-RIGHT (No Variances):
• Max Units: 408 units
• Max Building SF: 894,180 SF
• Max Height: 6 stories / 75 feet

WITH VARIANCES (Possible):
• Max Units: 500 units (+23% with density bonus)
• Max Building SF: 1,050,000 SF
• Max Height: 8 stories / 95 feet (if transit-adjacent)
```

**E. Entitlement Status**
- **Current Status:** Pre-Application / In Review / Approved
- **Required Approvals:**
  - ☐ Rezoning (if needed)
  - ☐ Site Plan Approval
  - ☐ Traffic Study
  - ☐ Environmental Review
  - ☐ Parking Variance
  - ☐ Public Hearing
- **Estimated Timeline:** X months to entitlements
- **Risk Level:** Low / Medium / High

**F. Comparable Approvals**
- Recent approvals in same zoning district
- Density achieved, timeline, conditions imposed

**Data Output:**
- → **3D Design Builder:** Max units, height limits, buildable area, setbacks
- → **Financial Model:** Entitlement costs, timeline risk

---

### Module 4: Context Tracker (Same - Keep As Is)
- Notes, Activity Timeline, Contacts, Documents, etc.

---

### Module 5: Team & Collaborators (Same - Keep As Is)
- Deal team, architect, engineer, broker, etc.

---

## 🏢 EXISTING PROPERTY DEALS - Overview & Setup

### Module 1: Property Overview (NEW - replaces "Deal Overview")

**Purpose:** Essential property information for acquisition/repositioning

**Data to Show:**

**A. Property Identification**
- **Address:** 123 Main Street, Atlanta, GA 30303
- **Property Name:** Riverside Apartments
- **Property Type:** Multifamily - Garden Style
- **Class:** B / B+ / A- (user selects)
- **Parcel ID:** XXX-XXX-XXX

**B. Physical Characteristics**
- **Units:** 243 units
  - 52 Studios (21%)
  - 128 1BR (53%)
  - 52 2BR (21%)
  - 11 3BR (5%)
- **Year Built:** 1985 (39 years old)
- **Building SF:** 180,000 SF
- **Avg Unit Size:** 740 SF/unit
- **Stories:** 4 stories
- **Parking:** 310 spaces (1.27/unit)
- **Land Area:** 8.2 acres (29.6 units/acre)

**C. Current Operations**
- **Occupancy:** 92% (vs 95% submarket avg)
- **Avg Rent/Unit:** $1,750/month
- **Avg Rent/SF:** $2.36/SF
- **Market Position:** 15% below market ($2.78/SF)
- **Concessions:** 1 month free on 12-month lease
- **Annual Turnover:** 45%

**D. Financial Snapshot**
- **Asking Price:** $37.7M ($155k/unit)
- **Current NOI:** $3.2M
- **Going-In Cap Rate:** 8.5%
- **Current Debt:** $22M (58% LTV)
- **Debt Service:** $1.5M/year (4.5% rate)

**E. Current Owner**
- **Owner:** ABC Properties LLC
- **Portfolio:** 5 properties in Atlanta (1,200 total units)
- **Years Owned:** 12 years
- **Seller Propensity Score:** 72/100 (HIGH - likely to sell!)
- **Out-of-State Owner:** Yes (California-based)

**F. Property Positioning**
```
┌─────────────────────────────────────────┐
│ PROPERTY SNAPSHOT                       │
├─────────────────────────────────────────┤
│ 🏢 243 units • Built 1985 (Class B)     │
│ 📊 92% occupied • $2.36/SF rent         │
│ 💰 $37.7M asking ($155k/unit)           │
│ 📉 15% below market rent = opportunity! │
│ 🎯 Seller Score: 72/100 (HIGH)          │
└─────────────────────────────────────────┘
```

**G. Deal Rationale (User Input)**
- **Investment Thesis:** Value-add repositioning
- **Strategy:** Renovate + raise rents to market
- **Target Hold:** 3-5 years
- **Target IRR:** 18-22%

---

### Module 2: Operational Overview (NEW - replaces "Zoning & Entitlements")

**Purpose:** Current operations and value-add opportunities

**Data to Show:**

**A. Revenue Analysis**
- **Gross Potential Rent:** $5.1M/year (100% occupied at current rents)
- **Actual Revenue:** $4.7M/year (92% occupied)
- **Loss to Lease:** $400k/year (undermarket rents + vacancies)
- **Other Income:** $150k/year (parking, laundry, pet fees)
- **Total Revenue:** $4.85M/year

**B. Expense Breakdown**
- **Operating Expenses:** $2.1M (43% of revenue)
  - Payroll: $600k
  - R&M: $450k
  - Utilities: $380k
  - Insurance: $240k
  - Marketing: $120k
  - Admin: $310k
- **Property Taxes:** $520k (1.4% of value)
  - vs Submarket Avg: 2.1% → BELOW MARKET (good!)
  - Tax Appeal Opportunity: Potential $45k/year savings
- **Net Operating Income:** $2.2M

**C. Occupancy Trends (Last 12 Months)**
```
Jan: 89% → Feb: 90% → Mar: 91% → Apr: 93%
May: 94% → Jun: 95% → Jul: 94% → Aug: 93%
Sep: 92% → Oct: 91% → Nov: 90% → Dec: 92%

Trend: Stable 90-95% range
Peak: June (summer leasing season)
Trough: January (winter)
```

**D. Rent Comp Analysis**
```
Your Property:
• Studio: $1,450/mo ($2.64/SF)
• 1BR: $1,650/mo ($2.36/SF)
• 2BR: $2,100/mo ($2.27/SF)
• Weighted Avg: $1,750/mo ($2.36/SF)

Market Comps (5 within 1 mile):
• Studio: $1,650/mo ($3.00/SF)
• 1BR: $1,900/mo ($2.78/SF)
• 2BR: $2,450/mo ($2.65/SF)
• Weighted Avg: $2,050/mo ($2.78/SF)

OPPORTUNITY: +$300/unit/month = +$876k/year revenue!
```

**E. Capital Needs Assessment**
- **Deferred Maintenance:** $1.2M estimated
  - Roof: $450k (original from 1985)
  - HVAC: $380k (50% of units original)
  - Parking lot: $220k (needs repaving)
  - Exterior paint: $150k
- **Value-Add Renovations:** $3.6M ($15k/unit)
  - Unit interiors: $12k/unit
  - Common areas: $500k
  - Amenities: $400k
- **Total Capex:** $4.8M

**F. Value-Add Opportunity Summary**
```
Current NOI: $2.2M
Stabilized NOI (post-renovation): $4.4M (+100%!)

How?
• Raise rents to market: +$876k/year
• Improve occupancy to 95%: +$150k/year
• Add income (package lockers, storage): +$75k/year
• Reduce expenses (bulk utilities): -$100k/year (savings)
• Tax appeal: +$45k/year (savings)
= TOTAL NOI INCREASE: +$2.2M/year

Exit Value (5.75% cap): $76.5M
Purchase + Capex: $42.5M
Gross Profit: $34M (80% return!)
```

---

### Module 3: Context Tracker (Same - Keep As Is)

---

### Module 4: Team & Collaborators (Same - Keep As Is)

---

## 🎯 Implementation Plan

### Phase 1: Conditional Rendering (Week 1)
1. Add "Deal Type" field to deal creation:
   - ☐ Development (Ground-Up)
   - ☐ Existing Property (Acquisition)
2. Conditional logic in `DealDetailPage.tsx`:
   ```typescript
   const overviewSetupTabs: Tab[] = deal.dealType === 'development' 
     ? developmentOverviewTabs 
     : existingPropertyOverviewTabs;
   ```

### Phase 2: Build Property Boundary Module (Week 2)
1. Create `PropertyBoundarySection.tsx`
2. Integrate Mapbox/Google Maps
3. Polygon drawing tools
4. Data export (GeoJSON, DXF, PDF)
5. Store boundary data in database

### Phase 3: Enhance Zoning Module (Week 3)
1. Pull boundary from Module 2
2. Calculate buildable area, setbacks
3. Max density/FAR calculations
4. Entitlement status tracking

### Phase 4: Update Overview Sections (Week 4)
1. `SiteOverviewSection.tsx` (development)
2. `PropertyOverviewSection.tsx` (existing)
3. `OperationalOverviewSection.tsx` (existing)
4. Connect to backend data sources

---

## 🔄 Data Flow Diagram

```
DEVELOPMENT DEALS:
1. Site Overview → Property Boundary → Zoning & Entitlements → 3D Design Builder
   (basic info)   (define boundary)    (max density)          (design building)

EXISTING PROPERTY DEALS:
1. Property Overview → Operational Overview → Financial Model
   (property details)  (current operations)    (underwriting)
```

---

## 📊 Summary of Changes

**Development Deals Overview (4 modules):**
1. ✅ Site Overview (NEW - replaces Deal Overview)
2. ✅ Property Boundary & Site Plan (NEW - critical addition!)
3. ✅ Zoning & Entitlements (ENHANCED - uses boundary data)
4. ✅ Context Tracker (KEEP)
5. ✅ Team & Collaborators (KEEP)

**Existing Property Overview (4 modules):**
1. ✅ Property Overview (NEW - replaces Deal Overview)
2. ✅ Operational Overview (NEW - replaces Zoning)
3. ✅ Context Tracker (KEEP)
4. ✅ Team & Collaborators (KEEP)

**Key Innovation:**
- Property Boundary module becomes the SOURCE OF TRUTH for site data
- Feeds both Zoning analysis AND 3D Design Builder
- One place to define site, used everywhere

---

**Status:** Ready for Leon's review and feedback! 🚀
