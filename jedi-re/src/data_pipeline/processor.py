"""
Main processor for GIS data pipeline
"""
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
import json
from datetime import datetime
import pandas as pd

from .config import config
from .database import db_manager
from .loader import GISDataLoader
from .validator import DataValidator
from .capacity_analyzer import CapacityAnalyzer

logger = logging.getLogger(__name__)


class GISDataProcessor:
    """Main processor for GIS data pipeline"""
    
    def __init__(self):
        self.loader = GISDataLoader()
        self.validator = DataValidator()
        self.capacity_analyzer = CapacityAnalyzer()
        self.setup_logging()
    
    def setup_logging(self):
        """Setup logging configuration"""
        log_file = config.logs_dir / f"gis_pipeline_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        
        # Create file handler
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(logging.INFO)
        file_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        file_handler.setFormatter(file_formatter)
        
        # Add handler to root logger
        logging.getLogger().addHandler(file_handler)
        
        logger.info(f"Logging to {log_file}")
    
    def process_all_files(self, pattern: str = "*.shp", 
                         limit: Optional[int] = None,
                         batch_size: Optional[int] = None) -> Dict[str, Any]:
        """
        Process all GIS files matching pattern
        
        Args:
            pattern: File pattern to match
            limit: Maximum records per file (for testing)
            batch_size: Batch size for processing
            
        Returns:
            Dictionary with overall processing statistics
        """
        overall_stats = {
            "start_time": datetime.now().isoformat(),
            "total_files": 0,
            "processed_files": 0,
            "failed_files": 0,
            "total_records": 0,
            "valid_records": 0,
            "invalid_records": 0,
            "files": []
        }
        
        # Find files
        files = self.loader.find_shapefiles(pattern)
        overall_stats["total_files"] = len(files)
        
        if not files:
            logger.warning("No files found to process")
            return overall_stats
        
        logger.info(f"Found {len(files)} files to process")
        
        all_valid_records = []
        all_invalid_records = []
        
        for file_path in files:
            logger.info(f"Processing file: {file_path.name}")
            
            try:
                # Process file
                result = self.loader.process_file(file_path, limit, batch_size)
                stats = result["stats"]
                
                overall_stats["files"].append({
                    "file_name": file_path.name,
                    "stats": stats
                })
                
                all_valid_records.extend(result["valid_records"])
                all_invalid_records.extend(result["invalid_records"])
                
                overall_stats["total_records"] += stats["total_records"]
                overall_stats["valid_records"] += stats["valid_records"]
                overall_stats["invalid_records"] += stats["invalid_records"]
                overall_stats["processed_files"] += 1
                
                logger.info(f"Completed {file_path.name}: {stats['valid_records']} valid records")
                
            except Exception as e:
                logger.error(f"Failed to process {file_path.name}: {e}")
                overall_stats["failed_files"] += 1
                overall_stats["files"].append({
                    "file_name": file_path.name,
                    "error": str(e)
                })
        
        # Save processed data
        if all_valid_records:
            output_file = self.loader.save_processed_data(all_valid_records)
            overall_stats["output_file"] = str(output_file)
        
        # Save invalid records for review
        if all_invalid_records:
            invalid_file = config.processed_dir / f"invalid_records_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(invalid_file, 'w') as f:
                json.dump(all_invalid_records, f, indent=2, default=str)
            overall_stats["invalid_records_file"] = str(invalid_file)
        
        overall_stats["end_time"] = datetime.now().isoformat()
        overall_stats["duration_seconds"] = (
            datetime.fromisoformat(overall_stats["end_time"]) - 
            datetime.fromisoformat(overall_stats["start_time"])
        ).total_seconds()
        
        # Save overall statistics
        stats_file = config.processed_dir / f"processing_stats_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(stats_file, 'w') as f:
            json.dump(overall_stats, f, indent=2, default=str)
        
        logger.info(f"Processing complete. Summary: {overall_stats}")
        
        return overall_stats
    
    def load_to_database(self, valid_records: List[Dict[str, Any]], 
                        truncate: bool = False) -> Dict[str, Any]:
        """
        Load validated records into database
        
        Args:
            valid_records: List of validated records
            truncate: Whether to truncate table before loading
            
        Returns:
            Dictionary with loading statistics
        """
        stats = {
            "start_time": datetime.now().isoformat(),
            "total_records": len(valid_records),
            "loaded_records": 0,
            "failed_records": 0,
            "errors": []
        }
        
        if not valid_records:
            logger.warning("No records to load")
            return stats
        
        try:
            # Ensure table exists
            db_manager.create_parcels_table_if_not_exists()
            
            # Truncate table if requested
            if truncate:
                db_manager.truncate_table("parcels")
                logger.info("Truncated parcels table")
            
            # Batch insert records
            batch_size = config.batch_size
            num_batches = (len(valid_records) + batch_size - 1) // batch_size
            
            logger.info(f"Loading {len(valid_records)} records in {num_batches} batches")
            
            for i in range(0, len(valid_records), batch_size):
                batch = valid_records[i:i + batch_size]
                batch_num = i // batch_size + 1
                
                try:
                    rows_inserted = db_manager.batch_insert("parcels", batch)
                    stats["loaded_records"] += rows_inserted
                    logger.info(f"Batch {batch_num}/{num_batches}: Inserted {rows_inserted} records")
                    
                except Exception as e:
                    logger.error(f"Failed to insert batch {batch_num}: {e}")
                    stats["failed_records"] += len(batch)
                    stats["errors"].append({
                        "batch": batch_num,
                        "error": str(e)
                    })
            
            # Verify load
            table_count = db_manager.get_table_row_count("parcels")
            stats["table_count_after_load"] = table_count
            
            logger.info(f"Database load complete: {stats['loaded_records']} records loaded")
            
        except Exception as e:
            logger.error(f"Database load failed: {e}")
            stats["errors"].append(str(e))
        
        stats["end_time"] = datetime.now().isoformat()
        
        return stats
    
    def run_capacity_analysis(self, parcel_ids: Optional[List[int]] = None) -> Dict[str, Any]:
        """
        Run capacity analysis on parcels
        
        Args:
            parcel_ids: List of parcel IDs to analyze (None for all)
            
        Returns:
            Dictionary with analysis results
        """
        stats = {
            "start_time": datetime.now().isoformat(),
            "parcels_analyzed": 0,
            "capacity_results": [],
            "errors": []
        }
        
        try:
            # Get parcels to analyze
            if parcel_ids:
                query = "SELECT * FROM parcels WHERE parcel_id IN %s"
                params = (tuple(parcel_ids),)
            else:
                query = "SELECT * FROM parcels"
                params = None
            
            parcels = db_manager.execute_query(query, params)
            stats["total_parcels"] = len(parcels)
            
            logger.info(f"Running capacity analysis on {len(parcels)} parcels")
            
            # Analyze each parcel
            for parcel in parcels:
                try:
                    result = self.capacity_analyzer.analyze_parcel(parcel)
                    stats["capacity_results"].append(result)
                    stats["parcels_analyzed"] += 1
                    
                    # Save to database
                    self._save_capacity_result(result)
                    
                except Exception as e:
                    logger.error(f"Failed to analyze parcel {parcel.get('parcel_id')}: {e}")
                    stats["errors"].append({
                        "parcel_id": parcel.get("parcel_id"),
                        "error": str(e)
                    })
            
            logger.info(f"Capacity analysis complete: {stats['parcels_analyzed']} parcels analyzed")
            
        except Exception as e:
            logger.error(f"Capacity analysis failed: {e}")
            stats["errors"].append(str(e))
        
        stats["end_time"] = datetime.now().isoformat()
        
        # Save analysis results
        results_file = config.processed_dir / f"capacity_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(results_file, 'w') as f:
            json.dump(stats, f, indent=2, default=str)
        
        return stats
    
    def _save_capacity_result(self, result: Dict[str, Any]):
        """Save capacity analysis result to database"""
        try:
            # Check if development_capacity table exists
            if not db_manager.check_table_exists("development_capacity"):
                self._create_capacity_tables()
            
            # Insert result
            insert_sql = """
            INSERT INTO development_capacity (
                parcel_id, maximum_buildable_units, development_potential,
                confidence_score, analysis_date, analysis_version,
                buildable_sqft, estimated_construction_cost, estimated_land_value,
                limiting_factors, opportunities, notes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            params = (
                result["parcel_id"],
                result["maximum_buildable_units"],
                result["development_potential"],
                result["confidence_score"],
                result["analysis_date"],
                result["analysis_version"],
                result.get("buildable_sqft"),
                result.get("estimated_construction_cost"),
                result.get("estimated_land_value"),
                result.get("limiting_factors", []),
                result.get("opportunities", []),
                result.get("notes")
            )
            
            db_manager.execute_update(insert_sql, params)
            
        except Exception as e:
            logger.error(f"Failed to save capacity result: {e}")
            raise
    
    def _create_capacity_tables(self):
        """Create capacity analysis tables if they don't exist"""
        # Check if tables exist in database schema
        schema_file = Path("/home/leon/clawd/jedi-re/src/database_schema.sql")
        if schema_file.exists():
            # The tables should already exist from the main schema
            logger.info("Capacity tables should exist from main schema")
        else:
            logger.warning("Database schema file not found, capacity tables may not exist")
    
    def run_full_pipeline(self, pattern: str = "*.shp", 
                         limit: Optional[int] = None,
                         run_analysis: bool = True) -> Dict[str, Any]:
        """
        Run full pipeline: load, validate, insert, analyze
        
        Args:
            pattern: File pattern to match
            limit: Maximum records per file (for testing)
            run_analysis: Whether to run capacity analysis
            
        Returns:
            Dictionary with pipeline results
        """
        pipeline_stats = {
            "pipeline_start": datetime.now().isoformat(),
            "steps": []
        }
        
        logger.info("Starting full GIS data pipeline")
        
        # Step 1: Process files
        logger.info("Step 1: Processing GIS files")
        processing_result = self.process_all_files(pattern, limit)
        pipeline_stats["steps"].append({
            "step": "file_processing",
            "result": processing_result
        })
        
        if processing_result.get("valid_records", 0) == 0:
            logger.error("No valid records found, stopping pipeline")
            return pipeline_stats
        
        # Step 2: Load to database
        logger.info("Step 2: Loading to database")
        
        # Load processed data if available
        if "output_file" in processing_result:
            output_file = Path(processing_result["output_file"])
            valid_records_df = self.loader.load_processed_data(output_file)
            valid_records = valid_records_df.to_dict('records')
        else:
            # Fallback: would need to reprocess
            logger.error("No output file found from processing step")
            return pipeline_stats
        
        load_result = self.load_to_database(valid_records, truncate=True)
        pipeline_stats["steps"].append({
            "step": "database_load",
            "result": load_result
        })
        
        # Step 3: Run capacity analysis
        if run_analysis and load_result.get("loaded_records", 0) > 0:
            logger.info("Step 3: Running capacity analysis")
            analysis_result = self.run_capacity_analysis()
            pipeline_stats["steps"].append({
                "step": "capacity_analysis",
                "result": analysis_result
            })
        
        pipeline_stats["pipeline_end"] = datetime.now().isoformat()
        
        # Save pipeline results
        results_file = config.processed_dir / f"pipeline_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(results_file, 'w') as f:
            json.dump(pipeline_stats, f, indent=2, default=str)
        
        logger.info(f"Full pipeline complete. Results saved to {results_file}")
        
        return pipeline_stats