// Month-anchor price data: row checksums, and the latest anchor must reproduce the year-to-date and prior-year figures in data-asp.js / data-tier-asp.js.
import fs from 'node:fs'; import vm from 'node:vm';
const load = (f) => { const w = {}; vm.runInNewContext(fs.readFileSync(new URL('../private/' + f, import.meta.url), 'utf8'), { window: w }); return w; };
const A = load('data-anchor-asp.js').BRITAX_ANCHOR.trim().split('\n'), ASP = load('data-asp.js').BRITAX_ASP, TA = load('data-tier-asp.js').BRITAX_TIERASP;
let month = null, rows = 0, bad = 0; const last = {};
A.forEach((l) => {
  if (l[0] === '@') { month = l.slice(1); return; }
  const p = l.split('|'), v = p[3].split(',').map(Number), s = v.reduce((a, x) => a + x, 0); rows++;
  if (s !== Number(p[4])) { bad++; console.log('MISMATCH', month, l.slice(0, 60)); }
  if (month === '2026-10') last[p[0] + '|' + p[1] + '|' + p[2]] = v;
});
let reg = 0, regBad = 0;
const cmp = (key, o) => { const a = last[key]; if (!a) return; reg++; if (a[0] !== o[6] || a[1] !== o[7] || a[2] !== o[4] || a[3] !== o[5]) { regBad++; console.log('REGRESSION', key, a.slice(0, 4).join(','), 'vs', o.slice(4, 8).join(',')); } };
ASP.forEach((r) => { const p = r.split('|'); cmp(p[0] + '|A|' + p[1], p[2].split(',').map(Number)); });
TA.forEach((r) => { const p = r.split('|'); cmp(p[0] + '|' + p[1] + '|' + p[2], p[3].split(',').map(Number)); });
console.log(`month anchors: ${rows - bad} of ${rows} rows match their checksums; ${reg - regBad} of ${reg} latest-month figures reproduce the year-to-date tables`);
if (bad || regBad) process.exit(1);
