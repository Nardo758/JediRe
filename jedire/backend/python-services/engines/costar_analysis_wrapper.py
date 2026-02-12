#!/usr/bin/env python3
"""
API Wrapper for CoStar Data Analysis
Reads submarket name from stdin, returns carrying capacity analysis using REAL CoStar data
"""
import json
import sys
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from costar_to_engine import CoStarDataSource, costar_to_submarket_data
from carrying_capacity import CarryingCapacityEngine


def main():
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        submarket_name = input_data.get('submarket_name')
        if not submarket_name:
            print(json.dumps({
                'success': False,
                'error': 'Missing required field: submarket_name'
            }))
            return
        
        # Load CoStar data
        try:
            data_source = CoStarDataSource()
        except FileNotFoundError as e:
            print(json.dumps({
                'success': False,
                'error': f'CoStar data not available: {str(e)}'
            }))
            return
        
        # Get submarket data
        costar_data = data_source.get_submarket(submarket_name)
        if not costar_data:
            # Return available submarkets
            available = data_source.list_submarkets()
            print(json.dumps({
                'success': False,
                'error': f'Submarket not found: {submarket_name}',
                'available_submarkets': available[:20]  # Top 20
            }))
            return
        
        # Convert to engine format
        submarket_data = costar_to_submarket_data(costar_data)
        
        # Run analysis
        engine = CarryingCapacityEngine()
        result = engine.analyze(submarket_data)
        
        # Format output
        output = {
            'success': True,
            'submarket': result.submarket,
            'costar_data': {
                'total_units': costar_data.total_units,
                'avg_effective_rent': costar_data.avg_effective_rent,
                'avg_asking_rent': costar_data.avg_asking_rent,
                'avg_vacancy_pct': costar_data.avg_vacancy_pct,
                'property_count': costar_data.property_count,
                'building_class_distribution': costar_data.building_class_distribution,
                'quality_score': costar_data.quality_score
            },
            'analysis': {
                'demand_units': result.demand_units,
                'demand_growth_annual': result.demand_growth_annual,
                'total_supply': result.total_supply,
                'existing_units': result.existing_units,
                'pipeline_units': result.pipeline_units,
                'saturation_pct': result.saturation_pct,
                'equilibrium_quarters': result.equilibrium_quarters,
                'verdict': result.verdict.value,
                'confidence': result.confidence,
                'summary': result.summary
            }
        }
        
        print(json.dumps(output))
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))


if __name__ == '__main__':
    main()
