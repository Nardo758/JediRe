#!/usr/bin/env python3
"""
JEDI RE - CLI Submarket Analysis Tool

Analyze a submarket from the command line and output results

Usage:
    python analyze_submarket.py "Midtown" --city "Atlanta" --state "GA"
    python analyze_submarket.py "Buckhead" --city "Atlanta" --output json
    python analyze_submarket.py --help

@version 1.0.0
@date 2026-02-05
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, Any
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# ============================================================================
# Engine Imports
# ============================================================================

try:
    from engines.apartmentiq_wrapper import ApartmentIQProcessor
    from engines.costar_signal_wrapper import CoStarSignalProcessor
    from engines.carrying_capacity import CarryingCapacityAnalyzer
    from engines.imbalance_detector import ImbalanceDetector
    ENGINES_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Could not import engines: {e}")
    ENGINES_AVAILABLE = False

# ============================================================================
# CLI Colors
# ============================================================================

class Colors:
    """ANSI color codes for terminal output"""
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

# ============================================================================
# Analysis Functions
# ============================================================================

def analyze_submarket(submarket: str, city: str, state: str = 'GA') -> Dict[str, Any]:
    """
    Run complete analysis on a submarket
    
    Returns dict with all engine results
    """
    if not ENGINES_AVAILABLE:
        raise Exception("Engines not available. Check imports.")
    
    results = {
        'submarket': submarket,
        'city': city,
        'state': state,
        'analyzed_at': datetime.now().isoformat(),
    }
    
    print(f"\n{Colors.HEADER}{Colors.BOLD}Analyzing {submarket}, {city}, {state}{Colors.ENDC}")
    print("=" * 60)
    
    # Signal Processing
    print(f"\n{Colors.CYAN}1. Signal Processing Engine...{Colors.ENDC}")
    try:
        processor = CoStarSignalProcessor()
        signal = processor.get_market_signal(use_full_history=False)
        
        results['signal_processing'] = {
            'rent_growth_rate': signal.rent_growth_rate,
            'confidence': signal.confidence,
            'current_rent': signal.current_rent,
            'trend_component': signal.trend_component,
            'data_points': signal.data_points,
        }
        
        print(f"   {Colors.GREEN}✓{Colors.ENDC} Rent growth: {signal.rent_growth_rate:.2%}")
        print(f"   {Colors.GREEN}✓{Colors.ENDC} Confidence: {signal.confidence:.1%}")
        print(f"   {Colors.GREEN}✓{Colors.ENDC} Current rent: ${signal.current_rent:.0f}")
    except Exception as e:
        results['signal_processing'] = {'error': str(e)}
        print(f"   {Colors.RED}✗{Colors.ENDC} Error: {e}")
    
    # Carrying Capacity (placeholder - needs parcel data)
    print(f"\n{Colors.CYAN}2. Carrying Capacity Engine...{Colors.ENDC}")
    results['carrying_capacity'] = {
        'status': 'requires_parcel_data',
        'message': 'Load parcel data first: python load_parcels.py'
    }
    print(f"   {Colors.YELLOW}⚠{Colors.ENDC} Requires parcel data (not loaded)")
    
    # Imbalance Detector
    print(f"\n{Colors.CYAN}3. Imbalance Detector Engine...{Colors.ENDC}")
    try:
        # Use signal processing results
        if 'error' not in results['signal_processing']:
            # Create mock ApartmentIQ signal for imbalance detection
            from engines.apartmentiq_wrapper import ApartmentIQSignal
            
            signal_data = results['signal_processing']
            mock_signal = ApartmentIQSignal(
                rent_growth_rate=signal_data['rent_growth_rate'],
                confidence=signal_data['confidence'],
                seasonal_component=0,
                trend_component=signal_data['trend_component'],
                noise_level=50,
                total_supply=10000,  # Mock
                vacancy_rate=0.15,  # Mock
                available_units=1500,  # Mock
                days_on_market=25,  # Mock
                opportunity_score=7.0,  # Mock
                negotiation_success_rate=0.70,  # Mock
                concessions_prevalence=0.65,  # Mock
                market_pressure_index=6.5,  # Mock
                data_points=signal_data['data_points'],
                current_rent=signal_data['current_rent'],
                processed_at=datetime.now().isoformat(),
                data_source='costar'
            )
            
            processor = ApartmentIQProcessor()
            imbalance = processor.detect_imbalance(mock_signal)
            
            results['imbalance_detector'] = {
                'imbalance_score': imbalance.imbalance_score,
                'verdict': imbalance.verdict,
                'recommended_action': imbalance.recommended_action,
                'key_drivers': imbalance.key_drivers,
                'confidence': imbalance.confidence,
            }
            
            # Color-code verdict
            verdict_color = Colors.GREEN if imbalance.imbalance_score > 70 else Colors.YELLOW if imbalance.imbalance_score > 50 else Colors.RED
            
            print(f"   {Colors.GREEN}✓{Colors.ENDC} Imbalance score: {verdict_color}{imbalance.imbalance_score}/100{Colors.ENDC}")
            print(f"   {Colors.GREEN}✓{Colors.ENDC} Verdict: {verdict_color}{imbalance.verdict}{Colors.ENDC}")
            print(f"   {Colors.GREEN}✓{Colors.ENDC} Drivers: {', '.join(imbalance.key_drivers[:2])}")
        else:
            raise Exception("Signal processing failed - cannot run imbalance detector")
    except Exception as e:
        results['imbalance_detector'] = {'error': str(e)}
        print(f"   {Colors.RED}✗{Colors.ENDC} Error: {e}")
    
    print(f"\n{Colors.GREEN}{Colors.BOLD}Analysis Complete{Colors.ENDC}")
    print("=" * 60)
    
    return results

# ============================================================================
# Output Formatters
# ============================================================================

def format_json(results: Dict[str, Any]) -> str:
    """Format results as JSON"""
    return json.dumps(results, indent=2)

def format_pretty(results: Dict[str, Any]) -> str:
    """Format results as human-readable text"""
    output = []
    
    output.append(f"\n{Colors.HEADER}{Colors.BOLD}JEDI RE Market Analysis{Colors.ENDC}")
    output.append(f"{Colors.BOLD}{results['submarket']}, {results['city']}, {results['state']}{Colors.ENDC}")
    output.append(f"Analyzed: {results['analyzed_at']}")
    output.append("=" * 60)
    
    # Signal Processing
    if 'signal_processing' in results and 'error' not in results['signal_processing']:
        sp = results['signal_processing']
        output.append(f"\n{Colors.CYAN}{Colors.BOLD}📊 Signal Processing{Colors.ENDC}")
        output.append(f"  Rent Growth:   {sp['rent_growth_rate']:.2%} annually")
        output.append(f"  Current Rent:  ${sp['current_rent']:.0f}/month")
        output.append(f"  Trend:         ${sp['trend_component']:.2f}")
        output.append(f"  Confidence:    {sp['confidence']:.1%}")
        output.append(f"  Data Points:   {sp['data_points']}")
    
    # Imbalance Detector
    if 'imbalance_detector' in results and 'error' not in results['imbalance_detector']:
        im = results['imbalance_detector']
        
        verdict_color = Colors.GREEN if im['imbalance_score'] > 70 else Colors.YELLOW if im['imbalance_score'] > 50 else Colors.RED
        
        output.append(f"\n{Colors.CYAN}{Colors.BOLD}⚖️  Demand/Supply Imbalance{Colors.ENDC}")
        output.append(f"  Score:         {verdict_color}{im['imbalance_score']}/100{Colors.ENDC}")
        output.append(f"  Verdict:       {verdict_color}{im['verdict']}{Colors.ENDC}")
        output.append(f"  Action:        {im['recommended_action']}")
        output.append(f"  Key Drivers:   {', '.join(im['key_drivers'])}")
        output.append(f"  Confidence:    {im['confidence']:.1%}")
    
    output.append("\n" + "=" * 60)
    
    return '\n'.join(output)

def format_csv(results: Dict[str, Any]) -> str:
    """Format results as CSV (one-line summary)"""
    row = [
        results['submarket'],
        results['city'],
        results['state'],
        results['analyzed_at'],
    ]
    
    # Signal Processing
    if 'signal_processing' in results and 'error' not in results['signal_processing']:
        sp = results['signal_processing']
        row.extend([
            sp['rent_growth_rate'],
            sp['current_rent'],
            sp['confidence'],
        ])
    else:
        row.extend(['', '', ''])
    
    # Imbalance
    if 'imbalance_detector' in results and 'error' not in results['imbalance_detector']:
        im = results['imbalance_detector']
        row.extend([
            im['imbalance_score'],
            im['verdict'],
            im['confidence'],
        ])
    else:
        row.extend(['', '', ''])
    
    return ','.join(str(x) for x in row)

# ============================================================================
# Main CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='JEDI RE - Submarket Analysis CLI Tool',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python analyze_submarket.py "Midtown" --city "Atlanta"
  python analyze_submarket.py "Buckhead" --city "Atlanta" --output json
  python analyze_submarket.py "Downtown" --city "Austin" --state "TX" --output csv
        '''
    )
    
    parser.add_argument('submarket', help='Submarket name (e.g., "Midtown")')
    parser.add_argument('--city', required=True, help='City name (e.g., "Atlanta")')
    parser.add_argument('--state', default='GA', help='State abbreviation (default: GA)')
    parser.add_argument('--output', choices=['pretty', 'json', 'csv'], default='pretty',
                       help='Output format (default: pretty)')
    parser.add_argument('--save', help='Save results to file')
    
    args = parser.parse_args()
    
    try:
        # Run analysis
        results = analyze_submarket(args.submarket, args.city, args.state)
        
        # Format output
        if args.output == 'json':
            output = format_json(results)
        elif args.output == 'csv':
            # Print header if first run
            print("submarket,city,state,analyzed_at,rent_growth_rate,current_rent,signal_confidence,imbalance_score,verdict,imbalance_confidence")
            output = format_csv(results)
        else:
            output = format_pretty(results)
        
        # Print to console
        print(output)
        
        # Save to file if requested
        if args.save:
            with open(args.save, 'w') as f:
                f.write(output)
            print(f"\n{Colors.GREEN}✓{Colors.ENDC} Results saved to {args.save}")
        
        sys.exit(0)
    
    except Exception as e:
        print(f"\n{Colors.RED}{Colors.BOLD}Error:{Colors.ENDC} {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
