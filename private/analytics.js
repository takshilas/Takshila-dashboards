// Parses the precomputed tables and derives every number the dashboard shows. No data is fetched here.
// Runs in the browser (window.BritaxAnalytics) and in node (module.exports) so the numbers can be checked from a script.
(function (root) {
  var W = 106;
  var FIRST = Date.UTC(2024, 9, 6); // week 0 starts 2024-10-06 (Sunday)
  var R12_START = 54;               // first week of the 12-month tables (2025-10-19)
  var SEGMENTS = ['Car Seats', 'Strollers', 'Travel Systems', 'Accessories']; // Amazon categories, as in the CommerceIQ Market Share page
  var CORE = [0, 1]; // Britax's two largest categories: Car Seats and Strollers, about 88% of Britax sales
  // June and October Prime events. 2025 had no June event, so Prime Day in July 2025 is used.
  var PRIME = [
    { week: 39, short: 'Jul-25', label: 'Prime Day Jul 2025 (no June event in 2025)' },
    { week: 52, short: 'Oct-25', label: 'Prime Big Deal Days Oct 2025' },
    { week: 89, short: 'Jun-26', label: 'Prime Day Jun 2026' },
    { week: 104, short: 'Oct-26', label: 'Prime Big Deal Days Oct 2026' }
  ];
  var TARIFF = [13, 38]; // Jan to Jun 2025
  var BLACK_FRIDAY = [6, 7, 8, 59, 60];

  // ---------- month selection ----------
  // A week belongs to the month its Saturday (week-end date) falls in. Jan-Oct 2026 is then the 42 platform weeks of Dec 28, 2025 to Oct 11, 2026.
  function endDate(i) { return new Date(FIRST + (i * 7 + 6) * 864e5); }
  function monthOf(i) { var d = endDate(i); return d.getUTCFullYear() * 12 + d.getUTCMonth(); }
  function mKey(ix) { var m = ix % 12 + 1; return Math.floor(ix / 12) + '-' + (m < 10 ? '0' : '') + m; }
  function mIdx(key) { var p = String(key).split('-'); return +p[0] * 12 + (+p[1] - 1); }
  function mName(ix) { return new Date(Date.UTC(Math.floor(ix / 12), ix % 12, 1)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }); }
  function weeksBetween(a, b) { var o = []; for (var w = 0; w < W; w++) { var m = monthOf(w); if (m >= a && m <= b) o.push(w); } return o; }
  var LATEST = monthOf(W - 1), FIRST_SELECTABLE = monthOf(W - 1); // the dashboard starts at Oct 2026; earlier months are not offered
  var MONTHS = []; for (var mi = FIRST_SELECTABLE; mi <= LATEST; mi++) MONTHS.push(mKey(mi));
  // Every window the dashboard uses, as lists of week indexes, for the month selected.
  function win(key) {
    var m = key ? mIdx(key) : LATEST; if (!(m <= LATEST)) m = LATEST; if (m < FIRST_SELECTABLE) m = FIRST_SELECTABLE;
    var y = Math.floor(m / 12), jan = y * 12;
    var o = { key: mKey(m), ix: m, label: mName(m), year: y,
      month: weeksBetween(m, m), prev: weeksBetween(m - 1, m - 1), q: weeksBetween(m - 2, m), h: weeksBetween(m - 5, m), y12: weeksBetween(m - 11, m),
      ytd: weeksBetween(jan, m), py: weeksBetween(jan - 12, jan - 1), q1: weeksBetween(jan, jan + 2).filter(function (w) { return w <= weeksBetween(m, m).slice(-1)[0]; }) };
    o.pytd = o.ytd.map(function (w) { return w - 52; }).filter(function (w) { return w >= 0; }); // the same weeks one year (52 weeks) earlier
    o.last = o.month[o.month.length - 1];
    var next = new Date(endDate(o.last).getTime() + 7 * 864e5);
    o.partial = m === LATEST && next.getUTCFullYear() * 12 + next.getUTCMonth() === m;
    var d0 = new Date(Date.UTC(Math.floor(m / 12), m % 12, 1)), tot = 0; while (d0.getUTCMonth() === m % 12) { if (d0.getUTCDay() === 6) tot++; d0 = new Date(d0.getTime() + 864e5); }
    o.total = tot; // week-ends (Saturdays) in the month
    o.fromLabel = function (ws) { return wkLabel(ws[0]); };
    o.range = function (ws) { return ws.length ? wkLabel(ws[0]) + ' to ' + wkLabel(ws[ws.length - 1]) + ' (' + ws.length + ' weeks)' : '—'; };
    return o;
  }
  var WIN = win();
  function setMonth(key) { WIN = win(key); return WIN; }
  function current() { return WIN; }
  function cleanWeeks(ws) { return ws.filter(function (w) { return !excluded(w); }); }

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
    var out = { wk: {}, r12: {}, skus: [], prices: {}, ladder: [], range: {}, skuall: [], skucov: {}, cmp: {}, asp: {}, tw: {}, ta: {}, tp: {}, ti: {}, el: [], tsk: {}, bw: {}, cnt: {}, an: {} };
    D.weekly.forEach(function (r) { var p = r.split('|'); (out.wk[+p[0]] = out.wk[+p[0]] || {})[p[1]] = { s: nums(p[2]), u: nums(p[3]) }; });
    D.r12.forEach(function (r) {
      var p = r.split('|'), place = function (s) { var a = [], v = nums(s); for (var i = 0; i < 52; i++) a[R12_START + i] = v[i]; return a; };
      (out.r12[+p[0]] = out.r12[+p[0]] || {})[p[1]] = { idx: place(p[2]), pu: place(p[3]), un: place(p[4]) };
    });
    (D.skus || []).forEach(function (r) {
      var p = r.split('|'), b = p[5].split(','), pr = []; nums(p[6]).forEach(function (v, i) { pr[R12_START + i] = v; });
      out.skus.push({ si: +p[0], own: p[1] === 'B', asin: p[2], brand: p[3], title: p[4].trim(), base: +b[0], u13: +b[1], price: pr });
    });
    (D.prices || []).forEach(function (r) { var p = r.split('|'), v = nums(p[2]); (out.prices[+p[0]] = out.prices[+p[0]] || {})[p[1]] = { pu: v[0], ps: v[1], nu: v[2], ns: v[3], psr: v[4], por: v[5] }; });
    (D.range || []).forEach(function (r) { var p = r.split('|'), v = nums(p[2]); (out.range[+p[0]] = out.range[+p[0]] || {})[p[1]] = { n: v[0], lo: v[1], med: v[2], hi: v[3], p52: v[4], p13: v[5] }; });
    (D.asp || []).forEach(function (r) { var p = r.split('|'), v = nums(p[2]); (out.asp[+p[0]] = out.asp[+p[0]] || {})[p[1]] = v; });
    (D.skuall || []).forEach(function (r) {
      var p = r.split('|'), v = nums(p[5]);
      out.skuall.push({ si: +p[0], own: p[1] === 'B', asin: p[2], brand: p[3], title: p[4].trim(), base: v[0], pu: v[1] || 0, ps: v[2] || 0, nu: v[3] || 0, ns: v[4] || 0, pw: v[5], wk: v[6], now: v[7] });
    });
    (D.skucov || []).forEach(function (r) { var p = r.split('|'), v = nums(p[2]); (out.skucov[+p[0]] = out.skucov[+p[0]] || {})[p[1]] = { n: v[0], pct: v[1] }; });
    (D.cmp || []).forEach(function (r) { var p = r.split('|'), v = nums(p[3]); ((out.cmp[+p[0]] = out.cmp[+p[0]] || { rows: [], tot: null }).rows).push({ own: p[1] === 'B', brand: p[2], s25: v[0] || 0, s25b: v[1] || 0, s26: v[2] || 0, n25: v[3], n26: v[4] }); });
    (D.cmptot || []).forEach(function (r) { var p = r.split('|'), v = nums(p[1]); (out.cmp[+p[0]] = out.cmp[+p[0]] || { rows: [], tot: null }).tot = { s25: v[0], s25b: v[1], s26: v[2], n25: v[3], n26: v[4] }; });
    var put = function (o, p, v) { ((o[+p[0]] = o[+p[0]] || {})[+p[1]] = o[+p[0]][+p[1]] || {})[p[2]] = v; };
    (D.tierwk || []).forEach(function (r) { var p = r.split('|'), s = nums(p[3]), u = nums(p[4]); put(out.tw, p, { s: s.map(function (v) { return v == null ? null : v * 100; }), u: u }); });
    (D.tierbrwk || []).forEach(function (r) { var p = r.split('|'), v = nums(p[3]), a = []; v.forEach(function (x, i) { a[12 + i] = x == null ? null : x * 100; }); put(out.tw, p, { s: a, u: [] }); });
    (D.tierbrasp || []).forEach(function (r) { var p = r.split('|'); put(out.ta, p, nums(p[3])); });
    (D.tierbrpromo || []).forEach(function (r) { var p = r.split('|'), v = nums(p[3]); put(out.tp, p, { np: v[0] || 0, sp: v[1] || 0, nn: v[2] || 0, sn: v[3] || 0 }); });
    (D.tierbridx || []).forEach(function (r) { var p = r.split('|'); put(out.ti, p, nums(p[3])); });
    (D.tierskus || []).forEach(function (r) {
      var p = r.split('|'), b = p[6].split(','), pr = []; nums(p[7]).forEach(function (v, i) { pr[R12_START + i] = v; });
      ((out.tsk[+p[0]] = out.tsk[+p[0]] || {})[+p[1]] = out.tsk[+p[0]][+p[1]] || []).push({ own: p[2] === 'B', asin: p[3], brand: p[4], title: p[5].trim(), base: +b[0], u13: +b[1], asp: +b[2], price: pr });
    });
    (D.brandwk || []).forEach(function (r) { var p = r.split('|'), v = nums(p[2]), a = []; v.forEach(function (x, i) { a[12 + i] = x == null ? null : x * 100; }); (out.bw[+p[0]] = out.bw[+p[0]] || {})[p[1]] = a; });
    (D.tierasp || []).forEach(function (r) { var p = r.split('|'); put(out.ta, p, nums(p[3])); });
    (D.tierpromo || []).forEach(function (r) { var p = r.split('|'), v = nums(p[3]); put(out.tp, p, { np: v[0] || 0, sp: v[1] || 0, nn: v[2] || 0, sn: v[3] || 0 }); });
    (D.tieridx || []).forEach(function (r) { var p = r.split('|'); put(out.ti, p, nums(p[3])); });
    (D.elast || []).forEach(function (r) { var p = r.split('|'), v = nums(p[3]); out.el.push({ cs: +p[0], gr: p[1], tr: +p[2], n: v[0], ne: v[1], S: v[2], Se: v[3], Swe: v[4], med: v[5], npos: v[6], nr: v[7], Sr: v[8], Swr: v[9] }); });
    // Month anchors: for each selectable month, products and price sums for year to date, the same weeks a year earlier, the month and the month before.
    var mo = null;
    String(D.anchor || '').split('\n').forEach(function (l) {
      if (!l) return; if (l.charAt(0) === '@') { mo = l.slice(1); return; }
      var p = l.split('|'), a = out.an[mo] = out.an[mo] || {}, s = a[+p[0]] = a[+p[0]] || {}, t = s[p[1]] = s[p[1]] || {};
      t[p[2]] = nums(p[3]);
    });
    return out;
  }

  // Price windows [2024, 2025, prior-year YTD, YTD, previous month, month] as products and price sums: the two full years are fixed, the rest follow the month selected.
  function anchored(M, si, t, b, base) {
    var a = M.an && M.an[WIN.key] && M.an[WIN.key][si] && M.an[WIN.key][si][t] && M.an[WIN.key][si][t][b], v = base || [];
    if (!a) return [v[0] || 0, v[1] || 0, v[2] || 0, v[3] || 0, 0, 0, 0, 0, 0, 0, 0, 0];
    return [v[0] || 0, v[1] || 0, v[2] || 0, v[3] || 0, a[2], a[3], a[0], a[1], a[6], a[7], a[4], a[5]];
  }

  // Average selling price of all products (sales / units, promotions included) as a weekly index, Oct to Dec 2024 (deal weeks left out) = 100.
  var BASE_WEEKS = [2, 3, 4, 5, 9, 10, 11, 12];
  function trendSeries(M, si, brand) {
    var d = M.wk[si] && M.wk[si][brand], asp = [], vals = [], bs = 0, bu = 0;
    if (!d) return { vals: vals, asp: asp, base: null };
    for (var w = 0; w < W; w++) asp[w] = d.u[w] ? d.s[w] / d.u[w] : null;
    BASE_WEEKS.forEach(function (x) { if (d.s[x] != null && d.u[x]) { bs += d.s[x]; bu += d.u[x]; } });
    var base = bu ? bs / bu : null;
    for (var x = 0; x < W; x++) vals[x] = base && asp[x] != null ? asp[x] / base * 100 : null;
    return { vals: vals, asp: asp, base: base };
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

  // Last six months (weeks 80..105), Prime-affected weeks left out. Net change and swing use the average selling price of all products; weeks well below baseline use the 12-month promo series.
  function stability(M, si, brand) {
    var r = M.r12[si] && M.r12[si][brand], t = trendSeries(M, si, brand); if (!r || t.base == null) return null;
    var cl = function (lo, hi) { return slice(t.vals, lo, hi).map(function (v, i) { return excluded(lo + i) ? null : v; }); };
    var first = avg(cl(80, 85)), last = avg(cl(96, 101)), all = cl(80, 105), ch = [];
    for (var i = 1; i < all.length; i++) if (all[i] != null && all[i - 1] != null) ch.push((all[i] / all[i - 1] - 1) * 100);
    var idx = slice(r.idx, 80, 105).map(function (v, k) { return excluded(80 + k) ? null : v; });
    var dips = idx.filter(function (v) { return v != null && v <= 95; }).length;
    var moves = findMoves(t.vals).filter(function (m) { return m.week >= 80; });
    var net = first && last ? (last / first - 1) * 100 : null, vol = sd(ch);
    var status = net == null ? 'No read' : net >= 3 ? 'Raised' : net <= -3 ? 'Cut' : (dips >= 4 || (vol != null && vol >= 3)) ? 'Stable, promotes often' : 'Stable';
    return { net: net, vol: vol, dips: dips, weeks: cnt(idx), moves: moves, status: status };
  }

  // Tariff period: average selling price of all products in Jun 2025 (weeks 33-36) vs Jan 2025 (weeks 13-16).
  function tariffRow(M, si, brand) {
    var d = M.wk[si] && M.wk[si][brand]; if (!d) return null;
    var p = function (lo, hi) { var s = 0, u = 0; for (var w = lo; w <= hi; w++) if (d.s[w] != null && d.u[w]) { s += d.s[w]; u += d.u[w]; } return u ? s / u : null; };
    var jan = p(13, 16), jun = p(33, 36);
    return { rise: jan && jun ? (jun / jan - 1) * 100 : null, cov: 100 };
  }

  function brands(M, si) {
    var o = M.wk[si] || {}, tot = function (b) { return o[b].s.reduce(function (a, v) { return a + (v || 0); }, 0); };
    var others = Object.keys(o).filter(function (b) { return ['Britax group', 'All competitors', 'Segment total'].indexOf(b) < 0; }).sort(function (a, b) { return tot(b) - tot(a); });
    return ['Britax group', 'All competitors'].concat(others);
  }

  // 12-month promotion summary (baseline = each SKU's own 12-month average selling price). Weighted by units.
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

  // Average price on promotion vs off promotion over the last 12 months.
  function promoPrices(M, si, brand) {
    var p = M.prices[si] && M.prices[si][brand]; if (!p) return null;
    var on = p.pu ? p.ps / p.pu : null, off = p.nu ? p.ns / p.nu : null;
    // Average price of all products on promotion vs off promotion (unit-weighted); it moves with product mix as well as discount depth.
    return { on: on, off: off, np: p.pu, nn: p.nu, gap: on != null && off ? (on / off - 1) * 100 : null };
  }

  // Price table by brand: share of sales and units (last 52 weeks) with average selling price (sales / units, all weeks) changes.
  // Rows = Britax and the 5 competitors with the largest share of the category, ordered by share, then all competitors combined.
  function priceRows(M, si) {
    var src = M.asp, wk = M.wk[si] || {};
    var ch = function (x, y) { return x != null && y ? (x / y - 1) * 100 : null; };
    var pr = function (v, k) { return v && v[2 * k] >= 3 ? v[2 * k + 1] / v[2 * k] : null; }; // simple average of product prices: sum / products (needs 3+ products)
    var one = function (b) {
      var v0 = src[si] && src[si][b], d = wk[b]; if (!v0 || !d) return null;
      var v = anchored(M, si, 'A', b, v0);
      var p24 = pr(v, 0), p25 = pr(v, 1), p25y = pr(v, 2), p26y = pr(v, 3), pSep = pr(v, 4), pOct = pr(v, 5);
      var u = 0; WIN.y12.forEach(function (w) { u += d.u[w] || 0; });
      return { brand: b, share: shareWeeks(M, si, b, WIN.y12), units: u, sh25: shareWeeks(M, si, b, WIN.py), sh26: shareWeeks(M, si, b, WIN.ytd),
        p25: p25, c25: ch(p25, p24), p26y: p26y, c26y: ch(p26y, p25y), pOct: pOct, cOct: ch(pOct, pSep), p24: p24, p25y: p25y, v: v };
    };
    var names = Object.keys(wk).filter(function (b) { return ['All competitors', 'Segment total'].indexOf(b) < 0 && src[si] && src[si][b]; });
    var rows = names.map(one).filter(Boolean).sort(function (a, b) { return b.share - a.share; });
    var me = rows.filter(function (r) { return r.brand === 'Britax group'; })[0];
    var t5 = rows.filter(function (r) { return r.brand !== 'Britax group'; }).slice(0, 5), top = t5.slice();
    if (me) top.push(me);
    top.sort(function (a, b) { return b.share - a.share; });
    var base = me && me.p26y;
    top.forEach(function (r) { r.vsB = me && r !== me && r.p26y != null && base ? (r.p26y / base - 1) * 100 : null; });
    // top 5 share holders combined (sum sales and units over each window)
    var comb = { brand: 'Top 5 competitors', group: 1, units: 0, share: 0, sh25: 0, sh26: 0 }, v = [];
    for (var k = 0; k < 12; k++) v[k] = t5.reduce(function (a, r) { return a + (r.v[k] || 0); }, 0);
    comb.v = v; t5.forEach(function (r) { comb.share += r.share; comb.sh25 += r.sh25; comb.sh26 += r.sh26; comb.units += r.units; });
    var q = pr(v, 0), q25 = pr(v, 1), q25y = pr(v, 2), q26y = pr(v, 3), qs = pr(v, 4), qo = pr(v, 5);
    comb.p25 = q25; comb.c25 = ch(q25, q); comb.p26y = q26y; comb.c26y = ch(q26y, q25y); comb.pOct = qo; comb.cOct = ch(qo, qs);
    comb.vsB = me && q26y != null && base ? (q26y / base - 1) * 100 : null;
    var all = one('All competitors'); if (all) { all.group = 1; all.brand = 'All competitors'; all.vsB = me && all.p26y != null && base ? (all.p26y / base - 1) * 100 : null; }
    return { rows: top, comb: comb, all: all };
  }

  // Every product behind the promo averages (own: top 40 by units, competitors: top 30), with its own on/off-promo prices.
  function skuAll(M, si, own) {
    return M.skuall.filter(function (s) { return s.si === si && s.own === own; }).map(function (s) {
      var u = s.pu + s.nu, on = s.pu ? s.ps / s.pu : null, off = s.nu ? s.ns / s.nu : null;
      return { brand: s.brand, title: s.title, asin: s.asin, base: s.base, units: u, on: on, off: off, gap: on != null && off ? (on / off - 1) * 100 : null,
        pct: u ? s.pu / u * 100 : null, pw: s.pw, wk: s.wk, now: s.now, nowVs: s.now && off ? (s.now / off - 1) * 100 : null };
    });
  }

  // Share of sales ($) of a brand in its category over a list of weeks: brand sales / sales of every tracked brand, as in the CommerceIQ Market Share page.
  function shareWeeks(M, si, brand, weeks) {
    var r = M.wk[si] && M.wk[si][brand], t = M.wk[si] && M.wk[si]['Segment total'], a = 0, b = 0;
    if (!r || !t) return null;
    weeks.forEach(function (w) { if (r.s[w] != null && t.s[w] != null) { a += r.s[w]; b += t.s[w]; } });
    return b ? a / b * 100 : null;
  }

  // 2026 year to date vs 2025: sales, share of the segment, and the change, for Britax group brands and the top competitors.
  // Sales change compares 2026 YTD with the same 41 weeks of 2025; share difference compares 2026 YTD share with full-year 2025 share.
  function compareRows(M, si) {
    var bw = M.bw[si]; if (!bw) return null;
    var tot = []; (si === 4 ? [0, 1, 2, 3] : [si]).forEach(function (k) { var t = M.wk[k] && M.wk[k][TG]; if (t) t.s.forEach(function (v, w) { if (v != null) tot[w] = (tot[w] || 0) + v; }); });
    var sw = function (arr, ws) { var a = 0; ws.forEach(function (w) { if (arr[w] != null) a += arr[w]; }); return a; };
    var cn = M.cnt && M.cnt[WIN.key] && M.cnt[WIN.key][si] || {};
    var t = { s26: sw(tot, WIN.ytd), s25: sw(tot, WIN.py), s25b: sw(tot, WIN.pytd), n26: cn['All brands'] != null ? cn['All brands'] : null };
    var rows = Object.keys(bw).map(function (b) {
      var s26 = sw(bw[b], WIN.ytd), s25 = sw(bw[b], WIN.py), s25b = sw(bw[b], WIN.pytd);
      return { own: b === 'Britax' || b === 'Bob Gear', brand: b, s26: s26, s25: s25, s25b: s25b, n26: cn[b] != null ? cn[b] : null,
        chg: s25b ? (s26 / s25b - 1) * 100 : null, sh26: s26 / t.s26 * 100, sh25: s25 / t.s25 * 100, sh25b: s25b / t.s25b * 100, d: s26 / t.s26 * 100 - s25 / t.s25 * 100 };
    });
    var sum = function (own, k) { return rows.filter(function (r) { return r.own === own; }).reduce(function (a, r) { return a + (r[k] || 0); }, 0); };
    var group = function (own) { var o = { brand: own ? 'Britax group' : 'Top competitors', s26: sum(own, 's26'), s25: sum(own, 's25'), s25b: sum(own, 's25b'), n26: sum(own, 'n26') }; o.chg = o.s25b ? (o.s26 / o.s25b - 1) * 100 : null; o.sh26 = o.s26 / t.s26 * 100; o.sh25 = o.s25 / t.s25 * 100; o.d = o.sh26 - o.sh25; return o; };
    var own = rows.filter(function (r) { return r.own; }).sort(function (a, b) { return b.s26 - a.s26; });
    var comps = rows.filter(function (r) { return !r.own; }).sort(function (a, b) { return b.s26 - a.s26; });
    return { own: own, comps: comps, britax: group(true), top: group(false), total: t, totalChg: t.s25b ? (t.s26 / t.s25b - 1) * 100 : null };
  }

  // Share of sales in a category, weekly.
  function shareSeries(M, si, brand) {
    var r = M.wk[si] && M.wk[si][brand], t = M.wk[si] && M.wk[si]['Segment total'], out = [];
    if (!r || !t) return out;
    for (var w = 0; w < W; w++) out[w] = r.s[w] != null && t.s[w] ? r.s[w] / t.s[w] * 100 : null;
    return out;
  }
  function range(lo, hi) { var o = []; for (var w = lo; w <= hi; w++) o.push(w); return o; }
  function shareOver(M, si, brand, lo, hi) { return shareWeeks(M, si, brand, range(lo, hi)); }
  // Share change over six months (clean weeks) and around each Prime event inside the window.
  function shareChange(M, si, brand) {
    var c = cleanWeeks(WIN.h), s0 = shareWeeks(M, si, brand, c.slice(0, 6)), s1 = shareWeeks(M, si, brand, c.slice(-6));
    return { was: s0, now: s1, d: s0 != null && s1 != null ? s1 - s0 : null };
  }
  function shareEvent(M, si, brand, e) {
    var before = shareOver(M, si, brand, e - 3, e - 1), during = shareOver(M, si, brand, e, e), after = shareOver(M, si, brand, e + 1, Math.min(e + 3, W - 1));
    return { before: before, during: during, after: after, dDuring: during - before, dAfter: after - before };
  }

  // Key products: current price vs the SKU's 12-month baseline, range, promo weeks.
  // Weekly-price statistics of one key product (current price, vs baseline, promo weeks, recent promotions, status).
  function skuStat(s) {
      var p = s.price, have = p.filter(function (v) { return v != null; }), base = s.asp;
      // Price now = average weekly price in the selected month (latest weeks if the month has no price); baseline = the product's average selling price over the last 12 months.
      var cur = avg(WIN.month.map(function (w) { return p[w]; }));
      if (cur == null) cur = avg(slice(p, WIN.last - 3, WIN.last)); var last = p[WIN.last];
      var promoWk = have.filter(function (v) { return v <= 0.95 * base; }).length;
      var up = cur != null && base ? (cur / base - 1) * 100 : null;
      // Recent promotions: the last 13 weeks to the selected month, 5% or more below the baseline, the deepest of them, and the latest promoted week.
      var recent = [], lastPromo = null, deepest = null, lo13 = WIN.last - 12;
      for (var w = lo13; w <= WIN.last; w++) if (p[w] != null && p[w] <= 0.95 * base) { recent.push(w); lastPromo = w; var dd = (1 - p[w] / base) * 100; if (deepest == null || dd > deepest) deepest = dd; }
      var flags = [];
      if (cur != null && up <= -5) flags.push('On promo now'); else if (cur != null && up >= 5) flags.push('Priced above baseline'); else flags.push('At baseline');
      if (have.length && promoWk / have.length >= 0.25) flags.push('Promotes often');
      return { brand: s.brand, title: s.title, asin: s.asin, base: base, u13: s.u13, cur: cur, last: last, vs: up, lo: Math.min.apply(null, have), hi: Math.max.apply(null, have), promoWk: promoWk, recentWk: recent.length, recentOf: slice(p, lo13, WIN.last).filter(function (v) { return v != null; }).length, deepest: deepest, lastPromo: lastPromo, weeks: have.length, price: p, flags: flags, asp: s.asp };
  }
  function skuRows(M, si, own) {
    return M.skus.filter(function (s) { return s.si === si && s.own === own; }).map(skuStat);
  }
  // Key products of one price tier: the best-selling Britax products (own) or competitor products.
  function tierSkuRows(M, si, tier, own) {
    return ((M.tsk[si] && M.tsk[si][tier]) || []).filter(function (s) { return s.own === own; }).map(skuStat);
  }

  // ---------- price tiers ----------
  // Each category's ASINs are split into three tiers by the ASIN's own average price since Jan 2024 (cut-offs below), so an ASIN keeps one tier in every period.
  var TIER_NAMES = ['Value', 'Mid', 'Premium'], TIER_CUTS = [[160, 290], [200, 550], [315, 450], [25, 75]];
  function tierRange(si, t) { var c = TIER_CUTS[si]; return t === 0 ? 'under $' + c[0] : t === 1 ? '$' + c[0] + '–' + c[1] : '$' + c[1] + ' and over'; }
  function tierLabel(si, t) { return TIER_NAMES[t] + ' (' + tierRange(si, t) + ')'; }
  var BG = 'Britax group', CG = 'All competitors', TG = 'Segment total';
  function tsum(M, si, t, g, weeks, key) {
    var d = M.tw[si] && M.tw[si][t]; if (!d) return null;
    if (g !== TG && !d[g]) return null;
    var gs = g === TG ? [BG, CG] : [g], tot = 0;
    gs.forEach(function (x) { var r = d[x]; if (r) weeks.forEach(function (w) { if (r[key][w] != null) tot += r[key][w]; }); });
    return tot;
  }
  // Share of sales in a tier: group sales / sales of every tracked brand in the tier.
  function tierShare(M, si, t, g, weeks) { var a = tsum(M, si, t, g, weeks, 's'), b = tsum(M, si, t, TG, weeks, 's'); return a != null && b ? a / b * 100 : null; }
  function tierShareSeries(M, si, t, g) { var o = []; for (var w = 0; w < W; w++) o[w] = w < 12 ? null : tierShare(M, si, t, g, [w]); return o; }
  // Where is the loss: Britax sales and share by tier, 2026 YTD vs 2025.
  function tierOverview(M, si) {
    var rows = [0, 1, 2].map(function (t) {
      var c26 = tsum(M, si, t, TG, WIN.ytd, 's'), c25b = tsum(M, si, t, TG, WIN.pytd, 's'), b26 = tsum(M, si, t, BG, WIN.ytd, 's'), b25b = tsum(M, si, t, BG, WIN.pytd, 's');
      var sh25 = tierShare(M, si, t, BG, WIN.py), sh26 = tierShare(M, si, t, BG, WIN.ytd), d = sh25 != null && sh26 != null ? sh26 - sh25 : null;
      return { t: t, label: tierLabel(si, t), c26: c26, catChg: c25b ? (c26 / c25b - 1) * 100 : null, b26: b26, b25b: b25b, bChg: b25b > 0 ? (b26 / b25b - 1) * 100 : null, sh25: sh25, sh26: sh26, d: d, impact: d != null && c26 ? d / 100 * c26 : null };
    });
    var tot = rows.reduce(function (a, r) { return a + r.c26; }, 0);
    rows.forEach(function (r) { r.mix = tot ? r.c26 / tot * 100 : null; });
    return { rows: rows, tot: tot, b26: rows.reduce(function (a, r) { return a + r.b26; }, 0), b25b: rows.reduce(function (a, r) { return a + r.b25b; }, 0) };
  }
  function tierPriceFrom(v) {
    var pr = function (k) { return v && v[2 * k] >= 3 ? v[2 * k + 1] / v[2 * k] : null; }, ch = function (x, y) { return x != null && y ? (x / y - 1) * 100 : null; };
    var p24 = pr(0), p25 = pr(1), p25y = pr(2), p26y = pr(3), pSep = pr(4), pOct = pr(5);
    return { n: v ? v[6] : 0, p25: p25, c25: ch(p25, p24), p26y: p26y, c26y: ch(p26y, p25y), pOct: pOct, cOct: ch(pOct, pSep) };
  }
  // Price changes in a tier: Britax, all competitors and the tier overall (every tracked product).
  // Britax first, then the category's top 5 competitors in order of sales.
  function tierBrands(M, si) { return [BG].concat(brands(M, si).filter(function (b) { return b !== BG && b !== CG; })); }
  function tierPrice(M, si, t) {
    var d0 = M.ta[si] && M.ta[si][t] || {}, d = {}; Object.keys(d0).forEach(function (b) { d[b] = anchored(M, si, t, b, d0[b]); });
    tierBrands(M, si).concat([BG, CG]).forEach(function (b) { if (!d[b]) d[b] = anchored(M, si, t, b, null); });
    var B = d[BG], C = d[CG], cat = B && C ? B.map(function (x, i) { return (x || 0) + (C[i] || 0); }) : (C || B);
    var rows = tierBrands(M, si).map(function (b) { return { brand: b, r: tierPriceFrom(d[b]) }; }).concat([{ brand: CG, r: tierPriceFrom(C) }, { brand: 'Tier overall', r: tierPriceFrom(cat) }]);
    var base = rows[0].r.p26y;
    rows.forEach(function (x) { x.r.vsB = x.brand !== BG && x.r.p26y != null && base ? (x.r.p26y / base - 1) * 100 : null; });
    return rows;
  }
  function tierPromoFrom(p) {
    if (!p) return { np: 0, nn: 0, on: null, off: null, gap: null };
    var on = p.np >= 3 ? p.sp / p.np : null, off = p.nn >= 3 ? p.sn / p.nn : null;
    return { np: p.np, nn: p.nn, on: on, off: off, gap: on != null && off ? (on / off - 1) * 100 : null };
  }
  function tierPromo(M, si, t) {
    var d = M.tp[si] && M.tp[si][t] || {}, B = d[BG], C = d[CG], cat = B || C ? { np: (B ? B.np : 0) + (C ? C.np : 0), sp: (B ? B.sp : 0) + (C ? C.sp : 0), nn: (B ? B.nn : 0) + (C ? C.nn : 0), sn: (B ? B.sn : 0) + (C ? C.sn : 0) } : null;
    return tierBrands(M, si).map(function (b) { return { brand: b, r: tierPromoFrom(d[b]) }; }).concat([{ brand: CG, r: tierPromoFrom(C) }, { brand: 'Tier overall', r: tierPromoFrom(cat) }]);
  }
  // Share of sales by tier for Britax and each top competitor, 2026 YTD vs 2025.
  function tierBrandShare(M, si, t, g) {
    var sh25 = tierShare(M, si, t, g, WIN.py), sh26 = tierShare(M, si, t, g, WIN.ytd);
    return { sh25: sh25, sh26: sh26, d: sh25 != null && sh26 != null ? sh26 - sh25 : null };
  }
  // Same measures as the share comparison table, for one group within one price tier: estimated sales (YTD, prior year, prior-year same weeks), % change, share and share difference.
  function tierBrandCompare(M, si, t, g) {
    var s26 = tsum(M, si, t, g, WIN.ytd, 's'), s25 = tsum(M, si, t, g, WIN.py, 's'), s25b = tsum(M, si, t, g, WIN.pytd, 's'), a26 = tsum(M, si, t, TG, WIN.ytd, 's'), a25 = tsum(M, si, t, TG, WIN.py, 's');
    if (s26 == null) return { s26: null, s25: null, s25b: null, chg: null, sh26: null, sh25: null, d: null };
    var sh26 = a26 ? s26 / a26 * 100 : null, sh25 = a25 ? s25 / a25 * 100 : null;
    return { s26: s26, s25: s25, s25b: s25b, chg: s25b ? (s26 / s25b - 1) * 100 : null, sh26: sh26, sh25: sh25, d: sh26 != null && sh25 != null ? sh26 - sh25 : null };
  }
  // Share in Prime weeks vs other weeks, 2026 year to date, for one group in one tier.
  function tierPrimeVs(M, si, t, g) {
    var all = WIN.ytd, prime = [], other = [];
    all.forEach(function (k) { (PRIME.some(function (e) { return Math.abs(e.week - k) <= 1; }) ? prime : other).push(k); });
    var a = tierShare(M, si, t, g, all), p = tierShare(M, si, t, g, prime), o = tierShare(M, si, t, g, other), f = tierShare(M, si, t, g, WIN.q1), l = tierShare(M, si, t, g, WIN.q);
    return { a: a, p: p, o: o, lift: p != null && o != null ? p - o : null, f: f, l: l, d: f != null && l != null ? l - f : null };
  }
  function tierChange(M, si, t, g) {
    var c = cleanWeeks(WIN.h), s0 = tierShare(M, si, t, g, c.slice(0, 6)), s1 = tierShare(M, si, t, g, c.slice(-6));
    return { was: s0, now: s1, d: s0 != null && s1 != null ? s1 - s0 : null };
  }
  function tierEvent(M, si, t, g, e) {
    var before = tierShare(M, si, t, g, range(e - 3, e - 1)), during = tierShare(M, si, t, g, [e]), after = tierShare(M, si, t, g, range(e + 1, Math.min(e + 3, W - 1)));
    var ix = M.ti[si] && M.ti[si][t] && M.ti[si][t][g]; var iv = ix ? (e === 89 ? ix[0] : e === 104 ? ix[1] : null) : null;
    return { before: before, during: during, after: after, dDuring: during != null && before != null ? during - before : null, dAfter: after != null && before != null ? after - before : null, ix: iv };
  }

  // ---------- price elasticity (own ASINs, latest 2026 feed) ----------
  function elastRows(M, cs) { return M.el.filter(function (r) { return r.cs === cs; }); }
  function elastStat(r) {
    return { n: r.n, ne: r.ne, cov: r.S ? r.Se / r.S * 100 : null, nr: r.nr, covR: r.S ? r.Sr / r.S * 100 : null, wR: r.Sr ? r.Swr / r.Sr : null, wAll: r.Se ? r.Swe / r.Se : null, med: r.med, npos: r.npos };
  }

  var api = { W: W, R12_START: R12_START, SEGMENTS: SEGMENTS, CORE: CORE, PRIME: PRIME, TARIFF: TARIFF,
    wkDate: wkDate, wkIso: wkIso, wkLabel: wkLabel, monthLabel: monthLabel, primeWeek: primeWeek, excluded: excluded, f1: f1, avg: avg,
    parse: parse, trendSeries: trendSeries, findMoves: findMoves, stability: stability, tariffRow: tariffRow, brands: brands,
    promoStats: promoStats, win: current, setMonth: setMonth, monthName: function (k) { return mName(mIdx(k)); }, MONTHS: MONTHS, mName: mName, mKey: mKey, cleanWeeks: cleanWeeks, compareRows: compareRows, priceRows: priceRows, promoPrices: promoPrices, skuAll: skuAll, shareWeeks: shareWeeks, shareSeries: shareSeries, shareChange: shareChange, shareEvent: shareEvent, skuRows: skuRows, tierSkuRows: tierSkuRows,
    TIER_NAMES: TIER_NAMES, tierRange: tierRange, tierLabel: tierLabel, tierShare: tierShare, tierShareSeries: tierShareSeries, tierOverview: tierOverview, tierPrice: tierPrice, tierPromo: tierPromo, tierBrands: tierBrands, tierBrandShare: tierBrandShare, tierBrandCompare: tierBrandCompare, tierPrimeVs: tierPrimeVs, tierChange: tierChange, tierEvent: tierEvent,
    elastRows: elastRows, elastStat: elastStat };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BritaxAnalytics = api;
})(typeof window !== 'undefined' ? window : this);
