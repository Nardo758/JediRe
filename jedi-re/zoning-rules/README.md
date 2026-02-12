# JEDI RE - Zoning Rules Parser (Phase 1A)

## Overview

This directory contains tools and data for parsing Atlanta zoning ordinance PDFs to extract rules for residential/multifamily zones. The extracted data is used by the **Development Capacity Analyzer** in Phase 2 of JEDI RE.

## Target Zones

The parser focuses on extracting rules for these residential and multifamily zones:

### Single-Family Residential Zones
- **R-1**: Single-Family Residential - Low Density
- **R-2**: Single-Family Residential - Low-Medium Density  
- **R-3**: Single-Family Residential - Medium Density
- **R-4**: Single-Family Residential - Medium-High Density
- **R-5**: Single-Family Residential - High Density

### Multifamily Residential Zones
- **MF-1**: Multifamily Residential - Low Density
- **MF-2**: Multifamily Residential - Low-Medium Density
- **MF-3**: Multifamily Residential - Medium Density
- **MF-4**: Multifamily Residential - Medium-High Density
- **MF-5**: Multifamily Residential - High Density

## Data to Extract

For each zoning code, extract:
- **Minimum lot size** (sq ft and acres)
- **FAR** (Floor Area Ratio)
- **Maximum units per acre**
- **Height limits** (feet and stories)
- **Setbacks** (front, rear, side)
- **Parking requirements** (spaces per unit)

## Files

### `atlanta_zoning_rules_placeholder.json`
- **Status**: PLACEHOLDER DATA
- **Purpose**: Template structure with reasonable estimates based on typical US city zoning
- **Note**: **MUST BE VERIFIED** with actual Atlanta zoning ordinance
- **Use**: Development and testing until actual data is available

### `atlanta_zoning_template.json`
- **Status**: EMPTY TEMPLATE
- **Purpose**: Clean template with null values for filling with actual data
- **Use**: Starting point for actual data entry

### `zoning_parser.py`
- **Status**: WORKING PARSER FRAMEWORK
- **Purpose**: Python script to parse zoning ordinance PDFs
- **Features**:
  - `ZoningRule` class for structured data
  - `ZoningParser` class with regex patterns for metric extraction
  - JSON export functionality
  - Placeholder data loading
- **Dependencies needed for PDF parsing**:
  ```bash
  pip install PyPDF2 pdfplumber
  ```

## Usage

### 1. Using Placeholder Data (for development)
```bash
cd jedi-re/zoning-rules
python zoning_parser.py --placeholder --output atlanta_zoning_rules.json
```

### 2. Parsing Actual PDF (when available)
```bash
cd jedi-re/zoning-rules
python zoning_parser.py --input /path/to/atlanta_zoning_ordinance.pdf --output atlanta_zoning_rules.json
```

### 3. Testing with Sample Text
```python
from zoning_parser import ZoningParser

parser = ZoningParser()
sample_text = """
R-3 District Regulations:
Minimum lot size: 10,000 sq ft
Maximum density: 4.4 units per acre
Maximum FAR: 0.55
Maximum height: 35 feet
Front setback: 15 feet
Rear setback: 15 feet
Side setback: 6 feet
"""

parser.extract_from_text(sample_text)
parser.to_json("test_output.json")
```

## Data Sources Needed

### Primary Source
- **Official Atlanta Zoning Ordinance PDF**
  - Source: Atlanta City Planning Department
  - URL: https://www.atlantaga.gov/government/departments/city-planning/zoning

### Alternative Sources
1. **Municipal Code Libraries**:
   - https://codelibrary.amlegal.com/codes/atlanta/latest/overview
   - https://library.municode.com/ga/atlanta/codes/code_of_ordinances

2. **Open Data Portals**:
   - Atlanta GIS: https://gis.atlantaga.gov
   - Open Data Atlanta: https://data.atlantaga.gov

3. **Planning Documents**:
   - Zoning district maps
   - Zoning ordinance amendments
   - Comprehensive plan documents

## Integration with JEDI RE

The zoning rules will be used by the **Development Capacity Analyzer** (Phase 2 feature) to:

1. **Calculate maximum allowed units** per parcel
2. **Determine development capacity** for submarkets
3. **Forecast long-term supply** (2-10 years)
4. **Identify redevelopment opportunities**

### Database Schema
```sql
CREATE TABLE zoning_rules (
    id SERIAL PRIMARY KEY,
    city VARCHAR(100),
    state VARCHAR(2),
    zoning_code VARCHAR(20),
    
    -- Rule type
    rule_type VARCHAR(50),  -- 'density_based', 'far_based', 'lot_size'
    
    -- Density rules
    density_per_acre DECIMAL(8, 2),
    
    -- FAR rules
    max_far DECIMAL(4, 2),
    avg_unit_size_sqft INTEGER,
    
    -- Lot size rules
    min_lot_per_unit INTEGER,
    
    -- Additional constraints
    max_height_feet INTEGER,
    min_setback_feet INTEGER,
    
    -- Metadata
    source TEXT,
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(city, state, zoning_code)
);
```

## Next Steps

### Immediate (Phase 1A)
1. ✅ Create directory structure and templates
2. ✅ Build parser framework
3. ✅ Create placeholder data for development
4. 🔄 **Obtain actual Atlanta zoning ordinance PDF**
5. 🔄 Parse PDF and extract actual zoning rules
6. 🔄 Verify extracted data against official sources
7. 🔄 Update JSON files with verified data

### Future (Phase 2)
8. Integrate with Development Capacity Analyzer
9. Add support for additional cities (Austin, Miami, Charlotte)
10. Build automated zoning rule scraper/parser
11. Create zoning rule database with versioning

## Notes

- **Placeholder data is for development only** and should not be used for actual analysis
- Actual Atlanta zoning rules may differ significantly from placeholder values
- Some zoning codes may have additional regulations (use restrictions, design standards, etc.)
- Zoning ordinances are frequently updated - need version tracking
- Consider both "by-right" development and "with variances" scenarios

## Contact

For questions about zoning data or parser implementation, refer to the JEDI RE project documentation or contact the development team.

---

**Last Updated**: 2026-02-03  
**Status**: Phase 1A - Parser framework complete, awaiting actual zoning ordinance PDF