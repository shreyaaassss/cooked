# CookCart — Backend API Reference

**Base URL:** `http://localhost:8000`
**Content-Type:** All endpoints accept and return `application/json`
**Default User ID:** `00000000-0000-0000-0000-000000000001` (used when `user_id` is omitted)
**Currency:** All prices are in Indian Rupees (INR)

---

## 1. Agent Chat (`/api/agent`)

### POST `/api/agent/chat`

Conversational grocery agent. Takes a chat history, uses GPT-4o to understand intent, extracts grocery items, and if intent is `search`, runs the full compare pipeline (pantry diff → Zepto + Swiggy search → SKU resolution → cart optimization).

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "I need 1kg onions and 200g paneer" }
  ],
  "user_id": "string (optional)"
}
```

**Response:**
```json
{
  "intent": "search | greeting | clarify | confirm | help",
  "message": "Great choice! Let me find the best prices for you.",
  "items": [
    { "name": "onion", "quantity": 1, "unit": "kg" },
    { "name": "paneer", "quantity": 200, "unit": "g" }
  ],
  "comparison": { /* same shape as POST /api/compare/prices response, or null */ }
}
```

**Intents:**
| Intent | When | `items` | `comparison` |
|--------|------|---------|-------------|
| `search` | User wants groceries | Extracted items | Full comparison result |
| `greeting` | "hi", "hello" | `[]` | `null` |
| `clarify` | Need more info ("how much paneer?") | `[]` | `null` |
| `confirm` | User confirms order | `[]` | `null` |
| `help` | "what can you do?" | `[]` | `null` |

---

## 2. Recipe Decomposition (`/api/recipe`)

### POST `/api/recipe/decompose`

Parses a dish name into a structured ingredient list using GPT-4o.

**Request:**
```json
{
  "dish": "butter chicken",
  "servings": 4
}
```
- `dish` — required, string
- `servings` — required, integer (1–20)

**Response:**
```json
{
  "dish": "butter chicken",
  "servings": 4,
  "ingredients": [
    {
      "name": "boneless chicken thighs",
      "quantity": 600,
      "unit": "g",
      "category": "protein",
      "is_common_staple": false
    },
    {
      "name": "salt",
      "quantity": 0,
      "unit": "to taste",
      "category": "seasoning",
      "is_common_staple": true
    }
  ]
}
```

**Ingredient categories:** `protein`, `dairy`, `vegetable`, `spice`, `grain`, `condiment`, `seasoning`, `other`

---

## 3. Price Comparison (`/api/compare`)

### POST `/api/compare/prices`

Full comparison pipeline:
1. Removes pantry staples from the list
2. Searches Zepto and Swiggy Instamart for each ingredient
3. Resolves best-matching pack sizes (always rounds up)
4. Builds candidate carts and recommends the cheapest option

**Request:**
```json
{
  "user_id": "string (optional)",
  "ingredients": [
    {
      "name": "onion",
      "quantity": 500,
      "unit": "g",
      "category": "vegetable",
      "is_common_staple": false
    }
  ]
}
```

**Response:**
```json
{
  "buy_list": [ /* ingredients after pantry diff */ ],
  "skipped": [
    {
      "name": "salt",
      "quantity": 0,
      "unit": "to taste",
      "skip_reason": "pantry staple | common staple"
    }
  ],
  "zepto_items": [ /* resolved SKUs, see SKU model below */ ],
  "swiggy_items": [ /* resolved SKUs */ ],
  "recommended": { /* cart recommendation, see Cart model below */ },
  "alternatives": [ /* other cart options */ ],
  "reasoning": "All from Zepto: Rs182 total (Rs208 cheaper than Swiggy Instamart)",
  "errors": ["Swiggy search failed: ..."] or null
}
```

---

## 4. Pantry Management (`/api/pantry`)

### GET `/api/pantry/staples?user_id=...`

List all pantry staples. These items are auto-skipped during price comparison.

**Response:**
```json
[
  { "id": "uuid", "ingredient_name": "salt", "always_have": true },
  { "id": "uuid", "ingredient_name": "turmeric", "always_have": true }
]
```

### POST `/api/pantry/staples`

Add a pantry staple.

**Request:**
```json
{
  "ingredient_name": "salt",
  "user_id": "string (optional)"
}
```

**Response:**
```json
{ "id": "uuid", "ingredient_name": "salt", "always_have": true }
```

### DELETE `/api/pantry/staples/{ingredient_name}?user_id=...`

Remove a pantry staple.

**Response:** `{ "removed": "salt" }`
**404** if not found.

---

## 5. Checkout (`/api/checkout`)

### GET `/api/checkout/prava-status`

Check if Prava payment agent is active.

**Response:**
```json
{ "status": "active | pending | not_configured", "raw": "..." }
```

### POST `/api/checkout/initiate`

Creates an order and Prava payment session.

**Request:**
```json
{
  "platform": "zepto | swiggy_instamart",
  "cart_items": [ /* resolved SKU items */ ],
  "total_amount": 182.0,
  "source_recipe": "butter chicken",
  "skipped_items": [],
  "user_id": "string (optional)"
}
```

**Response:**
```json
{
  "order_id": "uuid",
  "prava_payment_url": "https://..." or null,
  "session_id": "string" or null,
  "status": "awaiting_approval",
  "message": "Please approve the payment of Rs182.00 on the Prava page."
}
```

**Errors:** `400` if Prava inactive or spend cap exceeded. `500` if session creation fails.

### POST `/api/checkout/complete/{order_id}`

Poll Prava for approval, receive tokenized credentials.

**Response:**
```json
{
  "order_id": "uuid",
  "status": "payment_pending | failed",
  "platform": "zepto",
  "total": 182.0,
  "credentials_received": true,
  "message": "Payment approved! Completing checkout..."
}
```

### GET `/api/checkout/order/{order_id}`

Get order details.

**Response:**
```json
{
  "order_id": "uuid",
  "source_recipe": "butter chicken",
  "platform": "zepto",
  "items": [ /* cart items */ ],
  "skipped": [ /* skipped items */ ],
  "total": 182.0,
  "status": "pending_approval | approved | payment_pending | paid | failed | cancelled",
  "eta_minutes": 14,
  "platform_order_id": "string" or null,
  "created_at": "2026-07-21T10:30:00+05:30"
}
```

---

## 6. Orders (`/api/orders`)

### GET `/api/orders/?user_id=...&limit=20`

List recent orders.

**Response:**
```json
[
  {
    "order_id": "uuid",
    "source_recipe": "butter chicken",
    "platform": "zepto",
    "total": 182.0,
    "status": "paid",
    "created_at": "2026-07-21T10:30:00+05:30"
  }
]
```

---

## 7. Addresses (`/api/address`)

### GET `/api/address/zepto`

List saved Zepto addresses.

**Response:**
```json
{
  "platform": "zepto",
  "addresses": [
    {
      "id": "uuid",
      "type": "HOME | WORK | OTHER",
      "name": "My Home",
      "formattedAddress": "301, Sunrise Apts, Kothrud, Pune 411038",
      "shortAddress": "Kothrud, Pune",
      "latitude": 18.5089,
      "longitude": 73.926
    }
  ]
}
```

### POST `/api/address/zepto/select?address_id=...`

Select a delivery address for Zepto.

**Response:** `{ "platform": "zepto", "selected": "uuid", "result": {...} }`

### POST `/api/address/zepto/add`

Add a new Zepto delivery address.

**Request:**
```json
{
  "type": "HOME",
  "name": "My Home",
  "flat_details": "A-301",
  "building_name": "Sunrise Apartments",
  "landmark": "Near City Mall",
  "latitude": 18.5089,
  "longitude": 73.926,
  "formatted_address": "A-301, Sunrise Apartments, Kothrud, Pune 411038",
  "short_address": "Kothrud, Pune",
  "contact_name": "Shreyas",
  "contact_number": "+91 9876543210"
}
```

Required fields: `type`, `name`, `flat_details`, `building_name`, `latitude`, `longitude`, `formatted_address`, `short_address`

**Response:** `{ "platform": "zepto", "result": {...} }`

### GET `/api/address/zepto/serviceability?latitude=18.5&longitude=73.9`

Check if Zepto delivers to a location.

**Response:** `{ "platform": "zepto", "serviceable": true, "result": {...} }`

### GET `/api/address/swiggy`

List saved Swiggy addresses (synced from Swiggy account, read-only).

**Response:**
```json
{
  "platform": "swiggy",
  "addresses": [
    {
      "id": "d6q2fu9ls48rdh81njc0",
      "addressLine": "Shreyas: Ratnaprabha building, Masulkar Colony...",
      "phoneNumber": "****5178",
      "addressCategory": "Other",
      "addressTag": "Grandparents"
    }
  ]
}
```

---

## Data Models

### Resolved SKU (available)
```json
{
  "ingredient": "paneer",
  "status": "available",
  "sku_id": "5c5e2f50-...",
  "sku_name": "Desi Farms Low Fat Paneer",
  "pack_size": "1 pack (200 g)",
  "quantity": 1,
  "price_per_unit": 67.0,
  "total_price": 67.0,
  "needed": "200.0g",
  "getting": "200.0g",
  "reasoning": "Exact match: Desi Farms Low Fat Paneer covers 200.0g"
}
```

### Resolved SKU (unavailable)
```json
{
  "ingredient": "paneer",
  "status": "unavailable",
  "reasoning": "No SKUs found for paneer"
}
```

### Cart Recommendation (single platform)
```json
{
  "strategy": "single_platform",
  "platform": "zepto",
  "total": 182.0,
  "item_total": 157.0,
  "delivery_fee": 25.0,
  "eta": 14,
  "items": [ /* resolved SKUs with status=available */ ],
  "unavailable": ["garam masala"]
}
```

### Cart Recommendation (split across platforms)
```json
{
  "strategy": "split",
  "platforms": ["zepto", "swiggy_instamart"],
  "zepto_items": [ /* SKUs cheaper on Zepto */ ],
  "swiggy_items": [ /* SKUs cheaper on Swiggy */ ],
  "total": 323.0,
  "item_total": 268.0,
  "delivery_fee": 55.0,
  "eta": 19,
  "savings_vs_single": 31.0,
  "unavailable": []
}
```

> **Note on split carts:** When `strategy` is `split`, there is no `platform` field — use `platforms` array instead. Items are in `zepto_items` and `swiggy_items` rather than `items`.

---

## Error Format

All errors return:
```json
{ "detail": "Error message here" }
```

| Code | Meaning |
|------|---------|
| 400 | Validation error, business logic error (spend cap exceeded, etc.) |
| 404 | Resource not found |
| 500 | Server error |
| 502 | External service failure (Zepto/Swiggy MCP down or auth expired) |

---

## Platform Details

| Platform | Delivery Fee | ETA | Price Format |
|----------|-------------|-----|-------------|
| Zepto | Rs 25 | ~14 min | Paisa from API, converted to Rupees |
| Swiggy Instamart | Rs 30 | ~19 min | Rupees from API |

---

## Frontend Pages (current)

| Route | Purpose | Primary API |
|-------|---------|-------------|
| `/agent` | Chat-based grocery ordering | `POST /api/agent/chat` |
| `/list` | Manual grocery list builder | `POST /api/compare/prices` |
| `/` | Recipe-to-checkout | `POST /api/recipe/decompose` → `POST /api/compare/prices` |
| `/settings` | Addresses + pantry + spend controls | `/api/address/*`, `/api/pantry/*` |
