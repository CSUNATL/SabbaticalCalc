# Requirements

Status key: **[done]** implemented in v1.0; **[open]** not yet decided or built.

## 1. Purpose and users

- R1.1 **[done]** A calculator that allocates sabbatical seats across the colleges of a university in proportion to eligible faculty, so that a committee can compute, verify, and record the allocation.
- R1.2 **[done]** Users are committee members and administrators on Windows or macOS with no technical setup. Assume Chrome, Edge, Safari, or Firefox from the last two years.
- R1.3 **[done]** Users must be able to check every number by hand from the inputs shown on the page.

## 2. Deliverable

- R2.1 **[done]** Exactly one file, `sabbatical-allocation.html`, launched by double-click. No installer, no runtime, no admin rights.
- R2.2 **[done]** Works offline from `file://`. No external resources of any kind.
- R2.3 **[done]** No data leaves the browser. Persistence is only through files the user explicitly saves and loads.
- R2.4 **[done]** The same file behaves identically on Windows and macOS.

## 3. Inputs

- R3.1 **[done]** The user specifies how many colleges exist and their names; any number of colleges from 1 upward. Rows can be added and removed.
- R3.2 **[done]** Per college: name (required, unique, case-insensitive), eligible faculty (integer ≥ 0), applicants (integer ≥ 0, ≤ eligible), carry forward (number ≥ 0, default 0, taken from the previous year's carry-forward report).
- R3.3 **[done]** Seat pool = total eligible faculty × a percentage, default 12%, rounded to a whole number. The percentage is editable to four decimal places (ten-thousandths of a percent); more decimals are an input error. The product is computed in integer arithmetic, never floating point, so 375 × 18.4% is exactly 69. The rounding rule is selectable: round up (default), nearest (an exact half rounds up), down. The exact product (written out to at most six decimals) and the rounded result are both shown. Set to ten-thousandths by the owner on September 15, 2026.
- R3.4 **[done]** Invalid input blocks results and shows a list of specific, fixable messages. Results reappear as soon as inputs are valid.
- R3.5 **[done]** Inputs are loaded from a spreadsheet saved as CSV: one row per college with columns for the college name, eligible faculty, applicants and, optionally, carry forward. A header row is recognised by its headings (college/name, eligible, applicants, carry) so the columns may be in any order and extra columns are ignored; without a header the columns are taken in that order. Comma, semicolon and tab delimiters, quoted cells, a byte-order mark, blank rows and a "Total" row are handled. The colleges keep the file's order; the seat percentage and rounding rule stay as set on the page; the tie rule returns to its default. "Save inputs to file" writes the same four-column CSV, and "Save next year's starting inputs to file" writes it with next year's carry forwards and the counts cleared. The page's "Files" section shows the shape, linked from beside the buttons, and a failed load names the reason. Inputs files that earlier versions saved as JSON still load. Changed from JSON to CSV by the owner on September 15, 2026, because committees work in spreadsheets.
- R3.6 **[done]** The page opens with the ten CSUN colleges listed by name, with eligible faculty and applicants at zero, so the committee only enters the year's counts. A "Reset to CSUN colleges" button restores that list, and a "Load test data" button fills it with a fixed set of test counts (382 eligible, 100 applicants) for trying the worksheet. Names remain editable so the file can be used elsewhere.
- R3.7 **[done]** The list can be reordered: each row has a drag handle and move-up and move-down buttons (keyboard-accessible), and shows its position number. Reordering switches the tie rule (R4.2) to list order, because the order then matters; the user can switch it back. Set by the owner on September 15, 2026.
- R3.8 **[done]** The tie rule is selectable under the seat rule: carry forward then more eligible faculty (default); carry forward then list order then more eligible faculty; or carry forward then list order with nothing after. Reordering the list selects the second rule only if the first is in use; a list rule already chosen is kept.

## 4. Allocation rules (policy)

- R4.1 **[done]** Apportionment within a round uses the Hamilton (largest-remainder) method: each participating college's exact quota is `pool × eligible / (eligible of participants)`; each receives the whole-number part; remaining seats go one each to the largest fractional parts.
- R4.2 **[done]** Fractional parts are compared exactly (integer arithmetic). Ties at the cutoff are broken first by larger carry forward (compared in thousandths of a seat), then by the steps of the selected rule (R3.8): (1) *eligible faculty*, the default: larger eligible headcount; (2) *list order, then eligible faculty*: the college listed higher, then larger eligible headcount; or (3) *list order only*: the college listed higher, with no further step. College name is never a rule. If every step of the rule leaves the colleges equal, the tie is **unresolved**; in practice this can happen only under rule 1, because list positions are unique. The seat is then placed provisionally with the college listed higher so that the calculation can complete, and the page flags it: a red alert above the results naming the round, "unresolved" labels and a red row edge on the tied colleges in every table, a sentence in the round narrative naming the colleges and their positions, a note in the carry-forward report that the dependent carry forwards are provisional, and the record. Under either list-order rule a tie is always resolved, because positions are unique; the flag is implemented generically all the same. Ties that affect the outcome are reported with who won, who lost, and which rule decided, and the tied colleges are marked in every table (a "won tie" or "lost tie" label and a colored row edge, blue for won and amber for lost). Set by the owner on September 15, 2026.
- R4.3 **[done]** Round 1 includes every college, including colleges with zero applicants. Round-1 quotas depend only on headcounts.
- R4.4 **[done]** After apportionment, each college's allocation is matched to its unfunded applicants. Seats exceeding a college's unfunded applicants are returned to the pool. A college with no unfunded applicants is settled.
- R4.5 **[done]** Each subsequent round apportions the returned seats, by the same method, among only the colleges that still have unfunded applicants. Settled colleges are excluded.
- R4.6 **[done]** The process ends when the pool is empty or when no college has unfunded applicants. In the latter case leftover seats are reported as unallocated. A round-count guard (colleges + 1) prevents any loop.
- R4.7 **[done]** Invariants that must always hold and are checked by tests: per round, whole + extra = pool and funded + returned = pool; overall, awarded + unallocated = pool; no college is awarded more than its applicants; later rounds never include a settled college.
- R4.8 **[done]** Carry forward. Each college carries a fraction of a seat from previous years that is used only to break ties. At the end of the year: a college that won a tie at the cutoff resets to 0; a college that lost a tie and ends the year with an unfunded applicant adds the fractional part it lost (recorded to three decimals); every other college's value is unchanged, so it persists until that college wins a tie. Within a year, a college that has won a tie is treated as having no carry forward in later rounds. Set by the owner on September 15, 2026.

## 5. Output

- R5.1 **[done]** Seat-pool statement showing the arithmetic (`total × % = exact, rounded to N`).
- R5.2 **[done]** "Where the seats went": a flow from the pool through each round's funded and returned counts to the total awarded, with unallocated seats and unfunded applicants stated.
- R5.3 **[done]** Final allocation table per college: eligible, share of eligible, applicants, seats awarded, share of seats, awarded by round, unfunded applicants, outcome; with totals.
- R5.4 **[done]** For each round: a heading (pool, participants, participating headcount), a narrative in plain sentences describing exactly what happened, and a table with the exact quota written out as its arithmetic (pool × eligible ÷ participating headcount) and its result, whole seats, fraction, rank, extra seat, allocation, applicants awaiting, funded, returned, status; with totals.
- R5.5 **[done]** A step-by-step record listing every division and every seat movement in order, with checksums per round and overall, suitable for meeting minutes.
- R5.6 **[done]** A description of the full process on the page itself, written as numbered steps for a non-technical reader, with the reasoning behind round-1 inclusion and later-round exclusion. It is linked from the top of the page and from the round-by-round section; following a link opens it.
- R5.7 **[done]** CSV export of all round tables and the final table.
- R5.8 **[done]** Print / save-as-PDF with controls hidden and the collapsed sections (method description, step-by-step record) expanded. Expansion is done by script on the print event, because CSS cannot open a closed `<details>`.
- R5.9 **[done]** Results update immediately on any input change; there is no separate "calculate" step.
- R5.10 **[done]** A "Carry forward for next year" report: per college, the value entered, every tie this year (round, won or lost, fraction), the value for next year, and the reason in a sentence; changed values highlighted; a button to save next year's starting inputs file. Ties also appear in the round narrative, the record, and the CSV. The CSV states the tie rule in use and, per round row, the rule that decided a tie and the college's position in the list. The record states the tie rule and the list order.

## 6. Quality

- R6.1 **[done]** Allocation logic is separable from the UI and covered by automated tests, including randomized invariant checks and a BigInt reference check of the seat pool. A second test file checks that the built file matches `src/` and is self-contained.
- R6.2 **[done]** Keyboard-accessible controls with visible focus; labels on all inputs.
- R6.3 **[done]** Layout readable at 1280px wide without horizontal scrolling of the round tables; usable on narrower screens with scrolling tables.

## 7. Open items

- R7.1 **[open]** Confirm the seat-pool rounding rule against the governing policy text. The default was changed from round down to round up on September 15, 2026 at the owner's request.
- R7.2 **[open]** Three tie rules are offered (R4.2). Still to confirm against the policy text which should be the default, and whether an unresolved tie under the eligible-faculty rule should be placed provisionally by list order (the current behavior) or withheld.
- R7.3 **[open]** Whether multi-year carry-over of unallocated seats or of unfunded applicants is in scope. Not built; it would be another column in the inputs CSV.
- R7.4 **[open]** Whether a college should be able to cap its own participation (e.g., a college declining seats) separately from applicant count. Not built.
- R7.5 **[open]** Whether the deliverable should carry institution name, academic year, and a committee sign-off block in the printed output.
