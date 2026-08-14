from app.config import settings
from app.market_intelligence import trends_history_store
from app.market_intelligence.google_trends_client import TrendRecord


def _record(**overrides) -> TrendRecord:
    defaults = dict(
        keyword="SHG products India",
        date="2026-01-04",
        interest=42.0,
        is_partial=False,
    )
    defaults.update(overrides)
    return TrendRecord(**defaults)


def test_first_snapshot_creates_the_history_file(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "trends_history_dir", str(tmp_path))
    result = trends_history_store.append_snapshot([_record()])
    assert len(result) == 1
    assert result.iloc[0]["interest"] == 42.0


def test_appending_a_new_week_grows_the_history(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "trends_history_dir", str(tmp_path))
    trends_history_store.append_snapshot([_record(date="2026-01-04")])
    result = trends_history_store.append_snapshot([_record(date="2026-01-11")])
    assert len(result) == 2


def test_re_fetching_the_same_keyword_and_date_does_not_duplicate_rows(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "trends_history_dir", str(tmp_path))
    trends_history_store.append_snapshot([_record()])
    result = trends_history_store.append_snapshot([_record()])
    assert len(result) == 1


def test_re_fetching_the_same_date_keeps_the_newest_value(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "trends_history_dir", str(tmp_path))
    trends_history_store.append_snapshot([_record(interest=42.0, is_partial=True)])
    result = trends_history_store.append_snapshot([_record(interest=55.0, is_partial=False)])
    assert len(result) == 1
    assert result.iloc[0]["interest"] == 55.0
    assert not bool(result.iloc[0]["is_partial"])


def test_load_trends_history_returns_an_empty_frame_when_nothing_has_run_yet(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "trends_history_dir", str(tmp_path))
    result = trends_history_store.load_trends_history()
    assert result.empty


def test_load_trends_history_reads_back_what_was_appended(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "trends_history_dir", str(tmp_path))
    trends_history_store.append_snapshot([_record()])
    result = trends_history_store.load_trends_history()
    assert len(result) == 1
    assert result.iloc[0]["keyword"] == "SHG products India"