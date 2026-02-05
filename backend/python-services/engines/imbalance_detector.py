"""
JEDI RE - Supply-Demand Imbalance Detector
Synthesizes Signal Processing + Carrying Capacity into actionable verdicts

Enhanced to use real CoStar historical market data when available
"""
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional
from signal_processing import SignalProcessor, RentSignal
from carrying_capacity import CarryingCapacityEngine, CarryingCapacityResult, SubmarketData, SupplyVerdict

try:
    from costar_signal_wrapper import CoStarSignalProcessor, DemandSignal as CoStarDemandSignal
    COSTAR_AVAILABLE = True
except ImportError:
    COSTAR_AVAILABLE = False


class ImbalanceVerdict(Enum):
    """Overall market opportunity assessment"""
    STRONG_OPPORTUNITY = "STRONG_OPPORTUNITY"
    MODERATE_OPPORTUNITY = "MODERATE_OPPORTUNITY"
    NEUTRAL = "NEUTRAL"
    CAUTION = "CAUTION"
    AVOID = "AVOID"


class DemandStrength(Enum):
    """Demand signal classification"""
    STRONG = "STRONG"
    MODERATE = "MODERATE"
    WEAK = "WEAK"


@dataclass
class DemandSignal:
    """Processed demand indicators"""
    strength: DemandStrength
    score: int  # 0-100
    confidence: float  # 0-1
    
    # Components
    rent_growth_rate: float  # Annualized
    rent_growth_confidence: float
    search_trend_change: Optional[float] = None
    migration_annual: Optional[int] = None
    
    summary: str = ""


@dataclass
class ImbalanceSignal:
    """Combined supply-demand analysis"""
    submarket: str
    verdict: ImbalanceVerdict
    composite_score: int  # 0-100
    confidence: float  # 0-1
    
    # Component signals
    demand_signal: DemandSignal
    supply_signal: CarryingCapacityResult
    
    # Actionable output
    recommendation: str
    key_factors: List[str]
    risks: List[str]


class ImbalanceDetector:
    """
    Synthesizes multiple method engines into unified opportunity assessment
    
    Combines:
    1. Signal Processing (rent trends, noise filtering)
    2. Carrying Capacity (supply analysis)
    3. Search trends (demand validation)
    
    Outputs: Simple verdict + detailed breakdown
    """
    
    # Scoring weights
    DEMAND_WEIGHT = 0.50
    SUPPLY_WEIGHT = 0.50
    
    def __init__(self, use_costar_signals: bool = False):
        """
        Initialize imbalance detector
        
        Args:
            use_costar_signals: If True, use real CoStar market data instead of user-provided rent arrays
        """
        self.signal_processor = SignalProcessor()
        self.capacity_engine = CarryingCapacityEngine()
        self.use_costar_signals = use_costar_signals and COSTAR_AVAILABLE
        
        if self.use_costar_signals:
            self.costar_processor = CoStarSignalProcessor()
        else:
            self.costar_processor = None
    
    def process_demand_signal_from_costar(self,
                                        search_trend_change: Optional[float] = None,
                                        migration_annual: Optional[int] = None,
                                        use_full_history: bool = False) -> DemandSignal:
        """
        Analyze demand strength using REAL CoStar market data
        
        Args:
            search_trend_change: YoY change in search interest (optional)
            migration_annual: Net annual migration (optional)
            use_full_history: Use 26-year history (True) or 6-year complete dataset (False)
            
        Returns:
            DemandSignal with strength classification based on real data
        """
        if not self.use_costar_signals or self.costar_processor is None:
            raise ValueError("CoStar signals not enabled. Initialize with use_costar_signals=True")
        
        # Get processed market signal from CoStar data
        costar_signal = self.costar_processor.get_market_signal(use_full_history=use_full_history)
        
        # Extract growth rate and confidence
        growth_rate = costar_signal.rent_growth_rate
        rent_confidence = costar_signal.confidence
        
        # Score demand (0-100)
        demand_score = self._calculate_demand_score(
            growth_rate, 
            rent_confidence,
            search_trend_change
        )
        
        # Classify strength
        if demand_score >= 70:
            strength = DemandStrength.STRONG
        elif demand_score >= 40:
            strength = DemandStrength.MODERATE
        else:
            strength = DemandStrength.WEAK
        
        # Overall confidence (weighted by data availability)
        confidence = rent_confidence
        if search_trend_change is not None:
            confidence = (confidence * 0.7 + 0.3)  # Boost for having search data
        
        # Summary
        summary = self._generate_demand_summary(
            strength, growth_rate, search_trend_change, migration_annual
        )
        summary += f" [Real CoStar data: {costar_signal.data_points} months]"
        
        return DemandSignal(
            strength=strength,
            score=demand_score,
            confidence=confidence,
            rent_growth_rate=growth_rate,
            rent_growth_confidence=rent_confidence,
            search_trend_change=search_trend_change,
            migration_annual=migration_annual,
            summary=summary
        )
    
    def process_demand_signal(self, rent_timeseries: List[float],
                             search_trend_change: Optional[float] = None,
                             migration_annual: Optional[int] = None) -> DemandSignal:
        """
        Analyze demand strength from rent trends + other signals
        
        Args:
            rent_timeseries: List of rent values (weekly/monthly)
            search_trend_change: YoY change in search interest (optional)
            migration_annual: Net annual migration (optional)
            
        Returns:
            DemandSignal with strength classification
        """
        # Process rent signal
        rent_signal = self.signal_processor.process_rent_signal(rent_timeseries)
        growth_rate = self.signal_processor.calculate_growth_rate(rent_signal.clean_trend)
        
        # Score demand (0-100)
        demand_score = self._calculate_demand_score(
            growth_rate, 
            rent_signal.confidence,
            search_trend_change
        )
        
        # Classify strength
        if demand_score >= 70:
            strength = DemandStrength.STRONG
        elif demand_score >= 40:
            strength = DemandStrength.MODERATE
        else:
            strength = DemandStrength.WEAK
        
        # Overall confidence (weighted by data availability)
        confidence = rent_signal.confidence
        if search_trend_change is not None:
            confidence = (confidence * 0.7 + 0.3)  # Boost for having search data
        
        # Summary
        summary = self._generate_demand_summary(
            strength, growth_rate, search_trend_change, migration_annual
        )
        
        return DemandSignal(
            strength=strength,
            score=demand_score,
            confidence=confidence,
            rent_growth_rate=growth_rate,
            rent_growth_confidence=rent_signal.confidence,
            search_trend_change=search_trend_change,
            migration_annual=migration_annual,
            summary=summary
        )
    
    def _calculate_demand_score(self, growth_rate: float, 
                                confidence: float,
                                search_trend_change: Optional[float]) -> int:
        """Convert demand indicators into 0-100 score"""
        
        # Base score from rent growth
        # 5%+ growth = 100, 0% growth = 50, -5% = 0
        rent_component = min(100, max(0, (growth_rate + 0.05) * 1000))
        
        # Adjust by confidence
        rent_component *= confidence
        
        # Boost/penalize based on search trends if available
        if search_trend_change is not None:
            search_multiplier = 1.0 + (search_trend_change * 0.5)  # +20% search = 1.1x
            rent_component *= search_multiplier
        
        return int(min(100, max(0, rent_component)))
    
    def _generate_demand_summary(self, strength: DemandStrength, 
                                 growth_rate: float,
                                 search_trend_change: Optional[float],
                                 migration_annual: Optional[int]) -> str:
        """Generate human-readable demand summary"""
        
        parts = [f"Demand is {strength.value.lower()}"]
        
        # Rent growth
        parts.append(f"with rent growth at {growth_rate:+.1%} annually")
        
        # Search trends
        if search_trend_change is not None:
            if search_trend_change > 0.1:
                parts.append(f"and strong search interest (+{search_trend_change:.0%} YoY)")
            elif search_trend_change < -0.1:
                parts.append(f"but declining search interest ({search_trend_change:.0%} YoY)")
        
        # Migration
        if migration_annual is not None:
            if migration_annual > 500:
                parts.append(f"supported by net in-migration of {migration_annual:,} people/year")
            elif migration_annual < -500:
                parts.append(f"weakened by net out-migration of {abs(migration_annual):,} people/year")
        
        return ". ".join(parts) + "."
    
    def analyze_imbalance(self, submarket_data: SubmarketData,
                         rent_timeseries: Optional[List[float]] = None,
                         search_trend_change: Optional[float] = None,
                         use_costar_data: bool = None) -> ImbalanceSignal:
        """
        Full supply-demand imbalance analysis
        
        Args:
            submarket_data: SubmarketData for carrying capacity calculation
            rent_timeseries: Rent data for signal processing (optional if using CoStar)
            search_trend_change: Optional search trend data
            use_costar_data: If True, use real CoStar market data. If None, auto-detect from initialization
            
        Returns:
            ImbalanceSignal with verdict and recommendations
        """
        # Determine data source
        should_use_costar = use_costar_data if use_costar_data is not None else self.use_costar_signals
        
        # Process demand signal
        if should_use_costar and self.costar_processor is not None:
            # Use real CoStar market data
            demand_signal = self.process_demand_signal_from_costar(
                search_trend_change=search_trend_change,
                migration_annual=submarket_data.net_migration_annual,
                use_full_history=False  # Default to 6-year complete dataset
            )
        elif rent_timeseries is not None:
            # Use user-provided rent timeseries
            demand_signal = self.process_demand_signal(
                rent_timeseries,
                search_trend_change,
                submarket_data.net_migration_annual
            )
        else:
            raise ValueError("Must provide either rent_timeseries or enable CoStar data")
        
        # Process supply signal
        supply_signal = self.capacity_engine.analyze(submarket_data)
        
        # Calculate composite score
        composite_score = self._calculate_composite_score(
            demand_signal, supply_signal
        )
        
        # Determine verdict
        verdict = self._determine_verdict(
            demand_signal, supply_signal, composite_score
        )
        
        # Overall confidence (lowest of the two)
        confidence = min(demand_signal.confidence, supply_signal.confidence)
        
        # Generate recommendation
        recommendation = self._generate_recommendation(
            verdict, demand_signal, supply_signal
        )
        
        # Identify key factors and risks
        key_factors = self._identify_key_factors(demand_signal, supply_signal)
        risks = self._identify_risks(demand_signal, supply_signal)
        
        return ImbalanceSignal(
            submarket=submarket_data.name,
            verdict=verdict,
            composite_score=composite_score,
            confidence=confidence,
            demand_signal=demand_signal,
            supply_signal=supply_signal,
            recommendation=recommendation,
            key_factors=key_factors,
            risks=risks
        )
    
    def _calculate_composite_score(self, demand: DemandSignal, 
                                   supply: CarryingCapacityResult) -> int:
        """
        Weighted composite of demand + supply scores
        
        Logic:
        - Strong demand + undersupplied = HIGH score
        - Weak demand + oversupplied = LOW score
        """
        demand_score = demand.score
        
        # Convert supply verdict to score (inverted - undersupply = good)
        supply_score = self._supply_verdict_to_score(supply.verdict, supply.saturation_pct)
        
        composite = (
            demand_score * self.DEMAND_WEIGHT +
            supply_score * self.SUPPLY_WEIGHT
        )
        
        return int(composite)
    
    def _supply_verdict_to_score(self, verdict: SupplyVerdict, saturation: float) -> int:
        """Convert supply verdict to 0-100 score (undersupplied = high score)"""
        
        if verdict == SupplyVerdict.CRITICALLY_UNDERSUPPLIED:
            return 95
        elif verdict == SupplyVerdict.UNDERSUPPLIED:
            return 75
        elif verdict == SupplyVerdict.BALANCED:
            return 50
        elif verdict == SupplyVerdict.OVERSUPPLIED:
            return 25
        else:  # CRITICALLY_OVERSUPPLIED
            return 5
    
    def _determine_verdict(self, demand: DemandSignal, 
                          supply: CarryingCapacityResult,
                          composite_score: int) -> ImbalanceVerdict:
        """Classify overall opportunity"""
        
        # Strong opportunity: Good demand + undersupplied
        if (demand.strength == DemandStrength.STRONG and 
            supply.verdict in [SupplyVerdict.UNDERSUPPLIED, SupplyVerdict.CRITICALLY_UNDERSUPPLIED]):
            return ImbalanceVerdict.STRONG_OPPORTUNITY
        
        # Avoid: Weak demand + oversupplied
        if (demand.strength == DemandStrength.WEAK and 
            supply.verdict in [SupplyVerdict.OVERSUPPLIED, SupplyVerdict.CRITICALLY_OVERSUPPLIED]):
            return ImbalanceVerdict.AVOID
        
        # Use composite score for everything else
        if composite_score >= 70:
            return ImbalanceVerdict.STRONG_OPPORTUNITY
        elif composite_score >= 55:
            return ImbalanceVerdict.MODERATE_OPPORTUNITY
        elif composite_score >= 40:
            return ImbalanceVerdict.NEUTRAL
        elif composite_score >= 25:
            return ImbalanceVerdict.CAUTION
        else:
            return ImbalanceVerdict.AVOID
    
    def _generate_recommendation(self, verdict: ImbalanceVerdict,
                                demand: DemandSignal,
                                supply: CarryingCapacityResult) -> str:
        """Generate actionable recommendation"""
        
        if verdict == ImbalanceVerdict.STRONG_OPPORTUNITY:
            return (f"Strong buy signal for {supply.submarket}. "
                   f"Demand is {demand.strength.value.lower()} while supply is {supply.verdict.value.lower()}. "
                   f"Favorable conditions for rent growth and occupancy.")
        
        elif verdict == ImbalanceVerdict.MODERATE_OPPORTUNITY:
            return (f"Moderate opportunity in {supply.submarket}. "
                   f"Fundamentals are solid but not exceptional. "
                   f"Good value-add or operational improvement plays.")
        
        elif verdict == ImbalanceVerdict.NEUTRAL:
            return (f"Neutral outlook for {supply.submarket}. "
                   f"Market is balanced. Focus on execution and operational efficiency "
                   f"rather than market tailwinds.")
        
        elif verdict == ImbalanceVerdict.CAUTION:
            return (f"Exercise caution in {supply.submarket}. "
                   f"Supply is {supply.verdict.value.lower()} with {demand.strength.value.lower()} demand. "
                   f"Expect {supply.equilibrium_quarters} quarters until equilibrium. "
                   f"Underwrite conservatively.")
        
        else:  # AVOID
            return (f"Avoid new investments in {supply.submarket}. "
                   f"Oversupply with weak demand creates downward pressure on rents. "
                   f"Wait for market correction.")
    
    def _identify_key_factors(self, demand: DemandSignal, 
                             supply: CarryingCapacityResult) -> List[str]:
        """Extract key positive factors"""
        factors = []
        
        if demand.rent_growth_rate > 0.03:
            factors.append(f"Strong rent growth: {demand.rent_growth_rate:+.1%} annually")
        
        if supply.verdict in [SupplyVerdict.UNDERSUPPLIED, SupplyVerdict.CRITICALLY_UNDERSUPPLIED]:
            factors.append(f"Supply constrained: {supply.saturation_pct:.1f}% saturation")
        
        if demand.migration_annual and demand.migration_annual > 500:
            factors.append(f"Population influx: +{demand.migration_annual:,} net migration")
        
        if demand.search_trend_change and demand.search_trend_change > 0.15:
            factors.append(f"Rising interest: search volume +{demand.search_trend_change:.0%}")
        
        return factors
    
    def _identify_risks(self, demand: DemandSignal, 
                       supply: CarryingCapacityResult) -> List[str]:
        """Extract key risks"""
        risks = []
        
        if supply.verdict in [SupplyVerdict.OVERSUPPLIED, SupplyVerdict.CRITICALLY_OVERSUPPLIED]:
            risks.append(f"Oversupply: {supply.pipeline_units:,} units in pipeline")
        
        if demand.rent_growth_rate < 0:
            risks.append(f"Declining rents: {demand.rent_growth_rate:.1%} annually")
        
        if supply.equilibrium_quarters > 12:
            risks.append(f"Long absorption: {supply.equilibrium_quarters} quarters to equilibrium")
        
        if demand.confidence < 0.7 or supply.confidence < 0.7:
            risks.append(f"Data uncertainty: {min(demand.confidence, supply.confidence):.0%} confidence")
        
        return risks


# Example usage
if __name__ == "__main__":
    import numpy as np
    
    # Simulated data for Buckhead, Atlanta
    submarket = SubmarketData(
        name="Buckhead, Atlanta",
        population=48_200,
        population_growth_rate=0.012,
        net_migration_annual=580,
        employment=35_000,
        employment_growth_rate=0.018,
        median_income=95_000,
        existing_units=11_240,
        pipeline_units=2_840,
        future_permitted_units=420
    )
    
    # Simulate 2 years of weekly rent data (slight upward trend + noise)
    weeks = 104
    base_rent = 2000
    growth = 0.028  # 2.8% annual
    time = np.arange(weeks)
    rent_trend = base_rent * (1 + growth * time / 52)
    seasonal = 30 * np.sin(2 * np.pi * time / 52)
    noise = np.random.normal(0, 25, weeks)
    rent_timeseries = (rent_trend + seasonal + noise).tolist()
    
    # Search trend change (15% increase YoY)
    search_trend_change = 0.15
    
    # Analyze
    detector = ImbalanceDetector()
    result = detector.analyze_imbalance(
        submarket, 
        rent_timeseries,
        search_trend_change
    )
    
    # Display results
    print(f"\n{'='*70}")
    print(f"SUPPLY-DEMAND IMBALANCE ANALYSIS")
    print(f"{'='*70}\n")
    print(f"SUBMARKET: {result.submarket}")
    print(f"VERDICT: {result.verdict.value}")
    print(f"COMPOSITE SCORE: {result.composite_score}/100 (±{(1-result.confidence)*100:.0f} pts)")
    print(f"\n{'─'*70}\n")
    print(f"DEMAND SIGNAL: {result.demand_signal.strength.value} ●●●○○")
    print(f"  Score: {result.demand_signal.score}/100")
    print(f"  {result.demand_signal.summary}")
    print(f"\nSUPPLY SIGNAL: {result.supply_signal.verdict.value} ●●●●○")
    print(f"  Saturation: {result.supply_signal.saturation_pct:.1f}%")
    print(f"  {result.supply_signal.summary}")
    print(f"\n{'─'*70}\n")
    print(f"RECOMMENDATION:")
    print(f"  {result.recommendation}")
    
    if result.key_factors:
        print(f"\nKEY FACTORS:")
        for factor in result.key_factors:
            print(f"  ✓ {factor}")
    
    if result.risks:
        print(f"\nRISKS:")
        for risk in result.risks:
            print(f"  ⚠ {risk}")
    
    print(f"\n{'='*70}\n")
