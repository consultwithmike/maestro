---
description: Show the current state of Maestro tasks — stage, verifier votes, open rework reasons, and retry count.
argument-hint: [task_id]  (omit to list all tasks)
---

Report the current state of Maestro work by reading the state files under `.maestro/`.

- If a task_id was provided (`$ARGUMENTS`), read `.maestro/tasks/$ARGUMENTS/status.json` and
  summarize: current `stage`, each verifier's latest vote, any `active_rework_reasons` (with
  their acceptance conditions), `retry.count` / `retry.max`, and the last few `history` entries.
- If no task_id was provided, list every task under `.maestro/tasks/` with its `task_id` and
  `stage` in a compact table, then note how many total items sit in `.maestro/backlog.json`.

Do not run any agents or change any files — this is a read-only status view.
