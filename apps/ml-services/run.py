import asyncio
import sys

# Must run before uvicorn creates its event loop — by the time `uvicorn
# app.main:app` imports the app string, asyncio.run() has already created a
# ProactorEventLoop on Windows, too late for psycopg's async mode (see
# app/main.py). Not needed in Docker/Linux (prod, CI), where the default loop
# already works.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001)
