from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "ml-services"}


def test_metrics_endpoint_exposes_real_prometheus_output():
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "http_requests_total" in response.text


def test_ready_returns_503_when_the_database_is_unreachable():
    with patch("app.main.psycopg.AsyncConnection.connect", side_effect=OSError("refused")):
        response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json()["detail"]["checks"] == {"database": False}
