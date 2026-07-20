import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.ml_services_client import MlServicesClient, MlServicesError


def _mock_httpx_client(status_code: int, json_body=None, text_body: str = ""):
    response = MagicMock()
    response.status_code = status_code
    response.content = json.dumps(json_body).encode() if json_body is not None else b""
    response.json.return_value = json_body
    response.text = text_body

    client = AsyncMock()
    client.post = AsyncMock(return_value=response)
    client.__aenter__.return_value = client
    client.__aexit__.return_value = None
    return client


async def test_search_schemes_returns_the_results_list():
    mock_client = _mock_httpx_client(
        200, {"results": [{"scheme_name": "PM SVANidhi", "content": "...", "score": 0.8}]}
    )
    with patch("app.ml_services_client.httpx.AsyncClient", return_value=mock_client):
        result = await MlServicesClient(base_url="http://ml-services").search_schemes(
            "street vendor loan"
        )

    assert result == [{"scheme_name": "PM SVANidhi", "content": "...", "score": 0.8}]
    call = mock_client.post.call_args
    assert call.args == ("http://ml-services/scheme-guidance/search",)
    assert call.kwargs["json"] == {"query": "street vendor loan", "top_k": 3}


async def test_search_schemes_returns_empty_list_when_nothing_matches():
    mock_client = _mock_httpx_client(200, {"results": []})
    with patch("app.ml_services_client.httpx.AsyncClient", return_value=mock_client):
        result = await MlServicesClient(base_url="http://ml-services").search_schemes("weather")
    assert result == []


async def test_error_response_raises_ml_services_error():
    mock_client = _mock_httpx_client(500, None, "boom")
    with patch("app.ml_services_client.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(MlServicesError):
            await MlServicesClient(base_url="http://ml-services").search_schemes("loan")


async def test_network_error_raises_ml_services_error():
    client = AsyncMock()
    client.__aenter__.return_value = client
    client.__aexit__.return_value = None
    client.post = AsyncMock(side_effect=httpx.ConnectError("refused"))
    with patch("app.ml_services_client.httpx.AsyncClient", return_value=client):
        with pytest.raises(MlServicesError):
            await MlServicesClient(base_url="http://ml-services").search_schemes("loan")
