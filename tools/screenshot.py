"""Headless render of the two deliverables in dist/ for visual review.

Usage:  python tools/screenshot.py            (needs: pip install playwright && playwright install chromium)

Opens each built file from file:// at 1280px wide, loads the test data, and:
  - prints any JavaScript errors or console errors (and exits non-zero if there were any),
  - checks that no results table needs horizontal scrolling at 1280px,
  - exercises reordering, one input edit, file loading and one validation error,
  - writes full.png (Hamilton) and full-webster.png (Webster), full-page screenshots with the test data loaded,
    in the repository root.
"""
import os
import sys
import tempfile

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = [
    ("hamilton", os.path.join(ROOT, "dist", "sabbatical-allocation.html"), os.path.join(ROOT, "full.png")),
    ("webster", os.path.join(ROOT, "dist", "sabbatical_webster.html"), os.path.join(ROOT, "full-webster.png")),
]


def check(p, method, dist, out, problems):
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.on("pageerror", lambda e: problems.append(f"{method}: page error: {e}"))
    page.on("console", lambda m: problems.append(f"{method}: console {m.type}: {m.text}") if m.type == "error" else None)
    page.goto("file:///" + dist.replace("\\", "/"))

    # The title names the method for the Webster page only.
    title = page.title()
    assert ("Webster method" in title) == (method == "webster"), title

    # Opens with the CSUN list and a prompt to enter counts.
    assert page.locator("#inputRows tr").count() == 10, "expected 10 college rows on open"
    assert "total is currently zero" in page.locator("#errors").inner_text()

    # Load the test data: 382 eligible, 100 applicants, 46 seats, two rounds under either method.
    page.click("#btnTest")
    rule = page.locator("#ruleOut").inner_text()
    assert "382 eligible faculty × 12% = 45.84, rounded up to 46 seats" in rule, rule
    assert "That is at least the minimum of 42 seats, so the pool is 46 seats" in rule, rule
    assert page.locator("#results h3", has_text="Round 2").count() == 1, "expected two rounds"
    assert page.locator("#results h3", has_text="Round 3").count() == 0
    results = page.locator("#results").inner_text()
    record = page.locator("#results").text_content()                   # the record is inside a closed <details>
    if method == "hamilton":
        assert "largest fractional parts" in results
        assert "Exact quota arithmetic" in results
    else:
        assert "8.5 faculty per seat" in results, "round 1 should use a divisor of 8.5"
        assert "Eligible ÷ divisor" in results
        assert "Seat 1 to Social & Behavioral Sciences: claim 75 ÷ 0.5 = 150.000" in record
        assert "Seat 46 to Health & Human Development" in record
        assert "Cutoff: the weakest claim that won a seat is 8.533" in record
        assert "Why Webster's method" in page.locator("#method").text_content()

    # Every results table fits at 1280px without horizontal scrolling.
    overflow = page.evaluate(
        "Array.from(document.querySelectorAll('.tablewrap')).filter(w => w.scrollWidth > w.clientWidth + 1).length"
    )
    if overflow:
        problems.append(f"{method}: {overflow} table(s) need horizontal scrolling at 1280px")

    assert "unresolved" not in results.lower(), "test data should have no unresolved tie"
    assert page.locator("#tieMethod").input_value() == "eligible"

    page.screenshot(path=out, full_page=True)

    # Reordering: move the first college down one row; the tie rule switches to list order.
    first = page.locator("#inputRows tr:nth-child(1) input[data-k=name]").input_value()
    page.click("#inputRows tr:nth-child(1) button[data-mv='1']")
    assert page.locator("#inputRows tr:nth-child(2) input[data-k=name]").input_value() == first
    assert page.locator("#inputRows tr:nth-child(1) td.pos").inner_text().strip().endswith("1")
    assert page.locator("#tieMethod").input_value() == "list", "reordering should select the list-order rule"
    record = page.locator("#results").text_content()
    assert "Tie rule: a tie at the cutoff goes to the larger carry forward, then to the college listed higher" in record
    page.select_option("#tieMethod", "list-only")
    assert "then to the college listed higher, with nothing after that" in page.locator("#results").text_content()
    page.click("#inputRows tr:nth-child(2) button[data-mv='-1']")     # reordering keeps a list rule that is already chosen
    assert page.locator("#tieMethod").input_value() == "list-only"
    page.select_option("#tieMethod", "eligible")                       # and it can be switched back
    assert "then to more eligible faculty" in page.locator("#results").text_content()
    page.click("#btnTest")                                             # restore the test data for the checks below

    # A tie at the cutoff is reported and marked. Two colleges of 50 and one of 0 applicants: with 3 seats the
    # third is a tie between the two equal colleges under either method; unresolved under the default rule.
    page.click("#btnClear")
    for name, elig, appl in [("P", 50, 50), ("Q", 50, 50)]:
        page.click("#btnAdd")
        row = page.locator("#inputRows tr").last
        row.locator("input[data-k=name]").fill(name)
        row.locator("input[data-k=eligible]").fill(str(elig))
        row.locator("input[data-k=applicants]").fill(str(appl))
    page.fill("#minimum", "0")                                         # no minimum, so that
    page.fill("#percent", "3")                                         # 100 × 3% = 3 seats
    assert "minimum" not in page.locator("#ruleOut").inner_text()
    text = page.locator("#results").inner_text()
    assert "Unresolved tie in round 1" in text, text
    assert "won tie, unresolved" in text and "lost tie, unresolved" in text
    page.select_option("#tieMethod", "list")
    text = page.locator("#results").inner_text()
    assert "Unresolved" not in text
    assert "decided by list order" in text, text
    assert ("fraction 0.500" in text) == (method == "hamilton")
    assert ("half a seat at stake" in text) == (method == "webster")
    page.click("#btnTest")

    # One input edit: a non-integer percentage is computed exactly.
    page.fill("#percent", "18.4")
    page.fill("#inputRows tr:nth-child(1) input[data-k=eligible]", "26")   # total becomes 375
    rule = page.locator("#ruleOut").inner_text()
    assert "375 eligible faculty × 18.4% = 69, rounded up to 69 seats" in rule, rule

    # Loading files: a file that is not a spreadsheet gives a message that says what is expected;
    # a CSV with a header row loads in file order and resets the tie rule; a headerless CSV loads too.
    tmp = tempfile.mkdtemp()
    bad = os.path.join(tmp, "notes.txt")
    with open(bad, "w", encoding="utf-8") as fh:
        fh.write("this is not a saved inputs file")
    page.set_input_files("#fileLoad", bad)
    page.wait_for_function("document.getElementById('errors').textContent.includes('could not be loaded')")   # FileReader is asynchronous
    msg = page.locator("#errors").inner_text()
    assert "could not be loaded: rows need at least three columns" in msg and "saved as CSV" in msg, msg
    page.select_option("#tieMethod", "list")
    csv = os.path.join(tmp, "inputs.csv")
    with open(csv, "w", encoding="utf-8-sig", newline="") as fh:              # as Excel writes it: BOM and CRLF
        fh.write("College,Eligible faculty,Applicants,Carry forward\r\nZeta,100,3,0\r\n\"Arts, Media\",50,2,0.5\r\n")
    page.set_input_files("#fileLoad", csv)
    page.wait_for_function("document.querySelectorAll('#inputRows tr').length === 2")
    assert page.locator("#inputRows tr:nth-child(1) input[data-k=name]").input_value() == "Zeta"
    assert page.locator("#inputRows tr:nth-child(2) input[data-k=name]").input_value() == "Arts, Media"
    assert page.locator("#inputRows tr:nth-child(2) input[data-k=carry]").input_value() == "0.5"
    rule = page.locator("#ruleOut").inner_text()                       # 150 × 18.4% = 27.6: the minimum applies
    assert "150 eligible faculty × 18.4% = 27.6, rounded up to 28 seats. That is fewer than the minimum of 42 seats, so the pool is 42 seats" in rule, rule
    assert "rounded up to 28 seats. That is fewer than the minimum of 42 seats, so the pool is 42 seats." in page.locator("#results").text_content()
    assert page.locator("#tieMethod").input_value() == "eligible", "loading a file returns the tie rule to its default"
    plain = os.path.join(tmp, "plain.csv")
    with open(plain, "w", encoding="utf-8") as fh:
        fh.write("A,10,1\nB,20,2\n")
    page.set_input_files("#fileLoad", plain)
    page.wait_for_function("document.getElementById('ruleOut').textContent.includes('30 eligible faculty')")
    page.click("#btnTest")

    # Validation errors: results withheld, message shown.
    page.fill("#minimum", "")
    assert "Minimum number of seats must be a whole number" in page.locator("#errors").inner_text()
    page.fill("#minimum", "42")
    page.fill("#inputRows tr:nth-child(1) input[data-k=applicants]", "999")
    assert "cannot exceed eligible faculty" in page.locator("#errors").inner_text()
    assert page.locator("#results").inner_text().strip() == ""

    browser.close()


def main() -> int:
    for _, dist, _ in PAGES:
        if not os.path.exists(dist):
            print(f"missing {dist}; run `npm run build` first")
            return 2
    problems = []
    with sync_playwright() as p:
        for method, dist, out in PAGES:
            check(p, method, dist, out, problems)
            print(f"wrote {out}")
    for line in problems:
        print(line)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
