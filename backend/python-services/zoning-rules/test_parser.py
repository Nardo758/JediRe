#!/usr/bin/env python3
"""
Test script for the zoning parser.
"""

import json
from zoning_parser import ZoningParser

def test_parser_framework():
    """Test the zoning parser framework."""
    print("🧪 Testing Zoning Parser Framework")
    print("=" * 50)
    
    # Create parser
    parser = ZoningParser(city="Atlanta", state="GA")
    
    # Test text extraction
    test_text = """
    R-3 DISTRICT - SINGLE FAMILY RESIDENTIAL (MEDIUM DENSITY)
    
    Section 16-03.004: Lot Requirements
    Minimum lot size: 10,000 square feet (0.23 acres)
    Minimum lot width: 80 feet
    
    Section 16-03.005: Density and Intensity
    Maximum density: 4.4 dwelling units per acre
    Maximum FAR: 0.55
    
    Section 16-03.006: Height and Setbacks
    Maximum height: 35 feet (2.5 stories)
    Front setback: 15 feet minimum
    Rear setback: 15 feet minimum
    Side setback: 6 feet minimum (each side)
    
    Section 16-03.007: Parking
    Parking required: 2 spaces per dwelling unit
    """
    
    print("📝 Testing text extraction for R-3 zone...")
    parser.extract_from_text(test_text, page_num=1)
    
    if 'R-3' in parser.rules:
        rule = parser.rules['R-3']
        print(f"✅ Successfully extracted R-3 rules")
        print(f"   Description: {rule.description}")
        print(f"   Lot size: {rule.minimum_lot_size_sqft} sq ft")
        print(f"   Density: {rule.maximum_density_units_per_acre} units/acre")
        print(f"   FAR: {rule.maximum_far}")
        print(f"   Height: {rule.maximum_height_feet} ft")
        print(f"   Setbacks: Front={rule.front_setback_feet}ft, "
              f"Rear={rule.rear_setback_feet}ft, Side={rule.side_setback_feet}ft")
        print(f"   Parking: {rule.parking_required_per_unit} spaces/unit")
    else:
        print("❌ Failed to extract R-3 rules")
    
    print("\n" + "=" * 50)
    print("📊 Testing placeholder data loading...")
    
    # Test placeholder loading
    parser2 = ZoningParser()
    parser2.load_placeholder()
    
    print(f"✅ Loaded {len(parser2.rules)} zoning rules from placeholder")
    
    # List loaded zones
    zones = sorted(parser2.rules.keys())
    print(f"   Zones: {', '.join(zones)}")
    
    # Show sample data for R-1 and MF-5
    print("\n📋 Sample data from placeholder:")
    for zone_code in ['R-1', 'MF-5']:
        if zone_code in parser2.rules:
            rule = parser2.rules[zone_code]
            print(f"\n  {zone_code}: {rule.description}")
            print(f"    Density: {rule.maximum_density_units_per_acre} units/acre")
            print(f"    FAR: {rule.maximum_far}")
            print(f"    Height: {rule.maximum_height_feet} ft")
    
    print("\n" + "=" * 50)
    print("💾 Testing JSON export...")
    
    # Export to JSON
    test_output = "test_output.json"
    parser2.to_json(test_output, include_source=False)
    
    # Verify export
    with open(test_output, 'r') as f:
        exported_data = json.load(f)
    
    print(f"✅ Exported {len(exported_data['zoning_rules'])} rules to {test_output}")
    print(f"   City: {exported_data['city']}, State: {exported_data['state']}")
    
    # Clean up
    import os
    if os.path.exists(test_output):
        os.remove(test_output)
        print(f"🧹 Cleaned up test file: {test_output}")
    
    print("\n" + "=" * 50)
    print("🎯 Parser Framework Test Complete!")
    print("\nNext steps:")
    print("1. Obtain actual Atlanta zoning ordinance PDF")
    print("2. Install PDF parsing libraries: pip install PyPDF2 pdfplumber")
    print("3. Update parse_pdf() method in zoning_parser.py")
    print("4. Parse actual PDF and verify extracted data")
    print("5. Update placeholder JSON with verified data")

if __name__ == "__main__":
    test_parser_framework()