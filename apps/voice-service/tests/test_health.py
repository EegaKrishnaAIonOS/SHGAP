from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.session import SessionStore
from tests.fake_redis import FakeRedis

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "voice-service"}


def test_metrics_endpoint_exposes_real_prometheus_output():
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "http_requests_total" in response.text


def test_ready_reports_ok_when_redis_responds():
    with patch("app.main.session_store", new=SessionStore(FakeRedis())):
        response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "checks": {"redis": True}}


def test_ready_returns_503_when_redis_is_unreachable():
    async def _raise_connection_error() -> bool:
        raise ConnectionError("refused")

    broken = FakeRedis()
    broken.ping = _raise_connection_error

    with patch("app.main.session_store", new=SessionStore(broken)):
        response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json()["detail"]["checks"] == {"redis": False}
