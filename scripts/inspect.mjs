import fs from 'node:fs'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const A = require('../private/analytics.js');
const w = {}; for (const f of ['weekly','basket','tariff','events','moves','ladder']) new Function('window', fs.readFileSync(new URL(`../private/data-${f}.js`, import.meta.url), 'utf8'))(w);
const M = A.parse({ weekly: w.BRITAX_WEEKLY, basket: w.BRITAX_BASKET, tariff: w.BRITAX_TARIFF, events: w.BRITAX_EVENTS, moves: w.BRITAX_MOVES, ladder: w.BRITAX_LADDER });
const f = A.fmt1;
for (let si = 0; si < 6; si++) {
  const s = A.segmentSummary(M, si), st = A.stability(M, si), fl = A.flagStatus(M, si), L = A.ladderRows(M, si);
  console.log(`\n== ${A.SEGMENTS[si]}`);
  console.log(` price: Britax $${f(s.bNow)} vs comp $${f(s.cNow)} premium ${f(s.premium)}% (prior ${f(s.premiumPrior)}%, LY ${f(s.premiumLY)}%)`);
  console.log(` share units now ${f(s.shNow.unit)} prior ${f(s.shPrior.unit)} LY ${f(s.shLY.unit)} | rel YY ${f(s.relShareYY)}% | $share now ${f(s.shNow.dollar)} LY ${f(s.shLY.dollar)}`);
  console.log(` basket13 comp ${f(s.compBasket13)} britax ${f(s.britaxBasket13)} | YY comp ${f(s.compBasketYY)} britax ${f(s.britaxBasketYY)} | w4 comp ${f(s.compBasket4)}`);
  console.log(` events lift britax ${f(s.britaxLift)}x comp ${f(s.compLift)}x depth b ${f(s.britaxDepth)} c ${f(s.compDepth)} retain b ${f(s.britaxRetain)} c ${f(s.compRetain)}`);
  console.log(` verdict: ${s.verdict.call} | ${s.verdict.reasons.join(' / ')}`);
  console.log(` stability: vol tariff ${f(st.volTariff)} now ${f(st.volNow)} calm ${f(st.calmShare)}% (${st.calmBrands}/${st.brands}) stabilised=${st.stabilised}`);
  console.log(` flags(${fl.level}): ${fl.flags.map(x=>x.text).join(' | ')}`);
  console.log(` ladder: Britax rank ${L.britaxRank}/${L.listed}; mkt p25/50/75 ${JSON.stringify(L.mkt)}`);
  const t = A.tariffRows(M, si).slice(0,4).map(r=>`${r.brand} ${f(r.riseJan)}% (Q4 ${f(r.riseQ4)}%) start wk ${r.start}`).join('; ');
  console.log(` tariff top: ${t}`);
}
