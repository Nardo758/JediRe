#!/usr/bin/env python3
"""
Standalone wrapper for CoStar Market Signal
Reads input from stdin (optional), outputs JSON to stdout
Uses real CoStar historical timeseries data
"""
import json
import sys
from costar_signal_wrapper import CoStarSignalProcessor
from dataclasses import asdict


def main():
    try:
        # Check if there's input (optional)
        use_full_history = False
        if not sys.stdin.isatty():
            try:
                input_data = json.load(sys.stdin)
                use_full_history = input_data.get('use_full_history', False)
            except json.JSONDecodeError:
                # No input or invalid JSON, use defaults
                pass
        
        # Initialize processor
        processor = CoStarSignalProcessor()
        
        # Get market signal
        signal = processor.get_market_signal(use_full_history=use_full_history)
        
        # Get metadata
        stats = processor.get_statistics()
        
        # Build output
        output = {
            "success": True,
            "market": stats['market'],
            "signal": asdict(signal),
            "metadata": {
                "data_source": "CoStar Historical Timeseries",
                "dataset_used": "full_26yr_history" if use_full_history else "complete_6yr_dataset",
                "time_span_years": signal.time_span_years,
                "data_points": signal.data_points,
                "date_range": {
                    "start": stats['full_start_date'] if use_full_history else stats['complete_start_date'],
                    "end": stats['end_date']
                }
            }
        }
        
        print(json.dumps(output, indent=2))
        
    except FileNotFoundError as e:
        error_output = {
            "success": False,
            "error": "CoStar timeseries data not found",
            "message": str(e),
            "hint": "Run parse_costar_timeseries.py to generate the data file"
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)
        
    except Exception as e:
        error_output = {
            "success": False,
            "error": str(e),
            "type": type(e).__name__
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)


if __name__ == '__main__':
    main()
