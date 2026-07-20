from pydantic import BaseModel, Field


class SchemeSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, description="The SHG member's scheme-guidance question")
    top_k: int = Field(default=3, ge=1, le=10)


class SchemeSearchResult(BaseModel):
    scheme_name: str
    content: str
    source_url: str
    source_title: str
    # Cosine similarity, 0-1 — a relevance proxy, not a calibrated probability.
    score: float = Field(..., ge=0, le=1)


class SchemeSearchResponse(BaseModel):
    results: list[SchemeSearchResult]
