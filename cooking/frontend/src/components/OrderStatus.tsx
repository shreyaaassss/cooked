"use client";

import type { ResolvedSKU, SkippedItem } from "@/lib/types";

interface OrderStatusProps {
  orderId: string;
  dish: string;
  platform: string;
  items: ResolvedSKU[];
  skipped: SkippedItem[];
  total: number;
  status: string;
  eta?: number | null;
  onNewOrder: () => void;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  paid: { label: "Order Placed", color: "bg-green-500", icon: "✅" },
  payment_pending: {
    label: "Payment Processing",
    color: "bg-yellow-500",
    icon: "⏳",
  },
  approved: { label: "Approved", color: "bg-blue-500", icon: "👍" },
  failed: { label: "Failed", color: "bg-red-500", icon: "❌" },
  cancelled: { label: "Cancelled", color: "bg-gray-500", icon: "🚫" },
  pending_approval: {
    label: "Awaiting Approval",
    color: "bg-orange-500",
    icon: "🔐",
  },
};

export default function OrderStatus({
  orderId,
  dish,
  platform,
  items,
  skipped,
  total,
  status,
  eta,
  onNewOrder,
}: OrderStatusProps) {
  const statusInfo = STATUS_CONFIG[status] || {
    label: status,
    color: "bg-gray-500",
    icon: "❓",
  };
  const platformLabel =
    platform === "zepto" ? "Zepto" : "Swiggy Instamart";
  const isPaid = status === "paid";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-md overflow-hidden">
      {/* Header */}
      <div
        className={`${isPaid ? "bg-gradient-to-r from-green-500 to-emerald-500" : "bg-gradient-to-r from-gray-500 to-gray-600"} px-6 py-5`}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">{statusInfo.icon}</span>
          <div>
            <h3 className="text-xl font-bold text-white">
              {statusInfo.label}
            </h3>
            <p className="text-white/80 text-sm">
              {isPaid
                ? `Your ${dish} ingredients are on the way from ${platformLabel}!`
                : `Order for ${dish} ingredients`}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Order details */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs text-gray-400 uppercase">Platform</p>
            <p className="font-medium text-gray-800">{platformLabel}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase">Total</p>
            <p className="font-bold text-xl text-gray-800">
              ₹{total.toFixed(0)}
            </p>
          </div>
          {eta && (
            <div>
              <p className="text-xs text-gray-400 uppercase">ETA</p>
              <p className="font-medium text-gray-800">~{eta} minutes</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400 uppercase">Order ID</p>
            <p className="font-mono text-xs text-gray-500">
              {orderId.slice(0, 8)}...
            </p>
          </div>
        </div>

        {/* Items */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">
            Items Ordered ({items.length})
          </h4>
          <div className="space-y-1.5">
            {items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-700">
                  {item.sku_name || item.ingredient}
                </span>
                <span className="text-gray-500">
                  ₹{item.total_price?.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Skipped */}
        {skipped.length > 0 && (
          <div className="p-3 bg-green-50 rounded-lg mb-6">
            <p className="text-sm text-green-700">
              Skipped {skipped.length} pantry staples:{" "}
              {skipped.map((s) => s.name).join(", ")}
            </p>
          </div>
        )}

        {/* New order */}
        <button
          onClick={onNewOrder}
          className="w-full py-3 px-4 bg-orange-500 text-white font-bold rounded-xl
                     hover:bg-orange-600 transition-colors"
        >
          Cook something else
        </button>
      </div>
    </div>
  );
}
