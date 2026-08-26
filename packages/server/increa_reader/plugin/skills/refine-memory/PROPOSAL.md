# Proposal: refine-memory skill 改进

> 给优化 agent：本文是基于一次**真实运行**（2026-06-17，brain2 项目）暴露的问题清单 + 可直接 patch 的改写建议。问题按严重度排，每条给「现象 / 证据 / 根因 / 建议」。最后的「建议改写」是可直接替换进 `SKILL.md` 的英文片段。

## 运行环境（证据来源）

- memory 目录：`/Users/bencode/work/brain2/chat-logs/memory/`
  - `sessions/` 仅 1 个 transcript：`session_1780641666831.md`
  - `refine/`：`project-seed.md`、`reading-notes.md`
- 同项目另有**独立的 auto-memory 系统**：`/Users/bencode/.claude/projects/-Users-bencode-work-brain2/memory/`（`MEMORY.md` + 28 条 `*.md`）。refine-memory skill 目前完全不感知它。

## 问题清单

### P0-1 · transcript 回环（最严重）

**现象**：transcript 会把「上一次 refine 运行的报告」原样录进去；下次 refine 时，这段「提炼产物」又成了输入。

**证据**：`session_1780641666831.md` 第 5–23 行——第一条 user 消息是 *"Use the refine-memory skill..."*，紧跟的 assistant 段是上次的总结（*"Done. Read all 7 session transcripts... Created 2 topic files..."*）。这整段是 refine 的**输出**，不是源知识。

**根因**：`Procedure` 步骤 3 的「discard noise」清单里没有「prior refine-run summaries embedded in transcripts」这一类；`Rules` 也没提示识别。盲目提炼会把报告再提炼一遍，噪音自我繁殖。

### P0-2 · 幂等 / 增量检测缺失

**现象**：skill 假设每次运行都有新东西要提炼，但没有任何「判断 transcript 是否已被提炼过」的步骤。

**证据**：本次运行时，transcript 的 durable 内容已被前一次运行提炼干净（`reading-notes.md` mtime 15:07 > transcript 最后条目 13:14）。我是靠 **mtime** 侥幸判断「已处理」的，但这不可靠——mtime 不代表内容覆盖关系；session 一旦 append 新条目，整个文件 mtime 更新，但旧部分其实已提炼过。

**根因**：`Procedure` 缺一步「按**内容覆盖度**判断是否跳过」，且没说明 mtime 不可作为判据。

### P1-1 · 去重范围只限 `refine/`

**现象**：`Procedure` 步骤 2「Read everything currently in `refine/`」——去重只扫 `refine/`，不扫同项目的 auto-memory。

**证据**：「Agent+RAG+RL 主线」这条事实，auto-memory（`MEMORY.md` → `user_professional_direction`）和 `refine/reading-notes.md`（triage methodology 段）**两边都有**。refine 侧是冗余副本，且未来两边更新会不一致。

### P1-2 · 两套 memory 的边界未声明

**现象**：skill 完全没说 `refine/` 和 auto-memory 是什么关系，新知识该进哪套没指引。

**根因**：`Locations` 只描述了 `sessions/` 和 `refine/`，没有 scope 声明。结果是同一事实两边都长，权威源不明。

### P2-1 · topic 文件内「生命周期混合」

**现象**：`refine/reading-notes.md` 混了三类生命周期不同的内容：已读笔记、已评估后跳过的论文、**未读 backlog**（ASSAY 等）。

**根因**：`Procedure` 步骤 4 只说「by topic」组织，没要求把易变状态（backlog / 待决项）从稳定笔记里分离。等 backlog 里某篇真被读了，要做「状态搬运」，混在一起会乱。

### P2-2 · no-op 结果未规定

**现象**：`Rules` 最后一条「reply with a one-paragraph summary of what was added or changed」——没规定「本次无任何变更」时该怎么报。我这次是临时编了个「nothing changed」报告。

**根因**：skill 隐含「每次必有变更」，逼着 agent 制造编辑。

### P3 · 日期语义混淆

**现象**：`Rules`「Date major facts (YYYY-MM-DD) taken from the transcript timestamps」——但 transcript 时间戳是**会话发生时间**，不一定是事实成立时间。

**证据**：SkillWiki 论文的日期应是它自己的 arxiv/发表时间，不是 2026-06-17 讨论它的那天。skill 没区分「会话日期」与「事实日期」。

---

## 建议改写（可直接 patch 进 `SKILL.md`）

### 新增小节：`Scope: refine/ vs auto-memory`（放 `Locations` 之后）

```markdown
## Scope: refine/ vs auto-memory

Two memory systems may coexist in a project:

- **auto-memory** (`MEMORY.md` + `memory/*.md`, if present): short rules,
  preferences, project status — injected into context on recall. Authoritative
  for "how to work" and "current state".
- **refine/** (`refine/*.md`): long-form knowledge distillation — reading notes,
  topic deep-dives, conclusions with reasoning. Read on demand, not injected.

A given fact should be authoritative in one system only. refine/ complements
auto-memory with depth and context; it does not mirror its short rules.
```

### 替换 `Procedure`（整段替换步骤 1–4）

```markdown
## Procedure

1. List all transcripts in `sessions/` (Glob) and read each (Read).
2. Read everything currently in `refine/` **and skim the project's auto-memory**
   (`MEMORY.md` + `memory/*.md`, if present) so you update rather than duplicate.
3. **Decide what's already distilled** — per transcript, judge by *content
   coverage*, not file mtime (mtime is unreliable once a transcript is appended
   to). If a transcript's durable facts are already covered in `refine/`, skip
   it. Strong signal a transcript was already processed: its early entries are a
   prior refine-memory run's own summary — treat that summary as **output, not
   input**.
4. Extract only durable knowledge from the *new* content:
   - User preferences and habits (how they like things done)
   - Facts and conclusions reached (decisions, findings, established context)
   - Project/domain background the user explained
   - Explicitly deferred items ("next time", "later we should ...")

   Discard: greetings, one-off lookups, tool mechanics, **and prior refine-run
   summaries embedded in transcripts**.
5. Write/update topic files in `refine/`, e.g. `refine/reading-notes.md`,
   `refine/user-preferences.md`, `refine/project-context.md`. Create new topic
   files only when content doesn't fit existing ones. **Keep volatile state**
   (to-read backlogs, pending decisions) **separate from stable notes** — its
   own file or a clearly marked section.
6. If nothing new was added (everything already distilled, or only noise), say
   so explicitly with the reason — do not manufacture edits.
```

### 替换 `Rules`（在现有 6 条基础上调整 + 新增）

```markdown
## Rules

- **Merge, don't append blindly**: if a topic file already covers a point, update
  it in place; resolve contradictions in favor of the newer transcript.
- **Dedup across both memory systems**: a short rule already living in
  auto-memory should not be duplicated in `refine/`. One fact, one home —
  `refine/` holds the long-form context, auto-memory holds the recall-injected
  rule.
- **Discard noise**: greetings, one-off lookups, tool mechanics, prior refine-run
  summaries — anything with no long-term value.
- **Stay terse**: bullet points, one fact per line; each topic file should stay
  well under 100 lines.
- **Date facts by when they became true**, not by session date (a paper's date is
  its publication, not the day it was discussed). Tag the discussion date
  separately only if it matters (e.g. "evaluated 2026-06-17").
- Never modify or delete anything under `sessions/` — transcripts are the
  immutable source of truth.
- **No-op is a valid outcome**: when every transcript was already distilled or
  held only noise, report that with the reason instead of forcing a change.
```

---

## 验收（用本次运行作回归基线）

把优化后的 skill 喂**同一个输入**（1 个已被提炼的 session），应当：

1. 识别出 transcript 的 durable 内容已在 `refine/` 中 → 跳过；
2. 把 transcript 里嵌入的「上次 refine 报告段」当**非输入**丢弃；
3. **零文件变更**；
4. 报告一个 no-op 并写明原因。

再追加一段**全新**会话后重跑，应当只提炼这段新内容的 durable 知识，旧笔记原样不动。

---

## 优先级建议

- **必做**：P0-1（回环）、P0-2（幂等）——这俩是正确性 bug，会让产物被噪音污染。
- **应做**：P1-1（跨系统去重）、P1-2（scope 声明）——解决冗余与权威源混乱。
- **可做**：P2/P3——体验与精度优化，时间够再上。
