# Financial Auto-Sync Integration Guide

Quick guide for connecting the financial auto-sync system to your 3D design editor.

---

## Step 1: Import Services

```typescript
// In your 3D design page/component
import { financialAutoSync } from '@/services/financialAutoSync.service';
import { FinancialModelDisplay } from '@/components/financial';
import type { Design3D, FinancialAssumptions } from '@/types';
```

---

## Step 2: Set Up State

```typescript
import { useState, useEffect } from 'react';

const [currentDesign, setCurrentDesign] = useState<Design3D | null>(null);
const [proForma, setProForma] = useState<ProForma | null>(null);
const [assumptions, setAssumptions] = useState<FinancialAssumptions>(defaultAssumptions);
```

---

## Step 3: Start Watching Design Changes

```typescript
useEffect(() => {
  if (!currentDesign) return;

  // Start watching this design
  const unwatch = financialAutoSync.watchDesign3D(
    currentDesign.id,
    assumptions,
    (design, newProForma) => {
      // Update pro forma state
      setProForma(newProForma);
      
      // Optional: Show notification
      toast.success('Financial model updated!');
    },
    (error) => {
      console.error('Financial calculation error:', error);
      toast.error('Failed to calculate financial model');
    }
  );

  // Trigger initial calculation
  financialAutoSync.onDesignChange(currentDesign);

  // Cleanup on unmount
  return () => {
    unwatch();
    financialAutoSync.cleanup(currentDesign.id);
  };
}, [currentDesign?.id, assumptions]); // Re-run when design or assumptions change
```

---

## Step 4: Connect 3D Editor to Financial Updates

### When User Modifies Design

```typescript
// Example: User changes unit mix in 3D editor
const handleUnitMixChange = (newUnitMix: UnitMix) => {
  const updatedDesign: Design3D = {
    ...currentDesign,
    unitMix: newUnitMix,
    totalUnits: Object.values(newUnitMix).reduce((sum, count) => sum + count, 0),
    lastModified: new Date().toISOString(),
  };

  setCurrentDesign(updatedDesign);
  
  // Trigger financial recalculation (debounced 500ms)
  financialAutoSync.onDesignChange(updatedDesign);
};
```

### When User Changes Parking

```typescript
const handleParkingChange = (spaces: number, type: 'surface' | 'structured' | 'underground') => {
  const updatedDesign: Design3D = {
    ...currentDesign,
    parkingSpaces: spaces,
    parkingType: type,
    lastModified: new Date().toISOString(),
  };

  setCurrentDesign(updatedDesign);
  financialAutoSync.onDesignChange(updatedDesign);
};
```

### When User Adjusts Building Size

```typescript
const handleBuildingSizeChange = (newRentableSF: number, newGrossSF: number) => {
  const updatedDesign: Design3D = {
    ...currentDesign,
    rentableSF: newRentableSF,
    grossSF: newGrossSF,
    efficiency: newRentableSF / newGrossSF,
    lastModified: new Date().toISOString(),
  };

  setCurrentDesign(updatedDesign);
  financialAutoSync.onDesignChange(updatedDesign);
};
```

---

## Step 5: Add Financial Display to UI

```typescript
return (
  <div className="grid grid-cols-2 gap-6">
    {/* Left: 3D Editor */}
    <div className="col-span-1">
      <ThreeDEditor
        design={currentDesign}
        onDesignChange={(newDesign) => {
          setCurrentDesign(newDesign);
          financialAutoSync.onDesignChange(newDesign);
        }}
      />
    </div>

    {/* Right: Financial Model */}
    <div className="col-span-1">
      {currentDesign && (
        <FinancialModelDisplay
          design3D={currentDesign}
          assumptions={assumptions}
          onProFormaChange={(newProForma) => {
            setProForma(newProForma);
            console.log('Updated IRR:', newProForma.returns.leveredIRR);
          }}
        />
      )}
    </div>
  </div>
);
```

---

## Step 6: Add Assumption Controls

```typescript
const AssumptionControls = () => {
  const [localAssumptions, setLocalAssumptions] = useState(assumptions);

  const handleRentChange = (unitType: keyof MarketRents, newRent: number) => {
    const updated = {
      ...localAssumptions,
      marketRents: {
        ...localAssumptions.marketRents,
        [unitType]: newRent,
      },
    };
    setLocalAssumptions(updated);
    setAssumptions(updated);
  };

  return (
    <div className="space-y-4">
      <h3>Market Assumptions</h3>
      
      <label>
        Studio Rent:
        <input
          type="number"
          value={localAssumptions.marketRents.studio}
          onChange={(e) => handleRentChange('studio', parseFloat(e.target.value))}
        />
      </label>
      
      {/* ... other controls */}
    </div>
  );
};
```

---

## Step 7: Show Impact of Design Changes

```typescript
const DesignImpactIndicator = () => {
  const [impact, setImpact] = useState<any>(null);

  const calculateImpact = (unitChanges: Partial<UnitMix>) => {
    if (!currentDesign) return;

    const impact = financialAutoSync.calculateUnitMixImpact(
      currentDesign,
      assumptions,
      unitChanges
    );

    setImpact(impact);
  };

  return (
    <div className="bg-blue-50 p-4 rounded">
      <h4>Impact of Adding 10 Units:</h4>
      <button onClick={() => calculateImpact({ oneBed: currentDesign.unitMix.oneBed + 10 })}>
        Calculate
      </button>
      
      {impact && (
        <div className="mt-2">
          <div>Revenue: +${impact.revenueImpact.toLocaleString()}</div>
          <div>Cost: +${impact.costImpact.toLocaleString()}</div>
          <div>NOI: +${impact.noiImpact.toLocaleString()}</div>
          <div>IRR: {impact.irrImpact > 0 ? '+' : ''}{(impact.irrImpact * 100).toFixed(2)}%</div>
        </div>
      )}
    </div>
  );
};
```

---

## Step 8: Add Loading States

```typescript
const FinancialPanel = () => {
  const syncState = financialAutoSync.getSyncState(currentDesign?.id || '');

  return (
    <div>
      {syncState?.isCalculating && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded flex items-center gap-2">
          <Spinner />
          <span>Recalculating financial model...</span>
        </div>
      )}

      {syncState?.errors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
          <strong>Errors:</strong>
          <ul>
            {syncState.errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <FinancialModelDisplay
        design3D={currentDesign}
        assumptions={assumptions}
        onProFormaChange={setProForma}
      />
    </div>
  );
};
```

---

## Step 9: Persist to Backend

```typescript
import { financialModelsService } from '@/services/financialModels.service';

// Save pro forma to database
const saveProForma = async () => {
  if (!proForma) return;

  try {
    await financialModelsService.saveFinancialModel({
      dealId: currentDesign.dealId,
      name: `Pro Forma - ${new Date().toLocaleDateString()}`,
      components: {
        developmentBudget: proForma.developmentBudget,
        operatingProForma: proForma.operatingProForma,
      },
      assumptions: proForma.assumptions,
      results: proForma.returns,
    });

    toast.success('Financial model saved!');
  } catch (error) {
    console.error('Failed to save:', error);
    toast.error('Failed to save financial model');
  }
};

// Auto-save on blur
useEffect(() => {
  if (!proForma) return;

  const autoSave = async () => {
    await financialModelsService.autoSave(currentDesign.dealId, {
      components: {
        developmentBudget: proForma.developmentBudget,
        operatingProForma: proForma.operatingProForma,
      },
      assumptions: proForma.assumptions,
      results: proForma.returns,
    });
  };

  const timer = setTimeout(autoSave, 2000); // Auto-save after 2s of no changes
  return () => clearTimeout(timer);
}, [proForma]);
```

---

## Step 10: Add Keyboard Shortcuts (Optional)

```typescript
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    // Cmd/Ctrl + R: Force recalculation
    if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
      e.preventDefault();
      if (currentDesign) {
        financialAutoSync.recalculate(currentDesign);
        toast.info('Financial model recalculated');
      }
    }

    // Cmd/Ctrl + S: Save pro forma
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      saveProForma();
    }
  };

  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, [currentDesign, proForma]);
```

---

## Complete Example Component

```typescript
import React, { useState, useEffect } from 'react';
import { financialAutoSync } from '@/services/financialAutoSync.service';
import { FinancialModelDisplay } from '@/components/financial';
import type { Design3D, FinancialAssumptions, ProForma } from '@/types';

export const DesignFinancialPage = () => {
  const [currentDesign, setCurrentDesign] = useState<Design3D | null>(null);
  const [proForma, setProForma] = useState<ProForma | null>(null);
  const [assumptions, setAssumptions] = useState<FinancialAssumptions>(defaultAssumptions);

  // Watch design changes
  useEffect(() => {
    if (!currentDesign) return;

    const unwatch = financialAutoSync.watchDesign3D(
      currentDesign.id,
      assumptions,
      (design, newProForma) => {
        setProForma(newProForma);
      },
      (error) => {
        console.error('Financial error:', error);
      }
    );

    financialAutoSync.onDesignChange(currentDesign);

    return () => {
      unwatch();
      financialAutoSync.cleanup(currentDesign.id);
    };
  }, [currentDesign?.id, assumptions]);

  // Handle design changes from 3D editor
  const handleDesignChange = (newDesign: Design3D) => {
    setCurrentDesign(newDesign);
    financialAutoSync.onDesignChange(newDesign);
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <ThreeDEditor
          design={currentDesign}
          onDesignChange={handleDesignChange}
        />
      </div>

      <div>
        {currentDesign && (
          <FinancialModelDisplay
            design3D={currentDesign}
            assumptions={assumptions}
            onProFormaChange={setProForma}
          />
        )}
      </div>
    </div>
  );
};
```

---

## Testing Your Integration

1. **Manual Test**: Change a design parameter → See financial update within 500ms
2. **Check Console**: Look for sync state updates
3. **Verify Debouncing**: Rapid changes should only trigger one calculation
4. **Test Error Handling**: Set invalid assumptions → Should show error

```typescript
// Test helper
const testFinancialSync = () => {
  console.log('Testing financial sync...');
  
  // Test 1: Initial calculation
  financialAutoSync.onDesignChange(testDesign);
  
  // Test 2: Rapid changes (should debounce)
  for (let i = 0; i < 10; i++) {
    financialAutoSync.onDesignChange({ ...testDesign, totalUnits: 100 + i });
  }
  
  // Test 3: Check state
  setTimeout(() => {
    const state = financialAutoSync.getSyncState(testDesign.id);
    console.log('Sync state:', state);
    console.log('Last pro forma:', financialAutoSync.getLastProForma(testDesign.id));
  }, 1000);
};
```

---

## Common Patterns

### Pattern 1: Side-by-Side Comparison

```typescript
const [scenarioA, setScenarioA] = useState<ProForma | null>(null);
const [scenarioB, setScenarioB] = useState<ProForma | null>(null);

// Compare two designs
<div className="grid grid-cols-2 gap-4">
  <FinancialModelDisplay design3D={designA} assumptions={assumptionsA} onProFormaChange={setScenarioA} />
  <FinancialModelDisplay design3D={designB} assumptions={assumptionsB} onProFormaChange={setScenarioB} />
</div>

{scenarioA && scenarioB && (
  <div className="mt-4 p-4 bg-gray-100 rounded">
    <h3>Comparison</h3>
    <div>IRR Difference: {((scenarioA.returns.leveredIRR - scenarioB.returns.leveredIRR) * 100).toFixed(2)}%</div>
  </div>
)}
```

### Pattern 2: Optimization Loop

```typescript
const optimizeDesign = () => {
  let bestDesign = currentDesign;
  let bestIRR = 0;

  // Test different unit mixes
  for (let oneBedCount = 100; oneBedCount <= 150; oneBedCount += 10) {
    const testDesign = {
      ...currentDesign,
      unitMix: { ...currentDesign.unitMix, oneBed: oneBedCount },
      totalUnits: currentDesign.totalUnits - currentDesign.unitMix.oneBed + oneBedCount,
    };

    const proForma = generateProForma(testDesign, assumptions, dealId);
    
    if (proForma.returns.leveredIRR > bestIRR) {
      bestIRR = proForma.returns.leveredIRR;
      bestDesign = testDesign;
    }
  }

  setCurrentDesign(bestDesign);
  console.log('Optimized design found! IRR:', bestIRR);
};
```

---

## Troubleshooting

**Q: Financial model not updating?**  
A: Check that `designId` matches between `currentDesign` and watcher.

**Q: Multiple calculations firing?**  
A: Verify you're not setting state in a way that triggers useEffect loops.

**Q: Slow performance?**  
A: Reduce frequency of `onDesignChange` calls, or implement additional debouncing.

**Q: NaN or Infinity in results?**  
A: Check assumptions for zero or negative values (land cost, rents, etc.).

---

**Next:** See `FINANCIAL_AUTOSYNC_README.md` for complete API documentation.
