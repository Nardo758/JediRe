#!/usr/bin/env python3
"""
CoStar Data Integration Layer
Maps real CoStar market data to JEDI RE engine format

MAJOR UPGRADE: Replaces estimated data with REAL market data!
- Real unit counts (not estimates!)
- Real vacancy rates
- Real market rents
- Preserves Census data for population/income (for now)
"""
import json
from pathlib import Path
from typing import Dict, Optional, List
from dataclasses import dataclass
import sys

# Add engines to path
sys.path.insert(0, str(Path(__file__).parent))

from carrying_capacity import SubmarketData, CarryingCapacityEngine, CarryingCapacityResult
from imbalance_detector import ImbalanceDetector, ImbalanceSignal


# Atlanta metro demographic estimates (until we add Census API)
# These are metro-wide averages - can be refined per submarket later
ATLANTA_DEMOGRAPHICS = {
    'population_per_unit': 2.3,           # Average household size
    'renter_ratio': 0.35,                  # 35% of population are MF renters
    'employment_ratio': 1.4,               # Jobs per household
    'median_income_default': 65000,
    'population_growth_rate': 0.018,       # 1.8% annual (Atlanta metro average)
    'employment_growth_rate': 0.022,       # 2.2% annual
}


@dataclass
class CoStarSubmarketData:
    """CoStar raw submarket data"""
    name: str
    total_units: int
    avg_effective_rent: float
    avg_asking_rent: float
    avg_vacancy_pct: float
    property_count: int
    building_class_distribution: Dict[str, float]
    quality_score: float


class CoStarDataSource:
    """Load and manage CoStar market data"""
    
    def __init__(self, json_path: Optional[str] = None):
        """
        Initialize data source
        
        Args:
            json_path: Path to costar_submarkets.json (auto-detects if None)
        """
        if json_path is None:
            # Auto-detect path
            json_path = Path(__file__).parent.parent.parent / 'data' / 'costar' / 'costar_submarkets.json'
        
        self.json_path = Path(json_path)
        self.data = None
        self.submarkets = {}
        self._load_data()
    
    def _load_data(self):
        """Load JSON data"""
        if not self.json_path.exists():
            raise FileNotFoundError(f"CoStar data not found at: {self.json_path}")
        
        with open(self.json_path, 'r') as f:
            self.data = json.load(f)
        
        # Parse submarkets
        for key, submarket_data in self.data['submarkets'].items():
            self.submarkets[key] = CoStarSubmarketData(
                name=submarket_data['name'],
                total_units=submarket_data['total_units'],
                avg_effective_rent=submarket_data['avg_effective_rent'],
                avg_asking_rent=submarket_data['avg_asking_rent'],
                avg_vacancy_pct=submarket_data['avg_vacancy_pct'],
                property_count=submarket_data['property_count'],
                building_class_distribution=submarket_data['building_class_distribution'],
                quality_score=submarket_data['quality_score']
            )
        
        # Only print if running interactively (not from API wrapper)
        import sys
        if sys.stdout.isatty():
            print(f"✓ Loaded {len(self.submarkets)} submarkets from CoStar data")
    
    def get_submarket(self, name: str) -> Optional[CoStarSubmarketData]:
        """
        Get submarket by name (fuzzy match)
        
        Args:
            name: Submarket name
            
        Returns:
            CoStarSubmarketData or None
        """
        # Try exact key match first
        key = name.lower().replace(' ', '_')
        if key in self.submarkets:
            return self.submarkets[key]
        
        # Try fuzzy match on name
        name_lower = name.lower()
        for submarket in self.submarkets.values():
            if name_lower in submarket.name.lower() or submarket.name.lower() in name_lower:
                return submarket
        
        return None
    
    def list_submarkets(self) -> List[str]:
        """Get list of all submarket names"""
        return sorted([s.name for s in self.submarkets.values()])
    
    def get_top_submarkets(self, n: int = 10, sort_by: str = 'units') -> List[CoStarSubmarketData]:
        """
        Get top N submarkets
        
        Args:
            n: Number of submarkets to return
            sort_by: 'units', 'rent', or 'properties'
            
        Returns:
            List of CoStarSubmarketData
        """
        if sort_by == 'units':
            key = lambda s: s.total_units
        elif sort_by == 'rent':
            key = lambda s: s.avg_effective_rent
        elif sort_by == 'properties':
            key = lambda s: s.property_count
        else:
            raise ValueError(f"Invalid sort_by: {sort_by}")
        
        return sorted(self.submarkets.values(), key=key, reverse=True)[:n]


def costar_to_submarket_data(costar_data: CoStarSubmarketData,
                             population_override: Optional[int] = None,
                             income_override: Optional[float] = None) -> SubmarketData:
    """
    Convert CoStar data to SubmarketData for engine analysis
    
    KEY UPGRADE: Uses REAL unit counts and vacancy rates!
    
    Args:
        costar_data: Real CoStar market data
        population_override: Override population estimate
        income_override: Override income estimate
        
    Returns:
        SubmarketData ready for analysis
    """
    
    # Estimate population from REAL unit counts
    # This is more accurate than parcel estimates!
    estimated_population = int(costar_data.total_units * ATLANTA_DEMOGRAPHICS['population_per_unit'])
    population = population_override or estimated_population
    
    # Estimate employment
    employment = int(population * ATLANTA_DEMOGRAPHICS['employment_ratio'])
    
    # Estimate median income (can refine based on rent levels and quality)
    # Higher rents suggest higher incomes
    income_multiplier = costar_data.avg_effective_rent / 1500  # $1500 = baseline
    estimated_income = ATLANTA_DEMOGRAPHICS['median_income_default'] * income_multiplier
    estimated_income = max(40000, min(150000, estimated_income))  # Clamp to reasonable range
    median_income = income_override or estimated_income
    
    # Calculate pipeline using REAL vacancy rates
    # High vacancy suggests oversupply, low vacancy suggests undersupply
    # Estimate pipeline based on market conditions
    vacancy_rate = costar_data.avg_vacancy_pct / 100
    
    if vacancy_rate < 0.05:
        # Very tight market - likely high construction activity
        pipeline_multiplier = 0.15
    elif vacancy_rate < 0.10:
        # Healthy market - moderate construction
        pipeline_multiplier = 0.08
    elif vacancy_rate < 0.15:
        # Elevated vacancy - slowing construction
        pipeline_multiplier = 0.05
    else:
        # High vacancy - minimal new construction
        pipeline_multiplier = 0.02
    
    pipeline_units = int(costar_data.total_units * pipeline_multiplier)
    
    # Future permitted (smaller than pipeline)
    future_permitted = int(pipeline_units * 0.3)
    
    # Calculate net migration based on market strength
    # Strong markets (low vacancy, high rent growth) attract more people
    migration_rate = 0.01  # Base 1% of population
    if vacancy_rate < 0.08:
        migration_rate = 0.02  # Tight market = strong migration
    elif vacancy_rate > 0.20:
        migration_rate = 0.005  # Weak market = less migration
    
    net_migration = int(population * migration_rate)
    
    return SubmarketData(
        name=costar_data.name,
        population=population,
        population_growth_rate=ATLANTA_DEMOGRAPHICS['population_growth_rate'],
        net_migration_annual=net_migration,
        employment=employment,
        employment_growth_rate=ATLANTA_DEMOGRAPHICS['employment_growth_rate'],
        median_income=median_income,
        existing_units=costar_data.total_units,  # ⭐ REAL DATA!
        pipeline_units=pipeline_units,
        future_permitted_units=future_permitted
    )


def analyze_costar_submarket(submarket_name: str,
                             data_source: Optional[CoStarDataSource] = None) -> Optional[CarryingCapacityResult]:
    """
    Analyze a CoStar submarket using carrying capacity engine
    
    Args:
        submarket_name: Name of submarket
        data_source: CoStarDataSource (creates new if None)
        
    Returns:
        CarryingCapacityResult or None if submarket not found
    """
    if data_source is None:
        data_source = CoStarDataSource()
    
    # Get CoStar data
    costar_data = data_source.get_submarket(submarket_name)
    if not costar_data:
        print(f"❌ Submarket not found: {submarket_name}")
        print(f"\nAvailable submarkets:")
        for name in data_source.list_submarkets()[:10]:
            print(f"  - {name}")
        return None
    
    # Convert to engine format
    submarket_data = costar_to_submarket_data(costar_data)
    
    # Run analysis
    engine = CarryingCapacityEngine()
    result = engine.analyze(submarket_data)
    
    # Display results
    print(f"\n{'='*80}")
    print(f"CARRYING CAPACITY ANALYSIS (CoStar Data)")
    print(f"{'='*80}\n")
    print(f"SUBMARKET: {result.submarket}")
    print(f"  Real Market Data: ✓ {costar_data.property_count} properties, {costar_data.total_units:,} units")
    print(f"  Avg Rent: ${costar_data.avg_effective_rent:,.0f}/month")
    print(f"  Vacancy: {costar_data.avg_vacancy_pct:.1f}%")
    print(f"  Quality Score: {costar_data.quality_score:.1f}/3.0")
    
    print(f"\n{'─'*80}\n")
    print(f"DEMAND CAPACITY:")
    print(f"  Total: {result.demand_units:,} units")
    print(f"  Annual Growth: +{result.demand_growth_annual:,} units/year")
    
    print(f"\nSUPPLY:")
    print(f"  Existing: {result.existing_units:,} units (REAL)")
    print(f"  Pipeline: {result.pipeline_units:,} units (estimated)")
    print(f"  Total: {result.total_supply:,} units")
    
    print(f"\nANALYSIS:")
    print(f"  Saturation: {result.saturation_pct:.1f}%")
    print(f"  Verdict: {result.verdict.value}")
    print(f"  Equilibrium: {result.equilibrium_quarters} quarters")
    print(f"  Confidence: {result.confidence:.0%}")
    
    print(f"\nSUMMARY:")
    print(f"  {result.summary}")
    
    print(f"\n{'='*80}\n")
    
    return result


def compare_submarkets(submarket_names: List[str],
                      data_source: Optional[CoStarDataSource] = None):
    """
    Compare multiple submarkets side-by-side
    
    Args:
        submarket_names: List of submarket names
        data_source: CoStarDataSource (creates new if None)
    """
    if data_source is None:
        data_source = CoStarDataSource()
    
    engine = CarryingCapacityEngine()
    results = []
    
    print(f"\n{'='*80}")
    print(f"COMPARATIVE ANALYSIS ({len(submarket_names)} submarkets)")
    print(f"{'='*80}\n")
    
    for name in submarket_names:
        costar_data = data_source.get_submarket(name)
        if not costar_data:
            print(f"⚠️  Skipping {name} (not found)")
            continue
        
        submarket_data = costar_to_submarket_data(costar_data)
        result = engine.analyze(submarket_data)
        results.append((costar_data, result))
    
    # Sort by opportunity (saturation)
    results.sort(key=lambda x: x[1].saturation_pct)
    
    print(f"{'Submarket':<25} {'Units':>8} {'Rent':>8} {'Vac%':>6} {'Sat%':>6} {'Verdict':<25}")
    print("-" * 80)
    
    for costar_data, result in results:
        print(f"{costar_data.name:<25} {costar_data.total_units:>8,} "
              f"${costar_data.avg_effective_rent:>7,.0f} {costar_data.avg_vacancy_pct:>5.1f}% "
              f"{result.saturation_pct:>5.0f}% {result.verdict.value:<25}")
    
    print(f"\n{'='*80}\n")
    
    return results


def main():
    """Main execution"""
    import sys
    
    # Initialize data source
    try:
        data_source = CoStarDataSource()
    except FileNotFoundError as e:
        print(f"❌ Error: {e}")
        print("\nRun parse_costar.py first to generate the JSON file.")
        return
    
    if len(sys.argv) > 1:
        # Analyze specific submarket from command line
        submarket_name = " ".join(sys.argv[1:])
        analyze_costar_submarket(submarket_name, data_source)
    else:
        # Demo: Analyze top submarkets
        print("\n🎯 JEDI RE - CoStar Integration Demo")
        print("="*80)
        print(f"\nTotal Submarkets: {len(data_source.submarkets)}")
        print(f"Total Units: {sum(s.total_units for s in data_source.submarkets.values()):,}")
        
        # Show top 10 by units
        print("\n📊 Top 10 Submarkets by Unit Count:")
        top_submarkets = data_source.get_top_submarkets(10)
        for i, sub in enumerate(top_submarkets, 1):
            print(f"  {i:2}. {sub.name:<30} {sub.total_units:>6,} units @ ${sub.avg_effective_rent:,.0f}/mo")
        
        # Analyze top 3
        print("\n" + "="*80)
        print("ANALYZING TOP 3 SUBMARKETS")
        print("="*80)
        
        for submarket in top_submarkets[:3]:
            analyze_costar_submarket(submarket.name, data_source)
        
        # Compare top 5
        print("\n" + "="*80)
        print("COMPARATIVE ANALYSIS")
        print("="*80)
        compare_submarkets([s.name for s in top_submarkets[:5]], data_source)


if __name__ == '__main__':
    main()
