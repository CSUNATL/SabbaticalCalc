# Sabbatical Seat Allocation

`index.html` is a complete, offline sabbatical-allocation calculator. It implements the institutional rules in `BRIEF.md`, reports invalid inputs beside the affected fields, shows final results, and exposes every Hamilton quota and capacity adjustment in a round-by-round audit trail.

## Launch

Double-click `index.html`, or open it from any current desktop browser. The file has no dependencies, does not need a web server, and makes no network requests. It can be copied or emailed as the single end-user deliverable.

## Technology and structure

The application is one self-contained HTML file using standards-based HTML, CSS, and JavaScript. This was chosen because committee members on Windows and macOS can run it without installation, administrator rights, or an internet connection. Keeping the styling and code inside the artifact also prevents missing-file problems when it is shared.

Within `index.html`:

- Semantic HTML provides the input form, accessible validation, results, and expandable audit rounds.
- CSS provides responsive screen and print layouts without fonts or assets from the internet.
- The `allocation-core` script contains the pure calculation functions. It uses integer arithmetic for seat rounding and Hamilton floors/remainders so floating-point approximations do not determine awards.
- The final script manages rows, validates user input, and renders the human-readable report.

No input is stored or transmitted. Refreshing or closing the page clears it.

## Decisions left open by policy

Available seats are **12% of total eligible faculty, with any fractional result rounded up to the next whole seat**. The app shows both the exact value and rounded count. Internally this is calculated as `floor((total × 12 + 99) / 100)`, avoiding binary floating-point rounding issues for non-negative whole-number inputs.

Hamilton fractional-remainder ties are resolved deterministically by:

1. more eligible faculty;
2. college name A–Z, case-insensitive; then
3. original entry order.

The rule is displayed in the interface and applied in every round. Names must be non-empty and unique (case-insensitive), so audit reports remain unambiguous.

The first round includes every college, even one with no applicants. Later rounds include only colleges with unfunded applicants, as required. Seats that cannot be used are returned; if no unfunded applicant remains, the report labels those seats unallocated.

## Tests

Automated tests require Node.js only for development; end users do not need it:

```text
node tests/allocation.test.cjs
```

The test runner extracts and executes the same `allocation-core` code embedded in `index.html`, so the artifact and tests cannot silently use different implementations. No packages or build step are required.

For a quick manual check, open `index.html`, enter eligible-faculty and applicant counts for the prepopulated colleges, and select **Calculate allocation**. **Reset college list** restores the original ten-college roster with zero counts. Resize the window to verify the mobile layout; use **Print report** to preview the printable audit report.

## Build

There is no build step. Edit `index.html` directly and rerun the tests. The checked-in HTML is both source and launchable artifact.
