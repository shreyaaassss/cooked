import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Text, Numeric, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB

from .database import Base


class AgentSession(Base):
    """Persistent state of one agent run.

    Every state-machine handler reads its inputs from this row and writes its
    outputs back, so a run can be resumed (e.g. after human approval or a
    server restart) from the stored state alone.
    """

    __tablename__ = "agent_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    goal = Column(Text, nullable=False)

    state = Column(String, nullable=False, default="PARSE")
    # running | awaiting_approval | completed | failed | cancelled
    status = Column(String, nullable=False, default="running")

    intent = Column(JSONB)       # structured intent/constraints from the LLM
    plan = Column(JSONB)         # ingredient list + planned steps
    pantry = Column(JSONB)       # buy_list, skipped, savings
    comparison = Column(JSONB)   # raw search results, resolved SKUs, per-platform carts
    ranked_carts = Column(JSONB)  # candidate carts, best first
    cart = Column(JSONB)         # the cart the agent wants to buy
    total = Column(Numeric(10, 2))

    policy = Column(JSONB)       # spend-policy decision for `cart`
    approval_status = Column(String, default="not_required")  # not_required | pending | approved | auto_approved | rejected
    recovery = Column(JSONB)     # pending recovery action, if any
    attempts = Column(JSONB, default=dict)  # per-state retry counters

    order_id = Column(UUID(as_uuid=True))  # set by the execute step
    errors = Column(JSONB, default=list)
    events = Column(JSONB, default=list)   # ordered timeline, streamed over SSE

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
