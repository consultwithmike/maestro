---
description: Ask "is this even possible?" — run the front half of the Maestro pipeline (strategist → principal engineer) to produce an honest, evidence-grounded feasibility verdict, then STOP before any code.
argument-hint: <a free-text feasibility question, e.g. "can we split token usage into input vs output?">
---

Invoke the **maestro-orchestrator** skill in **feasibility mode** for the following question.
You are the orchestrator (main session): follow the skill's `## Feasibility mode (/what-if)`
section exactly.

Question:

$ARGUMENTS

This is a **feasibility study, not a build**. Run STRATEGY (strategist) and then — unless the
strategist early-terminates — ARCHITECTURE (principal engineer), then STOP. Do **not** invoke
the implementer or any verifier, do **not** touch source code, and do **not** produce a diff.
Write only under `.maestro/whatifs/<id>/`.

Synthesize a feasibility verdict (`FEASIBLE` | `FEASIBLE_WITH_CAVEATS` | `INFEASIBLE`) from the
strategist's scope and the principal engineer's plan/risks, with reasoning and **at least one
cited evidence ref** (a concrete file/artifact citation). Be honest: an accurate `INFEASIBLE`
is the point of this command — never inflate a verdict, and `token_usage` never influences it
(observability only). Terminate in stage `WHATIF_DONE`.

Report the verdict, its reasoning, and the evidence refs to the human. If the verdict is
promotable (`FEASIBLE` or `FEASIBLE_WITH_CAVEATS`), tell them how to promote it into a real
build: `/maestro run <whatif_id>`.
