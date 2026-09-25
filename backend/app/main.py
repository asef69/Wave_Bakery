"""WaveKitchen API — application entry point."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .database import SessionLocal, init_db
from .dsp import core as C
from .routers import catalogue, dsp, leaderboard, players, sessions
from .seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        seed(db)              # idempotent: only inserts what is missing
    finally:
        db.close()
    yield


app = FastAPI(
    title=config.APP_NAME,
    version=config.APP_VERSION,
    description=(
        'Backend for WaveKitchen, a signal processing cooking game. '
        'The server owns the DSP: it generates and contaminates ingredients, '
        'rebuilds the player\'s filter chain from its specification, re-runs the '
        'full pipeline and computes every score, so results cannot be forged '
        'client-side.'),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(players.router, prefix=config.API_PREFIX)
app.include_router(catalogue.router, prefix=config.API_PREFIX)
app.include_router(sessions.router, prefix=config.API_PREFIX)
app.include_router(leaderboard.router, prefix=config.API_PREFIX)
app.include_router(dsp.router, prefix=config.API_PREFIX)


def spa_file(dist_root, full_path: str):
    """
    The file to serve for a client path: a real file inside dist, else
    index.html (client-side routing). The path is resolved and must stay
    inside dist — without that, '/..%2F..%2Fbackend%2Fwavekitchen.db'
    served any file the server could read.
    """
    candidate = (dist_root / full_path).resolve()
    if full_path and candidate.is_relative_to(dist_root) and candidate.is_file():
        return candidate
    return dist_root / 'index.html'


def _mount_frontend() -> None:
    """
    In production the built React bundle is served by the same origin as the
    API, so there is no CORS surface at all. In development Vite serves the
    client on :5173 and proxies /api here instead.
    """
    from pathlib import Path

    from fastapi.responses import FileResponse
    from fastapi.staticfiles import StaticFiles

    dist = Path(__file__).resolve().parent.parent.parent / 'frontend' / 'dist'
    if not dist.is_dir():
        return

    app.mount('/assets', StaticFiles(directory=dist / 'assets'), name='assets')

    dist_root = dist.resolve()

    @app.get('/{full_path:path}', include_in_schema=False)
    def spa(full_path: str):
        return FileResponse(spa_file(dist_root, full_path))


@app.get('/api/health', tags=['meta'])
def health():
    return {
        'status': 'ok',
        'version': config.APP_VERSION,
        'sample_rate': C.SR,
        'frame': C.FRAME,
    }


_mount_frontend()   # must be last: the catch-all route swallows everything
