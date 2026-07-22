"use client";

import { useState } from "react";
import type { CompareResult, ResolvedSKU } from "@/lib/types";

interface ComparisonTableProps {
  data: CompareResult;
}

const PLATFORM_NAMES: Record<string, string> = {
  zepto: "Zepto",
  swiggy_instamart: "Swiggy Instamart",
};

function formatPrice(price?: number) {
  if (price == null) return "\u2014";
  return `\u20B9${price.toFixed(0)}`;
}

/* ── Platform summary card ── */
function PlatformCard({
  platform,
  total,
  deliveryFee,
  itemCount,
  eta,
  isWinner,
}: {
  platform: string;
  total: number;
  deliveryFee: number;
  itemCount: number;
  eta: number;
  isWinner: boolean;
}) {
  const isZepto = platform === "zepto";
  const colorText = isZepto ? "text-zepto" : "text-swiggy";

  return (
    <div
      className={`flex-1 rounded-xl p-4 transition-all duration-300 ${
        isWinner ? "glass glass-winner" : "glass opacity-60"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${
            isWinner ? colorText : "text-warm-400"
          }`}
        >
          {PLATFORM_NAMES[platform] || platform}
        </span>
        {isWinner && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ok/10 text-ok text-[10px] font-semibold uppercase tracking-wide">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Best
          </span>
        )}
      </div>

      <div
        className={`text-2xl font-bold tracking-tight ${
          isWinner ? "text-warm-50" : "text-warm-400"
        }`}
      >
        {formatPrice(total)}
      </div>

      <div className="flex items-center gap-3 mt-2 text-[11px] text-warm-400">
        <span className="flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 7V5a4 4 0 00-8 0v2" />
          </svg>
          {itemCount} items
        </span>
        <span className="flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          ~{eta} min
        </span>
        <span>+{formatPrice(deliveryFee)} delivery</span>
      </div>
    </div>
  );
}

/* ── Item comparison row ── */
function ItemRow({
  name,
  needed,
  zeptoSku,
  swiggySku,
}: {
  name: string;
  needed: string;
  zeptoSku: ResolvedSKU;
  swiggySku: ResolvedSKU;
}) {
  const zPrice = zeptoSku.total_price ?? Infinity;
  const sPrice = swiggySku.total_price ?? Infinity;
  const zAvail = zeptoSku.status === "available";
  const sAvail = swiggySku.status === "available";

  let winner: "zepto" | "swiggy" | "tie" | "none" = "none";
  if (zAvail && sAvail) {
    winner = zPrice < sPrice ? "zepto" : sPrice < zPrice ? "swiggy" : "tie";
  } else if (zAvail) winner = "zepto";
  else if (sAvail) winner = "swiggy";

  return (
    <div className="flex items-center py-2.5 px-3 rounded-lg hover:bg-white/[0.02] transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-warm-100 font-medium truncate">{name}</p>
        {needed && <p className="text-[11px] text-warm-600 mt-0.5">{needed}</p>}
      </div>

      <div
        className={`w-20 text-right text-sm ${
          winner === "zepto" ? "text-zepto font-semibold" : "text-warm-400"
        }`}
      >
        {zAvail ? formatPrice(zPrice) : <span className="text-[10px] text-danger/50">N/A</span>}
      </div>

      <div
        className={`w-20 text-right text-sm ${
          winner === "swiggy" ? "text-swiggy font-semibold" : "text-warm-400"
        }`}
      >
        {sAvail ? formatPrice(sPrice) : <span className="text-[10px] text-danger/50">N/A</span>}
      </div>

      <div className="w-5 ml-2 flex justify-center">
        {winner === "zepto" && <div className="w-1.5 h-1.5 rounded-full bg-zepto" />}
        {winner === "swiggy" && <div className="w-1.5 h-1.5 rounded-full bg-swiggy" />}
        {winner === "tie" && <div className="w-1.5 h-1.5 rounded-full bg-warm-600" />}
      </div>
    </div>
  );
}

/* ── Main component ── */
export default function ComparisonTable({ data }: ComparisonTableProps) {
  const [expanded, setExpanded] = useState(false);
  const { zepto_items, swiggy_items, recommended, alternatives, reasoning } = data;

  const allCarts = [recommended, ...alternatives];
  const zeptoCart = allCarts.find((c) => c.platform === "zepto");
  const swiggyCart = allCarts.find((c) => c.platform === "swiggy_instamart");

  const zeptoItemTotal = zepto_items
    .filter((i) => i.status === "available")
    .reduce((s, i) => s + (i.total_price || 0), 0);
  const swiggyItemTotal = swiggy_items
    .filter((i) => i.status === "available")
    .reduce((s, i) => s + (i.total_price || 0), 0);

  const zTotal = zeptoCart?.total ?? zeptoItemTotal + 25;
  const sTotal = swiggyCart?.total ?? swiggyItemTotal + 30;
  const zCount = zepto_items.filter((i) => i.status === "available").length;
  const sCount = swiggy_items.filter((i) => i.status === "available").length;
  const zDelivery = zeptoCart?.delivery_fee ?? 25;
  const sDelivery = swiggyCart?.delivery_fee ?? 30;
  const zEta = zeptoCart?.eta ?? 14;
  const sEta = swiggyCart?.eta ?? 19;

  const winnerPlatform = zTotal <= sTotal ? "zepto" : "swiggy_instamart";
  const savings = Math.abs(zTotal - sTotal);

  // Paired rows
  const names = new Set([
    ...zepto_items.map((i) => i.ingredient),
    ...swiggy_items.map((i) => i.ingredient),
  ]);
  const zMap = Object.fromEntries(zepto_items.map((i) => [i.ingredient, i]));
  const sMap = Object.fromEntries(swiggy_items.map((i) => [i.ingredient, i]));
  const empty: ResolvedSKU = { ingredient: "", status: "unavailable" };

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,252,248,0.04)" }}>
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <h3 className="text-base font-semibold text-warm-50">
            Price Comparison
          </h3>
        </div>
        <p className="text-warm-400 text-xs mt-1">{reasoning}</p>
      </div>

      {/* Platform cards */}
      <div className="p-5">
        <div className="flex gap-3">
          <PlatformCard
            platform="zepto"
            total={zTotal}
            deliveryFee={zDelivery}
            itemCount={zCount}
            eta={zEta}
            isWinner={winnerPlatform === "zepto"}
          />
          <PlatformCard
            platform="swiggy_instamart"
            total={sTotal}
            deliveryFee={sDelivery}
            itemCount={sCount}
            eta={sEta}
            isWinner={winnerPlatform === "swiggy_instamart"}
          />
        </div>

        {/* Savings */}
        {savings > 0 && (
          <div
            className="mt-3 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-ok/5"
            style={{ border: "1px solid rgba(52,211,153,0.1)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ok">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
            <span className="text-ok text-xs font-semibold">
              Save {formatPrice(savings)} with{" "}
              {PLATFORM_NAMES[winnerPlatform]}
            </span>
          </div>
        )}
      </div>

      {/* Item breakdown toggle */}
      <div style={{ borderTop: "1px solid rgba(255,252,248,0.04)" }}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-5 py-3 text-warm-400 hover:text-warm-300 transition-colors"
        >
          <span className="text-xs font-semibold uppercase tracking-wider">
            Item Breakdown
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {expanded && (
          <div className="px-5 pb-5 animate-in">
            {/* Column labels */}
            <div className="flex items-center py-2 px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-warm-600">
              <div className="flex-1">Item</div>
              <div className="w-20 text-right text-zepto/60">Zepto</div>
              <div className="w-20 text-right text-swiggy/60">Swiggy</div>
              <div className="w-5 ml-2" />
            </div>

            <div className="space-y-0.5">
              {[...names].map((name) => {
                const z = zMap[name] || { ...empty, ingredient: name };
                const s = sMap[name] || { ...empty, ingredient: name };
                return (
                  <ItemRow
                    key={name}
                    name={name}
                    needed={z.needed || s.needed || ""}
                    zeptoSku={z}
                    swiggySku={s}
                  />
                );
              })}
            </div>

            {/* Delivery row */}
            <div
              className="flex items-center py-2.5 px-3 mt-2 rounded-lg text-warm-400"
              style={{ borderTop: "1px solid rgba(255,252,248,0.04)" }}
            >
              <div className="flex-1 text-xs font-medium">Delivery Fee</div>
              <div className="w-20 text-right text-xs">{formatPrice(zDelivery)}</div>
              <div className="w-20 text-right text-xs">{formatPrice(sDelivery)}</div>
              <div className="w-5 ml-2" />
            </div>

            {/* Total row */}
            <div className="flex items-center py-2.5 px-3 rounded-lg text-warm-50 font-semibold">
              <div className="flex-1 text-sm">Total</div>
              <div className={`w-20 text-right text-sm ${winnerPlatform === "zepto" ? "text-zepto" : ""}`}>
                {formatPrice(zTotal)}
              </div>
              <div className={`w-20 text-right text-sm ${winnerPlatform === "swiggy_instamart" ? "text-swiggy" : ""}`}>
                {formatPrice(sTotal)}
              </div>
              <div className="w-5 ml-2" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
