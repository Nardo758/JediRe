#!/usr/bin/env python3
"""
CoStar Data Parser
Loads and cleans CoStar Excel data for JEDI RE engines
"""
import pandas as pd
import json
from pathlib import Path
from typing import Dict, List, Any
import numpy as np


class CoStarParser:
    """Parse and clean CoStar property data"""
    
    def __init__(self, excel_path: str):
        """
        Initialize parser
        
        Args:
            excel_path: Path to CoStar Excel file
        """
        self.excel_path = excel_path
        self.df = None
        self.cleaned_df = None
    
    def load_data(self) -> pd.DataFrame:
        """Load Excel file into DataFrame"""
        print(f"Loading data from {self.excel_path}...")
        self.df = pd.read_excel(self.excel_path)
        print(f"✓ Loaded {len(self.df)} properties with {len(self.df.columns)} columns")
        return self.df
    
    def clean_data(self) -> pd.DataFrame:
        """
        Clean and validate data
        
        Returns:
            Cleaned DataFrame
        """
        print("\nCleaning data...")
        df = self.df.copy()
        
        # Key columns we need
        required_columns = [
            'Property Name',
            'Submarket Name',
            'Number Of Units',
            'Avg Effective/Unit',
            'Avg Asking/Unit',
            'Vacancy %',
            'Building Class'
        ]
        
        # Check all required columns exist
        missing = [col for col in required_columns if col not in df.columns]
        if missing:
            raise ValueError(f"Missing required columns: {missing}")
        
        # Remove rows with missing critical data
        initial_count = len(df)
        df = df.dropna(subset=['Submarket Name', 'Number Of Units'])
        
        print(f"  Removed {initial_count - len(df)} rows with missing critical data")
        
        # Clean numeric columns
        numeric_cols = ['Number Of Units', 'Avg Effective/Unit', 'Avg Asking/Unit', 'Vacancy %']
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
        
        # Remove rows where Number Of Units is 0 or negative
        df = df[df['Number Of Units'] > 0]
        
        # Fill missing vacancy % with median
        if 'Vacancy %' in df.columns:
            median_vacancy = df['Vacancy %'].median()
            df['Vacancy %'] = df['Vacancy %'].fillna(median_vacancy)
        
        # Fill missing rents with median per submarket
        for col in ['Avg Effective/Unit', 'Avg Asking/Unit']:
            if col in df.columns:
                df[col] = df.groupby('Submarket Name')[col].transform(
                    lambda x: x.fillna(x.median())
                )
        
        # Clean Building Class (A, B, C)
        if 'Building Class' in df.columns:
            df['Building Class'] = df['Building Class'].str.upper().str.strip()
            # Map variations to standard classes
            df['Building Class'] = df['Building Class'].replace({
                'A+': 'A',
                'A-': 'A',
                'B+': 'B',
                'B-': 'B',
                'C+': 'C',
                'C-': 'C'
            })
            # Fill missing with 'B' (most common)
            df['Building Class'] = df['Building Class'].fillna('B')
        
        # Clean Year Built
        if 'Year Built' in df.columns:
            df['Year Built'] = pd.to_numeric(df['Year Built'], errors='coerce')
        
        self.cleaned_df = df
        print(f"✓ Cleaned data: {len(df)} valid properties")
        
        return df
    
    def get_submarket_summary(self) -> pd.DataFrame:
        """
        Get summary statistics by submarket
        
        Returns:
            DataFrame with submarket-level aggregations
        """
        if self.cleaned_df is None:
            raise ValueError("Must load and clean data first")
        
        print("\nAggregating by submarket...")
        
        df = self.cleaned_df
        
        # Group by submarket
        summary = df.groupby('Submarket Name').agg({
            'Number Of Units': 'sum',
            'Avg Effective/Unit': lambda x: np.average(x, weights=df.loc[x.index, 'Number Of Units']),
            'Avg Asking/Unit': lambda x: np.average(x, weights=df.loc[x.index, 'Number Of Units']),
            'Vacancy %': lambda x: np.average(x, weights=df.loc[x.index, 'Number Of Units']),
            'Property Name': 'count'
        }).reset_index()
        
        summary.columns = [
            'submarket_name',
            'total_units',
            'avg_effective_rent',
            'avg_asking_rent',
            'avg_vacancy_pct',
            'property_count'
        ]
        
        # Add building class distribution
        class_dist = df.groupby('Submarket Name')['Building Class'].value_counts(normalize=True).unstack(fill_value=0)
        for col in ['A', 'B', 'C']:
            if col in class_dist.columns:
                summary[f'pct_class_{col}'] = summary['submarket_name'].map(class_dist[col] * 100)
            else:
                summary[f'pct_class_{col}'] = 0.0
        
        # Calculate quality score (A=3, B=2, C=1)
        summary['quality_score'] = (
            summary['pct_class_A'] * 3 +
            summary['pct_class_B'] * 2 +
            summary['pct_class_C'] * 1
        ) / 100
        
        # Sort by total units
        summary = summary.sort_values('total_units', ascending=False)
        
        print(f"✓ Aggregated {len(summary)} submarkets")
        
        return summary
    
    def export_to_json(self, output_path: str) -> Dict[str, Any]:
        """
        Export aggregated data to JSON
        
        Args:
            output_path: Path for JSON output
            
        Returns:
            Dictionary of submarket data
        """
        summary = self.get_submarket_summary()
        
        # Convert to dictionary format
        submarkets = {}
        for _, row in summary.iterrows():
            submarket_key = row['submarket_name'].lower().replace(' ', '_')
            submarkets[submarket_key] = {
                'name': row['submarket_name'],
                'total_units': int(row['total_units']),
                'avg_effective_rent': round(float(row['avg_effective_rent']), 2),
                'avg_asking_rent': round(float(row['avg_asking_rent']), 2),
                'avg_vacancy_pct': round(float(row['avg_vacancy_pct']), 2),
                'property_count': int(row['property_count']),
                'building_class_distribution': {
                    'A': round(float(row['pct_class_A']), 1),
                    'B': round(float(row['pct_class_B']), 1),
                    'C': round(float(row['pct_class_C']), 1)
                },
                'quality_score': round(float(row['quality_score']), 2)
            }
        
        # Add metadata
        output_data = {
            'metadata': {
                'source': 'CoStar',
                'market': 'Atlanta, GA',
                'total_properties': len(self.cleaned_df),
                'total_submarkets': len(submarkets),
                'total_units': int(summary['total_units'].sum()),
                'generated': pd.Timestamp.now().isoformat()
            },
            'submarkets': submarkets
        }
        
        # Write to file
        with open(output_path, 'w') as f:
            json.dump(output_data, f, indent=2)
        
        print(f"\n✓ Exported to {output_path}")
        print(f"  Total submarkets: {len(submarkets)}")
        print(f"  Total units: {output_data['metadata']['total_units']:,}")
        
        return output_data
    
    def display_summary(self):
        """Display summary statistics"""
        if self.cleaned_df is None:
            raise ValueError("Must load and clean data first")
        
        summary = self.get_submarket_summary()
        
        print("\n" + "="*80)
        print("COSTAR DATA SUMMARY")
        print("="*80)
        print(f"\nTotal Properties: {len(self.cleaned_df):,}")
        print(f"Total Submarkets: {len(summary)}")
        print(f"Total Units: {summary['total_units'].sum():,}")
        print(f"\nAverage Effective Rent: ${summary['avg_effective_rent'].mean():,.0f}/unit")
        print(f"Average Vacancy: {summary['avg_vacancy_pct'].mean():.1f}%")
        
        print(f"\n{'Top 10 Submarkets by Unit Count:':<40}")
        print("-"*80)
        print(f"{'Submarket':<30} {'Units':>10} {'Avg Rent':>12} {'Vacancy':>10} {'Properties':>10}")
        print("-"*80)
        
        for _, row in summary.head(10).iterrows():
            print(f"{row['submarket_name']:<30} {int(row['total_units']):>10,} "
                  f"${row['avg_effective_rent']:>10,.0f} {row['avg_vacancy_pct']:>9.1f}% "
                  f"{int(row['property_count']):>10}")
        
        print("="*80 + "\n")


def main():
    """Main execution"""
    # Path to Excel file
    excel_path = Path(__file__).parent / "atlanta_properties.xlsx"
    output_path = Path(__file__).parent / "costar_submarkets.json"
    
    # Parse
    parser = CoStarParser(str(excel_path))
    parser.load_data()
    parser.clean_data()
    parser.display_summary()
    
    # Export
    parser.export_to_json(str(output_path))
    
    print("✅ CoStar data processing complete!")


if __name__ == '__main__':
    main()
