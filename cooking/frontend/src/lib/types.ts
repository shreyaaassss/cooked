// ===== Recipe Types =====
export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  is_common_staple: boolean;
}

export interface RecipeResult {
  dish: string;
  servings: number;
  ingredients: Ingredient[];
}

// ===== Pantry Types =====
export interface PantryStaple {
  id: string;
  ingredient_name: string;
  always_have: boolean;
}

export interface SkippedItem extends Ingredient {
  skip_reason: string;
}

// ===== SKU / Comparison Types =====
export interface ResolvedSKU {
  ingredient: string;
  status: "available" | "unavailable";
  sku_id?: string;
  sku_name?: string;
  pack_size?: string;
  quantity?: number;
  price_per_unit?: number;
  total_price?: number;
  needed?: string;
  getting?: string;
  reasoning?: string;
}

export interface CartRecommendation {
  strategy: "single_platform" | "split";
  platform?: string;
  platforms?: string[];
  total: number;
  item_total: number;
  delivery_fee: number;
  eta: number;
  items: ResolvedSKU[];
  unavailable: string[];
  savings_vs_single?: number;
}

export interface CompareResult {
  buy_list: Ingredient[];
  skipped: SkippedItem[];
  zepto_items: ResolvedSKU[];
  swiggy_items: ResolvedSKU[];
  recommended: CartRecommendation;
  alternatives: CartRecommendation[];
  reasoning: string;
  errors?: string[];
}

// ===== Checkout Types =====
export interface CheckoutInitResult {
  order_id: string;
  prava_payment_url: string | null;
  session_id: string | null;
  status: string;
  message: string;
}

export interface OrderStatus {
  order_id: string;
  source_recipe: string;
  platform: string;
  items: ResolvedSKU[];
  skipped: SkippedItem[];
  total: number | null;
  status: string;
  eta_minutes: number | null;
  platform_order_id: string | null;
  created_at: string | null;
}

// ===== App State =====
export type AppStep =
  | "input"
  | "recipe"
  | "comparing"
  | "comparison"
  | "confirmation"
  | "prava_approval"
  | "completing"
  | "done"
  | "error";

export interface AppState {
  step: AppStep;
  dish: string;
  servings: number;
  recipe: RecipeResult | null;
  comparison: CompareResult | null;
  checkout: CheckoutInitResult | null;
  order: OrderStatus | null;
  error: string | null;
}
