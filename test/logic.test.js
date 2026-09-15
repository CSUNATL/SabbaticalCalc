'use strict';
/* Tests for src/logic.js (node:test, no dependencies). Run with `npm test`. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeSeatPool, hamilton, allocate, validate, TIE_METHODS, parseInputsCsv, formatInputsCsv } = require('../src/logic.js');

/* ---------- helpers ---------- */
const col = (name, eligible, applicants, carry = 0) => ({ name, eligible, applicants, carry });
const pool = (total, percent, rounding) => computeSeatPool([col('X', total, 0)], percent, rounding);

/* The CSUN college list and the "Load test data" counts in src/sabbatical-allocation.html, in the same order. */
const CSUN = [
  ['Andrew J. Anagnost College of Engineering and Computer Science', 33, 6],
  ['Health & Human Development', 64, 12],
  ['Humanities', 39, 13],
  ['Counseling', 9, 0],
  ['Social & Behavioral Sciences', 75, 21],
  ['Science & Mathematics', 45, 16],
  ['David Nazarian College of Business & Economics', 38, 13],
  ['Library', 18, 2],
  ['Mike Curb College of Arts, Media, & Communication', 39, 10],
  ['Michael D. Eisner College of Education', 22, 7],
].map(([n, e, a]) => col(n, e, a));

/* ---------- seat pool (R3.3) ---------- */
test('seat pool: 12% of 382 under each rounding rule', () => {
  assert.equal(pool(382, 12, 'up').seats, 46);        // 45.84
  assert.equal(pool(382, 12, 'nearest').seats, 46);
  assert.equal(pool(382, 12, 'down').seats, 45);
  assert.equal(pool(382, 12, 'up').exactText, '45.84');
  assert.equal(pool(382, 12, 'up').totalEligible, 382);
});

test('seat pool: non-integer percentages are exact, not floating point', () => {
  // 375 × 18.4% = 69 exactly; floating point gives 68.99999… and rounds down to 68.
  for (const r of ['up', 'nearest', 'down']) assert.equal(pool(375, 18.4, r).seats, 69, r);
  assert.equal(pool(375, 18.4, 'up').exactText, '69');
  // 250 × 64.4% = 161 exactly; floating point gives 161.00000000000003 and rounds up to 162.
  for (const r of ['up', 'nearest', 'down']) assert.equal(pool(250, 64.4, r).seats, 161, r);
});

test('seat pool: percentage is taken to four decimal places', () => {
  const p = pool(1000, 12.3456, 'down');
  assert.equal(p.percentScaled, 123456);
  assert.equal(p.exactText, '123.456');
  assert.equal(p.seats, 123);
  assert.equal(pool(1000, 12.3456, 'up').seats, 124);
  assert.equal(pool(7, 0.0001, 'up').exactText, '0.000007');
  assert.equal(pool(7, 0.0001, 'up').seats, 1);
  assert.equal(pool(7, 0.0001, 'nearest').seats, 0);
});

test('seat pool: "nearest" rounds an exact half up', () => {
  assert.equal(pool(50, 13, 'nearest').seats, 7);     // 6.5
  assert.equal(pool(50, 13, 'down').seats, 6);
  assert.equal(pool(50, 13, 'up').seats, 7);
  assert.equal(pool(50, 12.99, 'nearest').seats, 6);  // 6.495
});

test('seat pool: edge cases', () => {
  assert.equal(pool(0, 12, 'up').seats, 0);
  assert.equal(pool(0, 12, 'up').exactText, '0');
  assert.equal(pool(100, 0, 'up').seats, 0);
  assert.equal(pool(100, 100, 'down').seats, 100);
  assert.equal(pool(200, 12, 'up').exactText, '24');
  const two = computeSeatPool([col('A', 100, 0), col('B', 282, 0)], 12, 'up');
  assert.equal(two.totalEligible, 382);
  assert.equal(two.seats, 46);
});

test('seat pool: agrees with a BigInt reference over many random inputs', () => {
  let seed = 12345;
  const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let i = 0; i < 5000; i++) {
    const total = rnd(20000);
    const scaled = rnd(1000001);                         // percent in ten-thousandths, 0..100%
    const percent = scaled / 10000;
    const num = BigInt(total) * BigInt(scaled), den = 1000000n;
    const whole = num / den, rem = num % den;
    const want = {
      down: whole, up: rem > 0n ? whole + 1n : whole, nearest: rem * 2n >= den ? whole + 1n : whole,
    };
    for (const r of ['down', 'up', 'nearest']) {
      assert.equal(BigInt(pool(total, percent, r).seats), want[r], `${total} × ${percent}% ${r}`);
    }
  }
});

/* ---------- hamilton (R4.1, R4.2) ---------- */
test('hamilton: whole seats then largest remainders, integer comparison', () => {
  const parts = [{ idx: 0, name: 'A', eligible: 50 }, { idx: 1, name: 'B', eligible: 30 }, { idx: 2, name: 'C', eligible: 20 }];
  const h = hamilton(parts, 11);                           // quotas 5.5, 3.3, 2.2
  assert.equal(h.total, 100);
  assert.equal(h.wholeSum, 10);
  assert.equal(h.remainderSeats, 1);
  assert.deepEqual(h.rows.map(r => r.whole), [5, 3, 2]);
  assert.deepEqual(h.rows.map(r => r.remNum), [50, 30, 20]);
  assert.deepEqual(h.rows.map(r => r.allocated), [6, 3, 2]);
  assert.deepEqual(h.order.map(r => r.name), ['A', 'B', 'C']);
  assert.deepEqual(h.rows.map(r => r.rank), [1, 2, 3]);
  assert.deepEqual(h.ties, []);
  assert.equal(h.tieDecidedBy, '');
});

test('hamilton: exact quotas leave no remainder seats', () => {
  const h = hamilton([{ idx: 0, name: 'A', eligible: 50 }, { idx: 1, name: 'B', eligible: 50 }], 4);
  assert.equal(h.remainderSeats, 0);
  assert.deepEqual(h.rows.map(r => r.allocated), [2, 2]);
  assert.deepEqual(h.ties, []);
});

test('hamilton: a tie that does not straddle the cutoff is not reported', () => {
  // Humanities and Mike Curb both have 39 eligible in the CSUN data; both get an extra seat.
  const parts = CSUN.map((c, i) => ({ idx: i, name: c.name, eligible: c.eligible, carry: 0 }));
  const h = hamilton(parts, 46);
  assert.equal(h.remainderSeats, 5);
  assert.deepEqual(h.ties, []);
  assert.equal(h.rows[2].remNum, h.rows[8].remNum);
  assert.equal(h.rows[2].remainderSeat, 1);
  assert.equal(h.rows[8].remainderSeat, 1);
});

test('hamilton tie-break: carry forward first, compared in thousandths', () => {
  const mk = (ca, cc) => hamilton([
    { idx: 0, name: 'A', eligible: 10, carry: ca }, { idx: 1, name: 'B', eligible: 20, carry: 0 }, { idx: 2, name: 'C', eligible: 70, carry: cc },
  ], 5);                                                   // quotas 0.5, 1.0, 3.5: A and C tie for the one extra seat
  let h = mk(0.5, 0);
  assert.deepEqual(h.ties.sort(), ['A', 'C']);
  assert.equal(h.tieDecidedBy, 'carry');
  assert.equal(h.rows[0].tie, 'won');
  assert.equal(h.rows[2].tie, 'lost');
  assert.deepEqual(h.rows.map(r => r.allocated), [1, 1, 3]);
  h = mk(0.0004, 0);                                       // below a thousandth: treated as equal, so headcount decides
  assert.equal(h.tieDecidedBy, 'eligible');
  assert.equal(h.rows[2].tie, 'won');
  h = mk(0.001, 0);
  assert.equal(h.tieDecidedBy, 'carry');
  assert.equal(h.rows[0].tie, 'won');
  h = mk(0.3, 0.7);
  assert.equal(h.tieDecidedBy, 'carry');
  assert.equal(h.rows[2].tie, 'won');
});

test('hamilton tie-break, eligible-faculty rule (default): then more eligible faculty', () => {
  assert.deepEqual(TIE_METHODS, ['eligible', 'list', 'list-only']);
  let h = hamilton([{ idx: 0, name: 'A', eligible: 10 }, { idx: 1, name: 'B', eligible: 20 }, { idx: 2, name: 'C', eligible: 70 }], 5);
  assert.equal(h.method, 'eligible');
  assert.equal(h.tieDecidedBy, 'eligible');
  assert.equal(h.unresolved, false);
  assert.deepEqual(h.rows.map(r => r.allocated), [0, 1, 4]);
  assert.equal(h.rows[0].tie, 'lost');
  assert.equal(h.rows[2].tie, 'won');
  // An unknown method falls back to the default.
  assert.equal(hamilton([{ idx: 0, name: 'A', eligible: 10 }, { idx: 1, name: 'C', eligible: 70 }], 1, 'bogus').method, 'eligible');
});

test('hamilton tie-break, eligible-faculty rule: equal headcount is unresolved and placed provisionally by list order', () => {
  // Zeta is listed above Alpha; name plays no part.
  let h = hamilton([{ idx: 0, name: 'Zeta', eligible: 50 }, { idx: 1, name: 'Alpha', eligible: 50 }], 3);
  assert.equal(h.tieDecidedBy, 'unresolved');
  assert.equal(h.unresolved, true);
  assert.deepEqual(h.ties.sort(), ['Alpha', 'Zeta']);
  assert.deepEqual(h.rows.map(r => r.allocated), [2, 1]);
  assert.equal(h.rows[0].tie, 'won');
  assert.equal(h.rows[1].tie, 'lost');
  // The list order used for the provisional placement is the idx, not the array order.
  h = hamilton([{ idx: 5, name: 'Zeta', eligible: 50 }, { idx: 2, name: 'Alpha', eligible: 50 }], 3);
  assert.equal(h.rows[1].tie, 'won');
  // Three-way tie for one seat: unresolved only if the last winner and first loser cannot be separated.
  h = hamilton([{ idx: 0, name: 'A', eligible: 10 }, { idx: 1, name: 'B', eligible: 10 }, { idx: 2, name: 'C', eligible: 10 }, { idx: 3, name: 'D', eligible: 70 }], 1);
  assert.equal(h.tieDecidedBy, '');                     // D (0.7) wins outright; the 0.1s are all losers, no tie at the cutoff
  assert.deepEqual(h.ties, []);
  assert.equal(h.unresolved, false);
  h = hamilton([{ idx: 0, name: 'A', eligible: 1 }, { idx: 1, name: 'B', eligible: 1 }, { idx: 2, name: 'C', eligible: 1 }], 1);
  assert.equal(h.tieDecidedBy, 'unresolved');
  assert.deepEqual(h.rows.map(r => r.tie), ['won', 'lost', 'lost']);
  // Two seats among three equal colleges: two winners, one loser, still unresolved.
  h = hamilton([{ idx: 0, name: 'A', eligible: 1 }, { idx: 1, name: 'B', eligible: 1 }, { idx: 2, name: 'C', eligible: 1 }], 2);
  assert.equal(h.tieDecidedBy, 'unresolved');
  assert.deepEqual(h.rows.map(r => r.tie), ['won', 'won', 'lost']);
});

test('hamilton tie-break, list-order rule: carry forward, then the college listed higher, then eligible faculty', () => {
  let h = hamilton([{ idx: 0, name: 'A', eligible: 10 }, { idx: 1, name: 'B', eligible: 20 }, { idx: 2, name: 'C', eligible: 70 }], 5, 'list');
  assert.equal(h.method, 'list');
  assert.equal(h.tieDecidedBy, 'list');                 // A is listed above C, even though C has more eligible faculty
  assert.equal(h.unresolved, false);
  assert.deepEqual(h.rows.map(r => r.allocated), [1, 1, 3]);
  assert.equal(h.rows[0].tie, 'won');
  assert.equal(h.rows[2].tie, 'lost');
  // Carry forward still comes first.
  h = hamilton([{ idx: 0, name: 'A', eligible: 10, carry: 0 }, { idx: 1, name: 'B', eligible: 20 }, { idx: 2, name: 'C', eligible: 70, carry: 0.25 }], 5, 'list');
  assert.equal(h.tieDecidedBy, 'carry');
  assert.equal(h.rows[2].tie, 'won');
  // Equal headcount is never unresolved under the list rule.
  h = hamilton([{ idx: 0, name: 'Zeta', eligible: 50 }, { idx: 1, name: 'Alpha', eligible: 50 }], 3, 'list');
  assert.equal(h.tieDecidedBy, 'list');
  assert.equal(h.rows[0].tie, 'won');
  // Ranking uses idx (the position in the full list), not the order of the parts array.
  h = hamilton([{ idx: 7, name: 'Low', eligible: 50 }, { idx: 3, name: 'High', eligible: 50 }], 3, 'list');
  assert.equal(h.rows[1].tie, 'won');
  assert.deepEqual(h.order.map(r => r.name), ['High', 'Low']);
});

test('hamilton tie-break, list-only rule: carry forward, then the college listed higher, nothing after', () => {
  let h = hamilton([{ idx: 0, name: 'A', eligible: 10 }, { idx: 1, name: 'B', eligible: 20 }, { idx: 2, name: 'C', eligible: 70 }], 5, 'list-only');
  assert.equal(h.method, 'list-only');
  assert.equal(h.tieDecidedBy, 'list');
  assert.equal(h.unresolved, false);
  assert.deepEqual(h.rows.map(r => r.allocated), [1, 1, 3]);
  h = hamilton([{ idx: 0, name: 'A', eligible: 10, carry: 0 }, { idx: 1, name: 'B', eligible: 20 }, { idx: 2, name: 'C', eligible: 70, carry: 0.25 }], 5, 'list-only');
  assert.equal(h.tieDecidedBy, 'carry');
  assert.equal(h.rows[2].tie, 'won');
  // Positions are unique, so the unresolved flag cannot fire under this rule; every tie is decided by list order.
  h = hamilton([{ idx: 7, name: 'Low', eligible: 50 }, { idx: 3, name: 'High', eligible: 50 }], 3, 'list-only');
  assert.equal(h.tieDecidedBy, 'list');
  assert.equal(h.rows[1].tie, 'won');
  // Eligible faculty is never consulted: under 'list' the same inputs also go by list, so the two rules agree;
  // they differ only in what they would do after list order, which never happens.
  const a = allocate([col('P', 10, 10), col('Q', 10, 10), col('Big', 80, 0)], 6, 'list');
  const b = allocate([col('P', 10, 10), col('Q', 10, 10), col('Big', 80, 0)], 6, 'list-only');
  assert.deepEqual(a.final.map(f => f.awarded), b.final.map(f => f.awarded));
  assert.equal(b.method, 'list-only');
  assert.deepEqual(b.unresolvedRounds, []);
});

/* ---------- allocate (R4.3 to R4.8) ---------- */
test('allocate: the CSUN test data gives 46 seats in two rounds', () => {
  const p = computeSeatPool(CSUN, 12, 'up');
  assert.equal(p.totalEligible, 382);
  assert.equal(p.seats, 46);
  const res = allocate(CSUN, p.seats);
  assert.equal(res.rounds.length, 2);
  const r1 = res.rounds[0];
  assert.equal(r1.participants, 10);
  assert.equal(r1.totalEligible, 382);
  assert.equal(r1.wholeSum, 41);
  assert.equal(r1.remainderSeats, 5);
  assert.deepEqual(r1.rows.map(r => r.whole), [3, 7, 4, 1, 9, 5, 4, 2, 4, 2]);
  assert.deepEqual(r1.rows.map(r => r.allocated), [4, 8, 5, 1, 9, 5, 4, 2, 5, 3]);
  assert.deepEqual(r1.rows.map(r => r.funded), [4, 8, 5, 0, 9, 5, 4, 2, 5, 3]);
  assert.equal(r1.funded, 45);
  assert.equal(r1.surplus, 1);                             // Counseling has no applicants
  assert.deepEqual(r1.settledNow, ['Counseling', 'Library']);
  const r2 = res.rounds[1];
  assert.equal(r2.pool, 1);
  assert.equal(r2.participants, 8);
  assert.equal(r2.totalEligible, 355);
  assert.ok(!r2.rows.some(r => r.name === 'Counseling' || r.name === 'Library'));
  assert.equal(r2.order[0].name, 'Social & Behavioral Sciences');   // largest fraction = largest headcount
  assert.equal(r2.funded, 1);
  assert.equal(r2.surplus, 0);
  assert.equal(res.totalAwarded, 46);
  assert.equal(res.unallocated, 0);
  assert.deepEqual(res.final.map(f => f.awarded), [4, 8, 5, 0, 10, 5, 4, 2, 5, 3]);
  assert.deepEqual(res.final.map(f => f.unfunded), [2, 4, 8, 0, 11, 11, 9, 0, 5, 4]);
  assert.deepEqual(res.final[4].byRound, [{ round: 1, seats: 9 }, { round: 2, seats: 1 }]);
  assert.deepEqual(res.final.map(f => f.settledIn), [null, null, null, 1, null, null, null, 1, null, null]);
  assert.equal(res.stopReason, 'All seats have been placed.');
});

test('allocate: a zero-applicant college takes part in round 1 and is excluded afterwards', () => {
  const cs = [col('Big', 60, 0), col('Mid', 30, 30), col('Small', 10, 10)];
  const res = allocate(cs, 10);
  assert.deepEqual(res.rounds[0].rows.map(r => r.name), ['Big', 'Mid', 'Small']);
  assert.deepEqual(res.rounds[0].rows.map(r => r.allocated), [6, 3, 1]);
  assert.equal(res.rounds[0].surplus, 6);
  assert.deepEqual(res.rounds[1].rows.map(r => r.name), ['Mid', 'Small']);
  assert.deepEqual(res.rounds[1].rows.map(r => r.allocated), [5, 1]);   // 6 × 30/40 = 4.5, 6 × 10/40 = 1.5: tie, Mid by headcount
  assert.equal(res.rounds[1].tieDecidedBy, 'eligible');
  assert.equal(res.method, 'eligible');
  assert.deepEqual(res.unresolvedRounds, []);
  assert.equal(res.final[0].awarded, 0);
  assert.deepEqual(res.final.map(f => f.awarded), [0, 8, 2]);
  assert.equal(res.unallocated, 0);
});

test('allocate: seats nobody can use are reported as unallocated', () => {
  const cs = [col('A', 50, 1), col('B', 50, 1)];
  const res = allocate(cs, 10);
  assert.equal(res.totalAwarded, 2);
  assert.equal(res.unallocated, 8);
  assert.equal(res.rounds.length, 1);
  assert.match(res.stopReason, /8 seats could not be placed/);
  assert.ok(res.final.every(f => f.unfunded === 0));
});

test('allocate: zero seats gives no rounds', () => {
  const res = allocate([col('A', 50, 5)], 0);
  assert.equal(res.rounds.length, 0);
  assert.equal(res.totalAwarded, 0);
  assert.equal(res.unallocated, 0);
  assert.equal(res.stopReason, 'All seats have been placed.');
});

test('allocate: one college gets everything it can use', () => {
  const res = allocate([col('Only', 100, 7)], 12);
  assert.equal(res.rounds.length, 1);
  assert.equal(res.final[0].awarded, 7);
  assert.equal(res.unallocated, 5);
});

test('carry forward: a tie loser with an unfunded applicant adds the lost fraction', () => {
  const cs = [col('A', 10, 10), col('B', 20, 20), col('C', 70, 70)];
  const res = allocate(cs, 5);                             // A and C tie at 0.5; C wins by headcount
  assert.equal(res.rounds[0].tieDecidedBy, 'eligible');
  const a = res.final[0], c = res.final[2];
  assert.deepEqual(a.tieEvents, [{ round: 1, result: 'lost', fraction: 0.5, decidedBy: 'eligible', counted: true, carryAfter: 0.5 }]);
  assert.equal(a.carryNext, 0.5);
  assert.equal(c.tieEvents[0].result, 'won');
  assert.equal(c.carryNext, 0);
  assert.equal(res.final[1].carryNext, 0);
  assert.deepEqual(res.final[1].tieEvents, []);
});

test('carry forward: a tie loser whose applicants were all funded adds nothing', () => {
  const cs = [col('A', 10, 0, 0.2), col('B', 20, 20), col('C', 70, 3, 0.4)];
  const res = allocate(cs, 5);                             // A loses the tie to C by carry forward, and has no applicants
  assert.equal(res.rounds[0].tieDecidedBy, 'carry');
  const a = res.final[0];
  assert.equal(a.tieEvents[0].result, 'lost');
  assert.equal(a.tieEvents[0].counted, false);
  assert.equal(a.carryNext, 0.2);                          // unchanged
});

test('carry forward: a winner resets to zero and has no carry forward in later rounds', () => {
  // Round 1, 6 seats: quotas 0.6, 0.6, 4.8. Extra seats to C (0.8) and then to Beta by carry forward, although
  // Alpha is listed higher. C has no applicants, so 5 seats return. Round 2: 2.5 each; Beta's carry is spent,
  // so under the list rule Alpha wins.
  const cs = [col('Alpha', 10, 10, 0), col('Beta', 10, 10, 0.3), col('C', 80, 0)];
  const res = allocate(cs, 6, 'list');
  assert.equal(res.method, 'list');
  const [r1, r2] = res.rounds;
  assert.equal(r1.tieDecidedBy, 'carry');
  assert.equal(r1.rows[1].tie, 'won');
  assert.equal(r1.rows[0].tie, 'lost');
  assert.equal(r2.tieDecidedBy, 'list');
  assert.equal(r2.rows.find(r => r.name === 'Beta').carry, 0);
  assert.equal(r2.rows.find(r => r.name === 'Beta').tie, 'lost');
  assert.equal(r2.rows.find(r => r.name === 'Alpha').tie, 'won');
  assert.deepEqual(res.final.map(f => f.awarded), [3, 3, 0]);
  const beta = res.final[1], alpha = res.final[0];
  assert.deepEqual(beta.tieEvents.map(e => [e.round, e.result, e.counted]), [[1, 'won', true], [2, 'lost', true]]);
  assert.equal(beta.carryNext, 0.5);                       // reset to 0 in round 1, then + 0.5 lost in round 2
  assert.deepEqual(alpha.tieEvents.map(e => [e.round, e.result, e.counted]), [[1, 'lost', true], [2, 'won', true]]);
  assert.equal(alpha.carryNext, 0);
});

test('carry forward: repeated losses accumulate and may exceed one seat', () => {
  const cs = [col('Alpha', 10, 10), col('Zed', 10, 10), col('C', 80, 0)];
  const res = allocate(cs, 6, 'list');                     // Alpha is listed higher and wins both ties
  const zed = res.final[1];
  assert.deepEqual(zed.tieEvents.map(e => [e.round, e.result, e.fraction, e.decidedBy]), [[1, 'lost', 0.6, 'list'], [2, 'lost', 0.5, 'list']]);
  assert.equal(zed.carryNext, 1.1);
  assert.equal(zed.tieEvents[1].carryAfter, 1.1);
  assert.equal(res.final[0].carryNext, 0);
});

test('carry forward: recorded to three decimals', () => {
  const cs = [col('A', 1, 1), col('B', 1, 1), col('C', 1, 1)];
  const res = allocate(cs, 1, 'list');                     // each 1/3; A is listed first
  assert.equal(res.rounds[0].tieDecidedBy, 'list');
  assert.equal(res.final[1].carryNext, 0.333);
  assert.equal(res.final[2].carryNext, 0.333);
  assert.equal(res.final[0].carryNext, 0);
});

test('allocate: an unresolved tie under the default rule is flagged and placed provisionally', () => {
  const cs = [col('A', 1, 1), col('B', 1, 1), col('C', 1, 1)];
  const res = allocate(cs, 1);
  assert.equal(res.method, 'eligible');
  assert.deepEqual(res.unresolvedRounds, [1]);
  assert.equal(res.rounds[0].unresolved, true);
  assert.equal(res.rounds[0].tieDecidedBy, 'unresolved');
  assert.deepEqual(res.final.map(f => f.awarded), [1, 0, 0]);          // provisional: A is listed first
  assert.deepEqual(res.final.map(f => f.tieEvents[0].decidedBy), ['unresolved', 'unresolved', 'unresolved']);
  assert.deepEqual(res.final.map(f => f.carryNext), [0, 0.333, 0.333]);
  // The same inputs under the list rule give the same seats, resolved.
  const res2 = allocate(cs, 1, 'list');
  assert.deepEqual(res2.unresolvedRounds, []);
  assert.deepEqual(res2.final.map(f => f.awarded), [1, 0, 0]);
  // A later round can be the unresolved one.
  const cs3 = [col('Big', 80, 0), col('P', 10, 10), col('Q', 10, 10)];
  const res3 = allocate(cs3, 5);                           // round 1: 0.5, 0.5, 4.0 -> unresolved; round 2: 4 seats, 2 each
  assert.deepEqual(res3.unresolvedRounds, [1]);
  assert.equal(res3.rounds.length, 2);
  assert.equal(res3.rounds[1].unresolved, false);
});

/* ---------- validate (R3.2, R3.4) ---------- */
test('validate: clean input has no errors', () => {
  assert.deepEqual(validate(CSUN, 12), []);
  assert.deepEqual(validate([col('A', 1, 0)], 12.3456), []);
});

test('validate: each rule produces a specific message', () => {
  const msgs = (cs, p = 12) => validate(cs, p);
  assert.deepEqual(msgs([], 12), ['Add at least one college.']);
  assert.match(msgs([col('A', 1, 0)], 101)[0], /between 0 and 100/);
  assert.match(msgs([col('A', 1, 0)], -1)[0], /between 0 and 100/);
  assert.match(msgs([col('A', 1, 0)], NaN)[0], /between 0 and 100/);
  assert.match(msgs([col('A', 1, 0)], 12.00001)[0], /at most four decimal places/);
  assert.match(msgs([col('', 1, 0)])[0], /Row 1 needs a college name/);
  assert.match(msgs([col('A', 1, 0), col(' a ', 1, 0)])[0], /appears more than once/);
  assert.match(msgs([col('A', 1.5, 0)])[0], /eligible faculty must be a whole number/);
  assert.match(msgs([col('A', NaN, 0)])[0], /eligible faculty must be a whole number/);
  assert.match(msgs([col('A', 1, -1)])[0], /applicants must be a whole number/);
  assert.match(msgs([col('A', 1, 2)])[0], /applicants \(2\) cannot exceed eligible faculty \(1\)/);
  assert.match(msgs([col('A', 1, 0, -0.5)])[0], /carry forward must be a number of 0 or more/);
  assert.match(msgs([col('A', 1, 0, NaN)])[0], /carry forward must be a number of 0 or more/);
  assert.match(msgs([col('A', 0, 0)])[0], /total is currently zero/);
});

/* ---------- invariants (R4.7) ---------- */
test('fuzz: allocation invariants hold for random inputs', () => {
  let seed = 424242;
  const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let iter = 0; iter < 3000; iter++) {
    const n = 1 + rnd(12);
    const cs = [];
    for (let i = 0; i < n; i++) {
      const eligible = rnd(4) === 0 ? rnd(3) : rnd(200);
      const applicants = rnd(3) === 0 ? 0 : rnd(eligible + 1);
      const carry = rnd(3) === 0 ? rnd(1000) / 1000 : 0;
      cs.push(col(`C${i}`, eligible, applicants, carry));
    }
    if (cs.every(c => c.eligible === 0)) cs[0].eligible = 1;
    const percent = [12, 5, 33.3333, 100, 0][rnd(5)];
    const p = computeSeatPool(cs, percent, ['up', 'nearest', 'down'][rnd(3)]);
    const method = TIE_METHODS[rnd(TIE_METHODS.length)];
    const res = allocate(cs, p.seats, method);
    const tag = JSON.stringify({ cs, seats: p.seats, method });
    assert.equal(res.method, method, tag);
    assert.deepEqual(res.unresolvedRounds, res.rounds.filter(rd => rd.unresolved).map(rd => rd.round), tag);
    if (method !== 'eligible') assert.deepEqual(res.unresolvedRounds, [], tag);
    assert.equal(res.totalAwarded + res.unallocated, p.seats, tag);
    assert.ok(res.rounds.length <= n + 1, tag);
    assert.ok(!/should not happen/.test(res.stopReason), tag);
    res.final.forEach((f, i) => {
      assert.ok(f.awarded <= cs[i].applicants, tag);
      assert.equal(f.awarded + f.unfunded, cs[i].applicants, tag);
      assert.equal(f.byRound.reduce((s, b) => s + b.seats, 0), f.awarded, tag);
      assert.ok(f.carryNext >= 0, tag);
    });
    if (res.unallocated > 0) assert.ok(res.final.every(f => f.unfunded === 0), tag);
    const totalApplicants = cs.reduce((s, c) => s + c.applicants, 0);
    if (res.totalAwarded < Math.min(p.seats, totalApplicants)) assert.fail('seats left while applicants unfunded: ' + tag);
    let pool = p.seats;
    const settledNames = new Set();
    res.rounds.forEach((rd, k) => {
      assert.equal(rd.pool, pool, tag);
      assert.equal(rd.wholeSum + rd.remainderSeats, rd.pool, tag);
      assert.equal(rd.rows.reduce((s, r) => s + r.allocated, 0), rd.pool, tag);
      assert.equal(rd.funded + rd.surplus, rd.pool, tag);
      assert.equal(rd.rows.reduce((s, r) => s + r.funded, 0), rd.funded, tag);
      assert.equal(rd.rows.reduce((s, r) => s + r.surplus, 0), rd.surplus, tag);
      if (k === 0) assert.equal(rd.rows.length, n, tag);
      else rd.rows.forEach(r => { assert.ok(!settledNames.has(r.name), tag); assert.ok(r.demandBefore > 0, tag); });
      rd.rows.forEach(r => {
        assert.equal(r.whole * rd.totalEligible + r.remNum, rd.pool * r.eligible, tag);
        assert.ok(r.remNum >= 0 && r.remNum < rd.totalEligible, tag);
        assert.ok(r.funded <= r.demandBefore, tag);
        if (r.settled) settledNames.add(r.name);
      });
      // Every extra seat went to a fraction at least as large as every fraction that got none.
      const got = rd.rows.filter(r => r.remainderSeat).map(r => r.remNum);
      const not = rd.rows.filter(r => !r.remainderSeat).map(r => r.remNum);
      if (got.length && not.length) assert.ok(Math.min(...got) >= Math.max(...not), tag);
      if (rd.ties.length) {
        assert.ok(rd.rows.some(r => r.tie === 'won') && rd.rows.some(r => r.tie === 'lost'), tag);
        const w = rd.order[rd.remainderSeats - 1], l = rd.order[rd.remainderSeats];
        const sameCarry = Math.round(w.carry * 1000) === Math.round(l.carry * 1000);
        if (rd.tieDecidedBy === 'carry') assert.ok(!sameCarry && w.carry > l.carry, tag);
        if (rd.tieDecidedBy === 'eligible') assert.ok(sameCarry && w.eligible > l.eligible && method !== 'list-only', tag);
        if (rd.tieDecidedBy === 'list') assert.ok(sameCarry && w.idx < l.idx, tag);
        if (rd.tieDecidedBy === 'unresolved') assert.ok(sameCarry && w.eligible === l.eligible && w.idx < l.idx && method === 'eligible', tag);
        assert.equal(rd.unresolved, rd.tieDecidedBy === 'unresolved', tag);
      } else {
        assert.equal(rd.tieDecidedBy, '', tag);
      }
      pool = rd.surplus;
    });
  }
});

/* ---------- inputs file: CSV (R3.5) ---------- */
test('csv: header row with the standard columns, CRLF, and a byte-order mark', () => {
  const text = '\uFEFFCollege,Eligible faculty,Applicants,Carry forward\r\nHumanities,39,13,0\r\nLibrary,18,2,0.333\r\n';
  assert.deepEqual(parseInputsCsv(text), [col('Humanities', 39, 13, 0), col('Library', 18, 2, 0.333)]);
});

test('csv: columns in any order, extra columns ignored, headings matched by words', () => {
  const text = 'Applicants,Notes,Carry forward from last year,Name of college,Eligible\n3,x,0.5,A,10\n0,,0,B,20\n';
  assert.deepEqual(parseInputsCsv(text), [col('A', 10, 3, 0.5), col('B', 20, 0, 0)]);
});

test('csv: no header row takes the columns in order; carry forward optional', () => {
  assert.deepEqual(parseInputsCsv('A,10,3\nB,20,0,0.25\n'), [col('A', 10, 3, 0), col('B', 20, 0, 0.25)]);
  // A college whose name contains "College" in a headerless file is not mistaken for a header.
  assert.deepEqual(parseInputsCsv('College of Science,10,3\nB,20,0\n'), [col('College of Science', 10, 3, 0), col('B', 20, 0, 0)]);
});

test('csv: header without a carry column gives carry forward 0', () => {
  assert.deepEqual(parseInputsCsv('College,Eligible,Applicants\nA,10,3\n'), [col('A', 10, 3, 0)]);
});

test('csv: quoted names with commas and quotes, semicolons, tabs', () => {
  assert.deepEqual(parseInputsCsv('College,Eligible,Applicants,Carry\n"Arts, Media, & Communication",39,10,0\n"The ""Library""",18,2,0\n'),
    [col('Arts, Media, & Communication', 39, 10, 0), col('The "Library"', 18, 2, 0)]);
  assert.deepEqual(parseInputsCsv('College;Eligible;Applicants;Carry\nA;10;3;0\nB;20;0;0\n'), [col('A', 10, 3, 0), col('B', 20, 0, 0)]);
  assert.deepEqual(parseInputsCsv('College\tEligible\tApplicants\nA\t10\t3\n'), [col('A', 10, 3, 0)]);
});

test('csv: blank rows and a Total row are skipped; blank cells; thousands separators', () => {
  const text = 'College,Eligible faculty,Applicants,Carry forward\n\nA,"1,234",,\n,,,\nB,20,5,\nTotal,1254,5,\n';
  const got = parseInputsCsv(text);
  assert.equal(got.length, 2);
  assert.deepEqual(got[0], col('A', 1234, 0, 0));
  assert.deepEqual(got[1], col('B', 20, 5, 0));
  const blankEligible = parseInputsCsv('College,Eligible,Applicants\nA,,3\n')[0];
  assert.ok(Number.isNaN(blankEligible.eligible));
  assert.match(validate([blankEligible], 12)[0], /eligible faculty must be a whole number/);
});

test('csv: order of rows is kept and duplicates are left for validation', () => {
  const got = parseInputsCsv('College,Eligible,Applicants\nZ,1,0\nA,2,0\nz,3,0\n');
  assert.deepEqual(got.map(c => c.name), ['Z', 'A', 'z']);
  assert.match(validate(got, 12)[0], /appears more than once/);
});

test('csv: unusable files throw a message that completes "could not be loaded: ..."', () => {
  assert.throws(() => parseInputsCsv(''), /the file is empty/);
  assert.throws(() => parseInputsCsv('\n\n'), /the file is empty/);
  assert.throws(() => parseInputsCsv('this is not a saved inputs file'), /at least three columns/);
  assert.throws(() => parseInputsCsv('College,Eligible\nA,10\n'), /no column for applicants/);
  assert.throws(() => parseInputsCsv('College,Applicants\nA,10\n'), /no column for eligible faculty/);
  assert.throws(() => parseInputsCsv('College,Eligible,Applicants\n'), /no college rows/);
});

test('csv: formatInputsCsv writes a header and quotes what needs quoting; round trip', () => {
  const cs = [col('Arts, Media, & Communication', 39, 10, 0), col('The "Library"', 18, 2, 0.333), col('Plain', 5, NaN, 0)];
  const text = formatInputsCsv(cs);
  assert.equal(text.split('\r\n')[0], 'College,Eligible faculty,Applicants,Carry forward');
  assert.equal(text.split('\r\n')[1], '"Arts, Media, & Communication",39,10,0');
  assert.equal(text.split('\r\n')[2], '"The ""Library""",18,2,0.333');
  assert.equal(text.split('\r\n')[3], 'Plain,5,,0');                      // NaN (still being typed) is written blank
  const back = parseInputsCsv(text);
  assert.deepEqual(back.slice(0, 2), cs.slice(0, 2));
  assert.equal(back[2].applicants, 0);                                    // and a blank applicants cell reads as 0
  assert.deepEqual(parseInputsCsv(formatInputsCsv(CSUN)), CSUN);
});
