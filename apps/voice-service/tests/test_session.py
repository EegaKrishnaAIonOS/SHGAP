from app.session import SessionStore
from tests.fake_redis import FakeRedis


async def test_create_and_get_round_trip():
    store = SessionStore(FakeRedis())
    created = await store.create("sess-1", "token-abc", "te")

    assert created.session_id == "sess-1"
    assert created.access_token == "token-abc"
    assert created.language == "te"
    assert created.shg_id is None
    assert created.history == []

    fetched = await store.get("sess-1")
    assert fetched == created


async def test_get_returns_none_for_a_session_that_was_never_created():
    store = SessionStore(FakeRedis())
    assert await store.get("missing") is None


async def test_append_turn_accumulates_history_in_order():
    store = SessionStore(FakeRedis())
    await store.create("sess-1", "token", "en")

    await store.append_turn("sess-1", "user", "Hello")
    await store.append_turn("sess-1", "assistant", "Hi there")

    session = await store.get("sess-1")
    assert session.history == [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi there"},
    ]


async def test_append_turn_is_a_noop_for_a_missing_session():
    store = SessionStore(FakeRedis())
    await store.append_turn("missing", "user", "Hello")  # must not raise
    assert await store.get("missing") is None


async def test_set_shg_id():
    store = SessionStore(FakeRedis())
    await store.create("sess-1", "token", "te")

    await store.set_shg_id("sess-1", "shg-123")

    session = await store.get("sess-1")
    assert session.shg_id == "shg-123"


async def test_delete_removes_the_session():
    store = SessionStore(FakeRedis())
    await store.create("sess-1", "token", "te")

    await store.delete("sess-1")

    assert await store.get("sess-1") is None


async def test_save_persists_a_directly_mutated_session_object():
    store = SessionStore(FakeRedis())
    session = await store.create("sess-1", "old-token", "te")

    session.access_token = "new-token"
    session.language = "en"
    await store.save(session)

    fetched = await store.get("sess-1")
    assert fetched.access_token == "new-token"
    assert fetched.language == "en"
