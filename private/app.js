// Britax US pricing and share dashboard. Renders from precomputed tables (private/data-*.js); nothing is queried in the browser.
(function () {
  var A = window.BritaxAnalytics;
  var M = A.parse({ basket: window.BRITAX_BASKET, tariff: window.BRITAX_TARIFF, r12: window.BRITAX_R12, skus: window.BRITAX_SKUS, prices: window.BRITAX_PRICES, ladder: window.BRITAX_LADDER, range: window.BRITAX_RANGE });
  var SEG = A.SEGMENTS, CORE = A.CORE, PRIME = A.PRIME, W = A.W, f1 = A.f1, R0 = A.R12_START, LAST = W - 1;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var fin = function (v) { return v != null && isFinite(v); };
  var sgn = function (v, d) { return !fin(v) ? '—' : (v > 0.049 ? '+' : v < -0.049 ? '−' : '') + Math.abs(v).toFixed(d == null ? 1 : d) + '%'; };
  var pts = function (v) { return !fin(v) ? '—' : (v > 0.049 ? '+' : v < -0.049 ? '−' : '') + Math.abs(v).toFixed(1) + ' pts'; };
  var usd = function (v) { return !fin(v) ? '—' : '$' + v.toFixed(0); };
  var num = function (v) { return !fin(v) ? '—' : Math.round(v).toLocaleString('en-US'); };
  var cls = function (v) { return !fin(v) ? '' : v > 0.049 ? 'up' : v < -0.049 ? 'down' : ''; };
  var COLORS = ['#1F22B2', '#5AAFFE', '#B54708', '#067647', '#7A5AF8', '#D92D20', '#0E7090', '#667085'];
  var BRITAX = '#C231FF', COMP_ALL = '#210235';

  var VIEWS = [
    { id: 'trend', label: 'Price trend and stability' },
    { id: 'promo', label: 'Promotions vs 12-month baseline' },
    { id: 'skus', label: 'Key competitor products' },
    { id: 'share', label: 'Share around Prime days' }
  ];
  var q = new URLSearchParams(location.search);
  function clampInt(v, lo, hi, d) { var n = parseInt(v, 10); return isNaN(n) ? d : Math.max(lo, Math.min(hi, n)); }
  var state = { view: VIEWS.some(function (v) { return v.id === q.get('view'); }) ? q.get('view') : 'trend', seg: clampInt(q.get('seg'), 0, 5, 0), overlay: {} };
  function sync() { history.replaceState(null, '', '?view=' + state.view + '&seg=' + state.seg + location.hash); }

  $('asof').innerHTML = 'Amazon US · weekly Market Share estimates · data through week of <b>' + A.wkIso(LAST) + '</b> · tariff period Jan–Jun 2025 · Prime events: June and October';

  // ---------- tabs ----------
  function drawTabs() {
    $('viewTabs').innerHTML = VIEWS.map(function (v) { return '<button class="tab view" role="tab" data-v="' + v.id + '" aria-selected="' + (v.id === state.view) + '">' + esc(v.label) + '</button>'; }).join('');
    var segs = state.view === 'skus' ? CORE : [0, 1, 2, 3, 4, 5];
    if (segs.indexOf(state.seg) < 0) state.seg = segs[0];
    $('segTabs').innerHTML = segs.map(function (i) { return '<button class="tab" role="tab" data-s="' + i + '" aria-selected="' + (i === state.seg) + '">' + esc(SEG[i]) + '</button>'; }).join('');
  }
  $('viewTabs').onclick = function (e) { var b = e.target.closest('[data-v]'); if (b) { state.view = b.dataset.v; render(); } };
  $('segTabs').onclick = function (e) { var b = e.target.closest('[data-s]'); if (b) { state.seg = +b.dataset.s; render(); } };

  // ---------- table with sort and csv ----------
  var sortState = {};
  function table(el, id, cols, rows, opts) {
    opts = opts || {};
    var st = sortState[id], data = rows.slice();
    if (st) {
      var col = cols.filter(function (c) { return c.key === st.key; })[0];
      if (col) data.sort(function (a, b) {
        var x = col.sort ? col.sort(a) : a[col.key], y = col.sort ? col.sort(b) : b[col.key];
        if (!fin(x) && typeof x !== 'string') x = null; if (!fin(y) && typeof y !== 'string') y = null;
        if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
        return (typeof x === 'string' ? x.localeCompare(y) : x - y) * st.dir;
      });
    }
    el.innerHTML = '<thead><tr>' + cols.map(function (c) {
      var on = st && st.key === c.key;
      return '<th scope="col" class="' + (c.l ? 'l' : '') + '"' + (on ? ' aria-sort="' + (st.dir > 0 ? 'ascending' : 'descending') + '"' : '') + '><button data-k="' + c.key + '" title="Sort">' + esc(c.label) + (on ? (st.dir > 0 ? ' ▲' : ' ▼') : '') + '</button></th>';
    }).join('') + '</tr></thead><tbody>' + data.map(function (r) {
      return '<tr class="' + (r._cls || '') + '">' + cols.map(function (c) {
        return '<td class="' + (c.l ? 'l ' : '') + (c.wrap ? 'wrap ' : '') + (c.cls ? c.cls(r) : '') + '">' + (c.render ? c.render(r) : esc(r[c.key] == null ? '—' : r[c.key])) + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody>';
    el.onclick = function (e) {
      var b = e.target.closest('button[data-k]'); if (b) {
        var cur = sortState[id]; sortState[id] = { key: b.dataset.k, dir: cur && cur.key === b.dataset.k ? -cur.dir : 1 }; table(el, id, cols, rows, opts); return;
      }
      var s = e.target.closest('[data-seg]'); if (s) { state.seg = +s.dataset.seg; render(); }
    };
    el._csv = function () {
      var lines = [cols.map(function (c) { return JSON.stringify(c.label); }).join(',')].concat(data.map(function (r) {
        return cols.map(function (c) { var v = c.csv ? c.csv(r) : r[c.key]; return JSON.stringify(v == null ? '' : v); }).join(',');
      }));
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })); a.download = id + '.csv'; a.click();
    };
  }
  function csvBtn(id) { return '<button class="btn" data-csv="' + id + '">Download CSV</button>'; }
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-csv]'); if (b) { var t = $(b.dataset.csv); if (t && t._csv) t._csv(); } });

  // ---------- charts ----------
  var CW = 920, CH = 300, PL = 46, PR = 14, PT = 12, PB = 30;
  function lineChart(id, o) {
    var lo = o.lo, hi = o.hi, ys = [];
    o.series.forEach(function (s) { for (var w = lo; w <= hi; w++) if (fin(s.vals[w])) ys.push(s.vals[w]); });
    if (!ys.length) return '<p class="muted">No data for this selection.</p>';
    var mn = Math.min.apply(null, ys), mx = Math.max.apply(null, ys), pad = (mx - mn) * 0.08 || 2;
    mn = Math.floor((mn - pad) / 5) * 5; if (o.floor0) mn = Math.max(0, mn); mx = Math.ceil((mx + pad) / 5) * 5;
    var x = function (w) { return PL + (w - lo) / (hi - lo) * (CW - PL - PR); };
    var y = function (v) { return PT + (1 - (v - mn) / (mx - mn)) * (CH - PT - PB); };
    var g = '';
    for (var t = mn; t <= mx; t += 5) g += '<line x1="' + PL + '" x2="' + (CW - PR) + '" y1="' + y(t) + '" y2="' + y(t) + '" stroke="#E7E2EC"/><text x="' + (PL - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end" font-size="11" fill="#5b5266">' + (o.pct ? t : t) + '</text>';
    if (o.base != null && o.base >= mn && o.base <= mx) g += '<line x1="' + PL + '" x2="' + (CW - PR) + '" y1="' + y(o.base) + '" y2="' + y(o.base) + '" stroke="#5b5266" stroke-dasharray="3 3"/>';
    var bands = '';
    if (o.tariff) { var a = Math.max(lo, A.TARIFF[0]), b = Math.min(hi, A.TARIFF[1]); if (b > a) bands += '<rect x="' + x(a) + '" y="' + PT + '" width="' + (x(b) - x(a)) + '" height="' + (CH - PT - PB) + '" fill="#EAF4FF"/><text x="' + (x(a) + 4) + '" y="' + (PT + 11) + '" font-size="11" fill="#1F22B2">Tariff period</text>'; }
    PRIME.forEach(function (e) {
      if (e.week - 1 > hi || e.week + 1 < lo) return;
      var a = Math.max(lo, e.week - 1), b = Math.min(hi, e.week + 1);
      bands += '<rect x="' + (x(a) - 3) + '" y="' + PT + '" width="' + (x(b) - x(a) + 6) + '" height="' + (CH - PT - PB) + '" fill="#C231FF" fill-opacity=".13"/><text x="' + x(e.week) + '" y="' + (CH - PB - 4) + '" font-size="11" text-anchor="middle" fill="#8A1FB8">' + e.short + '</text>';
    });
    (o.extra || []).forEach(function (w) { if (w < lo || w > hi) return; bands += '<rect x="' + (x(w) - 4) + '" y="' + PT + '" width="8" height="' + (CH - PT - PB) + '" fill="#F79009" fill-opacity=".16"/>'; });
    var ticks = '';
    for (var w = lo; w <= hi; w++) { var d = A.wkDate(w); if (d.getUTCDate() <= 7 && (d.getUTCMonth() % (hi - lo > 60 ? 3 : 1) === 0)) ticks += '<text x="' + x(w) + '" y="' + (CH - 10) + '" font-size="11" text-anchor="middle" fill="#5b5266">' + A.monthLabel(w) + '</text>'; }
    var lines = '', marks = '';
    o.series.forEach(function (s) {
      var d = '', pen = false;
      for (var w = lo; w <= hi; w++) { var v = s.vals[w]; if (!fin(v)) { pen = false; continue; } d += (pen ? 'L' : 'M') + x(w).toFixed(1) + ' ' + y(v).toFixed(1); pen = true; }
      lines += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="' + (s.bold ? 2.6 : 1.7) + '"' + (s.dash ? ' stroke-dasharray="5 3"' : '') + '/>';
      if (s.moves) s.moves.forEach(function (m) {
        if (m.week < lo || m.week > hi || !fin(s.vals[m.week])) return;
        var up = m.chg > 0, cy = y(s.vals[m.week]);
        marks += '<path d="' + (up ? 'M' + x(m.week) + ' ' + (cy - 11) + ' l-5 9 h10z' : 'M' + x(m.week) + ' ' + (cy + 11) + ' l-5 -9 h10z') + '" fill="' + s.color + '" stroke="#fff"/><title>' + esc(s.name) + ' ' + sgn(m.chg) + ' week of ' + A.wkLabel(m.week) + '</title>';
      });
    });
    var stitch = '';
    if (o.stitch != null && o.stitch > lo && o.stitch < hi) stitch = '<line x1="' + x(o.stitch) + '" x2="' + x(o.stitch) + '" y1="' + PT + '" y2="' + (CH - PB) + '" stroke="#98A2B3" stroke-dasharray="2 4"/><text x="' + (x(o.stitch) + 4) + '" y="' + (PT + 24) + '" font-size="10" fill="#667085">price basis changes</text>';
    return '<div class="chartwrap" id="' + id + '"><svg viewBox="0 0 ' + CW + ' ' + CH + '" width="100%" role="img" aria-label="' + esc(o.aria || 'Line chart') + '">' + bands + g + stitch + lines + marks + ticks + '<rect class="hit" x="' + PL + '" y="' + PT + '" width="' + (CW - PL - PR) + '" height="' + (CH - PT - PB) + '" fill="transparent"/></svg><div class="tip"></div></div>';
  }
  function wireTip(id, o) {
    var el = $(id); if (!el) return;
    var svg = el.querySelector('svg'), tip = el.querySelector('.tip'), hit = el.querySelector('.hit');
    hit.onmousemove = function (e) {
      var r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * CW;
      var w = Math.max(o.lo, Math.min(o.hi, Math.round(o.lo + (px - PL) / (CW - PL - PR) * (o.hi - o.lo))));
      var ev = PRIME.filter(function (p) { return Math.abs(p.week - w) <= 1; })[0];
      tip.innerHTML = '<b>Week of ' + A.wkLabel(w) + '</b>' + (ev ? '<br><span style="color:#8A1FB8">' + esc(ev.label) + '</span>' : '') + o.series.map(function (s) {
        return '<br><span style="color:' + s.color + '">●</span> ' + esc(s.name) + ': <b>' + (fin(s.vals[w]) ? s.vals[w].toFixed(1) + (o.unit || '') : '—') + '</b>';
      }).join('');
      tip.style.display = 'block';
      var left = (e.clientX - r.left) + 14; if (left > r.width - 200) left = (e.clientX - r.left) - 200;
      tip.style.left = left + 'px'; tip.style.top = '8px';
    };
    hit.onmouseleave = function () { tip.style.display = 'none'; };
  }
  function spark(vals, lo, hi, base) {
    var w = 130, h = 26, v = [], i;
    for (i = lo; i <= hi; i++) if (fin(vals[i])) v.push(vals[i]);
    if (v.length < 3) return '<span class="muted">—</span>';
    var mn = Math.min.apply(null, v), mx = Math.max.apply(null, v); if (base != null) { mn = Math.min(mn, base); mx = Math.max(mx, base); } if (mx === mn) mx = mn + 1;
    var x = function (k) { return 1 + (k - lo) / (hi - lo) * (w - 2); }, y = function (val) { return 2 + (1 - (val - mn) / (mx - mn)) * (h - 4); };
    var bands = PRIME.map(function (e) { return e.week >= lo && e.week <= hi ? '<rect x="' + (x(e.week) - 2) + '" y="0" width="5" height="' + h + '" fill="#C231FF" fill-opacity=".2"/>' : ''; }).join('');
    var d = '', pen = false;
    for (i = lo; i <= hi; i++) { if (!fin(vals[i])) { pen = false; continue; } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(vals[i]).toFixed(1); pen = true; }
    return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' + bands + (base != null ? '<line x1="0" x2="' + w + '" y1="' + y(base) + '" y2="' + y(base) + '" stroke="#98A2B3" stroke-dasharray="2 2"/>' : '') + '<path d="' + d + '" fill="none" stroke="#1F22B2" stroke-width="1.5"/></svg>';
  }
  function legend(items) { return '<div class="legend">' + items.join('') + '</div>'; }
  var sw = function (c, t, dash) { return '<span><i style="background:' + c + (dash ? ';opacity:.6' : '') + '"></i>' + t + '</span>'; };
  var primeKey = '<span><span class="sw" style="background:#C231FF;opacity:.2"></span>Prime event week (±1)</span>';
  function statusPill(s) { var c = { 'Raised': 'bad', 'Cut': 'info', 'Stable': 'good', 'Stable, promotes often': 'warn', 'No read': 'plain' }[s] || 'plain'; return '<span class="pill ' + c + '">' + esc(s) + '</span>'; }

  var isGroup = function (b) { return b === 'Britax group' || b === 'All competitors'; };
  var shortName = function (b) { return b === 'Britax group' ? 'Britax (incl. Bob Gear)' : b; };
  function compBrands(si) { return A.brands(M, si).filter(function (b) { return !isGroup(b); }); }

  // ====================== view 1: trend ======================
  function viewTrend() {
    var si = state.seg, all = A.brands(M, si), rows = {}, first = {};
    all.forEach(function (b) {
      var t = A.trendSeries(M, si, b);
      rows[b] = { brand: b, t: t, st: A.stability(M, si, b), tr: A.tariffRow(M, si, b), moves: A.findMoves(t.vals) };
    });
    var comps = all.filter(function (b) { return !isGroup(b); });
    var bx = rows['Britax group'], cx = rows['All competitors'];
    var stableNames = comps.filter(function (b) { return rows[b].st && /^Stable/.test(rows[b].st.status); });
    var steady = comps.filter(function (b) { return rows[b].st && rows[b].st.status === 'Stable'; });
    var raised = comps.filter(function (b) { return rows[b].tr && rows[b].tr.rise != null && rows[b].tr.rise >= 5 && rows[b].tr.cov >= 40; });
    var movedNow = comps.filter(function (b) { return rows[b].st && (rows[b].st.status === 'Raised' || rows[b].st.status === 'Cut'); });
    var ans = '<div class="answer">';
    ans += '<p><b>Who raised price?</b> ' + (raised.length ? raised.map(function (b) { return esc(b) + ' ' + sgn(rows[b].tr.rise, 0); }).join(', ') + ' (Jan to Jun 2025, same products).' : 'No tracked competitor raised price by 5% or more over Jan to Jun 2025 on like-for-like products.') + (bx.tr && bx.tr.rise != null ? ' Britax: ' + sgn(bx.tr.rise, 0) + '.' : '') + '</p>';
    ans += '<p><b>Stable in the last 6 months (Prime weeks excluded):</b> ' + (stableNames.length ? stableNames.map(function (b) { return esc(b) + (rows[b].st.status === 'Stable' ? '' : ' (promotes often)'); }).join(', ') : 'none') + '. <b>Still moving:</b> ' + (movedNow.length ? movedNow.map(function (b) { return esc(b) + ' ' + sgn(rows[b].st.net, 0); }).join(', ') : 'none') + '.</p>';
    ans += '<p><b>Britax:</b> ' + (bx.st ? statusPill(bx.st.status) + ' (' + sgn(bx.st.net) + ' over 6 months) vs all competitors combined ' + sgn(cx.st && cx.st.net) + '.' : 'No read.') + '</p></div>';

    var series = [
      { name: 'Britax (incl. Bob Gear)', color: BRITAX, bold: true, vals: bx.t.vals, moves: bx.moves.filter(function (m) { return m.week >= 5; }) },
      { name: 'All competitors combined', color: COMP_ALL, bold: true, vals: cx.t.vals, moves: cx.moves }
    ];
    comps.forEach(function (b, i) { if (state.overlay[b]) series.push({ name: b, color: COLORS[i % COLORS.length], vals: rows[b].t.vals, moves: rows[b].moves, dash: false }); });
    var cOpts = { lo: 0, hi: LAST, series: series, tariff: true, base: 100, stitch: R0, aria: 'Weekly same-product price index', unit: '' };

    var h = '<section class="card"><h2>Who raised price, and who is stable now</h2><p class="sub">' + esc(SEG[si]) + '</p>' + ans;
    h += '<h3>Price index, same products (Oct–Dec 2024 = 100)</h3>';
    h += legend([sw(BRITAX, 'Britax'), sw(COMP_ALL, 'All competitors combined'), '<span><span class="sw" style="background:#EAF4FF;border:1px solid #cfe3f7"></span>Tariff period Jan–Jun 2025</span>', primeKey, '<span>▲ ▼ price move of 5% or more</span>']);
    h += comps.length ? '<div class="legend">Add a competitor: ' + comps.map(function (b, i) { return '<label><input type="checkbox" data-ov="' + esc(b) + '"' + (state.overlay[b] ? ' checked' : '') + '> <span style="color:' + COLORS[i % COLORS.length] + '">●</span> ' + esc(b) + '</label>'; }).join('') + '</div>' : '';
    h += lineChart('c1', cOpts);
    h += '<p class="rule">Dips inside the purple bands are Prime event deals, not list price changes. Before ' + A.wkLabel(R0) + ' the line uses the Q4 2024 basket; after it, the 12-month basket rescaled to match. Brands with too few matching products stop at the basis change.</p></section>';

    h += '<section class="card"><h2>Price behaviour by brand</h2><p class="sub">Tariff change is Jan to Jun 2025 on like-for-like products. Last 6 months compares the first and last six clean weeks, with Prime weeks left out.</p><div class="scroll"><table class="tbl" id="t1"></table></div>' + csvBtn('t1') + '</section>';
    h += '<section class="card"><h2>Average price on promotion vs off promotion</h2><p class="sub">Last 12 months, ' + esc(SEG[si]) + '. A product is on promotion in a week when its price is 5% or more below its own 12-month median. Averages are weighted by units sold.</p><div class="scroll"><table class="tbl" id="t2"></table></div>' + csvBtn('t2') + '<p class="rule">Promo depth compares the same products on promotion with their own baseline, so it is not affected by which products sold.</p></section>';
    h += '<section class="card"><h2>Brand price ladder</h2><p class="sub">' + esc(SEG[si]) + ' · 12-month average selling price by brand (weeks of ' + A.wkLabel(R0) + ' to ' + A.wkLabel(LAST) + '). Select a column to sort.</p><div class="scroll"><table class="tbl" id="t9"></table></div>' + csvBtn('t9') + '<p class="rule">Last 13 weeks vs the 13 weeks before. Unit share is of all tracked brands in the segment. Average selling price mixes products, so a change can come from mix as well as price.</p></section>';
    $('view').innerHTML = h;

    wireTip('c1', cOpts);
    Array.prototype.forEach.call(document.querySelectorAll('[data-ov]'), function (cb) { cb.onchange = function () { state.overlay[cb.dataset.ov] = cb.checked; viewTrend(); }; });
    var tr = all.map(function (b) {
      var r = rows[b];
      return { _cls: b === 'Britax group' ? 'me' : b === 'All competitors' ? 'all' : '', brand: shortName(b), rise: r.tr && r.tr.cov >= 40 ? r.tr.rise : null, net: r.st && r.st.net, vol: r.st && r.st.vol, dips: r.st && r.st.dips, weeks: r.st && r.st.weeks, moves: r.moves.length, status: r.st ? r.st.status : 'No read', vals: r.t.vals };
    });
    table($('t1'), 't1', [
      { key: 'brand', label: 'Brand', l: 1 },
      { key: 'rise', label: 'Tariff change Jan→Jun 2025', render: function (r) { return '<span class="' + cls(r.rise) + '">' + sgn(r.rise) + '</span>'; }, csv: function (r) { return r.rise; } },
      { key: 'net', label: 'Last 6 months, net', render: function (r) { return '<span class="' + cls(r.net) + '">' + sgn(r.net) + '</span>'; }, csv: function (r) { return r.net; } },
      { key: 'vol', label: 'Weekly swing (st. dev., pts)', render: function (r) { return f1(r.vol); } },
      { key: 'dips', label: 'Weeks 5%+ below baseline', render: function (r) { return r.dips == null ? '—' : r.dips + ' of ' + r.weeks; }, csv: function (r) { return r.dips; } },
      { key: 'moves', label: 'Moves of 5%+' },
      { key: 'status', label: 'Last 6 months', render: function (r) { return statusPill(r.status); } },
      { key: 'spark', label: 'Trend', render: function (r) { return spark(r.vals, R0, LAST, null); }, sort: function () { return null; }, csv: function () { return ''; } }
    ], tr);
    var pr = all.map(function (b) { var p = A.promoPrices(M, si, b); return { _cls: b === 'Britax group' ? 'me' : b === 'All competitors' ? 'all' : '', brand: shortName(b), p: p }; });
    var pcol = function (key, label, f, fmt) { return { key: key, label: label, render: function (r) { return fmt(r.p && r.p[f]); }, sort: function (r) { return r.p && r.p[f]; }, csv: function (r) { return r.p && r.p[f]; } }; };
    table($('t2'), 't2', [
      { key: 'brand', label: 'Brand', l: 1 },
      pcol('off', 'Avg price, not on promo', 'off', usd),
      pcol('on', 'Avg price, on promo', 'on', usd),
      { key: 'gap', label: 'Price on promo vs not', render: function (r) { return '<span class="' + cls(r.p && r.p.gap) + '">' + sgn(r.p && r.p.gap) + '</span>'; }, sort: function (r) { return r.p && r.p.gap; }, csv: function (r) { return r.p && r.p.gap; } },
      { key: 'depth', label: 'Avg promo depth vs own baseline', render: function (r) { return '<b class="' + (r.p && r.p.depth > 0 ? 'down' : '') + '">' + (r.p && fin(r.p.depth) ? '−' + r.p.depth.toFixed(1) + '%' : '—') + '</b>'; }, sort: function (r) { return r.p && r.p.depth; }, csv: function (r) { return r.p && r.p.depth; } }
    ], pr);
    drawLadder('t9', si);
  }

  function drawLadder(id, si) {
    var rows = A.ladderRows(M, si), mx = Math.max.apply(null, rows.map(function (r) { return r.asp; }));
    rows.forEach(function (r) { r._cls = r.brand === 'Britax' ? 'me' : ''; });
    table($(id), id, [
      { key: 'brand', label: 'Brand', l: 1 },
      { key: 'units', label: 'Est. units', render: function (r) { return num(r.units); } },
      { key: 'share', label: 'Unit share', render: function (r) { return fin(r.share) ? r.share.toFixed(1) + '%' : '—'; } },
      { key: 'asp', label: '52-wk ASP', render: function (r) { return '<span style="display:inline-block;height:8px;border-radius:4px;vertical-align:middle;margin-right:8px;width:' + Math.round(r.asp / mx * 110) + 'px;background:' + (r.brand === 'Britax' ? BRITAX : '#5AAFFE') + '"></span>' + usd(r.asp); }, sort: function (r) { return r.asp; }, csv: function (r) { return r.asp; } },
      { key: 'now', label: 'Last 13 wks', render: function (r) { return usd(r.now); } },
      { key: 'prior', label: 'Prior 13 wks', render: function (r) { return usd(r.prior); } },
      { key: 'chg', label: 'Change', render: function (r) { return '<span class="' + cls(r.chg) + '">' + sgn(r.chg) + '</span>'; } },
      { key: 'vsB', label: 'Price vs Britax', render: function (r) { return r.brand === 'Britax' ? '—' : '<span class="' + cls(r.vsB) + '">' + sgn(r.vsB, 0) + '</span>'; } }
    ], rows);
  }

  // ====================== view 2: promotions ======================
  function viewPromo() {
    var si = state.seg;
    var segRows = [0, 1, 2, 3, 4, 5].map(function (s) {
      return { s: s, name: SEG[s], b: A.promoPrices(M, s, 'Britax group'), c: A.promoPrices(M, s, 'All competitors'), bs: A.promoStats(M, s, 'Britax group'), cs: A.promoStats(M, s, 'All competitors') };
    });
    var cur = segRows[si];
    var depthTxt = function (p) { return p && fin(p.depth) ? '−' + p.depth.toFixed(1) + '%' : '—'; };
    var ans = '<div class="answer"><p><b>' + esc(SEG[si]) + ':</b> Britax averaged <b>' + usd(cur.b && cur.b.off) + '</b> off promotion and <b>' + usd(cur.b && cur.b.on) + '</b> on promotion (promo depth <b>' + depthTxt(cur.b) + '</b> vs its own baseline). Competitors combined: <b>' + usd(cur.c && cur.c.off) + '</b> and <b>' + usd(cur.c && cur.c.on) + '</b> (depth <b>' + depthTxt(cur.c) + '</b>).</p></div>';
    var h = '<section class="card"><h2>Promotions against a 12-month baseline</h2><p class="sub">Baseline = each product’s own median weekly price over the last 52 weeks (' + A.wkLabel(R0) + ' to ' + A.wkLabel(LAST) + '). A product is on promotion in a week when its price is 5% or more below baseline. Averages are weighted by units sold.</p>' + ans;
    h += '<h3>Britax vs competitors by segment</h3><div class="scroll"><table class="tbl" id="t3"></table></div>' + csvBtn('t3') + '<p class="rule">Select a segment name to see its brands below.</p></section>';
    h += '<section class="card"><h2>By brand: ' + esc(SEG[si]) + '</h2><div class="scroll"><table class="tbl" id="t4"></table></div>' + csvBtn('t4') + '<p class="rule">Sparkline: weekly price vs the 12-month baseline (dashed); purple marks Prime weeks.</p></section>';
    var bs = A.brands(M, si).filter(function (b) { return b !== 'All competitors'; });
    var bx = M.r12[si]['Britax group'].idx, extra = [];
    for (var w = R0; w <= LAST; w++) if (fin(bx[w]) && bx[w] <= 95 && !A.primeWeek(w)) extra.push(w);
    var series = bs.map(function (b, i) { return { name: shortName(b), color: b === 'Britax group' ? BRITAX : COLORS[i % COLORS.length], bold: b === 'Britax group', vals: A.shareSeries(M, si, b) }; });
    var cOpts = { lo: R0, hi: LAST, series: series, aria: 'Weekly unit share, last 12 months', unit: '%', floor0: true, extra: extra };
    h += '<section class="card"><h2>Market share, last 12 months</h2><p class="sub">' + esc(SEG[si]) + ' · weekly unit share of tracked brands. Purple bands are Prime event weeks; orange bands are other weeks when Britax itself was on promotion.</p>';
    h += legend(series.map(function (s) { return sw(s.color, esc(s.name)); }).concat([primeKey, '<span><span class="sw" style="background:#F79009;opacity:.3"></span>Britax on promo (non-Prime)</span>']));
    h += lineChart('c3', cOpts) + '</section>';
    $('view').innerHTML = h;
    wireTip('c3', cOpts);
    var grp = function (key, label, f, g) { return [
      { key: key + 'o', label: label + ': avg price, not on promo', render: function (r) { return usd(f(r) && f(r).off); }, sort: function (r) { return f(r) && f(r).off; }, csv: function (r) { return f(r) && f(r).off; } },
      { key: key + 'n', label: label + ': avg price, on promo', render: function (r) { return usd(f(r) && f(r).on); }, sort: function (r) { return f(r) && f(r).on; }, csv: function (r) { return f(r) && f(r).on; } },
      { key: key + 'd', label: label + ': promo depth', render: function (r) { return '<b class="' + (f(r) && f(r).depth > 0 ? 'down' : '') + '">' + depthTxt(f(r)) + '</b>'; }, sort: function (r) { return f(r) && f(r).depth; }, csv: function (r) { return f(r) && f(r).depth; } }]; };
    table($('t3'), 't3', [{ key: 'name', label: 'Segment', l: 1, render: function (r) { return '<a href="#" data-seg="' + r.s + '" onclick="return false">' + esc(r.name) + '</a>'; }, csv: function (r) { return r.name; } }]
      .concat(grp('b', 'Britax', function (r) { return r.b; })).concat(grp('c', 'Competitors', function (r) { return r.c; })), segRows.map(function (r) { r._cls = r.s === si ? 'me' : ''; return r; }));
    var brs = A.brands(M, si).map(function (b) { return { _cls: b === 'Britax group' ? 'me' : b === 'All competitors' ? 'all' : '', brand: shortName(b), p: A.promoPrices(M, si, b), st: A.promoStats(M, si, b), idx: M.r12[si][b].idx }; });
    table($('t4'), 't4', [{ key: 'brand', label: 'Brand', l: 1 }].concat(grp('x', 'Price', function (r) { return r.p; }).map(function (c) { c.label = c.label.replace('Price: ', ''); return c; })).concat([
      { key: 'vs', label: 'Avg price vs baseline', render: function (r) { return '<span class="' + cls(r.st && r.st.vs) + '">' + sgn(r.st && r.st.vs) + '</span>'; }, sort: function (r) { return r.st && r.st.vs; }, csv: function (r) { return r.st && r.st.vs; } },
      { key: 'spark', label: 'Weekly price vs baseline', render: function (r) { return spark(r.idx, R0, LAST, 100); }, sort: function () { return null; }, csv: function () { return ''; } }
    ]), brs);
  }

  // ====================== view 3: key products ======================
  var CAT_SALES = [['Convertible car seats', 14.6], ['Booster car seats', 8.52], ['Double strollers', 5.41], ['Strollers (other)', 5.0], ['Travel systems', 2.82], ['Infant car seats', 0.89], ['Other categories (14)', 2.46]];
  function viewSkus() {
    var si = state.seg;
    var mine = A.skuRows(M, si, true), comp = A.skuRows(M, si, false);
    var h = '<section class="card"><h2>Key competitor products</h2><p class="sub">The four largest Britax categories (top 20% of 20) make up about 85% of Britax est. sales over the last 52 weeks. For each, the best-selling Britax products and the best-selling competitor products, priced against their own 12-month baseline.</p>';
    var rb = M.range[si] && M.range[si].B, rc = M.range[si] && M.range[si].C;
    h += '<div class="answer"><p>' + esc(SEG[si]) + ': ' + (rb && rc ? 'median product price <b>' + usd(rb.med) + '</b> for Britax vs <b>' + usd(rc.med) + '</b> for competitors; promoted units over the last 13 weeks <b>' + rb.p13.toFixed(0) + '%</b> vs <b>' + rc.p13.toFixed(0) + '%</b>. ' : '') + (function () {
      var on = comp.filter(function (r) { return r.flags.indexOf('On promo now') >= 0; }).length;
      return on + ' of ' + comp.length + ' tracked competitor products are priced 5% or more below their baseline now (weeks 98–101).';
    })() + '</p></div>';
    h += '<h3>Price range and promotion by segment</h3><div class="scroll"><table class="tbl" id="t10"></table></div>' + csvBtn('t10') + '<p class="rule">Low, median and high are the 12-month average selling prices of products that sold 100+ units. Promoted units = share of units sold 5% or more below the product’s own 12-month median price. Segments with few Britax products (for example double strollers) give a narrow range.</p>';
    h += '<h3>Britax products</h3><div class="scroll"><table class="tbl" id="t5"></table></div>' + csvBtn('t5');
    h += '<h3>Competitor products</h3><div class="scroll"><table class="tbl" id="t6"></table></div>' + csvBtn('t6');
    h += '<p class="rule">Price now = average of the latest four weeks. “Weeks on promo” counts weeks at least 5% below baseline. Recent promotions look at the last 13 weeks. The tables cover the best-selling products (up to 5 Britax, 15 competitor) by units.</p></section>';
    h += '<section class="card"><h2>Why these four categories</h2><p class="sub">Britax est. sales, last 52 weeks, $M</p><div class="scroll"><table class="tbl" id="t7"></table></div></section>';
    $('view').innerHTML = h;
    var cols = [
      { key: 'brand', label: 'Brand', l: 1 },
      { key: 'title', label: 'Product', l: 1, wrap: 1, render: function (r) { return esc(r.title) + '<div class="muted" style="font-size:12px">' + esc(r.asin) + '</div>'; }, csv: function (r) { return r.title; } },
      { key: 'u13', label: 'Units/wk', render: function (r) { return num(r.u13); } },
      { key: 'base', label: '12-month baseline', render: function (r) { return usd(r.base); } },
      { key: 'cur', label: 'Price now', render: function (r) { return usd(r.cur); } },
      { key: 'vs', label: 'Now vs baseline', render: function (r) { return '<span class="' + cls(r.vs) + '">' + sgn(r.vs) + '</span>'; } },
      { key: 'lo', label: 'Low–high', render: function (r) { return usd(r.lo) + '–' + usd(r.hi); }, sort: function (r) { return r.hi - r.lo; }, csv: function (r) { return usd(r.lo) + '-' + usd(r.hi); } },
      { key: 'promoWk', label: 'Weeks on promo', render: function (r) { return r.promoWk + ' of ' + r.weeks; } },
      { key: 'recent', label: 'Promo weeks, last 13', render: function (r) { return r.recentWk + ' of ' + r.recentOf; }, sort: function (r) { return r.recentWk; }, csv: function (r) { return r.recentWk; } },
      { key: 'deep', label: 'Deepest recent promo', render: function (r) { return r.deepest == null ? '—' : '−' + r.deepest.toFixed(0) + '%'; }, sort: function (r) { return r.deepest; }, csv: function (r) { return r.deepest; } },
      { key: 'last', label: 'Last on promo', render: function (r) { return r.lastPromo == null ? '—' : esc(A.wkLabel(r.lastPromo).replace(/, \d{4}/, '')); }, sort: function (r) { return r.lastPromo; }, csv: function (r) { return r.lastPromo == null ? '' : A.wkLabel(r.lastPromo); } },
      { key: 'spark', label: 'Weekly price', render: function (r) { return spark(r.price, R0, LAST, r.base); }, sort: function () { return null; }, csv: function () { return ''; } },
      { key: 'flags', label: 'Status', render: function (r) { return r.flags.map(function (f) { return '<span class="pill ' + (f === 'On promo now' ? 'warn' : f === 'Promotes often' ? 'info' : f === 'Priced above baseline' ? 'bad' : 'good') + '">' + f + '</span>'; }).join(' '); }, sort: function (r) { return r.vs; }, csv: function (r) { return r.flags.join('; '); } }
    ];
    mine.forEach(function (r) { r._cls = 'me'; });
    table($('t5'), 't5', cols, mine); table($('t6'), 't6', cols, comp);
    var rg = [];
    CORE.forEach(function (sg) { ['B', 'C'].forEach(function (k) { var r = M.range[sg] && M.range[sg][k]; if (r) rg.push({ _cls: k === 'B' ? 'me' : '', seg: SEG[sg], who: k === 'B' ? 'Britax' : 'Competitors', n: r.n, lo: r.lo, med: r.med, hi: r.hi, p52: r.p52, p13: r.p13 }); }); });
    table($('t10'), 't10', [
      { key: 'seg', label: 'Segment', l: 1 }, { key: 'who', label: 'Own / competitor', l: 1 },
      { key: 'n', label: 'Products' },
      { key: 'lo', label: 'Low', render: function (r) { return usd(r.lo); } },
      { key: 'med', label: 'Median', render: function (r) { return usd(r.med); } },
      { key: 'hi', label: 'High', render: function (r) { return usd(r.hi); } },
      { key: 'p52', label: '% of units on promo, 12 months', render: function (r) { return r.p52.toFixed(0) + '%'; } },
      { key: 'p13', label: '% of units on promo, last 13 weeks', render: function (r) { return r.p13.toFixed(0) + '%'; } }
    ], rg);
    var tot = CAT_SALES.reduce(function (s, r) { return s + r[1]; }, 0);
    var cats = CAT_SALES.map(function (r, i) { return { name: r[0], v: r[1], sh: r[1] / tot * 100, top: i < 4 }; });
    cats.push({ _cls: 'all', name: 'Total', v: tot, sh: 100, top: false });
    table($('t7'), 't7', [
      { key: 'name', label: 'Category', l: 1 },
      { key: 'v', label: '$M', render: function (r) { return r.v.toFixed(1); } },
      { key: 'sh', label: 'Share of Britax sales', render: function (r) { return r.sh.toFixed(0) + '%'; } },
      { key: 'top', label: 'In top 20%', render: function (r) { return r.top ? '<span class="pill good">Yes</span>' : ''; }, sort: function (r) { return r.top ? 1 : 0; } }
    ], cats);
  }

  // ====================== view 4: share ======================
  function readPill(dd, da) {
    if (!fin(dd)) return '<span class="pill plain">No read</span>';
    var T = 0.3, c, t;
    if (dd >= T && fin(da) && da >= T) { c = 'good'; t = 'Gains and keeps it'; }
    else if (dd >= T) { c = 'warn'; t = fin(da) ? 'Gains, then gives back' : 'Gains during'; }
    else if (fin(da) && da >= T) { c = 'info'; t = 'Gains after'; }
    else if (dd <= -T) { c = 'bad'; t = 'Loses during'; }
    else { c = 'plain'; t = 'Little change'; }
    return '<span class="pill ' + c + '">' + t + '</span>';
  }
  function gcls(v) { return !fin(v) ? '' : v > 0.049 ? 'down' : v < -0.049 ? 'up' : ''; }
  function viewShare() {
    var si = state.seg, bs = A.brands(M, si).filter(function (b) { return b !== 'All competitors'; });
    var LO = 80, ss = {}; bs.forEach(function (b) { ss[b] = A.shareSeries(M, si, b); });
    var chg = bs.map(function (b) { var c = A.shareChange(M, si, b); return { _cls: b === 'Britax group' ? 'me' : '', brand: shortName(b), was: c.was, now: c.now, d: c.d }; });
    var gainers = chg.filter(function (r) { return r.brand.indexOf('Britax') < 0 && fin(r.d) && r.d >= 0.3; }).sort(function (a, b) { return b.d - a.d; });
    var bc = chg.filter(function (r) { return r.brand.indexOf('Britax') === 0; })[0];
    var series = bs.map(function (b, i) { return { name: shortName(b), color: b === 'Britax group' ? BRITAX : COLORS[i % COLORS.length], bold: b === 'Britax group', vals: ss[b] }; }).filter(function (s) { return s.vals.slice(LO).some(fin); });
    var h = '<section class="card"><h2>Share around Prime days</h2><p class="sub">' + esc(SEG[si]) + ' · unit share of tracked brands in the segment, weekly, last 6 months</p>';
    h += '<div class="answer"><p><b>Britax:</b> ' + (bc ? f1(bc.was) + '% → ' + f1(bc.now) + '% (' + pts(bc.d) + ') between the first and last six clean weeks.' : 'No read.') + ' <b>Gaining share:</b> ' + (gainers.length ? gainers.slice(0, 3).map(function (r) { return esc(r.brand) + ' ' + pts(r.d); }).join(', ') : 'no competitor gained 0.3 pts or more') + '.</p></div>';
    var cOpts = { lo: LO, hi: LAST, series: series, aria: 'Weekly unit share', unit: '%', floor0: true };
    h += legend(series.map(function (s) { return sw(s.color, esc(s.name)); }).concat([primeKey]));
    h += lineChart('c2', cOpts) + '</section>';
    h += '<section class="card"><h2>Six-month change</h2><p class="sub">Average share in weeks of ' + A.wkLabel(80) + '–' + A.wkLabel(85) + ' vs ' + A.wkLabel(96) + '–' + A.wkLabel(101) + ', Prime weeks left out.</p><div class="scroll"><table class="tbl" id="t8"></table></div>' + csvBtn('t8') + '</section>';
    PRIME.filter(function (e) { return e.week >= LO; }).forEach(function (e, i) {
      var prov = e.week + 3 > LAST;
      h += '<section class="card"><h2>' + esc(e.label) + '</h2><p class="sub">Promo columns: price in the event week vs each brand’s 12-month baseline; on promo = 5% or more below. Before = 3 weeks before the event · during = event week · after = ' + (prov ? 'the week after (provisional: later weeks are not in yet)' : 'the 3 weeks after') + '</p><div class="scroll"><table class="tbl" id="te' + i + '"></table></div>' + csvBtn('te' + i) + '</section>';
    });
    $('view').innerHTML = h;
    wireTip('c2', cOpts);
    var pc = function (k) { return { key: k, label: k, render: function (r) { return fin(r[k]) ? f1(r[k]) + '%' : '—'; }, csv: function (r) { return r[k]; } }; };
    table($('t8'), 't8', [{ key: 'brand', label: 'Brand', l: 1 }, { key: 'was', label: 'Earlier', render: function (r) { return fin(r.was) ? f1(r.was) + '%' : '—'; } }, { key: 'now', label: 'Latest', render: function (r) { return fin(r.now) ? f1(r.now) + '%' : '—'; } },
      { key: 'd', label: 'Change', render: function (r) { return '<b class="' + gcls(r.d) + '">' + pts(r.d) + '</b>'; }, csv: function (r) { return r.d; } }], chg);
    PRIME.filter(function (e) { return e.week >= LO; }).forEach(function (e, i) {
      var rows = bs.map(function (b) { var s = A.shareEvent(M, si, b, e.week); return { _cls: b === 'Britax group' ? 'me' : '', brand: shortName(b), before: s.before, during: s.during, after: s.after, dd: s.dDuring, da: s.after == null ? null : s.dAfter, ix: M.r12[si][b].idx[e.week] }; });
      table($('te' + i), 'te' + i, [{ key: 'brand', label: 'Brand', l: 1 },
        { key: 'before', label: 'Before', render: function (r) { return fin(r.before) ? f1(r.before) + '%' : '—'; } },
        { key: 'during', label: 'During', render: function (r) { return fin(r.during) ? f1(r.during) + '%' : '—'; } },
        { key: 'after', label: 'After', render: function (r) { return fin(r.after) ? f1(r.after) + '%' : '—'; } },
        { key: 'dd', label: 'During vs before', render: function (r) { return '<span class="' + gcls(r.dd) + '">' + pts(r.dd) + '</span>'; }, csv: function (r) { return r.dd; } },
        { key: 'da', label: 'After vs before', render: function (r) { return '<span class="' + gcls(r.da) + '">' + pts(r.da) + '</span>'; }, csv: function (r) { return r.da; } },
        { key: 'promo', label: 'On promo in event week?', render: function (r) { return !fin(r.ix) ? '—' : r.ix <= 95 ? '<span class="pill warn">Yes</span>' : '<span class="pill plain">No</span>'; }, sort: function (r) { return fin(r.ix) ? 100 - r.ix : null; }, csv: function (r) { return !fin(r.ix) ? '' : r.ix <= 95 ? 'Yes' : 'No'; } },
        { key: 'depth', label: 'Promo depth vs 12-month baseline', render: function (r) { return !fin(r.ix) ? '—' : r.ix < 100 ? '<span class="' + (r.ix <= 95 ? 'down' : '') + '">−' + (100 - r.ix).toFixed(1) + '%</span>' : '+' + (r.ix - 100).toFixed(1) + '%'; }, sort: function (r) { return fin(r.ix) ? 100 - r.ix : null; }, csv: function (r) { return fin(r.ix) ? 100 - r.ix : ''; } },
        { key: 'read', label: 'Read', render: function (r) { return readPill(r.dd, r.da); }, sort: function (r) { return r.dd; }, csv: function (r) { return ''; } }], rows);
    });
  }

  // ====================== method ======================
  function renderMethod() {
    $('method').innerHTML = '<h2>How to read this</h2><ul class="notes">' +
      '<li><b>Source:</b> weekly Amazon US Market Share estimates (units, sales, average price) for the Britax group (Britax and Bob Gear) and tracked competitors.</li>' +
      '<li><b>Price index:</b> same products only, so mix shifts do not look like price changes. 100 = Oct–Dec 2024 on non-deal weeks. From ' + A.wkLabel(R0) + ' the index is built on the last 12 months and rescaled to the earlier line, so the “price basis changes” marker is a join, not a price move.</li>' +
      '<li><b>Promotion:</b> a price at least 5% below the product’s own median weekly price over the last 52 weeks.</li>' +
      '<li><b>Average price on and off promotion:</b> unit-weighted average selling price of products in weeks they were on promotion vs weeks they were not. Different products sell in each group, so use promo depth (same products against their own baseline) for the size of the discount.</li>' +
      '<li><b>Price ladder:</b> 12-month average selling price by brand (sales ÷ units), last 13 weeks vs the 13 before. Top 10 brands by units plus Britax.</li>' +
      '<li><b>Prime weeks:</b> the event week plus the week before and after. June events: Prime Day Jun 2026. July 2025 stands in for June 2025 because there was no June event. October: Prime Big Deal Days 2025 and 2026. Excluded from stability reads, along with the two weeks before and Black Friday weeks.</li>' +
      '<li><b>Price moves of 5%+:</b> the next four clean weeks average at least 5% away from the prior four, and the move holds 4–7 weeks later. Recent moves marked “too recent to tell”.</li>' +
      '<li><b>Stability, last 6 months:</b> Raised or Cut if the net change is 3% or more; “Stable, promotes often” if four or more clean weeks sit 5% below baseline or the weekly swing is 3 pts or more.</li>' +
      '<li><b>Share:</b> brand units ÷ units of all tracked brands in the segment. Estimates, so read small moves (under 0.3 pts) as noise.</li>' +
      '<li><b>Limits:</b> estimates, not reported sales. Brands with too few matching products lack a long trend. The latest Prime event has few weeks after it.</li></ul>';
  }

  function render() { sync(); drawTabs(); ({ trend: viewTrend, promo: viewPromo, skus: viewSkus, share: viewShare })[state.view](); }
  renderMethod();
  render();
})();
