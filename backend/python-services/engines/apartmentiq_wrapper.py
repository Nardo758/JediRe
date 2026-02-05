"""
ApartmentIQ Integration Wrapper
Processes ApartmentIQ data for JEDI RE engines
"""

import json
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict

from signal_processing import SignalProcessor


@dataclass
class ApartmentIQSignal:
    """Market signal derived from ApartmentIQ data"""
    # Signal Processing
    rent_growth_rate: float  # Annualized growth rate
    confidence: float  # 0-1 based on data quality
    seasonal_component: float  # Seasonal adjustment factor
    trend_component: float  # Current trend value
    noise_level: float  # Historical noise/volatility
    
    # Supply Metrics
    total_supply: int  # Total units in submarket
    vacancy_rate: float  # 0-1 (e.g., 0.203 = 20.3%)
    available_units: int  # Currently available
    days_on_market: float  # Average across properties
    
    # Demand Intelligence (ApartmentIQ proprietary)
    opportunity_score: float  # 0-10 market opportunity
    negotiation_success_rate: float  # 0-1 success rate
    concessions_prevalence: float  # 0-1 % with concessions
    market_pressure_index: float  # 0-10 (higher = softer market)
    
    # Metadata
    data_points: int  # Number of properties analyzed
    current_rent: float  # Latest average rent
    processed_at: str  # ISO timestamp
    data_source: str  # "apartmentiq"


@dataclass
class ApartmentIQCarryingCapacity:
    """Supply metrics from ApartmentIQ"""
    total_supply: int  # Existing units
    vacancy_rate: float  # Current vacancy
    available_units: int  # Available now
    properties_count: int  # Number of properties
    
    # Building quality mix
    class_a_pct: float  # 0-1
    class_b_pct: float  # 0-1
    class_c_pct: float  # 0-1
    
    # Unit mix
    studio_pct: float
    one_bed_pct: float
    two_bed_pct: float
    three_bed_pct: float
    
    # Pricing
    avg_rent: float
    rent_by_type: Dict[str, float]  # studio, 1bed, 2bed, 3bed
    
    # Metadata
    confidence: float
    data_source: str


@dataclass
class ApartmentIQImbalance:
    """Demand/supply imbalance from ApartmentIQ"""
    imbalance_score: int  # 0-100 (100 = max opportunity)
    verdict: str  # STRONG_OPPORTUNITY, BALANCED, OVERSUPPLY
    
    # Key factors
    vacancy_signal: float  # Contribution from vacancy
    concession_signal: float  # Contribution from concessions
    opportunity_signal: float  # Contribution from ApartmentIQ scores
    rent_growth_signal: float  # Contribution from rent trends
    
    # Recommendations
    recommended_action: str
    key_drivers: List[str]
    
    # Metadata
    confidence: float
    data_source: str


class ApartmentIQProcessor:
    """
    Processes ApartmentIQ market data for JEDI RE engines
    Handles timeseries, supply metrics, and intelligence signals
    """
    
    def __init__(self):
        """Initialize processor"""
        # Signal processor for timeseries (weekly data typical)
        self.processor = SignalProcessor(sampling_rate=52)
    
    # ==========================================================================
    # Signal Processing Engine Integration
    # ==========================================================================
    
    def process_timeseries(self, timeseries_data: List[Dict[str, Any]]) -> ApartmentIQSignal:
        """
        Process ApartmentIQ timeseries data with Signal Processing Engine
        
        Args:
            timeseries_data: List of observations with format:
                {
                    'date': '2026-01-15',
                    'avg_rent': 1982,
                    'vacancy_rate': 0.203,
                    'total_supply': 12543,
                    'available_units': 2546,
                    'avg_opportunity_score': 7.2,
                    'concessions_prevalence': 0.68,
                    'avg_days_on_market': 23,
                    'negotiation_success_rate': 0.73
                }
        
        Returns:
            ApartmentIQSignal with processed market data
        """
        if not timeseries_data or len(timeseries_data) < 4:
            raise ValueError("Need at least 4 data points for signal processing")
        
        # Extract rent timeseries
        rent_data = [obs['avg_rent'] for obs in timeseries_data]
        
        # Process with Signal Processing Engine
        result = self.processor.process_rent_signal(rent_data)
        
        # Calculate growth rate (annualized)
        # Assumes weekly data, so 52 periods = 1 year
        growth_rate = self.processor.calculate_growth_rate(result.clean_trend, periods=52)
        
        # Get latest values
        latest = timeseries_data[-1]
        current_rent = latest['avg_rent']
        current_trend = result.clean_trend[-1]
        current_seasonal = result.seasonal_component[-1]
        
        # Calculate market pressure from ApartmentIQ intelligence
        market_pressure = self._calculate_market_pressure(latest)
        
        # Calculate confidence
        # 1. Signal processing confidence (from SNR)
        # 2. Data span confidence (more weeks = higher)
        # 3. ApartmentIQ confidence (derived from opportunity scores)
        
        weeks_of_data = len(timeseries_data)
        span_confidence = min(1.0, weeks_of_data / 52)  # 1 year = full confidence
        
        # Historical volatility
        rent_array = np.array(rent_data)
        weekly_returns = np.diff(rent_array) / rent_array[:-1]
        volatility = np.std(weekly_returns)
        volatility_confidence = max(0.0, 1.0 - (volatility / 0.01))  # Weekly threshold
        
        # Combined confidence
        combined_confidence = (
            result.confidence * 0.4 +
            span_confidence * 0.3 +
            volatility_confidence * 0.3
        )
        
        return ApartmentIQSignal(
            # Signal Processing
            rent_growth_rate=growth_rate,
            confidence=combined_confidence,
            seasonal_component=current_seasonal,
            trend_component=current_trend,
            noise_level=result.noise_level,
            
            # Supply Metrics
            total_supply=latest['total_supply'],
            vacancy_rate=latest['vacancy_rate'],
            available_units=latest['available_units'],
            days_on_market=latest.get('avg_days_on_market', 0),
            
            # Intelligence
            opportunity_score=latest.get('avg_opportunity_score', 0),
            negotiation_success_rate=latest.get('negotiation_success_rate', 0),
            concessions_prevalence=latest.get('concessions_prevalence', 0),
            market_pressure_index=market_pressure,
            
            # Metadata
            data_points=len(timeseries_data),
            current_rent=current_rent,
            processed_at=datetime.now().isoformat(),
            data_source='apartmentiq'
        )
    
    # ==========================================================================
    # Carrying Capacity Engine Integration
    # ==========================================================================
    
    def process_supply_metrics(self, market_data: Dict[str, Any]) -> ApartmentIQCarryingCapacity:
        """
        Extract supply metrics for Carrying Capacity Engine
        
        Args:
            market_data: ApartmentIQ market summary with format:
                {
                    'total_units': 12543,
                    'available_units': 2546,
                    'vacancy_rate': 0.203,
                    'avg_rent_overall': 1982,
                    'avg_rent_studio': 1450,
                    'avg_rent_1bed': 1650,
                    'avg_rent_2bed': 2200,
                    'avg_rent_3bed': 2850,
                    'total_properties': 45,
                    ...
                }
        
        Returns:
            ApartmentIQCarryingCapacity with supply data
        """
        # Extract building class mix from properties if available
        class_mix = market_data.get('building_class_mix', {
            'A': 0.33, 'B': 0.45, 'C': 0.22  # Defaults if not provided
        })
        
        # Extract unit mix
        unit_mix = market_data.get('unit_mix', {
            'studio_pct': 10,
            'one_bed_pct': 45,
            'two_bed_pct': 35,
            'three_bed_pct': 10
        })
        
        # Calculate confidence based on sample size
        properties_count = market_data.get('total_properties', 0)
        confidence = min(1.0, properties_count / 20)  # 20 properties = full confidence
        
        return ApartmentIQCarryingCapacity(
            total_supply=market_data['total_units'],
            vacancy_rate=market_data['vacancy_rate'],
            available_units=market_data['available_units'],
            properties_count=properties_count,
            
            class_a_pct=class_mix.get('A', 0),
            class_b_pct=class_mix.get('B', 0),
            class_c_pct=class_mix.get('C', 0),
            
            studio_pct=unit_mix['studio_pct'] / 100,
            one_bed_pct=unit_mix['one_bed_pct'] / 100,
            two_bed_pct=unit_mix['two_bed_pct'] / 100,
            three_bed_pct=unit_mix['three_bed_pct'] / 100,
            
            avg_rent=market_data['avg_rent_overall'],
            rent_by_type={
                'studio': market_data.get('avg_rent_studio', 0),
                '1bed': market_data.get('avg_rent_1bed', 0),
                '2bed': market_data.get('avg_rent_2bed', 0),
                '3bed': market_data.get('avg_rent_3bed', 0),
            },
            
            confidence=confidence,
            data_source='apartmentiq'
        )
    
    # ==========================================================================
    # Imbalance Detector Integration
    # ==========================================================================
    
    def detect_imbalance(self, signal: ApartmentIQSignal) -> ApartmentIQImbalance:
        """
        Detect demand/supply imbalance using ApartmentIQ intelligence
        
        Args:
            signal: ApartmentIQSignal from process_timeseries()
        
        Returns:
            ApartmentIQImbalance with opportunity assessment
        """
        # Calculate signal contributions (0-25 points each)
        
        # 1. Vacancy Signal (higher vacancy = more opportunity)
        vacancy_signal = min(signal.vacancy_rate * 100, 25)
        
        # 2. Concession Signal (more concessions = softer market)
        concession_signal = min(signal.concessions_prevalence * 25, 25)
        
        # 3. Opportunity Signal (ApartmentIQ proprietary)
        opportunity_signal = min(signal.opportunity_score * 2.5, 25)
        
        # 4. Rent Growth Signal (negative growth = opportunity)
        # If rent is declining, that's a signal of oversupply
        rent_growth_contribution = 0
        if signal.rent_growth_rate < 0:
            rent_growth_contribution = min(abs(signal.rent_growth_rate) * 500, 25)
        elif signal.rent_growth_rate < 0.02:  # Below 2% inflation
            rent_growth_contribution = 10
        
        # Total imbalance score (0-100)
        imbalance_score = int(
            vacancy_signal + 
            concession_signal + 
            opportunity_signal + 
            rent_growth_contribution
        )
        
        # Determine verdict
        if imbalance_score >= 70:
            verdict = "STRONG_OPPORTUNITY"
            action = "High negotiation potential - expect significant concessions"
        elif imbalance_score >= 50:
            verdict = "MODERATE_OPPORTUNITY"
            action = "Some negotiation room - concessions available"
        elif imbalance_score >= 30:
            verdict = "BALANCED"
            action = "Normal market conditions - limited negotiation leverage"
        else:
            verdict = "TIGHT_MARKET"
            action = "Landlord advantage - limited concessions expected"
        
        # Identify key drivers
        drivers = []
        if vacancy_signal > 15:
            drivers.append(f"High vacancy ({signal.vacancy_rate:.1%})")
        if concession_signal > 15:
            drivers.append(f"Widespread concessions ({signal.concessions_prevalence:.1%})")
        if opportunity_signal > 15:
            drivers.append(f"Strong opportunity score ({signal.opportunity_score:.1f}/10)")
        if rent_growth_contribution > 10:
            drivers.append(f"Weak rent growth ({signal.rent_growth_rate:.1%})")
        
        if not drivers:
            drivers = ["Market in equilibrium"]
        
        return ApartmentIQImbalance(
            imbalance_score=imbalance_score,
            verdict=verdict,
            
            vacancy_signal=vacancy_signal,
            concession_signal=concession_signal,
            opportunity_signal=opportunity_signal,
            rent_growth_signal=rent_growth_contribution,
            
            recommended_action=action,
            key_drivers=drivers,
            
            confidence=signal.confidence,
            data_source='apartmentiq'
        )
    
    # ==========================================================================
    # Helper Methods
    # ==========================================================================
    
    def _calculate_market_pressure(self, observation: Dict[str, Any]) -> float:
        """
        Calculate market pressure index (0-10)
        Higher = more pressure (good for renters, bad for landlords)
        """
        pressure = 0
        
        # Vacancy contributes 0-3 points
        vacancy = observation.get('vacancy_rate', 0)
        pressure += min(vacancy * 15, 3)
        
        # Concessions contributes 0-3 points
        concessions = observation.get('concessions_prevalence', 0)
        pressure += min(concessions * 3, 3)
        
        # Days on market 0-2 points (30+ days = max)
        dom = observation.get('avg_days_on_market', 0)
        pressure += min(dom / 15, 2)
        
        # Opportunity score 0-2 points
        opp_score = observation.get('avg_opportunity_score', 0)
        pressure += min(opp_score / 5, 2)
        
        return min(pressure, 10)


# Example usage and testing
if __name__ == '__main__':
    print("=== ApartmentIQ Integration Test ===\n")
    
    # Mock ApartmentIQ timeseries data (weekly observations)
    mock_timeseries = [
        {
            'date': f'2026-01-{i:02d}',
            'avg_rent': 1950 + (i * 2),  # Gradually increasing rent
            'vacancy_rate': 0.20 + (i * 0.002),  # Increasing vacancy
            'total_supply': 12500,
            'available_units': 2500 + (i * 10),
            'avg_opportunity_score': 7.0 + (i * 0.05),
            'concessions_prevalence': 0.65 + (i * 0.01),
            'avg_days_on_market': 20 + i,
            'negotiation_success_rate': 0.70 + (i * 0.01)
        }
        for i in range(1, 13)  # 12 weeks of data
    ]
    
    # Mock market summary
    mock_market = {
        'total_units': 12543,
        'available_units': 2546,
        'vacancy_rate': 0.203,
        'avg_rent_overall': 1982,
        'avg_rent_studio': 1450,
        'avg_rent_1bed': 1650,
        'avg_rent_2bed': 2200,
        'avg_rent_3bed': 2850,
        'total_properties': 45
    }
    
    # Test processing
    processor = ApartmentIQProcessor()
    
    print("1. Processing Timeseries...")
    signal = processor.process_timeseries(mock_timeseries)
    print(f"   Current Rent: ${signal.current_rent:.0f}")
    print(f"   Rent Growth Rate: {signal.rent_growth_rate:.2%}")
    print(f"   Vacancy: {signal.vacancy_rate:.1%}")
    print(f"   Opportunity Score: {signal.opportunity_score:.1f}/10")
    print(f"   Market Pressure: {signal.market_pressure_index:.1f}/10")
    print(f"   Confidence: {signal.confidence:.1%}")
    
    print("\n2. Processing Supply Metrics...")
    capacity = processor.process_supply_metrics(mock_market)
    print(f"   Total Supply: {capacity.total_supply:,} units")
    print(f"   Vacancy Rate: {capacity.vacancy_rate:.1%}")
    print(f"   Avg Rent: ${capacity.avg_rent:.0f}")
    print(f"   Properties: {capacity.properties_count}")
    
    print("\n3. Detecting Imbalance...")
    imbalance = processor.detect_imbalance(signal)
    print(f"   Imbalance Score: {imbalance.imbalance_score}/100")
    print(f"   Verdict: {imbalance.verdict}")
    print(f"   Action: {imbalance.recommended_action}")
    print(f"   Key Drivers: {', '.join(imbalance.key_drivers)}")
    
    print("\n✓ ApartmentIQ integration working!")
    print("✓ Ready for API integration!")
