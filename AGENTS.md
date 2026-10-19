# AGENTS.md

Repository-wide rules for coding agents. They apply to every tool in this repository. See `README.md` for the layout and the list of tools.

- Each tool lives in its own folder under `tools/`, with its own `AGENTS.md`. Read it before changing files there. Its rules add to these.
- Stay within the folder of the tool being worked on. Don't change another tool's folder, or files at the repository root, unless the task asks for it.
- Never commit data files: student, personnel, or any other real records. `.gitignore` excludes `*.xlsx`, `*.xls` and `*.csv`; don't force-add such files or add exceptions for them unless asked.
- Run the tool's tests before declaring work done, from the tool's folder, as its `AGENTS.md` describes. Report failures as they are.
- Keep changes small: one task per pull request, on its own branch. Never commit directly to `main`.
