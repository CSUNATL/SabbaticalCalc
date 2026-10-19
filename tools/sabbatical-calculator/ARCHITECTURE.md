# Architecture

## Why a single HTML file

The users are committee members on Windows and macOS who must receive one artifact they can launch without installing anything. A self-contained HTML file is the only option that is one file, runs identically on both platforms, needs no runtime, and avoids macOS Gatekeeper and Windows SmartScreen. Rejected alternatives and why: Go/Tauri/Electron/PyInstaller (one binary per OS, unsigned-binary friction on macOS), Java jar (needs a JRE), Excel (multi-round exclusion logic is awkward in formulas, VBA blocked by default), hosted web app (a URL, not a launchable file, and tied to someone's server).

## Folder layout

The tool lives in `tools/sabbatical-calculator/` of the faculty-affairs-tools repository. Paths are relative to that folder.

```
AGENTS.md            instructions for coding agents
CLAUDE.md            imports AGENTS.md for Claude Code
REQUIREMENTS.md      what the tool must do; policy rules; open items
ARCHITECTURE.md      this file
HANDOFF.md           record of the design conversation and reasoning
README.md            short user-facing readme
package.json         scripts only; no dependencies
build.js             splices src/logic.js into src/sabbatical-allocation.html -> dist/, one file per apportionment method
src/logic.js         pure allocation logic, Hamilton and Webster (Node-testable)
src/sabbatical-allocation.html   page: CSS, markup, UI script, with /*__LOGIC__*/ marker and marked method-specific blocks
test/logic.test.js   node:test suite for src/logic.js
test/build.test.js   checks dist/ matches src/ and is self-contained
tools/screenshot.py  optional Playwright render for visual review
dist/sabbatical-allocation.html   the deliverable, Hamilton method (build output)
dist/sabbatical_webster.html      the deliverable, Webster method (build output)
MethodAnalysis.md    comparison of the apportionment methods at CSUN's scale, and the case for Webster
```

`.gitattributes` sits at the repository root, not in this folder. It sets LF line endings for text files, so builds are byte-identical on Windows and macOS. Its patterns are unanchored, so they apply here.

`src/` is edited; `dist/` is generated. The only build step is string substitution: `build.js` reads `logic.js`, strips its `module.exports` guard, replaces `/*__LOGIC__*/` in `src/sabbatical-allocation.html`, normalises line endings to LF, and refuses to write if `module.exports` or an external URL would end up in the output. No bundler, no minification. The deliverable is readable source, which is itself a verification feature.

One page source produces two deliverables. Text and code that belong to one method sit in marked blocks: `<!--[hamilton]-->…<!--[/hamilton]-->` or `<!--[webster]-->…<!--[/webster]-->` in the markup (inline within a line, or on lines of their own), and `/*[hamilton]*/…/*[/hamilton]*/` or `/*[webster]*/…/*[/webster]*/` in the script. `build(method)` keeps the blocks for `method`, removing only the markers, and removes the other method's blocks without leaving a blank line; it then sets the page's `const APPORTIONMENT = '…'` and refuses to write if any marker survives. Both apportionment functions stay in both deliverables (the logic is one unit and is tested as one); only the page text and the rendering strategy differ. Everything outside the marked blocks is shared, so a UI fix is made once.

## Runtime structure (inside the deliverable)

One `<script>` with two parts.

### Part 1: allocation logic (from `src/logic.js`)

Pure functions, no DOM.

- `computeSeatPool(colleges, percent, rounding, minimum = 0) -> { totalEligible, percent, percentScaled, exact, exactText, rounded, minimum, seats, rounding }`
  - `percentScaled = round(percent × 10,000)` (ten-thousandths of a percent). `num = totalEligible × percentScaled`; the exact pool is `num / 1,000,000`, split with integer `%` into `whole` and `rem`. `down` = `whole`; `up` = `whole + 1` if `rem > 0`; `nearest` = `whole + 1` if `2 × rem ≥ 1,000,000` (an exact half rounds up). `exactText` is the exact product as a decimal string with trailing zeros removed, for display; `exact` is the same value as a float and is not used for any decision. `validate` rejects a percentage with more than four decimal places so nothing is rounded silently. `rounded` is the result of the rounding rule; `seats = max(rounded, minimum)` is the pool. The minimum (42 on the page, from CSUN's Section 600 policy) is applied after rounding and has no effect on how the pool is divided.
- `hamilton(parts, seats, method) -> { total, wholeSum, remainderSeats, rows, order, ties, tieDecidedBy, unresolved, method }`
  - `parts`: `[{ idx, name, eligible, carry }]` for the colleges taking part; `idx` is the college's position in the full list (0 = top) and `carry` is the carry forward used for tie-breaks. `method` is `'eligible'` (default, also used for any unknown value), `'list'`, or `'list-only'`; `TIE_STEPS` maps each to its ordered steps after carry forward (`['eligible']`, `['list', 'eligible']`, `['list']`) and `TIE_METHODS` lists the keys. Adding a rule is one entry in `TIE_STEPS` plus a UI option and label.
  - For each part: `num = seats × eligible`, `whole = floor(num / total)`, `remNum = num − whole × total` (the fractional part's numerator, an exact integer). `order` is rows sorted by `remNum` desc, `carryKey(carry)` desc (thousandths), then each step of the method in turn (`eligible` desc or `idx` asc), then `idx` asc as the provisional placement for anything still equal. The first `remainderSeats` entries get `remainderSeat = 1` and `allocated = whole + 1`. `rank` is the position in `order`. Name is not compared anywhere.
  - `ties`: names of rows whose `remNum` equals the cutoff row's when the tie straddles the cutoff (i.e., the tie changed who got a seat). Empty otherwise. Those rows get `tie = 'won' | 'lost'`, and `tieDecidedBy` is `'carry'` or the first step of the method that separated the last winner from the first loser (`'list'` or `'eligible'`); if no step did, it is `'unresolved'` and `unresolved = true`. The final `idx` comparison only orders the provisional placement of an unresolved tie and is never reported as a rule.
- `webster(parts, seats, method) -> { apportionment: 'webster', total, rows, awards, lastAward, runnerUp, divisor, divisorText, divisorIsCutoff, ties, tieDecidedBy, unresolved, method }`
  - Same inputs and tie rules as `hamilton`, used by the Webster deliverable. Seats are awarded one at a time to the strongest claim, `eligible ÷ (allocated + ½)`, compared exactly as `e1 × (2·a2 + 1)` against `e2 × (2·a1 + 1)`; the comparator then applies carry forward, the steps of `method`, and `idx` exactly as `hamilton`'s sort does. `awards[k]` records seat `k + 1`: the college, its seats before and after, the claim, and `runnerUp`, the strongest competing claim at that moment. Rows carry `allocated`, `lastClaim` (`eligible ÷ (allocated − ½)`, null when 0), `nextClaim`, `quotient` (`eligible ÷ divisor`), `share`, `quota` (for reference only), and `tieFraction = 0.5`.
  - Cutoff: `lastAward` (the weakest claim that won) against `runnerUp` (the strongest claim that did not, after all seats are placed). A tie is the exact equality of those two claims; rows whose last claim equals it are `'won'` and rows whose next claim equals it are `'lost'`; `tieDecidedBy` is derived from the last award's college and the runner-up as in `hamilton`. Any divisor above the runner-up's claim and not above the last award's reproduces the allocation by rounding to nearest; `divisor` is the one with the fewest decimal places in that range, found in integer arithmetic on the doubled claims (`divisorText` is its decimal string). At a tie, `divisor` is the cutoff claim itself and `divisorIsCutoff` is true; the tied colleges' quotients then sit exactly on a half. A tie loser is exactly half a seat short at that divisor, which is why `tieFraction` is 0.5.
  - `hamilton` rows carry `tieFraction = fraction` and its result carries `apportionment: 'hamilton'`, so `allocate` treats the two alike. `APPORTIONMENTS = ['hamilton', 'webster']`.
- `allocate(colleges, seats, method, apportionment) -> { seats, rounds, final, unallocated, stopReason, totalAwarded, method, apportionment, unresolvedRounds }`
  - `apportionment` is `'hamilton'` (default, also used for any unknown value) or `'webster'`; it selects the function each round calls and nothing else changes: rounds, caps, settlement, tie rules and carry forward are shared. Each round record spreads the apportionment result (everything but `total`, which becomes `totalEligible`), so a Hamilton round has `wholeSum`, `remainderSeats`, `order` and a Webster round has `awards`, `lastAward`, `runnerUp`, `divisor`, `divisorText`, `divisorIsCutoff`; both have `apportionment`, `rows`, `ties`, `tieDecidedBy`, `unresolved`, `method`.
  - Passes `method` to every round; each round record carries `tieDecidedBy` and `unresolved`; `unresolvedRounds` lists the round numbers with an unresolved tie. Tie events take their `fraction` from the row's `tieFraction`.
  - Maintains `demand[i]` (unfunded applicants), `awarded[i]`, `byRound[i]`, `settledIn[i]`, `carryNow[i]` (carry forward used for tie-breaks; cleared when the college wins a tie), and `tieEvents[i]`.
  - After the loop, each `final[i]` gets `carry` (entered), `tieEvents` (`{ round, result, fraction, decidedBy, counted, carryAfter }`), and `carryNext`: events applied in order, won → 0, lost with `demand[i] > 0` at year end → previous + fraction rounded to 3 decimals, lost otherwise → unchanged.
  - Loop: stop if `pool === 0`. Participants are all colleges in round 1, else those with `demand > 0`; stop with `unallocated = pool` if none. Guard: stop if `round > n + 1` (unreachable by construction; see Termination). Run `hamilton`, then per row: `funded = min(allocated, demand)`, `surplus = allocated − funded`, update demand/awarded, mark settled. `pool = Σ surplus`.
  - Each round record keeps the full `hamilton` rows augmented with `demandBefore`, `funded`, `surplus`, `demandAfter`, `settled`, so the UI can render everything without recomputation.
- `validate(colleges, percent, minimum = 0) -> string[]` of user-facing error messages; empty means valid.

Termination argument: from round 2 on, every participant has `demand > 0`. A round either exhausts the pool (`Σ surplus = 0` → stop) or produces surplus, which requires some participant to have `allocated > demand`, which settles that participant and removes it from the next round. Participants strictly decrease, so at most `n` more rounds after round 1.

### Part 2: UI (IIFE in `src/sabbatical-allocation.html`)

- `const APPORTIONMENT = 'hamilton'` at the top of the IIFE is rewritten by `build.js` for the Webster deliverable. It is passed to `allocate` and selects `METHOD`, the rendering strategy (below).
- `state = { percent, rounding, minimum, tieMethod, colleges: [{ name, eligible, applicants, carry }] }`. `eligible`/`applicants` may be `NaN` while the user is typing; `validate` reports that. The array order is the list order and is significant under the list tie rule.
- `renderInputs()` rebuilds the input `<tbody>` from `state.colleges` (one row per college: position cell with a drag handle, text input, three number inputs, move-up, move-down and remove buttons) and calls `recalc()`. Event delegation on the `<tbody>` handles `input` (write back to state by `data-i`/`data-k`) and `click` on the move and remove buttons.
- Reordering: `moveCollege(from, to)` splices the array, sets `state.tieMethod = 'list'` if it was `'eligible'` (a list rule already chosen is kept), and re-renders (the user can change the select back). Drag uses the native HTML5 drag-and-drop API with no library: `mousedown` on the handle sets `draggable` on its row (so text in the inputs can still be selected), `dragover` marks the target row `drop-before` or `drop-after` from the pointer's position relative to the row's midpoint, and `drop` computes the target index (adjusted by one when moving downward). The arrow buttons are the keyboard and touch path.
- `recalc()`: trims names, updates input totals, runs `validate`. On errors: show the list, clear results. Otherwise: `computeSeatPool`, `allocate(cs, seats, tieMethod, APPORTIONMENT)`, store `lastResult`, render the seat-rule sentence, and set `#results.innerHTML = renderResults(...)`.
- `METHODS.hamilton` and `METHODS.webster`, each inside its marked script block, hold what differs between the methods in rendering: `label` (for the CSV), `sameThing` and `stake` (phrases in the unresolved-tie alert, the carry-forward table and `carryReason`), `tieHead(rd)` (the first sentence of `tieSentence`), `carryIntro` and `roundsIntro` (paragraphs), `narrative(rd, isFirst)` (the method-specific sentences of a round, returned as an array that `roundNarrative` completes with the matching-to-applicants sentences), `table(rd)`, `record(rd, rec)` (the round's lines in the step-by-step record, between the generic heading and tie line), `csvHeader`, `csvRows(rd)` and `csvExtra(res)` (Webster adds a seat-by-seat section). `METHOD = METHODS[APPORTIONMENT]`. The Webster table's columns are eligible, share, exact share, `eligible ÷ divisor = quotient`, allocated (with the tie label), claim that won its last seat, claim for one more seat, then the shared matching columns; its record lists every award with its runner-up, the cutoff, then one division per college.
- `renderResults()` builds, in order: seat flow boxes, notes (unallocated / unfunded), final allocation table, carry-forward report, round-by-round sections (`roundNarrative` + `METHOD.table` per round), and the step-by-step record inside a `<details>`. All are template strings; user-supplied names pass through `esc()`.
- Save: `formatInputsCsv(state.colleges)` to a Blob download. Load: `FileReader` → `parseInputsCsv` (or, for a file starting with `{`, the JSON shape earlier versions wrote) → `state.colleges`, `state.tieMethod = 'eligible'` → `renderInputs()`. Percent and rounding are not in the file and are left as set on the page.
- Print: `window.print()`. A `beforeprint` handler opens every `<details>` and `afterprint` restores their previous state, since CSS cannot reveal the content of a closed `<details>`. CSS `@media print` hides `.noprint`, page-breaks before each `h2`, and preserves the highlight colors.
- Method description: `<details id="method">` at the end of the page, a numbered procedure plus the reasoning for the two non-obvious rules. Links with class `methodlink` (one in the header, one in the round-by-round intro) set `open` on it via a delegated click handler before the anchor scrolls.

### Data formats

Inputs file (`sabbatical-inputs.csv`, also what "Save next year's starting inputs" writes):

```
College,Eligible faculty,Applicants,Carry forward
Humanities,39,13,0
Library,18,2,0.333
```

`parseInputsCsv` and `formatInputsCsv` live in `src/logic.js` so they are tested under Node. The parser detects the delimiter (comma, semicolon, tab) from the first line, handles quoted cells and a byte-order mark, recognises a header row by headings containing eligib/applic (then matches college/name and carry by heading, any order, extras ignored), falls back to positional columns without a header, skips blank rows and a row named "Total", reads blank applicants/carry as 0 and blank eligible as `NaN` (so `validate` reports it), and throws an `Error` whose message completes "could not be loaded: ...". Row order is the list order. Files starting with `{` are read as the JSON shape earlier versions saved (`{ colleges: [{ name, eligible, applicants, carry }] }`; other fields ignored). The same shape and the rules are documented for users in the page's "Files" section (`#method-files`), which must be kept in step with the parser; a failed load reports the parser's reason and points to that section. Bump `version` if the shape changes and keep the loader backward compatible. The "Save next year's starting inputs" button writes the same format with `carry` set to each college's `carryNext` and counts at 0.

## Design system

- Layout: left-aligned worksheet, max width 1280px. Sections are headings with a rule beneath, not cards.
- Type: serif (Palatino Linotype / Palatino / Book Antiqua / Georgia) for headings and the seat-rule sentence; system sans (Segoe UI / -apple-system / Helvetica / Arial) for body and tables; tabular figures throughout. System fonts only, because the file must work offline.
- Color roles (CSS variables in `:root`): `--pool` blue marks seats entering or extra seats assigned; `--return` amber marks seats returned or applicants unfunded; `--settled` green marks colleges done; `--error` red for validation and for unresolved ties. Neutral ink/muted/rule greys for everything else. Color always accompanies a number or label; nothing is conveyed by color alone.
- Tables: header text wraps to keep 13 columns within 1280px; `.tablewrap` scrolls horizontally on narrower screens.

## Testing

`test/logic.test.js` (node:test, no dependencies) covers: seat-pool rounding rules, the seat minimum (applied after rounding; a pool raised to it is divided like any other under both methods), the two floating-point cases that used to be wrong (375 × 18.4%, 250 × 64.4%), four-decimal percentages, half-up rounding, and a 5,000-case comparison against a BigInt reference; the CSUN test data's exact outcome (whole sum 41, five extra seats, Counseling's returned seat, round 2 of one seat among eight colleges to Social & Behavioral Sciences, 46 awarded, 54 unfunded); round-1 inclusion and later-round exclusion of a zero-applicant college; unallocated seats; zero seats; every tie-break rule (carry forward in thousandths, headcount, name) and every carry-forward outcome (loser with unfunded applicant adds the fraction, loser fully funded unchanged, winner reset and treated as having none in later rounds, accumulation past 1, three-decimal recording); every validation message; and a seeded fuzz of 3,000 random inputs checking the R4.7 invariants, the round bound, and that extra seats always go to fractions at least as large as those that got none. For Webster: the worked example (50/30/20, 11 seats: 6/3/2, divisor 9), the CSUN test data (same seats as Hamilton, divisor 8.5 in round 1, 129 in round 2), every tie-break rule and the unresolved case, a tie between claims for different seat numbers, carry forward in halves, and two fuzz checks: one that adding a seat never takes one away (house monotonicity), that awards are in claim order, that every winning claim beats every losing claim, that the divisor check reproduces the allocation whenever there is no tie, and that a tie's `tieDecidedBy` agrees with the comparator; and one repeating the R4.7 invariants under `allocate(…, 'webster')`.

`test/build.test.js` checks, for both deliverables, that `dist/` is byte-identical to what `build(method)` produces from `src/` (so a stale build fails `npm test`), that the file has no external script, stylesheet, URL, or web storage, that its script parses, that the logic part runs in a bare `vm` context with no DOM and allocates by the file's own method, that the ids and handlers the UI needs are present, that no build marker or run of blank lines survives, and that each file carries only its own method's text and rendering strategy while both carry the whole logic.

The UI has no other automated tests. `tools/screenshot.py` renders each built file headless at 1280px, fails on JS or console errors, checks that no results table needs horizontal scrolling, loads the test data (and, for Webster, checks the divisor sentence and the seat-by-seat record), exercises reordering, an unresolved tie and its resolution by list order, a non-integer percentage, the seat minimum applied and not applied and its validation message, file loading and a validation error, and writes `full.png` and `full-webster.png`.

## Extension points

- New apportionment method: add a function to `src/logic.js` returning the shared fields (`apportionment`, `total`, `rows` with `allocated`, `tie`, `tieFraction`, `carry`, `share`, `quota`; `ties`, `tieDecidedBy`, `unresolved`, `method`), add its name to `APPORTIONMENTS` and to the selection in `allocate`, add an entry to `OUTPUTS` in `build.js`, a `METHODS.<name>` strategy and the marked text blocks in the page, tests, and a screenshot check. Keep the tie rules and carry forward in the new function identical in meaning; only the arithmetic that places seats should differ.
- New tie-break rule: add an entry to `TIE_STEPS` (and a comparator to `TIE_STEP_CMP` if it needs a new step), add an `<option>` and a `TIE_METHOD_LABEL` entry in the UI, add a test, and update REQUIREMENTS R4.2 and the method text. The carry-forward year-end rule lives in `allocate`'s `final` mapping.
- Carry-over between years: add a column to the inputs CSV (parser, formatter, and the Files section), pass it into `allocate`, and add a column to the final table. Keep `allocate` pure.
- Institution branding / sign-off block for print: markup and CSS only, no logic change.
