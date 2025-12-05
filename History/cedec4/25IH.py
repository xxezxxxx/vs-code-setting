# """
# FastAPI 메인 (단일 프로세스용, Redis 제거 버전)
# - Streamlit이 /signal/ready 호출하면 해당 user_id의 게이트가 '지금부터 10분' 열림
# - 다시 호출하면 '지금부터 10분'으로 리셋 (항상 최대 10분)
# - user_id는 반드시 전달해야 함 (헤더 X-User-ID 또는 쿼리 user_id)
# - 멀티 워커 / 멀티 서버에서는 동기화 안 됨 (개발/단일 서버 테스트용)
# """

# from __future__ import annotations
# import os
# import logging
# from datetime import datetime, timedelta
# from typing import Optional, Dict

# from fastapi import FastAPI, Request, HTTPException, Query
# from fastapi.responses import JSONResponse

# # 라우터 (예: /sum)
# from backend.api import sum

# # ------------------------------------------------------------------------------
# # 환경 변수 / 상수
# # ------------------------------------------------------------------------------
# BOOT_SECRET = os.getenv("BOOT_SECRET", "dev-secret")
# READY_TTL_SEC = int(os.getenv("READY_TTL_SEC", "600"))  # 최대 10분(600초)
# ALLOW_HEALTH_PATHS = {"/health"}
# ALLOW_SIGNAL_PREFIX = "/signal/"

# logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
# log = logging.getLogger("gate")

# # ------------------------------------------------------------------------------
# # 앱 & in-memory 상태
# # ------------------------------------------------------------------------------
# app = FastAPI()

# # user_id -> 만료시각
# _user_ready: Dict[str, datetime] = {}


# def _now() -> datetime:
#     return datetime.utcnow()


# def get_user_id(request: Request) -> Optional[str]:
#     """유저 식별: 헤더 X-User-ID > 쿼리 user_id"""
#     uid = request.headers.get("X-User-ID")
#     if uid and uid.strip():
#         return uid.strip()
#     q = request.query_params.get("user_id")
#     if q and q.strip():
#         return q.strip()
#     return None


# def set_user_ready(user_id: str) -> int:
#     """지금부터 TTL초 동안 게이트 열기 (리셋)"""
#     expires = _now() + timedelta(seconds=READY_TTL_SEC)
#     _user_ready[user_id] = expires
#     return READY_TTL_SEC


# def is_user_ready(user_id: str) -> bool:
#     exp = _user_ready.get(user_id)
#     return bool(exp and exp > _now())


# # ------------------------------------------------------------------------------
# # 미들웨어
# # ------------------------------------------------------------------------------
# @app.middleware("http")
# async def gatekeeper(request: Request, call_next):
#     path = request.url.path

#     if path in ALLOW_HEALTH_PATHS or path.startswith(ALLOW_SIGNAL_PREFIX):
#         return await call_next(request)

#     user_id = get_user_id(request)
#     if not user_id:
#         return JSONResponse({"detail": "user_id required"}, status_code=401)

#     if not is_user_ready(user_id):
#         return JSONResponse({"detail": "Service not ready for this user"}, status_code=503)

#     return await call_next(request)


# # ------------------------------------------------------------------------------
# # 헬스 & 신호
# # ------------------------------------------------------------------------------
# @app.get("/health")
# async def health():
#     return {"ok": True, "now": _now().isoformat()}


# @app.post("/signal/ready")
# async def signal_ready(x_key: str = Query(...), user_id: str = Query(...)):
#     """
#     Streamlit이 호출:
#     - x_key 일치해야 함
#     - user_id의 게이트를 '지금부터 10분'으로 리셋
#     """
#     if x_key != BOOT_SECRET:
#         raise HTTPException(status_code=401, detail="unauthorized")

#     if not user_id.strip():
#         raise HTTPException(status_code=400, detail="user_id required")

#     ttl = set_user_ready(user_id)
#     log.info("READY SET: user=%s ttl=%ss", user_id, ttl)
#     return {"ok": True, "user_id": user_id, "ttl_sec": ttl}


# # ------------------------------------------------------------------------------
# # 보호 라우터 등록
# # ------------------------------------------------------------------------------
# app.include_router(sum.router)


# backend/app/main.py
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import time

app = FastAPI()

# 유저별 최근 요청 기록
request_log = {}

# 설정값
WINDOW_SEC = 10.0   # 최근 10초 창
LIMIT      = 10     # 창 내 최대 허용 요청 수
BAN_SEC    = 10.0   # 초과 시 재시도 금지 시간

# 상태 저장소
_request_qs: DefaultDict[str, Deque[float]] = defaultdict(deque)      # 최근 요청 타임스탬프
_locks: DefaultDict[str, asyncio.Lock] = defaultdict(asyncio.Lock)    # 키별 락
_ban_until: Dict[str, float] = {}                                     # 키별 차단 만료 시각

def _key_of(request: Request) -> str:
    # 스트림릿에서 붙이는 사용자 식별 헤더가 있으면 최우선 사용
    uid = request.headers.get("X-User-ID")
    if uid:
        return f"user:{uid}"
    return f"ip:{request.client.host}"

async def rate_limiter_middleware(request: Request, call_next):
    now = time.monotonic()
    key = _key_of(request)
    lock = _locks[key]

    async with lock:
        # 1) 현재 차단 중인지 체크
        until = _ban_until.get(key, 0.0)
        if until > now:
            retry_after = max(0, int(until - now))
            # 429 + Retry-After 헤더
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please retry later.",
                headers={"Retry-After": str(retry_after)}
            )

        # 2) 창 밖 요청 제거(슬라이딩 윈도우)
        q = _request_qs[key]
        while q and (now - q[0]) > WINDOW_SEC:
            q.popleft()

        # 3) 초과 여부 판단
        if len(q) >= LIMIT:
            # 즉시 차단 시작
            _ban_until[key] = now + BAN_SEC
            raise HTTPException(
                status_code=429,
                detail=f"Too many requests. Limit={LIMIT} per {int(WINDOW_SEC)}s.",
                headers={"Retry-After": str(int(BAN_SEC))}
            )

        # 4) 기록 추가
        q.append(now)

    # 5) 정상 처리
    return await call_next(request)

# CORS: 컴포넌트(프론트) 도메인을 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:8501"],  # 필요 도메인 추가
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SaveIn(BaseModel):
    name: Optional[str] = None
    checked: List[str]
    order: List[str]
    options: Dict[Any, Any] = {}
    ts: int
    user_id: Optional[str] = None
    meta: Optional[dict] = None

@app.post("/save")
def save(payload: SaveIn):
    # TODO: DB 저장 로직
    # with engine.begin() as conn: ...
    print("[SAVE]", payload.dict())
    return {"ok": True, "message": "saved", "count": len(payload.checked)}
