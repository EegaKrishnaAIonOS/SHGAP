"""Runs the T14 market-intelligence feature pipeline once, standalone —
useful for a real OS-level cron entry, or for manually refreshing features
without the FastAPI process's own APScheduler job. Does the same work as
`POST /market-intelligence/refresh-features` and the scheduled job in
app/main.py — all three call `run_feature_pipeline()` directly.

    python scripts/run_feature_pipeline.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.market_intelligence.pipeline import run_feature_pipeline  # noqa: E402


async def main() -> None:
    manifest = await run_feature_pipeline()
    print("Feature pipeline run complete:")
    for key, value in manifest.items():
        print(f"  {key}: {value}")


if __name__ == "__main__":
    asyncio.run(main())
