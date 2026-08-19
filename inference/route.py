import os
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent__lakshmi import run_guidance


app = FastAPI(title="Lakshmi SHG Guidance API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


class GuidanceRequest(BaseModel):
    question: str


class GuidanceResponse(BaseModel):
    element_id: Optional[str]
    override_code: str
    message: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/guidance", response_model=GuidanceResponse)
def get_guidance(payload: GuidanceRequest):

    question = payload.question.strip()

    if not question:
        raise HTTPException(
            status_code=400,
            detail="question must not be empty"
        )

    try:
        return run_guidance(question)

    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc)
        ) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "route:app",
        port=int(os.getenv("PORT", "8090")),
        reload=False
    )