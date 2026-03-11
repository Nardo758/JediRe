# ATLANTA DEVELOPMENT - IMMEDIATE ACTION ITEMS
## Deal ID: e044db04-439b-4442-82df-b36a840f2fd8
## Priority: CRITICAL
## Date: 2026-03-10

---

## 🚨 EXECUTIVE SUMMARY FOR LEADERSHIP

**Bottom Line:** Deal has **4 critical data errors** that invalidate current pro forma and design. Immediate corrections required before proceeding to next stage.

**Financial Impact:** 
- Potential savings: **$7.35M** (unnecessary parking structure)
- Compliance risk: **HIGH** (building design violates 5-story limit)
- Opportunity cost: **$583k SF** of unused FAR allowance

**Status:** ⚠️ **HALT PROGRESSION** until corrections complete

---

## ✅ IMMEDIATE ACTIONS (THIS WEEK)

### ACTION #1: Fix Database Error
**Assigned to:** IT/Database Admin  
**Priority:** 🔴 CRITICAL  
**Deadline:** Within 24 hours

**Task:**
```sql
UPDATE deals 
SET acres = 4.81 
WHERE id = 'e044db04-439b-4442-82df-b36a840f2fd8';
```

**Current:** 30.83 acres (541% error!)  
**Correct:** 4.81 acres  
**Impact:** Fixes all density, FAR, and land cost calculations

**Verification:**
```sql
SELECT id, name, acres, description 
FROM deals 
WHERE id = 'e044db04-439b-4442-82df-b36a840f2fd8';
```

**Sign-off:** _______________  Date: _______________

---

### ACTION #2: Verify Parking Exemption
**Assigned to:** Zoning Consultant / Legal  
**Priority:** 🔴 CRITICAL  
**Deadline:** Within 48 hours

**Tasks:**
1. [ ] Confirm MRC-2-C zoning district designation
2. [ ] Verify BeltLine overlay applies to this parcel
3. [ ] Obtain written confirmation of zero parking requirement
4. [ ] Check if ADA spaces still required (typically 2-5 spaces)
5. [ ] Verify bicycle parking requirements (if any)

**Contact:**
- City of Atlanta Zoning Division: (404) 330-6145
- Planning Department: (404) 330-6070

**Deliverable:** Letter from city confirming parking exemption

**Current Assumption:** ZERO parking required (per deal description)  
**Design Impact:** Eliminates $7.35M parking structure  

**Sign-off:** _______________  Date: _______________

---

### ACTION #3: Revise Building Design
**Assigned to:** Architect  
**Priority:** 🔴 CRITICAL  
**Deadline:** Within 1 week

**Requirements:**
- ✅ Maximum 5 stories (per MRC-2-C)
- ✅ No parking structure (per BeltLine exemption)
- ✅ 300 units total
- ✅ 10.5 ft floor-to-floor minimum
- ✅ 51,000 SF floor plate
- ✅ Amenity program (lobby, fitness, rooftop deck)

**Current Design Issues:**
- ❌ 8 stories total (violates 5-story limit)
- ❌ 2-story parking podium (unnecessary)
- ❌ 9.17 ft floor-to-floor (too low)

**Recommended Design (Scenario B):**
```
5-Story Residential Tower with Amenities
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Roof:     Pool deck, lounge        | 4,500 SF
Floor 5:  58 units                 | 49,300 SF
Floor 4:  58 units                 | 49,300 SF
Floor 3:  58 units                 | 49,300 SF
Floor 2:  58 units                 | 49,300 SF
Floor 1:  58 units + amenities     | 47,300 SF
         + Retail                  | 2,000 SF
Ground:   Surface parking (ADA)    | 5-10 spaces
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL:    290 units | 253,000 SF
```

**Deliverables:**
1. Revised floor plans (all 5 floors)
2. Updated site plan (no parking structure)
3. Revised building elevations
4. Updated unit mix schedule
5. Construction cost estimate

**Sign-off:** _______________  Date: _______________

---

### ACTION #4: Update Financial Model
**Assigned to:** Development Analyst  
**Priority:** 🟠 HIGH  
**Deadline:** Within 1 week

**Tasks:**
1. [ ] Remove $7.35M in parking costs
2. [ ] Update construction budget to ~$77.6M
3. [ ] Recalculate cost per unit (~$268k vs. $260k)
4. [ ] Update rent assumptions (need unit mix)
5. [ ] Revise NOI projections
6. [ ] Rerun returns analysis (IRR, EM, CoC)
7. [ ] Update debt sizing (if needed)

**Required Inputs:**
- ✅ Unit mix breakdown (Studios/1BR/2BR/3BR counts)
- ✅ Target rents by unit type
- ✅ Operating expense assumptions
- ✅ Development timeline
- ✅ Exit cap rate assumption

**Current Status:** Financial model exists (ID: 1, status: "complete") but details unknown

**Action:** Access financial model module and extract:
- Rent roll
- Operating assumptions
- Pro forma projections
- Return metrics

**Sign-off:** _______________  Date: _______________

---

## 🔍 VERIFICATION TASKS (THIS WEEK)

### TASK #1: Get Unit Mix Breakdown
**Assigned to:** Leasing / Development Team  
**Priority:** 🟠 HIGH  

**Current Status:** ❌ NOT IN SYSTEM  
**Need:**
| Type | Count | % | Avg SF | Target Rent |
|------|-------|---|--------|-------------|
| Studio | ? | ?% | ? | $?/mo |
| 1BR | ? | ?% | ? | $?/mo |
| 2BR | ? | ?% | ? | $?/mo |
| 3BR | ? | ?% | ? | $?/mo |

**Where to Check:**
- Unit Mix Intelligence module
- Financial model rent roll
- Leasing team assumptions

**Sign-off:** _______________  Date: _______________

---

### TASK #2: Verify Market Assumptions
**Assigned to:** Market Research / Brokerage  
**Priority:** 🟡 MEDIUM  

**Verify:**
1. [ ] Competitive supply in 1-mile radius
2. [ ] Absorption rates for new multifamily
3. [ ] Comp rents by unit type
4. [ ] Concessions in market
5. [ ] Demand drivers (employment, demographic trends)

**Current Status:** Market analysis module exists but details unknown

**Sign-off:** _______________  Date: _______________

---

### TASK #3: Check 3D Design Module
**Assigned to:** Design Team  
**Priority:** 🟠 HIGH  

**Verify:**
1. [ ] Does 3D model show parking structure?
2. [ ] What is current story count in model?
3. [ ] Are floor-to-floor heights correct?
4. [ ] Is FAR calculation accurate?
5. [ ] Does site plan reflect zero parking?

**Access:** Building 3D Editor tab in platform

**Sign-off:** _______________  Date: _______________

---

### TASK #4: Review Capital Structure
**Assigned to:** Finance Team  
**Priority:** 🟡 MEDIUM  

**Verify:**
1. [ ] Senior debt amount and terms
2. [ ] Equity requirements
3. [ ] LTV ratio
4. [ ] Interest rate assumptions
5. [ ] Return hurdles (IRR, EM, CoC targets)

**Current Status:** Capital structure module exists but details unknown

**Sign-off:** _______________  Date: _______________

---

## 📊 SCENARIO DECISION (NEXT WEEK)

**Team Decision Required:** Which scenario to pursue?

### Option A: Basic (300 units, no amenities)
- **Cost:** $75.5M (under budget)
- **Units:** 300
- **Positioning:** Value/mid-tier
- **Risk:** Lower
- **Returns:** ~6% yield

### Option B: Optimized with Amenities (RECOMMENDED)
- **Cost:** $77.6M (at budget)
- **Units:** 290
- **Positioning:** Premium
- **Risk:** Medium
- **Returns:** ~6.3% yield, better exit cap

### Option C: High-Density (350 units)
- **Cost:** $84.5M (over budget)
- **Units:** 350
- **Positioning:** Value/workforce
- **Risk:** Higher (requires additional capital)
- **Returns:** ~6.7% yield but higher execution risk

**Decision Meeting:** Schedule for _______________  
**Attendees:** Development, Finance, Construction, Leasing  
**Deliverables:** Final unit mix, budget, timeline

---

## 🎯 SUCCESS METRICS

**Week 1:**
- [ ] Database corrected
- [ ] Parking exemption confirmed
- [ ] Design revision started

**Week 2:**
- [ ] Revised design complete
- [ ] Updated budget finalized
- [ ] Unit mix locked
- [ ] Financial model updated

**Week 3:**
- [ ] Scenario decision made
- [ ] Investment committee approval
- [ ] Proceed to permitting

**Week 4:**
- [ ] Permits submitted
- [ ] Construction contracts bid
- [ ] Financing documentation updated

---

## 🚧 RISKS IF NOT ADDRESSED

### Risk #1: Compliance Violation
**If:** Building design proceeds with 8 stories  
**Impact:** 
- Permits denied by city
- $500k+ in redesign costs
- 6+ month delay
- Loss of market timing

### Risk #2: Budget Overrun
**If:** Parking structure proceeds  
**Impact:**
- $7.35M unnecessary spend
- 10% cost overrun
- Reduced returns
- Potential funding gap

### Risk #3: Market Mismatch
**If:** Unit mix not verified  
**Impact:**
- Wrong product for market
- Slower absorption
- Rent concessions required
- Lower NOI than projected

### Risk #4: Data Corruption
**If:** Database acres error not fixed  
**Impact:**
- All downstream calculations wrong
- Comparables mis-selected
- Land cost overstated
- Underwriting invalid

---

## 📞 ESCALATION CONTACTS

**Project Lead:** _______________  
**Development Director:** _______________  
**CFO:** _______________  

**For Issues Contact:**
- Design questions: Architect _______________
- Zoning questions: Zoning Consultant _______________
- Financial questions: Development Analyst _______________
- Database issues: IT Admin _______________

---

## 📝 SIGN-OFF

**Reviewed by:**

Development Team: _______________ Date: _______________  
Finance Team: _______________ Date: _______________  
Construction Team: _______________ Date: _______________  
Legal/Zoning: _______________ Date: _______________  

**Approved to Proceed:**

Project Sponsor: _______________ Date: _______________

---

*Action plan prepared by: Leon AI Assistant*  
*Date: 2026-03-10*  
*Distribution: Project team, Leadership*

---

**NEXT REVIEW:** 1 week from today  
**STATUS REPORT DUE:** Every Friday until complete
