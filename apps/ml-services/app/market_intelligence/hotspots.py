import h3
import pandas as pd

# T14 already bins sales into H3 cells (resolution 7, ~5 km²) as part of
# feature engineering — that binning *is* the spatial clustering step here:
# aggregating raw per-sale lat/lng into a shared cell and ranking cells by
# volume. A further clustering pass (e.g. DBSCAN over cell centers) isn't
# applied on top of it: with the pilot's current 3 real SHG locations
# (one per pilot district), every cell is already its own well-separated
# hotspot, so an extra clustering step would just recover the same 3 points
# it started from — see ADR-0024.


def compute_hotspots(sales_features: pd.DataFrame, top_n: int = 20) -> list[dict]:
    """Ranks H3 cells by total sales value — "best selling locations"."""
    if sales_features.empty:
        return []

    grouped = (
        sales_features.groupby(["h3_cell", "district_id"])
        .agg(
            total_quantity=("total_quantity", "sum"),
            total_amount=("total_amount", "sum"),
            product_count=("product_id", "nunique"),
        )
        .reset_index()
        .sort_values("total_amount", ascending=False)
        .head(top_n)
    )

    results = []
    for _, row in grouped.iterrows():
        lat, lng = h3.cell_to_latlng(row["h3_cell"])
        results.append(
            {
                "h3_cell": row["h3_cell"],
                "district_id": row["district_id"],
                "lat": lat,
                "lng": lng,
                "total_quantity": float(row["total_quantity"]),
                "total_amount": float(row["total_amount"]),
                "product_count": int(row["product_count"]),
            }
        )
    return results
