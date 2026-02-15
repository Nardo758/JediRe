# Migration 024: Property Records Schema

**Created:** Feb 15, 2026 09:25 EST  
**File:** `backend/migrations/024_property_records_schema.sql`  
**Size:** 19.6 KB  
**Status:** Ready to run

---

## 📊 What This Creates

### **5 Core Tables:**

1. **`property_records`** - Master property data
   - 40+ fields: address, assessment, taxes, ownership
   - PostGIS spatial indexing (geom column)
   - Unique constraint: (parcel_id, county, state)
   - 9 indexes for performance

2. **`property_sales`** - Transaction history
   - Sale date, price, buyer/seller
   - Hold period calculations
   - Price per unit/sqft metrics
   - 6 indexes

3. **`property_tax_history`** - Annual tax data
   - Tax assessments by year
   - Payment status tracking
   - Appeals and exemptions
   - YoY change calculations
   - 3 indexes

4. **`property_permits`** - Building permits
   - Permit type, status, valuation
   - Contractor information
   - Construction details
   - Inspections tracking
   - 5 indexes

5. **`scraper_runs`** - Performance tracking
   - Success/failure rates
   - Error logging (JSONB)
   - Performance metrics
   - 4 indexes

---

### **3 Helpful Views:**

1. **`recent_property_sales`**
   - Sales in last 24 months
   - Joins property details
   - Ready for comp queries

2. **`high_tax_properties`**
   - Properties >20% above market avg
   - Tax premium calculation
   - Sorted by premium %

3. **`scraper_performance`**
   - Last 30 days by county
   - Success rates
   - Average scrape times

---

### **2 Utility Functions:**

1. **`get_comparable_sales(lat, lng, radius, months, filters)`**
   - PostGIS spatial query
   - Returns comps within radius
   - Filters by type, units
   - Sorted by distance

2. **`calculate_tax_burden(property_id)`**
   - Compare to market avg/median
   - Calculate percentile
   - Difference from market

---

## 🚀 How to Run

### **Option 1: Direct psql (Recommended)**
```bash
# From JEDI RE backend directory
psql postgresql://postgres:password@helium/heliumdb?sslmode=disable \
  -f migrations/024_property_records_schema.sql
```

### **Option 2: Node.js script**
```javascript
// In backend/scripts/run-migration.js
const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  connectionString: 'postgresql://postgres:password@helium/heliumdb?sslmode=disable'
});

async function runMigration() {
  await client.connect();
  const sql = fs.readFileSync('./migrations/024_property_records_schema.sql', 'utf8');
  await client.query(sql);
  await client.end();
  console.log('Migration 024 complete!');
}

runMigration();
```

### **Option 3: Replit shell**
```bash
# In Replit shell
cd backend
cat migrations/024_property_records_schema.sql | \
  psql postgresql://postgres:password@helium/heliumdb?sslmode=disable
```

---

## ✅ Verification

After running, verify with:

```sql
-- Check tables created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'property_%' OR table_name = 'scraper_runs';

-- Should return:
-- property_records
-- property_sales
-- property_tax_history
-- property_permits
-- scraper_runs

-- Check views created
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public';

-- Should return:
-- recent_property_sales
-- high_tax_properties
-- scraper_performance

-- Check functions created
SELECT proname 
FROM pg_proc 
WHERE proname IN ('get_comparable_sales', 'calculate_tax_burden');

-- Check PostGIS enabled
SELECT PostGIS_Version();
```

---

## 📝 Table Sizes (Empty)

```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'property_%' OR tablename = 'scraper_runs'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 🔗 Next Steps

1. ✅ **Run this migration** (takes ~10 seconds)
2. ⏳ **Build Cloudflare Worker** (municipal-scraper)
3. ⏳ **Implement Fulton County scraper**
4. ⏳ **Wire Market Research Engine** to query property_records

---

## 🎯 Expected Data Flow

```
Cloudflare Worker
    ↓ (scrapes county site)
    ↓ (writes to)
property_records table
    ↓ (reads from)
Market Research Engine
    ↓ (calls get_comparable_sales())
    ↓ (calls calculate_tax_burden())
Property Records Tab (UI)
```

---

## 📋 Sample Queries

### Get comps for a property:
```sql
SELECT * FROM get_comparable_sales(
  33.8490,  -- latitude
  -84.3880, -- longitude
  3,        -- radius (miles)
  12,       -- months back
  'Multifamily', -- property type
  150,      -- min units
  300       -- max units
);
```

### Calculate tax burden:
```sql
SELECT * FROM calculate_tax_burden(
  'property-uuid-here'
);
```

### Recent sales:
```sql
SELECT * FROM recent_property_sales
WHERE city = 'Atlanta'
AND property_type = 'Multifamily'
LIMIT 10;
```

---

## 🔒 Security Notes

- **No sensitive data** - All data from public records
- **PostGIS extension** - Requires superuser first time only
- **Indexes** - Optimized for spatial queries
- **Constraints** - Prevent duplicate parcels

---

**Status:** ✅ Ready to run  
**Est. Time:** ~10 seconds  
**Rollback:** Drop tables in reverse order if needed

