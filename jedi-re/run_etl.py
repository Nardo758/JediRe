#!/usr/bin/env python3
"""
JEDI RE - ETL Pipeline Runner
Command-line tool for running Phase 2 data imports

Usage:
    python run_etl.py --source oppgrid --city Atlanta --incremental
    python run_etl.py --source file --file data/apartments.csv --no-geocoding
    python run_etl.py --help
"""

import argparse
import sys
import os
import logging
from pathlib import Path
from datetime import datetime

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from scrapers.oppgrid_adapter import create_oppgrid_adapter
from scrapers.adapter_base import FileAdapter
from scrapers.etl_orchestrator import run_etl, ETLStats


def setup_logging(verbose: bool = False):
    """Configure logging"""
    level = logging.DEBUG if verbose else logging.INFO
    
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(f'logs/etl_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')
        ]
    )


def create_adapter(args):
    """Create appropriate adapter based on arguments"""
    
    if args.source == 'oppgrid':
        # OppGrid adapter
        if args.oppgrid_type == 'database':
            return create_oppgrid_adapter(
                'database',
                host=args.oppgrid_host,
                port=args.oppgrid_port,
                database=args.oppgrid_db,
                user=args.oppgrid_user,
                password=args.oppgrid_password
            )
        elif args.oppgrid_type == 'api':
            return create_oppgrid_adapter(
                'api',
                base_url=args.oppgrid_url,
                api_key=args.oppgrid_api_key
            )
        else:
            raise ValueError(f"Unknown OppGrid type: {args.oppgrid_type}")
    
    elif args.source == 'file':
        # File adapter
        if not args.file:
            raise ValueError("--file required for file source")
        
        return FileAdapter(
            source_name=f"file-{Path(args.file).stem}",
            file_path=args.file
        )
    
    else:
        raise ValueError(f"Unknown source: {args.source}")


def print_stats(stats: ETLStats):
    """Print formatted statistics"""
    print("\n" + "="*80)
    print("ETL PIPELINE RESULTS")
    print("="*80)
    
    print(f"\nDuration: {stats.duration_seconds():.1f} seconds")
    
    print(f"\nPROPERTIES:")
    print(f"  Fetched:   {stats.properties_fetched:,}")
    print(f"  Geocoded:  {stats.properties_geocoded:,}")
    print(f"  Matched:   {stats.properties_matched:,}")
    print(f"  Inserted:  {stats.properties_inserted:,}")
    print(f"  Updated:   {stats.properties_updated:,}")
    print(f"  Failed:    {stats.properties_failed:,}")
    
    print(f"\nRENT OBSERVATIONS:")
    print(f"  Fetched:   {stats.rents_fetched:,}")
    print(f"  Inserted:  {stats.rents_inserted:,}")
    print(f"  Failed:    {stats.rents_failed:,}")
    
    if stats.errors:
        print(f"\nERRORS ({len(stats.errors)}):")
        for i, error in enumerate(stats.errors[:20], 1):  # Show first 20
            print(f"  {i}. {error}")
        if len(stats.errors) > 20:
            print(f"  ... and {len(stats.errors) - 20} more")
    else:
        print(f"\nNo errors ✓")
    
    # Success rate
    if stats.properties_fetched > 0:
        success_rate = (stats.properties_inserted / stats.properties_fetched) * 100
        print(f"\nSuccess rate: {success_rate:.1f}%")
    
    print("\n" + "="*80)


def main():
    parser = argparse.ArgumentParser(
        description="JEDI RE ETL Pipeline Runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run from OppGrid database
  python run_etl.py --source oppgrid --oppgrid-type database \\
      --oppgrid-host localhost --oppgrid-db oppgrid \\
      --city Atlanta --incremental

  # Run from OppGrid API
  python run_etl.py --source oppgrid --oppgrid-type api \\
      --oppgrid-url https://api.oppgrid.com \\
      --oppgrid-api-key YOUR_KEY --city Atlanta

  # Import from CSV file
  python run_etl.py --source file --file data/apartments.csv \\
      --no-geocoding --city Atlanta

  # Full refresh (not incremental)
  python run_etl.py --source oppgrid --no-incremental --limit 1000
        """
    )
    
    # Source selection
    parser.add_argument(
        '--source',
        choices=['oppgrid', 'file'],
        required=True,
        help='Data source type'
    )
    
    # OppGrid options
    oppgrid_group = parser.add_argument_group('OppGrid options')
    oppgrid_group.add_argument(
        '--oppgrid-type',
        choices=['database', 'api'],
        default='database',
        help='OppGrid connection type'
    )
    oppgrid_group.add_argument('--oppgrid-host', default='localhost', help='Database host')
    oppgrid_group.add_argument('--oppgrid-port', type=int, default=5432, help='Database port')
    oppgrid_group.add_argument('--oppgrid-db', default='oppgrid', help='Database name')
    oppgrid_group.add_argument('--oppgrid-user', default='postgres', help='Database user')
    oppgrid_group.add_argument('--oppgrid-password', default='', help='Database password')
    oppgrid_group.add_argument('--oppgrid-url', help='API base URL')
    oppgrid_group.add_argument('--oppgrid-api-key', help='API key')
    
    # File options
    file_group = parser.add_argument_group('File import options')
    file_group.add_argument('--file', help='Path to CSV/JSON/Parquet file')
    
    # Target database
    target_group = parser.add_argument_group('Target database options')
    target_group.add_argument('--target-host', default='localhost', help='Target DB host')
    target_group.add_argument('--target-port', type=int, default=5432, help='Target DB port')
    target_group.add_argument('--target-db', default='jedire', help='Target DB name')
    target_group.add_argument('--target-user', default='postgres', help='Target DB user')
    target_group.add_argument('--target-password', default='', help='Target DB password')
    
    # ETL options
    etl_group = parser.add_argument_group('ETL options')
    etl_group.add_argument('--city', help='Filter by city (e.g., Atlanta)')
    etl_group.add_argument('--incremental', dest='incremental', action='store_true', default=True,
                          help='Only process new/updated data (default)')
    etl_group.add_argument('--no-incremental', dest='incremental', action='store_false',
                          help='Full refresh (process all data)')
    etl_group.add_argument('--limit', type=int, help='Max properties to process')
    etl_group.add_argument('--batch-size', type=int, default=100, help='Batch size')
    etl_group.add_argument('--geocoding', dest='geocoding', action='store_true', default=True,
                          help='Enable geocoding (default)')
    etl_group.add_argument('--no-geocoding', dest='geocoding', action='store_false',
                          help='Disable geocoding')
    
    # Logging
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose logging')
    parser.add_argument('--dry-run', action='store_true', help='Test without writing to database')
    
    args = parser.parse_args()
    
    # Setup
    os.makedirs('logs', exist_ok=True)
    setup_logging(args.verbose)
    logger = logging.getLogger(__name__)
    
    logger.info("JEDI RE ETL Pipeline")
    logger.info(f"Source: {args.source}")
    logger.info(f"Target: {args.target_db} @ {args.target_host}")
    logger.info(f"City filter: {args.city or 'None'}")
    logger.info(f"Incremental: {args.incremental}")
    logger.info(f"Geocoding: {args.geocoding}")
    
    if args.dry_run:
        logger.warning("DRY RUN MODE - No data will be written")
    
    try:
        # Create source adapter
        logger.info("Creating source adapter...")
        source_adapter = create_adapter(args)
        
        # Build target connection string
        target_conn_string = (
            f"postgresql://{args.target_user}"
            f"{':' + args.target_password if args.target_password else ''}"
            f"@{args.target_host}:{args.target_port}/{args.target_db}"
        )
        
        # Run ETL
        logger.info("Starting ETL pipeline...")
        stats = run_etl(
            source_adapter=source_adapter,
            target_db_connection_string=target_conn_string,
            city=args.city,
            incremental=args.incremental,
            batch_size=args.batch_size,
            enable_geocoding=args.geocoding
        )
        
        # Print results
        print_stats(stats)
        
        # Exit code based on results
        if stats.properties_failed > 0 or stats.rents_failed > 0:
            logger.warning("ETL completed with errors")
            sys.exit(1)
        else:
            logger.info("ETL completed successfully")
            sys.exit(0)
    
    except Exception as e:
        logger.error(f"ETL failed: {e}", exc_info=True)
        print(f"\nERROR: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
