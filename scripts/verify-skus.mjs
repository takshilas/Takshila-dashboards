// Checks every key-product price series against the checksum the SQL printed with it.
import fs from 'node:fs';
const w = {}; new Function('window', fs.readFileSync(new URL('../private/data-skus.js', import.meta.url), 'utf8'))(w);
let bad = 0;
w.BRITAX_SKUS.forEach((r) => {
  const p = r.split('|'), a = p[6].split(','), sum = a.reduce((t, x) => t + (x === '' ? 0 : +x), 0);
  if (p.length !== 8 || a.length !== 52 || sum !== +p[7]) { bad++; console.log('MISMATCH', p[0], p[2], 'len', a.length, 'sum', sum, 'expected', p[7]); }
});
console.log(bad ? `${bad} rows mismatch` : `key products: all ${w.BRITAX_SKUS.length} rows match their SQL checksums`);
process.exit(bad ? 1 : 0);
