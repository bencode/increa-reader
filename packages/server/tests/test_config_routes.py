import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from increa_reader import config_routes
from increa_reader.models import WorkspaceConfig


def _client(monkeypatch, current: dict, saved: dict) -> TestClient:
    monkeypatch.setattr(config_routes, "load_api_settings", lambda: current)
    monkeypatch.setattr(
        config_routes,
        "save_api_settings",
        lambda settings: saved.update(settings),
    )
    app = FastAPI()
    config_routes.create_config_routes(
        app,
        WorkspaceConfig(title="Test", repos=[], excludes=[]),
    )
    return TestClient(app)


def test_update_api_settings_preserves_advanced_fields(monkeypatch):
    current = {
        "base_url": "https://old.example.com",
        "api_key": "sk-old-secret",
        "auth_token": "token-secret",
        "default_model": "old-model",
        "haiku_model": "fast-model",
        "sonnet_model": "main-model",
        "opus_model": "main-model",
        "auto_compact_window": "1000000",
    }
    saved: dict = {}
    client = _client(monkeypatch, current, saved)

    response = client.put(
        "/api/config/api-settings",
        json={
            "base_url": "https://new.example.com",
            "default_model": "new-model",
        },
    )

    assert response.status_code == 200
    assert saved == {
        **current,
        "base_url": "https://new.example.com",
        "default_model": "new-model",
    }


@pytest.mark.parametrize("field", ["base_url", "default_model"])
def test_update_api_settings_only_changes_submitted_fields(monkeypatch, field: str):
    current = {
        "base_url": "https://provider.example.com",
        "api_key": "sk-old-secret",
        "default_model": "model-a",
    }
    saved: dict = {}
    client = _client(monkeypatch, current, saved)

    response = client.put(
        "/api/config/api-settings",
        json={field: None},
    )

    assert response.status_code == 200
    assert saved == {
        **current,
        field: None,
    }


def test_update_api_settings_accepts_key_only_for_empty_config(monkeypatch):
    saved: dict = {}
    client = _client(monkeypatch, {}, saved)

    response = client.put(
        "/api/config/api-settings",
        json={"api_key": "sk-new-secret"},
    )

    assert response.status_code == 200
    assert response.json()["base_url"] is None
    assert saved == {"api_key": "sk-new-secret"}


@pytest.mark.parametrize(
    ("payload", "expected_key", "keeps_auth_token"),
    [
        ({}, "sk-old-secret", True),
        ({"api_key": None}, "sk-old-secret", True),
        ({"api_key": ""}, None, True),
        ({"api_key": "sk-new-secret"}, "sk-new-secret", False),
        ({"api_key": "sk-old-...cret"}, "sk-old-secret", True),
    ],
)
def test_update_api_settings_api_key_semantics(
    monkeypatch,
    payload: dict,
    expected_key: str | None,
    keeps_auth_token: bool,
):
    current = {
        "base_url": "https://provider.example.com",
        "api_key": "sk-old-secret",
        "auth_token": "token-secret",
        "default_model": "model-a",
    }
    saved: dict = {}
    client = _client(monkeypatch, current, saved)

    response = client.put("/api/config/api-settings", json=payload)

    assert response.status_code == 200
    assert saved["api_key"] == expected_key
    assert ("auth_token" in saved) is keeps_auth_token
    assert saved["base_url"] == current["base_url"]
    assert saved["default_model"] == current["default_model"]
