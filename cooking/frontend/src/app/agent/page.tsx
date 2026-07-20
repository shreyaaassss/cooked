"use client";

import { useState, useRef, useEffect } from "react";
import { agentChat, initiateCheckout } from "@/lib/api";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  comparison?: any;
  items?: Array<{ name: string; quantity: number; unit: string }>;
}

export default function AgentPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const apiMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await agentChat(apiMessages);

      const assistantMsg: ChatMsg = {
        role: "assistant",
        content: res.message,
        comparison: res.comparison,
        items: res.items,
      };
      setMessages([...newMessages, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMsg = {
        role: "assistant",
        content:
          err instanceof Error
            ? `Something went wrong: ${err.message}`
            : "Something went wrong. Please try again.",
      };
      setMessages([...newMessages, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckout(comparison: any) {
    if (!comparison?.recommended) return;
    setCheckoutLoading(true);
    try {
      const rec = comparison.recommended;
      const allItems = getAllItems(rec);
      const result = await initiateCheckout({
        platform: rec.platform || rec.platforms?.[0] || "zepto",
        cart_items: allItems,
        total_amount: rec.total || 0,
        source_recipe: "Agent order",
        skipped_items: comparison.skipped || [],
      });
      const checkoutMsg: ChatMsg = {
        role: "assistant",
        content: result.prava_payment_url
          ? `Order created! Approve payment of Rs${rec.total?.toFixed(0)} on Prava:\n${result.prava_payment_url}`
          : `Order created (ID: ${result.order_id}). ${result.message}`,
      };
      setMessages((prev) => [...prev, checkoutMsg]);
    } catch (err) {
      const errMsg: ChatMsg = {
        role: "assistant",
        content:
          err instanceof Error
            ? `Checkout failed: ${err.message}`
            : "Checkout failed. Please try again.",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setCheckoutLoading(false);
    }
  }

  function addItemsToList(items: Array<{ name: string; quantity: number; unit: string }>) {
    try {
      const raw = localStorage.getItem("cookcart_list");
      const existing: any[] = raw ? JSON.parse(raw) : [];
      const newItems = items
        .filter((item) => !existing.some((e: any) => e.name.toLowerCase() === item.name.toLowerCase()))
        .map((item) => ({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: item.name.charAt(0).toUpperCase() + item.name.slice(1),
          quantity: item.quantity,
          unit: item.unit,
          category: "Other",
          checked: false,
        }));
      localStorage.setItem("cookcart_list", JSON.stringify([...existing, ...newItems]));
      const added = newItems.length;
      const skipped = items.length - added;
      const parts = [];
      if (added > 0) parts.push(`${added} item${added > 1 ? "s" : ""} added to your list`);
      if (skipped > 0) parts.push(`${skipped} already in list`);
      alert(parts.join(". ") + ". Go to My List to review.");
    } catch {
      alert("Failed to save to list");
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Pantry Agent</h1>
        <p className="text-gray-500 text-sm">
          Tell me what groceries you need and I&apos;ll find the best prices.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🛒</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              What do you need from the store?
            </h2>
            <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
              Just tell me what you want — like &quot;1kg onions, paneer, and
              milk&quot; — and I&apos;ll compare prices across Zepto &amp;
              Swiggy Instamart.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "I need 1kg onions and 500g paneer",
                "Get me eggs, bread, and milk",
                "I want 2kg rice and 1kg dal",
                "Order some chicken and vegetables",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-full
                             text-sm text-gray-600 hover:border-orange-300
                             hover:text-orange-600 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            {/* Message bubble */}
            <div
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                  msg.role === "user"
                    ? "bg-orange-500 text-white rounded-br-md"
                    : "bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>

            {/* Extracted items tags + Add to List */}
            {msg.role === "assistant" && msg.items && msg.items.length > 0 && (
              <div className="mt-2 pl-2">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {msg.items.map((item, j) => (
                    <span
                      key={j}
                      className="px-2.5 py-1 bg-orange-50 text-orange-700 text-xs
                                 rounded-full border border-orange-200 font-medium"
                    >
                      {item.name} — {item.quantity}
                      {item.unit}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => addItemsToList(msg.items!)}
                  className="text-xs text-orange-600 hover:text-orange-700 font-medium
                             hover:underline transition-colors"
                >
                  + Add to My List
                </button>
              </div>
            )}

            {/* Comparison card */}
            {msg.role === "assistant" &&
              msg.comparison &&
              msg.comparison.recommended && (
                <CartCard
                  comparison={msg.comparison}
                  onCheckout={() => handleCheckout(msg.comparison)}
                  checkoutLoading={checkoutLoading}
                />
              )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md shadow-sm px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="animate-pulse">Searching prices...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="shrink-0 pt-2 border-t border-gray-100"
      >
        <div className="flex gap-2 bg-white border border-gray-200 rounded-2xl shadow-lg p-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell me what you need..."
            className="flex-1 text-sm outline-none bg-transparent text-gray-800
                       placeholder-gray-400"
            disabled={loading}
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-5 py-2 bg-orange-500 text-white text-sm font-semibold
                       rounded-xl hover:bg-orange-600 disabled:opacity-50
                       disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Helpers ── */

function getAllItems(rec: any): any[] {
  if (rec.strategy === "split") {
    return [...(rec.zepto_items || []), ...(rec.swiggy_items || [])];
  }
  return rec.items || [];
}

function platformLabel(name: string): string {
  if (!name) return "";
  return name.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
}

/* ── Cart card with expandable item list ── */

function CartCard({
  comparison,
  onCheckout,
  checkoutLoading,
}: {
  comparison: any;
  onCheckout: () => void;
  checkoutLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const rec = comparison.recommended;
  const isSplit = rec.strategy === "split";

  // Collect all items from the recommended cart
  const zeptoItems: any[] = isSplit ? rec.zepto_items || [] : rec.platform === "zepto" ? rec.items || [] : [];
  const swiggyItems: any[] = isSplit ? rec.swiggy_items || [] : rec.platform === "swiggy_instamart" ? rec.items || [] : [];
  const allItems = [...zeptoItems, ...swiggyItems];
  const totalAvailable = allItems.length;
  const unavailable: string[] = rec.unavailable || [];

  // Summary label
  const strategyLabel = isSplit
    ? "Split: Zepto + Swiggy"
    : platformLabel(rec.platform || "");

  return (
    <div className="mt-3 ml-2 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden max-w-lg">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-orange-600 uppercase tracking-wide">
              {isSplit ? "Best Option — Split Order" : "Best Option"}
            </p>
            <p className="text-sm font-bold text-gray-800">{strategyLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-gray-800">
              Rs{rec.total?.toFixed(0)}
            </p>
            <p className="text-xs text-gray-500">~{rec.eta} min</p>
          </div>
        </div>
      </div>

      {/* Summary row */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-50">
        <span className="text-xs text-gray-500">
          {totalAvailable} item{totalAvailable !== 1 ? "s" : ""} found
          {unavailable.length > 0 &&
            ` · ${unavailable.length} unavailable`}
          {comparison.skipped?.length > 0 &&
            ` · ${comparison.skipped.length} in pantry`}
        </span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors"
        >
          {expanded ? "Hide cart" : "View cart"}
        </button>
      </div>

      {/* Expanded item list */}
      {expanded && (
        <div className="px-4 py-3 max-h-64 overflow-y-auto">
          {/* Zepto items */}
          {zeptoItems.length > 0 && (
            <div className="mb-3">
              {isSplit && (
                <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider mb-1.5">
                  From Zepto
                </p>
              )}
              {zeptoItems.map((item: any, i: number) => (
                <ItemRow key={`z-${i}`} item={item} />
              ))}
            </div>
          )}

          {/* Swiggy items */}
          {swiggyItems.length > 0 && (
            <div className="mb-3">
              {isSplit && (
                <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider mb-1.5">
                  From Swiggy Instamart
                </p>
              )}
              {swiggyItems.map((item: any, i: number) => (
                <ItemRow key={`s-${i}`} item={item} />
              ))}
            </div>
          )}

          {/* Unavailable */}
          {unavailable.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-amber-600">
                Unavailable: {unavailable.join(", ")}
              </p>
            </div>
          )}

          {/* Skipped pantry items */}
          {comparison.skipped?.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Skipped (in pantry):{" "}
                {comparison.skipped
                  .map((s: any) => s.name || s.ingredient_name)
                  .join(", ")}
              </p>
            </div>
          )}

          {/* Price breakdown */}
          <div className="pt-3 mt-2 border-t border-gray-200 space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Items</span>
              <span>Rs{rec.item_total?.toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Delivery{isSplit ? " (x2)" : ""}</span>
              <span>Rs{rec.delivery_fee?.toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-gray-800 pt-1">
              <span>Total</span>
              <span>Rs{rec.total?.toFixed(0)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Reasoning */}
      <div className="px-4 py-2 border-t border-gray-100">
        <p className="text-xs text-gray-400">{comparison.reasoning}</p>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm
                     font-medium rounded-xl hover:bg-white transition-colors"
        >
          {expanded ? "Hide Cart" : "View Cart"}
        </button>
        {totalAvailable > 0 && (
          <button
            onClick={onCheckout}
            disabled={checkoutLoading}
            className="flex-1 px-4 py-2.5 bg-orange-500 text-white text-sm font-semibold
                       rounded-xl hover:bg-orange-600 disabled:opacity-50
                       transition-colors"
          >
            {checkoutLoading ? "Processing..." : `Proceed — Rs${rec.total?.toFixed(0)}`}
          </button>
        )}
      </div>
    </div>
  );
}

function ItemRow({ item }: { item: any }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <div className="min-w-0">
        <p className="text-sm text-gray-800 truncate">
          {item.sku_name || item.ingredient}
        </p>
        <p className="text-[11px] text-gray-400">
          {item.needed} &rarr; {item.pack_size}
        </p>
      </div>
      <span className="text-sm font-semibold text-gray-800 shrink-0 ml-3">
        Rs{item.total_price?.toFixed(0)}
      </span>
    </div>
  );
}
