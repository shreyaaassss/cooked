import json
import subprocess
import os


# Path to the Zepto MCP runner script (bundled at backend/scripts/zepto-mcp-runner.mjs)
ZEPTO_RUNNER = os.environ.get(
    "ZEPTO_MCP_RUNNER",
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "scripts",
        "zepto-mcp-runner.mjs",
    ),
)


class ZeptoService:
    """Wraps the Zepto MCP via the zepto-mcp-runner.mjs helper script.

    The runner handles MCP initialization, auth, and tool calls
    over a single persistent connection per invocation.
    """

    def __init__(self, runner_path: str | None = None):
        self.runner = runner_path or ZEPTO_RUNNER

    async def search_product(self, query: str) -> list[dict]:
        """Search for a single product on Zepto."""
        calls = []
        try:
            addresses = self._run_mcp("list_saved_addresses", {})
            addr_list = addresses.get("addresses", []) if isinstance(addresses, dict) else []
            if addr_list:
                addr_id = addr_list[0]["id"]
                calls.append({"name": "select_saved_address", "arguments": {"addressId": addr_id}})
            else:
                calls.append({"name": "get_location_serviceability", "arguments": {"latitude": 18.5089, "longitude": 73.9260}})
        except Exception:
            calls.append({"name": "get_location_serviceability", "arguments": {"latitude": 18.5089, "longitude": 73.9260}})
            
        calls.append({"name": "search_products", "arguments": {"query": query, "pageNumber": 0}})
        
        batch_res = self._run_batch(calls)
        search_res = batch_res[-1].get("result", {})
        if isinstance(search_res, dict):
            return search_res.get("products", [])
        return search_res if isinstance(search_res, list) else []

    async def search_multiple(self, queries: list[str]) -> dict:
        """Search for multiple products in a single MCP call.

        Returns dict mapping query name -> list of product SKUs.
        """
        calls = []
        try:
            addresses = self._run_mcp("list_saved_addresses", {})
            addr_list = addresses.get("addresses", []) if isinstance(addresses, dict) else []
            if addr_list:
                addr_id = addr_list[0]["id"]
                calls.append({"name": "select_saved_address", "arguments": {"addressId": addr_id}})
            else:
                calls.append({"name": "get_location_serviceability", "arguments": {"latitude": 18.5089, "longitude": 73.9260}})
        except Exception:
            calls.append({"name": "get_location_serviceability", "arguments": {"latitude": 18.5089, "longitude": 73.9260}})

        calls.append({"name": "search_multiple_products", "arguments": {"queries": queries, "pageNumber": 0}})

        batch_res = self._run_batch(calls)
        search_res = batch_res[-1].get("result", {})

        # Zepto returns {"sections": [{"query": "...", "products": [...]}]}
        # Normalize to {query_name: [products]}
        results: dict[str, list[dict]] = {}
        if isinstance(search_res, dict):
            sections = search_res.get("sections", [])
            if sections:
                for section in sections:
                    query = section.get("query", "")
                    products = section.get("products", [])
                    # Normalize product fields for SKU resolver
                    normalized = []
                    for p in products:
                        normalized.append({
                            "id": p.get("id", p.get("productVariantId", "")),
                            "productId": p.get("id", p.get("productVariantId", "")),
                            "name": p.get("name", ""),
                            "price": p.get("price", 0) / 100 if p.get("price", 0) > 1000 else p.get("price", 0),
                            "sellingPrice": p.get("price", 0) / 100 if p.get("price", 0) > 1000 else p.get("price", 0),
                            "packSize": p.get("packSize", ""),
                        })
                    results[query] = normalized
            else:
                # Fallback: maybe it's already in {query: products} format
                results = search_res
        return results

    async def get_addresses(self) -> list[dict]:
        """Get saved delivery addresses."""
        return self._run_mcp("list_saved_addresses", {})

    async def select_address(self, address_id: str) -> dict:
        """Select a delivery address."""
        return self._run_mcp("select_saved_address", {"addressId": address_id})

    async def get_product_details(self, variant_id: str) -> dict:
        """Full product detail for a variant — the only place `productId`
        (distinct from `productVariantId`) is returned; search results
        don't include it."""
        return self._run_mcp("get_product_details", {"product_variant_id": variant_id})

    def _cart_item_args(self, item: dict) -> dict:
        """Each cart item needs productId, productVariantId AND
        storeProductId together — confirmed live that productVariantId
        alone silently no-ops (no error, cart just stays empty)."""
        return {
            "productId": item["product_id"],
            "productVariantId": item["sku_id"],
            "storeProductId": item["store_product_id"],
            "quantity": item.get("quantity", 1),
        }

    async def update_cart(self, items: list[dict], device_id: str = "cookcart-agent") -> dict:
        """Add/update items in cart. `items` must already carry product_id
        and store_product_id (see `resolve_cart_items`)."""
        return self._run_mcp(
            "update_cart",
            {"deviceId": device_id, "cartItems": [self._cart_item_args(i) for i in items]},
        )

    async def resolve_cart_items(self, resolved_skus: list[dict]) -> list[dict]:
        """Fetch each item's real productId/storeProductId via
        get_product_details, batched into one subprocess call. Needed before
        update_cart, since search results alone don't carry productId."""
        calls = [
            {"name": "get_product_details", "arguments": {"product_variant_id": i["sku_id"]}}
            for i in resolved_skus
        ]
        batch_raw = self._run_batch(calls)
        # Runner returns the unwrapped single result for one call, a list for several.
        batch = batch_raw if isinstance(batch_raw, list) else [{"name": "get_product_details", "result": batch_raw}]
        items = []
        for sku, call in zip(resolved_skus, batch):
            detail = call.get("result", {}) if isinstance(call, dict) else {}
            if not isinstance(detail, dict) or not detail.get("productId"):
                raise RuntimeError(f"couldn't resolve product details for {sku.get('sku_name', sku.get('sku_id'))}")
            items.append(
                {
                    **sku,
                    "product_id": detail["productId"],
                    "store_product_id": detail.get("storeProductId"),
                }
            )
        return items

    async def view_cart(self) -> dict:
        """View current cart contents and totals."""
        return self._run_mcp("view_cart", {})

    async def get_payment_methods(self) -> list:
        """Get available payment methods."""
        return self._run_mcp("get_payment_methods", {})

    async def create_order_preview(self, address_id: str) -> dict:
        """Create order preview (confirmOrder=false) to get final amount."""
        return self._run_mcp(
            "create_online_payment_order",
            {
                "confirmOrder": False,
                "riderTip": 0,
                "userAddressId": address_id,
                "useZeptoCash": False,
            },
        )

    async def create_order_confirmed(self, address_id: str) -> dict:
        """Create confirmed order (confirmOrder=true) to get payment link."""
        return self._run_mcp(
            "create_online_payment_order",
            {
                "confirmOrder": True,
                "riderTip": 0,
                "userAddressId": address_id,
                "useZeptoCash": False,
            },
        )

    async def check_payment_status(self, order_id: str) -> dict:
        """Check payment/order status."""
        return self._run_mcp(
            "check_payment_status", {"orderId": order_id, "poll": False}
        )

    async def build_cart_batch(self, address_id: str, items: list[dict]) -> list[dict]:
        """Select the address, then set the whole cart in one `update_cart`
        call, then view it and check payment methods.

        `items` must already carry product_id/store_product_id — call
        `resolve_cart_items` first (get_product_details doesn't need an
        address, so that step runs independently before this one).
        """
        calls = [
            {"name": "select_saved_address", "arguments": {"addressId": address_id}},
            {
                "name": "update_cart",
                "arguments": {
                    "deviceId": "cookcart-agent",
                    "cartItems": [self._cart_item_args(i) for i in items],
                },
            },
            {"name": "view_cart", "arguments": {}},
            {"name": "get_payment_methods", "arguments": {}},
        ]
        return self._run_batch(calls)

    def _run_mcp(self, tool_name: str, args: dict) -> dict | list:
        """Execute a Zepto MCP tool via the runner script."""
        cmd = ["node", self.runner, "--compact", tool_name, json.dumps(args)]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60, encoding="utf-8", errors="replace")
        if result.returncode != 0:
            raise RuntimeError(f"Zepto MCP error: {result.stderr}")
        return json.loads(result.stdout)

    def _run_batch(self, calls: list[dict]) -> list[dict]:
        """Execute multiple Zepto MCP calls in a single process."""
        batch_json = json.dumps(calls)
        cmd = ["node", self.runner, "--compact", "--batch-json", batch_json]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120, encoding="utf-8", errors="replace")
        if result.returncode != 0:
            raise RuntimeError(f"Zepto MCP batch error: {result.stderr}")
        return json.loads(result.stdout)
