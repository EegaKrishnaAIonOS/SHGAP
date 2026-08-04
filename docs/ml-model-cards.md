# ML model cards

Five real models/pipelines run in `apps/ml-services`. Each card below states what the model actually is, what data it actually trains on, what was actually measured, and — as important — what hasn't been validated yet. See the linked ADR for the full design rationale; this page is the evaluation/limitations summary a reviewer or auditor would want without reading source code.

---

## 1. Product categorization

- **What it is:** Zero-shot semantic similarity — embeds a product's name+description and every category name with the same sentence-transformer, then ranks categories by cosine similarity. Not a trained classifier; there is no labeled training set for this platform's actual product/category pairs to train one on.
- **Model:** `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384-dim, multilingual — handles Telugu and English input without a separate model per language).
- **Code:** `apps/ml-services/app/categorization/`. **Decision record:** ADR-0017.
- **Training data:** None — this is inference-only against a pre-trained public model. The "training set," if any, is the live `Category` taxonomy itself (re-embedded on a TTL cache, `category_cache_ttl_seconds`).
- **Evaluation:** Not formally scored (no labeled ground truth exists to score against). Spot-checked during T08 against real category names. Cross-lingual queries (Telugu product name against the English-only taxonomy) score measurably lower (~0.5-0.9 for same-language matches, noticeably lower cross-lingual) — this is real embedding-space behavior, not a bug, and is why low scores are treated as "no confident match," not surfaced as false precision.
- **Known limitations:** No confidence calibration beyond a raw cosine score; a genuinely novel product with no close taxonomy match will still return _something_ (top-3 nearest categories) rather than an honest "none of these fit" — the caller (a human registering a product) is the actual judgment backstop, not this model.

---

## 2. Demand forecasting

- **What it is:** One Prophet time-series model **per product × district** combination with enough sales history — not one global model. Real regressors: seasonality, festival-calendar windows (`FestivalCalendar` rows), H3-cell-binned regional demand signal.
- **Model:** Facebook Prophet, `yearly_seasonality=False, weekly_seasonality=True` (yearly seasonality needs more history than a 90-day pilot's real sales data has accumulated — turning it on now would fit noise).
- **Code:** `apps/ml-services/app/market_intelligence/demand_model.py`. **Decision records:** ADR-0008 (stack choice), ADR-0024 (per-product-district granularity, Darts dropped).
- **Training data:** Real `Sale` rows, backfilled with **synthetic seed sales** where real transaction history doesn't exist yet (T14/ADR-0023) — a 90-day-old pilot platform has too little organic sales volume to train anything without this. The synthetic component is explicitly flagged in the feature pipeline's own output, not silently blended in as if it were real.
- **Evaluation:** Backtested per product-district series with a **7-row minimum** for both the train and test split (`len(test_df) < 7 or len(train_df) < 7` skips training rather than fitting on too little data) — a hand-written backtest, not Darts' built-in one (ADR-0024 explains why Darts was dropped).
- **Known limitations:** Any series without 7+ real-or-seeded rows on each side of the split has no model at all — reported as "insufficient data," never silently backed by a global fallback that would misrepresent a specific product-district's real demand shape. Accuracy has not been validated against real (non-seeded) sales at any real production scale — there isn't yet enough real transaction volume to do that meaningfully.

---

## 3. Price forecasting

- **What it is:** **One pooled model across all commodities**, not one per commodity — deliberately different from demand forecasting's per-product-district granularity, because Agmarknet's real price-feed volume per individual commodity is too sparse to train a separate model each, but pooling with commodity as a categorical feature gives XGBoost enough real rows to learn from.
- **Model:** XGBoost (`XGBRegressor`), trained then re-fit on the full dataset once validated (`model` for validation, `final_model` for production use).
- **Code:** `apps/ml-services/app/market_intelligence/price_model.py`. **Decision record:** ADR-0024.
- **Training data:** Real Agmarknet market-price feed ingestion (T14/ADR-0023) — modal price, price range, arrival date, commodity, market. Requires `settings.min_price_training_rows` real rows to train at all; below that, training is skipped honestly rather than fit on too little data.
- **Evaluation:** Held-out split, minimum 5 rows train/test (`len(train_df) < 5 or len(test_df) < 5` skips training) — smaller minimum than demand forecasting's 7, since price data pools across all commodities rather than being split per-series.
- **Known limitations:** A pooled model can't capture a specific commodity's own idiosyncratic price dynamics as well as a dedicated per-commodity model could — an explicit trade-off for real trainability at this pilot's real data volume, not an oversight.

---

## 4. Buyer matching / recommendation ranking

- **What it is:** A **real, individually-inspectable heuristic score** today; a trained LightGBM re-ranker only once real accept/reject feedback exists to train it on (currently zero — no ranker has ever trained in this pilot).
- **Heuristic weights** (`MatchComponents.weighted_score()`): `0.45 × content_similarity + 0.30 × category_interest + 0.15 × price_band_fit + 0.10 × geo_proximity`. Content similarity gets the largest weight because it's the one signal that's always real and always available (an embedding always exists for a real product/buyer); geo gets the smallest weight because a `GOVERNMENT_PROCUREMENT` buyer is often state-level with no district at all and shouldn't be penalized for that (missing geo defaults to a neutral 0.5, not zero).
- **Ranker gate:** `MIN_FEEDBACK_ROWS_FOR_RANKER = 30` (real accept/reject `Recommendation` rows) — below this, a LightGBM model would be memorizing noise from a handful of labels, not learning a real preference signal, so the heuristic score is used directly and no ranker trains at all. **This gate has never yet been crossed in this pilot** — every recommendation shown to date is heuristic-scored, not ranker-scored.
- **Explainability:** Each of the four weighted components is a real, separately computed number (not a black box), and backs the human-readable reasons in `matching/explanations.py` — template-based today; SHAP-based explanations (ADR-0009's original plan) activate automatically once a ranker actually exists to explain, and were correctly not built for a model that doesn't exist yet.
- **Code:** `apps/ml-services/app/matching/`. **Decision record:** ADR-0026.
- **Known limitations:** The heuristic weights (0.45/0.30/0.15/0.10) are a reasoned starting point, explicitly not learned from data — validating or re-tuning them against real buyer behavior is real follow-up work, gated behind this pilot actually accumulating 30+ real feedback rows.

---

## 5. Scheme guidance (RAG retrieval)

- **What it is:** Retrieval only — embeds a query, cosine-similarity search against `SchemeChunk` (pgvector), filters below a relevance floor, returns ranked chunks with real source citations. **No LLM call happens in ml-services for this** — `voice-service`'s own Groq call (already driving the conversation) does the actual answer generation, grounded in whatever chunks this returns.
- **Model:** Same `paraphrase-multilingual-MiniLM-L12-v2` embedding model as categorization/matching — one embedding model total across this whole platform, not a separate one per feature.
- **Relevance floor:** `MINIMUM_RELEVANCE_SCORE = 0.3` — chunks scoring below this are dropped rather than returned as low-confidence context, so a question about a scheme outside the six curated ones gets an honest "no match," not a confident-sounding non-answer stitched from irrelevant chunks.
- **Content:** Six real, hand-curated AP/MEPMA SHG credit schemes (DAY-NULM, Vaddi Leni Runaalu, PM SVANidhi, SthreeNidhi, PM Mudra Yojana, MEPMA's 2025-26 action plan) with real source URLs — `apps/ml-services/app/scheme_guidance/content.py`. Not a general document store; questions outside this set are correctly declined, not hallucinated.
- **Code:** `apps/ml-services/app/scheme_guidance/`. **Decision records:** ADR-0010 (LLM+RAG approach), ADR-0021 (retrieval/generation split between ml-services and voice-service).
- **Known limitations:** Small, non-exhaustive corpus by design — a real statewide rollout would need this curated set to grow considerably past six schemes, which is straightforward (more `SchemeChunk` rows) but hasn't been done for this pilot's scope. Retrieval quality is sensitive to how a question is phrased (ADR-0021's own finding) — a generic "What loans are available?" scores lower than a scheme-name-specific phrasing.
