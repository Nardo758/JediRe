# Fulton County Property API - Data Capabilities

## API Overview

**Endpoint:** `https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0`

**Type:** ArcGIS REST API (Free, Public, No Auth Required)

**Status:** ✅ WORKING (Tested Feb 19, 2026)

---

## Available Data Fields (34 Total)

### Property Identification
- `ParcelID` - Unique parcel identifier
- `FeatureID` - GIS feature ID
- `Address` - Full property address
- `AddrNumber` - Street number
- `AddrPreDir` - Pre-directional (N, S, E, W)
- `AddrStreet` - Street name
- `AddrSuffix` - Street suffix (RD, ST, AVE, etc.)
- `AddrPosDir` - Post-directional
- `AddrUntTyp` - Unit type (APT, UNIT, etc.)
- `AddrUnit` - Unit number
- `TaxYear` - Tax assessment year

### Ownership Information
- `Owner` - Property owner name
- `OwnerAddr1` - Owner mailing address line 1
- `OwnerAddr2` - Owner mailing address line 2 (city, state, zip)

### Property Characteristics
- `LivUnits` - Number of living units (critical for multifamily!)
- `LandAcres` - Land size in acres
- `LUCode` - Land use code (252 = multifamily, 341 = commercial, etc.)
- `ClassCode` - Property class code (C3, C5, etc.)
- `ExCode` - Exemption code

### Location Details
- `NbrHood` - Neighborhood code
- `Subdiv` - Subdivision name
- `SubdivNum` - Subdivision number
- `SubdivLot` - Lot number
- `SubdivBlck` - Block number
- `TaxDist` - Tax district code

### Valuation Data (EXCELLENT!)
- `TotAssess` - Total assessed value
- `LandAssess` - Land assessed value
- `ImprAssess` - Improvements assessed value
- `TotAppr` - Total appraised value
- `LandAppr` - Land appraised value
- `ImprAppr` - Improvements appraised value

### Geometry (GIS Data)
- `Shape__Area` - Parcel area in square feet
- `Shape__Length` - Parcel perimeter in feet
- `OBJECTID` - Database object ID

---

## Real-World Example: Multifamily Property

**Address:** 35 Milton Ave, Atlanta, GA  
**Owner:** PDOF ALPHARETTA LLC  
**Units:** 119 apartments

### Data Retrieved:
```
Property ID:            22 482512690060
Living Units:           119
Land Size:              0.1786 acres (6,839 sqft)
Parcel Perimeter:       354.72 feet

Valuation (2025):
  Total Assessed:       $6,480,000
  Land Assessed:        $94,280
  Improvements:         $6,385,720
  
  Total Appraised:      $16,200,000
  Land Appraised:       $235,700
  Improvements:         $15,964,300

Per-Unit Metrics:
  Assessed/Unit:        $54,453
  Appraised/Unit:       $136,134
  Acres/Unit:           0.0015

Owner Contact:
  Name:                 PDOF ALPHARETTA LLC
  Address:              3500 LENOX RD SUITE 625
                        ATLANTA GA 30326

Classification:
  Land Use Code:        252 (Multifamily)
  Class Code:           C3
  Neighborhood:         C103
  Tax District:         10
```

---

## What We CAN Get ✅

1. **Property Basics**
   - Exact address and parcel ID
   - Land size (acres + square feet)
   - Number of units (for multifamily)
   - Property type/use codes

2. **Owner Information**
   - Current owner name
   - Owner mailing address
   - Can search by owner name

3. **Valuation Data (BEST PART!)**
   - Assessed values (land + improvements)
   - Appraised values (land + improvements)
   - Can calculate per-unit metrics
   - Tax district information

4. **Location Context**
   - Neighborhood codes
   - Subdivision details
   - Precise parcel boundaries (GIS data)

5. **Bulk Queries**
   - Search by address, parcel ID, or owner
   - Query multifamily properties (LivUnits > X)
   - Get counts and statistics
   - Export up to 100+ records per query

---

## What We CAN Also Get ✅ (Additional APIs)

### **Sales History** (Tyler_YearlySales Service)
- **Endpoint:** `Tyler_YearlySales/FeatureServer`
- **Years Available:** 2018-2022 (separate layers)
- **Data Fields:**
  - ParID (Parcel ID)
  - TaxYear
  - Price (sale amount)
  - Cur (current flag)
  - Geometry (parcel shape)

**Example:** 2022 Sale
- Address: 2125 Fairfax Dr
- Sale Price: $672,500
- Current Assessed: $316,000
- Current Appraised: $790,000

**Note:** Some sales show $0 (non-market transfers: gifts, corporate restructuring, etc.)

## What We CANNOT Get ❌

1. **Recent Sales (2023+)**
   - Tyler_YearlySales only has 2018-2022
   - Need county recorder for current year

2. **Building Details**
   - No square footage
   - No year built
   - No number of bedrooms/bathrooms
   - No building stories or height

3. **Tax Payment History**
   - No tax payment records
   - No delinquency information
   - Only shows tax district

4. **Liens & Encumbrances**
   - No mortgage information
   - No liens or judgments
   - Need title search

5. **Permits & Violations**
   - No building permits
   - No code violations
   - Need separate city/county systems

6. **Rental/Income Data**
   - No rent rolls
   - No occupancy rates
   - No income verification

---

## Query Examples

### 1. Search by Address
```
GET /query?where=Address LIKE '%3500 PEACHTREE%'&outFields=*&f=json
```

### 2. Search by Parcel ID
```
GET /query?where=ParcelID='22 482512690060'&outFields=*&f=json
```

### 3. Find Multifamily Properties
```
GET /query?where=LivUnits >= 20&outFields=*&resultRecordCount=100&f=json
```

### 4. Search by Owner
```
GET /query?where=Owner LIKE '%PDOF%'&outFields=*&f=json
```

### 5. Get Property Count
```
GET /query?where=LivUnits > 50&returnCountOnly=true&f=json
```

---

## Use Cases for JEDI RE

### ✅ PERFECT FOR:
1. **Initial property discovery** - Find multifamily properties
2. **Owner research** - Who owns what?
3. **Valuation analysis** - Assessed vs appraised values
4. **Portfolio tracking** - Monitor specific parcels
5. **Market screening** - Filter by units, size, location
6. **Contact discovery** - Owner mailing addresses

### ⚠️ NEED ADDITIONAL DATA FOR:
1. **Sales comps** - Requires county recorder or MLS
2. **Building specs** - Requires assessor's detailed records
3. **Financial performance** - Requires income statements
4. **Title research** - Requires title search
5. **Historical trends** - Requires multi-year data collection

---

## Integration with JEDI RE

### Current Scraper Location:
`./municipal-scraper/src/scrapers/fulton-county-api.ts`

### API Functions Available:
- `scrapeByAddress(address)` - Get property by address
- `scrapeByParcelId(parcelId)` - Get property by parcel
- `scrapeByOwner(ownerName)` - Find all properties by owner
- `scrapeMultifamily(minUnits, limit)` - Query multifamily properties
- `getParcelCount(whereClause)` - Count matching properties
- `healthCheck()` - Verify API is accessible

### Recommended Workflow:
1. Use API to discover properties (fast, free, bulk)
2. For selected properties, supplement with:
   - Sales history from county recorder
   - Building details from assessor's office
   - Financial data from owner/operator
   - Market data from CoStar/Yardi/etc.

---

## Performance

- **Speed:** <1 second per property
- **Success Rate:** ~99% (API is very reliable)
- **Cost:** FREE (public API)
- **Rate Limits:** None observed (reasonable use)
- **Data Freshness:** Updated annually (Tax Year 2025)

---

## Next Steps

1. ✅ API is working and tested
2. ✅ Scraper code exists in `./municipal-scraper/`
3. 🔄 Deploy to Cloudflare Workers (if needed)
4. 🔄 Integrate with JEDI RE platform
5. 🔄 Add supplemental data sources for sales history

---

**Date:** February 19, 2026  
**Tested By:** RocketMan 🚀  
**Status:** Production Ready ✅
