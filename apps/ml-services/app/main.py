import asyncio
import sys

# psycopg's async mode cannot run on Windows' default ProactorEventLoop
# (raises psycopg.InterfaceError at connect time) — must switch to the
# selector loop before uvicorn or anything else creates an event loop.
# Linux/Docker (prod, CI) already default to a compatible loop, so this
# is a no-op there.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import logging  # noqa: E402
from contextlib import asynccontextmanager  # noqa: E402

from apscheduler.schedulers.asyncio import AsyncIOScheduler  # noqa: E402
from apscheduler.triggers.interval import IntervalTrigger  # noqa: E402
from fastapi import FastAPI  # noqa: E402

from app.categorization.router import router as categorization_router  # noqa: E402
from app.config import settings  # noqa: E402
from app.market_intelligence.pipeline import run_feature_pipeline  # noqa: E402
from app.market_intelligence.router import router as market_intelligence_router  # noqa: E402
from app.scheme_guidance.router import router as scheme_guidance_router  # noqa: E402

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # "cron/Airflow-lite" (T14) — a lightweight in-process scheduler rather
    # than standing up real Airflow infrastructure for a 90-day pilot; see
    # ADR-0023. Runs the same function POST /market-intelligence/refresh
    # -features calls manually, so there's exactly one code path either way.
    async def scheduled_run() -> None:
        try:
            await run_feature_pipeline()
            logger.info("Scheduled feature pipeline run completed")
        except Exception as err:  # noqa: BLE001 - a scheduled job must never crash the scheduler
            logger.error(f"Scheduled feature pipeline run failed: {err}")

    # IntervalTrigger's default start_date is "now", so the first automatic
    # run fires one interval after startup, not immediately — a fresh boot
    # gets its first feature table from the manual endpoint/script instead.
    scheduler.add_job(
        scheduled_run,
        trigger=IntervalTrigger(hours=settings.feature_pipeline_interval_hours),
        id="feature_pipeline",
    )
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(
    title="SHGAP ML Services",
    description="Categorization, forecasting, buyer recommendation, ranking & explainability.",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(categorization_router)
app.include_router(scheme_guidance_router)
app.include_router(market_intelligence_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "ml-services"}
