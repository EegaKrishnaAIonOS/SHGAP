import json
from typing import Any

from groq import AsyncGroq

from app.actions import build_tools
from app.config import settings
from app.prompts import SYSTEM_PROMPT
from app.session import SessionStore, VoiceSession


def _to_groq_tool(schema: Any) -> dict[str, Any]:
    """Hand-converts a Pipecat `FunctionSchema` to Groq's (OpenAI-compatible)
    tool-call format. `build_tools()` was written for Pipecat's in-pipeline
    LLM service, which does this conversion internally — this endpoint calls
    Groq directly instead of going through a full Pipecat pipeline (there's
    no audio here, just one request/response), so the same small schema is
    converted by hand rather than pulling in Pipecat's adapter machinery for
    a single-turn HTTP call."""
    return {
        "type": "function",
        "function": {
            "name": schema.name,
            "description": schema.description,
            "parameters": {
                "type": "object",
                "properties": schema.properties,
                "required": schema.required,
            },
        },
    }


class _CapturedToolCall:
    """Minimal stand-in for Pipecat's `FunctionCallParams` — every handler in
    `app/actions.py` only ever reads `.arguments` and awaits
    `.result_callback(...)`, so this is all a tool handler needs to run
    outside of a live Pipecat pipeline."""

    def __init__(self, arguments: dict[str, Any]):
        self.arguments = arguments
        self.result: Any = None

    async def result_callback(self, result: Any) -> None:
        self.result = result


async def handle_text_message(
    session: VoiceSession,
    session_store: SessionStore,
    message: str,
    groq_client: AsyncGroq | None = None,
) -> tuple[str, list[dict[str, Any]]]:
    """Runs one text-chat turn through the same tools and system prompt the
    live voice pipeline uses (T12) — reusing `build_tools` and the session's
    shared history means a typed message and a spoken one are part of the
    same ongoing conversation, whichever channel the member used (ADR-0021).

    Returns `(reply_text, tool_results)` — `tool_results` carries each
    invoked tool's raw structured output (e.g. a created product, or scheme
    chunks with citations) so the frontend can render an action-result card
    alongside the natural-language reply, not just prose.
    """
    client = groq_client or AsyncGroq(api_key=settings.groq_api_key)
    tools_by_name = {tool.name: tool for tool in build_tools(session, session_store)}
    groq_tools = [_to_groq_tool(tool) for tool in tools_by_name.values()]

    messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend({"role": turn["role"], "content": turn["content"]} for turn in session.history)
    messages.append({"role": "user", "content": message})

    response = await client.chat.completions.create(
        model=settings.groq_llm_model, messages=messages, tools=groq_tools
    )
    reply_message = response.choices[0].message
    tool_results: list[dict[str, Any]] = []

    if reply_message.tool_calls:
        messages.append(reply_message.model_dump(exclude_none=True))
        for call in reply_message.tool_calls:
            tool = tools_by_name.get(call.function.name)
            if tool is None or tool.handler is None:
                # Groq's API requires a "tool" message for every tool_call_id
                # the assistant message declared, or the follow-up call below
                # gets rejected — so an unrecognized tool still needs a
                # (error) response, not a silently skipped one.
                result: dict[str, Any] = {"error": "unknown_tool", "tool": call.function.name}
            else:
                captured = _CapturedToolCall(json.loads(call.function.arguments))
                await tool.handler(captured)
                result = captured.result
                tool_results.append({"tool": call.function.name, "result": result})
            messages.append(
                {"role": "tool", "tool_call_id": call.id, "content": json.dumps(result)}
            )

        follow_up = await client.chat.completions.create(
            model=settings.groq_llm_model, messages=messages
        )
        reply_text = follow_up.choices[0].message.content or ""
    else:
        reply_text = reply_message.content or ""

    await session_store.append_turn(session.session_id, "user", message)
    await session_store.append_turn(session.session_id, "assistant", reply_text)

    return reply_text, tool_results
