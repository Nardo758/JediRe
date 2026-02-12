#!/usr/bin/env python3
"""
CoStar Timeseries Data Parser
Extracts and processes Atlanta market data for JEDI RE Signal Processing Engine
"""

import pandas as pd
import numpy as np
from datetime import datetime
from dateutil.relativedelta import relativedelta
import json
from pathlib import Path

def clean_numeric(value):
    """Clean numeric values that might be stored as strings"""
    if pd.isna(value):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        # Remove commas, percentage signs, and other non-numeric characters
        cleaned = value.replace(',', '').replace('%', '').strip()
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None

def parse_period(period_str):
    """Convert period string like '2024 Q3' to datetime"""
    parts = period_str.strip().split()
    year = int(parts[0])
    
    # Handle QTD suffix
    quarter_str = parts[1].replace('QTD', '').strip()
    quarter = int(quarter_str[1])  # Extract number from 'Q1', 'Q2', etc.
    
    # Map quarter to month (use middle month of quarter)
    quarter_to_month = {1: 2, 2: 5, 3: 8, 4: 11}
    month = quarter_to_month[quarter]
    
    return datetime(year, month, 1)

def interpolate_to_monthly(quarterly_data):
    """
    Convert quarterly data to monthly using cubic spline interpolation
    Returns list of monthly values
    """
    # Create quarterly index (0, 3, 6, 9, 12, ... months)
    quarterly_indices = np.arange(len(quarterly_data)) * 3
    
    # Create monthly index (0, 1, 2, 3, ... months)
    num_months = (len(quarterly_data) - 1) * 3 + 1
    monthly_indices = np.arange(num_months)
    
    # Interpolate using cubic spline
    monthly_values = np.interp(monthly_indices, quarterly_indices, quarterly_data)
    
    return monthly_values.tolist()

def main():
    """Parse CoStar data and create timeseries JSON"""
    
    # Paths
    script_dir = Path(__file__).parent
    excel_path = script_dir / 'atlanta_market_data.xlsx'
    output_path = script_dir / 'costar_market_timeseries.json'
    
    print(f"Reading CoStar data from: {excel_path}")
    
    # Read Excel file
    df = pd.read_excel(excel_path)
    
    # Clean column names (remove leading/trailing spaces)
    df.columns = df.columns.str.strip()
    
    print(f"Loaded {len(df)} quarters of data")
    print(f"Date range: {df['Period'].iloc[-1]} to {df['Period'].iloc[0]}")
    
    # Reverse the dataframe (it's in reverse chronological order)
    df = df.iloc[::-1].reset_index(drop=True)
    
    # Parse periods
    df['date'] = df['Period'].apply(parse_period)
    
    # Clean and extract key columns
    df['effective_rent'] = df['Effective Rent Per Unit'].apply(clean_numeric)
    # Vacancy is stored as decimal (0.203 = 20.3%), convert to percentage
    df['vacancy_percent'] = df['Vacancy Percent'].apply(lambda x: clean_numeric(x) * 100 if clean_numeric(x) is not None else None)
    df['inventory_units'] = df['Inventory Units'].apply(clean_numeric)
    df['under_construction_units'] = df['Under Construction Units'].apply(clean_numeric)
    df['absorption_units'] = df['Absorption Units'].apply(clean_numeric)
    
    # Create full rent dataset (all available rent data)
    df_rent_only = df[df['effective_rent'].notna()].copy()
    
    # Create complete dataset (all fields present)
    df_complete = df[
        df['effective_rent'].notna() & 
        df['vacancy_percent'].notna() &
        (df['inventory_units'] > 0)
    ].copy()
    
    print(f"\n=== Data Quality ===")
    print(f"Full rent history: {len(df_rent_only)} quarters (starting {df_rent_only['Period'].iloc[0]})")
    print(f"Complete dataset: {len(df_complete)} quarters (starting {df_complete['Period'].iloc[0]})")
    print(f"\nFull Rent range: ${df_rent_only['effective_rent'].min():.0f} - ${df_rent_only['effective_rent'].max():.0f}")
    if len(df_complete) > 0:
        print(f"Complete Vacancy range: {df_complete['vacancy_percent'].min():.1f}% - {df_complete['vacancy_percent'].max():.1f}%")
    
    # Extract quarterly arrays - FULL RENT HISTORY
    quarterly_rent_full = df_rent_only['effective_rent'].values
    dates_rent_full = df_rent_only['date'].tolist()
    
    # Extract quarterly arrays - COMPLETE DATASET
    quarterly_rent = df_complete['effective_rent'].values
    quarterly_vacancy = df_complete['vacancy_percent'].values
    quarterly_inventory = df_complete['inventory_units'].values
    quarterly_construction = df_complete['under_construction_units'].values
    quarterly_absorption = df_complete['absorption_units'].values
    dates_complete = df_complete['date'].tolist()
    
    # Convert to monthly - FULL RENT HISTORY
    print("\nInterpolating full rent history to monthly...")
    monthly_rent_full = interpolate_to_monthly(quarterly_rent_full)
    start_date_full = df_rent_only['date'].iloc[0]
    monthly_dates_full = [start_date_full + relativedelta(months=i) for i in range(len(monthly_rent_full))]
    
    # Convert to monthly - COMPLETE DATASET
    print("Interpolating complete dataset to monthly...")
    monthly_rent = interpolate_to_monthly(quarterly_rent)
    monthly_vacancy = interpolate_to_monthly(quarterly_vacancy)
    monthly_inventory = interpolate_to_monthly(quarterly_inventory)
    monthly_construction = interpolate_to_monthly(quarterly_construction)
    monthly_absorption = interpolate_to_monthly(quarterly_absorption)
    start_date = df_complete['date'].iloc[0]
    monthly_dates = [start_date + relativedelta(months=i) for i in range(len(monthly_rent))]
    
    # Calculate statistics - FULL HISTORY
    years_full = len(quarterly_rent_full) / 4
    rent_growth_full = ((quarterly_rent_full[-1] / quarterly_rent_full[0]) ** (1 / years_full) - 1) * 100
    
    # Calculate statistics - COMPLETE DATASET
    years_complete = len(quarterly_rent) / 4
    rent_growth = ((quarterly_rent[-1] / quarterly_rent[0]) ** (1 / years_complete) - 1) * 100
    avg_vacancy = np.mean(quarterly_vacancy)
    
    print(f"\n=== Key Statistics ===")
    print(f"Full rent history: {len(df_rent_only)} quarters ({len(monthly_rent_full)} months)")
    print(f"  - Time span: {years_full:.1f} years")
    print(f"  - Average annual rent growth: {rent_growth_full:.2f}%")
    print(f"  - Starting rent: ${quarterly_rent_full[0]:.0f}")
    print(f"  - Current rent: ${quarterly_rent_full[-1]:.0f}")
    print(f"\nComplete dataset: {len(df_complete)} quarters ({len(monthly_rent)} months)")
    print(f"  - Time span: {years_complete:.1f} years")
    print(f"  - Average annual rent growth: {rent_growth:.2f}%")
    print(f"  - Average vacancy rate: {avg_vacancy:.2f}%")
    print(f"  - Current vacancy: {quarterly_vacancy[-1]:.1f}%")
    
    # Build output structure
    output = {
        'metadata': {
            'market': 'Atlanta',
            'data_source': 'CoStar',
            'parsed_at': datetime.now().isoformat(),
            'full_history_quarters': len(df_rent_only),
            'full_history_months': len(monthly_rent_full),
            'complete_data_quarters': len(df_complete),
            'complete_data_months': len(monthly_rent),
            'full_start_date': start_date_full.isoformat(),
            'complete_start_date': start_date.isoformat(),
            'end_date': monthly_dates[-1].isoformat(),
            'statistics': {
                'full_history_avg_annual_rent_growth_pct': round(rent_growth_full, 2),
                'complete_avg_annual_rent_growth_pct': round(rent_growth, 2),
                'avg_vacancy_pct': round(avg_vacancy, 2),
                'min_rent': float(quarterly_rent_full.min()),
                'max_rent': float(quarterly_rent_full.max()),
                'min_vacancy': float(quarterly_vacancy.min()),
                'max_vacancy': float(quarterly_vacancy.max())
            }
        },
        'full_rent_history': {
            'quarterly': {
                'dates': [d.isoformat() for d in dates_rent_full],
                'effective_rent': quarterly_rent_full.tolist()
            },
            'monthly': {
                'dates': [d.isoformat() for d in monthly_dates_full],
                'effective_rent': monthly_rent_full
            }
        },
        'complete_dataset': {
            'quarterly': {
                'dates': [d.isoformat() for d in dates_complete],
                'effective_rent': quarterly_rent.tolist(),
                'vacancy_percent': quarterly_vacancy.tolist(),
                'inventory_units': quarterly_inventory.tolist(),
                'under_construction_units': quarterly_construction.tolist(),
                'absorption_units': quarterly_absorption.tolist()
            },
            'monthly': {
                'dates': [d.isoformat() for d in monthly_dates],
                'effective_rent': monthly_rent,
                'vacancy_percent': monthly_vacancy,
                'inventory_units': monthly_inventory,
                'under_construction_units': monthly_construction,
                'absorption_units': monthly_absorption
            }
        }
    }
    
    # Save to JSON
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n✓ Timeseries data saved to: {output_path}")
    print(f"✓ Ready for Signal Processing Engine!")
    
    return output

if __name__ == '__main__':
    main()
