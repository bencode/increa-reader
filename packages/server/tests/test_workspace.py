from increa_reader import workspace


def test_bigmodel_uses_glm_5_3_as_provider_default():
    settings = {"base_url": "https://open.bigmodel.cn/api/anthropic"}

    assert workspace.resolve_default_model(settings) == "glm-5.3"


def test_explicit_model_overrides_provider_default():
    settings = {
        "base_url": "https://open.bigmodel.cn/api/anthropic",
        "default_model": "glm-5.3-flash",
    }

    assert workspace.resolve_default_model(settings) == "glm-5.3-flash"


def test_anthropic_endpoint_keeps_sdk_default():
    settings = {"base_url": "https://api.anthropic.com"}

    assert workspace.resolve_default_model(settings) is None


def test_bigmodel_defaults_claude_model_aliases(monkeypatch):
    monkeypatch.setattr(
        workspace,
        "load_api_settings",
        lambda: {"base_url": "https://open.bigmodel.cn/api/anthropic"},
    )
    for name in (
        "ANTHROPIC_DEFAULT_HAIKU_MODEL",
        "ANTHROPIC_DEFAULT_SONNET_MODEL",
        "ANTHROPIC_DEFAULT_OPUS_MODEL",
    ):
        monkeypatch.delenv(name, raising=False)

    sdk_env = workspace.build_sdk_env()

    assert sdk_env["ANTHROPIC_DEFAULT_HAIKU_MODEL"] == "glm-5.3"
    assert sdk_env["ANTHROPIC_DEFAULT_SONNET_MODEL"] == "glm-5.3"
    assert sdk_env["ANTHROPIC_DEFAULT_OPUS_MODEL"] == "glm-5.3"
