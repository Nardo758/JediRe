"""
Trend Analyzer for Supply Agent
Analyzes inventory trends, absorption rates, and market dynamics
"""
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from loguru import logger
import statistics

from ..models import MarketData, InventoryMetrics, InventoryTrends


class TrendAnalyzer:
    """Analyzes inventory trends and market dynamics"""
    
    def __init__(self):
        self.name = "TrendAnalyzer"
    
    async def analyze(
        self,
        market: str,
        current_data: List[MarketData],
        historical_data: Optional[List[Dict]] = None
    ) -> tuple[InventoryMetrics, InventoryTrends]:
        """
        Analyze inventory metrics and trends
        
        Args:
            market: Market identifier
            current_data: List of MarketData from all collectors
            historical_data: Optional historical metrics from database
            
        Returns:
            Tuple of (InventoryMetrics, InventoryTrends)
        """
        logger.info(f"Analyzing trends for {market}")
        
        # Aggregate data from all sources
        aggregated = self._aggregate_sources(current_data)
        
        # Calculate current metrics
        metrics = self._calculate_metrics(aggregated)
        
        # Calculate trends (requires historical data)
        trends = self._calculate_trends(metrics, historical_data)
        
        logger.success(
            f"Analysis complete: {metrics.total_inventory} active, "
            f"{metrics.months_of_supply:.1f} months supply, "
            f"{metrics.absorption_rate:.2%} absorption"
        )
        
        return metrics, trends
    
    def _aggregate_sources(self, data_list: List[MarketData]) -> Dict:
        """
        Aggregate data from multiple sources
        
        Combines data from Zillow, Redfin, etc. and deduplicates
        """
        all_active = []
        all_pending = []
        all_sold = []
        
        for data in data_list:
            all_active.extend(data.active_listings)
            all_pending.extend(data.pending_listings)
            all_sold.extend(data.sold_listings)
        
        # Deduplicate by address (simple approach)
        active = self._deduplicate_listings(all_active)
        pending = self._deduplicate_listings(all_pending)
        sold = self._deduplicate_listings(all_sold)
        
        return {
            'active': active,
            'pending': pending,
            'sold': sold
        }
    
    def _deduplicate_listings(self, listings: List[Dict]) -> List[Dict]:
        """
        Remove duplicate listings across sources
        
        Uses address as deduplication key
        """
        seen_addresses = set()
        unique = []
        
        for listing in listings:
            address = listing.get('address', '').lower().strip()
            if not address:
                continue
                
            # Create a composite key
            key = f"{address}_{listing.get('city', '')}_{listing.get('zip', '')}"
            
            if key not in seen_addresses:
                seen_addresses.add(key)
                unique.append(listing)
        
        return unique
    
    def _calculate_metrics(self, aggregated: Dict) -> InventoryMetrics:
        """Calculate core inventory metrics"""
        
        active = aggregated['active']
        pending = aggregated['pending']
        sold = aggregated['sold']
        
        # Total counts
        total_inventory = len(active)
        total_pending = len(pending)
        total_sold_30d = len(sold)
        
        # Months of supply
        # Formula: (Active Inventory) / (Avg Monthly Sales)
        avg_monthly_sales = total_sold_30d  # Approximation for 30 days
        months_of_supply = (
            total_inventory / avg_monthly_sales 
            if avg_monthly_sales > 0 
            else 12.0  # Default to high value if no sales
        )
        
        # Absorption rate
        # Formula: (Sales / (Sales + Inventory))
        total_market_size = total_sold_30d + total_inventory
        absorption_rate = (
            total_sold_30d / total_market_size 
            if total_market_size > 0 
            else 0.0
        )
        
        # Median days on market
        dom_values = [
            listing.get('days_on_market', 0) 
            for listing in active 
            if listing.get('days_on_market') is not None
        ]
        median_dom = int(statistics.median(dom_values)) if dom_values else 30
        
        # New listings (estimate from active + sold)
        # In real scenario, would track actual new listings
        new_listings_30d = total_inventory + total_sold_30d
        
        # Price reductions (would need historical data)
        price_reductions = self._estimate_price_reductions(active)
        
        return InventoryMetrics(
            total_inventory=total_inventory,
            months_of_supply=round(months_of_supply, 2),
            absorption_rate=round(absorption_rate, 3),
            median_dom=median_dom,
            new_listings_30d=new_listings_30d,
            pending_sales=total_pending,
            closed_sales_30d=total_sold_30d,
            price_reductions=price_reductions
        )
    
    def _calculate_trends(
        self,
        current: InventoryMetrics,
        historical: Optional[List[Dict]]
    ) -> InventoryTrends:
        """
        Calculate trend metrics comparing to historical data
        
        Args:
            current: Current inventory metrics
            historical: List of historical metrics from database
                       Format: [{'timestamp': ..., 'total_inventory': ..., ...}, ...]
        """
        if not historical or len(historical) == 0:
            # No historical data - return neutral trends
            return InventoryTrends(
                inventory_change_30d=0.0,
                inventory_change_90d=0.0,
                absorption_change=0.0,
                dom_change_30d=0.0,
                new_listings_trend="stable"
            )
        
        # Sort by timestamp
        historical = sorted(historical, key=lambda x: x['timestamp'], reverse=True)
        
        # Find data from 30 and 90 days ago
        now = datetime.utcnow()
        thirty_days_ago = now - timedelta(days=30)
        ninety_days_ago = now - timedelta(days=90)
        
        data_30d = self._find_closest_data(historical, thirty_days_ago)
        data_90d = self._find_closest_data(historical, ninety_days_ago)
        
        # Calculate inventory changes
        inventory_change_30d = (
            self._percent_change(data_30d.get('total_inventory'), current.total_inventory)
            if data_30d else 0.0
        )
        
        inventory_change_90d = (
            self._percent_change(data_90d.get('total_inventory'), current.total_inventory)
            if data_90d else 0.0
        )
        
        # Absorption rate change
        absorption_change = (
            current.absorption_rate - data_30d.get('absorption_rate', current.absorption_rate)
            if data_30d else 0.0
        )
        
        # DOM change
        dom_change_30d = (
            self._percent_change(data_30d.get('median_dom'), current.median_dom)
            if data_30d else 0.0
        )
        
        # New listings trend
        new_listings_trend = self._determine_listing_trend(historical, current)
        
        return InventoryTrends(
            inventory_change_30d=round(inventory_change_30d, 2),
            inventory_change_90d=round(inventory_change_90d, 2),
            absorption_change=round(absorption_change, 3),
            dom_change_30d=round(dom_change_30d, 2) if dom_change_30d else None,
            new_listings_trend=new_listings_trend
        )
    
    def _find_closest_data(self, historical: List[Dict], target_date: datetime) -> Optional[Dict]:
        """Find historical data point closest to target date"""
        if not historical:
            return None
        
        closest = min(
            historical,
            key=lambda x: abs((x['timestamp'] - target_date).total_seconds())
        )
        
        # Only return if within reasonable range (7 days)
        if abs((closest['timestamp'] - target_date).days) <= 7:
            return closest
        
        return None
    
    def _percent_change(self, old_value: Optional[float], new_value: float) -> float:
        """Calculate percent change"""
        if old_value is None or old_value == 0:
            return 0.0
        
        return ((new_value - old_value) / old_value) * 100
    
    def _determine_listing_trend(self, historical: List[Dict], current: InventoryMetrics) -> str:
        """Determine if new listings are trending up, down, or stable"""
        if len(historical) < 3:
            return "stable"
        
        recent = historical[:3]
        avg_new_listings = statistics.mean([
            h.get('new_listings_30d', 0) 
            for h in recent 
            if h.get('new_listings_30d')
        ])
        
        if avg_new_listings == 0:
            return "stable"
        
        change = ((current.new_listings_30d - avg_new_listings) / avg_new_listings) * 100
        
        if change > 10:
            return "up"
        elif change < -10:
            return "down"
        else:
            return "stable"
    
    def _estimate_price_reductions(self, active_listings: List[Dict]) -> int:
        """
        Estimate price reductions
        
        In production, would track actual price history
        For MVP, estimate based on high DOM
        """
        # Assume properties with >45 days on market likely had price reduction
        high_dom_count = sum(
            1 for listing in active_listings 
            if listing.get('days_on_market', 0) > 45
        )
        
        # Estimate ~40% of high DOM properties had price reductions
        return int(high_dom_count * 0.4)
