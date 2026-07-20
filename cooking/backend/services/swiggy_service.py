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
        address_id = None
        try:
            addresses = self._run_mcp("get_addresses", {})
            addr_list = addresses.get("addresses", []) if isinstance(addresses, dict) else []
            if addr_list:
                address_id = addr_list[0]["id"]
        except Exception:
            pass
        if not address_id:
            address_id = "86719714"

        result = self._run_mcp("search_products", {"query": query, "addressId": address_id})
        raw_products = []
        if isinstance(result, dict):
            raw_products = result.get("products", result.get("items", []))
        elif isinstance(result, list):
            raw_products = result

        flat_skus = []
        for prod in raw_products:
            variations = prod.get("variations", [])
            for var in variations:
                flat_skus.append({
                    "id": var.get("skuId"),
                    "productId": var.get("skuId"),
                    "name": f"{prod.get('displayName', '')} - {var.get('displayName', '')}",
                    "price": float(var.get("price", {}).get("offerPrice", var.get("price", {}).get("mrp", 0))),
                    "packSize": var.get("quantityDescription"),
                })
        return flat_skus

    async def search_multiple(self, queries: list[str]) -> dict:
        """Search for multiple products. Runs one search per query
        in a single MCP process via batch mode."""
        address_id = None
        try:
            addresses = self._run_mcp("get_addresses", {})
            addr_list = addresses.get("addresses", []) if isinstance(addresses, dict) else []
            if addr_list:
                address_id = addr_list[0]["id"]
        except Exception:
            pass
        if not address_id:
            address_id = "86719714"

        calls = [
            {"name": "search_products", "arguments": {"query": q, "addressId": address_id}}
            for q in queries
        ]
        batch_results = self._run_batch(calls)

        # Map results back to query names
        results: dict[str, list[dict]] = {}
        for query, item in zip(queries, batch_results):
            raw = item.get("result", item) if isinstance(item, dict) else item
            raw_products = []
            if isinstance(raw, dict):
                raw_products = raw.get("products", raw.get("items", []))
            elif isinstance(raw, list):
                raw_products = raw

            flat_skus = []
            for prod in raw_products:
                variations = prod.get("variations", [])
                for var in variations:
                    flat_skus.append({
                        "id": var.get("skuId"),
                        "productId": var.get("skuId"),
                        "name": f"{prod.get('displayName', '')} - {var.get('displayName', '')}",
                        "price": float(var.get("price", {}).get("offerPrice", var.get("price", {}).get("mrp", 0))),
                        "packSize": var.get("quantityDescription"),
                    })
            results[query] = flat_skus
        return results

    async def get_addresses(self) -> list[dict]:
        """Get saved delivery addresses."""
        return self._run_mcp("get_addresses", {})

    async def add_to_cart(self, product_id: str, quantity: int) -> dict:
        """Add item to Swiggy Instamart cart."""
        return self._run_mcp(
            "add_to_cart", {"productId": product_id, "quantity": quantity}
        )

    async def update_cart(self, product_id: str, quantity: int) -> dict:
        """Add/update product in cart (alias matching Zepto's API)."""
        return self._run_mcp(
            "update_cart", {"productId": product_id, "quantity": quantity}
        )

    async def view_cart(self) -> dict:
        """View current Swiggy Instamart cart."""
        return self._run_mcp("view_cart", {})

    async def get_payment_methods(self) -> list:
        """Get available payment methods."""
        return self._run_mcp("get_payment_methods", {})

    async def build_cart_batch(
        self, address_id: str, items: list[dict]
    ) -> list[dict]:
        """Build a full cart in one batch: select address + add items + view cart."""
        calls = [
            {"name": "select_address", "arguments": {"addressId": address_id}}
        ]
        for item in items:
            calls.append(
                {
                    "name": "add_to_cart",
                    "arguments": {
                        "productId": item["sku_id"],
                        "quantity": item.get("quantity", 1),
                    },
                }
            )
        calls.append({"name": "view_cart", "arguments": {}})
        calls.append({"name": "get_payment_methods", "arguments": {}})
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
            cmd, capture_output=True, text=True, timeout=60
        )
        if result.returncode != 0:
            raise RuntimeError(f"Swiggy MCP error: {result.stderr}")
        return json.loads(result.stdout)

    def _run_batch(self, calls: list[dict]) -> list[dict]:
        """Execute multiple Swiggy MCP calls in a single mcp-remote process."""
        batch_json = json.dumps(calls)
        cmd = self._build_cmd(["--compact", "--batch-json", batch_json])
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            raise RuntimeError(f"Swiggy MCP batch error: {result.stderr}")
        return json.loads(result.stdout)
