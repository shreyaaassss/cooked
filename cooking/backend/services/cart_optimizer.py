from dataclasses import dataclass, field


@dataclass
class PlatformCart:
    platform: str  # "zepto" or "swiggy_instamart"
    items: list[dict] = field(default_factory=list)
    item_total: float = 0.0
    delivery_fee: float = 0.0
    total: float = 0.0
    eta_minutes: int = 0
    unavailable: list[str] = field(default_factory=list)

    @classmethod
    def from_resolved(
        cls,
        platform: str,
        resolved_items: list[dict],
        delivery_fee: float = 25.0,
        eta_minutes: int = 15,
    ) -> "PlatformCart":
        """Build a PlatformCart from SKU-resolved items."""
        items = []
        unavailable = []
        item_total = 0.0

        for item in resolved_items:
            if item["status"] == "available":
                items.append(item)
                item_total += item["total_price"]
            else:
                unavailable.append(item["ingredient"])

        return cls(
            platform=platform,
            items=items,
            item_total=item_total,
            delivery_fee=delivery_fee,
            total=item_total + delivery_fee,
            eta_minutes=eta_minutes,
            unavailable=unavailable,
        )


class CartOptimizer:
    """Compares carts across Zepto and Swiggy Instamart.

    Optimization rules (from PRD):
    - Build full candidate carts on each platform
    - Only split across platforms if item-level savings > extra delivery fee
    - Factor in delivery fees for total comparison
    """

    def optimize(
        self,
        zepto_cart: PlatformCart,
        swiggy_cart: PlatformCart,
    ) -> dict:
        """Determine the optimal cart strategy."""

        cart_a = {
            "strategy": "single_platform",
            "platform": "zepto",
            "total": zepto_cart.total,
            "item_total": zepto_cart.item_total,
            "delivery_fee": zepto_cart.delivery_fee,
            "eta": zepto_cart.eta_minutes,
            "items": zepto_cart.items,
            "unavailable": zepto_cart.unavailable,
        }

        cart_b = {
            "strategy": "single_platform",
            "platform": "swiggy_instamart",
            "total": swiggy_cart.total,
            "item_total": swiggy_cart.item_total,
            "delivery_fee": swiggy_cart.delivery_fee,
            "eta": swiggy_cart.eta_minutes,
            "items": swiggy_cart.items,
            "unavailable": swiggy_cart.unavailable,
        }

        cart_c = self._build_split_cart(zepto_cart, swiggy_cart)

        candidates = [cart_a, cart_b]
        if cart_c:
            candidates.append(cart_c)

        # Prefer carts with no unavailable items
        viable = [c for c in candidates if len(c.get("unavailable", [])) == 0]
        if not viable:
            viable = candidates

        best = min(viable, key=lambda c: c["total"])

        return {
            "recommended": best,
            "alternatives": [c for c in candidates if c is not best],
            "reasoning": self._explain_choice(best, candidates),
        }

    def _build_split_cart(
        self,
        zepto: PlatformCart,
        swiggy: PlatformCart,
    ) -> dict | None:
        """Build a split cart if savings exceed extra delivery fee."""
        zepto_prices = {i["ingredient"]: i for i in zepto.items}
        swiggy_prices = {i["ingredient"]: i for i in swiggy.items}

        zepto_items = []
        swiggy_items = []

        all_ingredients = set(zepto_prices.keys()) | set(swiggy_prices.keys())

        for ingredient in all_ingredients:
            z = zepto_prices.get(ingredient)
            s = swiggy_prices.get(ingredient)

            if z and s:
                if z["total_price"] <= s["total_price"]:
                    zepto_items.append(z)
                else:
                    swiggy_items.append(s)
            elif z:
                zepto_items.append(z)
            elif s:
                swiggy_items.append(s)

        if not zepto_items or not swiggy_items:
            return None

        combined_item_total = sum(i["total_price"] for i in zepto_items) + sum(
            i["total_price"] for i in swiggy_items
        )
        combined_delivery = zepto.delivery_fee + swiggy.delivery_fee
        combined_total = combined_item_total + combined_delivery

        single_best = min(zepto.total, swiggy.total)
        if combined_total >= single_best:
            return None

        return {
            "strategy": "split",
            "platforms": ["zepto", "swiggy_instamart"],
            "zepto_items": zepto_items,
            "swiggy_items": swiggy_items,
            "total": combined_total,
            "item_total": combined_item_total,
            "delivery_fee": combined_delivery,
            "eta": max(zepto.eta_minutes, swiggy.eta_minutes),
            "savings_vs_single": single_best - combined_total,
            "unavailable": [],
        }

    def _explain_choice(self, best: dict, all_carts: list[dict]) -> str:
        if best["strategy"] == "split":
            return (
                f"Split across Zepto + Swiggy saves "
                f"₹{best['savings_vs_single']:.0f} even after two delivery fees"
            )

        others = [
            c
            for c in all_carts
            if c is not best and c.get("strategy") == "single_platform"
        ]
        if others:
            diff = others[0]["total"] - best["total"]
            return (
                f"All from {best['platform'].replace('_', ' ').title()}: "
                f"₹{best['total']:.0f} total "
                f"(₹{abs(diff):.0f} {'cheaper' if diff > 0 else 'more'} "
                f"than {others[0]['platform'].replace('_', ' ').title()})"
            )
        return f"Best option: {best['platform']} at ₹{best['total']:.0f}"
