"""Housing rules. Everything money-related is decided here, never by the browser."""

CHECKPOINT = "checkpoint"

# price in whole rupees, rent_per_hour in whole rupees
TIERS = {
    "checkpoint": {"label": "Checkpoint shelter", "price": 0, "rent_per_hour": 0},
    "cottage": {"label": "Cottage", "price": 800, "rent_per_hour": 20},
    "apartment": {"label": "Apartment block", "price": 2500, "rent_per_hour": 60},
    "villa": {"label": "Villa", "price": 6000, "rent_per_hour": 160},
    "tower": {"label": "Tower", "price": 15000, "rent_per_hour": 420},
}
PAID_TIERS = [t for t in TIERS if t != CHECKPOINT]

MAX_PAID_PROPERTIES = 5          # per citizen, so nobody owns the whole city
SELL_BACK_PERCENT = 70           # of the purchase price
MAX_ACCRUAL_HOURS = 24           # rent stops piling up after a day: come back and collect


def upgrade_cost(old_tier: str, new_tier: str) -> int:
    return TIERS[new_tier]["price"] - TIERS[old_tier]["price"]


def sell_value(tier: str) -> int:
    return TIERS[tier]["price"] * SELL_BACK_PERCENT // 100


def accrued_rent(tier: str, last_collected: float, now: float) -> int:
    hours = max(0.0, min((now - last_collected) / 3600.0, MAX_ACCRUAL_HOURS))
    return int(TIERS[tier]["rent_per_hour"] * hours)
