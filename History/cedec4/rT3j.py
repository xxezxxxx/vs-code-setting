from fastapi import FastAPI
from backend.app.api import routes_sum

app = FastAPI()

# 라우터 등록
app.include_router(routes_sum.router)
