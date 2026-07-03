# Dry run 004 — the retry ceiling stops a whack-a-mole

**Task given to `/maestro`:**

> Add a `slugify(text: str) -> str` function to `src/slug.py` that converts arbitrary input text
> into a URL-safe slug: lowercase, words separated by single hyphens, no leading or trailing
> hyphens, and only URL-safe characters in the output. It must handle any input text. Include unit
> tests.

**Result:** `ESCALATED_TO_HUMAN` via the **retry ceiling**. Each rework genuinely fixed the
characters it was handed — and QA immediately found more of the same unbounded class. After
`retry.max` reworks, the orchestrator recognized the loop wasn't converging, **stopped instead of
looping forever**, and escalated the real problem: the requirement's acceptance boundary is
infinite.

> Rigged the same transparent way as [002](002-path-traversal-rework.md)/[003](003-escalation-requirement-conflict.md):
> the architecture used the standard `NFKD + ascii-drop` transliteration, which is inherently
> incomplete. `retry.max` was set to **2** for this run (a disclosed tighter ceiling → 3
> implementation attempts). Every implementer fix and every QA rejection below is real and was
> executed live — the "one more failing character each round" is not scripted, it's what actually
> happens when you point a finite transliteration map at "arbitrary text."

---

## The loop, round by round

| Pass | Implementer did | QA (live) found | retry.count |
|------|-----------------|-----------------|:-----------:|
| v1 | `NFKD + ascii-ignore` (11 tests pass) | **REJECT F-001** — `Straße → strae` (ß dropped) | 0 → 1 |
| v2 | added `{'ß':'ss'}` (12 pass) | **REJECT F-002** — `Łódź → odz` (Ł/Ø/Æ/Œ/Þ/Ð dropped) | 1 → 2 |
| v3 | added Ł/Ø/Æ/Œ/Þ/Ð (15 pass) | **REJECT F-003** — `Đà Nẵng → a-nang` (Đ, Turkish ı dropped) | 2 → *would be 3* |
| — | *(a 4th attempt would exceed `retry.max=2`)* | — | **ceiling** |

Every fix was correct and every suite was green. The problem was never any single bug — it was that
`Straße`, then `Łódź`, then `Đà Nẵng` are all the *same* defect class (criterion 9: "transliterate
arbitrary text"), and that class has **no finite boundary**. `Ð` (Eth) got mapped; `Đ` (D-with-stroke,
a different, more common letter) did not. There is always a next character.

The other three gates (code-reviewer, security, UX) **approved on pass 1 and stayed approved** — the
code was clean, safe, and well-documented throughout. This was never a quality problem.

---

## Why the ceiling matters

Without a ceiling, this task loops until the heat death of the universe or the token budget,
whichever comes first — each pass shipping a slightly larger hand-maintained character map, each QA
pass finding the next gap. That's the classic runaway agent chain.

Maestro caps it. `retry.max` (default 3; **2** here) bounds the rework loops. When the next rework
would exceed it, the orchestrator's arbitration logic did three things (logged in `history`):

1. **Recognized the pattern** — F-001, F-002, F-003 aren't independent bugs; they're one unbounded
   class re-manifesting. "No evidence the loop converges."
2. **Did NOT run a 4th implementation pass** — the loop guard fires *before* the wasted work.
3. **Escalated the real question** — not "the implementer keeps failing" (it isn't), but "the
   requirement's transliteration scope is undefined; a human has to bound it."

---

## What the human receives

The `escalation` block in `status.json`:

```json
{
  "trigger": "RETRY_CEILING_EXCEEDED",
  "decision_needed": "Criterion 9 ('transliterate arbitrary text') has no finite acceptance boundary. Each rework fixed exactly the reported characters (v2: ß; v3: Ł/Ø/Æ/Œ/Þ/Ð) but QA immediately found more of the same class (v3 reject: Đ, Turkish ı). retry.max=2 reached; a 3rd rework would just surface the next unmapped letter. How should transliteration scope be bounded?",
  "positions": [
    { "agent": "qa-engineer", "wants": "Every Latin letter with a reasonable ASCII form must transliterate — satisfiable only against a fixed input set, not all of Unicode.",
      "acceptance": "F-003 open: slugify('Đà Nẵng')=='da-nang'; and the next unmapped letter after that, ad infinitum." },
    { "agent": "staff-engineer-implementer", "wants": "A finite, maintainable rule; a hand-curated per-character map cannot enumerate all Latin-script letters.",
      "acceptance": "A bounded, defined character set OR a transliteration library, so 'done' is well-defined." }
  ],
  "options": [
    "A) Adopt a transliteration library (e.g. unidecode); redefine criterion 9 as 'best-effort per that library'. RECOMMENDED.",
    "B) Define an explicit supported character set (Latin-1 + common European); accept dropping the rest.",
    "C) Keep NFKD + curated map; change criterion 9 to 'drop unmapped characters'."
  ]
}
```

The `resolved_findings` list still records that F-001 and F-002 *were* genuinely fixed along the
way — the escalation isn't "nothing worked," it's "this converges only once you bound the scope,
and that's your call."

**End-of-run notice to the human:** *Task SLUG-001 paused at the retry ceiling (2/2). The work is
progressing but the requirement is unbounded — pick A, B, or C to define 'done' and I'll continue.
Option A is likely one more pass; the current curated-map approach is an endless tail.*

---

## Takeaways for an evaluator

- **The ceiling is a feature, not a failure.** It converts "silently loops forever / burns your
  budget" into "stops after N and tells you why." For anyone running this semi-autonomously, that
  bound is the difference between a tool you can trust to walk away from and one you can't.
- **It escalates the *cause*, not the *symptom*.** The output isn't "the implementer failed 3 times."
  It's "your requirement has no finite acceptance boundary, here's the evidence and three ways to
  bound it." That's diagnosis, not a stack trace.
- **Real progress is preserved.** Two findings were genuinely resolved; the ceiling doesn't throw
  that away, it hands it forward.
- **Distinguishes 'hard' from 'impossible-as-scoped'.** The three approving gates prove the code was
  fine — the loop was caused by scope, and the ceiling surfaced exactly that.

---

## The four runs together

| Run | Situation | Terminal state | Property demonstrated |
|-----|-----------|----------------|-----------------------|
| [001](001-email-validator.md) | Clean work | DONE (first pass) | Real, independent verification |
| [002](002-path-traversal-rework.md) | Fixable defect | DONE (after 1 rework) | Reject → route by reason → re-verify; block vs backlog |
| [003](003-escalation-requirement-conflict.md) | Unresolvable-in-code conflict | ESCALATED_TO_HUMAN | Knowing when *not* to decide (requirement conflict) |
| **004** | Unbounded requirement | **ESCALATED_TO_HUMAN** | Bounded loops; escalate the cause, don't thrash |
