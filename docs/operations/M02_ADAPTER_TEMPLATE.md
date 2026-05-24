# M02 Zoning Module — Adapter Template & Checklist

Use this document when adding a new metro to M02.  The Atlanta adapter is the
reference implementation.  Every new metro follows the same pattern.

---

## RegulatoryConstraints Interface Reference

```typescript
// backend/src/services/regulatory/types.ts

type UseClassification =
  | 'single_family_residential' | 'multifamily_residential' | 'mixed_use'
  | 'retail_commercial' | 'office' | 'industrial' | 'warehouse_distribution'
  | 'hospitality' | 'short_term_rental' | 'agricultural'
  | 'institutional' | 'open_space_recreation' | 'conditional_use';

interface OverlayDistrict {
  name: string;
  type: 'historic' | 'transit_oriented' | 'opportunity_zone'
      | 'floodplain' | 'urban_renewal' | 'airport_noise' | 'other';
  code: string | null;
  affects_str?: boolean;
  notes?: string;
}

interface RegulatoryConstraints {
  // Use & density
  permitted_uses:             LayeredValue<UseClassification[]>;
  density_max_units_per_acre: LayeredValue<number | null>;
  far_max:                    LayeredValue<number | null>;
  // Form
  height_max_feet:            LayeredValue<number | null>;
  stories_max:                LayeredValue<number | null>;
  setback_front_feet:         LayeredValue<number | null>;
  setback_side_feet:          LayeredValue<number | null>;
  setback_rear_feet:          LayeredValue<number | null>;
  lot_coverage_max_pct:       LayeredValue<number | null>;
  // Parking
  parking_min_per_unit:       LayeredValue<number | null>;
  parking_min_method:         LayeredValue<'per_unit' | 'per_sqft' | 'matrix' | null>;
  // Entitlement
  entitlement_risk:           LayeredValue<'low' | 'medium' | 'high' | null>;
  allows_short_term_rental:   LayeredValue<boolean | null>;
  // Development cost
  impact_fees_est:            LayeredValue<number | null>;
  // Overlays
  overlay_districts:          LayeredValue<OverlayDistrict[]>;
  // Jurisdictional
  zone_code:                  LayeredValue<string | null>;
  jurisdiction:               LayeredValue<string>;
  regulatory_model:           LayeredValue<'zoning' | 'deed_restriction' | 'mixed'>;
  // Provenance (bare — not LayeredValue)
  resolved_at:  string;    // ISO timestamp
  source_chain: string[];  // adapters / endpoints queried, in order
}
```

All constraint fields are `LayeredValue<T>`.  Unknown / unavailable values are
`null` (never omit the key).  Start every adapter from
`emptyRegulatoryConstraints()` and fill only what you can resolve.

**Downstream consumers at a glance:**

| Consumer | Fields it reads |
|---|---|
| M03 Dev Capacity | `far_max`, `height_max_feet`, `stories_max`, `setback_*`, `density_max_units_per_acre`, `parking_min_per_unit`, `lot_coverage_max_pct` |
| M08 Strategy Arb | `permitted_uses`, `allows_short_term_rental`, `overlay_districts`, `entitlement_risk` |
| M09 ProForma | `parking_min_per_unit`, `far_max`, `impact_fees_est` |
| M14 Risk | `entitlement_risk`, `zone_code` (audit) |
| M25 JEDI Score | `regulatory_model` (Position component) |

---

## Adapter Implementation Checklist

### 1. Identify zoning data source

Confirm the metro's public zoning GIS endpoint.  Target: ArcGIS FeatureServer
with point-in-polygon query capability.

```
GET <service_url>/query
  ?geometry=<lng>,<lat>
  &geometryType=esriGeometryPoint
  &spatialRel=esriSpatialRelIntersects
  &outFields=ZONING_CODE,<other_fields>
  &returnGeometry=false
  &f=json
```

Probe checklist:
- [ ] Endpoint responds from Replit cloud IP (no Cloudflare WAF block)
- [ ] Returns `ZONING_CODE` (or equivalent field name) for a test coordinate
- [ ] Confirm jurisdiction boundary: unincorporated county vs city
- [ ] Document in `docs/operations/ALTERNATIVE_ENDPOINT_PROBES.md`

### 2. Build the zoning_codes lookup table

File: `backend/src/services/regulatory/zoning-codes/<jurisdiction>.json`

Structure:
```json
{
  "_meta": { "jurisdiction": "...", "source": "...", "last_updated": "..." },
  "districts": {
    "ZONE_CODE": {
      "description": "...",
      "permitted_uses": ["multifamily_residential"],
      "density_max_units_per_acre": 20,
      "far_max": 1.2,
      "height_max_feet": 45,
      "stories_max": 4,
      "setback_front_feet": 15,
      "setback_side_feet": 7,
      "setback_rear_feet": 15,
      "lot_coverage_max_pct": 50,
      "parking_min_per_unit": 1.5,
      "parking_min_method": "per_unit",
      "allows_short_term_rental": true,
      "entitlement_risk": "low",
      "impact_fees_est": null
    }
  }
}
```

Populate from the jurisdiction's official zoning code (ordinance text).
Start with the 10–20 most common districts; expand as verification requires.

### 3. Implement jurisdiction resolution

Pattern: Census Geocoder → county FIPS → (optionally) city-limits polygon.

```typescript
// County FIPS from Census Geocoder is passed via input.county_fips.
// If the metro has multiple jurisdictions (e.g., Miami-Dade has 34
// municipalities each with their own zoning authority), check which
// city the coordinate falls within before selecting a lookup table.
```

Atlanta example:
1. FIPS 13121 (Fulton) or 13089 (DeKalb) → query Atlanta GIS
2. GIS returns feature → `jurisdiction = "City of Atlanta"`, use CoA table
3. GIS returns no feature → `jurisdiction = "Unincorporated <County>"`, null constraints (stub)

Miami-Dade example (when built):
1. FIPS 12086 → query Miami-Dade PA service for ZoningCode
2. Cross-reference ZoningCode against Zones Dade Table JSON
3. If City of Miami address → separate jurisdiction, separate lookup table

### 4. Create the adapter file

Location: `backend/src/services/regulatory/m02-zoning/adapters/<metro>.ts`

Must implement `RegulatoryAdapter`:
```typescript
export const myMetroAdapter: RegulatoryAdapter = {
  id: 'm02_<metro>',
  name: '<Metro> (<counties>)',
  async lookupRegulatory(input): Promise<RegulatoryConstraints> {
    // 1. Route by county FIPS
    // 2. Query GIS for zone_code
    // 3. Cross-reference lookup table
    // 4. Return complete RegulatoryConstraints
    // NEVER throw — catch all errors, degrade gracefully
  },
};
```

Source tag convention: `'municipal:m02_<jurisdiction>'`
e.g. `'municipal:m02_atlanta_city'`, `'municipal:m02_miamidade_unincorp'`

### 5. Register in the registry

File: `backend/src/services/regulatory/m02-zoning/index.ts`

```typescript
// FIPS_REGISTRY: add all county FIPS codes that route to this adapter
'12086': miamiDadeAdapter,  // Miami-Dade
```

### 6. Wire into orchestrator (already done at Step 2 of M02)

The intake worker already calls `lookupRegulatory()` after `stepMunicipalLookup`.
No orchestrator changes needed for new adapters — just register the FIPS.

### 7. Paired-read verification on 5 sample properties

For each property:

```
a. Run: INSERT INTO intake_jobs (parcel_id, source_data, state) VALUES (...) then wait for worker
b. Check enrichment_log: SELECT enrichment_log FROM intake_jobs WHERE parcel_id = '<id>';
c. Check property_descriptions: SELECT regulatory_constraints FROM property_descriptions WHERE parcel_id = '<id>';
d. Hit: GET /api/v1/properties/by-parcel/<parcelId>/summary
e. Verify: regulatory_constraints visible with correct zone_code, jurisdiction, provenance
```

Acceptance criteria:
- [ ] `zone_code.value` matches the county's GIS response
- [ ] `jurisdiction.value` is correct (city vs unincorporated vs county)
- [ ] At least one non-null constraint field (far_max or height_max_feet)
- [ ] `source_chain` lists every step: census_geocoder → gis_url → lookup_table
- [ ] `source` on each LayeredValue = `"municipal:m02_<jurisdiction>"`
- [ ] API response includes `regulatory_constraints` at top level

---

## Worked Example: Atlanta (reference implementation, shipped 2026-06-08)

**Data source:** `gis.atlantaga.gov` ArcGIS zoning layer (point-in-polygon)

**Jurisdiction resolution:**
- FIPS 13121 (Fulton) or 13089 (DeKalb) → Atlanta GIS query
- GIS feature found → City of Atlanta (uses `city-of-atlanta.json`)
- GIS returns no feature → Unincorporated county (null constraints, stub)
- FIPS 13067/13135/13057/13063/13151 → Metro stub (correct jurisdiction name, null constraints)

**Lookup table:** `zoning-codes/city-of-atlanta.json`
- 22 districts covering R-1 through I-2, MR-1 through MR-5, MRC-1 through MRC-3
- STR permissions per Ordinance 20-O-1656 (owner-occupied broadly permitted;
  non-owner-occupied restricted in R-1 through R-5, MR-1)

**Source chain example:**
```json
["census_geocoder", "atlanta_gis_zoning",
 "https://gis.atlantaga.gov/server/rest/services/ADHI/ADHI_zoning/MapServer/0/query",
 "zoning-codes/city-of-atlanta.json"]
```

**Source tag:** `"municipal:m02_atlanta_city"`

---

## Houston-Specific Path (placeholder — fill when Houston becomes sales priority)

Houston has no traditional zoning ordinance (City Council decision; state law
does not require Texas cities to zone).  Harris County also has no county-wide
zoning.

**regulatory_model:** `'deed_restriction'`

**Implementation differences:**
- No zone_code lookup.  `zone_code.value = null`.
- `permitted_uses` derived from deed restriction type (residential, commercial,
  industrial) if deed restriction data is available.
- Most constraint fields (FAR, height, setbacks) will be null — deed
  restrictions don't prescribe form standards.
- `entitlement_risk = 'medium'` for most parcels (no zoning = rezoning not
  needed, but deed restrictions can be as restrictive as zoning + require court
  to remove).
- Data source: Houston HCAD parcel data + deed restriction layer (City of
  Houston Planning open data portal, if available).
- The `RegulatoryConstraints` interface stays identical.  Only the source-side
  logic differs.

---

## Common Edge Cases

**Multi-jurisdiction parcels** (rare — typically at city limits)
- Census Geocoder may place the address inside one city; GIS may return the
  other.  Trust the GIS geometry query over Census text matching.
- Log both outcomes in `source_chain`.

**Recently-rezoned parcels**
- County GIS layers typically lag the official ordinance by days to weeks.
- If zone_code is known stale, add a note in `source_chain`:
  `"gis_lag_possible"`.

**Overlay districts that supersede base zoning**
- Beltline overlay in Atlanta allows higher FAR than base zone.
- For now: return base zone constraints + populate `overlay_districts` array.
  The overlay modifier is not applied automatically — M03 must handle it.

**No data found**
- Return `emptyRegulatoryConstraints()` with:
  - `zone_code.value = null`
  - `jurisdiction.value = best-known-jurisdiction-string`
  - `source_chain = [...steps_attempted, "not_found"]`
- Never return undefined.  Never throw.

**Adapter GIS endpoint unreachable from cloud IP**
- Cloudflare WAF blocks qPublic/Schneidercorp from Replit (documented gotcha).
- If the GIS is behind WAF, the adapter must fall back to a REST API or open
  data download rather than direct HTML scrape.
- Document WAF status in `ALTERNATIVE_ENDPOINT_PROBES.md`.
