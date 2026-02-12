#!/usr/bin/env python3
"""
Zoning Parser for JEDI RE Phase 1A

This script is designed to parse Atlanta zoning ordinance PDFs to extract
rules for residential/multifamily zones (R-1, R-2, R-3, R-4, R-5, MF-1, MF-2, MF-3, MF-4, MF-5).

Extracts: minimum lot size, FAR, max units per acre, height limits, setbacks.
Creates structured JSON output.

Usage:
    python zoning_parser.py --input zoning_ordinance.pdf --output atlanta_zoning_rules.json
"""

import json
import re
import argparse
from pathlib import Path
from typing import Dict, List, Optional, Any
import sys

# Placeholder for PDF parsing - would use PyPDF2, pdfplumber, or similar
# import PyPDF2
# import pdfplumber

class ZoningRule:
    """Represents zoning rules for a specific zone code."""
    
    def __init__(self, zoning_code: str, description: str = ""):
        self.zoning_code = zoning_code
        self.description = description
        self.zone_type = self._determine_zone_type(zoning_code)
        
        # Core metrics to extract
        self.minimum_lot_size_sqft: Optional[float] = None
        self.minimum_lot_size_acres: Optional[float] = None
        self.maximum_density_units_per_acre: Optional[float] = None
        self.maximum_far: Optional[float] = None
        self.maximum_height_feet: Optional[float] = None
        self.maximum_height_stories: Optional[float] = None
        self.front_setback_feet: Optional[float] = None
        self.rear_setback_feet: Optional[float] = None
        self.side_setback_feet: Optional[float] = None
        self.parking_required_per_unit: Optional[float] = None
        self.notes: str = ""
        
        # Source tracking
        self.source_text: str = ""
        self.page_number: Optional[int] = None
        
    def _determine_zone_type(self, code: str) -> str:
        """Determine if zone is residential or multifamily based on code."""
        if code.startswith('R-'):
            return 'residential'
        elif code.startswith('MF-'):
            return 'multifamily'
        else:
            return 'unknown'
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'zoning_code': self.zoning_code,
            'description': self.description,
            'zone_type': self.zone_type,
            'minimum_lot_size_sqft': self.minimum_lot_size_sqft,
            'minimum_lot_size_acres': self.minimum_lot_size_acres,
            'maximum_density_units_per_acre': self.maximum_density_units_per_acre,
            'maximum_far': self.maximum_far,
            'maximum_height_feet': self.maximum_height_feet,
            'maximum_height_stories': self.maximum_height_stories,
            'front_setback_feet': self.front_setback_feet,
            'rear_setback_feet': self.rear_setback_feet,
            'side_setback_feet': self.side_setback_feet,
            'parking_required_per_unit': self.parking_required_per_unit,
            'notes': self.notes,
            'source_text': self.source_text,
            'page_number': self.page_number
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ZoningRule':
        """Create ZoningRule from dictionary."""
        rule = cls(data['zoning_code'], data.get('description', ''))
        rule.zone_type = data.get('zone_type', rule.zone_type)
        rule.minimum_lot_size_sqft = data.get('minimum_lot_size_sqft')
        rule.minimum_lot_size_acres = data.get('minimum_lot_size_acres')
        rule.maximum_density_units_per_acre = data.get('maximum_density_units_per_acre')
        rule.maximum_far = data.get('maximum_far')
        rule.maximum_height_feet = data.get('maximum_height_feet')
        rule.maximum_height_stories = data.get('maximum_height_stories')
        rule.front_setback_feet = data.get('front_setback_feet')
        rule.rear_setback_feet = data.get('rear_setback_feet')
        rule.side_setback_feet = data.get('side_setback_feet')
        rule.parking_required_per_unit = data.get('parking_required_per_unit')
        rule.notes = data.get('notes', '')
        rule.source_text = data.get('source_text', '')
        rule.page_number = data.get('page_number')
        return rule


class ZoningParser:
    """Main parser for zoning ordinance documents."""
    
    def __init__(self, city: str = "Atlanta", state: str = "GA"):
        self.city = city
        self.state = state
        self.rules: Dict[str, ZoningRule] = {}
        
        # Target zones to extract
        self.target_zones = [
            'R-1', 'R-2', 'R-3', 'R-4', 'R-5',
            'MF-1', 'MF-2', 'MF-3', 'MF-4', 'MF-5'
        ]
        
        # Regular expressions for extracting zoning metrics
        self.patterns = {
            'lot_size': re.compile(r'(?:minimum\s+)?lot\s+size[:\s]*([\d,\.]+)\s*(?:sq\s*ft|sq\.?\s*ft\.?|square\s*feet)', re.IGNORECASE),
            'acres': re.compile(r'([\d,\.]+)\s*acres?', re.IGNORECASE),
            'density': re.compile(r'(?:maximum\s+)?density[:\s]*([\d,\.]+)\s*(?:units?\s+per\s+acre|du/acre|upa)', re.IGNORECASE),
            'far': re.compile(r'(?:maximum\s+)?F\.?A\.?R\.?[:\s]*([\d,\.]+)', re.IGNORECASE),
            'height': re.compile(r'(?:maximum\s+)?height[:\s]*([\d,\.]+)\s*(?:feet|ft\.?|\')', re.IGNORECASE),
            'stories': re.compile(r'(?:maximum\s+)?stories[:\s]*([\d,\.]+)', re.IGNORECASE),
            'front_setback': re.compile(r'front\s+setback[:\s]*([\d,\.]+)\s*(?:feet|ft\.?|\')', re.IGNORECASE),
            'rear_setback': re.compile(r'rear\s+setback[:\s]*([\d,\.]+)\s*(?:feet|ft\.?|\')', re.IGNORECASE),
            'side_setback': re.compile(r'side\s+setback[:\s]*([\d,\.]+)\s*(?:feet|ft\.?|\')', re.IGNORECASE),
            'parking': re.compile(r'parking[:\s]*([\d,\.]+)\s*(?:spaces?|spots?)\s*per\s*(?:dwelling\s+)?unit', re.IGNORECASE),
        }
    
    def parse_pdf(self, pdf_path: str) -> bool:
        """
        Parse zoning ordinance PDF.
        
        Note: This is a placeholder implementation. Actual implementation would
        require PDF parsing libraries like PyPDF2 or pdfplumber.
        """
        print(f"⚠️  PDF parsing not implemented. This is a placeholder.")
        print(f"   To implement, install: pip install PyPDF2 pdfplumber")
        print(f"   Then modify this method to extract text from {pdf_path}")
        
        # Placeholder: Create rules for target zones
        for zone_code in self.target_zones:
            rule = ZoningRule(zone_code)
            rule.description = f"{self._get_zone_type(zone_code)} - {self._get_density_level(zone_code)}"
            rule.source_text = f"Placeholder - Need to parse actual PDF: {pdf_path}"
            rule.notes = "Placeholder data - requires actual PDF parsing"
            self.rules[zone_code] = rule
        
        return True
    
    def _get_zone_type(self, code: str) -> str:
        """Get zone type description."""
        if code.startswith('R-'):
            return 'Single-Family Residential'
        elif code.startswith('MF-'):
            return 'Multifamily Residential'
        else:
            return 'Unknown'
    
    def _get_density_level(self, code: str) -> str:
        """Get density level description."""
        density_map = {
            '1': 'Low Density',
            '2': 'Low-Medium Density',
            '3': 'Medium Density',
            '4': 'Medium-High Density',
            '5': 'High Density'
        }
        num = code.split('-')[1] if '-' in code else '1'
        return density_map.get(num, 'Unknown Density')
    
    def extract_from_text(self, text: str, page_num: int = 1) -> None:
        """Extract zoning rules from text (for testing or alternative sources)."""
        # Look for zone codes in text
        for zone_code in self.target_zones:
            if zone_code in text:
                if zone_code not in self.rules:
                    self.rules[zone_code] = ZoningRule(zone_code)
                
                rule = self.rules[zone_code]
                rule.source_text = text[:500] + "..." if len(text) > 500 else text
                rule.page_number = page_num
                
                # Extract metrics using patterns
                self._extract_metrics_from_text(rule, text)
    
    def _extract_metrics_from_text(self, rule: ZoningRule, text: str) -> None:
        """Extract metrics from text using regular expressions."""
        for metric_name, pattern in self.patterns.items():
            match = pattern.search(text)
            if match:
                try:
                    value = float(match.group(1).replace(',', ''))
                    setattr(rule, self._metric_to_attribute(metric_name), value)
                except (ValueError, AttributeError):
                    pass
    
    def _metric_to_attribute(self, metric_name: str) -> str:
        """Convert metric name to attribute name."""
        mapping = {
            'lot_size': 'minimum_lot_size_sqft',
            'acres': 'minimum_lot_size_acres',
            'density': 'maximum_density_units_per_acre',
            'far': 'maximum_far',
            'height': 'maximum_height_feet',
            'stories': 'maximum_height_stories',
            'front_setback': 'front_setback_feet',
            'rear_setback': 'rear_setback_feet',
            'side_setback': 'side_setback_feet',
            'parking': 'parking_required_per_unit',
        }
        return mapping.get(metric_name, metric_name)
    
    def to_json(self, output_path: str, include_source: bool = False) -> None:
        """Export zoning rules to JSON file."""
        output_data = {
            'city': self.city,
            'state': self.state,
            'source': 'Parsed from zoning ordinance',
            'last_updated': '2026-02-03',
            'zoning_rules': [],
            'notes': [
                'Generated by JEDI RE Zoning Parser',
                'Some values may be placeholders until actual PDF is parsed'
            ]
        }
        
        for zone_code in sorted(self.rules.keys()):
            rule_dict = self.rules[zone_code].to_dict()
            if not include_source:
                # Remove source text for cleaner output
                rule_dict.pop('source_text', None)
                rule_dict.pop('page_number', None)
            output_data['zoning_rules'].append(rule_dict)
        
        with open(output_path, 'w') as f:
            json.dump(output_data, f, indent=2)
        
        print(f"✅ Exported {len(self.rules)} zoning rules to {output_path}")
    
    def load_placeholder(self) -> None:
        """Load placeholder data for testing."""
        placeholder_path = Path(__file__).parent / "atlanta_zoning_rules_placeholder.json"
        if placeholder_path.exists():
            with open(placeholder_path, 'r') as f:
                data = json.load(f)
            
            for rule_data in data.get('zoning_rules', []):
                zone_code = rule_data['zoning_code']
                rule = ZoningRule.from_dict(rule_data)
                self.rules[zone_code] = rule
            
            print(f"✅ Loaded placeholder data for {len(self.rules)} zones")
        else:
            print(f"⚠️  Placeholder file not found: {placeholder_path}")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Parse Atlanta zoning ordinance PDF')
    parser.add_argument('--input', '-i', help='Input PDF file path')
    parser.add_argument('--output', '-o', default='atlanta_zoning_rules.json',
                       help='Output JSON file path (default: atlanta_zoning_rules.json)')
    parser.add_argument('--placeholder', action='store_true',
                       help='Use placeholder data instead of parsing PDF')
    parser.add_argument('--include-source', action='store_true',
                       help='Include source text in output')
    
    args = parser.parse_args()
    
    # Create parser
    zoning_parser = ZoningParser(city="Atlanta", state="GA")
    
    if args.placeholder:
        # Use placeholder data
        zoning_parser.load_placeholder()
    elif args.input:
        # Parse PDF (placeholder implementation)
        if not Path(args.input).exists():
            print(f"❌ Input file not found: {args.input}")
            sys.exit(1)
        
        success = zoning_parser.parse_pdf(args.input)
        if not success:
            print("❌ Failed to parse PDF")
            sys.exit(1)
    else:
        print("❌ No input specified. Use --input PDF_FILE or --placeholder")
        parser.print_help()
        sys.exit(1)
    
    # Export to JSON
    zoning_parser.to_json(args.output, include_source=args.include_source)
    
    # Print summary
    print("\n📊 Summary of extracted zoning rules:")
    for zone_code, rule in sorted(zoning_parser.rules.items()):
        print(f"  {zone_code}: {rule.description}")
        if rule.maximum_density_units_per_acre:
            print(f"     Density: {rule.maximum_density_units_per_acre} units/acre")
        if rule.maximum_far:
            print(f"     FAR: {rule.maximum_far}")
        if rule.maximum_height_feet:
            print(f"     Height: {rule.maximum_height_feet} ft")


if __name__ == "__main__":
    main()