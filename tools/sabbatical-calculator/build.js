'use strict';
/* Splices src/logic.js into src/sabbatical-allocation.html at the /*__LOGIC__*\/ marker and writes one
   deliverable per apportionment method:
     dist/sabbatical-allocation.html   Hamilton (largest remainder)
     dist/sabbatical_webster.html      Webster (Sainte-Laguë)
   The page source holds both methods' text and rendering code in marked blocks,
     <!--[hamilton]--> ... <!--[/hamilton]-->   in markup,    /*[webster]*\/ ... /*[/webster]*\/   in script,
   and each build keeps only its own method's blocks (the markers themselves are removed) and sets the
   page's APPORTIONMENT constant. No dependencies, no minification: the deliverable stays readable
   source. Line endings are normalised to LF so the output is identical on Windows and macOS. */
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const OUTPUTS = { hamilton: 'sabbatical-allocation.html', webster: 'sabbatical_webster.html' };
const lf = s => s.replace(/\r\n/g, '\n');
const logic = lf(fs.readFileSync(path.join(root, 'src', 'logic.js'), 'utf8'));
const app = lf(fs.readFileSync(path.join(root, 'src', 'sabbatical-allocation.html'), 'utf8'));

// Drop the Node export guard; the browser must not see `module`.
const exportGuard = /\n\/\* Node export for tests[^\n]*\n(?:if \(typeof module[\s\S]*?\n\}\n)/;
if (!exportGuard.test(logic)) throw new Error('src/logic.js: export guard not found');
const browserLogic = logic.replace(exportGuard, '\n').trimEnd() + '\n';

const marker = '/*__LOGIC__*/';
if (app.split(marker).length !== 2) throw new Error('src/sabbatical-allocation.html: expected exactly one /*__LOGIC__*/ marker');
const spliced = app.replace(marker, browserLogic.trimEnd());

const decl = "const APPORTIONMENT = 'hamilton';";
if (spliced.split(decl).length !== 2) throw new Error('src/sabbatical-allocation.html: expected exactly one APPORTIONMENT declaration');

// A marked block: the opening marker with its indentation and line break when it stands on its own line,
// the content, then the closing marker the same way. A kept block loses its markers and nothing else;
// a removed block leaves no blank line behind. Markers may also sit inline within a line of text.
const block = (open, close) => new RegExp(`(?:^[ \\t]*)?${open}(?:[ \\t]*\\n)?([\\s\\S]*?)(?:^[ \\t]*)?${close}(?:[ \\t]*\\n)?`, 'gm');

function build(method = 'hamilton') {
  if (!OUTPUTS[method]) throw new Error(`unknown apportionment method: ${method}`);
  let out = spliced.replace(decl, `const APPORTIONMENT = '${method}';`);
  for (const m of Object.keys(OUTPUTS)) {
    const keep = m === method ? '$1' : '';
    out = out.replace(block(`<!--\\[${m}\\]-->`, `<!--\\[/${m}\\]-->`), keep);
    out = out.replace(block(`/\\*\\[${m}\\]\\*/`, `/\\*\\[/${m}\\]\\*/`), keep);
  }
  if (/<!--\[\/?\w+\]-->|\/\*\[\/?\w+\]\*\//.test(out)) throw new Error('a method marker is left in the deliverable: unbalanced markers or an unknown method name');
  if (/\bmodule\.exports\b/.test(out)) throw new Error('module.exports leaked into the deliverable');
  if (/<script[^>]*\ssrc=|<link[^>]*\shref=|https?:\/\//i.test(out)) throw new Error('deliverable references an external resource');
  return out;
}

if (require.main === module) {
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  for (const [method, name] of Object.entries(OUTPUTS)) {
    const out = build(method);
    const dest = path.join(root, 'dist', name);
    fs.writeFileSync(dest, out);
    console.log(`built ${path.relative(root, dest)} (${method}, ${out.length} characters)`);
  }
}

module.exports = { build, OUTPUTS };   // used by test/build.test.js; requiring this file writes nothing
