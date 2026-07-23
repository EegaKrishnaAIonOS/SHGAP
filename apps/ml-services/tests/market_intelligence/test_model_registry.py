import os

from app.config import settings
from app.market_intelligence import model_registry


def test_model_path_lives_inside_the_registry_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
    path = model_registry.model_path("demand_p1", "json")
    assert path == os.path.join(str(tmp_path), "demand_p1.json")
    assert os.path.isdir(tmp_path)


def test_write_and_read_manifest_entry_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
    written = model_registry.write_manifest_entry("demand", "p1", {"observed_days": 42})

    assert written["observed_days"] == 42
    assert "trained_at" in written

    read_back = model_registry.read_manifest_entry("demand", "p1")
    assert read_back == written


def test_read_manifest_entry_returns_none_when_absent(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
    assert model_registry.read_manifest_entry("demand", "does-not-exist") is None


def test_read_manifest_returns_empty_dict_before_any_write(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
    assert model_registry.read_manifest() == {}


def test_clear_manifest_entries_only_removes_matching_model_type(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
    model_registry.write_manifest_entry("demand", "p1", {})
    model_registry.write_manifest_entry("demand", "p2", {})
    model_registry.write_manifest_entry("price", "pooled", {})

    model_registry.clear_manifest_entries("demand")

    manifest = model_registry.read_manifest()
    assert "demand:p1" not in manifest
    assert "demand:p2" not in manifest
    assert "price:pooled" in manifest
