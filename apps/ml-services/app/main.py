import asyncio
import sys

# psycopg's async mode cannot run on Windows' default ProactorEventLoop
# (raises psycopg.InterfaceError at connect time) — must switch to the
# selector loop before uvicorn or anything else creates an event loop.
# Linux/Docker (prod, CI) already default to a compatible loop, so this
# is a no-op there.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI  # noqa: E402

from app.categorization.router import router as categorization_router  # noqa: E402
from app.scheme_guidance.router import router as scheme_guidance_router  # noqa: E402

app = FastAPI(
    title="SHGAP ML Services",
    description="Categorization, forecasting, buyer recommendation, ranking & explainability.",
    version="0.1.0",
)

app.include_router(categorization_router)
app.include_router(scheme_guidance_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "ml-services"}
