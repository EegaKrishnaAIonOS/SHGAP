"""Runs the T15 training pipeline once, standalone — trains and registers
the demand (Prophet, per product) and price (pooled XGBoost) forecasting
models against whatever T14's feature pipeline last produced. Same
underlying function as `POST /market-intelligence/train-models` and the
scheduled weekly retraining job in app/main.py.

    python scripts/train_models.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.market_intelligence.training_pipeline import run_training_pipeline  # noqa: E402


async def main() -> None:
    result = await run_training_pipeline()
    print("Training pipeline run complete:")
    for key, value in result.items():
        print(f"  {key}: {value}")


if __name__ == "__main__":
    asyncio.run(main())
