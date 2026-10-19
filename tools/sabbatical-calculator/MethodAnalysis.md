# Method analysis: is Hamilton the right apportionment method for sabbatical seats?

Written September 18, 2026, in answer to the question: given the Alabama paradox, is there a fairer way for CSUN to divide sabbatical seats among colleges than the Hamilton method? Would Webster, Huntington-Hill, or another method be better?

This is an assessment. The allocation rules in REQUIREMENTS.md sections 3 and 4 are policy, and any change described here is a policy decision for the Senate before it is a code change.

Status, September 18, 2026: the "Webster in rounds" option below was built at the owner's request as `dist/sabbatical_webster.html`, alongside the unchanged Hamilton file; see REQUIREMENTS.md R4.9 and HANDOFF.md, session 4. The single-pass option has not been built.

## Short answer

1. Webster's method (called Sainte-Laguë in Europe) is the better choice for this purpose and is the one the apportionment literature recommends. It has no Alabama paradox, no population paradox, and no new-states paradox, and at CSUN's scale it never left quota in 20,000 simulated years.
2. Huntington-Hill is a poor fit. It guarantees every college at least one seat regardless of share, which is a U.S. constitutional requirement rather than a fairness property, and it is undefined when the pool is smaller than the number of colleges, which is exactly the situation in the tool's later rounds.
3. The round structure has a larger effect on fairness than the choice between Hamilton and Webster. With a small surplus, later rounds hand seats to the largest colleges regardless of how the first round rounded them. A single-pass method that caps each college at its applicants removes that tilt and is simpler to audit.
4. Recommendation: at minimum, replace Hamilton with Webster inside the existing rounds. Better, replace the rounds with Webster capped at applicants in a single pass, shown as a seat-by-seat table.

## Background

An apportionment method divides a whole number of seats among groups in proportion to their sizes. Two families are in use.

**Largest-remainder methods** (Hamilton, also called Vinton or Hare-Niemeyer). Compute each group's exact share, give each group the whole part, and give the leftover seats one each to the groups with the largest fractional parts. Hamilton always satisfies *quota*: every group gets its exact share rounded either down or up. Its weakness is that it is not monotone. Three named paradoxes follow:

- *Alabama paradox.* Adding a seat to the house can take a seat away from a group whose size did not change. Found in the 1880 U.S. census calculation, where Alabama would have received 8 seats in a House of 299 and 7 in a House of 300.
- *Population paradox.* Group A grows faster than group B, yet A loses a seat and B gains one.
- *New-states paradox.* Adding a group, with seats added for it, can move a seat between two other groups.

**Divisor methods** (Jefferson, Webster, Huntington-Hill, Dean, Adams). Choose a divisor, the number of faculty per seat, divide each group's size by it, round by the method's rule, and adjust the divisor until the rounded values total the house. Equivalently, hand out seats one at a time to the group with the strongest claim, where the claim for a group's next seat is its size divided by a signpost that depends on the seats it already holds. Divisor methods are house-monotone and population-monotone, so none of the three paradoxes can occur. Their cost is that they can, rarely, give a group a seat count outside its quota.

| Method | Rounding rule | Signpost for seat *a*+1 | Bias |
|---|---|---|---|
| Adams | always up | *a* | toward small groups, strongly |
| Dean | at the harmonic mean | *a*(*a*+1) / (*a*+½) | toward small groups |
| Huntington-Hill | at the geometric mean | √(*a*(*a*+1)) | toward small groups, slightly |
| Webster | to nearest | *a* + ½ | none |
| Jefferson (D'Hondt) | always down | *a* + 1 | toward large groups |

Balinski and Young proved that no method can both satisfy quota and be free of the population paradox. The choice is therefore between Hamilton's quota guarantee and a divisor method's monotonicity. They showed that Webster is the unique divisor method that is unbiased between large and small groups, and that it is the divisor method that stays nearest quota; they recommend it. Their *quota method* of 1975 is house-monotone and satisfies quota but is not population-monotone and is complicated to explain; it has never been adopted anywhere and is not considered further here.

The U.S. House used Hamilton from 1852 to 1900, abandoned it after the paradox appeared in the 1880 and 1900 calculations, used Webster in 1911 and 1931, and has used Huntington-Hill since 1941. Germany, New Zealand, Norway, and others use Webster for parliamentary seats.

## Why not Huntington-Hill

- The signpost for a group's first seat is √(0·1) = 0, so every group with any members has an infinite claim to its first seat. Every college with at least one eligible faculty member receives a seat before proportionality enters at all. For a college with a handful of eligible faculty this is a distortion, not a fairness property.
- Because every college must receive at least one seat, the method has no solution when the pool is smaller than the number of colleges. In the tool's later rounds the pool is often one or two seats among eight or nine unsettled colleges. Huntington-Hill cannot rank them.
- Rounding at the geometric mean is harder to explain to a faculty committee than rounding to nearest. The U.S. adopted it for reasons specific to the House, not because it is easier or fairer in general.

Jefferson and Adams are not fairer than Hamilton; they are biased in opposite directions. On the CSUN test data Jefferson moves a seat from MDECOE to DNCBE and Adams moves one from CHHD to DNCBE, in each case away from the exact shares.

## What it means at CSUN's scale

All numbers below come from running `src/logic.js` (the current Hamilton implementation) and a Webster implementation over the CSUN test data and over random campuses. The appendix describes the simulation precisely.

### The test data

Ten colleges, 382 eligible faculty, 100 applicants, 46 seats (12 percent rounded up).

| College | Eligible | Applicants | Quota | Hamilton, round 1 | Webster, round 1 |
|---|---:|---:|---:|---:|---:|
| CECS | 33 | 6 | 3.974 | 4 | 4 |
| CHHD | 64 | 12 | 7.707 | 8 | 8 |
| COH | 39 | 13 | 4.696 | 5 | 5 |
| COUNSELING | 9 | 0 | 1.084 | 1 | 1 |
| CSBS | 75 | 21 | 9.031 | 9 | 9 |
| CSM | 45 | 16 | 5.419 | 5 | 5 |
| DNCBE | 38 | 13 | 4.576 | 4 | 4 |
| LIBRARY | 18 | 2 | 2.168 | 2 | 2 |
| MCCAMC | 39 | 10 | 4.696 | 5 | 5 |
| MDECOE | 22 | 7 | 2.649 | 3 | 3 |

Hamilton and Webster agree on every college in round 1, and they agree on the final allocation after the second round (CSBS 10, COUNSELING 0, everyone else as above). Switching the rounding method would not change this year's result.

### Alabama paradox on the CSUN headcounts

With the headcounts above held fixed and the pool varied from 1 to 120 seats, Hamilton takes a seat away from a college six times as the pool grows by one:

| Pool | College that loses a seat |
|---|---|
| 63 to 64 | CECS and COUNSELING (both) |
| 72 to 73 | LIBRARY |
| 76 to 77 | LIBRARY |
| 95 to 96 | LIBRARY |
| 104 to 105 | COUNSELING |
| 112 to 113 | MDECOE |

None of these is near 46, so the risk in any given year is small. But the pool moves with total headcount every year, and the losers are the small colleges, as the theory predicts. Webster shows no instance across the same range.

### Random campuses

20,000 random ten-college campuses, headcounts drawn uniformly from 5 to 100, pool 12 percent rounded up.

| Check | Hamilton | Webster |
|---|---:|---:|
| Round-1 result differs between the two methods | 16.8% of campuses | |
| Some college loses a seat when the pool grows by one | 3.9% | 0 |
| Population paradox from one year to the next, each college moving by up to 3 faculty | 0.36% | 0 |
| Some college outside quota | never | 0 of 20,000 |

The population paradox is the one a committee would actually see: a college gains faculty relative to another, the pool is recomputed, and the college that grew loses a seat to the one that shrank. It is rare at this scale but it happens, and it has no defensible explanation. Under Webster it cannot happen.

Webster's theoretical cost, leaving quota, did not occur once at this scale.

## The round structure matters more

The tool applies the method in rounds: apportion the pool among all colleges, fund each college up to its applicants, return the surplus, and apportion the surplus among the colleges that still have unfunded applicants. HANDOFF.md section 3 already notes that with a small pool the remainder seats track headcount. The consequence for fairness is larger than the Hamilton-versus-Webster question.

In the test data, after round 1 CSBS holds 9 seats against a quota of 9.031 and DNCBE holds 4 against 4.576. COUNSELING returns its seat. Round 2 apportions one seat among nine unsettled colleges, and one seat goes to the largest headcount: CSBS, now at 10 against a quota of 9.031, while DNCBE stays at 4 against 4.576. Round 2 does not know how round 1 rounded anyone. Webster inside the same rounds does exactly the same thing, because one seat among nine colleges goes to the largest claim, which is the largest headcount.

A single-pass method that caps each college at its applicants gives that seat to DNCBE, whose claim for a fifth seat (38 ÷ 4.5 = 8.44 faculty per seat) beats CSBS's claim for a tenth (75 ÷ 9.5 = 7.89).

Over 20,000 random campuses with realistic demand (20 to 35 percent of eligible faculty applying, one college in ten with no applicants):

| Rounds versus single pass | |
|---|---:|
| Final allocation differs | 62.7% of campuses |
| Seats moved when they differ, mean | 1.3 |
| Seats moved when they differ, maximum | 3 |
| Mean eligible faculty of colleges that do better under rounds | 57.5 |
| Mean eligible faculty of colleges that do worse under rounds | 50.1 |
| Unallocated seats differ | never |

The rounds systematically favor larger colleges in the redistribution. Whether the pool ends up fully placed is the same either way.

### The single-pass method

This is the standard extension of a divisor method to maximum requirements (Balinski and Young; Pukelsheim). Stated for a committee:

> Each college's claim to its next seat is its eligible faculty divided by the seats it already has plus one half. Hand out seats one at a time to the strongest claim among the colleges that still have an unfunded applicant. Stop when the pool is empty or every applicant is funded.

Properties:

- It is Webster with a cap at applicants. Colleges whose proportional share exceeds their demand are held at their demand, and the rest absorb the surplus in proportion, with a single rounding rather than a sum of roundings.
- The output is one table with a row per seat: seat number, college, the claim that won it, the college's seats after. Anyone can check any row with one division.
- Adding a seat adds a row. The Alabama paradox is impossible by construction, and the monotonicity guarantees hold for the whole allocation, not round by round.
- It always terminates and never strands a seat while an applicant is unfunded.
- The design goals recorded in HANDOFF.md section 2 are preserved. Each college's entitlement from headcount alone (uncapped Webster) can still be shown as a column for audit, computed in advance from one table. The surplus still goes only to colleges with unfunded applicants. Zero applicants is still not a special case.
- The tie rule carries over. Two colleges tie when their claims are equal, which is an exact integer test: eligible₁ × (2 × seats₂ + 1) = eligible₂ × (2 × seats₁ + 1). Carry forward, then list order or headcount, then the unresolved flag apply as now.

### Carry forward under Webster

The current carry-forward rule is written in terms of Hamilton's lost fraction. Under Webster it simplifies. At a tie for the last seat, both colleges have the same claim; at the divisor equal to that claim, the loser's exact share is its seats plus one half. Every tie loser is exactly half a seat short. So the carry forward becomes half a seat per tie lost, or equivalently a count of tie losses, cleared when the college wins a tie. The year-end rule (a loser whose applicants were all funded anyway adds nothing) still applies. REQUIREMENTS.md section 4.8 and the on-page method text would need restating; the mechanism does not change.

## Options

| Option | Removes the paradoxes | Removes the large-college tilt in redistribution | Change to the page | Change to the policy text |
|---|---|---|---|---|
| Keep Hamilton in rounds (today) | no | no | none | none |
| Webster in rounds | yes, round by round | no | replace `hamilton()`; round tables show claims instead of remainders | rounding rule |
| Webster with caps, single pass | yes, for the whole allocation | yes | replace rounds with a seat-by-seat table; keep the entitlement table for audit | rounding rule, round structure, carry-forward amount |
| Huntington-Hill | yes | no | not workable in later rounds | not recommended |

Recommendation: Webster with caps in a single pass. If the Senate wants the smallest possible change to the policy text, Webster in rounds removes the paradoxes on its own and gives the same result as today on the test data.

## What would change in the tool

Not done; listed for planning.

1. `src/logic.js`: a `webster()` in highest-averages form using the integer comparison above, with the tie steps and the unresolved flag from `hamilton()`; `allocate()` either calls it per round or runs the single capped pass. Integer arithmetic throughout, as AGENTS.md requires.
2. Tests: the same invariants (awarded + unallocated = pool, awarded ≤ applicants, unallocated only when every applicant is funded), plus house monotonicity and population monotonicity as fuzz checks, plus the test-data outcome under the new method (single pass: CSBS 9, DNCBE 5, everything else unchanged).
3. Page: the method section rewritten for the new rule; the round tables replaced or supplemented by the seat-by-seat table; the entitlement table kept.
4. REQUIREMENTS.md sections 3, 4, and 4.8; ARCHITECTURE.md; HANDOFF.md.

## Appendix: how the numbers were produced

Scratch scripts, not checked in, run with Node 24 against `src/logic.js`. Reproduction:

- Hamilton: `hamilton()` from `src/logic.js` with the eligible-faculty tie rule.
- Webster: highest averages; the claim for a college's next seat is eligible ÷ (seats + ½); comparisons done as eligible₁ × (2 × seats₂ + 1) versus eligible₂ × (2 × seats₁ + 1); ties to the larger headcount, then list position. The capped version skips any college whose seats equal its applicants.
- Rounds: `allocate()` from `src/logic.js` for Hamilton; the same loop with Webster substituted for the Webster-in-rounds figures.
- Random campuses: 10 colleges, eligible faculty uniform on 5..100, pool = ⌈12% of total⌉, linear congruential generator seeded 12345 for the first table and 777 for the second. 20,000 campuses each.
- Alabama check: same headcounts, pool +1, any college with fewer seats.
- Population paradox check: next year's headcounts are this year's plus a uniform integer in −3..3 (minimum 1), pool recomputed; flagged when some college A has eligible₂ᴬ × eligible₁ᴮ > eligible₁ᴬ × eligible₂ᴮ (A grew relative to B) yet A has fewer seats and B has more.
- Quota check: any college with seats below the floor or above the ceiling of pool × eligible ÷ total.
- First random table: applicants uniform on 0..40% of eligible. Second table: applicants uniform on 20%..35% of eligible, with each college independently set to 0 applicants with probability 0.1.

## References

- Balinski, M. L., and H. P. Young. *Fair Representation: Meeting the Ideal of One Man, One Vote.* 2nd ed. Brookings Institution Press, 2001. The impossibility theorem, the case for Webster, and the treatment of minimum and maximum requirements.
- Balinski, M. L., and H. P. Young. "The Webster Method of Apportionment." *Proceedings of the National Academy of Sciences* 77 (1980): 1–4.
- Pukelsheim, F. *Proportional Representation: Apportionment Methods and Their Applications.* 2nd ed. Springer, 2017. Divisor methods with restrictions; bias analysis.
- U.S. Census Bureau, "Computing Apportionment," for the Huntington-Hill priority-value procedure and the history of the House methods.
