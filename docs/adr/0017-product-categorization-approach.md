# ADR-0017: Zero-shot embedding-similarity categorization, multilingual sentence-transformer instead of IndicBERT

- **Status:** Accepted
- **Date:** 2026-07-17
- **Sprint:** Sprint 1 (T08)

## Context

T08 asks to "fine-tune/prompt IndicBERT on product name + description to predict the taxonomy category" and return top-3 suggestions with confidence, as a suggestion the SHG member can override during product creation (T07).

Two things ruled out the literal reading of that spec:

1. **No labeled training data exists.** The only product/category data in the system is the 22-node taxonomy seeded in T02 and 6 demo products (T06) — nowhere near enough to fine-tune a transformer classifier, and there's no user-correction signal yet to bootstrap one from (that only starts accumulating once T09's admin portal and real registrations are live).
2. **`ai4bharat/indic-bert` is gated on HuggingFace** (`gated: "auto"` — requires an authenticated, license-accepted HF account). This environment has no HF credentials, and getting one specifically for this task wasn't worth a stop to request when open alternatives exist.

## Decision

Build categorization as **zero-shot semantic similarity**, not a trained classifier: embed each of the 22 categories once (as `"{category name} ({parent name})"`, e.g. `"Pickles (Food Products)"`) using a multilingual sentence-embedding model, embed the incoming product's `name + description` the same way, and rank categories by cosine similarity (scikit-learn's `cosine_similarity`, per the sprint's own named tech stack). Return the top 3 as suggestions; the category picker built in T07 remains fully user-editable — this only prefills/highlights it.

Model: **`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`** (ungated, ~470MB, supports 50+ languages including Telugu) instead of IndicBERT. This is a "prompt" in the sense the task allows (using a pretrained model's existing representations with no further training), just not IndicBERT specifically.

Category embeddings are computed at ml-services startup from a **live read from the Postgres `categories` table** (ml-services connects directly to Postgres — this matches the container/data-flow diagrams from T01, which already show `mlPods -> pg`), not a hardcoded copy, so the taxonomy can change without redeploying code.

## Alternatives Considered

- **`l3cube-pune/indic-sentence-similarity-sbert`** — an actual Indic-specialized sentence-BERT (ungated), closer in spirit to "IndicBERT." Passed over for now purely on footprint (~950MB vs ~470MB) and the resulting Docker build/CI time, given this pilot's data is bilingual (Telugu/English) rather than needing broad Indic-language coverage; worth revisiting if categorization accuracy on real Telugu input proves weak in the pilot.
- **CLIP/ViT image classifier** — explicitly marked optional in the sprint plan. Deferred entirely for this task to keep scope focused on a well-verified text classifier; a follow-up could blend an image-similarity score using the same zero-shot pattern once this text path is validated with real usage.
- **Waiting for labeled data to fine-tune a real classifier** — the more "correct" long-term approach once enough product/category/correction history exists (a natural T14-era data-pipeline follow-up), but not viable for a 90-day POC that needs a working suggestion feature now.

## Consequences

- Positive: works immediately with zero training data; taxonomy changes need no redeploy; suggestion quality is inspectable (cosine scores are meaningful confidence proxies, not an opaque classifier's softmax).
- Trade-offs: zero-shot similarity is inherently less accurate than a properly fine-tuned classifier would eventually be — this is explicitly a stopgap, not a permanent design; ml-services now has a direct DB dependency (previously stateless), matching the intended architecture but adding a new failure mode (DB unreachable at startup) that the health check and category-embedding refresh logic need to handle gracefully.

## Verified Behavior (real model + real DB, post-implementation)

Ran real `/categorize` requests against the live 22-category taxonomy (not the fake embedder used in unit tests). English product names categorize well — "Mango Pickle" → Pickles (0.52), "Handwoven Bamboo Basket" → Bamboo Craft (0.82), "Cotton Saree with Zari border" → Cotton Sarees (0.90).

Telugu product names do **not** categorize well: a Telugu query for "mango pickle" (మామిడి ఊరగాయ) scored only 0.12-0.19 against every category and ranked unrelated categories (Handloom, Jute Products) above the correct one. A follow-up raw-similarity check confirmed why — this model's Telugu↔English cross-lingual alignment is real but weak (~0.34-0.40 for genuinely matching words) compared to same-language similarity (~0.75 for the same Telugu words against each other). The category taxonomy has no Telugu names to embed against (`categories` table is English-only, a T02 schema decision out of this task's scope), so a Telugu query is always compared against English-only category text.

Mitigation: added `MINIMUM_SUGGESTION_SCORE = 0.3` in `service.py` — suggestions scoring below this are dropped rather than shown, so a low-confidence/wrong Telugu suggestion becomes an empty suggestion list (prompting manual category selection) instead of a confidently-wrong prefill. This does not fix Telugu categorization; it only prevents it from actively misleading the SHG member, which the human-override design in T07's category picker already relies on regardless.

Real fix (out of scope for T08): add Telugu category names to the schema and embed `"{name} / {name_te}"` per category, or switch to `l3cube-pune/indic-sentence-similarity-sbert` (already flagged above as the Indic-specialized alternative). Worth revisiting once real pilot usage shows how often SHG members actually type product names in Telugu script versus English/Telugu-transliterated-in-Latin-script.

## Docker Build Verified

Built the real ml-services image (`docker build`) and ran it standalone against the live Postgres — `/health` and `/categorize` both work correctly on the very first request (Linux's default event loop has no equivalent to the Windows `ProactorEventLoop` issue documented above, so no `run.py`-style shim is needed there; `CMD` stays a plain `uvicorn app.main:app`).

Cold build time is real and worth flagging for CI: ~5 min installing `torch`+`sentence-transformers`+`transformers` (CPU wheel index keeps this from being worse), plus ~2.2 min for the model pre-fetch `RUN` step — roughly 8 minutes total before layer caching kicks in. Unrelated code-only changes (anything under `app/`) don't re-pay this, since `COPY requirements.txt` and the pip-install/model-prefetch layers sit above `COPY app` in the Dockerfile and cache accordingly. A `requirements.txt` change, however, invalidates and re-downloads everything — worth keeping in mind before adding further ML dependencies.

The first version of this Dockerfile placed the model-prefetch `RUN` _after_ `COPY app ./app`, which silently defeated its own caching intent — any app-code change would invalidate and re-run the ~2-minute model download for no reason, since Docker invalidates every layer after the first one that changes. Caught by rebuilding three times in a row: (1) a clean build, (2) a build after moving the `RUN` above `COPY app` — pip-install stayed cached, model re-downloaded once as expected since its layer position changed, (3) a build after a trivial one-line `app/` edit — this time the model layer stayed `CACHED` (0.7s total build), confirming the fix.
