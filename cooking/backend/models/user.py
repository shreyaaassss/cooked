import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, unique=True)
    # Login identity. Separate accounts, separate pantry/mandates/orders/agent
    # sessions — every query elsewhere already filters by user_id, so a real
    # username+PIN here is what actually turns that into per-user isolation.
    username = Column(String, unique=True, index=True)
    pin_hash = Column(String)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    pantry_staples = relationship("PantryStaple", back_populates="user", cascade="all, delete-orphan")
    mandates = relationship("SpendMandate", back_populates="user", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="user", cascade="all, delete-orphan")
