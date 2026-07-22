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

function StatusIcon({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ok">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    );
  }
  if (status === "failed") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

const STATUS_LABELS: Record<string, string> = {
  paid: "Order Placed",
  payment_pending: "Payment Processing",
  approved: "Approved",
  failed: "Failed",
  cancelled: "Cancelled",
  pending_approval: "Awaiting Approval",
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
  const label = STATUS_LABELS[status] || status;
  const platformLabel = platform === "zepto" ? "Zepto" : "Swiggy Instamart";
  const isPaid = status === "paid";
  const statusColor = isPaid ? "text-ok" : status === "failed" ? "text-danger" : "text-amber-400";

  return (
    <div
      className="glass rounded-2xl overflow-hidden"
      style={{
        borderColor: isPaid ? "rgba(52,211,153,0.15)" : undefined,
      }}
    >
      {/* Header */}
      <div
        className={`px-5 py-5 ${isPaid ? "bg-ok/5" : ""}`}
        style={{ borderBottom: "1px solid rgba(255,252,248,0.04)" }}
      >
        <div className="flex items-center gap-3">
          <StatusIcon status={status} />
          <div>
            <h3 className={`text-base font-semibold ${statusColor}`}>
              {label}
            </h3>
            <p className="text-warm-400 text-xs mt-0.5">
              {isPaid
                ? `Your ${dish} ingredients are on the way from ${platformLabel}`
                : `Order for ${dish} ingredients`}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5">
        {/* Details grid */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <p className="text-[10px] text-warm-600 uppercase tracking-wider font-semibold">
              Platform
            </p>
            <p className="text-sm font-medium text-warm-100 mt-1">
              {platformLabel}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-warm-600 uppercase tracking-wider font-semibold">
              Total
            </p>
            <p className="text-xl font-bold text-warm-50 mt-1">
              &#8377;{total.toFixed(0)}
            </p>
          </div>
          {eta && (
            <div>
              <p className="text-[10px] text-warm-600 uppercase tracking-wider font-semibold">
                ETA
              </p>
              <p className="text-sm font-medium text-warm-100 mt-1 flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-warm-400">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                ~{eta} min
              </p>
            </div>
          )}
          <div>
            <p className="text-[10px] text-warm-600 uppercase tracking-wider font-semibold">
              Order ID
            </p>
            <p className="text-xs font-mono text-warm-400 mt-1">
              {orderId.slice(0, 8)}
            </p>
          </div>
        </div>

        {/* Items */}
        <div className="mb-4">
          <h4 className="text-[11px] font-semibold text-warm-600 uppercase tracking-wider mb-2">
            Items ({items.length})
          </h4>
          <div className="space-y-1">
            {items.map((item, i) => (
              <div
                key={i}
                className="flex justify-between text-sm py-1.5 px-3 rounded-lg
                           hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-warm-200">
                  {item.sku_name || item.ingredient}
                </span>
                <span className="text-warm-400 ml-4 flex-shrink-0">
                  &#8377;{item.total_price?.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Skipped */}
        {skipped.length > 0 && (
          <div
            className="p-3 rounded-lg bg-ok/5 mb-5"
            style={{ border: "1px solid rgba(52,211,153,0.1)" }}
          >
            <p className="text-xs text-ok/80">
              Skipped {skipped.length} pantry staples:{" "}
              {skipped.map((s) => s.name).join(", ")}
            </p>
          </div>
        )}

        {/* New order */}
        <button
          onClick={onNewOrder}
          className="w-full py-3 px-4 rounded-xl text-sm font-semibold
                     bg-accent text-deep hover:bg-accent-dim transition-all duration-200
                     flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Cook something else
        </button>
      </div>
    </div>
  );
}
