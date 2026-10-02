from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from backend.config import DATABASE_URL

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# create_all() never alters existing tables, so columns added after the first
# deploy are applied here. Every statement is idempotent.
_MIGRATIONS = [
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS agent_session_id UUID",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'not_started'",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_status TEXT DEFAULT 'not_placed'",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_url TEXT",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_ref TEXT",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_orders JSONB",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS failure_state JSONB",
    "ALTER TABLE orders DROP CONSTRAINT IF EXISTS ck_order_status",
    "ALTER TABLE orders ADD CONSTRAINT ck_order_status CHECK (status IN ("
    "'pending_approval','approved','awaiting_user_payment','payment_pending','paid','failed','cancelled'))",
]


def init_db():
    """Create all tables and apply column migrations. Call once at startup."""
    import backend.models  # noqa: F401  (registers every model on Base.metadata)

    Base.metadata.create_all(bind=engine)
    if engine.dialect.name != "postgresql":
        return
    for stmt in _MIGRATIONS:
        with engine.begin() as conn:
            conn.execute(text(stmt))
