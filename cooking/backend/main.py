from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import FRONTEND_URL, FRONTEND_URL_REGEX
from backend.models.database import init_db
from backend.routers import address, agent, auth, checkout, compare, orders, pantry, recipe

app = FastAPI(
    title="QuickPick API",
    description="Autonomous grocery agent (Zepto + Swiggy Instamart)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    # Vercel gives every branch/PR its own preview URL in addition to the
    # stable production one; an exact-match allowlist alone would break
    # those. FRONTEND_URL_REGEX (unset by default) lets deploys opt into
    # matching a pattern, e.g. https://quickpick.*\.vercel\.app
    allow_origin_regex=FRONTEND_URL_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(agent.router, prefix="/api/agent", tags=["agent"])
app.include_router(address.router, prefix="/api/address", tags=["address"])
app.include_router(recipe.router, prefix="/api/recipe", tags=["recipe"])
app.include_router(pantry.router, prefix="/api/pantry", tags=["pantry"])
app.include_router(compare.router, prefix="/api/compare", tags=["compare"])
app.include_router(checkout.router, prefix="/api/checkout", tags=["checkout"])
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])


@app.on_event("startup")
async def startup():
    init_db()


@app.get("/")
async def root():
    return {
        "app": "QuickPick",
        "version": "1.0.0",
        "description": "Recipe-to-Checkout Grocery Agent",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
