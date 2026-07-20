import json
from backend.config import LLM_PROVIDER, OPENAI_API_KEY, GEMINI_API_KEY

RECIPE_SYSTEM_PROMPT = """You are a precise cooking ingredient calculator.
Given a dish name and serving count, return a JSON object with the recipe decomposition.

Output format (strict JSON):
{
  "dish": "butter chicken",
  "servings": 4,
  "ingredients": [
    {
      "name": "boneless chicken thighs",
      "quantity": 600,
      "unit": "g",
      "category": "protein",
      "is_common_staple": false
    },
    {
      "name": "salt",
      "quantity": 0,
      "unit": "to taste",
      "category": "seasoning",
      "is_common_staple": true
    }
  ]
}

Rules:
- Scale quantities precisely for the given serving count
- Mark common pantry staples (salt, pepper, cooking oil, sugar, turmeric, cumin seeds, black pepper, mustard seeds) as is_common_staple: true
- Use metric units (g, ml, pieces) for consistency
- Include ALL ingredients, even garnishes
- Be specific about cuts/types (e.g., "boneless chicken thighs" not just "chicken")
- quantity must be a number (use 0 for "to taste" items)
- category should be one of: protein, dairy, vegetable, spice, grain, condiment, seasoning, other
"""


async def decompose_recipe(dish: str, servings: int) -> dict:
    """Parse a dish name + serving count into structured ingredient list."""
    user_msg = f"Dish: {dish}, Servings: {servings}"

    if LLM_PROVIDER == "gemini":
        return await _call_gemini(user_msg)
    else:
        return await _call_openai(user_msg)


async def _call_gemini(user_msg: str) -> dict:
    import google.generativeai as genai

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(
        "gemini-2.0-flash",
        system_instruction=RECIPE_SYSTEM_PROMPT,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.2,
        ),
    )
    response = model.generate_content(user_msg)
    return json.loads(response.text)


async def _call_openai(user_msg: str) -> dict:
    from openai import OpenAI

    client = OpenAI(api_key=OPENAI_API_KEY)
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": RECIPE_SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    return json.loads(response.choices[0].message.content)
