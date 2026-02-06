"""
Service Tests - Data Aggregator

Tests property-to-submarket data aggregation

@version 1.0.0
@date 2026-02-05
"""

import pytest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from services.data_aggregator import dataAggregator, PropertyData

# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def sample_properties():
    """Generate sample property data"""
    return [
        PropertyData(
            id='prop-1',
            submarket='Midtown',
            total_units=100,
            available_units=10,
            vacancy_rate=0.10,
            rent_avg=1800,
            building_class='A',
            data_source='test'
        ),
        PropertyData(
            id='prop-2',
            submarket='Midtown',
            total_units=150,
            available_units=15,
            vacancy_rate=0.10,
            rent_avg=1900,
            building_class='A',
            data_source='test'
        ),
        PropertyData(
            id='prop-3',
            submarket='Midtown',
            total_units=80,
            available_units=16,
            vacancy_rate=0.20,
            rent_avg=1500,
            building_class='B',
            data_source='test'
        ),
    ]

# ============================================================================
# Aggregation Tests
# ============================================================================

class TestDataAggregation:
    """Test property data aggregation"""
    
    def test_aggregate_total_units(self, sample_properties):
        """Test total units calculation"""
        result = dataAggregator.aggregateToSubmarket(
            sample_properties,
            'Midtown',
            'Atlanta',
            'GA'
        )
        
        expected_units = 100 + 150 + 80  # 330
        assert result.existing_units == expected_units
    
    def test_aggregate_weighted_rent(self, sample_properties):
        """Test weighted average rent calculation"""
        result = dataAggregator.aggregateToSubmarket(
            sample_properties,
            'Midtown',
            'Atlanta',
            'GA'
        )
        
        # Weighted by units:
        # (100*1800 + 150*1900 + 80*1500) / 330 = 1790.9
        assert 1785 < result.avg_rent.average < 1795
    
    def test_aggregate_vacancy_rate(self, sample_properties):
        """Test vacancy rate calculation"""
        result = dataAggregator.aggregateToSubmarket(
            sample_properties,
            'Midtown',
            'Atlanta',
            'GA'
        )
        
        total_available = 10 + 15 + 16  # 41
        total_units = 330
        expected_vacancy = 41 / 330  # 0.124
        
        assert abs(result.vacancy_rate - expected_vacancy) < 0.001
    
    def test_building_class_mix(self, sample_properties):
        """Test building class distribution"""
        result = dataAggregator.aggregateToSubmarket(
            sample_properties,
            'Midtown',
            'Atlanta',
            'GA'
        )
        
        # 250 units in class A, 80 in class B
        # A = 250/330 = 0.757
        # B = 80/330 = 0.242
        
        assert 0.75 < result.building_class_mix.A < 0.77
        assert 0.24 < result.building_class_mix.B < 0.26
        assert result.building_class_mix.C == 0

# ============================================================================
# Confidence Scoring Tests
# ============================================================================

class TestConfidenceScoring:
    """Test data quality confidence scoring"""
    
    def test_more_properties_higher_confidence(self):
        """More properties should increase confidence"""
        few_props = [
            PropertyData(id=f'p{i}', submarket='Test', total_units=100, rent_avg=1500, building_class='A', data_source='test')
            for i in range(5)
        ]
        
        many_props = [
            PropertyData(id=f'p{i}', submarket='Test', total_units=100, rent_avg=1500, building_class='A', data_source='test')
            for i in range(25)
        ]
        
        few_result = dataAggregator.aggregateToSubmarket(few_props, 'Test', 'City', 'ST')
        many_result = dataAggregator.aggregateToSubmarket(many_props, 'Test', 'City', 'ST')
        
        assert many_result.confidence > few_result.confidence

# ============================================================================
# Edge Cases
# ============================================================================

class TestEdgeCases:
    """Test edge cases"""
    
    def test_single_property(self):
        """Test with single property"""
        props = [
            PropertyData(
                id='only-one',
                submarket='Test',
                total_units=100,
                rent_avg=1500,
                building_class='A',
                data_source='test'
            )
        ]
        
        result = dataAggregator.aggregateToSubmarket(props, 'Test', 'City', 'ST')
        
        assert result.existing_units == 100
        assert result.avg_rent.average == 1500
    
    def test_empty_property_list(self):
        """Test with no properties (should error)"""
        with pytest.raises(Exception):
            dataAggregator.aggregateToSubmarket([], 'Test', 'City', 'ST')

# ============================================================================
# Run Tests
# ============================================================================

if __name__ == '__main__':
    pytest.main([__file__, '-v'])
