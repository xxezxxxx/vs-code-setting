from fastapi import FastAPI, HTTPException
from pathlib import Path
import json

app = FastAPI()

JSON_PATH = Path("data/data.json")   # 상대경로, 절대경로 둘 다 가능


@app.post("/api/load")
async def load_json_data():
    # 1. 파일 존재 여부 체크
    if not JSON_PATH.exists():
        raise HTTPException(status_code=404, detail="data.json not found")

    # 2. JSON 읽기
    try:
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="JSON decode error")

    # 3. 그대로 반환
    return data
