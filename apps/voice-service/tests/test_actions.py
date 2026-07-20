from unittest.mock import AsyncMock, MagicMock, patch

from app.actions import SESSION_EXPIRED_RESULT, build_tools
from app.core_api_client import CoreApiAuthError, CoreApiRequestError
from app.session import SessionStore
from tests.fake_redis import FakeRedis


def _make_params(arguments: dict):
    params = MagicMock()
    params.arguments = arguments
    params.result_callback = AsyncMock()
    return params


async def _seed_session(store: SessionStore, shg_id: str | None = None):
    session = await store.create("sess-1", "token-abc", "en")
    if shg_id:
        await store.set_shg_id("sess-1", shg_id)
        session.shg_id = shg_id
    return session


def _tool(tools, name: str):
    return next(t for t in tools if t.name == name)


async def test_register_product_success_resolves_shg_and_category():
    store = SessionStore(FakeRedis())
    session = await _seed_session(store)  # no shg_id cached yet

    mock_client = AsyncMock()
    mock_client.get_my_shg.return_value = {"id": "shg-1"}
    mock_client.suggest_category.return_value = {
        "categoryId": "cat-1",
        "categoryName": "Pickles",
    }
    mock_client.create_product.return_value = {"name": "Mango Pickle"}

    with patch("app.actions.CoreApiClient", return_value=mock_client):
        tools = build_tools(session, store)
        params = _make_params({"name": "Mango Pickle", "unit": "jar", "price": 100})
        await _tool(tools, "register_product").handler(params)

    params.result_callback.assert_awaited_once_with(
        {"status": "created", "product_name": "Mango Pickle", "category_name": "Pickles"}
    )
    mock_client.create_product.assert_awaited_once_with(
        shg_id="shg-1",
        category_id="cat-1",
        name="Mango Pickle",
        description=None,
        unit="jar",
        price=100,
        moq=None,
        stock=None,
    )
    # shg_id is now cached on the session and persisted.
    assert session.shg_id == "shg-1"
    assert (await store.get("sess-1")).shg_id == "shg-1"


async def test_register_product_skips_get_my_shg_when_already_cached():
    store = SessionStore(FakeRedis())
    session = await _seed_session(store, shg_id="shg-cached")

    mock_client = AsyncMock()
    mock_client.suggest_category.return_value = {"categoryId": "cat-1", "categoryName": "Pickles"}
    mock_client.create_product.return_value = {"name": "Pickle"}

    with patch("app.actions.CoreApiClient", return_value=mock_client):
        tools = build_tools(session, store)
        params = _make_params({"name": "Pickle", "unit": "jar", "price": 50})
        await _tool(tools, "register_product").handler(params)

    mock_client.get_my_shg.assert_not_called()


async def test_register_product_reports_when_caller_has_no_shg():
    store = SessionStore(FakeRedis())
    session = await _seed_session(store)

    mock_client = AsyncMock()
    mock_client.get_my_shg.return_value = None

    with patch("app.actions.CoreApiClient", return_value=mock_client):
        tools = build_tools(session, store)
        params = _make_params({"name": "Pickle", "unit": "jar", "price": 50})
        await _tool(tools, "register_product").handler(params)

    result = params.result_callback.call_args.args[0]
    assert result["error"] == "no_shg_registered"


async def test_register_product_reports_when_no_category_is_confident_enough():
    store = SessionStore(FakeRedis())
    session = await _seed_session(store, shg_id="shg-1")

    mock_client = AsyncMock()
    mock_client.suggest_category.return_value = None

    with patch("app.actions.CoreApiClient", return_value=mock_client):
        tools = build_tools(session, store)
        params = _make_params({"name": "అపరిచిత ఉత్పత్తి", "unit": "kg", "price": 10})
        await _tool(tools, "register_product").handler(params)

    result = params.result_callback.call_args.args[0]
    assert result["error"] == "no_category_match"
    mock_client.create_product.assert_not_called()


async def test_register_product_reports_session_expired_on_auth_error():
    store = SessionStore(FakeRedis())
    session = await _seed_session(store, shg_id="shg-1")

    mock_client = AsyncMock()
    mock_client.suggest_category.side_effect = CoreApiAuthError("expired")

    with patch("app.actions.CoreApiClient", return_value=mock_client):
        tools = build_tools(session, store)
        params = _make_params({"name": "Pickle", "unit": "jar", "price": 50})
        await _tool(tools, "register_product").handler(params)

    params.result_callback.assert_awaited_once_with(SESSION_EXPIRED_RESULT)


async def test_register_product_reports_other_core_api_errors():
    store = SessionStore(FakeRedis())
    session = await _seed_session(store, shg_id="shg-1")

    mock_client = AsyncMock()
    mock_client.suggest_category.side_effect = CoreApiRequestError("bad request")

    with patch("app.actions.CoreApiClient", return_value=mock_client):
        tools = build_tools(session, store)
        params = _make_params({"name": "Pickle", "unit": "jar", "price": 50})
        await _tool(tools, "register_product").handler(params)

    result = params.result_callback.call_args.args[0]
    assert result["error"] == "core_api_error"


async def test_check_product_price_found():
    store = SessionStore(FakeRedis())
    session = await _seed_session(store)

    mock_client = AsyncMock()
    mock_client.search_my_products.return_value = [
        {"name": "Mango Pickle", "price": 120, "stock": 10, "isAvailable": True}
    ]

    with patch("app.actions.CoreApiClient", return_value=mock_client):
        tools = build_tools(session, store)
        params = _make_params({"name": "pickle"})
        await _tool(tools, "check_product_price").handler(params)

    params.result_callback.assert_awaited_once_with(
        {
            "status": "found",
            "products": [
                {"name": "Mango Pickle", "price": 120, "stock": 10, "isAvailable": True}
            ],
        }
    )


async def test_check_product_price_not_found():
    store = SessionStore(FakeRedis())
    session = await _seed_session(store)

    mock_client = AsyncMock()
    mock_client.search_my_products.return_value = []

    with patch("app.actions.CoreApiClient", return_value=mock_client):
        tools = build_tools(session, store)
        params = _make_params({"name": "nonexistent"})
        await _tool(tools, "check_product_price").handler(params)

    params.result_callback.assert_awaited_once_with({"status": "not_found"})


async def test_tool_schemas_declare_required_fields():
    store = SessionStore(FakeRedis())
    session = await _seed_session(store)
    tools = build_tools(session, store)

    register = _tool(tools, "register_product")
    assert register.required == ["name", "unit", "price"]

    check = _tool(tools, "check_product_price")
    assert check.required == ["name"]
