from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.services.recipe_service import decompose_recipe

router = APIRouter()


class RecipeRequest(BaseModel):
    dish: str = Field(..., examples=["butter chicken"])
    servings: int = Field(default=4, ge=1, le=20)


class Ingredient(BaseModel):
    name: str
    quantity: float
    unit: str
    category: str
    is_common_staple: bool = False


class RecipeResponse(BaseModel):
    dish: str
    servings: int
    ingredients: list[dict]


@router.post("/decompose", response_model=RecipeResponse)
async def decompose(req: RecipeRequest):
    """Parse a natural-language dish + serving count into a structured ingredient list.

    Uses an LLM to decompose the recipe into precise, quantity-scaled ingredients.
    """
    result = await decompose_recipe(req.dish, req.servings)
    return RecipeResponse(
        dish=result.get("dish", req.dish),
        servings=result.get("servings", req.servings),
        ingredients=result.get("ingredients", []),
    )
