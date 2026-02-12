"""
OppGrid Scraper Adapter
Connects to Leon's apartment scraping infrastructure

This is a template - needs to be customized once we know:
1. How OppGrid stores data (DB? API? Files?)
2. Schema/field names
3. Access credentials
"""

from typing import Iterator, Optional
from datetime import datetime
import logging

from .adapter_base import (
    DataSourceAdapter,
    DatabaseAdapter,
    APIAdapter,
    PropertyData,
    RentObservation
)

logger = logging.getLogger(__name__)


class OppGridDatabaseAdapter(DatabaseAdapter):
    """
    OppGrid adapter using direct database connection
    Use this if Leon's scrapers write to PostgreSQL/MySQL
    """
    
    def __init__(
        self,
        host: str = "localhost",
        port: int = 5432,
        database: str = "oppgrid",
        user: str = "oppgrid_user",
        password: str = "",
        properties_table: str = "apartments",
        rents_table: str = "rent_history"
    ):
        connection_string = f"postgresql://{user}:{password}@{host}:{port}/{database}"
        super().__init__(
            source_name="oppgrid-db",
            connection_string=connection_string,
            properties_table=properties_table,
            rents_table=rents_table
        )
    
    def _map_to_property_data(self, row: dict) -> PropertyData:
        """
        Custom mapping for OppGrid schema
        CUSTOMIZE THIS based on actual OppGrid database schema
        """
        return PropertyData(
            external_id=str(row.get('apartment_id', row.get('id'))),
            name=row.get('property_name', row.get('name', '')),
            address=row.get('street_address', row.get('address', '')),
            city=row.get('city', ''),
            state=row.get('state', 'GA'),
            zip_code=row.get('zip_code', row.get('zipcode')),
            latitude=row.get('lat', row.get('latitude')),
            longitude=row.get('lng', row.get('longitude')),
            total_units=row.get('unit_count', row.get('total_units')),
            year_built=row.get('year_built', row.get('built_year')),
            stories=row.get('floors', row.get('stories')),
            amenities=self._parse_amenities(row.get('amenities')),
            source="oppgrid",
            scraped_at=row.get('last_scraped', row.get('updated_at'))
        )
    
    def _map_to_rent_observation(self, row: dict) -> RentObservation:
        """
        Custom mapping for OppGrid rent observations
        CUSTOMIZE THIS based on actual OppGrid schema
        """
        # Map bedroom count to unit_type
        bedrooms = row.get('bedrooms', row.get('bedroom_count', 0))
        unit_type = self._bedrooms_to_unit_type(bedrooms)
        
        return RentObservation(
            property_external_id=str(row.get('apartment_id', row.get('property_id'))),
            observed_at=row.get('scraped_date', row.get('observed_at', datetime.now())),
            unit_type=unit_type,
            asking_rent=float(row.get('rent', row.get('asking_rent', 0))),
            effective_rent=row.get('effective_rent'),
            sqft=row.get('square_feet', row.get('sqft')),
            floor_plan_name=row.get('floor_plan', row.get('plan_name')),
            available_units=row.get('available', row.get('available_count')),
            source="oppgrid",
            confidence=1.0
        )
    
    def _parse_amenities(self, amenities_data) -> dict:
        """Parse amenities from whatever format OppGrid uses"""
        if amenities_data is None:
            return {}
        
        # If it's JSON string, parse it
        if isinstance(amenities_data, str):
            import json
            try:
                return json.loads(amenities_data)
            except:
                # Maybe it's a comma-separated string
                return {"amenities": amenities_data.split(',')}
        
        # If it's already a dict, return as-is
        if isinstance(amenities_data, dict):
            return amenities_data
        
        return {}
    
    def _bedrooms_to_unit_type(self, bedrooms: int) -> str:
        """Convert bedroom count to standard unit_type"""
        if bedrooms == 0:
            return "studio"
        elif bedrooms == 1:
            return "1br"
        elif bedrooms == 2:
            return "2br"
        elif bedrooms == 3:
            return "3br"
        elif bedrooms >= 4:
            return "4br"
        else:
            return "unknown"


class OppGridAPIAdapter(APIAdapter):
    """
    OppGrid adapter using REST API
    Use this if Leon exposes scrapers via API
    """
    
    def __init__(
        self,
        base_url: str = "https://api.oppgrid.com",
        api_key: Optional[str] = None
    ):
        super().__init__(
            source_name="oppgrid-api",
            base_url=base_url,
            api_key=api_key,
            rate_limit_per_minute=60
        )
    
    def _map_to_property_data(self, data: dict) -> PropertyData:
        """Custom mapping for OppGrid API response"""
        return PropertyData(
            external_id=str(data.get('id', data.get('apartment_id'))),
            name=data.get('name', data.get('property_name', '')),
            address=data.get('address', ''),
            city=data.get('city', ''),
            state=data.get('state', 'GA'),
            zip_code=data.get('zip', data.get('zipcode')),
            latitude=data.get('lat', data.get('latitude')),
            longitude=data.get('lon', data.get('longitude')),
            total_units=data.get('units', data.get('total_units')),
            year_built=data.get('year_built'),
            stories=data.get('stories', data.get('floors')),
            amenities=data.get('amenities', {}),
            source="oppgrid",
            scraped_at=self._parse_datetime(data.get('last_updated'))
        )


class OppGridFileAdapter:
    """
    OppGrid adapter for CSV/JSON exports
    Use this if Leon exports scraper data to files
    """
    
    @staticmethod
    def create_csv_adapter(csv_path: str) -> DataSourceAdapter:
        """Create adapter for OppGrid CSV export"""
        from .adapter_base import FileAdapter
        return FileAdapter(source_name="oppgrid-csv", file_path=csv_path)
    
    @staticmethod
    def create_json_adapter(json_path: str) -> DataSourceAdapter:
        """Create adapter for OppGrid JSON export"""
        from .adapter_base import FileAdapter
        return FileAdapter(source_name="oppgrid-json", file_path=json_path)


def create_oppgrid_adapter(
    connection_type: str = "database",
    **kwargs
) -> DataSourceAdapter:
    """
    Factory function to create appropriate OppGrid adapter
    
    Args:
        connection_type: 'database', 'api', or 'file'
        **kwargs: Connection parameters specific to adapter type
    
    Returns:
        DataSourceAdapter instance
    
    Examples:
        # Database connection
        adapter = create_oppgrid_adapter(
            'database',
            host='localhost',
            database='oppgrid',
            user='user',
            password='pass'
        )
        
        # API connection
        adapter = create_oppgrid_adapter(
            'api',
            base_url='https://api.oppgrid.com',
            api_key='your-key'
        )
        
        # File import
        adapter = create_oppgrid_adapter(
            'file',
            file_path='/path/to/oppgrid_export.csv'
        )
    """
    if connection_type == "database":
        return OppGridDatabaseAdapter(**kwargs)
    elif connection_type == "api":
        return OppGridAPIAdapter(**kwargs)
    elif connection_type == "file":
        file_path = kwargs.get('file_path')
        if not file_path:
            raise ValueError("file_path required for file adapter")
        
        if file_path.endswith('.csv'):
            return OppGridFileAdapter.create_csv_adapter(file_path)
        elif file_path.endswith('.json'):
            return OppGridFileAdapter.create_json_adapter(file_path)
        else:
            raise ValueError(f"Unsupported file format: {file_path}")
    else:
        raise ValueError(f"Unknown connection type: {connection_type}")


# Example usage
if __name__ == "__main__":
    # Test database adapter
    print("Testing OppGrid Database Adapter...")
    db_adapter = create_oppgrid_adapter(
        'database',
        host='localhost',
        database='oppgrid',
        user='postgres',
        password=''
    )
    
    if db_adapter.connect():
        print("✓ Connected to OppGrid database")
        
        # Fetch first 10 properties in Atlanta
        print("\nFetching properties...")
        count = 0
        for prop in db_adapter.fetch_properties(city="Atlanta", limit=10):
            print(f"  - {prop.name} ({prop.address})")
            count += 1
        
        print(f"\n✓ Fetched {count} properties")
        
        db_adapter.disconnect()
    else:
        print("✗ Failed to connect")
