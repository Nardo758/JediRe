"""
JediRe Platform Integrations
Connect User Agent with existing JediRe analysis agents
"""

from .jedire_api import JediReAPI
from .jedire_tools import (
    analyze_property_zoning,
    analyze_market_supply,
    analyze_deal_financials,
    AVAILABLE_TOOLS
)

__all__ = [
    'JediReAPI',
    'analyze_property_zoning',
    'analyze_market_supply',
    'analyze_deal_financials',
    'AVAILABLE_TOOLS'
]
