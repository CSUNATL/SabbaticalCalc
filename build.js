'use strict';
/* Splices src/logic.js into src/app.html at the /*__LOGIC__*\/ marker and writes
   dist/sabbatical-allocation.html. No dependencies, no minification: the deliverable
   stays readable source. Line endings are normalised to LF so the output is identical
   on Windows and macOS. */
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const lf = s => s.replace(/\r\n/g, '\n');
const logic = lf(fs.readFileSync(path.join(root, 'src', 'logic.js'), 'utf8'));
const app = lf(fs.readFileSync(path.join(root, 'src', 'app.html'), 'utf8'));

// Drop the Node export guard; the browser must not see `module`.
const exportGuard = /\n\/\* Node export for tests[^\n]*\n(?:if \(typeof module[\s\S]*?\n\}\n)/;
if (!exportGuard.test(logic)) throw new Error('src/logic.js: export guard not found');
const browserLogic = logic.replace(exportGuard, '\n').trimEnd() + '\n';

const marker = '/*__LOGIC__*/';
if (app.split(marker).length !== 2) throw new Error('src/app.html: expected exactly one /*__LOGIC__*/ marker');
const out = app.replace(marker, browserLogic.trimEnd());

if (/\bmodule\.exports\b/.test(out)) throw new Error('module.exports leaked into the deliverable');
if (/<script[^>]*\ssrc=|<link[^>]*\shref=|https?:\/\//i.test(out)) throw new Error('deliverable references an external resource');

if (require.main === module) {
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  const dest = path.join(root, 'dist', 'sabbatical-allocation.html');
  fs.writeFileSync(dest, out);
  console.log(`built ${path.relative(root, dest)} (${out.length} characters)`);
}

module.exports = { build: () => out };   // used by test/build.test.js; requiring this file writes nothing
