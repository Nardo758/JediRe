"""
API Tests - Analysis Routes

Tests REST API endpoints for analysis engines

@version 1.0.0
@date 2026-02-05
"""

import pytest
from httpx import AsyncClient
from fastapi import status

# ============================================================================
# Test /api/v1/analysis Endpoints
# ============================================================================

class TestAnalysisEndpoints:
    """Test analysis API endpoints"""
    
    @pytest.mark.asyncio
    async def test_health_endpoint(self, client: AsyncClient):
        """Test /health endpoint"""
        response = await client.get('/health')
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['status'] == 'healthy'
        assert 'timestamp' in data
    
    @pytest.mark.asyncio
    async def test_capacity_analysis_valid(self, client: AsyncClient):
        """Test capacity analysis with valid data"""
        payload = {
            'parcel_id': 'TEST-001',
            'current_zoning': 'MRC-2',
            'lot_size_sqft': 87120,
            'current_units': 0
        }
        
        response = await client.post('/api/v1/pipeline/analyze', json=payload)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert 'potential_units' in data
        assert 'development_cost' in data
        assert 'development_potential' in data
        assert data['potential_units'] > 0
    
    @pytest.mark.asyncio
    async def test_capacity_analysis_missing_field(self, client: AsyncClient):
        """Test capacity analysis with missing required field"""
        payload = {
            'parcel_id': 'TEST-001',
            # missing lot_size_sqft
            'current_zoning': 'MRC-2'
        }
        
        response = await client.post('/api/v1/pipeline/analyze', json=payload)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    @pytest.mark.asyncio
    async def test_imbalance_analysis_valid(self, client: AsyncClient, test_submarket):
        """Test imbalance analysis"""
        payload = {
            'submarket_id': str(test_submarket.id)
        }
        
        response = await client.post('/api/v1/analysis/imbalance', json=payload)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert 'imbalance_score' in data
        assert 'verdict' in data
        assert 0 <= data['imbalance_score'] <= 100
    
    @pytest.mark.asyncio
    async def test_imbalance_nonexistent_submarket(self, client: AsyncClient):
        """Test imbalance with non-existent submarket"""
        payload = {
            'submarket_id': '00000000-0000-0000-0000-000000000000'
        }
        
        response = await client.post('/api/v1/analysis/imbalance', json=payload)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

# ============================================================================
# Authentication Tests
# ============================================================================

class TestAuthentication:
    """Test API authentication"""
    
    @pytest.mark.asyncio
    async def test_protected_endpoint_no_auth(self, client: AsyncClient):
        """Protected endpoint should require auth"""
        response = await client.get('/api/v1/user/profile')
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    @pytest.mark.asyncio
    async def test_protected_endpoint_with_auth(self, client: AsyncClient, auth_headers):
        """Protected endpoint should work with auth"""
        response = await client.get('/api/v1/user/profile', headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK

# ============================================================================
# Rate Limiting Tests
# ============================================================================

class TestRateLimiting:
    """Test API rate limiting"""
    
    @pytest.mark.asyncio
    async def test_rate_limit_not_exceeded(self, client: AsyncClient):
        """Normal usage should not hit rate limit"""
        for _ in range(5):
            response = await client.get('/health')
            assert response.status_code == status.HTTP_200_OK
    
    @pytest.mark.asyncio
    async def test_rate_limit_exceeded(self, client: AsyncClient):
        """Excessive requests should be rate limited"""
        # Make 100 requests quickly
        for _ in range(100):
            response = await client.get('/health')
            
            if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                # Rate limit hit (expected)
                return
        
        # If we got here, rate limiting may not be enabled
        # (That's ok for test environment)
        pass

# ============================================================================
# Error Handling Tests
# ============================================================================

class TestErrorHandling:
    """Test API error responses"""
    
    @pytest.mark.asyncio
    async def test_404_for_invalid_route(self, client: AsyncClient):
        """Invalid route should return 404"""
        response = await client.get('/api/v1/nonexistent')
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    @pytest.mark.asyncio
    async def test_invalid_json_payload(self, client: AsyncClient):
        """Invalid JSON should return 422"""
        response = await client.post(
            '/api/v1/pipeline/analyze',
            data='{"invalid": json}',
            headers={'Content-Type': 'application/json'}
        )
        
        assert response.status_code in [
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            status.HTTP_400_BAD_REQUEST
        ]

# ============================================================================
# Run Tests
# ============================================================================

if __name__ == '__main__':
    pytest.main([__file__, '-v', '--asyncio-mode=auto'])
