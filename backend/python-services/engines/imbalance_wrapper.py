#!/usr/bin/env python3
"""
Standalone wrapper for imbalance_detector engine
Reads JSON from stdin, outputs JSON to stdout
"""
import json
import sys
import os

# Add engines directory to path so we can import the other modules
sys.path.insert(0, os.path.dirname(__file__))

from imbalance_detector import ImbalanceDetector
from carrying_capacity import SubmarketData


def main():
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)
        
        # Create SubmarketData
        submarket = SubmarketData(
            name=input_data.get('name', 'Unknown Submarket'),
            population=input_data.get('population', 0),
            population_growth_rate=input_data.get('population_growth_rate', 0.0),
            net_migration_annual=input_data.get('net_migration_annual', 0),
            employment=input_data.get('employment', 0),
            employment_growth_rate=input_data.get('employment_growth_rate', 0.0),
            median_income=input_data.get('median_income', 0.0),
            existing_units=input_data.get('existing_units', 0),
            pipeline_units=input_data.get('pipeline_units', 0),
            future_permitted_units=input_data.get('future_permitted_units', 0)
        )
        
        # Extract other parameters
        rent_timeseries = input_data.get('rent_timeseries')
        search_trend_change = input_data.get('search_trend_change')
        use_costar_data = input_data.get('use_costar_data', False)
        
        # Validate
        if submarket.population == 0:
            raise ValueError("population is required and must be > 0")
        
        # Check data source requirements
        if not use_costar_data:
            if not rent_timeseries or len(rent_timeseries) < 2:
                raise ValueError("rent_timeseries must contain at least 2 values (or set use_costar_data=true)")
        
        # Analyze
        detector = ImbalanceDetector(use_costar_signals=use_costar_data)
        result = detector.analyze_imbalance(
            submarket_data=submarket,
            rent_timeseries=rent_timeseries,
            search_trend_change=search_trend_change,
            use_costar_data=use_costar_data
        )
        
        # Format output
        output = {
            "success": True,
            "result": {
                "submarket": result.submarket,
                "verdict": result.verdict.value,
                "composite_score": result.composite_score,
                "confidence": float(result.confidence),
                "demand_signal": {
                    "strength": result.demand_signal.strength.value,
                    "score": result.demand_signal.score,
                    "confidence": float(result.demand_signal.confidence),
                    "rent_growth_rate": float(result.demand_signal.rent_growth_rate),
                    "rent_growth_confidence": float(result.demand_signal.rent_growth_confidence),
                    "search_trend_change": result.demand_signal.search_trend_change,
                    "migration_annual": result.demand_signal.migration_annual,
                    "summary": result.demand_signal.summary
                },
                "supply_signal": {
                    "demand_units": result.supply_signal.demand_units,
                    "demand_growth_annual": result.supply_signal.demand_growth_annual,
                    "total_supply": result.supply_signal.total_supply,
                    "existing_units": result.supply_signal.existing_units,
                    "pipeline_units": result.supply_signal.pipeline_units,
                    "saturation_pct": float(result.supply_signal.saturation_pct),
                    "equilibrium_quarters": result.supply_signal.equilibrium_quarters,
                    "verdict": result.supply_signal.verdict.value,
                    "confidence": float(result.supply_signal.confidence),
                    "summary": result.supply_signal.summary
                },
                "recommendation": result.recommendation,
                "key_factors": result.key_factors,
                "risks": result.risks
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
