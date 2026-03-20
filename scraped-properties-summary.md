# Property Scraper Results

**Date:** 2026-02-27  
**Scraper URL:** https://property-api.m-dixon5030.workers.dev

## Summary

- **Fulton County:** 100 multifamily properties (10+ units)
- **DeKalb County:** 100 multifamily properties (10+ units)
- **Total:** 200 properties

## Sample Properties

### Fulton County Examples:
1. 855 N MAIN ST - 521 units, $2.7M assessed value
2. 13200 SUMMIT BLVD - 292 units, $23.6M assessed value
3. 905 LAKE UNION HILL WAY - 294 units, $22.6M assessed value

### Data Fields Captured:
- Parcel ID
- Address
- Owner Name
- Total Assessed Value
- Lot Size (acres)
- Unit Count
- Property Type
- Data Source URL
- Scrape Timestamp

## Files Generated:
- `fulton-properties.json` - 100 Fulton County properties
- `dekalb-properties.json` - 100 DeKalb County properties

## Next Steps:
- Send to JEDI ingest endpoint: `POST /api/jedi/ingest`
- Or adjust minUnits/limit to scrape more/different properties
