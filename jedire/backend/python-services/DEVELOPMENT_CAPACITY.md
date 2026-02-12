# Development Capacity Analyzer

## Overview

The Development Capacity Analyzer is a core component of JEDI RE that calculates maximum buildable units and development potential for parcels based on local zoning regulations. It integrates Atlanta's zoning rules to provide accurate development capacity estimates for real estate analysis.

## Features

- **Zoning Rules Integration**: Loads and caches Atlanta zoning rules from verified JSON sources
- **Capacity Calculation**: Calculates maximum buildable units based on FAR, density limits, and lot size requirements
- **Development Potential Assessment**: Classifies parcels as VERY_HIGH, HIGH, MODERATE, LOW, VERY_LOW, or NOT_VIABLE
- **Constraint Analysis**: Identifies development constraints (setbacks, height limits, parking requirements)
- **Supply Forecasting**: Estimates development timeframe and submarket impact
- **API Integration**: RESTful endpoints for parcel and submarket analysis
- **Database Integration**: Stores analysis results for historical tracking

## Architecture

### Core Components

1. **Zoning Rules Service** (`src/services/zoning_rules_service.py`)
   - Loads zoning rules from JSON files
   - Provides lookup methods for zoning codes
   - Caches rules for performance

2. **Development Capacity Analyzer** (`src/engines/development_capacity_analyzer.py`)
   - Main analysis engine
   - Calculates maximum buildable units
   - Assesses development potential
   - Generates supply forecasts

3. **API Endpoints** (`src/api/development_capacity.py`)
   - RESTful API for development capacity analysis
   - Integration with main FastAPI application

4. **Database Schema** (`src/database_migrations/zoning_migration.sql`)
   - Adds zoning fields to properties table
   - Creates analysis tracking tables
   - Adds development pipeline views

### Data Flow

```
Zoning JSON Files → Zoning Rules Service → Development Capacity Analyzer → API → Database
                      ↑                           ↓
                  Cache Rules              Analyze Parcels
```

## Installation & Setup

### 1. Database Migration

Run the zoning migration script to add required fields and tables:

```bash
psql -h localhost -p 5433 -U postgres -d jedire -f src/database_migrations/zoning_migration.sql
```

### 2. Verify Zoning Data

Ensure zoning JSON files are in place:
- `zoning-rules/atlanta_zoning_verified.json` (single-family districts R-1 to R-5)
- `zoning-rules/atlanta_mf_zoning_verified.json` (multifamily districts RG, MR-1 to MR-6, etc.)

### 3. Update Properties Data

Add zoning information to properties:

```sql
-- Example: Update a property with zoning information
UPDATE properties 
SET zoning_code = 'MR-4A', 
    lot_size_sqft = 15000,
    last_zoning_check_date = CURRENT_DATE
WHERE id = 1;
```

## Usage

### Python API

```python
from src.engines.development_capacity_analyzer import DevelopmentCapacityAnalyzer

# Initialize analyzer
analyzer = DevelopmentCapacityAnalyzer()

# Analyze a parcel
result = analyzer.analyze_parcel(
    parcel_id=123,
    current_zoning="MR-4A",
    lot_size_sqft=15000,
    current_units=0,
    location="Buckhead, Atlanta",
    submarket_id=1
)

# Access results
print(f"Max Units: {result.maximum_buildable_units}")
print(f"Potential: {result.development_potential.value}")
print(f"Constraints: {result.constraints}")
```

### REST API Endpoints

#### 1. Analyze Parcel Development Capacity
```
POST /api/v1/development/parcels/analyze
```
**Request Body:**
```json
{
  "parcel_id": 123,
  "current_zoning": "MR-4A",
  "lot_size_sqft": 15000,
  "current_units": 0,
  "location": "Buckhead, Atlanta",
  "submarket_id": 1
}
```

#### 2. Get Parcel Development Capacity
```
GET /api/v1/development/parcels/{parcel_id}/development-capacity
```
**Query Parameters:**
- `recalculate` (optional): Force recalculation

#### 3. Get Submarket Development Pipeline
```
GET /api/v1/development/submarkets/{submarket_id}/development-pipeline
```
**Query Parameters:**
- `include_parcels` (optional): Include individual parcel analysis

#### 4. List Zoning Codes
```
GET /api/v1/development/zoning-codes
```
**Query Parameters:**
- `zone_type` (optional): Filter by zone type
- `city`: City name (default: Atlanta)
- `state`: State code (default: GA)

#### 5. Get Zoning Rules
```
GET /api/v1/development/zoning-rules/{zoning_code}
```

## Calculation Methodology

### Maximum Buildable Units

The analyzer uses three methods and applies the most restrictive:

1. **Density-Based Calculation**
   ```
   max_units = lot_size_acres × maximum_density_units_per_acre
   ```

2. **FAR-Based Calculation**
   ```
   max_units = (lot_size_sqft × maximum_far) ÷ average_unit_size
   ```
   - Single-family: 2,000 sqft average
   - Multifamily: 800 sqft average

3. **Minimum Lot Size Constraint**
   ```
   max_units = lot_size_sqft ÷ minimum_lot_size_sqft
   ```

### Development Potential Classification

| Potential Level | Unit Range | Description |
|----------------|------------|-------------|
| VERY_HIGH | > 100 units | Large development opportunity |
| HIGH | 50-100 units | Significant development potential |
| MODERATE | 20-50 units | Moderate development potential |
| LOW | 5-20 units | Limited development potential |
| VERY_LOW | 1-5 units | Minimal development potential |
| NOT_VIABLE | 0 units | No development possible |

### Confidence Scoring

Confidence score (0-1) based on:
- Zoning rules completeness (+0.3 base)
- Density data available (+0.2)
- FAR data available (+0.2)
- Lot size data available (+0.1)
- Valid lot size (>0 sqft) (+0.1)
- Reasonable lot size (>1000 sqft) (+0.1)

## Example Analysis

### Buckhead Vacant Parcel Analysis

**Input:**
- Zoning: MR-4A (high-density multifamily)
- Lot Size: 15,000 sqft (0.34 acres)
- Current Units: 0 (vacant)

**Output:**
```json
{
  "parcel_id": 1001,
  "current_zoning": "MR-4A",
  "lot_size_sqft": 15000,
  "current_units": 0,
  "maximum_buildable_units": 42,
  "development_potential": "HIGH",
  "estimated_far": 1.49,
  "max_height_feet": 80,
  "constraints": [
    "80ft height limit",
    "Transitional height plane"
  ],
  "supply_forecast": {
    "timeframe_months": 18,
    "projected_new_units": 42,
    "impact_on_submarket": "6% supply increase",
    "development_likelihood": "HIGH"
  }
}
```

### Submarket Impact Analysis

For a submarket with 10,000 existing units:
- 42 new units = 0.42% supply increase
- **Impact**: Minimal - unlikely to affect market dynamics

## Integration with JEDI RE

### Carrying Capacity Engine Integration

The development capacity analyzer complements the existing Carrying Capacity Engine:

1. **Supply Pipeline Data**: Development capacity analysis provides future supply estimates
2. **Market Timing**: Helps identify when new supply might hit the market
3. **Risk Assessment**: Identifies oversupply risks from zoning-allowed development

### Database Integration

New tables and fields:
- `properties.zoning_code`: Zoning classification
- `properties.lot_size_sqft`: Parcel size
- `properties.development_capacity`: Cached capacity calculation
- `zoning_rules_cache`: Cached zoning rules
- `development_capacity_analysis`: Historical analysis results
- `submarket_development_pipeline`: Aggregated pipeline view

## Testing

Run the test suite:

```bash
python test_development_capacity.py
```

**Test Coverage:**
1. Single parcel analysis (Buckhead vacant lot)
2. Multiple zoning code comparison
3. Submarket pipeline analysis
4. API response structure validation

## Data Sources

### Atlanta Zoning Rules
- **Single-Family**: `atlanta_zoning_verified.json` (R-1 to R-5)
- **Multi-Family**: `atlanta_mf_zoning_verified.json` (RG, MR-1 to MR-6, MR-MU, MRC-1 to MRC-3)

### Verification Status
- All rules verified against Atlanta Municipal Code
- Source: Municode Atlanta Zoning Ordinance
- Last Updated: 2026-02-03

## Limitations & Assumptions

### Current Limitations
1. **Atlanta-Specific**: Currently only supports Atlanta zoning rules
2. **Average Unit Sizes**: Uses fixed averages for FAR calculations
3. **Simplified Constraints**: Some complex zoning provisions simplified
4. **No Site-Specific Factors**: Doesn't consider topography, utilities, etc.

### Key Assumptions
1. **Buildable Area**: Assumes entire lot is buildable (no wetlands, etc.)
2. **Unit Mix**: Assumes standard unit mix for density calculations
3. **Parking**: Assumes parking can be accommodated
4. **Market Conditions**: Assumes market demand exists for new units

## Future Enhancements

### Planned Features
1. **Additional Cities**: Expand to other major markets
2. **Site-Specific Factors**: Incorporate topography, utilities, access
3. **Economic Feasibility**: Add pro forma analysis integration
4. **Visualization**: Map-based development potential visualization
5. **Historical Tracking**: Track zoning changes over time

### Integration Opportunities
1. **GIS Integration**: Connect with parcel shapefiles
2. **Market Data**: Integrate with rent and absorption data
3. **Construction Costs**: Add cost estimation for development
4. **Permit Tracking**: Monitor actual permit applications

## Troubleshooting

### Common Issues

1. **Zoning Code Not Found**
   - Verify zoning code spelling
   - Check if code exists in JSON files
   - Try case-insensitive search

2. **Zero Maximum Units**
   - Check lot size meets minimum requirements
   - Verify zoning allows development
   - Check for conflicting constraints

3. **Low Confidence Score**
   - Ensure zoning rules have complete data
   - Verify lot size is reasonable
   - Check data source completeness

### Debugging

Enable debug logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

Check zoning data loading:

```python
from src.services.zoning_rules_service import get_zoning_service
service = get_zoning_service()
print(f"Loaded {len(service.get_all_zoning_codes())} zoning codes")
```

## Support

For issues or questions:
1. Check zoning data files for completeness
2. Verify database migration ran successfully
3. Review API documentation for correct usage
4. Check test suite for expected behavior

## Changelog

### v1.0.0 (Initial Release)
- Initial development capacity analyzer
- Atlanta zoning rules integration
- REST API endpoints
- Database schema and migrations
- Comprehensive test suite
- Documentation