/* ---------- Allocation logic (pure; no DOM) ---------- */

/* Seat pool = total eligible faculty × percent ÷ 100, rounded by `rounding` ('up' | 'nearest' | 'down').
   The percentage is taken in ten-thousandths of a percent (four decimal places) and the product is
   formed in integer arithmetic, so 375 × 18.4% is exactly 69 and never 68.999…. "Nearest" rounds an
   exact half up. `exactText` is the exact product written out in decimal (at most six places). */
const PERCENT_SCALE = 10000;                      // percent in ten-thousandths: 12.3456% -> 123456
const POOL_DEN = 100 * PERCENT_SCALE;             // exact product = totalEligible × percentScaled ÷ POOL_DEN
function computeSeatPool(colleges, percent, rounding) {
  const totalEligible = colleges.reduce((s, c) => s + c.eligible, 0);
  const percentScaled = Math.round(percent * PERCENT_SCALE);
  const num = totalEligible * percentScaled;
  const rem = num % POOL_DEN;
  const whole = (num - rem) / POOL_DEN;
  let seats;
  if (rounding === 'down') seats = whole;
  else if (rounding === 'nearest') seats = rem * 2 >= POOL_DEN ? whole + 1 : whole;
  else seats = rem > 0 ? whole + 1 : whole;
  const exactText = rem === 0 ? String(whole) : `${whole}.${String(rem).padStart(6, '0').replace(/0+$/, '')}`;
  return { totalEligible, percent, percentScaled, exact: num / POOL_DEN, exactText, seats, rounding };
}

/* Hamilton (largest remainder) apportionment of `seats` among `parts`.
   parts: [{ idx, name, eligible, carry }], where idx is the college's position in the list (0 = top).
   Integer arithmetic throughout so ties are exact.
   Extra seats go to the largest fractional parts. Ties at the cutoff are broken by the larger carry
   forward (compared in thousandths), then by the steps of `method`, in order:
     'eligible'  (default): more eligible faculty.
     'list':     position in the list (higher wins), then more eligible faculty.
     'list-only': position in the list (higher wins), nothing after that.
   If every step of the method leaves two colleges equal, the tie is unresolved: the seat is placed
   provisionally with the college listed higher (so the calculation can finish) and tieDecidedBy =
   'unresolved'. List positions are unique, so a method that includes the list step always resolves. */
const TIE_STEPS = { eligible: ['eligible'], list: ['list', 'eligible'], 'list-only': ['list'] };
const TIE_METHODS = Object.keys(TIE_STEPS);
const TIE_STEP_CMP = { eligible: (a, b) => b.eligible - a.eligible, list: (a, b) => a.idx - b.idx };
const carryKey = x => Math.round((x || 0) * 1000);   // carry forward compared in thousandths of a seat
function hamilton(parts, seats, method) {
  if (!TIE_METHODS.includes(method)) method = 'eligible';
  const steps = TIE_STEPS[method];
  const total = parts.reduce((s, p) => s + p.eligible, 0);
  const rows = parts.map(p => {
    const num = seats * p.eligible;
    const whole = Math.floor(num / total);
    const remNum = num - whole * total;           // numerator of fractional part (0..total-1)
    return {
      idx: p.idx, name: p.name, eligible: p.eligible, carry: p.carry || 0,
      share: p.eligible / total,
      quota: num / total,
      whole,
      remNum, fraction: remNum / total,
      remainderSeat: 0, rank: 0, allocated: whole, tie: '',
    };
  });
  const wholeSum = rows.reduce((s, r) => s + r.whole, 0);
  const remainderSeats = seats - wholeSum;
  const order = rows.slice().sort((a, b) => {
    let d = b.remNum - a.remNum || carryKey(b.carry) - carryKey(a.carry);
    for (const step of steps) d = d || TIE_STEP_CMP[step](a, b);
    return d || a.idx - b.idx;                    // provisional placement of an unresolved tie: listed higher
  });
  order.forEach((r, i) => { r.rank = i + 1; });
  for (let i = 0; i < remainderSeats; i++) { order[i].remainderSeat = 1; order[i].allocated = order[i].whole + 1; }
  // Detect ties that mattered: same remNum straddling the cutoff. Mark who won and who lost,
  // and record which rule separated the last winner from the first loser.
  const ties = [];
  let tieDecidedBy = '';
  if (remainderSeats > 0 && remainderSeats < order.length) {
    const cut = order[remainderSeats - 1].remNum;
    if (order[remainderSeats].remNum === cut) {
      const tied = order.filter(r => r.remNum === cut);
      ties.push(...tied.map(r => r.name));
      tied.forEach(r => { r.tie = r.remainderSeat ? 'won' : 'lost'; });
      const w = order[remainderSeats - 1], l = order[remainderSeats];
      if (carryKey(w.carry) !== carryKey(l.carry)) tieDecidedBy = 'carry';
      else tieDecidedBy = steps.find(step => TIE_STEP_CMP[step](w, l) !== 0) || 'unresolved';
    }
  }
  return { total, wholeSum, remainderSeats, rows, order, ties, tieDecidedBy, unresolved: tieDecidedBy === 'unresolved', method };
}

function allocate(colleges, seats, method) {
  if (!TIE_METHODS.includes(method)) method = 'eligible';
  const n = colleges.length;
  const demand = colleges.map(c => c.applicants);
  const awarded = colleges.map(() => 0);
  const byRound = colleges.map(() => []);
  const settledIn = colleges.map(() => null);
  const carryIn = colleges.map(c => c.carry || 0);
  const carryNow = carryIn.slice();          // used for tie-breaks; winning a tie clears it for later rounds
  const tieEvents = colleges.map(() => []);
  const rounds = [];
  let pool = seats;
  let round = 0;
  let unallocated = 0;
  let stopReason = '';

  while (true) {
    if (pool === 0) { stopReason = 'All seats have been placed.'; break; }
    round++;
    const partIdx = round === 1
      ? colleges.map((_, i) => i)
      : colleges.map((_, i) => i).filter(i => demand[i] > 0);
    if (partIdx.length === 0) {
      unallocated = pool;
      stopReason = `${pool} seat${pool === 1 ? '' : 's'} could not be placed: every college already has as many seats as it has applicants.`;
      break;
    }
    if (round > n + 1) { stopReason = 'Stopped: round limit exceeded (this should not happen; check inputs).'; unallocated = pool; break; }

    const parts = partIdx.map(i => ({ idx: i, name: colleges[i].name, eligible: colleges[i].eligible, carry: carryNow[i] }));
    const h = hamilton(parts, pool, method);
    let surplusTotal = 0;
    const settledNow = [];
    h.rows.forEach(r => {
      r.demandBefore = demand[r.idx];
      r.funded = Math.min(r.allocated, demand[r.idx]);
      r.surplus = r.allocated - r.funded;
      demand[r.idx] -= r.funded;
      awarded[r.idx] += r.funded;
      if (r.funded > 0) byRound[r.idx].push({ round, seats: r.funded });
      r.demandAfter = demand[r.idx];
      r.settled = demand[r.idx] === 0;
      if (r.settled && settledIn[r.idx] === null) { settledIn[r.idx] = round; settledNow.push(r.name); }
      if (r.tie) {
        tieEvents[r.idx].push({ round, result: r.tie, fraction: r.fraction, decidedBy: h.tieDecidedBy });
        if (r.tie === 'won') carryNow[r.idx] = 0;
      }
      surplusTotal += r.surplus;
    });
    rounds.push({
      round, pool, participants: partIdx.length, totalEligible: h.total,
      wholeSum: h.wholeSum, remainderSeats: h.remainderSeats,
      rows: h.rows, order: h.order, ties: h.ties, tieDecidedBy: h.tieDecidedBy, unresolved: h.unresolved, method,
      funded: pool - surplusTotal, surplus: surplusTotal, settledNow,
    });
    pool = surplusTotal;
  }

  // Carry forward for next year, from this year's tie events in order:
  // won a tie -> reset to 0; lost a tie and still has an unfunded applicant at year end -> add the lost fraction;
  // lost a tie but every applicant was funded -> unchanged. Recorded to three decimals.
  const r3 = x => Math.round(x * 1000) / 1000;
  const final = colleges.map((c, i) => {
    let carryNext = carryIn[i];
    tieEvents[i].forEach(ev => {
      if (ev.result === 'won') { carryNext = 0; ev.counted = true; }
      else if (demand[i] > 0) { carryNext = r3(carryNext + ev.fraction); ev.counted = true; }
      else ev.counted = false;
      ev.carryAfter = carryNext;
    });
    return {
      idx: i, name: c.name, eligible: c.eligible, applicants: c.applicants,
      awarded: awarded[i], unfunded: demand[i], byRound: byRound[i], settledIn: settledIn[i],
      carry: carryIn[i], carryNext, tieEvents: tieEvents[i],
    };
  });
  const unresolvedRounds = rounds.filter(rd => rd.unresolved).map(rd => rd.round);
  return { seats, rounds, final, unallocated, stopReason, totalAwarded: awarded.reduce((s, a) => s + a, 0), method, unresolvedRounds };
}

function validate(colleges, percent) {
  const errors = [];
  if (!(percent >= 0 && percent <= 100)) errors.push('Seat percentage must be between 0 and 100.');
  else if (Math.abs(percent * PERCENT_SCALE - Math.round(percent * PERCENT_SCALE)) > 1e-6) errors.push('Seat percentage can have at most four decimal places.');
  if (colleges.length === 0) errors.push('Add at least one college.');
  const seen = new Map();
  colleges.forEach((c, i) => {
    const label = c.name.trim() ? `"${c.name.trim()}"` : `row ${i + 1}`;
    if (!c.name.trim()) errors.push(`Row ${i + 1} needs a college name.`);
    else if (seen.has(c.name.trim().toLowerCase())) errors.push(`${label} appears more than once.`);
    seen.set(c.name.trim().toLowerCase(), true);
    if (!Number.isInteger(c.eligible) || c.eligible < 0) errors.push(`${label}: eligible faculty must be a whole number of 0 or more.`);
    if (!Number.isInteger(c.applicants) || c.applicants < 0) errors.push(`${label}: applicants must be a whole number of 0 or more.`);
    if (Number.isInteger(c.eligible) && Number.isInteger(c.applicants) && c.applicants > c.eligible)
      errors.push(`${label}: applicants (${c.applicants}) cannot exceed eligible faculty (${c.eligible}).`);
    if (!(Number.isFinite(c.carry) && c.carry >= 0)) errors.push(`${label}: carry forward must be a number of 0 or more (enter 0 if there is none).`);
  });
  const totalEligible = colleges.reduce((s, c) => s + (Number.isInteger(c.eligible) ? c.eligible : 0), 0);
  if (colleges.length && totalEligible === 0) errors.push('Enter the eligible faculty for each college; the total is currently zero.');
  return errors;
}

/* ---------- Inputs file: a CSV spreadsheet ---------- */
/* The inputs file is a spreadsheet saved as CSV with one row per college and columns for the college
   name, eligible faculty, applicants and, optionally, carry forward. Nothing else is in the file: the
   seat percentage, rounding rule and tie rule are set on the page.
   parseInputsCsv(text) -> [{ name, eligible, applicants, carry }] in file order.
     - The delimiter is whichever of comma, semicolon or tab is most frequent in the first line, so
       files from Excel in any locale and tab-separated files both load. Quoted cells may contain the
       delimiter and doubled quotes. A leading byte-order mark is ignored.
     - The first row is a header if it names an eligible-faculty or applicants column; the columns are
       then matched by their headings (college/name, eligib..., applic..., carry) in any order. Without
       a header the columns are taken as: college, eligible faculty, applicants, carry forward.
     - Blank rows and a row named "Total" are skipped. A blank applicants or carry-forward cell is 0;
       a blank eligible-faculty cell is NaN so validate() reports it. Thousands separators are removed.
     - Throws an Error whose message completes "The file could not be loaded: ..." when there is nothing
       usable in the file.
   formatInputsCsv(colleges) -> the same shape with a header row, CRLF line endings, for Excel. */
const CSV_HEADINGS = { name: /college|name|unit|school|division/i, eligible: /eligib/i, applicants: /applic/i, carry: /carry/i };
function csvRows(text) {
  text = String(text || '').replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/).find(l => l.trim()) || '';
  const delim = [',', ';', '\t'].map(d => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(c => c.trim())).filter(r => r.some(c => c !== ''));
}
function parseInputsCsv(text) {
  const rows = csvRows(text);
  if (!rows.length) throw new Error('the file is empty');
  const cellNum = (s, blank) => { const t = (s || '').replace(/[,\s]/g, ''); return t === '' ? blank : Number(t); };
  let cols, first = 0;
  const head = rows[0];
  const found = {};
  for (const k of ['eligible', 'applicants', 'carry', 'name']) {
    const j = head.findIndex((c, idx) => CSV_HEADINGS[k].test(c) && !Object.values(found).includes(idx));
    if (j >= 0) found[k] = j;
  }
  if (found.eligible !== undefined || found.applicants !== undefined) {           // a header row
    if (found.eligible === undefined) throw new Error('the header row has no column for eligible faculty');
    if (found.applicants === undefined) throw new Error('the header row has no column for applicants');
    if (found.name === undefined) found.name = head.findIndex((c, idx) => !Object.values(found).includes(idx));
    if (found.name < 0) throw new Error('the header row has no column for the college name');
    cols = found; first = 1;
  } else {
    if (rows.every(r => r.length < 3)) throw new Error('rows need at least three columns: college, eligible faculty, applicants');
    cols = { name: 0, eligible: 1, applicants: 2, carry: 3 };
  }
  const colleges = [];
  for (let i = first; i < rows.length; i++) {
    const r = rows[i];
    const name = r[cols.name] || '';
    if (name.toLowerCase() === 'total') continue;
    colleges.push({
      name,
      eligible: cellNum(r[cols.eligible], NaN),
      applicants: cellNum(r[cols.applicants], 0),
      carry: cols.carry === undefined ? 0 : cellNum(r[cols.carry], 0),
    });
  }
  if (!colleges.length) throw new Error('no college rows were found after the header row');
  return colleges;
}
function formatInputsCsv(colleges) {
  const q = v => { const s = String(v ?? ''); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const num = v => Number.isFinite(v) ? String(v) : '';
  const lines = [['College', 'Eligible faculty', 'Applicants', 'Carry forward'].join(',')];
  colleges.forEach(c => lines.push([q(c.name), num(c.eligible), num(c.applicants), num(c.carry)].join(',')));
  return lines.join('\r\n') + '\r\n';
}

/* Node export for tests; ignored in the browser. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeSeatPool, hamilton, allocate, validate, TIE_METHODS, parseInputsCsv, formatInputsCsv };
}
