"""T11 evaluation: STT word-error-rate against a real Sarvam TTS->STT round
trip, per-language, using `jiwer` (named in T11's own tech-stack list).

Methodology note (read before trusting the numbers): this measures how well
Sarvam's own STT (saaras:v3) recovers text that Sarvam's own TTS (bulbul:v2)
just synthesized — a synthetic round trip, not real human speech recorded by
real SHG members. It's a fair check of "does this vendor's STT/TTS pair
agree with itself", not a claim about real-world accuracy on real accents,
background noise, or phone-mic audio. See the eval report and ADR-0020.

Calls the real Sarvam API. Run manually, not in CI:
    cd apps/voice-service && .venv/Scripts/python.exe eval/run_stt_wer_eval.py
"""

import asyncio
import base64
import io
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import jiwer  # noqa: E402
from sarvamai import AsyncSarvamAI  # noqa: E402

from app.config import settings  # noqa: E402
from eval.test_utterances import TEST_UTTERANCES  # noqa: E402

LANGUAGE_CODES = {"te": "te-IN", "en": "en-IN"}


def _normalize(text: str) -> str:
    """Strips differences that aren't real transcription errors: zero-width
    joiners Telugu conjuncts use (TTS/STT can add or drop these without
    changing the spoken word), currency symbols, and punctuation. Does NOT
    fix "₹120" vs "120 రూపాయలు" — the STT rendering a spoken amount as a
    digit+symbol instead of spelling out the currency word is a real,
    remaining source of apparent word-level error this can't erase; see the
    eval report.
    """
    text = text.replace("‌", "").replace("‍", "").replace("₹", "")
    text = re.sub(r"[.,!?;:]", "", text)
    return re.sub(r"\s+", " ", text).strip().lower()


async def round_trip_wer(client: AsyncSarvamAI, text: str, language: str) -> tuple[float, float]:
    tts = await client.text_to_speech.convert(
        text=text, target_language_code=LANGUAGE_CODES[language]
    )
    audio_bytes = base64.b64decode(tts.audios[0])
    stt = await client.speech_to_text.transcribe(file=io.BytesIO(audio_bytes), model="saaras:v3")
    raw = jiwer.wer(text, stt.transcript)
    normalized = jiwer.wer(_normalize(text), _normalize(stt.transcript))
    return raw, normalized


async def main() -> None:
    client = AsyncSarvamAI(api_subscription_key=settings.sarvam_api_key, timeout=60.0)

    results = []
    for case in TEST_UTTERANCES:
        raw_wer, normalized_wer = await round_trip_wer(client, case["text"], case["language"])
        results.append({**case, "raw_wer": raw_wer, "wer": normalized_wer})

    print(f"{'language':10} {'raw_wer':>9} {'norm_wer':>9}  text")
    for r in results:
        print(f"{r['language']:10} {r['raw_wer']:>9.2f} {r['wer']:>9.2f}  {r['text'][:50]}")

    for lang in ("te", "en"):
        subset = [r["wer"] for r in results if r["language"] == lang]
        raw_subset = [r["raw_wer"] for r in results if r["language"] == lang]
        if subset:
            print(f"\n{lang}: mean raw WER = {sum(raw_subset) / len(raw_subset):.3f}, ", end="")
            print(f"mean normalized WER = {sum(subset) / len(subset):.3f} (n={len(subset)})")


if __name__ == "__main__":
    asyncio.run(main())
