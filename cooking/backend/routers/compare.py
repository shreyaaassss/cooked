from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.models.database import get_db
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


class CompareRequest(BaseModel):
    user_id: str = DEMO_USER_ID
    ingredients: list[dict] = Field(
        ...,
        description="Ingredients from recipe decomposition",
    )


@router.post("/prices")
async def compare_prices(req: CompareRequest, db: Session = Depends(get_db)):
    """Full comparison pipeline:
    1. Apply pantry diff (remove staples)
    2. Search both platforms for each ingredient
    3. Resolve pack sizes
    4. Build and compare carts
    5. Return recommendation with reasoning
    """
    # Step 1: Pantry diff
    buy_list, skipped = await apply_pantry_diff(db, req.user_id, req.ingredients)

    if not buy_list:
        return {
            "buy_list": [],
            "skipped": skipped,
            "recommendation": None,
            "reasoning": "All ingredients are pantry staples — nothing to buy!",
        }

    ingredient_names = [i["name"] for i in buy_list]

    # Step 2: Search both platforms
    zepto_search = {}
    swiggy_search = {}
    errors = []

    try:
        zepto_search = await zepto.search_multiple(ingredient_names)
    except Exception as e:
        errors.append(f"Zepto search failed: {e}")

    try:
        swiggy_search = await swiggy.search_multiple(ingredient_names)
    except Exception as e:
        errors.append(f"Swiggy search failed: {e}")

    # Step 3: Resolve pack sizes
    zepto_resolved = resolver.resolve_all(buy_list, zepto_search)
    swiggy_resolved = resolver.resolve_all(buy_list, swiggy_search)

    # Step 4: Build platform carts
    zepto_cart = PlatformCart.from_resolved(
        "zepto", zepto_resolved, delivery_fee=25.0, eta_minutes=14
    )
    swiggy_cart = PlatformCart.from_resolved(
        "swiggy_instamart", swiggy_resolved, delivery_fee=30.0, eta_minutes=19
    )

    # Step 5: Optimize
    result = optimizer.optimize(zepto_cart, swiggy_cart)

    return {
        "buy_list": buy_list,
        "skipped": skipped,
        "zepto_items": zepto_resolved,
        "swiggy_items": swiggy_resolved,
        "recommended": result["recommended"],
        "alternatives": result["alternatives"],
        "reasoning": result["reasoning"],
        "errors": errors if errors else None,
    }
