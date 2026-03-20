# Zoning Entitlement Engine — Claude Code Session Prompts

═══════════════════════════════════════════════════════════════════
SESSION Z1: MERGE COMPONENTS — Design UI + Wired Backend
═══════════════════════════════════════════════════════════════════

Read these files in order:
1. `entitlement-comparison-engine (1).jsx` in the repo root — this is the DESIGN REFERENCE. Read the full file. It has the correct computation logic (calculateBuildableArea, calculateEnvelope, generatePathScenarios, rankZoningCodes), the constraint waterfall visualization, path comparison cards, next-best code ranking, and AI narrative. It uses hardcoded mock data.

2. `frontend/src/components/zoning/tabs/DevelopmentCapacityTab.tsx` (1,692 lines) — this is the WIRED version. It has real API connections (zoning-profile, scenarios, envelope-enrichment, density-benchmarks, Municode URL), Zustand store integration (zoningModuleStore, selectDevelopmentPath), scenario persistence to the database, and TypeScript types.

3. `zoning-interpretation-engine.md` — read the section "The 30+ Nuances That Affect the Math" for context on what the computation must handle.

Now merge them. The design reference provides the UI; the wired version provides the data layer.

Step 1: In DevelopmentCapacityTab.tsx, add the computation functions from the design reference:
- `calculateBuildableArea(parcel, zoning)` — computes gross lot, setback deduction (with corner lot handling), and net buildable area
- `calculateEnvelope(parcel, zoning, overrides)` — computes all four constraints (density cap, FAR cap with 15% common area factor and mixed-use floor heights, height cap, lot coverage cap), finds the binding constraint (minimum), computes parking (surface vs structured trigger), and estimated values
- `generatePathScenarios(parcel, currentZoning)` — generates 4 paths: By-Right, Overlay Bonus, Variance, Rezone, each with its own envelope recalculation
- `rankZoningCodes(parcel, currentZoning)` — ranks alternative zoning codes by risk-adjusted net expected value

These functions run CLIENT-SIDE as immediate calculations while the backend enrichment loads. They provide instant results even before the API responds.

Step 2: Add the UI components from the design reference:
- `ConstraintWaterfall` — shows all 4 constraints as horizontal bars with the binding constraint highlighted in red and tagged "BINDING". The explanation text shows: "Max units = MIN(density, FAR, height, coverage). The lowest is the binding constraint."
- `PathComparisonCards` — 4 clickable cards showing: path label, risk badge, max units (large number), binding constraint, timeline, approval probability, estimated value, parking type
- `EnvelopeDetail` — table showing all envelope parameters with values and source citations
- `PathComparisonTable` — side-by-side table comparing all 4 paths row by row
- `NextBestCodeRanking` — table of alternative zoning codes ranked by risk-adjusted value uplift

Step 3: Replace the existing DevelopmentCapacityTab render with the design reference's layout:
- Path selection cards at the top (replaces the current column-based layout)
- Three sub-tabs: Envelope Analysis (waterfall + detail), Path Comparison (table), Next-Best Code (ranking)
- AI Analysis card below the waterfall with contextual narrative per path

Step 4: Wire the path selection cards to the existing `handleSelectPath` function. When a user clicks a path card:
1. Call `handleSelectPath(pathId, envelope)` which already saves to Zustand store and persists to the database
2. Update the waterfall and detail table to show the selected path's envelope

Step 5: Feed the computation functions with data from the API response instead of mock data. In the existing `loadData` function:
- After fetching the zoning profile, construct a `parcel` object from the deal/profile data: `{ lot_size_sf: profile.lot_area_sf, is_corner: deal.is_corner || false, setbacks: { front_ft: profile.setback_front_ft, ... } }`
- After fetching the zoning profile, construct a `currentZoning` object: `{ max_density_units_per_acre: profile.max_density_per_acre, max_height_ft: profile.max_height_ft, max_far: profile.applied_far, lot_coverage_pct: profile.max_lot_coverage_pct, ... }`
- Call `calculateEnvelope(parcel, currentZoning)` and `generatePathScenarios(parcel, currentZoning)` to populate the waterfall and path cards
- If the backend also returns enrichment data or AI recommendations, merge them with the client-side calculations (backend values override where available)

Step 6: Keep the T color tokens and FONT definitions from the design reference (they match the Bloomberg aesthetic). Keep the Municode URL link from the existing component. Keep the source attribution footer from the design reference.

Build and verify: the Dev Capacity tab shows path selection cards, constraint waterfall with binding constraint highlighted, and the envelope detail table. Clicking a path card updates the display and persists to the database.


═══════════════════════════════════════════════════════════════════
SESSION Z2: DEAL TYPE ADAPTATION
═══════════════════════════════════════════════════════════════════

Status from Z1: DevelopmentCapacityTab has merged UI with constraint waterfall, path cards, and API wiring.

Read these files:
1. `zoning-deal-type-adaptation.md` in the repo's output directory or root — the full deal type adaptation spec
2. `frontend/src/shared/config/deal-type-visibility.ts` — the deal type system. M03 (Dev Capacity) is hidden for existing deals and visible for development/redevelopment.
3. `frontend/src/stores/dealStore.ts` — look at how projectType and existingProperty are stored

The DevelopmentCapacityTab currently shows the same UI regardless of deal type. It needs to adapt.

Step 1: Get the deal type inside the component. Import `useDealType` from the dealStore:
```typescript
import { useDealType } from '../../../stores/dealStore';
const dealType = useDealType();
```

Step 2: For DEVELOPMENT deals (current behavior + enhancements):
- Show the full path comparison: By-Right, Overlay Bonus, Variance, Rezone
- Show the constraint waterfall
- Show the Next-Best Code ranking
- Add: phasing analysis card if the site is > 5 acres ("Phase 1: 150 units, Phase 2: 170 units")
- This is what the component currently does, just cleaner

Step 3: For EXISTING deals, completely change the display:
- Replace "Development Paths" with "Expansion Analysis"
- Add a conformance check section at the top:
  ```typescript
  const existing = deal.existingProperty || { units: 0, totalSF: 0, stories: 0, parkingSpaces: 0 };
  const envelope = calculateEnvelope(parcel, zoningProfile);
  const conformance = {
    density: existing.units <= envelope.density_cap,
    far: existing.totalSF <= envelope.max_gfa,
    height: existing.stories <= envelope.max_stories,
    coverage: (existing.buildingFootprintSF / parcel.lot_size_sf) <= zoningProfile.max_lot_coverage_pct,
    parking: existing.parkingSpaces >= (existing.units * zoningProfile.parking_per_unit),
  };
  const untapped = {
    units: Math.max(0, envelope.max_units - existing.units),
    sf: Math.max(0, envelope.max_gfa - existing.totalSF),
    stories: Math.max(0, envelope.max_stories - existing.stories),
  };
  ```
- Show utilization bars: "Density: 320 of 350 allowed (91% utilized)" with green/amber/red coloring
- Show untapped entitlement hero card: "+30 units | +72,000 SF | +4 stories available"
- Replace the 4 development paths with 4 expansion paths:
  - "No Expansion" (baseline)
  - "Minor Expansion" (stay within parking trigger threshold)
  - "Major Expansion" (triggers full compliance)
  - "Conversion" (change of use)
- Add a compliance trigger warning if expansion exceeds the substantial improvement threshold
- Hide the Next-Best Code ranking tab (not relevant for existing)

Step 4: For REDEVELOPMENT deals:
- Show the conformance check (same as existing)
- Show the untapped entitlement (same as existing)
- Replace paths with redevelopment scenarios:
  - "Renovate in Place" (no structural changes, no compliance trigger)
  - "Partial Demo + Infill" (demo worst buildings, build new on freed footprint)
  - "Full Demo + Rebuild" (treat site as development — show full envelope)
  - "Vertical Addition" (add floors to existing structure)
- Each scenario card shows: total units after, cost estimate, timeline, whether it triggers full compliance
- Add a "Compliance Trigger Analysis" card showing: what renovations trigger ADA/parking/fire/energy code upgrades and estimated costs
- Show the constraint waterfall for the "Full Demo + Rebuild" scenario so the user can see the max potential

Step 5: The sub-tabs adapt by deal type:
- Development: Envelope Analysis | Path Comparison | Next-Best Code
- Existing: Conformance Check | Expansion Scenarios | (no third tab)
- Redevelopment: Current vs Allowed | Renovation Scenarios | Compliance Analysis

Step 6: In deal-type-visibility.ts, the M03 module is currently hidden for existing deals. This made sense when M03 was only "3D Building Design." But now that it includes the entitlement analysis (conformance check, untapped entitlement), it should be visible for ALL deal types — just with different content. Change the visibility: in the MODULE_TABS config for M02 (Zoning), the Dev Capacity sub-tab should be visible for all deal types but with the adapted content. Alternatively, if Dev Capacity is a sub-tab of Zoning (not M03), check where it's gated and make sure it shows for all types.

Actually — check first. Read how DevelopmentCapacityTab is mounted. It's a sub-tab inside ZoningModuleSection, not a separate sidebar tab. The sidebar tab is "Property & Zoning" (M02). If the zoning module itself is visible for all deal types, and Dev Capacity is one of its internal tabs, then the gating is inside ZoningModuleSection. Read `frontend/src/components/deal/sections/ZoningModuleSection.tsx` lines 39-43 — there are SIMPLIFIED_TABS for existing (3 tabs, no capacity) and FULL_TABS for dev/redev (6 tabs, includes capacity). For existing deals, add 'capacity' back to SIMPLIFIED_TABS since it now has relevant content (conformance check).

Build and verify: open an existing deal — the Zoning tab should show a Dev Capacity sub-tab with conformance check and untapped entitlement. Open a development deal — it shows the full path comparison and waterfall.


═══════════════════════════════════════════════════════════════════
SESSION Z3: INTERPRETATION PANEL + OVERRIDE MECHANISM
═══════════════════════════════════════════════════════════════════

Status from Z2: DevelopmentCapacityTab adapts by deal type. Waterfall and paths working.

Read `zoning-interpretation-engine.md` — sections "How Claude (Layer 1) Handles Interpretation", "The Resolution Engine (Layer 2)", and "What the User Sees".

The goal: every number in the envelope calculation should show WHERE it came from and HOW it was interpreted. Users must be able to override any parameter.

Step 1: Create an InterpretationPanel component within DevelopmentCapacityTab (or as a separate file imported into it). This panel shows below the path cards and above the waterfall.

For each resolved parameter, show a row:
```
⚙ [Parameter Name]: [Value Used]
  Rationale: [Why this value]
  Source: [Municode section] → [link]
  Confidence: ●●●○ [High/Medium/Low]
  [Override: input field]
```

Parameters to show:
- FAR type (residential/commercial/combined) and value
- FAR measurement basis (gross vs net lot area)
- Common area factor (%)
- Density measurement basis (gross vs net acres)
- Ground floor height (ft)
- Upper floor height (ft)
- Parking per unit (after any transit/shared reductions)
- Corner lot treatment (if applicable)
- Setback values (front/side/rear)
- Lot coverage definition (what counts as "covered")

Step 2: Wire the override mechanism. Each parameter row has an optional input field. When the user enters an override:
1. Store the override in component state: `const [overrides, setOverrides] = useState<Record<string, number>>({})`
2. Re-run `calculateEnvelope(parcel, zoningProfile, overrides)` with the overrides applied
3. The waterfall and path cards update instantly
4. Show a visual diff: "Platform: 3.2 → Your Override: 3.5 (+9.4%)"
5. Persist the override to the deal's zoning profile via PUT /api/v1/deals/:dealId/zoning-profile with a user_overrides JSONB field

Step 3: Add an interpretation mode toggle: [Conservative] [Moderate] [Aggressive]
- Conservative: uses worst-case on every ambiguity (lowest FAR, most restrictive parking, maximum setbacks)
- Moderate: uses the platform's best interpretation (default)
- Aggressive: uses developer-favorable readings on every ambiguity

When the mode changes:
1. Swap the resolved values for each ambiguous parameter
2. Re-run the envelope calculation
3. Show the unit count delta between modes: "Conservative: 218 units | Moderate: 245 units | Aggressive: 267 units"

Step 4: Add warning callouts for common pitfalls:
- If stormwater impervious surface limit data is missing: "⚠ Stormwater impervious limit not checked — county regulations may constrain before zoning coverage"
- If parking is the binding constraint: "⚠ Parking is your binding constraint. Transit reduction, shared parking, or structured parking can unlock additional units."
- If FAR confidence is "low": "⚠ FAR interpretation has ambiguity — confirm with the municipality's planning department before underwriting"
- If the building is nonconforming (existing/redev): "⚠ Existing building has nonconforming items. Expansion may trigger full code compliance."

Step 5: Source attribution on every parameter value. If the zoning profile has a `source_url` (Municode link), render each parameter's source as a clickable link: "Sec. 16-18A.007(2) → ↗" opening the Municode page. The existing `MunicodeLink` component in the codebase can be reused.

Build and verify: the interpretation panel shows below the path cards. Each parameter has a source citation. Override a value (e.g., change FAR from 3.2 to 3.5) and watch the waterfall recalculate. Toggle between Conservative/Moderate/Aggressive and see the unit count change.


═══════════════════════════════════════════════════════════════════
SESSION Z4: ZONING AGENT CLAUDE INTERPRETATION (Layer 1)
═══════════════════════════════════════════════════════════════════

Status from Z3: DevelopmentCapacityTab has interpretation panel with overrides working. Computation functions running client-side.

Read these files:
1. `backend/src/services/entitlement-comparison-engine.service.ts` (1,269 lines) — the existing backend service that uses Claude for analysis
2. `backend/src/api/rest/zoning-capacity.routes.ts` (1,260 lines) — the API routes
3. `zoning-interpretation-engine.md` — section "How Claude (Layer 1) Handles Interpretation" for the prompt structure

The backend already has a Claude integration in the entitlement engine. The goal is to enhance it so Claude extracts STRUCTURED zoning parameters that feed the frontend computation functions, instead of just generating text analysis.

Step 1: In `entitlement-comparison-engine.service.ts`, find where Claude is called (look for `anthropic.messages.create`). The existing call generates AI analysis text. Add a SECOND Claude call (or modify the existing one) that extracts structured parameters.

Create a new method `extractStructuredZoning(municodeText: string, districtCode: string, municipality: string)` that:
1. Sends the Municode text to Claude with the structured extraction prompt from zoning-interpretation-engine.md
2. The system prompt instructs Claude to return JSON matching this structure:
   ```json
   {
     "density": { "max_units_per_acre": 109, "measurement_basis": "gross_lot_area", "confidence": "high", "source": "Sec. 16-18A.007(1)", ... },
     "far": { "residential": 3.2, "commercial": 1.5, "combined": 3.2, "exclusions": { ... }, "confidence": "medium", "ambiguity": "...", ... },
     "height": { "max_ft": 225, "measurement_from": "mean_finished_grade", ... },
     "setbacks": { "front_ft": 0, "side_ft": 10, "rear_ft": 20, "corner_treatment": "...", ... },
     "parking": { "min_per_unit": 1.0, "guest_per_unit": 0.25, "transit_reduction": { ... }, ... },
     "coverage": { "max_lot_coverage_pct": 85, "includes_carports": true, ... }
   }
   ```
3. Parse Claude's response as JSON (strip markdown fences if present)
4. Validate the extracted values against reasonable ranges (density 0-500, FAR 0-20, height 0-1000, etc.)
5. Return the structured extraction

Step 2: Add a new API endpoint: POST /api/v1/deals/:dealId/zoning-interpretation
This endpoint:
1. Fetches the deal's zoning profile to get the district code and municipality
2. Fetches the Municode text for that district (use the existing municodeUrlService or scraping service)
3. Calls `extractStructuredZoning()` with the text
4. Returns the structured extraction to the frontend
5. Caches the result in the zoning_profiles table's `interpretation` JSONB column (add this column if it doesn't exist)

Step 3: On the frontend, in DevelopmentCapacityTab, after loading the zoning profile:
1. Check if interpretation data exists (cached from a previous extraction)
2. If not, call POST /api/v1/deals/:dealId/zoning-interpretation (show a loading spinner: "AI interpreting zoning code...")
3. When interpretation returns, feed it into the interpretation panel:
   - Each parameter shows Claude's extracted value, confidence, source section, and any ambiguity notes
   - If Claude flagged ambiguity, show it as a yellow warning on that parameter
   - The interpretation panel's values become the DEFAULT inputs to calculateEnvelope

Step 4: Add a "Re-interpret" button that re-runs the Claude extraction (in case the code was amended or the user wants a fresh analysis). Clear the cache and re-fetch.

Step 5: Create the municipality rule set cache. After Claude interprets a zoning district for the first time, store the general rules (FAR exclusions, parking policy, height measurement method) as a `municipality_rules` record. For subsequent deals in the same municipality with the same district code, use the cached rules instead of re-running Claude — only call Claude if the district code changes or the cache is older than 90 days.

The cache table (add via migration if needed):
```sql
CREATE TABLE IF NOT EXISTS municipality_zoning_rules (
  id SERIAL PRIMARY KEY,
  municipality VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  district_code VARCHAR(50) NOT NULL,
  rules JSONB NOT NULL,
  source_url TEXT,
  last_verified TIMESTAMPTZ DEFAULT NOW(),
  verified_by VARCHAR(50) DEFAULT 'zoning_agent',
  UNIQUE(municipality, state, district_code)
);
```

Build and verify: create a development deal in Atlanta. The system fetches the Municode text, Claude extracts structured parameters, the interpretation panel shows each parameter with confidence and source. On the second deal in the same Atlanta district, the cached rules load instantly without calling Claude.
