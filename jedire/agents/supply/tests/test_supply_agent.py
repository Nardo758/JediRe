"""
Tests for Supply Agent
"""
import pytest
import asyncio
from datetime import datetime

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.models import (
    InventoryMetrics,
    InventoryTrends,
    SupplyScore,
    MarketInterpretation
)
from src.scorers.supply_scorer import SupplyScorer
from src.analyzers.trend_analyzer import TrendAnalyzer


class TestSupplyScorer:
    """Test supply scoring algorithm"""
    
    @pytest.fixture
    def scorer(self):
        return SupplyScorer()
    
    @pytest.mark.asyncio
    async def test_score_severe_shortage(self, scorer):
        """Test scoring for severe shortage market"""
        metrics = InventoryMetrics(
            total_inventory=500,
            months_of_supply=0.8,
            absorption_rate=0.75,
            median_dom=8,
            new_listings_30d=800,
            pending_sales=600,
            closed_sales_30d=700
        )
        
        trends = InventoryTrends(
            inventory_change_30d=-25.0,
            inventory_change_90d=-40.0,
            absorption_change=0.05
        )
        
        score = await scorer.calculate_score(metrics, trends)
        
        assert score.overall_score >= 85
        assert score.interpretation in [
            MarketInterpretation.SEVERE_SHORTAGE,
            MarketInterpretation.SHORTAGE
        ]
        assert score.confidence > 0.7
    
    @pytest.mark.asyncio
    async def test_score_balanced_market(self, scorer):
        """Test scoring for balanced market"""
        metrics = InventoryMetrics(
            total_inventory=2000,
            months_of_supply=5.0,
            absorption_rate=0.45,
            median_dom=35,
            new_listings_30d=2200,
            pending_sales=1000,
            closed_sales_30d=1100
        )
        
        trends = InventoryTrends(
            inventory_change_30d=2.0,
            inventory_change_90d=-5.0,
            absorption_change=0.01
        )
        
        score = await scorer.calculate_score(metrics, trends)
        
        assert 35 <= score.overall_score <= 65
        assert score.interpretation == MarketInterpretation.BALANCED
    
    @pytest.mark.asyncio
    async def test_score_oversupply(self, scorer):
        """Test scoring for oversupply market"""
        metrics = InventoryMetrics(
            total_inventory=5000,
            months_of_supply=15.0,
            absorption_rate=0.15,
            median_dom=120,
            new_listings_30d=3000,
            pending_sales=200,
            closed_sales_30d=300
        )
        
        trends = InventoryTrends(
            inventory_change_30d=35.0,
            inventory_change_90d=80.0,
            absorption_change=-0.08
        )
        
        score = await scorer.calculate_score(metrics, trends)
        
        assert score.overall_score <= 20
        assert score.interpretation in [
            MarketInterpretation.OVERSUPPLY,
            MarketInterpretation.SEVERE_OVERSUPPLY
        ]


class TestTrendAnalyzer:
    """Test trend analysis"""
    
    @pytest.fixture
    def analyzer(self):
        return TrendAnalyzer()
    
    def test_deduplicate_listings(self, analyzer):
        """Test listing deduplication"""
        listings = [
            {'address': '123 Main St', 'city': 'Austin', 'zip': '78701', 'id': '1'},
            {'address': '123 main st', 'city': 'Austin', 'zip': '78701', 'id': '2'},
            {'address': '456 Oak Ave', 'city': 'Austin', 'zip': '78702', 'id': '3'},
        ]
        
        unique = analyzer._deduplicate_listings(listings)
        
        assert len(unique) == 2
        assert unique[0]['address'] == '123 Main St'
        assert unique[1]['address'] == '456 Oak Ave'
    
    def test_calculate_metrics(self, analyzer):
        """Test metrics calculation"""
        aggregated = {
            'active': [
                {'days_on_market': 10},
                {'days_on_market': 20},
                {'days_on_market': 30}
            ],
            'pending': [
                {'id': '1'},
                {'id': '2'}
            ],
            'sold': [
                {'id': '1'},
                {'id': '2'},
                {'id': '3'}
            ]
        }
        
        metrics = analyzer._calculate_metrics(aggregated)
        
        assert metrics.total_inventory == 3
        assert metrics.pending_sales == 2
        assert metrics.closed_sales_30d == 3
        assert metrics.median_dom == 20
        assert 0 < metrics.absorption_rate < 1


class TestModels:
    """Test data models"""
    
    def test_supply_score_bounds(self):
        """Ensure supply score stays within 0-100"""
        score = SupplyScore(
            overall_score=150,  # Should be capped
            inventory_component=50,
            absorption_component=50,
            dom_component=50,
            trend_component=50,
            interpretation=MarketInterpretation.BALANCED,
            confidence=0.85
        )
        
        # Pydantic validation should ensure 0-100
        assert 0 <= score.overall_score <= 100
    
    def test_inventory_metrics_validation(self):
        """Test InventoryMetrics validation"""
        metrics = InventoryMetrics(
            total_inventory=1000,
            months_of_supply=3.5,
            absorption_rate=0.55,
            median_dom=25,
            new_listings_30d=800,
            pending_sales=500
        )
        
        assert metrics.total_inventory == 1000
        assert metrics.months_of_supply == 3.5
        assert 0 <= metrics.absorption_rate <= 1


@pytest.mark.asyncio
async def test_end_to_end_analysis():
    """
    Integration test - end-to-end analysis
    (Requires mock data or test environment)
    """
    # This would test the full pipeline
    # For now, just a placeholder
    pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
