# CoStar Data Import Guide

**Great news:** CoStar data dumps are perfect for JEDI RE!

---

## What You Sent

✅ **File:** `sample_costar_export.xlsx` (11KB)  
✅ **Format:** Excel 2007+  
✅ **Status:** Saved to `/home/leon/clawd/jedi-re/sample_costar_export.xlsx`

---

## Next Steps (When You're at PC)

### Step 1: Inspect the Export

This will show what columns are available:

```bash
cd /home/leon/clawd/jedi-re

# First, install pandas if needed (part of SETUP_PIPELINE.sh)
source venv/bin/activate
pip install pandas openpyxl

# Then inspect
python inspect_costar_export.py sample_costar_export.xlsx
```

**This tool will:**
- Show all columns in the export
- Count rows
- Display sample data
- Auto-detect field mappings (Property Name, Address, Units, etc.)
- **Generate a custom CoStar adapter** (`src/scrapers/costar_adapter.py`)

### Step 2: Review & Customize

The generated adapter will have field mappings like:

```python
self.field_map = {
    'property_name': 'Property Name',  # Customize these
    'address': 'Street Address',
    'city': 'City',
    'units': 'Unit Count',
    # ... etc
}
```

Update these to match actual CoStar column names.

### Step 3: Import CoStar Data

```bash
# Using the generated adapter
python run_etl.py \
    --source costar \
    --file costar_export.xlsx \
    --city Atlanta \
    --geocoding
```

Or in Python:

```python
from scrapers.costar_adapter import load_costar_export

stats = load_costar_export(
    excel_file="costar_export.xlsx",
    target_db_connection_string="postgresql://postgres@localhost/jedire",
    city="Atlanta"
)

print(f"Loaded {stats.properties_inserted} properties")
```

---

## What Data We Hope CoStar Provides

### Essential:
- ✅ **Property Name**
- ✅ **Address** (Street, City, State, ZIP)
- ✅ **Coordinates** (Lat/Lon) - if not, we'll geocode
- ✅ **Units** (Total unit count)
- ✅ **Property Type** (Multifamily, Mixed-Use, etc.)

### Highly Valuable:
- 🎯 **Pipeline Projects** (Under construction, Planned)
  - Estimated delivery dates
  - Unit counts
  - Status
- 🎯 **Market Rents** (By unit type: Studio, 1BR, 2BR, 3BR)
- 🎯 **Vacancy Rate**
- 🎯 **Absorption Rate**
- 🎯 **Year Built**
- 🎯 **Submarket** (Buckhead, Midtown, etc.)

### Nice to Have:
- Historical rent trends (6-12+ months)
- Occupancy history
- Rent concessions
- Amenities
- Cap rates

---

## Import Strategy

### CoStar Exports (Quarterly/Monthly)
**What it provides:**
- Property inventory snapshot
- Pipeline projects
- Market stats (vacancy, absorption)
- Professional-grade data

**Frequency:** However often you can get dumps (monthly ideal, quarterly acceptable)

### Apartment Scrapers (Between Dumps)
**What it provides:**
- Real-time current rents
- New listings
- Availability

**Frequency:** Daily/weekly automated

### Combined = Powerful
- CoStar = foundation + pipeline intelligence
- Scrapers = real-time price movements
- JEDI RE = synthesizes both for live verdicts

---

## File Format Support

The ETL framework supports:

✅ **Excel** (.xlsx, .xls)  
✅ **CSV** (.csv)  
✅ **JSON** (.json)  
✅ **Parquet** (.parquet)

**Recommendation:** Excel is fine. If exports get large (10K+ properties), ask for CSV or Parquet for faster loading.

---

## Automation

Once we have the adapter working:

### Option A: Manual (Easy Start)
1. Download CoStar export monthly
2. Run: `python run_etl.py --source costar --file new_export.xlsx`
3. Done

### Option B: Scheduled (Production)
Set up cron job or GitHub Action:

```bash
# Every 1st of month at 6am
0 6 1 * * cd /home/leon/clawd/jedi-re && ./import_costar.sh
```

### Option C: Dropbox/Drive Sync
1. CoStar exports to shared folder
2. Script watches for new files
3. Auto-imports when detected

---

## What Happens After Import

1. **Properties loaded** → `properties` table
2. **Geocoding** → Match to parcels (if lat/lon missing)
3. **Submarket assignment** → Link to submarkets
4. **Market signals calculated** → Phase 2 engines run
5. **API updates** → `/api/v1/submarkets` shows fresh data
6. **Verdicts refresh** → STRONG_OPPORTUNITY scores update

---

## Testing First

Before using real CoStar data, we can test with mock data:

```bash
# Test full pipeline
python load_mock_data.py --all

# Verify it works
curl http://localhost:8000/api/v1/submarkets
```

Once that works, swap mock → CoStar → same results, real data.

---

## Questions to Answer (When You Inspect)

1. **What columns does the export have?**
   - Property identifiers?
   - Market data?
   - Pipeline projects?

2. **How many rows?**
   - 100 properties? 1,000? 10,000?

3. **Coverage?**
   - Just Atlanta? Multiple cities?
   - Just existing inventory? Or pipeline too?

4. **Update frequency?**
   - Can you get monthly dumps?
   - Quarterly?
   - On-demand?

5. **Historical data?**
   - Does it include past quarters?
   - Or just current snapshot?

---

## Expected Timeline

**When you're at PC:**

1. **5 min:** Run `inspect_costar_export.py` → see what we have
2. **10 min:** Customize adapter field mappings
3. **5 min:** Test import with sample file
4. **Done:** CoStar integration complete

Then going forward:
- Download new export → run import → data refreshes

---

## Current Status

**Phase 1A:** 95% complete (waiting for setup)  
**Phase 2:** Ready to receive CoStar data  
**CoStar Adapter:** Will auto-generate when you inspect the file  

**Next:** Run `inspect_costar_export.py` to see what's in that Excel file! 🚀
