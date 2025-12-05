from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

@router.get("/mypage")
def 