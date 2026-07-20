import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Numeric, Integer, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from .database import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    source_recipe = Column(String, nullable=False)
    ingredients_requested = Column(JSONB, nullable=False)
    ingredients_skipped = Column(JSONB)
    platform_chosen = Column(String)
    cart_items = Column(JSONB)
    total_amount = Column(Numeric(10, 2))
    delivery_fee = Column(Numeric(10, 2))
    status = Column(String, default="pending_approval")
    prava_session_id = Column(String)
    platform_order_id = Column(String)
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
            "status IN ('pending_approval', 'approved', 'payment_pending', 'paid', 'failed', 'cancelled')",
            name="ck_order_status",
        ),
    )
