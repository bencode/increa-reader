"""Tests for the refine-memory deterministic pre/post-processing tool.

Covers the three correctness guarantees the LLM should not have to guess:
idempotency (already-distilled turns are skipped), loop guard (a refine run's
own echo is dropped), and append-safety (appending a turn only surfaces it).
"""

import importlib.util
from pathlib import Path

import pytest

_SCRIPT = (
    Path(__file__).resolve().parents[1]
    / "increa_reader/plugin/skills/refine-memory/scripts/refine_delta.py"
)
_spec = importlib.util.spec_from_file_location("refine_delta", _SCRIPT)
refine_delta = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(refine_delta)


def _turn(stamp: str, user: str, assistant: str = "ok") -> str:
    return f"## [{stamp}] User\n\n{user}\n\n## [{stamp}] Assistant\n\n{assistant}\n"


REAL_TURN = _turn("2026-06-17 12:57", "我们聊一聊这篇论文，值得研究吗？", "评测如下…")
LOOP_TURN = _turn(
    "2026-06-12 16:49",
    "Use the refine-memory skill: read all transcripts and distill into refine/.",
    "Done. Created 2 topic files under refine/.",
)


def test_split_turns_drops_preamble_and_groups_assistant():
    text = "# Session x\n\nCreated: ...\n\n" + REAL_TURN + LOOP_TURN
    turns = refine_delta.split_turns(text)
    assert len(turns) == 2
    assert turns[0].startswith("## [2026-06-17 12:57] User")
    assert "评测如下" in turns[0]  # assistant reply stays in the same turn


def test_loop_turn_detected_and_dropped():
    assert refine_delta.is_loop_turn(LOOP_TURN) is True
    assert refine_delta.is_loop_turn(REAL_TURN) is False

    new_turns, hashes, _, n_loop = refine_delta.compute_delta(
        {"s.md": REAL_TURN + LOOP_TURN}, seen=set()
    )
    assert n_loop == 1
    assert len(new_turns) == 1 and "评测如下" in new_turns[0]
    assert len(hashes) == 1


def test_idempotent_when_already_seen():
    seen = {refine_delta.turn_hash(REAL_TURN)}
    new_turns, hashes, n_seen, _ = refine_delta.compute_delta({"s.md": REAL_TURN}, seen)
    assert new_turns == [] and hashes == [] and n_seen == 1


def test_append_safe_only_new_turn_surfaces():
    first = REAL_TURN
    seen = {refine_delta.turn_hash(first)}
    appended = _turn("2026-06-18 09:00", "新问题：换个话题", "新回答")
    new_turns, _, n_seen, _ = refine_delta.compute_delta(
        {"s.md": first + appended}, seen
    )
    assert n_seen == 1
    assert len(new_turns) == 1 and "新问题" in new_turns[0]


def test_prepare_commit_roundtrip(tmp_path):
    (tmp_path / "sessions").mkdir()
    (tmp_path / "sessions/s.md").write_text(REAL_TURN + LOOP_TURN, encoding="utf-8")

    refine_delta.cmd_prepare(tmp_path)
    inbox = (tmp_path / "refine/.inbox.md").read_text(encoding="utf-8")
    assert "评测如下" in inbox and "refine-memory skill" not in inbox  # loop excluded

    refine_delta.cmd_commit(tmp_path)
    assert not (tmp_path / "refine/.inbox.md").exists()

    # second prepare sees nothing new
    refine_delta.cmd_prepare(tmp_path)
    assert (tmp_path / "refine/.inbox.md").read_text(encoding="utf-8") == ""


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
