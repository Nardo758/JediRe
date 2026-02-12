#!/usr/bin/env python3
"""
Quick parcel data loader - loads sample parcels from GeoJSON into database
"""
import json
import os
import sys
import psycopg2
from psycopg2.extras import execute_batch

# Database connection from environment
DB_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/jedire")

def create_parcels_table(conn):
    """Create parcels table"""
    with conn.cursor() as cur:
        cur.execute("""
        CREATE TABLE IF NOT EXISTS parcels (
            parcel_id SERIAL PRIMARY KEY,
            apn VARCHAR(50) NOT NULL,
            address VARCHAR(500),
            lot_size_sqft DECIMAL(12, 2),
            current_zoning VARCHAR(100),
            current_units INTEGER DEFAULT 0,
            coordinates_lat DECIMAL(10, 8),
            coordinates_lon DECIMAL(11, 8),
            land_value DECIMAL(15, 2),
            total_appraised_value DECIMAL(15, 2),
            improvement_value DECIMAL(15, 2),
            county VARCHAR(100),
            city VARCHAR(100),
            state VARCHAR(2),
            zip_code VARCHAR(10),
            owner_name1 VARCHAR(255),
            owner_name2 VARCHAR(255),
            property_class_code VARCHAR(10),
            property_class_description VARCHAR(255),
            council_district VARCHAR(10),
            npu VARCHAR(10),
            neighborhood VARCHAR(255),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(apn, county, state)
        );
        
        CREATE INDEX IF NOT EXISTS idx_parcels_apn ON parcels(apn);
        CREATE INDEX IF NOT EXISTS idx_parcels_neighborhood ON parcels(neighborhood);
        CREATE INDEX IF NOT EXISTS idx_parcels_zoning ON parcels(current_zoning);
        """)
    conn.commit()
    print("✓ Parcels table created")


def load_sample_parcels(conn, geojson_file, limit=100):
    """Load sample parcels from GeoJSON"""
    with open(geojson_file, 'r') as f:
        data = json.load(f)
    
    features = data['features'][:limit]
    print(f"Loading {len(features)} parcels...")
    
    parcels = []
    for feature in features:
        props = feature['properties']
        geom = feature.get('geometry', {})
        
        # Extract coordinates (centroid for polygons)
        coords = geom.get('coordinates', [])
        if coords and len(coords) > 0:
            if geom.get('type') == 'Polygon':
                # Get first point of polygon as representative
                lat, lon = coords[0][0][1], coords[0][0][0]
            else:
                lat, lon = 0, 0
        else:
            lat, lon = 0, 0
        
        parcel = (
            props.get('PARCELID', ''),
            props.get('SITEADDRESS', '').strip(),
            float(props.get('SHAPE.AREA', 0)),
            props.get('ZONING1', ''),
            int(props.get('LIVUNITS', 0) or 0),
            lat,
            lon,
            float(props.get('LNDVALUE', 0) or 0),
            float(props.get('TOT_APPR', 0) or 0),
            float(props.get('IMPR_APPR', 0) or 0),
            'Fulton',
            props.get('SITECITY', '').strip(),
            props.get('SITESTATE', 'GA'),
            props.get('SITEZIP', ''),
            props.get('OWNERNME1', ''),
            props.get('OWNERNME2', ''),
            props.get('CLASSCD', ''),
            props.get('CLASSDSCRP', ''),
            props.get('COUNCIL', ''),
            props.get('NPU', ''),
            props.get('NEIGHBORHOOD', ''),
        )
        parcels.append(parcel)
    
    with conn.cursor() as cur:
        execute_batch(cur, """
            INSERT INTO parcels (
                apn, address, lot_size_sqft, current_zoning, current_units,
                coordinates_lat, coordinates_lon, land_value, total_appraised_value, 
                improvement_value, county, city, state, zip_code,
                owner_name1, owner_name2, property_class_code, property_class_description,
                council_district, npu, neighborhood
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (apn, county, state) DO NOTHING
        """, parcels)
    
    conn.commit()
    print(f"✓ Loaded {len(parcels)} parcels")
    return len(parcels)


def test_database():
    """Test database connection"""
    try:
        conn = psycopg2.connect(DB_URL)
        print("✓ Database connection successful")
        
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM parcels")
            count = cur.fetchone()[0]
            print(f"✓ Current parcel count: {count}")
        
        conn.close()
        return True
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        return False


def main():
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        test_database()
        return
    
    try:
        # Connect to database
        conn = psycopg2.connect(DB_URL)
        print("✓ Connected to database")
        
        # Create table
        create_parcels_table(conn)
        
        # Load sample data
        geojson_file = '../gis-data/fulton_parcels_sample.geojson'
        limit = 100
        
        if len(sys.argv) > 1:
            limit = int(sys.argv[1])
        
        loaded = load_sample_parcels(conn, geojson_file, limit)
        
        # Show sample
        with conn.cursor() as cur:
            cur.execute("""
                SELECT neighborhood, COUNT(*) as count 
                FROM parcels 
                GROUP BY neighborhood 
                ORDER BY count DESC 
                LIMIT 10
            """)
            print("\nTop neighborhoods by parcel count:")
            for row in cur.fetchall():
                print(f"  {row[0]}: {row[1]} parcels")
        
        conn.close()
        print("\n✓ Load complete!")
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
