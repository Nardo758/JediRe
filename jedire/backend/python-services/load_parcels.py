#!/usr/bin/env python3
"""
JEDI RE - Fulton County Parcel Data Loader
Main script for loading GIS data into PostgreSQL database

Usage:
    python load_parcels.py --help
    python load_parcels.py process --pattern "*.geojson" --limit 1000
    python load_parcels.py load --file processed_data.parquet
    python load_parcels.py analyze --parcel-ids 1,2,3,4,5
    python load_parcels.py pipeline --pattern "*.geojson" --limit 1000
"""

import argparse
import logging
import sys
from pathlib import Path
import json

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from data_pipeline.processor import GISDataProcessor
from data_pipeline.loader import GISDataLoader
from data_pipeline.database import db_manager
from data_pipeline.capacity_analyzer import CapacityAnalyzer


def setup_logging(verbose: bool = False):
    """Setup logging configuration"""
    log_level = logging.DEBUG if verbose else logging.INFO
    
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
        ]
    )


def process_command(args):
    """Process GIS files"""
    processor = GISDataProcessor()
    
    result = processor.process_all_files(
        pattern=args.pattern,
        limit=args.limit,
        batch_size=args.batch_size
    )
    
    print("\n" + "="*60)
    print("PROCESSING RESULTS")
    print("="*60)
    print(f"Total files: {result['total_files']}")
    print(f"Processed files: {result['processed_files']}")
    print(f"Failed files: {result['failed_files']}")
    print(f"Total records: {result['total_records']}")
    print(f"Valid records: {result['valid_records']}")
    print(f"Invalid records: {result['invalid_records']}")
    
    if 'output_file' in result:
        print(f"\nOutput file: {result['output_file']}")
    
    if result['valid_records'] > 0:
        validation_rate = result['valid_records'] / result['total_records']
        print(f"Validation rate: {validation_rate:.2%}")
    
    return result


def load_command(args):
    """Load processed data to database"""
    from data_pipeline.loader import GISDataLoader
    import pandas as pd
    
    loader = GISDataLoader()
    processor = GISDataProcessor()
    
    # Load processed data
    if args.file:
        file_path = Path(args.file)
        if not file_path.exists():
            print(f"Error: File not found: {file_path}")
            return
        
        print(f"Loading data from {file_path}")
        df = loader.load_processed_data(file_path)
        valid_records = df.to_dict('records')
    else:
        print("Error: No file specified. Use --file to specify processed data file.")
        return
    
    print(f"Loaded {len(valid_records)} records")
    
    # Load to database
    result = processor.load_to_database(valid_records, truncate=args.truncate)
    
    print("\n" + "="*60)
    print("DATABASE LOAD RESULTS")
    print("="*60)
    print(f"Total records: {result['total_records']}")
    print(f"Loaded records: {result['loaded_records']}")
    print(f"Failed records: {result['failed_records']}")
    
    if result.get('table_count_after_load'):
        print(f"Table count after load: {result['table_count_after_load']}")
    
    return result


def analyze_command(args):
    """Run capacity analysis"""
    processor = GISDataProcessor()
    
    # Parse parcel IDs if provided
    parcel_ids = None
    if args.parcel_ids:
        try:
            parcel_ids = [int(id.strip()) for id in args.parcel_ids.split(",")]
            print(f"Analyzing {len(parcel_ids)} specific parcels")
        except ValueError:
            print("Error: Invalid parcel IDs format. Use comma-separated integers.")
            return
    
    # Run analysis
    result = processor.run_capacity_analysis(parcel_ids)
    
    print("\n" + "="*60)
    print("CAPACITY ANALYSIS RESULTS")
    print("="*60)
    print(f"Total parcels: {result.get('total_parcels', 0)}")
    print(f"Parcels analyzed: {result['parcels_analyzed']}")
    
    if result['parcels_analyzed'] > 0:
        # Calculate summary
        potentials = {}
        total_units = 0
        
        for analysis in result.get('capacity_results', []):
            potential = analysis.get('development_potential', 'UNKNOWN')
            potentials[potential] = potentials.get(potential, 0) + 1
            total_units += analysis.get('maximum_buildable_units', 0)
        
        print(f"\nDevelopment Potential Summary:")
        for potential, count in sorted(potentials.items()):
            print(f"  {potential}: {count} parcels")
        
        print(f"\nTotal buildable units: {total_units:,}")
    
    return result


def pipeline_command(args):
    """Run full pipeline"""
    processor = GISDataProcessor()
    
    print("Starting full GIS data pipeline...")
    print("="*60)
    
    result = processor.run_full_pipeline(
        pattern=args.pattern,
        limit=args.limit,
        run_analysis=not args.skip_analysis
    )
    
    print("\n" + "="*60)
    print("PIPELINE COMPLETE")
    print("="*60)
    
    for step in result.get('steps', []):
        step_name = step['step'].replace('_', ' ').title()
        step_result = step['result']
        
        print(f"\n{step_name}:")
        
        if step['step'] == 'file_processing':
            print(f"  Valid records: {step_result.get('valid_records', 0):,}")
            print(f"  Invalid records: {step_result.get('invalid_records', 0):,}")
        
        elif step['step'] == 'database_load':
            print(f"  Loaded records: {step_result.get('loaded_records', 0):,}")
            print(f"  Failed records: {step_result.get('failed_records', 0):,}")
        
        elif step['step'] == 'capacity_analysis':
            print(f"  Parcels analyzed: {step_result.get('parcels_analyzed', 0):,}")
    
    return result


def test_command(args):
    """Test database connection and configuration"""
    print("Testing GIS Data Pipeline Configuration")
    print("="*60)
    
    # Test database connection
    print("\n1. Testing database connection...")
    try:
        with db_manager.get_connection() as conn:
            print("  ✓ Database connection successful")
            
            # Check if parcels table exists
            if db_manager.check_table_exists("parcels"):
                count = db_manager.get_table_row_count("parcels")
                print(f"  ✓ Parcels table exists with {count} rows")
            else:
                print("  ⚠ Parcels table does not exist")
    
    except Exception as e:
        print(f"  ✗ Database connection failed: {e}")
    
    # Test GIS data directory
    print("\n2. Testing GIS data directory...")
    from data_pipeline.config import config
    
    if config.gis_data_dir.exists():
        files = list(config.gis_data_dir.glob("*.*"))
        print(f"  ✓ GIS data directory exists: {config.gis_data_dir}")
        print(f"  ✓ Found {len(files)} files")
        
        # List GIS files
        gis_files = [f for f in files if f.suffix.lower() in ['.shp', '.geojson', '.json']]
        if gis_files:
            print("  ✓ Found GIS files:")
            for f in gis_files[:5]:  # Show first 5
                print(f"    - {f.name}")
            if len(gis_files) > 5:
                print(f"    ... and {len(gis_files) - 5} more")
        else:
            print("  ⚠ No GIS files found (looking for .shp, .geojson, .json)")
    else:
        print(f"  ✗ GIS data directory not found: {config.gis_data_dir}")
    
    # Test processed directory
    print("\n3. Testing processed data directory...")
    if config.processed_dir.exists():
        print(f"  ✓ Processed data directory exists: {config.processed_dir}")
    else:
        print(f"  ⚠ Processed data directory not found, will be created")
    
    # Test logs directory
    print("\n4. Testing logs directory...")
    if config.logs_dir.exists():
        print(f"  ✓ Logs directory exists: {config.logs_dir}")
    else:
        print(f"  ⚠ Logs directory not found, will be created")
    
    # Test Python dependencies
    print("\n5. Testing Python dependencies...")
    dependencies = [
        ("geopandas", "GIS data processing"),
        ("psycopg2", "PostgreSQL database"),
        ("pandas", "Data manipulation"),
        ("numpy", "Numerical computations"),
    ]
    
    all_ok = True
    for package, purpose in dependencies:
        try:
            __import__(package.replace("-", "_"))
            print(f"  ✓ {package:15} ({purpose})")
        except ImportError:
            print(f"  ✗ {package:15} ({purpose}) - NOT INSTALLED")
            all_ok = False
    
    if not all_ok:
        print("\n⚠ Some dependencies are missing. Install with:")
        print("  pip install geopandas psycopg2-binary pandas numpy")
    
    print("\n" + "="*60)
    print("TEST COMPLETE")
    
    return True


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="JEDI RE - Fulton County Parcel Data Loader",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s test                         # Test configuration
  %(prog)s process --pattern "*.geojson" --limit 1000
  %(prog)s load --file processed_data.parquet --truncate
  %(prog)s analyze --parcel-ids "1,2,3,4,5"
  %(prog)s pipeline --pattern "*.geojson" --limit 1000
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    # Process command
    process_parser = subparsers.add_parser('process', help='Process GIS files')
    process_parser.add_argument('--pattern', default="*.geojson", 
                               help='File pattern to match (default: *.geojson)')
    process_parser.add_argument('--limit', type=int, 
                               help='Limit records per file (for testing)')
    process_parser.add_argument('--batch-size', type=int, default=1000,
                               help='Batch size for processing (default: 1000)')
    
    # Load command
    load_parser = subparsers.add_parser('load', help='Load processed data to database')
    load_parser.add_argument('--file', required=True,
                            help='Processed data file (Parquet format)')
    load_parser.add_argument('--truncate', action='store_true',
                            help='Truncate table before loading')
    
    # Analyze command
    analyze_parser = subparsers.add_parser('analyze', help='Run capacity analysis')
    analyze_parser.add_argument('--parcel-ids',
                               help='Comma-separated list of parcel IDs to analyze')
    
    # Pipeline command
    pipeline_parser = subparsers.add_parser('pipeline', help='Run full pipeline')
    pipeline_parser.add_argument('--pattern', default="*.geojson",
                                help='File pattern to match (default: *.geojson)')
    pipeline_parser.add_argument('--limit', type=int,
                                help='Limit records per file (for testing)')
    pipeline_parser.add_argument('--skip-analysis', action='store_true',
                                help='Skip capacity analysis step')
    
    # Test command
    subparsers.add_parser('test', help='Test configuration and dependencies')
    
    # Common arguments
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Enable verbose logging')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # Setup logging
    setup_logging(args.verbose)
    
    # Execute command
    try:
        if args.command == 'process':
            process_command(args)
        elif args.command == 'load':
            load_command(args)
        elif args.command == 'analyze':
            analyze_command(args)
        elif args.command == 'pipeline':
            pipeline_command(args)
        elif args.command == 'test':
            test_command(args)
    
    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nError: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()