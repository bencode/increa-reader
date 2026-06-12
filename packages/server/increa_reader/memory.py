"""
Conversation memory: dumb file persistence under {CHAT_LOGS_DIR}/memory/.

The server only writes transcripts; distillation is done by the agent itself
via the refine-memory skill (see plugin/skills/refine-memory/SKILL.md).
"""

import asyncio
import os
import re
from datetime import datetime
from pathlib import Path

PLUGIN_DIR = Path(__file__).parent / "plugin"

REFINE_PROMPT = (
    "Use the refine-memory skill: read all transcripts under the memory "
    "directory's sessions/ folder and distill durable knowledge into "
    "topic files under refine/."
)


def memory_dir() -> Path:
    logs_path = os.getenv("CHAT_LOGS_DIR", "chat-logs")
    return Path(logs_path).expanduser() / "memory"


def ensure_memory_dirs() -> Path:
    root = memory_dir()
    (root / "sessions").mkdir(parents=True, exist_ok=True)
    (root / "refine").mkdir(parents=True, exist_ok=True)
    return root


def memory_prompt_note() -> str:
    root = memory_dir()
    return (
        f"\n\nPast conversations with this user live in {root}: "
        "sessions/ holds raw transcripts, refine/ holds distilled notes. "
        "Read/Grep there when the user references earlier discussions."
    )


def _safe_session_id(session_id: str) -> str | None:
    """Keep only filename-safe chars; reject anything that could escape the dir."""
    cleaned = re.sub(r"[^A-Za-z0-9_-]", "", session_id)
    return cleaned or None


def transcript_path(session_id: str) -> Path | None:
    safe_id = _safe_session_id(session_id)
    if not safe_id:
        return None
    return memory_dir() / "sessions" / f"{safe_id}.md"


def format_turn(
    prompt: str,
    assistant_texts: list[str],
    tool_names: list[str],
    ts: datetime,
) -> str:
    stamp = ts.strftime("%Y-%m-%d %H:%M")
    parts = [f"## [{stamp}] User\n\n{prompt.strip()}\n"]
    assistant_body = "\n\n".join(t.strip() for t in assistant_texts if t.strip())
    if assistant_body:
        parts.append(f"## [{stamp}] Assistant\n\n{assistant_body}\n")
    if tool_names:
        parts.append(f"> tools: {', '.join(dict.fromkeys(tool_names))}\n")
    return "\n".join(parts) + "\n"


def append_turn(
    session_id: str | None,
    prompt: str,
    assistant_texts: list[str],
    tool_names: list[str],
) -> None:
    """Append one completed turn to the session transcript. Never raises."""
    if not session_id:
        return
    try:
        path = transcript_path(session_id)
        if path is None:
            return
        ensure_memory_dirs()
        if not path.exists():
            created = datetime.now().strftime("%Y-%m-%d %H:%M")
            path.write_text(
                f"# Session {session_id}\n\nCreated: {created}\n\n",
                encoding="utf-8",
            )
        with path.open("a", encoding="utf-8") as f:
            f.write(format_turn(prompt, assistant_texts, tool_names, datetime.now()))
    except OSError as e:
        print(f"⚠ Failed to write transcript for {session_id}: {e}")


async def memory_refine_loop() -> None:
    """Periodically run a one-shot agent that refines memory via the skill."""
    interval_hours = float(os.getenv("MEMORY_REFINE_INTERVAL_HOURS", "24"))
    while True:
        await asyncio.sleep(interval_hours * 3600)
        try:
            await _run_refine_agent()
        except Exception as e:
            print(f"⚠ Memory refine run failed: {e}")


async def _run_refine_agent() -> None:
    from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

    from .workspace import build_sdk_env

    root = ensure_memory_dirs()
    options = ClaudeAgentOptions(
        cwd=str(root),
        permission_mode="bypassPermissions",
        system_prompt={
            "type": "preset",
            "preset": "claude_code",
            "append": memory_prompt_note(),
        },
        plugins=[{"type": "local", "path": str(PLUGIN_DIR)}],
        env=build_sdk_env(),
    )
    client = ClaudeSDKClient(options=options)
    try:
        await client.connect()
        await client.query(REFINE_PROMPT)
        async for _ in client.receive_response():
            pass
        print("✓ Memory refine completed")
    finally:
        await client.disconnect()
