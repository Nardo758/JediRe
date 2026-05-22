# Phase 2/4/5 Pipeline — Property Metadata Enrichment

## Pipeline

For each property:

```
            ┌─ Does OM PDF exist? ──→ Yes ──→ Extract 20+ fields via AI
            │                                    (parse-om endpoint)
            │                                    ↓
            │                          ┌─ Fields complete? ──→ Done ✓
            │                          │
            │                          └─ No ──→ Get address from OM
            │                                      ↓
            └─ No OM or address found ──────────────→ Search file names
                                                        for address or name
                                                        ↓
                                             ┌─ Got address? ──→ No ──→ Search by property name
                                             │                             ↓
                                             └─ Yes ─────────→ apartments.com search
                                                                 ↓
                                                      Extract: year_built, units, stories,
                                                               class, parking, management,
                                                               amenities, photos
                                                                 ↓
                                                      Write to property_descriptions
```

## Step-by-Step

### Step 1: OM PDF → AI Extraction
For properties with an OM PDF (42 identified already):
- Send PDF to `POST /api/v1/archive/parse-om` (already wired, just needs prompt expansion)
- AI returns: year_built, building_type, stories, units, class, address, city, state, zip, county, msa, sqft, lot_size, parking, amenities, construction_type, management_company
- Write non-null values to `property_descriptions` with source `om_extraction`

### Step 2: Get Address
If the OM doesn't contain a clear address (unlikely but possible), extract from:
1. File names containing street addresses (e.g., "860 South Cobb Dr.xlsx")
2. Lease clause headers in rent roll XLSX files
3. Property name → geocode via web search

The property name (folder name) is already a known entity identifier.

### Step 3: apartments.com Search
For any field still null after OM extraction:
- Use the address (or property name + city) to search apartments.com
- Scrape the property detail page
- Extract: year_built, units, stories, rent, deposit, pet policy, management, parking, amenities
- Write as source `apartments_com` with confidence 0.7

### Step 4: Write to DB
Upsert each non-null, non-nullified field into `property_descriptions`:
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

COALESCE means OM data wins if exists, apartments.com fills the gap.
