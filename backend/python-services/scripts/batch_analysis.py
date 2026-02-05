#!/usr/bin/env python3
"""
JEDI RE - Batch Analysis Tool

Analyze multiple submarkets at once and generate comparison report

Usage:
    python batch_analysis.py --city "Atlanta" --output batch_results.csv
    python batch_analysis.py --file submarkets.txt --output results.json
    python batch_analysis.py --help

@version 1.0.0
@date 2026-02-05
"""

import argparse
import json
import sys
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime
import time

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import the single-submarket analyzer
from analyze_submarket import analyze_submarket, Colors

# ============================================================================
# Batch Analysis
# ============================================================================

def batch_analyze(submarkets: List[Dict[str, str]], verbose: bool = True) -> List[Dict[str, Any]]:
    """
    Analyze multiple submarkets
    
    Args:
        submarkets: List of dicts with 'name', 'city', 'state'
        verbose: Print progress
    
    Returns:
        List of analysis results
    """
    results = []
    total = len(submarkets)
    
    if verbose:
        print(f"\n{Colors.HEADER}{Colors.BOLD}Batch Analysis{Colors.ENDC}")
        print(f"Analyzing {total} submarkets...")
        print("=" * 60)
    
    for idx, submarket in enumerate(submarkets, 1):
        if verbose:
            print(f"\n[{idx}/{total}] {submarket['name']}, {submarket['city']}")
        
        try:
            start_time = time.time()
            result = analyze_submarket(
                submarket['name'],
                submarket['city'],
                submarket.get('state', 'GA')
            )
            duration = time.time() - start_time
            
            result['analysis_duration'] = duration
            results.append(result)
            
            if verbose:
                print(f"   Completed in {duration:.2f}s")
        
        except Exception as e:
            if verbose:
                print(f"   {Colors.RED}✗ Error: {e}{Colors.ENDC}")
            
            results.append({
                'submarket': submarket['name'],
                'city': submarket['city'],
                'state': submarket.get('state', 'GA'),
                'error': str(e),
                'analyzed_at': datetime.now().isoformat()
            })
    
    if verbose:
        success_count = len([r for r in results if 'error' not in r])
        print(f"\n{Colors.GREEN}{Colors.BOLD}Batch Complete{Colors.ENDC}")
        print(f"Successful: {success_count}/{total}")
        print("=" * 60)
    
    return results

# ============================================================================
# Comparison Report
# ============================================================================

def generate_comparison_report(results: List[Dict[str, Any]]) -> str:
    """Generate ranked comparison of submarkets"""
    
    # Filter successful results
    valid_results = [r for r in results if 'error' not in r and 'imbalance_detector' in r]
    
    if not valid_results:
        return "No valid results to compare"
    
    # Sort by imbalance score (descending)
    sorted_results = sorted(
        valid_results,
        key=lambda x: x.get('imbalance_detector', {}).get('imbalance_score', 0),
        reverse=True
    )
    
    report = []
    report.append(f"\n{Colors.HEADER}{Colors.BOLD}Market Comparison Report{Colors.ENDC}")
    report.append(f"Analyzed {len(sorted_results)} markets")
    report.append("=" * 80)
    
    # Header
    report.append(f"\n{'Rank':<6} {'Submarket':<20} {'City':<15} {'Score':<8} {'Verdict':<25}")
    report.append("-" * 80)
    
    # Rankings
    for rank, result in enumerate(sorted_results, 1):
        im = result.get('imbalance_detector', {})
        score = im.get('imbalance_score', 0)
        verdict = im.get('verdict', 'N/A')
        
        # Color code by score
        if score > 70:
            color = Colors.GREEN
        elif score > 50:
            color = Colors.YELLOW
        else:
            color = Colors.RED
        
        line = f"{rank:<6} {result['submarket']:<20} {result['city']:<15} "
        line += f"{color}{score:<8}{Colors.ENDC} {verdict:<25}"
        report.append(line)
    
    # Summary statistics
    scores = [r.get('imbalance_detector', {}).get('imbalance_score', 0) for r in sorted_results]
    avg_score = sum(scores) / len(scores) if scores else 0
    
    report.append("\n" + "=" * 80)
    report.append(f"\n{Colors.CYAN}Summary Statistics:{Colors.ENDC}")
    report.append(f"  Average Score:    {avg_score:.1f}/100")
    report.append(f"  Highest Score:    {max(scores)}/100 ({sorted_results[0]['submarket']})")
    report.append(f"  Lowest Score:     {min(scores)}/100 ({sorted_results[-1]['submarket']})")
    
    # Top opportunities
    top_3 = sorted_results[:3]
    report.append(f"\n{Colors.GREEN}{Colors.BOLD}Top 3 Opportunities:{Colors.ENDC}")
    for idx, result in enumerate(top_3, 1):
        im = result.get('imbalance_detector', {})
        report.append(f"  {idx}. {result['submarket']}, {result['city']} - {im['imbalance_score']}/100")
        report.append(f"     {im.get('recommended_action', 'N/A')}")
    
    return '\n'.join(report)

# ============================================================================
# Input/Output
# ============================================================================

def load_submarkets_from_file(filepath: str) -> List[Dict[str, str]]:
    """Load submarkets from text or JSON file"""
    path = Path(filepath)
    
    if not path.exists():
        raise FileNotFoundError(f"File not found: {filepath}")
    
    # JSON format
    if path.suffix == '.json':
        with open(path) as f:
            data = json.load(f)
            
            # Handle different JSON structures
            if isinstance(data, list):
                return data
            elif 'submarkets' in data:
                return data['submarkets']
            else:
                raise ValueError("Invalid JSON structure")
    
    # Text format (one per line: "Submarket, City, State")
    submarkets = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            
            parts = [p.strip() for p in line.split(',')]
            
            if len(parts) >= 2:
                submarkets.append({
                    'name': parts[0],
                    'city': parts[1],
                    'state': parts[2] if len(parts) > 2 else 'GA'
                })
    
    return submarkets

def save_results(results: List[Dict[str, Any]], filepath: str, format: str = 'json'):
    """Save results to file"""
    path = Path(filepath)
    
    if format == 'json':
        with open(path, 'w') as f:
            json.dump(results, f, indent=2)
    
    elif format == 'csv':
        import csv
        
        with open(path, 'w', newline='') as f:
            writer = csv.writer(f)
            
            # Header
            writer.writerow([
                'submarket', 'city', 'state', 'analyzed_at',
                'rent_growth_rate', 'current_rent', 'signal_confidence',
                'imbalance_score', 'verdict', 'imbalance_confidence',
                'analysis_duration'
            ])
            
            # Data
            for result in results:
                sp = result.get('signal_processing', {})
                im = result.get('imbalance_detector', {})
                
                writer.writerow([
                    result.get('submarket', ''),
                    result.get('city', ''),
                    result.get('state', ''),
                    result.get('analyzed_at', ''),
                    sp.get('rent_growth_rate', ''),
                    sp.get('current_rent', ''),
                    sp.get('confidence', ''),
                    im.get('imbalance_score', ''),
                    im.get('verdict', ''),
                    im.get('confidence', ''),
                    result.get('analysis_duration', '')
                ])

# ============================================================================
# Predefined Market Lists
# ============================================================================

ATLANTA_SUBMARKETS = [
    {'name': 'Midtown', 'city': 'Atlanta', 'state': 'GA'},
    {'name': 'Buckhead', 'city': 'Atlanta', 'state': 'GA'},
    {'name': 'Virginia Highland', 'city': 'Atlanta', 'state': 'GA'},
    {'name': 'West End', 'city': 'Atlanta', 'state': 'GA'},
    {'name': 'Downtown', 'city': 'Atlanta', 'state': 'GA'},
    {'name': 'East Atlanta', 'city': 'Atlanta', 'state': 'GA'},
    {'name': 'Kirkwood', 'city': 'Atlanta', 'state': 'GA'},
    {'name': 'Inman Park', 'city': 'Atlanta', 'state': 'GA'},
    {'name': 'Old Fourth Ward', 'city': 'Atlanta', 'state': 'GA'},
    {'name': 'Grant Park', 'city': 'Atlanta', 'state': 'GA'},
]

# ============================================================================
# Main CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='JEDI RE - Batch Submarket Analysis Tool',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Analyze all Atlanta submarkets
  python batch_analysis.py --city "Atlanta" --output atlanta_results.csv
  
  # Analyze from file
  python batch_analysis.py --file submarkets.txt --output results.json
  
  # Generate comparison report
  python batch_analysis.py --city "Atlanta" --compare
        '''
    )
    
    parser.add_argument('--city', help='Analyze all submarkets in city (predefined list)')
    parser.add_argument('--file', help='Load submarkets from file (.txt or .json)')
    parser.add_argument('--output', help='Save results to file')
    parser.add_argument('--format', choices=['json', 'csv'], default='json',
                       help='Output format (default: json)')
    parser.add_argument('--compare', action='store_true',
                       help='Generate comparison report')
    parser.add_argument('--quiet', action='store_true',
                       help='Suppress progress output')
    
    args = parser.parse_args()
    
    # Determine submarkets to analyze
    submarkets = None
    
    if args.file:
        try:
            submarkets = load_submarkets_from_file(args.file)
        except Exception as e:
            print(f"{Colors.RED}Error loading file:{Colors.ENDC} {e}", file=sys.stderr)
            sys.exit(1)
    
    elif args.city:
        city_lower = args.city.lower()
        
        if city_lower == 'atlanta':
            submarkets = ATLANTA_SUBMARKETS
        else:
            print(f"{Colors.RED}Error:{Colors.ENDC} No predefined list for {args.city}", file=sys.stderr)
            print(f"Use --file to provide custom submarket list", file=sys.stderr)
            sys.exit(1)
    
    else:
        parser.print_help()
        sys.exit(1)
    
    if not submarkets:
        print(f"{Colors.RED}Error:{Colors.ENDC} No submarkets to analyze", file=sys.stderr)
        sys.exit(1)
    
    # Run batch analysis
    try:
        results = batch_analyze(submarkets, verbose=not args.quiet)
        
        # Save results
        if args.output:
            save_results(results, args.output, args.format)
            print(f"\n{Colors.GREEN}✓{Colors.ENDC} Results saved to {args.output}")
        
        # Generate comparison report
        if args.compare:
            report = generate_comparison_report(results)
            print(report)
        
        sys.exit(0)
    
    except Exception as e:
        print(f"\n{Colors.RED}{Colors.BOLD}Error:{Colors.ENDC} {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
