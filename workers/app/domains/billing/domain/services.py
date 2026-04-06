from decimal import Decimal


def cost_to_microdollars(cost_usd: Decimal) -> int:
    """Convert a USD cost to microdollar units for Stripe metered billing.

    1 unit = 1 microdollar ($0.000001). Stripe price is set to $0.000001/unit.
    Returns 0 for zero or negative costs.
    """
    units = int(cost_usd * 1_000_000)
    return max(units, 0)
