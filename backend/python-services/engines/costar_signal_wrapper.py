"""
CoStar Signal Processing Wrapper
Integrates real CoStar timeseries data with JEDI RE Signal Processing Engine
"""

import json
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any
from dataclasses import dataclass, asdict

from signal_processing import SignalProcessor


@dataclass
class DemandSignal:
    """Market demand signal derived from real data"""
    rent_growth_rate: float  # Annualized (e.g., 0.028 = 2.8%)
    confidence: float  # 0-1 based on data quality and historical volatility
    seasonal_component: float  # Current seasonal adjustment factor
    trend_component: float  # Current trend value
    noise_level: float  # Historical noise/volatility
    data_points: int  # Number of data points used
    time_span_years: float  # Years of data
    current_rent: float  # Latest rent value
    processed_at: str  # ISO timestamp


class CoStarSignalProcessor:
    """
    Processes CoStar historical timeseries data using Signal Processing Engine
    Returns real market signals for use in demand/supply imbalance detection
    """
    
    def __init__(self, data_path: Optional[Path] = None):
        """
        Args:
            data_path: Path to costar_market_timeseries.json
                      If None, uses default location
        """
        if data_path is None:
            # Default path: jedire/backend/data/costar/
            # This file is in: jedire/backend/python-services/engines/
            self.data_path = Path(__file__).parent.parent.parent / 'data' / 'costar' / 'costar_market_timeseries.json'
        else:
            self.data_path = Path(data_path)
        
        # Initialize signal processor for monthly data
        self.processor = SignalProcessor(sampling_rate=12)  # 12 months per year
        
        # Load data
        self.data = self._load_data()
    
    def _load_data(self) -> Dict[str, Any]:
        """Load CoStar timeseries JSON"""
        if not self.data_path.exists():
            raise FileNotFoundError(
                f"CoStar data not found at {self.data_path}. "
                f"Run parse_costar_timeseries.py first!"
            )
        
        with open(self.data_path, 'r') as f:
            return json.load(f)
    
    def get_market_signal(self, use_full_history: bool = False) -> DemandSignal:
        """
        Process CoStar data and return market demand signal
        
        Args:
            use_full_history: If True, use full 26-year rent history
                            If False, use complete 6-year dataset with vacancy
        
        Returns:
            DemandSignal with processed market data
        """
        # Choose dataset
        if use_full_history:
            dataset = self.data['full_rent_history']['monthly']
            time_span = self.data['metadata']['full_history_months'] / 12
        else:
            dataset = self.data['complete_dataset']['monthly']
            time_span = self.data['metadata']['complete_data_months'] / 12
        
        # Extract rent timeseries
        rent_data = dataset['effective_rent']
        
        # Process with Signal Processing Engine
        result = self.processor.process_rent_signal(rent_data)
        
        # Calculate growth rate (annualized)
        growth_rate = self.processor.calculate_growth_rate(result.clean_trend, periods=12)
        
        # Get current values
        current_rent = rent_data[-1]
        current_trend = result.clean_trend[-1]
        current_seasonal = result.seasonal_component[-1]
        
        # Calculate confidence based on:
        # 1. Signal processing confidence (SNR)
        # 2. Historical volatility (lower volatility = higher confidence)
        # 3. Data span (more data = higher confidence)
        
        # Historical volatility adjustment
        rent_array = np.array(rent_data)
        monthly_returns = np.diff(rent_array) / rent_array[:-1]
        volatility = np.std(monthly_returns)
        
        # Normalize volatility to confidence (lower volatility = higher confidence)
        # Typical monthly rent volatility is 0.5-2%, so scale accordingly
        volatility_confidence = max(0.0, 1.0 - (volatility / 0.02))
        
        # Data span confidence (6+ years = 1.0, less = scaled down)
        span_confidence = min(1.0, time_span / 6.0)
        
        # Combined confidence (weighted average)
        combined_confidence = (
            result.confidence * 0.4 +      # Signal processing confidence
            volatility_confidence * 0.4 +  # Historical stability
            span_confidence * 0.2          # Data sufficiency
        )
        
        return DemandSignal(
            rent_growth_rate=growth_rate,
            confidence=combined_confidence,
            seasonal_component=current_seasonal,
            trend_component=current_trend,
            noise_level=result.noise_level,
            data_points=len(rent_data),
            time_span_years=time_span,
            current_rent=current_rent,
            processed_at=datetime.now().isoformat()
        )
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get metadata and statistics about the loaded data"""
        return self.data['metadata']
    
    def get_rent_timeseries(self, frequency: str = 'monthly', 
                           use_full_history: bool = False) -> Dict[str, list]:
        """
        Get raw rent timeseries data
        
        Args:
            frequency: 'monthly' or 'quarterly'
            use_full_history: Full 26-year history or complete 6-year dataset
        
        Returns:
            Dict with 'dates' and 'effective_rent' lists
        """
        if use_full_history:
            dataset = self.data['full_rent_history'][frequency]
        else:
            dataset = self.data['complete_dataset'][frequency]
        
        return {
            'dates': dataset['dates'],
            'effective_rent': dataset['effective_rent']
        }
    
    def get_vacancy_timeseries(self, frequency: str = 'monthly') -> Dict[str, list]:
        """
        Get vacancy timeseries (only available in complete dataset)
        
        Args:
            frequency: 'monthly' or 'quarterly'
        
        Returns:
            Dict with 'dates' and 'vacancy_percent' lists
        """
        dataset = self.data['complete_dataset'][frequency]
        
        return {
            'dates': dataset['dates'],
            'vacancy_percent': dataset['vacancy_percent']
        }


# Example usage and testing
if __name__ == '__main__':
    print("=== CoStar Signal Processing Test ===\n")
    
    try:
        # Initialize processor
        processor = CoStarSignalProcessor()
        
        # Get statistics
        stats = processor.get_statistics()
        print(f"Loaded CoStar Data:")
        print(f"  Market: {stats['market']}")
        print(f"  Full history: {stats['full_history_quarters']} quarters")
        print(f"  Complete dataset: {stats['complete_data_quarters']} quarters")
        print(f"  Date range: {stats['complete_start_date'][:10]} to {stats['end_date'][:10]}")
        print()
        
        # Process signal - Complete dataset (6 years with vacancy)
        print("Processing Complete Dataset (6 years)...")
        signal_complete = processor.get_market_signal(use_full_history=False)
        
        print(f"\n=== Market Signal (Complete Dataset) ===")
        print(f"Current Rent: ${signal_complete.current_rent:.0f}")
        print(f"Trend Component: ${signal_complete.trend_component:.2f}")
        print(f"Seasonal Component: ${signal_complete.seasonal_component:.2f}")
        print(f"Annualized Rent Growth Rate: {signal_complete.rent_growth_rate:.2%}")
        print(f"Signal Confidence: {signal_complete.confidence:.2%}")
        print(f"Noise Level: ${signal_complete.noise_level:.2f}")
        print(f"Data Points: {signal_complete.data_points} months ({signal_complete.time_span_years:.1f} years)")
        
        # Process signal - Full history (26 years)
        print("\n\nProcessing Full Rent History (26 years)...")
        signal_full = processor.get_market_signal(use_full_history=True)
        
        print(f"\n=== Market Signal (Full History) ===")
        print(f"Current Rent: ${signal_full.current_rent:.0f}")
        print(f"Trend Component: ${signal_full.trend_component:.2f}")
        print(f"Seasonal Component: ${signal_full.seasonal_component:.2f}")
        print(f"Annualized Rent Growth Rate: {signal_full.rent_growth_rate:.2%}")
        print(f"Signal Confidence: {signal_full.confidence:.2%}")
        print(f"Noise Level: ${signal_full.noise_level:.2f}")
        print(f"Data Points: {signal_full.data_points} months ({signal_full.time_span_years:.1f} years)")
        
        # Compare growth rates
        print(f"\n=== Comparison ===")
        print(f"6-year growth rate: {signal_complete.rent_growth_rate:.2%}")
        print(f"26-year growth rate: {signal_full.rent_growth_rate:.2%}")
        print(f"Confidence delta: {abs(signal_complete.confidence - signal_full.confidence):.2%}")
        
        print("\n✓ Signal processing complete!")
        print("✓ Ready for API integration!")
        
    except FileNotFoundError as e:
        print(f"ERROR: {e}")
        print("Run parse_costar_timeseries.py first to generate the data file.")
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
