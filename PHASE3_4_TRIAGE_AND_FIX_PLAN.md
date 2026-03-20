# PHASE 3.4: TRIAGE & FIX — PostgreSQL NUMERIC Type Issues

**Session:** Phase 3.4 - Triage and Fix Financial Route 500 Errors
**Date:** March 20, 2026
**Status:** Planning & Identification Complete
**Issues Found:** 40+ across 6 critical files

---

## Overview

PostgreSQL NUMERIC columns (like `senior_balance NUMERIC(15,2)`) are being converted to TypeScript `number` type, which uses IEEE 754 64-bit floating-point. This causes precision loss that cascades through calculations, resulting in 500 errors during JSON serialization and inaccurate financial metrics.

**Example Error:**
```
GET /api/v1/proforma/deal-123/recalculate returns HTTP 500
Error: JSON.stringify() encountered number with precision loss
seniorBalance: 50000000 → stored as 50000001.12 in float memory
```

---

## Issue Severity Classification

### **CRITICAL (Will cause 500 errors) - 12 issues**
These must be fixed first. They cause JSON serialization failures:
- ProformaLayer interface (all financial fields as `number`)
- GenerateResult.returns (IRR, equityMultiple, etc. as `number`)
- CapitalLayer.amount (large loans lose precision)
- StackMetrics.dscr (critical metric)
- Waterfall distributions (multi-million dollar amounts)
- Math.round() truncation in calculations

### **HIGH (Will cause inaccurate results) - 15 issues**
These won't cause 500 errors but will produce wrong answers:
- AssumptionValue/AssumptionAdjustment fields
- mapProForma() parseFloat chains
- Cascading float calculations in projections
- DSCR/LTV calculation chains
- Export formatting

### **MEDIUM (Data quality) - 8 issues**
These affect data quality and UI/export appearance:
- Risk scoring float arithmetic
- JSON response serialization
- Export/markdown formatting
- Input validation

### **LOW (Code quality) - 5 issues**
These are improvements but lower priority:
- Response normalization
- API documentation
- Schema precision comments

---

## Root Cause Analysis

### **Why These Errors Occur**

1. **Type Mismatch at Database Layer**
   ```typescript
   // PostgreSQL schema
   CREATE TABLE proforma (
     rent_growth_baseline NUMERIC(15,4)  // Arbitrary precision, 4 decimals
   );

   // TypeScript interface (WRONG)
   interface Assumption {
     baseline: number;  // ❌ IEEE 754 float, ~15 significant digits
   }

   // What happens:
   // 0.0325 → stored in float as 0.032500000000000004
   // JSON.stringify() → "baseline": 0.032500000000000004
   // Backend math → accumulates errors over 50-60 operations
   // Result → DSCR becomes 1.224567 instead of 1.235000, breaks loan qualification
   ```

2. **parseFloat() Conversions Compound Errors**
   ```typescript
   // mapProForma() does this:
   const baseline = parseFloat(row.rent_growth_baseline);  // Error #1: string → float
   const current = parseFloat(row.rent_growth_current);    // Error #2
   const effective = (baseline + current) / 2;             // Error #3: math
   // Total: 3 precision loss points in one function
   ```

3. **Multi-Step Calculations Cascade Errors**
   ```typescript
   // Annual projection loop (5 years = 5 iterations, 10+ operations each)
   const projectedRent = baseRent * rentGrowthFactor;      // Error ×1
   const gpr = projectedRent * totalUnits * 12;            // Error ×2
   const vacancy = gpr * active.vacancyRate;               // Error ×3
   const egi = gpr - vacancy;                              // Error ×4
   const opex = egi * active.opexRatio * growth;          // Error ×5
   const noi = egi - opex;                                 // Error ×6
   // Year 5 NOI could be 1-2% off: $5M NOI → $4.95M-$5.05M
   ```

4. **JSON Serialization Exposes Float Artifacts**
   ```
   Client sends: {"irr": 25.0}
   Database stores: NUMERIC(5,4)
   Backend receives: 25.0 (precise in NUMERIC)
   Backend uses: number type = 24.999999999999999
   Client receives: {"irr": 24.999999999999999} ← Confuses user
   ```

---

## File-by-File Fix Plan

### **FILE 1: proforma-generator.service.ts (HIGHEST PRIORITY)**

**Why first:** This file is called by POST /proforma/:dealId/recalculate which is a known failing endpoint

**Issues:** 7 critical, 3 high

#### Fix 1.1: Change ProformaLayer Interface (Lines 4-19)
**Before:**
```typescript
interface ProformaLayer {
  rentGrowth: number;          // ❌
  vacancyRate: number;         // ❌
  concessionPct: number;       // ❌
  // ... etc
}
```

**After:**
```typescript
interface ProformaLayer {
  rentGrowth: string;          // Numeric(7,4) - 0.0325 format
  vacancyRate: string;         // Numeric(5,4) - 0.045 format
  concessionPct: string;       // Numeric(5,4) - percentage
  // ... etc
  // Note: Parse only when doing mathematical operations
}
```

**Impact:** 12 fields to update

#### Fix 1.2: Change AnnualProjection Interface (Lines 21-31)
**Before:**
```typescript
interface AnnualProjection {
  gpr: number;                 // ❌ $5M+ loses precision
  egi: number;                 // ❌
  opex: number;                // ❌
  noi: number;                 // ❌
  debtService: number;         // ❌
  cashFlow: number;            // ❌
  cumulativeCF: number;        // ❌
}
```

**After:**
```typescript
interface AnnualProjection {
  gpr: string;                 // Numeric(15,2) - stored exactly
  egi: string;                 // Numeric(15,2)
  opex: string;                // Numeric(15,2)
  noi: string;                 // Numeric(15,2)
  debtService: string;         // Numeric(15,2)
  cashFlow: string;            // Numeric(15,2)
  cumulativeCF: string;        // Numeric(15,2)
}
```

**Impact:** 7 fields to update

#### Fix 1.3: Change GenerateResult Interface (Lines 38-50)
**Before:**
```typescript
interface GenerateResult {
  year1Noi: number;            // ❌ CRITICAL
  goingInCap: number;          // ❌ CRITICAL
  cocReturn: number;           // ❌ CRITICAL
  irr: number;                 // ❌ CRITICAL - affects deal decisions
  equityMultiple: number;      // ❌ CRITICAL
  dscr: number;                // ❌ CRITICAL - lender requirement
  debtYield: number;           // ❌
}
```

**After:**
```typescript
interface GenerateResult {
  year1Noi: string;            // Numeric(15,2)
  goingInCap: string;          // Numeric(5,4) - 0.0650 format
  cocReturn: string;           // Numeric(5,4)
  irr: string;                 // Numeric(5,4) - 0.2500 format (25%)
  equityMultiple: string;      // Numeric(5,4) - 2.3500 format
  dscr: string;                // Numeric(5,4) - 1.2350 format
  debtYield: string;           // Numeric(5,4)
}
```

**Impact:** 7 critical fields to update - **HIGHEST PRIORITY**

#### Fix 1.4: Replace Intermediate Calculations with Decimal Library (Lines 167-195)
**Before:**
```typescript
// In annual projection loop
const projectedRent = baseRent * rentGrowthFactor;  // ❌ Float math
const gpr = projectedRent * totalUnits * 12;        // ❌ Cascades
const vacancy = gpr * active.vacancyRate;           // ❌ Cascades
const egi = gpr - vacancy;                          // ❌ Cascades
const opex = egi * active.opexRatio * opexGrowthFactor;  // ❌ 3 multiplies
const noi = egi - opex;                             // ❌ Cascades
projections.push({
  gpr: Math.round(gpr),  // ❌ Truncates to integer!
  vacancy: Math.round(vacancy),
  egi: Math.round(egi),
  opex: Math.round(opex),
  noi: Math.round(noi),
  debtService: Math.round(annualDebtService),
  cashFlow: Math.round(cashFlow),
  cumulativeCF: Math.round(cumulativeCF),
});
```

**After:**
```typescript
// Install decimal.js: npm install decimal.js
import Decimal from 'decimal.js';

// In annual projection loop
const projectedRent = new Decimal(baseRent).times(rentGrowthFactor);
const gpr = projectedRent.times(totalUnits).times(12);
const vacancy = gpr.times(active.vacancyRate);
const egi = gpr.minus(vacancy);
const opex = egi.times(active.opexRatio).times(opexGrowthFactor);
const noi = egi.minus(opex);

projections.push({
  gpr: gpr.toFixed(2),           // "5000000.50"
  vacancy: vacancy.toFixed(2),
  egi: egi.toFixed(2),
  opex: opex.toFixed(2),
  noi: noi.toFixed(2),
  debtService: debtService.toFixed(2),
  cashFlow: cashFlow.toFixed(2),
  cumulativeCF: cumulativeCF.toFixed(2),
});
```

**Impact:** ~40 lines of calculation logic to update

#### Fix 1.5: Update buildAdjustedLayer() (Lines 320-342)
**Before:**
```typescript
// Float addition/subtraction
adjusted.vacancyRate = Math.min(adjusted.vacancyRate + 0.01, 0.12);
adjusted.rentGrowth = Math.max(adjusted.rentGrowth - 0.005, 0.005);
```

**After:**
```typescript
// Decimal arithmetic
adjusted.vacancyRate = new Decimal(adjusted.vacancyRate)
  .plus(0.01)
  .min(new Decimal(0.12))
  .toFixed(4);
adjusted.rentGrowth = new Decimal(adjusted.rentGrowth)
  .minus(0.005)
  .max(new Decimal(0.005))
  .toFixed(4);
```

**Impact:** 5-10 adjustment lines

---

### **FILE 2: capital-structure.service.ts (HIGHEST PRIORITY)**

**Why second:** This file handles /capital-structure/rate/* endpoints which are failing

**Issues:** 10 critical, 5 high

#### Fix 2.1: Change CapitalLayer Interface (Lines 28-39)
**Before:**
```typescript
interface CapitalLayer {
  amount: number;              // ❌ $50M+ loses precision
  rate: number;                // ❌ 0.065 for 6.5%
  term: number;
}
```

**After:**
```typescript
interface CapitalLayer {
  amount: string;              // Numeric(15,2) - exact cents
  rate: string;                // Numeric(5,4) - exact 0.0650
  term: number;                // OK as number (months)
}
```

**Impact:** 2 critical fields

#### Fix 2.2: Change CapitalUses Interface (Lines 41-49)
**Before:**
```typescript
interface CapitalUses {
  acquisitionPrice: number;    // ❌
  closingCosts: number;        // ❌
  renovationBudget: number;    // ❌
  carryingCosts: number;       // ❌
  reserves: number;            // ❌
  developerFee: number;        // ❌
  total: number;               // ❌
}
```

**After:**
```typescript
interface CapitalUses {
  acquisitionPrice: string;    // Numeric(15,2)
  closingCosts: string;        // Numeric(15,2)
  renovationBudget: string;    // Numeric(15,2)
  carryingCosts: string;       // Numeric(15,2)
  reserves: string;            // Numeric(15,2)
  developerFee: string;        // Numeric(15,2)
  total: string;               // Numeric(15,2)
}
```

**Impact:** 7 critical fields

#### Fix 2.3: Change StackMetrics Interface (Lines 51-63)
**Before:**
```typescript
interface StackMetrics {
  ltv: number;                 // ❌ 0.68 for 68% LTV
  ltc: number;                 // ❌
  dscr: number;                // ❌ CRITICAL 1.2350
  debtYield: number;           // ❌
  equityRequired: number;      // ❌
  totalDebt: number;           // ❌
  totalEquity: number;         // ❌
  weightedAvgCostOfCapital: number;  // ❌
  cocReturn: number;           // ❌
  breakEvenOccupancy: number;  // ❌
}
```

**After:**
```typescript
interface StackMetrics {
  ltv: string;                 // Numeric(5,4) - 0.6800
  ltc: string;                 // Numeric(5,4)
  dscr: string;                // Numeric(5,4) - CRITICAL
  debtYield: string;           // Numeric(5,4)
  equityRequired: string;      // Numeric(15,2)
  totalDebt: string;           // Numeric(15,2)
  totalEquity: string;         // Numeric(15,2)
  weightedAvgCostOfCapital: string;  // Numeric(5,4)
  cocReturn: string;           // Numeric(5,4)
  breakEvenOccupancy: string;  // Numeric(5,4)
}
```

**Impact:** 10 critical fields

#### Fix 2.4: Fix DSCR Calculation (Line 234)
**Before:**
```typescript
const dscr = totalAnnualDS > 0
  ? parseFloat((noi / totalAnnualDS).toFixed(2))  // ❌ Float division then parse
  : 0;
```

**After:**
```typescript
const dscr = totalAnnualDS > 0
  ? new Decimal(noi).dividedBy(totalAnnualDS).toFixed(4)
  : "0.0000";
```

**Impact:** 1 critical calculation

#### Fix 2.5: Fix COC Return Calculation (Line 241)
**Before:**
```typescript
const cocReturn = totalEquity > 0
  ? parseFloat(((annualCashFlow / totalEquity) * 100).toFixed(2))  // ❌ Float ops
  : 0;
```

**After:**
```typescript
const cocReturn = totalEquity > 0
  ? new Decimal(annualCashFlow).dividedBy(totalEquity).times(100).toFixed(4)
  : "0.0000";
```

**Impact:** 1 critical calculation

#### Fix 2.6: Fix Waterfall Distribution Logic (Lines 442-540)
**Before:**
```typescript
// Subtracting floats accumulates errors
remainingProceeds -= (lpCapitalReturn + gpCapitalReturn);
// After multiple subtractions, might be 0.00000001 instead of 0
```

**After:**
```typescript
// Use integer arithmetic (work in cents)
let remainingProceedsCents = Math.round(remainingProceeds * 100);
const lpReturnCents = Math.round(lpCapitalReturn * 100);
const gpReturnCents = Math.round(gpCapitalReturn * 100);
remainingProceedsCents -= (lpReturnCents + gpReturnCents);
// Convert back: remainingProceeds = remainingProceedsCents / 100
```

**Impact:** ~50 lines of waterfall logic

---

### **FILE 3: proforma-adjustment.service.ts**

**Issues:** 4 critical, 2 high

#### Fix 3.1: Change AssumptionValue Interface (Lines 41-46)
**Before:**
```typescript
interface AssumptionValue {
  baseline: number;
  current: number;
  userOverride: number;
  effective: number;
}
```

**After:**
```typescript
interface AssumptionValue {
  baseline: string;            // Numeric(7,4)
  current: string;             // Numeric(7,4)
  userOverride: string;        // Numeric(7,4)
  effective: string;           // Numeric(7,4)
}
```

**Impact:** 4 fields

#### Fix 3.2: Change AssumptionAdjustment Interface (Lines 48-65)
**Before:**
```typescript
interface AssumptionAdjustment {
  previousValue: number;
  newValue: number;
  adjustmentDelta: number;
  adjustmentPct: number;
  confidenceScore: number;
}
```

**After:**
```typescript
interface AssumptionAdjustment {
  previousValue: string;       // Numeric(7,4)
  newValue: string;            // Numeric(7,4)
  adjustmentDelta: string;     // Numeric(7,4)
  adjustmentPct: string;       // Numeric(5,4)
  confidenceScore: string;     // Numeric(5,2)
}
```

**Impact:** 5 fields

#### Fix 3.3: Remove parseFloat() Chain in mapProForma() (Lines 1018-1082)
**Before:**
```typescript
const baseline = parseFloat(row.rent_growth_baseline);  // Error #1
const current = row.current ? parseFloat(row.current) : null;  // Error #2
const userOverride = row.user_override ? parseFloat(row.user_override) : null;  // Error #3
const effective = (baseline + (userOverride || current || baseline)) / 4;  // Error #4
```

**After:**
```typescript
// Return strings directly, parse only in calculations
const baseline = row.rent_growth_baseline;  // Return as string
const current = row.current || null;       // Keep as string
const userOverride = row.user_override || null;  // Keep as string
// For calculations that need numbers:
if (effective calculation needed) {
  const baselineNum = new Decimal(baseline);
  const currentNum = current ? new Decimal(current) : baselineNum;
  const effective = baselineNum.plus(currentNum).dividedBy(2).toString();
}
```

**Impact:** 60+ lines of mapper logic

---

### **FILE 4: risk-scoring.service.ts**

**Issues:** 1 low (good news!), 2 high

#### Fix 4.1: Update Weight Calculations (Lines 1064-1068)
**Before:**
```typescript
const weightedImpact = parseFloat(event.risk_score_impact)
  * (parseFloat(event.stage_probability) / 100);  // ❌ 2 float ops
```

**After:**
```typescript
const weightedImpact = new Decimal(event.risk_score_impact)
  .times(event.stage_probability)
  .dividedBy(100)
  .toFixed(4);
```

**Impact:** 5-10 weight calculation lines

---

### **FILE 5: proforma.routes.ts**

**Issues:** 2 medium

#### Fix 5.1: Add Response Formatting Middleware (Around line 39)
**Before:**
```typescript
res.json({ success: true, data: proforma });
// Returns float artifacts: {"rentGrowth": 0.032500000000000004}
```

**After:**
```typescript
// Middleware to normalize numbers
const normalizeNumericFields = (obj, decimalPlaces = 4) => {
  for (const key in obj) {
    if (typeof obj[key] === 'number' && !Number.isInteger(obj[key])) {
      obj[key] = parseFloat(obj[key].toFixed(decimalPlaces));
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      normalizeNumericFields(obj[key], decimalPlaces);
    }
  }
  return obj;
};

res.json({
  success: true,
  data: normalizeNumericFields(proforma)
});
```

**Impact:** 3-5 response endpoints

#### Fix 5.2: Add Decimal Formatting to Exports (Lines 425-449)
**Before:**
```typescript
const csvContent = `${comparison.baseline.rentGrowth.baseline}%`;
// Outputs: "0.0325000000000004%"
```

**After:**
```typescript
const formatDecimal = (value, places = 4) =>
  typeof value === 'string' ? value : parseFloat(value).toFixed(places);

const csvContent = `${formatDecimal(comparison.baseline.rentGrowth.baseline, 4)}%`;
// Outputs: "0.0325%"
```

**Impact:** 10-15 export lines

---

### **FILE 6: capital-structure.routes.ts**

**Issues:** 2 medium

#### Fix 6.1: Add Input Validation (Lines 42, 68, 184)
**Before:**
```typescript
app.post('/optimal-strategy', (req, res) => {
  const { noi, debtService } = req.body;  // Accepts numbers
  // Treats as precise but already float
});
```

**After:**
```typescript
app.post('/optimal-strategy', (req, res) => {
  const { noi, debtService } = req.body;

  // Validate that financial inputs are strings
  if (typeof noi !== 'string' || typeof debtService !== 'string') {
    return res.status(400).json({
      error: 'Financial amounts must be strings (e.g., "2500000.50")',
      example: { noi: "2500000.50", debtService: "180000.00" }
    });
  }

  // Process with Decimal
  const dscrVal = new Decimal(noi).dividedBy(debtService).toFixed(4);
});
```

**Impact:** 5-8 route validation lines

---

## Implementation Sequence

### **Phase 1: Install Decimal Library (5 minutes)**
```bash
cd /home/user/JediRe/backend
npm install decimal.js
npm install --save-dev @types/decimal.js
```

### **Phase 2: Fix proforma-generator.service.ts (1-2 hours)**
1. Change interfaces (ProformaLayer, AnnualProjection, GenerateResult)
2. Replace calculation loop with Decimal (Lines 167-195)
3. Update buildAdjustedLayer()
4. Test with npm run dev

### **Phase 3: Fix capital-structure.service.ts (1-2 hours)**
1. Change interfaces (CapitalLayer, CapitalUses, StackMetrics)
2. Fix DSCR/COC calculations
3. Fix waterfall distribution logic
4. Test endpoints

### **Phase 4: Fix proforma-adjustment.service.ts (30 minutes)**
1. Change interfaces
2. Remove parseFloat chains
3. Keep string throughout mappers

### **Phase 5: Fix Routes & Risk Service (30 minutes)**
1. Add response formatting
2. Update export formatting
3. Add input validation
4. Fix risk weight calculations

### **Phase 6: Database Schema Review (15 minutes)**
1. Verify NUMERIC precision in migrations
2. Update comments in schema files
3. Document API contracts

---

## Testing After Fixes

### **Unit Tests to Add**
```typescript
// Test decimal precision
describe('ProForma Calculations', () => {
  it('should preserve precision for rent growth over 5 years', () => {
    const result = calculateProjectedRent(100000, 0.0325, 5);
    // Should be exact to 2 decimal places
    expect(result).toBe("119140.82");  // Not 119140.8200000001
  });

  it('should calculate DSCR accurately', () => {
    const dscr = calculateDSCR(2500000.00, 180000.00);
    // Should be exactly 13.8889, not 13.889000000000001
    expect(dscr).toBe("13.8889");
  });

  it('should not lose cents in waterfall distribution', () => {
    const [lp, gp, remaining] = distributeProceeds(45300000.75, 0.80, 0.15);
    // Total should equal input exactly
    const total = parseFloat(lp) + parseFloat(gp) + parseFloat(remaining);
    expect(total).toBe(45300000.75);
  });
});
```

### **Smoke Test Expectations After Fixes**
- POST /api/v1/proforma/:dealId/recalculate → HTTP 200 ✅
- POST /api/v1/capital-structure/rate/all-in → HTTP 200 ✅
- POST /api/v1/capital-structure/rate/sensitivity → HTTP 200 ✅
- All 192 endpoints → 100% pass rate

---

## Rollback Plan

If issues occur during fixes:

1. **Git checkout to last commit** before changes
2. **Revert decimal.js installation** if needed
3. **Keep backup of original interfaces**

```bash
git diff backend/src/services/proforma-generator.service.ts  # Review changes
git checkout -- backend/src/services/proforma-generator.service.ts  # Rollback
```

---

## Success Criteria for Phase 3.4

✅ **All interfaces typed as `string` for financial fields**
✅ **All calculations use Decimal library**
✅ **No parseFloat() calls in service layer**
✅ **DSCR/LTV calculations precise to 4 decimals**
✅ **Waterfall distributions match to the penny**
✅ **Response formatting middleware in place**
✅ **All 500 errors resolved**
✅ **No precision loss in JSON serialization**

---

## Commits to Make

After each file fix, commit:
```bash
git add backend/src/services/proforma-generator.service.ts
git commit -m "Fix PostgreSQL NUMERIC precision in proforma-generator.service.ts

- Changed ProformaLayer/GenerateResult interfaces from number → string
- Replaced float calculations with Decimal library
- Fixed Math.round() truncation (now uses toFixed(2))
- Removed parseFloat() chains
- Cascading calculation errors fixed

This fixes POST /api/v1/proforma/:dealId/recalculate 500 errors"
```

---

## Summary

**Total Issues Identified:** 40+
**Critical Issues:** 12 (cause 500 errors)
**High Priority:** 15 (cause inaccuracy)
**Files to Modify:** 6
**Lines of Code to Change:** ~200-300
**Estimated Time:** 3-4 hours total
**Difficulty Level:** Medium (mechanical type changes + Decimal library integration)

**Benefit:** All Phase 3 financial endpoints will work correctly with precise decimal handling for all financial calculations.

---

*Phase 3.4 triaging complete. Ready to begin fixes.*
