# T11 evaluation report — NLU/dialogue (intent-routing accuracy + STT WER)

- **Date:** 2026-07-20
- **Sprint:** Sprint 2 (T11)
- **See also:** ADR-0020 (why this evaluates the LLM-based system built in T10, not a fine-tuned IndicBERT classifier), ADR-0019 (voice pipeline design)

## What this measures

T11 asks for intent classification, entity extraction, and dialogue management, evaluated for word-error-rate (WER) and intent F1 against a Telugu test set, tuned to a ≥90% recognition target. As explained in ADR-0020, this evaluates the actual system built in T10 (Groq LLM + tool-calling, with `FunctionSchema.required` fields driving slot-filling) rather than a separate fine-tuned classifier that would need labeled data this project doesn't have.

Test set: `apps/voice-service/eval/test_utterances.py` — 17 hand-written utterances (9 Telugu, 8 English) covering `register_product`, `check_product_price`, and four out-of-scope categories (other SHGs' prices, buyer search, scheme guidance, general chit-chat) that the assistant should decline rather than act on.

**Honest caveat on sample size:** 17 utterances is enough to catch real, gross failure modes (and it did — see below) but is not a statistically rigorous benchmark. Treat the percentages here as a snapshot from one/two runs, not a certified accuracy figure.

## Intent-routing accuracy

Run via `eval/run_intent_eval.py` against the real Groq API (not mocked). Two runs, shown separately rather than averaged or cherry-picked:

| Run                              | Accuracy          | Notes                                                                                                                                                                                                                                                              |
| -------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 (no retry)                     | 15/17 = **88.2%** | Both misses were `register_product` on Telugu-heavy input — Groq returned a malformed tool call (`tool_use_failed`) rather than a valid one.                                                                                                                       |
| 2 (retry once on malformed call) | 16/17 = **94.1%** | The two run-1 failures both succeeded on retry. But a _different_ utterance failed this time — a simple Telugu greeting ("మీరు ఎలా ఉన్నారు?") that should never call a tool at all triggered a malformed tool-call attempt on both its original try and its retry. |

**What this means:** the malformed-tool-call failure is confirmed stochastic, not deterministic — five repeated calls on the run-1 failing input all succeeded (see ADR-0020). A retry-once policy measurably helps (below 90% → above 90% in run 2), but run 2's own new failure shows this isn't a clean "retry fixes everything" story — it's LLM sampling noise that retries reduce but don't eliminate. **The retry policy exists only in this eval script, not in the production pipeline (`app/bot.py`)** — flagged as real follow-up work in ADR-0020, not implemented here.

Per-class precision/recall/F1 (run 2, with retry):

| Class                  | Precision | Recall | F1   |
| ---------------------- | --------- | ------ | ---- |
| `register_product`     | 1.00      | 1.00   | 1.00 |
| `check_product_price`  | 1.00      | 1.00   | 1.00 |
| out-of-scope (no tool) | 1.00      | 0.88   | 0.93 |

## STT word-error-rate

Run via `eval/run_stt_wer_eval.py` — a real Sarvam TTS→STT round trip per utterance (synthesize the reference text, transcribe the resulting audio, compare). **This measures Sarvam's STT/TTS pair agreeing with itself, not real human speech** — no real SHG member's voice, phone-mic audio, or background noise is involved. Treat it as a floor on real-world WER, not an estimate of it.

| Language | Mean raw WER | Mean normalized WER | n   |
| -------- | ------------ | ------------------- | --- |
| Telugu   | 0.216        | **0.123**           | 9   |
| English  | 0.268        | **0.169**           | 8   |

"Normalized" strips zero-width joiner characters (Telugu conjuncts can gain/lose these without any change in the spoken word) and currency symbols/punctuation before comparing — confirmed by hand-inspecting a transcript that raw WER was counting `"₹120"` vs `"120 రూపాయలు"` as two word errors despite both meaning "120 rupees," and a dropped invisible joiner in `"జార్‌కి"` as another. Both numbers are reported; normalized is the more honest measure of real transcription quality, raw shows how much a naive WER computation would have overstated it.

**A real, non-artifact failure found by hand-inspection:** the acronym "MEPMA" (this platform's own government sponsor) spoken inside a Telugu sentence was transcribed as unrelated Telugu syllables — not a close phonetic miss, a completely different word. This matters concretely, since MEPMA and other scheme/program names will come up regularly once scheme-guidance conversations (a later task) are built. Normalization can't fix this; it's a genuine STT weakness worth tracking, not a punctuation-comparison artifact like the currency-formatting cases above.

## Transliteration (Roman/mixed-script → Telugu)

Not scored numerically (no reference test set for this — "correct" transliteration of colloquial romanization is inherently judgment-based). Spot-checked with real, deliberately messy input:

| Input                                                           | Output                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| `nenu mamidi pickle register cheyali, ధర 120 rupees`            | `నేను మామిడి పికల్ రెజిస్టర్ చేయాలి, ధర 120 రూపాయలు`               |
| `meeru elా unnaru`                                              | `మీరు ఎలా ఉన్నారు`                                                 |
| `nాకు oka kotha product add cheయాli, pేరు tomato pickle, ధర 80` | `నాకు ఒక కొత్త ప్రొడక్ట్ యాడ్ చేయాలి, పేరు టొమాటో పిక్కిల్, ధర 80` |

All three correctly normalized messy mixed-script/typo'd input into clean Telugu, including correctly transliterating English loanwords ("register" → "రెజిస్టర్", "product" → "ప్రొడక్ట్") rather than leaving them as-is or mistranslating them.

## Summary

| Deliverable           | Status                                                                                                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intent routing        | 88.2–94.1% across two runs on a small test set; real stochastic failure mode found and characterized, not yet hardened in production                                                                              |
| Entity extraction     | Implicit in tool-call arguments (`FunctionSchema` required fields) — not separately scored; every successful `register_product`/`check_product_price` call in the intent eval extracted the right name/unit/price |
| Slot-filling dialogue | Handled by Groq's tool-calling honoring `required` fields — not separately exercised with an incomplete-input test case in this pass                                                                              |
| Transliteration       | Working on spot-checked realistic input; no formal scored test set                                                                                                                                                |
| WER                   | Telugu 12.3%, English 16.9% (normalized) on a synthetic TTS→STT round trip only — a real acronym-misrecognition weakness found, not reflected in the aggregate number                                             |

Net: intent routing reaches T11's ≥90% target on one of two runs, and the gap is a characterized, understood cause (not a mystery) — but production has not yet been hardened against it. WER numbers are self-consistency checks on Sarvam's own STT/TTS pair, not a real-world accuracy claim.
