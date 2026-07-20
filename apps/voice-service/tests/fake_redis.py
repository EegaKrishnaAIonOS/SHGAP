class FakeRedis:
    """Minimal in-memory stand-in for `redis.asyncio.Redis` — only the
    get/set/delete surface `SessionStore` actually calls."""

    def __init__(self):
        self.store: dict[str, str] = {}

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        self.store[key] = value

    async def delete(self, key: str) -> None:
        self.store.pop(key, None)
