---
description: Show the current state of Maestro tasks — stage, verifier votes, open rework reasons, and retry count.
argument-hint: [task_id]  (omit to list all tasks)
---

Report the current state of Maestro work by reading the state files under `.maestro/`.

- If a **`WHATIF-*`** id was provided (`$ARGUMENTS`), this is a feasibility study, not a task:
  read `.maestro/whatifs/$ARGUMENTS/status.json` and render its **verdict block** — the current
  `stage`, and (if `feasibility_verdict` is present) its `verdict`, `reasoning`, `evidence_refs`,
  `blocking_constraint` (`—` if null), and `promotable`. Then render the same **Token usage**
  block described below from its `token_usage` (its turns only ever span `STRATEGY` /
  `ARCHITECTURE`). If the file is missing, say so plainly — never error. This is read-only.
- If a task_id was provided (`$ARGUMENTS`), read `.maestro/tasks/$ARGUMENTS/status.json` and
  summarize: current `stage`, each verifier's latest vote, any `active_rework_reasons` (with
  their acceptance conditions), `retry.count` / `retry.max`, and the last few `history` entries.
  Then, if `token_usage` is present, render a **Token usage** block:
  - `total` tokens for the task.
  - A per-stage line from `by_stage` (e.g. `STRATEGY 29,142 · ARCHITECTURE 25,815`).
  - A per-agent line from `by_agent` (e.g. `strategist 29,142 · principal-engineer 25,815`).
  - A per-turn table with columns `seq | stage | agent | tokens`, one row per entry in
    `token_usage.turns`; render a `null` `subagent_tokens` as `—`.
  - Render every token count in this block — `total`, each `by_stage` value, each `by_agent`
    value, and each per-turn `tokens` cell — with thousands-separator grouping: a comma every
    three digits from the right (e.g. `208950` → `208,950`, `29142` → `29,142`). This is
    display-only — never round, abbreviate (`209K`), or otherwise alter the stored value. A
    `null`/absent token count still renders as `—`, never a grouped zero.
  If `token_usage` is absent (pre-USAGE-001 state), show `—` / `n/a` for these — never error.
- If no task_id was provided, list every task under `.maestro/tasks/` with its `task_id` and
  `stage` in a compact table — add a **tokens** column showing each task's `token_usage.total`
  (or `—` if the task has no `token_usage`), rendering that total with the same thousands-separator (comma) grouping used in the single-task Token usage block (e.g. `208950` → `208,950`); a `—` stays `—`, then note how many total items sit in
  `.maestro/backlog.json`.
- Also in the no-arg case, render a **SEPARATE What-ifs section** for feasibility studies — this
  is fully guarded and **never merged into the tasks table** and never counted as a built task.
  Only if `.maestro/whatifs/` exists **and is non-empty**, list every study under it in its own
  compact table with columns `whatif_id | stage | verdict | promotable | tokens`, one row per
  study (grouped as a section), rendering an absent `verdict`/`promotable` as `—` and the
  `tokens` column as `token_usage.total` with the same thousands-separator grouping (or `—` if
  absent). If `.maestro/whatifs/` is missing or empty, render **nothing** for this section —
  never error.

Do not run any agents or change any files — this is a read-only status view. `token_usage` is
displayed only; it never affects routing or any decision.
