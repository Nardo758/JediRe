# Phase 2/4/5 Dispatch — OM Field Extraction + Multi-Source Enrichment

**Depends on:** Phases 0-3, 7 complete (all data in R2, property_descriptions schema live)
**Goal:** Populate all `property_descriptions` LayeredValue fields from OM PDFs, then fill any remaining gaps from municipal records, property websites, and listing platforms.

---

## Strategy

Two layers:

1. **Phase 2 — OM AI extraction** — Parse OM PDF text → extract ~20 fields → write to `property_descriptions` as source `om_extraction`
2. **Phase 4+5 — Multi-source gap filling** — For any fields still null after OM, search municipal records, apartmentlist.com, apartments.com, and property websites to fill them in. Write as source `web_enrichment`.

The `LayeredValue<T>` type tracks provenance:
```typescript
interface LayeredValue<T> {
  value: T | null;
  source: string;       // "om_extraction" | "web_enrichment" | "costar" | etc.
  confidence: number;
  updatedAt: string;
  history?: Array<{ value: T; source: string; updatedAt: string }>;
}
```

---

## Part A — OM Field Extraction (Phase 2)

### Expanded Prompt

Current parse-om prompt asks only for `yearBuilt`. Expand to extract ALL of:

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

All fields optional — the model returns `null` for anything it can't find in the PDF.

### Writing to property_descriptions

After extraction, upsert each non-null field:

```sql
INSERT INTO property_descriptions (parcel_id, year_built, building_type, ...)
VALUES ($1, 
  '{"value": 2005, "source": "om_extraction", "confidence": 0.85, "updatedAt": "..."}'::jsonb,
  ...
)
ON CONFLICT (parcel_id) DO UPDATE SET
  year_built = COALESCE(property_descriptions.year_built, EXCLUDED.year_built),
  ...
```

`COALESCE` means OM data fills in, but doesn't overwrite a better source.

---

## Part B — Multi-Source Gap Fill (Phase 4+5)

### The Agent

For each property that still has null fields after OM extraction, the enrichment agent:

1. **Builds a search query**: `"{property_name}" "{city}" "{state}" apartment`
2. **Searches across sources** in priority order:
   - **County assessor / CAD**: `qpublic` (GA), `hcad.org` (TX-Harris), `dcad.org` (TX-Dallas), etc.
   - **Apartments.com**: Scrape property detail page
   - **Apartment List**: Scrape property detail page
   - **Property website**: Direct search for the property's own site
3. **Extracts all matching fields**: year_built, units, stories, class, sqft, parking, amenities, etc.
4. **Writes non-null values** to `property_descriptions` with source `web_enrichment`

### Implementation

```typescript
interface EnrichmentResult {
  parcelId: string;
  address: string;
  source: string;
  fields: Partial<Record<string, any>>;
  confidence: number;  // per-source confidence
}

async function enrichProperty(parcelId: string, address: string): Promise<EnrichmentResult> {
  const results: EnrichmentResult[] = [];
  
  // Try county assessor first (most reliable for year_built, sqft, lot_size)
  const countyData = await searchCountyAssessor(address);
  if (countyData) results.push(countyData);
  
  // Try listing platforms
  const aptListData = await searchApartmentList(parcelId, address);
  if (aptListData) results.push(aptListData);
  
  const aptsComData = await searchApartmentsCom(parcelId, address);
  if (aptsComData) results.push(aptsComData);
  
  // Merge: prefer higher-confidence sources for each field
  return mergeResults(results);
}
```

### Multi-Source Confidence Rules

| Source | Confidence | Best For |
|---|---|---|
| County assessor | 0.95 | year_built, sqft, lot_size, zoning, tax_value |
| OM PDF | 0.85 | building_type, class, units, amenities |
| Apartments.com | 0.7 | rent, amenities, photos, year_built |
| Apartment List | 0.65 | rent, amenities, floor plans |
| Property website | 0.6 | photos, amenities, description |
| Web search | 0.4 | addresses, phone, management company |

### Batch Enrichment Endpoint

```
POST /api/v1/enrichment/run

Body:
{
  "parcelIds": ["Mirabella Lakes", "Alta Dairies", ...],  // optional, default = all
  "sources": ["county", "apartment_list", "apartments_com", "web"],  // all enabled by default
  "dryRun": false,  // log what would be fetched, don't write
  "concurrency": 4   // parallel requests to avoid rate limiting
}
```

### Rate Limiting

- County assessor sites: 1 req/sec per county
- Listing platforms: 2 req/sec
- Batch should run overnight or with progress tracking
- Progress endpoint: `GET /api/v1/enrichment/status` returns `{ completed: N, remaining: N, failed: N }`

---

## Acceptance Criteria

### Phase 2 — OM Extraction
1. Re-run all 42 OM PDFs → each produces all extractable fields
2. `property_descriptions` populated for all 42 properties with source `om_extraction`
3. Null fields left as null (the OM might not have building_class, for example)
4. Existing year_built data preserved (COALESCE)

### Phase 4+5 — Multi-Source Enrichment
1. Enrichment agent runs for all 296 properties (takes ~15 min at 4 concurrency)
2. County assessor data fills year_built and sqft for GA properties
3. Listing platforms fill amenities, rent, photos for active properties
4. Null fields in `property_descriptions` reduced by at least 50%
5. Source provenance preserved per field
6. No rate limit bans, 429s handled gracefully with retry + backoff

### AssetDetailModal Integration
- With 20+ fields populated, the per-property page can render the full detail modal
- Photos from property websites display in a gallery
- Multiple data sources shown as badges on each field

---

## Endpoint Summary

| Endpoint | Phase | Description |
|---|---|---|
| POST /api/v1/archive/parse-om?parcel_id=X | 2 | Extended prompt — returns all extracted fields |
| POST /api/v1/enrichment/run | 4+5 | Multi-source batch enrichment |
| GET /api/v1/enrichment/status | 4+5 | Progress tracking |
| GET /api/v1/properties/:parcelId/summary | 3 | Returns all property_descriptions LayeredValues |

All three endpoints use `x-ingest-secret` auth.
