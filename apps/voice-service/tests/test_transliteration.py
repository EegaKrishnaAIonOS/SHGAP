from unittest.mock import AsyncMock, MagicMock

import pytest

from app.transliteration import TextNormalizer, TransliterationError


def _make_fake_groq_client(reply: str | None):
    message = MagicMock()
    message.content = reply
    choice = MagicMock()
    choice.message = message
    response = MagicMock()
    response.choices = [choice]

    client = MagicMock()
    client.chat.completions.create = AsyncMock(return_value=response)
    return client


async def test_normalize_returns_the_llm_response():
    client = _make_fake_groq_client("నేను మామిడి పికల్ రెజిస్టర్ చేయాలి")
    normalizer = TextNormalizer(client=client)

    result = await normalizer.normalize("nenu mamidi pickle register cheyali")

    assert result == "నేను మామిడి పికల్ రెజిస్టర్ చేయాలి"


async def test_normalize_returns_empty_or_whitespace_text_unchanged_without_calling_the_llm():
    client = _make_fake_groq_client("shouldn't matter")
    normalizer = TextNormalizer(client=client)

    result = await normalizer.normalize("   ")

    assert result == "   "
    client.chat.completions.create.assert_not_called()


async def test_normalize_falls_back_to_original_text_when_the_llm_returns_nothing():
    client = _make_fake_groq_client(None)
    normalizer = TextNormalizer(client=client)

    result = await normalizer.normalize("some input")

    assert result == "some input"


async def test_normalize_raises_transliteration_error_on_api_failure():
    client = MagicMock()
    client.chat.completions.create = AsyncMock(side_effect=RuntimeError("network down"))
    normalizer = TextNormalizer(client=client)

    with pytest.raises(TransliterationError):
        await normalizer.normalize("some input")


async def test_normalize_sends_the_expected_prompt_shape():
    client = _make_fake_groq_client("output")
    normalizer = TextNormalizer(client=client)

    await normalizer.normalize("input text")

    call = client.chat.completions.create.call_args
    messages = call.kwargs["messages"]
    assert messages[0]["role"] == "system"
    assert messages[1] == {"role": "user", "content": "input text"}
    assert call.kwargs["temperature"] == 0
