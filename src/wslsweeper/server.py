from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from wslsweeper.api.router import router


def create_app() -> FastAPI:
    app = FastAPI(title="wslsweeper", docs_url=None, redoc_url=None)

    app.include_router(router, prefix="/api")

    static_dir = Path(__file__).parent / "static"
    if static_dir.exists() and any(static_dir.iterdir()):
        app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="spa")

    return app
