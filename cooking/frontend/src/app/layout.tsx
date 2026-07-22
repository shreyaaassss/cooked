import type { Metadata } from "next";
import { Outfit, Geist_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CookCart - Recipe to Checkout",
  description:
    "Tell us what you want to cook. We find the ingredients, compare prices across Zepto & Swiggy Instamart, and complete the order.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="sticky top-0 z-50 glass" style={{ borderBottom: "1px solid rgba(255,252,248,0.04)" }}>
          <div className="max-w-2xl mx-auto px-5 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent"
              >
                <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
              </svg>
              <span className="text-lg font-semibold text-warm-50 tracking-tight">
                CookCart
              </span>
            </a>
            <div className="flex items-center gap-0.5">
              {[
                { href: "/agent", label: "Agent" },
                { href: "/list", label: "Lists" },
                { href: "/", label: "Cook" },
                { href: "/settings", label: "Settings" },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="px-3 py-1.5 rounded-lg text-warm-400 text-sm font-medium
                             hover:text-warm-50 hover:bg-white/5 transition-all duration-200"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </nav>

        <main className="relative z-10 max-w-2xl mx-auto px-5 py-8 w-full flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
