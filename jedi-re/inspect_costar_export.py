#!/usr/bin/env python3
"""
Inspect CoStar Excel Export
Analyzes the structure and creates an import adapter

Run this when you have pandas installed:
    python3 inspect_costar_export.py sample_costar_export.xlsx
"""

import sys
import pandas as pd
from pathlib import Path


def inspect_excel(file_path: str):
    """Inspect Excel file structure"""
    print(f"Inspecting: {file_path}")
    print("="*80)
    
    # Read Excel file
    df = pd.read_excel(file_path)
    
    print(f"\nTotal Rows: {len(df):,}")
    print(f"Total Columns: {len(df.columns)}")
    
    print("\n" + "="*80)
    print("COLUMNS")
    print("="*80)
    for i, col in enumerate(df.columns, 1):
        dtype = df[col].dtype
        null_count = df[col].isnull().sum()
        null_pct = (null_count / len(df)) * 100 if len(df) > 0 else 0
        
        print(f"{i:2d}. {col:40s} | {dtype:10s} | {null_pct:5.1f}% null")
    
    print("\n" + "="*80)
    print("SAMPLE DATA (First 5 Rows)")
    print("="*80)
    print(df.head(5).to_string())
    
    print("\n" + "="*80)
    print("DATA SUMMARY")
    print("="*80)
    
    # Detect likely field mappings
    mappings = {
        'property_name': None,
        'address': None,
        'city': None,
        'state': None,
        'zip': None,
        'latitude': None,
        'longitude': None,
        'units': None,
        'year_built': None,
        'property_type': None,
        'rent': None,
        'vacancy_rate': None,
        'absorption': None
    }
    
    # Try to auto-detect columns
    for col in df.columns:
        col_lower = col.lower()
        
        if 'property' in col_lower and 'name' in col_lower:
            mappings['property_name'] = col
        elif 'address' in col_lower or 'street' in col_lower:
            mappings['address'] = col
        elif col_lower in ['city', 'market', 'submarket']:
            mappings['city'] = col
        elif 'state' in col_lower:
            mappings['state'] = col
        elif 'zip' in col_lower or 'postal' in col_lower:
            mappings['zip'] = col
        elif 'lat' in col_lower and 'long' not in col_lower:
            mappings['latitude'] = col
        elif 'long' in col_lower or 'lng' in col_lower:
            mappings['longitude'] = col
        elif 'unit' in col_lower and 'count' in col_lower:
            mappings['units'] = col
        elif 'year' in col_lower and 'built' in col_lower:
            mappings['year_built'] = col
        elif 'type' in col_lower and 'property' in col_lower:
            mappings['property_type'] = col
        elif 'rent' in col_lower and 'effective' not in col_lower:
            mappings['rent'] = col
        elif 'vacancy' in col_lower:
            mappings['vacancy_rate'] = col
        elif 'absorption' in col_lower:
            mappings['absorption'] = col
    
    print("\nSuggested Field Mappings:")
    print("-"*80)
    for field, excel_col in mappings.items():
        if excel_col:
            print(f"  {field:20s} → {excel_col}")
        else:
            print(f"  {field:20s} → [NOT FOUND]")
    
    # Generate adapter template
    print("\n" + "="*80)
    print("GENERATING COSTAR ADAPTER...")
    print("="*80)
    
    generate_adapter(df.columns.tolist(), mappings)
    
    print("\n✓ Adapter template generated: src/scrapers/costar_adapter.py")
    print("✓ Review and customize field mappings as needed")


def generate_adapter(columns, mappings):
    """Generate CoStar adapter code"""
    
    adapter_code = f'''"""
CoStar Excel Import Adapter
Auto-generated from sample CoStar export

Columns found in export:
{chr(10).join(f"  - {col}" for col in columns[:20])}
{'  ...' if len(columns) > 20 else ''}
"""

import pandas as pd
from typing import Iterator, Dict, Any
from pathlib import Path

from .adapter_base import DataSourceAdapter, PropertyData, RentObservation


class CoStarExcelAdapter(DataSourceAdapter):
    """
    Adapter for CoStar Excel exports
    """
    
    def __init__(self, excel_file: str):
        super().__init__(source_name="costar-excel")
        self.file_path = excel_file
        self.df = None
        
        # Field mapping (customize these based on actual CoStar columns)
        self.field_map = {{
            'property_name': {repr(mappings.get('property_name'))},
            'address': {repr(mappings.get('address'))},
            'city': {repr(mappings.get('city'))},
            'state': {repr(mappings.get('state'))},
            'zip': {repr(mappings.get('zip'))},
            'latitude': {repr(mappings.get('latitude'))},
            'longitude': {repr(mappings.get('longitude'))},
            'units': {repr(mappings.get('units'))},
            'year_built': {repr(mappings.get('year_built'))},
            'property_type': {repr(mappings.get('property_type'))},
        }}
    
    def connect(self) -> bool:
        """Load Excel file"""
        try:
            self.df = pd.read_excel(self.file_path)
            self.logger.info(f"Loaded {{len(self.df):,}} rows from {{self.file_path}}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to load Excel: {{e}}")
            return False
    
    def disconnect(self):
        """Clear data"""
        self.df = None
    
    def fetch_properties(self, city=None, updated_since=None, limit=None) -> Iterator[PropertyData]:
        """Fetch properties from Excel"""
        if self.df is None:
            raise RuntimeError("Not connected - call connect() first")
        
        df = self.df.copy()
        
        # Apply filters
        if city:
            city_col = self.field_map.get('city')
            if city_col and city_col in df.columns:
                df = df[df[city_col].str.contains(city, case=False, na=False)]
        
        if limit:
            df = df.head(limit)
        
        # Convert to PropertyData
        for idx, row in df.iterrows():
            yield self._row_to_property(row, idx)
    
    def _row_to_property(self, row: pd.Series, idx: int) -> PropertyData:
        """Convert Excel row to PropertyData"""
        
        def safe_get(field_name):
            """Safely get field value"""
            col_name = self.field_map.get(field_name)
            if col_name and col_name in row.index:
                val = row[col_name]
                return None if pd.isna(val) else val
            return None
        
        return PropertyData(
            external_id=str(idx),  # Use row index as ID
            name=safe_get('property_name') or f"Property {{idx}}",
            address=safe_get('address') or "",
            city=safe_get('city') or "",
            state=safe_get('state') or "GA",
            zip_code=safe_get('zip'),
            latitude=safe_get('latitude'),
            longitude=safe_get('longitude'),
            total_units=int(safe_get('units')) if safe_get('units') else None,
            year_built=int(safe_get('year_built')) if safe_get('year_built') else None,
            source="costar"
        )
    
    def fetch_rent_observations(self, property_external_id=None, start_date=None, 
                               end_date=None, limit=None) -> Iterator[RentObservation]:
        """
        CoStar exports typically don't have time-series rent data
        Override this if your export includes historical rents
        """
        return iter([])  # Empty iterator


# Convenience function
def load_costar_export(excel_file: str, target_db_connection_string: str, city: str = None):
    """
    Load CoStar Excel export into JEDI RE
    
    Usage:
        load_costar_export("costar_export.xlsx", "postgresql://...", city="Atlanta")
    """
    from .etl_orchestrator import run_etl
    
    adapter = CoStarExcelAdapter(excel_file)
    
    stats = run_etl(
        source_adapter=adapter,
        target_db_connection_string=target_db_connection_string,
        city=city,
        incremental=False,  # CoStar exports are full snapshots
        enable_geocoding=True  # Geocode if lat/lon missing
    )
    
    return stats


if __name__ == "__main__":
    # Test the adapter
    adapter = CoStarExcelAdapter("sample_costar_export.xlsx")
    
    if adapter.connect():
        print("✓ Loaded CoStar export")
        
        count = 0
        for prop in adapter.fetch_properties(limit=5):
            print(f"  - {{prop.name}} ({{prop.address}})")
            count += 1
        
        print(f"\\n✓ Processed {{count}} properties")
        adapter.disconnect()
'''
    
    # Write to file
    output_path = Path(__file__).parent / "src" / "scrapers" / "costar_adapter.py"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w") as f:
        f.write(adapter_code)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python inspect_costar_export.py <excel_file>")
        sys.exit(1)
    
    excel_file = sys.argv[1]
    
    if not Path(excel_file).exists():
        print(f"Error: File not found: {excel_file}")
        sys.exit(1)
    
    inspect_excel(excel_file)
