"""T11 evaluation: intent-routing accuracy of the actual production system
(Groq LLM + the real tool schemas from `app.actions.build_tools`), not a
hypothetical fine-tuned classifier — see ADR-0020 for why.

Calls the real Groq API. Run manually, not in CI:
    cd apps/voice-service && .venv/Scripts/python.exe eval/run_intent_eval.py
"""

import asyncio
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from groq import AsyncGroq, BadRequestError  # noqa: E402

from app.actions import build_tools  # noqa: E402
from app.bot import _SYSTEM_PROMPT  # noqa: E402
from app.config import settings  # noqa: E402
from app.session import SessionStore, VoiceSession  # noqa: E402
from eval.test_utterances import TEST_UTTERANCES  # noqa: E402


class _InertRedis:
    """Never actually read from in this script — `build_tools`'s handlers are
    never invoked, only their schemas are read, so nothing is persisted."""

    async def get(self, key):
        return None

    async def set(self, key, value, ex=None):
        pass

    async def delete(self, key):
        pass


async def _classify_once(client: AsyncGroq, tools, utterance: str) -> str | None:
    """Returns the tool name Groq chose to call, `None` if it chose not to
    call one, or the literal string "MALFORMED_TOOL_CALL" if Groq attempted
    a tool call but produced output its own API couldn't parse — a real
    failure mode observed during this evaluation (see the eval report),
    scored as always-wrong rather than crashing the whole run.
    """
    try:
        response = await client.chat.completions.create(
            model=settings.groq_llm_model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": utterance},
            ],
            tools=[{"type": "function", "function": t.to_default_dict()} for t in tools],
        )
    except BadRequestError as err:
        if "tool_use_failed" in str(err):
            return "MALFORMED_TOOL_CALL"
        raise
    message = response.choices[0].message
    if message.tool_calls:
        return message.tool_calls[0].function.name
    return None


async def classify(client: AsyncGroq, tools, utterance: str, retries: int = 0) -> str | None:
    """`retries=1` retries once on a malformed tool call — confirmed by hand
    (see the eval report) to be a stochastic generation glitch, not a
    deterministic prompt/schema problem, so a retry has a real chance of
    getting a valid response for the same input.
    """
    result = await _classify_once(client, tools, utterance)
    attempt = 0
    while result == "MALFORMED_TOOL_CALL" and attempt < retries:
        attempt += 1
        result = await _classify_once(client, tools, utterance)
    return result


def _prf1(tp: int, fp: int, fn: int) -> tuple[float, float, float]:
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return precision, recall, f1


async def main() -> None:
    retries = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    print(f"(retries={retries})\n")

    session = VoiceSession(session_id="eval", access_token="unused", language="te")
    store = SessionStore(_InertRedis())
    tools = build_tools(session, store)
    client = AsyncGroq(api_key=settings.groq_api_key)

    results = []
    for case in TEST_UTTERANCES:
        predicted = await classify(client, tools, case["text"], retries=retries)
        results.append({**case, "predicted_tool": predicted})

    labels = {"register_product", "check_product_price", None}
    counts: dict[str | None, dict[str, int]] = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0})
    correct = 0
    for r in results:
        expected, predicted = r["expected_tool"], r["predicted_tool"]
        if expected == predicted:
            correct += 1
            counts[expected]["tp"] += 1
        else:
            counts[predicted]["fp"] += 1
            counts[expected]["fn"] += 1

    print(f"{'text':60} {'expected':22} {'predicted':22} {'ok'}")
    for r in results:
        ok = "✓" if r["expected_tool"] == r["predicted_tool"] else "✗"
        row = f"{r['text'][:58]:60} {str(r['expected_tool']):22} {str(r['predicted_tool']):22} {ok}"
        print(row)

    print(f"\nOverall accuracy: {correct}/{len(results)} = {correct / len(results):.1%}\n")
    print(f"{'label':22} {'precision':>10} {'recall':>10} {'f1':>10}")
    for label in labels:
        p, r, f1 = _prf1(**counts[label])
        print(f"{str(label):22} {p:>10.2f} {r:>10.2f} {f1:>10.2f}")


if __name__ == "__main__":
    asyncio.run(main())
