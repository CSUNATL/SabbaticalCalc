# Handoff

Record of the design conversation that produced v1.0 (September 15, 2026), for continuing the project in Claude Code. Written so that the reasoning behind the non-obvious rules is not lost.

## Owner and context

Jeff, Full Professor and Faculty Senate President at CSUN, designed a Hamilton-method sabbatical allocation flowchart and policy framework for a nine-college university. He wants a tool other people can use to compute the allocation. He is comfortable in Go, Python, PowerShell, and embedded work, and prefers self-hosted and dependency-light tooling.

## The conversation, in order

### 1. Language and architecture

Question: what language and architecture for a GUI calculator that Windows and macOS users launch as one platform-independent deliverable?

Answer adopted: a single self-contained HTML file with vanilla JavaScript, no server, no build step required. It is the only option that is literally one artifact, runs identically on both platforms, needs no install, and doesn't trip Gatekeeper or SmartScreen. Architecture: pure `hamilton()`/`allocate()` functions with no DOM references (so they can be unit-tested under Node), a thin DOM layer, and JSON load/save through browser file download/upload. Alternatives rejected: Go (Fyne/Wails), Tauri, Electron, PyInstaller (one binary per OS; unsigned macOS binaries blocked without a paid Apple developer account and notarization); Java jar (needs a JRE); Excel workbook (multi-round exclusion is ugly in formulas, VBA blocked by default); hosted web app (a URL, not a launchable file, dependent on a server being up).

### 2. Why zero-applicant colleges stay in round 1 but settled colleges leave later rounds

Jeff asked for the logic behind his own rule. The answer given:

It is not uniquely fair in a mathematical sense; a one-step method that drops zero-applicant colleges up front is also defensible, and the two can differ by a seat because of Hamilton rounding. The case for the rule is procedural consistency:

- Round 1 computes entitlement, not demand. Entitlement is a function of eligible headcount alone, so every college's baseline can be computed in advance and audited from one table. Letting applicant behavior into round-1 inputs would make the same headcounts produce different baselines year to year, and Hamilton's new-states paradox means adding or removing a college can shift a seat between two unrelated colleges purely through rounding.
- Zero applicants is not a special case. A college with 0 applicants and entitlement 3 and a college with 1 applicant and entitlement 3 are the same situation: demand fully met with unused seats. The round mechanism handles both identically (settle, release surplus, redistribute among the unsettled). A separate exclusion rule for zero would treat two instances of one situation differently based on an arbitrary threshold.
- The surplus goes to the right place. Redistributing only among unsettled colleges sends released seats to colleges with unfunded applicants. Excluding zero-applicant colleges up front instead hands their share to everyone proportionally, including colleges about to be oversubscribed, whose surplus then needs another round anyway.

Upshot: one rule applied repeatedly until every college is settled or the pool is exhausted; simpler to implement and explain, and it yields a record of entitlement, use, and where the remainder went.

### 3. What if settled colleges were included in later rounds?

Jeff asked whether including zero-demand colleges in later rounds would be unfair and whether it could loop forever. Answer:

Yes, it can loop forever, and it isn't fairer. A round is a deterministic function of (pool size, headcounts). If every seat in a round lands on a settled college, those seats are released, the next round has identical inputs, and it produces the identical result: a fixed point. Simplest case: one seat left, Hamilton with S=1 gives every college floor 0 and hands the seat to the largest fractional part of N_i/N, which is the largest college; if it is settled, the seat cycles indefinitely. Before reaching a fixed point the pool shrinks each round, so the process converges, but it can converge onto a nonzero stranded pool.

The unfairness is concrete: seats that could fund an applicant in an unsettled college sit unallocated, and the losers are systematically the small colleges, because with a small pool Hamilton's remainder seats go to the largest fractional parts, which track headcount. In the continuous limit the two schemes are equivalent (each round distributes proportionally, so the share reaching unsettled colleges is proportional among themselves either way), so including settled colleges buys nothing and only adds rounding noise and a termination failure. Excluding settled colleges is the terminating rule: every seat in a round goes to a college that can use it, so the pool strictly decreases or every college is settled, and the loop ends within (colleges + 1) rounds. The app guards the loop with that invariant anyway.

### 4. Variable number of colleges and names in a single HTML file

Colleges are a data array, not fixed HTML. `state.colleges` is rendered into an editable table by a `render()` function; add/remove buttons mutate the array and re-render; input handlers write back by row index and re-run the allocation. Persistence is the JSON round-trip, so a committee at another campus loads its list once. Validation: non-empty unique names, integer non-negative counts, applicants ≤ eligible, and results are withheld until the list is clean. The allocation functions take `colleges` and `seats` as arguments and never depend on count or names; names appear only in rendering.

### 5. Seat pool rule and implementation

Jeff specified: total seats available = 12% of total eligible faculty. He asked for the file to be designed and implemented, with output that is very informative, easy to understand, and lets the user verify and validate what took place.

Built: `dist/sabbatical-allocation.html` (see ARCHITECTURE.md for structure, REQUIREMENTS.md for behavior). Decisions made without explicit instruction, flagged to Jeff for confirmation:

- Seat-pool rounding defaults to round down; nearest and up are selectable; percentage is editable.
- Remainder-seat ties break by larger eligible headcount, then name; comparison is exact integer arithmetic; ties at the cutoff are reported in the narrative and the record.
- Applicants > eligible is an input error, not a warning.

Output structure delivered: seat-flow summary; final allocation table with per-round breakdown and share-of-seats vs share-of-eligible; per-round narrative paragraph plus full table (quota, whole seats, fraction, rank, extra seat, allocation, funded, returned, status); collapsible step-by-step record with every division written out and per-round checksums; save/load JSON; CSV export; print stylesheet. Example data: nine colleges, 900 eligible → 108 seats, one college with zero applicants (Science, 118 eligible), one oversubscribed (Social Sciences, 30 applicants, 27 funded); three rounds.

Logic fuzz-tested against random inputs for the invariants: per round whole + extra = pool and funded + returned = pool; overall awarded + unallocated = pool; awarded ≤ applicants; rounds ≤ colleges + 1; unallocated > 0 only when every applicant is funded.

### 6. This handoff

Jeff asked for CLAUDE.md, ARCHITECTURE.md, REQUIREMENTS.md, any other needed files, and this HANDOFF.md, to move the project to disk and continue in Claude Code. The source was split into `src/logic.js` and `src/app.html` with `build.js` producing `dist/`, a `node:test` suite was added (8 tests, passing), and `tools/screenshot.py` was kept for visual review.

## State at handoff

- `npm test`: 8/8 passing. `npm run build` reproduces `dist/sabbatical-allocation.html` byte-for-byte from `src/`.
- Visually reviewed at 1280px: all tables fit without horizontal scroll; no JS errors in headless Chromium.
- Open items are listed in REQUIREMENTS.md section 7. The two that matter most for correctness against policy are the seat-pool rounding rule (R7.1) and the tie-break order (R7.2).

## Suggested first steps in Claude Code

1. `git init`, commit as-is, then `npm run check` to confirm the environment.
2. Resolve R7.1 and R7.2 against the policy text; adjust `computeSeatPool` default or `hamilton`'s comparator, update tests and the on-page method text.
3. Replace the example college names and counts with real ones if the file will be distributed pre-loaded, or leave the generic example and rely on save/load.
4. Decide on R7.5 (institution name, academic year, sign-off block in print).
