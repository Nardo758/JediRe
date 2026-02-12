#!/usr/bin/env python3
"""
Test script for Development Capacity Analyzer
Demonstrates analysis of a vacant parcel in Buckhead, Atlanta
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.engines.development_capacity_analyzer import DevelopmentCapacityAnalyzer
from src.services.zoning_rules_service import get_zoning_service


def test_buckhead_vacant_parcel():
    """Test analysis of a vacant parcel in Buckhead"""
    print("=" * 80)
    print("DEVELOPMENT CAPACITY ANALYZER - TEST")
    print("Analyzing vacant parcel in Buckhead, Atlanta")
    print("=" * 80)
    
    # Initialize analyzer
    analyzer = DevelopmentCapacityAnalyzer()
    zoning_service = get_zoning_service()
    
    # Test parcel: Vacant lot in Buckhead zoned MR-4A (high density multifamily)
    test_parcel = {
        "parcel_id": 1001,
        "current_zoning": "MR-4A",
        "lot_size_sqft": 15000,  # ~0.34 acres
        "current_units": 0,      # Vacant lot
        "location": "Buckhead, Atlanta, GA",
        "submarket_id": 1        # Assuming Buckhead is submarket 1
    }
    
    print(f"\n📋 Parcel Details:")
    print(f"  Location: {test_parcel['location']}")
    print(f"  Zoning: {test_parcel['current_zoning']}")
    print(f"  Lot Size: {test_parcel['lot_size_sqft']:,.0f} sqft ({test_parcel['lot_size_sqft']/43560:.2f} acres)")
    print(f"  Current Units: {test_parcel['current_units']} (vacant)")
    
    # Get zoning rules
    print(f"\n📜 Zoning Rules Lookup:")
    rules = zoning_service.get_rules_by_zone(test_parcel['current_zoning'])
    if rules:
        print(f"  ✓ Found zoning rules for {rules.zoning_code}")
        print(f"  Description: {rules.description}")
        print(f"  Zone Type: {rules.zone_type}")
        if rules.maximum_far:
            print(f"  Maximum FAR: {rules.maximum_far}")
        if rules.maximum_density_units_per_acre:
            print(f"  Max Density: {rules.maximum_density_units_per_acre} units/acre")
        if rules.maximum_height_feet:
            print(f"  Height Limit: {rules.maximum_height_feet} ft")
    else:
        print(f"  ✗ Zoning rules not found for {test_parcel['current_zoning']}")
        return
    
    # Analyze development capacity
    print(f"\n🔍 Development Capacity Analysis:")
    result = analyzer.analyze_parcel(**test_parcel)
    
    print(f"  Maximum Buildable Units: {result.maximum_buildable_units}")
    print(f"  Development Potential: {result.development_potential.value}")
    print(f"  Estimated FAR: {result.estimated_far}")
    print(f"  Max Height: {result.max_height_feet} ft")
    print(f"  Confidence Score: {result.confidence_score:.2f}")
    
    print(f"\n🚧 Development Constraints:")
    for constraint in result.constraints:
        print(f"  • {constraint}")
    
    print(f"\n📈 Supply Forecast:")
    forecast = result.supply_forecast
    print(f"  Projected New Units: {forecast['projected_new_units']}")
    print(f"  Timeframe: {forecast['timeframe_months']} months")
    print(f"  Submarket Impact: {forecast['impact_on_submarket']}")
    print(f"  Development Likelihood: {forecast['development_likelihood']}")
    
    # Calculate submarket impact
    print(f"\n🏙️  Submarket Impact Analysis:")
    print(f"  Assuming Buckhead submarket has ~10,000 existing multifamily units...")
    existing_units = 10000
    new_units = forecast['projected_new_units']
    supply_increase_pct = (new_units / existing_units) * 100
    
    print(f"  New units would represent {supply_increase_pct:.1f}% supply increase")
    
    if supply_increase_pct < 1:
        print(f"  Impact: Minimal - unlikely to affect market dynamics")
    elif supply_increase_pct < 5:
        print(f"  Impact: Moderate - could affect specific sub-segments")
    else:
        print(f"  Impact: Significant - could affect overall market rents")
    
    return result


def test_multiple_zoning_codes():
    """Test different zoning codes for comparison"""
    print(f"\n" + "=" * 80)
    print("COMPARISON OF DIFFERENT ZONING CODES")
    print("=" * 80)
    
    analyzer = DevelopmentCapacityAnalyzer()
    
    test_cases = [
        {"zoning": "R-1", "lot_size": 87120, "desc": "Single-family, 2-acre lot"},
        {"zoning": "R-4", "lot_size": 9000, "desc": "Single-family, small lot"},
        {"zoning": "MR-1", "lot_size": 20000, "desc": "Low-density multifamily"},
        {"zoning": "MR-4A", "lot_size": 15000, "desc": "High-density multifamily"},
        {"zoning": "RG", "lot_size": 25000, "desc": "Residential General"},
    ]
    
    print(f"\n{'Zoning':<10} {'Lot Size':<12} {'Max Units':<12} {'Potential':<12} Description")
    print("-" * 80)
    
    for case in test_cases:
        result = analyzer.analyze_parcel(
            parcel_id=0,
            current_zoning=case["zoning"],
            lot_size_sqft=case["lot_size"],
            current_units=0
        )
        
        print(f"{case['zoning']:<10} {case['lot_size']:<12,.0f} "
              f"{result.maximum_buildable_units:<12} "
              f"{result.development_potential.value:<12} "
              f"{case['desc']}")


def test_submarket_pipeline():
    """Test submarket pipeline analysis"""
    print(f"\n" + "=" * 80)
    print("SUBMARKET PIPELINE ANALYSIS")
    print("=" * 80)
    
    analyzer = DevelopmentCapacityAnalyzer()
    
    # Simulate parcels in a submarket
    submarket_parcels = [
        {"id": 1, "zoning_code": "MR-4A", "lot_size_sqft": 15000, "current_units": 0},
        {"id": 2, "zoning_code": "MR-4A", "lot_size_sqft": 12000, "current_units": 24},
        {"id": 3, "zoning_code": "RG", "lot_size_sqft": 25000, "current_units": 0},
        {"id": 4, "zoning_code": "R-4", "lot_size_sqft": 9000, "current_units": 1},
        {"id": 5, "zoning_code": "MR-1", "lot_size_sqft": 20000, "current_units": 8},
    ]
    
    pipeline_result = analyzer.analyze_submarket_pipeline(
        submarket_id=1,
        parcels=submarket_parcels
    )
    
    print(f"\n📊 Pipeline Summary for Submarket {pipeline_result['submarket_id']}:")
    print(f"  Total Potential New Units: {pipeline_result['total_potential_new_units']:,}")
    print(f"  Viable Parcels: {pipeline_result['viable_parcels_count']} of {pipeline_result['total_parcels_analyzed']}")
    print(f"  Pipeline Impact: {pipeline_result['pipeline_impact']}")
    print(f"  Estimated Timeframe: {pipeline_result['estimated_timeframe_months']} months")
    print(f"  Recommendation: {pipeline_result['recommendation']}")
    
    print(f"\n📋 Potential by Zoning Code:")
    for zone, units in pipeline_result['potential_by_zoning'].items():
        print(f"  {zone}: {units:,} units")


def main():
    """Run all tests"""
    print("JEDI RE - Development Capacity Analyzer Test Suite")
    print("Testing Atlanta zoning data integration\n")
    
    try:
        # Test 1: Single parcel analysis
        result = test_buckhead_vacant_parcel()
        
        # Test 2: Multiple zoning codes
        test_multiple_zoning_codes()
        
        # Test 3: Submarket pipeline
        test_submarket_pipeline()
        
        print(f"\n" + "=" * 80)
        print("✅ ALL TESTS COMPLETED SUCCESSFULLY")
        print("=" * 80)
        
        # Show sample API response
        print(f"\n📋 Sample API Response Structure:")
        if result:
            sample_response = {
                "success": True,
                "data": result.to_dict()
            }
            # Print just the structure, not all data
            print("  Response includes:")
            for key in sample_response["data"].keys():
                print(f"    - {key}")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())