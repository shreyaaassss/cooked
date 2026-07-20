"use client";

import { useState } from "react";

interface ChatInputProps {
  onSubmit: (dish: string, servings: number) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSubmit, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [servings, setServings] = useState(4);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dish = input.trim();
    if (!dish) return;
    onSubmit(dish, servings);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🍳</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='What are you cooking? e.g. "butter chicken for 4"'
            className="flex-1 text-lg outline-none bg-transparent text-gray-800 placeholder-gray-400"
            disabled={disabled}
            autoFocus
          />
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <label htmlFor="servings">Servings:</label>
            <input
              id="servings"
              type="number"
              min={1}
              max={20}
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
              className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-center text-gray-700"
              disabled={disabled}
            />
          </div>
          <button
            type="submit"
            disabled={disabled || !input.trim()}
            className="px-6 py-2 bg-orange-500 text-white font-semibold rounded-xl
                       hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {disabled ? "Working..." : "Cook it!"}
          </button>
        </div>
      </div>
    </form>
  );
}
