"use client";

import { useEffect, useState } from "react";
import {
  addPantryStaple,
  getPantryStaples,
  removePantryStaple,
} from "@/lib/api";
import type { PantryStaple } from "@/lib/types";

export default function PantryManager() {
  const [staples, setStaples] = useState<PantryStaple[]>([]);
  const [newItem, setNewItem] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStaples();
  }, []);

  async function loadStaples() {
    try {
      const data = await getPantryStaples();
      setStaples(data);
    } catch {
      // API not connected yet
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    try {
      await addPantryStaple(newItem.trim());
      setNewItem("");
      await loadStaples();
    } catch {
      // handle error
    }
  }

  async function handleRemove(name: string) {
    try {
      await removePantryStaple(name);
      await loadStaples();
    } catch {
      // handle error
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-6">
      <h3 className="text-lg font-bold text-gray-800 mb-1">
        Pantry Staples
      </h3>
      <p className="text-sm text-gray-400 mb-4">
        Items you always have at home — these will be skipped when shopping.
      </p>

      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add staple (e.g. salt, oil)"
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm
                     outline-none focus:border-orange-300"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-orange-500 text-white text-sm font-medium
                     rounded-lg hover:bg-orange-600 transition-colors"
        >
          Add
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : staples.length === 0 ? (
        <p className="text-sm text-gray-400">
          No staples configured. Add items you always have at home.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {staples.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100
                         text-gray-700 text-sm rounded-full"
            >
              {s.ingredient_name}
              <button
                onClick={() => handleRemove(s.ingredient_name)}
                className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
