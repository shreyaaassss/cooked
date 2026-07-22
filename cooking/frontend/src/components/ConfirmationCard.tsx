"use client";

import type { CartRecommendation, SkippedItem } from "@/lib/types";

interface ConfirmationCardProps {
  recommendation: CartRecommendation;
  skipped: SkippedItem[];
  dish: string;
  reasoning: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const PLATFORM_LABELS: Record<string, string> = {
  zepto: "Zepto",
  swiggy_instamart: "Swiggy Instamart",
};

export default function ConfirmationCard({
  recommendation,
  skipped,
  dish,
  reasoning,
  onConfirm,
  onCancel,
  loading,
}: ConfirmationCardProps) {
  const platform = recommendation.platform || "zepto";

  return (
    <div className="glass glass-accent rounded-2xl overflow-hidden">
      <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,252,248,0.04)" }}>
        <div className="flex items-center gap-2 mb-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
            <rect x="1" y="4" width="22" height="16" rx="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          <h3 className="text-base font-semibold text-warm-50">
            Ready to order <span className="capitalize">{dish}</span>?
          </h3>
        </div>
        <p className="text-warm-400 text-xs">{reasoning}</p>
      </div>

      <div className="p-5">
        {/* Items */}
        <div className="mb-4">
          <h4 className="text-[11px] font-semibold text-warm-600 uppercase tracking-wider mb-2">
            From {PLATFORM_LABELS[platform] || platform}
          </h4>
          <div className="space-y-1">
            {recommendation.items.map((item, i) => (
              <div
                key={i}
                className="flex justify-between items-center py-1.5 px-3 rounded-lg
                           hover:bg-white/[0.02] transition-colors"
              >
                <div className="min-w-0">
                  <span className="text-sm text-warm-100 truncate block">
                    {item.sku_name || item.ingredient}
                  </span>
                  {item.pack_size && (
                    <span className="text-[11px] text-warm-600">
                      {item.pack_size}
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium text-warm-50 ml-4 flex-shrink-0">
                  &#8377;{item.total_price?.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Skipped */}
        {skipped.length > 0 && (
          <div
            className="mb-4 p-3 rounded-lg bg-ok/5"
            style={{ border: "1px solid rgba(52,211,153,0.1)" }}
          >
            <p className="text-xs text-ok/80">
              <span className="font-semibold">
                Skipping {skipped.length} pantry staples:
              </span>{" "}
              {skipped.map((s) => s.name).join(", ")}
            </p>
          </div>
        )}

        {/* Unavailable */}
        {recommendation.unavailable.length > 0 && (
          <div
            className="mb-4 p-3 rounded-lg bg-danger/5"
            style={{ border: "1px solid rgba(248,113,113,0.1)" }}
          >
            <p className="text-xs text-danger/80">
              <span className="font-semibold">Unavailable:</span>{" "}
              {recommendation.unavailable.join(", ")}
            </p>
          </div>
        )}

        {/* Totals */}
        <div className="pt-4 space-y-2" style={{ borderTop: "1px solid rgba(255,252,248,0.04)" }}>
          <div className="flex justify-between text-xs text-warm-400">
            <span>Items</span>
            <span>&#8377;{recommendation.item_total.toFixed(0)}</span>
          </div>
          <div className="flex justify-between text-xs text-warm-400">
            <span>Delivery</span>
            <span>&#8377;{recommendation.delivery_fee.toFixed(0)}</span>
          </div>
          <div
            className="flex justify-between text-base font-bold text-warm-50 pt-2"
            style={{ borderTop: "1px solid rgba(255,252,248,0.04)" }}
          >
            <span>Total</span>
            <span>&#8377;{recommendation.total.toFixed(0)}</span>
          </div>
          <div className="text-right text-[11px] text-warm-600 flex items-center justify-end gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            ~{recommendation.eta} min delivery
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 px-4 rounded-xl text-sm font-medium
                       text-warm-400 hover:bg-white/5 hover:text-warm-300
                       disabled:opacity-30 transition-all duration-200"
            style={{ border: "1px solid rgba(255,252,248,0.06)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 px-4 rounded-xl text-sm font-bold
                       bg-accent text-deep hover:bg-accent-dim
                       disabled:opacity-30 transition-all duration-200
                       flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="1" y="4" width="22" height="16" rx="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
                Pay &#8377;{recommendation.total.toFixed(0)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
