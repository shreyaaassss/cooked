"use client";

import type { CompareResult, ResolvedSKU } from "@/lib/types";

interface ComparisonTableProps {
  data: CompareResult;
}

function formatPrice(price?: number) {
  if (price == null) return "—";
  return `₹${price.toFixed(0)}`;
}

function PlatformBadge({ platform }: { platform: string }) {
  const colors: Record<string, string> = {
    zepto: "bg-purple-100 text-purple-700",
    swiggy_instamart: "bg-orange-100 text-orange-700",
  };
  const labels: Record<string, string> = {
    zepto: "Zepto",
    swiggy_instamart: "Swiggy Instamart",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors[platform] || "bg-gray-100 text-gray-700"}`}
    >
      {labels[platform] || platform}
    </span>
  );
}

function ItemRow({
  zepto,
  swiggy,
  cheaper,
}: {
  zepto: ResolvedSKU;
  swiggy: ResolvedSKU;
  cheaper: "zepto" | "swiggy" | "tie";
}) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-3 px-4 font-medium text-gray-800">
        {zepto.ingredient || swiggy.ingredient}
      </td>
      <td className="py-3 px-4 text-sm text-gray-500">
        {zepto.needed || swiggy.needed}
      </td>
      <td
        className={`py-3 px-4 text-sm ${cheaper === "zepto" ? "text-purple-700 font-semibold" : "text-gray-600"}`}
      >
        {zepto.status === "available" ? (
          <div>
            <div>{zepto.pack_size}</div>
            <div className="font-medium">{formatPrice(zepto.total_price)}</div>
          </div>
        ) : (
          <span className="text-red-400 text-xs">Unavailable</span>
        )}
      </td>
      <td
        className={`py-3 px-4 text-sm ${cheaper === "swiggy" ? "text-orange-700 font-semibold" : "text-gray-600"}`}
      >
        {swiggy.status === "available" ? (
          <div>
            <div>{swiggy.pack_size}</div>
            <div className="font-medium">
              {formatPrice(swiggy.total_price)}
            </div>
          </div>
        ) : (
          <span className="text-red-400 text-xs">Unavailable</span>
        )}
      </td>
      <td className="py-3 px-4">
        <PlatformBadge
          platform={cheaper === "tie" ? "zepto" : cheaper === "swiggy" ? "swiggy_instamart" : "zepto"}
        />
      </td>
    </tr>
  );
}

export default function ComparisonTable({ data }: ComparisonTableProps) {
  const { zepto_items, swiggy_items, recommended, reasoning } = data;

  // Build paired rows
  const ingredientNames = new Set([
    ...zepto_items.map((i) => i.ingredient),
    ...swiggy_items.map((i) => i.ingredient),
  ]);

  const zeptoMap = Object.fromEntries(
    zepto_items.map((i) => [i.ingredient, i])
  );
  const swiggyMap = Object.fromEntries(
    swiggy_items.map((i) => [i.ingredient, i])
  );

  const empty: ResolvedSKU = {
    ingredient: "",
    status: "unavailable",
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-md overflow-hidden">
      <div className="bg-gradient-to-r from-purple-500 to-orange-500 px-6 py-4">
        <h3 className="text-xl font-bold text-white">Price Comparison</h3>
        <p className="text-white/80 text-sm">{reasoning}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="py-3 px-4">Ingredient</th>
              <th className="py-3 px-4">Needed</th>
              <th className="py-3 px-4">
                <span className="text-purple-600">Zepto</span>
              </th>
              <th className="py-3 px-4">
                <span className="text-orange-600">Swiggy Instamart</span>
              </th>
              <th className="py-3 px-4">Pick</th>
            </tr>
          </thead>
          <tbody>
            {[...ingredientNames].map((name) => {
              const z = zeptoMap[name] || { ...empty, ingredient: name };
              const s = swiggyMap[name] || { ...empty, ingredient: name };
              const zPrice = z.total_price ?? Infinity;
              const sPrice = s.total_price ?? Infinity;
              const cheaper: "zepto" | "swiggy" | "tie" =
                zPrice < sPrice
                  ? "zepto"
                  : sPrice < zPrice
                    ? "swiggy"
                    : "tie";
              return (
                <ItemRow
                  key={name}
                  zepto={z}
                  swiggy={s}
                  cheaper={cheaper}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary bar */}
      <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
        <div>
          <span className="text-sm text-gray-500">Recommended: </span>
          <PlatformBadge platform={recommended.platform || "zepto"} />
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-800">
            {formatPrice(recommended.total)}
          </div>
          <div className="text-xs text-gray-400">
            incl. ₹{recommended.delivery_fee} delivery &middot; ~
            {recommended.eta} min
          </div>
        </div>
      </div>
    </div>
  );
}
