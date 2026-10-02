-- CookCart Database Schema
-- Run this against your Supabase/Postgres instance

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Pantry staples (user's always-have items)
CREATE TABLE IF NOT EXISTS pantry_staples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ingredient_name TEXT NOT NULL,
    always_have BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, ingredient_name)
);

-- Spend mandates
CREATE TABLE IF NOT EXISTS spend_mandates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    platform_scope TEXT CHECK (platform_scope IN ('zepto', 'swiggy_instamart', 'both')),
    cap_amount DECIMAL(10,2) NOT NULL,
    auto_approve_threshold DECIMAL(10,2) NOT NULL,
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Orders (with idempotency)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    source_recipe TEXT NOT NULL,
    ingredients_requested JSONB NOT NULL,
    ingredients_skipped JSONB,
    platform_chosen TEXT CHECK (platform_chosen IN ('zepto', 'swiggy_instamart')),
    cart_items JSONB,
    total_amount DECIMAL(10,2),
    delivery_fee DECIMAL(10,2),
    status TEXT CHECK (status IN (
        'pending_approval', 'approved', 'awaiting_user_payment',
        'payment_pending', 'paid', 'failed', 'cancelled'
    )) DEFAULT 'pending_approval',
    agent_session_id UUID,
    payment_status TEXT DEFAULT 'not_started',
    order_status TEXT DEFAULT 'not_placed',
    payment_url TEXT,
    payment_ref TEXT,
    platform_order_id TEXT,
    platform_orders JSONB,
    failure_state JSONB,
    idempotency_key TEXT UNIQUE,
    eta_minutes INT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Agent sessions (persistent agent state; the app creates this via SQLAlchemy create_all)
CREATE TABLE IF NOT EXISTS agent_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'PARSE',
    status TEXT NOT NULL DEFAULT 'running',
    intent JSONB, plan JSONB, pantry JSONB, comparison JSONB,
    ranked_carts JSONB, cart JSONB,
    total DECIMAL(10,2),
    policy JSONB,
    approval_status TEXT DEFAULT 'not_required',
    recovery JSONB,
    attempts JSONB DEFAULT '{}',
    order_id UUID,
    errors JSONB DEFAULT '[]',
    events JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pantry_user ON pantry_staples(user_id);
CREATE INDEX IF NOT EXISTS idx_mandates_user ON spend_mandates(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key);

-- Seed default pantry staples for demo user
INSERT INTO users (id, name, email) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Demo User', 'demo@cookcart.app')
ON CONFLICT (email) DO NOTHING;

INSERT INTO pantry_staples (user_id, ingredient_name, always_have) VALUES
    ('00000000-0000-0000-0000-000000000001', 'salt', true),
    ('00000000-0000-0000-0000-000000000001', 'turmeric', true),
    ('00000000-0000-0000-0000-000000000001', 'cumin seeds', true),
    ('00000000-0000-0000-0000-000000000001', 'black pepper', true),
    ('00000000-0000-0000-0000-000000000001', 'cooking oil', true),
    ('00000000-0000-0000-0000-000000000001', 'sugar', true)
ON CONFLICT (user_id, ingredient_name) DO NOTHING;

INSERT INTO spend_mandates (user_id, platform_scope, cap_amount, auto_approve_threshold) VALUES
    ('00000000-0000-0000-0000-000000000001', 'both', 800.00, 500.00)
ON CONFLICT DO NOTHING;
