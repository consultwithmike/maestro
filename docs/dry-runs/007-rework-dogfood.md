# Dry run 007 — a rework loop, dogfooded on the installed plugin

**Task given to `/maestro-backlog`:**

> run BL-0001

**Result:** `DONE` after **1 rework loop**. This run was launched from a **backlog item** the
previous run ([006](006-token-accounting.md)) deferred rather than fixed — BL-0001, a low-severity
UX nit that token counts rendered as bare digits (`208950`) instead of grouped (`208,950`). Running
it re-scoped that finding as its own task (**FMT-001**, `task_origin = BL-0001`), took it through
the full pipeline, hit a **verifier-driven rework loop**, cleared it with **curated
re-verification**, shipped, and marked the backlog item `resolved`. Total cost: **174,435 tokens
across 10 subagent turns** — the second run to dogfood the [token ledger](006-token-accounting.md).

> ### Why this run exists
> [Run 002](002-path-traversal-rework.md) demonstrated the reject→rework→re-verify loop, but as a
> *simulation* (driven manually through general-purpose agents). Run 007 is the **same machinery on
> the real installed plugin** — `maestro:*` subagents spawned via the Agent tool — and it shows two
> things 002 could not: (1) a rework loop triggered by **low-severity findings on an
> already-passing (4/4 APPROVE) change**, disposed as a tight polish loop rather than a block; and
> (2) **curated re-verification**, where only the two verifiers who raised findings re-check their
> own findings — the other two are not re-run, because their domains didn't change. It also closes
> the full backlog lifecycle: **backlog → re-scope → build → verify → rework → re-verify → ship →
> resolved.**

---

## Pipeline trace

| # (seq) | Stage | Agent | Verdict / action | Tokens |
|---|-------|-------|------------------|-------:|
| 1 | INTAKE | orchestrator | Task `FMT-001` from backlog `BL-0001`; finding + acceptance carried into the requirement verbatim; `retry.max=3` | — |
| 2 | STRATEGY | strategist | **SCOPED** — 7 criteria; comma grouping for *rendered* counts only; schema/template + raw JSON data blocks explicitly out of scope | 8,692 |
| 3 | ROUTE | orchestrator | Recorded strategist turn; route to ARCHITECTURE | — |
| 4 | ARCHITECTURE | principal-engineer | Design: exact insert wording for `maestro-status.md`; regroup the 006 render samples; a precise DO-NOT-TOUCH list (schema, template, raw JSON, arithmetic proofs, unrelated 002/005 mentions) + a grep verification step | 15,799 |
| 5 | ROUTE | orchestrator | Recorded principal turn (cumulative 24,491); route to IMPLEMENTATION | — |
| 6 | IMPLEMENTATION | staff-engineer-implementer | Edited 2 files; grouped both views + 006 samples; grep-verified bare digits remain only in JSON + arithmetic; both 006 JSON fences still parse | 32,999 |
| 7 | ROUTE | orchestrator | Recorded implementer turn (cumulative 57,490); route to VERIFICATION — 4 verifiers in parallel | — |
| 8 | VERIFICATION | security-engineer | **APPROVE** — pure markdown/doc change; JSON blocks stay valid bare integers; no executable surface | 16,732 |
| 9 | VERIFICATION | code-reviewer | **APPROVE** — grouping correct + deterministic; grep-proved; BL-0001 callout resolved not deleted. **1 low finding (F-CR-1):** splice artifact `stays —, — then` at `maestro-status.md:25` | 21,552 |
| 10 | VERIFICATION | qa-engineer | **APPROVE** — all 7 criteria traced; `git status` = only 2 in-scope files changed | 18,505 |
| 11 | VERIFICATION | ux-engineer | **APPROVE** — fix delivered, `208,950` scannable. **1 low finding (F-UX-1):** grouped value overhangs its dash rule by 1 char in the 006 no-arg sample | 19,440 |
| 12 | ARBITRATION | orchestrator | Gate **PASS 4/4 APPROVE**. Two low mechanical nits, both targeting the implementer → one tight polish rework (`retry 1/3`); do **not** re-run the whole gate | — |
| 13 | REWORK | staff-engineer-implementer | Fixed F-CR-1 (removed the duplicated em-dash) and F-UX-1 (widened the no-arg tokens column to 8 dashes so `208,950` sits flush); JSON re-parsed | 21,788 |
| 14 | ROUTE | orchestrator | Curated re-verify: **only the two finding-owners** (code-reviewer, ux-engineer). Security + QA domains unchanged → not re-run | — |
| 15 | VERIFICATION (re-verify) | code-reviewer | **APPROVE** — F-CR-1 resolved; sentence clean, grouping + read-only intact | 6,807 |
| 16 | VERIFICATION (re-verify) | ux-engineer | **APPROVE** — F-UX-1 resolved; header, dash rule, and `208,950` right edges all align at column 31 | 12,121 |
| 17 | ARBITRATION | orchestrator | Both findings **RESOLVED** + re-verified. Gate **re-PASS**. `BL-0001` → `resolved`. **DONE** | — |

> Ten of the seventeen rows are subagent **turns** (they carry `subagent_tokens`); the other seven
> are orchestrator-only steps (INTAKE / ROUTE / ARBITRATION) that spawn no subagent and cost no
> tokens. The rework (seq 13) and the two re-verifies (seq 15–16) are **new turns appended** to the
> ledger — nothing is overwritten.

---

## The rework loop — a passing change still got polished

The gate **passed 4/4 on the first verification round.** Both findings were `low` severity: a
cosmetic prose artifact and a one-character table misalignment. Neither blocked the requirement.

So why loop at all? Because both were (a) genuine quality defects in *this task's own
deliverables* and (b) **cheap and mechanical** — and both `target`ed the same agent (the
implementer). The orchestrator routed them back as **one tight polish pass** rather than blocking,
dismissing, or backlogging them. This is the disposition machinery choosing the proportionate
response: not every finding is a BLOCK, and not every non-blocking finding is a BACKLOG.

Contrast with the sibling runs:
- [Run 002](002-path-traversal-rework.md): a **high**-severity **REJECT** forced the loop.
- [Run 006](006-token-accounting.md): the same class of low UX nit was **backlogged** (BL-0001)
  because the run's scope was already large — deferring was the proportionate call there.
- Run 007: the low nits were fixed **in-loop** because they were trivial and the change was
  otherwise done. Same finding type, three different dispositions — driven by context, not a rule.

### Curated re-verification (the part that saves tokens)

After the rework, the orchestrator did **not** re-run all four verifiers. Only the two who raised
findings re-checked their own:

| Re-verify turn | Full first-pass review | Scoped re-check | Saving |
|---|--:|--:|--:|
| code-reviewer (F-CR-1) | 21,552 | **6,807** | ~68% |
| ux-engineer (F-UX-1) | 19,440 | **12,121** | ~38% |

Security and QA were **not re-invoked** — the rework touched only wording and table padding, which
is outside their domains (no new attack surface, no acceptance-criterion changed). This is the same
**curated-context** principle the pipeline uses on the forward path — an agent sees only what's on
its whitelist plus the findings that `target` it — applied to re-verification: re-check only what
actually changed. Re-running the full gate would have cost roughly another ~40k tokens for zero
added assurance.

---

## Token ledger — final state

`.maestro/tasks/FMT-001/status.json` (`token_usage`), reconciled:

```json
{
  "token_usage": {
    "turns": [
      { "seq": 2,  "actor": "strategist",                 "stage": "STRATEGY",       "subagent_tokens": 8692 },
      { "seq": 4,  "actor": "principal-engineer",         "stage": "ARCHITECTURE",   "subagent_tokens": 15799 },
      { "seq": 6,  "actor": "staff-engineer-implementer", "stage": "IMPLEMENTATION", "subagent_tokens": 32999 },
      { "seq": 8,  "actor": "security-engineer",          "stage": "VERIFICATION",   "subagent_tokens": 16732 },
      { "seq": 9,  "actor": "code-reviewer",              "stage": "VERIFICATION",   "subagent_tokens": 21552 },
      { "seq": 10, "actor": "qa-engineer",                "stage": "VERIFICATION",   "subagent_tokens": 18505 },
      { "seq": 11, "actor": "ux-engineer",                "stage": "VERIFICATION",   "subagent_tokens": 19440 },
      { "seq": 13, "actor": "staff-engineer-implementer", "stage": "REWORK",         "subagent_tokens": 21788 },
      { "seq": 15, "actor": "code-reviewer",              "stage": "VERIFICATION",   "subagent_tokens": 6807 },
      { "seq": 16, "actor": "ux-engineer",                "stage": "VERIFICATION",   "subagent_tokens": 12121 }
    ],
    "total": 174435,
    "by_agent": {
      "strategist": 8692, "principal-engineer": 15799, "staff-engineer-implementer": 54787,
      "security-engineer": 16732, "code-reviewer": 28359, "qa-engineer": 18505, "ux-engineer": 31561
    },
    "by_stage": { "STRATEGY": 8692, "ARCHITECTURE": 15799, "IMPLEMENTATION": 32999, "VERIFICATION": 95157, "REWORK": 21788 }
  }
}
```

The identity holds: `total == Σ turns == Σ by_agent == Σ by_stage == 174,435`. Note the two agents
who ran twice (`staff-engineer-implementer` = 32,999 + 21,788; `code-reviewer` = 21,552 + 6,807;
`ux-engineer` = 19,440 + 12,121) — the ledger attributes **every** invocation, including rework and
re-verify, so `by_agent` is a true per-role cost, not a per-stage one.

What a rework costs, made legible: the loop (seq 13 REWORK + seq 15–16 re-verify) added **40,716
tokens** — about 23% of the run. That's the price of the fix-and-confirm cycle, and it's now a line
item an operator can see instead of a mystery.

---

## Backlog lifecycle closed

`/maestro-backlog list` before and after:

```
BEFORE (post-006):  [BL-0001] LOW · open      · from USAGE-001   (1 open item)
AFTER  (post-007):  [BL-0001] LOW · resolved  · from USAGE-001   (0 open items)
```

The item was never silently dropped and never auto-re-entered a run: it sat in the backlog until a
human ran `/maestro-backlog run BL-0001`, at which point it became a deliberate, fully-verified new
task carrying its original `finding` and `acceptance` forward.

---

## Takeaways for an evaluator

- **A rework loop is not only for rejects.** The gate passed 4/4; the orchestrator still ran a
  tight polish loop for two low nits because they were cheap and belonged to this task. Disposition
  is proportionate, not binary.
- **Curated re-verification is real and measurable.** Only the two finding-owners re-checked their
  own findings (6,807 and 12,121 tokens — a third to two-thirds of a full review); security and QA
  weren't re-run because nothing in their domain changed. Same curated-context discipline as the
  forward path.
- **The retry ceiling held with room to spare.** `retry 1/3` — the loop closed on the first rework,
  exactly the bounded behavior [run 004](004-retry-ceiling.md) stress-tests at the limit.
- **The token ledger attributes rework honestly.** Agents that ran twice show summed `by_agent`
  costs; the loop's 40,716-token cost is a visible line item, not hidden overhead.
- **Full backlog lifecycle, on the installed plugin.** backlog → re-scope → build → verify →
  rework → re-verify → ship → `resolved`. The deferred nit from run 006 was closed here, by the
  same tool, dogfooded end to end.
