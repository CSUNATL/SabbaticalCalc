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

### State after the reconstruction

At this point every check passed (31 tests) and nothing was yet committed. The rest of the session, below, continued from here; the closing state is at the end of this file.

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

### Focus ring on the file-load control (same session)

The hidden 1px file input received keyboard focus, so the focus ring was invisible. Fixed with `.filebtn:focus-within`, which draws the ring on the visible label. No logic change.

### Documenting the inputs file (same session)

Jeff asked how a person would know the format for "Load inputs from file"; nothing on the page said. Added a "Files" section to the method description with an example file and the list of required and optional fields, a link to it beside the toolbar, and a load error that names the reason (not JSON, no colleges list, and so on) and points to the section. The loader itself is unchanged apart from clearer checks; a file with only `colleges` and each entry's name, eligible, and applicants loads, which the screenshot tool now exercises. A CSV import was discussed and not built.

### Inputs file changed from JSON to CSV (same session)

Jeff's correction: committees will never have a JSON file; the load control must take a CSV spreadsheet with college names, eligible faculty, applicants, and carry forward. The seat percentage, rounding rule, and tie rule are not in the file. The colleges keep the file's order, and loading returns the tie rule to its default (carry forward, then eligible faculty).

Built: `parseInputsCsv` and `formatInputsCsv` in `src/logic.js` (pure, tested: header in any order, no header, semicolons, tabs, quotes, byte-order mark, CRLF, blank rows, a "Total" row, thousands separators, blank cells, error messages, round trip). Both save buttons now write CSV. The "Files" section and the load error were rewritten for CSV. Files that this page saved as JSON earlier in the day still load, detected by a leading brace, so nothing written today is orphaned. Decisions made without instruction: a blank applicants or carry-forward cell is 0 while a blank eligible-faculty cell is an error; a row named "Total" is skipped because spreadsheets often have one; a headerless file is accepted with positional columns. The JSON "Files" section from earlier in the session lasted one commit.

### State at end of session 3

- Everything is committed and pushed to `main` (last commit: inputs file changed to CSV). Working tree clean.
- `npm run check`: 41 tests passing; `dist/sabbatical-allocation.html` is the fresh build. `python tools/screenshot.py` passes: no script errors, no table wider than 1280px, test data gives 46 seats in two rounds, reordering switches and keeps the tie rule as specified, a non-CSV file is refused with an explanation, an Excel-style CSV and a headerless CSV load.
- Environment on Jeff's machine: Node 24 LTS installed per-user with winget on this date (see the memory note if `node` is not on PATH: call `npm.cmd`); Playwright and Chromium installed with pip.
- Behavior now differs from Codex's version in `codex/` in more ways than the carry-forward cap: three tie rules, no name rule, the unresolved flag, a reorderable list, CSV inputs. `codex/` is kept for comparison only and was not updated.
- Still open: R7.1 through R7.5 (policy confirmations; R7.2 now also asks whether an unresolved tie should be placed provisionally or withheld); whether to keep JSON loading for the files written earlier this day, or drop it after the committee has none left.

### Suggested next steps

1. Have the committee try the CSV round trip with a real spreadsheet (Excel and Google Sheets export) and confirm the heading words are recognised; add any heading variants to `CSV_HEADINGS` in `src/logic.js` with a test.
2. Confirm R7.1 and R7.2 against the policy text and set the defaults accordingly (percent, rounding, tie rule).
3. Decide R7.5 (institution name, academic year, sign-off block in print); markup and CSS only.
4. Decide whether `codex/` should stay in the repository now that the two implementations have diverged.

## Fourth session: Claude Code, September 18, 2026

### Is Hamilton the right method?

Jeff had been reading about the Alabama paradox and asked whether Webster, Huntington-Hill or another method would be fairer for CSUN. The answer is `MethodAnalysis.md`, written at his request. In short: Webster (Sainte-Laguë) is the method the literature recommends and is free of the Alabama, population and new-states paradoxes; Huntington-Hill is a poor fit because it guarantees every college a seat and has no solution when the pool is smaller than the number of colleges, which is the normal state of the tool's later rounds; Jefferson and Adams are biased. At CSUN's scale, Hamilton and Webster give the same result on the test data; over 20,000 random campuses they differ in about one year in six, Hamilton shows the Alabama paradox in 3.9 percent of pool-grows-by-one cases and the population paradox in 0.36 percent of year-to-year transitions, and Webster never left quota. The larger finding was that the round structure itself tilts the redistribution toward large colleges (a small later-round pool goes to the largest headcounts regardless of how round 1 rounded them: in the test data Counseling's returned seat goes to Social & Behavioral Sciences at 9.03 quota rather than to Nazarian at 4.58), and that a single pass of Webster capped at applicants removes that and is simpler to audit. The document recommends Webster in a single capped pass, with Webster inside the existing rounds as the minimal change.

### The Webster file

Jeff asked for `sabbatical_webster.html`, the same as the current file except with Webster's method. Read as the minimal change: Webster replaces Hamilton inside each round, and rounds, caps, settlement, the three tie rules, the unresolved flag and the carry-forward mechanism are unchanged. The single-pass version was not built.

Built as one source, two deliverables. `src/logic.js` gained `webster(parts, seats, method)` with the same inputs, tie rules and reporting as `hamilton`, and `allocate` takes a fourth argument, the apportionment. The page source holds both methods' text and rendering code in marked blocks (`<!--[hamilton]-->…<!--[/hamilton]-->`, `/*[webster]*/…/*[/webster]*/`); `build.js` keeps one method's blocks and removes the other's, sets the page's `APPORTIONMENT` constant, and writes `dist/sabbatical-allocation.html` and `dist/sabbatical_webster.html`. Everything outside the blocks is shared, so a UI fix is made once. Both files carry both apportionment functions; only the page text and the rendering strategy (`METHODS.hamilton` / `METHODS.webster` in the UI script) differ. The Hamilton file's behavior and text are unchanged.

How Webster is presented to the committee: seats are handed out one at a time to the strongest claim, eligible ÷ (seats held + ½); the record lists every award with the claim that won it and the strongest competing claim; the narrative names the weakest winning claim and the strongest losing claim (the cutoff) and one divisor between them, and the round table shows each college's eligible faculty ÷ that divisor rounded to nearest, so the whole round can be checked with one division per college. The divisor shown is the one with the fewest decimal places in the valid range, found in integer arithmetic (8.5 for the test data's round 1, 129 for its round 2). At a tie the divisor is the cutoff claim itself and the tied colleges' quotients sit exactly on a half. Claims are compared exactly as `e1 × (2·a2 + 1)` against `e2 × (2·a1 + 1)`.

Decision made without instruction and flagged: the carry forward for a tie lost under Webster is half a seat, because at the deciding divisor the losing college's share is exactly halfway between two whole numbers. Hamilton's rule (the fractional part lost) has no other natural counterpart. Recorded in R4.8 and R7.6.

Tests: 48, including a house-monotonicity fuzz (adding a seat never takes one away), the divisor check over random inputs, tie consistency, and the R4.7 invariants under Webster. `test/build.test.js` checks both deliverables and that no build marker survives. `tools/screenshot.py` renders both files and, for Webster, checks the divisor sentence and the seat-by-seat record; it also now exercises an unresolved tie and its resolution by list order on both pages.

### Environment

The Node and Playwright installs from September 15 were gone from this machine at the start of the session (a Node 24 runtime under JetBrains' agent folder served for the first checks). Jeff reinstalled Node 24 with npm during the session; Playwright and Chromium were reinstalled with `python -m pip install --user playwright` and `python -m playwright install chromium` for Python 3.14. A freshly opened shell may need its PATH refreshed before `node` is found.

### State at end of session 4

- `npm run check`: 48 tests passing, both `dist/` files fresh from the current `src/`. `python tools/screenshot.py` passes for both pages: no script errors, no table wider than 1280px. The Webster page was also looked at in `full-webster.png`.
- **Nothing from this session is committed.** The working tree holds all of it, uncommitted, on `main` at commit 70860ef: `MethodAnalysis.md` and `dist/sabbatical_webster.html` are new files; `src/logic.js`, `src/sabbatical-allocation.html`, `build.js`, both test files, `tools/screenshot.py`, `.gitignore`, `README.md`, `ARCHITECTURE.md`, `REQUIREMENTS.md`, `CLAUDE.md` and this file are modified. Jeff stopped the session before deciding whether to commit. Run `npm run check` first; if it passes, one commit for the analysis and one for the Webster file would be the natural split, or a single commit if that is simpler.
- The Hamilton deliverable was rebuilt (its UI script was restructured around `METHODS`), but its text and behavior are unchanged; the diff against the committed file is code only.
- `codex/` was not touched.
- Open: R7.6 (which method to adopt; whether to move to the single capped pass; whether half a seat is the right carry forward under Webster), and everything listed at the end of session 3.

### Suggested next steps

1. Review and commit the working tree (above).
2. Put both files in front of the committee with the same year's inputs and compare the round narratives; the Webster one should be no harder to follow.
3. If the Senate prefers Webster, decide on the single capped pass (MethodAnalysis.md, "The rounds matter more"); it changes the policy text in REQUIREMENTS.md sections 3 and 4 and the page's method description, and would replace the round tables with one seat-by-seat table plus an entitlement table.
4. Confirm the half-seat carry forward, or replace it with a plain count of ties lost.

## Fifth session: Claude Code, October 16, 2026

### Committing session 4's work

Session 4's work was checked and committed. `npm run check` passed 48 tests with both `dist/` files fresh. Jeff chose the two-commit split: `MethodAnalysis.md` alone, then the Webster file with its logic, page, build, tests, tooling and documentation. Both were pushed to `origin/main` (971d8c5, 433074a). `tools/screenshot.py` was not re-run because no UI had changed since session 4's pass. Playwright was missing again from both Python installs on this machine (Scoop's 3.11 on PATH, and 3.14 via `py`). Reinstall it with `py -3.14 -m pip install --user playwright` and `py -3.14 -m playwright install chromium`, then run the tool with `py -3.14 tools/screenshot.py`.

### Minimum of 42 seats (same session)

Jeff added a policy caveat that had been left out: the union contract sets the pool at 12% of eligible faculty, and CSUN's Section 600 administrative policy adds that there be no fewer than 42 sabbaticals. The pool is now the greater of the rounded 12% and 42. `computeSeatPool` takes a fourth argument, `minimum` (default 0, so existing calls are unchanged), and returns `rounded` (the percentage's result) alongside `seats` (the pool). The minimum is applied after rounding and changes nothing about how the pool is divided.

Decision made without instruction: the minimum is an input on the page beside the percentage ("…to a whole number, but no fewer than [42] seats"), default 42, rather than a fixed number, because the percentage and rounding rule are editable and the page is meant to work elsewhere; 0 means no minimum. Like the percentage, it is not in the inputs CSV and loading a file leaves it as set. The pool statement under the inputs and the step-by-step record each add a sentence saying which applied ("That is fewer than the minimum of 42 seats, so the pool is 42 seats"), and the results CSV gains `Rounded` and `Minimum` fields before `Seats`. The method description cites Section 600. The test data (46 seats) is above the minimum, so its results are unchanged. Applies to both deliverables identically; no method block was touched.

Tests: 50. `tools/screenshot.py` sets the minimum to 0 for its three-seat tie check, and checks both sentences and the validation message. Playwright was reinstalled for Python 3.14 this session, as above. Committed and pushed as 58a4af6.

Open question recorded as R7.7: the policy says "no less than 42 sabbaticals", and the page reads that as a floor on the seat pool, applied after the 12% is rounded. If the policy means 42 awarded, the page cannot meet it in a year with fewer than 42 applicants; it awards every applicant and reports the remaining seats as unallocated, as it always has.

### Environment

Node 24.15 and npm 12.2 are on PATH; `npm run check` and `npm.cmd run check` both work from PowerShell. `python` on PATH is Scoop's 3.11, which has no Playwright; the screenshot tool runs under 3.14: `py -3.14 tools/screenshot.py`. Do not pass `-I` to it, since Playwright is installed in the per-user site-packages that `-I` hides. Playwright has vanished between sessions twice; check with `py -3.14 -c "import playwright"` and reinstall as above if needed.

### State at end of session 5

- Everything is committed and pushed to `main`; the working tree is clean. Commits this session: 971d8c5 (MethodAnalysis.md), 433074a (Webster file), 58a4af6 (minimum of 42 seats), and the close-out commit that adds this section.
- `npm run check`: 50 tests passing; both `dist/` files are fresh builds of the current `src/`. `py -3.14 tools/screenshot.py` passes for both pages: no script errors, no table wider than 1280px.
- Both deliverables open with 12%, rounded up, minimum 42 seats, and the eligible-faculty tie rule. The test data gives 46 seats in two rounds under either method, unchanged by the minimum.
- `codex/` was not touched.

### Suggested next steps

1. Confirm R7.7 against the text of Section 600: a floor on the seat pool, applied after rounding (as built), or something else.
2. Put both files in front of the committee with the same year's inputs and compare the round narratives (R7.6).
3. If the Senate prefers Webster, decide on the single capped pass (MethodAnalysis.md, "The rounds matter more"). It changes the policy text in REQUIREMENTS.md sections 3 and 4 and the page's method description, and would replace the round tables with one seat-by-seat table plus an entitlement table.
4. Confirm the half-seat carry forward under Webster, or replace it with a plain count of ties lost (R4.8, R7.6).
5. Still open from session 3: try the CSV round trip with real Excel and Google Sheets exports; confirm R7.1 and R7.2 (rounding and tie-rule defaults); decide R7.5 (institution name, year, sign-off block in print); decide whether `codex/` stays in the repository.

## Sixth session: Claude Code, October 19, 2026

### Retiring `codex/`

Jeff decided that `codex/` leaves the repository (session 5's next step 5). It held Codex's independent implementation of the brief: `sabbaticalapp.html`, its README and BRIEF.md, and `tests/allocation.test.cjs`. That version had diverged from this worksheet since session 3 and was never part of the build or the tests. The folder was removed with `git rm`, and README.md's file list and ARCHITECTURE.md no longer mention it. The earlier sessions above still describe it, as the record of what was done then. To look at it again, `git checkout f0c8cb3 -- codex` restores it from the last commit that had it.

Decision made without instruction: "retire" was read as removing it from the repository, with git history as the archive, rather than moving it somewhere else.

### Planned move to faculty-affairs-tools

Jeff has a step-by-step plan, `TRANSITION.md`, to turn this repository into a department-wide one for Faculty Affairs tools. It renames `CSUNATL/SabbaticalCalc` to `CSUNATL/faculty-affairs-tools` on GitHub (the old address redirects), moves this project into `tools/sabbatical-calculator/`, and moves daily work from this OneDrive folder to a fresh clone at `C:\Users\jeffw\src\faculty-affairs-tools`. A copy is saved at `C:\Users\jeffw\src\TRANSITION.md`. It runs in six phases from a new Claude Code session started in `C:\Users\jeffw\src`, and keeps its own log in `C:\Users\jeffw\src\TRANSITION-LOG.md`. One step was added to the copy: the repository's existing `tools/` folder cannot be moved into `tools/sabbatical-calculator/`, so `tools/screenshot.py` is moved by itself. None of the plan has been run yet.

After the move, this OneDrive folder is an out-of-date copy, the commands in this file and CLAUDE.md are run from `tools/sabbatical-calculator/`, and changes go through a branch and a pull request instead of straight to `main`.

### State at end of session 6

- Commits this session: f0c8cb3 (session 5's close-out and R7.7), and the commit that adds this section and removes `codex/`. Both pushed to `origin/main`.
- `npm run check`: 50 tests passing. No `src/` change, so both `dist/` files are unchanged.
- `C:\Users\jeffw\src\TRANSITION.md` is ready; Phase 1 has not been started.

### Suggested next steps

1. Run the move in `C:\Users\jeffw\src\TRANSITION.md`, Phase 1 first, from a new Claude Code session in `C:\Users\jeffw\src`.
2. After the move, copy Claude Code's memory notes to the new folder (they are kept per folder), and change the commit note from "commit on main and push" to "branch, then pull request".
3. Session 5's next steps 1 to 4, and the rest of 5, still stand.

## Seventh session: Claude Code, October 19, 2026

### The move to faculty-affairs-tools

The plan in `C:\Users\jeffw\src\TRANSITION.md` was run in full; its record is `C:\Users\jeffw\src\TRANSITION-LOG.md`. The repository is now `CSUNATL/faculty-affairs-tools`, and `github.com/CSUNATL/SabbaticalCalc` redirects to it. No new repository in CSUNATL may take the old name, or the redirect stops working.

This project now lives in `tools/sabbatical-calculator/`. Pull request #1 moved it in three commits: `dd4d092` moves the files without changing them, `e7204ca` fixes the wording that assumed the repository root, and `66ea311` adds the repository-level files (the root README.md and AGENTS.md, CODEOWNERS, the pull request template, and the CI workflow). It was merged with a merge commit, `8455609`, so the three commits are on `main` unchanged, and `git log --follow` reaches the history from before the move. CLAUDE.md in this folder became AGENTS.md, and CLAUDE.md now only imports it; the rules for the whole repository are in the root AGENTS.md.

CI (`.github/workflows/sabbatical-calculator.yml`) runs `npm run check` on every pull request and fails if the build changes `dist/`. `main` is protected: a pull request is required, the `sabbatical-calculator` check must pass, the branch must be up to date with `main`, and admins are included, so nothing is pushed straight to `main` any more. Merges are squash-only, using the pull request's title and description, and merged branches are deleted.

Pull request #2 (`a860ba3`) added the MIT `LICENSE` at the repository root, with Jeff as the copyright holder, and the README's "License" section links to it.

The OneDrive folder was copied to `C:\Users\jeffw\archive\SabbaticalCalc-onedrive`, checked, and removed from OneDrive. Claude Code's memory notes were copied to the new folder, and the commit note now says branch, then pull request.

### Environment

Work happens in the clone at `C:\Users\jeffw\src\faculty-affairs-tools`; start Claude Code there, at the repository root, so the copied memory notes load. The commands in this file and in AGENTS.md are run from `tools/sabbatical-calculator/`; the screenshot tool is still `py -3.14 tools/screenshot.py`, from that folder.

### State at end of session 7

- Commits on `main`: `8455609` (pull request #1, the move) and `a860ba3` (pull request #2, `LICENSE`). This close-out is its own pull request.
- `npm run check`: 50 tests passing. The move left both `dist/` files byte-for-byte unchanged.

### Suggested next steps

1. Session 5's next steps 1 to 4, and the rest of 5, still stand, except the question about `codex/`, which session 6 settled.
