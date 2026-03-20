"""
Quick API tests for JediRe User Agent
Run with: pytest test_api.py -v
"""

import pytest
from httpx import AsyncClient
from api.main import app

@pytest.mark.asyncio
async def test_health_check():
    """Test health endpoint"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["healthy", "degraded", "unhealthy"]
        assert "version" in data
        assert "services" in data


@pytest.mark.asyncio
async def test_list_models():
    """Test models endpoint (no auth required)"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/v1/models")
        
        # Should fail without auth
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_auth_flow():
    """Test magic link authentication flow"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Step 1: Request magic link
        response = await client.post(
            "/auth/login",
            json={"email": "test@jedire.com"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "magic_link_token" in data
        
        magic_token = data["magic_link_token"]
        
        # Step 2: Verify magic link and get access token
        response = await client.post(
            "/auth/verify",
            json={"token": magic_token}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "test@jedire.com"
        
        access_token = data["access_token"]
        
        # Step 3: Use access token to access protected endpoint
        response = await client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@jedire.com"


@pytest.mark.asyncio
async def test_models_with_auth():
    """Test models endpoint with authentication"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Get token
        login_response = await client.post(
            "/auth/login",
            json={"email": "test@jedire.com"}
        )
        magic_token = login_response.json()["magic_link_token"]
        
        verify_response = await client.post(
            "/auth/verify",
            json={"token": magic_token}
        )
        access_token = verify_response.json()["access_token"]
        
        # List models
        response = await client.get(
            "/v1/models",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "models" in data
        assert len(data["models"]) > 0
        assert "user_plan" in data


@pytest.mark.asyncio  
async def test_chat_endpoint():
    """Test chat endpoint (requires database)"""
    # This test requires a real database connection
    # Skip for now, implement after database is set up
    pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
