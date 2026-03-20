# PHASE 11: UI Integration Points for Unit Mix

**UI Locations Where Unit Mix Appears:**

1. **Overview Page** - Unit mix summary
2. **Unit Mix Intelligence → Program Tab** - Detailed breakdown
3. **Financial Model → Assumptions Tab** - Rent roll structure
4. **3D Design Module** - Floor plan metadata
5. **Development Capacity** - Unit assumptions

---

## Current UI Components to Update

### 1. Overview Page (`OverviewSection.tsx`)

**What It Shows:**
- Total unit count
- Unit mix breakdown (Studios/1BR/2BR/3BR)
- Average unit size
- Total building SF

**Needs to Subscribe To:**
```typescript
const { resolvedUnitMix, totalUnits } = useDealStore(
  state => ({
    resolvedUnitMix: state.resolvedUnitMix,
    totalUnits: state.totalUnits
  }),
  shallow
);
```

**Auto-Updates When:**
- Development path selected
- Unit Mix Intelligence completes
- User manually sets unit mix

---

### 2. Unit Mix Intelligence → Program Tab

**Location:** This is the SOURCE OF TRUTH for unit mix data

**What It Shows:**
- Detailed unit type breakdown
- Count per type
- Average SF per type
- Target rent per type
- Total units
- Total SF

**Component Structure:**
```typescript
function ProgramTab({ dealId }: { dealId: string }) {
  const { resolvedUnitMix } = useDealStore(state => ({
    resolvedUnitMix: state.resolvedUnitMix
  }));
  
  // Display the program table
  return (
    <Table>
      {resolvedUnitMix.map(row => (
        <Row key={row.id}>
          <Cell>{row.unitType}</Cell>
          <Cell>{row.count}</Cell>
          <Cell>{row.avgSF}</Cell>
          <Cell>${row.targetRent}/mo</Cell>
        </Row>
      ))}
    </Table>
  );
}
```

**When User Edits Program:**
```typescript
// After user edits in Program tab
const handleProgramUpdate = async (newProgram: UnitMixRow[]) => {
  // Option 1: Update via manual override
  const unitMixPayload = {
    studio: { count: ..., avgSF: ... },
    oneBR: { count: ..., avgSF: ... },
    twoBR: { count: ..., avgSF: ... },
    threeBR: { count: ..., avgSF: ... }
  };
  
  await dealStore.setManualUnitMix(unitMixPayload);
  
  // This will:
  // ✅ Store as manual override (highest priority)
  // ✅ Propagate to Financial Model
  // ✅ Propagate to 3D Design
  // ✅ Propagate to Dev Capacity
  // ✅ Update Overview page (via dealStore subscription)
  
  toast.success('Unit mix applied to all modules!');
};
```

---

### 3. Financial Model → Assumptions Tab

**What It Shows:**
- Unit mix from financial model assumptions
- Editable fields

**Current Code:**
```typescript
// From AssumptionsTab.tsx
const unitMix = assumptions.unitMix || [];

return (
  <Section>
    <h3>Unit Mix</h3>
    {unitMix.map((item, idx) => (
      <Row key={idx}>
        <Cell>{item.unitType}</Cell>
        <Cell>{item.count}</Cell>
        <Cell>{item.avgSF} SF</Cell>
        <Cell>{item.percent}%</Cell>
      </Row>
    ))}
  </Section>
);
```

**After Phase 11:**
```typescript
// AssumptionsTab should show propagation status
function AssumptionsTab({ modelId }: { modelId: string }) {
  const [unitMixStatus, setUnitMixStatus] = useState(null);
  
  useEffect(() => {
    // Check if unit mix was propagated
    dealStore.getUnitMixStatus().then(setUnitMixStatus);
  }, []);
  
  return (
    <Section>
      <h3>Unit Mix</h3>
      
      {unitMixStatus?.hasUnitMix && (
        <Badge color="green">
          Applied from {unitMixStatus.source}
          {unitMixStatus.appliedAt && 
            ` at ${new Date(unitMixStatus.appliedAt).toLocaleString()}`
          }
        </Badge>
      )}
      
      {/* Unit mix table */}
    </Section>
  );
}
```

---

### 4. Development Path Selection UI

**Location:** Strategy module or Overview page

**Before Phase 11:**
```typescript
<Button onClick={() => selectPath(pathId)}>
  Select This Path
</Button>
```

**After Phase 11:**
```typescript
const handleSelectPath = async (pathId: string) => {
  // Select path (triggers auto-propagation in dealStore)
  dealStore.selectDevelopmentPath(pathId);
  
  // Show feedback
  toast.loading('Applying unit mix to all modules...');
  
  // Wait for propagation (dealStore handles this internally)
  // The store's selectDevelopmentPath() already calls applyUnitMixToAllModules()
  
  // After a brief delay, show success
  setTimeout(() => {
    toast.success('Development path selected! Unit mix applied to all modules.');
  }, 1000);
};

<Button onClick={() => handleSelectPath(pathId)}>
  Select This Path
</Button>
```

---

## Data Flow Visualization

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER INTERACTIONS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Select Development Path                                     │
│     (Strategy Module)                                           │
│           ↓                                                     │
│     dealStore.selectDevelopmentPath(pathId)                     │
│           ↓                                                     │
│     Auto-triggers: applyUnitMixToAllModules()                   │
│                                                                 │
│  2. Edit Program in Unit Mix Intelligence                       │
│     (Unit Mix Intelligence → Program Tab)                       │
│           ↓                                                     │
│     dealStore.setManualUnitMix({ studio: {...}, ... })        │
│           ↓                                                     │
│     Auto-triggers: propagateUnitMix(dealId, 'manual')          │
│                                                                 │
│  3. AI Recommendation Completes                                 │
│     (Backend: Unit Mix Intelligence agent)                      │
│           ↓                                                     │
│     Backend calls: propagateUnitMix(dealId, 'intelligence')    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│               BACKEND: Unit Mix Propagation Service             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. getAuthoritativeUnitMix(dealId)                            │
│     Priority: Manual > Intelligence > Path                      │
│                                                                 │
│  2. updateFinancialModelUnitMix(dealId, unitMix)               │
│                                                                 │
│  3. update3DDesignUnitMix(dealId, unitMix)                     │
│                                                                 │
│  4. updateDevelopmentCapacityUnitMix(dealId, unitMix)          │
│                                                                 │
│  5. updateDealTargetUnits(dealId, unitMix.total)               │
│                                                                 │
│  6. markUnitMixApplied(dealId, source)                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  FRONTEND: Auto-Update UI                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ Overview Page                                               │
│     (useDealStore subscribes to resolvedUnitMix)               │
│     → Sees updated unit mix instantly                           │
│                                                                 │
│  ✅ Unit Mix Intelligence → Program Tab                         │
│     (useDealStore subscribes to resolvedUnitMix)               │
│     → Table updates with propagated data                        │
│                                                                 │
│  ✅ Financial Model → Assumptions Tab                           │
│     (Fetches fresh financial model from backend)                │
│     → Shows updated assumptions.unitMix                         │
│     → Displays "Applied from [source]" badge                    │
│                                                                 │
│  ✅ 3D Design Module                                            │
│     (Reads design metadata)                                     │
│     → Floor plans use correct unit breakdown                    │
│                                                                 │
│  ✅ Development Capacity                                        │
│     (Reads module_outputs.developmentCapacity)                  │
│     → Capacity analysis uses same unit mix                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Required Code Changes

### Change 1: Overview Page Component

**File:** `frontend/src/components/deal/sections/OverviewSection.tsx`

**Add Unit Mix Status Indicator:**

```typescript
import { useDealStore } from '../../../stores/dealStore';
import { useState, useEffect } from 'react';

function OverviewSection({ dealId }: { dealId: string }) {
  const { resolvedUnitMix, totalUnits } = useDealStore(
    state => ({
      resolvedUnitMix: state.resolvedUnitMix,
      totalUnits: state.totalUnits
    }),
    shallow
  );
  
  const [unitMixStatus, setUnitMixStatus] = useState<any>(null);
  
  useEffect(() => {
    const fetchStatus = async () => {
      const status = await useDealStore.getState().getUnitMixStatus();
      setUnitMixStatus(status);
    };
    fetchStatus();
  }, [resolvedUnitMix]); // Refetch when unit mix changes
  
  return (
    <div className="overview-section">
      <h2>Deal Overview</h2>
      
      {/* Unit Mix Status Badge */}
      {unitMixStatus?.hasUnitMix && (
        <div className="status-badge">
          <span className="badge badge-success">
            Unit Mix: {unitMixStatus.source}
            {unitMixStatus.appliedAt && (
              <span className="text-xs ml-2">
                {new Date(unitMixStatus.appliedAt).toLocaleString()}
              </span>
            )}
          </span>
        </div>
      )}
      
      {/* Unit Count Summary */}
      <div className="unit-summary">
        <div className="metric">
          <label>Total Units</label>
          <value>{totalUnits}</value>
        </div>
      </div>
      
      {/* Unit Mix Breakdown */}
      <div className="unit-mix-grid">
        {resolvedUnitMix.map(row => (
          <div key={row.id} className="unit-type-card">
            <h4>{row.unitType}</h4>
            <div className="count">{row.count} units</div>
            <div className="sf">{row.avgSF} SF avg</div>
            <div className="rent">${row.targetRent}/mo</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### Change 2: Unit Mix Intelligence Program Tab

**File:** `frontend/src/components/UnitMixIntelligence/ProgramTab.tsx` (create if doesn't exist)

```typescript
import { useDealStore } from '../../stores/dealStore';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

function ProgramTab({ dealId }: { dealId: string }) {
  const { resolvedUnitMix } = useDealStore(state => ({
    resolvedUnitMix: state.resolvedUnitMix
  }));
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedProgram, setEditedProgram] = useState(resolvedUnitMix);
  
  const handleEdit = () => {
    setIsEditing(true);
    setEditedProgram(resolvedUnitMix);
  };
  
  const handleSave = async () => {
    // Convert to backend format
    const unitMixPayload = {
      studio: editedProgram.find(r => r.unitType.toLowerCase().includes('studio')),
      oneBR: editedProgram.find(r => r.unitType.toLowerCase().includes('1') && r.unitType.toLowerCase().includes('br')),
      twoBR: editedProgram.find(r => r.unitType.toLowerCase().includes('2') && r.unitType.toLowerCase().includes('br')),
      threeBR: editedProgram.find(r => r.unitType.toLowerCase().includes('3') && r.unitType.toLowerCase().includes('br')),
    };
    
    toast.loading('Applying unit mix to all modules...');
    
    const result = await useDealStore.getState().setManualUnitMix(unitMixPayload);
    
    if (result.success) {
      toast.dismiss();
      toast.success('Unit mix applied to all modules!');
      setIsEditing(false);
      
      // Refresh deal context to see updated data
      await useDealStore.getState().fetchDealContext(dealId);
    } else {
      toast.dismiss();
      toast.error('Failed to apply unit mix');
    }
  };
  
  const handleCancel = () => {
    setIsEditing(false);
    setEditedProgram(resolvedUnitMix);
  };
  
  return (
    <div className="program-tab">
      <div className="header">
        <h3>Unit Mix Program</h3>
        {!isEditing ? (
          <button onClick={handleEdit} className="btn-edit">
            Edit Program
          </button>
        ) : (
          <div className="edit-actions">
            <button onClick={handleSave} className="btn-save">
              Save & Apply to All Modules
            </button>
            <button onClick={handleCancel} className="btn-cancel">
              Cancel
            </button>
          </div>
        )}
      </div>
      
      <table className="program-table">
        <thead>
          <tr>
            <th>Unit Type</th>
            <th>Count</th>
            <th>Avg SF</th>
            <th>Target Rent</th>
            <th>Total SF</th>
          </tr>
        </thead>
        <tbody>
          {(isEditing ? editedProgram : resolvedUnitMix).map((row, idx) => (
            <tr key={row.id}>
              <td>{row.unitType}</td>
              <td>
                {isEditing ? (
                  <input
                    type="number"
                    value={row.count}
                    onChange={(e) => {
                      const updated = [...editedProgram];
                      updated[idx].count = parseInt(e.target.value) || 0;
                      setEditedProgram(updated);
                    }}
                  />
                ) : (
                  row.count
                )}
              </td>
              <td>
                {isEditing ? (
                  <input
                    type="number"
                    value={row.avgSF}
                    onChange={(e) => {
                      const updated = [...editedProgram];
                      updated[idx].avgSF = parseInt(e.target.value) || 0;
                      setEditedProgram(updated);
                    }}
                  />
                ) : (
                  row.avgSF
                )}
              </td>
              <td>${row.targetRent}/mo</td>
              <td>{row.count * row.avgSF} SF</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="totals">
            <td>Total</td>
            <td>
              {(isEditing ? editedProgram : resolvedUnitMix)
                .reduce((sum, r) => sum + r.count, 0)}
            </td>
            <td>
              {Math.round(
                (isEditing ? editedProgram : resolvedUnitMix)
                  .reduce((sum, r) => sum + r.count * r.avgSF, 0) /
                  (isEditing ? editedProgram : resolvedUnitMix)
                    .reduce((sum, r) => sum + r.count, 0)
              )} SF avg
            </td>
            <td>-</td>
            <td>
              {(isEditing ? editedProgram : resolvedUnitMix)
                .reduce((sum, r) => sum + r.count * r.avgSF, 0)} SF
            </td>
          </tr>
        </tfoot>
      </table>
      
      {isEditing && (
        <div className="help-text">
          💡 Changes will be applied as a manual override and propagated to:
          Financial Model, 3D Design, Development Capacity, and Deal metadata.
        </div>
      )}
    </div>
  );
}

export default ProgramTab;
```

---

### Change 3: Financial Model Assumptions Tab

**File:** `frontend/src/components/FinancialModel/AssumptionsTab.tsx`

**Add at the top of the component:**

```typescript
const [unitMixStatus, setUnitMixStatus] = useState<any>(null);

useEffect(() => {
  const fetchStatus = async () => {
    const status = await useDealStore.getState().getUnitMixStatus();
    setUnitMixStatus(status);
  };
  fetchStatus();
}, []);
```

**Add status badge in the unit mix section:**

```typescript
<Section>
  <div className="section-header">
    <h3>Unit Mix</h3>
    {unitMixStatus?.hasUnitMix && (
      <Badge color="green" size="sm">
        From {unitMixStatus.source}
      </Badge>
    )}
  </div>
  
  {/* Existing unit mix table */}
</Section>
```

---

## Testing Checklist

### Test 1: Development Path Selection

1. Navigate to deal
2. Open Strategy module
3. Select a development path
4. **Verify:**
   - ✅ Overview page unit mix updates
   - ✅ Unit Mix Intelligence Program tab updates
   - ✅ Financial Model Assumptions tab shows "From path"
   - ✅ All show same unit counts

### Test 2: Manual Edit in Program Tab

1. Navigate to Unit Mix Intelligence
2. Click "Edit Program"
3. Change Studio count from 45 → 50
4. Click "Save & Apply to All Modules"
5. **Verify:**
   - ✅ Overview page shows 50 Studios
   - ✅ Financial Model Assumptions shows 50 Studios
   - ✅ Badge shows "From manual"
   - ✅ Total units updated everywhere

### Test 3: AI Recommendation

1. Run Unit Mix Intelligence module
2. Wait for AI to complete
3. **Verify:**
   - ✅ Program tab shows AI recommendation
   - ✅ Overview page updates
   - ✅ Badge shows "From intelligence"
   - ✅ Financial model assumptions updated

### Test 4: Refresh Page

1. Make changes (select path or edit program)
2. Refresh browser
3. **Verify:**
   - ✅ All data persists
   - ✅ Status badges show correct source
   - ✅ Timestamps are accurate

---

## Implementation Priority

1. **High Priority:**
   - ✅ Add status badge to Overview page
   - ✅ Create/update Program tab in Unit Mix Intelligence
   - ✅ Add "Save & Apply" button to Program tab

2. **Medium Priority:**
   - ✅ Add status badge to Financial Model Assumptions tab
   - ✅ Add loading states during propagation
   - ✅ Add toast notifications for success/error

3. **Low Priority:**
   - ✅ Add unit mix change history log
   - ✅ Add "Revert to Path" button (clear manual override)
   - ✅ Add validation (prevent saving invalid unit mix)

---

## UI/UX Best Practices

### Success Messages:
```typescript
toast.success('Unit mix applied to all modules!', {
  description: 'Financial Model, 3D Design, and Dev Capacity updated',
  duration: 5000
});
```

### Loading States:
```typescript
toast.loading('Applying unit mix...', { id: 'unit-mix-apply' });
// ... await propagation ...
toast.success('Applied!', { id: 'unit-mix-apply' });
```

### Error Handling:
```typescript
if (!result.success && result.errors.length > 0) {
  toast.error('Some modules failed to update', {
    description: result.errors.join(', ')
  });
}
```

### Status Badges:
```typescript
// Color coding by source
const badgeColor = {
  manual: 'blue',      // User override
  intelligence: 'purple', // AI recommendation
  path: 'green'        // Development path
}[unitMixStatus.source];
```

---

## Summary

**UI Components That Need Updates:**

1. ✅ Overview Page - Add status badge, subscribe to resolvedUnitMix
2. ✅ Unit Mix Intelligence Program Tab - Add "Save & Apply" button
3. ✅ Financial Model Assumptions Tab - Add status badge
4. ✅ Development path selection - Add loading feedback

**User Flow:**

```
User Action → dealStore.setManualUnitMix() 
           → Backend propagates to all modules
           → dealStore.fetchDealContext()
           → All subscribed UI components auto-update
           → User sees consistent data everywhere
```

**Key Principle:** All UI components subscribe to `dealStore.resolvedUnitMix`, so when backend propagates and store refreshes, **everything updates automatically**.
