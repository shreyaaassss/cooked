# QuickPick backend — FastAPI + Node (for the Zepto/Swiggy MCP runner scripts).
#
# Pinned to Python 3.12: psycopg2-binary and pydantic-core don't ship
# prebuilt wheels for very new Python releases yet (confirmed the hard way
# locally against 3.14 — don't bump this without checking wheel availability
# first).
FROM python:3.12-slim

# Node 20 LTS, for `node scripts/*-mcp-runner.mjs` subprocess calls.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Pre-install the pinned mcp-remote version so `npx` doesn't fetch it on
# every cold start (see scripts/*-mcp-runner.mjs — pinned to work around a
# newer mcp-remote issuer-mismatch bug against Swiggy's OAuth metadata).
RUN npm install -g mcp-remote@0.1.37

WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# The app is imported as `backend.*` (see main.py), so the package needs to
# live one level up from its own directory — copy the whole repo subtree.
COPY backend backend

EXPOSE 8000

# Railway (and most PaaS) inject $PORT; default to 8000 for local `docker run`.
CMD ["sh", "-c", "python -m uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
