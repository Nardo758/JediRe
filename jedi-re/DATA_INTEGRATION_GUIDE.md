# JEDI RE - Data Integration Guide
**Getting real data into the system**

Last Updated: 2026-02-03

---

## 🎯 What We're Integrating

### ✅ Ready Now (No API Keys Required)
1. **Google Trends** - Search demand proxy
2. **Census API** - Demographics (population, income, employment)
3. **Manual Property Entry** - Quick data entry tool for testing

### ⏸️ Waiting on Access
1. **CoStar API** - Rent comps (waiting on API access)
2. **Your apartment scrapers** - If you have existing scrapers, point me to them

---

## 🚀 Quick Start: Manual Property Entry

While we wait on automated data sources, you can manually add properties to test the system:

```bash
cd /home/leon/clawd/jedi-re
python src/tools/manual_property_entry.py
```

### Example: Adding a Test Property

```
Options:
  1. List submarkets
  2. List properties
  3. Add new property
  4. Add rent observation
  5. Add rent series (12 weeks)
  6. Exit

Select option: 3

Property name: The Standard at Buckhead
Address: 3232 Peachtree Rd NE, Atlanta, GA 30305
Submarket ID: 1  # Buckhead submarket
Latitude: 33.8490
Longitude: -84.3800
Number of units: 310

✅ Added property: The Standard at Buckhead (ID: 2)
```

### Adding Rent Data

**Option A: Single observation**
```
Select option: 4
Property ID: 2
Rent amount: 2450
✅ Added rent observation: $2450 on 2026-02-03
```

**Option B: 12 weeks of historical data (recommended for testing)**
```
Select option: 5
Property ID: 2
Starting rent: 2400
Weekly growth rate: 0.002  # 0.2% per week = ~10% annual
✅ Added 12 weeks of rent data for property 2
   Starting: $2400.00 → Ending: $2457.60
```

---

## 🤖 Automated Data Integration (Running in Background)

A background agent is currently setting up:

### 1. Google Trends Collector
**What it does:**
- Tracks search volume for "apartments [submarket name]"
- Proxy for rental demand in the area
- Updates weekly

**Example output:**
```json
{
  "submarket_id": 1,
  "keyword": "apartments buckhead atlanta",
  "search_volume": 75,
  "trend": "increasing",
  "date": "2026-02-03"
}
```

### 2. Census Data Collector
**What it does:**
- Pulls demographics for each submarket
- Population, median income, employment rate
- Updates quarterly (Census data doesn't change often)

**Example output:**
```json
{
  "submarket_id": 1,
  "population": 45000,
  "median_income": 82000,
  "employment_rate": 0.94,
  "median_age": 35
}
```

### 3. Integration Service
**What it does:**
- Schedules weekly data collection
- Updates database automatically
- Logs results for monitoring

---

## 📊 Testing the Full Pipeline

Once you've added properties + rent data, test the analysis:

### Via API:
```bash
curl http://localhost:8000/api/v1/submarkets/1/analysis
```

### Via UI:
Open: http://localhost:8000/ui

You should see:
- **Verdict**: STRONG_OPPORTUNITY / MODERATE_OPPORTUNITY / etc.
- **Scores**: Demand score, Supply score, Confidence
- **Signals**: Detailed breakdown

---

## 🔌 Next: Connect Your Scrapers

If you have existing apartment scrapers:

1. **Share the code/API endpoint** - I'll build an adapter
2. **Adapter will:**
   - Pull rent data weekly
   - Insert into `rent_observations` table
   - Trigger analysis updates

**Adapter structure:**
```python
# src/data_integrations/oppgrid_adapter.py
def sync_oppgrid_properties():
    """Pull latest data from OppGrid scraper"""
    properties = fetch_from_oppgrid_api()
    
    for prop in properties:
        # Insert/update property
        property_id = upsert_property(prop)
        
        # Add rent observation
        add_rent_observation(property_id, prop.rent, prop.date)
```

---

## 📈 Data Requirements for Analysis

To get a **confident** verdict, you need:

### Minimum Data:
- **1 property** in a submarket
- **12 weeks** of rent observations
- **Submarket demographics** (population, income)

### Recommended Data:
- **3-5 properties** in a submarket
- **24+ weeks** of rent observations
- **Google Trends data** (search demand)
- **Traffic counts** (if available)

### Gold Standard:
- **10+ properties** in a submarket
- **52+ weeks** (1 year) of rent data
- All supplemental data sources

---

## 🚨 Troubleshooting

### Database Connection Issues
```bash
# Check if database is running
docker ps | grep postgres

# If not running:
cd /home/leon/clawd/jedi-re
docker-compose up -d
```

### Manual Entry Tool Not Working
```bash
# Check Python environment
python --version  # Should be 3.8+

# Install dependencies if needed
pip install psycopg2-binary
```

### API Not Responding
```bash
# Check if API is running
curl http://localhost:8000/health

# If not running:
cd /home/leon/clawd/jedi-re
docker-compose up -d api
```

---

## 📞 Next Steps

1. **Test Manual Entry**: Add 2-3 properties with 12 weeks of data
2. **Check Analysis**: View results in UI (http://localhost:8000/ui)
3. **Wait for Integrations**: Background agent setting up Google Trends + Census
4. **Connect Scrapers**: Once automated data flows, we're fully operational

---

**Status**: Data integration setup in progress (~30 min)
**Blockers**: Need CoStar API access (when available)
**Ready**: Manual entry tool ready for testing now
