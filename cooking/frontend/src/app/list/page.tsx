"use client";

import { useState, useEffect, useRef } from "react";
import { comparePrices, initiateCheckout } from "@/lib/api";

/* ── Types ── */

interface GroceryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  checked: boolean;
}

interface SavedList {
  name: string;
  items: GroceryItem[];
  updatedAt: string;
}

/* ── Constants ── */

const UNITS = ["kg", "g", "ml", "l", "pieces", "packs", "dozen"];

const CATEGORIES: Record<string, string[]> = {
  "Fruits & Vegetables": ["onion", "tomato", "potato", "garlic", "ginger", "carrot", "capsicum", "green chili", "coriander", "mint", "lemon", "banana", "apple", "cucumber"],
  "Dairy": ["milk", "curd", "paneer", "butter", "cheese", "cream", "ghee", "yogurt"],
  "Staples": ["rice", "wheat flour", "atta", "sugar", "salt", "dal", "toor dal", "moong dal", "chana dal", "poha", "rava"],
  "Spices": ["turmeric", "red chili powder", "cumin", "coriander powder", "garam masala", "mustard seeds", "black pepper"],
  "Bread & Bakery": ["bread", "pav", "bun"],
  "Eggs & Meat": ["eggs", "chicken", "mutton"],
  "Beverages": ["tea", "coffee", "water bottle", "juice"],
  "Snacks & Packaged": ["biscuits", "chips", "namkeen", "maggi", "oats"],
  "Oils & Condiments": ["cooking oil", "olive oil", "ketchup", "soy sauce", "vinegar"],
};

const QUICK_ITEMS = [
  { name: "Onion", qty: 1, unit: "kg", cat: "Fruits & Vegetables" },
  { name: "Tomato", qty: 500, unit: "g", cat: "Fruits & Vegetables" },
  { name: "Milk", qty: 500, unit: "ml", cat: "Dairy" },
  { name: "Paneer", qty: 200, unit: "g", cat: "Dairy" },
  { name: "Eggs", qty: 12, unit: "pieces", cat: "Eggs & Meat" },
  { name: "Bread", qty: 1, unit: "packs", cat: "Bread & Bakery" },
  { name: "Rice", qty: 1, unit: "kg", cat: "Staples" },
  { name: "Butter", qty: 100, unit: "g", cat: "Dairy" },
  { name: "Atta", qty: 1, unit: "kg", cat: "Staples" },
  { name: "Potato", qty: 1, unit: "kg", cat: "Fruits & Vegetables" },
  { name: "Chicken", qty: 500, unit: "g", cat: "Eggs & Meat" },
  { name: "Curd", qty: 400, unit: "g", cat: "Dairy" },
];

function guessCategory(name: string): string {
  const lower = name.toLowerCase();
  for (const [cat, items] of Object.entries(CATEGORIES)) {
    if (items.some((i) => lower.includes(i) || i.includes(lower))) return cat;
  }
  return "Other";
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ── Storage helpers ── */

function loadList(): GroceryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("cookcart_list");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveList(items: GroceryItem[]) {
  localStorage.setItem("cookcart_list", JSON.stringify(items));
}

function loadSavedLists(): SavedList[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("cookcart_saved_lists");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSavedLists(lists: SavedList[]) {
  localStorage.setItem("cookcart_saved_lists", JSON.stringify(lists));
}

/* ── Main component ── */

export default function ListPage() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState<any>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);
  const [saveNameInput, setSaveNameInput] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [undoItem, setUndoItem] = useState<{ item: GroceryItem; index: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load on mount
  useEffect(() => {
    setItems(loadList());
    setSavedLists(loadSavedLists());
  }, []);

  // Persist on change
  useEffect(() => {
    if (items.length > 0 || loadList().length > 0) {
      saveList(items);
    }
  }, [items]);

  // Auto-clear undo after 4s
  useEffect(() => {
    if (!undoItem) return;
    const t = setTimeout(() => setUndoItem(null), 4000);
    return () => clearTimeout(t);
  }, [undoItem]);

  /* ── Autocomplete ── */

  function handleInputChange(val: string) {
    setInput(val);
    if (val.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const lower = val.toLowerCase();
    const allItems = Object.values(CATEGORIES).flat();
    const matches = allItems
      .filter((i) => i.includes(lower) && !items.some((x) => x.name.toLowerCase() === i))
      .slice(0, 5);
    setSuggestions(matches);
  }

  /* ── Add item ── */

  function addItem(name: string, quantity?: number, unit?: string) {
    const trimmed = name.trim();
    if (!trimmed) return;

    // Check for duplicate
    const existing = items.find((i) => i.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      setItems(items.map((i) => i.id === existing.id ? { ...i, quantity: i.quantity + (quantity || 1) } : i));
    } else {
      const cat = guessCategory(trimmed);
      const newItem: GroceryItem = {
        id: uid(),
        name: trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
        quantity: quantity || 1,
        unit: unit || (cat === "Dairy" ? "ml" : cat === "Fruits & Vegetables" ? "kg" : "pieces"),
        category: cat,
        checked: false,
      };
      setItems([...items, newItem]);
    }
    setInput("");
    setSuggestions([]);
    inputRef.current?.focus();
  }

  function handleSubmitItem(e: React.FormEvent) {
    e.preventDefault();
    // Parse "1kg onion" or "onion 500g" patterns
    const text = input.trim();
    if (!text) return;

    const match = text.match(/^(\d+(?:\.\d+)?)\s*(kg|g|ml|l|pieces?|packs?|dozen)?\s+(.+)$/i)
      || text.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(kg|g|ml|l|pieces?|packs?|dozen)?$/i);

    if (match) {
      const isQtyFirst = /^\d/.test(text);
      const qty = parseFloat(isQtyFirst ? match[1] : match[2]);
      const unit = (isQtyFirst ? match[2] : match[3]) || undefined;
      const name = isQtyFirst ? match[3] : match[1];
      addItem(name, qty, unit?.toLowerCase());
    } else {
      addItem(text);
    }
  }

  /* ── Edit / Remove ── */

  function updateQty(id: string, delta: number) {
    setItems(items.map((i) => {
      if (i.id !== id) return i;
      const newQty = Math.max(0.5, i.quantity + delta);
      return { ...i, quantity: newQty };
    }));
  }

  function setQty(id: string, qty: number) {
    setItems(items.map((i) => i.id === id ? { ...i, quantity: Math.max(0.5, qty) } : i));
  }

  function setUnit(id: string, unit: string) {
    setItems(items.map((i) => i.id === id ? { ...i, unit } : i));
  }

  function toggleCheck(id: string) {
    setItems(items.map((i) => i.id === id ? { ...i, checked: !i.checked } : i));
  }

  function removeItem(id: string) {
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return;
    setUndoItem({ item: items[idx], index: idx });
    setItems(items.filter((i) => i.id !== id));
  }

  function undoRemove() {
    if (!undoItem) return;
    const newItems = [...items];
    newItems.splice(undoItem.index, 0, undoItem.item);
    setItems(newItems);
    setUndoItem(null);
  }

  function clearChecked() {
    setItems(items.filter((i) => !i.checked));
  }

  /* ── Saved lists ── */

  function handleSaveList() {
    const name = saveNameInput.trim() || `List ${savedLists.length + 1}`;
    const newList: SavedList = { name, items: [...items], updatedAt: new Date().toISOString() };
    const updated = [newList, ...savedLists.filter((l) => l.name !== name)].slice(0, 10);
    setSavedLists(updated);
    saveSavedLists(updated);
    setShowSaveDialog(false);
    setSaveNameInput("");
  }

  function loadSavedList(list: SavedList) {
    setItems(list.items.map((i) => ({ ...i, checked: false })));
    setShowSaved(false);
    setComparison(null);
  }

  function deleteSavedList(name: string) {
    const updated = savedLists.filter((l) => l.name !== name);
    setSavedLists(updated);
    saveSavedLists(updated);
  }

  /* ── Compare prices ── */

  async function handleCompare() {
    const unchecked = items.filter((i) => !i.checked);
    if (unchecked.length === 0) return;
    setComparing(true);
    setComparison(null);
    try {
      const ingredients = unchecked.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        category: i.category.toLowerCase(),
        is_common_staple: false,
      }));
      const result = await comparePrices(ingredients);
      setComparison(result);
    } catch (err) {
      setComparison({ error: err instanceof Error ? err.message : "Failed to compare" });
    } finally {
      setComparing(false);
    }
  }

  async function handleCheckout() {
    if (!comparison?.recommended) return;
    setCheckoutLoading(true);
    try {
      const rec = comparison.recommended;
      const allItems = rec.strategy === "split"
        ? [...(rec.zepto_items || []), ...(rec.swiggy_items || [])]
        : rec.items || [];
      await initiateCheckout({
        platform: rec.platform || rec.platforms?.[0] || "zepto",
        cart_items: allItems,
        total_amount: rec.total || 0,
        source_recipe: "Grocery list order",
      });
      alert("Order placed successfully!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setCheckoutLoading(false);
    }
  }

  /* ── Group by category ── */

  const grouped: Record<string, GroceryItem[]> = {};
  for (const item of items) {
    const cat = item.category || "Other";
    (grouped[cat] ??= []).push(item);
  }
  const uncheckedCount = items.filter((i) => !i.checked).length;
  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Grocery List</h1>
          <p className="text-gray-400 text-sm">
            {items.length === 0
              ? "Add items to get started"
              : `${uncheckedCount} item${uncheckedCount !== 1 ? "s" : ""} to buy`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSaved(!showSaved)}
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg
                       text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {showSaved ? "Close" : "Saved Lists"}
          </button>
          {items.length > 0 && (
            <button
              onClick={() => setShowSaveDialog(true)}
              className="px-3 py-1.5 text-xs font-medium border border-orange-200 rounded-lg
                         text-orange-600 bg-orange-50 hover:bg-orange-100 transition-colors"
            >
              Save List
            </button>
          )}
        </div>
      </div>

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="mb-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm flex gap-2">
          <input
            type="text"
            value={saveNameInput}
            onChange={(e) => setSaveNameInput(e.target.value)}
            placeholder="List name (e.g. Weekly groceries)"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-orange-300"
            autoFocus
          />
          <button onClick={handleSaveList} className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg">
            Save
          </button>
          <button onClick={() => setShowSaveDialog(false)} className="px-3 py-2 text-sm text-gray-500">
            Cancel
          </button>
        </div>
      )}

      {/* Saved lists panel */}
      {showSaved && (
        <div className="mb-4 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">Saved Lists</p>
          </div>
          {savedLists.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">No saved lists yet</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {savedLists.map((list) => (
                <div key={list.name} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                  <button onClick={() => loadSavedList(list)} className="text-left flex-1">
                    <p className="text-sm font-medium text-gray-800">{list.name}</p>
                    <p className="text-xs text-gray-400">
                      {list.items.length} items &middot; {new Date(list.updatedAt).toLocaleDateString()}
                    </p>
                  </button>
                  <button onClick={() => deleteSavedList(list.name)} className="text-gray-300 hover:text-red-500 text-lg ml-3">&times;</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick add chips */}
      <div className="mb-4 overflow-x-auto">
        <div className="flex gap-2 pb-1">
          {QUICK_ITEMS.filter((q) => !items.some((i) => i.name.toLowerCase() === q.name.toLowerCase())).slice(0, 10).map((q) => (
            <button
              key={q.name}
              onClick={() => addItem(q.name, q.qty, q.unit)}
              className="shrink-0 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs
                         text-gray-600 hover:border-orange-300 hover:text-orange-600 transition-colors"
            >
              + {q.name}
            </button>
          ))}
        </div>
      </div>

      {/* Add input */}
      <form onSubmit={handleSubmitItem} className="mb-5 relative">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder='Add item — e.g. "1kg onion" or "paneer"'
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none
                         focus:border-orange-300 shadow-sm"
              autoFocus
            />
            {/* Autocomplete dropdown */}
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { addItem(s); setSuggestions([]); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50
                               hover:text-orange-700 transition-colors capitalize"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-5 py-3 bg-orange-500 text-white text-sm font-semibold rounded-xl
                       hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            Add
          </button>
        </div>
      </form>

      {/* Grocery list grouped by category */}
      {items.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-2xl">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-gray-500 text-sm">Your grocery list is empty</p>
          <p className="text-gray-400 text-xs mt-1">
            Type an item above or tap a quick-add chip
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{cat}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {catItems.map((item) => (
                  <div
                    key={item.id}
                    className={`px-4 py-3 flex items-center gap-3 transition-colors ${item.checked ? "bg-gray-50" : ""}`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleCheck(item.id)}
                      className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors ${
                        item.checked
                          ? "bg-green-500 border-green-500"
                          : "border-gray-300 hover:border-orange-400"
                      }`}
                    >
                      {item.checked && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    {/* Name */}
                    <span className={`flex-1 text-sm ${item.checked ? "line-through text-gray-400" : "text-gray-800"}`}>
                      {item.name}
                    </span>

                    {/* Quantity controls */}
                    {!item.checked && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQty(item.id, item.unit === "g" || item.unit === "ml" ? -50 : -0.5)}
                          className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 text-sm
                                     hover:bg-gray-100 flex items-center justify-center"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => setQty(item.id, parseFloat(e.target.value) || 0.5)}
                          className="w-14 text-center text-sm border border-gray-200 rounded-lg py-1 outline-none
                                     focus:border-orange-300"
                          step="any"
                        />
                        <button
                          onClick={() => updateQty(item.id, item.unit === "g" || item.unit === "ml" ? 50 : 0.5)}
                          className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 text-sm
                                     hover:bg-gray-100 flex items-center justify-center"
                        >
                          +
                        </button>
                        <select
                          value={item.unit}
                          onChange={(e) => setUnit(item.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg py-1 px-1.5 outline-none
                                     focus:border-orange-300 text-gray-600 bg-white"
                        >
                          {UNITS.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Remove */}
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors text-lg shrink-0"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Clear checked */}
          {checkedCount > 0 && (
            <button
              onClick={clearChecked}
              className="w-full py-2 text-sm text-gray-400 hover:text-red-500 transition-colors"
            >
              Remove {checkedCount} checked item{checkedCount !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}

      {/* Undo snackbar */}
      {undoItem && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2.5
                        rounded-xl shadow-lg flex items-center gap-3 text-sm z-50">
          <span>Removed &quot;{undoItem.item.name}&quot;</span>
          <button onClick={undoRemove} className="font-bold text-orange-400 hover:text-orange-300">UNDO</button>
        </div>
      )}

      {/* Comparison results */}
      {comparison && !comparison.error && comparison.recommended && (
        <ComparisonResult comparison={comparison} onCheckout={handleCheckout} checkoutLoading={checkoutLoading} />
      )}
      {comparison?.error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {comparison.error}
        </div>
      )}

      {/* Sticky bottom bar */}
      {uncheckedCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {uncheckedCount} item{uncheckedCount !== 1 ? "s" : ""} to buy
            </span>
            <button
              onClick={handleCompare}
              disabled={comparing}
              className="px-6 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl
                         hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {comparing ? "Searching..." : "Find Best Prices"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Comparison Result ── */

function ComparisonResult({
  comparison,
  onCheckout,
  checkoutLoading,
}: {
  comparison: any;
  onCheckout: () => void;
  checkoutLoading: boolean;
}) {
  const rec = comparison.recommended;
  const isSplit = rec.strategy === "split";
  const zItems: any[] = isSplit ? rec.zepto_items || [] : rec.platform === "zepto" ? rec.items || [] : [];
  const sItems: any[] = isSplit ? rec.swiggy_items || [] : rec.platform === "swiggy_instamart" ? rec.items || [] : [];
  const allItems = [...zItems, ...sItems];
  const label = isSplit
    ? "Split: Zepto + Swiggy"
    : (rec.platform || "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

  return (
    <div className="mt-6 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-gray-100 flex justify-between items-center">
        <div>
          <p className="text-xs font-medium text-orange-600 uppercase tracking-wide">Best Option</p>
          <p className="text-base font-bold text-gray-800">{label}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-800">Rs{rec.total?.toFixed(0)}</p>
          <p className="text-xs text-gray-500">~{rec.eta} min delivery</p>
        </div>
      </div>

      {/* Items */}
      <div className="px-5 py-4 divide-y divide-gray-50">
        {isSplit && zItems.length > 0 && (
          <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider pb-1">From Zepto</p>
        )}
        {zItems.map((item: any, i: number) => (
          <div key={`z${i}`} className="flex justify-between py-2">
            <div>
              <p className="text-sm text-gray-800">{item.sku_name || item.ingredient}</p>
              <p className="text-[11px] text-gray-400">{item.needed} &rarr; {item.pack_size}</p>
            </div>
            <span className="text-sm font-semibold text-gray-800">Rs{item.total_price?.toFixed(0)}</span>
          </div>
        ))}
        {isSplit && sItems.length > 0 && (
          <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider pb-1 pt-3">From Swiggy</p>
        )}
        {sItems.map((item: any, i: number) => (
          <div key={`s${i}`} className="flex justify-between py-2">
            <div>
              <p className="text-sm text-gray-800">{item.sku_name || item.ingredient}</p>
              <p className="text-[11px] text-gray-400">{item.needed} &rarr; {item.pack_size}</p>
            </div>
            <span className="text-sm font-semibold text-gray-800">Rs{item.total_price?.toFixed(0)}</span>
          </div>
        ))}
        {(rec.unavailable || []).length > 0 && (
          <p className="text-xs text-amber-600 pt-2">Unavailable: {rec.unavailable.join(", ")}</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 space-y-2">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Items</span><span>Rs{rec.item_total?.toFixed(0)}</span>
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>Delivery{isSplit ? " (x2)" : ""}</span><span>Rs{rec.delivery_fee?.toFixed(0)}</span>
        </div>
        <div className="flex justify-between text-sm font-bold text-gray-800 pt-1 border-t border-gray-200">
          <span>Total</span><span>Rs{rec.total?.toFixed(0)}</span>
        </div>
      </div>

      {/* Checkout */}
      {allItems.length > 0 && (
        <div className="px-5 py-4 border-t border-gray-100">
          <button
            onClick={onCheckout}
            disabled={checkoutLoading}
            className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl
                       hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {checkoutLoading ? "Processing..." : `Proceed to Checkout — Rs${rec.total?.toFixed(0)}`}
          </button>
          <p className="text-[11px] text-gray-400 text-center mt-2">{comparison.reasoning}</p>
        </div>
      )}
    </div>
  );
}
