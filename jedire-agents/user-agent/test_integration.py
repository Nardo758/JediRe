#!/usr/bin/env python3
"""
Test JediRe Platform Integration
Quick test to verify User Agent can communicate with platform agents
"""

import asyncio
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from integrations.jedire_api import JediReAPI
from integrations.jedire_tools import (
    analyze_property_zoning,
    analyze_market_supply,
    analyze_deal_financials
)


async def test_connection():
    """Test basic connection to JediRe API"""
    print("\n" + "="*60)
    print("JediRe Integration Test")
    print("="*60 + "\n")
    
    api = JediReAPI()
    
    # Check configuration
    print("📋 Configuration:")
    print(f"  API URL: {api.base_url}")
    print(f"  API Key: {'✅ Set' if api.api_key else '❌ Not Set'}")
    print()
    
    if not api.api_key:
        print("⚠️  JEDIRE_API_KEY not configured in .env")
        print("   Integration will not work without it.")
        print()
        print("To fix:")
        print("  1. Get API key from JediRe platform")
        print("  2. Add to .env: JEDIRE_API_KEY=your-key-here")
        print()
        return False
    
    return True


async def test_zoning_analysis():
    """Test zoning analysis integration"""
    print("\n🔍 Test 1: Zoning Analysis")
    print("-" * 60)
    
    try:
        print("Analyzing: 1950 Piedmont Circle NE, Atlanta, GA...")
        
        result = await analyze_property_zoning(
            address="1950 Piedmont Circle NE, Atlanta, GA 30324"
        )
        
        print("\n✅ Zoning Analysis Result:")
        print(result)
        return True
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        print("\nPossible issues:")
        print("  - JediRe platform not running")
        print("  - Invalid API key")
        print("  - Zoning agent not available")
        return False


async def test_supply_analysis():
    """Test supply/market analysis integration"""
    print("\n🏢 Test 2: Market Supply Analysis")
    print("-" * 60)
    
    try:
        print("Analyzing: Midtown Atlanta market...")
        
        result = await analyze_market_supply(
            market="Midtown Atlanta",
            property_type="multifamily"
        )
        
        print("\n✅ Supply Analysis Result:")
        print(result)
        return True
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        print("\nPossible issues:")
        print("  - JediRe platform not running")
        print("  - Supply agent not available")
        return False


async def test_cashflow_analysis():
    """Test financial/cashflow analysis integration"""
    print("\n💰 Test 3: Cash Flow Analysis")
    print("-" * 60)
    
    # This requires a valid deal ID in the system
    print("⚠️  Skipping - requires valid deal ID")
    print("   To test: Call analyze_deal_financials(deal_id='...')")
    return True


async def main():
    """Run all integration tests"""
    
    # Test 1: Configuration check
    if not await test_connection():
        print("\n⏸️  Testing paused. Fix configuration first.\n")
        return
    
    # Test 2: Zoning analysis
    zoning_ok = await test_zoning_analysis()
    
    # Test 3: Supply analysis
    supply_ok = await test_supply_analysis()
    
    # Test 4: Cashflow (skip for now)
    cashflow_ok = await test_cashflow_analysis()
    
    # Summary
    print("\n" + "="*60)
    print("Test Summary")
    print("="*60)
    print(f"  Configuration: {'✅' if True else '❌'}")
    print(f"  Zoning Agent:  {'✅' if zoning_ok else '❌'}")
    print(f"  Supply Agent:  {'✅' if supply_ok else '❌'}")
    print(f"  Cashflow Agent: ⏭️  (skipped)")
    print()
    
    if zoning_ok and supply_ok:
        print("🎉 Integration working! User Agent can call platform agents.")
    else:
        print("⚠️  Some tests failed. Check errors above.")
    
    print()


if __name__ == "__main__":
    asyncio.run(main())
