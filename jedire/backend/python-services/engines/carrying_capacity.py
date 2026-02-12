"""
JEDI RE - Carrying Capacity Engine
Ecological framework for sustainable supply analysis
"""
from dataclasses import dataclass
from typing import Optional
from enum import Enum


class SupplyVerdict(Enum):
    """Supply-demand balance verdict"""
    CRITICALLY_UNDERSUPPLIED = "CRITICALLY_UNDERSUPPLIED"
    UNDERSUPPLIED = "UNDERSUPPLIED"
    BALANCED = "BALANCED"
    OVERSUPPLIED = "OVERSUPPLIED"
    CRITICALLY_OVERSUPPLIED = "CRITICALLY_OVERSUPPLIED"


@dataclass
class SubmarketData:
    """Input data for carrying capacity calculation"""
    name: str
    population: int
    population_growth_rate: float  # Annual rate (e.g., 0.021 = 2.1%)
    net_migration_annual: int      # Net people moving in per year
    employment: int
    employment_growth_rate: float  # Annual rate
    median_income: float
    existing_units: int
    pipeline_units: int            # Units under construction
    future_permitted_units: int    # Permitted but not started


@dataclass
class CarryingCapacityResult:
    """Output from carrying capacity analysis"""
    submarket: str
    
    # Demand metrics
    demand_units: int
    demand_growth_annual: int
    
    # Supply metrics
    total_supply: int
    existing_units: int
    pipeline_units: int
    
    # Analysis
    saturation_pct: float          # >100% = oversupplied
    equilibrium_quarters: int      # Quarters until balance
    verdict: SupplyVerdict
    confidence: float              # 0-1
    
    # Human-readable
    summary: str


class CarryingCapacityEngine:
    """
    Calculate sustainable supply levels using ecological principles
    
    Key concept: Every submarket has a "carrying capacity" - the maximum
    number of housing units it can support given economic fundamentals.
    """
    
    # Constants for demand calculation
    UNITS_PER_CAPITA = 0.35        # ~35% of population are renters in MF
    UNITS_PER_JOB_GROWTH = 0.80    # 1 new job = 0.8 new rental units needed
    INCOME_THRESHOLD_MULTIPLIER = 0.30  # Rent should be ~30% of income
    
    # Saturation thresholds
    CRITICAL_UNDERSUPPLY = 0.85
    UNDERSUPPLY = 0.95
    BALANCED_LOW = 0.95
    BALANCED_HIGH = 1.05
    OVERSUPPLY = 1.15
    
    def calculate_demand_capacity(self, submarket: SubmarketData) -> int:
        """
        Calculate total sustainable demand for rental units
        
        Uses multiple demand signals:
        1. Population-based demand (renters as % of population)
        2. Job growth (new jobs create housing demand)
        3. Income-based affordability ceiling
        
        Args:
            submarket: SubmarketData object
            
        Returns:
            Total sustainable demand in units
        """
        # Base demand from population
        population_demand = int(submarket.population * self.UNITS_PER_CAPITA)
        
        # Demand from job growth (annual)
        job_growth_annual = int(submarket.employment * submarket.employment_growth_rate)
        job_demand = int(job_growth_annual * self.UNITS_PER_JOB_GROWTH)
        
        # Total demand
        total_demand = population_demand + job_demand
        
        return total_demand
    
    def calculate_supply(self, submarket: SubmarketData) -> int:
        """
        Calculate total supply (existing + pipeline + future)
        
        Args:
            submarket: SubmarketData object
            
        Returns:
            Total supply in units
        """
        return (submarket.existing_units + 
                submarket.pipeline_units + 
                submarket.future_permitted_units)
    
    def calculate_saturation(self, demand: int, supply: int) -> float:
        """
        Calculate saturation percentage
        
        Args:
            demand: Total demand capacity
            supply: Total supply
            
        Returns:
            Saturation as decimal (1.0 = 100% = perfectly balanced)
        """
        if demand == 0:
            return float('inf')
        
        return supply / demand
    
    def determine_verdict(self, saturation: float) -> SupplyVerdict:
        """
        Classify supply-demand balance
        
        Args:
            saturation: Saturation percentage
            
        Returns:
            SupplyVerdict enum
        """
        if saturation < self.CRITICAL_UNDERSUPPLY:
            return SupplyVerdict.CRITICALLY_UNDERSUPPLIED
        elif saturation < self.UNDERSUPPLY:
            return SupplyVerdict.UNDERSUPPLIED
        elif saturation <= self.BALANCED_HIGH:
            return SupplyVerdict.BALANCED
        elif saturation <= self.OVERSUPPLY:
            return SupplyVerdict.OVERSUPPLIED
        else:
            return SupplyVerdict.CRITICALLY_OVERSUPPLIED
    
    def estimate_equilibrium_timeline(self, submarket: SubmarketData, 
                                     saturation: float) -> int:
        """
        Estimate quarters until supply-demand equilibrium
        
        Args:
            submarket: SubmarketData object
            saturation: Current saturation level
            
        Returns:
            Number of quarters until equilibrium (0 if balanced)
        """
        if self.BALANCED_LOW <= saturation <= self.BALANCED_HIGH:
            return 0  # Already balanced
        
        # Calculate quarterly absorption rate
        population_growth_quarterly = submarket.population * submarket.population_growth_rate / 4
        demand_growth_quarterly = int(population_growth_quarterly * self.UNITS_PER_CAPITA)
        
        if demand_growth_quarterly == 0:
            return 999  # No growth = long time to equilibrium
        
        # Calculate excess supply
        total_supply = self.calculate_supply(submarket)
        total_demand = self.calculate_demand_capacity(submarket)
        excess_units = total_supply - total_demand
        
        # Quarters to absorb excess
        if excess_units <= 0:
            return 0
        
        quarters = int(excess_units / demand_growth_quarterly)
        
        return min(quarters, 40)  # Cap at 10 years
    
    def calculate_confidence(self, submarket: SubmarketData) -> float:
        """
        Calculate confidence in the analysis based on data quality
        
        Factors:
        - Market size (larger = more reliable)
        - Growth volatility (stable = more reliable)
        - Data completeness
        
        Args:
            submarket: SubmarketData object
            
        Returns:
            Confidence score (0-1)
        """
        confidence = 1.0
        
        # Penalize small markets (less stable)
        if submarket.population < 10000:
            confidence *= 0.7
        elif submarket.population < 30000:
            confidence *= 0.85
        
        # Penalize extreme growth rates (less predictable)
        if abs(submarket.population_growth_rate) > 0.05:  # >5% growth
            confidence *= 0.8
        
        # Penalize if no pipeline data
        if submarket.pipeline_units == 0 and submarket.existing_units > 1000:
            confidence *= 0.9  # Might be missing data
        
        return confidence
    
    def analyze(self, submarket: SubmarketData) -> CarryingCapacityResult:
        """
        Full carrying capacity analysis
        
        Args:
            submarket: SubmarketData object
            
        Returns:
            CarryingCapacityResult with complete analysis
        """
        # Calculate demand capacity
        demand = self.calculate_demand_capacity(submarket)
        demand_growth = int(demand * submarket.population_growth_rate)
        
        # Calculate supply
        supply = self.calculate_supply(submarket)
        
        # Saturation analysis
        saturation = self.calculate_saturation(demand, supply)
        verdict = self.determine_verdict(saturation)
        
        # Timeline to equilibrium
        equilibrium_quarters = self.estimate_equilibrium_timeline(submarket, saturation)
        
        # Confidence
        confidence = self.calculate_confidence(submarket)
        
        # Generate summary
        summary = self._generate_summary(
            submarket, demand, supply, saturation, verdict, equilibrium_quarters
        )
        
        return CarryingCapacityResult(
            submarket=submarket.name,
            demand_units=demand,
            demand_growth_annual=demand_growth,
            total_supply=supply,
            existing_units=submarket.existing_units,
            pipeline_units=submarket.pipeline_units + submarket.future_permitted_units,
            saturation_pct=saturation * 100,
            equilibrium_quarters=equilibrium_quarters,
            verdict=verdict,
            confidence=confidence,
            summary=summary
        )
    
    def _generate_summary(self, submarket: SubmarketData, demand: int, 
                         supply: int, saturation: float, verdict: SupplyVerdict,
                         quarters: int) -> str:
        """Generate human-readable summary"""
        
        imbalance_pct = (saturation - 1.0) * 100
        
        if verdict in [SupplyVerdict.CRITICALLY_OVERSUPPLIED, SupplyVerdict.OVERSUPPLIED]:
            return (f"{submarket.name} is {verdict.value.lower()} with {saturation*100:.1f}% "
                   f"saturation ({imbalance_pct:+.1f}%). Excess supply will take "
                   f"~{quarters} quarters to absorb. Exercise caution with new investments.")
        
        elif verdict in [SupplyVerdict.CRITICALLY_UNDERSUPPLIED, SupplyVerdict.UNDERSUPPLIED]:
            return (f"{submarket.name} is {verdict.value.lower()} with {saturation*100:.1f}% "
                   f"saturation ({imbalance_pct:+.1f}%). Strong demand supports development "
                   f"and rent growth.")
        
        else:
            return (f"{submarket.name} is balanced with {saturation*100:.1f}% saturation. "
                   f"Supply and demand are in equilibrium.")


# Example usage
if __name__ == "__main__":
    # Buckhead, Atlanta example
    buckhead = SubmarketData(
        name="Buckhead, Atlanta",
        population=48_200,
        population_growth_rate=0.012,  # 1.2% annual
        net_migration_annual=580,
        employment=35_000,
        employment_growth_rate=0.018,  # 1.8% annual
        median_income=95_000,
        existing_units=11_240,
        pipeline_units=2_840,
        future_permitted_units=420
    )
    
    engine = CarryingCapacityEngine()
    result = engine.analyze(buckhead)
    
    print(f"\n{'='*60}")
    print(f"CARRYING CAPACITY ANALYSIS: {result.submarket}")
    print(f"{'='*60}\n")
    print(f"DEMAND:")
    print(f"  Total Capacity: {result.demand_units:,} units")
    print(f"  Annual Growth: +{result.demand_growth_annual:,} units/year")
    print(f"\nSUPPLY:")
    print(f"  Existing: {result.existing_units:,} units")
    print(f"  Pipeline: {result.pipeline_units:,} units")
    print(f"  Total: {result.total_supply:,} units")
    print(f"\nANALYSIS:")
    print(f"  Saturation: {result.saturation_pct:.1f}%")
    print(f"  Verdict: {result.verdict.value}")
    print(f"  Time to Equilibrium: {result.equilibrium_quarters} quarters")
    print(f"  Confidence: {result.confidence:.0%}")
    print(f"\nSUMMARY:")
    print(f"  {result.summary}")
    print(f"\n{'='*60}\n")
