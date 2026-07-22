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
      <div className="glass glass-hover rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-warm-600 flex-shrink-0"
          >
            <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
          </svg>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='e.g. "butter chicken for 4 people"'
            className="flex-1 text-base outline-none bg-transparent text-warm-50
                       placeholder-warm-600 font-normal"
            disabled={disabled}
            autoFocus
          />
        </div>

        <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,252,248,0.04)" }}>
          <div className="flex items-center gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-warm-600"
            >
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
            <span className="text-xs text-warm-600 font-medium">Servings</span>
            <input
              type="number"
              min={1}
              max={20}
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
              className="w-12 px-2 py-1 rounded-lg text-center text-warm-50 text-xs font-medium
                         bg-white/5 border border-white/5 outline-none
                         focus:border-accent/30 transition-colors"
              disabled={disabled}
            />
          </div>

          <button
            type="submit"
            disabled={disabled || !input.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold
                       bg-accent text-deep hover:bg-accent-dim
                       disabled:opacity-30 disabled:cursor-not-allowed
                       transition-all duration-200"
          >
            {disabled ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Working
              </>
            ) : (
              <>
                Cook
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
