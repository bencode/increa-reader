import pytest

from increa_reader import frontend_tools


@pytest.mark.asyncio
async def test_get_document_notes_delegates_to_frontend_wrapper(monkeypatch):
    calls = []

    async def fake_wrapper(name: str, **kwargs):
        calls.append((name, kwargs))
        return {"content": [{"type": "text", "text": "ok"}]}

    monkeypatch.setattr(frontend_tools, "frontend_tool_wrapper", fake_wrapper)

    result = await frontend_tools.get_document_notes.handler({})

    assert result == {"content": [{"type": "text", "text": "ok"}]}
    assert calls == [("get_document_notes", {})]


@pytest.mark.asyncio
async def test_get_visible_notes_delegates_to_frontend_wrapper(monkeypatch):
    calls = []

    async def fake_wrapper(name: str, **kwargs):
        calls.append((name, kwargs))
        return {"content": [{"type": "text", "text": "ok"}]}

    monkeypatch.setattr(frontend_tools, "frontend_tool_wrapper", fake_wrapper)

    result = await frontend_tools.get_visible_notes.handler({})

    assert result == {"content": [{"type": "text", "text": "ok"}]}
    assert calls == [("get_visible_notes", {})]


def test_frontend_tools_exports_note_reader_tools():
    tool_names = {tool_def.name for tool_def in frontend_tools.FRONTEND_TOOLS}

    assert "get_document_notes" in tool_names
    assert "get_visible_notes" in tool_names
