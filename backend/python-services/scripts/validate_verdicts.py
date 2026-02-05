#!/usr/bin/env python3
"""
JEDI RE - Verdict Validation Tool

Compare JEDI RE predictions against actual market outcomes for accuracy testing

Usage:
    python validate_verdicts.py --predictions predictions.json --actuals actuals.json
    python validate_verdicts.py --backtest 2020-2023 --city Atlanta
    python validate_verdicts.py --help

@version 1.0.0
@date 2026-02-05
"""

import argparse
import json
import sys
from pathlib import Path
from typing import List, Dict, Any, Tuple
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from analyze_submarket import Colors

# ============================================================================
# Validation Logic
# ============================================================================

def validate_predictions(
    predictions: List[Dict[str, Any]],
    actuals: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Validate predictions against actual outcomes
    
    Args:
        predictions: List of JEDI RE predictions
        actuals: List of actual market outcomes
    
    Returns:
        Validation metrics
    """
    matches = []
    
    # Match predictions to actuals
    for pred in predictions:
        pred_key = f"{pred['submarket']}_{pred['city']}"
        
        # Find matching actual
        actual = next(
            (a for a in actuals if f"{a['submarket']}_{a['city']}" == pred_key),
            None
        )
        
        if actual:
            matches.append({
                'submarket': pred['submarket'],
                'city': pred['city'],
                'predicted': pred,
                'actual': actual
            })
    
    if not matches:
        return {
            'error': 'No matching predictions and actuals found',
            'total_predictions': len(predictions),
            'total_actuals': len(actuals)
        }
    
    # Calculate metrics
    metrics = calculate_accuracy_metrics(matches)
    
    return metrics

def calculate_accuracy_metrics(matches: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate accuracy metrics from matched predictions"""
    
    total = len(matches)
    
    # Verdict accuracy
    verdict_correct = 0
    verdict_map = {
        'STRONG_OPPORTUNITY': ['high_vacancy', 'rent_decline', 'oversupply'],
        'MODERATE_OPPORTUNITY': ['moderate_vacancy', 'flat_rents'],
        'BALANCED': ['stable', 'normal_growth'],
        'TIGHT_MARKET': ['low_vacancy', 'rent_spike', 'undersupply']
    }
    
    for match in matches:
        pred_verdict = match['predicted'].get('imbalance_detector', {}).get('verdict', '')
        actual_outcome = match['actual'].get('outcome', '')
        
        # Check if actual outcome matches predicted verdict category
        expected_outcomes = verdict_map.get(pred_verdict, [])
        if actual_outcome in expected_outcomes:
            verdict_correct += 1
    
    verdict_accuracy = verdict_correct / total if total > 0 else 0
    
    # Rent growth prediction accuracy
    rent_errors = []
    for match in matches:
        pred_growth = match['predicted'].get('signal_processing', {}).get('rent_growth_rate')
        actual_growth = match['actual'].get('rent_growth_rate')
        
        if pred_growth is not None and actual_growth is not None:
            error = abs(pred_growth - actual_growth)
            rent_errors.append(error)
    
    mae = sum(rent_errors) / len(rent_errors) if rent_errors else None  # Mean Absolute Error
    rmse = (sum(e**2 for e in rent_errors) / len(rent_errors)) ** 0.5 if rent_errors else None  # RMSE
    
    # Imbalance score accuracy (within ±10 points)
    score_correct = 0
    for match in matches:
        pred_score = match['predicted'].get('imbalance_detector', {}).get('imbalance_score')
        actual_score = match['actual'].get('imbalance_score')
        
        if pred_score is not None and actual_score is not None:
            if abs(pred_score - actual_score) <= 10:
                score_correct += 1
    
    score_accuracy = score_correct / total if total > 0 else 0
    
    return {
        'total_matches': total,
        'verdict_accuracy': verdict_accuracy,
        'verdict_correct': verdict_correct,
        'rent_growth_mae': mae,
        'rent_growth_rmse': rmse,
        'score_accuracy': score_accuracy,
        'score_correct': score_correct,
        'matches': matches
    }

# ============================================================================
# Reporting
# ============================================================================

def generate_validation_report(metrics: Dict[str, Any]) -> str:
    """Generate human-readable validation report"""
    
    if 'error' in metrics:
        return f"{Colors.RED}Error: {metrics['error']}{Colors.ENDC}"
    
    report = []
    
    report.append(f"\n{Colors.HEADER}{Colors.BOLD}JEDI RE Validation Report{Colors.ENDC}")
    report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append("=" * 70)
    
    total = metrics['total_matches']
    
    # Overall Accuracy
    report.append(f"\n{Colors.CYAN}{Colors.BOLD}Overall Accuracy:{Colors.ENDC}")
    report.append(f"  Total Predictions Validated: {total}")
    
    # Verdict Accuracy
    verdict_acc = metrics['verdict_accuracy']
    verdict_color = Colors.GREEN if verdict_acc >= 0.7 else Colors.YELLOW if verdict_acc >= 0.5 else Colors.RED
    
    report.append(f"\n{Colors.CYAN}{Colors.BOLD}Verdict Accuracy:{Colors.ENDC}")
    report.append(f"  Correct Predictions: {metrics['verdict_correct']}/{total}")
    report.append(f"  Accuracy: {verdict_color}{verdict_acc:.1%}{Colors.ENDC}")
    
    if verdict_acc >= 0.7:
        report.append(f"  {Colors.GREEN}✓ Meets 70% accuracy threshold{Colors.ENDC}")
    else:
        report.append(f"  {Colors.RED}✗ Below 70% accuracy threshold{Colors.ENDC}")
    
    # Rent Growth Accuracy
    if metrics['rent_growth_mae'] is not None:
        mae = metrics['rent_growth_mae']
        rmse = metrics['rent_growth_rmse']
        
        report.append(f"\n{Colors.CYAN}{Colors.BOLD}Rent Growth Prediction:{Colors.ENDC}")
        report.append(f"  Mean Absolute Error: {mae:.2%}")
        report.append(f"  Root Mean Squared Error: {rmse:.2%}")
        
        if mae <= 0.05:  # Within ±5%
            report.append(f"  {Colors.GREEN}✓ Excellent accuracy (within ±5%){Colors.ENDC}")
        elif mae <= 0.10:  # Within ±10%
            report.append(f"  {Colors.YELLOW}⚠ Acceptable accuracy (within ±10%){Colors.ENDC}")
        else:
            report.append(f"  {Colors.RED}✗ Needs improvement (>10% error){Colors.ENDC}")
    
    # Score Accuracy
    score_acc = metrics['score_accuracy']
    score_color = Colors.GREEN if score_acc >= 0.7 else Colors.YELLOW if score_acc >= 0.5 else Colors.RED
    
    report.append(f"\n{Colors.CYAN}{Colors.BOLD}Imbalance Score Accuracy:{Colors.ENDC}")
    report.append(f"  Correct (within ±10 points): {metrics['score_correct']}/{total}")
    report.append(f"  Accuracy: {score_color}{score_acc:.1%}{Colors.ENDC}")
    
    # Detailed Matches
    report.append(f"\n{Colors.CYAN}{Colors.BOLD}Detailed Comparison:{Colors.ENDC}")
    report.append(f"{'Submarket':<25} {'Predicted':<20} {'Actual':<20} {'Match':<6}")
    report.append("-" * 70)
    
    for match in metrics['matches'][:10]:  # Show first 10
        pred = match['predicted'].get('imbalance_detector', {})
        actual = match['actual']
        
        pred_verdict = pred.get('verdict', 'N/A')[:18]
        actual_outcome = actual.get('outcome', 'N/A')[:18]
        
        # Determine if match
        is_match = pred_verdict.replace('_', '') in actual_outcome.replace('_', '') or \
                   actual_outcome.replace('_', '') in pred_verdict.replace('_', '')
        
        match_str = f"{Colors.GREEN}✓{Colors.ENDC}" if is_match else f"{Colors.RED}✗{Colors.ENDC}"
        
        location = f"{match['submarket']}, {match['city']}"[:24]
        report.append(f"{location:<25} {pred_verdict:<20} {actual_outcome:<20} {match_str:<6}")
    
    if len(metrics['matches']) > 10:
        report.append(f"  ... and {len(metrics['matches']) - 10} more")
    
    # Recommendations
    report.append(f"\n{Colors.CYAN}{Colors.BOLD}Recommendations:{Colors.ENDC}")
    
    if verdict_acc >= 0.7 and (metrics['rent_growth_mae'] or 0) <= 0.05:
        report.append(f"  {Colors.GREEN}✓ Model performance is excellent{Colors.ENDC}")
        report.append(f"  → Ready for production deployment")
    elif verdict_acc >= 0.6:
        report.append(f"  {Colors.YELLOW}⚠ Model performance is acceptable{Colors.ENDC}")
        report.append(f"  → Monitor performance and gather more validation data")
    else:
        report.append(f"  {Colors.RED}✗ Model needs improvement{Colors.ENDC}")
        report.append(f"  → Review engine parameters and data quality")
        report.append(f"  → Increase training data")
    
    report.append("\n" + "=" * 70)
    
    return '\n'.join(report)

# ============================================================================
# File I/O
# ============================================================================

def load_json_file(filepath: str) -> List[Dict[str, Any]]:
    """Load predictions or actuals from JSON file"""
    path = Path(filepath)
    
    if not path.exists():
        raise FileNotFoundError(f"File not found: {filepath}")
    
    with open(path) as f:
        data = json.load(f)
    
    # Handle different JSON structures
    if isinstance(data, list):
        return data
    elif 'predictions' in data:
        return data['predictions']
    elif 'actuals' in data:
        return data['actuals']
    else:
        raise ValueError("Invalid JSON structure - expected list or dict with 'predictions'/'actuals'")

# ============================================================================
# Main CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='JEDI RE - Verdict Validation Tool',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Validate predictions against actuals
  python validate_verdicts.py --predictions pred.json --actuals actual.json
  
  # Generate validation report
  python validate_verdicts.py --predictions pred.json --actuals actual.json --report
  
  # Save results
  python validate_verdicts.py --predictions pred.json --actuals actual.json --output validation.json
        '''
    )
    
    parser.add_argument('--predictions', required=True,
                       help='JSON file with JEDI RE predictions')
    parser.add_argument('--actuals', required=True,
                       help='JSON file with actual market outcomes')
    parser.add_argument('--output', help='Save validation results to file')
    parser.add_argument('--report', action='store_true',
                       help='Generate detailed report')
    
    args = parser.parse_args()
    
    try:
        # Load data
        print(f"Loading predictions from {args.predictions}...")
        predictions = load_json_file(args.predictions)
        
        print(f"Loading actuals from {args.actuals}...")
        actuals = load_json_file(args.actuals)
        
        # Validate
        print(f"\nValidating {len(predictions)} predictions...")
        metrics = validate_predictions(predictions, actuals)
        
        # Generate report
        if args.report or not args.output:
            report = generate_validation_report(metrics)
            print(report)
        
        # Save results
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(metrics, f, indent=2)
            print(f"\n{Colors.GREEN}✓{Colors.ENDC} Results saved to {args.output}")
        
        # Exit with appropriate code
        verdict_acc = metrics.get('verdict_accuracy', 0)
        if verdict_acc >= 0.7:
            sys.exit(0)  # Success
        else:
            sys.exit(1)  # Below threshold
    
    except Exception as e:
        print(f"\n{Colors.RED}{Colors.BOLD}Error:{Colors.ENDC} {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
