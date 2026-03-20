# Scenario Selection Implementation Progress

## ✅ Completed (Steps 1-2)

### Step 1: Database Migration Created ✅
**File:** `backend/src/db/migrations/073_scenario_metadata.sql`
- Added `timeline`, `cost_estimate`, `risk_level`, `success_probability` columns
- Populated defaults for existing scenarios
- Ready to run migration

### Step 2: Backend Auto-Create Scenarios ✅
**File:** `backend/src/api/rest/property-boundary.routes.ts`
- Added `createOrUpdateScenarios()` function
- Extracts by-right, variance, rezone from capacity analysis
- Creates all 3 scenarios with metadata (timeline, cost, risk)
- Sets by-right as default active
- Called automatically when property boundary is saved

**What happens now:**
```
User saves property boundary
  ↓
triggerZoningAutoPopulate() runs
  ↓
Calculates capacity (by-right, variance, rezone)
  ↓
createOrUpdateScenarios() runs
  ↓
Creates 3 scenarios in development_scenarios table
  ↓
by_right set as is_active = true
```

---

## 🚧 Next Steps (Step 3)

### Step 3: Frontend - Add Persistence to Selection
**File:** `frontend/src/components/zoning/tabs/DevelopmentCapacityTab.tsx`

Need to add:
1. **State for scenarios:**
   ```typescript
   const [scenarios, setScenarios] = useState<any[]>([]);
   const [activeScenario, setActiveScenario] = useState<any>(null);
   const [activatingScenario, setActivatingScenario] = useState(false);
   ```

2. **loadScenarios() function:**
   - Fetches from `GET /api/v1/deals/:dealId/scenarios`
   - Sets active scenario in Zustand store
   - Called on component mount

3. **Update handleSelectPath():**
   - Keep existing logic
   - Add API call to persist selection
   - Create/update scenario if doesn't exist
   - Call activate endpoint
   - Show loading state while saving

4. **Update button rendering:**
   - Show "Active" for persisted selection
   - Show "Saving..." during API call
   - Disable buttons while saving

---

## 📝 Implementation Code for Step 3

### Add State Variables (line ~145)
```typescript
const [scenarios, setScenarios] = useState<any[]>([]);
const [activeScenario, setActiveScenario] = useState<any>(null);
const [activatingScenario, setActivatingScenario] = useState(false);
```

### Add loadScenarios Function (after handleSelectPath)
```typescript
const loadScenarios = useCallback(async () => {
  if (!dealId) return;
  
  try {
    const response = await apiClient.get(`/api/v1/deals/${dealId}/scenarios`);
    const scenarioList = response.data.scenarios || [];
    const active = scenarioList.find((s: any) => s.is_active);
    
    setScenarios(scenarioList);
    setActiveScenario(active || null);
    
    // If there's an active scenario, set it in Zustand store
    if (active) {
      const pathId = active.name as DevelopmentPath;
      const envelope: BuildingEnvelope = {
        max_units: active.max_units,
        max_gfa_sf: active.max_gba,
        max_stories: active.max_stories,
        max_footprint_sf: active.max_footprint,
        buildable_polygon: null,
        required_parking_spaces: active.parking_required,
        parking_structure_type: active.max_units > 200 ? 'podium' : active.max_units > 100 ? 'garage' : 'surface',
        parking_levels: 0,
        residential_floors: active.max_stories,
        ground_floor_retail_sf: 0,
        construction_type: active.max_stories <= 4 ? 'wood_frame' : active.max_stories <= 7 ? 'podium_wood' : 'steel_concrete',
      };
      
      selectDevelopmentPath(pathId, envelope);
      setSelectedColKey(pathId);
    }
  } catch (error) {
    console.error('Failed to load scenarios:', error);
  }
}, [dealId, selectDevelopmentPath]);
```

### Update handleSelectPath to Persist (replace existing function at line ~164)
```typescript
const handleSelectPath = useCallback(async (colKey: string, rec: any) => {
  if (!dealId) return;
  
  setSelectedColKey(colKey);
  const pathId = colKeyToPathId(colKey);
  const units = rec.maxUnits || 0;
  const gba = rec.maxGba || 0;
  const stories = rec.maxStories || 1;
  const parking = rec.parkingRequired || 0;
  const footprint = stories > 0 ? Math.round(gba / stories / 0.82) : 0;
  const constructionType: BuildingEnvelope['construction_type'] =
    stories <= 4 ? 'wood_frame' : stories <= 7 ? 'podium_wood' : 'steel_concrete';
  const parkingType: BuildingEnvelope['parking_structure_type'] =
    units > 200 ? 'podium' : units > 100 ? 'garage' : 'surface';

  const envelope: BuildingEnvelope = {
    max_units: units,
    max_gfa_sf: gba,
    max_stories: stories,
    max_footprint_sf: footprint,
    buildable_polygon: null,
    required_parking_spaces: parking,
    parking_structure_type: parkingType,
    parking_levels: parkingType === 'surface' ? 0 : Math.ceil(parking * 350 / Math.max(footprint, 1)),
    residential_floors: stories - (parkingType !== 'surface' ? 1 : 0),
    ground_floor_retail_sf: units > 150 ? 5000 : 0,
    construction_type: constructionType,
  };

  // Update Zustand store
  selectDevelopmentPath(pathId, envelope);
  
  // Persist to database
  try {
    setActivatingScenario(true);
    
    // Check if scenario exists
    const existingRes = await apiClient.get(`/api/v1/deals/${dealId}/scenarios`);
    const existing = existingRes.data.scenarios?.find((s: any) => s.name === pathId);
    
    let scenarioId: string;
    if (existing) {
      scenarioId = existing.id;
    } else {
      // Create scenario if it doesn't exist
      const scenarioData = {
        name: pathId,
        is_active: false,
        use_mix: { residential_pct: 100 },
        avg_unit_size_sf: Math.round(gba / Math.max(units, 1)),
        efficiency_factor: 0.85,
        max_gba: gba,
        max_footprint: footprint,
        net_leasable_sf: Math.round(gba * 0.85),
        parking_required: parking,
        max_stories: stories,
        max_units: units,
        applied_far: rec.appliedFar || null,
        binding_constraint: rec.bindingConstraint || null
      };
      const createRes = await apiClient.post(`/api/v1/deals/${dealId}/scenarios`, scenarioData);
      scenarioId = createRes.data.scenario.id;
    }
    
    // Activate the scenario
    await apiClient.put(`/api/v1/deals/${dealId}/scenarios/${scenarioId}/activate`);
    
    // Reload scenarios
    await loadScenarios();
    
    console.log(`✅ Activated ${pathId} scenario for deal ${dealId}`);
  } catch (error) {
    console.error('Failed to persist scenario selection:', error);
  } finally {
    setActivatingScenario(false);
  }
}, [dealId, selectDevelopmentPath, loadScenarios]);
```

### Update useEffect to Load Scenarios (line ~270)
```typescript
useEffect(() => {
  loadData();
  loadScenarios(); // NEW: Load scenarios on mount
}, [loadData, loadScenarios]);
```

### Update Button Rendering (line ~1025)
Replace the cols.map section in the "Select Path" row with:
```typescript
{cols.map((col: any, colIdx: number) => {
  const isSelected = selectedColKey === col.key;
  const pathId = colKeyToPathId(col.key);
  const isPersisted = activeScenario?.name === pathId;
  const rec = recommendations[colIdx];
  
  return (
    <td key={col.key} className="px-3 py-3 text-center">
      <button
        onClick={() => rec && handleSelectPath(col.key, rec)}
        disabled={activatingScenario}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          isPersisted
            ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
            : isSelected
            ? 'bg-blue-100 text-blue-700 border border-blue-300'
            : 'bg-white text-blue-700 border border-blue-300 hover:bg-blue-50 hover:border-blue-400'
        } ${activatingScenario ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {activatingScenario && isSelected ? (
          <>
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
            Saving...
          </>
        ) : isPersisted ? (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Active
          </>
        ) : isSelected ? (
          'Selected'
        ) : (
          'Select'
        )}
      </button>
    </td>
  );
})}
```

---

## ✅ Testing Checklist

After implementing Step 3:

1. [ ] Run migration: `073_scenario_metadata.sql`
2. [ ] Restart backend server
3. [ ] Navigate to Development Capacity tab
4. [ ] Verify table shows scenarios with "Select" buttons
5. [ ] Click "Select" on By-Right
   - [ ] Button shows "Saving..."
   - [ ] Button changes to "Active" with checkmark
6. [ ] Refresh page
   - [ ] By-Right still shows "Active"
7. [ ] Click Variance scenario
   - [ ] By-Right deactivates
   - [ ] Variance becomes "Active"
8. [ ] Check database:
   ```sql
   SELECT name, is_active, max_units, max_stories, timeline, cost_estimate
   FROM development_scenarios
   WHERE deal_id = 'e044db04-439b-4442-82df-b36a840f2fd8'
   ORDER BY name;
   ```
9. [ ] Check console for "✅ Activated {path} scenario" message

---

## 📊 Current Status

**Completed:**
- ✅ Database schema ready (migration created)
- ✅ Backend auto-creates scenarios on boundary save
- ✅ Scenarios include timeline, cost, risk metadata

**Next:**
- 🚧 Frontend persistence (Step 3)
- 🚧 3D Design integration (Step 4)
- 🚧 Financial Dashboard integration (Step 5)

**Estimated Time Remaining:** 1-2 hours for Step 3

---

Ready to implement Step 3 (frontend updates)?
