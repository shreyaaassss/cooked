import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .database import Base


class SpendMandate(Base):
    __tablename__ = "spend_mandates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    platform_scope = Column(String, nullable=False)  # zepto | swiggy_instamart | both
    cap_amount = Column(Numeric(10, 2), nullable=False)
    auto_approve_threshold = Column(Numeric(10, 2), nullable=False)
    valid_until = Column(DateTime(timezone=True))
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user = relationship("User", back_populates="mandates")

    __table_args__ = (
        CheckConstraint(
            "platform_scope IN ('zepto', 'swiggy_instamart', 'both')",
            name="ck_platform_scope",
        ),
    )
