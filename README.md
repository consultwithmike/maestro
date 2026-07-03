# Maestro

A conductor-led team of specialist subagents for Claude Code. Hand Maestro a story, task, or
even a rough idea; it runs the work through a real high-functioning team — a strategist who
verifies intent, a principal engineer who architects, a staff engineer who implements, and four
**independent verifiers** (code review, security, QA, UX) who can each send the work back — and
returns a change that's been reviewed the way a serious team reviews before shipping.

The **orchestrator** (the conductor) doesn't write or review code. It routes work, breaks ties
when verifiers conflict, curates exactly the context each agent needs, decides whether a finding
should **block**, **backlog**, or (rarely) be **dismissed**, enforces a retry ceiling, and hands
the human a clear summary at the end.

---

## The team

| Agent | Role | Can send work back? |
|-------|------|:---:|
| **Strategist** | Knows and verifies the requirement; turns intent into testable acceptance criteria | — |
| **Principal Engineer** | Architect — smallest clean design that fits the codebase | — |
| **Staff Engineer (Implementer)** | Writes the change | — |
| **Code Reviewer** | Enforces KISS + best practices, verifies the requirement was met | ✅ |
| **Security Engineer** | Best practices, compliance, no new risk | ✅ |
| **QA Engineer** | Verifies against acceptance criteria | ✅ |
| **UX Engineer** | World-class user experience; verifies user-facing behavior | ✅ |
| **Orchestrator** (conductor) | Routing, tie-breaking, context assembly, disposition, retry limits | it *is* the gate |

---

## How it actually works (an important architecture note)

In Claude Code, **a subagent cannot invoke other subagents** — only the main session can. So the
orchestrator is **not** an eighth subagent. It's a **Skill run by the main session**, which *can*
spawn the seven role subagents via the Agent tool. Everything the conductor needs to do —
routing, arbitration, context curation, backlog, retries — lives in that skill
(`skills/maestro-orchestrator/SKILL.md`). This is more portable, versioned, and testable than
baking the logic into a project's `CLAUDE.md`, and it's the only shape that actually runs.

The verifiers are **read-only** and **return** structured verdicts; the orchestrator is the
**sole writer** of state, so parallel verification never races on the state file.

Hooks are intentionally *not* load-bearing: the `SubagentStop` payload doesn't include a
subagent's output, so it can't drive routing. Maestro uses it only for a convenience audit trail.
The authoritative audit is the orchestrator's own `history` log.

---

## Install

```bash
# add this repo as a marketplace, then install the plugin
claude plugin marketplace add <your-org>/maestro
claude plugin install maestro
```

Or point at a local checkout during development:

```bash
claude plugin marketplace add ./path/to/maestro
claude plugin install maestro
```

---

## Use

```
/maestro Add rate limiting to the public API: 100 req/min per API key, 429 on exceed.
```

Other entry points:

- `/maestro-status [task_id]` — current stage, verifier votes, open rework reasons, retry count.
- `/maestro-backlog list` — everything that got deferred.
- `/maestro-backlog run BL-0007` — launch a fresh pipeline scoped from a backlog item.

The pipeline stops and asks you when it should: a high-severity security finding, the retry
ceiling is hit, or the verifiers disagree about what the requirement actually *means*.

---

## State

Runtime state lives under `.maestro/` in your repo (git-ignored by default):

```
.maestro/
├── backlog.json                 # cross-task deferred findings
├── audit.log                    # convenience trace from the SubagentStop hook
└── tasks/<task_id>/
    ├── status.json              # single source of truth (schemas/task-status.schema.json)
    ├── requirement.md           # strategist output
    ├── architecture.md          # principal output
    ├── diff-vNN.md              # implementer output per pass
    └── raw/<seq>-<agent>.md      # captured raw agent outputs
```

The two files are validated by JSON Schemas in `schemas/`.

---

## Design decisions baked in

- **Requirement is immutable.** The human's words are stored verbatim and every agent is measured
  against them. The strategist normalizes *around* them; it never overwrites them.
- **Context is curated, not dumped.** Each agent gets only the artifacts on its whitelist
  (`context_requirements`) plus the specific rework findings that `target` it. A UX rejection that
  goes back to the implementer is *also* shown to the code reviewer next pass — so the reviewer
  can confirm that exact fix — but the security engineer never sees UX noise.
- **Normalization is structured, not lossy.** Cross-agent findings are re-shaped into a schema
  (`finding`, `location`, `expected`, `actual`, `acceptance`, `severity`), not compressed into a
  one-liner. The `acceptance` field — what "resolved" means — is never distilled away, because
  that's what the re-verification checks against. One-liners are for the human summary only.
- **Findings have three fates.** BLOCK (fix now), BACKLOG (valid, out of scope → new standalone
  task, human notified), or DISMISS (rare; **never** for security findings).
- **Severity priority for tie-breaks:** `security > correctness > KISS/maintainability > UX polish`,
  unless the requirement says otherwise. This default is explicit and editable — set it once so
  arbitration is consistent across runs.
- **Retries are bounded.** At `retry.max` (default 3) the orchestrator stops and escalates rather
  than looping forever.
- **Nothing ships silently.** Every backlogged item is reported at end of run with its rationale.

---

## Tuning

- **Severity priority / disposition defaults** — edit the "Arbitration" section of
  `skills/maestro-orchestrator/SKILL.md`. This is the single most important thing to make explicit
  for your team; inconsistent tie-breaking is what erodes trust in a pipeline.
- **Models & effort per role** — each `agents/*.md` sets `model:`; raise or lower per your
  cost/quality tradeoff.
- **Retry ceiling** — default `retry.max` is 3 (`templates/task-status.template.json`), overridable
  per run.
- **Tool permissions** — verifiers ship read-only (their `tools:` allowlist omits `Write`/`Edit`);
  tighten or loosen in each agent's frontmatter.

---

## Cost & latency

Seven roles, re-invoked on rejection, means real token and wall-clock cost per task. That's the
tradeoff for review-gated output. Two levers: the retry ceiling caps worst-case loops, and
verifiers run in parallel. Because cost scales with agent-hops and retries rather than headcount,
this pipeline fits **per-task / per-PR** economics far better than seat-based.

---

## License

MIT — see [LICENSE](LICENSE).
