# CookCart — Project Information & Setup Guide

CookCart is a recipe-to-checkout grocery agent built for the **Prava Agentic Commerce Hackathon**. A user types a dish and serving count, and the system autonomously decomposes the recipe, compares prices across Zepto and Swiggy Instamart, and completes a real paid order using Prava-authorized payment credentials.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Environment Variables](#environment-variables)
4. [Prava Skills Installation (for Coding Agents)](#prava-skills-installation-for-coding-agents)
5. [MCP Server Registration](#mcp-server-registration)
6. [Prava CLI Setup](#prava-cli-setup)
7. [Database Setup (Supabase / Postgres)](#database-setup)
8. [Running the Backend](#running-the-backend)
9. [Running the Frontend](#running-the-frontend)
10. [Full Startup Sequence](#full-startup-sequence)
11. [Agent-Specific Setup Instructions](#agent-specific-setup-instructions)
12. [Project Structure](#project-structure)
13. [API Endpoints Reference](#api-endpoints-reference)
14. [Demo Flow (Butter Chicken Example)](#demo-flow)
15. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
 Next.js Frontend (port 3000)
       |
 FastAPI Backend (port 8000)
       |
  +----+--------+--------+-----------+
  |             |        |           |
Recipe       Pantry   SKU/Price   Prava
Decomp       Diff     Resolver   Checkout
(LLM)      (Postgres)  (MCP)    (CLI/SDK)
                        |
                 +------+------+
                 |             |
            Zepto MCP    Swiggy Instamart MCP
```

**Stack:**
- **Frontend:** Next.js 16 + React 19 + Tailwind CSS 4 + TypeScript
- **Backend:** FastAPI + SQLAlchemy + Pydantic
- **Database:** PostgreSQL (Supabase recommended for fast setup)
- **LLM:** Google Gemini 2.0 Flash (default) or OpenAI GPT-4o
- **Payments:** Prava CLI (`@prava-sdk/cli`) — single-use tokenized card credentials
- **Merchants:** Zepto MCP + Swiggy Instamart MCP (pre-built Prava merchant skills)

---

## Prerequisites

Before starting, make sure you have these installed on your machine:

| Tool | Version | Purpose | Install |
|------|---------|---------|---------|
| **Node.js** | >= 18 | Frontend, MCP tools, Prava CLI | https://nodejs.org |
| **npm** | >= 9 | Package management | Comes with Node.js |
| **npx** | >= 9 | Running MCP tools and skill installer | Comes with npm |
| **Python** | >= 3.11 | Backend | https://python.org |
| **pip** | >= 23 | Python packages | Comes with Python |
| **PostgreSQL** | >= 15 | Database (or use Supabase) | https://supabase.com |
| **Git** | >= 2.0 | Version control | https://git-scm.com |

---

## Environment Variables

### Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and fill in the values:

```bash
cp backend/.env.example backend/.env
```

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://postgres:password@db.xxx.supabase.co:5432/postgres` |
| `LLM_PROVIDER` | Yes | Which LLM to use for recipe decomposition | `gemini` or `openai` |
| `GEMINI_API_KEY` | If using Gemini | Google AI Studio API key | `AIza...` |
| `OPENAI_API_KEY` | If using OpenAI | OpenAI API key | `sk-...` |
| `PRAVA_SKILL_VERSION` | No | Prava skill version (auto-detected) | `2.4.0` |
| `FRONTEND_URL` | No | Frontend URL for CORS (default: `http://localhost:3000`) | `http://localhost:3000` |
| `ZEPTO_MCP_RUNNER` | No | Path to zepto-mcp-runner.mjs (auto-detected if skills installed globally) | `/home/user/.skills/zepto-prava-skill/scripts/zepto-mcp-runner.mjs` |
| `SWIGGY_MCP_RUNNER` | No | Path to swiggy-mcp-runner.mjs (bundled at `backend/scripts/swiggy-mcp-runner.mjs`, auto-detected) | `backend/scripts/swiggy-mcp-runner.mjs` |

**How to get the keys:**
- **Gemini API Key:** Go to https://aistudio.google.com/apikey and create a key.
- **OpenAI API Key:** Go to https://platform.openai.com/api-keys and create a key.
- **Supabase Database URL:** Create a project at https://supabase.com, go to Project Settings > Database, and copy the connection string (use the "Direct connection" URL).

### Frontend (`frontend/.env.local`)

Copy `frontend/.env.local.example` to `frontend/.env.local`:

```bash
cp frontend/.env.local.example frontend/.env.local
```

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | No | Backend API base URL | `http://localhost:8000` |

---

## Prava Skills Installation (for Coding Agents)

**This is the most important section for any coding agent picking up this project.** The Prava skills tell the agent how to interact with Zepto, Swiggy Instamart, and the Prava payment flow. Without them, the agent cannot orchestrate checkout.

### What are Prava Skills?

Prava skills are markdown-based instruction files (`SKILL.md`) that teach coding agents (Claude Code, Codex, Gemini CLI, Cursor, etc.) how to:
- Search products and build carts on Zepto and Swiggy Instamart via MCP
- Create Prava payment sessions and poll for tokenized credentials
- Complete checkout using browser automation with Prava-issued card tokens

### Skills to Install

There are **3 skills** required for this project:

| Skill | Purpose | Repo Path |
|-------|---------|-----------|
| `prava-pay` | Core payment flow: agent linking, session creation, polling, credential issuance | `prava-pay/` |
| `swiggy-prava-skill` | Swiggy ordering: MCP cart building + Prava card checkout via browser automation | `prava-merchants-checkout/swiggy-prava-skill/` |
| `zepto-prava-skill` | Zepto ordering: MCP cart building + Juspay payment link + Prava card checkout | `prava-merchants-checkout/zepto-prava-skill/` |

All skills come from: **https://github.com/Prava-Payments/prava-skills**

### Install Commands (by Agent Platform)

#### Claude Code

```bash
npx skills add https://github.com/Prava-Payments/prava-skills --skill prava-pay --global --yes
npx skills add https://github.com/Prava-Payments/prava-skills --skill swiggy-prava-skill --global --yes
npx skills add https://github.com/Prava-Payments/prava-skills --skill zepto-prava-skill --global --yes
```

#### OpenAI Codex

```bash
npx skills add https://github.com/Prava-Payments/prava-skills --skill prava-pay --agent codex --full-depth --yes
npx skills add https://github.com/Prava-Payments/prava-skills --skill swiggy-prava-skill --agent codex --full-depth --yes
npx skills add https://github.com/Prava-Payments/prava-skills --skill zepto-prava-skill --agent codex --full-depth --yes
```

#### Google Antigravity / Gemini CLI

```bash
npx skills add https://github.com/Prava-Payments/prava-skills --skill prava-pay --agent antigravity --full-depth --yes
npx skills add https://github.com/Prava-Payments/prava-skills --skill swiggy-prava-skill --agent antigravity --full-depth --yes
npx skills add https://github.com/Prava-Payments/prava-skills --skill zepto-prava-skill --agent antigravity --full-depth --yes
```

#### Project-scoped (any agent, current repo only)

```bash
npx skills add https://github.com/Prava-Payments/prava-skills --skill prava-pay --yes
npx skills add https://github.com/Prava-Payments/prava-skills --skill swiggy-prava-skill --yes
npx skills add https://github.com/Prava-Payments/prava-skills --skill zepto-prava-skill --yes
```

### Verify Installation

```bash
npx skills list
```

You should see `prava-pay`, `swiggy-prava-skill`, and `zepto-prava-skill` in the output.

Skills are installed to `.agents/skills/` (project scope) or `~/.skills/` (global scope). Each skill contains:
- `SKILL.md` — Main instructions the agent reads
- `references/` — Detailed setup, checkout protocol, and troubleshooting docs
- `agents/` — Agent-specific config (e.g., `openai.yaml`)
- `scripts/` — Helper scripts (Zepto has `zepto-mcp-runner.mjs` and `zepto-prava-doctor.mjs`). Note: Swiggy's skill does not include a runner script, so CookCart bundles its own at `backend/scripts/swiggy-mcp-runner.mjs`

### Updating Skills

```bash
npx skills update prava-pay -g
npx skills update swiggy-prava-skill -g
npx skills update zepto-prava-skill -g
```

---

## MCP Server Registration

MCP (Model Context Protocol) servers are how the agent communicates with Zepto and Swiggy. The project includes an `mcp.json` at the repo root with server definitions.

### MCP Endpoints

| Server | URL | Purpose |
|--------|-----|---------|
| `zepto` | `https://mcp.zepto.co.in/mcp` | Zepto product search, cart, orders, payment |
| `swiggy-instamart` | `https://mcp.swiggy.com/im` | Swiggy Instamart grocery shopping |
| `swiggy-food` | `https://mcp.swiggy.com/food` | Swiggy Food restaurant ordering |

### Register MCP Servers (by Agent Platform)

#### Claude Code

```bash
claude mcp add --transport stdio zepto -- npx --yes mcp-remote https://mcp.zepto.co.in/mcp
claude mcp add --transport stdio swiggy-instamart -- npx --yes mcp-remote https://mcp.swiggy.com/im
claude mcp add --transport stdio swiggy-food -- npx --yes mcp-remote https://mcp.swiggy.com/food
```

Verify:
```bash
claude mcp list
```

#### OpenAI Codex

```bash
codex mcp add zepto -- npx --yes mcp-remote https://mcp.zepto.co.in/mcp
codex mcp add swiggy-instamart -- npx --yes mcp-remote https://mcp.swiggy.com/im
codex mcp add swiggy-food -- npx --yes mcp-remote https://mcp.swiggy.com/food
```

Verify:
```bash
codex mcp list
```

#### Gemini CLI

Add to your Gemini CLI `settings.json`:

```json
{
  "mcpServers": {
    "zepto": {
      "command": "npx",
      "args": ["--yes", "mcp-remote", "https://mcp.zepto.co.in/mcp"],
      "timeout": 600000,
      "trust": false
    },
    "swiggy-instamart": {
      "command": "npx",
      "args": ["--yes", "mcp-remote", "https://mcp.swiggy.com/im"],
      "timeout": 600000,
      "trust": false
    }
  }
}
```

#### Any other MCP-compatible agent

Use the `mcp.json` file at the project root, or configure stdio MCP servers with:
- **Command:** `npx`
- **Args:** `["--yes", "mcp-remote", "<url>"]`

### Zepto MCP Authentication

Zepto requires OAuth + Indian mobile OTP authentication via `mcp-remote`. When you first connect:

1. The `mcp-remote` bridge prints an authorization URL like `https://auth.zepto.co.in/authorize?...`
2. Open that URL in your browser
3. Complete the Indian mobile number + OTP flow
4. The auth state is cached locally by `mcp-remote`

### Swiggy MCP Authentication

Swiggy MCP may trigger OAuth when first connecting. Follow the authorization URL printed by `mcp-remote` and complete the login flow in your browser.

---

## Prava CLI Setup

The Prava CLI is how the agent creates payment sessions and receives tokenized card credentials. **The user installs it, not the agent.**

### Install

```bash
npm install -g @prava-sdk/cli
```

Verify:
```bash
prava --version
```

### Link Your Agent

This is a one-time setup that connects the agent to the user's Prava wallet:

```bash
# For Claude Code:
prava setup --name "Claude Code" --platform claude-code

# For Codex:
prava setup --name "Codex" --platform codex

# For Gemini CLI:
prava setup --name "Gemini CLI" --platform gemini-cli

# For any other agent:
prava setup --name "My Agent" --platform custom
```

The CLI prints a link URL. Open it in your browser, connect your card, and approve the agent. Then immediately poll:

```bash
prava setup poll
```

### Verify Link

```bash
prava status
```

Should show `Status: active`.

### Supported Platforms

See the full list in the `prava-pay` skill (`references/platforms.md`). Key ones:

| Agent | `--platform` value |
|-------|-------------------|
| Claude Code | `claude-code` |
| Codex | `codex` |
| Cursor | `cursor` |
| Gemini CLI | `gemini-cli` |
| Google Antigravity | `antigravity` (use `custom` if not listed) |
| Windsurf | `windsurf` |
| Cline | `cline` |

### Important Notes

- **Never ask for raw card numbers.** Prava handles all card entry securely.
- **Credentials expire in ~30 minutes.** Move promptly from session creation to checkout.
- **Prava currently supports Visa cards only** (excluding Chase and Ramp). Mastercard/Amex coming soon.
- **US only** for now. India/UPI is not supported at this time.

---

## Database Setup

### Option A: Supabase (Recommended for Hackathon)

1. Go to https://supabase.com and create a new project
2. Go to **Project Settings > Database** and copy the **Direct connection** URL
3. Paste it as `DATABASE_URL` in `backend/.env`
4. Run the schema SQL:
   - Go to **SQL Editor** in the Supabase dashboard
   - Paste the contents of `backend/models/schema.sql`
   - Click **Run**

### Option B: Local PostgreSQL

1. Install PostgreSQL locally
2. Create a database:
   ```bash
   createdb cookcart
   ```
3. Run the schema:
   ```bash
   psql cookcart < backend/models/schema.sql
   ```
4. Set `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cookcart` in `backend/.env`

### Option C: Let SQLAlchemy Create Tables

If you just set the `DATABASE_URL` and start the backend, SQLAlchemy will auto-create tables on startup (via `init_db()` in `main.py`). However, you'll need to manually insert the demo user and seed data — use the `INSERT` statements from `backend/models/schema.sql`.

---

## Running the Backend

```bash
cd backend

# Create virtual environment (recommended)
python -m venv .venv
source .venv/bin/activate      # Linux/Mac
# .venv\Scripts\activate       # Windows

# Install dependencies
pip install -r requirements.txt

# Make sure .env is configured (see Environment Variables section)

# Start the server
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

---

## Running the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local if backend is not at localhost:8000

# Start dev server
npm run dev
```

The app will be available at `http://localhost:3000`.

### Build for Production

```bash
npm run build
npm start
```

---

## Full Startup Sequence

Here's the complete order to get everything running from scratch:

```bash
# 1. Clone the repo
git clone <repo-url> cookcart && cd cookcart

# 2. Install Prava skills (for your coding agent)
npx skills add https://github.com/Prava-Payments/prava-skills --skill prava-pay --global --yes
npx skills add https://github.com/Prava-Payments/prava-skills --skill swiggy-prava-skill --global --yes
npx skills add https://github.com/Prava-Payments/prava-skills --skill zepto-prava-skill --global --yes

# 3. Register MCP servers (example for Claude Code)
claude mcp add --transport stdio zepto -- npx --yes mcp-remote https://mcp.zepto.co.in/mcp
claude mcp add --transport stdio swiggy-instamart -- npx --yes mcp-remote https://mcp.swiggy.com/im

# 4. Install and link Prava CLI
npm install -g @prava-sdk/cli
prava setup --name "Claude Code" --platform claude-code
# Open the printed URL, approve, then:
prava setup poll
prava status  # Should show "active"

# 5. Set up the database
# (Run backend/models/schema.sql against your Postgres/Supabase instance)

# 6. Configure backend environment
cp backend/.env.example backend/.env
# Edit backend/.env with your DATABASE_URL, GEMINI_API_KEY, etc.

# 7. Start the backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000 &

# 8. Start the frontend
cd ../frontend
npm install
cp .env.local.example .env.local
npm run dev

# 9. Open http://localhost:3000 and try "butter chicken for 4"
```

---

## Agent-Specific Setup Instructions

### For Claude Code

```bash
# Skills
npx skills add https://github.com/Prava-Payments/prava-skills --skill prava-pay --global --yes
npx skills add https://github.com/Prava-Payments/prava-skills --skill swiggy-prava-skill --global --yes
npx skills add https://github.com/Prava-Payments/prava-skills --skill zepto-prava-skill --global --yes

# MCP servers
claude mcp add --transport stdio zepto -- npx --yes mcp-remote https://mcp.zepto.co.in/mcp
claude mcp add --transport stdio swiggy-instamart -- npx --yes mcp-remote https://mcp.swiggy.com/im

# Prava
prava setup --name "Claude Code" --platform claude-code
prava setup poll
```

### For OpenAI Codex

```bash
# Skills
npx skills add https://github.com/Prava-Payments/prava-skills --skill prava-pay --agent codex --full-depth --yes
npx skills add https://github.com/Prava-Payments/prava-skills --skill swiggy-prava-skill --agent codex --full-depth --yes
npx skills add https://github.com/Prava-Payments/prava-skills --skill zepto-prava-skill --agent codex --full-depth --yes

# MCP servers
codex mcp add zepto -- npx --yes mcp-remote https://mcp.zepto.co.in/mcp
codex mcp add swiggy-instamart -- npx --yes mcp-remote https://mcp.swiggy.com/im

# Prava
prava setup --name "Codex" --platform codex
prava setup poll
```

### For Google Antigravity / Gemini CLI

```bash
# Skills
npx skills add https://github.com/Prava-Payments/prava-skills --skill prava-pay --agent antigravity --full-depth --yes
npx skills add https://github.com/Prava-Payments/prava-skills --skill swiggy-prava-skill --agent antigravity --full-depth --yes
npx skills add https://github.com/Prava-Payments/prava-skills --skill zepto-prava-skill --agent antigravity --full-depth --yes

# MCP servers — add to your settings.json (see MCP section above)

# Prava
prava setup --name "Gemini CLI" --platform gemini-cli
prava setup poll
```

### For Cursor / Windsurf / Cline / Any Other Agent

```bash
# Skills (project scope)
npx skills add https://github.com/Prava-Payments/prava-skills --skill prava-pay --yes
npx skills add https://github.com/Prava-Payments/prava-skills --skill swiggy-prava-skill --yes
npx skills add https://github.com/Prava-Payments/prava-skills --skill zepto-prava-skill --yes

# MCP servers — configure in your agent's MCP settings using:
#   command: npx
#   args: ["--yes", "mcp-remote", "https://mcp.zepto.co.in/mcp"]
# (see mcp.json at project root for all server definitions)

# Prava — replace platform with your agent's platform ID
prava setup --name "<Agent Name>" --platform <platform-id>
prava setup poll
```

---

## Project Structure

```
cookingcart/
├── information.md              # This file
├── Cookingcart.pdf             # PRD document
├── mcp.json                    # MCP server configuration
├── .gitignore
│
├── backend/                    # FastAPI backend
│   ├── .env.example            # Environment template
│   ├── requirements.txt        # Python dependencies
│   ├── main.py                 # FastAPI app entry point
│   ├── config.py               # Environment config loader
│   ├── scripts/
│   │   └── swiggy-mcp-runner.mjs  # Swiggy MCP runner (mirrors Zepto's runner)
│   ├── models/
│   │   ├── schema.sql          # Raw SQL schema + seed data
│   │   ├── database.py         # SQLAlchemy engine + session
│   │   ├── user.py             # User model
│   │   ├── pantry.py           # PantryStaple model
│   │   ├── mandate.py          # SpendMandate model
│   │   └── order.py            # Order model (with idempotency)
│   ├── services/
│   │   ├── recipe_service.py   # LLM recipe decomposition (Gemini/OpenAI)
│   │   ├── pantry_service.py   # Pantry diff logic
│   │   ├── sku_resolver.py     # Pack-size resolution + unit conversion
│   │   ├── cart_optimizer.py   # Cross-platform cart comparison
│   │   ├── zepto_service.py    # Zepto MCP client (via zepto-mcp-runner.mjs)
│   │   ├── swiggy_service.py   # Swiggy Instamart MCP client (via swiggy-mcp-runner.mjs)
│   │   └── prava_service.py    # Prava CLI wrapper
│   └── routers/
│       ├── recipe.py           # POST /api/recipe/decompose
│       ├── pantry.py           # GET/POST/DELETE /api/pantry/staples
│       ├── compare.py          # POST /api/compare/prices
│       ├── checkout.py         # POST /api/checkout/initiate + /complete
│       └── orders.py           # GET /api/orders/
│
├── frontend/                   # Next.js 16 + React 19 + Tailwind 4
│   ├── .env.local.example      # Environment template
│   ├── package.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx      # Root layout with nav
│   │   │   ├── page.tsx        # Main chat flow (6-step state machine)
│   │   │   └── settings/
│   │   │       └── page.tsx    # Pantry + spend settings
│   │   ├── components/
│   │   │   ├── ChatInput.tsx       # Dish + servings input
│   │   │   ├── RecipeCard.tsx      # Ingredient list + pantry diff
│   │   │   ├── ComparisonTable.tsx # Zepto vs Swiggy side-by-side
│   │   │   ├── ConfirmationCard.tsx# Pre-checkout review
│   │   │   ├── PravaApproval.tsx   # Passkey approval flow
│   │   │   ├── OrderStatus.tsx     # Post-checkout confirmation
│   │   │   ├── PantryManager.tsx   # Manage pantry staples
│   │   │   └── LoadingSpinner.tsx  # Loading states
│   │   └── lib/
│   │       ├── api.ts          # Backend API client
│   │       └── types.ts        # TypeScript type definitions
│   └── ...
│
└── .agents/skills/             # Installed Prava skills (if project-scoped)
    ├── prava-pay/
    ├── swiggy-prava-skill/
    └── zepto-prava-skill/
```

---

## API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | App info |
| `GET` | `/health` | Health check |
| `POST` | `/api/recipe/decompose` | Parse dish + servings into ingredient list |
| `GET` | `/api/pantry/staples` | List user's pantry staples |
| `POST` | `/api/pantry/staples` | Add a pantry staple |
| `DELETE` | `/api/pantry/staples/{name}` | Remove a pantry staple |
| `POST` | `/api/compare/prices` | Full pipeline: pantry diff + search + resolve + compare |
| `GET` | `/api/checkout/prava-status` | Check Prava agent link status |
| `POST` | `/api/checkout/initiate` | Create Prava session + order record |
| `POST` | `/api/checkout/complete/{id}` | Poll Prava + complete platform checkout |
| `GET` | `/api/checkout/order/{id}` | Get order details |
| `GET` | `/api/orders/` | List order history |

Interactive API docs available at `http://localhost:8000/docs` when the backend is running.

---

## Demo Flow

The primary demo is the **butter chicken for 4** example:

```
1. User types: "I'm cooking butter chicken for 4 people"
2. [Recipe Decomposition] LLM returns 13 ingredients with quantities
3. [Pantry Diff] Removes salt, turmeric, cumin seeds → 10 items to buy
4. [SKU Resolution] Maps each to nearest pack size on Zepto + Swiggy
5. [Cart Optimization]
   - Cart A (all Zepto): ~Rs 612, 14 min delivery
   - Cart B (all Swiggy): ~Rs 649, 19 min delivery
   - Cart C (split): Rs 580 items + 2 delivery fees = Rs 630
   → Recommends Cart A (single platform, cheapest total)
6. [Confirmation Card] User reviews items, prices, reasoning
7. [Prava Session] User approves via passkey (Face ID / Touch ID)
8. [Checkout] Tokenized credentials fill the merchant payment form
9. [Result] "Ordered from Zepto — Rs 612, arriving in ~14 minutes"
```

---

## Troubleshooting

### Skills not found after installation

Restart your agent session. Skills are loaded at session start, not mid-session.

### Zepto MCP tools not visible

1. Check if Zepto is configured: look for it in your MCP server list
2. If configured but not visible, use the fallback runner:
   ```bash
   node <skill-dir>/scripts/zepto-mcp-runner.mjs --list-tools
   ```
3. Run the diagnostic:
   ```bash
   node <skill-dir>/scripts/zepto-prava-doctor.mjs
   ```

### Swiggy MCP tools not visible

Swiggy does not ship its own runner script (unlike Zepto). CookCart bundles one at `backend/scripts/swiggy-mcp-runner.mjs`. To test it directly:

1. List available Swiggy Instamart tools:
   ```bash
   node backend/scripts/swiggy-mcp-runner.mjs --list-tools
   ```
2. Test a search:
   ```bash
   node backend/scripts/swiggy-mcp-runner.mjs --compact search_products '{"query":"chicken"}'
   ```
3. Switch to Swiggy Food or Dineout:
   ```bash
   node backend/scripts/swiggy-mcp-runner.mjs --endpoint food --list-tools
   node backend/scripts/swiggy-mcp-runner.mjs --endpoint dineout --list-tools
   ```
4. If `npx` is not found, set `SWIGGY_NPX_PATH=/absolute/path/to/npx` before running.

If auth is stale (you get connection errors), run `npx --yes mcp-remote https://mcp.swiggy.com/im` manually, complete the OAuth flow in your browser, then retry.

### Prava status shows "pending"

The user hasn't approved the agent yet. Re-show the link URL from the most recent `prava setup` output, or check:
```bash
prava status
```
If it prints a `Link:` URL, open it and approve. If it says `Link expired`, run `prava setup` again.

### "Skill update required" error

```bash
npx skills update prava-pay -g
npx skills update swiggy-prava-skill -g
npx skills update zepto-prava-skill -g
```
Then restart your agent session.

### Database connection errors

- Verify `DATABASE_URL` in `backend/.env`
- Supabase: make sure you're using the **Direct connection** URL, not the pooler
- Local: make sure PostgreSQL is running and the database exists

### LLM errors (recipe decomposition)

- Verify your `GEMINI_API_KEY` or `OPENAI_API_KEY` is valid
- Check that `LLM_PROVIDER` matches the key you provided (`gemini` or `openai`)
- Gemini free tier has rate limits — wait and retry if you hit them

### Frontend can't reach backend

- Verify backend is running on port 8000
- Check `NEXT_PUBLIC_API_URL` in `frontend/.env.local`
- Check browser console for CORS errors — the backend allows `localhost:3000` by default
