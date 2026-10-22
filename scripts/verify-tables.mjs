// Structural checks on the copied tables (field counts, value ranges, row counts).
import fs from 'node:fs';
const load = (f, k) => { const w = {}; new Function('window', fs.readFileSync(new URL(`../private/${f}`, import.meta.url), 'utf8'))(w); return w[k]; };
let bad = 0; const fail = (m) => { bad++; console.log('FAIL', m); };
const tariff = load('data-tariff.js', 'BRITAX_TARIFF'), events = load('data-events.js', 'BRITAX_EVENTS'),
  moves = load('data-moves.js', 'BRITAX_MOVES'), ladder = load('data-ladder.js', 'BRITAX_LADDER');
tariff.forEach((r) => { const p = r.split('|'); if (p.length !== 6 || p[3].split(',').length !== 14) fail('tariff ' + r); });
const evRows = events.filter((r) => !r.startsWith('CK|')), evCk = events.find((r) => r.startsWith('CK|')).split('|');
evRows.forEach((r) => { const p = r.split('|'); if (p.length !== 5 || p[3].split(',').length !== 4 || p[4].split(',').length !== 3) fail('events ' + r); });
// checksum printed by the SQL: row count, sums of the four unit columns and of the three price columns
{ const u = [0, 0, 0, 0], px = [0, 0, 0]; evRows.forEach((r) => { const p = r.split('|'); p[3].split(',').forEach((v, i) => { u[i] += v === '' ? 0 : +v; }); p[4].split(',').forEach((v, i) => { px[i] += v === '' ? 0 : +v; }); });
  if (evRows.length !== +evCk[1] || u.join(',') !== evCk[2] || px.map((x) => x.toFixed(1)).join(',') !== evCk[3]) fail(`events checksum: got ${evRows.length}|${u.join(',')}|${px.map((x) => x.toFixed(1)).join(',')} expected ${evCk.slice(1).join('|')}`); }
moves.forEach((r) => { const p = r.split('|'); const w = +p[2]; if (p.length !== 5 || !(w >= 5 && w <= 105) || isNaN(+p[3]) || !/^[PU]$/.test(p[4])) fail('moves ' + r); });
ladder.forEach((r) => { const p = r.split('|'); const n = p[2].split(',').length; if (p.length !== 3 || n !== (p[1] === 'MKT' ? 4 : 6)) fail('ladder ' + r); });
console.log({ tariff: tariff.length, events: evRows.length, moves: moves.length, ladder: ladder.length });
// every segment x event has a total row and a Britax row
for (let s = 0; s < 6; s++) for (let e = 0; e < 4; e++) ['Segment total', 'Britax group', 'All competitors'].forEach((b) => { if (!evRows.some((r) => r.startsWith(`${s}|${e}|${b}|`))) fail(`events missing ${s}|${e}|${b}`); });
// competitor units in an event row can never exceed the segment total
evRows.forEach((r) => { const [s, e, b, u] = r.split('|'); if (b === 'Segment total') return; const t = evRows.find((x) => x.startsWith(`${s}|${e}|Segment total|`)).split('|')[3].split(',').map(Number); const v = u.split(',').map(Number); v.forEach((x, i) => { if (!isNaN(x) && x > t[i] + 1) fail('events exceeds total ' + r); }); });
console.log(bad ? bad + ' failures' : 'tables: structure checks pass');
process.exit(bad ? 1 : 0);
