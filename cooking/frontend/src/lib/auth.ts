"use client";

/**
 * Client-side session for the username+PIN auth in backend/routers/auth.py.
 *
 * No cookies/JWT: login just returns a user_id, which is held in
 * localStorage and sent as `user_id` on every API call from here on (the
 * same parameter every backend endpoint already filters its queries by).
 * That's real separate accounts and real per-user data, but it is NOT a
 * hardened session — there's no server-side session to revoke, and anyone
 * who learns another user's id could use it. Fine for a hackathon demo with
 * trusted users; don't expose this publicly without real sessions.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const STORAGE_KEY = "quickpick_session";

export interface Session {
  user_id: string;
  username: string;
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function getCurrentUserId(): string | undefined {
  return getSession()?.user_id;
}

function setSession(session: Session) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* private browsing / storage disabled — session just won't persist across reloads */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

async function authRequest(path: string, username: string, pin: string): Promise<Session> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, pin }),
  });
  const body = await res.json().catch(() => ({ detail: res.statusText }));
  if (!res.ok) throw new Error(body.detail || `Request failed: ${res.status}`);
  setSession(body);
  return body as Session;
}

export function signup(username: string, pin: string) {
  return authRequest("/api/auth/signup", username, pin);
}

export function login(username: string, pin: string) {
  return authRequest("/api/auth/login", username, pin);
}
