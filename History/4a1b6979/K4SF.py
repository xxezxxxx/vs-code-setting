from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.sum import router as sum_router
from .api.multiply import router as multiply_router
from .api.users import router as users_router
from .api.echo import router as echo_router
from .api.mypage import router as mypage_router


def create_app() -> FastAPI:
    app = FastAPI(title="test02 API", version="0.1.0")

    # CORS for local dev (frontend on 5173)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(sum_router, prefix="/api")
    app.include_router(multiply_router, prefix="/api")
    app.include_router(users_router, prefix="/api")
    app.include_router(echo_router, prefix="/api")
    app.include_router(mypage_router, prefix="/api")

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()
