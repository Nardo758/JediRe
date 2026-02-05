#!/usr/bin/env python3
"""
Example: Real-world analysis for Atlanta neighborhoods

This script demonstrates the complete pipeline:
1. Load real parcel data from Fulton County GIS
2. Aggregate by neighborhood
3. Feed to carrying capacity engine
4. Generate investment insights
"""

from parcel_queries import ParcelDataSource
from parcel_to_engine import estimate_submarket_data, analyze_neighborhood
from carrying_capacity import CarryingCapacityEngine


def investment_analysis(neighborhood: str):
    """
    Generate investment insights for a neighborhood
    
    Args:
        neighborhood: Atlanta neighborhood name
    """
    print("\n" + "="*80)
    print(f"INVESTMENT ANALYSIS REPORT: {neighborhood.upper()}")
    print("="*80 + "\n")
    
    # Initialize data source
    source = ParcelDataSource()
    
    # Get parcel statistics
    stats = source.get_neighborhood_stats(neighborhood)
    
    if not stats:
        print(f"❌ No data found for {neighborhood}")
        return
    
    # Show parcel overview
    print("📊 PARCEL DATA OVERVIEW")
    print("-" * 80)
    print(f"Total Parcels:          {stats.total_parcels:>10,}")
    print(f"Current Units:          {stats.total_units:>10,}")
    print(f"Developable Parcels:    {stats.developable_parcels:>10,}")
    print(f"Total Property Value:   ${stats.total_property_value:>10,.0f}")
    print(f"Average Lot Size:       {stats.avg_lot_size:>10,.0f} sqft")
    
    print(f"\nTop Zoning Districts:")
    for zoning, count in sorted(stats.zoning_mix.items(), key=lambda x: x[1], reverse=True)[:3]:
        pct = (count / stats.total_parcels) * 100
        print(f"  {zoning or 'Unknown':15} {count:>5} parcels ({pct:.1f}%)")
    
    # Run carrying capacity analysis
    submarket_data = estimate_submarket_data(neighborhood, stats)
    engine = CarryingCapacityEngine()
    result = engine.analyze(submarket_data)
    
    # Show market analysis
    print(f"\n🎯 MARKET ANALYSIS")
    print("-" * 80)
    print(f"Market Saturation:      {result.saturation_pct:>10.1f}%")
    print(f"Market Verdict:         {result.verdict.value:>20}")
    print(f"Demand Capacity:        {result.demand_units:>10,} units")
    print(f"Total Supply:           {result.total_supply:>10,} units")
    print(f"Supply/Demand Gap:      {result.total_supply - result.demand_units:>10,} units")
    print(f"Annual Demand Growth:   {result.demand_growth_annual:>10,} units/year")
    print(f"Time to Equilibrium:    {result.equilibrium_quarters:>10} quarters")
    print(f"Analysis Confidence:    {result.confidence:>10.0%}")
    
    # Generate investment recommendations
    print(f"\n💡 INVESTMENT INSIGHTS")
    print("-" * 80)
    
    if result.saturation_pct < 90:
        print("✅ STRONG BUY SIGNAL")
        print("   • Market is undersupplied")
        print("   • Rent growth likely")
        print("   • Development opportunities abundant")
        print(f"   • Can support {result.demand_units - result.total_supply:,} more units")
        
    elif result.saturation_pct < 105:
        print("✓ MODERATE BUY SIGNAL")
        print("   • Market is balanced")
        print("   • Stable rental conditions")
        print("   • Selective development makes sense")
        print("   • Focus on quality locations")
        
    else:
        print("⚠️  CAUTION ADVISED")
        print("   • Market is oversupplied")
        print(f"   • {result.equilibrium_quarters} quarters to absorb excess supply")
        print("   • Downward pressure on rents likely")
        print("   • Hold off on new development unless:")
        print("     - Unique value proposition")
        print("     - Strong differentiation")
        print("     - Below-market construction costs")
    
    # Development opportunity breakdown
    if stats.developable_parcels > 0:
        print(f"\n🏗️  DEVELOPMENT OPPORTUNITIES")
        print("-" * 80)
        print(f"Developable Parcels:    {stats.developable_parcels:>10,}")
        
        # Estimate development potential
        small_mf_units = stats.developable_parcels * 6  # 6 units per parcel (townhomes)
        mid_mf_units = stats.developable_parcels * 15  # If assembled for mid-rise
        
        print(f"\nPotential Capacity:")
        print(f"  Small MF (6u/parcel): {small_mf_units:>10,} units")
        print(f"  Mid-Rise (15u/parcel):{mid_mf_units:>10,} units")
        
        # Calculate absorption time
        if result.demand_growth_annual > 0:
            years_to_absorb = small_mf_units / result.demand_growth_annual
            print(f"\nAbsorption Timeline:")
            print(f"  {years_to_absorb:.1f} years to absorb all small MF development")
            
            if years_to_absorb < 5:
                print("  ✅ Fast absorption - favorable for development")
            elif years_to_absorb < 10:
                print("  ⚠️  Moderate absorption - pace development carefully")
            else:
                print("  ❌ Slow absorption - significant oversupply risk")
    
    print(f"\n" + "="*80 + "\n")


def compare_investment_opportunities():
    """Compare investment opportunities across multiple neighborhoods"""
    
    source = ParcelDataSource()
    neighborhoods = source.list_neighborhoods()
    engine = CarryingCapacityEngine()
    
    print("\n" + "="*80)
    print("ATLANTA NEIGHBORHOOD INVESTMENT RANKINGS")
    print("="*80 + "\n")
    
    # Analyze all neighborhoods
    results = []
    for neighborhood in neighborhoods:
        stats = source.get_neighborhood_stats(neighborhood)
        if not stats:
            continue
        
        submarket_data = estimate_submarket_data(neighborhood, stats)
        result = engine.analyze(submarket_data)
        
        # Calculate investment score (lower saturation = better opportunity)
        investment_score = 100 - result.saturation_pct
        
        results.append({
            'neighborhood': neighborhood,
            'score': investment_score,
            'saturation': result.saturation_pct,
            'verdict': result.verdict.value,
            'parcels': stats.total_parcels,
            'developable': stats.developable_parcels
        })
    
    # Sort by investment score (highest first)
    results.sort(key=lambda x: x['score'], reverse=True)
    
    # Display rankings
    print(f"{'Rank':<6} {'Neighborhood':<28} {'Score':<8} {'Saturation':<12} {'Developable':<12}")
    print("-" * 80)
    
    for i, r in enumerate(results, 1):
        emoji = "🟢" if r['score'] > 10 else "🟡" if r['score'] > 0 else "🔴"
        print(f"{i:<6} {emoji} {r['neighborhood']:<25} {r['score']:>6.1f}   {r['saturation']:>6.1f}%     {r['developable']:>8}")
    
    print("\n🟢 = Strong opportunity | 🟡 = Moderate | 🔴 = Caution")
    print("\n" + "="*80 + "\n")


def main():
    """Main demo"""
    import sys
    
    if len(sys.argv) > 1:
        # Analyze specific neighborhood from command line
        neighborhood = " ".join(sys.argv[1:])
        investment_analysis(neighborhood)
    else:
        # Show rankings
        compare_investment_opportunities()
        
        # Deep dive on top opportunity
        source = ParcelDataSource()
        neighborhoods = source.list_neighborhoods()
        if neighborhoods:
            print("\nDetailed analysis of top opportunity:\n")
            investment_analysis(neighborhoods[0])


if __name__ == '__main__':
    main()
