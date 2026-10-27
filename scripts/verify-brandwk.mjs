// Checks the brand weekly sales table: 94 values per series and the sums match the SQL checksums, and the brands of a category never exceed the category total in data-weekly.js.
import fs from 'node:fs'; import vm from 'node:vm';
const load = (f) => { const w = {}; vm.runInNewContext(fs.readFileSync(new URL('../private/' + f, import.meta.url), 'utf8'), { window: w }); return w; };
const rows = load('data-brand-weekly.js').BRITAX_BRANDWK, wk = load('data-weekly.js').BRITAX_WEEKLY;
let bad = 0; const tot = {}; 
wk.forEach((r) => { const p = r.split('|'); if (p[1] !== 'Segment total') return; p[2].split(',').forEach((x, i) => { if (i >= 12 && x !== '') { tot[p[0]] = tot[p[0]] || []; tot[p[0]][i - 12] = +x; } }); });
const sum = {};
rows.forEach((r) => {
  const p = r.split('|'), v = p[2].split(','), s = v.reduce((a, x) => a + (x === '' ? 0 : +x), 0);
  if (v.length !== 94 || s !== +p[3]) { bad++; console.log('MISMATCH', p[0], p[1], v.length, s, p[3]); }
  const c = p[0]; sum[c] = sum[c] || []; v.forEach((x, i) => { sum[c][i] = (sum[c][i] || 0) + (x === '' ? 0 : +x * 100); });
});
for (const c of ['0', '1', '2', '3']) sum[c].forEach((x, i) => { if (x > tot[c][i] * 1.001) { bad++; console.log('BRANDS EXCEED CATEGORY', c, i + 12, x, tot[c][i]); } });
console.log(`brand weekly sales: ${bad ? 'FAILED' : 'all ' + rows.length + ' rows match their checksums and stay within the category totals'}`); if (bad) process.exit(1);
