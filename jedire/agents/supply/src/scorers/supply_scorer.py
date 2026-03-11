"""
Supply Scorer
Calculates 0-100 supply score based on inventory metrics and trends
"""
from typing import Dict
from loguru import logger

from ..models import InventoryMetrics, InventoryTrends, SupplyScore, MarketInterpretation
from config.settings import settings


class SupplyScorer:
    """
    Calculates supply score (0-100) for a market
    
    Score interpretation:
    - 90-100: Severe shortage (hot seller's market)
    - 75-89:  Shortage (seller's market)
    - 60-74:  Tight market (favors sellers)
    - 40-59:  Balanced market
    - 25-39:  Loose market (favors buyers)
    - 10-24:  Oversupply (buyer's market)
    - 0-9:    Severe oversupply (very cold market)
    """
    
    def __init__(self):
        self.name = "SupplyScorer"
        self.weights = settings.score_weights
    
    async def calculate_score(
        self,
        metrics: InventoryMetrics,
        trends: InventoryTrends
    ) -> SupplyScore:
        """
        Calculate overall supply score
        
        Args:
            metrics: Current inventory metrics
            trends: Inventory trends
            
        Returns:
            SupplyScore with overall score and component breakdown
        """
        logger.info("Calculating supply score...")
        
        # Calculate individual components (0-100 each)
        inventory_component = self._score_inventory(metrics.months_of_supply)
        absorption_component = self._score_absorption(metrics.absorption_rate)
        dom_component = self._score_dom(metrics.median_dom)
        trend_component = self._score_trends(trends)
        
        # Weight and sum components
        overall_score = (
            inventory_component * self.weights['inventory'] +
            absorption_component * self.weights['absorption'] +
            dom_component * self.weights['dom'] +
            trend_component * self.weights['trend']
        )
        
        # Round to integer
        overall_score = int(round(overall_score))
        
        # Ensure within bounds
        overall_score = max(0, min(100, overall_score))
        
        # Interpret score
        interpretation = self._interpret_score(overall_score)
        
        # Calculate confidence
        confidence = self._calculate_confidence(metrics, trends)
        
        logger.success(
            f"Supply score: {overall_score}/100 ({interpretation.value}) "
            f"[Inv:{inventory_component:.0f} Abs:{absorption_component:.0f} "
            f"DOM:{dom_component:.0f} Trend:{trend_component:.0f}]"
        )
        
        return SupplyScore(
            overall_score=overall_score,
            inventory_component=round(inventory_component, 2),
            absorption_component=round(absorption_component, 2),
            dom_component=round(dom_component, 2),
            trend_component=round(trend_component, 2),
            interpretation=interpretation,
            confidence=round(confidence, 2)
        )
    
    def _score_inventory(self, months_of_supply: float) -> float:
        """
        Score based on months of supply
        
        Lower months of supply = Higher score (tighter market)
        
        Benchmarks:
        - <1 month: Extreme shortage (100)
        - 1-2 months: Strong shortage (85)
        - 2-3 months: Shortage (70)
        - 3-4 months: Tight (55)
        - 4-6 months: Balanced (50)
        - 6-9 months: Loose (30)
        - 9-12 months: Oversupply (15)
        - >12 months: Severe oversupply (0)
        """
        if months_of_supply < 1:
            return 100
        elif months_of_supply < 2:
            # Linear interpolation between 85-100
            return 85 + (2 - months_of_supply) * 15
        elif months_of_supply < 3:
            return 70 + (3 - months_of_supply) * 15
        elif months_of_supply < 4:
            return 55 + (4 - months_of_supply) * 15
        elif months_of_supply < 6:
            return 45 + (6 - months_of_supply) * 5
        elif months_of_supply < 9:
            return 25 + (9 - months_of_supply) * 6.67
        elif months_of_supply < 12:
            return 10 + (12 - months_of_supply) * 5
        else:
            # Exponential decay for very high inventory
            return max(0, 10 * (1 - (months_of_supply - 12) / 12))
    
    def _score_absorption(self, absorption_rate: float) -> float:
        """
        Score based on absorption rate
        
        Higher absorption = Higher score (stronger demand)
        
        Benchmarks:
        - >0.7: Very high (100)
        - 0.6-0.7: High (85)
        - 0.5-0.6: Above average (70)
        - 0.4-0.5: Balanced (50)
        - 0.3-0.4: Below average (35)
        - 0.2-0.3: Low (20)
        - <0.2: Very low (0)
        """
        if absorption_rate >= 0.7:
            return 100
        elif absorption_rate >= 0.6:
            return 85 + (absorption_rate - 0.6) * 150
        elif absorption_rate >= 0.5:
            return 70 + (absorption_rate - 0.5) * 150
        elif absorption_rate >= 0.4:
            return 50 + (absorption_rate - 0.4) * 200
        elif absorption_rate >= 0.3:
            return 35 + (absorption_rate - 0.3) * 150
        elif absorption_rate >= 0.2:
            return 20 + (absorption_rate - 0.2) * 150
        else:
            return absorption_rate * 100  # Linear from 0-20%
    
    def _score_dom(self, median_dom: int) -> float:
        """
        Score based on days on market
        
        Lower DOM = Higher score (faster moving market)
        
        Benchmarks:
        - <7 days: Extremely hot (100)
        - 7-14 days: Very hot (85)
        - 14-21 days: Hot (70)
        - 21-30 days: Above average (60)
        - 30-45 days: Balanced (50)
        - 45-60 days: Slow (35)
        - 60-90 days: Very slow (20)
        - >90 days: Stagnant (5)
        """
        if median_dom < 7:
            return 100
        elif median_dom < 14:
            return 85 + (14 - median_dom) * 2.14
        elif median_dom < 21:
            return 70 + (21 - median_dom) * 2.14
        elif median_dom < 30:
            return 60 + (30 - median_dom) * 1.11
        elif median_dom < 45:
            return 50 + (45 - median_dom) * 0.67
        elif median_dom < 60:
            return 35 + (60 - median_dom) * 1.0
        elif median_dom < 90:
            return 20 + (90 - median_dom) * 0.5
        else:
            return max(0, 20 - (median_dom - 90) * 0.2)
    
    def _score_trends(self, trends: InventoryTrends) -> float:
        """
        Score based on inventory trends
        
        Declining inventory = Higher score (tightening market)
        Rising inventory = Lower score (loosening market)
        
        Combines:
        - 30-day inventory change (weight: 0.6)
        - 90-day inventory change (weight: 0.3)
        - Absorption change (weight: 0.1)
        """
        # Inventory change score (inverted - negative change = higher score)
        inv_30d_score = self._normalize_percent_change(
            -trends.inventory_change_30d,  # Invert
            extreme=30  # ±30% is extreme
        )
        
        inv_90d_score = self._normalize_percent_change(
            -trends.inventory_change_90d,
            extreme=50  # ±50% over 90 days is extreme
        )
        
        # Absorption change score (positive change = higher score)
        absorption_score = 50  # Default neutral
        if trends.absorption_change != 0:
            # Scale: ±0.1 absorption change is significant
            absorption_score = 50 + (trends.absorption_change * 500)
            absorption_score = max(0, min(100, absorption_score))
        
        # Weighted combination
        trend_score = (
            inv_30d_score * 0.6 +
            inv_90d_score * 0.3 +
            absorption_score * 0.1
        )
        
        return trend_score
    
    def _normalize_percent_change(self, change: float, extreme: float = 30) -> float:
        """
        Normalize percent change to 0-100 score
        
        Args:
            change: Percent change value
            extreme: What's considered an extreme change
            
        Returns:
            Score from 0-100 where 50 is neutral
        """
        if change == 0:
            return 50
        
        # Map change to score
        # Positive extreme change = 100
        # Zero change = 50
        # Negative extreme change = 0
        
        if change > 0:
            score = 50 + min(change / extreme, 1.0) * 50
        else:
            score = 50 - min(abs(change) / extreme, 1.0) * 50
        
        return max(0, min(100, score))
    
    def _interpret_score(self, score: int) -> MarketInterpretation:
        """Convert numeric score to interpretation"""
        if score >= 90:
            return MarketInterpretation.SEVERE_SHORTAGE
        elif score >= 75:
            return MarketInterpretation.SHORTAGE
        elif score >= 60:
            return MarketInterpretation.TIGHT
        elif score >= 40:
            return MarketInterpretation.BALANCED
        elif score >= 25:
            return MarketInterpretation.LOOSE
        elif score >= 10:
            return MarketInterpretation.OVERSUPPLY
        else:
            return MarketInterpretation.SEVERE_OVERSUPPLY
    
    def _calculate_confidence(
        self,
        metrics: InventoryMetrics,
        trends: InventoryTrends
    ) -> float:
        """
        Calculate confidence in the score (0-1)
        
        Factors:
        - Data completeness
        - Sample size
        - Trend consistency
        """
        confidence = 1.0
        
        # Reduce confidence if low inventory count
        if metrics.total_inventory < 100:
            confidence *= 0.7
        elif metrics.total_inventory < 300:
            confidence *= 0.85
        
        # Reduce if no sales data
        if metrics.closed_sales_30d == 0:
            confidence *= 0.6
        elif metrics.closed_sales_30d < 50:
            confidence *= 0.8
        
        # Reduce if trends are contradictory
        # (e.g., inventory dropping but absorption also dropping)
        if (trends.inventory_change_30d < -10 and trends.absorption_change < -0.05):
            confidence *= 0.9
        
        return max(0.3, min(1.0, confidence))  # Keep between 0.3-1.0
