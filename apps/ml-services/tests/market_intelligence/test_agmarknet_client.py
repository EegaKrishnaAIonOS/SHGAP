from unittest.mock import MagicMock, patch

import pytest

from app.market_intelligence.agmarknet_client import AgmarknetError, fetch_daily_prices

REQUESTS_GET = "app.market_intelligence.agmarknet_client.requests.get"


def _record(commodity="Tomato"):
    return {
        "state": "Andhra Pradesh",
        "district": "Anantapur",
        "market": "Anantapur APMC",
        "commodity": commodity,
        "variety": "Hybrid",
        "arrival_date": "21/07/2026",
        "min_price": 1000,
        "max_price": 1500,
        "modal_price": 1250,
    }


def _mock_response(status_code=200, json_body=None):
    response = MagicMock()
    response.status_code = status_code
    response.text = "error text"
    response.json.return_value = json_body or {}
    return response


class TestFetchDailyPrices:
    def test_parses_a_single_page_into_dataclasses(self):
        body = {"status": "ok", "total": 1, "records": [_record()]}
        with patch(REQUESTS_GET) as mock_get:
            mock_get.return_value = _mock_response(json_body=body)
            results = fetch_daily_prices("Andhra Pradesh")

        assert len(results) == 1
        assert results[0].commodity == "Tomato"
        assert results[0].modal_price == 1250.0
        assert mock_get.call_count == 1

    def test_passes_the_state_filter_and_configured_credentials(self):
        empty = {"status": "ok", "total": 0, "records": []}
        with patch(REQUESTS_GET) as mock_get:
            mock_get.return_value = _mock_response(json_body=empty)
            fetch_daily_prices("Andhra Pradesh")

        call = mock_get.call_args
        assert call.kwargs["params"]["filters[state]"] == "Andhra Pradesh"
        assert "api-key" in call.kwargs["params"]

    def test_sends_a_non_default_user_agent(self):
        # data.gov.in silently times out requests carrying the default
        # "python-requests/x.y" signature — verified directly against the
        # real API (see agmarknet_client.py's comment). This just guards
        # against that header accidentally being removed later.
        empty = {"status": "ok", "total": 0, "records": []}
        with patch(REQUESTS_GET) as mock_get:
            mock_get.return_value = _mock_response(json_body=empty)
            fetch_daily_prices("Andhra Pradesh")

        assert "python-requests" not in mock_get.call_args.kwargs["headers"]["User-Agent"]

    def test_pages_through_multiple_batches_until_total_is_reached(self):
        page1 = {"status": "ok", "total": 15, "records": [_record("Tomato")] * 10}
        page2 = {"status": "ok", "total": 15, "records": [_record("Onion")] * 5}
        with patch(REQUESTS_GET) as mock_get:
            mock_get.side_effect = [
                _mock_response(json_body=page1),
                _mock_response(json_body=page2),
            ]
            results = fetch_daily_prices("Andhra Pradesh")

        assert len(results) == 15
        assert mock_get.call_count == 2
        assert mock_get.call_args_list[1].kwargs["params"]["offset"] == 10

    def test_stops_paging_once_a_page_returns_no_records(self):
        page1 = {"status": "ok", "total": 100, "records": [_record()] * 10}
        page2 = {"status": "ok", "total": 100, "records": []}
        with patch(REQUESTS_GET) as mock_get:
            mock_get.side_effect = [
                _mock_response(json_body=page1),
                _mock_response(json_body=page2),
            ]
            results = fetch_daily_prices("Andhra Pradesh")

        assert len(results) == 10
        assert mock_get.call_count == 2

    def test_raises_on_non_200_response(self):
        with patch(REQUESTS_GET) as mock_get:
            mock_get.return_value = _mock_response(status_code=500)
            with pytest.raises(AgmarknetError):
                fetch_daily_prices("Andhra Pradesh")

    def test_raises_when_the_api_reports_an_error_status(self):
        error_body = {"status": "error", "error": "Key not authorised"}
        with patch(REQUESTS_GET) as mock_get:
            mock_get.return_value = _mock_response(json_body=error_body)
            with pytest.raises(AgmarknetError):
                fetch_daily_prices("Andhra Pradesh")

    def test_raises_on_network_failure(self):
        import requests

        with patch(REQUESTS_GET) as mock_get:
            mock_get.side_effect = requests.ConnectionError("refused")
            with pytest.raises(AgmarknetError):
                fetch_daily_prices("Andhra Pradesh")
