const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `API error: ${res.status}`);
  }
  return res.json();
}

// ===== Agent =====
export async function agentChat(
  messages: Array<{ role: string; content: string }>
) {
  return fetchAPI<{
    intent: string;
    message: string;
    items: Array<{ name: string; quantity: number; unit: string }>;
    comparison: {
      buy_list: Array<Record<string, unknown>>;
      skipped: Array<Record<string, unknown>>;
      zepto_items: Array<Record<string, unknown>>;
      swiggy_items: Array<Record<string, unknown>>;
      recommended: Record<string, unknown>;
      alternatives: Array<Record<string, unknown>>;
      reasoning: string;
      errors?: string[];
    } | null;
  }>("/api/agent/chat", {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
}

// ===== Address =====
export async function getZeptoAddresses() {
  return fetchAPI<{ platform: string; addresses: any[] }>("/api/address/zepto");
}

export async function selectZeptoAddress(addressId: string) {
  return fetchAPI<{ platform: string; selected: string; result: any }>(
    `/api/address/zepto/select?address_id=${addressId}`,
    { method: "POST" }
  );
}

export async function addZeptoAddress(data: {
  type: string;
  name: string;
  flat_details: string;
  building_name: string;
  landmark?: string;
  latitude: number;
  longitude: number;
  formatted_address: string;
  short_address: string;
  contact_name?: string;
  contact_number?: string;
}) {
  return fetchAPI("/api/address/zepto/add", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function checkZeptoServiceability(lat: number, lng: number) {
  return fetchAPI(
    `/api/address/zepto/serviceability?latitude=${lat}&longitude=${lng}`
  );
}

export async function getSwiggyAddresses() {
  return fetchAPI<{ platform: string; addresses: any[] }>("/api/address/swiggy");
}

// ===== Recipe =====
export async function decomposeRecipe(dish: string, servings: number) {
  return fetchAPI<{
    dish: string;
    servings: number;
    ingredients: Array<{
      name: string;
      quantity: number;
      unit: string;
      category: string;
      is_common_staple: boolean;
    }>;
  }>("/api/recipe/decompose", {
    method: "POST",
    body: JSON.stringify({ dish, servings }),
  });
}

// ===== Pantry =====
export async function getPantryStaples(userId?: string) {
  const params = userId ? `?user_id=${userId}` : "";
  return fetchAPI<
    Array<{ id: string; ingredient_name: string; always_have: boolean }>
  >(`/api/pantry/staples${params}`);
}

export async function addPantryStaple(ingredientName: string, userId?: string) {
  return fetchAPI("/api/pantry/staples", {
    method: "POST",
    body: JSON.stringify({
      ingredient_name: ingredientName,
      ...(userId && { user_id: userId }),
    }),
  });
}

export async function removePantryStaple(
  ingredientName: string,
  userId?: string
) {
  const params = userId ? `?user_id=${userId}` : "";
  return fetchAPI(`/api/pantry/staples/${ingredientName}${params}`, {
    method: "DELETE",
  });
}

// ===== Compare =====
export async function comparePrices(
  ingredients: Array<Record<string, unknown>>,
  userId?: string
) {
  return fetchAPI("/api/compare/prices", {
    method: "POST",
    body: JSON.stringify({
      ingredients,
      ...(userId && { user_id: userId }),
    }),
  });
}

// ===== Checkout =====
export async function checkPravaStatus() {
  return fetchAPI<{ status: string; raw: string }>(
    "/api/checkout/prava-status"
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function initiateCheckout(data: {
  platform: string;
  cart_items: any[];
  total_amount: number;
  source_recipe: string;
  skipped_items?: any[];
  user_id?: string;
}) {
  return fetchAPI<{
    order_id: string;
    prava_payment_url: string | null;
    session_id: string | null;
    status: string;
    message: string;
  }>("/api/checkout/initiate", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function completeCheckout(orderId: string) {
  return fetchAPI(`/api/checkout/complete/${orderId}`, {
    method: "POST",
  });
}

export async function getOrder(orderId: string) {
  return fetchAPI(`/api/checkout/order/${orderId}`);
}

// ===== Orders =====
export async function listOrders(userId?: string) {
  const params = userId ? `?user_id=${userId}` : "";
  return fetchAPI<
    Array<{
      order_id: string;
      source_recipe: string;
      platform: string;
      total: number | null;
      status: string;
      created_at: string | null;
    }>
  >(`/api/orders/${params}`);
}
