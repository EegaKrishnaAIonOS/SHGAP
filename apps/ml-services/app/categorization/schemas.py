from pydantic import BaseModel, Field


class CategorizeRequest(BaseModel):
    name: str = Field(..., min_length=1, description="Product name")
    description: str | None = Field(default=None, description="Product description, if any")


class CategorySuggestion(BaseModel):
    category_id: str
    category_name: str
    parent_category_name: str | None
    # Cosine similarity, 0-1 — a confidence proxy, not a calibrated probability.
    score: float = Field(..., ge=0, le=1)


class CategorizeResponse(BaseModel):
    suggestions: list[CategorySuggestion]
