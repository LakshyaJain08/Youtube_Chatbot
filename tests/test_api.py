"""
Integration tests for FastAPI endpoints using async httpx client.
"""

import pytest
import httpx
from unittest.mock import patch
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
        assert "uptime_seconds" in data
        assert "total_requests" in data


@pytest.mark.asyncio
async def test_monitoring_endpoint():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/monitoring")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "service" in data
        assert "telemetry" in data
        assert "traffic" in data
        assert "ai_engine" in data
        assert "uptime_seconds" in data["telemetry"]


@pytest.mark.asyncio
async def test_metrics_endpoint():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/metrics")
        assert response.status_code == 200
        text = response.text
        assert "app_uptime_seconds" in text
        assert "app_requests_total" in text


@pytest.mark.asyncio
async def test_invalid_url_ingest():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Malformed non-URL non-ID input -> 400
        response = await client.post("/api/ingest", json={"url": "https://notyoutube.com/something_invalid"})
        assert response.status_code == 400

        # Non-existent video ID simulated with mock -> 404
        with patch("app.api.ingestion_pipeline.run") as mock_run:
            from src.utils.exceptions import TranscriptNotFoundError
            mock_run.side_effect = TranscriptNotFoundError("Transcript not found for video: notreal_999")
            response_404 = await client.post("/api/ingest", json={"url": "notreal_999"})
            assert response_404.status_code == 404


@pytest.mark.asyncio
async def test_serve_index_html():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")
        assert response.status_code == 200

