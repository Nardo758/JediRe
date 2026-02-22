# 🚀 Run Fulton County Property Import in Replit

**Quick Start Guide - Copy/Paste Commands**

---

## Step 1: Run Migration (Create Tables)

Open Replit Shell and run:

```bash
psql $DATABASE_URL -f backend/src/database/migrations/040_property_records.sql
```

**Expected Output:**
```
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE INDEX
...
CREATE VIEW
GRANT
COMMENT
```

**What this does:**
- Creates `property_records` table (property details)
- Creates `property_sales` table (individual sales 2018-2022)
- Creates `market_trends` table (city median prices 2012-2024)
- Creates `property_metrics` view (per-unit calculations)
- Sets up indexes for fast queries

---

## Step 2: Run the Import Script

```bash
cd backend
tsx src/scripts/import-fulton-properties.ts
```

**What to expect:**

```
🚀 Starting Fulton County Property Import (100+ units)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Querying Tax Parcels API for 100+ unit properties...
✅ Found 47 properties with 100+ units

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📥 Importing properties into database...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/47] 35 MILTON AVE (119 units, 22 482512690060)
  💰 Found 1 sale(s)
[2/47] 3500 PEACHTREE RD NW REAR (0 units, 17 0044  LL0920)
[3/47] ...
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 Importing market trends (city median prices)...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Querying market trends (city median prices 2012-2024)...
✅ Found market data for 15 cities
✅ Imported 195 market trend records

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Import Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Summary:
   Properties imported: 47/47
   Sales records: 12
   Market trends: 195 data points (15 cities, 2012-2024)
```

**Runtime:** ~5-10 minutes

---

## Step 3: Verify the Import

After import completes, verify the data:

```bash
psql $DATABASE_URL << 'EOF'
-- Count total properties
SELECT COUNT(*) as total_properties FROM property_records;

-- View top 5 by units
SELECT address, units, owner_name, appraised_value
FROM property_records
ORDER BY units DESC
LIMIT 5;

-- Count sales records
SELECT COUNT(*) as total_sales FROM property_sales;

-- View market trends sample
SELECT city, year, median_sale_price
FROM market_trends
WHERE year IN (2012, 2024)
ORDER BY city, year;
EOF
```

---

## Troubleshooting

### "relation does not exist"
→ Run Step 1 (migration) first

### "command not found: tsx"
→ Install dependencies first:
```bash
cd backend
npm install
```

### Import hangs or times out
→ Check Replit hasn't gone to sleep
→ The script rate-limits itself (100ms between requests)

### "Cannot find module 'pg'"
→ Install pg package:
```bash
cd backend
npm install pg
```

---

## After Import: Query Examples

### Basic Queries

```sql
-- All 100+ unit properties
SELECT address, units, owner_name, appraised_per_unit
FROM property_metrics
WHERE units >= 100
ORDER BY units DESC;

-- Properties under $120k/unit (value-add opportunities)
SELECT address, units, owner_name, appraised_per_unit
FROM property_metrics
WHERE appraised_per_unit < 120000
ORDER BY appraised_per_unit;

-- Recent sales with appreciation
SELECT 
  pr.address,
  pr.units,
  ps.sale_year,
  ps.sale_price / pr.units as price_per_unit,
  pr.appraised_per_unit,
  ROUND(((pr.appraised_value - ps.sale_price)::FLOAT / ps.sale_price * 100), 1) as appreciation_pct
FROM property_records pr
JOIN property_sales ps ON pr.parcel_id = ps.parcel_id
WHERE ps.sale_price > 0
ORDER BY ps.sale_year DESC;
```

### Year-Built Cohort Analysis

```sql
-- Sales by vintage (Pre-1980, 1980-1999, 2000-2009, 2010-2019, 2020+)
SELECT 
  CASE 
    WHEN year_built < '1980' THEN 'Pre-1980'
    WHEN year_built < '2000' THEN '1980-1999'
    WHEN year_built < '2010' THEN '2000-2009'
    WHEN year_built < '2020' THEN '2010-2019'
    ELSE '2020+'
  END AS vintage,
  ps.sale_year,
  COUNT(*) as sales_count,
  ROUND(AVG(ps.sale_price / pr.units)) as avg_price_per_unit
FROM property_sales ps
JOIN property_records pr ON ps.parcel_id = pr.parcel_id
WHERE ps.sale_price > 0 AND pr.units >= 100 AND pr.year_built IS NOT NULL
GROUP BY vintage, ps.sale_year
ORDER BY ps.sale_year DESC, vintage;
```

### Market Trends

```sql
-- City appreciation 2012-2024
SELECT 
  city,
  MAX(CASE WHEN year = 2012 THEN median_sale_price END) as median_2012,
  MAX(CASE WHEN year = 2024 THEN median_sale_price END) as median_2024,
  ROUND(((MAX(CASE WHEN year = 2024 THEN median_sale_price END) - 
          MAX(CASE WHEN year = 2012 THEN median_sale_price END))::FLOAT /
         MAX(CASE WHEN year = 2012 THEN median_sale_price END) * 100), 1) as appreciation_pct
FROM market_trends
WHERE year IN (2012, 2024)
GROUP BY city
ORDER BY appreciation_pct DESC;
```

**📊 More queries:** See `MARKET_ANALYSIS_QUERIES.md` for advanced year-built cohort analysis!

---

## Summary

✅ **Step 1:** Run migration (creates tables)  
✅ **Step 2:** Run import script (~5-10 min)  
✅ **Step 3:** Verify data loaded  

**Result:**
- ~40-60 large multifamily properties (100+ units)
- Individual sales history (2018-2022)
- City median prices (2012-2024) for 15+ cities
- Year-built cohort analysis capabilities
- Full market research dataset!

**Data You'll Have:**
- Property addresses, owners, contact info
- Unit counts, land size, valuations
- Per-unit metrics ($120k-150k/unit typical)
- 5 years of sales transactions
- 12 years of market appreciation trends
- Year-built for vintage analysis

---

**Ready to run? Start with Step 1!** 🚀
