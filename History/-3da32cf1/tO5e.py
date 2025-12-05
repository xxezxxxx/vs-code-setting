from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
import json

app = FastAPI()

JSON_PATH = Path("data/data.json")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],         # ★ 모든 도메인 허용
    allow_credentials=True,
    allow_methods=["*"],         # ★ 모든 메서드 허용 (GET, POST 등)
    allow_headers=["*"],         # ★ 모든 헤더 허용
)

@app.post("/api/load")
async def load_json_data(sdwt: str = Query(...)):
    # 1) 파일 체크
    if not JSON_PATH.exists():
        return JSONResponse(
            status_code=404,
            content={"error": "data.json not found"}
        )

    # 2) JSON 로드
    try:
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError:
        return JSONResponse(
            status_code=500,
            content={"error": "JSON decode error"}
        )

    # 3) 해당 SDWT 존재하는지 체크
    if sdwt not in data:
        return JSONResponse(
            status_code=404,
            content={"error": f"SDWT '{sdwt}' not found"}
        )

    # 4) 구조 분리
    sdwt_block = data[sdwt]

    update_time = sdwt_block.get("updated_at")
    items = sdwt_block.get("items", [])

    # 5) 원하는 형태로 응답
    return JSONResponse(
        status_code=200,
        content={
            "update": update_time,
            "data": items
        }
    )
