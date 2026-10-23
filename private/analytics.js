// Parses the precomputed tables and derives every number the dashboard shows. No data is fetched here.
// Runs in the browser (window.BritaxAnalytics) and in node (module.exports) so the numbers can be checked from a script.
(function (root) {
  var W = 106;
  var FIRST = Date.UTC(2024, 9, 6); // week 0 starts 2024-10-06 (Sunday)
  var R12_START = 54;               // first week of the 12-month tables (2025-10-19)
  var SEGMENTS = ['Convertible car seats', 'Booster car seats', 'Infant car seats', 'Strollers (other)', 'Double strollers', 'Travel systems'];
  var CORE = [0, 1, 3, 4]; // Britax's top 20% of categories: 4 of 20, about 85% of Britax sales
  // June and October Prime events. 2025 had no June event, so Prime Day in July 2025 is used.
  var PRIME = [
    { week: 39, short: 'Jul-25', label: 'Prime Day Jul 2025 (no June event in 2025)' },
    { week: 52, short: 'Oct-25', label: 'Prime Big Deal Days Oct 2025' },
    { week: 89, short: 'Jun-26', label: 'Prime Day Jun 2026' },
    { week: 104, short: 'Oct-26', label: 'Prime Big Deal Days Oct 2026' }
  ];
  var TARIFF = [13, 38]; // Jan to Jun 2025
  var BLACK_FRIDAY = [6, 7, 8, 59, 60];

  function wkDate(i) { return new Date(FIRST + i * 7 * 864e5); }
  function wkIso(i) { return wkDate(i).toISOString().slice(0, 10); }
  function wkLabel(i) { return wkDate(i).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); }
  function monthLabel(i) { return wkDate(i).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }); }
  function nums(s) { return s.split(',').map(function (x) { return x === '' ? null : Number(x); }); }
  // Weeks distorted by a Prime event: two weeks of early deals before it, the event, the week after.
  function primeWeek(w) { return PRIME.some(function (e) { return w >= e.week - 2 && w <= e.week + 1; }); }
  function excluded(w) { return primeWeek(w) || BLACK_FRIDAY.indexOf(w) >= 0 || w <= 1; }
  function avg(a) { var s = 0, n = 0; a.forEach(function (x) { if (x != null) { s += x; n++; } }); return n ? s / n : null; }
  function cnt(a) { return a.filter(function (x) { return x != null; }).length; }
  function slice(a, lo, hi) { return a.slice(lo, hi + 1); }
  function median(a) { var s = a.filter(function (x) { return x != null && isFinite(x); }).sort(function (x, y) { return x - y; }); if (!s.length) return null; var m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function sd(a) { var v = a.filter(function (x) { return x != null; }); if (v.length < 4) return null; var m = avg(v); return Math.sqrt(v.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (v.length - 1)); }
  function f1(v) { return v == null || !isFinite(v) ? '—' : (Math.round(v * 10) / 10).toFixed(1); }

  function parse(D) {
    var out = { basket: {}, tariff: [], r12: {}, skus: [], prices: {}, ladder: [], range: {} };
    D.basket.forEach(function (r) { var p = r.split('|'); (out.basket[+p[0]] = out.basket[+p[0]] || {})[p[1]] = { idx: nums(p[5]) }; });
    D.tariff.forEach(function (r) {
      var p = r.split('|'), v = p[3].split(',').map(function (x) { return x === '' ? null : Number(x); });
      out.tariff.push({ si: +p[0], brand: p[1], bu: +p[2], jj: v[4], jjCov: v[5], start: p[4] === '' ? null : +p[4] });
    });
    D.r12.forEach(function (r) {
      var p = r.split('|'), place = function (s) { var a = [], v = nums(s); for (var i = 0; i < 52; i++) a[R12_START + i] = v[i]; return a; };
      (out.r12[+p[0]] = out.r12[+p[0]] || {})[p[1]] = { idx: place(p[2]), pu: place(p[3]), un: place(p[4]) };
    });
    D.skus.forEach(function (r) {
      var p = r.split('|'), b = p[5].split(','), pr = []; nums(p[6]).forEach(function (v, i) { pr[R12_START + i] = v; });
      out.skus.push({ si: +p[0], own: p[1] === 'B', asin: p[2], brand: p[3], title: p[4].trim(), base: +b[0], u13: +b[1], price: pr });
    });
    (D.prices || []).forEach(function (r) { var p = r.split('|'), v = nums(p[2]); (out.prices[+p[0]] = out.prices[+p[0]] || {})[p[1]] = { pu: v[0], ps: v[1], pb: v[2], nu: v[3], ns: v[4] }; });
    (D.ladder || []).forEach(function (r) { var p = r.split('|'), v = nums(p[2]); out.ladder.push({ si: +p[0], brand: p[1], u52: v[0], s52: v[1], u13: v[2], s13: v[3], up: v[4], sp: v[5] }); });
    (D.range || []).forEach(function (r) { var p = r.split('|'), v = nums(p[2]); (out.range[+p[0]] = out.range[+p[0]] || {})[p[1]] = { n: v[0], lo: v[1], med: v[2], hi: v[3], p52: v[4], p13: v[5] }; });
    return out;
  }

  // One continuous price index per brand: Q4 2024 basket up to week 53, then the 12-month series rescaled to it.
  function trendSeries(M, si, brand) {
    var old = M.basket[si] && M.basket[si][brand], neu = M.r12[si] && M.r12[si][brand];
    var vals = [], stitched = false, k = null;
    if (old) for (var w = 0; w < R12_START; w++) vals[w] = old.idx[w];
    if (old && neu) {
      var ratios = [];
      for (var x = R12_START; x < W; x++) if (!excluded(x) && old.idx[x] != null && neu.idx[x] != null) ratios.push(old.idx[x] / neu.idx[x]);
      if (ratios.length >= 6) { k = median(ratios); stitched = true; for (var y = R12_START; y < W; y++) vals[y] = neu.idx[y] == null ? null : neu.idx[y] * k; }
    }
    return { vals: vals, stitched: stitched, k: k };
  }

  // Sustained price moves of 5% or more on weeks that are not distorted by a Prime event or Black Friday.
  function findMoves(vals) {
    var c = vals.map(function (v, w) { return excluded(w) ? null : v; }), out = [], cand = [];
    function win(lo, hi) { var a = []; for (var i = lo; i <= hi; i++) a.push(i >= 0 && i < W ? c[i] : null); return a; }
    for (var w = 5; w < W; w++) {
      if (c[w] == null) continue;
      var pa = win(w - 4, w - 1), na = win(w, w + 3);
      if (cnt(pa) < 3 || cnt(na) < 3) continue;
      var chg = avg(na) / avg(pa) - 1;
      if (Math.abs(chg) >= 0.05) cand.push({ week: w, chg: chg });
    }
    cand.forEach(function (m) {
      var best = cand.every(function (o) { return Math.abs(o.week - m.week) > 3 || Math.abs(o.chg) < Math.abs(m.chg) || (Math.abs(o.chg) === Math.abs(m.chg) && o.week >= m.week); });
      if (!best) return;
      var later = win(m.week + 4, m.week + 7), prior = avg(win(m.week - 4, m.week - 1)), confirmed = null;
      if (cnt(later) >= 2) {
        var lc = avg(later) / prior - 1;
        if (!(lc * m.chg > 0 && Math.abs(lc) >= 0.6 * Math.abs(m.chg))) return; // transient: dropped
        confirmed = true;
      } else confirmed = false;
      out.push({ week: m.week, chg: m.chg * 100, confirmed: confirmed });
    });
    return out;
  }

  // Last six months (weeks 80..105), Prime-affected weeks left out.
  function stability(M, si, brand) {
    var r = M.r12[si] && M.r12[si][brand]; if (!r) return null;
    var clean = function (lo, hi) { return slice(r.idx, lo, hi).map(function (v, i) { return excluded(lo + i) ? null : v; }); };
    var first = avg(clean(80, 85)), last = avg(clean(96, 101));
    var all = clean(80, 105), ch = [];
    for (var i = 1; i < all.length; i++) if (all[i] != null && all[i - 1] != null) ch.push((all[i] / all[i - 1] - 1) * 100);
    var dips = all.filter(function (v) { return v != null && v <= 95; }).length;
    var vals = trendSeries(M, si, brand).vals, moves = findMoves(vals).filter(function (m) { return m.week >= 80; });
    var net = first && last ? (last / first - 1) * 100 : null, vol = sd(ch);
    var status = net == null ? 'No read' : net >= 3 ? 'Raised' : net <= -3 ? 'Cut' : (dips >= 4 || (vol != null && vol >= 3)) ? 'Stable, promotes often' : 'Stable';
    return { net: net, vol: vol, dips: dips, weeks: cnt(all), moves: moves, status: status };
  }

  function tariffRow(M, si, brand) {
    var t = M.tariff.filter(function (x) { return x.si === si && x.brand === brand; })[0];
    return t ? { rise: t.jj != null ? t.jj - 100 : null, start: t.start, cov: t.jjCov, bu: t.bu } : null;
  }

  function brands(M, si) {
    var o = M.r12[si] || {};
    var others = Object.keys(o).filter(function (b) { return ['Britax group', 'All competitors', 'Segment total'].indexOf(b) < 0; }).sort(function (a, b) { return unitsSum(o[b]) - unitsSum(o[a]); });
    return ['Britax group', 'All competitors'].concat(others);
  }
  function unitsSum(r) { var s = 0; r.un.forEach(function (v) { if (v != null) s += v; }); return s; }

  // 12-month promotion summary (baseline = each SKU's own 12-month median). Weighted by units.
  function promoStats(M, si, brand) {
    var r = M.r12[si] && M.r12[si][brand]; if (!r) return null;
    var tot = { p: 0, u: 0, pp: 0, pu: 0, np: 0, nu: 0, ix: 0, pw: 0 }, primeWeeks = [];
    PRIME.forEach(function (e) { [e.week - 1, e.week, e.week + 1].forEach(function (w) { primeWeeks.push(w); }); });
    var promoWeeks = 0, weeks = 0, primeIdx = [];
    for (var w = R12_START; w < W; w++) {
      var u = r.un[w], pu = r.pu[w], ix = r.idx[w]; if (u == null || pu == null) continue;
      var isPrime = primeWeeks.indexOf(w) >= 0;
      tot.u += u; tot.p += pu * u; if (ix != null) tot.ix += ix * u;
      if (isPrime) { tot.pu += u; tot.pp += pu * u; } else { tot.nu += u; tot.np += pu * u; weeks++; if (pu >= 25) promoWeeks++; }
    }
    PRIME.forEach(function (e) { if (r.idx[e.week] != null && e.week >= R12_START) primeIdx.push({ short: e.short, idx: r.idx[e.week], pu: r.pu[e.week] }); });
    return { all: tot.u ? tot.p / tot.u : null, prime: tot.pu ? tot.pp / tot.pu : null, normal: tot.nu ? tot.np / tot.nu : null,
      vs: tot.u ? tot.ix / tot.u - 100 : null, promoWeeks: promoWeeks, weeks: weeks, primeIdx: primeIdx, pu: r.pu };
  }

  // Average price on promotion vs off promotion over the last 12 months. depth = how far below baseline promoted units sold (same products).
  function promoPrices(M, si, brand) {
    var p = M.prices[si] && M.prices[si][brand]; if (!p) return null;
    var on = p.pu ? p.ps / p.pu : null, off = p.nu ? p.ns / p.nu : null;
    return { on: on, off: off, depth: p.pb ? (1 - p.ps / p.pb) * 100 : null, gap: on != null && off ? (on / off - 1) * 100 : null };
  }

  // Brand price ladder for a segment: 12-month ASP, last 13 weeks vs prior 13 weeks, price vs Britax, unit share of all tracked brands.
  function ladderRows(M, si) {
    var tot = M.r12[si] && M.r12[si]['Segment total'], totU = tot ? unitsSum(tot) : null;
    var rows = M.ladder.filter(function (r) { return r.si === si; }).map(function (r) {
      var asp = r.s52 / r.u52, now = r.u13 ? r.s13 / r.u13 : null, prior = r.up ? r.sp / r.up : null;
      return { brand: r.brand, units: r.u52, share: totU ? r.u52 / totU * 100 : null, asp: asp, now: now, prior: prior, chg: now && prior ? (now / prior - 1) * 100 : null };
    }).sort(function (a, b) { return b.units - a.units; });
    var me = rows.filter(function (r) { return r.brand === 'Britax'; })[0];
    rows.forEach(function (r) { r.vsB = me && r !== me ? (r.asp / me.asp - 1) * 100 : null; });
    return rows;
  }

  // Unit share in a segment, weekly, from the 12-month tables.
  function shareSeries(M, si, brand) {
    var r = M.r12[si] && M.r12[si][brand], t = M.r12[si] && M.r12[si]['Segment total'], out = [];
    if (!r || !t) return out;
    for (var w = R12_START; w < W; w++) out[w] = r.un[w] != null && t.un[w] ? r.un[w] / t.un[w] * 100 : null;
    return out;
  }
  function shareOver(M, si, brand, lo, hi) {
    var r = M.r12[si][brand], t = M.r12[si]['Segment total'], a = 0, b = 0;
    for (var w = lo; w <= hi; w++) if (r.un[w] != null && t.un[w] != null) { a += r.un[w]; b += t.un[w]; }
    return b ? a / b * 100 : null;
  }
  // Share change over six months (clean weeks) and around each Prime event inside the window.
  function shareChange(M, si, brand) {
    var s0 = cleanShare(M, si, brand, 80, 85), s1 = cleanShare(M, si, brand, 96, 101);
    return { was: s0, now: s1, d: s0 != null && s1 != null ? s1 - s0 : null };
  }
  function cleanShare(M, si, brand, lo, hi) {
    var r = M.r12[si][brand], t = M.r12[si]['Segment total'], a = 0, b = 0;
    for (var w = lo; w <= hi; w++) if (!excluded(w) && r.un[w] != null && t.un[w] != null) { a += r.un[w]; b += t.un[w]; }
    return b ? a / b * 100 : null;
  }
  function shareEvent(M, si, brand, e) {
    var before = shareOver(M, si, brand, e - 3, e - 1), during = shareOver(M, si, brand, e, e), after = shareOver(M, si, brand, e + 1, Math.min(e + 3, W - 1));
    return { before: before, during: during, after: after, dDuring: during - before, dAfter: after - before };
  }

  // Key products: current price vs the SKU's 12-month baseline, range, promo weeks.
  function skuRows(M, si, own) {
    return M.skus.filter(function (s) { return s.si === si && s.own === own; }).map(function (s) {
      var p = s.price, have = p.filter(function (v) { return v != null; });
      var cur = avg(slice(p, 98, 101)), last = p[W - 1];
      var promoWk = have.filter(function (v) { return v <= 0.95 * s.base; }).length;
      var up = cur != null ? (cur / s.base - 1) * 100 : null;
      // Recent promotions: weeks 93..105 at 5% or more below baseline, the deepest of them, and the latest promoted week.
      var recent = [], lastPromo = null, deepest = null;
      for (var w = 93; w < W; w++) if (p[w] != null && p[w] <= 0.95 * s.base) { recent.push(w); lastPromo = w; var dd = (1 - p[w] / s.base) * 100; if (deepest == null || dd > deepest) deepest = dd; }
      var flags = [];
      if (cur != null && up <= -5) flags.push('On promo now'); else if (cur != null && up >= 5) flags.push('Priced above baseline'); else flags.push('At baseline');
      if (have.length && promoWk / have.length >= 0.25) flags.push('Promotes often');
      return { brand: s.brand, title: s.title, asin: s.asin, base: s.base, u13: s.u13, cur: cur, last: last, vs: up, lo: Math.min.apply(null, have), hi: Math.max.apply(null, have), promoWk: promoWk, recentWk: recent.length, recentOf: slice(p, 93, W - 1).filter(function (v) { return v != null; }).length, deepest: deepest, lastPromo: lastPromo, weeks: have.length, price: p, flags: flags };
    });
  }

  var api = { W: W, R12_START: R12_START, SEGMENTS: SEGMENTS, CORE: CORE, PRIME: PRIME, TARIFF: TARIFF,
    wkDate: wkDate, wkIso: wkIso, wkLabel: wkLabel, monthLabel: monthLabel, primeWeek: primeWeek, excluded: excluded, f1: f1, avg: avg,
    parse: parse, trendSeries: trendSeries, findMoves: findMoves, stability: stability, tariffRow: tariffRow, brands: brands,
    promoStats: promoStats, promoPrices: promoPrices, ladderRows: ladderRows, shareSeries: shareSeries, shareChange: shareChange, shareEvent: shareEvent, skuRows: skuRows };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BritaxAnalytics = api;
})(typeof window !== 'undefined' ? window : this);
