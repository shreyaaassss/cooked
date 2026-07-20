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
    <div className="bg-white border-2 border-orange-300 rounded-2xl shadow-lg overflow-hidden">
      <div className="bg-orange-50 px-6 py-4 border-b border-orange-200">
        <h3 className="text-lg font-bold text-gray-800">
          Ready to order your <span className="capitalize">{dish}</span>{" "}
          ingredients?
        </h3>
        <p className="text-sm text-gray-500 mt-1">{reasoning}</p>
      </div>

      <div className="p-6">
        {/* Items */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Buying from {PLATFORM_LABELS[platform] || platform}
          </h4>
          <div className="space-y-1.5">
            {recommendation.items.map((item, i) => (
              <div
                key={i}
                className="flex justify-between items-center text-sm py-1"
              >
                <span className="text-gray-700">
                  {item.sku_name || item.ingredient}
                  {item.pack_size && (
                    <span className="text-gray-400 ml-1">
                      ({item.pack_size})
                    </span>
                  )}
                </span>
                <span className="font-medium text-gray-800">
                  ₹{item.total_price?.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Skipped */}
        {skipped.length > 0 && (
          <div className="mb-4 p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-700">
              <span className="font-medium">Skipping {skipped.length} pantry staples:</span>{" "}
              {skipped.map((s) => s.name).join(", ")}
            </p>
          </div>
        )}

        {/* Unavailable */}
        {recommendation.unavailable.length > 0 && (
          <div className="mb-4 p-3 bg-red-50 rounded-lg">
            <p className="text-sm text-red-700">
              <span className="font-medium">Unavailable:</span>{" "}
              {recommendation.unavailable.join(", ")}
            </p>
          </div>
        )}

        {/* Totals */}
        <div className="border-t border-gray-200 pt-4 space-y-1">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Items</span>
            <span>₹{recommendation.item_total.toFixed(0)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-500">
            <span>Delivery fee</span>
            <span>₹{recommendation.delivery_fee.toFixed(0)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-gray-800 pt-2 border-t border-gray-100">
            <span>Total</span>
            <span>₹{recommendation.total.toFixed(0)}</span>
          </div>
          <div className="text-right text-xs text-gray-400">
            Estimated delivery: ~{recommendation.eta} minutes
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 px-4 border border-gray-300 text-gray-600 rounded-xl
                       font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 px-4 bg-orange-500 text-white rounded-xl
                       font-bold hover:bg-orange-600 disabled:opacity-50
                       transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Processing...
              </>
            ) : (
              <>Pay with Prava ₹{recommendation.total.toFixed(0)}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
