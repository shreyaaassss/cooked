from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.models.database import get_db
from backend.models.order import Order

router = APIRouter()


@router.get("/order/{order_id}")
async def get_order(order_id: str, db: Session = Depends(get_db)):
    """Get order details. Payment and platform-order state are reported
    separately: `payment_status` says whether money moved, `order_status`
    says whether the platform actually confirmed an order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")

    return {
        "order_id": str(order.id),
        "agent_session_id": str(order.agent_session_id) if order.agent_session_id else None,
        "source_recipe": order.source_recipe,
        "platform": order.platform_chosen,
        "items": order.cart_items,
        "skipped": order.ingredients_skipped,
        "total": float(order.total_amount) if order.total_amount else None,
        "status": order.status,
        "payment_status": order.payment_status,
        "order_status": order.order_status,
        "payment_url": order.payment_url,
        "platform_order_id": order.platform_order_id,
        "platform_orders": order.platform_orders,
        "failure_state": order.failure_state,
        "eta_minutes": order.eta_minutes,
        "created_at": order.created_at.isoformat() if order.created_at else None,
    }
