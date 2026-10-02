import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Numeric, Integer, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from .database import Base

ORDER_STATUSES = (
    "pending_approval",
    "approved",
    "awaiting_user_payment",
    "payment_pending",
    "paid",
    "failed",
    "cancelled",
)


class Order(Base):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    agent_session_id = Column(UUID(as_uuid=True), ForeignKey("agent_sessions.id", ondelete="SET NULL"))
    source_recipe = Column(String, nullable=False)
    ingredients_requested = Column(JSONB, nullable=False)
    ingredients_skipped = Column(JSONB)
    platform_chosen = Column(String)  # NULL for split carts (see platform_orders)
    cart_items = Column(JSONB)
    total_amount = Column(Numeric(10, 2))
    delivery_fee = Column(Numeric(10, 2))

    # Payment and order are tracked separately: money moving is not the same
    # as the platform confirming an order.
    status = Column(String, default="pending_approval")
    payment_status = Column(String, default="not_started")  # not_started | link_created | pending | paid | failed
    order_status = Column(String, default="not_placed")     # not_placed | placed | verified | failed
    payment_url = Column(String)
    payment_ref = Column(String)
    platform_order_id = Column(String)
    platform_orders = Column(JSONB)  # per-platform order refs for split carts
    failure_state = Column(JSONB)    # {stage, reason, recoverable}

    idempotency_key = Column(String, unique=True)
    eta_minutes = Column(Integer)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="orders")

    __table_args__ = (
        CheckConstraint(
            "platform_chosen IN ('zepto', 'swiggy_instamart')",
            name="ck_platform_chosen",
        ),
        CheckConstraint(
            "status IN (" + ", ".join(f"'{s}'" for s in ORDER_STATUSES) + ")",
            name="ck_order_status",
        ),
    )
