from unittest.mock import AsyncMock, patch

from groq.types.chat import ChatCompletionMessage
from groq.types.chat.chat_completion_message_tool_call import (
    ChatCompletionMessageToolCall,
    Function,
)

from app.session import SessionStore
from app.text_chat import handle_text_message
from tests.fake_redis import FakeRedis


def _completion(message: ChatCompletionMessage):
    choice = AsyncMock()
    choice.message = message
    response = AsyncMock()
    response.choices = [choice]
    return response


def _make_groq_client(*responses):
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(side_effect=list(responses))
    return client


async def test_plain_reply_without_any_tool_call():
    store = SessionStore(FakeRedis())
    session = await store.create("sess-1", "token-abc", "en")

    groq_client = _make_groq_client(
        _completion(ChatCompletionMessage(role="assistant", content="Hello there!"))
    )

    reply, tool_results = await handle_text_message(
        session, store, "hi", groq_client=groq_client
    )

    assert reply == "Hello there!"
    assert tool_results == []
    saved = await store.get("sess-1")
    assert saved.history == [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "Hello there!"},
    ]


async def test_tool_call_runs_the_handler_and_returns_a_grounded_reply():
    store = SessionStore(FakeRedis())
    session = await store.create("sess-1", "token-abc", "en")

    tool_call = ChatCompletionMessageToolCall(
        id="call-1",
        type="function",
        function=Function(name="check_product_price", arguments='{"name": "pickle"}'),
    )
    first = _completion(
        ChatCompletionMessage(role="assistant", content=None, tool_calls=[tool_call])
    )
    second = _completion(
        ChatCompletionMessage(role="assistant", content="Your mango pickle is Rs 120.")
    )
    groq_client = _make_groq_client(first, second)

    mock_core_client = AsyncMock()
    mock_core_client.search_my_products.return_value = [
        {"name": "Mango Pickle", "price": 120, "stock": 5, "isAvailable": True}
    ]

    with patch("app.actions.CoreApiClient", return_value=mock_core_client):
        reply, tool_results = await handle_text_message(
            session, store, "how much is my pickle", groq_client=groq_client
        )

    assert reply == "Your mango pickle is Rs 120."
    assert len(tool_results) == 1
    assert tool_results[0]["tool"] == "check_product_price"
    assert tool_results[0]["result"]["status"] == "found"
    assert groq_client.chat.completions.create.await_count == 2


async def test_unknown_tool_call_is_skipped_without_crashing():
    store = SessionStore(FakeRedis())
    session = await store.create("sess-1", "token-abc", "en")

    tool_call = ChatCompletionMessageToolCall(
        id="call-1",
        type="function",
        function=Function(name="not_a_real_tool", arguments="{}"),
    )
    first = _completion(
        ChatCompletionMessage(role="assistant", content=None, tool_calls=[tool_call])
    )
    second = _completion(ChatCompletionMessage(role="assistant", content="Okay."))
    groq_client = _make_groq_client(first, second)

    reply, tool_results = await handle_text_message(
        session, store, "do something unsupported", groq_client=groq_client
    )

    assert reply == "Okay."
    assert tool_results == []
