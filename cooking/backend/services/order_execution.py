"""Order execution against the live Zepto / Swiggy MCPs.

Zepto exposes a real payment flow: build the cart, then
`create_online_payment_order(confirmOrder=true)` returns a Juspay payment
link, and `check_payment_status` reports on it afterwards.

Swiggy Instamart's MCP has no confirmed card/UPI checkout tool — per
`.agents/skills/swiggy-prava-skill/SKILL.md`, MCP can build a cart and may
place pay-on-delivery orders, but card payment needs browser automation we
don't do. So a Swiggy leg stops at "cart built"; the user pays in the app.
We never fake a payment integration for it.

CAVEAT: `_extract_zepto_order` guesses at the response field names
(paymentLink / orderId and similar). This was written without a live Zepto
MCP call — auth is expired in this environment. Run one real
`create_online_payment_order(confirmOrder=true)` call before a demo and fix
the key names here if they differ from what's guessed.
"""

import logging

from backend.services.sanitize import sanitize_text
from backend.services.swiggy_service import SwiggyInstamartService
from backend.services.zepto_service import ZeptoService

log = logging.getLogger("order_execution")

zepto = ZeptoService()
swiggy = SwiggyInstamartService()


class ExecutionError(RuntimeError):
    pass


def _first_address_id(addresses) -> str:
    addr_list = addresses.get("addresses", []) if isinstance(addresses, dict) else addresses
    if not addr_list:
        raise ExecutionError("no saved delivery address on file")
    return addr_list[0]["id"]


def _extract_zepto_order(raw) -> dict:
    """Best-effort extraction across plausible Zepto response shapes."""
    if not isinstance(raw, dict):
        return {"payment_url": None, "platform_order_id": None}
    nested = raw.get("data") if isinstance(raw.get("data"), dict) else {}
    payment_url = (
        raw.get("paymentLink") or raw.get("payment_url") or raw.get("paymentUrl")
        or raw.get("paymentLinkUrl") or nested.get("paymentLink") or nested.get("paymentUrl")
    )
    order_id = (
        raw.get("orderId") or raw.get("order_id") or raw.get("id")
        or nested.get("orderId") or nested.get("order_id")
    )
    return {
        "payment_url": sanitize_text(payment_url, 500) if payment_url else None,
        "platform_order_id": sanitize_text(order_id, 100) if order_id else None,
    }


async def execute_zepto(items: list[dict]) -> dict:
    """Build the Zepto cart and create a confirmed (payment-link) order."""
    addresses = await zepto.get_addresses()
    address_id = _first_address_id(addresses)
    cart_items = [{"sku_id": i["sku_id"], "quantity": int(i.get("quantity", 1))} for i in items]

    try:
        await zepto.build_cart_batch(address_id, cart_items)
    except Exception as e:
        raise ExecutionError(f"couldn't build the Zepto cart: {sanitize_text(e, 200)}") from e

    try:
        order_raw = await zepto.create_order_confirmed(address_id)
    except Exception as e:
        raise ExecutionError(f"couldn't create the Zepto payment link: {sanitize_text(e, 200)}") from e

    extracted = _extract_zepto_order(order_raw)
    return {
        "platform": "zepto",
        "address_id": address_id,
        "payment_url": extracted["payment_url"],
        "platform_order_id": extracted["platform_order_id"],
        "raw": order_raw,
    }


async def execute_swiggy(items: list[dict]) -> dict:
    """Build the Swiggy Instamart cart. No automated payment."""
    addresses = await swiggy.get_addresses()
    address_id = _first_address_id(addresses)
    cart_items = [{"sku_id": i["sku_id"], "quantity": int(i.get("quantity", 1))} for i in items]

    try:
        batch = await swiggy.build_cart_batch(address_id, cart_items)
    except Exception as e:
        raise ExecutionError(f"couldn't build the Swiggy cart: {sanitize_text(e, 200)}") from e

    return {
        "platform": "swiggy_instamart",
        "address_id": address_id,
        "payment_url": None,
        "platform_order_id": None,
        "raw": batch,
    }


async def check_zepto_payment(platform_order_id: str) -> dict:
    """Single non-blocking status check (poll=False) — never blocks on user approval."""
    try:
        raw = await zepto.check_payment_status(platform_order_id)
    except Exception as e:
        return {"status": "unknown", "raw": {"error": sanitize_text(e, 200)}}
    text = str(raw).lower()
    if any(k in text for k in ("success", "paid", "captured", "completed")):
        status = "paid"
    elif any(k in text for k in ("fail", "declined", "cancel")):
        status = "failed"
    else:
        status = "pending"
    return {"status": status, "raw": raw}
