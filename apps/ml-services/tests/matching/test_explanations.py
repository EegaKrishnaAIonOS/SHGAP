from app.matching.explanations import generate_template_reasons
from app.matching.repository import BuyerRecord, ProductRecord
from app.matching.scoring import MatchComponents

PRODUCT = ProductRecord(
    id="p1",
    shg_id="shg-1",
    category_id="cat-1",
    category_name="Pickles",
    district_id="dist-1",
    name="Mango Pickle",
    description="Traditional Andhra-style pickle",
    price=150.0,
    moq=5,
    stock=100,
    is_available=True,
    lng=77.6,
    lat=14.68,
)

BUYER = BuyerRecord(
    id="b1",
    name="Vijayawada Retail Mart",
    type="RETAIL",
    organization=None,
    district_id="dist-2",
    demand_profile={"priceBandMin": 100, "priceBandMax": 300},
    category_ids=["cat-1"],
    category_names=["Pickles"],
    lng=80.6,
    lat=16.5,
)


class TestGenerateTemplateReasons:
    def test_mentions_category_interest_when_declared(self):
        components = MatchComponents(
            content_similarity=0.5, category_interest=1.0, price_band_fit=0.5, geo_proximity=0.5
        )
        reasons = generate_template_reasons(components, PRODUCT, BUYER, 100.0, None)
        assert any("Pickles" in r and "interest" in r for r in reasons)

    def test_mentions_price_fit_when_strong(self):
        components = MatchComponents(
            content_similarity=0.0, category_interest=0.0, price_band_fit=0.9, geo_proximity=0.0
        )
        reasons = generate_template_reasons(components, PRODUCT, BUYER, None, None)
        assert any("150" in r for r in reasons)

    def test_mentions_distance_when_geo_is_strong_and_known(self):
        components = MatchComponents(
            content_similarity=0.0, category_interest=0.0, price_band_fit=0.0, geo_proximity=0.9
        )
        reasons = generate_template_reasons(components, PRODUCT, BUYER, 42.0, None)
        assert any("42" in r for r in reasons)

    def test_omits_distance_when_geo_is_unknown(self):
        components = MatchComponents(
            content_similarity=0.0, category_interest=0.0, price_band_fit=0.0, geo_proximity=None
        )
        reasons = generate_template_reasons(components, PRODUCT, BUYER, None, None)
        assert not any("km" in r for r in reasons)

    def test_mentions_expected_demand_when_known(self):
        components = MatchComponents(
            content_similarity=0.0, category_interest=0.0, price_band_fit=0.0, geo_proximity=0.0
        )
        reasons = generate_template_reasons(components, PRODUCT, BUYER, None, 85.4)
        assert any("85" in r for r in reasons)

    def test_falls_back_to_a_generic_reason_when_nothing_stands_out(self):
        components = MatchComponents(
            content_similarity=0.1, category_interest=0.0, price_band_fit=0.5, geo_proximity=None
        )
        reasons = generate_template_reasons(components, PRODUCT, BUYER, None, None)
        assert len(reasons) >= 1
