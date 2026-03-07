"""
JediRe Agent Tools
Functions that the AI can call to run platform analysis
"""

from typing import Dict, Any, Optional
from .jedire_api import JediReAPI

jedire_api = JediReAPI()


async def analyze_property_zoning(
    address: str,
    deal_id: Optional[str] = None
) -> str:
    """
    Analyze zoning regulations and development potential for a property.
    
    Args:
        address: Full property address
        deal_id: Optional deal ID if property exists in system
    
    Returns:
        Formatted analysis of zoning, allowed uses, and development potential
    """
    
    try:
        result = await jedire_api.analyze_zoning(address, deal_id)
        
        zoning = result.get('zoningDistrict', 'Unknown')
        uses = result.get('allowedUses', [])
        max_units = result.get('maxUnits', 'N/A')
        max_height = result.get('maxHeight', 'N/A')
        max_far = result.get('maxFAR', 'N/A')
        parking = result.get('parkingRequired', 'N/A')
        regulations = result.get('keyRegulations', [])
        
        summary = f"""
Zoning Analysis for {address}:

**Zoning District**: {zoning}

**Allowed Uses**: {', '.join(uses) if uses else 'Not specified'}

**Development Potential**:
- Maximum Units: {max_units}
- Maximum Height: {max_height} feet
- Maximum FAR: {max_far}
- Parking Required: {parking} spaces

**Key Regulations**:
{chr(10).join(f"- {reg}" for reg in regulations) if regulations else '- No specific regulations listed'}
"""
        
        return summary
        
    except Exception as e:
        return f"Error analyzing zoning: {str(e)}"


async def analyze_market_supply(
    market: str,
    property_type: str = "multifamily"
) -> str:
    """
    Analyze market inventory and supply for a given area.
    
    Args:
        market: Market area name (e.g., "Midtown Atlanta", "Atlanta")
        property_type: Type of property (default: "multifamily")
    
    Returns:
        Formatted market supply analysis with inventory, absorption, competition
    """
    
    try:
        result = await jedire_api.analyze_supply(market, property_type)
        
        total_units = result.get('totalUnits', 'N/A')
        vacant = result.get('vacantUnits', 'N/A')
        vacancy_rate = result.get('vacancyRate', 'N/A')
        absorption = result.get('quarterlyAbsorption', 'N/A')
        months_inventory = result.get('monthsOfInventory', 'N/A')
        competing = result.get('competingProperties', 'N/A')
        avg_rent = result.get('avgRent', 'N/A')
        trend = result.get('trendAnalysis', 'No trend data available')
        
        summary = f"""
Market Supply Analysis for {market} ({property_type}):

**Current Inventory**:
- Total Units: {f'{total_units:,}' if isinstance(total_units, int) else total_units}
- Vacant Units: {f'{vacant:,}' if isinstance(vacant, int) else vacant}
- Vacancy Rate: {vacancy_rate}%

**Absorption**:
- Quarterly Absorption: {absorption} units
- Months of Inventory: {months_inventory}

**Competition**:
- Competing Properties: {competing}
- Average Rent: ${avg_rent}/unit

**Market Trend**: {trend}
"""
        
        return summary
        
    except Exception as e:
        return f"Error analyzing market supply: {str(e)}"


async def analyze_deal_financials(
    deal_id: str,
    assumptions: Optional[Dict[str, Any]] = None
) -> str:
    """
    Run financial analysis on a deal.
    
    Args:
        deal_id: Deal ID in JediRe system
        assumptions: Optional custom assumptions (rent growth, exit cap, etc.)
    
    Returns:
        Formatted financial analysis with returns, cash flow, key metrics
    """
    
    try:
        result = await jedire_api.analyze_cashflow(deal_id, assumptions)
        
        purchase = result.get('purchasePrice', 0)
        units = result.get('units', 'N/A')
        price_per_unit = result.get('pricePerUnit', 0)
        cap_rate = result.get('capRate', 'N/A')
        coc = result.get('cashOnCash', 'N/A')
        irr = result.get('irr', 'N/A')
        gross_income = result.get('grossIncome', 0)
        opex = result.get('opex', 0)
        noi = result.get('noi', 0)
        debt_service = result.get('debtService', 0)
        cash_flow = result.get('netCashFlow', 0)
        dscr = result.get('dscr', 'N/A')
        breakeven = result.get('breakEvenOccupancy', 'N/A')
        
        summary = f"""
Financial Analysis for Deal {deal_id}:

**Purchase Details**:
- Purchase Price: ${purchase:,.0f}
- Units: {units}
- Price per Unit: ${price_per_unit:,.0f}

**Returns** (Year 1):
- Cap Rate: {cap_rate}%
- Cash-on-Cash: {coc}%
- IRR (10-year): {irr}%

**Cash Flow** (Year 1):
- Gross Income: ${gross_income:,.0f}
- Operating Expenses: ${opex:,.0f}
- NOI: ${noi:,.0f}
- Debt Service: ${debt_service:,.0f}
- Net Cash Flow: ${cash_flow:,.0f}

**Key Metrics**:
- Debt Coverage Ratio: {dscr}
- Break-even Occupancy: {breakeven}%
"""
        
        return summary
        
    except Exception as e:
        return f"Error analyzing deal financials: {str(e)}"


AVAILABLE_TOOLS = [
    {
        "name": "analyze_property_zoning",
        "description": "Analyze zoning regulations and development potential for a property address. Use when user asks about: what can be built, zoning restrictions, unit capacity, development potential, allowed uses.",
        "function": analyze_property_zoning,
        "parameters": {
            "type": "object",
            "properties": {
                "address": {
                    "type": "string",
                    "description": "Full property address including city and state"
                },
                "deal_id": {
                    "type": "string",
                    "description": "Optional: Deal ID if property is in the system"
                }
            },
            "required": ["address"]
        }
    },
    {
        "name": "analyze_market_supply",
        "description": "Analyze market inventory, absorption, and competition for a market area. Use when user asks about: market conditions, competition, inventory, absorption rates, vacancy.",
        "function": analyze_market_supply,
        "parameters": {
            "type": "object",
            "properties": {
                "market": {
                    "type": "string",
                    "description": "Market area name (e.g., 'Midtown Atlanta', 'Atlanta')"
                },
                "property_type": {
                    "type": "string",
                    "description": "Property type (default: 'multifamily')",
                    "enum": ["multifamily", "office", "retail", "industrial"]
                }
            },
            "required": ["market"]
        }
    },
    {
        "name": "analyze_deal_financials",
        "description": "Run financial analysis (IRR, cap rate, cash flow) on a deal. Use when user asks about: returns, profitability, cash flow, ROI, investment metrics.",
        "function": analyze_deal_financials,
        "parameters": {
            "type": "object",
            "properties": {
                "deal_id": {
                    "type": "string",
                    "description": "Deal ID in JediRe system"
                },
                "assumptions": {
                    "type": "object",
                    "description": "Optional custom assumptions (rent growth, exit cap, etc.)"
                }
            },
            "required": ["deal_id"]
        }
    }
]
