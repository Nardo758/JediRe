#!/usr/bin/env python3
"""
Standalone wrapper for signal_processing engine
Reads JSON from stdin, outputs JSON to stdout
"""
import json
import sys
import numpy as np
from signal_processing import SignalProcessor


def main():
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)
        
        # Extract parameters
        rent_timeseries = input_data.get('rent_timeseries', [])
        sampling_rate = input_data.get('sampling_rate', 52)  # Default to weekly
        
        if not rent_timeseries or len(rent_timeseries) < 2:
            raise ValueError("rent_timeseries must contain at least 2 values")
        
        # Process signal
        processor = SignalProcessor(sampling_rate=sampling_rate)
        result = processor.process_rent_signal(rent_timeseries)
        growth_rate = processor.calculate_growth_rate(result.clean_trend)
        
        # Convert numpy arrays to lists for JSON serialization
        output = {
            "success": True,
            "result": {
                "clean_trend": result.clean_trend.tolist(),
                "confidence": float(result.confidence),
                "seasonal_component": result.seasonal_component.tolist(),
                "noise_level": float(result.noise_level),
                "annualized_growth_rate": float(growth_rate),
                "trend_summary": {
                    "start_value": float(result.clean_trend[0]),
                    "end_value": float(result.clean_trend[-1]),
                    "change": float(result.clean_trend[-1] - result.clean_trend[0]),
                    "change_pct": float((result.clean_trend[-1] - result.clean_trend[0]) / result.clean_trend[0] * 100)
                }
            }
        }
        
        print(json.dumps(output))
        
    except Exception as e:
        error_output = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(error_output))
        sys.exit(1)


if __name__ == "__main__":
    main()
