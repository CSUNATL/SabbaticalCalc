# Sabbatical allocation worksheet

A single HTML file that divides a pool of sabbatical seats across the colleges of a university in proportion to their eligible faculty, using the Hamilton (largest-remainder) method in rounds. It was written for the Faculty Senate at California State University, Northridge (CSUN), but the college list is editable and the file can be used anywhere.

Every number the page produces can be checked by hand from the inputs shown on it. Each round is described in plain sentences and in a full table, and a step-by-step record lists every division and every seat movement with checksums.

## Using the worksheet

1. Download `dist/sabbatical-allocation.html` and double-click it. It opens in any current browser on Windows or macOS. Nothing is installed and nothing is sent anywhere; the page works with the computer offline.
2. Enter each college's eligible faculty and applicants. The ten CSUN colleges are listed on open. Colleges can be added, removed, or renamed.
3. Enter each college's carry forward from the previous year's report, if any. Or load all of it at once from a spreadsheet saved as CSV with columns for college, eligible faculty, applicants, and carry forward; the page's "Files" section shows the shape.
4. Results update as you type. Use the buttons at the top to save the inputs to a CSV file, load them again later, download the results as CSV, or print.

The seat pool is a percentage of all eligible faculty (12% by default, rounded up by default). Both are adjustable on the page. "How is the allocation calculated?" at the top of the page opens a numbered description of the whole procedure and the reasoning behind its rules.

## Repository layout

```
dist/sabbatical-allocation.html   the deliverable (built; do not edit by hand)
src/logic.js                      pure allocation logic, testable under Node
src/sabbatical-allocation.html    page: CSS, markup, and UI script (source of the deliverable)
build.js                          splices src/logic.js into src/sabbatical-allocation.html -> dist/
test/logic.test.js                allocation tests, including randomized invariant checks
test/build.test.js                checks that dist/ matches src/ and is self-contained
tools/screenshot.py               optional headless render for visual review
codex/                            an independent implementation of the same brief, kept for comparison
```

`REQUIREMENTS.md` states what the tool must do and which policy questions are still open. `ARCHITECTURE.md` describes the structure. `HANDOFF.md` records the design conversation and the reasoning behind the non-obvious rules. `CLAUDE.md` holds the working instructions for Claude Code.

## Development

Node 20 or later. There are no dependencies to install.

```
npm test          # run the tests
npm run build     # rebuild dist/sabbatical-allocation.html from src/
npm run check     # build, then test
python tools/screenshot.py   # optional: render dist/ headless, report JS errors, write full.png
```

Edit `src/logic.js` or `src/sabbatical-allocation.html`, then run `npm run check` before committing. The screenshot tool needs `pip install playwright` and `playwright install chromium`.

## License

MIT.
