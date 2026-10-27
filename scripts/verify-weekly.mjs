// Every weekly sales and units series must have 106 values and add up to the totals the query printed.
import fs from 'node:fs'; import vm from 'node:vm';
const w = {}; vm.runInNewContext(fs.readFileSync(new URL('../private/data-weekly.js', import.meta.url), 'utf8'), { window: w });
let bad = 0;
w.BRITAX_WEEKLY.forEach((r) => {
  const p = r.split('|'), ck = p[4].split(',').map(Number);
  [p[2], p[3]].forEach((s, i) => { const a = s.split(','), sum = a.reduce((t, x) => t + (x === '' ? 0 : Number(x)), 0); if (a.length !== 106 || sum !== ck[i]) { bad++; console.log('MISMATCH', p[0], p[1], i ? 'units' : 'sales', 'len', a.length, 'sum', sum, 'expected', ck[i]); } });
});
console.log(bad ? `${bad} series mismatch` : `weekly sales and units: all ${w.BRITAX_WEEKLY.length} rows match their SQL checksums`); process.exit(bad ? 1 : 0);
