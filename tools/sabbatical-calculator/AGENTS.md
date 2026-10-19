# AGENTS.md

Instructions for coding agents working on this tool. It lives in `tools/sabbatical-calculator/` of the faculty-affairs-tools repository; the repository-wide rules are in the root `AGENTS.md`, so read that too. Paths below are relative to this folder. `CLAUDE.md` here only imports this file, for Claude Code.

Sabbatical allocation worksheet: a single self-contained HTML file that divides a pool of sabbatical seats across university colleges in proportion to eligible faculty, using the Hamilton (largest-remainder) method in rounds. The deliverable is `dist/sabbatical-allocation.html`, which committee members on Windows or macOS open by double-clicking. A second deliverable, `dist/sabbatical_webster.html`, is the same worksheet with Webster's method inside each round; both are built from the same source. There is no server, no framework, no external dependency at runtime.

Read `REQUIREMENTS.md` before changing behavior and `ARCHITECTURE.md` before changing structure. `HANDOFF.md` records the design conversation and the reasoning behind the non-obvious rules. `MethodAnalysis.md` compares the apportionment methods and records why the Webster file exists.

## Commands

Run these from this folder (`tools/sabbatical-calculator/`), not from the repository root.

```
npm test          # node --test, runs test/*.test.js against src/logic.js
npm run build     # splices src/logic.js into src/sabbatical-allocation.html -> dist/sabbatical-allocation.html and dist/sabbatical_webster.html
npm run check     # build then test (the build test fails if either dist/ file is stale)
python3 tools/screenshot.py   # optional: headless render of both dist/ files, prints JS errors, writes full.png and full-webster.png
```

Node 20+ only. No `npm install` is needed; there are no dependencies. Do not add any without a reason stated in ARCHITECTURE.md.

## Hard constraints

- The deliverable stays one `.html` file with no network requests, no external scripts, fonts, or stylesheets. It must work from `file://` with the browser offline.
- `src/logic.js` is pure: no DOM, no globals other than its function definitions, and it must keep working under Node (`module.exports` guard at the bottom). All allocation arithmetic lives there and nowhere else.
- Apportionment comparisons use integer arithmetic (`seats * eligible` mod `total`), never rounded decimals. Do not "simplify" this to floating point. The seat pool likewise uses the percentage in ten-thousandths as an integer.
- The allocation rules in REQUIREMENTS.md sections 3 and 4 are policy, not implementation detail. Do not change round-1 participation, the exclusion of settled colleges from later rounds, the three tie-break rules (carry forward, then headcount; or list order then headcount; or list order alone; name is never a rule), the unresolved-tie flag, or the carry-forward year-end rule without an explicit request. The Webster file (R4.9) changes only the arithmetic that places seats within a round; every other rule is shared, and the two must not drift apart.
- The two deliverables come from one page source. Text or code that belongs to one method goes inside `<!--[hamilton]-->…<!--[/hamilton]-->` / `<!--[webster]-->…<!--[/webster]-->` in markup or `/*[hamilton]*/…/*[/hamilton]*/` / `/*[webster]*/…/*[/webster]*/` in script; `build.js` keeps one and strips the other. Do not duplicate the page, and do not put a method's wording outside its block. Both `hamilton()` and `webster()` stay in `src/logic.js` and in both built files.
- Never commit a `dist/` file that was not produced by `npm run build` from the current `src/`.

## Workflow

1. Edit `src/logic.js` and/or `src/sabbatical-allocation.html`. The `/*__LOGIC__*/` marker in the page is where `build.js` inserts the logic; keep it. Keep the method block markers balanced; the build refuses to write if one is left over.
2. `npm run check`. Every test must pass. If you change allocation behavior, add or update a test first, for both methods where the change touches shared rules. `test/build.test.js` compares both `dist/` files with the build output, so `npm test` alone fails after a `src/` edit until you rebuild.
3. If UI changed, run `tools/screenshot.py` (needs `pip install playwright && playwright install chromium`) and look at `full.png` and `full-webster.png`. Check that the round tables still fit at 1280px wide without horizontal scrolling and that no JS errors are printed.
4. Update ARCHITECTURE.md or REQUIREMENTS.md if the change affects what they describe.

## Conventions

- Vanilla JS, ES2020, no build tooling beyond `build.js`. No TypeScript, no bundler, no framework.
- UI code in `src/sabbatical-allocation.html` is one IIFE. Rendering functions return HTML strings; state is a single `state` object; every input change calls `recalc()` which re-validates and re-renders results from scratch. Keep it that way; do not introduce incremental DOM patching.
- All user-facing text is plain sentence-case English written for a faculty committee, not for developers. Say "seat", "college", "applicant", "settled", "returned to the pool". Never expose internal names like `remNum` or `demandBefore` in the UI.
- Escape anything derived from user input with `esc()` before inserting into HTML.
- Numbers in tables use tabular figures; quotas and fractions show 3 decimals; shares show 1 decimal percent.
- Keep printing working: `.noprint` on controls, and the `beforeprint`/`afterprint` handlers that open every `<details>` for printing and restore it afterwards (CSS alone cannot open a closed `<details>`).

## What not to do

- Do not add localStorage or any persistence beyond the explicit save/load CSV file. The user chose file-based persistence deliberately.
- Do not add a dark mode, animations, icons, or a CSS framework.
- Do not replace the narrative paragraphs with terser output. The verbosity is a requirement: committees must be able to verify every step.
