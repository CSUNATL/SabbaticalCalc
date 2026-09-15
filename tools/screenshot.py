"""Headless render of dist/sabbatical-allocation.html for visual review.

Usage:  python tools/screenshot.py            (needs: pip install playwright && playwright install chromium)

Opens the built file from file:// at 1280px wide, loads the test data, and:
  - prints any JavaScript errors or console errors (and exits non-zero if there were any),
  - checks that no results table needs horizontal scrolling at 1280px,
  - exercises one input edit and one validation error,
  - writes full.png (full-page screenshot with the test data loaded) next to this script's parent directory.
"""
import os
import sys

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist", "sabbatical-allocation.html")
OUT = os.path.join(ROOT, "full.png")


def main() -> int:
    if not os.path.exists(DIST):
        print(f"missing {DIST}; run `npm run build` first")
        return 2
    problems = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.on("pageerror", lambda e: problems.append(f"page error: {e}"))
        page.on("console", lambda m: problems.append(f"console {m.type}: {m.text}") if m.type == "error" else None)
        page.goto("file:///" + DIST.replace("\\", "/"))

        # Opens with the CSUN list and a prompt to enter counts.
        assert page.locator("#inputRows tr").count() == 10, "expected 10 college rows on open"
        assert "total is currently zero" in page.locator("#errors").inner_text()

        # Load the test data: 382 eligible, 100 applicants, 46 seats, two rounds.
        page.click("#btnTest")
        rule = page.locator("#ruleOut").inner_text()
        assert "382 eligible faculty × 12% = 45.84, rounded up to 46 seats" in rule, rule
        assert page.locator("#results h3", has_text="Round 2").count() == 1, "expected two rounds"
        assert page.locator("#results h3", has_text="Round 3").count() == 0

        # Every results table fits at 1280px without horizontal scrolling.
        overflow = page.evaluate(
            "Array.from(document.querySelectorAll('.tablewrap')).filter(w => w.scrollWidth > w.clientWidth + 1).length"
        )
        if overflow:
            problems.append(f"{overflow} table(s) need horizontal scrolling at 1280px")

        assert "unresolved" not in page.locator("#results").inner_text().lower(), "test data should have no unresolved tie"
        assert page.locator("#tieMethod").input_value() == "eligible"

        page.screenshot(path=OUT, full_page=True)

        # Reordering: move the first college down one row; the tie rule switches to list order.
        first = page.locator("#inputRows tr:nth-child(1) input[data-k=name]").input_value()
        page.click("#inputRows tr:nth-child(1) button[data-mv='1']")
        assert page.locator("#inputRows tr:nth-child(2) input[data-k=name]").input_value() == first
        assert page.locator("#inputRows tr:nth-child(1) td.pos").inner_text().strip().endswith("1")
        assert page.locator("#tieMethod").input_value() == "list", "reordering should select the list-order rule"
        record = page.locator("#results").text_content()                   # the record is inside a closed <details>
        assert "Tie rule: a tie at the cutoff goes to the larger carry forward, then to the college listed higher" in record
        page.select_option("#tieMethod", "list-only")
        assert "then to the college listed higher, with nothing after that" in page.locator("#results").text_content()
        page.click("#inputRows tr:nth-child(2) button[data-mv='-1']")     # reordering keeps a list rule that is already chosen
        assert page.locator("#tieMethod").input_value() == "list-only"
        page.select_option("#tieMethod", "eligible")                       # and it can be switched back
        assert "then to more eligible faculty" in page.locator("#results").text_content()
        page.click("#btnTest")                                             # restore the test data for the checks below

        # One input edit: a non-integer percentage is computed exactly.
        page.fill("#percent", "18.4")
        page.fill("#inputRows tr:nth-child(1) input[data-k=eligible]", "26")   # total becomes 375
        rule = page.locator("#ruleOut").inner_text()
        assert "375 eligible faculty × 18.4% = 69, rounded up to 69 seats" in rule, rule

        # Loading files: a file that is not JSON gives a message that says what is expected; a minimal
        # hand-written file with only the required fields loads.
        import tempfile, json
        tmp = tempfile.mkdtemp()
        bad = os.path.join(tmp, "notes.txt")
        with open(bad, "w", encoding="utf-8") as fh:
            fh.write("this is not a saved inputs file")
        page.set_input_files("#fileLoad", bad)
        msg = page.locator("#errors").inner_text()
        assert "could not be loaded: it is not in JSON format" in msg and '"colleges" list' in msg, msg
        minimal = os.path.join(tmp, "minimal.json")
        with open(minimal, "w", encoding="utf-8") as fh:
            json.dump({"colleges": [{"name": "A", "eligible": 100, "applicants": 3}, {"name": "B", "eligible": 50, "applicants": 2}]}, fh)
        page.set_input_files("#fileLoad", minimal)
        assert page.locator("#inputRows tr").count() == 2
        assert "150 eligible faculty" in page.locator("#ruleOut").inner_text()
        assert page.locator("#tieMethod").input_value() == "eligible"
        page.click("#btnTest")

        # One validation error: results withheld, message shown.
        page.fill("#inputRows tr:nth-child(1) input[data-k=applicants]", "999")
        assert "cannot exceed eligible faculty" in page.locator("#errors").inner_text()
        assert page.locator("#results").inner_text().strip() == ""

        browser.close()

    for line in problems:
        print(line)
    print(f"wrote {OUT}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
