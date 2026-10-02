"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { agentApprove, agentRun, agentStreamUrl, getOrder } from "@/lib/api";

/* ── Event / session types (loose — the backend's event `data` payload
   shape varies by event type; see orchestrator.py's `emit()` calls) ── */

interface TimelineEvent {
  seq: number;
  ts: string;
  type: string; // "state" | "log" | "approval" | "order"
  state: string;
  level: "info" | "success" | "warn" | "error";
  message: string;
  data?: any;
}

interface FinalView {
  state: string;
  status: string;
  cart?: any;
  total?: number | null;
  order_id?: string | null;
  errors?: Array<{ message: string }>;
}

const SUGGESTIONS = [
  "Order 1kg onions and 500g paneer",
  "Ingredients for butter chicken for 4, budget ₹800",
  "Get me eggs, bread and milk",
];

export default function AgentPage() {
  return (
    <Suspense fallback={null}>
      <AgentPageInner />
    </Suspense>
  );
}

function AgentPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSession = searchParams.get("session");

  const sessionId = urlSession; // the URL is the single source of truth for which run is shown
  const [goal, setGoal] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [approval, setApproval] = useState<{ data: any } | null>(null);
  const [approving, setApproving] = useState(false);
  const [order, setOrder] = useState<{ order_id: string; payment_url: string | null } | null>(null);
  const [final, setFinal] = useState<FinalView | null>(null);
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [connected, setConnected] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events, approval]);

  const connect = useCallback((sid: string) => {
    esRef.current?.close();
    setEvents([]);
    setApproval(null);
    setOrder(null);
    setFinal(null);
    setOrderDetail(null);

    const es = new EventSource(agentStreamUrl(sid));
    esRef.current = es;
    setConnected(true);

    const onTimeline = (e: MessageEvent) => {
      try {
        const ev: TimelineEvent = JSON.parse(e.data);
        setEvents((prev) => (prev.some((p) => p.seq === ev.seq) ? prev : [...prev, ev]));
        if (ev.type === "approval") setApproval({ data: ev.data });
        if (ev.type === "order") setOrder({ order_id: ev.data?.order_id, payment_url: ev.data?.payment_url ?? null });
      } catch {
        /* ignore malformed event */
      }
    };
    es.addEventListener("state", onTimeline);
    es.addEventListener("log", onTimeline);
    es.addEventListener("approval", onTimeline);
    es.addEventListener("order", onTimeline);
    es.addEventListener("end", (e: MessageEvent) => {
      try {
        const data: FinalView = JSON.parse(e.data);
        setFinal(data);
        setApproval(null);
        if (data.order_id) {
          getOrder(data.order_id)
            .then((o) => setOrderDetail(o))
            .catch(() => {});
        }
      } catch {
        /* ignore */
      }
      es.close();
      setConnected(false);
    });
    es.onerror = () => {
      // EventSource retries automatically; only reflect disconnect while no
      // terminal state has been reached yet.
      setConnected(es.readyState !== EventSource.CLOSED);
    };
  }, []);

  useEffect(() => {
    if (urlSession) connect(urlSession);
    return () => esRef.current?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSession]);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    const text = goal.trim();
    if (!text || starting) return;
    setStarting(true);
    setStartError(null);
    try {
      const { session_id } = await agentRun(text);
      // Pushing the URL updates `urlSession`, which the effect above picks
      // up to connect — the URL stays the single source of truth.
      router.push(`/agent?session=${session_id}`);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Couldn't start the agent. Please try again.");
    } finally {
      setStarting(false);
    }
  }

  async function handleDecision(approve: boolean) {
    if (!sessionId || approving) return;
    setApproving(true);
    try {
      await agentApprove(sessionId, approve);
      setApproval(null);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Couldn't record your decision. Please try again.");
    } finally {
      setApproving(false);
    }
  }

  function handleReset() {
    esRef.current?.close();
    setGoal("");
    setEvents([]);
    setApproval(null);
    setOrder(null);
    setFinal(null);
    setOrderDetail(null);
    router.push("/agent");
  }

  /* ── Landing: no session yet ── */
  if (!sessionId) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🛒</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">What do you need?</h1>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Give the agent one goal. It plans, checks your pantry, compares Zepto and
            Swiggy Instamart, and asks for your approval before spending anything.
          </p>
        </div>

        <form onSubmit={handleStart} className="flex gap-2 bg-white border border-gray-200 rounded-2xl shadow-lg p-3 mb-4">
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. order 1kg onions and paneer, budget ₹800"
            className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder-gray-400"
            disabled={starting}
            autoFocus
          />
          <button
            type="submit"
            disabled={starting || !goal.trim()}
            className="px-5 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl
                       hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {starting ? "Starting…" : "Start"}
          </button>
        </form>

        {startError && <p className="text-sm text-red-600 mb-4">{startError}</p>}

        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setGoal(s)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-600
                         hover:border-orange-300 hover:text-orange-600 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ── Live run ── */
  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Agent run</h1>
          <p className="text-xs text-gray-400 font-mono">{sessionId}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill connected={connected} final={final} />
          <button
            onClick={handleReset}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            New run
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pb-4">
        {events.map((ev) => (
          <TimelineRow key={ev.seq} ev={ev} />
        ))}

        {approval && (
          <ApprovalCard data={approval.data} onDecide={handleDecision} loading={approving} />
        )}

        {order && !final && <OrderCard orderId={order.order_id} paymentUrl={order.payment_url} />}

        {final && <FinalCard final={final} orderDetail={orderDetail} />}

        {startError && <p className="text-sm text-red-600 px-1">{startError}</p>}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

/* ── Pieces ── */

function StatusPill({ connected, final }: { connected: boolean; final: FinalView | null }) {
  if (final) {
    const map: Record<string, string> = {
      completed: "bg-green-50 text-green-700 border-green-200",
      failed: "bg-red-50 text-red-700 border-red-200",
      cancelled: "bg-gray-50 text-gray-600 border-gray-200",
    };
    return (
      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${map[final.status] ?? map.cancelled}`}>
        {final.status}
      </span>
    );
  }
  return (
    <span className="text-xs px-2.5 py-1 rounded-full border border-orange-200 bg-orange-50 text-orange-700 font-medium flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full bg-orange-500 ${connected ? "animate-pulse" : "opacity-30"}`} />
      {connected ? "running" : "reconnecting…"}
    </span>
  );
}

const LEVEL_STYLE: Record<string, string> = {
  info: "text-gray-500",
  success: "text-green-700",
  warn: "text-amber-700",
  error: "text-red-700",
};

const LEVEL_DOT: Record<string, string> = {
  info: "bg-gray-300",
  success: "bg-green-500",
  warn: "bg-amber-500",
  error: "bg-red-500",
};

function TimelineRow({ ev }: { ev: TimelineEvent }) {
  if (ev.type === "state") {
    return (
      <div className="flex items-center gap-2 pt-2 pb-0.5">
        <span className="text-[10px] font-mono tracking-wider text-gray-300">{ev.state}</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>
    );
  }
  // approval / order events render as their own cards elsewhere; here show
  // their log line too, since it carries the human-readable message.
  return (
    <div className="flex items-start gap-2 px-1">
      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${LEVEL_DOT[ev.level]}`} />
      <p className={`text-sm leading-snug ${LEVEL_STYLE[ev.level]}`}>{ev.message}</p>
    </div>
  );
}

function platformLabel(name?: string): string {
  if (!name) return "";
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function cartItems(cart: any): any[] {
  if (!cart) return [];
  if (cart.strategy === "split") return [...(cart.zepto_items || []), ...(cart.swiggy_items || [])];
  return cart.items || [];
}

function ApprovalCard({
  data,
  onDecide,
  loading,
}: {
  data: any;
  onDecide: (approve: boolean) => void;
  loading: boolean;
}) {
  const cart = data?.cart;
  const policy = data?.policy;
  const items = cartItems(cart);
  const platforms = cart?.strategy === "split" ? cart.platforms : [cart?.platform];

  return (
    <div className="mt-2 bg-white border-2 border-orange-300 rounded-2xl shadow-md overflow-hidden">
      <div className="px-4 py-3 bg-orange-50 border-b border-orange-100">
        <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Your approval needed</p>
        <p className="text-lg font-bold text-gray-800">
          ₹{cart?.total?.toFixed(0)} on {platforms?.map(platformLabel).join(" + ")}
        </p>
        {policy?.reasons && (
          <p className="text-xs text-gray-500 mt-1">{policy.reasons.join("; ")}</p>
        )}
      </div>

      {items.length > 0 && (
        <div className="px-4 py-3 max-h-48 overflow-y-auto space-y-1.5">
          {items.map((item: any, i: number) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-gray-700 truncate pr-2">{item.sku_name || item.ingredient}</span>
              <span className="text-gray-800 font-medium shrink-0">₹{item.total_price?.toFixed(0)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex gap-2">
        <button
          onClick={() => onDecide(false)}
          disabled={loading}
          className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium
                     rounded-xl hover:bg-white disabled:opacity-50 transition-colors"
        >
          Decline
        </button>
        <button
          onClick={() => onDecide(true)}
          disabled={loading}
          className="flex-1 px-4 py-2.5 bg-orange-500 text-white text-sm font-semibold
                     rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {loading ? "Approving…" : `Approve ₹${cart?.total?.toFixed(0)}`}
        </button>
      </div>
    </div>
  );
}

function OrderCard({ orderId, paymentUrl }: { orderId: string; paymentUrl: string | null }) {
  return (
    <div className="mt-2 bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Order placed</p>
      <p className="text-xs text-gray-400 font-mono mb-3">{orderId}</p>
      {paymentUrl ? (
        <a
          href={paymentUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block px-4 py-2.5 bg-orange-500 text-white text-sm font-semibold
                     rounded-xl hover:bg-orange-600 transition-colors"
        >
          Open payment link ↗
        </a>
      ) : (
        <p className="text-sm text-gray-500">
          Cart is ready — complete payment in the store&apos;s app. CookCart can&apos;t confirm this
          order automatically.
        </p>
      )}
    </div>
  );
}

function FinalCard({ final, orderDetail }: { final: FinalView; orderDetail: any }) {
  const tone =
    final.status === "completed"
      ? "border-green-200 bg-green-50"
      : final.status === "cancelled"
        ? "border-gray-200 bg-gray-50"
        : "border-red-200 bg-red-50";
  const title =
    final.status === "completed" ? "Done" : final.status === "cancelled" ? "Cancelled" : "Stopped";

  return (
    <div className={`mt-2 border rounded-2xl p-4 ${tone}`}>
      <p className="font-bold text-gray-800 mb-1">{title}</p>
      {final.errors && final.errors.length > 0 && (
        <p className="text-sm text-gray-600 mb-2">{final.errors[final.errors.length - 1].message}</p>
      )}
      {orderDetail && (
        <div className="mt-2 pt-2 border-t border-black/5 text-sm text-gray-700 space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Payment</span>
            <span className="font-medium">{orderDetail.payment_status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Order</span>
            <span className="font-medium">{orderDetail.order_status}</span>
          </div>
          {orderDetail.total != null && (
            <div className="flex justify-between">
              <span className="text-gray-500">Total</span>
              <span className="font-medium">₹{Number(orderDetail.total).toFixed(0)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
