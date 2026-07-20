# ADR-0020: NLU/dialogue — LLM tool-calling instead of a fine-tuned IndicBERT pipeline, LLM-based transliteration instead of IndicXlit

- **Status:** Accepted
- **Date:** 2026-07-20
- **Sprint:** Sprint 2 (T11)

## Context

T11 asks for a classical NLU stack: fine-tune IndicBERT as an intent classifier (product registration, market enquiry, price enquiry, buyer search, scheme guidance), a separate entity extractor (IndicNLP/spaCy) for product/quantity/place/price, Roman↔Telugu transliteration, a hand-built slot-filling dialogue manager, and an evaluation report (WER, intent F1) tuned until recognition reaches ≥90%.

This runs into the same wall ADR-0017 (T08) already hit: no labeled intent/entity training data exists for this platform's actual domain, and ml-services is CPU-only by design (no fine-tuning infrastructure). Meanwhile, T10 already built a working Groq LLM + tool-calling pipeline that does intent recognition, entity extraction, and slot-filling implicitly — verified end-to-end with real Telugu audio before this task started.

## Decision

**T10's LLM tool-calling is treated as already fulfilling T11's intent/entity/dialogue goal** — not literally re-implemented as a separate fine-tuned-classifier pipeline. `FunctionSchema`'s `required` fields already drive slot-filling (Groq's tool-calling asks for missing required arguments rather than guessing), and the system prompt already declines out-of-scope intents (market/buyer/scheme questions) rather than routing them anywhere. Building a second, parallel classical NLU stack next to a working LLM-based one would duplicate effort for no functional gain this POC can actually use, and — absent real labeled data — "fine-tune IndicBERT" would mean fine-tuning on synthetic, self-generated examples, which teaches the model to recognize _the developer's own guesses at how members would speak_, not real usage patterns. That's not meaningfully more trustworthy than evaluating the LLM's zero-shot behavior directly, which is what this task does instead.

**Transliteration is LLM-based (Groq), not `ai4bharat-transliteration` (IndicXlit).** IndicXlit depends on `fairseq`, a Facebook/Meta seq2seq library with a long-documented history of dependency and compatibility breakage on modern Python (it's effectively unmaintained relative to current tooling). Given the LLM already in use for T10 handles Telugu well, it was tested directly on messy, realistic Romanized/mixed-script input before committing to this — see the eval report — and handles it correctly, including correctly transliterating English loanwords (e.g. "register" → "రెజిస్టర్") rather than leaving them untouched or mistranslating them.

**Evaluation targets the actual built system, not a hypothetical one.** `eval/run_intent_eval.py` measures intent-routing accuracy using the real `app.actions.build_tools` schemas and the real system prompt from `app.bot` against a small labeled test set (`eval/test_utterances.py`); `eval/run_stt_wer_eval.py` measures STT word-error-rate via a real Sarvam TTS→STT round trip on the same utterances, using `jiwer` (T11's own named tool). Both are standalone scripts run manually against real APIs, not part of the CI test suite (they cost money and time on every run, and their point is a one-time/occasional quality snapshot, not a build gate).

## Alternatives Considered

- **Literally fine-tuning IndicBERT** — rejected for the same reason ADR-0017 rejected fine-tuning generally: no real labeled data, and ml-services has no GPU/fine-tuning infrastructure (a deliberate choice, not an oversight).
- **`ai4bharat-transliteration` (IndicXlit)** — rejected specifically for its `fairseq` dependency; verified the LLM-based alternative works correctly on real mixed-script input before deciding, rather than assuming.
- **A hand-built slot-filling dialogue manager** — the sprint plan's literal ask. Rejected because `FunctionSchema.required` plus a capable tool-calling LLM already produces this behavior; hand-rolling a state machine to replace something that already works would be pure duplication.

## Consequences

- Positive: no new heavy/fragile dependency; evaluation numbers describe the actual production system, not a proxy; transliteration handles genuinely messy real-world input (verified, not assumed) with zero additional infrastructure.
- Trade-offs / real findings from the evaluation (see `docs/eval/T11-nlu-eval.md` for full numbers):
  - **Groq's tool-calling occasionally returns a malformed function call** (a `tool_use_failed` 400 from Groq's own API) for some Telugu-heavy `register_product` inputs — confirmed stochastic, not deterministic (five repeated calls on an identical failing input succeeded every time). A retry-once policy meaningfully improves practical reliability (measured 88.2% → 94.1% intent accuracy across two runs) but **is not yet implemented in the production pipeline** (`app/bot.py` uses Pipecat's `GroqLLMService` as-is) — flagged here as a real follow-up, not silently left undone.
  - **Sarvam STT can badly misrecognize English acronyms/proper nouns spoken inside a Telugu sentence** — "MEPMA" was transcribed as unrelated Telugu syllables in testing. This matters concretely: MEPMA is the platform's own government sponsor's name, and scheme-guidance conversations (a later task) will very likely involve it.
  - **Raw word-error-rate overstates real error** for Telugu STT output — a STT engine choosing "₹120" over "120 రూపాయలు", or dropping an invisible Unicode joiner character in a Telugu conjunct, both count as full word errors under plain `jiwer.wer()` despite carrying identical meaning. Reported both raw and normalized WER rather than picking whichever number looked better.
