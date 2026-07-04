# Dry run 006 — token accounting, captured every turn

**Task given to `/maestro`:**

> Add token usage statistics. Add a new proof case (Run 006) that proves token usage is right
> and available after every turn, and that you can see token usage history for these turns. Usage
> is likely saved locally (not portable machine-to-machine), which is acceptable.

**Result:** `DONE`. The pipeline gained a **best-effort token ledger** (`token_usage` in
`status.json`) that the orchestrator writes **once per subagent turn**, in the same write as the
`history` append. Every turn is recorded — strategist, principal, implementer, and each of the
four verifiers as **four distinct turns** — with a per-turn `subagent_tokens` scalar and three
rollups (`total`, `by_agent`, `by_stage`). Final captured total for this run: **208,950 tokens**
across 7 turns.

> ### This run was the first end-to-end run on the *installed* plugin — and it dogfooded its own feature
> Runs 001–005 were driven through general-purpose agents. Run 006 ran on the **real installed
> Maestro** (`maestro:strategist`, `maestro:principal-engineer`, … invoked via the Agent tool),
> after the plugin was published and `claude plugin install`ed. The feature under construction was
> **token accounting**, and the orchestrator captured each turn's real `subagent_tokens` *as it
> built it*. The ledger's sole data source is the `<usage>subagent_tokens: N</usage>` scalar the
> **orchestrator** sees on each subagent return — a subagent cannot observe its own marker, and
> only the orchestrator sees every turn, so the authoritative numbers are written by the
> orchestrator, turn by turn. The strategist (seq 2) and principal (seq 4) turns were captured
> *live while the feature was mid-build*; the implementer and four verifier turns were captured by
> the orchestrator at ship (once those turns completed) — exactly the mechanism the feature
> defines. Nothing is fabricated: every number below is a real observed `subagent_tokens`.

---

## Pipeline trace

| # (seq) | Stage | Agent | Verdict | Tokens |
|---|-------|-------|---------|-------:|
| 1 | INTAKE | orchestrator | Task `USAGE-001`, requirement verbatim, `retry.max=3` | — |
| 2 | STRATEGY | strategist | **SCOPED** — 11 criteria; defined turn = one subagent invocation; usage non-blocking, additive schema, sole-writer | 29,142 |
| 3 | ROUTE | orchestrator | Recorded strategist turn (cumulative 29,142); route to ARCHITECTURE | — |
| 4 | ARCHITECTURE | principal-engineer | Design: `token_usage{turns[],total,by_agent,by_stage}`, additive (not in `required`), null-graceful path, SKILL subsection, `maestro-status` render | 25,815 |
| 5 | ROUTE | orchestrator | Recorded principal turn (cumulative 54,957); route to IMPLEMENTATION | — |
| 6 | IMPLEMENTATION | staff-engineer-implementer | Built 7 files; validated JSON. **Honest self-finding:** live `status.json` `token_usage` had a stray `note` key breaking `additionalProperties:false` — refused to edit `.maestro/`, flagged for orchestrator | 42,488 |
| 7 | RECONCILE | orchestrator | Accepted finding: dropped stray `note` key (now schema-clean); route to VERIFICATION | — |
| 8 | VERIFICATION | security-engineer | **APPROVE** — plain integer extract (no eval/injection), schema-bounded, no secrets/PII, non-blocking null path, local-only, write-only | 28,091 |
| 9 | VERIFICATION | code-reviewer | **APPROVE** — additive at `required` (line 7 untouched), draft-07 valid, field names consistent across all 7 files, KISS | 25,743 |
| 10 | VERIFICATION | ux-engineer | **APPROVE** — both views clear, null→`—`, graceful degrade; one **low** finding: no thousands separators → **BACKLOG BL-0001** | 24,622 |
| 11 | VERIFICATION | qa-engineer | **APPROVE** — all 11 criteria traced; reconciliation identity holds exactly; one **low** finding: finalize this doc's totals at ship → **resolved here** | 33,049 |
| 12 | ARBITRATION | orchestrator | Gate **PASS** (4/4 APPROVE). UX nit → BACKLOG; QA nit → resolved by finalizing this doc. **DONE** | — |

> The four verifier rows share stage `VERIFICATION` but are **four separate turns** with four
> distinct `seq`s (8, 9, 10, 11) — one Agent invocation each. That is the ledger's core invariant:
> **one turn = one invocation**. A rework pass, if one occurs, appends *new* turns; it never
> rewrites recorded ones. Orchestrator-only rows (INTAKE, ROUTE, RECONCILE, ARBITRATION) invoke no
> subagent, so they contribute no `subagent_tokens` and appear as `—`.

---

## Token available after *every* turn

The requirement is "token usage is right and available after every turn, and that you can see
token usage history for these turns." The mechanism that delivers this:

1. Each subagent return ends with a trailing `<usage>subagent_tokens: N</usage>` marker.
2. In the **same per-step write** as the `history` append, the orchestrator pushes one record to
   `token_usage.turns` — `{ seq, actor, stage, subagent_tokens }` — and adds `N` to `total`,
   `by_agent[actor]`, and `by_stage[stage]`.

Because the ledger write is bound to the same step as the history append, the ledger is current
**after every turn**, not reconciled at the end. `token_usage.turns` *is* the history of usage per
turn — readable at any point mid-run via `/maestro-status USAGE-001`. This document literally shows
the running total advancing turn by turn: 29,142 → 54,957 → 97,445 → 125,536 → 151,279 → 175,901 →
**208,950**.

### Graceful null — a missing marker is a null turn, not an error

If a return's `<usage>` marker is missing or malformed, the orchestrator records that turn with
`subagent_tokens: null`, adds **nothing** to the rollups, and continues — no retry, no error, no
stall (the same exit-0 ethos as the audit hook). **In this run all 7 turns reported a valid
marker, so no turn was null.** The behavior is illustrated (not from this run) by:

```json
{ "seq": 8, "actor": "security-engineer", "stage": "VERIFICATION", "subagent_tokens": null }
```

Such a turn still appears in `turns` (history preserved) but is excluded from `total`/`by_agent`/
`by_stage`, and renders as `—` in the status view. The pipeline proceeds unaffected.

### Running-total reconciliation

The ledger keeps three redundant rollups so a human can cross-check it at a glance. For all
**non-null** turns this identity always holds:

```
token_usage.total
  == sum(turn.subagent_tokens for turn in turns if turn is non-null)
  == sum(by_agent values)
  == sum(by_stage values)
```

Worked over the full run:

- turns: `29142 + 25815 + 42488 + 28091 + 25743 + 24622 + 33049` = **208950**
- `by_agent`: `strategist 29142 + principal-engineer 25815 + staff-engineer-implementer 42488 + security-engineer 28091 + code-reviewer 25743 + ux-engineer 24622 + qa-engineer 33049` = **208950**
- `by_stage`: `STRATEGY 29142 + ARCHITECTURE 25815 + IMPLEMENTATION 42488 + VERIFICATION 111505` = **208950**
- `total` = **208950** ✓

All three sums agree with `total`. (Any `null` turn is counted in `turns` but excluded from all
three sums — by construction, never breaking the identity.) QA re-derived this identity
independently in-env with Python.

---

## What `/maestro-status` shows

**Single-task view** — `/maestro-status USAGE-001` (final state):

```
Task USAGE-001 — stage: DONE   retry: 0/3
Verifier votes: code-reviewer APPROVE · security-engineer APPROVE · qa-engineer APPROVE · ux-engineer APPROVE
Active rework reasons: none

Token usage
  Total: 208,950
  By stage: STRATEGY 29,142 · ARCHITECTURE 25,815 · IMPLEMENTATION 42,488 · VERIFICATION 111,505
  By agent: strategist 29,142 · principal-engineer 25,815 · staff-engineer-implementer 42,488
            · security-engineer 28,091 · code-reviewer 25,743 · ux-engineer 24,622 · qa-engineer 33,049

  seq | stage          | agent                       | tokens
  ----+----------------+-----------------------------+-------
    2 | STRATEGY       | strategist                  | 29,142
    4 | ARCHITECTURE   | principal-engineer          | 25,815
    6 | IMPLEMENTATION | staff-engineer-implementer  | 42,488
    8 | VERIFICATION   | security-engineer           | 28,091
    9 | VERIFICATION   | code-reviewer               | 25,743
   10 | VERIFICATION   | ux-engineer                 | 24,622
   11 | VERIFICATION   | qa-engineer                 | 33,049
```

A `null`-usage turn (see above) would render its tokens cell as `—`.

**No-arg listing** — `/maestro-status` (tokens column = each task's `token_usage.total`):

```
task_id     | stage   |  tokens
------------+---------+--------
NOTE-001    | DONE    | —        (pre-USAGE-001 state: no token_usage)
USAGE-001   | DONE    | 208,950

Backlog: 1 item.
```

A task written before this feature has no `token_usage`; the view shows `—` / `n/a` for it and
**never errors**. This is what "additive" buys: old state stays valid and still renders.

> **Resolved (FMT-001):** rendered token counts now use thousands-separator grouping
> (`208,950`, `29,142`); the render samples above reflect it. This was the low-severity UX
> nit that shipped backlogged as **BL-0001** — a display tweak, not a correctness issue.

---

## Final state

`.maestro/tasks/USAGE-001/status.json` (`token_usage`, complete ledger):

```json
{
  "token_usage": {
    "turns": [
      { "seq": 2,  "actor": "strategist",                 "stage": "STRATEGY",       "subagent_tokens": 29142 },
      { "seq": 4,  "actor": "principal-engineer",         "stage": "ARCHITECTURE",   "subagent_tokens": 25815 },
      { "seq": 6,  "actor": "staff-engineer-implementer", "stage": "IMPLEMENTATION", "subagent_tokens": 42488 },
      { "seq": 8,  "actor": "security-engineer",          "stage": "VERIFICATION",   "subagent_tokens": 28091 },
      { "seq": 9,  "actor": "code-reviewer",              "stage": "VERIFICATION",   "subagent_tokens": 25743 },
      { "seq": 10, "actor": "ux-engineer",                "stage": "VERIFICATION",   "subagent_tokens": 24622 },
      { "seq": 11, "actor": "qa-engineer",                "stage": "VERIFICATION",   "subagent_tokens": 33049 }
    ],
    "total": 208950,
    "by_agent": {
      "strategist": 29142, "principal-engineer": 25815, "staff-engineer-implementer": 42488,
      "security-engineer": 28091, "code-reviewer": 25743, "ux-engineer": 24622, "qa-engineer": 33049
    },
    "by_stage": { "STRATEGY": 29142, "ARCHITECTURE": 25815, "IMPLEMENTATION": 42488, "VERIFICATION": 111505 }
  }
}
```

The property is **additive**: it is a new key under root `properties` and is **not** in the schema's
`required` list, so a status file from any earlier run (with no `token_usage`) still validates.

---

## Local-only by design

This ledger is deliberately **local and modest**:

- **No cost or pricing.** It stores raw token counts, not dollars — pricing is model- and
  contract-specific and would rot; a human can multiply by their own rate.
- **No in/out/cache split.** The only signal available is the single `subagent_tokens` scalar per
  return. The ledger records exactly that — no invented breakdown.
- **Not portable machine-to-machine.** Numbers reflect one machine's runs and live under
  `.maestro/` in that repo; they are observability for *this* checkout, not a transferable metric.

That modesty is the point: the feature is **write-only observability**. No decision path —
routing, context assembly, normalization, arbitration, retry, or the verifier gates — ever reads
`token_usage`. It can never change an outcome; it only lets a human see where the tokens went.

---

## Takeaways for an evaluator

- **First run on the installed plugin.** Real `maestro:*` subagents, invoked via the Agent tool,
  each returning a real `subagent_tokens` marker the orchestrator captured live. The numbers above
  are this run's actual cost.
- **The pipeline caught the orchestrator's own bug.** The implementer's honest self-check found a
  stray `note` key that broke the very schema it shipped; the orchestrator reconciled it (seq 7)
  before verification — a verifier-driven fix on the tool itself.
- **Usage is captured per turn, in the same write as history** — right and available *after every
  turn*, not reconciled at the end. `token_usage.turns` is the readable history.
- **One turn = one invocation.** Four verifiers = four records with distinct `seq`s; rework adds
  new turns and never rewrites old ones. Append-only, like `history`.
- **Missing usage is graceful, never fatal.** A malformed/absent `<usage>` marker becomes a `null`
  turn (rendered `—`), contributes nothing to the rollups, pipeline continues. (No null occurred
  this run; behavior shown illustratively.)
- **Three redundant rollups reconcile.** `total == sum(turns) == sum(by_agent) == sum(by_stage)` —
  a built-in cross-check QA re-derived independently.
- **Disposition on a real finding.** A 4/4-approved change still carried a low-severity UX nit; the
  orchestrator **backlogged** it (BL-0001) rather than gold-plate — findings have three fates.

Compare with [run 002](002-path-traversal-rework.md), where a verifier rejection drove a rework
loop; here the change is purely additive instrumentation that passed 4/4, with one nit backlogged.
