import pandas as pd

from app.market_intelligence.hotspots import compute_hotspots

# Real H3 resolution-7 cells (not placeholder strings) — compute_hotspots
# reverse-geocodes each cell via h3.cell_to_latlng, which raises on anything
# that isn't an actual H3 cell index.
CELL_A = "87619bd34ffffff"  # ~Guntur
CELL_B = "8760a5171ffffff"  # ~Anantapur
CELL_C = "873c93032ffffff"  # ~Visakhapatnam


def _rows():
    return pd.DataFrame(
        {
            "h3_cell": [CELL_A, CELL_A, CELL_B, CELL_C],
            "district_id": ["d1", "d1", "d2", "d3"],
            "total_quantity": [10.0, 5.0, 100.0, 1.0],
            "total_amount": [1000.0, 500.0, 200.0, 50000.0],
            "product_id": ["p1", "p2", "p1", "p1"],
        }
    )


class TestComputeHotspots:
    def test_empty_input_returns_empty_list(self):
        assert compute_hotspots(pd.DataFrame(), top_n=10) == []

    def test_groups_by_h3_cell_and_sums_correctly(self):
        result = compute_hotspots(_rows(), top_n=10)
        cell_a = next(r for r in result if r["h3_cell"] == CELL_A)
        assert cell_a["total_quantity"] == 15.0
        assert cell_a["total_amount"] == 1500.0
        assert cell_a["product_count"] == 2

    def test_ranked_by_total_amount_descending(self):
        result = compute_hotspots(_rows(), top_n=10)
        amounts = [r["total_amount"] for r in result]
        assert amounts == sorted(amounts, reverse=True)
        assert result[0]["h3_cell"] == CELL_C  # 50000 is the largest total_amount

    def test_top_n_limits_results(self):
        result = compute_hotspots(_rows(), top_n=1)
        assert len(result) == 1

    def test_lat_lng_are_derived_from_the_h3_cell(self):
        result = compute_hotspots(_rows(), top_n=10)
        for row in result:
            assert isinstance(row["lat"], float)
            assert isinstance(row["lng"], float)
