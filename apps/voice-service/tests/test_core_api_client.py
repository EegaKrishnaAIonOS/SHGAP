import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.core_api_client import (
    CoreApiAuthError,
    CoreApiClient,
    CoreApiRequestError,
    CoreApiUnavailableError,
)


def _mock_httpx_client(status_code: int, json_body=None, text_body: str = ""):
    response = MagicMock()
    response.status_code = status_code
    response.content = json.dumps(json_body).encode() if json_body is not None else b""
    response.json.return_value = json_body
    response.text = text_body

    client = AsyncMock()
    client.request = AsyncMock(return_value=response)
    client.__aenter__.return_value = client
    client.__aexit__.return_value = None
    return client


async def test_get_my_shg_returns_the_first_item():
    mock_client = _mock_httpx_client(200, {"items": [{"id": "shg-1"}], "total": 1})
    with patch("app.core_api_client.httpx.AsyncClient", return_value=mock_client):
        result = await CoreApiClient(access_token="tok").get_my_shg()
    assert result == {"id": "shg-1"}


async def test_get_my_shg_returns_none_when_the_caller_has_no_shg():
    mock_client = _mock_httpx_client(200, {"items": [], "total": 0})
    with patch("app.core_api_client.httpx.AsyncClient", return_value=mock_client):
        result = await CoreApiClient(access_token="tok").get_my_shg()
    assert result is None


async def test_suggest_category_returns_the_top_suggestion():
    mock_client = _mock_httpx_client(
        200, [{"categoryId": "cat-1", "categoryName": "Pickles", "score": 0.9}]
    )
    with patch("app.core_api_client.httpx.AsyncClient", return_value=mock_client):
        result = await CoreApiClient(access_token="tok").suggest_category("Mango Pickle", None)
    assert result == {"categoryId": "cat-1", "categoryName": "Pickles", "score": 0.9}


async def test_suggest_category_returns_none_when_nothing_is_confident_enough():
    mock_client = _mock_httpx_client(200, [])
    with patch("app.core_api_client.httpx.AsyncClient", return_value=mock_client):
        result = await CoreApiClient(access_token="tok").suggest_category("x", None)
    assert result is None


async def test_search_my_products_returns_the_item_list():
    mock_client = _mock_httpx_client(200, {"items": [{"id": "p1", "name": "Pickle"}], "total": 1})
    with patch("app.core_api_client.httpx.AsyncClient", return_value=mock_client):
        result = await CoreApiClient(access_token="tok").search_my_products("pickle")
    assert result == [{"id": "p1", "name": "Pickle"}]


async def test_create_product_sends_the_expected_payload_and_auth_header():
    mock_client = _mock_httpx_client(201, {"id": "prod-1", "name": "Pickle"})
    with patch("app.core_api_client.httpx.AsyncClient", return_value=mock_client):
        client = CoreApiClient(access_token="tok", base_url="http://core-api")
        await client.create_product(
            shg_id="shg-1",
            category_id="cat-1",
            name="Pickle",
            description=None,
            unit="jar",
            price=100,
            moq=2,
            stock=5,
        )

    call = mock_client.request.call_args
    assert call.args == ("POST", "http://core-api/products")
    assert call.kwargs["json"] == {
        "shgId": "shg-1",
        "categoryId": "cat-1",
        "name": "Pickle",
        "unit": "jar",
        "price": 100,
        "moq": 2,
        "stock": 5,
    }
    assert call.kwargs["headers"] == {"Authorization": "Bearer tok"}


async def test_401_raises_auth_error():
    mock_client = _mock_httpx_client(401, None, "Unauthorized")
    with patch("app.core_api_client.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(CoreApiAuthError):
            await CoreApiClient(access_token="expired").get_my_shg()


async def test_other_4xx_raises_request_error():
    mock_client = _mock_httpx_client(422, None, "Validation failed")
    with patch("app.core_api_client.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(CoreApiRequestError):
            await CoreApiClient(access_token="tok").search_my_products("x")


async def test_5xx_raises_unavailable_error():
    mock_client = _mock_httpx_client(500, None, "boom")
    with patch("app.core_api_client.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(CoreApiUnavailableError):
            await CoreApiClient(access_token="tok").search_my_products("x")


async def test_network_error_raises_unavailable_error():
    client = AsyncMock()
    client.__aenter__.return_value = client
    client.__aexit__.return_value = None
    client.request = AsyncMock(side_effect=httpx.ConnectError("refused"))
    with patch("app.core_api_client.httpx.AsyncClient", return_value=client):
        with pytest.raises(CoreApiUnavailableError):
            await CoreApiClient(access_token="tok").get_my_shg()
