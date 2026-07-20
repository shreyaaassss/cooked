import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50">
        {/* Nav */}
        <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <span className="text-2xl">🛒</span>
              <span className="text-xl font-bold text-gray-800">CookCart</span>
            </a>
            <div className="flex items-center gap-4 text-sm">
              <a
                href="/settings"
                className="text-gray-500 hover:text-gray-800 transition-colors"
              >
                Pantry & Settings
              </a>
              <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                Powered by Prava
              </span>
            </div>
          </div>
        </nav>

        <main className="max-w-3xl mx-auto px-4 py-8 w-full flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
