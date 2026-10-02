"""Server-side spend policy. Pure functions, no I/O.

The hard cap is enforced here from server-computed totals; nothing the client
sends can raise it. A user-stated budget can only lower the cap.
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone

from backend.config import DEFAULT_AUTO_APPROVE, DEFAULT_SPEND_CAP

ALL_PLATFORMS = {"zepto", "swiggy_instamart"}


@dataclass
class PolicyDecision:
    allowed: bool
    needs_approval: bool
    total: float
    hard_cap: float
    auto_approve_threshold: float
    reasons: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def _active(mandate, now):
    if mandate is None:
        return None
    if mandate.valid_until is not None and mandate.valid_until <= now:
        return None
    return mandate


def allowed_platforms(mandate, platform_pref: str = "any", now: datetime | None = None) -> set[str]:
    """Platforms the agent may buy from, given mandate scope and user preference."""
    now = now or datetime.now(timezone.utc)
    allowed = set(ALL_PLATFORMS)
    m = _active(mandate, now)
    if m is not None and m.platform_scope in ALL_PLATFORMS:
        allowed &= {m.platform_scope}
    if platform_pref in ALL_PLATFORMS:
        allowed &= {platform_pref}
    return allowed


def evaluate_policy(
    total: float,
    mandate,
    budget_cap: float | None = None,
    partial_cart: bool = False,
    now: datetime | None = None,
) -> PolicyDecision:
    now = now or datetime.now(timezone.utc)
    reasons: list[str] = []
    cap, auto = DEFAULT_SPEND_CAP, DEFAULT_AUTO_APPROVE

    m = _active(mandate, now)
    if m is not None:
        cap, auto = float(m.cap_amount), float(m.auto_approve_threshold)
    elif mandate is not None:
        reasons.append("Spend mandate expired; default limits applied")
    else:
        reasons.append("No spend mandate; default limits applied")

    if budget_cap is not None and budget_cap > 0 and budget_cap < cap:
        cap = budget_cap
        reasons.append(f"Your stated budget of ₹{budget_cap:.0f} lowers the cap")
    auto = min(auto, cap)

    total = round(float(total), 2)
    if total > cap:
        return PolicyDecision(
            False, False, total, cap, auto,
            reasons + [f"Total ₹{total:.2f} exceeds hard cap ₹{cap:.2f}"],
        )

    needs_approval = True
    if partial_cart:
        reasons.append("Some items are unavailable, so this needs your approval")
    elif total <= auto:
        needs_approval = False
        reasons.append(f"₹{total:.2f} is within your ₹{auto:.2f} auto-approve limit")
    else:
        reasons.append(f"₹{total:.2f} is above your ₹{auto:.2f} auto-approve limit")

    return PolicyDecision(True, needs_approval, total, cap, auto, reasons)
