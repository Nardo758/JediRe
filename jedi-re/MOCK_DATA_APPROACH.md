# Mock Data Approach - Testing Without Real Data Sources

**Problem:** We don't know yet whether to use CoStar or build scrapers  
**Solution:** Use synthetic data to validate architecture while decision is pending

---

## What We Built

### 1. Mock Data Generator (`src/mock_data/generator.py`)
Generates realistic synthetic data:

**Properties (50 buildings across 5 submarkets):**
- Buckhead (declining rents)
- Midtown (growing rents)
- Downtown (flat rents)
- Brookhaven (strong growth)
- Sandy Springs (slow growth)

**Rent Observations (52 weeks of time-series data):**
- Studio, 1BR, 2BR, 3BR
- Realistic trends per submarket
- Random noise and variation
- Vacancy rates

**Pipeline Projects (20 under construction/planned):**
- Delivery dates spread over next 3 years
- Status: planned, under-construction, completed
- Realistic unit counts

### 2. Data Loader (`load_mock_data.py`)
Loads synthetic data into PostgreSQL:
```bash
# Generate and load in one command
python load_mock_data.py --all

# Or separate steps
python load_mock_data.py --generate  # Create JSON files
python load_mock_data.py --load      # Load into DB
```

---

## Realistic Data Characteristics

### Buckhead (Declining Market)
- Base rent (2BR): $2,850
- Trend: -1% monthly
- Vacancy: 8%
- **Signal:** WEAK demand, declining rents

### Midtown (Growing Market)
- Base rent (2BR): $2,650
- Trend: +0.5% monthly
- Vacancy: 5%
- **Signal:** MODERATE growth

### Brookhaven (Strong Market)
- Base rent (2BR): $2,400
- Trend: +1% monthly  
- Vacancy: 3%
- **Signal:** STRONG demand, tight supply

### Downtown (Flat Market)
- Base rent (2BR): $2,200
- Trend: 0% monthly
- Vacancy: 12%
- **Signal:** NEUTRAL, oversupplied

### Sandy Springs (Slow Growth)
- Base rent (2BR): $2,100
- Trend: +0.2% monthly
- Vacancy: 6%
- **Signal:** SLOW growth

---

## What This Lets Us Test

### Phase 2 Engines (Already Built)
✅ **Signal Processing Engine**
- Feed it mock rent time series
- Validate trend detection (should see Buckhead declining, Brookhaven growing)
- Test noise filtering

✅ **Carrying Capacity Engine**
- Use mock pipeline + demographics
- Calculate saturation levels
- Estimate years to equilibrium

✅ **Imbalance Detector**
- Synthesize both engines
- Generate verdicts: STRONG_OPPORTUNITY → AVOID
- Validate scoring logic

### Phase 2 APIs
✅ **REST Endpoints** (`src/api/phase2_routes.py`)
- `/api/v1/submarkets` - List submarkets
- `/api/v1/submarkets/{id}/analysis` - Market analysis
- `/api/v1/properties` - Property listings
- `/api/v1/properties/{id}/rent-history` - Time series
- `/api/v1/parcels/{id}/market-fit` - **Phase 1 + Phase 2 integration**

### UI/Dashboard Development
✅ Can build charts and visualizations:
- Rent trend graphs (real data)
- Market heat maps (real verdicts)
- Supply-demand dashboards
- Investment opportunity rankings

---

## When Real Data Arrives

**Swap data source in 3 places:**

### Option A: CoStar Integration
```python
# Instead of mock data, load from CoStar API
from scrapers.costar_adapter import CoStarAdapter

adapter = CoStarAdapter(api_key="YOUR_KEY")
run_etl(source_adapter=adapter, ...)
```

### Option B: Scraper Integration  
```python
# Load from your apartment scrapers
from scrapers.oppgrid_adapter import create_oppgrid_adapter

adapter = create_oppgrid_adapter('database', host='...', ...)
run_etl(source_adapter=adapter, ...)
```

### Option C: File Imports
```python
# Load from CSV/JSON exports
from scrapers.adapter_base import FileAdapter

adapter = FileAdapter(source_name="costar-export", file_path="data.csv")
run_etl(source_adapter=adapter, ...)
```

**Everything else stays the same:**
- Phase 2 engines work unchanged
- APIs work unchanged  
- UI works unchanged
- Just different data source

---

## Development Workflow

### Step 1: Load Mock Data
```bash
cd /home/leon/clawd/jedi-re
python load_mock_data.py --all
```

### Step 2: Apply Phase 2 Schema
```bash
psql -U postgres -d jedire -f src/phase2_schema.sql
```

### Step 3: Test APIs
```bash
# Start FastAPI server (if not running)
cd src/api
uvicorn main:app --reload

# Test endpoints
curl http://localhost:8000/api/v1/submarkets
curl http://localhost:8000/api/v1/submarkets/1/analysis
```

### Step 4: Validate Engines
```python
from engines.imbalance_detector import ImbalanceDetector

detector = ImbalanceDetector()

# Test on Buckhead (should show WEAK demand)
analysis = detector.analyze_submarket(submarket_id=1, weeks_of_data=52)
print(analysis.verdict)  # Should see declining trend

# Test on Brookhaven (should show STRONG demand)
analysis = detector.analyze_submarket(submarket_id=4, weeks_of_data=52)
print(analysis.verdict)  # Should see growth
```

---

## Benefits of This Approach

### ✅ Keeps Development Moving
- Don't wait for CoStar access
- Don't wait for scraper decision
- Validate architecture now

### ✅ Realistic Testing
- Mock data mimics real market behavior
- Different submarkets = different signals
- Time series trends are realistic

### ✅ Plug-and-Play
- When real data arrives, swap adapter
- No code changes to engines/APIs
- Instant production-ready

### ✅ Documentation Value
- Shows what data we NEED from real sources
- Sample format for CoStar/scrapers
- Clear requirements

---

## Data Requirements (For Real Sources)

When choosing CoStar vs scrapers, we need:

### Minimum Required:
1. **Properties** (one-time + updates)
   - Name, address, coordinates
   - Total units, year built
   
2. **Rent Observations** (ongoing, weekly/daily)
   - Property ID
   - Date observed
   - Unit type (studio, 1br, 2br, 3br)
   - Asking rent
   - Square footage
   - Availability

### Highly Valuable:
3. **Pipeline Projects**
   - Under construction projects
   - Planned developments
   - Estimated delivery dates
   - Unit counts

4. **Demographics** (quarterly/annual)
   - Population growth
   - Median income
   - Household formation

### Nice to Have:
5. **Historical Data** (6-12+ months)
   - Past rent trends
   - Absorption rates
   - Vacancy history

---

## Current Status

**Phase 1A:** 95% complete (waiting for dependency install when Leon returns)

**Phase 2:**
- ✅ Architecture documented
- ✅ Database schema ready
- ✅ API endpoints built
- ✅ Mock data generator complete
- ✅ ETL framework ready
- ⏳ Waiting for real data source decision

**Phase 3:** Roadmap documented

**Next Steps When Leon Returns:**
1. Run Phase 1A setup (`./SETUP_PIPELINE.sh`)
2. Load 171K parcels
3. Apply Phase 2 schema  
4. Load mock data
5. Test full stack end-to-end

**Decision Point:**
- CoStar access timeline?
- Build scrapers instead?
- Use mock data indefinitely for testing?

---

**Last Updated:** 2026-02-03 12:30 EST  
**Status:** Ready to test Phase 2 with synthetic data
