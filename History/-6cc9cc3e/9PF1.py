from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class MyPageRequests(BaseModel):
    

@router.get("/mypage")
def setMyPage():