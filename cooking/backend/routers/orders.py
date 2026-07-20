from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.models.database import get_db
from backend.models.order import Order

router = APIRouter()

DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"


@router.get("/")
async def list_orders(
    user_id: str = DEMO_USER_ID,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """List recent orders for a user."""
    orders = (
        db.query(Order)
        .filter(Order.user_id == user_id)
        .order_by(Order.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "order_id": str(o.id),
            "source_recipe": o.source_recipe,
            "platform": o.platform_chosen,
            "total": float(o.total_amount) if o.total_amount else None,
            "status": o.status,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in orders
    ]
