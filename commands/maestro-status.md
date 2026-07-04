---
description: Show the current state of Maestro tasks — stage, verifier votes, open rework reasons, and retry count.
argument-hint: [task_id]  (omit to list all tasks)
---

Report the current state of Maestro work by reading the state files under `.maestro/`.

- If a task_id was provided (`$ARGUMENTS`), read `.maestro/tasks/$ARGUMENTS/status.json` and
  summarize: current `stage`, each verifier's latest vote, any `active_rework_reasons` (with
  their acceptance conditions), `retry.count` / `retry.max`, and the last few `history` entries.
  Then, if `token_usage` is present, render a **Token usage** block:
  - `total` tokens for the task.
  - A per-stage line from `by_stage` (e.g. `STRATEGY 29142 · ARCHITECTURE 25815`).
  - A per-agent line from `by_agent` (e.g. `strategist 29142 · principal-engineer 25815`).
  - A per-turn table with columns `seq | stage | agent | tokens`, one row per entry in
    `token_usage.turns`; render a `null` `subagent_tokens` as `—`.
  If `token_usage` is absent (pre-USAGE-001 state), show `—` / `n/a` for these — never error.
- If no task_id was provided, list every task under `.maestro/tasks/` with its `task_id` and
  `stage` in a compact table — add a **tokens** column showing each task's `token_usage.total`
  (or `—` if the task has no `token_usage`) — then note how many total items sit in
  `.maestro/backlog.json`.

Do not run any agents or change any files — this is a read-only status view. `token_usage` is
displayed only; it never affects routing or any decision.
