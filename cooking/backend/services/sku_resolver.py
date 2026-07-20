import math
import re


class SKUResolver:
    """Resolves needed ingredient quantities to real purchasable SKUs."""

    # Unit conversion table: (from, to) -> multiplier
    CONVERSIONS = {
        ("kg", "g"): 1000,
        ("g", "kg"): 0.001,
        ("l", "ml"): 1000,
        ("ml", "l"): 0.001,
        ("g", "g"): 1,
        ("ml", "ml"): 1,
        ("kg", "kg"): 1,
        ("l", "l"): 1,
        ("pieces", "pieces"): 1,
        ("piece", "pieces"): 1,
        ("pieces", "piece"): 1,
        ("pcs", "pieces"): 1,
        ("nos", "pieces"): 1,
        ("pack", "pieces"): 1,
        ("tbsp", "ml"): 15,
        ("tsp", "ml"): 5,
    }

    def resolve_pack_size(
        self,
        ingredient_name: str,
        needed_qty: float,
        needed_unit: str,
        available_skus: list[dict],
    ) -> dict:
        """Find the best matching SKU for a needed quantity.

        Rules:
        - Always round UP (never under-buy)
        - Prefer the closest size that covers the needed amount
        - Show reasoning for transparency
        """
        if not available_skus:
            return {
                "ingredient": ingredient_name,
                "status": "unavailable",
                "reasoning": f"No SKUs found for {ingredient_name}",
            }

        candidates = []
        for sku in available_skus:
            sku_qty = self._parse_quantity(sku.get("packSize", sku.get("quantity", "")))
            if sku_qty is None:
                continue

            sku_unit = self._parse_unit(sku.get("packSize", sku.get("unit", "")))
            sku_qty_normalized = self._normalize_unit(sku_qty, sku_unit, needed_unit)
            if sku_qty_normalized is None:
                # Try treating it as same unit
                sku_qty_normalized = sku_qty

            if sku_qty_normalized <= 0:
                continue

            packs_needed = math.ceil(needed_qty / sku_qty_normalized)
            total_qty = packs_needed * sku_qty_normalized
            waste = total_qty - needed_qty
            price = float(sku.get("price", sku.get("sellingPrice", 0)))

            candidates.append(
                {
                    "sku": sku,
                    "packs_needed": packs_needed,
                    "total_qty": total_qty,
                    "waste": waste,
                    "total_price": price * packs_needed,
                    "sku_qty_normalized": sku_qty_normalized,
                }
            )

        if not candidates:
            return {
                "ingredient": ingredient_name,
                "status": "unavailable",
                "reasoning": f"Could not match pack sizes for {ingredient_name}",
            }

        # Sort: prefer single-pack, then least waste, then lowest price
        candidates.sort(
            key=lambda c: (c["packs_needed"], c["waste"], c["total_price"])
        )
        best = candidates[0]
        sku = best["sku"]

        return {
            "ingredient": ingredient_name,
            "status": "available",
            "sku_id": sku.get("id", sku.get("productId", "")),
            "sku_name": sku.get("name", sku.get("productName", ingredient_name)),
            "pack_size": sku.get("packSize", sku.get("quantity", "")),
            "quantity": best["packs_needed"],
            "price_per_unit": float(sku.get("price", sku.get("sellingPrice", 0))),
            "total_price": best["total_price"],
            "needed": f"{needed_qty}{needed_unit}",
            "getting": f"{best['total_qty']}{needed_unit}",
            "reasoning": self._build_reasoning(
                ingredient_name, needed_qty, needed_unit, best
            ),
        }

    def resolve_all(
        self,
        buy_list: list[dict],
        platform_results: dict[str, list[dict]],
    ) -> list[dict]:
        """Resolve pack sizes for an entire buy list against a platform's search results."""
        resolved = []
        for ingredient in buy_list:
            name = ingredient["name"]
            skus = platform_results.get(name, [])
            resolved.append(
                self.resolve_pack_size(
                    name,
                    float(ingredient.get("quantity", 1)),
                    ingredient.get("unit", "pieces"),
                    skus,
                )
            )
        return resolved

    def _build_reasoning(self, name: str, needed: float, unit: str, best: dict) -> str:
        sku = best["sku"]
        sku_name = sku.get("name", sku.get("productName", ""))
        pack_size = sku.get("packSize", sku.get("quantity", ""))
        if best["waste"] <= 0:
            return f"Exact match: {sku_name} covers {needed}{unit}"
        return (
            f"Need {needed}{unit}, buying {pack_size} "
            f"({best['getting']} total) — {best['waste']:.0f}{unit} extra"
        )

    def _parse_quantity(self, pack_size) -> float | None:
        """Extract numeric quantity from pack size string like '500g' or '200ml'."""
        match = re.search(r"(\d+(?:\.\d+)?)", str(pack_size))
        return float(match.group(1)) if match else None

    def _parse_unit(self, pack_size: str) -> str:
        """Extract unit from pack size string."""
        match = re.search(r"\d+(?:\.\d+)?\s*([a-zA-Z]+)", str(pack_size))
        return match.group(1).lower() if match else ""

    def _normalize_unit(
        self, qty: float, from_unit: str, to_unit: str
    ) -> float | None:
        """Convert between compatible units."""
        from_u = from_unit.lower().strip()
        to_u = to_unit.lower().strip()

        if from_u == to_u:
            return qty

        key = (from_u, to_u)
        if key in self.CONVERSIONS:
            return qty * self.CONVERSIONS[key]

        return None
