"""
Integration tests for FastAPI endpoints using async httpx client.
"""

import pytest
import httpx
from app.api import app


@pytest.mark.asyncio
async def test_health_check_endpoint():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "app_name" in data
        assert "llm_model" in data


@pytest.mark.asyncio
async def test_invalid_url_ingest():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Malformed non-URL non-ID input -> 400
        response = await client.post("/api/ingest", json={"url": "https://notyoutube.com/something_invalid"})
        assert response.status_code == 400

        # Non-existent video ID -> 404
        response_404 = await client.post("/api/ingest", json={"url": "notreal_999"})
        assert response_404.status_code == 404


@pytest.mark.asyncio
async def test_serve_index_html():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")
        assert response.status_code == 200
