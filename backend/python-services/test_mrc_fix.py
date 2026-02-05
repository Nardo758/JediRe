#!/usr/bin/env python3
"""
Test script to verify MRC mixed-use calculations fix
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.engines.development_capacity_analyzer import DevelopmentCapacityAnalyzer
from src.services.zoning_rules_service import get_zoning_service


def test_mrc_zones():
    """Test MRC zone calculations"""
    print("=" * 80)
    print("MRC MIXED-USE ZONE CALCULATIONS TEST")
    print("=" * 80)
    
    # Initialize analyzer
    analyzer = DevelopmentCapacityAnalyzer()
    zoning_service = get_zoning_service()
    
    # Test MRC zones with different lot sizes
    test_cases = [
        {"zoning": "MRC-1", "lot_size": 43560, "desc": "1-acre lot in MRC-1"},
        {"zoning": "MRC-2", "lot_size": 87120, "desc": "2-acre lot in MRC-2"},
        {"zoning": "MRC-3", "lot_size": 217800, "desc": "5-acre lot in MRC-3"},
        {"zoning": "MR-4A", "lot_size": 43560, "desc": "1-acre lot in MR-4A (comparison)"},
        {"zoning": "R-1", "lot_size": 43560, "desc": "1-acre lot in R-1 (comparison)"},
    ]
    
    print(f"\n{'Zoning':<10} {'Lot Size':<12} {'Max Units':<12} {'Potential':<12} {'Res FAR':<10} {'Total FAR':<10} Description")
    print("-" * 100)
    
    for case in test_cases:
        # Get zoning rules first
        rules = zoning_service.get_rules_by_zone(case["zoning"])
        
        # Analyze parcel
        result = analyzer.analyze_parcel(
            parcel_id=0,
            current_zoning=case["zoning"],
            lot_size_sqft=case["lot_size"],
            current_units=0
        )
        
        # Extract residential FAR from rules if available
        res_far = rules.maximum_far_residential if rules else "N/A"
        total_far = rules.maximum_far_combined if rules else "N/A"
        
        print(f"{case['zoning']:<10} {case['lot_size']:<12,.0f} "
              f"{result.maximum_buildable_units:<12} "
              f"{result.development_potential.value:<12} "
              f"{res_far if res_far else 'N/A':<10} "
              f"{total_far if total_far else 'N/A':<10} "
              f"{case['desc']}")
        
        # Print detailed info for MRC zones
        if case["zoning"].startswith("MRC"):
            print(f"  → Zone type: {rules.zone_type if rules else 'N/A'}")
            print(f"  → Residential FAR: {rules.maximum_far_residential if rules else 'N/A'}")
            print(f"  → Non-residential FAR: {rules.maximum_far_nonresidential if rules else 'N/A'}")
            print(f"  → Combined FAR: {rules.maximum_far_combined if rules else 'N/A'}")
            print(f"  → Estimated FAR utilization: {result.estimated_far}")
            print(f"  → Confidence score: {result.confidence_score:.2f}")
            print()


def test_mrc_scenarios():
    """Test realistic MRC development scenarios"""
    print(f"\n" + "=" * 80)
    print("REALISTIC MRC DEVELOPMENT SCENARIOS")
    print("=" * 80)
    
    analyzer = DevelopmentCapacityAnalyzer()
    
    scenarios = [
        {
            "name": "Buckhead Village Parking Lot",
            "zoning": "MRC-3",
            "lot_size": 130680,  # 3 acres
            "current_units": 0,
            "location": "Buckhead Village, Atlanta"
        },
        {
            "name": "Lenox Corridor Vacant Lot",
            "zoning": "MRC-2",
            "lot_size": 87120,  # 2 acres
            "current_units": 0,
            "location": "Lenox Road, Atlanta"
        },
        {
            "name": "Midtown Small Parcel",
            "zoning": "MRC-1",
            "lot_size": 21780,  # 0.5 acres
            "current_units": 0,
            "location": "Midtown, Atlanta"
        },
        {
            "name": "Large Buckhead Redevelopment",
            "zoning": "MRC-3",
            "lot_size": 435600,  # 10 acres
            "current_units": 100,  # Existing building
            "location": "Buckhead, Atlanta"
        }
    ]
    
    for scenario in scenarios:
        print(f"\n🏢 {scenario['name']}")
        print(f"   Location: {scenario['location']}")
        print(f"   Zoning: {scenario['zoning']}")
        print(f"   Lot Size: {scenario['lot_size']:,.0f} sqft ({scenario['lot_size']/43560:.1f} acres)")
        print(f"   Current Units: {scenario['current_units']}")
        
        result = analyzer.analyze_parcel(
            parcel_id=0,
            current_zoning=scenario["zoning"],
            lot_size_sqft=scenario["lot_size"],
            current_units=scenario["current_units"],
            location=scenario["location"]
        )
        
        print(f"   Maximum Buildable Units: {result.maximum_buildable_units:,}")
        print(f"   Development Potential: {result.development_potential.value}")
        print(f"   New Units Possible: {max(0, result.maximum_buildable_units - scenario['current_units']):,}")
        print(f"   Estimated FAR: {result.estimated_far}")
        
        # Calculate ROI implications
        new_units = max(0, result.maximum_buildable_units - scenario['current_units'])
        if new_units > 0:
            # Rough revenue estimate: $2,000/month per unit * 12 months
            annual_revenue = new_units * 2000 * 12
            revenue_per_acre = annual_revenue / (scenario['lot_size'] / 43560)
            print(f"   Estimated Annual Revenue: ${annual_revenue:,.0f}")
            print(f"   Revenue per Acre: ${revenue_per_acre:,.0f}/year")


def compare_mrc_vs_standard():
    """Compare MRC zones with standard multifamily zones"""
    print(f"\n" + "=" * 80)
    print("MRC vs STANDARD MULTIFAMILY COMPARISON (2-acre lot)")
    print("=" * 80)
    
    analyzer = DevelopmentCapacityAnalyzer()
    lot_size = 87120  # 2 acres
    
    zones_to_compare = [
        ("R-1", "Single-family low density"),
        ("MR-1", "Low-density multifamily"),
        ("MR-4A", "High-density multifamily"),
        ("MRC-1", "Low-density mixed-use"),
        ("MRC-2", "Medium-density mixed-use"),
        ("MRC-3", "High-density mixed-use"),
    ]
    
    print(f"\n{'Zoning':<10} {'Zone Type':<20} {'Max Units':<12} {'Units/Acre':<12} {'Revenue/Acre*':<15} Description")
    print("-" * 80)
    
    for zone_code, description in zones_to_compare:
        result = analyzer.analyze_parcel(
            parcel_id=0,
            current_zoning=zone_code,
            lot_size_sqft=lot_size,
            current_units=0
        )
        
        units_per_acre = result.maximum_buildable_units / (lot_size / 43560)
        
        # Revenue estimate: $2,000/month per unit
        annual_revenue_per_unit = 2000 * 12
        revenue_per_acre = units_per_acre * annual_revenue_per_unit
        
        print(f"{zone_code:<10} {result.zoning_rule.zone_type if result.zoning_rule else 'N/A':<20} "
              f"{result.maximum_buildable_units:<12} "
              f"{units_per_acre:<12.1f} "
              f"${revenue_per_acre:,.0f}/year{'':<5} "
              f"{description}")
    
    print(f"\n* Assumes $2,000/month rent per unit, 100% occupancy")


def main():
    """Run all MRC tests"""
    print("JEDI RE - MRC Mixed-Use Calculations Fix Test")
    print("Testing updated development capacity analyzer\n")
    
    try:
        # Test 1: Basic MRC calculations
        test_mrc_zones()
        
        # Test 2: Realistic scenarios
        test_mrc_scenarios()
        
        # Test 3: Comparison with standard zones
        compare_mrc_vs_standard()
        
        print(f"\n" + "=" * 80)
        print("✅ MRC FIX TESTS COMPLETED SUCCESSFULLY")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())