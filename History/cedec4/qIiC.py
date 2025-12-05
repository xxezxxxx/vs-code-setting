"""
FastAPI 메인 (단일 프로세스용, Redis 제거 버전)
- Streamlit이 /signal/ready 호출하면 해당 user_id의 게이트가 '지금부터 10분' 열림
- 다시 호출하면 '지금부터 10분'으로 리셋 (항상 최대 10분)
- user_id는 반드시 전달해야 함 (헤더 X-User-ID 또는 쿼리 user_id)
- 멀티 워커 / 멀티 서버에서는 동기화 안 됨 (개발/단일 서버 테스트용)
"""

from __future__ import annotations
import os
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict

from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.responses import JSONResponse

# 라우터 (예: /sum)
from backend.api import sum

# ------------------------------------------------------------------------------
# 환경 변수 / 상수
# ------------------------------------------------------------------------------
BOOT_SECRET = os.getenv("BOOT_SECRET", "dev-secret")
READY_TTL_SEC = int(os.getenv("READY_TTL_SEC", "600"))  # 최대 10분(600초)
ALLOW_HEALTH_PATHS = {"/health"}
ALLOW_SIGNAL_PREFIX = "/signal/"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("gate")

# ------------------------------------------------------------------------------
# 앱 & in-memory 상태
# ------------------------------------------------------------------------------
app = FastAPI(
    title="Hold-Man API (in-memory gate)",
    description="Per-user 10-minute gating (single worker only)",
    version="0.1.0",
)

# user_id -> 만료시각
_user_ready: Dict[str, datetime] = {}


def _now() -> datetime:
    return datetime.utcnow()


def get_user_id(request: Request) -> Optional[str]:
    """유저 식별: 헤더 X-User-ID > 쿼리 user_id"""
    uid = request.headers.get("X-User-ID")
    if uid and uid.strip():
        return uid.strip()
    q = request.query_params.get("user_id")
    if q and q.strip():
        return q.strip()
    return None


def set_user_ready(user_id: str) -> int:
    """지금부터 TTL초 동안 게이트 열기 (리셋)"""
    expires = _now() + timedelta(seconds=READY_TTL_SEC)
    _user_ready[user_id] = expires
    return READY_TTL_SEC


def is_user_ready(user_id: str) -> bool:
    exp = _user_ready.get(user_id)
    return bool(exp and exp > _now())


# ------------------------------------------------------------------------------
# 미들웨어
# ------------------------------------------------------------------------------
@app.middleware("http")
async def gatekeeper(request: Request, call_next):
    path = request.url.path

    if path in ALLOW_HEALTH_PATHS or path.startswith(ALLOW_SIGNAL_PREFIX):
        return await call_next(request)

    user_id = get_user_id(request)
    if not user_id:
        return JSONResponse({"detail": "user_id required"}, status_code=401)

    if not is_user_ready(user_id):
        return JSONResponse({"detail": "Service not ready for this user"}, status_code=503)

    return await call_next(request)


# ------------------------------------------------------------------------------
# 헬스 & 신호
# ------------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"ok": True, "now": _now().isoformat()}


@app.post("/signal/ready")
async def signal_ready(x_key: str = Query(...), user_id: str = Query(...)):
    """
    Streamlit이 호출:
    - x_key 일치해야 함
    - user_id의 게이트를 '지금부터 10분'으로 리셋
    """
    if x_key != BOOT_SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")

    if not user_id.strip():
        raise HTTPException(status_code=400, detail="user_id required")

    ttl = set_user_ready(user_id)
    log.info("READY SET: user=%s ttl=%ss", user_id, ttl)
    return {"ok": True, "user_id": user_id, "ttl_sec": ttl}


# ------------------------------------------------------------------------------
# 보호 라우터 등록
# ------------------------------------------------------------------------------
app.include_router(sum.router)
