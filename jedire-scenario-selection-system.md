# JediRe Scenario Selection System
## Critical Missing Piece: User Must Pick Development Path

**Problem Identified:** Users can't proceed to 3D Design or Financial modules without first selecting which development path (scenario) to pursue.

---

## 🎯 Current State (Broken Flow)

### What Exists:
- ✅ `development_scenarios` table with `is_active` field
- ✅ API endpoint: `PUT /api/v1/deals/:dealId/scenarios/:id/activate`
- ✅ Development Capacity Tab calculates 3 scenarios:
  - By-Right: 312 units, 8 stories, $50K-$150K cost
  - Variance: 374 units, 9 stories, $100K-$350K cost
  - Rezone: 499 units, 12 stories, $200K-$750K cost
- ✅ `useZoningModuleStore` has `selectDevelopmentPath()` function

### What's Missing:
- ❌ **No UI to select/activate a scenario** (users can't pick a path!)
- ❌ **Selection not persisted** (stored only in Zustand, lost on refresh)
- ❌ **3D Design doesn't read from selected scenario** (no data source)
- ❌ **Financial modules don't know which path to use** (assumes by-right?)
- ❌ **No visual indicator of which path is active**

---

## 🚨 Why This Blocks Everything

### User Journey (Current - Broken):
```
1. User draws property boundary ✅
2. User confirms zoning ✅
3. System calculates 3 scenarios ✅
4. User sees scenarios but CAN'T SELECT ONE ❌
5. User navigates to 3D Design tab
   → Loads envelope constraints from ??? (undefined path)
6. User navigates to Financial Dashboard
   → Calculates metrics based on ??? (which scenario?)
```

### User Journey (Fixed):
```
1. User draws property boundary ✅
2. User confirms zoning ✅
3. System calculates 3 scenarios ✅
4. User SELECTS which path to pursue (by-right/variance/rezone) ✅
   → Selection saved to development_scenarios.is_active
   → All modules now have a baseline
5. User navigates to 3D Design tab
   → Loads envelope from ACTIVE scenario
   → Max height, max units, max FAR all constrained correctly
6. User designs building within envelope
   → Metrics calculated against selected scenario
7. User navigates to Financial Dashboard
   → Proforma uses units/GFA from ACTIVE scenario
   → Timeline/cost estimates match selected path
```

---

## 📊 Data Flow: Before & After

### BEFORE (Broken):
```
Development Capacity
  ↓ (calculates 3 scenarios)
Scenarios exist in frontend state only
  ↓ (user can't select, data lost on refresh)
3D Design
  ↓ (loads... what? no baseline!)
Building Metrics
  ↓ (calculated against... which scenario?)
Financial Dashboard
  ↓ (shows metrics for... unclear!)
```

### AFTER (Fixed):
```
Development Capacity
  ↓ (calculates 3 scenarios)
  ↓ (saves to development_scenarios table)
User Selects Active Scenario
  ↓ (PUT /api/v1/deals/:dealId/scenarios/:id/activate)
  ↓ (is_active = true in database)
3D Design
  ↓ (GET /api/v1/deals/:dealId/scenarios?active=true)
  ↓ (loads envelope constraints from ACTIVE scenario)
Building Metrics
  ↓ (validated against active scenario limits)
Financial Dashboard
  ↓ (reads units/GFA/costs from active scenario)
  ↓ (timeline & risk aligned with path)
```

---

## 🛠️ Implementation Plan

### Phase 1: Scenario Persistence & Selection (Critical)

#### 1.1 Update Development Capacity Tab UI
**File:** `frontend/src/components/zoning/tabs/DevelopmentCapacityTab.tsx`

**Add Scenario Cards with Selection:**
```tsx
<div className="grid grid-cols-3 gap-4 mt-6">
  {scenarios.map((scenario) => (
    <ScenarioCard
      key={scenario.id}
      scenario={scenario}
      isActive={scenario.is_active}
      onSelect={() => handleActivateScenario(scenario.id)}
    />
  ))}
</div>
```

**ScenarioCard Component:**
```tsx
interface ScenarioCardProps {
  scenario: any;
  isActive: boolean;
  onSelect: () => void;
}

function ScenarioCard({ scenario, isActive, onSelect }: ScenarioCardProps) {
  const pathLabels = {
    by_right: { title: 'By-Right', color: 'green', risk: 'Low Risk' },
    variance: { title: 'Variance Path', color: 'yellow', risk: 'Medium Risk' },
    rezone: { title: 'Rezone Path', color: 'red', risk: 'High Risk' }
  };
  
  const config = pathLabels[scenario.name] || pathLabels.by_right;
  
  return (
    <div
      className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
        isActive
          ? 'border-blue-500 bg-blue-50 shadow-lg'
          : 'border-gray-200 hover:border-gray-400'
      }`}
      onClick={onSelect}
    >
      {isActive && (
        <div className="absolute top-2 right-2">
          <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
            ✓ Active
          </span>
        </div>
      )}
      
      <div className={`text-lg font-bold text-${config.color}-700`}>
        {config.title}
      </div>
      
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Max Units:</span>
          <span className="font-semibold">{scenario.max_units}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Stories:</span>
          <span className="font-semibold">{scenario.max_stories}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">GFA:</span>
          <span className="font-semibold">
            {(scenario.max_gba || 0).toLocaleString()} SF
          </span>
        </div>
      </div>
      
      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="text-xs text-gray-500">Timeline: {scenario.timeline || 'TBD'}</div>
        <div className="text-xs text-gray-500">Cost: {scenario.cost || 'TBD'}</div>
        <div className={`text-xs font-medium text-${config.color}-600 mt-1`}>
          {config.risk}
        </div>
      </div>
    </div>
  );
}
```

**Handler Function:**
```tsx
const handleActivateScenario = async (scenarioId: string) => {
  try {
    setLoading(true);
    await apiClient.put(
      `/api/v1/deals/${dealId}/scenarios/${scenarioId}/activate`
    );
    
    // Reload scenarios to get updated is_active status
    await loadScenarios();
    
    // Update Zustand store
    const activeScenario = scenarios.find(s => s.id === scenarioId);
    if (activeScenario) {
      const envelope = {
        max_units: activeScenario.max_units,
        max_gfa_sf: activeScenario.max_gba,
        max_stories: activeScenario.max_stories,
        max_footprint_sf: activeScenario.max_footprint,
        required_parking_spaces: activeScenario.parking_required,
        // ... other envelope fields
      };
      selectDevelopmentPath(activeScenario.name, envelope);
    }
    
    toast.success(`Activated ${activeScenario?.name} scenario`);
  } catch (error) {
    console.error('Failed to activate scenario:', error);
    toast.error('Failed to activate scenario');
  } finally {
    setLoading(false);
  }
};
```

#### 1.2 Create Scenarios on Capacity Calculation
**File:** `backend/src/api/rest/property-boundary.routes.ts`

**Update `triggerZoningAutoPopulate()` function:**
```typescript
async function triggerZoningAutoPopulate(dealId: string) {
  try {
    // ... existing code to get capacity ...
    
    const byRight = analysisResult.step4_capacityScenarios.find((s: any) => 
      s.name === 'By Right'
    );
    const variance = analysisResult.step4_capacityScenarios.find((s: any) => 
      s.name === 'Variance'
    );
    const rezone = analysisResult.step4_capacityScenarios.find((s: any) => 
      s.name === 'Rezone'
    );
    
    // Create or update scenarios in development_scenarios table
    await createOrUpdateScenarios(dealId, {
      byRight,
      variance,
      rezone
    });
    
    // ... rest of existing code ...
  } catch (err) {
    console.error(`Auto-populate error for deal ${dealId}:`, err);
  }
}

async function createOrUpdateScenarios(
  dealId: string, 
  scenarios: { byRight: any, variance: any, rezone: any }
) {
  const pool = getPool();
  
  // Clear existing scenarios for this deal
  await pool.query(
    'DELETE FROM development_scenarios WHERE deal_id = $1',
    [dealId]
  );
  
  // Insert by-right scenario (default active)
  if (scenarios.byRight) {
    await pool.query(`
      INSERT INTO development_scenarios (
        deal_id, name, is_active, max_units, max_gba, max_footprint,
        max_stories, parking_required, applied_far, binding_constraint
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      dealId,
      'by_right',
      true, // By-right is active by default
      scenarios.byRight.maxUnits,
      scenarios.byRight.maxGFA,
      scenarios.byRight.maxFootprint,
      scenarios.byRight.stories,
      scenarios.byRight.parkingRequired,
      scenarios.byRight.far,
      scenarios.byRight.limitingFactor
    ]);
  }
  
  // Insert variance scenario (inactive)
  if (scenarios.variance) {
    await pool.query(`
      INSERT INTO development_scenarios (
        deal_id, name, is_active, max_units, max_gba, max_footprint,
        max_stories, parking_required, applied_far
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      dealId,
      'variance',
      false,
      scenarios.variance.maxUnits,
      scenarios.variance.maxGFA,
      scenarios.variance.maxFootprint,
      scenarios.variance.stories,
      scenarios.variance.parkingRequired,
      scenarios.variance.far
    ]);
  }
  
  // Insert rezone scenario (inactive)
  if (scenarios.rezone) {
    await pool.query(`
      INSERT INTO development_scenarios (
        deal_id, name, is_active, max_units, max_gba, max_footprint,
        max_stories, parking_required, applied_far
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      dealId,
      'rezone',
      false,
      scenarios.rezone.maxUnits,
      scenarios.rezone.maxGFA,
      scenarios.rezone.maxFootprint,
      scenarios.rezone.stories,
      scenarios.rezone.parkingRequired,
      scenarios.rezone.far
    ]);
  }
}
```

#### 1.3 Add Migration for Scenario Metadata
**File:** `backend/src/db/migrations/073_scenario_metadata.sql`

```sql
-- Add missing fields to development_scenarios for timeline/cost
ALTER TABLE development_scenarios 
  ADD COLUMN IF NOT EXISTS timeline VARCHAR(50),
  ADD COLUMN IF NOT EXISTS timeline_min_months INTEGER,
  ADD COLUMN IF NOT EXISTS timeline_max_months INTEGER,
  ADD COLUMN IF NOT EXISTS cost_estimate VARCHAR(50),
  ADD COLUMN IF NOT EXISTS cost_min_dollars INTEGER,
  ADD COLUMN IF NOT EXISTS cost_max_dollars INTEGER,
  ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20),
  ADD COLUMN IF NOT EXISTS success_probability INTEGER;

-- Add comments
COMMENT ON COLUMN development_scenarios.timeline IS 'Human-readable timeline (e.g., "6-9 months")';
COMMENT ON COLUMN development_scenarios.cost_estimate IS 'Human-readable cost (e.g., "$50K-$150K")';
COMMENT ON COLUMN development_scenarios.risk_level IS 'low | medium | high';
COMMENT ON COLUMN development_scenarios.success_probability IS 'Percent (0-100)';
```

### Phase 2: Downstream Module Integration

#### 2.1 3D Design Module - Load Active Scenario
**File:** `frontend/src/components/design/Building3DEditor.tsx`

**Add hook to load active scenario:**
```tsx
const [activeScenario, setActiveScenario] = useState<any>(null);

useEffect(() => {
  if (!dealId) return;
  
  const loadActiveScenario = async () => {
    try {
      const response = await fetch(
        `/api/v1/deals/${dealId}/scenarios?active=true`
      );
      const data = await response.json();
      
      if (data.scenarios && data.scenarios.length > 0) {
        setActiveScenario(data.scenarios[0]);
        
        // Set zoning envelope constraints from active scenario
        const envelope = {
          id: 'zoning-envelope-active',
          maxHeight: data.scenarios[0].max_stories * 12, // Approximate
          buildableArea: data.scenarios[0].max_footprint,
          FAR: data.scenarios[0].applied_far,
          maxUnits: data.scenarios[0].max_units,
          maxGFA: data.scenarios[0].max_gba
        };
        
        actions.setZoningEnvelope(envelope);
      } else {
        // No active scenario selected
        console.warn('No active scenario selected for this deal');
        showWarning('Please select a development path in the Capacity tab first');
      }
    } catch (error) {
      console.error('Failed to load active scenario:', error);
    }
  };
  
  loadActiveScenario();
}, [dealId]);
```

**Add validation against scenario constraints:**
```tsx
const validateDesignAgainstScenario = (metrics: BuildingMetrics) => {
  if (!activeScenario) return { valid: true, warnings: [] };
  
  const warnings: string[] = [];
  
  if (metrics.unitCount > activeScenario.max_units) {
    warnings.push(
      `Unit count (${metrics.unitCount}) exceeds scenario limit (${activeScenario.max_units})`
    );
  }
  
  if (metrics.totalSF > activeScenario.max_gba) {
    warnings.push(
      `Total GFA (${metrics.totalSF}) exceeds scenario limit (${activeScenario.max_gba})`
    );
  }
  
  if (metrics.height.stories > activeScenario.max_stories) {
    warnings.push(
      `Stories (${metrics.height.stories}) exceeds scenario limit (${activeScenario.max_stories})`
    );
  }
  
  return { valid: warnings.length === 0, warnings };
};
```

**Display scenario info in UI:**
```tsx
{activeScenario && (
  <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow-md">
    <div className="text-xs text-gray-500 mb-1">Active Scenario:</div>
    <div className="font-bold text-lg">{activeScenario.name}</div>
    <div className="text-sm text-gray-600 mt-2">
      Max: {activeScenario.max_units} units, {activeScenario.max_stories} stories
    </div>
  </div>
)}
```

#### 2.2 Financial Dashboard - Read from Active Scenario
**File:** `backend/src/services/proforma-generator.service.ts`

**Update to use active scenario:**
```typescript
async generateProforma(dealId: string) {
  // Get active scenario
  const scenarioResult = await pool.query(
    `SELECT * FROM development_scenarios 
     WHERE deal_id = $1 AND is_active = true 
     LIMIT 1`,
    [dealId]
  );
  
  if (scenarioResult.rows.length === 0) {
    throw new Error('No active scenario selected. Please select a development path first.');
  }
  
  const scenario = scenarioResult.rows[0];
  
  // Use scenario data as baseline
  const units = scenario.max_units;
  const gfa = scenario.max_gba;
  const parkingSpaces = scenario.parking_required;
  
  // If 3D design exists and is within scenario limits, use design metrics
  const design = await this.get3DDesign(dealId);
  if (design && this.validateDesignAgainstScenario(design, scenario)) {
    units = design.total_units;
    gfa = design.total_gfa;
    parkingSpaces = design.total_parking_spaces;
  }
  
  // Continue with proforma calculation...
  const construction = this.calculateConstructionCosts(gfa, parkingSpaces, scenario);
  const revenue = this.estimateRevenue(units, scenario);
  // ...
}
```

#### 2.3 API Endpoint - Get Active Scenario
**File:** `backend/src/api/rest/development-scenarios.routes.ts`

**Add query parameter support:**
```typescript
router.get('/deals/:dealId/scenarios', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { active } = req.query;
    
    let query = 'SELECT * FROM development_scenarios WHERE deal_id = $1';
    const params = [dealId];
    
    if (active === 'true') {
      query += ' AND is_active = true';
    }
    
    query += ' ORDER BY is_active DESC, created_at ASC';
    
    const result = await pool.query(query, params);
    
    res.json({
      scenarios: result.rows,
      active: result.rows.find(s => s.is_active) || null
    });
  } catch (error: any) {
    console.error('Error fetching scenarios:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### Phase 3: User Guidance & Validation

#### 3.1 Block Downstream Tabs Until Selection
**File:** `frontend/src/components/deal/DealTabs.tsx`

```tsx
const [hasActiveScenario, setHasActiveScenario] = useState(false);

useEffect(() => {
  const checkScenario = async () => {
    const response = await fetch(`/api/v1/deals/${dealId}/scenarios?active=true`);
    const data = await response.json();
    setHasActiveScenario(data.active !== null);
  };
  checkScenario();
}, [dealId]);

// Render tabs with disabled state
<Tab
  label="3D Design"
  disabled={!hasActiveScenario}
  tooltip={
    !hasActiveScenario 
      ? 'Select a development path in the Capacity tab first' 
      : undefined
  }
/>

<Tab
  label="Financial"
  disabled={!hasActiveScenario}
  tooltip={
    !hasActiveScenario 
      ? 'Select a development path in the Capacity tab first' 
      : undefined
  }
/>
```

#### 3.2 Add Warning Banner
**File:** `frontend/src/components/design/Building3DEditor.tsx`

```tsx
{!activeScenario && (
  <div className="absolute top-0 left-0 right-0 bg-yellow-100 border-b-2 border-yellow-400 p-4 z-50">
    <div className="flex items-center justify-between max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <span className="text-2xl">⚠️</span>
        <div>
          <div className="font-bold text-yellow-900">No Development Path Selected</div>
          <div className="text-sm text-yellow-800">
            Please select a development scenario (by-right, variance, or rezone) 
            in the Development Capacity tab before designing your building.
          </div>
        </div>
      </div>
      <button
        onClick={() => navigate(`/deals/${dealId}?tab=capacity`)}
        className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
      >
        Go to Capacity Tab
      </button>
    </div>
  </div>
)}
```

---

## 📋 Data Flow Checklist

### For Atlanta Development (300 units):

- [ ] **Step 1:** Property boundary saved (4.5 acres, 196K SF)
- [ ] **Step 2:** Zoning confirmed (MR-5, Atlanta, GA)
- [ ] **Step 3:** Capacity calculated
  - [ ] By-Right: 312 units created
  - [ ] Variance: 374 units created
  - [ ] Rezone: 499 units created
- [ ] **Step 4:** USER SELECTS SCENARIO
  - [ ] User clicks on "By-Right" card
  - [ ] `is_active = true` set in database
  - [ ] All other scenarios set `is_active = false`
- [ ] **Step 5:** 3D Design loads active scenario
  - [ ] Max units: 312
  - [ ] Max stories: 8
  - [ ] Max GFA: ~265K SF
  - [ ] Envelope constraints applied
- [ ] **Step 6:** User designs building
  - [ ] Validates against scenario limits
  - [ ] Warnings shown if exceeded
- [ ] **Step 7:** Financial dashboard uses scenario
  - [ ] Baseline from scenario
  - [ ] Actuals from 3D design (if within limits)
  - [ ] Timeline/costs match selected path

---

## 🚀 Implementation Priority

### Immediate (Day 1):
1. ✅ Add scenario cards to Development Capacity tab
2. ✅ Add `handleActivateScenario()` function
3. ✅ Create scenarios on capacity calculation
4. ✅ Add visual "Active" indicator

### Short-term (Day 2):
5. ✅ 3D Design loads active scenario
6. ✅ Financial dashboard reads active scenario
7. ✅ Add validation/warnings
8. ✅ Block tabs until selection made

### Polish (Day 3):
9. ✅ Add migration for timeline/cost fields
10. ✅ Add scenario comparison view
11. ✅ Add ability to switch scenarios
12. ✅ Add scenario change history

---

## 📊 Database Schema Updates

### Add to `development_scenarios`:
```sql
ALTER TABLE development_scenarios 
  ADD COLUMN IF NOT EXISTS timeline VARCHAR(50),
  ADD COLUMN IF NOT EXISTS cost_estimate VARCHAR(50),
  ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20),
  ADD COLUMN IF NOT EXISTS success_probability INTEGER;

-- Populate defaults for existing records
UPDATE development_scenarios 
SET 
  timeline = CASE name
    WHEN 'by_right' THEN '6-9 months'
    WHEN 'variance' THEN '9-18 months'
    WHEN 'rezone' THEN '12-36 months'
  END,
  cost_estimate = CASE name
    WHEN 'by_right' THEN '$50K-$150K'
    WHEN 'variance' THEN '$100K-$350K'
    WHEN 'rezone' THEN '$200K-$750K'
  END,
  risk_level = CASE name
    WHEN 'by_right' THEN 'low'
    WHEN 'variance' THEN 'medium'
    WHEN 'rezone' THEN 'high'
  END,
  success_probability = CASE name
    WHEN 'by_right' THEN 95
    WHEN 'variance' THEN 65
    WHEN 'rezone' THEN 35
  END
WHERE timeline IS NULL;
```

---

## 🔧 API Changes Summary

### New Endpoints:
None (all exist already)

### Modified Endpoints:

**GET `/api/v1/deals/:dealId/scenarios`**
- Add `?active=true` query parameter
- Returns only active scenario when filtered

**PUT `/api/v1/deals/:dealId/scenarios/:id/activate`**
- Sets `is_active = true` for selected scenario
- Sets `is_active = false` for all others
- Returns updated scenario

**POST `/api/v1/deals/:dealId/boundary`** (existing)
- Trigger: `createOrUpdateScenarios()` after capacity calculation
- Creates all 3 scenarios automatically
- Sets by-right as default active

---

## ✅ Success Criteria

### User can:
1. See all 3 development scenarios side-by-side
2. Click to select which path to pursue
3. See clear visual indicator of active scenario
4. Access 3D Design and Financial tabs only after selection
5. Change selected scenario at any time
6. See warnings if 3D design exceeds scenario limits

### System must:
1. Persist scenario selection to database
2. Load active scenario in all downstream modules
3. Validate building metrics against scenario constraints
4. Show timeline/cost estimates for each path
5. Default to by-right scenario after capacity calculation
6. Allow only one active scenario per deal

---

**End of Scenario Selection System Spec**

Ready to implement!
