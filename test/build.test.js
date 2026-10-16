'use strict';
/* Checks that dist/ is what build.js produces from src/, for both deliverables, and that each is self-contained. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { build, OUTPUTS } = require('../build.js');

const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'dist', name), 'utf8').replace(/\r\n/g, '\n');
const dists = Object.fromEntries(Object.entries(OUTPUTS).map(([m, name]) => [m, read(name)]));
const each = fn => { for (const [m, dist] of Object.entries(dists)) fn(dist, m, OUTPUTS[m]); };

test('dist/ is up to date with src/ (run `npm run build`)', () => {
  assert.deepEqual(OUTPUTS, { hamilton: 'sabbatical-allocation.html', webster: 'sabbatical_webster.html' });
  each((dist, m, name) => assert.equal(dist, build(m), name));
});

test('each deliverable is one self-contained file', () => {
  each(dist => {
    assert.doesNotMatch(dist, /<script[^>]*\ssrc=/i);
    assert.doesNotMatch(dist, /<link[^>]*\shref=/i);
    assert.doesNotMatch(dist, /https?:\/\//i);
    assert.doesNotMatch(dist, /@import|url\(\s*["']?\s*(https?:|\/\/)/i);
    assert.doesNotMatch(dist, /module\.exports/);
    assert.doesNotMatch(dist, /localStorage|sessionStorage|indexedDB/);
  });
});

test('each deliverable script parses and the logic part runs without a DOM', () => {
  each((dist, m) => {
    const scripts = Array.from(dist.matchAll(/<script>([\s\S]*?)<\/script>/g));
    assert.equal(scripts.length, 1);
    const src = scripts[0][1];
    assert.doesNotThrow(() => new vm.Script(src));
    const logicOnly = src.slice(0, src.indexOf('/* ---------- UI ---------- */'));
    const ctx = vm.createContext({});
    vm.runInContext(logicOnly + '\nthis.api = { computeSeatPool, hamilton, webster, allocate, validate };', ctx);
    assert.equal(ctx.api.computeSeatPool([{ eligible: 382 }], 12, 'up').seats, 46);
    const res = ctx.api.allocate([{ name: 'A', eligible: 50, applicants: 5 }, { name: 'B', eligible: 30, applicants: 5 }], 8, 'eligible', m);
    assert.equal(res.apportionment, m);
    assert.deepEqual(res.final.map(f => f.awarded), [5, 3]);
  });
});

test('each page has the pieces the UI relies on and no build markers', () => {
  each((dist, m) => {
    for (const id of ['percent', 'rounding', 'inputRows', 'errors', 'results', 'method', 'fileLoad', 'btnCsv']) {
      assert.ok(dist.includes(`id="${id}"`), id);
    }
    assert.match(dist, /class="methodlink"/);
    assert.match(dist, /addEventListener\('beforeprint'/);
    assert.match(dist, /addEventListener\('afterprint'/);
    assert.match(dist, /id="percent"[^>]*step="0\.0001"/);
    assert.match(dist, /id="tieMethod"/);
    assert.match(dist, /id="method-files"/);
    assert.match(dist, /sabbatical-inputs\.csv/);
    assert.doesNotMatch(dist, /sabbatical-inputs\.json/);
    assert.match(dist, /href="#method-files" class="methodlink"/);
    assert.match(dist, /addEventListener\('dragstart'/);
    assert.match(dist, /data-mv="-1"/);
    assert.doesNotMatch(dist, /localeCompare/);            // name is no longer a tie-break rule
    assert.ok(dist.includes(`const APPORTIONMENT = '${m}';`), m);
    assert.doesNotMatch(dist, /<!--\[|\/\*\[/);              // every marked block was kept or removed, markers and all
    assert.doesNotMatch(dist, /\n[ \t]+\n[ \t]+\n/);          // and no run of blank lines was left where a block was removed
  });
});

test('the two deliverables differ only in the method', () => {
  const h = dists.hamilton, w = dists.webster;
  assert.match(h, /<title>Sabbatical allocation worksheet<\/title>/);
  assert.match(w, /<title>Sabbatical allocation worksheet \(Webster method\)<\/title>/);
  assert.match(h, /using the Hamilton \(largest-remainder\) method\. Every number/);
  assert.match(w, /using Webster's method, in which every college's eligible faculty is divided by one common divisor/);
  assert.ok(h.includes('METHODS.hamilton = {') && !h.includes('METHODS.webster = {'));
  assert.ok(w.includes('METHODS.webster = {') && !w.includes('METHODS.hamilton = {'));
  assert.ok(h.includes('Give the seats left over, one each') && !h.includes("Why Webster's method"));
  assert.ok(w.includes("Why Webster's method") && !w.includes('Give the seats left over, one each'));
  assert.ok(h.includes('Carry forward is the fractional part of a seat') && w.includes('Carry forward is the half seat'));
  // Both carry the whole logic, so either file's record could be recomputed by the other method.
  for (const dist of [h, w]) assert.ok(dist.includes('function hamilton(') && dist.includes('function webster('));
});
