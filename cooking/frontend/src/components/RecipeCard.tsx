"use client";

import type { Ingredient, SkippedItem } from "@/lib/types";

interface RecipeCardProps {
  dish: string;
  servings: number;
  ingredients: Ingredient[];
  skipped?: SkippedItem[];
}

function CategoryIcon({ category }: { category: string }) {
  const iconClass = "flex-shrink-0";
  const size = 14;
  const sw = "1.5";

  const icons: Record<string, React.ReactNode> = {
    protein: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} className={`${iconClass} text-red-400`}>
        <path d="M6 13.87A4 4 0 0112 14a4 4 0 016-.13V21a1 1 0 01-1 1H7a1 1 0 01-1-1v-7.13z" />
        <line x1="12" y1="3" x2="12" y2="7" />
      </svg>
    ),
    dairy: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} className={`${iconClass} text-yellow-300`}>
        <path d="M8 2h8l2 6H6l2-6z" />
        <rect x="6" y="8" width="12" height="14" rx="1" />
      </svg>
    ),
    vegetable: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} className={`${iconClass} text-green-400`}>
        <path d="M7 20h10" />
        <path d="M10 20c5.5-2.5 8-7 8-14H6c0 7 2.5 11.5 8 14z" />
      </svg>
    ),
    spice: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} className={`${iconClass} text-orange-400`}>
        <path d="M12 10V2" />
        <path d="M8 6c0 4 8 4 8 0" />
        <circle cx="12" cy="17" r="5" />
      </svg>
    ),
    grain: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} className={`${iconClass} text-amber-400`}>
        <path d="M2 22L16 8" />
        <path d="M3.47 12.53L5 11l1.53 1.53a3.5 3.5 0 010 4.94L5 19l-1.53-1.53a3.5 3.5 0 010-4.94z" />
      </svg>
    ),
    condiment: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} className={`${iconClass} text-rose-400`}>
        <path d="M10 2v4a2 2 0 002 2h0a2 2 0 002-2V2" />
        <path d="M8 8h8l-1 14H9L8 8z" />
      </svg>
    ),
    seasoning: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} className={`${iconClass} text-warm-300`}>
        <rect x="8" y="2" width="8" height="6" rx="1" />
        <path d="M10 8v2" />
        <path d="M14 8v2" />
        <rect x="6" y="10" width="12" height="12" rx="2" />
      </svg>
    ),
  };

  const fallback = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} className={`${iconClass} text-warm-400`}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
    </svg>
  );

  return <>{icons[category] || fallback}</>;
}

export default function RecipeCard({
  dish,
  servings,
  ingredients,
  skipped,
}: RecipeCardProps) {
  const buyItems = ingredients.filter((i) => !i.is_common_staple);
  const stapleItems = skipped ?? ingredients.filter((i) => i.is_common_staple);

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,252,248,0.04)" }}>
        <div className="flex items-center gap-2 mb-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <h3 className="text-base font-semibold text-warm-50 capitalize">
            {dish}
          </h3>
        </div>
        <p className="text-warm-400 text-xs">
          {servings} servings &middot; {ingredients.length} ingredients
        </p>
      </div>

      <div className="p-5">
        <h4 className="text-[11px] font-semibold text-warm-600 uppercase tracking-wider mb-3">
          Shopping List ({buyItems.length})
        </h4>
        <div className="space-y-1.5">
          {buyItems.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 px-3 rounded-lg
                         bg-white/[0.02] hover:bg-white/5 transition-colors"
              style={{
                animation: "fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
                animationDelay: `${i * 0.04}s`,
              }}
            >
              <div className="flex items-center gap-2.5">
                <CategoryIcon category={item.category} />
                <span className="text-warm-100 text-sm font-medium">
                  {item.name}
                </span>
              </div>
              <span className="text-warm-400 text-xs font-mono">
                {item.quantity > 0
                  ? `${item.quantity} ${item.unit}`
                  : item.unit}
              </span>
            </div>
          ))}
        </div>

        {stapleItems.length > 0 && (
          <div className="mt-5 pt-4" style={{ borderTop: "1px solid rgba(255,252,248,0.04)" }}>
            <h4 className="text-[11px] font-semibold text-warm-600 uppercase tracking-wider mb-2.5">
              In Your Pantry ({stapleItems.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {stapleItems.map((item, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                             bg-ok/5 text-ok text-xs font-medium"
                  style={{ border: "1px solid rgba(52,211,153,0.1)" }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {item.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
