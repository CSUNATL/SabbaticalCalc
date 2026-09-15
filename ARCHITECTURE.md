# Architecture

## Why a single HTML file

The users are committee members on Windows and macOS who must receive one artifact they can launch without installing anything. A self-contained HTML file is the only option that is one file, runs identically on both platforms, needs no runtime, and avoids macOS Gatekeeper and Windows SmartScreen. Rejected alternatives and why: Go/Tauri/Electron/PyInstaller (one binary per OS, unsigned-binary friction on macOS), Java jar (needs a JRE), Excel (multi-round exclusion logic is awkward in formulas, VBA blocked by default), hosted web app (a URL, not a launchable file, and tied to someone's server).

## Repository layout

```
CLAUDE.md            instructions for Claude Code
REQUIREMENTS.md      what the tool must do; policy rules; open items
ARCHITECTURE.md      this file
HANDOFF.md           record of the design conversation and reasoning
README.md            short user-facing readme
package.json         scripts only; no dependencies
build.js             splices src/logic.js into src/app.html -> dist/
src/logic.js         pure allocation logic (Node-testable)
src/app.html         page: CSS, markup, UI script, with /*__LOGIC__*/ marker
test/logic.test.js   node:test suite for src/logic.js
tools/screenshot.py  optional Playwright render for visual review
dist/sabbatical-allocation.html   the deliverable (build output)
```

`src/` is edited; `dist/` is generated. The only build step is string substitution: `build.js` reads `logic.js`, strips its `module.exports` line, and replaces `/*__LOGIC__*/` in `app.html`. No bundler, no minification. The deliverable is readable source, which is itself a verification feature.

## Runtime structure (inside the deliverable)

One `<script>` with two parts.

### Part 1: allocation logic (from `src/logic.js`)

Pure functions, no DOM.

- `computeSeatPool(colleges, percent, rounding) -> { totalEligible, percent, exact, seats, rounding }`
- `hamilton(parts, seats) -> { total, wholeSum, remainderSeats, rows, order, ties, tieDecidedBy }`
  - `parts`: `[{ idx, name, eligible, carry }]` for the colleges taking part; `carry` is the carry forward used for tie-breaks.
  - For each part: `num = seats × eligible`, `whole = floor(num / total)`, `remNum = num − whole × total` (the fractional part's numerator, an exact integer). `order` is rows sorted by `remNum` desc, `carryKey(carry)` desc (thousandths), `eligible` desc, `name` asc (English collation); the first `remainderSeats` entries get `remainderSeat = 1` and `allocated = whole + 1`. `rank` is the position in `order`.
  - `ties`: names of rows whose `remNum` equals the cutoff row's when the tie straddles the cutoff (i.e., the tie changed who got a seat). Empty otherwise. Those rows get `tie = 'won' | 'lost'`, and `tieDecidedBy` is `'carry' | 'eligible' | 'name'`: the first rule that separated the last winner from the first loser.
- `allocate(colleges, seats) -> { seats, rounds, final, unallocated, stopReason, totalAwarded }`
  - Maintains `demand[i]` (unfunded applicants), `awarded[i]`, `byRound[i]`, `settledIn[i]`, `carryNow[i]` (carry forward used for tie-breaks; cleared when the college wins a tie), and `tieEvents[i]`.
  - After the loop, each `final[i]` gets `carry` (entered), `tieEvents` (`{ round, result, fraction, decidedBy, counted, carryAfter }`), and `carryNext`: events applied in order, won → 0, lost with `demand[i] > 0` at year end → previous + fraction rounded to 3 decimals, lost otherwise → unchanged.
  - Loop: stop if `pool === 0`. Participants are all colleges in round 1, else those with `demand > 0`; stop with `unallocated = pool` if none. Guard: stop if `round > n + 1` (unreachable by construction; see Termination). Run `hamilton`, then per row: `funded = min(allocated, demand)`, `surplus = allocated − funded`, update demand/awarded, mark settled. `pool = Σ surplus`.
  - Each round record keeps the full `hamilton` rows augmented with `demandBefore`, `funded`, `surplus`, `demandAfter`, `settled`, so the UI can render everything without recomputation.
- `validate(colleges, percent) -> string[]` of user-facing error messages; empty means valid.

Termination argument: from round 2 on, every participant has `demand > 0`. A round either exhausts the pool (`Σ surplus = 0` → stop) or produces surplus, which requires some participant to have `allocated > demand`, which settles that participant and removes it from the next round. Participants strictly decrease, so at most `n` more rounds after round 1.

### Part 2: UI (IIFE in `app.html`)

- `state = { percent, rounding, colleges: [{ name, eligible, applicants }] }`. `eligible`/`applicants` may be `NaN` while the user is typing; `validate` reports that.
- `renderInputs()` rebuilds the input `<tbody>` from `state.colleges` (one row per college: text input, two number inputs, remove button) and calls `recalc()`. Event delegation on the `<tbody>` handles `input` (write back to state by `data-i`/`data-k`) and `click` on remove buttons.
- `recalc()`: trims names, updates input totals, runs `validate`. On errors: show the list, clear results. Otherwise: `computeSeatPool`, `allocate`, store `lastResult`, render the seat-rule sentence, and set `#results.innerHTML = renderResults(...)`.
- `renderResults()` builds, in order: seat flow boxes, notes (unallocated / unfunded), final allocation table, round-by-round sections (`roundNarrative` + `roundTable` per round), and the step-by-step record inside a `<details>`. All are template strings; user-supplied names pass through `esc()`.
- Save: serialize `state` (plus `format`/`version` fields) to a Blob download. Load: `FileReader` → JSON → coerce fields defensively → `renderInputs()`. CSV: built from `lastResult`, quoted fields, CRLF.
- Print: `window.print()`. A `beforeprint` handler opens every `<details>` and `afterprint` restores their previous state, since CSS cannot reveal the content of a closed `<details>`. CSS `@media print` hides `.noprint`, page-breaks before each `h2`, and preserves the highlight colors.
- Method description: `<details id="method">` at the end of the page, a numbered procedure plus the reasoning for the two non-obvious rules. Links with class `methodlink` (one in the header, one in the round-by-round intro) set `open` on it via a delegated click handler before the anchor scrolls.

### Data formats

Saved inputs (`sabbatical-inputs.json`):

```json
{ "format": "sabbatical-allocation-inputs", "version": 2,
  "percent": 12, "rounding": "down",
  "colleges": [ { "name": "Engineering", "eligible": 120, "applicants": 6, "carry": 0 } ] }
```

Loader accepts any file with a `colleges` array; missing `percent`/`rounding` fall back to defaults and a missing `carry` (version-1 files) is 0. Bump `version` if the shape changes and keep the loader backward compatible. The "Save next year's starting inputs" button writes the same format with `carry` set to each college's `carryNext` and counts at 0.

## Design system

- Layout: left-aligned worksheet, max width 1280px. Sections are headings with a rule beneath, not cards.
- Type: serif (Palatino Linotype / Palatino / Book Antiqua / Georgia) for headings and the seat-rule sentence; system sans (Segoe UI / -apple-system / Helvetica / Arial) for body and tables; tabular figures throughout. System fonts only, because the file must work offline.
- Color roles (CSS variables in `:root`): `--pool` blue marks seats entering or extra seats assigned; `--return` amber marks seats returned or applicants unfunded; `--settled` green marks colleges done; `--error` red for validation. Neutral ink/muted/rule greys for everything else. Color always accompanies a number or label; nothing is conveyed by color alone.
- Tables: header text wraps to keep 13 columns within 1280px; `.tablewrap` scrolls horizontally on narrower screens.

## Testing

`test/logic.test.js` (node:test, no dependencies) covers: seat-pool rounding rules; the example dataset's exact round-1 outcome (whole sum 103, five extra seats in a specific order, Science's 14 returned seats, Social Sciences 27 awarded / 3 unfunded); round-1 inclusion and later-round exclusion of a zero-applicant college; surplus pools; ties; zero seats; validation; and a seeded fuzz of 3,000 random inputs checking the R4.7 invariants and the round bound.

The UI has no automated tests. `tools/screenshot.py` renders the built file headless, fails loudly on JS errors, and exercises one input edit and one validation error.

## Extension points

- New tie-break rule: change only `hamilton`'s sort comparator and `tieDecidedBy`, add a test, update REQUIREMENTS R4.2 and the method text. The carry-forward year-end rule lives in `allocate`'s `final` mapping.
- Carry-over between years: add fields to `state`/JSON (`version: 2`), pass them into `allocate`, and add a column to the final table. Keep `allocate` pure.
- Institution branding / sign-off block for print: markup and CSS only, no logic change.
