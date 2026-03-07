"""
JediRe Platform API Client
Calls existing analysis agents (zoning, supply, cashflow)
"""

import os
import httpx
from typing import Dict, Any, Optional
import asyncio

class JediReAPI:
    """Client for JediRe platform analysis agents"""
    
    def __init__(self):
        self.base_url = os.getenv("JEDIRE_API_URL", "http://localhost:3000")
        self.api_key = os.getenv("JEDIRE_API_KEY")
        self._client: Optional[httpx.AsyncClient] = None
        
        if not self.api_key:
            print("⚠️  JEDIRE_API_KEY not set - agent integration disabled")
    
    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers={
                    "x-api-key": self.api_key or "",
                    "Content-Type": "application/json"
                },
                timeout=30.0
            )
        return self._client
    
    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None
    
    async def submit_analysis_task(
        self,
        task_type: str,
        input_data: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Submit task to JediRe agent orchestrator
        
        Args:
            task_type: 'zoning_analysis', 'supply_analysis', or 'cashflow_analysis'
            input_data: Task-specific input data
            user_id: Optional user ID
        
        Returns:
            Task object with id and status
        """
        
        if not self.api_key:
            raise ValueError("JEDIRE_API_KEY not configured")
        
        payload = {
            "taskType": task_type,
            "inputData": input_data,
            "priority": 1
        }
        
        client = await self._get_client()
        response = await client.post(
            "/api/v1/agents/tasks",
            json=payload
        )
        response.raise_for_status()
        return response.json()
    
    async def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """Get task status and results"""
        
        if not self.api_key:
            raise ValueError("JEDIRE_API_KEY not configured")
        
        client = await self._get_client()
        response = await client.get(
            f"/api/v1/agents/tasks/{task_id}"
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
        
        Polls task status until completed, failed, or timeout
        """
        
        elapsed = 0
        while elapsed < timeout:
            task = await self.get_task_status(task_id)
            
            status = task.get('status')
            
            if status == 'completed':
                return task
            elif status == 'failed':
                error = task.get('error', 'Unknown error')
                raise Exception(f"Task failed: {error}")
            
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval
        
        raise TimeoutError(f"Task {task_id} did not complete within {timeout}s")
    
    async def analyze_zoning(
        self,
        property_address: str,
        deal_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Run zoning analysis on a property
        
        Args:
            property_address: Full property address
            deal_id: Optional deal ID if property is in system
        
        Returns:
            Zoning regulations, development potential, unit capacity
        """
        
        task = await self.submit_analysis_task(
            task_type="zoning_analysis",
            input_data={
                "propertyAddress": property_address,
                "dealId": deal_id
            }
        )
        
        result = await self.wait_for_task(task['id'], timeout=90)
        return result.get('outputData', {})
    
    async def analyze_supply(
        self,
        market_area: str,
        property_type: str = "multifamily"
    ) -> Dict[str, Any]:
        """
        Run supply/inventory analysis for a market
        
        Args:
            market_area: Market name (e.g., "Midtown Atlanta")
            property_type: Property type (default: "multifamily")
        
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
        
        result = await self.wait_for_task(task['id'], timeout=90)
        return result.get('outputData', {})
    
    async def analyze_cashflow(
        self,
        deal_id: str,
        assumptions: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Run cash flow / ROI analysis on a deal
        
        Args:
            deal_id: Deal ID in JediRe system
            assumptions: Optional custom assumptions
        
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
        
        result = await self.wait_for_task(task['id'], timeout=90)
        return result.get('outputData', {})
