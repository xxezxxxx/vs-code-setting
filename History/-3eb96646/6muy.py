"""
FastAPI 메인 애플리케이션 (유저별 10분 게이트)
- Streamlit이 /signal/ready 를 호출하기 전에는 모든 라우트(신호/헬스 제외) 접근 불가
- 신호를 보내면 '지금부터 10분' 동안만 해당 유저의 접근을 허용
- 10분이 남아 있든 1분이 남아 있든, 신호를 다시 보내면 '지금부터 10분'으로 '리셋'
- 라우터는 app/api/*.py 로 분리하여 include_router 로 사용

주의:
- 이 구현은 단일 프로세스(워커 1개) 환경에 최적. 멀티 워커면 Redis 등 공유 스토어 사용 필요.
"""

from __future__ import annotations

import os
import threading
import logging
from typing import Dict, Optional
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse

# 분리된 라우터(예: /sum) import
#   파일: backend/app/api/routes_sum.py
#   내용: router = APIRouter(prefix="/sum", ...) ...
from app.api import routes_sum


# ------------------------------------------------------------------------------
# 환경변수 & 상수
# ------------------------------------------------------------------------------
# Streamlit과 공유할 간단한 "신호 키" (외부 유출 금지: .env / 배포 시 시크릿에 보관)
BOOT_SECRET = os.getenv("BOOT_SECRET", "dev-secret")

# 유저별 허용 최대 시간(초) — 기본 600초(=10분)
READY_TTL_SEC = int(os.getenv("READY_TTL_SEC", "600"))

# 게이트를 우회할 수 있는 경로(항상 허용)
ALLOW_HEALTH_PATHS = {"/health"}
ALLOW_SIGNAL_PREFIX = "/signal/"  # /signal/* 는 항상 허용

# 로깅 설정(필요 시 수준 조정)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("gate")


# ------------------------------------------------------------------------------
# 앱 생성 및 전역 상태
# ------------------------------------------------------------------------------
app = FastAPI(
    title="Hold-Man API",
    description="Per-user 10-minute gating with reset-on-signal",
    version="0.1.0",
)

# 유저별 만료시각 저장소 (단일 워커 전제: 프로세스 메모리 공유)
#   key: user_id
#   val: 만료시각(datetime, UTC)
app.state.ready_untils: Dict[str, datetime] = {}
app.state.lock = threading.RLock()  # 다중 스레드 안전


# ------------------------------------------------------------------------------
# 유틸 함수
# ------------------------------------------------------------------------------
def now_utc() -> datetime:
    """UTC now (timezone-aware)."""
    return datetime.now(timezone.utc)


def get_user_id(request: Request) -> Optional[str]:
    """
    유저 식별값 취득 규칙:
    1) 헤더 X-User-ID 우선
    2) 없으면 쿼리 파라미터 user_id 허용
    ※ 실제 서비스에선 SSO/Token 등으로 강화 권장
    """
    uid = request.headers.get("X-User-ID")
    if uid and uid.strip():
        return uid.strip()
    q = request.query_params.get("user_id")
    if q and q.strip():
        return q.strip()
    return None


def set_user_ready(user_id: str, ttl_sec: int = READY_TTL_SEC) -> datetime:
    """
    유저별 사용 허용 시각을 '지금부터 ttl_sec'으로 '리셋'한다.
    - 연장이 아니라 '최대 10분' 보장(=항상 now + ttl)
    """
    expires = now_utc() + timedelta(seconds=ttl_sec)
    with app.state.lock:
        app.state.ready_untils[user_id] = expires
    log.debug("set_user_ready: user=%s until=%s", user_id, expires.isoformat())
    return expires


def is_user_ready(user_id: str) -> bool:
    """
    현재 시각이 유저의 만료시각 이전이면 True.
    """
    with app.state.lock:
        until = app.state.ready_untils.get(user_id)
    return bool(until and now_utc() < until)


# ------------------------------------------------------------------------------
# 게이트 미들웨어
# ------------------------------------------------------------------------------
@app.middleware("http")
async def gatekeeper(request: Request, call_next):
    """
    - /signal/*, /health 는 항상 통과
    - 그 외 모든 라우트는 user_id 필수 + 해당 유저의 게이트가 열려 있어야 함
    """
    path = request.url.path

    # 신호/헬스 경로는 항상 통과 (게이트 예외)
    if path in ALLOW_HEALTH_PATHS or path.startswith(ALLOW_SIGNAL_PREFIX):
        return await call_next(request)

    # 나머지는 user_id 필요
    user_id = get_user_id(request)
    if not user_id:
        # 인증/식별 실패 (여기서는 간단히 user_id 없으면 401)
        return JSONResponse({"detail": "user_id required"}, status_code=401)

    # 게이트 열림 여부 판정
    if not is_user_ready(user_id):
        # 열려있지 않으면 503
        return JSONResponse({"detail": "Service not ready for this user"}, status_code=503)

    # 통과
    return await call_next(request)


# ------------------------------------------------------------------------------
# 헬스체크 & 신호 엔드포인트
# ------------------------------------------------------------------------------
@app.get("/health")
def health():
    """
    단순 헬스체크.
    - 게이트 상태에 상관없이 200 응답
    """
    return {"ok": True, "now": now_utc().isoformat()}


@app.post("/signal/ready")
def signal_ready(x_key: str, user_id: str):
    """
    Streamlit이 호출하는 '게이트 오픈 신호' 엔드포인트.
    - x_key(사전 공유된 시크릿)가 일치해야 함
    - user_id 의 만료시각을 '지금부터 10분'으로 리셋
    - 다시 호출하면 또 '지금부터 10분'으로 리셋(=최대 10분 보장)
    """
    if x_key != BOOT_SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")

    user_id = (user_id or "").strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    expires = set_user_ready(user_id)
    log.info("READY SET: user=%s until=%s", user_id, expires.isoformat())
    return {
        "ok": True,
        "user_id": user_id,
        "ready_until": expires.isoformat(),
        "ttl_sec": READY_TTL_SEC,
    }


# ------------------------------------------------------------------------------
# 분리된 라우터 등록(게이트 대상)
# ------------------------------------------------------------------------------
# 예) /sum 라우터는 app/api/routes_sum.py에 정의되어 있고,
# 여기서 include_router로 등록만 해주면 됨.
app.include_router(routes_sum.router)


# ------------------------------------------------------------------------------
# 멀티 워커 환경 주의
# ------------------------------------------------------------------------------
# uvicorn --workers N 으로 여러 프로세스를 띄우면, 위의 app.state.* 메모리는
# 각 프로세스마다 분리됩니다. 즉, 한 워커에 신호를 보내도 다른 워커에는 반영되지 않아요.
# → 운영 환경에서는 Redis/DB 등 '공유 스토어'에 user_id별 ready_until 을 저장/검증하세요.
#   (Redis 예시: SETEX ready:<user_id> 600 "1" / TTL로 자동 만료)
