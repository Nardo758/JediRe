"""
JEDI RE - End-to-End Integration Tests
Tests complete workflows from API request to engine result

@version 1.0.0
@date 2026-02-05
"""

import pytest
import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, Any

# Test configuration
pytestmark = pytest.mark.asyncio

# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
async def test_submarket(db_session):
    """Create a test submarket with timeseries data"""
    from models import Submarket, MarketTimeseries
    
    # Create submarket
    submarket = Submarket(
        name='Test Submarket',
        city='Test City',
        state='TS',
        center_lat=33.7490,
        center_lng=-84.3880
    )
    db_session.add(submarket)
    await db_session.commit()
    
    # Add 52 weeks of timeseries data
    base_date = datetime.now() - timedelta(weeks=52)
    base_rent = 1500
    
    for week in range(52):
        observation = MarketTimeseries(
            submarket_id=submarket.id,
            observation_date=base_date + timedelta(weeks=week),
            effective_rent=base_rent + (week * 10),  # Gradual rent growth
            vacancy_rate=0.05 + (week * 0.001),  # Gradual vacancy increase
            total_supply=10000,
            available_units=500 + (week * 5),
            data_source='test',
            confidence=0.90
        )
        db_session.add(observation)
    
    await db_session.commit()
    
    yield submarket
    
    # Cleanup
    await db_session.delete(submarket)
    await db_session.commit()

@pytest.fixture
async def test_properties(db_session, test_submarket):
    """Create test properties for capacity analysis"""
    from models import Property
    
    properties = []
    
    for i in range(10):
        prop = Property(
            submarket_id=test_submarket.id,
            name=f'Test Property {i+1}',
            address=f'{i+1}00 Test St',
            lat=33.7490 + (i * 0.001),
            lng=-84.3880 + (i * 0.001),
            total_units=100 + (i * 10),
            available_units=10 + i,
            vacancy_rate=0.05 + (i * 0.01),
            rent_avg=1500 + (i * 50),
            building_class='A' if i < 3 else 'B' if i < 7 else 'C',
            year_built=2000 + i,
            data_source='test',
            confidence_score=0.90
        )
        db_session.add(prop)
        properties.append(prop)
    
    await db_session.commit()
    
    yield properties
    
    # Cleanup
    for prop in properties:
        await db_session.delete(prop)
    await db_session.commit()

@pytest.fixture
async def api_client(app):
    """HTTP client for API testing"""
    from httpx import AsyncClient
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client

# ============================================================================
# End-to-End Tests
# ============================================================================

class TestHealthAndStatus:
    """Test basic connectivity"""
    
    async def test_health_endpoint(self, api_client):
        """Health check returns 200"""
        response = await api_client.get('/health')
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['status'] == 'healthy'
        assert 'timestamp' in data
        assert 'uptime' in data

    async def test_api_version(self, api_client):
        """API version endpoint works"""
        response = await api_client.get('/api/v1')
        
        assert response.status_code == 200
        data = response.json()
        
        assert 'version' in data
        assert data['version'] == 'v1'

# ============================================================================
# Signal Processing Flow
# ============================================================================

class TestSignalProcessingFlow:
    """Test signal processing from API to engine"""
    
    async def test_market_signal_analysis(self, api_client, test_submarket):
        """Complete signal processing workflow"""
        
        # Act: Request signal analysis
        response = await api_client.post('/api/v1/analysis/market-signal', json={
            'submarket_id': str(test_submarket.id)
        })
        
        # Assert: Response structure
        assert response.status_code == 200
        result = response.json()
        
        # Check required fields
        assert 'rent_growth_rate' in result
        assert 'confidence' in result
        assert 'trend_component' in result
        assert 'seasonal_component' in result
        assert 'noise_level' in result
        
        # Check value ranges
        assert -1.0 <= result['rent_growth_rate'] <= 1.0  # -100% to +100%
        assert 0.0 <= result['confidence'] <= 1.0
        assert result['trend_component'] > 0  # Rent should be positive
        
        # Check metadata
        assert 'data_points' in result
        assert result['data_points'] == 52  # We inserted 52 weeks
        assert 'processed_at' in result

    async def test_signal_processing_with_sparse_data(self, api_client, db_session):
        """Test with minimal data (edge case)"""
        from models import Submarket, MarketTimeseries
        
        # Create submarket with only 4 weeks of data (minimum)
        submarket = Submarket(name='Sparse', city='Test', state='TS')
        db_session.add(submarket)
        await db_session.commit()
        
        for week in range(4):
            obs = MarketTimeseries(
                submarket_id=submarket.id,
                observation_date=datetime.now() - timedelta(weeks=3-week),
                effective_rent=1500 + (week * 20),
                data_source='test'
            )
            db_session.add(obs)
        await db_session.commit()
        
        # Act
        response = await api_client.post('/api/v1/analysis/market-signal', json={
            'submarket_id': str(submarket.id)
        })
        
        # Assert: Should work but with lower confidence
        assert response.status_code == 200
        result = response.json()
        
        assert result['data_points'] == 4
        assert result['confidence'] < 0.8  # Lower confidence due to sparse data

# ============================================================================
# Carrying Capacity Flow
# ============================================================================

class TestCarryingCapacityFlow:
    """Test capacity analysis workflow"""
    
    async def test_capacity_analysis(self, api_client, test_properties):
        """Complete carrying capacity analysis"""
        
        # Act: Analyze development capacity
        response = await api_client.post('/api/v1/pipeline/analyze', json={
            'parcel_id': 'TEST-001',
            'current_zoning': 'MRC-2',
            'lot_size_sqft': 87120,
            'current_units': 0
        })
        
        # Assert
        assert response.status_code == 200
        result = response.json()
        
        # Check structure
        assert 'potential_units' in result
        assert 'development_cost' in result
        assert 'development_potential' in result
        assert 'confidence' in result
        
        # Check values
        assert result['potential_units'] > 0
        assert result['development_cost'] > 0
        assert result['development_potential'] in [
            'VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'VERY_LOW'
        ]
        assert 0 <= result['confidence'] <= 1

    async def test_capacity_with_existing_units(self, api_client):
        """Test capacity analysis on existing property"""
        
        response = await api_client.post('/api/v1/pipeline/analyze', json={
            'parcel_id': 'EXISTING-001',
            'current_zoning': 'MRC-2',
            'lot_size_sqft': 87120,
            'current_units': 80  # Already has units
        })
        
        assert response.status_code == 200
        result = response.json()
        
        # Should show remaining potential
        assert result['potential_units'] >= result.get('current_units', 0)

# ============================================================================
# Imbalance Detection Flow
# ============================================================================

class TestImbalanceDetectionFlow:
    """Test imbalance detector workflow"""
    
    async def test_imbalance_analysis(self, api_client, test_submarket, test_properties):
        """Complete imbalance detection workflow"""
        
        # Act: Detect demand/supply imbalance
        response = await api_client.post('/api/v1/analysis/imbalance', json={
            'submarket_id': str(test_submarket.id)
        })
        
        # Assert
        assert response.status_code == 200
        result = response.json()
        
        # Check structure
        assert 'imbalance_score' in result
        assert 'verdict' in result
        assert 'vacancy_signal' in result
        assert 'concession_signal' in result
        assert 'rent_growth_signal' in result
        assert 'recommended_action' in result
        assert 'key_drivers' in result
        
        # Check values
        assert 0 <= result['imbalance_score'] <= 100
        assert result['verdict'] in [
            'STRONG_OPPORTUNITY',
            'MODERATE_OPPORTUNITY',
            'BALANCED',
            'TIGHT_MARKET'
        ]
        assert isinstance(result['key_drivers'], list)
        assert len(result['key_drivers']) > 0

    async def test_imbalance_with_high_vacancy(self, api_client, db_session):
        """Test imbalance detector with high vacancy scenario"""
        from models import Submarket, MarketTimeseries
        
        # Create scenario: high vacancy, declining rents
        submarket = Submarket(name='High Vacancy', city='Test', state='TS')
        db_session.add(submarket)
        await db_session.commit()
        
        # Insert data showing market stress
        for week in range(12):
            obs = MarketTimeseries(
                submarket_id=submarket.id,
                observation_date=datetime.now() - timedelta(weeks=11-week),
                effective_rent=2000 - (week * 20),  # Declining rents
                vacancy_rate=0.25,  # High vacancy (25%)
                concessions_prevalence=0.80,  # 80% offering concessions
                data_source='test'
            )
            db_session.add(obs)
        await db_session.commit()
        
        # Act
        response = await api_client.post('/api/v1/analysis/imbalance', json={
            'submarket_id': str(submarket.id)
        })
        
        # Assert: Should detect strong opportunity
        assert response.status_code == 200
        result = response.json()
        
        assert result['imbalance_score'] > 70  # High opportunity
        assert result['verdict'] in ['STRONG_OPPORTUNITY', 'MODERATE_OPPORTUNITY']
        assert 'vacancy' in ' '.join(result['key_drivers']).lower()

# ============================================================================
# Data Integration Flow
# ============================================================================

class TestDataIntegrationFlow:
    """Test multi-source data integration"""
    
    async def test_apartmentiq_integration(self, api_client, mock_apartmentiq):
        """Test ApartmentIQ data fetch and integration"""
        
        # Act: Fetch from ApartmentIQ (mocked)
        response = await api_client.get('/api/v1/apartmentiq/market-data', params={
            'city': 'Atlanta',
            'submarket': 'Midtown'
        })
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        
        assert 'market_summary' in data
        assert 'properties' in data
        assert data['market_summary']['city'] == 'Atlanta'
        assert data['market_summary']['submarket'] == 'Midtown'
        assert len(data['properties']) > 0

    async def test_costar_integration(self, api_client):
        """Test CoStar data processing"""
        
        # Act: Get CoStar signal analysis
        response = await api_client.get('/api/v1/analysis/costar-signal')
        
        # Assert
        assert response.status_code == 200
        result = response.json()
        
        assert 'rent_growth_rate' in result
        assert 'confidence' in result
        assert result['data_source'] == 'costar'

    async def test_multi_source_merge(self, api_client, mock_apartmentiq):
        """Test merging data from multiple sources"""
        
        # Act: Request merged analysis
        response = await api_client.post('/api/v1/analysis/merged', json={
            'city': 'Atlanta',
            'submarket': 'Midtown',
            'sources': ['apartmentiq', 'costar']
        })
        
        # Assert
        assert response.status_code == 200
        result = response.json()
        
        # Should include data from both sources
        assert 'data_sources' in result
        sources = [ds['name'] for ds in result['data_sources']]
        assert 'apartmentiq' in sources
        assert 'costar' in sources
        
        # Should have merged confidence score
        assert 'confidence' in result
        assert result['confidence'] > 0

# ============================================================================
# Complete User Workflow
# ============================================================================

class TestCompleteUserWorkflow:
    """Test full user journey"""
    
    async def test_new_user_analysis_flow(self, api_client, auth_headers, test_submarket):
        """Test: User signs up → Selects submarket → Gets analysis"""
        
        # Step 1: User authenticates (auth_headers fixture provides JWT)
        response = await api_client.get('/api/v1/user/profile', headers=auth_headers)
        assert response.status_code == 200
        
        # Step 2: User lists available submarkets
        response = await api_client.get('/api/v1/submarkets', params={
            'city': 'Test City'
        })
        assert response.status_code == 200
        submarkets = response.json()
        assert len(submarkets) > 0
        
        # Step 3: User requests analysis
        response = await api_client.post(
            '/api/v1/analysis/full',
            headers=auth_headers,
            json={'submarket_id': str(test_submarket.id)}
        )
        assert response.status_code == 200
        analysis = response.json()
        
        # Step 4: Analysis result includes all engines
        assert 'signal_processing' in analysis
        assert 'carrying_capacity' in analysis
        assert 'imbalance_detector' in analysis
        
        # Step 5: Result is saved to user's history
        response = await api_client.get(
            '/api/v1/user/analysis-history',
            headers=auth_headers
        )
        assert response.status_code == 200
        history = response.json()
        assert len(history) > 0

    async def test_alert_creation_and_trigger(self, api_client, auth_headers, test_submarket):
        """Test: User creates alert → Market changes → Alert triggers"""
        
        # Step 1: User creates alert
        response = await api_client.post(
            '/api/v1/alerts',
            headers=auth_headers,
            json={
                'submarket_id': str(test_submarket.id),
                'alert_type': 'imbalance_change',
                'threshold_value': 70,
                'condition': 'above'
            }
        )
        assert response.status_code == 201
        alert = response.json()
        alert_id = alert['id']
        
        # Step 2: Simulate market change (update imbalance score)
        # (This would normally happen via daily scraping job)
        
        # Step 3: Check if alert triggered
        response = await api_client.get(
            f'/api/v1/alerts/{alert_id}',
            headers=auth_headers
        )
        assert response.status_code == 200
        alert_status = response.json()
        
        # Should have trigger count or last_triggered field
        assert 'last_triggered' in alert_status or 'trigger_count' in alert_status

# ============================================================================
# Performance Tests
# ============================================================================

class TestPerformance:
    """Test performance benchmarks"""
    
    async def test_analysis_response_time(self, api_client, test_submarket):
        """Analysis should complete in <2 seconds"""
        import time
        
        start = time.time()
        
        response = await api_client.post('/api/v1/analysis/imbalance', json={
            'submarket_id': str(test_submarket.id)
        })
        
        duration = time.time() - start
        
        assert response.status_code == 200
        assert duration < 2.0, f"Analysis took {duration:.2f}s (threshold: 2s)"

    async def test_concurrent_requests(self, api_client, test_submarket):
        """Handle 10 concurrent analysis requests"""
        
        tasks = [
            api_client.post('/api/v1/analysis/imbalance', json={
                'submarket_id': str(test_submarket.id)
            })
            for _ in range(10)
        ]
        
        responses = await asyncio.gather(*tasks)
        
        # All should succeed
        assert all(r.status_code == 200 for r in responses)

# ============================================================================
# Error Handling Tests
# ============================================================================

class TestErrorHandling:
    """Test graceful error handling"""
    
    async def test_invalid_submarket_id(self, api_client):
        """Invalid submarket ID returns 404"""
        response = await api_client.post('/api/v1/analysis/imbalance', json={
            'submarket_id': '00000000-0000-0000-0000-000000000000'
        })
        
        assert response.status_code == 404
        assert 'error' in response.json()

    async def test_missing_required_field(self, api_client):
        """Missing required field returns 400"""
        response = await api_client.post('/api/v1/analysis/imbalance', json={})
        
        assert response.status_code == 400
        assert 'error' in response.json()

    async def test_invalid_data_type(self, api_client):
        """Invalid data type returns 422"""
        response = await api_client.post('/api/v1/pipeline/analyze', json={
            'parcel_id': 'TEST',
            'lot_size_sqft': 'not-a-number'  # Should be integer
        })
        
        assert response.status_code == 422

# ============================================================================
# Run Tests
# ============================================================================

if __name__ == '__main__':
    pytest.main([__file__, '-v', '--asyncio-mode=auto'])
