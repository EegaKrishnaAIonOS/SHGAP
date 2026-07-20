from groq import AsyncGroq

from app.config import settings

_SYSTEM_PROMPT = """You normalize text typed by a Self Help Group (SHG) member in Andhra \
Pradesh, India, into a product-registry voice assistant. Input may be Romanized Telugu \
(Telugu words spelled out in English letters, e.g. "nenu" for "నేను"), mixed script, or \
plain English — a common typing style when someone doesn't have a Telugu keyboard.

Rewrite the text so Telugu words appear in proper Telugu script and English words/loanwords \
stay in Latin script, exactly as an SHG member would naturally write them. Preserve the \
meaning, tone, and every number exactly as given — never translate, summarize, or add \
anything. Reply with ONLY the normalized text — no quotes, no explanation.

Example: "nenu mamidi pickle register cheyali, ధర 120 rupees" -> \
"నేను మామిడి పికల్ రెజిస్టర్ చేయాలి, ధర 120 రూపాయలు" """


class TransliterationError(Exception):
    """Raised when the normalization call itself fails (network/API error) — the caller
    decides whether to fall back to the original, unnormalized text."""


class TextNormalizer:
    """Normalizes Romanized/mixed-script Telugu into proper Telugu script via an LLM,
    not a dedicated transliteration model (see ADR-0020) — AI4Bharat's own
    IndicXlit package depends on `fairseq`, which has a long history of
    dependency/compatibility problems on modern Python, and the LLM we
    already use for the voice assistant (T10) handles this correctly with
    no new heavy dependency.

    Takes the Groq client as a constructor argument (not a module-level
    singleton) so tests can inject a fake instead of calling the real API.
    """

    def __init__(self, client: AsyncGroq | None = None):
        self._client = client or AsyncGroq(api_key=settings.groq_api_key)

    async def normalize(self, text: str) -> str:
        if not text.strip():
            return text
        try:
            response = await self._client.chat.completions.create(
                model=settings.groq_llm_model,
                temperature=0,
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": text},
                ],
            )
        except Exception as err:
            raise TransliterationError(str(err)) from err

        normalized = response.choices[0].message.content
        return normalized.strip() if normalized else text
