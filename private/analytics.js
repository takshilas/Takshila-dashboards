// Parses the precomputed tables and derives every number the dashboard shows. No data is fetched here.
// Runs in the browser (window.BritaxAnalytics) and in node (module.exports) so the numbers can be checked from a script.
(function (root) {
  var W = 106;
  var FIRST = Date.UTC(2024, 9, 6); // week 0 starts 2024-10-06 (Sunday)
  var SEGMENTS = ['Convertible car seats', 'Booster car seats', 'Infant car seats', 'Strollers (other)', 'Double strollers', 'Travel systems'];
  // Promotional periods (customer definition): June and October Prime events. 2025 had no June event, so Prime Day July 2025 stands in for it.
  var EVENTS = [
    { id: 0, week: 39, label: 'Prime Day Jul 2025', short: 'Jul-25', note: 'No June Prime Day in 2025; the July event is used' },
    { id: 1, week: 52, label: 'Prime Big Deal Days Oct 2025', short: 'Oct-25' },
    { id: 2, week: 89, label: 'Prime Day Jun 2026', short: 'Jun-26' },
    { id: 3, week: 104, label: 'Prime Big Deal Days Oct 2026', short: 'Oct-26', note: 'Only one post-event week is available' }
  ];
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
  function isPrimeEventWeek(w) { return EVENTS.some(function (e) { return w >= e.week - 2 && w <= e.week + 1; }); }
  function inDeal(w) { return DEAL_PERIODS.some(function (d) { return w >= d[0] && w <= d[1]; }); }
  function inTariff(w) { return w >= TARIFF_WINDOW[0] && w <= TARIFF_WINDOW[1]; }
  function sumRange(a, lo, hi) { var t = 0; for (var i = lo; i <= hi; i++) if (a[i] != null) t += a[i]; return t; }
  function wavg(asp, units, lo, hi) { var s = 0, u = 0; for (var i = lo; i <= hi; i++) if (asp[i] != null && units[i] != null) { s += asp[i] * units[i]; u += units[i]; } return u ? s / u : null; }
  function pct(a, b) { return a == null || b == null || b === 0 ? null : (a / b - 1) * 100; }
  function median(a) { var s = a.filter(function (x) { return x != null && isFinite(x); }).sort(function (x, y) { return x - y; }); if (!s.length) return null; var m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

  function parse(D) {
    var out = { weekly: [], basket: {}, tariff: [], events: [], moves: [], ladder: [] };
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
      var p = r.split('|'), u = p[3].split(',').map(Number), x = p[4].split(',');
      out.events.push({ si: +p[0], ev: +p[1], brand: p[2], lead: u[0], event: u[1], post: u[2], pxE: x[0] === '' ? null : +x[0], pxP: x[1] === '' ? null : +x[1] });
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
      var b = M.events.filter(function (r) { return r.si === si && r.ev === e.id && r.brand === 'Britax group'; })[0];
      var c = M.events.filter(function (r) { return r.si === si && r.ev === e.id && r.brand === 'All competitors'; })[0];
      var t = M.events.filter(function (r) { return r.si === si && r.ev === e.id && r.brand === 'Segment total'; })[0];
      evB.push({ ev: e.id, liftX: b.event / b.lead, retain: b.post / b.lead, pxE: b.pxE, pxP: b.pxP, shLead: b.lead / t.lead * 100, shEv: b.event / t.event * 100, shPost: b.post / t.post * 100, lead: b.lead });
      evC.push({ ev: e.id, liftX: c.event / c.lead, retain: c.post / c.lead, pxE: c.pxE, pxP: c.pxP });
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

  // Britax flag status: has Britax moved off-promo, and has a competitor moved 5%+ in the last 12 weeks without Britax following?
  function flagStatus(M, si) {
    var rows = moveRows(M, si), recentComp = rows.filter(function (r) { return !r.isBritax && r.week >= 94; });
    var recentBritax = rows.filter(function (r) { return r.isBritax && r.week >= 94; });
    var sum = segmentSummary(M, si);
    var cuts = recentComp.filter(function (r) { return r.chg <= -5; }), raises = recentComp.filter(function (r) { return r.chg >= 5; });
    var gapWide = sum.premium != null && sum.premiumPrior != null && sum.premium - sum.premiumPrior >= 5;
    var flags = [];
    if (cuts.length) flags.push({ level: 'amber', text: cuts.map(function (r) { return r.brand + ' ' + fmt1(r.chg) + '%'; }).join(', ') + ' since week of ' + wkLabel(Math.min.apply(null, cuts.map(function (r) { return r.week; }))) + ' (competitor cut off promo, Britax not following)' });
    if (gapWide) flags.push({ level: 'amber', text: 'Britax premium over competitor average widened by ' + fmt1(sum.premium - sum.premiumPrior) + ' points vs the prior 11 weeks' });
    if (recentBritax.length) flags.push({ level: 'blue', text: 'Britax moved ' + recentBritax.map(function (r) { return fmt1(r.chg) + '% (week of ' + wkLabel(r.week) + (r.confirmed ? '' : ', unconfirmed') + ')'; }).join(', ') });
    if (raises.length && !cuts.length) flags.push({ level: 'green', text: raises.map(function (r) { return r.brand + ' +' + fmt1(r.chg) + '%'; }).join(', ') + ' raised off promo: the gap is closing' });
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

  // Post-promo performance for one event and segment.
  function postPromo(M, si, ev) {
    var rows = M.events.filter(function (r) { return r.si === si && r.ev === ev; });
    var tot = rows.filter(function (r) { return r.brand === 'Segment total'; })[0];
    var nPost = ev === 3 ? 1 : 3;
    return rows.filter(function (r) { return r.brand !== 'Segment total'; }).map(function (r) {
      var shLead = r.lead / tot.lead * 100, shEv = r.event / tot.event * 100, shPost = r.post / tot.post * 100;
      var reaction = [];
      if (r.pxE != null && r.pxE <= 94) reaction.push('Cut price ' + fmt1(100 - r.pxE) + '% for the event');
      if (r.pxP != null && r.pxE != null && r.pxP - r.pxE >= 4) reaction.push('Took ' + fmt1(r.pxP - r.pxE) + ' pts back after');
      if (r.pxP != null && r.pxP <= 94) reaction.push('Still ' + fmt1(100 - r.pxP) + '% below lead-in price after');
      if (r.pxP != null && r.pxP >= 106) reaction.push('Priced ' + fmt1(r.pxP - 100) + '% above lead-in after');
      return { brand: r.brand, isBritax: r.brand === 'Britax group', isAll: r.brand === 'All competitors', lead: r.lead, event: r.event, post: r.post, liftX: r.event / r.lead, retain: r.post / r.lead,
        shLead: shLead, shEv: shEv, shPost: shPost, dShare: shPost - shLead, pxE: r.pxE, pxP: r.pxP, reaction: reaction, thin: r.lead < 40 };
    }).sort(function (a, b) { return (a.isAll ? 1 : 0) - (b.isAll ? 1 : 0) || b.lead - a.lead; });
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
    postPromo: postPromo, ladderRows: ladderRows
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BritaxAnalytics = api;
})(typeof window !== 'undefined' ? window : this);
