# Dry run 008 — a feasibility command that answers "no"

**Task given to `/maestro`:**

> build a what if command. this would allow me to determine if something is even possible before
> trying to implement it. i think (but you need to decide) we could then just execute what if runs
> that got saved because the architecture and planning for the feature would all be there. … can
> the token usage feature in maestro articulate input and output tokens as separate numbers?

**Result:** `DONE`. Maestro gained a new mode: **`/what-if "<question>"`** runs only the front half
of the pipeline (strategist + principal), **stops before any code**, and synthesizes an honest
feasibility verdict — `FEASIBLE` | `FEASIBLE_WITH_CAVEATS` | `INFEASIBLE` — with cited evidence and,
for anything short of feasible, a named blocking constraint. Feature cost: **233,169 tokens across
7 build turns**, 4/4 verifier APPROVE with **zero findings against the shipped code**.

> ### Why this run is different
> Every prior run *built* something. This one built a tool that decides whether something is worth
> building — and then **exercised itself on a real question mid-run**. The request carried its own
> test case ("can token usage articulate input and output tokens separately?"), so after the
> feature was implemented the orchestrator actually ran `/what-if` on it (study **WHATIF-002**). The
> answer came back **INFEASIBLE** — correctly. A feasibility tool whose first real use returns a
> well-evidenced "no" is the feature working, not failing.

---

## Two decisions the pipeline made (not the human)

The request delegated a product call explicitly ("*i think but you need to decide*"). The strategist
made two:

1. **What a what-if IS.** The front two *producing* stages (STRATEGY → ARCHITECTURE) then a hard
   stop. No implementer, no verifiers, no diff. The run terminates in a distinct `WHATIF_DONE`
   state, in a separate `.maestro/whatifs/<id>/` namespace, so a study is never mistaken for shipped
   work. Three independent signals enforce that separation: the namespace, the terminal state (a
   token absent from the task-status stage enum), and the `WHATIF-` id prefix.
2. **Promotion is in v1 — "seed, not skip."** Because the user's hypothesis was that a saved plan
   makes a study promotable, the strategist accepted promotion *but closed the dangerous version of
   it*: `/maestro run WHATIF-<id>` mints a **fresh build task** (`task_origin = WHATIF-<id>`), seeds
   the saved requirement + architecture as **prior art**, and runs the **full four-gate pipeline**,
   re-validating against current code. Nothing is skipped; a stale or wrong saved plan cannot ride
   into `main` unverified. `INFEASIBLE` studies are refused outright.

---

## Pipeline trace (building the feature)

| # (seq) | Stage | Agent | Verdict / action | Tokens |
|---|-------|-------|------------------|-------:|
| 1 | INTAKE | orchestrator | Task `WHATIF-001`; the delegated promotion decision handed to the strategist | — |
| 2 | STRATEGY | strategist | **SCOPED** — 11 criteria; defined what-if = STRATEGY+ARCHITECTURE-then-stop; **decided promotion IN v1 (seed-not-skip)**; flagged the example as a verdict-honesty regression test | 26,663 |
| 3 | ROUTE | orchestrator | Recorded strategist turn; route to ARCHITECTURE | — |
| 4 | ARCHITECTURE | principal-engineer | Design: new `whatif.schema.json` + verdict definition, `.maestro/whatifs/` namespace, `WHATIF_DONE` terminal, SKILL feasibility + promote sections; **closed the pre-existing `task_origin` schema gap** [run 007's FMT-001 surfaced it] | 27,007 |
| 5 | ROUTE | orchestrator | Recorded principal turn (cumulative 53,670); route to IMPLEMENTATION | — |
| 6 | IMPLEMENTATION | staff-engineer-implementer | Built 8 files (4 new, 4 additive); validated with a hand-written draft-07 subset validator (no `jsonschema` in env); confirmed only 8 files changed, no `agents/*.md`, no gate logic | 46,270 |
| 7 | DEMONSTRATE | orchestrator | Ran the honest-negative example live as study **WHATIF-002** → **INFEASIBLE** (early-terminate); validated | — |
| 8 | VERIFICATION | security-engineer | **APPROVE** — promote path re-runs all 4 gates (seed=prior-art, INFEASIBLE refused); read-only to source; `$ARGUMENTS` non-executable; schemas additive | 33,537 |
| 9 | VERIFICATION | ux-engineer | **APPROVE** — honest 3-value vocabulary, distinct namespace. 1 low: WHATIF-002 verdict paraphrased not mirrored | 20,831 |
| 10 | VERIFICATION | code-reviewer | **APPROVE** — schema valid + additive; SKILL non-contradictory; exactly 8 files, no gate logic. Zero findings | 37,739 |
| 11 | VERIFICATION | qa-engineer | **APPROVE** — all 11 criteria traced; criterion 6 cross-checked against real code. 2 low nits on the WHATIF-002 demo artifact | 41,122 |
| 12 | ARBITRATION | orchestrator | Gate **PASS 4/4**, **zero findings against the feature**. The 3 low findings all target the orchestrator's own WHATIF-002 study → reconciled directly (no implementer rework). **DONE** | — |

Reconciliation: `total = 26663 + 27007 + 46270 + 33537 + 20831 + 37739 + 41122 = 233,169`, matching
`by_agent` and `by_stage` sums.

---

## The live honest-negative (study WHATIF-002)

After the feature was built, the orchestrator ran the request's own example through it:

```
/what-if "can the token usage feature in maestro articulate input and output tokens as separate numbers?"
```

The feasibility-mode strategist grounded the question in the real code and found the answer is
**no, as asked**. Its verdict, verbatim from `.maestro/whatifs/WHATIF-002/verdict.json`:

```json
{
  "verdict": "INFEASIBLE",
  "reasoning": "Maestro's token accounting has exactly one upstream source: a single aggregate scalar per subagent return, <usage>subagent_tokens: N</usage>. The orchestrator never receives a prompt-token vs. completion-token breakdown, so the feature cannot articulate input and output tokens separately as asked. This is a source-signal limitation, not a schema or rendering choice ... It would become possible ONLY if the upstream Agent-tool <usage> marker itself began emitting separate input/output counts ... outside Maestro's control.",
  "evidence_refs": [
    "skills/maestro-orchestrator/SKILL.md#Token-accounting",
    "schemas/task-status.schema.json token_usage.turns[] (only subagent_tokens: integer|null; additionalProperties:false)",
    "docs/dry-runs/006-token-accounting.md ('No in/out/cache split ... no invented breakdown')"
  ],
  "blocking_constraint": "The upstream Agent-tool return emits only one aggregate subagent_tokens scalar; no input/output split exists at the source ... a change to Maestro's premise, not a build Maestro can perform on its own.",
  "promotable": false
}
```

This is the design's core promise made concrete:

- **It reached a truthful negative** instead of inflating to a helpful-sounding yes. The verdict
  rubric (`INFEASIBLE` when the request depends on data the codebase cannot currently provide) left
  no honest path to `FEASIBLE`.
- **It cited its evidence** — three real files a human can open and check.
- **It marked itself un-promotable** (`promotable: false`), so `/maestro run WHATIF-002` would be
  refused with that blocking constraint rather than starting a doomed build.
- **It early-terminated.** The strategist's grounding already established impossibility, so the
  orchestrator skipped ARCHITECTURE (designing an approach for data that does not exist is
  meaningless) — a sanctioned feasibility-mode path, recorded as `architecture_ref: null`.

The study cost **17,375 tokens** (its own separate ledger) — a few cents of thinking to save the
cost of building a feature that could never work.

---

## The disposition that makes this run honest

The gate passed 4/4 **with zero findings against the eight shipped files.** But UX and QA raised
three low-severity nits — all against **WHATIF-002, the demonstration study the orchestrator itself
authored**, not the implementer's code: a paraphrased-not-mirrored verdict, and a `raw_ref` pointing
at a capture file that was never written.

The verifiers reasonably *targeted* those at the implementer (they assumed pipeline provenance). The
orchestrator corrected the attribution and fixed its **own** artifact directly — rewrote the study's
verdict as a verbatim mirror and wrote the missing `raw/2-strategist.json` — with **no implementer
rework**, because the feature code was clean. It is the session's third such self-catch, after
[run 006](006-token-accounting.md)'s stray `note` key and [run 007](007-rework-dogfood.md)'s splice
artifact: the gates catch the *conductor's* mistakes too, not only the implementer's.

---

## Token ledger — final state

`.maestro/tasks/WHATIF-001/status.json` (`token_usage`):

```json
{
  "token_usage": {
    "total": 233169,
    "by_stage": { "STRATEGY": 26663, "ARCHITECTURE": 27007, "IMPLEMENTATION": 46270, "VERIFICATION": 133229 },
    "by_agent": {
      "strategist": 26663, "principal-engineer": 27007, "staff-engineer-implementer": 46270,
      "security-engineer": 33537, "ux-engineer": 20831, "code-reviewer": 37739, "qa-engineer": 41122
    }
  }
}
```

`total == Σ turns == Σ by_agent == Σ by_stage == 233,169`. Third feature this session to dogfood the
token ledger; the WHATIF-002 study carries its own independent 17,375-token ledger, proving
feasibility studies are accounted exactly like builds.

---

## Takeaways for an evaluator

- **A feasibility mode that can say "no."** The headline capability is an honest negative: given a
  real question, `/what-if` returned `INFEASIBLE` with three cited files and a named blocker, and
  marked itself un-promotable. Assess-before-you-build only has value if the assessment can be
  unfavourable.
- **The pipeline made the product call.** The human delegated whether promotion belonged in v1; the
  strategist accepted it *and* excluded the risky "trust the saved plan" version — promotion
  re-runs all four gates.
- **Studies are quarantined from ships.** Separate namespace + `WHATIF_DONE` terminal + `WHATIF-`
  prefix mean a feasibility study is never counted or shipped as a built feature.
- **The gates catch the conductor.** Zero findings against the shipped feature; the only nits were
  in the orchestrator's own demonstration artifact, and the orchestrator fixed them itself.
- **It composes with the prior runs.** It closed the `task_origin` schema gap that
  [run 007](007-rework-dogfood.md) surfaced, and reused the same `run <id>` promotion spine that
  `/maestro-backlog run` established.
