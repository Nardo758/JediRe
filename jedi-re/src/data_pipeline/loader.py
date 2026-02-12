"""
GIS data loader for shapefiles
"""
import logging
from typing import List, Dict, Any, Optional, Tuple, Iterator
import geopandas as gpd
from pathlib import Path
import pandas as pd
import numpy as np
from tqdm import tqdm
import warnings

from .config import config
from .validator import DataValidator

logger = logging.getLogger(__name__)


class GISDataLoader:
    """Load and process GIS shapefiles"""
    
    def __init__(self, data_dir: Optional[Path] = None):
        self.data_dir = data_dir or config.gis_data_dir
        self.validator = DataValidator()
    
    def find_shapefiles(self, pattern: str = "*.shp") -> List[Path]:
        """
        Find shapefiles in data directory
        
        Args:
            pattern: File pattern to search for
            
        Returns:
            List of shapefile paths
        """
        shapefiles = list(self.data_dir.glob(pattern))
        
        # Also look for GeoJSON files
        geojson_files = list(self.data_dir.glob("*.geojson"))
        
        all_files = shapefiles + geojson_files
        
        if not all_files:
            logger.warning(f"No shapefiles or GeoJSON files found in {self.data_dir}")
            return []
        
        logger.info(f"Found {len(all_files)} GIS files: {[f.name for f in all_files]}")
        return all_files
    
    def load_shapefile(self, file_path: Path, limit: Optional[int] = None) -> gpd.GeoDataFrame:
        """
        Load a shapefile or GeoJSON file
        
        Args:
            file_path: Path to shapefile or GeoJSON
            limit: Maximum number of records to load (for testing)
            
        Returns:
            GeoDataFrame with the data
        """
        try:
            logger.info(f"Loading GIS file: {file_path}")
            
            # Suppress warnings about missing CRS
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                
                if file_path.suffix.lower() in ['.shp', '.geojson', '.json']:
                    gdf = gpd.read_file(file_path)
                else:
                    raise ValueError(f"Unsupported file format: {file_path.suffix}")
            
            # Limit records if specified
            if limit and len(gdf) > limit:
                gdf = gdf.head(limit)
                logger.info(f"Limited to {limit} records for testing")
            
            # Check and set CRS
            if gdf.crs is None:
                logger.warning(f"No CRS found in {file_path}, assuming {config.source_crs}")
                gdf = gdf.set_crs(config.source_crs, allow_override=True)
            
            # Convert to target CRS if needed
            if str(gdf.crs) != config.target_crs:
                logger.info(f"Converting CRS from {gdf.crs} to {config.target_crs}")
                gdf = gdf.to_crs(config.target_crs)
            
            logger.info(f"Loaded {len(gdf)} records from {file_path}")
            logger.info(f"Columns: {list(gdf.columns)}")
            logger.info(f"CRS: {gdf.crs}")
            
            return gdf
        
        except Exception as e:
            logger.error(f"Failed to load {file_path}: {e}")
            raise
    
    def get_file_metadata(self, file_path: Path) -> Dict[str, Any]:
        """Get metadata about a GIS file"""
        try:
            gdf = gpd.read_file(file_path, rows=1)  # Just read first row for metadata
            return {
                "file_name": file_path.name,
                "file_size_mb": file_path.stat().st_size / (1024 * 1024),
                "record_count": self._estimate_record_count(file_path),
                "columns": list(gdf.columns),
                "crs": str(gdf.crs) if gdf.crs else None,
                "geometry_type": gdf.geometry.type.iloc[0] if not gdf.empty else None,
                "file_format": file_path.suffix.lower()
            }
        except Exception as e:
            logger.error(f"Failed to get metadata for {file_path}: {e}")
            return {}
    
    def _estimate_record_count(self, file_path: Path) -> int:
        """Estimate record count without loading entire file"""
        try:
            # For shapefiles, we can check the .dbf file
            if file_path.suffix.lower() == '.shp':
                dbf_file = file_path.with_suffix('.dbf')
                if dbf_file.exists():
                    import shapefile
                    sf = shapefile.Reader(str(dbf_file))
                    return len(sf)
            
            # For GeoJSON, we need to load it
            gdf = gpd.read_file(file_path)
            return len(gdf)
        except:
            return -1  # Unknown
    
    def batch_iterator(self, gdf: gpd.GeoDataFrame, batch_size: int = None) -> Iterator[List[Dict[str, Any]]]:
        """
        Iterate over GeoDataFrame in batches
        
        Args:
            gdf: GeoDataFrame to iterate over
            batch_size: Number of records per batch
            
        Yields:
            List of records (dictionaries) for each batch
        """
        batch_size = batch_size or config.batch_size
        
        total_records = len(gdf)
        num_batches = (total_records + batch_size - 1) // batch_size
        
        logger.info(f"Processing {total_records} records in {num_batches} batches of {batch_size}")
        
        for i in range(0, total_records, batch_size):
            batch_end = min(i + batch_size, total_records)
            batch_gdf = gdf.iloc[i:batch_end]
            
            # Convert to list of dictionaries
            batch_records = []
            for _, row in batch_gdf.iterrows():
                record = row.to_dict()
                
                # Handle geometry separately
                if 'geometry' in record:
                    record['geometry'] = row.geometry
                
                batch_records.append(record)
            
            yield batch_records
            
            logger.debug(f"Processed batch {i//batch_size + 1}/{num_batches}: records {i} to {batch_end-1}")
    
    def process_file(self, file_path: Path, 
                    limit: Optional[int] = None,
                    batch_size: Optional[int] = None) -> Dict[str, Any]:
        """
        Process a GIS file and return statistics
        
        Args:
            file_path: Path to GIS file
            limit: Maximum records to process
            batch_size: Batch size for processing
            
        Returns:
            Dictionary with processing statistics
        """
        stats = {
            "file_name": file_path.name,
            "total_records": 0,
            "processed_records": 0,
            "valid_records": 0,
            "invalid_records": 0,
            "batches_processed": 0,
            "errors": []
        }
        
        try:
            # Load the file
            gdf = self.load_shapefile(file_path, limit)
            stats["total_records"] = len(gdf)
            
            # Process in batches
            batch_size = batch_size or config.batch_size
            all_valid_records = []
            all_invalid_records = []
            
            with tqdm(total=len(gdf), desc=f"Processing {file_path.name}") as pbar:
                for batch_num, batch in enumerate(self.batch_iterator(gdf, batch_size)):
                    # Clean and validate batch
                    cleaned_batch = [self.validator.clean_record(record) for record in batch]
                    valid_records, invalid_records = self.validator.validate_batch(cleaned_batch)
                    
                    # Transform to database schema
                    transformed_records = [self.validator.transform_to_database_schema(record) 
                                         for record in valid_records]
                    
                    all_valid_records.extend(transformed_records)
                    all_invalid_records.extend(invalid_records)
                    
                    stats["batches_processed"] += 1
                    stats["valid_records"] += len(transformed_records)
                    stats["invalid_records"] += len(invalid_records)
                    
                    pbar.update(len(batch))
            
            stats["processed_records"] = stats["valid_records"] + stats["invalid_records"]
            
            # Generate validation summary
            validation_summary = self.validator.get_validation_summary(
                stats["total_records"],
                stats["valid_records"],
                all_invalid_records
            )
            
            stats["validation_summary"] = validation_summary
            
            logger.info(f"Processed {file_path.name}: {stats['valid_records']} valid, "
                       f"{stats['invalid_records']} invalid records")
            
            return {
                "stats": stats,
                "valid_records": all_valid_records,
                "invalid_records": all_invalid_records
            }
            
        except Exception as e:
            logger.error(f"Failed to process {file_path}: {e}")
            stats["errors"].append(str(e))
            return {"stats": stats, "valid_records": [], "invalid_records": []}
    
    def save_processed_data(self, valid_records: List[Dict[str, Any]], 
                          output_file: Optional[Path] = None) -> Path:
        """
        Save processed data to file
        
        Args:
            valid_records: List of validated records
            output_file: Output file path (optional)
            
        Returns:
            Path to saved file
        """
        if output_file is None:
            timestamp = pd.Timestamp.now().strftime("%Y%m%d_%H%M%S")
            output_file = config.processed_dir / f"parcels_processed_{timestamp}.parquet"
        
        # Convert to DataFrame
        df = pd.DataFrame(valid_records)
        
        # Save to Parquet (efficient for large datasets)
        df.to_parquet(output_file, index=False)
        
        logger.info(f"Saved {len(valid_records)} records to {output_file}")
        return output_file
    
    def load_processed_data(self, file_path: Path) -> pd.DataFrame:
        """Load processed data from file"""
        df = pd.read_parquet(file_path)
        logger.info(f"Loaded {len(df)} records from {file_path}")
        return df