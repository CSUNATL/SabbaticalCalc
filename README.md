# Faculty Affairs tools

Tools for Faculty Affairs at California State University, Northridge (CSUN). Each tool lives in its own folder under `tools/`, with its own README, agent instructions, source, tests and build. Tools don't share code.

This repository was `CSUNATL/SabbaticalCalc` until October 2026. The old address redirects here, and the sabbatical calculator's history from before the move is kept.

## Layout

```
tools/<tool>/   one folder per tool, with its own README.md and AGENTS.md
.github/        CI workflows, CODEOWNERS, pull request template
AGENTS.md       repository-wide rules for coding agents
CLAUDE.md       imports AGENTS.md for Claude Code
.gitattributes  LF line endings for text files, in every tool folder
.gitignore      OS and editor files, and spreadsheet and CSV data files
```

## Tools

| Tool | Folder | Owner | Purpose |
|---|---|---|---|
| Sabbatical allocation worksheet | [`tools/sabbatical-calculator/`](tools/sabbatical-calculator/) | @wiegleyj | Divides the sabbatical seat pool across colleges in proportion to eligible faculty, in rounds, by the Hamilton method, with a Webster's-method variant. Delivered as a single HTML file that works offline. |

## Working rules

- **One task = one branch = one pull request.** Start a branch from an up-to-date `main`, keep it to one task, and open a pull request when it's ready. Nobody pushes to `main` directly.
- **Pull requests are reviewed before merge.** CI runs every tool's tests on every pull request, including ones that change only root files, and they must pass.
- **No data files.** Never commit student, personnel, or any other real records. `.gitignore` excludes `*.xlsx`, `*.xls` and `*.csv` by default.
- **Adding a tool:** create `tools/<tool>/` with its own `README.md` and `AGENTS.md`, plus a `CLAUDE.md` containing only `@AGENTS.md`. Then add a row to the table above, a line to `.github/CODEOWNERS`, and a CI workflow for it. The workflow must run on every pull request, with no `paths:` filter on `pull_request`, so that it can be a required check without blocking pull requests that don't touch that tool.
