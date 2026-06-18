#!/usr/bin/env python3
"""Deterministic pre/post-processing for the refine-memory skill.

The LLM-facing skill handles only semantic distillation. The mechanical parts —
which transcript turns are new (idempotency) and which are refine-machinery
echoes (loop guard) — are computed here, not guessed per-run.

Pipeline: prepare -> (LLM distills refine/.inbox.md) -> commit.
Stdlib only; no dependency on the server package, so the plugin stays portable.
"""

import argparse
import hashlib
import json
import re
from pathlib import Path

USER_HEADER = re.compile(r"^## \[[^\]]*\] User\s*$", re.M)
NEXT_HEADER = re.compile(r"^## \[[^\]]*\] ")

INBOX_NOTE = (
    "<!-- refine inbox: new, un-distilled turns only. Distill these into atoms,\n"
    "     write them under refine/, then run `refine_delta.py commit`. -->\n\n"
)


# ── pure functions (unit-tested) ─────────────────────────────────────────────


def _normalize(block: str) -> str:
    return "\n".join(line.rstrip() for line in block.strip().splitlines())


def split_turns(text: str) -> list[str]:
    """A turn = one `## [..] User` header through to the next User header.

    The Assistant reply belongs to the same turn; the file preamble is dropped.
    """
    starts = [m.start() for m in USER_HEADER.finditer(text)]
    bounds = starts + [len(text)]
    return [text[bounds[i] : bounds[i + 1]].strip() for i in range(len(starts))]


def _user_body(turn: str) -> str:
    """The user's message within a turn, up to the Assistant/next header."""
    out: list[str] = []
    for line in turn.splitlines()[1:]:  # skip the User header line
        if NEXT_HEADER.match(line):
            break
        out.append(line)
    return "\n".join(out).strip()


def turn_hash(turn: str) -> str:
    """Stable id for a turn. Append-safe: existing turns keep their bytes."""
    return hashlib.sha256(_normalize(turn).encode("utf-8")).hexdigest()


def is_loop_turn(turn: str) -> bool:
    """True when the turn is a refine run itself (its prompt + echoed report).

    These get recorded back into transcripts; treating them as input would let
    refine re-distill its own output. They are output, never input.
    """
    body = _user_body(turn).lower()
    if "refine-memory" in body:
        return True
    return "distill" in body and "refine/" in body


def compute_delta(
    transcripts: dict[str, str], seen: set[str]
) -> tuple[list[str], list[str], int, int]:
    """Return (new_turns, their_hashes, n_already_seen, n_loop_dropped)."""
    new_turns: list[str] = []
    hashes: list[str] = []
    n_seen = n_loop = 0
    for name in sorted(transcripts):
        for turn in split_turns(transcripts[name]):
            if turn_hash(turn) in seen:
                n_seen += 1
                continue
            if is_loop_turn(turn):
                n_loop += 1
                continue
            new_turns.append(turn)
            hashes.append(turn_hash(turn))
    return new_turns, hashes, n_seen, n_loop


# ── I/O shell ────────────────────────────────────────────────────────────────


def _sessions(root: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for path in sorted((root / "sessions").glob("*.md")):
        try:
            out[path.name] = path.read_text(encoding="utf-8")
        except OSError:
            continue
    return out


def _load_hashes(path: Path, key: str) -> set[str]:
    try:
        return set(json.loads(path.read_text(encoding="utf-8")).get(key, []))
    except (OSError, ValueError):
        return set()


def _dump(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def cmd_prepare(root: Path) -> None:
    refine = root / "refine"
    refine.mkdir(parents=True, exist_ok=True)
    seen = _load_hashes(refine / ".distilled.json", "seen")
    new_turns, hashes, n_seen, n_loop = compute_delta(_sessions(root), seen)
    body = INBOX_NOTE + "\n\n".join(new_turns) if new_turns else ""
    (refine / ".inbox.md").write_text(body, encoding="utf-8")
    _dump(refine / ".pending.json", {"hashes": hashes})
    print(
        f"prepare: {len(new_turns)} new, {n_seen} already-distilled, {n_loop} loop-dropped"
    )
    if not new_turns:
        print("inbox empty — nothing to distill (no-op).")


def cmd_commit(root: Path) -> None:
    refine = root / "refine"
    seen = _load_hashes(refine / ".distilled.json", "seen")
    pending = _load_hashes(refine / ".pending.json", "hashes")
    seen |= pending
    _dump(refine / ".distilled.json", {"seen": sorted(seen)})
    for name in (".inbox.md", ".pending.json"):
        (refine / name).unlink(missing_ok=True)
    print(f"commit: +{len(pending)} watermarked ({len(seen)} total).")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)
    for name in ("prepare", "commit"):
        p = sub.add_parser(name)
        p.add_argument(
            "--root", default=".", help="memory dir (holds sessions/ + refine/)"
        )
    args = parser.parse_args()
    {"prepare": cmd_prepare, "commit": cmd_commit}[args.cmd](Path(args.root))


if __name__ == "__main__":
    main()
