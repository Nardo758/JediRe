# Zoning Interpretation Engine — Deal Type Adaptation Addendum

## The Three Questions

Each deal type asks a fundamentally different question of the entitlement engine.
The math engine is the same — but the INPUTS change, the OUTPUTS are framed
differently, and the PATHS are different.

### Existing Acquisition: "What am I allowed to do with what's already here?"

The user already has (or is buying) a building. They want to know:
1. **Conformance check**: Does the existing building comply with current zoning?
   (Old buildings often don't — they were built under prior zoning and are now
   "legal nonconforming" or "grandfathered")
2. **Untapped entitlement**: How many MORE units could I add without rezoning?
   If zoning allows 245 units and the building has 120, there are 125 units
   of untapped entitlement. This is the hidden value most buyers miss.
3. **Expansion feasibility**: Can I add a wing, floors, or ADUs within the
   existing envelope? What triggers a code compliance upgrade?
4. **Conversion potential**: Can I convert office→residential, retail→residential,
   or hotel→apartments under current zoning?

The engine computes:
```
existing_units = deal.existingProperty.units  (from the deal object)
existing_building_sf = deal.existingProperty.totalSF
existing_stories = deal.existingProperty.stories
existing_lot_coverage = existing_building_sf / parcel.lot_size_sf

max_allowed = calculateEnvelope(parcel, zoningProfile)  // same math

untapped_units = max_allowed.max_units - existing_units
untapped_sf = max_allowed.max_gfa - existing_building_sf
untapped_stories = max_allowed.max_stories - existing_stories
untapped_coverage = zoningProfile.max_lot_coverage - existing_lot_coverage

conformance = {
  density: existing_units <= max_allowed.density_cap,
  far: existing_building_sf <= max_allowed.max_gfa,
  height: existing_stories <= max_allowed.max_stories,
  coverage: existing_lot_coverage <= zoningProfile.max_lot_coverage,
  parking: existing_parking >= required_parking,
  setbacks: checkSetbackConformance(existing_footprint, setbacks),
  is_conforming: all of the above are true,
  nonconforming_items: list of any that fail,
}
```

**UI for existing:**
```
┌──────────────────────────────────────────────────────────┐
│ ENTITLEMENT ANALYSIS — EXISTING ACQUISITION              │
│ Exchange at Holly Springs · 320 units · Built 2018       │
│                                                          │
│ CONFORMANCE CHECK                                        │
│ ✓ Density: 320 of 350 allowed (91% utilized)            │
│ ✓ FAR: 2.4 of 3.2 allowed (75% utilized)               │
│ ✓ Height: 4 of 8 stories (50% utilized)                 │
│ ✓ Coverage: 42% of 85% allowed                          │
│ ✗ Parking: 280 spaces / 320 required (NONCONFORMING)    │
│   Note: Grandfathered — built under prior code           │
│                                                          │
│ UNTAPPED ENTITLEMENT                                     │
│ ┌─────────────────────────────────────────────────────┐  │
│ │  +30 units │ +72,000 SF │ +4 stories │ 43% coverage│  │
│ │  available  │ available   │ available  │ remaining   │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ EXPANSION SCENARIOS                                      │
│ ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│ │ Add Wing │ │ Add Floor│ │ Add ADUs │ │ Conversion   │ │
│ │ +12 units│ │ +30 units│ │ +8 units │ │ Office→Resi  │ │
│ │ By-Right │ │ By-Right │ │ Variance │ │ CUP Required │ │
│ │ 6-8 mo   │ │ 8-12 mo  │ │ 4-6 mo   │ │ 12-18 mo     │ │
│ └─────────┘ └──────────┘ └──────────┘ └──────────────┘ │
│                                                          │
│ ⚠ PARKING TRIGGER: Adding >10 units triggers full       │
│   parking compliance for entire property (320 + new)     │
│   Est. cost: $2.1M structured parking addition           │
└──────────────────────────────────────────────────────────┘
```

**Key nuances for existing:**
- Nonconforming status: the existing building may violate current zoning
  (built under prior code). Know the legal implications — can they expand
  without bringing the whole property into compliance?
- Parking trigger: most codes require that if you expand beyond a threshold
  (often 10-25% of existing SF or any change of use), you must bring the
  ENTIRE property into current parking compliance. This can kill an expansion.
- Change of use: converting from one use to another (office→residential)
  may trigger different density/parking/FAR rules even without physical changes.
- Historic designation: some properties have historic overlay that restricts
  exterior modifications, height additions, or demolition.


### Development (Ground-Up): "What's the maximum I can build on this site?"

This is what the current engine already does. The user has vacant land
(or plans to demolish everything and start fresh). They want:
1. **Maximum envelope**: How many units, how tall, how much GFA
2. **Development paths**: By-Right vs Overlay vs Variance vs Rezone
3. **Binding constraint**: What's limiting me and can I negotiate it
4. **Path comparison**: Risk-adjusted value of each entitlement path

The engine computes:
```
max_allowed = calculateEnvelope(parcel, zoningProfile)  // existing logic
paths = generatePathScenarios(parcel, zoningProfile)    // existing logic
ranking = rankZoningCodes(parcel, zoningProfile)        // existing logic
```

**UI for development:** The existing entitlement comparison engine UI — path cards,
constraint waterfall, envelope detail, next-best code ranking. No changes needed
except adding the interpretation panel from the zoning-interpretation-engine doc.

**Key nuances for development:**
- Demolition of existing structures: if the site has a building, demo costs
  and any hazmat abatement must be factored (feeds into ProForma cost stack)
- Phasing: large sites may develop in phases — Phase 1 uses X% of entitlement,
  Phase 2 uses the rest. The engine should show phased build-out scenarios.
- Infrastructure capacity: water/sewer/traffic capacity may constrain
  independent of zoning. "Zoning allows 400 units but the water main only
  supports 250 without a $3M upgrade."
- Concurrency requirements: FL requires adequate public facilities (roads,
  schools, parks) at the time of development. This is a hard stop that
  zoning doesn't reflect.


### Redevelopment: "What can I tear down, keep, and build back?"

The hybrid. The user has an existing building and plans to partially or fully
renovate, demolish portions, and potentially add new construction. They want:
1. **Current vs allowed**: Same as existing — what's the gap?
2. **Demolition scenarios**: What happens if I tear down Building B but keep A?
3. **Renovation constraints**: Can I add floors to the existing structure?
4. **Nonconforming expansion rules**: If the building is nonconforming, what
   renovations trigger full code compliance?
5. **Phased approach**: Renovate existing first (keep it occupied), then
   demolish and build new on the remaining site

The engine computes:
```
// Same as existing — start with conformance check
existing_units = deal.existingProperty.units
max_allowed = calculateEnvelope(parcel, zoningProfile)
untapped = max_allowed.max_units - existing_units

// NEW: demolition scenarios
scenarios = [
  {
    name: "Renovate in Place",
    keep_units: existing_units,
    demo_units: 0,
    new_units: 0,
    total_units: existing_units,
    triggers_compliance: false,
    cost_basis: renovation_cost_per_unit * existing_units,
  },
  {
    name: "Partial Demo + Expansion",
    keep_units: existing_units * 0.6,  // keep 60% of building
    demo_units: existing_units * 0.4,
    new_units: calculate_new_on_freed_footprint(parcel, zoningProfile, demo_footprint),
    total_units: keep + new,
    triggers_compliance: true,  // likely triggers full parking/ADA compliance
    cost_basis: reno_cost + demo_cost + new_construction_cost,
  },
  {
    name: "Full Demo + Ground-Up",
    keep_units: 0,
    demo_units: existing_units,
    new_units: max_allowed.max_units,
    total_units: max_allowed.max_units,
    triggers_compliance: true,
    cost_basis: demo_cost + hazmat_cost + new_construction_cost,
  },
  {
    name: "Vertical Addition",
    keep_units: existing_units,
    demo_units: 0,
    new_units: (max_allowed.max_stories - existing_stories) * units_per_floor,
    total_units: existing_units + new,
    triggers_compliance: maybe,  // depends on whether structural mods trigger
    cost_basis: structural_reinforcement + new_floor_construction,
    feasibility_notes: "Requires structural analysis — existing foundation may not support additional floors",
  },
]
```

**UI for redevelopment:**
```
┌──────────────────────────────────────────────────────────┐
│ ENTITLEMENT ANALYSIS — REDEVELOPMENT                     │
│ Westshore Commons · 196 units · Built 1988               │
│                                                          │
│ CURRENT STATE vs ZONING CAPACITY                         │
│ ┌────────────────────────────────────────────────┐       │
│ │ Current: 196 units │ Allowed: 320 units        │       │
│ │ Utilization: ████████░░░░ 61%                  │       │
│ │ Untapped: 124 units of entitlement             │       │
│ └────────────────────────────────────────────────┘       │
│                                                          │
│ REDEVELOPMENT SCENARIOS                                   │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│ │ Renovate │ │ Partial  │ │ Full Demo│ │ Add Floors   │ │
│ │ In Place │ │ Demo+New │ │ + Rebuild│ │ (Vertical)   │ │
│ │          │ │          │ │          │ │              │ │
│ │ 196 units│ │ 258 units│ │ 320 units│ │ 246 units    │ │
│ │ $8.2M    │ │ $22.5M   │ │ $48M     │ │ $12.8M       │ │
│ │ 14 mo    │ │ 24 mo    │ │ 30 mo    │ │ 18 mo        │ │
│ │ No comp  │ │ Full comp│ │ Full comp│ │ Structural?  │ │
│ │ trigger  │ │ trigger  │ │ trigger  │ │ TBD          │ │
│ └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │
│                                                          │
│ COMPLIANCE TRIGGER ANALYSIS                              │
│ ⚠ Any expansion >25% of existing SF triggers:           │
│   • Full ADA compliance upgrade ($380K estimated)        │
│   • Current parking code (need 62 additional spaces)     │
│   • Current fire code sprinkler retrofit ($220K)         │
│   • Current energy code envelope upgrade ($450K)         │
│   Total compliance cost: ~$1.05M                         │
│                                                          │
│ ⚠ Nonconforming items on existing building:             │
│   • Parking: 156 spaces / 196 required (built 1988)     │
│   • Side setback: 8ft / 10ft required                    │
│   These are grandfathered but VOID if demo >50%          │
└──────────────────────────────────────────────────────────┘
```

**Key nuances for redevelopment:**
- The 50% rule: most jurisdictions have a "substantial improvement" threshold
  (often 50% of building value). If renovation costs exceed this, the entire
  building must be brought into current code compliance — not just the
  renovated portion. This can add $500K-$2M in unexpected costs.
- Nonconforming vesting: legal nonconforming status is LOST if the building
  is demolished beyond a threshold (varies: 50-75% of structure). Once lost,
  rebuild must comply with current zoning — which may allow FEWER units than
  what exists if the code was downzoned since original construction.
- Tenant relocation: FL and some cities require tenant relocation assistance
  if occupied residential buildings are demolished. Cost and timeline impact.
- Phasing feasibility: can you renovate Building A while tenants occupy
  Building B, then swap? This affects revenue loss projections in ProForma.
- Structural feasibility of vertical additions: the engine can compute the
  zoning envelope for additional floors, but structural capacity is a
  separate engineering question. Flag it as "requires structural analysis."
- Historic preservation: if any part of the building is historically
  designated, demolition may be prohibited and renovation must follow
  preservation standards (Secretary of Interior's Standards).

---

## How calculateEnvelope() Adapts by Deal Type

The core function signature changes to accept deal type context:

```typescript
interface EnvelopeInput {
  parcel: ParcelAttributes;
  zoningProfile: ResolvedZoningProfile;
  dealType: 'existing' | 'development' | 'redevelopment';
  
  // Only for existing / redevelopment
  existingProperty?: {
    units: number;
    totalSF: number;
    stories: number;
    buildingFootprintSF: number;
    yearBuilt: number;
    parkingSpaces: number;
    isNonconforming: boolean;
    nonconformingItems?: string[];
    historicDesignation?: boolean;
  };
  
  // Only for redevelopment
  redevelopmentScope?: {
    demoPercentage: number;        // 0-100, what % of existing to demolish
    keepBuildings?: string[];      // Building IDs to preserve
    addVertical: boolean;          // Adding floors to existing?
    changeOfUse: boolean;          // Converting use type?
    targetUse?: string;            // New use if converting
  };
}

interface EnvelopeOutput {
  // SHARED — all deal types
  max_units: number;
  binding_constraint: string;
  constraints: ConstraintDetail[];
  buildable_area: BuildableAreaDetail;
  parking: ParkingAnalysis;
  financials: EnvelopeFinancials;
  
  // EXISTING — additional fields
  conformance?: {
    is_conforming: boolean;
    utilization_pct: number;
    items: ConformanceItem[];      // Per-parameter pass/fail
  };
  untapped?: {
    units: number;
    sf: number;
    stories: number;
    coverage_pct: number;
  };
  expansion_scenarios?: ExpansionScenario[];
  
  // REDEVELOPMENT — additional fields
  redevelopment_scenarios?: RedevelopmentScenario[];
  compliance_triggers?: ComplianceTrigger[];
  nonconforming_risk?: {
    items: string[];
    vesting_loss_threshold_pct: number;  // Usually 50%
    current_renovation_pct: number;
  };
}
```

---

## The Path System by Deal Type

### Existing — Expansion Paths (not development paths)
```
Path 1: No Expansion (baseline — just buy and operate)
Path 2: Minor Expansion (within parking trigger threshold)
Path 3: Major Expansion (triggers full compliance)
Path 4: Conversion (change of use — same structure)
```

### Development — Development Paths (current system)
```
Path 1: By-Right (no approvals needed)
Path 2: Overlay/Bonus (use available incentives)
Path 3: Variance/SAP (negotiate with planning)
Path 4: Rezone (change the base zoning district)
```

### Redevelopment — Renovation Paths
```
Path 1: Renovate in Place (no structural changes)
Path 2: Partial Demo + Infill (demo worst buildings, build new)
Path 3: Full Demo + Rebuild (treat as development)
Path 4: Vertical Addition (add floors to existing)
Path 5: Phase 1 Reno + Phase 2 New (staged approach)
```

---

## ProForma Cost Stack Differences

The entitlement engine feeds different cost line items to ProForma by deal type:

### Existing → ProForma
- Renovation cost per unit (interior, exterior)
- Compliance upgrade costs (if expanding)
- No land development costs
- No impact fees (unless expanding)

### Development → ProForma
- Land acquisition
- Impact fees
- Site preparation
- Hard costs (new construction $/SF)
- Soft costs (A&E, permits, marketing)
- Parking construction (surface vs structured)

### Redevelopment → ProForma
- Acquisition price
- Demolition + hazmat abatement
- Tenant relocation costs
- Lost revenue during renovation
- Renovation costs (kept buildings)
- New construction costs (new buildings)
- Compliance upgrade costs
- Impact fees (for net new units only — some jurisdictions credit existing units)

The "impact fee credit" is a common redevelopment benefit: if the property
currently has 196 units and you're building 258, you only pay impact fees
on the 62 NET NEW units, not all 258. This can save $500K-$1M in Florida.
