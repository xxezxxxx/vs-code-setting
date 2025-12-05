from fastapi import FastAPI
from backend.api import sum

app = FastAPI()

# 라우터 등록
app.include_router(sum.router)
a