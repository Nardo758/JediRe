"""
Base adapter class for integrating external data sources
Supports multiple integration patterns: Direct DB, REST API, File imports
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Iterator
from datetime import datetime, timedelta
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class PropertyData:
    """Standardized property data structure"""
    # Required fields
    name: str
    address: str
    city: str
    state: str
    
    # Optional fields
    external_id: Optional[str] = None
    zip_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    total_units: Optional[int] = None
    year_built: Optional[int] = None
    stories: Optional[int] = None
    amenities: Optional[Dict[str, Any]] = None
    
    # Metadata
    source: Optional[str] = None
    scraped_at: Optional[datetime] = None


@dataclass
class RentObservation:
    """Standardized rent observation structure"""
    # Required fields
    property_external_id: str
    observed_at: datetime
    unit_type: str  # 'studio', '1br', '2br', '3br', '4br'
    asking_rent: float
    
    # Optional fields
    effective_rent: Optional[float] = None
    sqft: Optional[int] = None
    floor_plan_name: Optional[str] = None
    available_units: Optional[int] = None
    total_units: Optional[int] = None
    
    # Metadata
    source: Optional[str] = None
    confidence: float = 1.0


class DataSourceAdapter(ABC):
    """
    Abstract base class for data source adapters
    
    Subclass this to create adapters for:
    - Direct database connections (PostgreSQL, MySQL, etc.)
    - REST APIs
    - File imports (CSV, JSON, Parquet)
    - Web scraping
    """
    
    def __init__(self, source_name: str):
        self.source_name = source_name
        self.logger = logging.getLogger(f"{__name__}.{source_name}")
    
    @abstractmethod
    def connect(self) -> bool:
        """
        Establish connection to data source
        
        Returns:
            True if connection successful, False otherwise
        """
        pass
    
    @abstractmethod
    def disconnect(self):
        """Close connection to data source"""
        pass
    
    @abstractmethod
    def fetch_properties(
        self, 
        city: Optional[str] = None,
        updated_since: Optional[datetime] = None,
        limit: Optional[int] = None
    ) -> Iterator[PropertyData]:
        """
        Fetch properties from data source
        
        Args:
            city: Filter by city name
            updated_since: Only fetch properties updated after this timestamp
            limit: Maximum number of properties to fetch
            
        Yields:
            PropertyData objects
        """
        pass
    
    @abstractmethod
    def fetch_rent_observations(
        self,
        property_external_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: Optional[int] = None
    ) -> Iterator[RentObservation]:
        """
        Fetch rent observations from data source
        
        Args:
            property_external_id: Filter by specific property
            start_date: Start of date range
            end_date: End of date range
            limit: Maximum number of observations to fetch
            
        Yields:
            RentObservation objects
        """
        pass
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about the data source
        
        Returns:
            Dictionary with stats like total properties, date range, etc.
        """
        return {
            "source": self.source_name,
            "connected": False,
            "properties_count": 0,
            "observations_count": 0
        }


class DatabaseAdapter(DataSourceAdapter):
    """
    Adapter for direct database connections
    Supports PostgreSQL, MySQL, SQLite
    """
    
    def __init__(
        self, 
        source_name: str,
        connection_string: str,
        properties_table: str = "properties",
        rents_table: str = "rent_observations"
    ):
        super().__init__(source_name)
        self.connection_string = connection_string
        self.properties_table = properties_table
        self.rents_table = rents_table
        self.connection = None
    
    def connect(self) -> bool:
        """Establish database connection"""
        try:
            import psycopg2
            self.connection = psycopg2.connect(self.connection_string)
            self.logger.info(f"Connected to database: {self.source_name}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to connect to database: {e}")
            return False
    
    def disconnect(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()
            self.logger.info(f"Disconnected from database: {self.source_name}")
    
    def fetch_properties(
        self, 
        city: Optional[str] = None,
        updated_since: Optional[datetime] = None,
        limit: Optional[int] = None
    ) -> Iterator[PropertyData]:
        """Fetch properties from database"""
        if not self.connection:
            raise RuntimeError("Not connected to database")
        
        query = f"SELECT * FROM {self.properties_table} WHERE 1=1"
        params = []
        
        if city:
            query += " AND city = %s"
            params.append(city)
        
        if updated_since:
            query += " AND updated_at > %s"
            params.append(updated_since)
        
        query += " ORDER BY property_id"
        
        if limit:
            query += f" LIMIT {limit}"
        
        cursor = self.connection.cursor()
        cursor.execute(query, params)
        
        columns = [desc[0] for desc in cursor.description]
        
        for row in cursor:
            row_dict = dict(zip(columns, row))
            yield self._map_to_property_data(row_dict)
        
        cursor.close()
    
    def fetch_rent_observations(
        self,
        property_external_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: Optional[int] = None
    ) -> Iterator[RentObservation]:
        """Fetch rent observations from database"""
        if not self.connection:
            raise RuntimeError("Not connected to database")
        
        query = f"SELECT * FROM {self.rents_table} WHERE 1=1"
        params = []
        
        if property_external_id:
            query += " AND property_id = %s"
            params.append(property_external_id)
        
        if start_date:
            query += " AND observed_at >= %s"
            params.append(start_date)
        
        if end_date:
            query += " AND observed_at <= %s"
            params.append(end_date)
        
        query += " ORDER BY observed_at DESC"
        
        if limit:
            query += f" LIMIT {limit}"
        
        cursor = self.connection.cursor()
        cursor.execute(query, params)
        
        columns = [desc[0] for desc in cursor.description]
        
        for row in cursor:
            row_dict = dict(zip(columns, row))
            yield self._map_to_rent_observation(row_dict)
        
        cursor.close()
    
    def _map_to_property_data(self, row: Dict) -> PropertyData:
        """Map database row to PropertyData"""
        return PropertyData(
            external_id=str(row.get('property_id', row.get('id'))),
            name=row.get('name', row.get('property_name', '')),
            address=row.get('address', row.get('street_address', '')),
            city=row.get('city', ''),
            state=row.get('state', 'GA'),
            zip_code=row.get('zip_code', row.get('zipcode')),
            latitude=row.get('latitude', row.get('lat')),
            longitude=row.get('longitude', row.get('lon', row.get('lng'))),
            total_units=row.get('total_units', row.get('units')),
            year_built=row.get('year_built', row.get('built_year')),
            stories=row.get('stories', row.get('floors')),
            amenities=row.get('amenities'),
            source=self.source_name,
            scraped_at=row.get('updated_at', row.get('scraped_at'))
        )
    
    def _map_to_rent_observation(self, row: Dict) -> RentObservation:
        """Map database row to RentObservation"""
        return RentObservation(
            property_external_id=str(row.get('property_id')),
            observed_at=row.get('observed_at', row.get('date')),
            unit_type=row.get('unit_type', row.get('bedroom_count')),
            asking_rent=float(row.get('asking_rent', row.get('rent', 0))),
            effective_rent=row.get('effective_rent'),
            sqft=row.get('sqft', row.get('square_feet')),
            floor_plan_name=row.get('floor_plan_name', row.get('plan')),
            available_units=row.get('available_units', row.get('availability')),
            total_units=row.get('total_units'),
            source=self.source_name,
            confidence=row.get('confidence', 1.0)
        )


class APIAdapter(DataSourceAdapter):
    """
    Adapter for REST APIs
    Handles authentication, pagination, rate limiting
    """
    
    def __init__(
        self,
        source_name: str,
        base_url: str,
        api_key: Optional[str] = None,
        rate_limit_per_minute: int = 60
    ):
        super().__init__(source_name)
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.rate_limit = rate_limit_per_minute
        self.session = None
    
    def connect(self) -> bool:
        """Initialize HTTP session"""
        try:
            import requests
            self.session = requests.Session()
            
            if self.api_key:
                self.session.headers.update({
                    'Authorization': f'Bearer {self.api_key}'
                })
            
            # Test connection
            response = self.session.get(f"{self.base_url}/health", timeout=10)
            response.raise_for_status()
            
            self.logger.info(f"Connected to API: {self.source_name}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to connect to API: {e}")
            return False
    
    def disconnect(self):
        """Close HTTP session"""
        if self.session:
            self.session.close()
            self.logger.info(f"Disconnected from API: {self.source_name}")
    
    def fetch_properties(
        self, 
        city: Optional[str] = None,
        updated_since: Optional[datetime] = None,
        limit: Optional[int] = None
    ) -> Iterator[PropertyData]:
        """Fetch properties from API"""
        if not self.session:
            raise RuntimeError("Not connected to API")
        
        params = {}
        if city:
            params['city'] = city
        if updated_since:
            params['updated_since'] = updated_since.isoformat()
        if limit:
            params['limit'] = limit
        
        # Handle pagination
        page = 1
        while True:
            params['page'] = page
            
            response = self.session.get(f"{self.base_url}/properties", params=params)
            response.raise_for_status()
            
            data = response.json()
            properties = data.get('properties', data.get('data', []))
            
            if not properties:
                break
            
            for prop in properties:
                yield self._map_to_property_data(prop)
            
            # Check if there are more pages
            if not data.get('has_next', False) or len(properties) < params.get('limit', 100):
                break
            
            page += 1
    
    def fetch_rent_observations(
        self,
        property_external_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: Optional[int] = None
    ) -> Iterator[RentObservation]:
        """Fetch rent observations from API"""
        if not self.session:
            raise RuntimeError("Not connected to API")
        
        params = {}
        if property_external_id:
            params['property_id'] = property_external_id
        if start_date:
            params['start_date'] = start_date.isoformat()
        if end_date:
            params['end_date'] = end_date.isoformat()
        if limit:
            params['limit'] = limit
        
        response = self.session.get(f"{self.base_url}/rents", params=params)
        response.raise_for_status()
        
        data = response.json()
        observations = data.get('observations', data.get('data', []))
        
        for obs in observations:
            yield self._map_to_rent_observation(obs)
    
    def _map_to_property_data(self, data: Dict) -> PropertyData:
        """Map API response to PropertyData"""
        # Flexible mapping - adapts to different API schemas
        return PropertyData(
            external_id=str(data.get('id', data.get('property_id', data.get('external_id')))),
            name=data.get('name', data.get('property_name', '')),
            address=data.get('address', data.get('street_address', '')),
            city=data.get('city', ''),
            state=data.get('state', 'GA'),
            zip_code=data.get('zip_code', data.get('zipcode', data.get('postal_code'))),
            latitude=data.get('latitude', data.get('lat')),
            longitude=data.get('longitude', data.get('lon', data.get('lng'))),
            total_units=data.get('total_units', data.get('units')),
            year_built=data.get('year_built', data.get('built_year')),
            stories=data.get('stories', data.get('floors')),
            amenities=data.get('amenities'),
            source=self.source_name,
            scraped_at=self._parse_datetime(data.get('updated_at', data.get('scraped_at')))
        )
    
    def _map_to_rent_observation(self, data: Dict) -> RentObservation:
        """Map API response to RentObservation"""
        return RentObservation(
            property_external_id=str(data.get('property_id')),
            observed_at=self._parse_datetime(data.get('observed_at', data.get('date'))),
            unit_type=data.get('unit_type', data.get('bedroom_count')),
            asking_rent=float(data.get('asking_rent', data.get('rent', 0))),
            effective_rent=data.get('effective_rent'),
            sqft=data.get('sqft', data.get('square_feet')),
            floor_plan_name=data.get('floor_plan_name'),
            available_units=data.get('available_units'),
            source=self.source_name
        )
    
    def _parse_datetime(self, value: Any) -> Optional[datetime]:
        """Parse datetime from various formats"""
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace('Z', '+00:00'))
            except:
                pass
        return None


class FileAdapter(DataSourceAdapter):
    """
    Adapter for file-based imports
    Supports CSV, JSON, Parquet
    """
    
    def __init__(self, source_name: str, file_path: str):
        super().__init__(source_name)
        self.file_path = file_path
        self.data = None
    
    def connect(self) -> bool:
        """Load file into memory"""
        try:
            import pandas as pd
            
            if self.file_path.endswith('.csv'):
                self.data = pd.read_csv(self.file_path)
            elif self.file_path.endswith('.json'):
                self.data = pd.read_json(self.file_path)
            elif self.file_path.endswith('.parquet'):
                self.data = pd.read_parquet(self.file_path)
            else:
                raise ValueError(f"Unsupported file format: {self.file_path}")
            
            self.logger.info(f"Loaded file: {self.file_path} ({len(self.data)} rows)")
            return True
        except Exception as e:
            self.logger.error(f"Failed to load file: {e}")
            return False
    
    def disconnect(self):
        """Clear data from memory"""
        self.data = None
        self.logger.info(f"Unloaded file: {self.file_path}")
    
    def fetch_properties(
        self, 
        city: Optional[str] = None,
        updated_since: Optional[datetime] = None,
        limit: Optional[int] = None
    ) -> Iterator[PropertyData]:
        """Fetch properties from file"""
        if self.data is None:
            raise RuntimeError("File not loaded")
        
        df = self.data.copy()
        
        # Apply filters
        if city and 'city' in df.columns:
            df = df[df['city'] == city]
        
        if updated_since and 'updated_at' in df.columns:
            df = df[pd.to_datetime(df['updated_at']) > updated_since]
        
        if limit:
            df = df.head(limit)
        
        for _, row in df.iterrows():
            yield self._map_to_property_data(row.to_dict())
    
    def fetch_rent_observations(
        self,
        property_external_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: Optional[int] = None
    ) -> Iterator[RentObservation]:
        """Fetch rent observations from file"""
        if self.data is None:
            raise RuntimeError("File not loaded")
        
        df = self.data.copy()
        
        # Apply filters
        if property_external_id and 'property_id' in df.columns:
            df = df[df['property_id'] == property_external_id]
        
        if start_date and 'observed_at' in df.columns:
            df = df[pd.to_datetime(df['observed_at']) >= start_date]
        
        if end_date and 'observed_at' in df.columns:
            df = df[pd.to_datetime(df['observed_at']) <= end_date]
        
        if limit:
            df = df.head(limit)
        
        for _, row in df.iterrows():
            yield self._map_to_rent_observation(row.to_dict())
    
    def _map_to_property_data(self, row: Dict) -> PropertyData:
        """Map file row to PropertyData"""
        return PropertyData(
            external_id=str(row.get('property_id', row.get('id', ''))),
            name=row.get('name', ''),
            address=row.get('address', ''),
            city=row.get('city', ''),
            state=row.get('state', 'GA'),
            zip_code=row.get('zip_code'),
            latitude=row.get('latitude'),
            longitude=row.get('longitude'),
            total_units=row.get('total_units'),
            year_built=row.get('year_built'),
            source=self.source_name
        )
    
    def _map_to_rent_observation(self, row: Dict) -> RentObservation:
        """Map file row to RentObservation"""
        return RentObservation(
            property_external_id=str(row.get('property_id', '')),
            observed_at=pd.to_datetime(row.get('observed_at')),
            unit_type=row.get('unit_type', ''),
            asking_rent=float(row.get('asking_rent', 0)),
            sqft=row.get('sqft'),
            source=self.source_name
        )
