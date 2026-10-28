// Shared checksum check for the row-per-line tables: the last field is the sum of the numeric fields in the third field.
import fs from 'node:fs'; import vm from 'node:vm';
export function check(file, name, key, bodyIdx = 2) {
  const w = {}; vm.runInNewContext(fs.readFileSync(new URL('../private/' + file, import.meta.url), 'utf8'), { window: w });
  const rows = w[key]; let bad = 0;
  rows.forEach((r) => { const p = r.split('|'); const s = p[bodyIdx].split(',').reduce((a, x) => a + (x === '' ? 0 : Number(x)), 0); const ck = Number(p[p.length - 1]); if (Math.abs(s - ck) > 0.11) { bad++; console.log('MISMATCH', name, r.slice(0, 60), s, ck); } });
  console.log(`${name}: ${rows.length - bad} of ${rows.length} rows match their SQL checksums`); if (bad) process.exit(1);
}
