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

import psycopg  # noqa: E402
from apscheduler.schedulers.asyncio import AsyncIOScheduler  # noqa: E402
from apscheduler.triggers.interval import IntervalTrigger  # noqa: E402
from fastapi import FastAPI, HTTPException  # noqa: E402
from prometheus_fastapi_instrumentator import Instrumentator  # noqa: E402

from app.categorization.router import router as categorization_router  # noqa: E402
from app.config import settings  # noqa: E402
from app.market_intelligence.forecast_router import router as forecast_router  # noqa: E402
from app.market_intelligence.pipeline import run_feature_pipeline  # noqa: E402
from app.market_intelligence.router import router as market_intelligence_router  # noqa: E402
from app.market_intelligence.training_pipeline import run_training_pipeline  # noqa: E402
from app.matching import ranking  # noqa: E402
from app.matching.repository import fetch_recommendation_feedback  # noqa: E402
from app.matching.router import router as matching_router  # noqa: E402
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

    # T15 model training — a much longer interval than the feature refresh
    # since retraining is more expensive and models don't meaningfully
    # change day-to-day the way raw features do; see ADR-0024.
    async def scheduled_training_run() -> None:
        try:
            await run_training_pipeline()
            logger.info("Scheduled model training run completed")
        except Exception as err:  # noqa: BLE001 - a scheduled job must never crash the scheduler
            logger.error(f"Scheduled model training run failed: {err}")

    scheduler.add_job(
        scheduled_training_run,
        trigger=IntervalTrigger(hours=settings.training_pipeline_interval_hours),
        id="model_training",
    )

    # T17 matching ranker — same cadence as model_training; declines to
    # train (logs and returns) below settings.min_feedback_rows_for_ranker,
    # same honest-threshold pattern as demand/price models. See ADR-0026.
    async def scheduled_ranker_training_run() -> None:
        try:
            feedback = await fetch_recommendation_feedback()
            ranking.train(feedback)
            logger.info("Scheduled matching ranker training run completed")
        except Exception as err:  # noqa: BLE001 - a scheduled job must never crash the scheduler
            logger.error(f"Scheduled matching ranker training run failed: {err}")

    scheduler.add_job(
        scheduled_ranker_training_run,
        trigger=IntervalTrigger(hours=settings.training_pipeline_interval_hours),
        id="matching_ranker_training",
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
app.include_router(forecast_router)
app.include_router(matching_router)

# T24/ADR-0033: real Prometheus instrumentation (ADR-0014 named the stack,
# deferred building it to T24) — request latency/count by method/handler/
# status, plus Python/process defaults, exposed at GET /metrics.
Instrumentator().instrument(app).expose(app, include_in_schema=False)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "ml-services"}


@app.get("/health/ready")
async def ready() -> dict:
    """T24/ADR-0033: a real readiness check against Postgres — this
    service's hard dependency for scheme-guidance RAG lookups, feature/
    training pipeline reads, and matching candidate queries. See
    core-api's identical liveness/readiness split rationale."""
    checks = {"database": False}
    try:
        async with await psycopg.AsyncConnection.connect(settings.database_url) as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT 1")
        checks["database"] = True
    except Exception:  # noqa: BLE001 - any DB failure means "not ready", not a 500
        pass

    if not all(checks.values()):
        raise HTTPException(status_code=503, detail={"status": "not_ready", "checks": checks})
    return {"status": "ok", "checks": checks}
