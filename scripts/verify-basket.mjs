// Re-computes the checksum that the Databricks query printed with each basket row.
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../private/data-basket.js', import.meta.url), 'utf8');
const window = {}; new Function('window', src)(window);
let bad = 0;
window.BRITAX_BASKET.forEach((row) => {
  const p = row.split('|');
  const a = p[5].split(',');
  const sum = a.reduce((t, x) => t + (x === '' ? 0 : Number(x)), 0);
  if (a.length !== 106 || sum !== Number(p[6])) { bad++; console.log('MISMATCH', p[0], p[1], 'len', a.length, 'sum', sum, 'expected', p[6]); }
});
console.log(bad ? `${bad} of ${window.BRITAX_BASKET.length} rows mismatch` : `basket: all ${window.BRITAX_BASKET.length} rows match their SQL checksums`);
process.exit(bad ? 1 : 0);
