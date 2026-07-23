import pandas as pd

from app.market_intelligence.seasonality import compute_seasonality


def _rows():
    return pd.DataFrame(
        {
            "product_id": ["p1", "p1", "p2"],
            "day_of_week": [5, 5, 0],  # Saturday, Saturday, Monday
            "month": [1, 1, 2],
            "total_quantity": [10.0, 20.0, 5.0],
        }
    )


class TestComputeSeasonality:
    def test_empty_input_returns_empty_lists_not_an_error(self):
        result = compute_seasonality(pd.DataFrame(), product_id="p1")
        assert result == {"product_id": "p1", "by_day_of_week": [], "by_month": []}

    def test_aggregates_across_all_products_when_product_id_is_none(self):
        result = compute_seasonality(_rows(), product_id=None)
        saturday = next(r for r in result["by_day_of_week"] if r["day"] == "Saturday")
        assert saturday["avg_quantity"] == 15.0  # mean of 10 and 20

    def test_filters_to_a_single_product_when_given(self):
        result = compute_seasonality(_rows(), product_id="p2")
        assert result["by_day_of_week"] == [{"day": "Monday", "avg_quantity": 5.0}]
        assert result["by_month"] == [{"month": 2, "avg_quantity": 5.0}]

    def test_unknown_product_id_yields_empty_lists(self):
        result = compute_seasonality(_rows(), product_id="does-not-exist")
        assert result == {
            "product_id": "does-not-exist",
            "by_day_of_week": [],
            "by_month": [],
        }
