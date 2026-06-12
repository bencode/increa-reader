---
name: refine-memory
description: Distill raw chat transcripts into durable memory notes. Use when asked to refine memory, organize past conversations, or consolidate the memory directory (triggers like "refine memory", "整理记忆", "提炼会话").
---

# Refine Memory

Distill raw conversation transcripts into durable, topic-organized notes so future
sessions can recall what matters without re-reading full transcripts.

## Locations

The memory directory was given to you in your system prompt ("Past conversations
with this user live in ..."). Inside it:

- `sessions/` — raw transcripts, one markdown file per chat session (input)
- `refine/` — distilled notes, organized **by topic, not by session** (output)

## Procedure

1. List all transcripts in `sessions/` and read them (Glob + Read).
2. Read everything currently in `refine/` so you update rather than duplicate.
3. Extract only durable knowledge:
   - User preferences and habits (how they like things done)
   - Facts and conclusions reached (decisions, findings, established context)
   - Project/domain background the user explained
   - Explicitly deferred items ("next time", "later we should ...")
4. Write/update topic files in `refine/`, e.g. `refine/reading-notes.md`,
   `refine/user-preferences.md`, `refine/project-context.md`. Create new topic
   files only when content doesn't fit existing ones.

## Rules

- **Merge, don't append blindly**: if a topic file already covers a point, update
  it in place; resolve contradictions in favor of the newer transcript.
- **Discard noise**: greetings, one-off lookups, tool mechanics, anything with no
  long-term value.
- **Stay terse**: bullet points, one fact per line; each topic file should stay
  well under 100 lines.
- **Date major facts**: suffix important entries with `(YYYY-MM-DD)` taken from
  the transcript timestamps.
- Never modify or delete anything under `sessions/` — transcripts are the
  immutable source of truth.
- When done, reply with a one-paragraph summary of what was added or changed.
