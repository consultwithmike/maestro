---
description: Run the full Maestro pipeline on a task, story, or idea (strategist → architect → implementer → 4 verifiers, with routing, arbitration, and backlog).
argument-hint: <task, story, idea, or "run BL-0007">
---

Invoke the **maestro-orchestrator** skill and run the complete pipeline for the following
request. You are the orchestrator (main session): follow the skill's routing, context
assembly, normalization, arbitration, disposition, retry, and end-of-run summary rules exactly.

Request:

$ARGUMENTS

If the request is of the form `run BL-<id>`, treat it as launching a fresh task scoped from
that backlog item (the strategist re-scopes it; use a new task_id with the backlog id as
`task_origin`).

Begin at INTAKE. Do not skip the strategist even if the request seems obvious — requirement
verification is the cheapest place to catch the most expensive mistakes.
