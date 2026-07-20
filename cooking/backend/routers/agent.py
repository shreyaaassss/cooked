from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.models.database import get_db
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
