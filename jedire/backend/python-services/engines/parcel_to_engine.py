#!/usr/bin/env python3
"""
Integration layer: Convert parcel data to engine input format
Maps real Atlanta parcel data to carrying capacity analysis
"""
from parcel_queries import ParcelDataSource, NeighborhoodStats
from carrying_capacity import SubmarketData, CarryingCapacityEngine
from typing import Optional


# Estimation constants for Atlanta submarkets
# These would ideally come from census/market data APIs
ATLANTA_METRO_STATS = {
    "population_per_sqft": 0.0025,  # Rough estimate: population density
    "avg_household_size": 2.3,
    "avg_sqft_per_unit": 1200,
    "employment_ratio": 1.4,  # Jobs per household
    "median_income_default": 65000,
    "growth_rate_default": 0.018,  # 1.8% annual
}


def estimate_submarket_data(neighborhood: str, stats: NeighborhoodStats) -> SubmarketData:
    """
    Convert parcel statistics to SubmarketData for carrying capacity analysis
    
    This function maps actual parcel data to the format expected by the engine.
    Uses estimation formulas where direct data is not available.
    
    Args:
        neighborhood: Neighborhood name
        stats: Aggregated parcel statistics
        
    Returns:
        SubmarketData ready for analysis
    """
    
    # Estimate population from existing units
    # If we have units, use those; otherwise estimate from land use
    if stats.total_units > 0:
        population = int(stats.total_units * ATLANTA_METRO_STATS["avg_household_size"])
    else:
        # Estimate from total land area and density
        total_sqft = stats.avg_lot_size * stats.total_parcels
        population = int(total_sqft * ATLANTA_METRO_STATS["population_per_sqft"])
    
    # Ensure minimum population
    population = max(population, 1000)
    
    # Estimate employment
    employment = int(population * ATLANTA_METRO_STATS["employment_ratio"])
    
    # Estimate median income based on property values
    if stats.total_property_value > 0:
        avg_property_value = stats.total_property_value / stats.total_parcels
        # Rough correlation: higher property values = higher incomes
        median_income = min(avg_property_value * 0.25, 150000)
        median_income = max(median_income, 40000)  # Floor
    else:
        median_income = ATLANTA_METRO_STATS["median_income_default"]
    
    # Calculate potential future units from developable parcels
    # Assume each developable parcel could hold 4-8 units (townhomes/small MF)
    avg_units_per_developable = 6
    future_capacity = stats.developable_parcels * avg_units_per_developable
    
    # Pipeline units: assume 10% of developable parcels are in development
    pipeline_units = int(stats.developable_parcels * 0.10 * avg_units_per_developable)
    
    # Future permitted: another 5%
    future_permitted = int(stats.developable_parcels * 0.05 * avg_units_per_developable)
    
    return SubmarketData(
        name=neighborhood,
        population=population,
        population_growth_rate=ATLANTA_METRO_STATS["growth_rate_default"],
        net_migration_annual=int(population * 0.01),  # 1% annual migration
        employment=employment,
        employment_growth_rate=ATLANTA_METRO_STATS["growth_rate_default"] * 1.2,
        median_income=median_income,
        existing_units=stats.total_units or int(population / ATLANTA_METRO_STATS["avg_household_size"]),
        pipeline_units=pipeline_units,
        future_permitted_units=future_permitted
    )


def analyze_neighborhood(neighborhood: str, data_source: Optional[ParcelDataSource] = None):
    """
    Full analysis pipeline for a neighborhood
    
    Args:
        neighborhood: Neighborhood name (e.g., "Buckhead", "Virginia Highland")
        data_source: ParcelDataSource (optional, creates default if None)
    """
    # Initialize data source
    if data_source is None:
        data_source = ParcelDataSource()
    
    print(f"\n{'='*70}")
    print(f"NEIGHBORHOOD ANALYSIS: {neighborhood}")
    print(f"{'='*70}\n")
    
    # Step 1: Get parcel statistics
    print("Step 1: Fetching parcel data...")
    stats = data_source.get_neighborhood_stats(neighborhood)
    
    if not stats:
        print(f"No data found for neighborhood: {neighborhood}")
        return
    
    print(f"  ✓ Found {stats.total_parcels} parcels")
    print(f"  ✓ Current units: {stats.total_units}")
    print(f"  ✓ Developable parcels: {stats.developable_parcels}")
    
    # Step 2: Convert to submarket data
    print("\nStep 2: Estimating submarket metrics...")
    submarket_data = estimate_submarket_data(neighborhood, stats)
    
    print(f"  ✓ Estimated population: {submarket_data.population:,}")
    print(f"  ✓ Employment: {submarket_data.employment:,}")
    print(f"  ✓ Median income: ${submarket_data.median_income:,.0f}")
    print(f"  ✓ Existing units: {submarket_data.existing_units:,}")
    print(f"  ✓ Pipeline units: {submarket_data.pipeline_units}")
    
    # Step 3: Run carrying capacity analysis
    print("\nStep 3: Running carrying capacity analysis...")
    engine = CarryingCapacityEngine()
    result = engine.analyze(submarket_data)
    
    # Display results
    print(f"\n{'='*70}")
    print(f"CARRYING CAPACITY RESULTS")
    print(f"{'='*70}\n")
    
    print(f"DEMAND CAPACITY:")
    print(f"  Total: {result.demand_units:,} units")
    print(f"  Annual Growth: +{result.demand_growth_annual:,} units/year")
    
    print(f"\nSUPPLY:")
    print(f"  Existing: {result.existing_units:,} units")
    print(f"  Pipeline: {result.pipeline_units:,} units")
    print(f"  Total: {result.total_supply:,} units")
    
    print(f"\nANALYSIS:")
    print(f"  Saturation: {result.saturation_pct:.1f}%")
    print(f"  Verdict: {result.verdict.value}")
    print(f"  Equilibrium Timeline: {result.equilibrium_quarters} quarters")
    print(f"  Confidence: {result.confidence:.0%}")
    
    print(f"\nSUMMARY:")
    print(f"  {result.summary}")
    
    print(f"\n{'='*70}\n")
    
    return result


def compare_neighborhoods(neighborhoods: list, data_source: Optional[ParcelDataSource] = None):
    """
    Compare multiple neighborhoods
    
    Args:
        neighborhoods: List of neighborhood names
        data_source: ParcelDataSource (optional)
    """
    if data_source is None:
        data_source = ParcelDataSource()
    
    engine = CarryingCapacityEngine()
    results = []
    
    print(f"\n{'='*70}")
    print(f"COMPARING {len(neighborhoods)} NEIGHBORHOODS")
    print(f"{'='*70}\n")
    
    for neighborhood in neighborhoods:
        stats = data_source.get_neighborhood_stats(neighborhood)
        if not stats:
            continue
        
        submarket_data = estimate_submarket_data(neighborhood, stats)
        result = engine.analyze(submarket_data)
        results.append((neighborhood, result))
    
    # Sort by saturation
    results.sort(key=lambda x: x[1].saturation_pct)
    
    print(f"{'Neighborhood':<25} {'Saturation':<12} {'Verdict':<25} {'Parcels':<10}")
    print("-" * 70)
    
    for neighborhood, result in results:
        stats = data_source.get_neighborhood_stats(neighborhood)
        print(f"{neighborhood:<25} {result.saturation_pct:>6.1f}%    {result.verdict.value:<25} {stats.total_parcels:<10}")
    
    print(f"\n{'='*70}\n")


def main():
    """Main demo"""
    import sys
    
    # Create data source
    data_source = ParcelDataSource()
    
    if len(sys.argv) > 1:
        # Analyze specific neighborhood from command line
        neighborhood = " ".join(sys.argv[1:])
        analyze_neighborhood(neighborhood, data_source)
    else:
        # Demo with available neighborhoods
        neighborhoods = data_source.list_neighborhoods()
        
        print("\nAvailable neighborhoods:")
        for i, nh in enumerate(neighborhoods, 1):
            print(f"  {i}. {nh}")
        
        # Analyze first 3 neighborhoods
        print("\nAnalyzing sample neighborhoods...\n")
        for neighborhood in neighborhoods[:3]:
            try:
                analyze_neighborhood(neighborhood, data_source)
            except Exception as e:
                print(f"Error analyzing {neighborhood}: {e}")
        
        # Compare all
        print("\n\nCOMPARATIVE ANALYSIS:")
        compare_neighborhoods(neighborhoods, data_source)


if __name__ == '__main__':
    main()
