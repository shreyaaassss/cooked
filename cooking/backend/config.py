import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/cookcart"
)
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "gemini")  # recipe decomposition only: "openai" or "gemini"

# Spend policy defaults, used when the user has no (valid) spend mandate.
# With no mandate every order needs explicit approval and is hard-capped.
DEFAULT_SPEND_CAP = float(os.environ.get("DEFAULT_SPEND_CAP", "1500"))
DEFAULT_AUTO_APPROVE = float(os.environ.get("DEFAULT_AUTO_APPROVE", "0"))

# Per-call timeout for a platform search (seconds)
SEARCH_TIMEOUT = int(os.environ.get("SEARCH_TIMEOUT", "120"))

# Delivery fee / ETA are NOT returned by the search APIs. These are estimates
# until the execute step reads the real numbers from the platform cart.
PLATFORM_ESTIMATES = {
    "zepto": {"delivery_fee": 25.0, "eta_minutes": 14},
    "swiggy_instamart": {"delivery_fee": 30.0, "eta_minutes": 19},
}

# CORS origins
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
