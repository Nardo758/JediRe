"""
ETL Orchestrator for Phase 2 Data Pipeline
Coordinates: Scraper → Geocode → Match → Store
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import logging
import psycopg2
from psycopg2.extras import execute_batch

from .adapter_base import DataSourceAdapter, PropertyData, RentObservation
from .geocoder import GeocodingPipeline, GeocodingResult

logger = logging.getLogger(__name__)


@dataclass
class ETLStats:
    """Statistics for ETL run"""
    start_time: datetime
    end_time: Optional[datetime] = None
    
    # Properties
    properties_fetched: int = 0
    properties_geocoded: int = 0
    properties_matched: int = 0
    properties_inserted: int = 0
    properties_updated: int = 0
    properties_failed: int = 0
    
    # Rent observations
    rents_fetched: int = 0
    rents_inserted: int = 0
    rents_failed: int = 0
    
    # Errors
    errors: List[str] = None
    
    def __post_init__(self):
        if self.errors is None:
            self.errors = []
    
    def duration_seconds(self) -> float:
        """Calculate duration of ETL run"""
        if self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return 0
    
    def summary(self) -> Dict[str, Any]:
        """Get summary dict"""
        return {
            "duration_seconds": self.duration_seconds(),
            "properties": {
                "fetched": self.properties_fetched,
                "geocoded": self.properties_geocoded,
                "matched": self.properties_matched,
                "inserted": self.properties_inserted,
                "updated": self.properties_updated,
                "failed": self.properties_failed
            },
            "rents": {
                "fetched": self.rents_fetched,
                "inserted": self.rents_inserted,
                "failed": self.rents_failed
            },
            "error_count": len(self.errors)
        }


class ETLOrchestrator:
    """
    Orchestrates the complete ETL pipeline:
    1. Fetch data from scrapers
    2. Geocode addresses
    3. Match to parcels
    4. Store in JEDI RE database
    """
    
    def __init__(
        self,
        source_adapter: DataSourceAdapter,
        target_db_connection,
        batch_size: int = 100,
        enable_geocoding: bool = True
    ):
        self.source = source_adapter
        self.target_db = target_db_connection
        self.batch_size = batch_size
        self.enable_geocoding = enable_geocoding
        
        if enable_geocoding:
            self.geocoding_pipeline = GeocodingPipeline(target_db_connection)
        else:
            self.geocoding_pipeline = None
    
    def run_full_pipeline(
        self,
        city: Optional[str] = None,
        incremental: bool = True,
        limit: Optional[int] = None
    ) -> ETLStats:
        """
        Run complete ETL pipeline
        
        Args:
            city: Filter by city
            incremental: Only process data updated since last run
            limit: Maximum number of properties to process
        
        Returns:
            ETLStats with results
        """
        stats = ETLStats(start_time=datetime.now())
        
        try:
            logger.info(f"Starting ETL pipeline (source: {self.source.source_name})")
            
            # Connect to source
            if not self.source.connect():
                stats.errors.append("Failed to connect to data source")
                return stats
            
            # Determine incremental update cutoff
            updated_since = None
            if incremental:
                updated_since = self._get_last_sync_time()
                logger.info(f"Incremental mode: fetching updates since {updated_since}")
            
            # Step 1: Extract properties from source
            logger.info("Step 1: Extracting properties...")
            properties = list(self.source.fetch_properties(
                city=city,
                updated_since=updated_since,
                limit=limit
            ))
            stats.properties_fetched = len(properties)
            logger.info(f"Fetched {stats.properties_fetched} properties")
            
            if not properties:
                logger.info("No properties to process")
                return stats
            
            # Step 2: Geocode and match to parcels
            if self.enable_geocoding:
                logger.info("Step 2: Geocoding and matching to parcels...")
                geocoded = self._geocode_batch(properties, stats)
            else:
                logger.info("Step 2: Skipping geocoding (disabled)")
                geocoded = properties
            
            # Step 3: Load properties into target database
            logger.info("Step 3: Loading properties into database...")
            self._load_properties(geocoded, stats)
            
            # Step 4: Extract and load rent observations
            logger.info("Step 4: Loading rent observations...")
            self._load_rent_observations(properties, stats, updated_since)
            
            # Update last sync time
            self._update_last_sync_time()
            
            logger.info("ETL pipeline complete")
            
        except Exception as e:
            logger.error(f"ETL pipeline failed: {e}", exc_info=True)
            stats.errors.append(str(e))
        
        finally:
            self.source.disconnect()
            stats.end_time = datetime.now()
        
        # Log summary
        summary = stats.summary()
        logger.info(f"ETL Summary: {summary}")
        
        return stats
    
    def _geocode_batch(
        self,
        properties: List[PropertyData],
        stats: ETLStats
    ) -> List[Dict[str, Any]]:
        """
        Geocode batch of properties and match to parcels
        
        Returns:
            List of dicts with property data + geocoding results
        """
        geocoded_properties = []
        
        for i in range(0, len(properties), self.batch_size):
            batch = properties[i:i+self.batch_size]
            logger.info(f"Geocoding batch {i//self.batch_size + 1} ({i+1}-{min(i+self.batch_size, len(properties))} of {len(properties)})")
            
            for prop in batch:
                try:
                    # Skip if already has coordinates
                    if prop.latitude and prop.longitude:
                        result = GeocodingResult(
                            address=prop.address,
                            latitude=prop.latitude,
                            longitude=prop.longitude,
                            confidence=1.0,
                            source="source_data"
                        )
                        stats.properties_geocoded += 1
                        
                        # Still try to match to parcel
                        if self.geocoding_pipeline:
                            parcel_id = self.geocoding_pipeline.matcher.find_parcel_by_coordinates(
                                prop.latitude,
                                prop.longitude
                            )
                            if parcel_id:
                                result.matched_parcel_id = parcel_id
                                stats.properties_matched += 1
                    else:
                        # Geocode from address
                        result = self.geocoding_pipeline.geocode_and_match(
                            address=prop.address,
                            city=prop.city,
                            state=prop.state,
                            zip_code=prop.zip_code
                        )
                        
                        if result.latitude and result.longitude:
                            stats.properties_geocoded += 1
                        
                        if result.matched_parcel_id:
                            stats.properties_matched += 1
                    
                    # Combine property data with geocoding result
                    prop_dict = asdict(prop)
                    prop_dict['geocoding_result'] = result
                    geocoded_properties.append(prop_dict)
                
                except Exception as e:
                    logger.error(f"Failed to geocode {prop.address}: {e}")
                    stats.errors.append(f"Geocoding failed for {prop.address}: {str(e)}")
                    stats.properties_failed += 1
        
        return geocoded_properties
    
    def _load_properties(
        self,
        properties: List[Dict[str, Any]],
        stats: ETLStats
    ):
        """
        Load properties into target database
        Uses UPSERT (INSERT ... ON CONFLICT UPDATE)
        """
        cursor = self.target_db.cursor()
        
        upsert_query = """
            INSERT INTO properties (
                external_id, data_source, name, address, city, state, zip_code,
                latitude, longitude, location, parcel_id,
                total_units, year_built, stories, amenities,
                last_scraped_at, created_at, updated_at
            ) VALUES (
                %(external_id)s, %(data_source)s, %(name)s, %(address)s, %(city)s, %(state)s, %(zip_code)s,
                %(latitude)s, %(longitude)s,
                CASE WHEN %(latitude)s IS NOT NULL AND %(longitude)s IS NOT NULL
                    THEN ST_SetSRID(ST_MakePoint(%(longitude)s, %(latitude)s), 4326)
                    ELSE NULL
                END,
                %(parcel_id)s,
                %(total_units)s, %(year_built)s, %(stories)s, %(amenities)s,
                %(last_scraped_at)s, NOW(), NOW()
            )
            ON CONFLICT (data_source, external_id)
            DO UPDATE SET
                name = EXCLUDED.name,
                address = EXCLUDED.address,
                latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude,
                location = EXCLUDED.location,
                parcel_id = EXCLUDED.parcel_id,
                total_units = EXCLUDED.total_units,
                year_built = EXCLUDED.year_built,
                stories = EXCLUDED.stories,
                amenities = EXCLUDED.amenities,
                last_scraped_at = EXCLUDED.last_scraped_at,
                updated_at = NOW()
        """
        
        batch_data = []
        
        for prop_dict in properties:
            geocode_result = prop_dict.get('geocoding_result')
            
            # Prepare data for insert
            data = {
                'external_id': prop_dict['external_id'],
                'data_source': prop_dict['source'],
                'name': prop_dict['name'],
                'address': prop_dict['address'],
                'city': prop_dict['city'],
                'state': prop_dict['state'],
                'zip_code': prop_dict.get('zip_code'),
                'latitude': prop_dict.get('latitude') or (geocode_result.latitude if geocode_result else None),
                'longitude': prop_dict.get('longitude') or (geocode_result.longitude if geocode_result else None),
                'parcel_id': geocode_result.matched_parcel_id if geocode_result else None,
                'total_units': prop_dict.get('total_units'),
                'year_built': prop_dict.get('year_built'),
                'stories': prop_dict.get('stories'),
                'amenities': prop_dict.get('amenities'),
                'last_scraped_at': prop_dict.get('scraped_at')
            }
            
            batch_data.append(data)
        
        # Execute batch upsert
        try:
            execute_batch(cursor, upsert_query, batch_data, page_size=self.batch_size)
            self.target_db.commit()
            
            # Count inserts vs updates (approximate - would need RETURNING clause for exact)
            stats.properties_inserted += len(batch_data)  # Conservative estimate
            
            logger.info(f"Loaded {len(batch_data)} properties")
        
        except Exception as e:
            self.target_db.rollback()
            logger.error(f"Failed to load properties: {e}")
            stats.errors.append(f"Database insert failed: {str(e)}")
            stats.properties_failed += len(batch_data)
        
        finally:
            cursor.close()
    
    def _load_rent_observations(
        self,
        properties: List[PropertyData],
        stats: ETLStats,
        updated_since: Optional[datetime] = None
    ):
        """
        Load rent observations for properties
        """
        cursor = self.target_db.cursor()
        
        # First, get mapping of external_id → property_id
        external_ids = [p.external_id for p in properties if p.external_id]
        
        if not external_ids:
            logger.warning("No external IDs found, skipping rent observations")
            return
        
        cursor.execute("""
            SELECT external_id, property_id
            FROM properties
            WHERE data_source = %s
            AND external_id = ANY(%s)
        """, (self.source.source_name, external_ids))
        
        id_mapping = {row[0]: row[1] for row in cursor.fetchall()}
        
        # Fetch rent observations for each property
        insert_query = """
            INSERT INTO rent_observations (
                observed_at, property_id, unit_type,
                asking_rent, effective_rent, sqft,
                floor_plan_name, available_units, total_units,
                data_source, confidence_score
            ) VALUES (
                %(observed_at)s, %(property_id)s, %(unit_type)s,
                %(asking_rent)s, %(effective_rent)s, %(sqft)s,
                %(floor_plan_name)s, %(available_units)s, %(total_units)s,
                %(data_source)s, %(confidence)s
            )
            ON CONFLICT (observed_at, property_id, unit_type)
            DO UPDATE SET
                asking_rent = EXCLUDED.asking_rent,
                effective_rent = EXCLUDED.effective_rent,
                available_units = EXCLUDED.available_units
        """
        
        batch_data = []
        
        for prop in properties:
            if not prop.external_id or prop.external_id not in id_mapping:
                continue
            
            property_id = id_mapping[prop.external_id]
            
            try:
                # Fetch rent observations for this property
                for obs in self.source.fetch_rent_observations(
                    property_external_id=prop.external_id,
                    start_date=updated_since,
                    limit=1000  # Reasonable limit per property
                ):
                    data = {
                        'observed_at': obs.observed_at,
                        'property_id': property_id,
                        'unit_type': obs.unit_type,
                        'asking_rent': obs.asking_rent,
                        'effective_rent': obs.effective_rent,
                        'sqft': obs.sqft,
                        'floor_plan_name': obs.floor_plan_name,
                        'available_units': obs.available_units,
                        'total_units': obs.total_units,
                        'data_source': obs.source,
                        'confidence': obs.confidence
                    }
                    
                    batch_data.append(data)
                    stats.rents_fetched += 1
                    
                    # Execute batch when full
                    if len(batch_data) >= self.batch_size:
                        self._execute_rent_batch(cursor, insert_query, batch_data, stats)
                        batch_data = []
            
            except Exception as e:
                logger.error(f"Failed to fetch rents for property {prop.external_id}: {e}")
                stats.errors.append(f"Rent fetch failed for {prop.external_id}: {str(e)}")
        
        # Execute remaining batch
        if batch_data:
            self._execute_rent_batch(cursor, insert_query, batch_data, stats)
        
        cursor.close()
    
    def _execute_rent_batch(
        self,
        cursor,
        query: str,
        batch_data: List[Dict],
        stats: ETLStats
    ):
        """Execute batch insert of rent observations"""
        try:
            execute_batch(cursor, query, batch_data, page_size=self.batch_size)
            self.target_db.commit()
            stats.rents_inserted += len(batch_data)
            logger.info(f"Inserted {len(batch_data)} rent observations")
        
        except Exception as e:
            self.target_db.rollback()
            logger.error(f"Failed to insert rent observations: {e}")
            stats.errors.append(f"Rent insert failed: {str(e)}")
            stats.rents_failed += len(batch_data)
    
    def _get_last_sync_time(self) -> Optional[datetime]:
        """Get timestamp of last successful sync"""
        cursor = self.target_db.cursor()
        
        try:
            cursor.execute("""
                SELECT MAX(last_scraped_at)
                FROM properties
                WHERE data_source = %s
            """, (self.source.source_name,))
            
            result = cursor.fetchone()
            return result[0] if result and result[0] else None
        
        finally:
            cursor.close()
    
    def _update_last_sync_time(self):
        """Record successful sync completion"""
        # Could store in a metadata table, for now just log
        logger.info(f"Sync completed at {datetime.now()}")


# Convenience function for running ETL
def run_etl(
    source_adapter: DataSourceAdapter,
    target_db_connection_string: str,
    city: Optional[str] = None,
    incremental: bool = True,
    batch_size: int = 100,
    enable_geocoding: bool = True
) -> ETLStats:
    """
    Run ETL pipeline with automatic database connection
    
    Args:
        source_adapter: Configured data source adapter
        target_db_connection_string: PostgreSQL connection string
        city: Filter by city
        incremental: Only process new/updated data
        batch_size: Batch size for processing
        enable_geocoding: Enable geocoding pipeline
    
    Returns:
        ETLStats with results
    """
    conn = psycopg2.connect(target_db_connection_string)
    
    try:
        orchestrator = ETLOrchestrator(
            source_adapter=source_adapter,
            target_db_connection=conn,
            batch_size=batch_size,
            enable_geocoding=enable_geocoding
        )
        
        stats = orchestrator.run_full_pipeline(
            city=city,
            incremental=incremental
        )
        
        return stats
    
    finally:
        conn.close()


# Example usage
if __name__ == "__main__":
    import sys
    sys.path.append('/home/leon/clawd/jedi-re')
    
    from src.scrapers.oppgrid_adapter import create_oppgrid_adapter
    
    # Example: Run ETL from OppGrid database
    print("Running ETL pipeline...")
    
    # Create source adapter (customize for your setup)
    source = create_oppgrid_adapter(
        'database',
        host='localhost',
        database='oppgrid',
        user='postgres',
        password=''
    )
    
    # Run ETL
    stats = run_etl(
        source_adapter=source,
        target_db_connection_string="postgresql://postgres@localhost/jedire",
        city="Atlanta",
        incremental=True,
        enable_geocoding=True
    )
    
    # Print results
    print("\nETL Complete!")
    print(f"Duration: {stats.duration_seconds():.1f} seconds")
    print(f"Properties: {stats.properties_inserted} inserted, {stats.properties_failed} failed")
    print(f"Rents: {stats.rents_inserted} inserted, {stats.rents_failed} failed")
    
    if stats.errors:
        print(f"\nErrors ({len(stats.errors)}):")
        for error in stats.errors[:10]:  # Show first 10
            print(f"  - {error}")
