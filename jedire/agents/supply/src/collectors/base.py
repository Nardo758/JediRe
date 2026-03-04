"""
Base collector interface for data sources
"""
from abc import ABC, abstractmethod
from typing import Optional
import time
from loguru import logger

from ..models import MarketData, CollectorResult


class BaseCollector(ABC):
    """Abstract base class for all data collectors"""
    
    def __init__(self, name: str):
        self.name = name
        self.call_count = 0
        self.error_count = 0
        self.total_response_time_ms = 0
    
    @abstractmethod
    async def collect(self, market: str) -> MarketData:
        """
        Collect data for a specific market
        
        Args:
            market: Market identifier (e.g., "Austin, TX")
            
        Returns:
            MarketData object with collected listings and stats
            
        Raises:
            CollectorError: If data collection fails
        """
        pass
    
    async def collect_safe(self, market: str) -> CollectorResult:
        """
        Safely collect data with error handling and metrics
        
        Args:
            market: Market identifier
            
        Returns:
            CollectorResult with success status and data or error
        """
        start_time = time.time()
        
        try:
            logger.info(f"{self.name}: Collecting data for {market}")
            
            market_data = await self.collect(market)
            
            response_time = int((time.time() - start_time) * 1000)
            self.call_count += 1
            self.total_response_time_ms += response_time
            
            logger.success(
                f"{self.name}: Successfully collected {market_data.total_active} "
                f"active listings for {market} in {response_time}ms"
            )
            
            return CollectorResult(
                source=self.name,
                success=True,
                market_data=market_data,
                response_time_ms=response_time
            )
            
        except Exception as e:
            response_time = int((time.time() - start_time) * 1000)
            self.error_count += 1
            error_msg = f"{self.name} failed for {market}: {str(e)}"
            
            logger.error(error_msg)
            
            return CollectorResult(
                source=self.name,
                success=False,
                error=error_msg,
                response_time_ms=response_time
            )
    
    @property
    def average_response_time_ms(self) -> float:
        """Calculate average response time"""
        if self.call_count == 0:
            return 0.0
        return self.total_response_time_ms / self.call_count
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate"""
        if self.call_count == 0:
            return 1.0
        return (self.call_count - self.error_count) / self.call_count
    
    def get_stats(self) -> dict:
        """Get collector statistics"""
        return {
            "name": self.name,
            "calls": self.call_count,
            "errors": self.error_count,
            "success_rate": self.success_rate,
            "avg_response_time_ms": self.average_response_time_ms
        }


class CollectorError(Exception):
    """Exception raised by collectors"""
    pass
