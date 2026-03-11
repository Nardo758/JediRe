# JediRe Agents Integration Guide

**Goal**: Connect the new User Agent (chat interface) with existing JediRe Analysis Agents (zoning, supply, cashflow)

---

## Architecture Overview

```
User (Telegram/Platform)
    ↓
User Agent API (FastAPI)
    ↓
JediRe Platform API
    ↓
Agent Orchestrator
    ↓
┌─────────────┬─────────────┬─────────────┐
│   Zoning    │   Supply    │  Cash Flow  │
│   Agent     │   Agent     │   Agent     │
└─────────────┴─────────────┴─────────────┘
```

---

## Step 1: Add JediRe API Client

**File**: `jedire-agents/user-agent/integrations/jedire_api.py`

```python
"""
JediRe Platform API Client
Calls existing analysis agents
"""

import os
import httpx
from typing import Dict, Any, Optional
from decimal import Decimal

class JediReAPI:
    """Client for JediRe platform API"""
    
    def __init__(self):
        self.base_url = os.getenv("JEDIRE_API_URL", "http://localhost:3000")
        self.api_key = os.getenv("JEDIRE_API_KEY")
    
    async def submit_analysis_task(
        self,
        task_type: str,
        input_data: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Submit task to JediRe agent orchestrator
        
        Args:
            task_type: One of 'zoning_analysis', 'supply_analysis', 'cashflow_analysis'
            input_data: Task-specific input data
            user_id: User making the request
        
        Returns:
            Task object with id and status
        """
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/v1/agents/tasks",
                headers=headers,
                json={
                    "taskType": task_type,
                    "inputData": input_data,
                    "priority": 1
                },
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
    
    async def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """
        Get task status and results
        
        Returns:
            Task with status: 'pending', 'running', 'completed', 'failed'
        """
        
        headers = {"Authorization": f"Bearer {self.api_key}"}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/agents/tasks/{task_id}",
                headers=headers,
                timeout=10.0
            )
            response.raise_for_status()
            return response.json()
    
    async def wait_for_task(
        self,
        task_id: str,
        timeout: int = 60,
        poll_interval: int = 2
    ) -> Dict[str, Any]:
        """
        Wait for task to complete
        
        Polls task status until completed or timeout
        """
        
        import asyncio
        
        elapsed = 0
        while elapsed < timeout:
            task = await self.get_task_status(task_id)
            
            if task['status'] == 'completed':
                return task
            elif task['status'] == 'failed':
                raise Exception(f"Task failed: {task.get('error', 'Unknown error')}")
            
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval
        
        raise TimeoutError(f"Task {task_id} did not complete within {timeout}s")
    
    # Convenience methods for each agent type
    
    async def analyze_zoning(
        self,
        property_address: str,
        deal_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Run zoning analysis on a property
        
        Returns:
            Zoning regulations, development potential, unit capacity, etc.
        """
        
        task = await self.submit_analysis_task(
            task_type="zoning_analysis",
            input_data={
                "propertyAddress": property_address,
                "dealId": deal_id
            }
        )
        
        # Wait for completion
        result = await self.wait_for_task(task['id'])
        return result['outputData']
    
    async def analyze_supply(
        self,
        market_area: str,
        property_type: str = "multifamily"
    ) -> Dict[str, Any]:
        """
        Run supply/inventory analysis for a market
        
        Returns:
            Market inventory, absorption rates, competitive analysis
        """
        
        task = await self.submit_analysis_task(
            task_type="supply_analysis",
            input_data={
                "marketArea": market_area,
                "propertyType": property_type
            }
        )
        
        result = await self.wait_for_task(task['id'])
        return result['outputData']
    
    async def analyze_cashflow(
        self,
        deal_id: str,
        assumptions: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Run cash flow / ROI analysis on a deal
        
        Returns:
            Financial projections, IRR, cap rate, cash-on-cash, etc.
        """
        
        task = await self.submit_analysis_task(
            task_type="cashflow_analysis",
            input_data={
                "dealId": deal_id,
                "assumptions": assumptions or {}
            }
        )
        
        result = await self.wait_for_task(task['id'])
        return result['outputData']
```

---

## Step 2: Update AI Gateway System Prompt

**File**: `jedire-agents/user-agent/prompts/system.md`

```markdown
You are an AI assistant for JediRe, a commercial real estate investment platform.

Your role is to help users:
- Analyze real estate deals and investment opportunities
- Run financial models (ROI, cap rate, IRR, etc.)
- Compare properties and markets
- Understand CRE concepts and terminology
- Make informed investment decisions

## Tools Available

You have access to JediRe's analysis agents:

### 1. Zoning Analysis
**When to use**: User asks about development potential, zoning, unit capacity, allowed uses
**What it does**: Analyzes zoning regulations and returns development potential
**Example queries**:
- "What can I build on this property?"
- "How many units can I fit on 1950 Piedmont Circle?"
- "What's the zoning for this address?"

### 2. Supply Analysis
**When to use**: User asks about market inventory, competition, absorption rates
**What it does**: Analyzes market supply and competitive landscape
**Example queries**:
- "What's the market like in Atlanta?"
- "How much competition is there for multifamily in Midtown?"
- "What's the absorption rate?"

### 3. Cash Flow Analysis
**When to use**: User asks about financial performance, returns, profitability
**What it does**: Runs financial models and returns IRR, cap rate, cash-on-cash, etc.
**Example queries**:
- "What's the ROI on this deal?"
- "Calculate cash flow for this property"
- "Is this a good investment?"

## How to Use Tools

When a user query requires analysis:

1. **Identify which agent(s) to call**
2. **Extract relevant parameters from user's message**
3. **Call the appropriate agent**
4. **Wait for results**
5. **Format results in natural language**

## Response Style

- Be professional but conversational
- Explain complex concepts simply
- Always cite the source when using agent analysis
- If uncertain, say so - never guarantee returns
- Include disclaimers for financial/legal advice
```

---

## Step 3: Create Agent Tools for AI

**File**: `jedire-agents/user-agent/api/jedire_tools.py`

```python
"""
JediRe Agent Tools
Functions that the AI can call to run analysis
"""

from typing import Dict, Any, Optional
from .integrations.jedire_api import JediReAPI

jedire_api = JediReAPI()

async def analyze_property_zoning(
    address: str,
    deal_id: Optional[str] = None
) -> str:
    """
    Analyze zoning regulations and development potential for a property.
    
    Args:
        address: Property address (e.g., "1950 Piedmont Circle NE, Atlanta, GA")
        deal_id: Optional deal ID if property is in the system
    
    Returns:
        Formatted analysis of zoning, allowed uses, and development potential
    """
    
    try:
        result = await jedire_api.analyze_zoning(address, deal_id)
        
        # Format results for AI consumption
        summary = f"""
Zoning Analysis for {address}:

**Zoning District**: {result.get('zoningDistrict', 'Unknown')}

**Allowed Uses**: {', '.join(result.get('allowedUses', []))}

**Development Potential**:
- Maximum Units: {result.get('maxUnits', 'N/A')}
- Maximum Height: {result.get('maxHeight', 'N/A')} feet
- Maximum FAR: {result.get('maxFAR', 'N/A')}
- Parking Required: {result.get('parkingRequired', 'N/A')} spaces

**Key Regulations**:
{chr(10).join(f"- {reg}" for reg in result.get('keyRegulations', []))}
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
        market: Market area (e.g., "Atlanta", "Midtown Atlanta")
        property_type: Type of property (default: "multifamily")
    
    Returns:
        Formatted market supply analysis
    """
    
    try:
        result = await jedire_api.analyze_supply(market, property_type)
        
        summary = f"""
Market Supply Analysis for {market} ({property_type}):

**Current Inventory**:
- Total Units: {result.get('totalUnits', 'N/A'):,}
- Vacant Units: {result.get('vacantUnits', 'N/A'):,}
- Vacancy Rate: {result.get('vacancyRate', 'N/A')}%

**Absorption**:
- Quarterly Absorption: {result.get('quarterlyAbsorption', 'N/A')} units
- Months of Inventory: {result.get('monthsOfInventory', 'N/A')}

**Competition**:
- Competing Properties: {result.get('competingProperties', 'N/A')}
- Average Rent: ${result.get('avgRent', 'N/A')}/unit

**Market Trend**: {result.get('trendAnalysis', 'Data not available')}
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
        Formatted financial analysis with returns
    """
    
    try:
        result = await jedire_api.analyze_cashflow(deal_id, assumptions)
        
        summary = f"""
Financial Analysis for Deal {deal_id}:

**Purchase Details**:
- Purchase Price: ${result.get('purchasePrice', 0):,.0f}
- Units: {result.get('units', 'N/A')}
- Price per Unit: ${result.get('pricePerUnit', 0):,.0f}

**Returns** (Year 1):
- Cap Rate: {result.get('capRate', 'N/A')}%
- Cash-on-Cash: {result.get('cashOnCash', 'N/A')}%
- IRR (10-year): {result.get('irr', 'N/A')}%

**Cash Flow** (Year 1):
- Gross Income: ${result.get('grossIncome', 0):,.0f}
- Operating Expenses: ${result.get('opex', 0):,.0f}
- NOI: ${result.get('noi', 0):,.0f}
- Debt Service: ${result.get('debtService', 0):,.0f}
- Net Cash Flow: ${result.get('netCashFlow', 0):,.0f}

**Key Metrics**:
- Debt Coverage Ratio: {result.get('dscr', 'N/A')}
- Break-even Occupancy: {result.get('breakEvenOccupancy', 'N/A')}%
"""
        
        return summary
        
    except Exception as e:
        return f"Error analyzing deal financials: {str(e)}"


# Tool registry for AI
AVAILABLE_TOOLS = [
    {
        "name": "analyze_property_zoning",
        "description": "Analyze zoning regulations and development potential for a property address",
        "function": analyze_property_zoning,
        "parameters": {
            "address": {"type": "string", "required": True},
            "deal_id": {"type": "string", "required": False}
        }
    },
    {
        "name": "analyze_market_supply",
        "description": "Analyze market inventory, absorption, and competition for a market area",
        "function": analyze_market_supply,
        "parameters": {
            "market": {"type": "string", "required": True},
            "property_type": {"type": "string", "required": False}
        }
    },
    {
        "name": "analyze_deal_financials",
        "description": "Run financial analysis (IRR, cap rate, cash flow) on a deal",
        "function": analyze_deal_financials,
        "parameters": {
            "deal_id": {"type": "string", "required": True},
            "assumptions": {"type": "object", "required": False}
        }
    }
]
```

---

## Step 4: Update AI Gateway to Use Tools

**File**: `jedire-agents/user-agent/api/ai_gateway.py` (additions)

```python
# Add to imports
from .jedire_tools import AVAILABLE_TOOLS, analyze_property_zoning, analyze_market_supply, analyze_deal_financials

# Update _call_anthropic method to support function calling
async def _call_anthropic(
    self,
    model: AIModel,
    messages: List[Dict[str, str]]
) -> Dict[str, Any]:
    """Call Anthropic Claude API with tool support"""
    
    if not self.anthropic_client:
        raise ValueError("Anthropic API key not configured")
    
    # System prompt with tools
    system_prompt = """You are an AI assistant for JediRe...
    
    You have access to these analysis tools:
    - analyze_property_zoning(address, deal_id?) - Zoning analysis
    - analyze_market_supply(market, property_type?) - Market analysis
    - analyze_deal_financials(deal_id, assumptions?) - Financial analysis
    
    When a user asks about properties, markets, or financials, USE THESE TOOLS.
    After getting results, format them naturally in your response."""
    
    try:
        # First pass - let Claude decide if it needs tools
        response = self.anthropic_client.messages.create(
            model=model.id,
            max_tokens=4096,
            system=system_prompt,
            messages=messages
        )
        
        # Check if Claude wants to call a tool
        # (This is simplified - real implementation would use Claude's tool calling)
        content = response.content[0].text
        
        # Parse for tool calls (simple pattern matching for now)
        # Real implementation: use Claude's function calling API
        if "analyze_property_zoning" in content.lower():
            # Extract address from message
            # Call tool
            # Add result to messages
            # Make second Claude call with results
            pass
        
        return {
            'content': content,
            'input_tokens': response.usage.input_tokens,
            'output_tokens': response.usage.output_tokens
        }
    
    except Exception as e:
        raise Exception(f"Anthropic API error: {str(e)}")
```

---

## Step 5: Example Usage Flow

### User Query → Agent Call → Response

**User**: "What can I build on 1950 Piedmont Circle in Atlanta?"

**User Agent**:
1. Identifies: Needs zoning analysis
2. Calls: `analyze_property_zoning("1950 Piedmont Circle NE, Atlanta, GA")`
3. JediRe Platform: Runs Zoning Agent
4. Returns: Development potential data
5. Formats: Natural language response

**Response**:
```
Based on the zoning analysis for 1950 Piedmont Circle in Atlanta:

The property is zoned MRC-2-C (Mixed Residential Commercial), which allows 
for multifamily residential development. Here's what you can build:

Development Potential:
• Maximum Units: 300 units (based on lot size and density regulations)
• Maximum Height: 12 stories (150 feet)
• Parking Required: 1.5 spaces per unit (450 spaces total)

Allowed Uses include:
- Multifamily housing
- Mixed-use development
- Ground-floor retail
- Parking structures

Key Regulations:
- Minimum 20% open space required
- Street-level activation required along Piedmont
- Step-back requirements above 6 stories

This is a great site for a mid-rise multifamily development. The MRC-2-C zoning 
is quite favorable for your 300-unit project.

Would you like me to run a financial analysis to see the potential returns?
```

---

## Step 6: Environment Configuration

**Update**: `jedire-agents/user-agent/.env.example`

```bash
# Existing
DATABASE_URL=postgresql://localhost/jedire_agent
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=...
MARKUP_PERCENTAGE=30

# NEW: JediRe Platform Integration
JEDIRE_API_URL=http://localhost:3000
JEDIRE_API_KEY=your-platform-api-key-here

# Or for production
# JEDIRE_API_URL=https://api.jedire.com
```

---

## Step 7: Testing the Integration

**Test Script**: `jedire-agents/user-agent/test_integration.py`

```python
"""
Test JediRe integration
"""

import asyncio
from integrations.jedire_api import JediReAPI

async def test_zoning():
    """Test zoning agent integration"""
    api = JediReAPI()
    
    print("Testing zoning analysis...")
    result = await api.analyze_zoning(
        property_address="1950 Piedmont Circle NE, Atlanta, GA 30324"
    )
    
    print("Zoning Result:")
    print(result)

async def test_supply():
    """Test supply agent integration"""
    api = JediReAPI()
    
    print("Testing supply analysis...")
    result = await api.analyze_supply(
        market_area="Midtown Atlanta",
        property_type="multifamily"
    )
    
    print("Supply Result:")
    print(result)

if __name__ == "__main__":
    asyncio.run(test_zoning())
    asyncio.run(test_supply())
```

---

## Step 8: Deployment Checklist

- [ ] Add JediRe API credentials to `.env`
- [ ] Create API key for User Agent in JediRe platform
- [ ] Test all three agent integrations
- [ ] Update system prompt with tool descriptions
- [ ] Deploy User Agent API
- [ ] Add chat widget to JediRe platform frontend
- [ ] Test end-to-end user flow
- [ ] Monitor agent usage and costs

---

## Next Steps

1. **Immediate**: Create the integration files above
2. **Test**: Verify agents can call each other
3. **Enhance**: Add more sophisticated tool calling
4. **Deploy**: Put it live in production

Want me to start building these integration files?
