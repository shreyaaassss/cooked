"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, getSession, type Session } from "@/lib/auth";

const PUBLIC_PATHS = new Set(["/login"]);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null | "checking">("checking");

  useEffect(() => {
    const s = getSession();
    setSession(s);
    if (!s && !PUBLIC_PATHS.has(pathname)) {
      router.replace("/login");
    }
  }, [pathname, router]);

  function handleLogout() {
    clearSession();
    setSession(null);
    router.push("/login");
  }

  // Public pages (just /login) render without the app shell/nav.
  if (PUBLIC_PATHS.has(pathname)) {
    return <>{children}</>;
  }

  // Waiting to know whether there's a session, or redirecting one that
  // doesn't exist — render nothing rather than flash the app shell.
  if (session === "checking" || session === null) {
    return null;
  }

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <span className="text-xl font-bold text-gray-800">QuickPick</span>
          </a>
          <div className="flex items-center gap-1 text-sm">
            <a href="/agent" className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-orange-50 hover:text-orange-600 transition-colors font-medium">
              Agent
            </a>
            <a href="/list" className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-orange-50 hover:text-orange-600 transition-colors font-medium">
              My List
            </a>
            <a href="/" className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-orange-50 hover:text-orange-600 transition-colors font-medium">
              Recipes
            </a>
            <a href="/settings" className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-orange-50 hover:text-orange-600 transition-colors font-medium">
              Settings
            </a>
            <span className="mx-1 w-px h-5 bg-gray-200" />
            <span className="px-2 text-gray-400 font-medium">{session.username}</span>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors font-medium"
            >
              Log out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8 w-full flex-1">{children}</main>
    </>
  );
}
