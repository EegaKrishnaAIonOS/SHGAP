from fastapi import FastAPI

app = FastAPI(
    title="SHGAP ML Services",
    description="Categorization, forecasting, buyer recommendation, ranking & explainability.",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "ml-services"}
