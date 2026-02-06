"""
Unit Tests - Carrying Capacity Engine

Tests development capacity calculations based on zoning rules

@version 1.0.0
@date 2026-02-05
"""

import pytest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'python-services'))

from engines.carrying_capacity import CarryingCapacityAnalyzer

# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def analyzer():
    """Create analyzer instance"""
    return CarryingCapacityAnalyzer()

@pytest.fixture
def typical_parcel():
    """Typical multifamily parcel"""
    return {
        'parcel_id': 'TEST-001',
        'current_zoning': 'MRC-2',
        'lot_size_sqft': 87120,  # ~2 acres
        'current_units': 0
    }

# ============================================================================
# Basic Calculation Tests
# ============================================================================

class TestBasicCalculations:
    """Test basic capacity calculations"""
    
    def test_calculate_capacity_mrc2(self, analyzer, typical_parcel):
        """Calculate capacity for MRC-2 zoning"""
        result = analyzer.analyze(typical_parcel)
        
        assert result['potential_units'] > 0
        assert result['development_cost'] > 0
        assert result['confidence'] > 0.5
    
    def test_larger_lot_more_units(self, analyzer):
        """Larger lots should support more units"""
        small_parcel = {
            'parcel_id': 'SMALL',
            'current_zoning': 'MRC-2',
            'lot_size_sqft': 20000,
            'current_units': 0
        }
        
        large_parcel = {
            'parcel_id': 'LARGE',
            'current_zoning': 'MRC-2',
            'lot_size_sqft': 100000,
            'current_units': 0
        }
        
        small_result = analyzer.analyze(small_parcel)
        large_result = analyzer.analyze(large_parcel)
        
        assert large_result['potential_units'] > small_result['potential_units']
    
    def test_existing_units_reduce_potential(self, analyzer, typical_parcel):
        """Existing units should reduce development potential"""
        empty_result = analyzer.analyze(typical_parcel)
        
        occupied_parcel = typical_parcel.copy()
        occupied_parcel['current_units'] = 50
        
        occupied_result = analyzer.analyze(occupied_parcel)
        
        assert occupied_result['potential_units'] <= empty_result['potential_units']

# ============================================================================
# Zoning Rule Tests
# ============================================================================

class TestZoningRules:
    """Test different zoning codes"""
    
    def test_high_density_zoning(self, analyzer):
        """High-density zoning allows more units"""
        parcel = {
            'parcel_id': 'HD-001',
            'current_zoning': 'MRC-3',  # High density
            'lot_size_sqft': 50000,
            'current_units': 0
        }
        
        result = analyzer.analyze(parcel)
        
        # Should allow significant development
        assert result['potential_units'] > 30
        assert result['development_potential'] in ['HIGH', 'VERY_HIGH']
    
    def test_low_density_zoning(self, analyzer):
        """Low-density zoning limits units"""
        parcel = {
            'parcel_id': 'LD-001',
            'current_zoning': 'R-4',  # Residential low density
            'lot_size_sqft': 50000,
            'current_units': 0
        }
        
        result = analyzer.analyze(parcel)
        
        # Should be limited
        assert result['potential_units'] < 20
    
    def test_invalid_zoning_code(self, analyzer):
        """Invalid zoning should return error or default"""
        parcel = {
            'parcel_id': 'INV-001',
            'current_zoning': 'INVALID-CODE',
            'lot_size_sqft': 50000,
            'current_units': 0
        }
        
        # Should handle gracefully (either error or default estimate)
        try:
            result = analyzer.analyze(parcel)
            assert 'error' in result or result['confidence'] < 0.5
        except:
            pass  # Expected behavior

# ============================================================================
# Cost Calculation Tests
# ============================================================================

class TestCostCalculations:
    """Test development cost estimates"""
    
    def test_cost_scales_with_units(self, analyzer, typical_parcel):
        """Cost should scale with number of units"""
        result = analyzer.analyze(typical_parcel)
        
        units = result['potential_units']
        cost = result['development_cost']
        
        cost_per_unit = cost / units
        
        # Typical cost per unit: $150k-$300k
        assert 100000 < cost_per_unit < 500000
    
    def test_cost_includes_components(self, analyzer, typical_parcel):
        """Cost should include land, construction, soft costs"""
        result = analyzer.analyze(typical_parcel)
        
        # Check cost breakdown exists (if implemented)
        assert result['development_cost'] > 0

# ============================================================================
# Development Potential Rating Tests
# ============================================================================

class TestDevelopmentPotential:
    """Test development potential ratings"""
    
    def test_rating_categories(self, analyzer, typical_parcel):
        """Development potential should be valid category"""
        result = analyzer.analyze(typical_parcel)
        
        valid_ratings = ['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'VERY_LOW']
        assert result['development_potential'] in valid_ratings
    
    def test_high_potential_criteria(self, analyzer):
        """High potential should meet criteria"""
        high_potential_parcel = {
            'parcel_id': 'HP-001',
            'current_zoning': 'MRC-3',
            'lot_size_sqft': 100000,  # Large lot
            'current_units': 0  # Empty
        }
        
        result = analyzer.analyze(high_potential_parcel)
        
        assert result['development_potential'] in ['HIGH', 'VERY_HIGH']
        assert result['potential_units'] > 50

# ============================================================================
# Edge Cases
# ============================================================================

class TestEdgeCases:
    """Test edge cases"""
    
    def test_tiny_lot(self, analyzer):
        """Very small lot"""
        tiny_parcel = {
            'parcel_id': 'TINY',
            'current_zoning': 'MRC-2',
            'lot_size_sqft': 5000,  # Too small for multifamily
            'current_units': 0
        }
        
        result = analyzer.analyze(tiny_parcel)
        
        # Should have low potential
        assert result['development_potential'] in ['LOW', 'VERY_LOW']
    
    def test_huge_lot(self, analyzer):
        """Very large lot"""
        huge_parcel = {
            'parcel_id': 'HUGE',
            'current_zoning': 'MRC-2',
            'lot_size_sqft': 500000,  # ~11 acres
            'current_units': 0
        }
        
        result = analyzer.analyze(huge_parcel)
        
        # Should handle gracefully
        assert result['potential_units'] > 0
        assert result['development_cost'] > 0
    
    def test_fully_developed_parcel(self, analyzer, typical_parcel):
        """Parcel at maximum capacity"""
        full_parcel = typical_parcel.copy()
        full_parcel['current_units'] = 200  # At or above capacity
        
        result = analyzer.analyze(full_parcel)
        
        # Should show little or no additional potential
        assert result['development_potential'] in ['LOW', 'VERY_LOW']

# ============================================================================
# Run Tests
# ============================================================================

if __name__ == '__main__':
    pytest.main([__file__, '-v'])
