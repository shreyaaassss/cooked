from sqlalchemy.orm import Session
from backend.models.pantry import PantryStaple


async def apply_pantry_diff(
    db: Session,
    user_id: str,
    ingredients: list[dict],
) -> tuple[list[dict], list[dict]]:
    """Remove pantry staples from ingredient list.

    Returns (buy_list, skipped_items).
    """
    staples = (
        db.query(PantryStaple)
        .filter(PantryStaple.user_id == user_id, PantryStaple.always_have.is_(True))
        .all()
    )
    staple_names = {s.ingredient_name.lower() for s in staples}

    buy_list: list[dict] = []
    skipped: list[dict] = []

    for ingredient in ingredients:
        name_lower = ingredient["name"].lower()
        if name_lower in staple_names or ingredient.get("is_common_staple", False):
            skipped.append(
                {
                    **ingredient,
                    "skip_reason": (
                        "pantry staple"
                        if name_lower in staple_names
                        else "common staple"
                    ),
                }
            )
        else:
            buy_list.append(ingredient)

    return buy_list, skipped


async def get_user_staples(db: Session, user_id: str) -> list[dict]:
    """Get all pantry staples for a user."""
    staples = (
        db.query(PantryStaple).filter(PantryStaple.user_id == user_id).all()
    )
    return [
        {
            "id": str(s.id),
            "ingredient_name": s.ingredient_name,
            "always_have": s.always_have,
        }
        for s in staples
    ]


async def add_staple(db: Session, user_id: str, ingredient_name: str) -> dict:
    """Add a pantry staple for a user."""
    staple = PantryStaple(
        user_id=user_id,
        ingredient_name=ingredient_name.lower().strip(),
        always_have=True,
    )
    db.add(staple)
    db.commit()
    db.refresh(staple)
    return {
        "id": str(staple.id),
        "ingredient_name": staple.ingredient_name,
        "always_have": staple.always_have,
    }


async def remove_staple(db: Session, user_id: str, ingredient_name: str) -> bool:
    """Remove a pantry staple."""
    rows = (
        db.query(PantryStaple)
        .filter(
            PantryStaple.user_id == user_id,
            PantryStaple.ingredient_name == ingredient_name.lower().strip(),
        )
        .delete()
    )
    db.commit()
    return rows > 0
