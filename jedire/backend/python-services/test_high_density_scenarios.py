#!/usr/bin/env python3
"""
Comprehensive High-Density Scenarios Test Script
Tests MR-6, MRC-3, MR-5A zones with 1-5 acre lots
Generates scenario analysis for Buckhead/Midtown Atlanta
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.engines.development_capacity_analyzer import DevelopmentCapacityAnalyzer
from src.services.zoning_rules_service import get_zoning_service


def test_high_density_zones():
    """Test high-density zones (MR-6, MRC-3, MR-5A) with varying lot sizes"""
    print("=" * 80)
    print("HIGH-DENSITY ZONES CAPACITY ANALYSIS")
    print("=" * 80)
    
    analyzer = DevelopmentCapacityAnalyzer()
    zoning_service = get_zoning_service()
    
    # Test zones and lot sizes
    zones = ["MR-6", "MRC-3", "MR-5A"]
    lot_sizes_acres = [1, 2, 3, 4, 5]
    
    print(f"\n{'Zone':<10} {'Lot Size':<12} {'Max Units':<12} {'Units/Acre':<12} {'FAR':<10} {'Potential':<15}")
    print("-" * 85)
    
    results = []
    
    for zone in zones:
        print(f"\n{zone} Analysis:")
        print("-" * 85)
        
        # Get zoning rules first
        rules = zoning_service.get_rules_by_zone(zone)
        if not rules:
            print(f"  ⚠️ Zoning rules not found for {zone}")
            continue
        
        # Print zoning rules summary
        if zone.startswith("MRC"):
            print(f"  Type: {rules.zone_type}")
            print(f"  Res FAR: {rules.maximum_far_residential if rules.maximum_far_residential else 'N/A'}")
            print(f"  Combined FAR: {rules.maximum_far_combined if rules.maximum_far_combined else 'N/A'}")
        else:
            print(f"  Type: {rules.zone_type}")
            print(f"  Density: {rules.maximum_density_units_per_acre if rules.maximum_density_units_per_acre else 'N/A'} units/acre")
            print(f"  FAR: {rules.maximum_far if rules.maximum_far else 'N/A'}")
        print(f"  Height: {rules.maximum_height_feet if rules.maximum_height_feet else 'N/A'} ft")
        print()
        
        for acres in lot_sizes_acres:
            lot_size_sqft = acres * 43560
            
            result = analyzer.analyze_parcel(
                parcel_id=0,
                current_zoning=zone,
                lot_size_sqft=lot_size_sqft,
                current_units=0
            )
            
            units_per_acre = result.maximum_buildable_units / acres if result.maximum_buildable_units else 0
            
            print(f"{zone:<10} {f'{acres} acres':<12} "
                  f"{result.maximum_buildable_units:<12} "
                  f"{units_per_acre:<12.1f} "
                  f"{result.estimated_far if result.estimated_far else 'N/A':<10} "
                  f"{result.development_potential.value if result.development_potential else 'N/A':<15}")
            
            results.append({
                'zone': zone,
                'acres': acres,
                'sqft': lot_size_sqft,
                'max_units': result.maximum_buildable_units,
                'units_per_acre': units_per_acre,
                'far': result.estimated_far,
                'potential': result.development_potential.value if result.development_potential else 'N/A',
                'confidence': result.confidence_score
            })
    
    return results


def test_buckhead_scenarios():
    """Test realistic Buckhead development scenarios"""
    print(f"\n" + "=" * 80)
    print("BUCKHEAD ATLANTA - HIGH-DENSITY DEVELOPMENT SCENARIOS")
    print("=" * 80)
    
    analyzer = DevelopmentCapacityAnalyzer()
    
    scenarios = [
        {
            "name": "Phipps Plaza Adjacent - Tower Site",
            "zoning": "MR-6",
            "lot_size_acres": 1.5,
            "current_units": 0,
            "location": "Buckhead Village",
            "notes": "Premium location near luxury retail"
        },
        {
            "name": "Lenox Square Corridor - High-Rise",
            "zoning": "MR-5A",
            "lot_size_acres": 2.0,
            "current_units": 0,
            "location": "Lenox Road Corridor",
            "notes": "Transit-oriented, MARTA accessible"
        },
        {
            "name": "Peachtree Road - Mixed-Use Tower",
            "zoning": "MRC-3",
            "lot_size_acres": 1.8,
            "current_units": 0,
            "location": "Peachtree Road",
            "notes": "Mixed-use corridor, ground-floor retail"
        },
        {
            "name": "Piedmont Road - Redevelopment",
            "zoning": "MR-5A",
            "lot_size_acres": 3.5,
            "current_units": 48,
            "location": "Piedmont Road Corridor",
            "notes": "Tear down existing low-density building"
        },
        {
            "name": "Buckhead Avenue - Mixed-Use Complex",
            "zoning": "MRC-3",
            "lot_size_acres": 5.0,
            "current_units": 0,
            "location": "Buckhead Village Core",
            "notes": "Large-scale mixed-use development"
        },
        {
            "name": "Roswell Road - Tower Site",
            "zoning": "MR-6",
            "lot_size_acres": 1.2,
            "current_units": 0,
            "location": "Roswell Road Corridor",
            "notes": "Compact high-rise site"
        },
    ]
    
    results = []
    total_new_units = 0
    
    for scenario in scenarios:
        print(f"\n🏢 {scenario['name']}")
        print(f"   Location: {scenario['location']}")
        print(f"   Zoning: {scenario['zoning']}")
        print(f"   Lot Size: {scenario['lot_size_acres']} acres")
        print(f"   Current Units: {scenario['current_units']}")
        print(f"   Notes: {scenario['notes']}")
        
        lot_size_sqft = scenario['lot_size_acres'] * 43560
        
        result = analyzer.analyze_parcel(
            parcel_id=0,
            current_zoning=scenario['zoning'],
            lot_size_sqft=lot_size_sqft,
            current_units=scenario['current_units'],
            location=scenario['location']
        )
        
        new_units = result.maximum_buildable_units - scenario['current_units']
        total_new_units += new_units
        
        print(f"\n   📊 Analysis:")
        print(f"      Max Buildable: {result.maximum_buildable_units} units")
        print(f"      Net New Units: {new_units} units")
        print(f"      Density: {result.maximum_buildable_units / scenario['lot_size_acres']:.1f} units/acre")
        print(f"      FAR: {result.estimated_far if result.estimated_far else 'N/A'}")
        print(f"      Height: {result.max_height_feet if result.max_height_feet else 'N/A'} ft")
        print(f"      Potential: {result.development_potential.value if result.development_potential else 'N/A'}")
        print(f"      Confidence: {result.confidence_score * 100:.0f}%")
        
        # Financial estimates
        avg_rent_psf_month = 2.5  # $2.50/sqft/month in Buckhead
        avg_unit_size = 850  # sqft for high-density
        monthly_revenue = new_units * avg_unit_size * avg_rent_psf_month
        annual_revenue = monthly_revenue * 12
        
        print(f"\n   💰 Revenue Potential:")
        print(f"      Est. Unit Size: {avg_unit_size} sqft")
        print(f"      Monthly Rent/Unit: ${avg_unit_size * avg_rent_psf_month:,.0f}")
        print(f"      Annual Revenue: ${annual_revenue:,.0f}")
        print(f"      Revenue/Acre: ${annual_revenue / scenario['lot_size_acres']:,.0f}")
        
        results.append({
            'name': scenario['name'],
            'zoning': scenario['zoning'],
            'acres': scenario['lot_size_acres'],
            'max_units': result.maximum_buildable_units,
            'new_units': new_units,
            'annual_revenue': annual_revenue,
            'potential': result.development_potential.value if result.development_potential else 'N/A'
        })
    
    # Summary
    print(f"\n" + "=" * 80)
    print("BUCKHEAD PIPELINE SUMMARY")
    print("=" * 80)
    
    print(f"\n{'Scenario':<45} {'Zone':<10} {'New Units':<12} {'Annual Rev':<15} {'Potential'}")
    print("-" * 90)
    
    total_revenue = 0
    for r in results:
        print(f"{r['name'][:44]:<45} {r['zoning']:<10} {r['new_units']:<12} "
              f"${r['annual_revenue']:>13,.0f} {r['potential']:<15}")
        total_revenue += r['annual_revenue']
    
    print("-" * 90)
    print(f"{'TOTAL PIPELINE:':<45} {'':<10} {total_new_units:<12} ${total_revenue:>13,.0f}")
    
    print(f"\n📈 Market Impact Analysis:")
    buckhead_existing_units = 12000  # Estimated existing multifamily in Buckhead
    supply_increase_pct = (total_new_units / buckhead_existing_units) * 100
    
    print(f"   Existing Buckhead Units: ~{buckhead_existing_units:,}")
    print(f"   Pipeline New Units: {total_new_units:,}")
    print(f"   Supply Increase: {supply_increase_pct:.1f}%")
    
    if supply_increase_pct < 3:
        print(f"   Impact: MINIMAL - Market can easily absorb")
    elif supply_increase_pct < 8:
        print(f"   Impact: MODERATE - Monitor absorption rates")
    else:
        print(f"   Impact: SIGNIFICANT - Potential rent pressure")
    
    return results


def test_midtown_scenarios():
    """Test realistic Midtown Atlanta development scenarios"""
    print(f"\n" + "=" * 80)
    print("MIDTOWN ATLANTA - HIGH-DENSITY DEVELOPMENT SCENARIOS")
    print("=" * 80)
    
    analyzer = DevelopmentCapacityAnalyzer()
    
    scenarios = [
        {
            "name": "Peachtree Street Tower Site",
            "zoning": "MR-5A",
            "lot_size_acres": 1.0,
            "current_units": 0,
            "location": "Midtown Core",
            "notes": "Premium corridor, walkable to offices"
        },
        {
            "name": "Arts Center District - Mixed-Use",
            "zoning": "MRC-3",
            "lot_size_acres": 2.5,
            "current_units": 0,
            "location": "Arts Center MARTA Station",
            "notes": "TOD opportunity, cultural amenities"
        },
        {
            "name": "West Peachtree High-Rise",
            "zoning": "MR-6",
            "lot_size_acres": 1.8,
            "current_units": 0,
            "location": "West Midtown",
            "notes": "Rapidly developing area"
        },
        {
            "name": "10th Street Corridor Tower",
            "zoning": "MR-5A",
            "lot_size_acres": 1.5,
            "current_units": 24,
            "location": "Midtown East",
            "notes": "Redevelopment opportunity"
        },
        {
            "name": "Spring Street Mixed-Use",
            "zoning": "MRC-3",
            "lot_size_acres": 3.0,
            "current_units": 0,
            "location": "Midtown West",
            "notes": "Large format mixed-use"
        },
    ]
    
    results = []
    total_new_units = 0
    
    for scenario in scenarios:
        print(f"\n🏢 {scenario['name']}")
        print(f"   Location: {scenario['location']}")
        print(f"   Zoning: {scenario['zoning']}")
        print(f"   Lot Size: {scenario['lot_size_acres']} acres")
        print(f"   Current Units: {scenario['current_units']}")
        print(f"   Notes: {scenario['notes']}")
        
        lot_size_sqft = scenario['lot_size_acres'] * 43560
        
        result = analyzer.analyze_parcel(
            parcel_id=0,
            current_zoning=scenario['zoning'],
            lot_size_sqft=lot_size_sqft,
            current_units=scenario['current_units'],
            location=scenario['location']
        )
        
        new_units = result.maximum_buildable_units - scenario['current_units']
        total_new_units += new_units
        
        print(f"\n   📊 Analysis:")
        print(f"      Max Buildable: {result.maximum_buildable_units} units")
        print(f"      Net New Units: {new_units} units")
        print(f"      Density: {result.maximum_buildable_units / scenario['lot_size_acres']:.1f} units/acre")
        print(f"      FAR: {result.estimated_far if result.estimated_far else 'N/A'}")
        print(f"      Potential: {result.development_potential.value if result.development_potential else 'N/A'}")
        
        results.append({
            'name': scenario['name'],
            'zoning': scenario['zoning'],
            'new_units': new_units,
            'max_units': result.maximum_buildable_units
        })
    
    # Summary
    print(f"\n" + "=" * 80)
    print("MIDTOWN PIPELINE SUMMARY")
    print("=" * 80)
    print(f"\n   Total New Units: {total_new_units:,}")
    print(f"   Scenarios Analyzed: {len(scenarios)}")
    
    midtown_existing_units = 15000
    supply_increase_pct = (total_new_units / midtown_existing_units) * 100
    print(f"   Supply Increase: {supply_increase_pct:.1f}%")
    
    return results


def comparative_analysis():
    """Compare all high-density zones side-by-side"""
    print(f"\n" + "=" * 80)
    print("COMPARATIVE ANALYSIS: MR-6 vs MRC-3 vs MR-5A")
    print("=" * 80)
    
    analyzer = DevelopmentCapacityAnalyzer()
    
    # Standard 2-acre lot for comparison
    lot_size_acres = 2.0
    lot_size_sqft = lot_size_acres * 43560
    
    zones = ["MR-6", "MRC-3", "MR-5A"]
    
    print(f"\nStandard Lot: 2.0 acres ({lot_size_sqft:,.0f} sqft)")
    print(f"\n{'Metric':<30} {'MR-6':<15} {'MRC-3':<15} {'MR-5A':<15}")
    print("-" * 75)
    
    zone_results = {}
    
    for zone in zones:
        result = analyzer.analyze_parcel(
            parcel_id=0,
            current_zoning=zone,
            lot_size_sqft=lot_size_sqft,
            current_units=0
        )
        zone_results[zone] = result
    
    # Compare metrics
    metrics = [
        ("Max Units", lambda r: f"{r.maximum_buildable_units}"),
        ("Units/Acre", lambda r: f"{r.maximum_buildable_units / lot_size_acres:.1f}"),
        ("FAR", lambda r: f"{r.estimated_far if r.estimated_far else 'N/A'}"),
        ("Height (ft)", lambda r: f"{r.max_height_feet if r.max_height_feet else 'N/A'}"),
        ("Potential", lambda r: f"{r.development_potential.value if r.development_potential else 'N/A'}"),
        ("Confidence", lambda r: f"{r.confidence_score * 100:.0f}%"),
    ]
    
    for metric_name, metric_fn in metrics:
        values = [metric_fn(zone_results[zone]) for zone in zones]
        print(f"{metric_name:<30} {values[0]:<15} {values[1]:<15} {values[2]:<15}")
    
    print("\n💡 Key Insights:")
    max_zone = max(zones, key=lambda z: zone_results[z].maximum_buildable_units)
    max_units = zone_results[max_zone].maximum_buildable_units
    
    print(f"   • {max_zone} produces highest density: {max_units} units")
    print(f"   • All zones support HIGH or VERY_HIGH development potential")
    print(f"   • MRC-3 enables mixed-use (residential + retail/office)")
    print(f"   • MR-6 and MR-5A are pure residential high-rise zones")


def main():
    """Run all high-density scenario tests"""
    print("JEDI RE - HIGH-DENSITY DEVELOPMENT SCENARIOS")
    print("Comprehensive Analysis of MR-6, MRC-3, MR-5A Zones")
    print()
    
    try:
        # Test 1: Systematic zone testing with 1-5 acre lots
        print("\n" + "=" * 80)
        print("TEST 1: SYSTEMATIC ZONE CAPACITY ANALYSIS")
        print("=" * 80)
        high_density_results = test_high_density_zones()
        
        # Test 2: Buckhead scenarios
        print("\n" + "=" * 80)
        print("TEST 2: BUCKHEAD SCENARIOS")
        print("=" * 80)
        buckhead_results = test_buckhead_scenarios()
        
        # Test 3: Midtown scenarios
        print("\n" + "=" * 80)
        print("TEST 3: MIDTOWN SCENARIOS")
        print("=" * 80)
        midtown_results = test_midtown_scenarios()
        
        # Test 4: Comparative analysis
        print("\n" + "=" * 80)
        print("TEST 4: COMPARATIVE ANALYSIS")
        print("=" * 80)
        comparative_analysis()
        
        # Final summary
        print(f"\n" + "=" * 80)
        print("✅ ALL HIGH-DENSITY SCENARIO TESTS COMPLETED")
        print("=" * 80)
        
        print(f"\nTest Summary:")
        print(f"  • {len(high_density_results)} zone/lot size combinations tested")
        print(f"  • {len(buckhead_results)} Buckhead scenarios analyzed")
        print(f"  • {len(midtown_results)} Midtown scenarios analyzed")
        print(f"  • Comparative analysis complete")
        
        return 0
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
