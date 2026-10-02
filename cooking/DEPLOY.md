# Deploying QuickPick — Vercel (frontend) + Railway (backend)

This gets the app live for anyone to open and click through: goal parsing, pantry,
price comparison, spend policy, and the approval flow. **Read "What won't work
remotely" below before you deploy anything** — it's not a bug, it's how this
feature is built, and it decides what you can honestly tell judges to expect.

Everything here was tested from this machine before writing it down (Docker build,
container run, real Supabase connection, real `/api/auth/signup`/`login` calls).

---

## What won't work remotely (read this first)

**Zepto and Swiggy ordering only works from the machine that already has a
logged-in MCP session.** The backend talks to Zepto/Swiggy through
`mcp-remote`, which does a real OAuth login via a local browser popup and
stores the resulting tokens in `~/.mcp-auth` on whatever machine runs it.
That's inherently local:

- A Railway container has no browser and no persisted home directory across
  deploys — there's no way to complete that login there.
- Copying `~/.mcp-auth` token files into the container isn't a real fix:
  tokens expire, and even fresh ones won't necessarily work from a different
  server/IP.

**So:** once deployed, the agent will get through PARSE → PLAN → PANTRY, then
fail at SEARCH with a Zepto/Swiggy MCP error — visibly, with a message, not a
silent crash. Everything before that (and the approval/spend-policy logic) is
real and demoable. For a live demo of real ordering, run the backend locally
on a machine that's already authenticated (`node backend/scripts/zepto-mcp-runner.mjs --list-tools`
and the Swiggy equivalent — see `code-run.md`), and either demo it directly or
tunnel it (`cloudflared tunnel --url http://localhost:8000` or `ngrok http 8000`)
and point the deployed frontend at that tunnel URL for the demo window.

---

## 0. Prerequisites

- A GitHub remote for this repo (Railway and Vercel both deploy from a repo).
- A Supabase project (or any Postgres) — already set up if you're continuing
  from this session; `backend/models/schema.sql` has the seed data reference.
- An OpenAI API key (`sk-proj-...`).
- Railway and Vercel accounts, both connected to the same GitHub account/org
  that has this repo.

---

## 1. Get the right Supabase connection string (do this first)

**Important, confirmed by testing:** Supabase's "Direct connection" host
(`db.<ref>.supabase.co`) resolves to an **IPv6-only** address. It works fine
from a Mac with native IPv6, which is why local dev can look fine — but it
**fails with "Network is unreachable"** from Docker's default network and
from most PaaS platforms (Railway included), which don't route IPv6 by
default. Using it here will make the backend crash on startup.

Use the **Session Pooler** connection string instead (IPv4-compatible):

1. Supabase dashboard → your project → **Connect** (top right).
2. Select the **Session pooler** (or **Shared Pooler**) tab, not "Direct connection".
3. Copy the connection string. It looks like:
   `postgresql://postgres.<project-ref>:[YOUR-PASSWORD]@aws-<N>-<region>.pooler.supabase.com:5432/postgres`
4. Replace `[YOUR-PASSWORD]` with the real database password.
5. If the password contains special characters (`@ : / ? # & % $` etc.),
   URL-encode them or the connection string will parse incorrectly. Quick way:
   ```bash
   python3 -c "from urllib.parse import quote; print(quote('your-password-here', safe=''))"
   ```

Keep this final string — you'll paste it into Railway's env vars in step 2.

---

## 2. Backend → Railway

The repo already has `backend/Dockerfile` (Python 3.12 + Node 20, with
`mcp-remote@0.1.37` pre-installed) and a root-level `.dockerignore`. Railway
auto-detects the Dockerfile.

1. **New Project → Deploy from GitHub repo** → pick this repo.
2. In the service's **Settings**:
   - **Root Directory**: the repo root that contains both `backend/` and
     `frontend/` (i.e. the `cooking/` folder, *not* `cooking/backend`) — the
     Dockerfile's `COPY backend backend` line assumes this as the build context.
   - **Dockerfile Path**: `backend/Dockerfile`
3. **Variables** tab — add:
   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the Session Pooler string from step 1 |
   | `OPENAI_API_KEY` | your real key |
   | `LLM_PROVIDER` | `openai` |
   | `FRONTEND_URL` | `http://localhost:3000` for now — you'll update this in step 4 once you have the real Vercel URL |
   | `DEFAULT_SPEND_CAP` | `1500` (or whatever you want as the hard cap with no mandate) |
   | `DEFAULT_AUTO_APPROVE` | `0` |

   Don't set `PORT` — Railway injects it automatically, and the Dockerfile's
   `CMD` already reads `$PORT`.
4. Deploy. Railway gives you a public URL like `https://<service>.up.railway.app`
   (Settings → Networking → **Generate Domain** if it's not there already).
5. Verify: `curl https://<your-railway-url>/health` → `{"status":"ok"}`.
   Also check `/docs` loads (FastAPI's auto-generated API docs).

---

## 3. Frontend → Vercel

1. **Add New Project** → import this same GitHub repo.
2. **Root Directory**: `cooking/frontend` (Vercel auto-detects Next.js once
   you set this).
3. **Environment Variables**:
   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | the Railway URL from step 2 (no trailing slash) |
4. Deploy. Vercel gives you both a stable production URL and a preview URL
   per branch/PR.

---

## 4. Close the loop: CORS

The backend only accepts requests from origins it's told about. Go back to
Railway and update:

- `FRONTEND_URL` → your real Vercel production URL (e.g. `https://quickpick.vercel.app`)
- Optionally add `FRONTEND_URL_REGEX` → a pattern matching your Vercel
  preview URLs too, e.g. `https://quickpick.*\.vercel\.app`, so PR/branch
  previews aren't blocked by CORS. (This env var and the code that reads it
  already exist in `backend/config.py`/`backend/main.py` — no code change
  needed, just set the variable.)

Redeploy the backend for this to take effect, then reload the frontend and
confirm requests succeed (no CORS errors in the browser console).

---

## 5. Smoke test once it's live

From any machine:

```bash
curl -s https://<railway-url>/health
curl -s -X POST https://<railway-url>/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"smoketest","pin":"1234"}'
```

Then open the Vercel URL, sign up through the UI, and try a goal like
*"order 1kg onions and paneer"* — it should get through PARSE, PLAN, PANTRY,
and SEARCH, then fail there with a clear message (per "What won't work
remotely" above). That failure is expected and confirms everything up to the
MCP calls is working correctly.

---

## Known gotchas (all confirmed while testing this guide)

- **IPv6-only direct DB connection** — see step 1. This is the one most
  likely to silently break a deploy if skipped.
- **`UID` is a reserved shell variable name** in zsh/bash — don't use it as a
  variable when scripting curl tests (`UUSER=$(...)` works fine).
- **Python 3.14 (if anyone runs this locally) breaks `psycopg2-binary` and
  `pydantic-core`** — no prebuilt wheels yet for that Python version. The
  Dockerfile pins 3.12 specifically to avoid this; if a friend runs the
  backend locally outside Docker, make sure they're on Python 3.12, not
  whatever `python3` happens to default to on their machine.
- **`mcp-remote` version pin** — `backend/scripts/*-mcp-runner.mjs` are
  pinned to `mcp-remote@0.1.37`; a newer version has a Swiggy OAuth
  issuer-mismatch bug. The Dockerfile pre-installs this exact version.
