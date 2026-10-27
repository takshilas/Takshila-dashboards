// Checks the tier weekly table: 106 values per series, and the sums match the SQL checksums; and that the tiers add back to the category data in data-weekly.js.
import fs from 'node:fs'; import vm from 'node:vm';
const load = (f) => { const w = {}; vm.runInNewContext(fs.readFileSync(new URL('../private/' + f, import.meta.url), 'utf8'), { window: w }); return w; };
const t = load('data-tier-weekly.js').BRITAX_TIERWK, wk = load('data-weekly.js').BRITAX_WEEKLY;
let bad = 0; const sums = {};
t.forEach((r) => {
  const p = r.split('|'), s = p[3].split(','), u = p[4].split(','), ck = p[5].split(',').map(Number);
  const ss = s.reduce((a, x) => a + (x === '' ? 0 : +x), 0), su = u.reduce((a, x) => a + (x === '' ? 0 : +x), 0);
  if (s.length !== 106 || u.length !== 106 || ss !== ck[0] || su !== ck[1]) { bad++; console.log('MISMATCH', p.slice(0, 3).join('|'), s.length, u.length, ss, ck[0], su, ck[1]); }
  const k = p[0] + '|' + p[2]; sums[k] = sums[k] || { s: 0, u: 0 }; sums[k].s += ss * 100; sums[k].u += su;
});
// tiers must add up to the category figures (weeks 12..105) from data-weekly.js, within rounding of the $100 unit
wk.forEach((r) => {
  const p = r.split('|'); if (!['Britax group', 'All competitors'].includes(p[1])) return;
  const s = p[2].split(',').slice(12).reduce((a, x) => a + (x === '' ? 0 : +x), 0), u = p[3].split(',').slice(12).reduce((a, x) => a + (x === '' ? 0 : +x), 0);
  const k = p[0] + '|' + p[1], q = sums[k];
  if (!q || Math.abs(q.s - s) / s > 0.0005 || Math.abs(q.u - u) / u > 0.0005) { bad++; console.log('TIERS DO NOT ADD UP', k, q && q.s, s, q && q.u, u); }
});
// per-brand tier weekly sales: 94 values and the sums match; the brands in a tier cannot exceed all competitors in that tier
const br = load('data-tier-brand.js').BRITAX_TIERBR_WK; const sumBr = {};
br.forEach((r) => {
  const p = r.split('|'), s = p[3].split(','), ss = s.reduce((a, x) => a + (x === '' ? 0 : +x), 0);
  if (s.length !== 94 || ss !== +p[4]) { bad++; console.log('MISMATCH brand weekly', p.slice(0, 3).join('|'), s.length, ss, p[4]); }
  const k = p[0] + '|' + p[1]; sumBr[k] = (sumBr[k] || 0) + ss;
});
t.forEach((r) => { const p = r.split('|'); if (p[2] !== 'All competitors') return; const ss = p[3].split(',').slice(12).reduce((a, x) => a + (x === '' ? 0 : +x), 0), k = p[0] + '|' + p[1]; if ((sumBr[k] || 0) > ss * 1.001) { bad++; console.log('BRANDS EXCEED ALL COMPETITORS', k, sumBr[k], ss); } });
console.log(`tier weekly sales and units: ${bad ? 'FAILED' : 'all 24 rows match their checksums and the tiers add up to the category data'}`); if (bad) process.exit(1);
