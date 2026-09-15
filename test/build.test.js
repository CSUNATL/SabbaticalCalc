'use strict';
/* Checks that dist/ is what build.js produces from src/, and that the deliverable is self-contained. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { build } = require('../build.js');

const root = path.join(__dirname, '..');
const dist = fs.readFileSync(path.join(root, 'dist', 'sabbatical-allocation.html'), 'utf8').replace(/\r\n/g, '\n');

test('dist/sabbatical-allocation.html is up to date with src/ (run `npm run build`)', () => {
  assert.equal(dist, build());
});

test('deliverable is one self-contained file', () => {
  assert.doesNotMatch(dist, /<script[^>]*\ssrc=/i);
  assert.doesNotMatch(dist, /<link[^>]*\shref=/i);
  assert.doesNotMatch(dist, /https?:\/\//i);
  assert.doesNotMatch(dist, /@import|url\(\s*["']?\s*(https?:|\/\/)/i);
  assert.doesNotMatch(dist, /module\.exports/);
  assert.doesNotMatch(dist, /localStorage|sessionStorage|indexedDB/);
});

test('deliverable script parses and the logic part runs without a DOM', () => {
  const scripts = Array.from(dist.matchAll(/<script>([\s\S]*?)<\/script>/g));
  assert.equal(scripts.length, 1);
  const src = scripts[0][1];
  assert.doesNotThrow(() => new vm.Script(src));
  const logicOnly = src.slice(0, src.indexOf('/* ---------- UI ---------- */'));
  const ctx = vm.createContext({});
  vm.runInContext(logicOnly + '\nthis.api = { computeSeatPool, hamilton, allocate, validate };', ctx);
  assert.equal(ctx.api.computeSeatPool([{ eligible: 382 }], 12, 'up').seats, 46);
});

test('page has the pieces the UI relies on', () => {
  for (const id of ['percent', 'rounding', 'inputRows', 'errors', 'results', 'method', 'fileLoad', 'btnCsv']) {
    assert.ok(dist.includes(`id="${id}"`), id);
  }
  assert.match(dist, /class="methodlink"/);
  assert.match(dist, /addEventListener\('beforeprint'/);
  assert.match(dist, /addEventListener\('afterprint'/);
  assert.match(dist, /id="percent"[^>]*step="0\.0001"/);
  assert.match(dist, /id="tieMethod"/);
  assert.match(dist, /id="method-files"/);
  assert.match(dist, /href="#method-files" class="methodlink"/);
  assert.match(dist, /addEventListener\('dragstart'/);
  assert.match(dist, /data-mv="-1"/);
  assert.doesNotMatch(dist, /localeCompare/);            // name is no longer a tie-break rule
});
