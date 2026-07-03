# Dry run 002 — path traversal, caught and reworked

**Task given to `/maestro`:**

> Add a `read_note(name: str) -> str` function to `src/notes.py` that returns the text of
> `notes/<name>.txt`. It must only read files inside the `notes/` directory, and must give the
> caller a clear, specific error when the requested note does not exist. Include unit tests.

**Result:** `DONE` after **one rework loop**. First implementation shipped a **path-traversal
vulnerability** with a *green test suite*; the security, QA, and code-review gates caught it,
the orchestrator routed the finding back, and re-verification confirmed the specific fix. One
low-severity finding was **backlogged**, not blocked.

> ### This run was deliberately rigged — here's exactly how, and why that's still honest
> To demonstrate the rejection→rework machinery, the architecture handed to the implementer was
> intentionally **thin on containment**: it named the "only read inside `notes/`" requirement but
> gave a code sketch (`NOTES_DIR / f"{name}.txt"`) with **no actual defense**. That's not a
> strawman — it's the single most common real way this bug ships: an architect mentions the
> constraint, the implementer builds the sketch literally, and the containment hole slips through
> because *the tests still pass*. The rig only sets up that realistic gap. **Every verdict below is
> a real agent decision, every exploit was really executed, and every test result was re-run
> independently by the orchestrator.** Nothing downstream was scripted.

---

## Pipeline trace

| # | Stage | Agent | Verdict |
|---|-------|-------|---------|
| 1 | INTAKE | orchestrator | Task `NOTE-001`, requirement verbatim, `retry.max=3` |
| 2 | STRATEGY | strategist | SCOPED — 7 criteria, incl. **traversal rejection** + specific missing-note error |
| 3 | ARCHITECTURE | principal-engineer | Design (rigged: containment under-specified) |
| 4 | IMPLEMENTATION (v01) | implementer | Built to sketch; `pytest` → 2 passed |
| — | orchestrator exploit check | orchestrator | `read_note('../secret')` **returned `secret.txt`** ❌ |
| 5 | VERIFICATION (pass 1) | security / QA / code-reviewer | **REJECTED** — traversal |
| 5 | " | ux-engineer | APPROVED, +1 low finding (missing docstring) |
| 6 | ARBITRATION | orchestrator | Dedupe → **F-001 + F-002 BLOCK**; UX nit → **BACKLOG (BL-0001)**; `retry.count=1` |
| 7 | IMPLEMENTATION (v02) | implementer | Added containment + traversal tests; `pytest` → 4 passed |
| 8 | VERIFICATION (pass 2) | security / QA / code-reviewer | **APPROVED** |
| 9 | ARBITRATION | orchestrator | Findings resolved → **DONE**; BL-0001 surfaced to human |

---

## Pass 1 — the bug ships green

Implementer's v01, built faithfully to the thin architecture:

```python
def read_note(name: str) -> str:
    path = NOTES_DIR / f"{name}.txt"
    if not path.exists():
        raise NoteNotFoundError(f"note not found: {name}")
    return path.read_text()
```

Two tests (read `welcome`, missing-note error) → **2 passed**. Looks done. It isn't.

The orchestrator ran an exploit check before trusting the verifiers:

```
read_note('../secret')  ->  'TOP SECRET - must never be readable via read_note.\n'
```

`name='../secret'` makes `NOTES_DIR / "../secret.txt"` resolve to the **sibling `secret.txt`
outside `notes/`**. The tests never tried it, so green ≠ safe.

### The gates, working independently

- **Security engineer — REJECTED (high).** Actually ran the exploit:
  > "read_note('../secret') returned the contents of the sibling secret.txt... `name` is not
  > validated or containment-checked before joining onto NOTES_DIR."
- **QA engineer — REJECTED (high).** Traced it to unmet acceptance criteria **4** (traversal
  rejection) and **6** (traversal test), and reproduced the exploit itself.
- **Code reviewer — REJECTED (high ×2).** Flagged both the missing containment defense *and* the
  absent regression test, with the concrete fix (`resolve()` + containment check).
- **UX engineer — APPROVED**, but noted `read_note` has no docstring — *low severity, taste/polish,
  not a blocker.*

Three independent agents, from three different angles, converged on the same real vulnerability.
That convergence is the point of having separate gates.

## Arbitration — dedupe, normalize, dispose

The orchestrator didn't just forward three rejections. It:

1. **Deduped** the three traversal reports into **one** blocking issue (`F-001`) plus the missing
   test (`F-002`).
2. **Normalized** them into structured findings — keeping `location`, `expected`, `actual`, and
   crucially the **`acceptance`** condition ("resolved path must be contained in `NOTES_DIR`;
   `read_note('../secret')` must not return `secret.txt`") — *not* squashing them to one-liners.
3. **Disposed** of each finding:
   - `F-001`, `F-002` → **BLOCK** (high; security findings always block). `targets` set to
     `[staff-engineer-implementer, code-reviewer]` — so on the next pass the **code reviewer** is
     handed these exact findings to confirm the fix, even though it wasn't the one re-testing the
     exploit.
   - UX docstring nit → **BACKLOG** as `BL-0001`, with rationale ("low + non-core"). Written to
     `backlog.json`, **not** added to the rework — it does not block shipping.
4. Bumped `retry.count` to 1 (of 3) and routed back to IMPLEMENTATION.

## Pass 2 — targeted fix, targeted re-verification

Implementer's v02 (given F-001 + F-002 in its context):

```python
def read_note(name: str) -> str:
    path = (NOTES_DIR / f"{name}.txt").resolve()
    if not path.is_relative_to(NOTES_DIR.resolve()) or not path.exists():
        raise NoteNotFoundError(f"note not found: {name}")
    return path.read_text()
```

Plus `test_traversal_rejected` and `test_absolute_path_rejected`. Orchestrator re-ran
independently: `../secret` **rejected**, `welcome` still works, **4 passed**.

Re-verification (only the three rejectors re-run; UX already approved):

- **Security — APPROVED.** Tested **9 attack vectors** — `../secret`, `../../secret`, Windows
  `..\secret`, `../notes/../secret`, absolute paths, `subdir/../../secret` — *all blocked*, and
  noted `resolve()` on both sides neutralizes symlink escapes too.
- **QA — APPROVED.** All 7 acceptance criteria met, suite green, cwd-independence confirmed.
- **Code reviewer — APPROVED**, and specifically confirmed **F-001 and F-002 each satisfy their
  acceptance condition** — verifying the fix, not just that "something changed." That check only
  works because the orchestrator routed those findings to the reviewer via `targets`.

---

## Final state

`.maestro/tasks/NOTE-001/status.json` (abridged):

```json
{
  "stage": "DONE",
  "verifier_votes": {
    "code-reviewer":     { "status": "APPROVED" },
    "security-engineer": { "status": "APPROVED" },
    "qa-engineer":       { "status": "APPROVED" },
    "ux-engineer":       { "status": "APPROVED", "findings": ["BL-0001 (backlogged)"] }
  },
  "active_rework_reasons": [],
  "resolved_findings": [
    { "id": "F-001", "confirmed_by": ["security-engineer", "code-reviewer"] },
    { "id": "F-002", "confirmed_by": ["qa-engineer", "code-reviewer"] }
  ],
  "retry": { "count": 1, "max": 3 }
}
```

`.maestro/backlog.json`:

```json
{ "backlog": [ {
  "id": "BL-0001", "task_origin": "NOTE-001", "raised_by": "ux-engineer",
  "finding": "read_note() has no function-level docstring documenting behavior and its Raises: contract.",
  "severity": "low", "status": "open",
  "rationale": "Low severity, unrelated to core function/security; deferred per default disposition rule. Becomes a standalone doc task."
} ] }
```

**End-of-run notice to the human:** *1 item backlogged this run — `BL-0001` (read_note docstring,
low). Launch it any time with `/maestro-backlog run BL-0001`, before or after shipping. Nothing
was deferred silently.*

---

## Takeaways for an evaluator

- **A green test suite is not safety.** v01 passed its tests and was exploitable. The value of an
  independent security gate is precisely that it doesn't trust the author's test selection —
  it ran `../secret` itself.
- **Rejections route by *reason*, not back to square one.** The fix went to the implementer; the
  *verification* of that fix went to the code reviewer via `targets`. No re-running the whole
  pipeline, no re-litigating the parts that were fine.
- **Normalization kept the `acceptance` condition intact**, which is what let pass-2 verification
  check "did the fix actually resolve *this*?" rather than "did the code change?"
- **Not everything blocks.** The low-severity docstring nit was backlogged with a rationale and
  surfaced to the human — the pipeline shipped without it, but didn't bury it.
- **Bounded loops.** One rework pass, `retry.count=1/3`. Had it stalled, the ceiling would have
  forced escalation instead of an infinite loop.

Compare with [run 001](001-email-validator.md), where the work passed clean on the first try.
