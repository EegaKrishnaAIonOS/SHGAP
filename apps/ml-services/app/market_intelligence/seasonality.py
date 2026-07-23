import pandas as pd

_DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def compute_seasonality(sales_features: pd.DataFrame, product_id: str | None = None) -> dict:
    """Purely descriptive historical averages — deliberately not derived from
    either forecasting model. It's always available (no training required),
    always reflects exactly what happened, and doesn't need Prophet's
    internal seasonal-component object translated into something a plain
    JSON API can return. `product_id=None` aggregates across every product.
    """
    if sales_features.empty:
        return {"product_id": product_id, "by_day_of_week": [], "by_month": []}

    df = (
        sales_features
        if product_id is None
        else sales_features[sales_features["product_id"] == product_id]
    )
    if df.empty:
        return {"product_id": product_id, "by_day_of_week": [], "by_month": []}

    by_dow = df.groupby("day_of_week")["total_quantity"].mean()
    by_month = df.groupby("month")["total_quantity"].mean()

    return {
        "product_id": product_id,
        "by_day_of_week": [
            {"day": _DAY_NAMES[day], "avg_quantity": round(float(value), 2)}
            for day, value in by_dow.items()
        ],
        "by_month": [
            {"month": int(month), "avg_quantity": round(float(value), 2)}
            for month, value in by_month.items()
        ],
    }
