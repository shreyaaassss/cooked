import json
import os
import subprocess

# Path to our Swiggy MCP runner script (mirrors zepto-mcp-runner.mjs)
SWIGGY_RUNNER = os.environ.get(
    "SWIGGY_MCP_RUNNER",
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "scripts",
        "swiggy-mcp-runner.mjs",
    ),
)


class SwiggyInstamartService:
    """Wraps Swiggy Instamart MCP via swiggy-mcp-runner.mjs.

    Uses the same runner pattern as ZeptoService:
    - Spawns a single mcp-remote process per invocation
    - Handles JSON-RPC init handshake, then runs tool calls sequentially
    - Supports single calls, batch calls, and --compact output

    The runner connects to https://mcp.swiggy.com/im by default.
    Pass endpoint="food" or endpoint="dineout" to switch Swiggy services.
    """

    def __init__(
        self,
        runner_path: str | None = None,
        endpoint: str = "instamart",
    ):
        self.runner = runner_path or SWIGGY_RUNNER
        # "instamart", "food", "dineout", or a raw URL
        self.endpoint = endpoint

    async def search_product(self, query: str) -> list[dict]:
        """Search for a single product on Swiggy Instamart."""
        address_id = await self._default_address_id()

        result = self._run_mcp("search_products", {"query": query, "addressId": address_id})
        raw_products = self._extract_products(result)

        flat_skus = []
        for prod in raw_products:
            variations = prod.get("variations", [])
            for var in variations:
                price_obj = var.get("price", {})
                flat_skus.append({
                    "id": var.get("skuId"),
                    "productId": var.get("skuId"),
                    "spinId": var.get("spinId"),
                    "name": f"{prod.get('displayName', '')} - {var.get('displayName', '')}",
                    "price": float(price_obj.get("offerPrice", price_obj.get("mrp", 0))),
                    "packSize": var.get("quantityDescription"),
                })
        return flat_skus

    async def search_multiple(self, queries: list[str]) -> dict:
        """Search for multiple products. Runs one search per query
        in a single MCP process via batch mode."""
        address_id = await self._default_address_id()

        calls = [
            {"name": "search_products", "arguments": {"query": q, "addressId": address_id}}
            for q in queries
        ]
        batch_raw = self._run_batch(calls)

        # Runner returns single result directly for 1 call, or list for multiple
        if isinstance(batch_raw, list):
            batch_results = batch_raw
        else:
            # Single call returned unwrapped — wrap it to match expected format
            batch_results = [{"name": "search_products", "result": batch_raw}]

        # Map results back to query names
        results: dict[str, list[dict]] = {}
        for query, item in zip(queries, batch_results):
            raw = item.get("result", item) if isinstance(item, dict) else item
            raw_products = self._extract_products(raw)

            flat_skus = []
            for prod in raw_products:
                variations = prod.get("variations", [])
                for var in variations:
                    price_obj = var.get("price", {})
                    flat_skus.append({
                        "id": var.get("skuId"),
                        "productId": var.get("skuId"),
                        "spinId": var.get("spinId"),
                        "name": f"{prod.get('displayName', '')} - {var.get('displayName', '')}",
                        "price": float(price_obj.get("offerPrice", price_obj.get("mrp", 0))),
                        "packSize": var.get("quantityDescription"),
                    })
            results[query] = flat_skus
        return results

    async def _default_address_id(self) -> str:
        """The account's default saved address, per get_addresses' own
        ranking — not just the first item in the list."""
        try:
            addresses = self._run_mcp("get_addresses", {})
        except Exception:
            return "86719714"  # last-resort fallback; search will just find nothing useful
        if not isinstance(addresses, dict):
            return "86719714"
        default_id = (addresses.get("resolution") or {}).get("defaultAddressId")
        if default_id:
            return default_id
        addr_list = addresses.get("addresses", [])
        return addr_list[0]["id"] if addr_list else "86719714"

    @staticmethod
    def _extract_products(raw) -> list:
        """Extract products list from various Swiggy response shapes."""
        if isinstance(raw, list):
            return raw
        if not isinstance(raw, dict):
            return []
        # {"success": true, "data": {"products": [...]}}
        if "data" in raw and isinstance(raw["data"], dict):
            return raw["data"].get("products", raw["data"].get("items", []))
        # {"products": [...]}
        return raw.get("products", raw.get("items", []))

    async def get_addresses(self) -> list[dict]:
        """Get saved delivery addresses."""
        return self._run_mcp("get_addresses", {})

    async def update_cart(self, items: list[dict], address_id: str) -> dict:
        """Replace the cart contents. Each item needs both `spinId` and
        `skuId` from search_products — skuId alone is rejected by the server.
        """
        return self._run_mcp(
            "update_cart",
            {
                "selectedAddressId": address_id,
                "items": [
                    {"spinId": i["spin_id"], "skuId": i["sku_id"], "quantity": i.get("quantity", 1)}
                    for i in items
                ],
            },
        )

    async def get_cart(self) -> dict:
        """View current Swiggy Instamart cart."""
        return self._run_mcp("get_cart", {})

    async def clear_cart(self) -> dict:
        """Empty the cart."""
        return self._run_mcp("clear_cart", {})

    async def get_payment_options(self, address_id: str) -> dict:
        """Available payment methods for the current cart."""
        return self._run_mcp("get_payment_options", {"addressId": address_id})

    async def build_cart_batch(self, address_id: str, items: list[dict]) -> list[dict]:
        """Build the cart in one batch: set items, then view it, then payment options."""
        calls = [
            {
                "name": "update_cart",
                "arguments": {
                    "selectedAddressId": address_id,
                    "items": [
                        {"spinId": i["spin_id"], "skuId": i["sku_id"], "quantity": i.get("quantity", 1)}
                        for i in items
                    ],
                },
            },
            {"name": "get_cart", "arguments": {}},
            {"name": "get_payment_options", "arguments": {"addressId": address_id}},
        ]
        return self._run_batch(calls)

    # ── Internal runner methods (same pattern as ZeptoService) ──

    def _build_cmd(self, extra_args: list[str]) -> list[str]:
        """Build the node command with optional --endpoint flag."""
        cmd = ["node", self.runner]
        if self.endpoint != "instamart":
            cmd.extend(["--endpoint", self.endpoint])
        cmd.extend(extra_args)
        return cmd

    def _run_mcp(self, tool_name: str, args: dict) -> dict | list:
        """Execute a single Swiggy MCP tool via the runner script."""
        cmd = self._build_cmd(["--compact", tool_name, json.dumps(args)])
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=60, encoding="utf-8", errors="replace"
        )
        if result.returncode != 0:
            raise RuntimeError(f"Swiggy MCP error: {result.stderr}")
        return json.loads(result.stdout)

    def _run_batch(self, calls: list[dict]) -> list[dict]:
        """Execute multiple Swiggy MCP calls in a single mcp-remote process."""
        batch_json = json.dumps(calls)
        cmd = self._build_cmd(["--compact", "--batch-json", batch_json])
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=120, encoding="utf-8", errors="replace"
        )
        if result.returncode != 0:
            raise RuntimeError(f"Swiggy MCP batch error: {result.stderr}")
        return json.loads(result.stdout)
