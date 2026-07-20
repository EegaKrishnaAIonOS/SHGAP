from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.session import SessionStore
from tests.fake_redis import FakeRedis

client = TestClient(app)


def test_message_to_a_new_session_requires_an_access_token():
    with patch("app.main.session_store", new=SessionStore(FakeRedis())):
        response = client.post("/sessions/new-sess/message", json={"message": "hi"})
    assert response.status_code == 400


async def test_message_to_a_new_session_creates_it_and_replies():
    store = SessionStore(FakeRedis())
    with (
        patch("app.main.session_store", new=store),
        patch(
            "app.main.handle_text_message",
            new=AsyncMock(return_value=("Hello!", [])),
        ) as mock_handle,
    ):
        response = client.post(
            "/sessions/new-sess/message",
            json={"message": "hi", "accessToken": "tok-1", "language": "te"},
        )

    assert response.status_code == 200
    assert response.json() == {"reply": "Hello!", "tool_results": []}
    session = mock_handle.call_args.args[0]
    assert session.access_token == "tok-1"
    assert session.language == "te"


async def test_message_to_an_existing_session_reuses_its_stored_token():
    store = SessionStore(FakeRedis())
    await store.create("existing-sess", "stored-tok", "en")

    with (
        patch("app.main.session_store", new=store),
        patch(
            "app.main.handle_text_message",
            new=AsyncMock(return_value=("Sure, checking that.", [])),
        ) as mock_handle,
    ):
        response = client.post(
            "/sessions/existing-sess/message", json={"message": "check my price"}
        )

    assert response.status_code == 200
    session = mock_handle.call_args.args[0]
    assert session.access_token == "stored-tok"


def test_message_rejects_a_missing_message_field():
    with patch("app.main.session_store", new=SessionStore(FakeRedis())):
        response = client.post(
            "/sessions/sess/message", json={"accessToken": "tok"}
        )
    assert response.status_code == 422
