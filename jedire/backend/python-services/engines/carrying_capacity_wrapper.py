#!/usr/bin/env python3
"""
Standalone wrapper for carrying_capacity engine
Reads JSON from stdin, outputs JSON to stdout
"""
import json
import sys
from carrying_capacity import CarryingCapacityEngine, SubmarketData


def main():
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)
        
        # Create SubmarketData from input
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
        
        # Validate required fields
        if submarket.population == 0:
            raise ValueError("population is required and must be > 0")
        
        # Analyze
        engine = CarryingCapacityEngine()
        result = engine.analyze(submarket)
        
        # Format output
        output = {
            "success": True,
            "result": {
                "submarket": result.submarket,
                "demand_units": result.demand_units,
                "demand_growth_annual": result.demand_growth_annual,
                "total_supply": result.total_supply,
                "existing_units": result.existing_units,
                "pipeline_units": result.pipeline_units,
                "saturation_pct": float(result.saturation_pct),
                "equilibrium_quarters": result.equilibrium_quarters,
                "verdict": result.verdict.value,
                "confidence": float(result.confidence),
                "summary": result.summary
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
