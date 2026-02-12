#!/usr/bin/env python3
"""
Atlanta Zoning Scraper for JEDI RE Phase 1A

Scrapes Atlanta zoning ordinance from municode.com for zones:
R-1, R-2, R-3, R-4, R-5, MF-1, MF-2, MF-3, MF-4, MF-5

Usage:
    python atlanta_zoning_scraper.py --output ../zoning-rules/atlanta_zoning_scraped.json
"""

import time
import json
import re
import argparse
from typing import Dict, List, Optional, Any
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service as ChromeService


class AtlantaZoningScraper:
    """Scrape Atlanta zoning ordinance from municode.com"""
    
    def __init__(self, headless: bool = False):
        self.base_url = "https://library.municode.com/ga/atlanta/codes/code_of_ordinances"
        self.target_zones = [
            'R-1', 'R-2', 'R-3', 'R-4', 'R-5',
            'MF-1', 'MF-2', 'MF-3', 'MF-4', 'MF-5'
        ]
        
        # Initialize Chrome driver
        chrome_options = Options()
        if headless:
            chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        
        print("🚀 Initializing Chrome WebDriver...")
        service = ChromeService(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=chrome_options)
        self.driver.implicitly_wait(10)
        
        self.zoning_data = {}
    
    def scrape_all_zones(self):
        """Scrape all target zoning districts"""
        print(f"\n📋 Scraping {len(self.target_zones)} zoning districts from municode.com...")
        
        # Navigate to Part 16 - Zoning
        zoning_url = f"{self.base_url}?nodeId=PTIICOORANDECO_PT16ZO"
        
        print(f"🌐 Opening: {zoning_url}")
        self.driver.get(zoning_url)
        
        # Wait for page to load
        time.sleep(3)
        
        # Try to find zoning chapters
        print("\n🔍 Looking for zoning district links...")
        
        try:
            # Look for links containing zone codes
            page_html = self.driver.page_source
            
            # Extract all zone-related links
            for zone_code in self.target_zones:
                print(f"\n📍 Searching for {zone_code}...")
                
                # Search for the zone code in page
                zone_data = self._extract_zone_data(zone_code, page_html)
                
                if zone_data:
                    self.zoning_data[zone_code] = zone_data
                    print(f"  ✅ Found data for {zone_code}")
                else:
                    print(f"  ⚠️  No data found for {zone_code}")
        
        except Exception as e:
            print(f"❌ Error during scraping: {e}")
        
        print(f"\n✅ Scraping complete. Found data for {len(self.zoning_data)} zones.")
    
    def _extract_zone_data(self, zone_code: str, html: str) -> Optional[Dict[str, Any]]:
        """
        Extract zoning data for a specific zone code from HTML.
        
        This is a placeholder - real implementation would navigate to each
        zone's page and extract metrics.
        """
        
        # Try to find the zone code in the HTML
        if zone_code.lower() in html.lower():
            # Placeholder data structure
            return {
                'zoning_code': zone_code,
                'description': f'{self._get_zone_description(zone_code)}',
                'source_url': self.base_url,
                'scraped_at': time.strftime('%Y-%m-%d %H:%M:%S'),
                'status': 'placeholder - needs manual extraction',
                'notes': 'Found reference in municode, but automatic extraction not implemented yet'
            }
        
        return None
    
    def _get_zone_description(self, zone_code: str) -> str:
        """Get description for zone code"""
        descriptions = {
            'R-1': 'Single-Family Residential - Low Density',
            'R-2': 'Single-Family Residential - Low-Medium Density',
            'R-3': 'Single-Family Residential - Medium Density',
            'R-4': 'Single-Family Residential - Medium-High Density',
            'R-5': 'Single-Family Residential - High Density',
            'MF-1': 'Multifamily Residential - Low Density',
            'MF-2': 'Multifamily Residential - Low-Medium Density',
            'MF-3': 'Multifamily Residential - Medium Density',
            'MF-4': 'Multifamily Residential - Medium-High Density',
            'MF-5': 'Multifamily Residential - High Density',
        }
        return descriptions.get(zone_code, 'Unknown')
    
    def export_to_json(self, output_path: str):
        """Export scraped data to JSON"""
        output_data = {
            'city': 'Atlanta',
            'state': 'GA',
            'source': 'Municode Library (library.municode.com)',
            'scraped_at': time.strftime('%Y-%m-%d %H:%M:%S'),
            'status': 'partial - needs manual extraction',
            'notes': [
                'This is a PARTIAL scrape from municode.com',
                'Municode requires JavaScript and manual navigation',
                'Zone references were found, but detailed rules need manual extraction',
                'Recommend: Navigate to each zone page and copy/paste text for parsing'
            ],
            'zoning_rules': list(self.zoning_data.values())
        }
        
        with open(output_path, 'w') as f:
            json.dump(output_data, f, indent=2)
        
        print(f"\n💾 Exported to: {output_path}")
    
    def close(self):
        """Close the browser"""
        if self.driver:
            self.driver.quit()
            print("\n🔚 Browser closed")


def main():
    parser = argparse.ArgumentParser(
        description='Scrape Atlanta zoning data from municode.com'
    )
    parser.add_argument(
        '--output', '-o',
        default='../zoning-rules/atlanta_zoning_scraped.json',
        help='Output JSON file path'
    )
    parser.add_argument(
        '--headless',
        action='store_true',
        help='Run browser in headless mode'
    )
    
    args = parser.parse_args()
    
    scraper = None
    try:
        # Create scraper
        scraper = AtlantaZoningScraper(headless=args.headless)
        
        # Scrape zones
        scraper.scrape_all_zones()
        
        # Export results
        scraper.export_to_json(args.output)
        
        # Print summary
        print("\n" + "="*60)
        print("📊 SCRAPING SUMMARY")
        print("="*60)
        print(f"Zones found: {len(scraper.zoning_data)}/{len(scraper.target_zones)}")
        print(f"Output: {args.output}")
        print("\n⚠️  NOTE: Municode requires manual extraction for detailed rules.")
        print("   Recommend: Navigate to each zone page and extract text manually.")
        print("\n🔗 Atlanta Zoning URL:")
        print("   https://library.municode.com/ga/atlanta/codes/code_of_ordinances?nodeId=PTIICOORANDECO_PT16ZO")
        
    except Exception as e:
        print(f"\n❌ Scraping failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        if scraper:
            scraper.close()


if __name__ == "__main__":
    main()
