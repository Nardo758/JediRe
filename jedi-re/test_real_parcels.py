#!/usr/bin/env python3
"""
Test Development Capacity Analyzer with Real Buckhead Parcels
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.engines.development_capacity_analyzer import DevelopmentCapacityAnalyzer
from src.services.zoning_rules_service import get_zoning_service


def analyze_real_parcels():
    """Analyze real parcels in Buckhead, Atlanta"""
    
    print("=" * 80)
    print("DEVELOPMENT CAPACITY ANALYZER - REAL BUCKHEAD PARCELS")
    print("=" * 80)
    
    analyzer = DevelopmentCapacityAnalyzer()
    
    # Real Buckhead parcels with actual addresses and estimated details
    # Note: Zoning and lot sizes are approximations based on typical Buckhead properties
    real_parcels = [
        {
            "name": "Vacant lot - Peachtree Rd",
            "address": "3400 Peachtree Rd NE, Atlanta, GA 30326",
            "parcel_id": 2001,
            "current_zoning": "MR-5A",  # High-rise corridor
            "lot_size_sqft": 25000,  # ~0.57 acres
            "current_units": 0,
            "location": "Buckhead Village, Atlanta",
            "submarket_id": 1,
            "notes": "Major corridor, high visibility, near MARTA"
        },
        {
            "name": "Underdeveloped site - Piedmont Rd",
            "address": "2900 Piedmont Rd NE, Atlanta, GA 30305",
            "parcel_id": 2002,
            "current_zoning": "MR-4A",  # Mid-rise
            "lot_size_sqft": 18000,  # ~0.41 acres
            "current_units": 4,  # Old low-density building
            "location": "Lindbergh area, Buckhead",
            "submarket_id": 1,
            "notes": "Redevelopment opportunity"
        },
        {
            "name": "Parking lot - Roswell Rd",
            "address": "4600 Roswell Rd NE, Atlanta, GA 30342",
            "parcel_id": 2003,
            "current_zoning": "MRC-2",  # Mixed-use corridor
            "lot_size_sqft": 32000,  # ~0.73 acres
            "current_units": 0,
            "location": "North Buckhead",
            "submarket_id": 1,
            "notes": "Currently surface parking, mixed-use potential"
        },
        {
            "name": "Single-family teardown - W Paces Ferry",
            "address": "3600 W Paces Ferry Rd NW, Atlanta, GA 30327",
            "parcel_id": 2004,
            "current_zoning": "R-4",  # Single-family
            "lot_size_sqft": 12000,  # ~0.28 acres
            "current_units": 1,  # Old house
            "location": "West Paces Ferry, Buckhead",
            "submarket_id": 1,
            "notes": "Luxury single-family area"
        },
        {
            "name": "Commercial conversion - Lenox Rd",
            "address": "3350 Lenox Rd NE, Atlanta, GA 30326",
            "parcel_id": 2005,
            "current_zoning": "MR-6",  # High-rise
            "lot_size_sqft": 45000,  # ~1.03 acres
            "current_units": 0,
            "location": "Near Lenox Square Mall",
            "submarket_id": 1,
            "notes": "Prime location, transit-oriented development"
        }
    ]
    
    results = []
    
    for parcel in real_parcels:
        print(f"\n{'='*80}")
        print(f"📍 {parcel['name']}")
        print(f"{'='*80}")
        print(f"Address: {parcel['address']}")
        print(f"Location: {parcel['location']}")
        print(f"Current Zoning: {parcel['current_zoning']}")
        print(f"Lot Size: {parcel['lot_size_sqft']:,} sqft ({parcel['lot_size_sqft']/43560:.2f} acres)")
        print(f"Current Units: {parcel['current_units']}")
        print(f"Notes: {parcel['notes']}")
        
        # Analyze
        result = analyzer.analyze_parcel(
            parcel_id=parcel['parcel_id'],
            current_zoning=parcel['current_zoning'],
            lot_size_sqft=parcel['lot_size_sqft'],
            current_units=parcel['current_units'],
            location=parcel['location'],
            submarket_id=parcel['submarket_id']
        )
        
        if result:
            print(f"\n📊 DEVELOPMENT CAPACITY ANALYSIS:")
            print(f"  Maximum Buildable Units: {result.maximum_buildable_units}")
            print(f"  Net New Units Potential: {result.maximum_buildable_units - parcel['current_units']}")
            print(f"  Development Potential: {result.development_potential}")
            print(f"  Estimated FAR: {result.estimated_far if result.estimated_far else 'N/A'}")
            print(f"  Max Height: {result.max_height_feet if result.max_height_feet else 'N/A'} ft")
            print(f"  Confidence: {result.confidence_score*100:.0f}%")
            
            if result.constraints:
                print(f"\n  Constraints:")
                for constraint in result.constraints[:5]:
                    print(f"    • {constraint}")
            
            if result.supply_forecast:
                forecast = result.supply_forecast
                print(f"\n  Supply Forecast:")
                print(f"    Timeframe: {forecast.get('timeframe_months', 0)} months")
                print(f"    Projected Units: {forecast.get('projected_new_units', 0)}")
                print(f"    Submarket Impact: {forecast.get('impact_on_submarket', 'Unknown')}")
            
            results.append({
                'name': parcel['name'],
                'address': parcel['address'],
                'zoning': parcel['current_zoning'],
                'max_units': result.maximum_buildable_units,
                'net_new_units': result.maximum_buildable_units - parcel['current_units'],
                'potential': result.development_potential
            })
    
    # Summary
    print(f"\n{'='*80}")
    print("📋 BUCKHEAD DEVELOPMENT PIPELINE SUMMARY")
    print(f"{'='*80}\n")
    
    print(f"{'Property':<35} {'Zoning':<10} {'Max Units':<12} {'Net New':<12} {'Potential'}")
    print("-" * 80)
    
    total_new_units = 0
    for r in results:
        print(f"{r['name'][:34]:<35} {r['zoning']:<10} {r['max_units']:<12} {r['net_new_units']:<12} {r['potential']}")
        total_new_units += r['net_new_units']
    
    print("-" * 80)
    print(f"{'TOTAL PIPELINE:':<35} {'':<10} {'':<12} {total_new_units:<12}")
    
    print(f"\n💡 KEY INSIGHTS:")
    print(f"  • Total potential new units: {total_new_units}")
    print(f"  • Assuming ~10,000 units in Buckhead submarket")
    print(f"  • Pipeline represents {total_new_units/10000*100:.1f}% supply increase")
    
    high_potential = [r for r in results if r['potential'] in ['VERY_HIGH', 'HIGH']]
    if high_potential:
        print(f"  • {len(high_potential)} HIGH potential development sites identified")
        print(f"  • Focus areas: {', '.join([r['name'] for r in high_potential])}")
    
    print(f"\n✅ Analysis complete for {len(real_parcels)} real Buckhead parcels")


if __name__ == "__main__":
    analyze_real_parcels()
