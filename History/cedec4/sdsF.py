import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from backend.api import sum

app = FastAPI()
app.state.ready = False

SECRET = os.getenv("BOOT_SECRET", "dev-secret")

# 라우터 등록
app.include_router(sum.router)