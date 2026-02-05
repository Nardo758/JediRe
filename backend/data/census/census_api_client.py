#!/usr/bin/env python3
"""
Census Bureau API Client

Fetch demographic and economic data from US Census Bureau API
No API key required for most endpoints

@version 1.0.0
@date 2026-02-05
"""

import requests
from typing import Dict, List, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# ============================================================================
# Configuration
# ============================================================================

BASE_URL = "https://api.census.gov/data"

# Common datasets
DATASETS = {
    'acs5': f"{BASE_URL}/2021/acs/acs5",  # American Community Survey 5-year
    'acs1': f"{BASE_URL}/2021/acs/acs1",  # American Community Survey 1-year
    'population': f"{BASE_URL}/2021/pep/population",  # Population estimates
}

# Useful variables
VARIABLES = {
    'population': 'B01001_001E',  # Total population
    'median_income': 'B19013_001E',  # Median household income
    'median_age': 'B01002_001E',  # Median age
    'college_educated': 'B15003_022E',  # Bachelor's degree or higher
    'unemployment': 'B23025_005E',  # Unemployed
    'labor_force': 'B23025_003E',  # Total labor force
    'housing_units': 'B25001_001E',  # Total housing units
    'occupied_units': 'B25002_002E',  # Occupied housing units
    'owner_occupied': 'B25003_002E',  # Owner-occupied units
    'renter_occupied': 'B25003_003E',  # Renter-occupied units
    'median_rent': 'B25064_001E',  # Median gross rent
    'median_home_value': 'B25077_001E',  # Median home value
}

# ============================================================================
# Census API Client
# ============================================================================

class CensusAPIClient:
    """Client for US Census Bureau API"""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Census API client
        
        Args:
            api_key: Optional API key (increases rate limits)
        """
        self.api_key = api_key
        self.session = requests.Session()
    
    def get_demographics(
        self,
        zip_codes: List[str],
        variables: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Get demographic data for ZIP codes
        
        Args:
            zip_codes: List of ZIP codes
            variables: List of variable names (uses defaults if None)
        
        Returns:
            Demographics by ZIP code
        """
        if variables is None:
            variables = [
                'population',
                'median_income',
                'median_age',
                'college_educated'
            ]
        
        # Convert to Census variable codes
        var_codes = [VARIABLES[v] for v in variables if v in VARIABLES]
        
        results = {}
        
        for zip_code in zip_codes:
            try:
                data = self._fetch_acs5_data(zip_code, var_codes)
                results[zip_code] = self._parse_demographics(data, variables)
            except Exception as e:
                logger.error(f"Failed to fetch data for ZIP {zip_code}: {e}")
                results[zip_code] = {'error': str(e)}
        
        return results
    
    def get_economic_indicators(
        self,
        zip_codes: List[str]
    ) -> Dict[str, Any]:
        """
        Get economic indicators for ZIP codes
        
        Returns unemployment rate, labor force participation, etc.
        """
        var_codes = [
            VARIABLES['unemployment'],
            VARIABLES['labor_force'],
            VARIABLES['median_income']
        ]
        
        results = {}
        
        for zip_code in zip_codes:
            try:
                data = self._fetch_acs5_data(zip_code, var_codes)
                
                unemployed = float(data[0][1]) if data and len(data[0]) > 1 else 0
                labor_force = float(data[0][2]) if data and len(data[0]) > 2 else 1
                median_income = int(data[0][3]) if data and len(data[0]) > 3 else 0
                
                results[zip_code] = {
                    'unemployment_rate': unemployed / labor_force if labor_force > 0 else 0,
                    'labor_force': int(labor_force),
                    'median_income': median_income,
                }
            except Exception as e:
                logger.error(f"Failed to fetch economic data for ZIP {zip_code}: {e}")
                results[zip_code] = {'error': str(e)}
        
        return results
    
    def get_housing_stats(
        self,
        zip_codes: List[str]
    ) -> Dict[str, Any]:
        """
        Get housing statistics for ZIP codes
        
        Returns rent, home values, occupancy rates
        """
        var_codes = [
            VARIABLES['housing_units'],
            VARIABLES['occupied_units'],
            VARIABLES['renter_occupied'],
            VARIABLES['median_rent'],
            VARIABLES['median_home_value']
        ]
        
        results = {}
        
        for zip_code in zip_codes:
            try:
                data = self._fetch_acs5_data(zip_code, var_codes)
                
                if data and len(data[0]) >= 6:
                    total_units = int(data[0][1])
                    occupied = int(data[0][2])
                    renter_occupied = int(data[0][3])
                    
                    results[zip_code] = {
                        'total_units': total_units,
                        'occupancy_rate': occupied / total_units if total_units > 0 else 0,
                        'renter_pct': renter_occupied / occupied if occupied > 0 else 0,
                        'median_rent': int(data[0][4]),
                        'median_home_value': int(data[0][5])
                    }
                else:
                    results[zip_code] = {'error': 'Insufficient data'}
            except Exception as e:
                logger.error(f"Failed to fetch housing data for ZIP {zip_code}: {e}")
                results[zip_code] = {'error': str(e)}
        
        return results
    
    def _fetch_acs5_data(
        self,
        zip_code: str,
        variables: List[str]
    ) -> List[List[str]]:
        """
        Fetch ACS 5-year data for a ZIP code
        
        Args:
            zip_code: 5-digit ZIP code
            variables: List of Census variable codes
        
        Returns:
            Raw API response data
        """
        # Build query
        vars_str = ','.join(variables)
        
        params = {
            'get': vars_str,
            'for': f'zip code tabulation area:{zip_code}',
        }
        
        if self.api_key:
            params['key'] = self.api_key
        
        # Make request
        response = self.session.get(DATASETS['acs5'], params=params, timeout=10)
        response.raise_for_status()
        
        return response.json()
    
    def _parse_demographics(
        self,
        data: List[List[str]],
        variable_names: List[str]
    ) -> Dict[str, Any]:
        """Parse raw Census API response into friendly format"""
        if not data or len(data) < 2:
            return {'error': 'No data returned'}
        
        # First row is headers, second row is data
        values = data[1]
        
        result = {}
        for i, var_name in enumerate(variable_names):
            if i + 1 < len(values):
                try:
                    result[var_name] = int(values[i + 1])
                except ValueError:
                    result[var_name] = values[i + 1]
        
        result['fetched_at'] = datetime.now().isoformat()
        
        return result

# ============================================================================
# Convenience Functions
# ============================================================================

def get_submarket_demographics(zip_codes: List[str]) -> Dict[str, Any]:
    """
    Quick function to get demographics for a submarket
    
    Args:
        zip_codes: List of ZIP codes in the submarket
    
    Returns:
        Aggregated demographics
    """
    client = CensusAPIClient()
    
    # Get data for all ZIPs
    demographics = client.get_demographics(zip_codes)
    economics = client.get_economic_indicators(zip_codes)
    housing = client.get_housing_stats(zip_codes)
    
    # Aggregate (simple average for demo purposes)
    # In production, would weight by population
    
    valid_demos = [d for d in demographics.values() if 'error' not in d]
    valid_econ = [e for e in economics.values() if 'error' not in e]
    valid_housing = [h for h in housing.values() if 'error' not in h]
    
    if not valid_demos:
        return {'error': 'No valid demographic data'}
    
    result = {
        'population': sum(d.get('population', 0) for d in valid_demos),
        'median_income': sum(e.get('median_income', 0) for e in valid_econ) // len(valid_econ) if valid_econ else 0,
        'unemployment_rate': sum(e.get('unemployment_rate', 0) for e in valid_econ) / len(valid_econ) if valid_econ else 0,
        'median_rent': sum(h.get('median_rent', 0) for h in valid_housing) // len(valid_housing) if valid_housing else 0,
        'fetched_at': datetime.now().isoformat()
    }
    
    return result

# ============================================================================
# CLI
# ============================================================================

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python census_api_client.py <zip_code> [zip_code...]")
        print("\nExample: python census_api_client.py 30308 30309")
        sys.exit(1)
    
    zip_codes = sys.argv[1:]
    
    print(f"Fetching Census data for: {', '.join(zip_codes)}")
    print("=" * 60)
    
    result = get_submarket_demographics(zip_codes)
    
    print("\nDemographics:")
    for key, value in result.items():
        if key != 'fetched_at':
            if 'rate' in key:
                print(f"  {key}: {value:.1%}")
            elif 'population' in key or 'income' in key or 'rent' in key:
                print(f"  {key}: {value:,}")
            else:
                print(f"  {key}: {value}")
    
    print(f"\nFetched: {result.get('fetched_at')}")
