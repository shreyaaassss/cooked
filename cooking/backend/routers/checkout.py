import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.models.database import get_db
from backend.models.mandate import SpendMandate
from backend.models.order import Order
from backend.services.prava_service import PravaService
from backend.services.zepto_service import ZeptoService

router = APIRouter()

DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

prava = PravaService()
zepto = ZeptoService()


class CheckoutInitRequest(BaseModel):
    user_id: str = DEMO_USER_ID
    platform: str = Field(..., pattern="^(zepto|swiggy_instamart)$")
    cart_items: list[dict]
    total_amount: float
    source_recipe: str
    skipped_items: list[dict] = []


class CheckoutInitResponse(BaseModel):
    order_id: str
    prava_payment_url: str | None
    session_id: str | None
    status: str
    message: str


@router.get("/prava-status")
async def prava_status():
    """Check Prava agent link status."""
    return await prava.check_status()


@router.post("/initiate", response_model=CheckoutInitResponse)
async def initiate_checkout(
    req: CheckoutInitRequest, db: Session = Depends(get_db)
):
    """Initiate Prava checkout for the optimized cart.

    Flow:
    1. Verify Prava is active
    2. Check spend mandate
    3. Create order record (idempotent)
    4. Create Prava session
    5. Return payment URL for user approval
    """
    # Step 1: Check Prava status
    status = await prava.check_status()
    if status["status"] != "active":
        raise HTTPException(
            400,
            f"Prava is not active (status: {status['status']}). "
            "Please set up Prava first.",
        )

    # Step 2: Check spend mandate
    mandate = (
        db.query(SpendMandate)
        .filter(SpendMandate.user_id == req.user_id)
        .first()
    )
    if mandate:
        cap = float(mandate.cap_amount)
        if req.total_amount > cap:
            raise HTTPException(
                400,
                f"Total ₹{req.total_amount:.2f} exceeds your spend cap of ₹{cap:.2f}",
            )

    # Step 3: Create order record
    idempotency_key = f"{req.user_id}:{req.source_recipe}:{uuid.uuid4().hex[:8]}"

    order = Order(
        user_id=req.user_id,
        source_recipe=req.source_recipe,
        ingredients_requested=req.cart_items,
        ingredients_skipped=req.skipped_items,
        platform_chosen=req.platform,
        cart_items=req.cart_items,
        total_amount=req.total_amount,
        status="pending_approval",
        idempotency_key=idempotency_key,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # Step 4: Create Prava session
    item_names = [i.get("ingredient", i.get("sku_name", "item")) for i in req.cart_items]
    cart_desc = f"CookCart: {', '.join(item_names[:5])}"

    try:
        if req.platform == "zepto":
            session = await prava.create_zepto_session(req.total_amount, cart_desc)
        else:
            session = await prava.create_swiggy_session(req.total_amount, cart_desc)
    except Exception as e:
        order.status = "failed"
        db.commit()
        raise HTTPException(500, f"Prava session creation failed: {e}")

    order.prava_session_id = session.get("session_id")
    db.commit()

    # Step 5: Check auto-approve threshold
    needs_approval = True
    if mandate:
        auto_threshold = float(mandate.auto_approve_threshold)
        if req.total_amount <= auto_threshold:
            needs_approval = False

    return CheckoutInitResponse(
        order_id=str(order.id),
        prava_payment_url=session.get("payment_url"),
        session_id=session.get("session_id"),
        status="awaiting_approval",
        message=(
            f"Please approve the payment of ₹{req.total_amount:.2f} "
            f"on the Prava page. Open the payment URL and tap Approve."
            if needs_approval
            else f"Auto-approved: ₹{req.total_amount:.2f} is under your "
            f"₹{auto_threshold:.2f} auto-approve threshold."
        ),
    )


@router.post("/complete/{order_id}")
async def complete_checkout(order_id: str, db: Session = Depends(get_db)):
    """Poll Prava for approval, then complete checkout.

    This is the critical path:
    1. Poll Prava for tokenized credentials (blocks until user approves)
    2. Use credentials to complete platform checkout via browser automation
    3. Verify payment status
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")

    if order.status not in ("pending_approval", "approved"):
        raise HTTPException(400, f"Order cannot be completed (status: {order.status})")

    if not order.prava_session_id:
        raise HTTPException(400, "No Prava session found for this order")

    # Step 1: Poll for credentials
    credentials = await prava.poll_session(order.prava_session_id)

    if credentials["status"] != "approved":
        order.status = "failed"
        db.commit()
        return {
            "order_id": str(order.id),
            "status": "failed",
            "message": f"Payment not approved: {credentials.get('status')}",
        }

    order.status = "payment_pending"
    db.commit()

    # Step 2: The actual checkout happens via browser automation
    # using the merchant Prava skills (zepto-prava-skill / swiggy-prava-skill).
    # The credentials (token, cryptogram, expiry) are passed to the
    # browser automation layer which fills the payment form.
    #
    # For Zepto: create_online_payment_order(confirmOrder=true) → payment link → fill card form
    # For Swiggy: open checkout page → select card payment → fill card form

    return {
        "order_id": str(order.id),
        "status": "payment_pending",
        "platform": order.platform_chosen,
        "total": float(order.total_amount),
        "credentials_received": True,
        "message": (
            "Payment approved! Credentials received. "
            "Completing checkout via browser automation..."
        ),
        # NOTE: In production, the browser automation step would happen here.
        # For the hackathon demo, this is orchestrated by the agent skills.
    }


@router.get("/order/{order_id}")
async def get_order(order_id: str, db: Session = Depends(get_db)):
    """Get order status and details."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")

    return {
        "order_id": str(order.id),
        "source_recipe": order.source_recipe,
        "platform": order.platform_chosen,
        "items": order.cart_items,
        "skipped": order.ingredients_skipped,
        "total": float(order.total_amount) if order.total_amount else None,
        "status": order.status,
        "eta_minutes": order.eta_minutes,
        "platform_order_id": order.platform_order_id,
        "created_at": order.created_at.isoformat() if order.created_at else None,
    }
