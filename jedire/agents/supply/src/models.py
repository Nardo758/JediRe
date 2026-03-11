"""
Data models for Supply Agent
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any
from datetime import datetime
from enum import Enum


class MarketInterpretation(str, Enum):
    """Supply market interpretation categories"""
    SEVERE_SHORTAGE = "severe_shortage"
    SHORTAGE = "shortage"
    TIGHT = "tight"
    BALANCED = "balanced"
    LOOSE = "loose"
    OVERSUPPLY = "oversupply"
    SEVERE_OVERSUPPLY = "severe_oversupply"


class InventoryMetrics(BaseModel):
    """Core inventory metrics for a market"""
    total_inventory: int = Field(..., description="Total active listings")
    months_of_supply: float = Field(..., description="Months of inventory at current absorption")
    absorption_rate: float = Field(..., description="Rate of inventory turnover (0-1)")
    median_dom: int = Field(..., description="Median days on market")
    new_listings_30d: int = Field(..., description="New listings in last 30 days")
    pending_sales: int = Field(..., description="Properties under contract")
    closed_sales_30d: Optional[int] = Field(None, description="Closed sales in last 30 days")
    price_reductions: Optional[int] = Field(None, description="Price reductions in last 30 days")
    

class InventoryTrends(BaseModel):
    """Inventory trend analysis"""
    inventory_change_30d: float = Field(..., description="% change in inventory (30 days)")
    inventory_change_90d: float = Field(..., description="% change in inventory (90 days)")
    absorption_change: float = Field(..., description="Change in absorption rate")
    dom_change_30d: Optional[float] = Field(None, description="Change in days on market")
    new_listings_trend: Optional[str] = Field(None, description="Trending up/down/stable")


class SupplyScore(BaseModel):
    """Supply score calculation breakdown"""
    overall_score: int = Field(..., ge=0, le=100, description="Overall supply score (0-100)")
    inventory_component: float = Field(..., description="Inventory factor contribution")
    absorption_component: float = Field(..., description="Absorption factor contribution")
    dom_component: float = Field(..., description="DOM factor contribution")
    trend_component: float = Field(..., description="Trend factor contribution")
    interpretation: MarketInterpretation = Field(..., description="Score interpretation")
    confidence: float = Field(..., ge=0, le=1, description="Confidence in score (0-1)")


class AIInsights(BaseModel):
    """Claude AI generated insights"""
    summary: str = Field(..., description="Brief market summary")
    key_findings: List[str] = Field(..., description="Key insights")
    recommendations: List[str] = Field(..., description="Actionable recommendations")
    risks: Optional[List[str]] = Field(None, description="Market risks")
    opportunities: Optional[List[str]] = Field(None, description="Investment opportunities")


class SupplyAnalysis(BaseModel):
    """Complete supply analysis result"""
    agent: str = "supply"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    market: str = Field(..., description="Market name (e.g., 'Austin, TX')")
    
    # Core data
    metrics: InventoryMetrics
    trends: InventoryTrends
    score: SupplyScore
    
    # AI insights
    ai_insights: Optional[AIInsights] = None
    
    # Metadata
    data_sources: List[str] = Field(default_factory=list, description="Sources used")
    data_quality: Optional[str] = Field(None, description="Quality assessment")
    processing_time_ms: Optional[int] = Field(None, description="Processing duration")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class MarketData(BaseModel):
    """Raw market data from collectors"""
    source: str = Field(..., description="Data source name")
    market: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Listing data
    active_listings: List[Dict[str, Any]] = Field(default_factory=list)
    pending_listings: List[Dict[str, Any]] = Field(default_factory=list)
    sold_listings: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Aggregated stats
    total_active: int = 0
    total_pending: int = 0
    total_sold_30d: int = 0
    
    # Price data
    median_list_price: Optional[float] = None
    median_sold_price: Optional[float] = None
    
    # Quality metrics
    completeness: float = Field(default=1.0, ge=0, le=1, description="Data completeness (0-1)")
    is_stale: bool = Field(default=False, description="Data older than threshold")


class AgentMetrics(BaseModel):
    """Agent performance metrics"""
    agent: str = "supply"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Performance
    markets_analyzed: int = 0
    successful_analyses: int = 0
    failed_analyses: int = 0
    average_processing_time_ms: float = 0.0
    
    # Data collection
    api_calls_made: int = 0
    scraping_attempts: int = 0
    data_quality_score: float = 0.0
    
    # AI usage
    claude_calls: int = 0
    claude_tokens_used: int = 0
    
    # System
    memory_usage_mb: float = 0.0
    cpu_usage_percent: float = 0.0
    uptime_seconds: int = 0
    
    # Errors
    error_count: int = 0
    last_error: Optional[str] = None
    last_error_time: Optional[datetime] = None


class CollectorResult(BaseModel):
    """Result from a data collector"""
    source: str
    success: bool
    market_data: Optional[MarketData] = None
    error: Optional[str] = None
    response_time_ms: int = 0
    timestamp: datetime = Field(default_factory=datetime.utcnow)
