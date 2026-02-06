#!/usr/bin/env python3
"""
Manual Property Entry Tool for JEDI RE
Allows quick data entry for testing without automated scrapers
"""

import psycopg2
from datetime import datetime, timedelta
from decimal import Decimal

DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'jedire',
    'user': 'jedire_user',
    'password': 'jedire_password'
}


def get_connection():
    """Get database connection"""
    return psycopg2.connect(**DB_CONFIG)


def add_property(name, address, submarket_id, lat, lon, unit_count, property_type='multifamily'):
    """Add a new property to track"""
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            INSERT INTO properties (name, address, submarket_id, latitude, longitude, unit_count, property_type)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (name, address, submarket_id, lat, lon, unit_count, property_type))
        
        property_id = cur.fetchone()[0]
        conn.commit()
        
        print(f"✅ Added property: {name} (ID: {property_id})")
        return property_id
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error adding property: {e}")
        return None
    finally:
        cur.close()
        conn.close()


def add_rent_observation(property_id, rent_amount, date=None):
    """Add a rent observation for a property"""
    if date is None:
        date = datetime.now()
    
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            INSERT INTO rent_observations (property_id, observation_date, average_rent)
            VALUES (%s, %s, %s)
        """, (property_id, date, Decimal(str(rent_amount))))
        
        conn.commit()
        print(f"✅ Added rent observation: ${rent_amount} on {date.date()}")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error adding rent observation: {e}")
    finally:
        cur.close()
        conn.close()


def add_rent_series(property_id, starting_rent, weeks=12, growth_rate=0.0):
    """
    Add a series of weekly rent observations
    
    Args:
        property_id: Property ID
        starting_rent: Starting rent amount
        weeks: Number of weeks of data
        growth_rate: Weekly growth rate (e.g., 0.001 = 0.1% per week)
    """
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        for week in range(weeks):
            date = datetime.now() - timedelta(weeks=weeks-week-1)
            rent = starting_rent * (1 + growth_rate) ** week
            
            cur.execute("""
                INSERT INTO rent_observations (property_id, observation_date, average_rent)
                VALUES (%s, %s, %s)
            """, (property_id, date, Decimal(str(round(rent, 2)))))
        
        conn.commit()
        print(f"✅ Added {weeks} weeks of rent data for property {property_id}")
        print(f"   Starting: ${starting_rent:.2f} → Ending: ${rent:.2f}")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error adding rent series: {e}")
    finally:
        cur.close()
        conn.close()


def list_properties():
    """List all properties in the database"""
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT p.id, p.name, p.address, s.name as submarket, p.unit_count,
                   COUNT(r.id) as obs_count
            FROM properties p
            LEFT JOIN submarkets s ON p.submarket_id = s.id
            LEFT JOIN rent_observations r ON p.id = r.property_id
            GROUP BY p.id, p.name, p.address, s.name, p.unit_count
            ORDER BY p.id
        """)
        
        properties = cur.fetchall()
        
        if not properties:
            print("No properties found in database.")
            return
        
        print("\n📋 Properties in Database:\n")
        print(f"{'ID':<5} {'Name':<30} {'Submarket':<20} {'Units':<8} {'Data Points'}")
        print("-" * 90)
        
        for prop in properties:
            print(f"{prop[0]:<5} {prop[1]:<30} {prop[3]:<20} {prop[4]:<8} {prop[5]}")
        
    finally:
        cur.close()
        conn.close()


def list_submarkets():
    """List all submarkets"""
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT id, name, city, state, population, median_income
            FROM submarkets
            ORDER BY id
        """)
        
        submarkets = cur.fetchall()
        
        if not submarkets:
            print("No submarkets found in database.")
            return
        
        print("\n🗺️  Submarkets in Database:\n")
        print(f"{'ID':<5} {'Name':<30} {'City, State':<25} {'Population':<12} {'Med Income'}")
        print("-" * 100)
        
        for sm in submarkets:
            pop = f"{sm[4]:,}" if sm[4] else "N/A"
            income = f"${sm[5]:,}" if sm[5] else "N/A"
            print(f"{sm[0]:<5} {sm[1]:<30} {sm[2]}, {sm[3]:<20} {pop:<12} {income}")
        
    finally:
        cur.close()
        conn.close()


def interactive_mode():
    """Interactive CLI for data entry"""
    print("\n🏢 JEDI RE - Manual Property Entry Tool")
    print("=" * 50)
    
    while True:
        print("\nOptions:")
        print("  1. List submarkets")
        print("  2. List properties")
        print("  3. Add new property")
        print("  4. Add rent observation")
        print("  5. Add rent series (12 weeks)")
        print("  6. Exit")
        
        choice = input("\nSelect option (1-6): ").strip()
        
        if choice == "1":
            list_submarkets()
        
        elif choice == "2":
            list_properties()
        
        elif choice == "3":
            print("\n➕ Add New Property")
            name = input("Property name: ")
            address = input("Address: ")
            submarket_id = int(input("Submarket ID: "))
            lat = float(input("Latitude: "))
            lon = float(input("Longitude: "))
            unit_count = int(input("Number of units: "))
            add_property(name, address, submarket_id, lat, lon, unit_count)
        
        elif choice == "4":
            print("\n➕ Add Rent Observation")
            property_id = int(input("Property ID: "))
            rent = float(input("Rent amount: "))
            add_rent_observation(property_id, rent)
        
        elif choice == "5":
            print("\n➕ Add Rent Series (12 weeks)")
            property_id = int(input("Property ID: "))
            starting_rent = float(input("Starting rent: "))
            growth = input("Weekly growth rate (default 0.0, e.g., 0.002 for 0.2%/week): ").strip()
            growth_rate = float(growth) if growth else 0.0
            add_rent_series(property_id, starting_rent, weeks=12, growth_rate=growth_rate)
        
        elif choice == "6":
            print("\n👋 Goodbye!")
            break
        
        else:
            print("❌ Invalid choice. Please select 1-6.")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) == 1:
        # Interactive mode
        interactive_mode()
    else:
        # Quick commands
        cmd = sys.argv[1]
        
        if cmd == "list-properties":
            list_properties()
        elif cmd == "list-submarkets":
            list_submarkets()
        else:
            print("Usage: python manual_property_entry.py [list-properties|list-submarkets]")
