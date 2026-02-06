"""
Configuration for GIS data pipeline
"""
import os
from dataclasses import dataclass
from typing import Optional
from pathlib import Path


@dataclass
class DatabaseConfig:
    """PostgreSQL database configuration"""
    host: str = os.getenv("DB_HOST", "localhost")
    port: int = int(os.getenv("DB_PORT", "5432"))
    database: str = os.getenv("DB_NAME", "jedire")
    user: str = os.getenv("DB_USER", "postgres")
    password: str = os.getenv("DB_PASSWORD", "")
    schema: str = os.getenv("DB_SCHEMA", "public")
    
    def get_connection_string(self) -> str:
        """Get PostgreSQL connection string"""
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.database}"


@dataclass
class PipelineConfig:
    """GIS pipeline configuration"""
    # Data directories (use env var or fallback to local paths)
    gis_data_dir: Path = Path(os.getenv("GIS_DATA_DIR", "/home/leon/clawd/jedi-re/gis-data"))
    processed_dir: Path = Path(os.getenv("PROCESSED_DIR", "/home/leon/clawd/jedi-re/processed-data"))
    logs_dir: Path = Path(os.getenv("LOGS_DIR", "/home/leon/clawd/jedi-re/logs"))
    
    # Processing settings
    batch_size: int = 1000  # Number of parcels to process in each batch
    max_workers: int = 4    # Maximum parallel workers
    chunk_size_mb: int = 50  # Maximum chunk size in MB for shapefile reading
    
    # Coordinate systems
    source_crs: str = "EPSG:4326"  # WGS84 - source data CRS
    target_crs: str = "EPSG:4326"  # WGS84 - target CRS (same for now)
    
    # Validation settings
    required_fields: list = None
    field_type_mapping: dict = None
    
    def __post_init__(self):
        """Initialize default values"""
        # Create directories if they don't exist
        self.gis_data_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        
        # Default required fields for parcels
        if self.required_fields is None:
            self.required_fields = [
                "PARCELID",  # Assessor's Parcel Number
                "SITEADDRESS",
                "SITECITY",
                "SITEZIP",
                "LNDVALUE",
                "TOT_APPR",
                "ZONING1",
                "CLASSCD",
            ]
        
        # Default field type mapping
        if self.field_type_mapping is None:
            self.field_type_mapping = {
                "PARCELID": "str",
                "SITEADDRESS": "str",
                "SITECITY": "str",
                "SITEZIP": "str",
                "LNDVALUE": "float",
                "TOT_APPR": "float",
                "IMPR_APPR": "float",
                "ZONING1": "str",
                "ZONING2": "str",
                "CLASSCD": "str",
                "CLASSDSCRP": "str",
                "OWNERNME1": "str",
                "OWNERNME2": "str",
                "COUNCIL": "str",
                "NPU": "str",
                "NEIGHBORHOOD": "str",
            }


# Global configuration instance
config = PipelineConfig()