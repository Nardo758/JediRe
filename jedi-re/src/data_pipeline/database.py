"""
Database connection and operations for GIS pipeline
"""
import logging
from typing import Optional, Dict, Any, List
import psycopg2
from psycopg2.extras import RealDictCursor, execute_batch
from psycopg2.extensions import connection as PgConnection
from contextlib import contextmanager

from .config import DatabaseConfig

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manage PostgreSQL database connections and operations"""
    
    def __init__(self, config: Optional[DatabaseConfig] = None):
        self.config = config or DatabaseConfig()
        self._connection: Optional[PgConnection] = None
    
    def connect(self) -> PgConnection:
        """Establish database connection"""
        try:
            conn = psycopg2.connect(
                host=self.config.host,
                port=self.config.port,
                database=self.config.database,
                user=self.config.user,
                password=self.config.password
            )
            conn.autocommit = False
            logger.info(f"Connected to database {self.config.database} on {self.config.host}:{self.config.port}")
            return conn
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise
    
    @contextmanager
    def get_connection(self):
        """Context manager for database connections"""
        conn = None
        try:
            conn = self.connect()
            yield conn
            conn.commit()
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Database operation failed: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def execute_query(self, query: str, params: Optional[tuple] = None) -> List[Dict[str, Any]]:
        """Execute a query and return results"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(query, params or ())
                return cursor.fetchall()
    
    def execute_update(self, query: str, params: Optional[tuple] = None) -> int:
        """Execute an update/insert/delete query and return row count"""
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query, params or ())
                return cursor.rowcount
    
    def batch_insert(self, table: str, data: List[Dict[str, Any]]) -> int:
        """
        Batch insert data into a table
        
        Args:
            table: Table name
            data: List of dictionaries with column:value pairs
            
        Returns:
            Number of rows inserted
        """
        if not data:
            return 0
        
        # Get column names from first dictionary
        columns = list(data[0].keys())
        columns_str = ", ".join(columns)
        placeholders = ", ".join(["%s"] * len(columns))
        
        query = f"INSERT INTO {table} ({columns_str}) VALUES ({placeholders})"
        
        # Prepare values list
        values = [[row[col] for col in columns] for row in data]
        
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                execute_batch(cursor, query, values)
                return cursor.rowcount
    
    def create_parcels_table_if_not_exists(self):
        """Create parcels table if it doesn't exist"""
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS parcels (
            parcel_id SERIAL PRIMARY KEY,
            apn VARCHAR(50) NOT NULL,
            address VARCHAR(500),
            
            -- Physical characteristics
            lot_size_sqft DECIMAL(12, 2),
            
            -- Current state
            current_zoning VARCHAR(100),
            current_units INTEGER DEFAULT 0,
            
            -- Geospatial data
            coordinates_lat DECIMAL(10, 8),
            coordinates_lon DECIMAL(11, 8),
            
            -- Property values
            land_value DECIMAL(15, 2),
            total_appraised_value DECIMAL(15, 2),
            improvement_value DECIMAL(15, 2),
            
            -- Additional context
            county VARCHAR(100),
            city VARCHAR(100),
            state VARCHAR(2),
            zip_code VARCHAR(10),
            
            -- Owner information
            owner_name1 VARCHAR(255),
            owner_name2 VARCHAR(255),
            
            -- Property classification
            property_class_code VARCHAR(10),
            property_class_description VARCHAR(255),
            
            -- Administrative
            council_district VARCHAR(10),
            npu VARCHAR(10),
            neighborhood VARCHAR(255),
            
            -- Metadata
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            
            UNIQUE(apn, county, state)
        );
        
        CREATE INDEX IF NOT EXISTS idx_parcels_apn ON parcels(apn);
        CREATE INDEX IF NOT EXISTS idx_parcels_location ON parcels(city, state);
        CREATE INDEX IF NOT EXISTS idx_parcels_zoning ON parcels(current_zoning);
        CREATE INDEX IF NOT EXISTS idx_parcels_coordinates ON parcels(coordinates_lat, coordinates_lon);
        CREATE INDEX IF NOT EXISTS idx_parcels_value ON parcels(total_appraised_value DESC);
        """
        
        try:
            self.execute_update(create_table_sql)
            logger.info("Parcels table created or already exists")
        except Exception as e:
            logger.error(f"Failed to create parcels table: {e}")
            raise
    
    def check_table_exists(self, table_name: str) -> bool:
        """Check if a table exists in the database"""
        query = """
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = %s 
            AND table_name = %s
        );
        """
        result = self.execute_query(query, (self.config.schema, table_name))
        return result[0]['exists']
    
    def get_table_row_count(self, table_name: str) -> int:
        """Get row count for a table"""
        query = f"SELECT COUNT(*) as count FROM {table_name}"
        result = self.execute_query(query)
        return result[0]['count'] if result else 0
    
    def truncate_table(self, table_name: str):
        """Truncate a table (delete all rows)"""
        query = f"TRUNCATE TABLE {table_name} CASCADE"
        self.execute_update(query)
        logger.info(f"Truncated table: {table_name}")


# Global database manager instance
db_manager = DatabaseManager()