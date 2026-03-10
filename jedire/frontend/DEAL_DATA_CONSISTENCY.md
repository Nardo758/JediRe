# Deal Data Consistency Strategy

## Problem Statement

Deal details must be accurate and consistent across all modules (capsules) throughout the entire deal lifecycle:
- Signal Intake → Intelligence Assembly → Underwriting → Deal Packaging → Post-Close

**Key Issues:**
1. Data entered in one module doesn't flow to dependent modules
2. Calculated values (e.g., cap rate, NOI) may be stale or incorrect
3. No validation when data is missing or invalid
4. Multiple "sources of truth" for the same data point
5. Changes in one tab don't trigger updates in others

---

## Solution: Multi-Layer Validation System

### **Layer 1: Schema Validation (Type Safety)**

Create TypeScript interfaces that define the complete deal structure:

```typescript
// jedire/frontend/src/types/dealSchema.ts

export interface DealSchema {
  // Core Identity
  id: string;
  name: string;
  status: DealStatus;
  state: DealState;
  tier: 'basic' | 'pro' | 'enterprise';
  
  // Property Details (SOURCE: Overview module)
  property: {
    address: string;
    city: string;
    state: string;
    zip: string;
    propertyType: PropertyType;
    yearBuilt?: number;
    units?: number;
    totalSqft?: number;
    lotSize?: number; // acres
    zoningCode?: string;
    // Validation: Required for UNDERWRITING stage
    requiredForUnderwriting: ['units', 'totalSqft', 'lotSize', 'zoningCode'];
  };
  
  // Financial Details (SOURCE: Financial module)
  financials: {
    askingPrice?: number;
    estimatedValue?: number;
    landCost?: number;
    hardCosts?: number;
    softCosts?: number;
    totalDevelopmentCost?: number;
    noi?: number;
    capRate?: number;
    irr?: number;
    equityMultiple?: number;
    // Validation: Required for DEAL_PACKAGING stage
    requiredForPackaging: ['totalDevelopmentCost', 'noi', 'irr'];
  };
  
  // Zoning/Capacity (SOURCE: Zoning module)
  zoning: {
    maxUnits?: number;
    maxGba?: number;
    appliedFar?: number;
    maxStories?: number;
    bindingConstraint?: string;
    parkingRequired?: number;
    // Validation: Required for INTELLIGENCE_ASSEMBLY stage
    requiredForIntelligence: ['maxUnits', 'appliedFar'];
  };
  
  // Development Program (SOURCE: Overview > DevPath selection)
  developmentProgram?: {
    selectedPathId: string; // P1, P2, P3
    pathLabel: string;
    units: number;
    totalSqft: number;
    unitMix: UnitMixEntry[];
    revenue: {
      monthly: number;
      annual: number;
    };
    // Validation: Must match zoning.maxUnits constraint
    validationRules: {
      unitsWithinZoning: boolean; // units <= zoning.maxUnits
      unitMixTotals100: boolean; // sum of unitMix percentages = 100%
    };
  };
  
  // Market Data (SOURCE: Market Intelligence module)
  market: {
    occupancy?: number;
    avgRent?: number;
    rentGrowth?: number;
    supplyPipeline?: number;
    demandScore?: number;
    // These should PULL from developmentProgram
    linkedUnits?: number; // = developmentProgram.units
    linkedSqft?: number; // = developmentProgram.totalSqft
  };
  
  // Metadata
  lifecycle: {
    stage: DealStage; // SIGNAL_INTAKE, INTELLIGENCE_ASSEMBLY, etc.
    lastUpdated: Date;
    lastValidated: Date;
    validationErrors: ValidationError[];
  };
}

export interface ValidationError {
  module: string; // 'overview' | 'financials' | 'zoning' | 'market'
  field: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  blockingStage?: DealStage; // Which stage this blocks
}

export type DealStage = 
  | 'SIGNAL_INTAKE'
  | 'INTELLIGENCE_ASSEMBLY'
  | 'TRIAGE'
  | 'UNDERWRITING'
  | 'DEAL_PACKAGING'
  | 'POST_CLOSE';

export type DealStatus = 
  | 'active' | 'lead' | 'under_contract' 
  | 'qualified' | 'closed_won' | 'due_diligence';

export type PropertyType = 
  | 'multifamily' | 'residential' | 'retail' 
  | 'office' | 'industrial' | 'mixed_use' 
  | 'townhome' | 'senior_living' | 'land';
```

---

### **Layer 2: Validation Rules Engine**

```typescript
// jedire/frontend/src/services/dealValidation.ts

import { DealSchema, ValidationError, DealStage } from '@/types/dealSchema';

export class DealValidator {
  
  /**
   * Validate entire deal against current stage requirements
   */
  static validateDeal(deal: DealSchema): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Stage-specific validation
    switch (deal.lifecycle.stage) {
      case 'SIGNAL_INTAKE':
        errors.push(...this.validateSignalIntake(deal));
        break;
      case 'INTELLIGENCE_ASSEMBLY':
        errors.push(...this.validateIntelligenceAssembly(deal));
        break;
      case 'UNDERWRITING':
        errors.push(...this.validateUnderwriting(deal));
        break;
      case 'DEAL_PACKAGING':
        errors.push(...this.validateDealPackaging(deal));
        break;
    }
    
    // Cross-module consistency checks (always run)
    errors.push(...this.validateCrossModuleConsistency(deal));
    
    return errors;
  }
  
  /**
   * SIGNAL_INTAKE: Basic property info required
   */
  private static validateSignalIntake(deal: DealSchema): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (!deal.name) {
      errors.push({
        module: 'overview',
        field: 'name',
        severity: 'error',
        message: 'Deal name is required',
        blockingStage: 'SIGNAL_INTAKE'
      });
    }
    
    if (!deal.property.address) {
      errors.push({
        module: 'overview',
        field: 'property.address',
        severity: 'error',
        message: 'Property address is required',
        blockingStage: 'SIGNAL_INTAKE'
      });
    }
    
    return errors;
  }
  
  /**
   * INTELLIGENCE_ASSEMBLY: Zoning + market data required
   */
  private static validateIntelligenceAssembly(deal: DealSchema): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (!deal.zoning.maxUnits) {
      errors.push({
        module: 'zoning',
        field: 'maxUnits',
        severity: 'error',
        message: 'Maximum buildable units required for intelligence assembly',
        blockingStage: 'INTELLIGENCE_ASSEMBLY'
      });
    }
    
    if (!deal.zoning.appliedFar) {
      errors.push({
        module: 'zoning',
        field: 'appliedFar',
        severity: 'warning',
        message: 'FAR should be defined for accurate capacity analysis'
      });
    }
    
    return errors;
  }
  
  /**
   * UNDERWRITING: Full property details + financials
   */
  private static validateUnderwriting(deal: DealSchema): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Property details
    const requiredProps = ['units', 'totalSqft', 'lotSize', 'zoningCode'];
    requiredProps.forEach(field => {
      if (!deal.property[field]) {
        errors.push({
          module: 'overview',
          field: `property.${field}`,
          severity: 'error',
          message: `${field} is required for underwriting`,
          blockingStage: 'UNDERWRITING'
        });
      }
    });
    
    // Financial data
    if (!deal.financials.noi) {
      errors.push({
        module: 'financials',
        field: 'noi',
        severity: 'error',
        message: 'NOI calculation required for underwriting',
        blockingStage: 'UNDERWRITING'
      });
    }
    
    return errors;
  }
  
  /**
   * DEAL_PACKAGING: Complete financial model + returns
   */
  private static validateDealPackaging(deal: DealSchema): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (!deal.financials.irr) {
      errors.push({
        module: 'financials',
        field: 'irr',
        severity: 'error',
        message: 'IRR projection required for deal packaging',
        blockingStage: 'DEAL_PACKAGING'
      });
    }
    
    if (!deal.financials.equityMultiple) {
      errors.push({
        module: 'financials',
        field: 'equityMultiple',
        severity: 'error',
        message: 'Equity multiple required for investor presentation',
        blockingStage: 'DEAL_PACKAGING'
      });
    }
    
    return errors;
  }
  
  /**
   * CROSS-MODULE CONSISTENCY: Ensure data flows correctly
   */
  private static validateCrossModuleConsistency(deal: DealSchema): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Check: Development program units <= Zoning max units
    if (deal.developmentProgram && deal.zoning.maxUnits) {
      if (deal.developmentProgram.units > deal.zoning.maxUnits) {
        errors.push({
          module: 'overview',
          field: 'developmentProgram.units',
          severity: 'error',
          message: `Selected path has ${deal.developmentProgram.units} units, exceeds zoning max of ${deal.zoning.maxUnits}`,
        });
      }
    }
    
    // Check: Market intelligence has correct linked units
    if (deal.developmentProgram && deal.market.linkedUnits) {
      if (deal.market.linkedUnits !== deal.developmentProgram.units) {
        errors.push({
          module: 'market',
          field: 'linkedUnits',
          severity: 'warning',
          message: `Market Intelligence shows ${deal.market.linkedUnits} units, but development program is ${deal.developmentProgram.units}. Data may be stale.`,
        });
      }
    }
    
    // Check: Unit mix percentages total 100%
    if (deal.developmentProgram?.unitMix) {
      const totalPct = deal.developmentProgram.unitMix.reduce((sum, u) => {
        const pct = parseFloat(u.pct.replace('%', ''));
        return sum + pct;
      }, 0);
      
      if (Math.abs(totalPct - 100) > 0.1) {
        errors.push({
          module: 'overview',
          field: 'developmentProgram.unitMix',
          severity: 'error',
          message: `Unit mix percentages total ${totalPct}%, must equal 100%`,
        });
      }
    }
    
    // Check: Financial calculations are consistent
    if (deal.financials.askingPrice && deal.property.units) {
      const pricePerUnit = deal.financials.askingPrice / deal.property.units;
      if (pricePerUnit < 50000 || pricePerUnit > 500000) {
        errors.push({
          module: 'financials',
          field: 'askingPrice',
          severity: 'warning',
          message: `Price per unit ($${Math.round(pricePerUnit).toLocaleString()}) seems unusual. Please verify.`,
        });
      }
    }
    
    return errors;
  }
  
  /**
   * Check if deal can advance to next stage
   */
  static canAdvanceStage(deal: DealSchema, targetStage: DealStage): {
    canAdvance: boolean;
    blockingErrors: ValidationError[];
  } {
    const errors = this.validateDeal(deal);
    const blockingErrors = errors.filter(e => 
      e.severity === 'error' && 
      e.blockingStage && 
      this.isStageBeforeOrEqual(e.blockingStage, targetStage)
    );
    
    return {
      canAdvance: blockingErrors.length === 0,
      blockingErrors
    };
  }
  
  private static isStageBeforeOrEqual(stage1: DealStage, stage2: DealStage): boolean {
    const stageOrder: DealStage[] = [
      'SIGNAL_INTAKE',
      'INTELLIGENCE_ASSEMBLY',
      'TRIAGE',
      'UNDERWRITING',
      'DEAL_PACKAGING',
      'POST_CLOSE'
    ];
    return stageOrder.indexOf(stage1) <= stageOrder.indexOf(stage2);
  }
}
```

---

### **Layer 3: Real-Time Validation UI Component**

```typescript
// jedire/frontend/src/components/deal/DealValidationPanel.tsx

import React, { useEffect, useState } from 'react';
import { DealValidator } from '@/services/dealValidation';
import { useDealModule } from '@/contexts/DealModuleContext';
import { AlertCircle, AlertTriangle, Info, CheckCircle } from 'lucide-react';

export const DealValidationPanel: React.FC<{ deal: any }> = ({ deal }) => {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [canAdvance, setCanAdvance] = useState(true);
  
  useEffect(() => {
    // Re-validate whenever deal data changes
    const validationResults = DealValidator.validateDeal(deal);
    setErrors(validationResults);
    
    const nextStage = getNextStage(deal.lifecycle.stage);
    if (nextStage) {
      const { canAdvance, blockingErrors } = DealValidator.canAdvanceStage(deal, nextStage);
      setCanAdvance(canAdvance);
    }
  }, [deal]);
  
  const errorCount = errors.filter(e => e.severity === 'error').length;
  const warningCount = errors.filter(e => e.severity === 'warning').length;
  
  if (errors.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-green-600" />
        <div>
          <div className="font-semibold text-green-900">All Validations Passed</div>
          <div className="text-sm text-green-700">Deal data is complete and consistent</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className={`border rounded-lg p-4 ${
        errorCount > 0 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {errorCount > 0 ? (
              <AlertCircle className="w-5 h-5 text-red-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            )}
            <div>
              <div className="font-semibold text-gray-900">
                {errorCount} Error{errorCount !== 1 && 's'}, {warningCount} Warning{warningCount !== 1 && 's'}
              </div>
              <div className="text-sm text-gray-600">
                {canAdvance 
                  ? 'Can advance to next stage' 
                  : 'Must resolve errors before advancing'}
              </div>
            </div>
          </div>
          {!canAdvance && (
            <button 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              onClick={() => {/* Jump to first error */}}
            >
              Fix Issues
            </button>
          )}
        </div>
      </div>
      
      {/* Error List */}
      <div className="space-y-2">
        {errors.map((error, idx) => (
          <div 
            key={idx}
            className={`border rounded-lg p-3 ${
              error.severity === 'error' 
                ? 'bg-red-50 border-red-200' 
                : error.severity === 'warning'
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-blue-50 border-blue-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {error.severity === 'error' && <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />}
              {error.severity === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />}
              {error.severity === 'info' && <Info className="w-4 h-4 text-blue-600 mt-0.5" />}
              <div className="flex-1">
                <div className="font-medium text-gray-900 text-sm">
                  {error.module.toUpperCase()} › {error.field}
                </div>
                <div className="text-sm text-gray-700 mt-1">
                  {error.message}
                </div>
                {error.blockingStage && (
                  <div className="text-xs text-gray-500 mt-1">
                    Blocks: {error.blockingStage}
                  </div>
                )}
              </div>
              <button 
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                onClick={() => {/* Navigate to module/field */}}
              >
                Fix →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

### **Layer 4: Automated Testing**

```typescript
// jedire/frontend/src/__tests__/dealConsistency.test.ts

import { DealValidator } from '@/services/dealValidation';
import { DealSchema } from '@/types/dealSchema';

describe('Deal Data Consistency', () => {
  
  test('Development units should not exceed zoning max', () => {
    const deal: DealSchema = {
      zoning: { maxUnits: 100 },
      developmentProgram: { units: 120 }, // INVALID
      // ... other fields
    };
    
    const errors = DealValidator.validateDeal(deal);
    expect(errors).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        field: 'developmentProgram.units'
      })
    );
  });
  
  test('Unit mix should total 100%', () => {
    const deal: DealSchema = {
      developmentProgram: {
        unitMix: [
          { type: 'Studio', pct: '10%' },
          { type: '1 BR', pct: '40%' },
          { type: '2 BR', pct: '30%' }, // Total = 80%, missing 20%
        ]
      }
    };
    
    const errors = DealValidator.validateDeal(deal);
    expect(errors).toContainEqual(
      expect.objectContaining({
        field: 'developmentProgram.unitMix',
        message: expect.stringContaining('must equal 100%')
      })
    );
  });
  
  test('Cannot advance to underwriting without required fields', () => {
    const incompleteDeal: DealSchema = {
      lifecycle: { stage: 'INTELLIGENCE_ASSEMBLY' },
      property: {}, // Missing required fields
      financials: {},
    };
    
    const { canAdvance, blockingErrors } = DealValidator.canAdvanceStage(
      incompleteDeal, 
      'UNDERWRITING'
    );
    
    expect(canAdvance).toBe(false);
    expect(blockingErrors.length).toBeGreaterThan(0);
  });
});
```

---

## Implementation Plan

### **Week 1: Foundation**
1. ✅ Create `dealSchema.ts` with complete TypeScript interfaces
2. ✅ Build `DealValidator` class with all validation rules
3. ✅ Write unit tests for validation logic

### **Week 2: Integration**
4. ✅ Add `<DealValidationPanel>` to all deal tabs
5. ✅ Wire up real-time validation in `DealModuleContext`
6. ✅ Add "Fix Issues" button that jumps to problem fields

### **Week 3: Data Flow**
7. ✅ Ensure `updateDevelopmentProgram()` triggers validation
8. ✅ Add validation hooks to all module update functions
9. ✅ Test cross-module data propagation

### **Week 4: Polish**
10. ✅ Add stage advancement blocking UI
11. ✅ Create validation reports for each stage
12. ✅ Document data ownership per module

---

## Quick Win: Add Validation to Current Code

**Immediate action - add to `OverviewSection.tsx`:**

```typescript
// After updating development program
useEffect(() => {
  if (activePath && unitMix.length > 0) {
    updateDevelopmentProgram({
      selectedPathId: activePath.id,
      pathLabel: activePath.label,
      units: activePath.units,
      totalSqft: avgSqft * activePath.units,
      unitMix,
      revenue: { monthly: totalRevMo, annual: totalRevMo * 12 },
      avgUnitSize: avgSqft,
      avgRent: avgRent,
    });
    
    // VALIDATE: Units within zoning constraint
    if (zoningMaxUnits && activePath.units > zoningMaxUnits) {
      console.error('[Validation] Selected path exceeds zoning max:', {
        selectedUnits: activePath.units,
        zoningMax: zoningMaxUnits,
      });
      // Show warning to user
    }
  }
}, [selectedPathId, activePath, unitMix]);
```

---

## Summary

**To ensure deal details are correct at every stage:**

1. **Define schema** - TypeScript interfaces for complete deal structure
2. **Validation rules** - Stage-specific + cross-module consistency checks
3. **Real-time UI** - Validation panel showing errors/warnings
4. **Automated tests** - Catch inconsistencies before they reach users
5. **Data flow hooks** - Validate on every module update

**This gives you:**
- ✅ Type safety across all modules
- ✅ Clear "source of truth" for each data point
- ✅ Automatic validation at each lifecycle stage
- ✅ UI feedback when data is missing or inconsistent
- ✅ Confidence that deals are "packaging-ready"

**Want me to start implementing this system?** 🚀
