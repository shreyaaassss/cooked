"use client";

import type { Ingredient, SkippedItem } from "@/lib/types";

interface RecipeCardProps {
  dish: string;
  servings: number;
  ingredients: Ingredient[];
  skipped?: SkippedItem[];
}

const CATEGORY_EMOJI: Record<string, string> = {
  protein: "🥩",
  dairy: "🧈",
  vegetable: "🥬",
  spice: "🌶️",
  grain: "🌾",
  condiment: "🫙",
  seasoning: "🧂",
  other: "🛒",
};

export default function RecipeCard({
  dish,
  servings,
  ingredients,
  skipped,
}: RecipeCardProps) {
  const buyItems = ingredients.filter((i) => !i.is_common_staple);
  const stapleItems = skipped ?? ingredients.filter((i) => i.is_common_staple);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-md overflow-hidden">
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4">
        <h3 className="text-xl font-bold text-white capitalize">
          {dish}
        </h3>
        <p className="text-orange-100 text-sm">
          {servings} servings &middot; {ingredients.length} ingredients
        </p>
      </div>

      <div className="p-6">
        {/* Buy list */}
        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Shopping List ({buyItems.length} items)
        </h4>
        <div className="space-y-2 mb-6">
          {buyItems.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <span>{CATEGORY_EMOJI[item.category] || "🛒"}</span>
                <span className="text-gray-800 font-medium">{item.name}</span>
              </div>
              <span className="text-gray-500 text-sm">
                {item.quantity > 0
                  ? `${item.quantity} ${item.unit}`
                  : item.unit}
              </span>
            </div>
          ))}
        </div>

        {/* Skipped pantry items */}
        {stapleItems.length > 0 && (
          <>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Skipped — Already in your pantry ({stapleItems.length})
            </h4>
            <div className="space-y-1">
              {stapleItems.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-1.5 px-3 text-gray-400"
                >
                  <span className="line-through">{item.name}</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    {"skip_reason" in item
                      ? (item as SkippedItem).skip_reason
                      : "staple"}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
