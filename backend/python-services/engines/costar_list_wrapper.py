#!/usr/bin/env python3
"""
API Wrapper: List available CoStar submarkets
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from costar_to_engine import CoStarDataSource


def main():
    try:
        # Load CoStar data
        try:
            data_source = CoStarDataSource()
        except FileNotFoundError as e:
            print(json.dumps({
                'success': False,
                'error': f'CoStar data not available: {str(e)}'
            }))
            return
        
        # Get all submarkets
        submarkets = []
        for submarket in data_source.submarkets.values():
            submarkets.append({
                'name': submarket.name,
                'total_units': submarket.total_units,
                'avg_effective_rent': submarket.avg_effective_rent,
                'avg_vacancy_pct': submarket.avg_vacancy_pct,
                'property_count': submarket.property_count,
                'quality_score': submarket.quality_score
            })
        
        # Sort by units
        submarkets.sort(key=lambda x: x['total_units'], reverse=True)
        
        # Get metadata
        metadata = {
            'total_submarkets': len(submarkets),
            'total_units': sum(s['total_units'] for s in submarkets),
            'avg_rent': sum(s['avg_effective_rent'] * s['total_units'] for s in submarkets) / sum(s['total_units'] for s in submarkets),
            'avg_vacancy': sum(s['avg_vacancy_pct'] * s['total_units'] for s in submarkets) / sum(s['total_units'] for s in submarkets)
        }
        
        output = {
            'success': True,
            'metadata': metadata,
            'submarkets': submarkets
        }
        
        print(json.dumps(output))
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))


if __name__ == '__main__':
    main()
