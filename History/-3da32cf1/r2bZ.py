from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pathlib import Path
import json

app = FastAPI()

JSON_PATH = Path("data/data.json")


@app.post("/api/load")
async def load_json_data():
    # 1. 파일 체크
    if not JSON_PATH.exists():
        return JSONResponse(
            status_code=404,
            content={"error": "data.json not found"}
        )

    try:
        # 2. JSON 읽기
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError:
        return JSONResponse(
            status_code=500,
            content={"error": "JSON decode error"}
        )

    # 3. 정상 응답 (200) + data 감싸기
    return JSONResponse(
        status_code=200,
        content={"data": data}
    )
