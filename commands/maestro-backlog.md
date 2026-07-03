---
description: List Maestro's backlog of deferred findings, or launch a new pipeline run against one.
argument-hint: [list | run BL-0007]
---

Manage the Maestro backlog by reading `.maestro/backlog.json`.

- `list` (or no argument): show every backlog item — `id`, `severity`, `status`, one-line
  `finding`, originating `task_origin`, and `rationale`. Group by status (open first). If the
  file doesn't exist or is empty, say so plainly.
- `run BL-<id>`: hand off to the **maestro-orchestrator** skill to launch a fresh pipeline run
  scoped from that backlog item. The strategist re-scopes it as its own task (new task_id,
  `task_origin` = the backlog id). Carry the item's `finding` and `acceptance` into the new
  task's requirement so nothing is lost.

Backlog items never re-enter an active task automatically — running one is always a deliberate,
human-initiated new task.

Argument: $ARGUMENTS
