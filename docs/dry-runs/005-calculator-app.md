# Dry run 005 — building something real (a Windows-style calculator)

**Task given to `/maestro`:**

> Build a visual calculator app, like the Windows Calculator.

**Result:** `DONE`. A self-contained, working **Windows 11-style Standard calculator** (single
`calculator.html`, no external dependencies) — correct immediate-execution math, keyboard support,
memory keys, light/dark theming, **28/28 golden-vector tests green**, verified by all four gates.
Delivered after a **2-turn strategist↔principal collaboration** and **one UX rework loop**. Three
genuinely-deferred items were backlogged, not blocked.

**The delivered app is in this repo:** [`artifacts/005-calculator.html`](artifacts/005-calculator.html)
— a single self-contained file; open it in any browser to use it. (Source engine:
[`artifacts/005-calculator.engine.js`](artifacts/005-calculator.engine.js); tests:
[`artifacts/005-test_engine.js`](artifacts/005-test_engine.js), run `node 005-test_engine.js` after
placing the engine alongside it.)

This run is different from 001–004: it's not a single function, it's a real app with a UI. It's
here to show the pipeline handling **scope negotiation, a substantial build, headless testing of
UI-adjacent logic, and visual-fidelity review** — the parts of real delivery the small runs don't
exercise. (Same production method as the others — see the [index](README.md#how-these-runs-were-produced-read-this-first).
The build, tests, and every verdict are real; test output was re-run independently.)

---

## What made this one hard: a one-line requirement

"Build a visual calculator app, like the Windows Calculator" hides a dozen product decisions
(Standard vs Scientific? memory? keyboard? history? theming? which % semantics?). A single-shot
agent picks answers silently and hopes. Maestro **negotiated them**.

### Turn 1 — strategist scopes, makes decisions *explicit*
The strategist returned a scoped v1 with **8 named product decisions** (Standard-only, single-register
memory, keyboard in, history out, light+dark Win-11 look, web SPA, immediate-execution math, inline
errors) and 17 acceptance criteria — each decision stated *so the team could challenge it*.

### Turn 1 (principal) — the architect pushes back
Instead of just building, the principal engineer **reviewed and returned 4 questions**:
- Match Windows's *unusual* % semantics exactly (`100+10%=110`, `200×10%=20`)?
- Exact display/precision limits (sig-digits, exponential threshold)?
- Memory scope — core register only, history panel out?
- Which keyboard bindings; clipboard in or out?

It also committed the **load-bearing engineering decision**: a **DOM-free `CalculatorEngine`** split
from the UI, so the math can be **unit-tested headlessly** — and proposed a **golden-vector table**
as the executable contract.

### Turn 2 — orchestrator mediates, strategist resolves
The orchestrator routed those product questions **back to the strategist** (they're product calls,
not the engineer's to make). The strategist resolved all four — Windows-exact % with the specific
value table, 16-sig-digit round-half-away display, single-register memory, a defined keyboard set —
added 6 acceptance criteria, and **approved the golden-vector contract**. Requirement converged.

> This is the collaboration the task asked to see: not a linear hand-off, but strategist ⇄ principal
> iterating through the orchestrator until scope and approach were settled *before a line of UI was
> written*.

---

## The build

Final architecture (principal, turn 2): a pure immediate-execution **state machine** (no operator
precedence — that's what makes it behave like Windows Standard), a display projection that rounds to
16 sig-digits *only at the display boundary* (so `0.1 + 0.2 = 0.3` while chained ops stay
full-precision), latched error states, a Windows-11 button grid, CSS-variable theming, and a
**28-row golden-vector table** covering every % context, error + recovery, unary ops, and the full
memory lifecycle.

The implementer delivered three files:
- `src/calculator.engine.js` — DOM-free engine (Node-`require`-able **and** browser global).
- `calculator.html` — self-contained: inline CSS + the engine **inlined byte-identical** + a thin UI
  that maps clicks *and* keyboard to engine tokens.
- `tests/test_engine.js` — headless golden-vector runner.

**28/28 golden vectors passed** on the first build. The implementer also made a documented judgment
call — using `Number(x.toPrecision(16))` instead of the spec's raw `floor(v*10^dp+0.5)`, because the
raw multiply produced a 16th-digit float artifact that rendered `0.1+0.2` as `0.3000000000000001`.

---

## Verification — three clean approvals, one sharp UX rejection

- **QA — APPROVED.** Ran the 28 vectors *and* a **20,000-sequence fuzz** (0 crashes, display always a
  string). Flagged 2 *out-of-scope* Windows-fidelity gaps (digit-after-unary entry reset; overflow
  latching) — correctly not treated as acceptance failures.
- **Security — APPROVED.** Confirmed the calculator avoids the classic `eval()` anti-pattern (math via
  a `switch`), writes the display via `textContent` only (no DOM XSS), is fully self-contained, and
  has a whitelisted keyboard handler.
- **Code reviewer — APPROVED.** Engine truly DOM-free, UI a thin mapping with no duplicated logic,
  inlined engine `diff`-identical to source, tests meaningful.
- **UX — REJECTED**, 4 findings:
  - **F-001 (medium):** M+/M− were disabled on empty memory — Windows keeps them enabled (only MC/MR
    gray out). A real fidelity bug, and the engine already supported it.
  - **F-002 (low):** digit vs operator key contrast almost imperceptible in light mode.
  - **F-003 (low):** a dead, permanently-disabled `M˅` placeholder duplicating MR's token.
  - **F-004 (low):** `aria-label="Result"` on the live region could shadow the changing value for
    screen readers.

### Arbitration — block the fidelity fixes, backlog the deferred features
The orchestrator **BLOCKED all four** UX findings (each cheap and each improving the core "like
Windows" goal), and **BACKLOGGED** what was genuinely out of v1 scope:
- `BL-0001` — the memory-list **flyout** (the real feature the `M˅` placeholder gestured at; the
  strategist had scoped memory to a single register).
- `BL-0002` — digit-after-unary entry reset (QA's fidelity observation).
- `BL-0003` — overflow error latching (QA's observation).

Only UX re-verified next pass (the other three had approved).

---

## Rework and ship

The implementer fixed all four (HTML/CSS/UI only — no engine change; golden vectors stayed 28/28;
inlined engine stayed byte-identical). Independently re-verified: `5 M+` on fresh memory now recalls
`5` (the Windows behavior). **UX re-verified → APPROVED**, no regressions. `stage = DONE` after one
rework loop, `retry.count = 1/3`.

Final state:

```json
{
  "stage": "DONE",
  "verifier_votes": { "qa": "APPROVED", "security": "APPROVED", "code-reviewer": "APPROVED", "ux": "APPROVED" },
  "resolved_findings": ["F-001","F-002","F-003","F-004"],
  "retry": { "count": 1, "max": 3 },
  "collaboration_log": [ "strategist→principal (t1)", "principal→strategist: 4 questions", "strategist→principal (t2): resolved + golden vectors" ]
}
```

**End-of-run notice to the human:** *Delivered `calculator.html` — self-contained, Windows-11
Standard, 28/28 tests, works by mouse and keyboard, light/dark. 3 items backlogged for post-v1
(memory flyout, digit-after-unary reset, overflow latch) — launch any with `/maestro-backlog run
BL-000x`.* During the run the result was also published as an interactive artifact so the calculator
could be used in-browser immediately.

---

## Takeaways for an evaluator

- **Scope negotiation is a first-class stage.** The most valuable work here happened *before* coding:
  the strategist↔principal loop turned a 9-word request into a settled, testable contract. That's the
  difference between "an agent built *a* calculator" and "the team built *the* calculator you meant."
- **The engine/UI split is what made a UI app testable.** Pulling the math into a DOM-free engine gave
  QA a headless, fuzzable surface — 20,000 sequences, zero crashes — that a DOM-coupled build can't
  offer. That was an *architect's* call, made because testability was a named goal.
- **Fidelity review needs a dedicated lens.** Three gates approved; only the UX engineer caught that
  M+/M− behaved unlike Windows. On a "make it like X" task, that lens is the one that protects the
  actual requirement.
- **Block vs backlog kept v1 shippable.** Four cheap fidelity/a11y fixes were done now; three deferred
  features were logged, not silently dropped and not scope-crept into v1.

---

## The five runs together

| Run | Situation | Terminal state | Property demonstrated |
|-----|-----------|----------------|-----------------------|
| [001](001-email-validator.md) | Clean function | DONE (first pass) | Real, independent verification |
| [002](002-path-traversal-rework.md) | Fixable defect | DONE (1 rework) | Reject → route by reason → re-verify; block vs backlog |
| [003](003-escalation-requirement-conflict.md) | Unresolvable-in-code conflict | ESCALATED | Knowing when *not* to decide |
| [004](004-retry-ceiling.md) | Unbounded requirement | ESCALATED (ceiling) | Bounded loops; escalate the cause |
| **005** | Real app from a 1-line ask | **DONE (1 rework)** | Multi-turn scope negotiation; testable architecture; fidelity review; a shipped, working deliverable |
