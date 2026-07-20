import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/cookcart"
)
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "gemini")  # "openai" or "gemini"

PRAVA_SKILL_VERSION = os.environ.get("PRAVA_SKILL_VERSION", "2.4.0")

# CORS origins
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
