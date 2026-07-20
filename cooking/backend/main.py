from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import FRONTEND_URL
from backend.models.database import init_db
from backend.routers import address, agent, checkout, compare, orders, pantry, recipe

app = FastAPI(
    title="CookCart API",
    description="Recipe-to-Checkout Grocery Agent powered by Prava Payments",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        "app": "CookCart",
        "version": "1.0.0",
        "description": "Recipe-to-Checkout Grocery Agent",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
