"""Deterministic agent state machine.

    PARSE → PLAN → PANTRY → SEARCH → COMPARE → OPTIMIZE → POLICY → APPROVAL → EXECUTE → VERIFY
                                ↘ RECOVER ↙ (search retries, over-cap replan, execute/verify failures)

The LLM is used in exactly one place (PARSE, plus recipe decomposition in PLAN)
to interpret the goal. Everything that touches money — pantry diff, SKU
resolution, cart optimisation, spend policy, approval, order execution — is
plain code operating on state persisted in `agent_sessions`. Each handler reads
its inputs from the session row and writes its outputs back, so a run can pause
at APPROVAL and resume later (or after a restart) from the row alone.
"""

import asyncio
import logging
import uuid
from dataclasses import asdict
from datetime import datetime, timezone
from enum import Enum
from typing import Awaitable, Callable

from sqlalchemy.orm import Session

from backend.config import PLATFORM_ESTIMATES, SEARCH_TIMEOUT
from backend.models.agent_session import AgentSession
from backend.models.database import SessionLocal
from backend.models.mandate import SpendMandate
from backend.services.agent_service import ParsedIntent, parse_goal
from backend.services.cart_optimizer import CartOptimizer, PlatformCart
from backend.services.pantry_service import apply_pantry_diff
from backend.services.recipe_service import decompose_recipe
from backend.services.sanitize import sanitize_text
from backend.services.sku_resolver import SKUResolver
from backend.services.spend_policy import allowed_platforms, evaluate_policy
from backend.services.swiggy_service import SwiggyInstamartService
from backend.services.zepto_service import ZeptoService

log = logging.getLogger("orchestrator")

MAX_SEARCH_ATTEMPTS = 2
PLATFORMS = ("zepto", "swiggy_instamart")


class State(str, Enum):
    PARSE = "PARSE"
    PLAN = "PLAN"
    PANTRY = "PANTRY"
    SEARCH = "SEARCH"
    COMPARE = "COMPARE"
    OPTIMIZE = "OPTIMIZE"
    POLICY = "POLICY"
    APPROVAL = "APPROVAL"
    EXECUTE = "EXECUTE"
    VERIFY = "VERIFY"
    RECOVER = "RECOVER"
    DONE = "DONE"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


S = State
TERMINAL = {S.DONE, S.FAILED, S.CANCELLED}

TRANSITIONS: dict[State, set[State]] = {
    S.PARSE: {S.PLAN, S.FAILED},
    S.PLAN: {S.PANTRY, S.FAILED},
    S.PANTRY: {S.SEARCH, S.DONE, S.FAILED},
    S.SEARCH: {S.COMPARE, S.RECOVER, S.FAILED},
    S.RECOVER: {S.SEARCH, S.COMPARE, S.POLICY, S.EXECUTE, S.VERIFY, S.FAILED},
    S.COMPARE: {S.OPTIMIZE, S.FAILED},
    S.OPTIMIZE: {S.POLICY, S.FAILED},
    S.POLICY: {S.APPROVAL, S.EXECUTE, S.RECOVER, S.FAILED},
    S.APPROVAL: {S.EXECUTE, S.CANCELLED, S.FAILED},
    S.EXECUTE: {S.VERIFY, S.RECOVER, S.FAILED},
    S.VERIFY: {S.DONE, S.RECOVER, S.FAILED},
}

zepto = ZeptoService()
swiggy = SwiggyInstamartService()
resolver = SKUResolver()
optimizer = CartOptimizer()

_tasks: set[asyncio.Task] = set()  # keep references so background runs aren't GC'd


# ── Persistence helpers ──────────────────────────────────────────────


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sid(session_id) -> uuid.UUID:
    return session_id if isinstance(session_id, uuid.UUID) else uuid.UUID(str(session_id))


def _load(db: Session, session_id) -> AgentSession:
    row = db.get(AgentSession, _sid(session_id))
    if row is None:
        raise LookupError(f"agent session {session_id} not found")
    return row


def _append_event(row: AgentSession, type_: str, message: str, level: str = "info", data=None):
    events = list(row.events or [])
    events.append(
        {
            "seq": len(events),
            "ts": _now(),
            "type": type_,
            "state": row.state,
            "level": level,
            "message": message,
            "data": data,
        }
    )
    row.events = events


def emit(session_id, message: str, level: str = "info", data=None, type_: str = "log"):
    """Append a timeline event (streamed to the UI over SSE)."""
    with SessionLocal() as db:
        row = _load(db, session_id)
        _append_event(row, type_, message, level, data)
        db.commit()


def _transition(session_id, target: State):
    with SessionLocal() as db:
        row = _load(db, session_id)
        current = State(row.state)
        if current == target:
            return
        if target not in TRANSITIONS.get(current, set()):
            raise RuntimeError(f"illegal transition {current.value} → {target.value}")
        row.state = target.value
        if target == S.DONE:
            row.status = "completed"
        elif target == S.CANCELLED:
            row.status = "cancelled"
        _append_event(row, "state", f"{target.value}", "info")
        db.commit()


def _fail(session_id, message: str, recoverable: bool = False) -> State:
    with SessionLocal() as db:
        row = _load(db, session_id)
        stage = row.state
        row.state = S.FAILED.value
        row.status = "failed"
        row.errors = list(row.errors or []) + [
            {"ts": _now(), "stage": stage, "message": message, "recoverable": recoverable}
        ]
        _append_event(row, "state", "FAILED", "error")
        _append_event(row, "log", message, "error")
        db.commit()
    return S.FAILED


def _bump(session_id, key: str) -> int:
    """Increment and return a per-state attempt counter."""
    with SessionLocal() as db:
        row = _load(db, session_id)
        attempts = dict(row.attempts or {})
        attempts[key] = attempts.get(key, 0) + 1
        row.attempts = attempts
        db.commit()
        return attempts[key]


def _update(session_id, **fields):
    with SessionLocal() as db:
        row = _load(db, session_id)
        for k, v in fields.items():
            setattr(row, k, v)
        db.commit()


def _get(session_id) -> dict:
    with SessionLocal() as db:
        row = _load(db, session_id)
        return {
            "user_id": str(row.user_id),
            "goal": row.goal,
            "intent": row.intent,
            "plan": row.plan,
            "pantry": row.pantry,
            "comparison": row.comparison,
            "ranked_carts": row.ranked_carts,
            "cart": row.cart,
            "total": float(row.total) if row.total is not None else None,
            "policy": row.policy,
            "approval_status": row.approval_status,
            "recovery": row.recovery,
            "attempts": dict(row.attempts or {}),
        }


async def _blocking(fn: Callable, *args):
    """Run a service call that shells out (MCP runner) off the event loop.

    The service methods are `async def` but call blocking `subprocess.run`
    internally; a private loop in a worker thread keeps SSE streams responsive.
    """
    return await asyncio.to_thread(lambda: asyncio.run(fn(*args)))


def cart_items(cart: dict) -> list[dict]:
    """All line items of a cart, whether single-platform or split."""
    if cart.get("strategy") == "split":
        return [
            {**i, "platform": "zepto"} for i in cart.get("zepto_items", [])
        ] + [{**i, "platform": "swiggy_instamart"} for i in cart.get("swiggy_items", [])]
    return [{**i, "platform": cart["platform"]} for i in cart.get("items", [])]


def cart_platforms(cart: dict) -> set[str]:
    return set(cart["platforms"]) if cart.get("strategy") == "split" else {cart["platform"]}


# ── State handlers ───────────────────────────────────────────────────
# Each returns the next State, or None to pause (waiting on the human).


async def h_parse(sid) -> State | None:
    data = _get(sid)
    emit(sid, "Understanding your request…")
    try:
        intent = await parse_goal(data["goal"])
    except Exception as e:
        log.exception("parse failed")
        return _fail(sid, f"Couldn't interpret the request: {sanitize_text(e, 200)}")

    if not intent.items and not intent.recipe:
        return _fail(
            sid,
            "I couldn't find any groceries or a dish in that. "
            "Try something like “order 1kg onions and paneer” or “ingredients for butter chicken for 4”.",
        )

    _update(sid, intent=intent.model_dump())
    parts = []
    if intent.items:
        parts.append(f"{len(intent.items)} item(s)")
    if intent.recipe:
        parts.append(f"ingredients for {intent.recipe.dish} (serves {intent.recipe.servings})")
    extras = []
    if intent.budget_cap:
        extras.append(f"budget ₹{intent.budget_cap:.0f}")
    if intent.platform_pref != "any":
        extras.append(f"only {intent.platform_pref.replace('_', ' ')}")
    extras += intent.constraints
    emit(
        sid,
        "Goal understood: " + " + ".join(parts) + (f" ({', '.join(extras)})" if extras else ""),
        "success",
        data=intent.model_dump(),
    )
    return S.PLAN


async def h_plan(sid) -> State | None:
    data = _get(sid)
    intent = ParsedIntent.model_validate(data["intent"])
    ingredients: list[dict] = [
        {
            "name": i.name,
            "quantity": i.quantity,
            "unit": i.unit,
            "category": "other",
            "is_common_staple": False,
            "source": "requested",
        }
        for i in intent.items
    ]

    if intent.recipe:
        emit(sid, f"Working out ingredients for {intent.recipe.dish}…")
        try:
            recipe = await decompose_recipe(intent.recipe.dish, intent.recipe.servings)
        except Exception as e:
            return _fail(sid, f"Couldn't break down the recipe: {sanitize_text(e, 200)}")
        have = {i["name"] for i in ingredients}
        for ing in recipe.get("ingredients", []):
            name = sanitize_text(ing.get("name"), 60).lower()
            if not name or name in have:
                continue
            ingredients.append(
                {
                    "name": name,
                    "quantity": float(ing.get("quantity") or 0),
                    "unit": sanitize_text(ing.get("unit"), 20) or "pieces",
                    "category": sanitize_text(ing.get("category"), 20) or "other",
                    "is_common_staple": bool(ing.get("is_common_staple")),
                    "source": f"recipe:{intent.recipe.dish}",
                }
            )

    # "to taste" style entries (quantity 0) can't be bought by amount
    to_taste = [i for i in ingredients if i["quantity"] <= 0]
    ingredients = [i for i in ingredients if i["quantity"] > 0]

    steps = [
        "Check what you already have in your pantry",
        "Search Zepto and Swiggy Instamart in parallel",
        "Normalise pack sizes and compare price, availability and ETA",
        "Pick the cheapest valid cart (single store or split)",
        "Check it against your spend limits",
        "Ask for your approval if needed, then place the order and verify it",
    ]
    _update(sid, plan={"ingredients": ingredients, "to_taste": to_taste, "steps": steps})
    emit(
        sid,
        f"Plan ready: {len(ingredients)} ingredient(s) to source",
        "success",
        data={"ingredients": ingredients, "steps": steps},
    )
    return S.PANTRY


async def h_pantry(sid) -> State | None:
    data = _get(sid)
    emit(sid, "Checking your pantry…")
    with SessionLocal() as db:
        buy_list, skipped = await apply_pantry_diff(db, _sid(data["user_id"]), data["plan"]["ingredients"])

    _update(sid, pantry={"buy_list": buy_list, "skipped": skipped, "savings": None})
    if skipped:
        emit(
            sid,
            f"Skipping {len(skipped)} item(s) you already have: "
            + ", ".join(s["name"] for s in skipped),
            "success",
            data={"skipped": skipped},
        )
    else:
        emit(sid, "Nothing in your pantry matches; buying everything")

    if not buy_list:
        emit(sid, "Everything you asked for is already in your pantry. Nothing to order.", "success")
        return S.DONE
    return S.SEARCH


async def _search_platform(platform: str, names: list[str]) -> dict:
    svc = zepto if platform == "zepto" else swiggy
    return await asyncio.wait_for(_blocking(svc.search_multiple, names), timeout=SEARCH_TIMEOUT)


async def h_search(sid) -> State | None:
    data = _get(sid)
    pantry = data["pantry"]
    prior = data["comparison"] or {}
    raw: dict = dict(prior.get("raw") or {})
    errors: dict = dict(prior.get("search_errors") or {})
    pending = [p for p in PLATFORMS if p not in raw]

    # Skipped pantry items are searched too, in the same batch, only to price
    # what the pantry saves the user.
    names = list(dict.fromkeys([i["name"] for i in pantry["buy_list"]] + [s["name"] for s in pantry["skipped"]]))
    attempt = _bump(sid, "SEARCH")
    emit(
        sid,
        f"Searching {' and '.join(p.replace('_', ' ').title() for p in pending)} for {len(names)} item(s) in parallel"
        + (f" (attempt {attempt})" if attempt > 1 else "")
        + "…",
    )

    results = await asyncio.gather(*[_search_platform(p, names) for p in pending], return_exceptions=True)
    for platform, res in zip(pending, results):
        label = platform.replace("_", " ").title()
        if isinstance(res, BaseException):
            reason = "timed out" if isinstance(res, asyncio.TimeoutError) else sanitize_text(res, 160)
            errors[platform] = reason
            emit(sid, f"{label} search failed: {reason}", "warn")
        else:
            raw[platform] = res
            errors.pop(platform, None)
            found = sum(1 for n in names if res.get(n))
            emit(sid, f"{label}: results for {found}/{len(names)} item(s)", "success")

    _update(sid, comparison={**prior, "raw": raw, "search_errors": errors})

    failed = [p for p in PLATFORMS if p not in raw]
    if not failed:
        return S.COMPARE
    if attempt < MAX_SEARCH_ATTEMPTS:
        _update(sid, recovery={"from": "SEARCH", "action": "retry_search", "reason": errors})
        return S.RECOVER
    if raw:
        # degrade gracefully: continue with the platform that answered
        _update(sid, recovery={"from": "SEARCH", "action": "single_platform", "reason": errors})
        return S.RECOVER
    return _fail(sid, "Both Zepto and Swiggy Instamart are unreachable right now. Please try again shortly.", True)


async def h_recover(sid) -> State | None:
    data = _get(sid)
    rec = data["recovery"] or {}
    action = rec.get("action")

    if action == "retry_search":
        emit(sid, "Retrying the platform that failed…", "warn")
        _update(sid, recovery=None)
        return S.SEARCH

    if action == "single_platform":
        ok = [p for p in PLATFORMS if p in (data["comparison"] or {}).get("raw", {})]
        emit(
            sid,
            f"Continuing with {ok[0].replace('_', ' ').title()} only; the other platform is unavailable.",
            "warn",
        )
        _update(sid, recovery=None)
        return S.COMPARE

    if action == "next_cart":
        cursor = int(rec.get("cursor", 1))
        emit(sid, rec.get("message", "Trying the next-best cart…"), "warn")
        _update(sid, recovery=None, attempts={**data["attempts"], "POLICY_CURSOR": cursor})
        return S.POLICY

    return _fail(sid, f"No recovery available for: {rec}")


async def h_compare(sid) -> State | None:
    data = _get(sid)
    pantry, comp = data["pantry"], data["comparison"]
    raw = comp["raw"]
    emit(sid, "Normalising pack sizes and comparing prices…")

    def resolve(platform: str, items: list[dict]) -> list[dict]:
        resolved = resolver.resolve_all(items, raw.get(platform, {}))
        for r in resolved:
            if "sku_name" in r:
                r["sku_name"] = sanitize_text(r["sku_name"], 120)
            if "pack_size" in r:
                r["pack_size"] = sanitize_text(r["pack_size"], 40)
        return resolved

    buy = pantry["buy_list"]
    resolved = {p: resolve(p, buy) for p in PLATFORMS}

    carts = {}
    for p in PLATFORMS:
        est = PLATFORM_ESTIMATES[p]
        if p in raw:
            carts[p] = PlatformCart.from_resolved(
                p, resolved[p], delivery_fee=est["delivery_fee"], eta_minutes=est["eta_minutes"]
            )
        else:
            # platform failed: an empty cart with everything unavailable, never selectable
            carts[p] = PlatformCart(
                platform=p, delivery_fee=est["delivery_fee"], eta_minutes=est["eta_minutes"],
                unavailable=[i["name"] for i in buy],
            )

    # Price what the pantry saves: cheapest available price per skipped item.
    savings, saved_items = 0.0, []
    for s in pantry["skipped"]:
        prices = []
        for p in PLATFORMS:
            if p in raw:
                r = resolver.resolve_pack_size(s["name"], float(s["quantity"]), s["unit"], raw[p].get(s["name"], []))
                if r["status"] == "available":
                    prices.append(r["total_price"])
        if prices:
            savings += min(prices)
            saved_items.append({"name": s["name"], "amount": round(min(prices), 2)})
    _update(sid, pantry={**pantry, "savings": {"amount": round(savings, 2), "items": saved_items, "estimate": True}})

    _update(
        sid,
        comparison={
            **comp,
            "zepto_items": resolved["zepto"],
            "swiggy_items": resolved["swiggy_instamart"],
            "carts": {p: asdict(c) for p, c in carts.items()},
        },
    )

    for p in PLATFORMS:
        c = carts[p]
        label = p.replace("_", " ").title()
        if p not in raw:
            continue
        msg = f"{label}: {len(c.items)}/{len(buy)} available, item total ₹{c.item_total:.0f}"
        if c.unavailable:
            msg += f" (unavailable: {', '.join(c.unavailable)})"
        emit(sid, msg, "warn" if c.unavailable else "info")
    if pantry["skipped"] and saved_items:
        emit(sid, f"Pantry saves you about ₹{savings:.0f}", "success", data={"savings": saved_items})
    return S.OPTIMIZE


async def h_optimize(sid) -> State | None:
    data = _get(sid)
    comp, intent = data["comparison"], ParsedIntent.model_validate(data["intent"])
    emit(sid, "Choosing the cheapest valid cart…")

    carts = {p: PlatformCart(**c) for p, c in comp["carts"].items()}
    result = optimizer.optimize(carts["zepto"], carts["swiggy_instamart"])
    candidates = [result["recommended"]] + result["alternatives"]

    with SessionLocal() as db:
        mandate = _mandate(db, data["user_id"])
    allowed = allowed_platforms(mandate, intent.platform_pref)
    candidates = [c for c in candidates if cart_platforms(c) <= allowed and cart_items(c)]
    if not candidates:
        return _fail(sid, "None of these items are available on the stores you're allowed to use.")

    # complete carts first, then cheapest
    ranked = sorted(candidates, key=lambda c: (len(c.get("unavailable", [])) > 0, c["total"]))
    best = ranked[0]
    reasoning = (
        result["reasoning"] if best is result["recommended"]
        else f"Best cart within your allowed stores: ₹{best['total']:.0f}"
    )
    _update(sid, ranked_carts=ranked, cart=best, total=best["total"])
    emit(
        sid,
        f"{reasoning}. Fees and ETA are estimates until checkout.",
        "success",
        data={"recommended": best, "alternatives": ranked[1:]},
    )
    return S.POLICY


def _mandate(db: Session, user_id: str) -> SpendMandate | None:
    return (
        db.query(SpendMandate)
        .filter(SpendMandate.user_id == _sid(user_id))
        .order_by(SpendMandate.created_at.desc())
        .first()
    )


async def h_policy(sid) -> State | None:
    data = _get(sid)
    intent = ParsedIntent.model_validate(data["intent"])
    ranked = data["ranked_carts"]
    cursor = int(data["attempts"].get("POLICY_CURSOR", 0))
    emit(sid, "Checking spend limits…")

    with SessionLocal() as db:
        mandate = _mandate(db, data["user_id"])

    cart = ranked[cursor]
    decision = evaluate_policy(
        cart["total"], mandate, intent.budget_cap, partial_cart=bool(cart.get("unavailable"))
    )

    if not decision.allowed:
        emit(sid, "; ".join(decision.reasons), "warn", data=decision.to_dict())
        if cursor + 1 < len(ranked):
            _update(
                sid,
                recovery={
                    "from": "POLICY",
                    "action": "next_cart",
                    "cursor": cursor + 1,
                    "message": "Over the spend cap; trying the next cheapest cart.",
                },
            )
            return S.RECOVER
        return _fail(
            sid,
            f"Every option exceeds your spend cap of ₹{decision.hard_cap:.0f} "
            f"(cheapest is ₹{min(c['total'] for c in ranked):.0f}). Raise the cap or trim the list.",
        )

    _update(sid, cart=cart, total=cart["total"], policy=decision.to_dict())
    emit(sid, "; ".join(decision.reasons), "success", data=decision.to_dict())

    if decision.needs_approval:
        _update(sid, approval_status="pending", status="awaiting_approval")
        return S.APPROVAL
    _update(sid, approval_status="auto_approved")
    emit(sid, "Within your auto-approve limit; proceeding without asking", "success")
    return S.EXECUTE


async def h_approval(sid) -> State | None:
    data = _get(sid)
    status = data["approval_status"]
    if status == "pending":
        cart = data["cart"]
        emit(
            sid,
            f"Approval needed to spend ₹{data['total']:.0f} on "
            + " + ".join(p.replace("_", " ").title() for p in sorted(cart_platforms(cart))),
            "warn",
            data={"cart": cart, "policy": data["policy"], "pantry": data["pantry"]},
            type_="approval",
        )
        return None  # pause until POST /approve
    if status == "approved":
        return S.EXECUTE
    if status == "rejected":
        return S.CANCELLED
    return _fail(sid, f"Unexpected approval status: {status}")


async def h_execute(sid) -> State | None:
    # Cart build + payment-link creation is implemented in the next step.
    return _fail(sid, "Order execution isn't implemented yet (approval was recorded; nothing was purchased).")


async def h_verify(sid) -> State | None:
    return _fail(sid, "Order verification isn't implemented yet.")


HANDLERS: dict[State, Callable[[uuid.UUID], Awaitable[State | None]]] = {
    S.PARSE: h_parse,
    S.PLAN: h_plan,
    S.PANTRY: h_pantry,
    S.SEARCH: h_search,
    S.RECOVER: h_recover,
    S.COMPARE: h_compare,
    S.OPTIMIZE: h_optimize,
    S.POLICY: h_policy,
    S.APPROVAL: h_approval,
    S.EXECUTE: h_execute,
    S.VERIFY: h_verify,
}


# ── Driver ───────────────────────────────────────────────────────────


async def drive(session_id) -> None:
    """Run the state machine until it finishes or pauses for approval."""
    sid = _sid(session_id)
    try:
        while True:
            with SessionLocal() as db:
                state = State(_load(db, sid).state)
            if state in TERMINAL:
                return
            nxt = await HANDLERS[state](sid)
            if nxt is None:
                return  # paused, waiting for the human
            _transition(sid, nxt)
    except Exception as e:  # never leave a session stuck in "running"
        log.exception("agent session %s crashed", sid)
        _fail(sid, f"Unexpected error: {sanitize_text(e, 200)}")


def spawn(session_id) -> None:
    task = asyncio.create_task(drive(session_id))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)


# ── Public API used by the router ────────────────────────────────────


def create_session(db: Session, user_id: str, goal: str) -> AgentSession:
    row = AgentSession(user_id=_sid(user_id), goal=sanitize_text(goal, 500), state="PARSE", status="running")
    row.events = []
    _append_event(row, "state", "PARSE", "info")
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def record_decision(db: Session, session_id, approve: bool) -> AgentSession:
    """Atomically record the human's decision and re-check the hard cap.

    The cap is re-evaluated here from the stored, server-computed total against
    the current mandate, so a stale approval can't exceed the limit.
    """
    row = (
        db.query(AgentSession).filter(AgentSession.id == _sid(session_id)).with_for_update().one_or_none()
    )
    if row is None:
        raise LookupError("session not found")
    if row.status != "awaiting_approval" or row.approval_status != "pending":
        raise ValueError("This session is not waiting for approval.")

    if approve:
        intent = ParsedIntent.model_validate(row.intent)
        decision = evaluate_policy(
            float(row.total), _mandate(db, str(row.user_id)), intent.budget_cap,
            partial_cart=bool((row.cart or {}).get("unavailable")),
        )
        if not decision.allowed:
            raise PermissionError("; ".join(decision.reasons))
        row.approval_status = "approved"
        _append_event(row, "approval", f"You approved ₹{float(row.total):.0f}", "success")
    else:
        row.approval_status = "rejected"
        _append_event(row, "approval", "You declined the order. Nothing was purchased.", "info")
    row.status = "running"
    db.commit()
    db.refresh(row)
    return row
