from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class MyPageRequests(BaseModel):
    name:str
    age:str

@router.get("/mypage")
def setMyPage(req:MyPageRequests):
    a:req.name