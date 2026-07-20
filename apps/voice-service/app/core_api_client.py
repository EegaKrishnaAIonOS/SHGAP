from typing import Any

import httpx

from app.config import settings


class CoreApiError(Exception):
    """Base for all core-api call failures — handlers catch this, not httpx's own exceptions."""


class CoreApiAuthError(CoreApiError):
    """The caller's access token is missing/expired (401) — nothing to retry, the
    voice session's token was only ever a snapshot of what the frontend held
    at connection time."""


class CoreApiRequestError(CoreApiError):
    """A 4xx other than 401 — the request itself was invalid (e.g. a validation error)."""


class CoreApiUnavailableError(CoreApiError):
    """core-api is unreachable or returned a 5xx."""


class CoreApiClient:
    """Thin async wrapper around the subset of core-api the voice assistant needs.

    Every call forwards the *caller's own* JWT access token (captured at
    WebRTC-connect time — see ADR-0019) as a plain Bearer header, so RBAC/
    ownership scoping is exactly what it already is for the web app: a
    voice call can only ever act on data that same user could reach via
    the website. No separate service-to-service credential exists.
    """

    def __init__(self, access_token: str, base_url: str | None = None):
        self._access_token = access_token
        self._base_url = base_url or settings.core_api_base_url

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._access_token}"}

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        url = f"{self._base_url}{path}"
        try:
            # 30s, not core-api's usual sub-second response time: the first
            # /categorization/suggest call after ml-services (re)starts loads
            # its embedding model lazily and has been observed taking ~25-30s
            # cold — every call after that is fast, since the model then
            # stays resident. A real (if bounded) voice-UX gap on that one
            # first call; see ADR-0019.
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.request(method, url, headers=self._headers(), **kwargs)
        except httpx.HTTPError as err:
            raise CoreApiUnavailableError(f"core-api unreachable: {err}") from err

        if response.status_code == 401:
            raise CoreApiAuthError("Access token missing or expired")
        if 400 <= response.status_code < 500:
            raise CoreApiRequestError(f"core-api rejected the request: {response.text}")
        if response.status_code >= 500:
            raise CoreApiUnavailableError(f"core-api returned {response.status_code}")

        return response.json() if response.content else None

    async def get_my_shg(self) -> dict[str, Any] | None:
        """A plain SHG member's `GET /shgs` is auto-scoped to their own group(s) —
        the first result is "my SHG", same convention the web app's
        `getMyShg()` helper uses."""
        result = await self._request("GET", "/shgs", params={"page": 1, "pageSize": 1})
        items = result.get("items", []) if result else []
        return items[0] if items else None

    async def suggest_category(
        self, name: str, description: str | None
    ) -> dict[str, Any] | None:
        """Reuses T08's categorization suggestion — the same one the web product
        form shows as a prefill. Returns the top suggestion, or None if
        nothing cleared the confidence floor (ADR-0017)."""
        suggestions = await self._request(
            "POST",
            "/categorization/suggest",
            json={"name": name, "description": description},
        )
        return suggestions[0] if suggestions else None

    async def create_product(
        self,
        *,
        shg_id: str,
        category_id: str,
        name: str,
        description: str | None,
        unit: str,
        price: float,
        moq: int | None = None,
        stock: int | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "shgId": shg_id,
            "categoryId": category_id,
            "name": name,
            "unit": unit,
            "price": price,
        }
        if description:
            payload["description"] = description
        if moq is not None:
            payload["moq"] = moq
        if stock is not None:
            payload["stock"] = stock
        return await self._request("POST", "/products", json=payload)

    async def search_my_products(self, search: str) -> list[dict[str, Any]]:
        """A plain SHG member's `GET /products` is auto-scoped to their own
        listings — same convention as `get_my_shg`."""
        result = await self._request(
            "GET", "/products", params={"page": 1, "pageSize": 5, "search": search}
        )
        return result.get("items", []) if result else []
