---
name: refine-memory
description: Distill raw chat transcripts into durable, retrievable memory atoms. Use when asked to refine memory, organize past conversations, or consolidate the memory directory (triggers like "refine memory", "整理记忆", "提炼会话").
---

# Refine Memory

Distill raw conversation transcripts into **retrieval atoms** so a future session
recalls what matters by Grep/Read, without re-reading whole transcripts.

This skill is stratified: each layer uses the representation that fits its
precision. Math states *what*; the tool *computes* the deterministic parts;
Clojure pins the *branching*; prose carries the *judgment* that can't be
formalized. Read top to bottom, then follow `## Procedure`.

## Locations

The memory directory was given in your system prompt ("Past conversations with
this user live in ..."). Inside it:

- `sessions/` — raw transcripts, one markdown file per chat (input, immutable)
- `refine/` — distilled atoms, organized **by topic, not by session** (output)

A second **auto-memory** system may coexist (`MEMORY.md` + `memory/*.md`). It
holds short, recall-injected rules; `refine/` holds long-form retrievable atoms.
A fact is authoritative in **one** system only — `refine/` complements, never
mirrors.

## Layer 0 — Direction (what the output *is*)

The product is a set of **retrieval atoms**. An atom is well-formed iff:

```
atom(a)  ⟺  atomic(a) ∧ retrievable(a) ∧ answer_bearing(a)
```

- **atomic** — one fact; the minimal independently writable/retrievable unit.
- **retrievable** — found by a plausible future Grep (self-anchoring, or given an
  explicit `[anchor: …]`).
- **answer_bearing** — states a conclusion, not a pointer to where one might be.

If a candidate fails any conjunct, split it, re-anchor it, or drop it.

## Layer 1 — Definitions (precise)

- Input delta (computed by the tool, never by eyeballing mtime):
  `delta = ⋃ᵢ turns(sessionᵢ) ∖ seen`
- Duplicate (resolve by **merging**, not appending):
  `dup(a) ⟺ ∃ b ∈ (refine ∪ auto-memory) : key(a) = key(b)`
- **One fact, one home** — `refine/` is a *partition*: every atom lives in exactly
  one file. No copies across files or across memory systems.
- **Date by truth, not by session** — `date(a) = becomes_true(fact(a))`. A paper's
  date is its publication, not the day it was discussed. Tag the discussion date
  separately only if it matters (e.g. `evaluated 2026-06-17`).

## Layer 2 — Mechanics (the tool does this; you don't guess)

`scripts/refine_delta.py` (path given in your prompt) handles idempotency and the
loop guard deterministically:

- `prepare --root <memory_dir>` → writes `refine/.inbox.md` with **only** new,
  non-loop turns, and stages their hashes in `refine/.pending.json`.
- `commit --root <memory_dir>` → folds the staged hashes into the watermark
  (`refine/.distilled.json`) and clears the inbox. Run **only after** a
  successful distill, so a failure never loses un-distilled turns.

You never decide "was this already refined?" or "is this a refine echo?" — the
tool already filtered those out before you see the inbox.

## Layer 3 — Routing (branching, unambiguous)

Each inbox turn routes by the tree below. The **leaf predicates are your
judgment**; the control flow and the output taxonomy are fixed.

```clojure
(defn route [turn]                 ; transcript turn → disposition + atom type
  (cond
    (loop-artifact? turn) :drop/loop      ; tool pre-filters; this is a backstop
    (noise? turn)         :drop/noise     ; greetings, one-off lookups, tool mechanics
    (preference? turn)    :keep/preference
    (decided? turn)       :keep/fact      ; decisions, findings, conclusions
    (context? turn)       :keep/context   ; project/domain background explained
    (deferred? turn)      :keep/backlog   ; "next time", "later" — volatile
    :else                 :review))       ; unsure → hold, don't force an atom

(defn place [atom-type]            ; atom type → home file (one fact, one home)
  (case atom-type
    :preference "refine/_user.md"
    (:fact :context) topic-file           ; merge into the matching topic file
    :backlog    "refine/_backlog.md"))    ; volatile state, isolated from stable notes
```

## Layer 4 — Judgment (not formalizable — this is your job)

- **Durability** — keep only what a future session would benefit from; discard the
  transient. When unsure, route `:review` and leave it out rather than guess.
- **Anchoring** — if an atom's statement isn't something you'd naturally Grep for,
  append `[anchor: <search terms>]`. The anchor is the retrieval handle, distinct
  from the statement.
- **Semantic dedup** — Layer 1 gives the predicate; you supply the similarity call.
  Before writing, skim `refine/` and (if present) auto-memory; if a fact is already
  homed, update it in place — never add a second copy.
- **Topic naming & merging** — group `:fact`/`:context` atoms into cohesive topic
  files; create a new one only when nothing fits.

## Layer 5 — Invariants

- **Merge, don't append blindly** — contradictions resolve toward the newer transcript.
- **Volatile ≠ stable** — backlog/pending items live in `refine/_backlog.md`, never
  mixed into stable topic notes.
- **No-op is valid** — if the inbox is empty or held only noise, say so with the
  reason; never manufacture edits.
- **`sessions/` is immutable** — never modify or delete a transcript.

## Atom format

One atom per line: a self-contained statement, a `:type` tag, the truth-date, and
an optional retrieval anchor.

```markdown
## <topic>
- <self-contained fact statement> `:fact` (2026-06-17) [anchor: <terms, if needed>]
```

## Procedure

1. **Prepare** — run `refine_delta.py prepare --root <memory_dir>`. Read the printed
   summary and `refine/.inbox.md`.
2. **No-op check** — if the inbox is empty, report that (with the reason from the
   summary) and stop. Do not run commit.
3. **Distill** — for each turn in the inbox: `route` it, and for kept turns extract
   atoms (Layer 0 shape), `place` them into the right `refine/` file, merging per
   Layer 4 dedup. Date by truth (Layer 1).
4. **Commit** — run `refine_delta.py commit --root <memory_dir>` to advance the
   watermark.
5. Reply with a one-paragraph summary of what was added, merged, or skipped.
