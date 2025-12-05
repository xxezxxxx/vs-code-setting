from fastapi import APIRouter

router = APIRouter(prefix="/sum", tags=["sum"])

@router.get("")
def sum_numbers(a: int, b: int):
    return {"result": a + b}
