from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.models.database import get_db
from backend.services.pantry_service import (
    add_staple,
    get_user_staples,
    remove_staple,
)

router = APIRouter()

# Default demo user for hackathon
DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"


class StapleRequest(BaseModel):
    ingredient_name: str
    user_id: str = DEMO_USER_ID


@router.get("/staples")
async def list_staples(
    user_id: str = DEMO_USER_ID, db: Session = Depends(get_db)
):
    """Get all pantry staples for a user."""
    return await get_user_staples(db, user_id)


@router.post("/staples")
async def add_pantry_staple(req: StapleRequest, db: Session = Depends(get_db)):
    """Add an ingredient to the user's pantry staples list."""
    try:
        return await add_staple(db, req.user_id, req.ingredient_name)
    except Exception as e:
        raise HTTPException(400, f"Could not add staple: {e}")


@router.delete("/staples/{ingredient_name}")
async def remove_pantry_staple(
    ingredient_name: str,
    user_id: str = DEMO_USER_ID,
    db: Session = Depends(get_db),
):
    """Remove an ingredient from the user's pantry staples list."""
    removed = await remove_staple(db, user_id, ingredient_name)
    if not removed:
        raise HTTPException(404, f"Staple '{ingredient_name}' not found")
    return {"removed": ingredient_name}
