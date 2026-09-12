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


@pytest.mark.parametrize(
    ("payload", "expected_key"),
    [
        ({}, "sk-old-secret"),
        ({"api_key": ""}, None),
        ({"api_key": "sk-new-secret"}, "sk-new-secret"),
        ({"api_key": "sk-old-...cret"}, "sk-old-secret"),
    ],
)
def test_update_api_settings_api_key_semantics(
    monkeypatch,
    payload: dict,
    expected_key: str | None,
):
    current = {"api_key": "sk-old-secret"}
    saved: dict = {}
    client = _client(monkeypatch, current, saved)

    response = client.put("/api/config/api-settings", json=payload)

    assert response.status_code == 200
    assert saved["api_key"] == expected_key
