// Re-computes the checksums that the Databricks query printed with each weekly row.
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../private/data-weekly.js', import.meta.url), 'utf8');
const window = {}; new Function('window', src)(window);
let bad = 0;
window.BRITAX_WEEKLY.forEach((row) => {
  const p = row.split('|');
  const ser = p.slice(1, 5).map((s) => s.split(','));
  const ck = p[5].split(',').map(Number);
  ser.forEach((a, i) => {
    const sum = a.reduce((t, x) => t + (x === '' ? 0 : Number(x)), 0);
    const ok = a.length === 106 && sum === ck[i];
    if (!ok) { bad++; console.log('MISMATCH seg', p[0], 'series', i, 'len', a.length, 'sum', sum, 'expected', ck[i]); }
  });
});
console.log(bad ? `${bad} mismatches` : 'weekly: all 24 series match their SQL checksums');
process.exit(bad ? 1 : 0);
