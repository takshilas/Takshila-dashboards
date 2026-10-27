// Checks every 12-month series row against the checksum the SQL printed with it.
import fs from 'node:fs';
const w = {}; new Function('window', fs.readFileSync(new URL('../private/data-r12.js', import.meta.url), 'utf8'))(w);
let bad = 0;
w.BRITAX_R12.forEach((r) => {
  const p = r.split('|'), ser = [p[2], p[3], p[4]].map((s) => s.split(',')), ck = p[5].split(',');
  ser.forEach((a, i) => {
    const sum = a.reduce((t, x) => t + (x === '' ? 0 : +x), 0), want = +ck[i], got = i === 0 ? +sum.toFixed(1) : sum;
    if (a.length !== 52 || Math.abs(got - want) > (i === 0 ? 0.05 : 0)) { bad++; console.log('MISMATCH', p[0], p[1], ['idx', 'promo', 'units'][i], 'len', a.length, 'got', got, 'expected', want); }
  });
});
console.log(bad ? `${bad} series mismatch` : `12-month series: all ${w.BRITAX_R12.length} rows match their SQL checksums`);
process.exit(bad ? 1 : 0);
