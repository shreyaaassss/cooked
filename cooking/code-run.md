# CookCart — How to Run

## Prerequisites

- **Python 3.12+**
- **Node.js 18+** (with npm)
- **Supabase** account (for Postgres database)
- **OpenAI API key** (for recipe decomposition and agent chat)
- **Zepto account** (for Zepto grocery ordering)
- **Swiggy account** (for Swiggy Instamart ordering)

---

## 1. Clone the Repository

```bash
git clone https://github.com/shreyaaassss/cooked.git
cd cooked/cooking
```

---

## 2. Backend Setup

### Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
```

### Create the `.env` file

Copy the example and fill in your credentials:

```bash
cp .env.example .env
```

Edit `backend/.env` with your values:

```env
# Database (Supabase Postgres — use the Shared Pooler connection string)
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_DB_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:5432/postgres

# LLM Provider
LLM_PROVIDER=openai

# OpenAI API Key (get from https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-proj-your-key-here

# Prava
PRAVA_SKILL_VERSION=2.4.0

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

> **Finding your Supabase connection string:**
> 1. Go to your Supabase project dashboard
> 2. Click **Connect** (top right)
> 3. Select **Shared Pooler** tab
> 4. Copy the connection string and replace `[YOUR-PASSWORD]` with your database password

### Start the backend

From the `cooking/` directory (not `cooking/backend/`):

```bash
cd ..  # back to cooking/
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Verify it's running:

```bash
curl http://localhost:8000/health
# Should return: {"status":"ok"}
```

---

## 3. Frontend Setup

Open a **new terminal**:

```bash
cd cooked/cooking/frontend
npm install
npm run dev
```

The frontend will be available at **http://localhost:3000**.

---

## 4. Authenticate Zepto & Swiggy MCP

Both Zepto and Swiggy require OAuth authentication before the app can search products and place orders. You need to run the MCP runners once to complete the login flow.

### Authenticate Zepto

From the `cooking/` directory:

```bash
node backend/scripts/zepto-mcp-runner.mjs --list-tools
```

This will:
1. Open your browser automatically to the Zepto login page
2. Log in with your Zepto account
3. Authorize the MCP client
4. Once authorized, the terminal will print the available tools and exit

> The auth token is cached locally — you only need to do this once.

### Authenticate Swiggy Instamart

```bash
node backend/scripts/swiggy-mcp-runner.mjs --list-tools
```

This will:
1. Open your browser to the Swiggy MCP authorization page
2. Log in with your Swiggy account
3. Authorize the MCP client
4. Once authorized, the terminal will print the available tools and exit

> The auth token is cached locally — you only need to do this once.

### Verify authentication works

Test Zepto search:

```bash
node backend/scripts/zepto-mcp-runner.mjs --compact search_products '{"query":"paneer","pageNumber":0}'
```

Test Swiggy search (use an address ID from your Swiggy account):

```bash
node backend/scripts/swiggy-mcp-runner.mjs --compact search_products '{"query":"paneer","addressId":"YOUR_ADDRESS_ID"}'
```

Both should return product listings with prices.

---

## 5. Using the App

Once backend, frontend, and MCP auth are set up:

| URL | Feature |
|---|---|
| http://localhost:3000/agent | **Pantry Agent** — Chat with the AI to order groceries |
| http://localhost:3000 | **Recipe Mode** — Enter a dish name, get ingredients and prices |
| http://localhost:3000/settings | **Settings** — Manage delivery addresses and pantry staples |

### Pantry Agent (main feature)

1. Go to http://localhost:3000/agent
2. Type what groceries you need, e.g.: *"I need 1kg onions, 200g paneer, and milk"*
3. The agent extracts items, searches Zepto and Swiggy, and shows the best prices
4. Click **View Cart** to see the full item breakdown
5. Click **Proceed** to initiate checkout via Prava

### Recipe Mode

1. Go to http://localhost:3000
2. Enter a dish name like *"butter chicken"* and set servings
3. The app decomposes the recipe into ingredients using GPT-4o
4. Compares prices across Zepto and Swiggy Instamart
5. Shows the cheapest option with one-click checkout

---

## Troubleshooting

### "ingredients unavailable" for all items
- Make sure you've completed Zepto and Swiggy MCP authentication (Step 4)
- Check that you have a delivery address set in Settings

### Database connection error
- Verify your `DATABASE_URL` in `.env` uses the **Shared Pooler** format
- Make sure your Supabase database password is correct

### OpenAI 401 error
- Check your `OPENAI_API_KEY` starts with `sk-proj-`
- Verify the key is valid at https://platform.openai.com/api-keys

### `npx` / MCP runner errors on Windows
- Make sure Node.js is installed and `npx` is in your PATH
- The runners use `shell: true` for Windows compatibility — this is handled automatically

### Swiggy search returns 0 products
- Swiggy requires a valid `addressId` for product search
- Go to Settings, check your Swiggy addresses, and make sure one is available
