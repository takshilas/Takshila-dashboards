// Parses the precomputed tables and derives every number the dashboard shows. No data is fetched here.
// Runs in the browser (window.BritaxAnalytics) and in node (module.exports) so the numbers can be checked from a script.
(function (root) {
  var W = 106;
  var FIRST = Date.UTC(2024, 9, 6); // week 0 starts 2024-10-06 (Sunday)
  var SEGMENTS = ['Convertible car seats', 'Booster car seats', 'Infant car seats', 'Strollers (other)', 'Double strollers', 'Travel systems'];
  // Promotional periods: October Prime Big Deal Days only (customer definition). dataId points at the matching rows in data-events.js.
  var EVENTS = [
    { id: 0, week: 52, dataId: 1, label: 'Prime Big Deal Days Oct 2025', short: 'Oct-25' },
    { id: 1, week: 104, dataId: 3, label: 'Prime Big Deal Days Oct 2026', short: 'Oct-26', note: 'Only the first week after the event exists, so "after" is that one week and is provisional' }
  ];
  // Other Prime weeks (Jul 2025, Jun 2026) are not promotional periods here. They are still kept out of the price-move series because they distort prices.
  var OTHER_PRIME = [{ week: 39, short: 'Jul-25' }, { week: 89, short: 'Jun-26' }];
  var ALL_PRIME_WEEKS = [39, 52, 89, 104];
  // Other deal weeks the model keeps out of the "outside promotional periods" list.
  var OTHER_EVENT_WEEKS = [0, 1, 6, 7, 8, 59, 60];
  var DEAL_PERIODS = [[19, 22], [70, 76]]; // Feb-Mar 2025 and Feb-Mar 2026: market units 20-40% above normal
  var TARIFF_WINDOW = [13, 38]; // Jan to Jun 2025
  var CLEAN_NOW = [91, 101], CLEAN_PRIOR = [76, 86], CLEAN_LY = [41, 49];

  function wkDate(i) { return new Date(FIRST + i * 7 * 864e5); }
  function wkIso(i) { return wkDate(i).toISOString().slice(0, 10); }
  function wkLabel(i) { return wkDate(i).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); }
  function monthLabel(i) { return wkDate(i).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }); }
  function nums(s) { return s.split(',').map(function (x) { return x === '' ? null : Number(x); }); }
  function isPrimeEventWeek(w) { return ALL_PRIME_WEEKS.some(function (e) { return w >= e - 2 && w <= e + 1; }); }
  function inDeal(w) { return DEAL_PERIODS.some(function (d) { return w >= d[0] && w <= d[1]; }); }
  function inTariff(w) { return w >= TARIFF_WINDOW[0] && w <= TARIFF_WINDOW[1]; }
  function sumRange(a, lo, hi) { var t = 0; for (var i = lo; i <= hi; i++) if (a[i] != null) t += a[i]; return t; }
  function wavg(asp, units, lo, hi) { var s = 0, u = 0; for (var i = lo; i <= hi; i++) if (asp[i] != null && units[i] != null) { s += asp[i] * units[i]; u += units[i]; } return u ? s / u : null; }
  function pct(a, b) { return a == null || b == null || b === 0 ? null : (a / b - 1) * 100; }
  function median(a) { var s = a.filter(function (x) { return x != null && isFinite(x); }).sort(function (x, y) { return x - y; }); if (!s.length) return null; var m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

  function parse(D) {
    var out = { weekly: [], basket: {}, tariff: [], events: [], moves: [], ladder: [], promo: [], psku: [], pweek: [] };
    D.weekly.forEach(function (r) {
      var p = r.split('|'), si = +p[0];
      out.weekly[si] = { ab: nums(p[1]), ac: nums(p[2]), ub: nums(p[3]), uc: nums(p[4]) };
    });
    D.basket.forEach(function (r) {
      var p = r.split('|'), si = +p[0];
      (out.basket[si] = out.basket[si] || {})[p[1]] = { r4: p[2] === '' ? null : +p[2], r8: p[3] === '' ? null : +p[3], jan: +p[4], idx: nums(p[5]) };
    });
    D.tariff.forEach(function (r) {
      var p = r.split('|'), v = p[3].split(',').map(function (x) { return x === '' ? null : Number(x); });
      out.tariff.push({ si: +p[0], brand: p[1], bu: +p[2], jan: v[0], janCov: v[1], jun: v[2], junCov: v[3], jj: v[4], jjCov: v[5], now: v[6], nowCov: v[7],
        w13: v[8], w13Cov: v[9], w4: v[10], w4Cov: v[11], yy: v[12], yyCov: v[13], r4: p[4] === '' ? null : +p[4], r8: p[5] === '' ? null : +p[5] });
    });
    D.events.forEach(function (r) {
      if (r.indexOf('CK|') === 0) return;
      var p = r.split('|'), u = p[3].split(','), x = p[4].split(','), n = function (v) { return v === '' ? null : +v; };
      out.events.push({ si: +p[0], ev: +p[1], brand: p[2], lead: +u[0], event: +u[1], p1: n(u[2]), p24: n(u[3]), pxE: n(x[0]), pxA: n(x[1]), pxP: n(x[2]) });
    });
    D.moves.forEach(function (r) {
      var p = r.split('|');
      out.moves.push({ si: +p[0], brand: p[1], week: +p[2], chg: +p[3], confirmed: p[4] === 'P' });
    });
    D.ladder.forEach(function (r) {
      var p = r.split('|'), v = p[2].split(',').map(function (x) { return x === '' ? null : Number(x); });
      if (p[1] === 'MKT') out.ladder.push({ si: +p[0], mkt: true, p25: v[0], p50: v[1], p75: v[2], belowBritax: v[3] });
      else out.ladder.push({ si: +p[0], brand: p[1], asp: v[0], units: v[1], aspLY: v[2], unitsLY: v[3], aspPrior: v[4], unitsPrior: v[5] });
    });
    (D.promo || []).forEach(function (r) {
      var p = r.split('|'), n = function (v) { return v === '' ? null : +v; };
      var per = [3, 4, 5].map(function (i) { var v = p[i].split(','); return { u: +v[0], cov: n(v[1]), idx: n(v[2]), pu: n(v[3]), dp: n(v[4]), ps: n(v[5]) }; });
      out.promo.push({ si: +p[0], ev: +p[1], brand: p[2], per: per });
    });
    (D.psku || []).forEach(function (r) {
      var p = r.split('|'), v = p[6].split(',').map(function (x) { return x === '' ? null : +x; });
      out.psku.push({ si: +p[0], ev: +p[1], own: p[2] === 'B', asin: p[3], brand: p[4], title: p[5], base: v[0], p0: v[1], p1: v[2], p2: v[3], u0: v[4], u1: v[5], u2: v[6] });
    });
    (D.pweek || []).forEach(function (r) {
      var p = r.split('|'); out.pweek.push({ si: +p[0], ev: +p[1], own: p[2] === 'B', idx: nums(p[3]), pu: nums(p[4]), un: nums(p[5]) });
    });
    return out;
  }

  // Britax vs competitors in one segment: price position, share trend, event response.
  function segmentSummary(M, si) {
    var w = M.weekly[si];
    var bNow = wavg(w.ab, w.ub, CLEAN_NOW[0], CLEAN_NOW[1]), cNow = wavg(w.ac, w.uc, CLEAN_NOW[0], CLEAN_NOW[1]);
    var bPrior = wavg(w.ab, w.ub, CLEAN_PRIOR[0], CLEAN_PRIOR[1]), cPrior = wavg(w.ac, w.uc, CLEAN_PRIOR[0], CLEAN_PRIOR[1]);
    var bLY = wavg(w.ab, w.ub, CLEAN_LY[0], CLEAN_LY[1]), cLY = wavg(w.ac, w.uc, CLEAN_LY[0], CLEAN_LY[1]);
    function share(lo, hi) {
      var b = sumRange(w.ub, lo, hi), c = sumRange(w.uc, lo, hi);
      var sb = 0, sc = 0;
      for (var i = lo; i <= hi; i++) { if (w.ab[i] != null && w.ub[i] != null) sb += w.ab[i] * w.ub[i]; if (w.ac[i] != null && w.uc[i] != null) sc += w.ac[i] * w.uc[i]; }
      return { unit: b / (b + c) * 100, dollar: sb / (sb + sc) * 100, perWeek: b / (hi - lo + 1) };
    }
    var shNow = share(CLEAN_NOW[0], CLEAN_NOW[1]), shPrior = share(CLEAN_PRIOR[0], CLEAN_PRIOR[1]), shLY = share(CLEAN_LY[0], CLEAN_LY[1]);
    var tAll = M.tariff.filter(function (t) { return t.si === si; });
    var tc = tAll.filter(function (t) { return t.brand === 'All competitors'; })[0], tb = tAll.filter(function (t) { return t.brand === 'Britax group'; })[0];
    var evB = [], evC = [];
    EVENTS.forEach(function (e) {
      var b = M.events.filter(function (r) { return r.si === si && r.ev === e.dataId && r.brand === 'Britax group'; })[0];
      var c = M.events.filter(function (r) { return r.si === si && r.ev === e.dataId && r.brand === 'All competitors'; })[0];
      var t = M.events.filter(function (r) { return r.si === si && r.ev === e.dataId && r.brand === 'Segment total'; })[0];
      var aft = function (r) { return r.p24 != null ? r.p24 : r.p1; }, aftT = function (r) { return r.p24 != null ? r.p24 : r.p1; };
      evB.push({ ev: e.id, liftX: b.event / b.lead, retain: aft(b) / b.lead, pxE: b.pxE, pxP: b.pxP != null ? b.pxP : b.pxA, shLead: b.lead / t.lead * 100, shEv: b.event / t.event * 100, shPost: aft(b) / aftT(t) * 100, lead: b.lead });
      evC.push({ ev: e.id, liftX: c.event / c.lead, retain: aft(c) / c.lead, pxE: c.pxE, pxP: c.pxP != null ? c.pxP : c.pxA });
    });
    var primeIdx = []; // Britax premium over competitors' average price
    var summary = {
      si: si, bNow: bNow, cNow: cNow, premium: bNow && cNow ? (bNow / cNow - 1) * 100 : null,
      premiumLY: bLY && cLY ? (bLY / cLY - 1) * 100 : null, premiumPrior: bPrior && cPrior ? (bPrior / cPrior - 1) * 100 : null,
      bAspChg13: pct(bNow, bPrior), cAspChg13: pct(cNow, cPrior), bAspChgYY: pct(bNow, bLY), cAspChgYY: pct(cNow, cLY),
      shNow: shNow, shPrior: shPrior, shLY: shLY,
      dShare13: shNow.unit - shPrior.unit, dShareYY: shNow.unit - shLY.unit,
      relShareYY: pct(shNow.unit, shLY.unit), relShare13: pct(shNow.unit, shPrior.unit),
      compBasket13: tc && tc.w13 != null ? tc.w13 - 100 : null, britaxBasket13: tb && tb.w13 != null ? tb.w13 - 100 : null,
      compBasketYY: tc && tc.yy != null ? tc.yy - 100 : null, britaxBasketYY: tb && tb.yy != null ? tb.yy - 100 : null,
      compBasket4: tc && tc.w4 != null ? tc.w4 - 100 : null, britaxBasket4: tb && tb.w4 != null ? tb.w4 - 100 : null,
      evB: evB, evC: evC,
      britaxLift: median(evB.map(function (x) { return x.liftX; })), compLift: median(evC.map(function (x) { return x.liftX; })),
      britaxDepth: median(evB.map(function (x) { return x.pxE != null ? 100 - x.pxE : null; })), compDepth: median(evC.map(function (x) { return x.pxE != null ? 100 - x.pxE : null; })),
      britaxRetain: median(evB.map(function (x) { return x.retain; })), compRetain: median(evC.map(function (x) { return x.retain; })),
      thin: tb ? tb.bu < 120 : true
    };
    summary.verdict = recommend(summary);
    return summary;
  }

  // Recommendation rule. Stated on the page so it can be challenged.
  //  LOWER (targeted): Britax lost unit share vs a year ago by more than 8% (relative) AND competitors' same-ASIN prices are flat or lower over the
  //    last 11 weeks (<= +1%) while Britax's are not lower than theirs by more than 2 points, i.e. the premium is not narrowing by itself.
  //  HOLD: share is steady or growing (no more than 8% relative loss vs LY).
  //  WATCH: share is down but competitors are raising price (they are narrowing the gap for us) or there is too little volume to tell.
  function recommend(s) {
    var rel = s.relShareYY, cMove = s.compBasket13, bMove = s.britaxBasket13;
    var reasons = [];
    if (rel == null) return { call: 'Not enough data', tone: 'neutral', reasons: ['No year-ago comparison available.'] };
    var lost = rel < -8, gained = rel > 8;
    var compFalling = cMove != null && cMove <= -3, compFlat = cMove != null && cMove > -3 && cMove < 3, compRising = cMove != null && cMove >= 3;
    if (s.thin) reasons.push('Low Britax volume in this segment, so shares move on small sales.');
    if (!lost) {
      reasons.push('Unit share is ' + (gained ? 'up' : 'steady') + ' vs the same weeks last year (' + fmt1(s.shLY.unit) + '% to ' + fmt1(s.shNow.unit) + '%).');
      if (compFalling) reasons.push('Competitor prices fell ' + fmt1(-cMove) + '% on the same ASINs over the last 11 weeks. Watch the gap before it costs share.');
      return { call: compFalling ? 'Hold, watch competitors' : 'Hold', tone: compFalling ? 'watch' : 'hold', reasons: reasons };
    }
    reasons.push('Unit share is ' + fmt1(s.shNow.unit) + '% vs ' + fmt1(s.shLY.unit) + '% a year ago (' + fmt1(rel) + '% relative).');
    if (compRising) {
      reasons.push('Competitors raised same-ASIN prices ' + fmt1(cMove) + '% over the last 11 weeks, so the gap is narrowing without a Britax cut.');
      return { call: 'Hold, gap is closing', tone: 'watch', reasons: reasons };
    }
    if (s.thin) return { call: 'Hold, volume too thin to act', tone: 'watch', reasons: reasons };
    reasons.push('Competitor same-ASIN prices are ' + (compFalling ? 'down ' + fmt1(-cMove) : 'flat (' + fmt1(cMove) + ')') + '% over the last 11 weeks.');
    return { call: 'Lower selectively', tone: 'lower', reasons: reasons };
  }

  function fmt1(v) { return v == null || !isFinite(v) ? '—' : (Math.round(v * 10) / 10).toFixed(1); }

  // Tariff table rows for one segment: how much and when each brand raised price on the same ASINs.
  function tariffRows(M, si) {
    return M.tariff.filter(function (t) { return t.si === si && t.brand !== 'All competitors'; }).map(function (t) {
      var thin = t.bu < 40, lowCov = t.junCov == null || t.junCov < 60;
      var riseVsJan = t.jj != null ? t.jj - 100 : null, riseVsQ4 = t.jun != null ? t.jun - 100 : null;
      return { brand: t.brand, isBritax: t.brand === 'Britax group', bu: t.bu, riseQ4: riseVsQ4, riseJan: riseVsJan, cov: t.junCov, start: t.r4, start8: t.r8, thin: thin, lowCov: lowCov,
        raised: riseVsJan != null && riseVsJan >= 4 };
    }).sort(function (a, b) { return (b.riseJan == null ? -99 : b.riseJan) - (a.riseJan == null ? -99 : a.riseJan); });
  }

  // Movement now: last 11 clean weeks vs the 11 before, and the last 4 vs the 4 before, same ASINs.
  function nowRows(M, si) {
    return M.tariff.filter(function (t) { return t.si === si; }).map(function (t) {
      var p13 = t.w13 != null ? t.w13 - 100 : null, p4 = t.w4 != null ? t.w4 - 100 : null, yy = t.yy != null ? t.yy - 100 : null;
      var dir = p13 == null ? '—' : p13 <= -3 ? 'Cutting' : p13 >= 3 ? 'Raising' : 'Holding';
      return { brand: t.brand, isBritax: t.brand === 'Britax group', isAll: t.brand === 'All competitors', bu: t.bu, p13: p13, p4: p4, yy: yy, cov13: t.w13Cov, covYY: t.yyCov, dir: dir, thin: t.bu < 40 };
    }).sort(function (a, b) { return (a.isAll ? 1 : 0) - (b.isAll ? 1 : 0) || (a.isBritax ? 1 : 0) - (b.isBritax ? 1 : 0) || (a.p13 == null ? 99 : a.p13) - (b.p13 == null ? 99 : b.p13); });
  }

  // Off-promo moves: sustained moves of 5% or more on non-event weeks. Bucketed by when they happen.
  function moveRows(M, si) {
    return M.moves.filter(function (m) { return m.si === si && m.brand !== 'All competitors'; }).map(function (m) {
      var bucket = inDeal(m.week) ? 'Other deal period' : OTHER_EVENT_WEEKS.indexOf(m.week) >= 0 ? 'Other deal period' : inTariff(m.week) ? 'Tariff window' : 'Outside promo';
      var afterEvent = EVENTS.some(function (e) { return m.week === e.week + 2; });
      return { brand: m.brand, isBritax: m.brand === 'Britax group', week: m.week, chg: m.chg, confirmed: m.confirmed, bucket: bucket, afterEvent: afterEvent, recent: m.week >= 94 };
    }).sort(function (a, b) { return b.week - a.week; });
  }

  // Britax flag status. A competitor cut is only flagged as 'Britax not following' when Britax did not move the same way over the same weeks.
  // Britax's own basket can go blank (few of its baseline ASINs still sell), so its last-4-vs-prior-4 same-ASIN change is used as a second check.
  function flagStatus(M, si) {
    var rows = moveRows(M, si), recentComp = rows.filter(function (r) { return !r.isBritax && r.week >= 94; });
    var recentBritax = rows.filter(function (r) { return r.isBritax && r.week >= 94; });
    var sum = segmentSummary(M, si);
    var cuts = recentComp.filter(function (r) { return r.chg <= -5; }), raises = recentComp.filter(function (r) { return r.chg >= 5; });
    var bCut = recentBritax.filter(function (r) { return r.chg <= -5; }), b4 = sum.britaxBasket4;
    var britaxFollowed = bCut.length > 0 || (b4 != null && b4 <= -5);
    var gapWide = sum.premium != null && sum.premiumPrior != null && sum.premium - sum.premiumPrior >= 5;
    var flags = [];
    function wkList(a) { return wkLabel(Math.min.apply(null, a.map(function (r) { return r.week; }))); }
    if (cuts.length) {
      var txt = cuts.map(function (r) { return r.brand + ' ' + fmt1(r.chg) + '%'; }).join(', ') + ' from the week of ' + wkList(cuts);
      if (britaxFollowed) flags.push({ level: 'blue', text: txt + '. Britax moved the same way (' + (b4 != null && b4 <= -5 ? fmt1(b4) + '% same-ASIN, last 4 vs prior 4 weeks' : fmt1(bCut[0].chg) + '%') + '). Unconfirmed and probably the Labor Day pricing cluster' });
      else flags.push({ level: 'amber', text: txt + ' (competitor cut outside a Prime event, Britax has not followed)' });
    } else if (britaxFollowed) {
      flags.push({ level: 'blue', text: 'Britax cut price ' + (b4 != null && b4 <= -5 ? fmt1(b4) + '% (same ASINs, last 4 vs prior 4 weeks)' : fmt1(bCut[0].chg) + '%') + ' with no matching competitor cut. Likely Britax\'s own Labor Day pricing; check it ends' });
    }
    if (gapWide) flags.push({ level: 'amber', text: 'Britax premium over competitor average widened by ' + fmt1(sum.premium - sum.premiumPrior) + ' points vs the prior 11 weeks' });
    var other = recentBritax.filter(function (r) { return bCut.indexOf(r) < 0; });
    if (other.length) flags.push({ level: 'blue', text: 'Britax moved ' + other.map(function (r) { return fmt1(r.chg) + '% (week of ' + wkLabel(r.week) + (r.confirmed ? '' : ', unconfirmed') + ')'; }).join(', ') });
    if (raises.length && !cuts.length) flags.push({ level: 'green', text: raises.map(function (r) { return r.brand + ' +' + fmt1(r.chg) + '%'; }).join(', ') + ' raised outside a Prime event: the gap is closing' });
    return { flags: flags, level: flags.some(function (f) { return f.level === 'amber'; }) ? 'amber' : flags.length ? 'green' : 'clear' };
  }

  // Stabilisation: how much weekly price noise is left, and whether brands' last 11 weeks sit within 3% of the 11 before.
  function stability(M, si) {
    var b = M.basket[si] && M.basket[si]['All competitors'];
    function vol(lo, hi) {
      if (!b) return null; var ch = [];
      for (var i = lo + 1; i <= hi; i++) { var a = b.idx[i - 1], c = b.idx[i]; if (a != null && c != null && !isPrimeEventWeek(i) && !isPrimeEventWeek(i - 1) && OTHER_EVENT_WEEKS.indexOf(i) < 0 && OTHER_EVENT_WEEKS.indexOf(i - 1) < 0) ch.push((c / a - 1) * 100); }
      if (ch.length < 5) return null; var m = ch.reduce(function (s, x) { return s + x; }, 0) / ch.length;
      return Math.sqrt(ch.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (ch.length - 1));
    }
    var rows = M.tariff.filter(function (t) { return t.si === si && t.brand !== 'All competitors' && t.brand !== 'Britax group' && t.bu >= 40 && t.w13 != null && (t.w13Cov || 0) >= 60; });
    var totalU = rows.reduce(function (s, t) { return s + t.bu; }, 0);
    var calm = rows.filter(function (t) { return Math.abs(t.w13 - 100) < 3; }), calmU = calm.reduce(function (s, t) { return s + t.bu; }, 0);
    var lvl = M.tariff.filter(function (t) { return t.si === si && t.brand === 'All competitors'; })[0];
    var junVsNow = b && b.idx ? null : null;
    var jun = lvl ? lvl.jj : null; // Jun-25 vs Jan-25
    var volT = vol(14, 36), volN = vol(91, 101);
    var volN2 = vol(60, 105);
    return { volTariff: volT, volNow: volN, calmShare: totalU ? calmU / totalU * 100 : null, calmBrands: calm.length, brands: rows.length,
      compLast13: lvl && lvl.w13 != null ? lvl.w13 - 100 : null, compLast4: lvl && lvl.w4 != null ? lvl.w4 - 100 : null,
      stabilised: lvl && lvl.w13 != null && Math.abs(lvl.w13 - 100) < 3 && (totalU ? calmU / totalU : 0) >= 0.6, vol60: volN2 };
  }

  // October Prime events against the 52-week baseline: one row per brand with before / during / after share, price vs baseline and promotion depth.
  function promoBrands(M, si, ev) {
    var rows = M.promo.filter(function (r) { return r.si === si && r.ev === ev; });
    var tot = rows.filter(function (r) { return r.brand === 'Segment total'; })[0];
    var prov = ev === 1;
    return rows.filter(function (r) { return r.brand !== 'Segment total'; }).map(function (r) {
      var sh = r.per.map(function (p, k) { return p.u / tot.per[k].u * 100; });
      return { brand: r.brand, isBritax: r.brand === 'Britax group', isAll: r.brand === 'All competitors', per: r.per, sh: sh, dShare: sh[2] - sh[0], lift: r.per[1].u / r.per[0].u, retain: r.per[2].u / r.per[0].u,
        thin: r.per[0].u < 40, provisional: prov };
    }).sort(function (a, b) { return (a.isAll ? 1 : 0) - (b.isAll ? 1 : 0) || b.per[0].u - a.per[0].u; });
  }
  // Weekly price index vs baseline and % of units on promotion, event-6 .. event+3, as arrays indexed by absolute week.
  function promoWeekly(M, si, ev, own) {
    var r = M.pweek.filter(function (x) { return x.si === si && x.ev === ev && x.own === own; })[0], e = EVENTS[ev].week;
    var idx = [], pu = [];
    if (r) for (var k = 0; k < 10; k++) { var w = e - 6 + k; if (w <= W - 1) { idx[w] = r.idx[k]; pu[w] = r.pu[k] == null ? null : r.pu[k]; } }
    // a week with no baseline coverage has no promo share either
    for (var i in idx) if (idx[i] == null) pu[i] = null;
    return { idx: idx, pu: pu, lo: Math.max(0, e - 6), hi: Math.min(W - 1, e + 3) };
  }
  // SKU-level promotion status: before / during / after vs the SKU's own 52-week baseline price.
  function promoSkus(M, si, ev, own) {
    return M.psku.filter(function (r) { return r.si === si && r.ev === ev && r.own === own; }).map(function (r) {
      var d = function (p) { return p == null || !r.base ? null : (p / r.base - 1) * 100; };
      var d0 = d(r.p0), d1 = d(r.p1), d2 = d(r.p2), flags = [];
      if (d0 != null && d0 <= -5) flags.push('Early deal');
      if (d1 != null && d1 <= -5) flags.push('On promo in event');
      if (d2 != null && d2 <= -5) flags.push('Promo continues after');
      if (d1 != null && d1 > -5 && d1 < 5) flags.push('At baseline in event');
      if (d1 != null && d1 >= 5) flags.push('Above baseline in event');
      return { asin: r.asin, brand: r.brand, title: r.title, base: r.base, p0: r.p0, p1: r.p1, p2: r.p2, d0: d0, d1: d1, d2: d2, u0: r.u0, u1: r.u1, u2: r.u2, lift: r.u0 ? r.u1 / r.u0 : null, flags: flags, onPromo: d1 != null && d1 <= -5 };
    }).sort(function (a, b) { return (b.u1 || 0) - (a.u1 || 0); });
  }

  // Price ladder for one segment: brand ASPs, market quartiles, Britax position.
  function ladderRows(M, si) {
    var w = M.weekly[si];
    var bAsp = wavg(w.ab, w.ub, CLEAN_NOW[0], CLEAN_NOW[1]), bU = sumRange(w.ub, CLEAN_NOW[0], CLEAN_NOW[1]) / 11;
    var bLY = wavg(w.ab, w.ub, CLEAN_LY[0], CLEAN_LY[1]), bLYu = sumRange(w.ub, CLEAN_LY[0], CLEAN_LY[1]) / 9;
    var bP = wavg(w.ab, w.ub, CLEAN_PRIOR[0], CLEAN_PRIOR[1]), bPu = sumRange(w.ub, CLEAN_PRIOR[0], CLEAN_PRIOR[1]) / 11;
    var cAsp = wavg(w.ac, w.uc, CLEAN_NOW[0], CLEAN_NOW[1]), cU = sumRange(w.uc, CLEAN_NOW[0], CLEAN_NOW[1]) / 11;
    var rows = M.ladder.filter(function (r) { return r.si === si && !r.mkt && r.asp != null && r.units >= 5; }).map(function (r) {
      return { brand: r.brand, asp: r.asp, units: r.units, aspLY: r.aspLY, aspPrior: r.aspPrior, isBritax: false };
    });
    rows.push({ brand: 'Britax group', asp: bAsp, units: bU, aspLY: bLY, aspPrior: bP, isBritax: true });
    rows.sort(function (a, b) { return b.asp - a.asp; });
    var mkt = M.ladder.filter(function (r) { return r.si === si && r.mkt; })[0];
    var totalU = rows.reduce(function (s, r) { return s + r.units; }, 0);
    return { rows: rows, mkt: mkt, compAsp: cAsp, compUnits: cU, britaxRank: rows.findIndex(function (r) { return r.isBritax; }) + 1, listed: rows.length, shown: totalU };
  }

  var api = {
    W: W, SEGMENTS: SEGMENTS, EVENTS: EVENTS, TARIFF_WINDOW: TARIFF_WINDOW, CLEAN_NOW: CLEAN_NOW, CLEAN_PRIOR: CLEAN_PRIOR, CLEAN_LY: CLEAN_LY,
    OTHER_EVENT_WEEKS: OTHER_EVENT_WEEKS, DEAL_PERIODS: DEAL_PERIODS,
    wkDate: wkDate, wkIso: wkIso, wkLabel: wkLabel, monthLabel: monthLabel, isPrimeEventWeek: isPrimeEventWeek, inDeal: inDeal, fmt1: fmt1,
    parse: parse, segmentSummary: segmentSummary, tariffRows: tariffRows, nowRows: nowRows, moveRows: moveRows, flagStatus: flagStatus, stability: stability,
    promoBrands: promoBrands, promoWeekly: promoWeekly, promoSkus: promoSkus, ladderRows: ladderRows, OTHER_PRIME: OTHER_PRIME
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BritaxAnalytics = api;
})(typeof window !== 'undefined' ? window : this);
