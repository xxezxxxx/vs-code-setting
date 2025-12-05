import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from backend.api import sum

# ----------------------------
# 앱 + 게이트 설정
# ----------------------------
app = FastAPI(title="Hold-Man API")
app.state.ready = False   # 기본 잠금

SECRET = os.getenv("BOOT_SECRET", "dev-secret")

# ----------------------------
# 미들웨어: 준비 신호 전까지 막기
# ----------------------------
@app.middleware("http")
async def gatekeeper(request: Request, call_next):
    path = request.url.path
    if path.startswith("/signal/") or path == "/health":
        return await call_next(request)

    if not app.state.ready:
        return JSONResponse({"detail": "Service not ready"}, status_code=503)

    return await call_next(request)

# ----------------------------
# 헬스체크 & 신호
# ----------------------------
@app.get("/health")
def health():
    return {"ok": True, "ready": app.state.ready}

@app.post("/signal/ready")
def set_ready(x_key: str):
    if x_key != SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")
    app.state.ready = True
    return {"ok": True, "ready": True}

# ----------------------------
# 라우터 등록
# ----------------------------
app.include_router(sum.router)