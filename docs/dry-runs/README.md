# Maestro dry runs

This folder is **evidence**. Each file is a real, end-to-end transcript of the Maestro pipeline
executing on a concrete task — so someone evaluating Maestro (who did *not* build it) can see how
it actually behaves, not just how it's described.

Each run shows: the task, every stage, each agent's verdict, the findings raised, how the
orchestrator disposed of them (block / backlog / dismiss), any rework loops, independently
re-run test output, and the final state file. Nothing is summarized away — where a verifier
rejected, you see the exact finding and the fix that cleared it.

## How these runs were produced (read this first)

Runs **001–005 are honest simulations**; runs **006–007 are the real installed plugin.** The
distinction matters for trusting them:

- Runs 001–005: the orchestration was driven **manually, following
  `skills/maestro-orchestrator/SKILL.md` exactly** — the same routing, context-whitelisting,
  normalization, arbitration, and retry rules the installed skill encodes — and each role agent
  ran as a subagent carrying **the real prompt from `agents/<role>.md`** and its real
  structured-JSON return contract. The prompts, return schemas, state schema (`schemas/`), and
  routing logic are the shipping artifacts — not mock-ups.
- Runs 006–007: run **as the fully installed marketplace plugin** — `claude plugin install`ed,
  the top-level session auto-loading `maestro-orchestrator` and spawning the registered
  `maestro:*` agent types via the Agent tool. This is the invocation surface 001–005 could only
  approximate; the mechanics proved identical. (Both also happen to build features *into Maestro
  itself* — the pipeline dogfooding its own repo.)
- Test output and validation shown were **re-executed independently by the orchestrator**, not
  taken on an agent's word.

If a run hit a wall or a gate behaved unexpectedly, it's written down. These aren't marketing
demos; they're execution logs.

## Runs

| # | Task | What it demonstrates | Result |
|---|------|----------------------|--------|
| [001](001-email-validator.md) | Add `is_valid_email` + tests | Clean happy path; four independent verifiers; real (non-rubber-stamp) verification | DONE, first pass |
| [002](002-path-traversal-rework.md) | Add `read_note(name)` file reader | Verifier **rejection** → rework loop → re-verification of the specific fix; block vs backlog disposition | DONE after 1 rework; 1 item backlogged |
| [003](003-escalation-requirement-conflict.md) | Add `mask_email(email)` for a confirmation screen | Security vs UX demand **mutually exclusive** things → orchestrator **escalates** instead of arbitrating; no wasted rework | ESCALATED_TO_HUMAN |
| [004](004-retry-ceiling.md) | Add `slugify(text)` for arbitrary text | Each rework fixes its case but the requirement is **unbounded**; the **retry ceiling** stops the loop and escalates the cause | ESCALATED_TO_HUMAN (ceiling) |
| [005](005-calculator-app.md) | Build a Windows-style **calculator app** | Real deliverable from a 1-line ask: **multi-turn strategist↔principal** scope negotiation, testable engine/UI split, visual-fidelity review, 1 rework | DONE — [working app](artifacts/005-calculator.html) |
| [006](006-token-accounting.md) | Add **token usage statistics** | A best-effort **token ledger** written once per turn (in the same write as `history`): per-turn records + `total`/`by_agent`/`by_stage` rollups; graceful null on missing usage; additive schema; observability-only (no gate reads it) | DONE — dogfooded live |
| [007](007-rework-dogfood.md) | `run BL-0001` (backlog cleanup) | A **rework loop on the installed plugin**: a 4/4-passing change still gets a tight polish loop for two low nits, cleared by **curated re-verification** (only the two finding-owners re-run — a third to two-thirds the cost of a full review); full backlog lifecycle closed | DONE after 1 rework; BL-0001 resolved |

## Reproducing

Install the plugin (`README.md` → Install), then run `/maestro "<your task>"` in any repo. The
orchestrator writes the same state files shown here under `.maestro/` in that repo.
