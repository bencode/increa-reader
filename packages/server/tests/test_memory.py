"""Tests for conversation memory transcript persistence."""

from datetime import datetime

import pytest

from increa_reader import memory


@pytest.fixture(autouse=True)
def tmp_logs_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("CHAT_LOGS_DIR", str(tmp_path))
    return tmp_path


def test_append_turn_creates_then_appends(tmp_logs_dir):
    memory.append_turn("session_123", "first question", ["first answer"], ["Read"])
    path = tmp_logs_dir / "memory" / "sessions" / "session_123.md"
    content = path.read_text(encoding="utf-8")
    assert "# Session session_123" in content
    assert "first question" in content
    assert "first answer" in content
    assert "> tools: Read" in content

    memory.append_turn("session_123", "second question", ["second answer"], [])
    content = path.read_text(encoding="utf-8")
    assert content.count("# Session") == 1
    assert "second question" in content
    assert "second answer" in content


def test_append_turn_rejects_path_escape(tmp_logs_dir):
    memory.append_turn("../../etc/evil", "q", ["a"], [])
    # Sanitized id keeps only safe chars, so the file stays inside sessions/
    sessions = tmp_logs_dir / "memory" / "sessions"
    files = list(sessions.glob("*.md")) if sessions.exists() else []
    assert all(f.parent == sessions for f in files)
    assert not (tmp_logs_dir / "etc").exists()


def test_append_turn_skips_empty_session_id(tmp_logs_dir):
    memory.append_turn(None, "q", ["a"], [])
    memory.append_turn("///", "q", ["a"], [])
    sessions = tmp_logs_dir / "memory" / "sessions"
    assert not sessions.exists() or not list(sessions.glob("*.md"))


def test_format_turn_dedupes_tools_and_skips_blank_text():
    out = memory.format_turn(
        "q", ["", "answer"], ["Read", "Read", "Grep"], datetime(2026, 6, 12, 10, 30)
    )
    assert "> tools: Read, Grep" in out
    assert out.count("## [2026-06-12 10:30]") == 2
