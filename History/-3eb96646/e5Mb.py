"""
FastAPI 메인 (멀티 워커 대응 / Redis 기반 유저별 10분 게이트)
- Streamlit이 /signal/ready 를 호출하면 해당 user_id의 사용 권한을 '지금부터 10분' 허용 (리셋)
- 그 10분 동안만 모든 보호 라우트 접근 가능 (요청 시 user_id 전달 필수)
- 다시 신호를 보내면 '지금부터 10분'으로 재설정(연장 X, 항상 최대 10분)
- 라우터는 app/api/*.py 로 분리, 여기서 include_router로 등록

주의:
- Redis가 반드시 접근 가능해야 함(환경변수 REDIS_URL)
- 요청은 헤더 X-User-ID 또는 쿼리 user_id 로 유저 식별
"""

from __future__ import annotations
import os
import logging
from typing import Optional

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse

# 라우터 (예: /sum) 분리 파일
from backend.api import sum

# ---- Redis(비동기) 클라이언트 ----
# pip install "redis>=5"   (redis.asyncio 사용)
import redis.asyncio as redis


# ------------------------------------------------------------------------------
# 환경 변수 / 상수
# ------------------------------------------------------------------------------
BOOT_SECRET = os.getenv("BOOT_SECRET", "dev-secret")               # Streamlit과 공유할 신호 키
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")     # Redis 연결 URL
READY_TTL_SEC = int(os.getenv("READY_TTL_SEC", "600"))             # 최대 10분(600초)
ALLOW_HEALTH_PATHS = {"/health"}
ALLOW_SIGNAL_PREFIX = "/signal/"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("gate")


# ------------------------------------------------------------------------------
# 앱 & Redis 클라이언트
# ------------------------------------------------------------------------------
app = FastAPI(
    title="Hold-Man API (Redis gate)",
    description="Per-user 10-minute gating via Redis (works with multiple workers)",
    version="0.1.0",
)

redis_client: Optional[redis.Redis] = None


@app.on_event("startup")
async def on_startup():
    """애플리케이션 시작 시 Redis 클라이언트 생성 (커넥션 풀 내부 관리)."""
    global redis_client
    redis_client = redis.from_url(
        REDIS_URL,
        decode_responses=True,           # 문자열로 사용
        health_check_interval=30,        # 유휴 연결 건강 체크
        client_name="hold-man-api",      # for observability
    )
    # 가볍게 ping 테스트(실패 시 예외 -> 로그로만 남기고 서비스는 떠있게 할 수도 있음)
    try:
        await redis_client.ping()
        log.info("Redis connected.")
    except Exception as e:
        log.error("Redis ping failed: %s", e)


@app.on_event("shutdown")
async def on_shutdown():
    """애플리케이션 종료 시 Redis 정리."""
    global redis_client
    if redis_client:
        try:
            await redis_client.aclose()
        except Exception:
            pass
        redis_client = None


# ------------------------------------------------------------------------------
# 유틸
# ------------------------------------------------------------------------------
def get_user_id(request: Request) -> Optional[str]:
    """
    유저 식별 규칙:
    1) 헤더 X-User-ID 우선
    2) 없으면 쿼리 파라미터 user_id 허용
    """
    uid = request.headers.get("X-User-ID")
    if uid and uid.strip():
        return uid.strip()
    q = request.query_params.get("user_id")
    if q and q.strip():
        return q.strip()
    return None


def user_ready_key(user_id: str) -> str:
    """Redis 키 네임스페이스."""
    return f"ready:{user_id}"


async def set_user_ready(user_id: str) -> int:
    """
    '지금부터 READY_TTL_SEC'으로 리셋.
    - Redis의 SETEX로 TTL을 항상 새로 설정 (연장 누적이 아닌 '최대 10분' 보장)
    - 반환: 설정된 TTL(초)
    """
    assert redis_client is not None
    key = user_ready_key(user_id)
    # SETEX key TTL value
    # value는 간단히 "1" 사용 (여기선 존재/TTL만 중요)
    await redis_client.setex(key, READY_TTL_SEC, "1")
    return READY_TTL_SEC


async def is_user_ready(user_id: str) -> bool:
    """
    유저의 게이트가 열려 있는지 확인.
    - TTL이 남아 있으면 True, 없거나 만료면 False
    """
    assert redis_client is not None
    key = user_ready_key(user_id)
    ttl = await redis_client.ttl(key)
    # ttl == -2: key 없음, ttl == -1: TTL 없음(무기한) → 둘 다 False 처리 (무기한 허용은 의도 아님)
    return ttl is not None and ttl > 0


# ------------------------------------------------------------------------------
# 게이트 미들웨어
# ------------------------------------------------------------------------------
@app.middleware("http")
async def gatekeeper(request: Request, call_next):
    """
    - /signal/*, /health 는 항상 허용
    - 그 외 보호 라우트는 user_id 필수 + Redis에 남은 TTL>0 이어야 접근 허용
    - Redis 장애 시: 안전을 위해 막는 쪽(503)으로 처리
    """
    path = request.url.path

    if path in ALLOW_HEALTH_PATHS or path.startswith(ALLOW_SIGNAL_PREFIX):
        return await call_next(request)

    user_id = get_user_id(request)
    if not user_id:
        return JSONResponse({"detail": "user_id required"}, status_code=401)

    try:
        # Redis 미초기화/오류 방지
        if redis_client is None:
            return JSONResponse({"detail": "Service not ready (gate offline)"}, status_code=503)

        ready = await is_user_ready(user_id)
        if not ready:
            return JSONResponse({"detail": "Service not ready for this user"}, status_code=503)

    except Exception as e:
        # Redis 오류 시 안전하게 막음 (원하시면 허용으로 바꿀 수도 있음)
        log.error("Gatekeeper Redis error: %s", e)
        return JSONResponse({"detail": "Service gate error"}, status_code=503)

    return await call_next(request)


# ------------------------------------------------------------------------------
# 헬스 & 신호
# ------------------------------------------------------------------------------
@app.get("/health")
async def health():
    ok = True
    try:
        if redis_client:
            await redis_client.ping()
    except Exception:
        ok = False
    return {"ok": ok}


@app.post("/signal/ready")
async def signal_ready(x_key: str, user_id: str):
    """
    Streamlit이 호출:
    - x_key(사전 공유된 시크릿)가 일치해야 함
    - 해당 user_id의 TTL을 '지금부터 10분'으로 리셋(SETEX)
    - 다시 호출하면 다시 10분으로 리셋(=최대 10분 보장)
    """
    if x_key != BOOT_SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")

    user_id = (user_id or "").strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    if redis_client is None:
        raise HTTPException(status_code=503, detail="gate offline")

    try:
        ttl = await set_user_ready(user_id)
        log.info("READY SET: user=%s ttl=%ss", user_id, ttl)
        return {"ok": True, "user_id": user_id, "ttl_sec": ttl}
    except Exception as e:
        log.error("set_user_ready error: %s", e)
        raise HTTPException(status_code=503, detail="gate error")


# ------------------------------------------------------------------------------
# 보호 라우터 등록 (게이트 통과 대상)
# ------------------------------------------------------------------------------
app.include_router(sum.router)
