from app.config import settings
from app.market_intelligence import price_history_store
from app.market_intelligence.agmarknet_client import MandiPriceRecord


def _record(**overrides) -> MandiPriceRecord:
    defaults = dict(
        state="Andhra Pradesh",
        district="Anantapur",
        market="Anantapur APMC",
        commodity="Tomato",
        variety="Hybrid",
        arrival_date="20/07/2026",
        min_price=1000.0,
        max_price=1500.0,
        modal_price=1250.0,
    )
    defaults.update(overrides)
    return MandiPriceRecord(**defaults)


def test_first_snapshot_creates_the_history_file(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "price_history_dir", str(tmp_path))
    result = price_history_store.append_daily_snapshot([_record()])
    assert len(result) == 1
    assert result.iloc[0]["commodity"] == "Tomato"


def test_appending_a_new_day_grows_the_history(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "price_history_dir", str(tmp_path))
    price_history_store.append_daily_snapshot([_record(arrival_date="20/07/2026")])
    result = price_history_store.append_daily_snapshot([_record(arrival_date="21/07/2026")])
    assert len(result) == 2


def test_re_running_on_the_same_day_does_not_duplicate_rows(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "price_history_dir", str(tmp_path))
    price_history_store.append_daily_snapshot([_record()])
    result = price_history_store.append_daily_snapshot([_record()])
    assert len(result) == 1


def test_load_price_history_returns_an_empty_frame_when_nothing_has_run_yet(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "price_history_dir", str(tmp_path))
    result = price_history_store.load_price_history()
    assert result.empty


def test_load_price_history_reads_back_what_was_appended(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "price_history_dir", str(tmp_path))
    price_history_store.append_daily_snapshot([_record()])
    result = price_history_store.load_price_history()
    assert len(result) == 1
    assert result.iloc[0]["modal_price"] == 1250.0
