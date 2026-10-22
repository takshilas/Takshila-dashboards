// Britax US pricing and share dashboard. Renders from precomputed tables (private/data-*.js); nothing is queried in the browser.
(function () {
  var A = window.BritaxAnalytics;
  var M = A.parse({ basket: window.BRITAX_BASKET, tariff: window.BRITAX_TARIFF, r12: window.BRITAX_R12, skus: window.BRITAX_SKUS });
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
  var state = { view: VIEWS.some(function (v) { return v.id === q.get('view'); }) ? q.get('view') : 'trend', seg: clampInt(q.get('seg'), 0, 5, 0), overlay: {}, movesAll: false };
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
    h += '<section class="card"><h2>Price changes of 5% or more</h2><div class="controls"><label>Show <select id="mv"><option value="0">Last 6 months</option><option value="1"' + (state.movesAll ? ' selected' : '') + '>Whole period</option></select></label></div><div class="scroll"><table class="tbl" id="t2"></table></div>' + csvBtn('t2') + '</section>';
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
    function drawMoves() {
      var out = [];
      all.forEach(function (b) { rows[b].moves.forEach(function (m) { if (b === 'Britax group' && m.week < 5) return; if (state.movesAll || m.week >= 80) out.push({ _cls: b === 'Britax group' ? 'me' : b === 'All competitors' ? 'all' : '', brand: shortName(b), week: m.week, chg: m.chg, confirmed: m.confirmed, when: A.wkLabel(m.week), inTariff: m.week >= A.TARIFF[0] && m.week <= A.TARIFF[1] }); }); });
      out.sort(function (a, b) { return b.week - a.week; });
      if (!out.length) { $('t2').innerHTML = '<tbody><tr><td class="l muted">No moves of 5% or more in this window.</td></tr></tbody>'; return; }
      table($('t2'), 't2', [
        { key: 'brand', label: 'Brand', l: 1 },
        { key: 'week', label: 'Week of', render: function (r) { return esc(r.when); }, csv: function (r) { return r.when; } },
        { key: 'chg', label: 'Change', render: function (r) { return '<b class="' + cls(r.chg) + '">' + sgn(r.chg) + '</b>'; }, csv: function (r) { return r.chg; } },
        { key: 'inTariff', label: 'Period', render: function (r) { return r.inTariff ? '<span class="pill info">Tariff period</span>' : '<span class="pill plain">Outside tariff period</span>'; }, sort: function (r) { return r.inTariff ? 1 : 0; }, csv: function (r) { return r.inTariff ? 'Tariff period' : 'Outside'; } },
        { key: 'confirmed', label: 'Held 4–7 weeks later?', render: function (r) { return r.confirmed ? 'Yes' : '<span class="muted">Too recent to tell</span>'; }, sort: function (r) { return r.confirmed ? 1 : 0; }, csv: function (r) { return r.confirmed ? 'Yes' : 'Too recent'; } }
      ], out);
    }
    drawMoves();
    $('mv').onchange = function () { state.movesAll = this.value === '1'; drawMoves(); };
  }

  // ====================== view 2: promotions ======================
  function viewPromo() {
    var si = state.seg;
    var segRows = [0, 1, 2, 3, 4, 5].map(function (s) {
      var b = A.promoStats(M, s, 'Britax group'), c = A.promoStats(M, s, 'All competitors');
      return { s: s, name: SEG[s], b: b, c: c };
    });
    var cur = segRows[si];
    var gap = function (p) { return p && fin(p.prime) && fin(p.normal) ? p.prime - p.normal : null; };
    var pc0 = function (v) { return fin(v) ? v.toFixed(0) + '%' : '—'; };
    var ans = '<div class="answer"><p><b>' + esc(SEG[si]) + ':</b> over the last 12 months Britax sold at an average price <b>' + sgn(cur.b && cur.b.vs) + '</b> against its own 12-month baseline; competitors combined <b>' + sgn(cur.c && cur.c.vs) + '</b>.</p>';
    ans += '<p>Share of units sold on promotion: Britax <b>' + pc0(cur.b && cur.b.prime) + '</b> in Prime weeks vs <b>' + pc0(cur.b && cur.b.normal) + '</b> in other weeks; competitors <b>' + pc0(cur.c && cur.c.prime) + '</b> vs <b>' + pc0(cur.c && cur.c.normal) + '</b>.</p></div>';
    var h = '<section class="card"><h2>Promotions against a 12-month baseline</h2><p class="sub">Baseline = each product’s own median weekly price over the last 52 weeks (' + A.wkLabel(R0) + ' to ' + A.wkLabel(LAST) + '). A promotion is a price at least 5% below baseline. Promo share is the percent of units sold at that price. Averages are weighted by units.</p>' + ans;
    h += '<h3>Britax vs competitors by segment</h3><div class="scroll"><table class="tbl" id="t3"></table></div>' + csvBtn('t3') + '<p class="rule">Select a segment name to see its brands below.</p></section>';
    h += '<section class="card"><h2>By brand: ' + esc(SEG[si]) + '</h2><div class="scroll"><table class="tbl" id="t4"></table></div>' + csvBtn('t4') + '<p class="rule">Sparkline: weekly share of units sold on promotion, dashed line is the 12-month average; purple marks Prime weeks. Prime lift = Prime weeks minus other weeks, in points.</p></section>';
    $('view').innerHTML = h;
    var side = function (key, label, f) { return [{ key: key + 'v', label: label + ': vs baseline', render: function (r) { var p = f(r); return '<span class="' + cls(p && p.vs) + '">' + sgn(p && p.vs) + '</span>'; }, sort: function (r) { var p = f(r); return p && p.vs; }, csv: function (r) { var p = f(r); return p && p.vs; } },
      { key: key + 'g', label: label + ': units on promo, Prime weeks', render: function (r) { var p = f(r); return pc0(p && p.prime); }, sort: function (r) { var p = f(r); return p && p.prime; }, csv: function (r) { var p = f(r); return p && p.prime; } },
      { key: key + 'n', label: label + ': units on promo, other weeks', render: function (r) { var p = f(r); return pc0(p && p.normal); }, sort: function (r) { var p = f(r); return p && p.normal; }, csv: function (r) { var p = f(r); return p && p.normal; } },
      { key: key + 'w', label: label + ': other weeks with 25%+ of units on promo', render: function (r) { var p = f(r); return p ? p.promoWeeks + ' of ' + p.weeks : '—'; }, sort: function (r) { var p = f(r); return p && p.promoWeeks; }, csv: function (r) { var p = f(r); return p && p.promoWeeks; } }]; };
    table($('t3'), 't3', [{ key: 'name', label: 'Segment', l: 1, render: function (r) { return '<a href="#" data-seg="' + r.s + '" onclick="return false">' + esc(r.name) + '</a>'; }, csv: function (r) { return r.name; } }]
      .concat(side('b', 'Britax', function (r) { return r.b; })).concat(side('c', 'Competitors', function (r) { return r.c; })), segRows.map(function (r) { r._cls = r.s === si ? 'me' : ''; return r; }));
    var brs = A.brands(M, si).map(function (b) { var p = A.promoStats(M, si, b); return { _cls: b === 'Britax group' ? 'me' : b === 'All competitors' ? 'all' : '', brand: shortName(b), p: p }; });
    table($('t4'), 't4', [
      { key: 'brand', label: 'Brand', l: 1 },
      { key: 'vs', label: 'Avg price vs baseline', render: function (r) { return '<span class="' + cls(r.p && r.p.vs) + '">' + sgn(r.p && r.p.vs) + '</span>'; }, sort: function (r) { return r.p && r.p.vs; }, csv: function (r) { return r.p && r.p.vs; } },
      { key: 'prime', label: 'Units on promo, Prime weeks', render: function (r) { return pc0(r.p && r.p.prime); }, sort: function (r) { return r.p && r.p.prime; }, csv: function (r) { return r.p && r.p.prime; } },
      { key: 'normal', label: 'Units on promo, other weeks', render: function (r) { return pc0(r.p && r.p.normal); }, sort: function (r) { return r.p && r.p.normal; }, csv: function (r) { return r.p && r.p.normal; } },
      { key: 'gap', label: 'Prime lift', render: function (r) { return '<span class="' + cls(gap(r.p)) + '">' + pts(gap(r.p)) + '</span>'; }, sort: function (r) { return gap(r.p); }, csv: function (r) { return gap(r.p); } },
      { key: 'pw', label: 'Other weeks with 25%+ on promo', render: function (r) { return r.p ? r.p.promoWeeks + ' of ' + r.p.weeks : '—'; }, sort: function (r) { return r.p && r.p.promoWeeks; }, csv: function (r) { return r.p && r.p.promoWeeks; } },
      { key: 'spark', label: 'Weekly % of units on promo', render: function (r) { return r.p ? spark(r.p.pu, R0, LAST, r.p.all) : '—'; }, sort: function () { return null; }, csv: function () { return ''; } }
    ], brs);
  }

  // ====================== view 3: key products ======================
  var CAT_SALES = [['Convertible car seats', 14.6], ['Booster car seats', 8.52], ['Double strollers', 5.41], ['Strollers (other)', 5.0], ['Travel systems', 2.82], ['Infant car seats', 0.89], ['Other categories (14)', 2.46]];
  function viewSkus() {
    var si = state.seg;
    var mine = A.skuRows(M, si, true), comp = A.skuRows(M, si, false);
    var lead = mine.slice().sort(function (a, b) { return b.u13 - a.u13; })[0];
    var h = '<section class="card"><h2>Key competitor products</h2><p class="sub">The four largest Britax categories (top 20% of 20) make up about 85% of Britax est. sales over the last 52 weeks. For each, the best-selling Britax products and the best-selling competitor products, priced against their own 12-month baseline.</p>';
    h += '<div class="answer"><p>' + esc(SEG[si]) + ': ' + (lead ? 'lead Britax product baseline <b>' + usd(lead.base) + '</b>. ' : '') + (function () {
      var on = comp.filter(function (r) { return r.flags.indexOf('On promo now') >= 0; }).length;
      return on + ' of ' + comp.length + ' tracked competitor products are priced 5% or more below their baseline now (weeks 98–101).';
    })() + '</p></div>';
    h += '<h3>Britax products</h3><div class="scroll"><table class="tbl" id="t5"></table></div>' + csvBtn('t5');
    h += '<h3>Competitor products</h3><div class="scroll"><table class="tbl" id="t6"></table></div>' + csvBtn('t6');
    h += '<p class="rule">Price now = average of the latest four weeks. “Weeks on promo” counts weeks at least 5% below baseline. Vs lead Britax compares the product’s baseline with the best-selling Britax product in this category.</p></section>';
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
      { key: 'vl', label: 'Baseline vs lead Britax', render: function (r) { var d = lead && r.base ? (r.base / lead.base - 1) * 100 : null; return '<span class="' + cls(d) + '">' + sgn(d, 0) + '</span>'; }, sort: function (r) { return lead ? r.base / lead.base : null; }, csv: function (r) { return lead ? (r.base / lead.base - 1) * 100 : ''; } },
      { key: 'spark', label: 'Weekly price', render: function (r) { return spark(r.price, R0, LAST, r.base); }, sort: function () { return null; }, csv: function () { return ''; } },
      { key: 'flags', label: 'Status', render: function (r) { return r.flags.map(function (f) { return '<span class="pill ' + (f === 'On promo now' ? 'warn' : f === 'Promotes often' ? 'info' : f === 'Priced above baseline' ? 'bad' : 'good') + '">' + f + '</span>'; }).join(' '); }, sort: function (r) { return r.vs; }, csv: function (r) { return r.flags.join('; '); } }
    ];
    mine.forEach(function (r) { r._cls = 'me'; });
    table($('t5'), 't5', cols, mine); table($('t6'), 't6', cols, comp);
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
      h += '<section class="card"><h2>' + esc(e.label) + '</h2><p class="sub">Before = 3 weeks before the event · during = event week · after = ' + (prov ? 'the week after (provisional: later weeks are not in yet)' : 'the 3 weeks after') + '</p><div class="scroll"><table class="tbl" id="te' + i + '"></table></div>' + csvBtn('te' + i) + '</section>';
    });
    $('view').innerHTML = h;
    wireTip('c2', cOpts);
    var pc = function (k) { return { key: k, label: k, render: function (r) { return fin(r[k]) ? f1(r[k]) + '%' : '—'; }, csv: function (r) { return r[k]; } }; };
    table($('t8'), 't8', [{ key: 'brand', label: 'Brand', l: 1 }, { key: 'was', label: 'Earlier', render: function (r) { return fin(r.was) ? f1(r.was) + '%' : '—'; } }, { key: 'now', label: 'Latest', render: function (r) { return fin(r.now) ? f1(r.now) + '%' : '—'; } },
      { key: 'd', label: 'Change', render: function (r) { return '<b class="' + gcls(r.d) + '">' + pts(r.d) + '</b>'; }, csv: function (r) { return r.d; } }], chg);
    PRIME.filter(function (e) { return e.week >= LO; }).forEach(function (e, i) {
      var rows = bs.map(function (b) { var s = A.shareEvent(M, si, b, e.week); return { _cls: b === 'Britax group' ? 'me' : '', brand: shortName(b), before: s.before, during: s.during, after: s.after, dd: s.dDuring, da: s.after == null ? null : s.dAfter }; });
      table($('te' + i), 'te' + i, [{ key: 'brand', label: 'Brand', l: 1 },
        { key: 'before', label: 'Before', render: function (r) { return fin(r.before) ? f1(r.before) + '%' : '—'; } },
        { key: 'during', label: 'During', render: function (r) { return fin(r.during) ? f1(r.during) + '%' : '—'; } },
        { key: 'after', label: 'After', render: function (r) { return fin(r.after) ? f1(r.after) + '%' : '—'; } },
        { key: 'dd', label: 'During vs before', render: function (r) { return '<span class="' + gcls(r.dd) + '">' + pts(r.dd) + '</span>'; }, csv: function (r) { return r.dd; } },
        { key: 'da', label: 'After vs before', render: function (r) { return '<span class="' + gcls(r.da) + '">' + pts(r.da) + '</span>'; }, csv: function (r) { return r.da; } },
        { key: 'read', label: 'Read', render: function (r) { return readPill(r.dd, r.da); }, sort: function (r) { return r.dd; }, csv: function (r) { return ''; } }], rows);
    });
  }

  // ====================== method ======================
  function renderMethod() {
    $('method').innerHTML = '<h2>How to read this</h2><ul class="notes">' +
      '<li><b>Source:</b> weekly Amazon US Market Share estimates (units, sales, average price) for the Britax group (Britax and Bob Gear) and tracked competitors.</li>' +
      '<li><b>Price index:</b> same products only, so mix shifts do not look like price changes. 100 = Oct–Dec 2024 on non-deal weeks. From ' + A.wkLabel(R0) + ' the index is built on the last 12 months and rescaled to the earlier line, so the “price basis changes” marker is a join, not a price move.</li>' +
      '<li><b>Promotion:</b> a price at least 5% below the product’s own median weekly price over the last 52 weeks.</li>' +
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
