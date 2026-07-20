from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.services.llm_service import FunctionCallParams

from app.core_api_client import CoreApiAuthError, CoreApiClient, CoreApiError
from app.session import SessionStore, VoiceSession

SESSION_EXPIRED_RESULT = {
    "error": "session_expired",
    "message": "The member's session has expired. Tell them to refresh the app and try again.",
}


def build_tools(session: VoiceSession, session_store: SessionStore) -> list[FunctionSchema]:
    """Builds this call's tool set — closes over `session`/`session_store` so
    each handler acts on the one SHG member on this call, using their own
    forwarded access token (see ADR-0019). `session` is the same object the
    rest of the pipeline holds, so a `shg_id` resolved here is visible to
    later calls in the same conversation without re-fetching it.
    """
    client = CoreApiClient(access_token=session.access_token)

    async def _resolve_shg_id() -> str | None:
        if session.shg_id:
            return session.shg_id
        shg = await client.get_my_shg()
        if not shg:
            return None
        session.shg_id = shg["id"]
        await session_store.set_shg_id(session.session_id, shg["id"])
        return shg["id"]

    async def register_product(params: FunctionCallParams) -> None:
        try:
            shg_id = await _resolve_shg_id()
            if not shg_id:
                await params.result_callback(
                    {
                        "error": "no_shg_registered",
                        "message": "This member has no registered SHG yet — they need to "
                        "register their SHG in the app before adding products.",
                    }
                )
                return

            name = params.arguments["name"]
            description = params.arguments.get("description")

            # Reuses T08's category-suggestion endpoint — the same one the web
            # product form shows as a prefill. If nothing clears the confidence
            # floor (ADR-0017), we don't guess a category by voice either.
            suggestion = await client.suggest_category(name, description)
            if suggestion is None:
                await params.result_callback(
                    {
                        "error": "no_category_match",
                        "message": "Couldn't confidently determine a category for this "
                        "product. Tell the member to add it from the app instead, where "
                        "they can pick a category manually.",
                    }
                )
                return

            product = await client.create_product(
                shg_id=shg_id,
                category_id=suggestion["categoryId"],
                name=name,
                description=description,
                unit=params.arguments["unit"],
                price=params.arguments["price"],
                moq=params.arguments.get("moq"),
                stock=params.arguments.get("stock"),
            )
            await params.result_callback(
                {
                    "status": "created",
                    "product_name": product["name"],
                    "category_name": suggestion["categoryName"],
                }
            )
        except CoreApiAuthError:
            await params.result_callback(SESSION_EXPIRED_RESULT)
        except CoreApiError as err:
            await params.result_callback({"error": "core_api_error", "message": str(err)})

    async def check_product_price(params: FunctionCallParams) -> None:
        try:
            matches = await client.search_my_products(params.arguments["name"])
            if not matches:
                await params.result_callback({"status": "not_found"})
                return
            await params.result_callback(
                {
                    "status": "found",
                    "products": [
                        {
                            "name": p["name"],
                            "price": p["price"],
                            "stock": p["stock"],
                            "isAvailable": p["isAvailable"],
                        }
                        for p in matches
                    ],
                }
            )
        except CoreApiAuthError:
            await params.result_callback(SESSION_EXPIRED_RESULT)
        except CoreApiError as err:
            await params.result_callback({"error": "core_api_error", "message": str(err)})

    return [
        FunctionSchema(
            name="register_product",
            description=(
                "Register a new product for the member's own SHG, based on what "
                "they describe out loud. The product's category is determined "
                "automatically — do not ask the member to choose one."
            ),
            properties={
                "name": {"type": "string", "description": "Product name, e.g. 'Mango Pickle'"},
                "description": {
                    "type": "string",
                    "description": "Optional short description, if the member gave one",
                },
                "unit": {
                    "type": "string",
                    "description": "Unit of sale, e.g. 'kg', 'jar', 'piece', 'dozen'",
                },
                "price": {"type": "number", "description": "Price per unit, in rupees"},
                "moq": {
                    "type": "integer",
                    "description": "Minimum order quantity, only if the member mentioned one",
                },
                "stock": {
                    "type": "integer",
                    "description": "Stock currently on hand, only if the member mentioned it",
                },
            },
            required=["name", "unit", "price"],
            handler=register_product,
        ),
        FunctionSchema(
            name="check_product_price",
            description=(
                "Look up the price and stock of one of the member's own already-listed "
                "products by name. Only searches this member's own products — cannot "
                "look up other SHGs' prices or general market prices."
            ),
            properties={
                "name": {
                    "type": "string",
                    "description": "Product name or partial name to search for",
                },
            },
            required=["name"],
            handler=check_product_price,
        ),
    ]
