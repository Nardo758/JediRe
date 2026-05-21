# Phase 2/4/5 Dispatch — OM Field Extraction + Municipal Enrichment + Research Agent

**Depends on:** Phases 0-3, 7 complete (all data in R2, property_descriptions schema live)
**Goal:** Populate all `property_descriptions` LayeredValue fields from OM PDFs, then municipal data, then research narratives.

---

## Strategy

Three layers, each feeding into `property_descriptions` with proper source provenance:

1. **OM AI extraction** (Phase 2) — Parse OM PDF text → extract ~20 fields → LayeredValues with source `om_extraction`
2. **Municipal API** (Phase 4) — County assessor data for fields OM might miss → `municipal_enrichment`
3. **Research Agent** (Phase 5) — Web research to fill gaps and add narratives → `research_agent`

The `LayeredValue<T>` type tracks source:
```typescript
interface LayeredValue<T> {
  value: T | null;
  source: string;       // "om_extraction" | "municipal_enrichment" | "research_agent" | "costar" | etc.
  confidence: number;   // 0-1
  updatedAt: string;    // ISO timestamp
  history?: Array<{ value: T; source: string; updatedAt: string }>;
}
```

---

## Part A — OM Field Extraction (Phase 2)

### What to Extract

The parse-om endpoint already calls DeepSeek with the OM PDF text. Currently it extracts only `yearBuilt`. Expand the prompt to extract all of:

**Building Info:**
- `year_built` ✅ (already done)
- `building_type` → "Garden" | "Mid-Rise" | "High-Rise" | "Townhouse"
- `stories` → number
- `total_units` → number (already in historical_observations too)
- `building_class` → "Class A" | "Class B" | "Class C"
- `square_footage` → number (building sqft from OM, not individual units)

**Location:**
- `address` → street address
- `city`
- `state`
- `zip_code`
- `county`
- `msa_name` (already enriched from folder scanning, but OM may have more precise)
- `cbsa_code`
- `latitude`, `longitude`

**Property Details:**
- `lot_size_acres` → number
- `parking_spaces` → number
- `amenities` → string (comma-separated or list)
- `year_renovated` → number (if mentioned)
- `construction_type` → "Wood Frame" | "Concrete" | "Steel" | etc.
- `average_unit_sqft` → number

**Financial (from OM):**
- `average_rent` → number
- `occupancy_rate` → number (0-1)
- `rent_concessions` → string

### Prompt Update

Current parse-om prompt asks only for year built. Expand to:

```json
{
  "yearBuilt": 2005,
  "buildingType": "Garden",
  "stories": 3,
  "totalUnits": 250,
  "buildingClass": "Class B",
  "address": "123 Main St",
  "city": "Atlanta",
  "state": "GA",
  "zipCode": "30301",
  "county": "Fulton",
  "msaName": "Atlanta-Sandy Springs-Roswell, GA",
  "squareFootage": 250000,
  "lotSizeAcres": 12.5,
  "parkingSpaces": 350,
  "amenities": "Pool, Fitness Center, Clubhouse, Dog Park",
  "yearRenovated": 2020,
  "constructionType": "Wood Frame",
  "averageUnitSqft": 950,
  "averageRent": 1450,
  "occupancyRate": 0.93,
  "rentConcessions": "1 month free on 12-month lease"
}
```

### Writing to property_descriptions

After extracting, write each field to its corresponding LayeredValue column in `property_descriptions`:

```sql
INSERT INTO property_descriptions (parcel_id, year_built, building_type, ...)
VALUES ($1, 
  '{"value": 2005, "source": "om_extraction", "confidence": 0.85, "updatedAt": "..."}'::jsonb,
  '{"value": "Garden", "source": "om_extraction", "confidence": 0.80, ...}',
  ...
)
ON CONFLICT (parcel_id) DO UPDATE SET
  year_built = EXCLUDED.year_built,
  building_type = EXCLUDED.building_type,
  ...
WHERE EXCLUDED.year_built IS NOT NULL;
```

### Re-run Strategy
For each OM with a known row, call the parse-om endpoint again with the expanded prompt. The destination table has changed from `historical_observations` (for extraction metadata) to also writing to `property_descriptions`. The `observation_date` SELECT fix means re-runs are safe.

---

## Part B — Municipal API Enrichment (Phase 4)

After OM fields are populated, fill gaps with county assessor data.

### Data Sources

Each county has a public property appraiser API or site. For the coverage the portfolio has (GA, FL, TX, NC, SC, TN):

| State | Appraiser Site | Method |
|---|---|---|
| GA (Fulton, DeKalb, Cobb, Gwinnett) | `qpublic.schneidercorp.com` | Scrape or CAMA API |
| FL (Miami-Dade, Broward, Palm Beach, Orange, Hillsborough) | Various county sites | Property search by address |
| TX (Dallas, Tarrant, Harris, Travis) | CAD sites (dcad.org, hcad.org, etc.) | Property search |
| NC (Mecklenburg, Wake) | County assessor | Property search |
| SC (Greenville, Charleston) | County assessor | Property search |
| TN (Davidson, Shelby) | County assessor | Property search |

### Implementation Approach

Since each county has its own API, the simplest approach is:

1. **Batch query service** — `POST /api/v1/enrichment/municipal` takes a list of parcel_ids with addresses
2. **Per-county adapters** — each adapter knows the URL pattern for its county
3. **Extract**: year_built, sqft, lot_size, bedrooms, bathrooms, tax_assessed_value, land_value, improvement_value, zoning, owner_name
4. **Write**: as LayeredValues with source `municipal_enrichment`

### Fallback

For properties where the OM already populated the fields, municipal data provides a second source for confidence boosting. Fields with two agreeing sources get confidence upgraded.

---

## Part C — Research Agent Enrichment (Phase 5)

### What it Does

For each property, the Research Agent:
1. Searches the web for: `"{property_name}" "{city}" "{state}" apartment`
2. Gathers: recent news, market reports, property reviews, vacancy trends
3. Writes a computed property description narrative

### Implementation

The Research Agent already exists as `src/agents/workflows/research-agent.ts` (from earlier work). It produces a `ComputedPropertyDescription` document.

Route the output to:

```sql
UPDATE property_descriptions
SET narrative_description = '{"value": "...", "source": "research_agent", "confidence": 0.6}'::jsonb,
    asset_description = '{"value": "...", "source": "research_agent", "confidence": 0.6}'::jsonb,
    market_notes = '{"value": "...", "source": "research_agent", "confidence": 0.5}'::jsonb,
    web_photos = '{"value": [...], "source": "research_agent", "confidence": 0.3}'::jsonb
WHERE parcel_id = $1;
```

### Web Photos
The Research Agent can find and store URLs of exterior/amenity photos from property websites. These go into `web_photos` as a JSON array of URLs.

---

## Acceptance Criteria

### Phase 2 — OM Extraction
1. Re-run all 42 OM PDFs → each produces ~20 new fields
2. `property_descriptions` table populated for all 42 properties
3. Source = `om_extraction` for all fields
4. Confidence scores assigned per field (higher for explicit numbers, lower for inferred)
5. Fields written to correct LayeredValue columns

### Phase 4 — Municipal
1. County assessor data fetched for at least 100 properties
2. Fields from municipal source merged into property_descriptions
3. No overwrites where OM already populated + municipal agrees
4. Confidence upgraded for corroborated fields

### Phase 5 — Research Agent
1. Narrative written for 50+ properties
2. Web photos stored as URLs (can be displayed in the per-property page)
3. Market context added — rental comps, vacancy trends, new supply

---

## Sequencing

```
Phase 2 (OM extraction) → Phase 4 (municipal enrich) → Phase 5 (research agent)
                              ↓
                    property_descriptions fully populated
                              ↓
                    AssetDetailModal renders complete data
```

Phase 2 must run first since it defines the baseline. Phases 4 and 5 can run in parallel.
