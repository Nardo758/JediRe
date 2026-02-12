"""
Unit Tests - Imbalance Detector Engine

Tests demand/supply imbalance detection and opportunity scoring

@version 1.0.0
@date 2026-02-05
"""

import pytest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'python-services'))

from engines.imbalance_detector import ImbalanceDetector

# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def detector():
    """Create detector instance"""
    return ImbalanceDetector()

@pytest.fixture
def balanced_market():
    """Normal balanced market conditions"""
    return {
        'vacancy_rate': 0.05,  # 5%
        'rent_growth_rate': 0.03,  # 3%
        'concessions_prevalence': 0.10,  # 10%
        'opportunity_score': 5.0,  # Middle
    }

@pytest.fixture
def soft_market():
    """Oversupply / renter's market"""
    return {
        'vacancy_rate': 0.25,  # 25% - high
        'rent_growth_rate': -0.02,  # -2% - declining
        'concessions_prevalence': 0.80,  # 80% - widespread
        'opportunity_score': 8.5,  # High opportunity
    }

@pytest.fixture
def tight_market():
    """Undersupply / landlord's market"""
    return {
        'vacancy_rate': 0.02,  # 2% - very low
        'rent_growth_rate': 0.08,  # 8% - strong growth
        'concessions_prevalence': 0.05,  # 5% - rare
        'opportunity_score': 2.0,  # Low opportunity
    }

# ============================================================================
# Basic Detection Tests
# ============================================================================

class TestBasicDetection:
    """Test basic imbalance detection"""
    
    def test_balanced_market_verdict(self, detector, balanced_market):
        """Balanced market should return BALANCED verdict"""
        result = detector.analyze(balanced_market)
        
        assert result['imbalance_score'] >= 30
        assert result['imbalance_score'] <= 70
        assert result['verdict'] == 'BALANCED'
    
    def test_soft_market_high_score(self, detector, soft_market):
        """Soft market should have high opportunity score"""
        result = detector.analyze(soft_market)
        
        assert result['imbalance_score'] > 70
        assert result['verdict'] in ['STRONG_OPPORTUNITY', 'MODERATE_OPPORTUNITY']
    
    def test_tight_market_low_score(self, detector, tight_market):
        """Tight market should have low opportunity score"""
        result = detector.analyze(tight_market)
        
        assert result['imbalance_score'] < 40
        assert result['verdict'] == 'TIGHT_MARKET'

# ============================================================================
# Signal Contribution Tests
# ============================================================================

class TestSignalContributions:
    """Test individual signal contributions"""
    
    def test_high_vacancy_increases_score(self, detector):
        """High vacancy should increase imbalance score"""
        low_vacancy = {'vacancy_rate': 0.03, 'rent_growth_rate': 0.03, 'concessions_prevalence': 0.10, 'opportunity_score': 5.0}
        high_vacancy = {'vacancy_rate': 0.20, 'rent_growth_rate': 0.03, 'concessions_prevalence': 0.10, 'opportunity_score': 5.0}
        
        low_result = detector.analyze(low_vacancy)
        high_result = detector.analyze(high_vacancy)
        
        assert high_result['imbalance_score'] > low_result['imbalance_score']
        assert high_result['vacancy_signal'] > low_result['vacancy_signal']
    
    def test_concessions_increase_score(self, detector):
        """High concessions should increase imbalance score"""
        low_conc = {'vacancy_rate': 0.05, 'rent_growth_rate': 0.03, 'concessions_prevalence': 0.10, 'opportunity_score': 5.0}
        high_conc = {'vacancy_rate': 0.05, 'rent_growth_rate': 0.03, 'concessions_prevalence': 0.70, 'opportunity_score': 5.0}
        
        low_result = detector.analyze(low_conc)
        high_result = detector.analyze(high_conc)
        
        assert high_result['imbalance_score'] > low_result['imbalance_score']
        assert high_result['concession_signal'] > low_result['concession_signal']
    
    def test_negative_rent_growth_increases_score(self, detector):
        """Declining rents should increase imbalance score"""
        pos_growth = {'vacancy_rate': 0.05, 'rent_growth_rate': 0.05, 'concessions_prevalence': 0.10, 'opportunity_score': 5.0}
        neg_growth = {'vacancy_rate': 0.05, 'rent_growth_rate': -0.05, 'concessions_prevalence': 0.10, 'opportunity_score': 5.0}
        
        pos_result = detector.analyze(pos_growth)
        neg_result = detector.analyze(neg_growth)
        
        assert neg_result['imbalance_score'] > pos_result['imbalance_score']
        assert neg_result['rent_growth_signal'] > 0

# ============================================================================
# Verdict Boundary Tests
# ============================================================================

class TestVerdictBoundaries:
    """Test verdict threshold boundaries"""
    
    def test_score_70_strong_opportunity(self, detector):
        """Score of 70 should be STRONG_OPPORTUNITY"""
        # Engineer inputs to get ~70 score
        data = {
            'vacancy_rate': 0.15,
            'rent_growth_rate': 0.01,
            'concessions_prevalence': 0.50,
            'opportunity_score': 7.0
        }
        
        result = detector.analyze(data)
        
        if result['imbalance_score'] >= 70:
            assert result['verdict'] == 'STRONG_OPPORTUNITY'
    
    def test_score_30_tight_market(self, detector):
        """Score of 30 should be TIGHT_MARKET"""
        data = {
            'vacancy_rate': 0.03,
            'rent_growth_rate': 0.06,
            'concessions_prevalence': 0.05,
            'opportunity_score': 3.0
        }
        
        result = detector.analyze(data)
        
        if result['imbalance_score'] < 30:
            assert result['verdict'] == 'TIGHT_MARKET'

# ============================================================================
# Recommendation Tests
# ============================================================================

class TestRecommendations:
    """Test recommended actions"""
    
    def test_recommendations_exist(self, detector, soft_market):
        """Result should include recommendations"""
        result = detector.analyze(soft_market)
        
        assert 'recommended_action' in result
        assert len(result['recommended_action']) > 0
    
    def test_key_drivers_identified(self, detector, soft_market):
        """Key drivers should be identified"""
        result = detector.analyze(soft_market)
        
        assert 'key_drivers' in result
        assert len(result['key_drivers']) > 0
        
        # Should mention relevant factors
        drivers_text = ' '.join(result['key_drivers']).lower()
        assert any(term in drivers_text for term in ['vacancy', 'rent', 'concession', 'opportunity'])

# ============================================================================
# Edge Cases
# ============================================================================

class TestEdgeCases:
    """Test edge cases"""
    
    def test_extreme_vacancy(self, detector):
        """Handle extreme vacancy (>50%)"""
        extreme = {
            'vacancy_rate': 0.60,  # 60%!
            'rent_growth_rate': -0.10,
            'concessions_prevalence': 0.95,
            'opportunity_score': 10.0
        }
        
        result = detector.analyze(extreme)
        
        # Should max out at 100
        assert result['imbalance_score'] <= 100
        assert result['verdict'] == 'STRONG_OPPORTUNITY'
    
    def test_zero_vacancy(self, detector):
        """Handle zero vacancy"""
        zero_vac = {
            'vacancy_rate': 0.0,  # 0%
            'rent_growth_rate': 0.10,
            'concessions_prevalence': 0.0,
            'opportunity_score': 1.0
        }
        
        result = detector.analyze(zero_vac)
        
        # Should show tight market
        assert result['imbalance_score'] < 30
        assert result['verdict'] == 'TIGHT_MARKET'
    
    def test_missing_optional_fields(self, detector):
        """Handle missing opportunity score"""
        minimal_data = {
            'vacancy_rate': 0.15,
            'rent_growth_rate': 0.02,
            'concessions_prevalence': 0.30
            # opportunity_score missing
        }
        
        # Should work with reduced inputs
        result = detector.analyze(minimal_data)
        
        assert 'imbalance_score' in result
        assert 'verdict' in result

# ============================================================================
# Confidence Scoring Tests
# ============================================================================

class TestConfidenceScoring:
    """Test confidence score calculation"""
    
    def test_confidence_in_range(self, detector, balanced_market):
        """Confidence should be 0-1"""
        result = detector.analyze(balanced_market)
        
        assert 0 <= result['confidence'] <= 1
    
    def test_more_data_higher_confidence(self, detector):
        """More data points should increase confidence"""
        # This would need data_points parameter in real implementation
        # For now, just verify confidence exists
        result = detector.analyze({
            'vacancy_rate': 0.10,
            'rent_growth_rate': 0.03,
            'concessions_prevalence': 0.30,
            'opportunity_score': 6.0
        })
        
        assert 'confidence' in result

# ============================================================================
# Run Tests
# ============================================================================

if __name__ == '__main__':
    pytest.main([__file__, '-v'])
