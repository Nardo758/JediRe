#!/usr/bin/env python3
"""
Standalone capacity analysis script - works without database
Takes parcel data as JSON input, returns analysis as JSON output
"""

import json
import sys
from data_pipeline.capacity_analyzer import CapacityAnalyzer

def main():
    # Read parcel data from stdin or command line
    if len(sys.argv) > 1:
        # Parse as JSON from argument
        parcel_json = ' '.join(sys.argv[1:])
        parcel = json.loads(parcel_json)
    else:
        # Read from stdin
        parcel = json.load(sys.stdin)
    
    # Create analyzer and run analysis
    analyzer = CapacityAnalyzer()
    result = analyzer.analyze_parcel(parcel)
    
    # Output JSON result
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        error_result = {
            "error": str(e),
            "type": type(e).__name__
        }
        print(json.dumps(error_result))
        sys.exit(1)
