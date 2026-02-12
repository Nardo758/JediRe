# Python Data Pipeline Services

This directory contains the Python-based data pipeline for JEDI RE, merged from the `jedi-re` project.

## What's Included

### Core Pipeline
- **data_pipeline/** - Core processing modules
  - `processor.py` - GIS data processing
  - `loader.py` - Database loading
  - `capacity_analyzer.py` - Development capacity analysis
  - `zoning_engine.py` - Zoning rules engine
  - `database.py` - Database operations
  - `config.py` - Configuration

### Scripts
- **load_parcels.py** - Main script to load parcel data
- **load_mock_data.py** - Load mock data for testing
- **test_*.py** - Test scripts for various components

### Data
- **zoning-rules/** - Atlanta zoning ordinance rules (245 codes)
- **../gis-data/** - GIS data files (parcels, zoning districts)

## Setup

### 1. Install Dependencies

```bash
cd /home/leon/clawd/jedire/backend/python-services
pip install -r requirements.txt
```

### 2. Configure Database

Set environment variables in `.env`:
```
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=jedire
DB_USER=postgres
DB_PASSWORD=your-password
```

Or use the Supabase connection from Apartment Locator AI.

### 3. Load Parcel Data

```bash
# Test with small dataset
python load_parcels.py pipeline --pattern "fulton_parcels_sample.geojson" --limit 1000

# Load full 171K parcels (30-60 min)
python load_parcels.py pipeline --pattern "fulton_parcels_complete.geojson"
```

## Integration with Node.js Backend

The Node.js backend can call these Python services via:

1. **Child process execution** (for batch jobs)
2. **Python microservice** (FastAPI wrapper - future)
3. **Direct database access** (Node reads what Python writes)

### Example: Call from Node.js

```typescript
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

async function analyzeParcel(parcelId: string) {
  const cmd = `cd python-services && python load_parcels.py analyze --parcel-ids ${parcelId}`;
  const { stdout, stderr } = await execPromise(cmd);
  return JSON.parse(stdout);
}
```

## Key Features

### Development Capacity Analysis
- Analyzes vacant land and redevelopment potential
- Calculates maximum units based on zoning
- Probability-weighted 10-year forecasts
- Supply pressure metrics

### Zoning Intelligence
- 245 Atlanta zoning codes mapped
- Automated FAR, height, setback rules
- MRC (Multi-Resident Community) calculations
- Compatible use detection

## Documentation

- **DEVELOPMENT_CAPACITY.md** - Full feature specification
- See `/jedi-re/ROADMAP.md` for implementation phases

## Status

✅ Phase 1A Complete:
- Database schema
- Zoning rules engine (245 codes)
- Capacity analyzer
- ETL pipeline
- GIS data downloaded (171K parcels)

⏳ Next: Load parcel data in Replit environment
