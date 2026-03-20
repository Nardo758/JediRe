# JEDI RE — Zoning Interpretation Engine Architecture

## The Core Problem

The entitlement math is: max_units = MIN(density_cap, far_cap, height_cap, coverage_cap)

But every INPUT to that math is an interpretation decision:

- What IS the FAR? Gross FAR, residential FAR, or combined FAR?
  → Miami uses "Floor Lot Ratio" (not FAR), computed differently
  → Atlanta MRC-3 has separate residential/commercial FAR with a combined cap
  → Tampa sometimes uses "Floor Area" as an absolute number, not a ratio

- What COUNTS toward FAR? Does the parking structure count? Balconies? 
  Mechanical rooms? Ground-floor retail in a mixed-use building?
  → Each municipality has different FAR exclusions
  → Miami 21 excludes open parking from FAR but includes structured parking
  → Atlanta excludes structured parking entirely
  → Tampa excludes the first floor of structured parking only

- What IS the lot area? Gross lot area including easements, or net buildable?
  → Some codes measure density against GROSS lot area
  → Others measure against NET (after setback deduction, easement deduction)
  → Some have a third concept: "effective lot area" with its own definition

- How do setbacks work for irregular parcels?
  → Rectangular approximation is wrong for L-shaped or triangular lots
  → Corner lots: which sides get "front" setback vs "side" setback?
  → Some municipalities require additional setback for buildings above a height threshold
  → Step-back requirements: first 4 floors at 0ft setback, floors 5+ step back 10ft

- What IS a "unit" for density calculations?
  → Some codes count efficiency/studio as 0.5 units
  → Some exclude affordable units from the density count (incentive zoning)
  → Some count by bedrooms, not units (3BR = 3 "equivalent units")

These aren't edge cases. They come up on EVERY deal.

---

## The Three-Layer Interpretation Pipeline

```
LAYER 1: ZONING TEXT EXTRACTION (Claude AI)
  Input:  Municode ordinance text + municipal code PDF
  Output: Raw parameters with source citations
  Agent:  Zoning Agent (A03 — already exists)
  
  Claude reads the zoning code text and extracts:
  - Every numeric parameter (density, FAR, height, setbacks, parking)
  - The DEFINITIONS section (what counts toward FAR, what's a "unit")
  - Conditional clauses ("if within 500ft of transit, parking reduced 20%")
  - Cross-references to other code sections
  - Amendment history
  
  Each extraction is tagged with:
  - Source: Municode URL + section number
  - Confidence: how unambiguous the text is
  - Interpretation notes: any ambiguity flagged for human review

         ↓

LAYER 2: STRUCTURED PARAMETER ASSEMBLY (Rule Engine)
  Input:  Raw extracted parameters + parcel attributes
  Output: ZoningProfile (the structured object the math consumes)
  Service: entitlement-comparison-engine.service.ts (backend)
  
  This layer resolves the interpretation decisions:
  - Selects the correct FAR (residential vs commercial vs combined)
    based on the proposed use type
  - Applies the correct FAR exclusion rules for this municipality
  - Determines which lot area measurement to use (gross vs net)
  - Handles conditional bonuses (transit proximity, affordable set-aside)
  - Resolves overlay district modifications
  - Applies step-back requirements to height calculations
  
  Every resolved parameter carries:
  - The value used
  - WHY this value was chosen (which code section, which interpretation)
  - Alternative interpretations (conservative vs aggressive)
  - Confidence level

         ↓

LAYER 3: MATH ENGINE (Deterministic Calculation)
  Input:  ZoningProfile (fully resolved, no interpretation left)
  Output: Development envelope with binding constraint identified
  Function: calculateEnvelope() — already built in the frontend component
  
  This layer is PURE MATH. No interpretation decisions.
  Given resolved inputs, compute the four constraints, find the minimum.
  This is the part that's already correct in the entitlement-comparison-engine.
```

---

## The 30+ Nuances That Affect the Math

### CATEGORY 1: FAR Interpretation (affects far_cap)

| # | Nuance | Example | Impact |
|---|--------|---------|--------|
| 1 | **Residential vs commercial vs combined FAR** | Atlanta MRC-3: res FAR 3.2, comm FAR 1.5, combined 3.2 | Choosing wrong FAR can over/undercount by 40%+ |
| 2 | **FAR exclusions** | Miami 21 excludes open parking from FAR | Including excluded areas inflates FAR consumption, reduces unit count |
| 3 | **FAR measurement basis** | Some use GROSS lot area, others NET (after setback deduction) | 15-25% difference on typical urban parcels |
| 4 | **Common area factor** | Industry standard 15%, but some codes define it at 10% or 20% | Each 5% changes unit count by ~5% |
| 5 | **Amenity exclusions** | Rooftop amenity decks, fitness centers — some codes exclude from FAR, some include | Can swing 2,000-5,000 SF of "free" space |
| 6 | **Below-grade exclusions** | Basement/cellar parking usually excluded, but definitions vary | Underground parking may or may not help |
| 7 | **Mechanical exclusions** | Roof mechanical rooms, elevator overruns — typically excluded up to a % | Can affect whether you hit the height limit |

**How the engine handles it:**
```typescript
interface FARResolution {
  applied_far: number;           // The FAR value we're using
  far_type: 'residential' | 'commercial' | 'combined' | 'floor_lot_ratio';
  measurement_basis: 'gross_lot' | 'net_buildable' | 'effective_lot';
  exclusions: {
    open_parking: boolean;
    structured_parking: boolean;  // or 'first_floor_only'
    balconies: boolean;
    mechanical: boolean;
    amenity_common: boolean;
    below_grade: boolean;
  };
  common_area_factor: number;    // 0.10 to 0.20
  source_section: string;        // "Sec. 16-18A.007(3)(b)"
  source_url: string;            // Municode deep link
  confidence: 'high' | 'medium' | 'low';
  interpretation_notes: string;  // "Code is ambiguous on structured parking; used conservative interpretation"
  alternative_interpretation?: {
    applied_far: number;
    rationale: string;
  };
}
```

### CATEGORY 2: Density Interpretation (affects density_cap)

| # | Nuance | Example | Impact |
|---|--------|---------|--------|
| 8 | **Gross vs net lot area for density** | "109 units/acre" — gross or net acres? | 15-25% swing |
| 9 | **Unit equivalency** | Studios count as 0.5, 3BRs count as 1.5 in some jurisdictions | Can increase actual unit count by 20-30% for studio-heavy projects |
| 10 | **Affordable housing exemptions** | 20% affordable set-aside units don't count toward density | Effectively increases allowable market-rate units |
| 11 | **Minimum lot size per unit** | Some codes express density as "min 2,000 SF per unit" instead of "units/acre" | Different computation path |
| 12 | **Density bonuses for specific uses** | Senior housing gets 25% density bonus in some FL jurisdictions | Significantly changes feasibility for age-restricted product |
| 13 | **Density averaging across PUD parcels** | Planned Unit Developments can average density across multiple parcels | One parcel can exceed density if another is under |

### CATEGORY 3: Height Interpretation (affects height_cap)

| # | Nuance | Example | Impact |
|---|--------|---------|--------|
| 14 | **Floor height assumptions** | Ground floor retail: 14ft? 16ft? 18ft? Upper residential: 9ft? 10ft? 11ft? | 1ft per floor × 20 floors = 20ft difference = 2 fewer floors |
| 15 | **Step-back requirements** | "Floors 1-4: 0ft setback. Floors 5+: 10ft step-back from facade" | Reduces floor plate above step-back, affecting units/floor |
| 16 | **Height measurement point** | From grade? From flood elevation? From mean sea level? | Coastal FL properties can gain/lose a full story |
| 17 | **Roof structure exclusions** | Elevator overruns, HVAC penthouses, parapets — usually excluded up to 12-15ft | Affects whether you can squeeze one more residential floor |
| 18 | **Height districts / height maps** | Some cities have height overlay maps that supersede the base zoning district | Must cross-reference the height map, not just the code |
| 19 | **Airport zones** | FAA height restrictions near airports override zoning | Can cap a project at 4-5 stories regardless of zoning |
| 20 | **View corridor protections** | Miami Beach, some coastal FL cities restrict height to protect sight lines | Hard cap that may be lower than zoning allows |

### CATEGORY 4: Lot Coverage Interpretation (affects coverage_cap)

| # | Nuance | Example | Impact |
|---|--------|---------|--------|
| 21 | **What counts as "covered"** | Building footprint only? Or including covered parking, canopies, covered walkways? | Can swing 5-15% of lot area |
| 22 | **Open space requirements** | Some codes require X% open space AT GRADE (rooftop doesn't count) | Limits footprint even if coverage allows more |
| 23 | **Impervious surface limits** | Stormwater codes limit total impervious surface (building + parking + drives) | Often the REAL binding constraint in FL, not the zoning coverage |
| 24 | **Green space vs open space** | Some codes distinguish "landscaped open space" from "recreation open space" | May need both types, each eating into buildable area |

### CATEGORY 5: Parking Interpretation (often the REAL binding constraint)

| # | Nuance | Example | Impact |
|---|--------|---------|--------|
| 25 | **Transit proximity reduction** | Within 1/4 mile of transit: 20-50% parking reduction | Massive impact — can shift from structured to surface |
| 26 | **Shared parking** | Mixed-use buildings: office parking is empty at night when residents are home | Can reduce total spaces by 15-25% |
| 27 | **Parking maximums** (not minimums) | Some progressive cities have MAXIMUM parking caps, not minimums | Affects whether structured parking pencils |
| 28 | **Guest parking** | 0.25 guest spaces/unit is common but some cities require 0.5 or none | Adds 25-50% more spaces |
| 29 | **Bicycle parking substitution** | Some codes allow bike parking to replace 5-10% of auto parking | Minor but can tip the surface-vs-structured threshold |
| 30 | **Tandem/compact allowances** | Some allow 20% compact spaces (8ft vs 9ft wide) or tandem parking | Reduces total parking area needed |
| 31 | **Surface parking lot coverage** | Does the surface parking lot count toward lot coverage? | If yes, parking itself becomes the coverage binding constraint |

### CATEGORY 6: Overlay & Bonus Interpretation

| # | Nuance | Example | Impact |
|---|--------|---------|--------|
| 32 | **Overlay vs base zoning conflict** | Overlay says max 8 stories, base zoning says 20 stories — which wins? | Usually the MORE RESTRICTIVE controls |
| 33 | **Incentive stacking** | Affordable housing bonus + transit bonus + green building bonus — can they stack? | Some jurisdictions allow stacking, others cap total bonus |
| 34 | **Inclusionary zoning triggers** | Above X units, must provide Y% affordable — changes the financial model | Not a zoning constraint but affects the ProForma directly |

---

## How Claude (Layer 1) Handles Interpretation

The Zoning Agent doesn't just extract numbers. It extracts the DECISION CONTEXT.

### Prompt Structure for Zoning Code Interpretation

```
You are a zoning code interpreter for a real estate development feasibility analysis.

I will give you the full text of a zoning district from {municipality}'s code of ordinances.

For each parameter, extract:
1. The numeric value
2. The EXACT section reference (e.g., "Sec. 16-18A.007(3)(b)")
3. Any conditions that modify the value (transit proximity, affordable set-aside, overlay)
4. The DEFINITION used (e.g., "FAR is defined in Sec. 16-28.001 as...")
5. Any ambiguity you notice — where the code could be interpreted two ways

Specifically extract:

DENSITY:
- Maximum density (units per acre) — is this GROSS or NET acres?
- Any unit equivalency rules (do studios count as 0.5 units?)
- Any density bonuses available and their requirements
- Minimum lot area per unit (if density is expressed this way instead)

FAR:
- Residential FAR (if separate)
- Commercial/Non-residential FAR (if separate)
- Combined/Total FAR cap (if applicable)
- What is EXCLUDED from FAR calculation? List each exclusion:
  □ Open/surface parking
  □ Structured parking (all, first floor only, or none)
  □ Balconies (enclosed? unenclosed?)
  □ Mechanical rooms/equipment
  □ Common area/corridors (or are they part of the FAR?)
  □ Amenity spaces (pool deck, fitness, leasing office)
  □ Below-grade space
- Is FAR measured against GROSS lot area or NET (after setbacks)?

HEIGHT:
- Maximum height in feet
- Maximum stories (if specified separately)
- How is height measured? (from grade, from BFE, from mean finished grade)
- Any step-back requirements above a certain floor?
- Roof structure exclusions (how many feet above max?)
- Any height overlay map that supersedes?

SETBACKS:
- Front, side, rear in feet
- Are there different setbacks above certain heights?
- Corner lot treatment — which sides are "front"?
- Do step-backs count as setbacks at upper floors?

PARKING:
- Minimum spaces per unit (by bedroom count?)
- Guest parking requirement
- Any transit proximity reductions? (distance threshold + reduction %)
- Shared parking provisions for mixed-use?
- Compact/tandem allowances?
- Maximum parking caps?
- Bicycle parking substitution?

LOT COVERAGE:
- Maximum lot coverage %
- What counts as "covered"? Building footprint only or include carports/canopies?
- Separate impervious surface limit?
- Open space requirement (at grade? or any level?)
- Landscaping/buffer requirements eating into coverage?

OVERLAYS & BONUSES:
- Any overlay districts applicable?
- Each overlay's modifications to base parameters
- Can bonuses from multiple programs stack?
- Affordable housing incentive thresholds and benefits

For each parameter, rate your confidence:
- HIGH: Unambiguous numeric value with clear definition
- MEDIUM: Numeric value found but definition/measurement basis has some ambiguity
- LOW: Value inferred or calculated from related provisions; needs human verification

Format as JSON matching the ZoningProfile interface.
```

### What Claude Returns

```json
{
  "district_code": "MRC-3",
  "municipality": "City of Atlanta",
  "source_document": "Atlanta Code of Ordinances, Chapter 16, Part 18A",
  
  "density": {
    "max_units_per_acre": 109,
    "measurement_basis": "gross_lot_area",
    "unit_equivalency": "standard (1 unit = 1 unit regardless of bedroom count)",
    "bonuses": [
      {
        "type": "beltline_overlay",
        "bonus_pct": 20,
        "requirement": "20% affordable at 80% AMI",
        "source": "Sec. 16-36.010(b)(2)"
      }
    ],
    "source": "Sec. 16-18A.007(1)",
    "confidence": "high",
    "notes": "Code clearly states 'dwelling units per gross acre of land area'"
  },
  
  "far": {
    "residential": 3.2,
    "commercial": 1.5,
    "combined": 3.2,
    "applied_type": "combined",
    "measurement_basis": "gross_lot_area",
    "exclusions": {
      "open_parking": true,
      "structured_parking": true,
      "balconies_enclosed": false,
      "balconies_unenclosed": true,
      "mechanical_rooms": true,
      "below_grade": true,
      "amenity_common": false
    },
    "common_area_note": "Code does not explicitly define common area factor. Industry standard 15% applied.",
    "source": "Sec. 16-18A.007(2) and Sec. 16-28.001(24)",
    "confidence": "medium",
    "ambiguity": "Section 16-28.001 defines FAR as 'the ratio of total floor area to lot area' but does not specify gross vs net. Section 16-18A.007(2) lists exclusions but is silent on enclosed balconies. Conservative interpretation: enclosed balconies count toward FAR."
  },
  
  "height": {
    "max_ft": 225,
    "max_stories": null,
    "measurement_from": "mean_finished_grade",
    "step_back": null,
    "roof_exclusion_ft": 15,
    "height_overlay": null,
    "airport_restriction": null,
    "source": "Sec. 16-18A.007(4)",
    "confidence": "high"
  },
  
  "setbacks": {
    "front_ft": 0,
    "side_ft": 10,
    "rear_ft": 20,
    "corner_treatment": "Two front setbacks (0ft) on street-facing sides, side setback (10ft) on non-street side",
    "height_dependent_setback": null,
    "source": "Sec. 16-18A.007(5)",
    "confidence": "high"
  },
  
  "parking": {
    "min_per_unit": 1.0,
    "guest_per_unit": 0.25,
    "by_bedroom": false,
    "transit_reduction": {
      "eligible": true,
      "distance_ft": 1320,
      "reduction_pct": 20,
      "transit_type": "MARTA heavy rail or BRT",
      "source": "Sec. 16-18A.008(2)(c)"
    },
    "shared_parking": {
      "eligible": true,
      "reduction_pct": 15,
      "requirement": "minimum 30% non-residential use",
      "source": "Sec. 16-18A.008(3)"
    },
    "compact_pct": 20,
    "max_cap": null,
    "source": "Sec. 16-18A.008",
    "confidence": "high"
  },
  
  "coverage": {
    "max_lot_coverage_pct": 85,
    "includes_carports": true,
    "impervious_limit_pct": null,
    "open_space_pct": 15,
    "open_space_at_grade": false,
    "source": "Sec. 16-18A.007(6)",
    "confidence": "medium",
    "ambiguity": "Open space provision states '15% usable open space' but does not specify at-grade requirement. Rooftop amenity decks likely qualify per Sec. 16-28.001(36) definition."
  }
}
```

---

## The Resolution Engine (Layer 2)

Layer 2 takes Claude's structured extraction and the parcel's specific attributes
to resolve every interpretation decision into a single number the math engine can use.

```typescript
interface ResolutionDecision {
  parameter: string;
  value_used: number;
  interpretation: 'conservative' | 'moderate' | 'aggressive';
  rationale: string;
  source: string;
  confidence: 'high' | 'medium' | 'low';
  alternative_value?: number;
  alternative_rationale?: string;
}

function resolveZoningProfile(
  claudeExtraction: ClaudeZoningExtraction,
  parcel: ParcelAttributes,
  proposedUse: 'multifamily' | 'mixed_use' | 'commercial',
  interpretationMode: 'conservative' | 'moderate' | 'aggressive'
): {
  resolved: ZoningProfile;
  decisions: ResolutionDecision[];
  warnings: string[];
} {
  const decisions: ResolutionDecision[] = [];
  const warnings: string[] = [];
  
  // ── RESOLVE FAR ──
  // Decision: which FAR to apply based on proposed use
  let applied_far: number;
  if (proposedUse === 'multifamily') {
    applied_far = claudeExtraction.far.residential;
  } else if (proposedUse === 'mixed_use') {
    applied_far = Math.min(
      claudeExtraction.far.combined,
      claudeExtraction.far.residential + claudeExtraction.far.commercial
    );
  } else {
    applied_far = claudeExtraction.far.commercial;
  }
  decisions.push({
    parameter: 'FAR',
    value_used: applied_far,
    interpretation: 'moderate',
    rationale: `Using ${proposedUse === 'multifamily' ? 'residential' : 'combined'} FAR for ${proposedUse} project`,
    source: claudeExtraction.far.source,
    confidence: claudeExtraction.far.confidence,
  });
  
  // Decision: FAR measurement basis
  // If the code says "gross lot area" but this is a corner lot with
  // significant setback loss, flag it
  if (claudeExtraction.far.measurement_basis === 'gross_lot_area') {
    // FAR is computed on full lot, not reduced lot
    // This is the MORE favorable interpretation for the developer
  } else if (claudeExtraction.far.measurement_basis === 'net_buildable') {
    // FAR is computed after setback deduction — LESS favorable
    warnings.push('FAR is measured against NET lot area (after setbacks). This reduces effective FAR.');
  }
  
  // Decision: common area factor
  const commonAreaFactor = claudeExtraction.far.common_area_note?.includes('not explicitly')
    ? 0.15  // Default when code is silent
    : parseCommonAreaFromCode(claudeExtraction.far);
  decisions.push({
    parameter: 'Common Area Factor',
    value_used: commonAreaFactor,
    interpretation: 'moderate',
    rationale: claudeExtraction.far.common_area_note || 'Code-specified common area factor',
    source: claudeExtraction.far.source,
    confidence: claudeExtraction.far.common_area_note?.includes('not explicitly') ? 'medium' : 'high',
  });
  
  // ── RESOLVE DENSITY ──
  // Decision: gross vs net acres
  const lot_acres = claudeExtraction.density.measurement_basis === 'gross_lot_area'
    ? parcel.lot_size_acres
    : parcel.buildable_acres; // After setback deduction
  
  const density_cap = Math.floor(claudeExtraction.density.max_units_per_acre * lot_acres);
  
  // ── RESOLVE HEIGHT ──
  // Decision: floor heights
  const ground_floor_height = proposedUse === 'mixed_use' ? 16 : 14; // Retail needs more
  const upper_floor_height = interpretationMode === 'conservative' ? 10 : 9.5;
  const roof_exclusion = claudeExtraction.height.roof_exclusion_ft || 0;
  
  const effective_height = claudeExtraction.height.max_ft - roof_exclusion; // Don't count roof equipment toward residential
  const total_stories = 1 + Math.floor((effective_height - ground_floor_height) / upper_floor_height);
  const residential_floors = proposedUse === 'mixed_use' ? total_stories - 1 : total_stories;
  
  // ── RESOLVE PARKING ──
  let parking_per_unit = claudeExtraction.parking.min_per_unit;
  let guest_parking = claudeExtraction.parking.guest_per_unit;
  
  // Check transit reduction eligibility
  if (claudeExtraction.parking.transit_reduction?.eligible && parcel.transit_distance_ft) {
    if (parcel.transit_distance_ft <= claudeExtraction.parking.transit_reduction.distance_ft) {
      const reduction = claudeExtraction.parking.transit_reduction.reduction_pct / 100;
      parking_per_unit *= (1 - reduction);
      decisions.push({
        parameter: 'Parking (Transit Reduction)',
        value_used: parking_per_unit,
        interpretation: 'moderate',
        rationale: `Transit reduction of ${claudeExtraction.parking.transit_reduction.reduction_pct}% applied — property is ${parcel.transit_distance_ft}ft from ${claudeExtraction.parking.transit_reduction.transit_type}`,
        source: claudeExtraction.parking.transit_reduction.source,
        confidence: 'high',
      });
    }
  }
  
  // Check shared parking for mixed-use
  if (proposedUse === 'mixed_use' && claudeExtraction.parking.shared_parking?.eligible) {
    // This is more complex — the reduction depends on the mix ratio
    // For now, apply if the mixed-use threshold is met
  }
  
  // ── RESOLVE SETBACKS ──
  let setbacks = { ...claudeExtraction.setbacks };
  if (parcel.is_corner) {
    // Corner lots: apply front setback to both street-facing sides
    // The "side" setback only applies to the non-street interior side
    setbacks.side_ft = claudeExtraction.setbacks.front_ft; // Second street face gets front setback
    decisions.push({
      parameter: 'Corner Lot Setbacks',
      value_used: setbacks.side_ft,
      interpretation: 'moderate',
      rationale: `Corner lot: second street face uses front setback (${setbacks.side_ft}ft) not side setback (${claudeExtraction.setbacks.side_ft}ft)`,
      source: claudeExtraction.setbacks.source,
      confidence: claudeExtraction.setbacks.confidence,
    });
  }
  
  // ... build the complete resolved ZoningProfile
  
  return {
    resolved: { /* the ZoningProfile with all resolved values */ },
    decisions,
    warnings,
  };
}
```

---

## What the User Sees

The UI shows the math engine's output (max units, binding constraint, waterfall)
BUT also surfaces the interpretation layer so the user can audit and override.

### Interpretation Panel (new addition to Dev Capacity tab)

```
┌─────────────────────────────────────────────────────────────┐
│ INTERPRETATION DECISIONS (12 resolved)                      │
│                                                             │
│ ⚙ FAR Applied: 3.2 (residential)                          │
│   Rationale: Using residential FAR for multifamily project  │
│   Source: Sec. 16-18A.007(2) → Municode ↗                 │
│   Confidence: ●●●○ Medium                                  │
│   ⚠ Ambiguity: Code silent on enclosed balconies            │
│   [Override: ___]                                           │
│                                                             │
│ ⚙ Common Area Factor: 15%                                  │
│   Rationale: Code does not specify — industry standard      │
│   [Override: ___]                                           │
│                                                             │
│ ⚙ Parking: 0.80 spaces/unit (reduced from 1.0)            │
│   Rationale: Transit reduction 20% — 1,100ft from MARTA    │
│   Source: Sec. 16-18A.008(2)(c) → Municode ↗              │
│   Confidence: ●●●● High                                    │
│                                                             │
│ ⚙ Corner Lot: Side setback = 0ft (using front setback)    │
│   Rationale: Second street face treated as front            │
│   Source: Sec. 16-18A.007(5) → Municode ↗                 │
│   Confidence: ●●●● High                                    │
│                                                             │
│ ⚠ WARNING: Stormwater impervious surface limit not checked  │
│   This parcel may be constrained by county stormwater regs  │
│   before zoning coverage is reached.                        │
│                                                             │
│ MODE: [Conservative] [Moderate ●] [Aggressive]              │
│       Conservative uses worst-case interpretation            │
│       Aggressive uses developer-favorable readings           │
└─────────────────────────────────────────────────────────────┘
```

### The Override Mechanism

Users can override ANY resolved parameter. When they do:
1. The math engine instantly recomputes with the new value
2. The override is stored as Layer 3 (user) in the LayeredValue<T> system
3. The original platform interpretation remains visible
4. The audit trail shows: "Platform says 3.2 FAR (moderate). User overrode to 3.5 (aggressive, citing pre-application meeting with planning director 03/12/2026)"

This is the same three-layer collision pattern from the Deal Capsule:
- Layer 1: Broker claim (the OM might say "FAR 3.5")
- Layer 2: Platform interpretation (Claude extracts 3.2 from Municode)
- Layer 3: User override (based on pre-app meeting or attorney opinion)

---

## Municipality-Specific Rule Sets

Some interpretations can't be computed — they need to be KNOWN per municipality.
The platform maintains a rule configuration per municipality:

```typescript
interface MunicipalityRuleSet {
  municipality_id: string;        // 'atlanta-ga', 'tampa-fl', 'miami-fl'
  
  far_rules: {
    measurement_basis: 'gross_lot' | 'net_buildable';
    uses_floor_lot_ratio: boolean;  // Miami's special term
    exclusions: FARExclusionSet;
    common_area_factor: number;     // 0.15 default
  };
  
  density_rules: {
    measurement_basis: 'gross_lot' | 'net_buildable';
    studio_equivalency: number;     // 1.0 default, 0.5 in some jurisdictions
    affordable_exemption: boolean;
    min_lot_per_unit_sf: number | null;  // Alternative density expression
  };
  
  height_rules: {
    measurement_from: 'grade' | 'bfe' | 'mean_finished_grade';
    ground_floor_height_ft: number;  // Varies by use
    upper_floor_height_ft: number;
    roof_exclusion_ft: number;
    has_step_back: boolean;
    step_back_config?: {
      trigger_floor: number;
      step_back_ft: number;
    };
  };
  
  parking_rules: {
    default_per_unit: number;
    guest_per_unit: number;
    by_bedroom: boolean;
    bedroom_schedule?: Record<number, number>;  // { 0: 0.5, 1: 1.0, 2: 1.5, 3: 2.0 }
    transit_reduction_eligible: boolean;
    transit_distance_threshold_ft: number;
    transit_reduction_pct: number;
    shared_parking_eligible: boolean;
    compact_pct_allowed: number;
    surface_cost_per_space: number;    // $5K typical
    structured_cost_per_space: number; // $35K typical
  };
  
  // When does parking become the binding constraint?
  parking_threshold_rules: {
    surface_sf_per_space: number;      // 350 SF typical
    structured_trigger: 'remaining_lot_area' | 'unit_threshold' | 'always_structured';
    structured_unit_threshold?: number;  // "Above 100 units, always use structured"
  };
  
  stormwater_rules: {
    has_impervious_limit: boolean;
    max_impervious_pct: number | null;
    is_municipal_or_county: 'municipal' | 'county';  // Stormwater is often county-level
  };
  
  last_updated: string;
  verified_by: string;  // "Zoning Agent A03 via Municode Sec. 16-18A"
  confidence: 'high' | 'medium' | 'low';
}
```

The platform pre-builds rule sets for target markets (Tampa, Orlando, Miami, Jacksonville, Atlanta, Dallas).
For new municipalities, Claude extracts rules from Municode on first deal.

---

## The Computation Flow

```
User enters address
    ↓
Platform resolves parcel (county GIS → PostGIS)
    ↓
Platform resolves zoning district (ArcGIS zoning layer → district code)
    ↓
Check: do we have a MunicipalityRuleSet for this jurisdiction?
    ├── YES → use cached rules, skip Claude extraction
    │         (but still fetch Municode link for source attribution)
    └── NO  → trigger Zoning Agent (Claude extraction)
              └── Claude reads Municode text
              └── Returns structured extraction
              └── Resolution engine + parcel attributes → ZoningProfile
              └── Cache as new MunicipalityRuleSet for future deals
    ↓
ZoningProfile assembled (with all interpretation decisions documented)
    ↓
calculateEnvelope(parcel, resolvedProfile)
    ↓
Four constraints computed → binding constraint identified
    ↓
generatePathScenarios(parcel, resolvedProfile)
    ↓
Four development paths → each with its own envelope recalculation
    ↓
Display: constraint waterfall + path cards + interpretation panel
    ↓
User can override any parameter → instant recompute → override stored as Layer 3
```

---

## Why This Matters for the Strategy Engine

The entitlement engine's output feeds directly into:
1. **M03B Unit Mix Designer**: max units determines how many units the user can plan
2. **M09 ProForma**: FAR × lot area → total rentable SF → revenue line
3. **M08 Strategy Arbitrage**: BTS feasibility depends entirely on the envelope
4. **M12 Exit & Capital**: development timeline comes from entitlement path

If the interpretation is wrong by 20% (common with naive implementations),
the entire downstream model is wrong by 20%. The interpretation layer is not
a nice-to-have — it's the foundation accuracy guarantee.
