import fs from 'node:fs'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const A = require('../private/analytics.js');
const w = {}; for (const f of ['basket', 'tariff', 'r12', 'skus']) new Function('window', fs.readFileSync(new URL(`../private/data-${f}.js`, import.meta.url), 'utf8'))(w);
const M = A.parse({ basket: w.BRITAX_BASKET, tariff: w.BRITAX_TARIFF, r12: w.BRITAX_R12, skus: w.BRITAX_SKUS });
const f = A.f1;
for (const si of [0, 1, 3, 4]) {
  console.log('\n==', A.SEGMENTS[si]);
  A.brands(M, si).forEach((b) => {
    const s = A.stability(M, si, b), t = A.tariffRow(M, si, b), pr = A.promoStats(M, si, b), sc = A.shareChange(M, si, b), ts = A.trendSeries(M, si, b);
    console.log(b.padEnd(16), 'tariff', t ? f(t.rise) + '%/' + t.start : '-', '| 6m net', f(s.net), 'vol', f(s.vol), 'dips', s.dips, 'moves', s.moves.length, s.status, '| promo12', f(pr.all), 'prime', f(pr.prime), 'normal', f(pr.normal), '| share', f(sc.was), '->', f(sc.now), '| stitched', ts.stitched, f(ts.k));
  });
  const e = A.shareEvent(M, si, 'Britax group', 89), e2 = A.shareEvent(M, si, 'Britax group', 104);
  console.log('Britax share Jun-26', f(e.before), f(e.during), f(e.after), '| Oct-26', f(e2.before), f(e2.during), f(e2.after));
  console.log('Britax moves', JSON.stringify(A.findMoves(A.trendSeries(M, si, 'Britax group').vals).map((m) => [m.week, +m.chg.toFixed(1), m.confirmed])));
  const sk = A.skuRows(M, si, false).slice(0, 3).map((r) => `${r.brand} ${r.base} cur ${f(r.cur)} vs ${f(r.vs)}% promoWk ${r.promoWk}/${r.weeks}`); console.log(sk.join(' ; '));
}
