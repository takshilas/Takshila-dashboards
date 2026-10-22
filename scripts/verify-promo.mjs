// Re-computes the SQL checksums for the October Prime tables (data-promo.js).
import fs from 'node:fs';
const w = {}; new Function('window', fs.readFileSync(new URL('../private/data-promo.js', import.meta.url), 'utf8'))(w);
const num = (v) => (v === '' ? 0 : +v);
let bad = 0; const check = (name, got, want) => { if (got !== want) { bad++; console.log('MISMATCH', name, 'got', got, 'expected', want); } };
// brand table: per period row count, units, coverage, price index, units on promo, depth, SKU-weeks on promo
const want = [
  { n: 108, u: 511835, cov: 10418, idx: 10245.0, pu: 4112, dp: 1382.0, ps: 3104 },
  { n: 108, u: 724037, cov: 10477, idx: 10021.3, pu: 5149, dp: 1357.2, ps: 3715 },
  { n: 108, u: 431514, cov: 10499, idx: 10527.6, pu: 2894, dp: 1250.3, ps: 2243 }];
const have = [0, 1, 2].map(() => ({ n: 0, u: 0, cov: 0, idx: 0, pu: 0, dp: 0, ps: 0 }));
w.BRITAX_PROMO.forEach((r) => { const p = r.split('|'); if (p.length !== 6) { bad++; console.log('BAD', r); return; } for (let k = 0; k < 3; k++) { const v = p[3 + k].split(','), o = have[k]; if (v.length !== 6) { bad++; console.log('BAD', r); } o.n++; o.u += num(v[0]); o.cov += num(v[1]); o.idx += num(v[2]); o.pu += num(v[3]); o.dp += num(v[4]); o.ps += num(v[5]); } });
have.forEach((o, k) => { ['n', 'u', 'cov', 'pu', 'ps'].forEach((f) => check(`promo period ${k} ${f}`, o[f], want[k][f])); ['idx', 'dp'].forEach((f) => check(`promo period ${k} ${f}`, +o[f].toFixed(1), want[k][f])); });
// weekly: 192 weeks with a price index, sums of index, % on promo, units
let n = 0, idx = 0, pu = 0, un = 0;
w.BRITAX_PWEEK.forEach((r) => { const p = r.split('|'), a = p[3].split(','), b = p[4].split(','), c = p[5].split(','); if (a.length !== 10 || b.length !== 10 || c.length !== 10) { bad++; console.log('BAD', r); } a.forEach((x) => { if (x !== '') { n++; idx += +x; } }); b.forEach((x) => { pu += num(x); }); c.forEach((x) => { un += num(x); }); });
check('pweek n', n, 192); check('pweek idx', +idx.toFixed(1), 18115.9); check('pweek pu', pu, 8327); check('pweek units', un, 1495261);
// SKU table: per segment x event sums of baseline, three prices, three unit columns
const wantSku = { '0|0': '11|3400,3033,2778,3262,5640,16657,5613', '0|1': '11|3631,3237,2859,3461,7263,20021,5251', '1|0': '11|1184,1111,1092,1199,13483,19464,10501', '1|1': '11|1311,1145,1022,1227,6499,11142,5539',
  '2|0': '11|2419,2170,2172,2357,2849,4067,2545', '2|1': '11|1880,1770,1839,1624,2482,2723,1982', '3|0': '11|3324,3197,3114,3451,2052,3539,1855', '3|1': '11|3729,3477,3258,3288,1467,3554,1198',
  '4|0': '7|2730,2539,2605,2788,1276,1985,1178', '4|1': '7|4601,4447,4319,4459,947,2739,950', '5|0': '11|4257,4042,3661,4164,2530,3543,2042', '5|1': '11|4315,3375,3801,3439,2702,3094,2515' };
const g = {};
w.BRITAX_PSKU.forEach((r) => { const p = r.split('|'); if (p.length !== 7) { bad++; console.log('BAD', r); return; } const k = p[0] + '|' + p[1], v = p[6].split(',').map(num), o = (g[k] = g[k] || { n: 0, s: [0, 0, 0, 0, 0, 0, 0] }); o.n++; v.forEach((x, i) => { o.s[i] += x; }); });
Object.keys(wantSku).forEach((k) => check('psku ' + k, g[k] ? g[k].n + '|' + g[k].s.join(',') : 'missing', wantSku[k]));
console.log(bad ? `${bad} mismatches` : 'promo: brand table, weekly series and SKU table all match their SQL checksums');
process.exit(bad ? 1 : 0);
