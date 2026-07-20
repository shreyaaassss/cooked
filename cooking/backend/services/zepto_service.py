import json
import subprocess
import os


# Path to the Zepto MCP runner script from the installed skill
ZEPTO_RUNNER = os.environ.get(
    "ZEPTO_MCP_RUNNER",
    os.path.join(
        os.path.expanduser("~"),
        ".skills",
        "zepto-prava-skill",
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
        """Search for multiple products in a single MCP call."""
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
        return search_res if isinstance(search_res, dict) else {}

    async def get_addresses(self) -> list[dict]:
        """Get saved delivery addresses."""
        return self._run_mcp("list_saved_addresses", {})

    async def select_address(self, address_id: str) -> dict:
        """Select a delivery address."""
        return self._run_mcp("select_saved_address", {"addressId": address_id})

    async def update_cart(self, product_id: str, quantity: int) -> dict:
        """Add/update product in cart."""
        return self._run_mcp(
            "update_cart", {"productId": product_id, "quantity": quantity}
        )

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

    async def build_cart_batch(
        self, address_id: str, items: list[dict]
    ) -> list[dict]:
        """Build a full cart in one batch: select address + add items + view cart."""
        calls = [{"name": "select_saved_address", "arguments": {"addressId": address_id}}]
        for item in items:
            calls.append(
                {
                    "name": "update_cart",
                    "arguments": {
                        "productId": item["sku_id"],
                        "quantity": item.get("quantity", 1),
                    },
                }
            )
        calls.append({"name": "view_cart", "arguments": {}})
        calls.append({"name": "get_payment_methods", "arguments": {}})
        return self._run_batch(calls)

    def _run_mcp(self, tool_name: str, args: dict) -> dict | list:
        """Execute a Zepto MCP tool via the runner script."""
        cmd = ["node", self.runner, "--compact", tool_name, json.dumps(args)]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            raise RuntimeError(f"Zepto MCP error: {result.stderr}")
        return json.loads(result.stdout)

    def _run_batch(self, calls: list[dict]) -> list[dict]:
        """Execute multiple Zepto MCP calls in a single process."""
        batch_json = json.dumps(calls)
        cmd = ["node", self.runner, "--compact", "--batch-json", batch_json]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            raise RuntimeError(f"Zepto MCP batch error: {result.stderr}")
        return json.loads(result.stdout)
