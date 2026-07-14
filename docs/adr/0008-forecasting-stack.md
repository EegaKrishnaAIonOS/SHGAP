# ADR-0008: Prophet / XGBoost / Darts for demand & price forecasting

- **Status:** Accepted
- **Date:** 2026-07-14
- **Sprint:** Sprint 0 (T01)

## Context
Module 3 (AI Market Intelligence) must forecast demand and price per product x district with strong seasonality and festival effects, and identify demand hotspots — within a pilot dataset that will be sparse for many product/district pairs.

## Decision
Use Prophet for interpretable per-series seasonality/festival-regressor forecasting as the default, XGBoost for series with enough history/features to benefit from gradient boosting, and the Darts library to standardize backtesting/evaluation across both.

## Alternatives Considered
- **Deep learning forecasters (LSTM/Temporal Fusion Transformer)** — can outperform with enough data, but pilot-scale, sparse per-product/district series make classical models both more robust and faster to ship in a 1-week sprint (T15).
- **Simple moving-average/naive baselines only** — fast but too weak to demonstrate "AI market intelligence" credibly for POC evaluation criteria (AI Accuracy is 20% of the evaluation weight).

## Consequences
- Positive: Prophet's explicit seasonality/holiday-regressor support maps directly onto the festival-calendar requirement; XGBoost adds accuracy where enough features exist; Darts gives one consistent backtesting harness for both.
- Trade-offs: multiple model types add operational complexity (model registry, retraining cadence) versus a single-algorithm approach — mitigated by keeping the feature pipeline (T14) shared across both.
