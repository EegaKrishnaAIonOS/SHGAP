from typing import Any

import httpx

from app.config import settings


class MlServicesError(Exception):
    """ml-services is unreachable or returned an error response."""


class MlServicesClient:
    """Thin async wrapper around ml-services' scheme-guidance search (T12).

    Unlike `CoreApiClient`, this forwards no access token: scheme content is
    public government information, not scoped to any one member, so there is
    nothing to authorize against (see ADR-0021).
    """

    def __init__(self, base_url: str | None = None):
        self._base_url = base_url or settings.ml_services_base_url

    async def search_schemes(self, query: str, top_k: int = 3) -> list[dict[str, Any]]:
        url = f"{self._base_url}/scheme-guidance/search"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json={"query": query, "top_k": top_k})
        except httpx.HTTPError as err:
            raise MlServicesError(f"ml-services unreachable: {err}") from err

        if response.status_code >= 400:
            raise MlServicesError(f"ml-services returned {response.status_code}: {response.text}")

        return response.json().get("results", [])
