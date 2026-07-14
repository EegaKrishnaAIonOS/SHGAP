# ADR-0007: IndicBERT / IndicNLP / spaCy for Telugu intent & entity extraction

- **Status:** Accepted
- **Date:** 2026-07-14
- **Sprint:** Sprint 0 (T01)

## Context
Beyond raw speech-to-text, the assistant must understand intent (registration, market enquiry, price enquiry, buyer search, scheme guidance) and extract entities (product, quantity, place, price) from Telugu/English text, then transliterate/normalize Roman-Telugu input.

## Decision
Fine-tune IndicBERT for intent classification, use AI4Bharat IndicNLP + spaCy for entity extraction and text normalization, and indic-trans for transliteration, evaluated with jiwer (WER) and standard intent-F1 metrics against a Telugu test set.

## Alternatives Considered
- **General multilingual BERT (mBERT/XLM-R)** — broader language coverage not needed here; IndicBERT is pre-trained specifically on Indian languages and should out-perform on Telugu with less fine-tuning data.
- **Rule-based/keyword intent matching** — simpler and faster to build, but too brittle for natural spoken Telugu phrasing and would not scale to the 5 required intents plus fallback handling.
- **LLM-only intent detection** (prompt-based) — flexible, but higher latency/cost per turn and harder to guarantee the ≥90% recognition target; used instead for the open-ended scheme-guidance RAG case (ADR-0010), not for structured intents.

## Consequences
- Positive: purpose-fit for Telugu, supports iterative fine-tuning against real pilot data collected in Sprint 2, keeps hard intents fast/cheap (small model) vs. open-ended Q&A (LLM).
- Trade-offs: requires labeled Telugu training/eval data and model fine-tuning time within Sprint 2's one-week window — scoped tightly in T11.
