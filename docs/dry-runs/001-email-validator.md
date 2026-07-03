# Dry run 001 — email validator (happy path)

**Task given to `/maestro`:**

> Add an `is_valid_email(email: str) -> bool` function to `src/validators.py`, with unit tests
> covering valid and invalid cases.

**Result:** `DONE` on the first pass. Four independent verifiers all approved. No rework, nothing
backlogged. Total: 6 agent invocations (strategist, principal, implementer, + 4 verifiers).

> Read [how these runs were produced](README.md#how-these-runs-were-produced-read-this-first)
> before trusting the transcript. Short version: real agent prompts + real state schema, driven
> by the real orchestrator rules; test output re-run independently.

---

## Pipeline trace

| # | Stage | Agent | Verdict |
|---|-------|-------|---------|
| 1 | INTAKE | orchestrator | Task `EMAIL-001` created, requirement stored verbatim, `retry.max=3` |
| 2 | STRATEGY | strategist | **SCOPED** — normalized requirement + **12 acceptance criteria** |
| 3 | ARCHITECTURE | principal-engineer | Design delivered; **flagged two bug-classes before any code was written** |
| 4 | IMPLEMENTATION | staff-engineer-implementer | Code + tests written; `pytest` → **15 passed** |
| 5 | VERIFICATION | code-reviewer / security / QA / UX (parallel) | **APPROVED × 4, zero findings** |
| 6 | ARBITRATION | orchestrator | Nothing to block/backlog/dismiss → **SHIP** |

---

## What each agent actually did

### Strategist → `SCOPED`
Turned a one-line ask into a testable contract: exact signature, "syntax-only" scope, explicit
**out-of-scope** list (DNS/MX, normalization, full RFC 5322, IDN), and **12 acceptance criteria**
including the specific rejects `@example.com`, `user@`, `""`, `us er@example.com`, `a@b@example.com`.

### Principal engineer → design + risk flags
Chose the smallest design (one compiled regex + an `isinstance` guard, stdlib only) and — before
a line of implementation — flagged two traps that routinely slip through:

1. **Trailing-newline hole:** Python's `$` matches before a final `\n`, so `"user@example.com\n"`
   would wrongly pass with `re.match`. Mandated `re.fullmatch`.
2. **Real-`bool` contract:** `re.match` returns `Match`/`None`, not `bool`; mandated `bool(...)`
   coercion and a `type(...) is bool` test.

It also explicitly told the implementer **not** to add complexity to reject `a..b@example.com` —
out of scope, and doing so risks regressing the required `first.last+tag@sub.example.co.uk`.

### Implementer → code + tests, green
Final `src/validators.py`:

```python
"""Validation helpers."""

import re

# Syntax-only email pattern: <local>@<domain>.<tld> with no whitespace or
# extra "@" anywhere. Non-goal: we intentionally do NOT reject consecutive
# dots (e.g. "a..b@example.com").
_EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s.]+")


def is_valid_email(email: str) -> bool:
    """Return True if ``email`` is syntactically a plausible email address. ..."""
    if not isinstance(email, str):
        return False
    return bool(_EMAIL_RE.fullmatch(email))
```

15-test pytest suite: parametrized valid/invalid cases, `type(...) is bool`, non-str→False
(no raise), trailing-newline rejected.

### Verifiers → the part that separates this from a single-shot agent

All four ran **in parallel**, each with only its whitelisted context, and none rubber-stamped:

- **Security engineer** didn't just eyeball the regex — it **empirically load-tested it for ReDoS**:
  > "Runtime scales strictly linearly with input length (100 KB → ~5 ms)... No exponential or
  > quadratic blowup... the two quantified classes are separated by hard, single-character anchors."

  Verdict: **APPROVED**, ReDoS-safe.
- **QA engineer** **re-ran the suite itself** (`py -3 -m pytest -q` → 15 passed) and verified the
  signature via `inspect` rather than trusting the implementer. **APPROVED**.
- **Code reviewer** confirmed requirement fulfillment, KISS, no silent failures. **APPROVED**.
- **UX engineer** (treating the calling developer as "the user") checked API clarity, naming, and
  that the docstring scopes its non-goals so callers don't over-trust it. **APPROVED**.

### Orchestrator → arbitration
Four APPROVED, zero findings → no BLOCK/BACKLOG/DISMISS, `retry.count` stayed 0, `stage=DONE`.

---

## Final state (`.maestro/tasks/EMAIL-001/status.json`, abridged)

```json
{
  "task_id": "EMAIL-001",
  "stage": "DONE",
  "refs": {
    "requirement_ref": "requirement.md",
    "architecture_ref": "architecture.md",
    "current_diff_ref": "diff-v01.md"
  },
  "verifier_votes": {
    "code-reviewer":     { "status": "APPROVED", "findings": [] },
    "security-engineer": { "status": "APPROVED", "findings": [] },
    "qa-engineer":       { "status": "APPROVED", "findings": [] },
    "ux-engineer":       { "status": "APPROVED", "findings": [] }
  },
  "retry": { "count": 0, "max": 3 },
  "history": [ "... 13 append-only steps: every route, verdict, and the ship decision ..." ]
}
```

---

## Takeaways for an evaluator

- **The gates are real work, not theater.** Security fuzzed the regex; QA re-executed the tests.
  That's the value proposition — verification independent of the thing that wrote the code.
- **Failure-prone details were caught *upstream*.** The architect pre-empted the newline and
  `bool` traps, and the tests locked them in — cheaper than catching them in review.
- **Cost is honest:** 6 agent calls for a trivial task. Maestro is for changes worth gating, and
  the design caps worst-case cost with a retry ceiling and parallel verification.
- This run never exercised the **rework loop** — it passed clean. See
  [run 002](002-path-traversal-rework.md) for a rejection and recovery.
