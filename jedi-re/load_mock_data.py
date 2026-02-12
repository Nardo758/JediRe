#!/usr/bin/env python3
"""
Load Mock Data into JEDI RE Database
Use this to test Phase 2 engines while waiting for real data sources

Usage:
    python load_mock_data.py --generate  # Generate fresh mock data
    python load_mock_data.py --load      # Load existing mock data
    python load_mock_data.py --all       # Generate and load
"""

import argparse
import sys
import json
import os
from pathlib import Path
from datetime import datetime

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from mock_data.generator import MockDataGenerator
import psycopg2
from psycopg2.extras import execute_batch


def connect_db():
    """Connect to database"""
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        database=os.getenv("DB_NAME", "jedire"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "")
    )


def load_submarkets(conn):
    """Load submarket definitions"""
    cursor = conn.cursor()
    
    submarkets = [
        ("Buckhead", "Atlanta", "GA"),
        ("Midtown", "Atlanta", "GA"),
        ("Downtown", "Atlanta", "GA"),
        ("Brookhaven", "Atlanta", "GA"),
        ("Sandy Springs", "Atlanta", "GA")
    ]
    
    query = """
        INSERT INTO submarkets (name, city, state)
        VALUES (%s, %s, %s)
        ON CONFLICT (name) DO NOTHING
    """
    
    cursor.executemany(query, submarkets)
    conn.commit()
    cursor.close()
    
    print(f"✓ Loaded {len(submarkets)} submarkets")


def load_properties(conn, properties_file: str):
    """Load mock properties"""
    with open(properties_file) as f:
        properties = json.load(f)
    
    cursor = conn.cursor()
    
    # Get submarket IDs
    cursor.execute("SELECT submarket_id, name FROM submarkets")
    submarket_map = {name: id for id, name in cursor.fetchall()}
    
    # Prepare data
    insert_query = """
        INSERT INTO properties (
            external_id, data_source, name, address, city, state, zip_code,
            latitude, longitude, location, submarket_id,
            total_units, year_built, stories,
            created_at, updated_at
        ) VALUES (
            %(external_id)s, 'mock', %(name)s, %(address)s, %(city)s, %(state)s, %(zip_code)s,
            %(latitude)s, %(longitude)s,
            ST_SetSRID(ST_MakePoint(%(longitude)s, %(latitude)s), 4326),
            %(submarket_id)s,
            %(total_units)s, %(year_built)s, %(stories)s,
            NOW(), NOW()
        )
        ON CONFLICT (data_source, external_id) DO UPDATE SET
            name = EXCLUDED.name,
            total_units = EXCLUDED.total_units,
            updated_at = NOW()
    """
    
    batch_data = []
    for prop in properties:
        data = {
            'external_id': str(prop['property_id']),
            'name': prop['name'],
            'address': prop['address'],
            'city': prop['city'],
            'state': prop['state'],
            'zip_code': prop['zip_code'],
            'latitude': prop['latitude'],
            'longitude': prop['longitude'],
            'submarket_id': submarket_map.get(prop['submarket']),
            'total_units': prop['total_units'],
            'year_built': prop['year_built'],
            'stories': prop['stories']
        }
        batch_data.append(data)
    
    execute_batch(cursor, insert_query, batch_data, page_size=100)
    conn.commit()
    cursor.close()
    
    print(f"✓ Loaded {len(properties)} properties")


def load_rent_observations(conn, observations_file: str):
    """Load mock rent observations"""
    with open(observations_file) as f:
        observations = json.load(f)
    
    cursor = conn.cursor()
    
    # Get property ID mapping (external_id -> property_id)
    cursor.execute("""
        SELECT external_id, property_id
        FROM properties
        WHERE data_source = 'mock'
    """)
    property_map = {ext_id: prop_id for ext_id, prop_id in cursor.fetchall()}
    
    insert_query = """
        INSERT INTO rent_observations (
            observed_at, property_id, unit_type,
            asking_rent, sqft, available_units,
            data_source, confidence_score
        ) VALUES (
            %(observed_at)s, %(property_id)s, %(unit_type)s,
            %(asking_rent)s, %(sqft)s, %(available_units)s,
            'mock', 1.0
        )
        ON CONFLICT (observed_at, property_id, unit_type) DO NOTHING
    """
    
    batch_data = []
    skipped = 0
    
    for obs in observations:
        ext_id = str(obs['property_id'])
        
        if ext_id not in property_map:
            skipped += 1
            continue
        
        data = {
            'observed_at': obs['observed_at'],
            'property_id': property_map[ext_id],
            'unit_type': obs['unit_type'],
            'asking_rent': obs['asking_rent'],
            'sqft': obs['sqft'],
            'available_units': obs['available_units']
        }
        batch_data.append(data)
        
        # Execute in batches
        if len(batch_data) >= 1000:
            execute_batch(cursor, insert_query, batch_data, page_size=1000)
            conn.commit()
            print(f"  - Loaded {len(batch_data)} observations...")
            batch_data = []
    
    # Execute remaining
    if batch_data:
        execute_batch(cursor, insert_query, batch_data, page_size=1000)
        conn.commit()
    
    cursor.close()
    
    print(f"✓ Loaded {len(observations) - skipped:,} rent observations (skipped {skipped})")


def load_pipeline_projects(conn, projects_file: str):
    """Load mock pipeline projects"""
    with open(projects_file) as f:
        projects = json.load(f)
    
    cursor = conn.cursor()
    
    # Get submarket IDs
    cursor.execute("SELECT submarket_id, name FROM submarkets")
    submarket_map = {name: id for id, name in cursor.fetchall()}
    
    insert_query = """
        INSERT INTO pipeline_projects (
            external_id, data_source, name, address,
            submarket_id, units, status, estimated_delivery,
            created_at, updated_at
        ) VALUES (
            %(external_id)s, 'mock', %(name)s, %(address)s,
            %(submarket_id)s, %(units)s, %(status)s, %(estimated_delivery)s,
            NOW(), NOW()
        )
        ON CONFLICT (data_source, external_id) DO UPDATE SET
            status = EXCLUDED.status,
            estimated_delivery = EXCLUDED.estimated_delivery,
            updated_at = NOW()
    """
    
    batch_data = []
    for proj in projects:
        data = {
            'external_id': str(proj['project_id']),
            'name': proj['name'],
            'address': proj['address'],
            'submarket_id': submarket_map.get(proj['submarket']),
            'units': proj['units'],
            'status': proj['status'],
            'estimated_delivery': proj['estimated_delivery']
        }
        batch_data.append(data)
    
    execute_batch(cursor, insert_query, batch_data, page_size=100)
    conn.commit()
    cursor.close()
    
    print(f"✓ Loaded {len(projects)} pipeline projects")


def main():
    parser = argparse.ArgumentParser(description="Load mock data for JEDI RE testing")
    parser.add_argument("--generate", action="store_true", help="Generate fresh mock data")
    parser.add_argument("--load", action="store_true", help="Load mock data into database")
    parser.add_argument("--all", action="store_true", help="Generate and load")
    parser.add_argument("--data-dir", default="mock_data", help="Mock data directory")
    
    args = parser.parse_args()
    
    if not (args.generate or args.load or args.all):
        parser.print_help()
        print("\nError: Must specify --generate, --load, or --all")
        sys.exit(1)
    
    # Generate
    if args.generate or args.all:
        print("="*60)
        print("GENERATING MOCK DATA")
        print("="*60)
        
        generator = MockDataGenerator(seed=42)
        generator.export_to_json(output_dir=args.data_dir)
    
    # Load
    if args.load or args.all:
        print("\n" + "="*60)
        print("LOADING MOCK DATA INTO DATABASE")
        print("="*60)
        
        try:
            conn = connect_db()
            print("✓ Connected to database")
            
            # Load in order
            print("\n1. Loading submarkets...")
            load_submarkets(conn)
            
            print("\n2. Loading properties...")
            properties_file = f"{args.data_dir}/properties.json"
            if not os.path.exists(properties_file):
                print(f"Error: {properties_file} not found. Run with --generate first.")
                sys.exit(1)
            load_properties(conn, properties_file)
            
            print("\n3. Loading rent observations...")
            observations_file = f"{args.data_dir}/rent_observations.json"
            load_rent_observations(conn, observations_file)
            
            print("\n4. Loading pipeline projects...")
            projects_file = f"{args.data_dir}/pipeline_projects.json"
            load_pipeline_projects(conn, projects_file)
            
            conn.close()
            
            print("\n" + "="*60)
            print("MOCK DATA LOAD COMPLETE")
            print("="*60)
            print("\nYou can now test Phase 2 APIs:")
            print("  - GET /api/v1/submarkets")
            print("  - GET /api/v1/properties")
            print("  - GET /api/v1/submarkets/1/analysis")
            
        except Exception as e:
            print(f"\nError loading data: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)


if __name__ == "__main__":
    main()
