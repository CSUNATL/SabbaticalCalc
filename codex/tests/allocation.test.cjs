"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const htmlPath = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
assert.match(html, /href="#calculation-method"/, "page links to the calculation description");
assert.match(html, /id="calculation-method"/, "page contains the calculation description");
assert.match(html, /Redistribute returned seats/, "description documents redistribution rounds");
assert.match(html, /id="load-test-data"/, "page provides a test-dataset control");
const scripts = Array.from(html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g));
assert.ok(scripts.length >= 2, "index.html contains core and interface scripts");
scripts.forEach(function (script, index) {
  assert.doesNotThrow(function () { new vm.Script(script[1]); }, "inline script " + (index + 1) + " parses");
});
const match = html.match(/<script id="allocation-core">([\s\S]*?)<\/script>/);
assert.ok(match, "index.html contains the allocation-core script");

const context = { window: {} };
vm.createContext(context);
vm.runInContext(match[1], context, { filename: "allocation-core.js" });
const core = context.window.SabbaticalCalculatorCore;

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("rounds any fractional 12 percent result up", function () {
  assert.equal(core.calculateAvailableSeats(100), 12);
  assert.equal(core.calculateAvailableSeats(101), 13); // 12.12
  assert.equal(core.calculateAvailableSeats(104), 13); // 12.48
  assert.equal(core.calculateAvailableSeats(105), 13); // 12.60
  assert.equal(core.calculateAvailableSeats(200), 24); // exact whole number
  assert.equal(core.calculateAvailableSeats(0), 0);
});

test("uses Hamilton largest remainders", function () {
  const result = core.allocate([
    { name: "Alpha", eligible: 50, applicants: 50 },
    { name: "Beta", eligible: 30, applicants: 30 },
    { name: "Gamma", eligible: 20, applicants: 20 }
  ]);
  assert.equal(result.availableSeats, 12);
  assert.deepEqual(Array.from(result.allocations), [6, 4, 2]);
  assert.equal(result.rounds[0].remainderSeats, 1);
});

test("resolves an exact fractional tie by higher eligible count", function () {
  const colleges = [
    { name: "Small", eligible: 1, applicants: 1 },
    { name: "Large", eligible: 5, applicants: 5 },
    { name: "Anchor", eligible: 94, applicants: 94 }
  ];
  const distribution = core.hamilton(colleges, [0, 1, 2], 25);
  // Small and Large both have .25 remainders; Large has the higher tie priority.
  assert.equal(distribution.records[0].remainderNumerator, distribution.records[1].remainderNumerator);
  assert.equal(distribution.records[1].rank < distribution.records[0].rank, true);
});

test("resolves a complete tie by name and then entry order", function () {
  const colleges = [
    { name: "Zulu", eligible: 1, applicants: 1 },
    { name: "Alpha", eligible: 1, applicants: 1 },
    { name: "alpha", eligible: 1, applicants: 1 }
  ];
  const distribution = core.hamilton(colleges, [0, 1, 2], 1);
  assert.equal(distribution.records[1].bonus, 1);
  assert.equal(distribution.records[2].bonus, 0);
  assert.equal(distribution.records[0].bonus, 0);
});

test("uses prior carry forward first and reports next-year balances", function () {
  const result = core.allocate([
    { name: "Alpha", eligible: 1, applicants: 1, carryForward: 0.2 },
    { name: "Beta", eligible: 1, applicants: 1, carryForward: 0.6 },
    { name: "Gamma", eligible: 1, applicants: 1, carryForward: 0 }
  ]);
  assert.equal(result.availableSeats, 1);
  assert.deepEqual(Array.from(result.allocations), [0, 1, 0]);
  assert.deepEqual(Array.from(result.nextCarryForwards), [0.2, 0, 1 / 3]);
  assert.equal(result.tieEvents.length, 3);
  assert.equal(result.tieEvents.find(function (event) { return event.index === 1; }).outcome, "won");
  assert.equal(result.tieEvents.find(function (event) { return event.index === 2; }).createdCarryForward, true);
});

test("preserves carry forward until a college wins a cutoff tie", function () {
  const result = core.allocate([
    { name: "Alpha", eligible: 10, applicants: 10, carryForward: 0.375 },
    { name: "Beta", eligible: 90, applicants: 90, carryForward: 0 }
  ]);
  assert.equal(result.tieEvents.length, 0);
  assert.deepEqual(Array.from(result.nextCarryForwards), [0.375, 0]);
});

test("creates carry forward only when a tied loss leaves unmet demand", function () {
  const result = core.allocate([
    { name: "Alpha", eligible: 1, applicants: 1, carryForward: 0 },
    { name: "Beta", eligible: 1, applicants: 1, carryForward: 0 },
    { name: "Gamma", eligible: 1, applicants: 0, carryForward: 0 }
  ]);
  assert.deepEqual(Array.from(result.allocations), [1, 0, 0]);
  assert.deepEqual(Array.from(result.nextCarryForwards), [0, 1 / 3, 0]);
});

test("rejects carry-forward values outside the fractional range", function () {
  assert.throws(function () {
    core.allocate([{ name: "A", eligible: 2, applicants: 1, carryForward: 1 }]);
  }, /invalid carry-forward fraction/);
});

test("includes zero-applicant colleges in round one and redistributes returned seats", function () {
  const result = core.allocate([
    { name: "No demand", eligible: 50, applicants: 0 },
    { name: "Demand", eligible: 50, applicants: 50 }
  ]);
  assert.equal(result.availableSeats, 12);
  assert.deepEqual(Array.from(result.allocations), [0, 12]);
  assert.equal(result.rounds.length, 2);
  assert.equal(result.rounds[0].participantIndexes.length, 2);
  assert.equal(result.rounds[0].returned, 6);
  assert.deepEqual(Array.from(result.rounds[1].participantIndexes), [1]);
});

test("supports multiple redistribution rounds", function () {
  const result = core.allocate([
    { name: "A", eligible: 100, applicants: 1 },
    { name: "B", eligible: 100, applicants: 15 },
    { name: "C", eligible: 100, applicants: 100 }
  ]);
  assert.equal(result.availableSeats, 36);
  assert.deepEqual(Array.from(result.allocations), [1, 15, 20]);
  assert.equal(result.rounds.length, 3);
  assert.equal(result.unallocatedSeats, 0);
});

test("reports seats left after all applicants are funded", function () {
  const result = core.allocate([
    { name: "A", eligible: 100, applicants: 2 },
    { name: "B", eligible: 100, applicants: 3 }
  ]);
  assert.equal(result.availableSeats, 24);
  assert.deepEqual(Array.from(result.allocations), [2, 3]);
  assert.equal(result.unallocatedSeats, 19);
  assert.deepEqual(Array.from(result.remainingApplicants), [0, 0]);
});

test("handles all-zero counts with an auditable first round", function () {
  const result = core.allocate([
    { name: "A", eligible: 0, applicants: 0 },
    { name: "B", eligible: 0, applicants: 0 }
  ]);
  assert.equal(result.availableSeats, 0);
  assert.equal(result.rounds.length, 1);
  assert.deepEqual(Array.from(result.allocations), [0, 0]);
});

test("rejects applicants greater than eligible faculty", function () {
  assert.throws(function () {
    core.allocate([{ name: "A", eligible: 2, applicants: 3 }]);
  }, /more applicants than eligible/);
});

test("calculates the embedded committee test dataset", function () {
  const result = core.allocate([
    { name: "CECS", eligible: 33, applicants: 6 },
    { name: "CHHD", eligible: 64, applicants: 12 },
    { name: "COH", eligible: 39, applicants: 13 },
    { name: "COUNSELING", eligible: 9, applicants: 0 },
    { name: "CSBS", eligible: 75, applicants: 21 },
    { name: "CSM", eligible: 45, applicants: 16 },
    { name: "DNCBE", eligible: 38, applicants: 13 },
    { name: "LIBRARY", eligible: 18, applicants: 2 },
    { name: "MCCAMC", eligible: 39, applicants: 10 },
    { name: "MDECOE", eligible: 22, applicants: 7 }
  ]);
  assert.equal(result.totalEligible, 382);
  assert.equal(result.totalApplicants, 100);
  assert.equal(result.availableSeats, 46);
  assert.deepEqual(Array.from(result.allocations), [4, 8, 5, 0, 10, 5, 4, 2, 5, 3]);
  assert.equal(result.rounds.length, 2);
});

test("preserves allocation invariants across varied inputs", function () {
  let seed = 73129;
  function random(max) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed % max;
  }

  for (let scenario = 0; scenario < 250; scenario += 1) {
    const count = 1 + random(12);
    const colleges = [];
    for (let index = 0; index < count; index += 1) {
      const eligible = random(301);
      colleges.push({
        name: "College " + index,
        eligible: eligible,
        applicants: random(eligible + 1),
        carryForward: random(4) === 0 ? random(1000) / 1000 : 0
      });
    }

    const result = core.allocate(colleges);
    assert.equal(result.allocatedSeats + result.unallocatedSeats, result.availableSeats);
    assert.equal(result.allocations.reduce(function (a, b) { return a + b; }, 0), result.allocatedSeats);
    result.allocations.forEach(function (allocation, index) {
      assert.ok(Number.isInteger(allocation) && allocation >= 0);
      assert.ok(allocation <= colleges[index].applicants);
      assert.ok(result.nextCarryForwards[index] >= 0 && result.nextCarryForwards[index] < 1);
    });
    assert.equal(result.rounds[0].participantIndexes.length, count);
    result.rounds.forEach(function (round, index) {
      assert.equal(round.baseTotal + round.remainderSeats, round.pool);
      assert.equal(round.funded + round.returned, round.pool);
      assert.equal(round.records.reduce(function (sum, record) { return sum + record.offered; }, 0), round.pool);
      if (index > 0) {
        round.records.forEach(function (record) { assert.ok(record.applicantsBefore > 0); });
      }
    });
  }
});

let passed = 0;
for (const current of tests) {
  try {
    current.fn();
    passed += 1;
    console.log("✓", current.name);
  } catch (error) {
    console.error("✗", current.name);
    throw error;
  }
}
console.log("\n" + passed + " tests passed.");
