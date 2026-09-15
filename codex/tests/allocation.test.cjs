"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const htmlPath = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
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
        applicants: random(eligible + 1)
      });
    }

    const result = core.allocate(colleges);
    assert.equal(result.allocatedSeats + result.unallocatedSeats, result.availableSeats);
    assert.equal(result.allocations.reduce(function (a, b) { return a + b; }, 0), result.allocatedSeats);
    result.allocations.forEach(function (allocation, index) {
      assert.ok(Number.isInteger(allocation) && allocation >= 0);
      assert.ok(allocation <= colleges[index].applicants);
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
