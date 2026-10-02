import asyncio
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.models.agent_session import AgentSession
from backend.models.database import SessionLocal, get_db
from backend.services import orchestrator
from backend.services.agent_service import chat
from backend.services.cart_optimizer import CartOptimizer, PlatformCart
from backend.services.pantry_service import apply_pantry_diff
from backend.services.sku_resolver import SKUResolver
from backend.services.zepto_service import ZeptoService
from backend.services.swiggy_service import SwiggyInstamartService

router = APIRouter()

DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

zepto = ZeptoService()
swiggy = SwiggyInstamartService()
resolver = SKUResolver()
optimizer = CartOptimizer()


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    user_id: str = DEMO_USER_ID


@router.post("/chat")
async def agent_chat(req: ChatRequest, db: Session = Depends(get_db)):
    """Conversational grocery agent.

    1. Send messages to LLM to understand intent and extract items
    2. If intent is "search", run the compare pipeline on extracted items
    3. Return agent response + comparison data if available
    """
    # Step 1: LLM understands the message
    llm_messages = [{"role": m.role, "content": m.content} for m in req.messages]
    agent_response = await chat(llm_messages)

    intent = agent_response.get("intent", "help")
    message = agent_response.get("message", "")
    items = agent_response.get("items", [])

    result = {
        "intent": intent,
        "message": message,
        "items": items,
        "comparison": None,
    }

    # Step 2: If agent extracted grocery items, search platforms
    if intent == "search" and items:
        ingredients = [
            {
                "name": item["name"],
                "quantity": item.get("quantity", 1),
                "unit": item.get("unit", "pieces"),
                "category": "other",
                "is_common_staple": False,
            }
            for item in items
        ]

        # Apply pantry diff
        buy_list, skipped = await apply_pantry_diff(db, req.user_id, ingredients)

        if not buy_list:
            result["message"] += "\n\nAll items are already in your pantry!"
            result["comparison"] = {
                "buy_list": [],
                "skipped": skipped,
                "recommendation": None,
            }
            return result

        ingredient_names = [i["name"] for i in buy_list]

        # Search both platforms
        zepto_search = {}
        swiggy_search = {}
        errors = []

        try:
            zepto_search = await zepto.search_multiple(ingredient_names)
        except Exception as e:
            errors.append(f"Zepto: {e}")

        try:
            swiggy_search = await swiggy.search_multiple(ingredient_names)
        except Exception as e:
            errors.append(f"Swiggy: {e}")

        # Resolve SKUs
        zepto_resolved = resolver.resolve_all(buy_list, zepto_search)
        swiggy_resolved = resolver.resolve_all(buy_list, swiggy_search)

        # Build carts
        zepto_cart = PlatformCart.from_resolved(
            "zepto", zepto_resolved, delivery_fee=25.0, eta_minutes=14
        )
        swiggy_cart = PlatformCart.from_resolved(
            "swiggy_instamart", swiggy_resolved, delivery_fee=30.0, eta_minutes=19
        )

        # Optimize
        comparison = optimizer.optimize(zepto_cart, swiggy_cart)

        result["comparison"] = {
            "buy_list": buy_list,
            "skipped": skipped,
            "zepto_items": zepto_resolved,
            "swiggy_items": swiggy_resolved,
            "recommended": comparison["recommended"],
            "alternatives": comparison["alternatives"],
            "reasoning": comparison["reasoning"],
            "errors": errors if errors else None,
        }

    return result


# ── Autonomous agent (state machine) ─────────────────────────────────


class RunRequest(BaseModel):
    goal: str = Field(..., min_length=2, max_length=500)
    user_id: str = DEMO_USER_ID


class ApproveRequest(BaseModel):
    session_id: str
    approve: bool = True


def _session_view(row: AgentSession) -> dict:
    return {
        "session_id": str(row.id),
        "goal": row.goal,
        "state": row.state,
        "status": row.status,
        "intent": row.intent,
        "plan": row.plan,
        "pantry": row.pantry,
        "cart": row.cart,
        "alternatives": (row.ranked_carts or [])[1:] if row.ranked_carts else [],
        "total": float(row.total) if row.total is not None else None,
        "policy": row.policy,
        "approval_status": row.approval_status,
        "order_id": str(row.order_id) if row.order_id else None,
        "errors": row.errors or [],
        "events": row.events or [],
    }


@router.post("/run")
async def agent_run(req: RunRequest, db: Session = Depends(get_db)):
    """Start an agent run from one natural-language goal. Returns immediately;
    follow progress on GET /stream/{session_id}."""
    try:
        user_id = orchestrator._sid(req.user_id)
    except ValueError:
        raise HTTPException(400, "Invalid user id")

    # Idempotency: a double-submit of the same goal returns the live session.
    recent = (
        db.query(AgentSession)
        .filter(
            AgentSession.user_id == user_id,
            AgentSession.goal == orchestrator.sanitize_text(req.goal, 500),
            AgentSession.status.in_(("running", "awaiting_approval")),
            AgentSession.created_at > datetime.now(timezone.utc) - timedelta(minutes=2),
        )
        .first()
    )
    if recent:
        return {"session_id": str(recent.id), "state": recent.state, "reused": True}

    row = orchestrator.create_session(db, str(user_id), req.goal)
    orchestrator.spawn(row.id)
    return {"session_id": str(row.id), "state": row.state, "reused": False}


@router.get("/session/{session_id}")
async def agent_session(session_id: str, db: Session = Depends(get_db)):
    try:
        row = db.get(AgentSession, orchestrator._sid(session_id))
    except ValueError:
        raise HTTPException(400, "Invalid session id")
    if not row:
        raise HTTPException(404, "Session not found")
    return _session_view(row)


@router.get("/stream/{session_id}")
async def agent_stream(session_id: str, request: Request):
    """Server-Sent Events: replays the timeline so far, then streams new
    events until the run reaches a terminal state."""
    try:
        sid = orchestrator._sid(session_id)
    except ValueError:
        raise HTTPException(400, "Invalid session id")
    with SessionLocal() as db:
        if db.get(AgentSession, sid) is None:
            raise HTTPException(404, "Session not found")

    async def gen():
        sent, idle = 0, 0
        while True:
            if await request.is_disconnected():
                return
            with SessionLocal() as db:
                row = db.get(AgentSession, sid)
                events = list(row.events or [])
                status, view = row.status, _session_view(row)
            for ev in events[sent:]:
                yield f"id: {ev['seq']}\nevent: {ev['type']}\ndata: {json.dumps(ev)}\n\n"
                sent, idle = ev["seq"] + 1, 0
            if status in ("completed", "failed", "cancelled"):
                view.pop("events", None)
                yield f"event: end\ndata: {json.dumps(view)}\n\n"
                return
            idle += 1
            if idle % 30 == 0:  # ~15s keep-alive while paused for approval
                yield ": keep-alive\n\n"
            await asyncio.sleep(0.5)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@router.post("/approve")
async def agent_approve(req: ApproveRequest, db: Session = Depends(get_db)):
    """Record the human's decision and resume the same session."""
    try:
        row = orchestrator.record_decision(db, req.session_id, req.approve)
    except LookupError:
        raise HTTPException(404, "Session not found")
    except ValueError as e:
        raise HTTPException(409, str(e))
    except PermissionError as e:
        raise HTTPException(403, f"Blocked by spend policy: {e}")
    orchestrator.spawn(row.id)
    return {"session_id": str(row.id), "approval_status": row.approval_status}
