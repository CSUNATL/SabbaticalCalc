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

## Second session: Claude Code, September 15, 2026

Jeff continued the project in Claude Code (Claude Fable 5.1). Codex worked in parallel in `codex/` on an independent implementation of the same brief; the two were not merged.

### Repository

- Created `github.com/CSUNATL/SabbaticalCalc` (public), branch `main`. The deliverable lives at the repository root as `sabbatical-allocation.html`, not in `dist/`.
- The `src/`, `test/`, `build.js`, `package.json`, and `tools/` layout described in CLAUDE.md and ARCHITECTURE.md was not brought over from session 1. Only the built file exists, so there is no test suite for it and `npm run check` cannot run. Every check in this session was done ad hoc by extracting the logic block into Node and rendering in headless Chrome; none of it is checked in.
- `codex/` holds the brief, Codex's `sabbaticalapp.html` (renamed from `index.html` at Jeff's request), its README, and its own test file (`node codex/tests/allocation.test.cjs`, 15 tests). Codex's version has kept pace with the same features on its own.
- The root `README.md` and `index.html` are the initial scaffold and are stale: the README points at the stub, not the worksheet.

### Review of the session-1 file

Verified correct: the documented nine-college example, 20,000 fuzzed inputs against the R4.7 invariants, rendering at 1280px with no script errors.

Found and fixed this session: the print stylesheet could not expand a closed `<details>` (CSS cannot; replaced with `beforeprint`/`afterprint` handlers); college names were inserted unescaped in the round narratives; long names overflowed the tables (name cells may now wrap).

Found and not yet fixed: the seat pool is computed in floating point and is off by one seat for some non-integer percentages (375 × 18.4% gives 68 instead of 69; 250 × 64.4% rounded up gives 162 instead of 161). Integer percentages, including 12%, are unaffected. The fix is to take the percentage in hundredths and use integer arithmetic. Also: "rounded to nearest" is round-half-up, and the keyboard focus ring on the file-load control is invisible because the real input is 1px.

### Changes made on Jeff's instruction

1. The page opens with the ten CSUN colleges by name, in the order Jeff gave, with counts at zero; "Reset to CSUN colleges" restores the list. The fictional example is gone.
2. Seat-pool rounding defaults to round up.
3. A "How is the allocation calculated?" link at the top and in the round-by-round section opens the method section, rewritten as numbered steps with the session-1 reasoning for the two non-obvious rules.
4. Round tables show the exact quota arithmetic (pool × eligible ÷ total, then the result), taken from Codex's version.
5. "Load test data" fills the CSUN list with Jeff's test counts (CECS 33/6, CHHD 64/12, COH 39/13, COUNSELING 9/0, CSBS 75/21, CSM 45/16, DNCBE 38/13, LIBRARY 18/2, MCCAMC 39/10, MDECOE 22/7), mapped by position to the full names: 382 eligible, 100 applicants, 46 seats, two rounds.
6. Carry forward for ties. Jeff's specification: a per-college field tracking the fraction that went unmet because of a tie; used to break ties in the current year; persists until that college wins a tie; the page reports what next year's value should be. Implemented as R4.2 and R4.8: tie-break is carry forward, then headcount, then name; at year end a tie winner resets to 0, a tie loser that still has an unfunded applicant adds the fraction it lost, everyone else is unchanged. Two choices made without instruction and flagged to Jeff: a loser whose applicants were all funded by year end adds nothing, since the seat cost it nothing; repeated losses accumulate, so values can exceed 1. Codex's version caps its carry-forward input below 1, so the two implementations differ there. Within a year, a college that has won a tie is treated as having no carry forward in later rounds.
7. Ties and tie winners are marked in every table: "won tie" and "lost tie" pills, a colored row edge (blue won, amber lost), and bold names in the tie sentence.

### Other decisions

- The name tie-break uses fixed English collation so the result cannot depend on a committee member's machine locale (R2.4).
- Saved-file format is version 2, adding `carry`; version-1 files load with carry forward 0. A button in the carry-forward report writes next year's starting file: names, next year's carry forwards, counts cleared.
- The "total eligible is zero" message was reworded as a prompt, since that is the state the page now opens in.

### State at end of session 2

- All work committed and pushed to `main`. Working tree clean at the last commit.
- Open: R7.1 (rounding rule against the policy text; the default is now round up), R7.2 (whether headcount then name are the right rules when carry forwards are equal), R7.3, R7.4, R7.5; the seat-pool floating-point fix; the missing `src/` and test layout; the stale root README and stub `index.html`; whether the main file and Codex's should agree on the carry-forward cap.

### Suggested next steps

1. Fix the seat-pool arithmetic (integer hundredths) before any non-integer percentage is used in earnest.
2. Either reconstruct `src/`, `build.js`, `package.json`, and `test/` from the single file so `npm run check` works as CLAUDE.md describes, or rewrite CLAUDE.md and ARCHITECTURE.md for a single-file repository. Turn this session's scratch checks (documented example, fuzz invariants, seven tie scenarios) into the checked-in test suite.
3. Replace the root README and drop or repurpose the stub `index.html` (make the worksheet `index.html` if GitHub Pages is wanted).
4. Confirm R7.1 and R7.2 against the policy text.

## Third session: Claude Code, September 15, 2026

Jeff asked for three things: fix the seat-pool arithmetic, taking the percentage to ten-thousandths rather than hundredths; reconstruct the `src/` and test layout; replace the root README and drop the stub `index.html`.

### Seat-pool arithmetic

`computeSeatPool` now scales the percentage to an integer in ten-thousandths of a percent (12.3456% → 123456), multiplies by the total eligible faculty, and splits the product over 1,000,000 with integer `%`. Round down, up, and nearest are decided from the integer remainder; "nearest" rounds an exact half up, which is now stated on the page. The exact product is shown as a decimal string built from the integers (at most six places, trailing zeros removed), so the page never displays a floating-point artifact. A percentage with more than four decimal places is an input error rather than being rounded silently. The percent input's step is 0.0001. The two cases that were wrong (375 × 18.4% → 68; 250 × 64.4% rounded up → 162) are now tests, along with a 5,000-case comparison against a BigInt reference.

### Reconstruction

The single file was split at its own `/* ---------- UI ---------- */` comment: everything before it became `src/logic.js` (with the `module.exports` guard added), the rest became `src/app.html` with the `/*__LOGIC__*/` marker in place of the logic. `build.js` reproduced the checked-in file byte-for-byte apart from two blank lines before any other change was made. The deliverable moved from the repository root to `dist/sabbatical-allocation.html`, as CLAUDE.md and ARCHITECTURE.md had described all along. `package.json` has the three scripts and no dependencies; `npm run check` builds first, then tests, so a stale `dist/` is caught by `test/build.test.js`. A `.gitattributes` pins LF endings so the build is identical on both platforms.

`test/logic.test.js` has 24 tests: seat-pool rules, Hamilton apportionment, the CSUN test data's full outcome, round-1 inclusion and later exclusion, unallocated seats, every tie-break rule and carry-forward outcome, every validation message, and a 3,000-case fuzz of the R4.7 invariants. `test/build.test.js` has 4: `dist/` is current, the file is self-contained, the script parses and the logic runs without a DOM, and the UI's ids and print handlers are present. `tools/screenshot.py` was rewritten: it renders at 1280px, loads the test data, checks the seat sentence and the two-round outcome, checks that no results table scrolls horizontally, exercises the 18.4% case and a validation error, and fails on any script error. All of it passes on this machine.

Node was not installed on Jeff's machine; Node 24 LTS was installed with `winget install OpenJS.NodeJS.LTS --scope user`. Playwright and its Chromium were installed with pip for the screenshot tool.

### README and stub

The root README now describes the worksheet for users and the layout and commands for developers. The stub `index.html` was deleted; there is no GitHub Pages copy.

### State at end of session 3

- Every check passes: 31 tests, build byte-identical, headless render clean. Not committed at the time of writing; Jeff had not asked for a commit.
- Still open: R7.1 through R7.5; the invisible keyboard focus ring on the file-load control (the real input is 1px); whether the main file and Codex's should agree on the carry-forward cap (the main file lets values exceed 1, Codex's caps below 1).

### Reorderable list and two tie rules (same session)

Jeff asked for the college list to be drag-reorderable and for two selectable tie rules after carry forward: (1) list order, topmost wins, then eligible faculty; (2) eligible faculty only, the default. Reordering the list is to select rule 1 automatically, and the user may switch back. Under rule 2 a tie that remains unresolved must be clearly flagged.

Built as specified. Each input row has a position number, a drag handle (native HTML5 drag-and-drop, no library; the handle alone starts a drag so text in the inputs stays selectable), and move-up and move-down buttons for keyboard and touch. A select under the seat rule chooses the tie rule; moving a row sets it to list order. The rule and the list order are saved in the inputs file (format version 3; older files load as eligible faculty) and stated in the record and the CSV.

Name is no longer a tie-break rule under either method. Under rule 1, list positions are unique, so a tie is always resolved. Under rule 2, colleges with the same fractional part, the same carry forward, and the same headcount are unresolved. Decision made without instruction and flagged here: the seat is still placed, provisionally with the college listed higher, so that the rest of the calculation and the invariants hold, and the page flags it in five places: a red alert under "Where the seats went" naming the round and the remedy; "won tie, unresolved" and "lost tie, unresolved" labels with a red row edge in the round, final, and carry-forward tables; a sentence in the round narrative naming the colleges and their list positions; a note in the carry-forward report that the dependent carry forwards are provisional; and the record. Choosing the list-order rule with the same list gives the same seats, resolved.

Under rule 1 the third step, eligible faculty, can never be reached because positions are unique; it is implemented as specified and the method text says so.

Tests: 31, including both rules, unresolved detection at the cutoff (a tie that does not straddle the cutoff is not a tie), provisional placement by position rather than array order, and a fuzz check that `tieDecidedBy` is consistent with the winner and loser under whichever rule was used. `tools/screenshot.py` also moves a row with the arrow button and checks that the rule switches and can be switched back. Drag-and-drop was exercised in headless Chromium by a scratch script, not by the checked-in tool.

### Third tie rule (same session)

Jeff asked for a third option: carry forward, then list order, with no step after that, flagging the tie if still unresolved. Added as `'list-only'`. Two colleges cannot share a list position, so under this rule the flag can never fire; Jeff was told this and the rule was built as specified. The flag is implemented generically: `hamilton` now walks the ordered steps of whichever rule is selected and reports `'unresolved'` when every step leaves the last winner and first loser equal, so any future rule gets the same treatment. Reordering the list now switches the rule to list order only when the eligible-faculty rule is in use; a list rule already chosen is kept. The unresolved texts name the rule in use instead of assuming eligible faculty. Tests: 32.

### Source file renamed (same session)

Jeff asked for the source page and the built file to share a name, since `app.html` was uninformative. `src/app.html` is now `src/sabbatical-allocation.html`; the earlier mentions of `app.html` in this file are history. `build.js`, the docs, and the test comment were updated.
