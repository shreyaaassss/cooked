"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, login, signup } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);

  // If already logged in, this page has nothing to do.
  if (typeof window !== "undefined" && getSession()) {
    router.replace("/agent");
  }

  function setDigit(i: number, raw: string) {
    const v = raw.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
    if (v && i < 3) digitRefs.current[i + 1]?.focus();
  }

  function onDigitKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      digitRefs.current[i - 1]?.focus();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pin = digits.join("");
    const uname = username.trim().toLowerCase();
    if (!uname || pin.length !== 4) {
      setError("Enter a username and all 4 PIN digits.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fn = mode === "login" ? login : signup;
      await fn(uname, pin);
      router.push("/agent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setDigits(["", "", "", ""]);
      digitRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="-mx-4 -my-8 min-h-[calc(100vh-57px)] bg-[#262624] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">⚡</div>
          <h1 className="text-2xl font-serif font-light text-[#C2C0B6]">QuickPick</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {mode === "login" ? "Log in to your account" : "Create your account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#30302E] border border-zinc-700 rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="lowercase, numbers, underscore"
              autoComplete="username"
              autoFocus
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100
                         placeholder:text-zinc-600 outline-none focus:border-amber-600/60 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">4-digit PIN</label>
            <div className="flex gap-2">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    digitRefs.current[i] = el;
                  }}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => onDigitKeyDown(i, e)}
                  autoComplete="off"
                  className="w-full aspect-square bg-zinc-800 border border-zinc-700 rounded-lg text-center text-lg
                             text-zinc-100 outline-none focus:border-amber-600/60 transition-colors"
                />
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm
                       font-semibold rounded-lg transition-colors"
          >
            {loading ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
          </button>

          <p className="text-center text-xs text-zinc-500">
            {mode === "login" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
              }}
              className="text-amber-500 hover:text-amber-400 font-medium"
            >
              {mode === "login" ? "Create an account" : "Log in instead"}
            </button>
          </p>
        </form>

        <p className="text-center text-xs text-zinc-600 mt-6 max-w-xs mx-auto">
          Your pantry, spend limits and orders stay separate per account. This is a simple
          username + PIN check — not a hardened login system.
        </p>
      </div>
    </div>
  );
}
