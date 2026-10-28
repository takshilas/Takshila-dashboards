// Britax US pricing and share dashboard. Renders from precomputed tables (private/data-*.js); nothing is queried in the browser.
(function () {
  var A = window.BritaxAnalytics;
  var M = A.parse({ weekly: window.BRITAX_WEEKLY, r12: window.BRITAX_R12, prices: window.BRITAX_PRICES, skuall: window.BRITAX_SKUALL, skucov: window.BRITAX_SKUCOV, brandwk: window.BRITAX_BRANDWK, asp: window.BRITAX_ASP, anchor: window.BRITAX_ANCHOR, tierwk: window.BRITAX_TIERWK, tierskus: window.BRITAX_TIERSKUS, tierasp: window.BRITAX_TIERASP, tierpromo: window.BRITAX_TIERPROMO, tierbrwk: window.BRITAX_TIERBR_WK, tierbrasp: window.BRITAX_TIERBR_ASP, tierbrpromo: window.BRITAX_TIERBR_PROMO, tierbridx: window.BRITAX_TIERBR_IDX, tieridx: window.BRITAX_TIERIDX, elast: window.BRITAX_ELAST });
  var Y = 2026, PY = 2025; // selected year and the year before
  var P6 = 80; // first week of the 6-month promo window (week of Apr 19, 2026)
  var SEG = A.SEGMENTS, CORE = A.CORE, PRIME = A.PRIME, W = A.W, f1 = A.f1, R0 = A.R12_START, LAST = W - 1;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var fin = function (v) { return v != null && isFinite(v); };
  var sgn = function (v, d) { return !fin(v) ? '—' : (v > 0.049 ? '+' : v < -0.049 ? '−' : '') + Math.abs(v).toFixed(d == null ? 1 : d) + '%'; };
  var pts = function (v) { return !fin(v) ? '—' : (v > 0.049 ? '+' : v < -0.049 ? '−' : '') + Math.abs(v).toFixed(1) + ' pts'; };
  var usd = function (v) { return !fin(v) ? '—' : '$' + v.toFixed(0); };
  var num = function (v) { return !fin(v) ? '—' : Math.round(v).toLocaleString('en-US'); };
  var gcls = function (v) { return !fin(v) ? '' : v > 0.049 ? 'down' : v < -0.049 ? 'up' : ''; };
  var cls = function (v) { return !fin(v) ? '' : v > 0.049 ? 'up' : v < -0.049 ? 'down' : ''; };
  var COLORS = ['#1F22B2', '#5AAFFE', '#B54708', '#067647', '#7A5AF8', '#D92D20', '#0E7090', '#667085'];
  var BRITAX = '#C231FF', COMP_ALL = '#210235';

  var VIEWS = [
    { id: 'summary', label: 'Share comparison and category summary' },
    { id: 'market', label: 'Market share' },
    { id: 'share', label: 'Share around 2026 Prime days' },
    { id: 'price', label: 'Price and promo' },
    { id: 'skus', label: 'Key competitor products' },
    { id: 'elasticity', label: 'Price elasticity' }
  ];
  var q = new URLSearchParams(location.search);
  function clampInt(v, lo, hi, d) { var n = parseInt(v, 10); return isNaN(n) ? d : Math.max(lo, Math.min(hi, n)); }
  var state = { lvl: 'brand', view: VIEWS.some(function (v) { return v.id === q.get('view'); }) ? q.get('view') : 'summary', seg: clampInt(q.get('seg'), 0, 4, 0), overlay: {}, tierBrand: 'Britax group', month: A.MONTHS.indexOf(q.get('m')) >= 0 ? q.get('m') : A.MONTHS[A.MONTHS.length - 1] };
  var Wd = A.win(); // windows for the selected month; refreshed by useMonth() before every render
  function useMonth() { A.setMonth(state.month); Wd = A.win(); R0 = Wd.y12[0]; LAST = Wd.last; P6 = Wd.h[0]; Y = Wd.year; PY = Wd.year - 1; }
  function sync() { history.replaceState(null, '', '?view=' + state.view + '&seg=' + state.seg + '&m=' + state.month + location.hash); }

  // Cards whose figures are precomputed for the latest month only: flagged when an earlier month is selected.
  function held(what) { return state.month && state.month !== A.MONTHS[A.MONTHS.length - 1] ? '<p class="sub held"><b>Shows the latest data (through the week of ' + A.wkLabel(A.W - 1) + '), not ' + esc(Wd.label) + ':</b> ' + what + '</p>' : ''; }
  function drawMonth() {
    var sel = $('monthSel');
    sel.innerHTML = A.MONTHS.slice().reverse().map(function (m) { return '<option value="' + m + '"' + (m === state.month ? ' selected' : '') + '>' + esc(A.monthName(m)) + '</option>'; }).join('');
    sel.onchange = function () { state.month = this.value; render(); };
    var yr = Wd.year;
    $('asof').innerHTML = 'Amazon US · weekly Market Share estimates · data through week of <b>' + A.wkIso(A.W - 1) + '</b> · tariff period Jan–Jun 2025 · Prime events: June and October';
    $('monthNote').innerHTML = (Wd.partial ? '<b>' + esc(Wd.label) + ' is partial</b>: ' + Wd.month.length + ' of ' + Wd.total + ' weeks so far (through the week of ' + A.wkLabel(Wd.last) + '). ' : '') + 'Last 12 months = ' + esc(A.monthName(A.mKey(Wd.ix - 11))) + ' to ' + esc(Wd.label) + ' · last quarter = ' + esc(A.monthName(A.mKey(Wd.ix - 2))) + ' to ' + esc(Wd.label) + ' · ' + yr + ' YTD = ' + (Wd.label.split(' ')[0] === 'Jan' ? 'Jan' : 'Jan to ' + esc(Wd.label.split(' ')[0])) + ' (' + Wd.ytd.length + ' weeks). A week counts in the month it ends in.';
  }

  // ---------- tabs ----------
  function drawTabs() {
    $('viewTabs').innerHTML = VIEWS.map(function (v) { return '<button class="tab view" role="tab" data-v="' + v.id + '" aria-selected="' + (v.id === state.view) + '">' + esc(v.label) + '</button>'; }).join('');
    var segs = (state.view === 'summary' || state.view === 'elasticity') ? [0, 1, 2, 3, 4] : [0, 1, 2, 3];
    if (state.seg > 3 && segs.indexOf(state.seg) < 0) state.seg = segs[0];
    if (segs.indexOf(state.seg) < 0) state.seg = segs[0];
    $('segTabs').innerHTML = segs.map(function (i) { return '<button class="tab" role="tab" data-s="' + i + '" aria-selected="' + (i === state.seg) + '">' + esc(i === 4 ? 'All categories' : SEG[i]) + '</button>'; }).join('');
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
    return '<div class="chartwrap" id="' + id + '"><svg viewBox="0 0 ' + CW + ' ' + CH + '" width="100%" role="img" aria-label="' + esc(o.aria || 'Line chart') + '">' + bands + g + lines + marks + ticks + '<rect class="hit" x="' + PL + '" y="' + PT + '" width="' + (CW - PL - PR) + '" height="' + (CH - PT - PB) + '" fill="transparent"/></svg><div class="tip"></div></div>';
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

  // ====================== view 1: price and promo ======================
  function viewPrice() {
    var si = state.seg, all = A.brands(M, si), rows = {};
    all.forEach(function (b) {
      var t = A.trendSeries(M, si, b);
      rows[b] = { brand: b, t: t, moves: A.findMoves(t.vals) };
    });
    var comps = all.filter(function (b) { return !isGroup(b); });
    var bx = rows['Britax group'], cx = rows['All competitors'];

    var series = [
      { name: 'Britax (incl. Bob Gear)', color: BRITAX, bold: true, vals: bx.t.vals, moves: bx.moves.filter(function (m) { return m.week >= 5; }) },
      { name: 'All competitors combined', color: COMP_ALL, bold: true, vals: cx.t.vals, moves: cx.moves }
    ];
    comps.forEach(function (b, i) { if (state.overlay[b]) series.push({ name: b, color: COLORS[i % COLORS.length], vals: rows[b].t.vals, moves: rows[b].moves }); });
    var cOpts = { lo: 0, hi: LAST, series: series, tariff: true, base: 100, aria: 'Weekly average selling price index', unit: '' };

    var h = '<section class="card"><h2>Are prices rising or stable?</h2><p class="sub">' + esc(SEG[si]) + '</p>';
    h += '<h3>Weekly price index (Oct–Dec 2024 = 100)</h3>';
    h += legend([sw(BRITAX, 'Britax'), sw(COMP_ALL, 'All competitors combined'), '<span><span class="sw" style="background:#EAF4FF;border:1px solid #cfe3f7"></span>Tariff period Jan–Jun 2025</span>', primeKey, '<span>▲ ▼ price move of 5% or more</span>']);
    h += comps.length ? '<div class="legend">Add a competitor: ' + comps.map(function (b, i) { return '<label><input type="checkbox" data-ov="' + esc(b) + '"' + (state.overlay[b] ? ' checked' : '') + '> <span style="color:' + COLORS[i % COLORS.length] + '">●</span> ' + esc(b) + '</label>'; }).join('') + '</div>' : '';
    h += lineChart('c1', cOpts);
    h += '<p class="rule">Dips inside the purple bands are Prime event deals, not list price changes. Each line is sales ÷ units of all the brand’s products in that week, so it moves with product mix as well as price, and it includes discounted weeks.</p></section>';

    h += '<section class="card"><h2>Which brands changed price?</h2><p class="sub">' + esc(SEG[si]) + ' · Britax and the top 5 competitors by share, ordered by share of sales over the last 12 months. Has category pricing stabilized since 2025?</p>';
    h += '<div id="pins"></div><div class="scroll"><table class="tbl" id="t1"></table></div>' + csvBtn('t1') + '<p class="rule" id="pnote"></p>' + tierHtml('price', si) + '</section>';

    h += '<section class="card"><h2>How deep is promo pricing?</h2>' + held('the 6-month promotion window and its 12-month baseline are fixed to the latest data.') + '<p class="sub">Last 6 months (weeks of ' + A.wkLabel(P6) + ' to ' + A.wkLabel(LAST) + '), ' + esc(SEG[si]) + '. A product is on promotion in a week when its price is 5% or more below its own average selling price over the last 12 months (' + A.wkLabel(R0) + ' to ' + A.wkLabel(LAST) + '). Each product’s price on and off promotion is its average over the six months; the brand figure is the simple average across its products, each product counting once (not weighted by units sold).</p>';
    h += '<div class="controls"><label>Show <select id="lvl"><option value="brand">Brands</option><option value="sku-all">All products behind the averages</option><option value="sku-own">Britax products only</option><option value="sku-comp">Competitor products only</option></select></label></div>';
    h += '<div id="lvlNote"></div><div class="scroll" style="max-height:640px;overflow:auto"><table class="tbl" id="t2"></table></div>' + csvBtn('t2') + '<p class="rule">Simple average across products: each product counts once, whether it sold many units or few, and a product is in the on-promo average only if it had promoted weeks (and in the off-promo average only if it had weeks off promotion), so the two groups can contain different products. Use the product view for a single product’s discount.</p>' + tierHtml('promo', si) + '</section>';

    h += '<section class="card"><h2>Is Britax promoting more than competitors?</h2>' + held('last 6 months to the latest week.') + '<p class="sub">Same measures, last 6 months. Select a category name to switch to it.</p><div class="scroll"><table class="tbl" id="t3"></table></div>' + csvBtn('t3') + '</section>';
    $('view').innerHTML = h;
    drawTierTables(si);
    drawTierTables(si);

    wireTip('c1', cOpts);
    Array.prototype.forEach.call(document.querySelectorAll('[data-ov]'), function (cb) { cb.onchange = function () { state.overlay[cb.dataset.ov] = cb.checked; viewPrice(); }; });
    var mine = function (b) { return b === 'Britax group' ? 'me' : b === 'All competitors' ? 'all' : ''; };
    var ptxt = function (v) { return '<span class="' + cls(v) + '">' + sgn(v) + '</span>'; };
    var pcell = function (k, label) { return { key: k, label: label, render: function (r) { return usd(r[k]); }, csv: function (r) { return r[k]; } }; };
    var ccell = function (k, label) { return { key: k, label: label, render: function (r) { return ptxt(r[k]); }, csv: function (r) { return r[k]; } }; };
    function drawPrice() {
      var basis = 'asp';
      var pt = A.priceRows(M, si), nm = 'average price', lab = 'avg price';
      var rows = pt.rows.slice().concat(pt.comb, pt.all ? [pt.all] : []);
      rows.forEach(function (r) { r._cls = r.brand === 'Britax group' ? 'me' : r.group ? 'all' : ''; r.name = r.brand === 'Britax group' ? shortName(r.brand) : r.brand; });
      table($('t1'), 't1', [{ key: 'name', label: 'Brand', l: 1 },
        { key: 'units', label: 'Est. units, 12 months', render: function (r) { return num(r.units); } },
        { key: 'share', label: 'Share of sales', render: function (r) { return fin(r.share) ? r.share.toFixed(1) + '%' : '—'; } },
        pcell('p25', PY + ' ' + lab), ccell('c25', 'vs ' + (PY - 1)),
        pcell('p26y', Y + ' YTD ' + lab), ccell('c26y', 'vs ' + PY + ' YTD'),
        pcell('pOct', Wd.label + ' ' + lab), ccell('cOct', 'vs ' + A.monthName(A.mKey(Wd.ix - 1))),
        { key: 'vsB', label: 'Price vs Britax', render: function (r) { return r.brand === 'Britax group' ? '—' : '<span class="' + cls(r.vsB) + '">' + sgn(r.vsB, 0) + '</span>'; }, csv: function (r) { return r.vsB; } }
      ], rows);
      // insights on the top 5 share holders and Britax
      var me = pt.rows.filter(function (r) { return r.brand === 'Britax group'; })[0], cb = pt.comb, others = pt.rows.filter(function (r) { return r.brand !== 'Britax group'; });
      var trend = function (r) { return fin(r.c25) && fin(r.c26y) ? (r.c26y < r.c25 - 2 ? 'slowed' : r.c26y > r.c25 + 2 ? 'picked up' : 'held steady') : null; };
      var steady = others.filter(function (r) { return fin(r.c26y) && Math.abs(r.c26y) < 3; }), moving = others.filter(function (r) { return fin(r.c26y) && Math.abs(r.c26y) >= 3; });
      var g = function (r) { return esc(r.brand) + ' ' + sgn(r.c25, 0) + ' → ' + sgn(r.c26y, 0) + ' → ' + sgn(r.cOct, 0); };
      var pts = function (r) { return r.sh26 - r.sh25; };
      var gain = pt.rows.filter(function (r) { return pts(r) >= 0.5; }), lose = pt.rows.filter(function (r) { return pts(r) <= -0.5; });
      var sp = function (r) { return esc(shortName(r.brand)) + ' ' + (pts(r) > 0 ? '+' : '−') + Math.abs(pts(r)).toFixed(1) + ' pts'; };
      var h2 = '<div class="answer"><p><b>Top 5 competitors combined</b> (' + (fin(cb.share) ? cb.share.toFixed(0) : '—') + '% of category sales): ' + nm + ' ' + sgn(cb.c25, 1) + ' in 2025 vs 2024, ' + sgn(cb.c26y, 1) + ' in 2026 YTD vs 2025 YTD, ' + sgn(cb.cOct, 1) + ' in Oct 2026 vs Sep' + (trend(cb) ? ', so price growth ' + trend(cb) + ' from ' + sgn(cb.c25, 0) + ' to ' + sgn(cb.c26y, 0) : '') + '.</p>';
      if (me) h2 += '<p><b>Britax:</b> ' + sgn(me.c25, 1) + ' in 2025, ' + sgn(me.c26y, 1) + ' in 2026 YTD, ' + sgn(me.cOct, 1) + ' in Oct' + (trend(me) ? ' (' + trend(me) + ')' : '') + '. Priced ' + (fin(cb.vsB) ? (cb.vsB < 0 ? Math.abs(cb.vsB).toFixed(0) + '% above' : cb.vsB.toFixed(0) + '% below') + ' the top 5 competitors combined (2026 YTD).' : '—') + '</p>';
      h2 += '<p><b>Steady in 2026 YTD (within ±3%):</b> ' + (steady.length ? steady.map(function (r) { return esc(r.brand) + ' ' + sgn(r.c26y, 1); }).join(', ') : 'none') + '. <b>Still moving:</b> ' + (moving.length ? moving.map(function (r) { return esc(r.brand) + ' ' + sgn(r.c26y, 1); }).join(', ') : 'none') + '. <span class="muted">Change path, 2025 → 2026 YTD → Oct: ' + others.map(g).join('; ') + '.</span></p>';
      h2 += '<p><b>Share of sales, 2026 YTD vs 2025:</b> ' + (gain.length ? 'gained: ' + gain.map(sp).join(', ') : 'no brand gained 0.5 pts or more') + (lose.length ? '; lost: ' + lose.map(sp).join(', ') : '') + '.</p></div>';
      $('pins').innerHTML = h2;
      $('pnote').innerHTML = 'Average price = simple average across the brand’s products of each product’s price (its sales ÷ its units in the period, promotions included). Every product counts once, so it is not weighted by units sold, and it moves with which products were on sale as well as with price. ' + Y + ' YTD = weeks of ' + Wd.range(Wd.ytd) + ' vs the same weeks of ' + PY + '; ' + PY + ' = the full year, vs ' + (PY - 1) + '; ' + Wd.label + ' = ' + Wd.range(Wd.month) + ' vs ' + A.monthName(A.mKey(Wd.ix - 1)) + ' (' + Wd.prev.length + ' weeks)' + (Wd.partial ? ', and ' + Wd.label + ' is a partial month' : '') + '. Units and share of sales are for the last 12 months (' + A.monthName(A.mKey(Wd.ix - 11)) + ' to ' + Wd.label + '); a week counts in the month it ends in. A dash means fewer than 3 products sold in the period. Price vs Britax compares ' + Y + ' YTD prices.';
    }
    drawPrice();


    var depthHtml = function (d) { return '<b class="' + (d > 0 ? 'down' : '') + '">' + (fin(d) ? '−' + d.toFixed(1) + '%' : '—') + '</b>'; };
    function drawPromo() {
      var lvl = state.lvl, sel = $('lvl'); if (sel) sel.value = lvl;
      var note = '';
      if (lvl === 'brand') {
        var pr = all.map(function (b) { return { _cls: mine(b), brand: shortName(b), p: A.promoPrices(M, si, b), idx: M.r12[si][b].idx }; });
        var pc = function (key, label, f, fmt) { return { key: key, label: label, render: function (r) { return fmt(r.p && r.p[f]); }, sort: function (r) { return r.p && r.p[f]; }, csv: function (r) { return r.p && r.p[f]; } }; };
        table($('t2'), 't2', [
          { key: 'brand', label: 'Brand', l: 1 },
          pc('nn', 'Products off promo', 'nn', num),
          pc('off', '6-month avg price (not on promo)', 'off', usd),
          pc('np', 'Products on promo', 'np', num),
          pc('on', 'Avg price, on promo', 'on', usd),
          { key: 'gap', label: 'On promo vs not on promo', render: function (r) { return '<b class="' + (r.p && r.p.gap < 0 ? 'down' : '') + '">' + sgn(r.p && r.p.gap) + '</b>'; }, sort: function (r) { return r.p && r.p.gap; }, csv: function (r) { return r.p && r.p.gap; } },
          { key: 'spark', label: 'Weekly price vs 12-month average price', render: function (r) { return spark(r.idx, P6, LAST, 100); }, sort: function () { return null; }, csv: function () { return ''; } }
        ], pr);
      } else {
        var data = [];
        if (lvl !== 'sku-comp') A.skuAll(M, si, true).forEach(function (r) { r._cls = 'me'; r.who = 'Britax'; data.push(r); });
        if (lvl !== 'sku-own') A.skuAll(M, si, false).forEach(function (r) { r.who = 'Competitor'; data.push(r); });
        var cv = M.skucov[si] || {};
        note = '<p class="rule" style="margin:0 0 8px">Showing ' + data.length + ' products: ' + [lvl !== 'sku-comp' && cv.B ? 'Britax, the top ' + A.skuAll(M, si, true).length + ' of ' + cv.B.n + ' products by sales (' + cv.B.pct.toFixed(0) + '% of Britax sales with a baseline)' : '', lvl !== 'sku-own' && cv.C ? 'competitors, the top ' + A.skuAll(M, si, false).length + ' of ' + cv.C.n + ' products by sales (' + cv.C.pct.toFixed(0) + '% of competitor sales with a baseline)' : ''].filter(Boolean).join('; ') + '. Brand averages above include every product.</p>';
        var num0 = function (key, label, f, fmt) { return { key: key, label: label, render: function (r) { return fmt(r[f]); }, csv: function (r) { return r[f]; } }; };
        table($('t2'), 't2', [
          { key: 'brand', label: 'Brand', l: 1, render: function (r) { return esc(shortName(r.brand)); } },
          { key: 'title', label: 'Product', l: 1, wrap: 1, render: function (r) { return esc(r.title) + '<div class="muted" style="font-size:12px">' + esc(r.asin) + '</div>'; }, csv: function (r) { return r.title; } },
          num0('units', 'Units, 6 months', 'units', num),
          num0('off', '6-month avg price (not on promo)', 'off', usd),
          num0('on', 'Avg price, on promo', 'on', usd),
          { key: 'gap', label: 'On promo vs not on promo', render: function (r) { return '<b class="' + (r.gap < 0 ? 'down' : '') + '">' + sgn(r.gap) + '</b>'; }, csv: function (r) { return r.gap; } },
          { key: 'pct', label: '% of units on promo', render: function (r) { return fin(r.pct) ? r.pct.toFixed(0) + '%' : '—'; } },
          { key: 'pw', label: 'Weeks on promo', render: function (r) { return r.pw + ' of ' + r.wk; }, sort: function (r) { return r.pw; }, csv: function (r) { return r.pw; } },
          num0('now', 'Price, last 4 weeks', 'now', usd),
          { key: 'nowVs', label: 'Last 4 weeks vs 6-month avg', render: function (r) { return ptxt(r.nowVs); }, csv: function (r) { return r.nowVs; } }
        ], data);
      }
      $('lvlNote').innerHTML = note;
    }
    drawPromo();
    $('lvl').onchange = function () { state.lvl = this.value; drawPromo(); };

    var segRows = [0, 1, 2, 3].map(function (s) { return { s: s, name: SEG[s], b: A.promoPrices(M, s, 'Britax group'), c: A.promoPrices(M, s, 'All competitors'), _cls: s === si ? 'me' : '' }; });
    var grp = function (key, label, f) { return [
      { key: key + 'o', label: label + ': 6-month avg price (not on promo)', render: function (r) { return usd(f(r) && f(r).off); }, sort: function (r) { return f(r) && f(r).off; }, csv: function (r) { return f(r) && f(r).off; } },
      { key: key + 'n', label: label + ': avg price, on promo', render: function (r) { return usd(f(r) && f(r).on); }, sort: function (r) { return f(r) && f(r).on; }, csv: function (r) { return f(r) && f(r).on; } },
      { key: key + 'd', label: label + ': on promo vs not', render: function (r) { return '<b class="' + (f(r) && f(r).gap < 0 ? 'down' : '') + '">' + sgn(f(r) && f(r).gap) + '</b>'; }, sort: function (r) { return f(r) && f(r).gap; }, csv: function (r) { return f(r) && f(r).gap; } }]; };
    table($('t3'), 't3', [{ key: 'name', label: 'Category', l: 1, render: function (r) { return '<a href="#" data-seg="' + r.s + '" onclick="return false">' + esc(r.name) + '</a>'; }, csv: function (r) { return r.name; } }]
      .concat(grp('b', 'Britax', function (r) { return r.b; })).concat(grp('c', 'Competitors', function (r) { return r.c; })), segRows);
  }

  // ====================== view 2: market share ======================
  function viewMarket() {
    var si = state.seg;
    var bs = A.brands(M, si).filter(function (b) { return b !== 'All competitors'; });
    var bx = (M.r12[si] && M.r12[si]['Britax group'] ? M.r12[si]['Britax group'].idx : []), extra = [];
    if (state.month === A.MONTHS[A.MONTHS.length - 1]) for (var w = R0; w <= LAST; w++) if (fin(bx[w]) && bx[w] <= 95 && !A.primeWeek(w)) extra.push(w);
    var series = bs.map(function (b, i) { return { name: shortName(b), color: b === 'Britax group' ? BRITAX : COLORS[i % COLORS.length], bold: b === 'Britax group', vals: A.shareSeries(M, si, b) }; });
    var cOpts = { lo: R0, hi: LAST, series: series, aria: 'Weekly share of sales, last 12 months', unit: '%', floor0: true, extra: extra };
    var h = '<section class="card"><h2>How has share moved in the last 12 months?</h2><p class="sub">' + esc(SEG[si]) + ' · ' + esc(A.monthName(A.mKey(Wd.ix - 11))) + ' to ' + esc(Wd.label) + ' · weekly share of sales ($) among tracked brands. Purple bands are Prime event weeks; orange bands are other weeks when Britax itself was on promotion (5% or more below its 12-month baseline).</p>';
    h += legend(series.map(function (s) { return sw(s.color, esc(s.name)); }).concat([primeKey, '<span><span class="sw" style="background:#F79009;opacity:.3"></span>Britax on promo (non-Prime)</span>']));
    h += lineChart('c3', cOpts) + '</section>';
    h += '<section class="card"><h2>Does Britax gain share in Prime weeks?</h2><p class="sub">' + esc(SEG[si]) + ' · ' + Wd.year + ' year to date only (weeks of ' + Wd.range(Wd.ytd) + '), share of sales ($) among tracked brands. Prime weeks = the event week plus the week before and after, for Prime Day in June and Prime Big Deal Days in October.</p><div class="scroll"><table class="tbl" id="t11"></table></div>' + csvBtn('t11') + '' + tierHtml('vs', si) + '</section>';
    $('view').innerHTML = h;
    drawTierTables(si);
    wireTip('c3', cOpts);
    var all = Wd.ytd, prime = [], other = [], f13 = Wd.q1, l13 = Wd.q;
    all.forEach(function (k) { (A.PRIME.some(function (e) { return Math.abs(e.week - k) <= 1; }) ? prime : other).push(k); });
    var rows = bs.map(function (b) {
      var a = A.shareWeeks(M, si, b, all), p = A.shareWeeks(M, si, b, prime), o = A.shareWeeks(M, si, b, other), f = A.shareWeeks(M, si, b, f13), l = A.shareWeeks(M, si, b, l13);
      return { _cls: b === 'Britax group' ? 'me' : '', brand: shortName(b), a: a, p: p, o: o, lift: p != null && o != null ? p - o : null, f: f, l: l, d: f != null && l != null ? l - f : null };
    });
    var pc = function (k) { return function (r) { return fin(r[k]) ? r[k].toFixed(1) + '%' : '—'; }; };
    var pts2 = function (k) { return function (r) { return '<b class="' + gcls(r[k]) + '">' + pts(r[k]) + '</b>'; }; };
    table($('t11'), 't11', [
      { key: 'brand', label: 'Brand', l: 1 },
      { key: 'a', label: Wd.year + ' YTD share', render: pc('a') },
      { key: 'o', label: 'Other weeks', render: pc('o') },
      { key: 'p', label: 'Prime weeks', render: pc('p') },
      { key: 'lift', label: 'Prime weeks vs other', render: pts2('lift'), csv: function (r) { return r.lift; } },
      { key: 'f', label: 'First quarter of ' + Wd.year, render: pc('f') },
      { key: 'l', label: 'Last quarter', render: pc('l') },
      { key: 'd', label: 'Change', render: pts2('d'), csv: function (r) { return r.d; } }
    ], rows);
  }

  // ====================== key products by price tier ======================
  function viewSkus() {
    var si = state.seg;
    var h = '<section class="card"><h2>Pricing summary for top-performing products: Britax and competitors</h2>' + '<p class="sub">' + esc(SEG[si]) + ' · in each price tier, the 3 best-selling Britax products and the 5 best-selling competitor products by sales over the last 26 weeks. Price now (' + esc(Wd.label) + ') is compared with each product’s 12-month average selling price. Price tiers: ' + tierNote(si) + '.</p>';
    [0, 1, 2].forEach(function (t) { h += '<h3>' + esc(A.tierLabel(si, t)) + '</h3><div class="scroll"><table class="tbl" id="sk' + t + '"></table></div>' + csvBtn('sk' + t); });
    h += '<p class="rule">Baseline = the product’s average selling price over the last 12 months, the 52 weeks from ' + A.wkLabel(A.R12_START) + ' to ' + A.wkLabel(A.W - 1) + ' (sales ÷ units, promotions included). The promotion tables on Price and promo use the same baseline. Price now = average weekly price in ' + esc(Wd.label) + '; “Price now vs 12-month avg” = price now ÷ baseline − 1. Last quarter = average weekly price over ' + esc(A.monthName(A.mKey(Wd.ix - 3))) + ' to ' + esc(A.monthName(A.mKey(Wd.ix - 1))) + '; “Price now vs last quarter” = price now ÷ last quarter price − 1. “Weeks on promo” counts weeks at least 5% below the baseline, and recent promotions look at the last 13 weeks. Status: On promo now = price now 5% or more below baseline; Priced above baseline = 5% or more above; Promotes often = on promo in a quarter or more of weeks. Products need 10+ weeks of 2+ units; a tier shows fewer than 3 Britax products where Britax sells fewer there.</p></section>';
    $('view').innerHTML = h;
    var cols = [
      { key: 'brand', label: 'Brand', l: 1 },
      { key: 'title', label: 'Product', l: 1, wrap: 1, render: function (r) { return esc(r.title) + '<div class="muted" style="font-size:12px">' + esc(r.asin) + '</div>'; }, csv: function (r) { return r.title; } },
      { key: 'u13', label: 'Units/wk', render: function (r) { return num(r.u13); } },
      { key: 'asp', label: '12-month avg selling price (baseline)', render: function (r) { return usd(r.asp); } },
      { key: 'lq', label: 'Last quarter avg price (' + A.monthName(A.mKey(Wd.ix - 3)).split(' ')[0] + '–' + A.monthName(A.mKey(Wd.ix - 1)).split(' ')[0] + ')', render: function (r) { return usd(r.lq); } },
      { key: 'cur', label: 'Price now (' + Wd.label + ')', render: function (r) { return usd(r.cur); } },
      { key: 'vsLq', label: 'Price now vs last quarter', render: function (r) { return '<span class="' + cls(r.vsLq) + '">' + sgn(r.vsLq) + '</span>'; } },
      { key: 'vs', label: 'Price now vs 12-month avg', render: function (r) { return '<span class="' + cls(r.vs) + '">' + sgn(r.vs) + '</span>'; } },
      { key: 'lo', label: 'Low–high', render: function (r) { return usd(r.lo) + '–' + usd(r.hi); }, sort: function (r) { return r.hi - r.lo; }, csv: function (r) { return usd(r.lo) + '-' + usd(r.hi); } },
      { key: 'promoWk', label: 'Weeks on promo', render: function (r) { return r.promoWk + ' of ' + r.weeks; } },
      { key: 'recent', label: 'Promo weeks, last 13', render: function (r) { return r.recentWk + ' of ' + r.recentOf; }, sort: function (r) { return r.recentWk; }, csv: function (r) { return r.recentWk; } },
      { key: 'deep', label: 'Deepest recent promo', render: function (r) { return r.deepest == null ? '—' : '−' + r.deepest.toFixed(0) + '%'; }, sort: function (r) { return r.deepest; }, csv: function (r) { return r.deepest; } },
      { key: 'flags', label: 'Status', render: function (r) { return r.flags.map(function (f) { return '<span class="pill ' + (f === 'On promo now' ? 'warn' : f === 'Promotes often' ? 'info' : f === 'Priced above baseline' ? 'bad' : 'good') + '">' + f + '</span>'; }).join(' '); }, sort: function (r) { return r.vs; }, csv: function (r) { return r.flags.join('; '); } }
    ];
    [0, 1, 2].forEach(function (t) {
      var mine = A.tierSkuRows(M, si, t, true), comp = A.tierSkuRows(M, si, t, false);
      mine.forEach(function (r) { r._cls = 'me'; });
      table($('sk' + t), 'sk' + t, cols, mine.concat(comp));
    });
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
  function viewShare() {
    var si = state.seg, bs = A.brands(M, si).filter(function (b) { return b !== 'All competitors'; });
    var LO = Wd.h[0], cw = A.cleanWeeks(Wd.h), f6 = cw.slice(0, 6), l6 = cw.slice(-6), ss = {}; bs.forEach(function (b) { ss[b] = A.shareSeries(M, si, b); });
    var chg = bs.map(function (b) { var c = A.shareChange(M, si, b); return { _cls: b === 'Britax group' ? 'me' : '', brand: shortName(b), was: c.was, now: c.now, d: c.d }; });
    var gainers = chg.filter(function (r) { return r.brand.indexOf('Britax') < 0 && fin(r.d) && r.d >= 0.3; }).sort(function (a, b) { return b.d - a.d; });
    var bc = chg.filter(function (r) { return r.brand.indexOf('Britax') === 0; })[0];
    var series = bs.map(function (b, i) { return { name: shortName(b), color: b === 'Britax group' ? BRITAX : COLORS[i % COLORS.length], bold: b === 'Britax group', vals: ss[b] }; }).filter(function (s) { return s.vals.slice(LO).some(fin); });
    var h = '<section class="card"><h2>How did share move around 2026 Prime days?</h2><p class="sub">' + esc(SEG[si]) + ' · share of sales ($) among tracked brands in the category, weekly, last 6 months (' + esc(A.monthName(A.mKey(Wd.ix - 5))) + ' to ' + esc(Wd.label) + ')</p>';
    h += '<div class="answer"><p><b>Britax:</b> ' + (bc ? f1(bc.was) + '% → ' + f1(bc.now) + '% (' + pts(bc.d) + ') between the first and last six clean weeks.' : 'No read.') + ' <b>Gaining share:</b> ' + (gainers.length ? gainers.slice(0, 3).map(function (r) { return esc(r.brand) + ' ' + pts(r.d); }).join(', ') : 'no competitor gained 0.3 pts or more') + '.</p></div>';
    var cOpts = { lo: LO, hi: LAST, series: series, aria: 'Weekly share of sales', unit: '%', floor0: true };
    h += legend(series.map(function (s) { return sw(s.color, esc(s.name)); }).concat([primeKey]));
    h += lineChart('c2', cOpts) + tierHtml('chart', si) + '</section>';
    h += '<section class="card"><h2>Has everyday share changed? (excluding Prime weeks)</h2><p class="sub">Average share in the first six weeks of the last six months (' + A.wkLabel(f6[0]) + ' to ' + A.wkLabel(f6[f6.length - 1]) + ') vs the latest six (' + A.wkLabel(l6[0]) + ' to ' + A.wkLabel(l6[l6.length - 1]) + '), Prime and Black Friday weeks left out.</p><div class="scroll"><table class="tbl" id="t8"></table></div>' + csvBtn('t8') + '' + tierHtml('change', si) + '</section>';
    PRIME.filter(function (e) { return e.week >= LO && e.week <= LAST; }).forEach(function (e, i) {
      var prov = e.week + 3 > LAST;
      h += '<section class="card"><h2>' + esc(e.label) + '</h2>' + held('the promotion columns compare event-week prices with a 12-month baseline ending at the latest week.') + '<p class="sub">Promo columns: price in the event week vs each brand’s 12-month baseline; on promo = 5% or more below. Before = 3 weeks before the event · during = event week · after = ' + (prov ? 'the week after (provisional: later weeks are not in yet)' : 'the 3 weeks after') + '</p><div class="scroll"><table class="tbl" id="te' + i + '"></table></div>' + csvBtn('te' + i) + tierHtml('event', si, i) + '</section>';
    });
    $('view').innerHTML = h;
    drawTierTables(si);
    wireTip('c2', cOpts);
    var pc = function (k) { return { key: k, label: k, render: function (r) { return fin(r[k]) ? f1(r[k]) + '%' : '—'; }, csv: function (r) { return r[k]; } }; };
    table($('t8'), 't8', [{ key: 'brand', label: 'Brand', l: 1 }, { key: 'was', label: 'Earlier', render: function (r) { return fin(r.was) ? f1(r.was) + '%' : '—'; } }, { key: 'now', label: 'Latest', render: function (r) { return fin(r.now) ? f1(r.now) + '%' : '—'; } },
      { key: 'd', label: 'Change', render: function (r) { return '<b class="' + gcls(r.d) + '">' + pts(r.d) + '</b>'; }, csv: function (r) { return r.d; } }], chg);
    PRIME.filter(function (e) { return e.week >= LO && e.week <= LAST; }).forEach(function (e, i) {
      var rows = bs.map(function (b) { var s = A.shareEvent(M, si, b, e.week); return { _cls: b === 'Britax group' ? 'me' : '', brand: shortName(b), before: s.before, during: s.during, after: s.after, dd: s.dDuring, da: s.after == null ? null : s.dAfter, ix: M.r12[si][b].idx[e.week] }; });
      table($('te' + i), 'te' + i, [{ key: 'brand', label: 'Brand', l: 1 },
        { key: 'before', label: 'Before', render: function (r) { return fin(r.before) ? f1(r.before) + '%' : '—'; } },
        { key: 'during', label: 'During', render: function (r) { return fin(r.during) ? f1(r.during) + '%' : '—'; } },
        { key: 'after', label: 'After', render: function (r) { return fin(r.after) ? f1(r.after) + '%' : '—'; } },
        { key: 'dd', label: 'During vs before', render: function (r) { return '<span class="' + gcls(r.dd) + '">' + pts(r.dd) + '</span>'; }, csv: function (r) { return r.dd; } },
        { key: 'da', label: 'After vs before', render: function (r) { return '<span class="' + gcls(r.da) + '">' + pts(r.da) + '</span>'; }, csv: function (r) { return r.da; } },
        { key: 'promo', label: 'On promo in event week?', render: function (r) { return !fin(r.ix) ? '—' : r.ix <= 95 ? '<span class="pill warn">Yes</span>' : '<span class="pill plain">No</span>'; }, sort: function (r) { return fin(r.ix) ? 100 - r.ix : null; }, csv: function (r) { return !fin(r.ix) ? '' : r.ix <= 95 ? 'Yes' : 'No'; } },
        { key: 'depth', label: 'Promo depth vs 12-month average price', render: function (r) { return !fin(r.ix) ? '—' : r.ix < 100 ? '<span class="' + (r.ix <= 95 ? 'down' : '') + '">−' + (100 - r.ix).toFixed(1) + '%</span>' : '+' + (r.ix - 100).toFixed(1) + '%'; }, sort: function (r) { return fin(r.ix) ? 100 - r.ix : null; }, csv: function (r) { return fin(r.ix) ? 100 - r.ix : ''; } },
        { key: 'read', label: 'Read', render: function (r) { return readPill(r.dd, r.da); }, sort: function (r) { return r.dd; }, csv: function (r) { return ''; } }], rows);
    });
  }


  // ====================== price tiers (collapsible blocks inside the price, promo and Prime-day cards) ======================
  var TIER_COLORS = ['#067647', '#1F22B2', '#B54708'];
  var tierNote = function (si) { return [0, 1, 2].map(function (t) { return '<b>' + A.TIER_NAMES[t] + '</b> ' + A.tierRange(si, t); }).join(' · '); };
  var TG = ['Britax group', 'All competitors'];
  var tgname = function (g) { return g === 'Britax group' ? 'Britax (incl. Bob Gear)' : g; };
  // Each block is closed by default; tables and the chart inside are filled by drawTierTables() once the card is on the page.
  function tierHtml(kind, si, i) {
    var intro = '<p class="sub">' + esc(SEG[si]) + ' · price tiers, set by each product’s own average price since Jan 2024 (about a third of the category’s ' + Y + ' YTD sales in each): ' + tierNote(si) + '.</p>', body = '';
    if (kind === 'price') body = '<p class="sub">Simple average across products (each counts once, promotions included): Britax, each top competitor, all competitors and every tracked product in the tier.</p><div class="scroll"><table class="tbl" id="tt2"></table></div>' + csvBtn('tt2') + '<p class="rule">Competitors shown are the category’s top 5 by sales; “All competitors” covers every tracked competitor brand. A dash means fewer than 3 products sold in the period. Price vs Britax compares 2026 YTD prices.</p>';
    else if (kind === 'promo') body = held('the 6-month promotion window and its baseline are fixed to the latest data.') + '<p class="sub">Last 6 months, simple average across products; a product is on promotion in a week when its price is 5% or more below its own 12-month average selling price.</p><div class="scroll"><table class="tbl" id="tt3"></table></div>' + csvBtn('tt3') + '<p class="rule">A dash means fewer than 3 products with promoted (or non-promoted) weeks. The two groups can contain different products.</p>';
    else if (kind === 'cmp') body = '<p class="sub">Same measures as the share comparison, within each price tier: Britax and each top competitor, ' + Y + ' YTD vs ' + PY + '.</p><div class="scroll"><table class="tbl" id="tt1b"></table></div>' + csvBtn('tt1b') + '<p class="rule">Share = brand sales ÷ sales of every tracked brand in the same tier. Tier total = every tracked product in the tier. Where a brand sells few products in a tier, read share moves with care.</p>';
    else if (kind === 'vs') body = '<p class="sub">Share in Prime weeks vs other weeks, ' + Y + ' YTD, Britax and each top competitor within each tier.</p><div class="scroll"><table class="tbl" id="tt4"></table></div>' + csvBtn('tt4') + '<p class="rule">Share = brand sales ÷ sales of every tracked brand in the same tier. Prime weeks = the event week plus the week before and after. Where a brand sells few products in a tier, read share moves with care.</p>';
    else if (kind === 'chart') body = '<p class="sub">Share of sales within each tier, weekly, last 6 months.</p><div class="controls"><label>Brand <select id="tierBrand">' + A.tierBrands(M, si).map(function (b) { return '<option value="' + esc(b) + '"' + (b === state.tierBrand ? ' selected' : '') + '>' + esc(tgname(b)) + '</option>'; }).join('') + '</select></label></div>' + legend([0, 1, 2].map(function (t) { return sw(TIER_COLORS[t], A.TIER_NAMES[t]); }).concat([primeKey])) + '<div id="ct1box">' + lineChart('ct1', tierChartOpts(si)) + '</div>';
    else if (kind === 'change') body = '<div class="scroll"><table class="tbl" id="tt5"></table></div>' + csvBtn('tt5');
    else if (kind === 'event') body = '<div class="scroll"><table class="tbl" id="tt-e' + i + '"></table></div>' + csvBtn('tt-e' + i);
    return '<details class="tier"><summary>By price tier</summary>' + intro + body + '</details>';
  }
  function tierChartOpts(si) {
    var g = A.tierBrands(M, si).indexOf(state.tierBrand) >= 0 ? state.tierBrand : 'Britax group';
    var series = [0, 1, 2].map(function (t) { return { name: tgname(g) + ' · ' + A.TIER_NAMES[t] + ' tier', color: TIER_COLORS[t], bold: true, vals: A.tierShareSeries(M, si, t, g) }; });
    return { lo: Wd.h[0], hi: LAST, series: series.filter(function (s) { return s.vals.slice(Wd.h[0]).some(fin); }), aria: 'Weekly share of sales by price tier', unit: '%', floor0: true };
  }
  function drawTierTables(si) {
    var pcf = function (k) { return function (r) { return fin(r[k]) ? f1(r[k]) + '%' : '—'; }; };
    var chgc = function (k, d) { return function (r) { return '<span class="' + cls(r[k]) + '">' + sgn(r[k], d == null ? 1 : d) + '</span>'; }; };
    var ptsc = function (k) { return function (r) { return '<b class="' + gcls(r[k]) + '">' + pts(r[k]) + '</b>'; }; };
    var csvs = function (k) { return function (r) { return r[k]; }; };
    var usdc = function (k) { return function (r) { return usd(r[k]); }; };
    var tcol = { key: 'tlabel', label: 'Price tier', l: 1, render: function (r) { return r._first ? '<b>' + esc(r.tlabel) + '</b>' : ''; }, sort: function (r) { return r.tlabel; } };
    var bcol = { key: 'brand', label: 'Brand', l: 1 };
    var cls0 = function (b) { return b === 'Britax group' || b.indexOf('Britax') === 0 ? 'me' : b === 'Tier overall' ? 'all' : ''; };
    if ($('ct1')) {
      wireTip('ct1', tierChartOpts(si));
      $('tierBrand').onchange = function () { state.tierBrand = this.value; var o = tierChartOpts(si); $('ct1box').innerHTML = lineChart('ct1', o); wireTip('ct1', o); };
    }
    if ($('tt1')) {
      var ov = A.tierOverview(M, si), worst = ov.rows.filter(function (r) { return fin(r.impact); }).sort(function (x, y) { return x.impact - y.impact; })[0];
      table($('tt1'), 'tt1', [
        { key: 'label', label: 'Price tier', l: 1 },
        { key: 'mix', label: 'Tier share of category sales', render: pcf('mix'), csv: csvs('mix') },
        { key: 'catChg', label: 'Category sales vs same weeks ' + PY, render: chgc('catChg', 0), csv: csvs('catChg') },
        { key: 'b26', label: 'Britax sales, ' + Y + ' YTD', render: function (r) { return usdM(r.b26); }, csv: csvs('b26') },
        { key: 'bChg', label: 'Britax sales vs same weeks ' + PY, render: chgc('bChg', 0), csv: csvs('bChg') },
        { key: 'sh25', label: 'Britax share, ' + PY, render: function (r) { return fin(r.sh25) ? r.sh25.toFixed(2) + '%' : '—'; }, csv: csvs('sh25') },
        { key: 'sh26', label: 'Britax share, ' + Y + ' YTD', render: function (r) { return fin(r.sh26) ? r.sh26.toFixed(2) + '%' : '—'; }, csv: csvs('sh26') },
        { key: 'd', label: 'Share change', render: function (r) { return '<b class="' + gcls(r.d) + '">' + (fin(r.d) ? (r.d > 0.0049 ? '+' : r.d < -0.0049 ? '−' : '') + Math.abs(r.d).toFixed(2) + ' pts' : '—') + '</b>'; }, csv: csvs('d') },
        { key: 'impact', label: 'Sales effect of share change', render: function (r) { return fin(r.impact) ? '<b class="' + gcls(r.impact) + '">' + (r.impact >= 0 ? '+' : '−') + '$' + Math.abs(r.impact / 1e6).toFixed(2) + 'M</b>' : '—'; }, csv: csvs('impact') }
      ], ov.rows.map(function (r) { r._cls = worst && r.t === worst.t && r.impact < 0 ? 'me' : ''; return r; }));
    }
    var BR = A.tierBrands(M, si), brRows = [], priceRows = [], promoRows = [], vsRows = [], chgRows = [];
    [0, 1, 2].forEach(function (t) {
      if ($('tt1b')) BR.concat(['All competitors', 'Segment total']).forEach(function (g, j) { var x = A.tierBrandCompare(M, si, t, g); x._cls = g === 'Britax group' ? 'me' : g === 'All competitors' || g === 'Segment total' ? 'all' : ''; x._first = j === 0; x.tlabel = A.tierLabel(si, t); x.brand = g === 'Segment total' ? 'Tier total' : tgname(g); brRows.push(x); });
      if ($('tt2')) A.tierPrice(M, si, t).forEach(function (x, j) { var r = x.r; priceRows.push({ _cls: cls0(x.brand), _first: j === 0, tlabel: A.tierLabel(si, t), brand: tgname(x.brand), n: r.n, p25: r.p25, c25: r.c25, p26y: r.p26y, c26y: r.c26y, pOct: r.pOct, cOct: r.cOct, vsB: r.vsB }); });
      if ($('tt3')) A.tierPromo(M, si, t).forEach(function (x, j) { var r = x.r; promoRows.push({ _cls: cls0(x.brand), _first: j === 0, tlabel: A.tierLabel(si, t), brand: tgname(x.brand), nn: r.nn, off: r.off, np: r.np, on: r.on, gap: r.gap }); });
      BR.forEach(function (g, j) {
        if ($('tt4')) { var v = A.tierPrimeVs(M, si, t, g); v._cls = g === 'Britax group' ? 'me' : ''; v._first = j === 0; v.tlabel = A.tierLabel(si, t); v.brand = tgname(g); vsRows.push(v); }
        if ($('tt5')) { var c = A.tierChange(M, si, t, g); chgRows.push({ _cls: g === 'Britax group' ? 'me' : '', _first: j === 0, tlabel: A.tierLabel(si, t), brand: tgname(g), was: c.was, now: c.now, d: c.d }); }
      });
    });
    if ($('tt1b')) table($('tt1b'), 'tt1b', [tcol, bcol,
      { key: 's26', label: 'Estimated sales, ' + Y + ' YTD', render: function (r) { return usdM(r.s26); }, csv: csvs('s26') }, { key: 's25', label: 'Estimated sales, ' + PY, render: function (r) { return usdM(r.s25); }, csv: csvs('s25') },
      { key: 's25b', label: 'Estimated sales, ' + PY + ' same weeks', render: function (r) { return usdM(r.s25b); }, csv: csvs('s25b') }, { key: 'chg', label: '% change vs same weeks', render: chgc('chg', 2), csv: csvs('chg') },
      { key: 'sh26', label: 'Market share, ' + Y + ' YTD', render: function (r) { return fin(r.sh26) ? r.sh26.toFixed(2) + '%' : '—'; }, csv: csvs('sh26') }, { key: 'sh25', label: 'Market share, ' + PY, render: function (r) { return fin(r.sh25) ? r.sh25.toFixed(2) + '%' : '—'; }, csv: csvs('sh25') },
      { key: 'd', label: 'Difference', render: function (r) { return '<b class="' + gcls(r.d) + '">' + (fin(r.d) ? (r.d > 0.0049 ? '+' : r.d < -0.0049 ? '−' : '') + Math.abs(r.d).toFixed(2) + '%' : '—') + '</b>'; }, csv: csvs('d') }], brRows);
    if ($('tt2')) table($('tt2'), 'tt2', [tcol, bcol,
      { key: 'n', label: 'Products sold, ' + Y + ' YTD', render: function (r) { return num(r.n); }, csv: csvs('n') },
      { key: 'p25', label: PY + ' avg price', render: usdc('p25'), csv: csvs('p25') }, { key: 'c25', label: 'vs ' + (PY - 1), render: chgc('c25'), csv: csvs('c25') },
      { key: 'p26y', label: Y + ' YTD avg price', render: usdc('p26y'), csv: csvs('p26y') }, { key: 'c26y', label: 'vs ' + PY + ' YTD', render: chgc('c26y'), csv: csvs('c26y') },
      { key: 'pOct', label: Wd.label + ' avg price', render: usdc('pOct'), csv: csvs('pOct') }, { key: 'cOct', label: 'vs ' + A.monthName(A.mKey(Wd.ix - 1)), render: chgc('cOct'), csv: csvs('cOct') },
      { key: 'vsB', label: 'Price vs Britax', render: function (r) { return r.brand.indexOf('Britax') === 0 ? '—' : '<span class="' + cls(r.vsB) + '">' + sgn(r.vsB, 0) + '</span>'; }, csv: csvs('vsB') }
    ], priceRows);
    if ($('tt3')) table($('tt3'), 'tt3', [tcol, bcol,
      { key: 'nn', label: 'Products off promo', render: function (r) { return num(r.nn); }, csv: csvs('nn') }, { key: 'off', label: '6-month avg price (not on promo)', render: usdc('off'), csv: csvs('off') },
      { key: 'np', label: 'Products on promo', render: function (r) { return num(r.np); }, csv: csvs('np') }, { key: 'on', label: 'Avg price, on promo', render: usdc('on'), csv: csvs('on') },
      { key: 'gap', label: 'On promo vs not on promo', render: function (r) { return '<b class="' + (r.gap < 0 ? 'down' : '') + '">' + sgn(r.gap) + '</b>'; }, csv: csvs('gap') }
    ], promoRows);
    if ($('tt4')) table($('tt4'), 'tt4', [tcol, bcol,
      { key: 'a', label: Y + ' YTD share', render: pcf('a'), csv: csvs('a') }, { key: 'o', label: 'Other weeks', render: pcf('o'), csv: csvs('o') }, { key: 'p', label: 'Prime weeks', render: pcf('p'), csv: csvs('p') },
      { key: 'lift', label: 'Prime weeks vs other', render: ptsc('lift'), csv: csvs('lift') },
      { key: 'f', label: 'First quarter of ' + Y, render: pcf('f'), csv: csvs('f') }, { key: 'l', label: 'Last quarter', render: pcf('l'), csv: csvs('l') }, { key: 'd', label: 'Change', render: ptsc('d'), csv: csvs('d') }
    ], vsRows);
    if ($('tt5')) table($('tt5'), 'tt5', [tcol, bcol, { key: 'was', label: 'Earlier', render: pcf('was'), csv: csvs('was') }, { key: 'now', label: 'Latest', render: pcf('now'), csv: csvs('now') }, { key: 'd', label: 'Change', render: ptsc('d'), csv: csvs('d') }], chgRows);
    PRIME.filter(function (e) { return e.week >= Wd.h[0] && e.week <= LAST; }).forEach(function (e, i) {
      var el = $('tt-e' + i); if (!el) return;
      var rows = [];
      [0, 1, 2].forEach(function (t) { BR.concat(['All competitors']).forEach(function (g, j) { var s = A.tierEvent(M, si, t, g, e.week); rows.push({ _cls: g === 'Britax group' ? 'me' : '', _first: j === 0, tlabel: A.tierLabel(si, t), brand: tgname(g), before: s.before, during: s.during, after: s.after, dd: s.dDuring, da: s.after == null ? null : s.dAfter, ix: s.ix }); }); });
      table(el, 'tt-e' + i, [tcol, bcol,
        { key: 'before', label: 'Before', render: pcf('before'), csv: csvs('before') }, { key: 'during', label: 'During', render: pcf('during'), csv: csvs('during') }, { key: 'after', label: 'After', render: pcf('after'), csv: csvs('after') },
        { key: 'dd', label: 'During vs before', render: function (r) { return '<span class="' + gcls(r.dd) + '">' + pts(r.dd) + '</span>'; }, csv: csvs('dd') },
        { key: 'da', label: 'After vs before', render: function (r) { return '<span class="' + gcls(r.da) + '">' + pts(r.da) + '</span>'; }, csv: csvs('da') },
        { key: 'promo', label: 'On promo in event week?', render: function (r) { return !fin(r.ix) ? '—' : r.ix <= 95 ? '<span class="pill warn">Yes</span>' : '<span class="pill plain">No</span>'; }, sort: function (r) { return fin(r.ix) ? 100 - r.ix : null; }, csv: function (r) { return !fin(r.ix) ? '' : r.ix <= 95 ? 'Yes' : 'No'; } },
        { key: 'depth', label: 'Promo depth vs 12-month average price', render: function (r) { return !fin(r.ix) ? '—' : r.ix < 100 ? '<span class="' + (r.ix <= 95 ? 'down' : '') + '">−' + (100 - r.ix).toFixed(1) + '%</span>' : '+' + (r.ix - 100).toFixed(1) + '%'; }, sort: function (r) { return fin(r.ix) ? 100 - r.ix : null; }, csv: function (r) { return fin(r.ix) ? 100 - r.ix : ''; } },
        { key: 'read', label: 'Read', render: function (r) { return readPill(r.dd, r.da); }, sort: function (r) { return r.dd; }, csv: function () { return ''; } }
      ], rows);
    });
  }

  // ====================== view: price elasticity ======================
  function viewElasticity() {
    var si = state.seg, rows = A.elastRows(M, si), cname = si === 4 ? 'all categories' : SEG[si];
    var all = rows.filter(function (r) { return r.gr === 'All own' && r.tr === 3; })[0];
    var st = all ? A.elastStat(all) : null;
    var lvl = function (e) { return !fin(e) ? '' : Math.abs(e) >= 3 ? 'high' : Math.abs(e) >= 1.5 ? 'medium' : 'low'; };
    var h = '<section class="card"><h2>How price-sensitive are Britax products?</h2>' + held('elasticity weights use 2026 YTD sales to the latest week.') + '<p class="sub">' + esc(segName(si)) + ' · elasticity = the % change in units for a 1% change in price (always negative: a higher price sells fewer units). Source: the CommerceIQ price elasticity feed for Britax group ASINs, <b>latest 2026 feed (Mar 29, 2026)</b>; every product’s model included, weighted by its 2026 YTD sales (weeks of Dec 28, 2025 to Oct 11, 2026).</p>';
    h += '<div class="answer"><p>' + (st && fin(st.wAll) ? '<b>' + esc(segName(si)) + ':</b> a 1% price increase goes with about <b>' + Math.abs(st.wAll).toFixed(1) + '%</b> fewer units (' + lvl(st.wAll) + ' sensitivity), measured on ' + st.ne + ' products with an elasticity model, which cover ' + st.cov.toFixed(0) + '% of Britax group sales in the category.' : 'Not enough models for this selection.') + ' ' + (si === 4 ? 'The categories differ a lot, so read the category rows below.' : '') + '</p></div>';
    h += '<div class="scroll"><table class="tbl" id="te1"></table></div>' + csvBtn('te1') + '<p class="rule"><b>Elasticity</b> = sum of (2026 YTD sales × the product’s elasticity) ÷ sales, over every product with a model. Price tiers use each category’s own cut-offs (see the “By price tier” blocks on the price and Prime-day cards). Elasticity is modelled only for Britax group products, so there are no competitor values. The feed’s latest date is Mar 29, 2026, so it reflects the first quarter of 2026 rather than the full year to date.</p></section>';
    h += '<section class="card"><h2>Where is demand most price-sensitive?</h2>' + held('elasticity weights use 2026 YTD sales to the latest week.') + '<p class="sub">Britax group, 2026 YTD sales weights. Bars show the sales-weighted elasticity.</p><div class="scroll"><table class="tbl" id="te2"></table></div>' + csvBtn('te2') + '</section>';
    $('view').innerHTML = h;
    var fmt = function (v) { return fin(v) ? v.toFixed(2) : '—'; };
    var bar = function (v) { return fin(v) ? '<span style="display:inline-block;height:8px;border-radius:4px;vertical-align:middle;margin-right:8px;width:' + Math.min(110, Math.round(Math.abs(v) / 6 * 110)) + 'px;background:' + (v > 0 ? '#D0D5DD' : Math.abs(v) >= 3 ? '#C231FF' : Math.abs(v) >= 1.5 ? '#5AAFFE' : '#B9DDF5') + '"></span>' + v.toFixed(2) : '—'; };
    var lab = function (r) { return r.gr === 'All own' ? (r.tr === 3 ? 'Britax group, all tiers' : 'Britax group · ' + A.TIER_NAMES[r.tr] + ' tier') : r.gr === 'Britax' ? 'Brand: Britax' : 'Brand: Bob Gear'; };
    var order = function (r) { return r.gr === 'All own' ? r.tr : 4 + (r.gr === 'Britax' ? 0 : 1); };
    var trs = rows.slice().sort(function (a, b) { return order(a) - order(b); }).map(function (r) { var s = A.elastStat(r); s._cls = r.gr === 'All own' && r.tr === 3 ? 'me' : ''; s.label = lab(r); return s; });
    var c = function (k, label, f) { return { key: k, label: label, render: function (r) { return f(r[k]); }, csv: function (r) { return r[k]; } }; };
    table($('te1'), 'te1', [{ key: 'label', label: 'Level', l: 1 },
      c('n', 'Products sold, 2026 YTD', num), c('ne', 'Products with a model', num),
      c('cov', 'Sales covered by a model', function (v) { return fin(v) ? v.toFixed(0) + '%' : '—'; }),
      { key: 'wAll', label: 'Elasticity (sales-weighted)', render: function (r) { return bar(r.wAll); }, csv: function (r) { return r.wAll; }, sort: function (r) { return r.wAll == null ? null : -r.wAll; } },
    ], trs);
    var cats = [0, 1, 2, 3, 4], ov = [];
    cats.forEach(function (cs) {
      var r = A.elastRows(M, cs).filter(function (x) { return x.gr === 'All own' && x.tr === 3; })[0]; if (!r) return;
      var s = A.elastStat(r); s.label = segName(cs) + ' · Britax group'; s._cls = cs === si ? 'me' : ''; ov.push(s);
      A.elastRows(M, cs).filter(function (x) { return x.gr !== 'All own'; }).forEach(function (b) { var t = A.elastStat(b); t.label = segName(cs) + ' · ' + b.gr; t._cls = ''; if (cs < 4) ov.push(t); });
    });
    table($('te2'), 'te2', [{ key: 'label', label: 'Level', l: 1 }, c('ne', 'Products with a model', num), c('cov', 'Sales covered', function (v) { return fin(v) ? v.toFixed(0) + '%' : '—'; }),
      { key: 'wAll', label: 'Elasticity (sales-weighted)', render: function (r) { return bar(r.wAll); }, csv: function (r) { return r.wAll; }, sort: function (r) { return r.wAll == null ? null : -r.wAll; } }], ov);
  }

  // ====================== views 5 and 6: share comparison and category summary ======================
  var segName = function (i) { return i === 4 ? 'All categories' : SEG[i]; };
  var usdM = function (v) { return !fin(v) ? '—' : '$' + Math.round(v).toLocaleString('en-US'); };
  var pct2 = function (v) { return !fin(v) ? '—' : v.toFixed(2) + '%'; };
  function compareHtml() {
    var si = state.seg, c = A.compareRows(M, si);
    if (!c) { return '<section class="card"><p class="muted">No data for this category.</p></section>'; }
    var best = c.comps.filter(function (r) { return r.d > 0; }).sort(function (x, y) { return y.d - x.d; })[0];
    var h = '<section class="card"><h2>Share comparison: ' + Y + ' year to date vs ' + PY + '</h2><p class="sub">' + esc(segName(si)) + ' · Amazon US estimated sales and share of all tracked brands in the category. ' + Y + ' YTD = weeks of ' + Wd.range(Wd.ytd) + '; ' + PY + ' = weeks of ' + Wd.range(Wd.py) + '; ' + PY + ' same weeks = ' + Wd.range(Wd.pytd) + '. A week counts in the month it ends in, which reproduces the CommerceIQ platform’s windows.</p>';
    h += '<div class="answer"><p><b>Britax group:</b> ' + pct2(c.britax.sh26) + ' share in ' + Y + ' YTD vs ' + pct2(c.britax.sh25) + ' in ' + PY + ' (<b class="' + gcls(c.britax.d) + '">' + pts(c.britax.d) + '</b>); sales ' + sgn(c.britax.chg) + ' vs the same weeks of ' + PY + ' while the category moved ' + sgn(c.totalChg) + '.' + (best ? ' <b>Biggest competitor share gain:</b> ' + esc(best.brand) + ' ' + pts(best.d) + '.' : '') + '</p></div>';
    var th = '<thead><tr><th class="l" rowspan="2" style="font-weight:800;color:#210235"></th><th class="l" rowspan="2" style="font-weight:800;color:#210235;font-size:14px">Brand</th><th colspan="4" style="text-align:center;background:#CFD9F2;color:#210235;font-weight:800;font-size:14px;letter-spacing:.02em;border-bottom:2px solid #210235">Estimated sales</th><th colspan="3" style="text-align:center;background:#CFD9F2;color:#210235;font-weight:800;font-size:14px;letter-spacing:.02em;border-bottom:2px solid #210235">Market share</th></tr><tr><th style="background:#E3EFD5;font-weight:700;color:#210235;font-size:12.5px">' + Y + ' YTD</th><th style="background:#E3EFD5;font-weight:700;color:#210235;font-size:12.5px">' + PY + '</th><th style="background:#E3EFD5;font-weight:700;color:#210235;font-size:12.5px">' + PY + ' same weeks</th><th style="background:#DDD;font-weight:700;color:#210235;font-size:12.5px">% change vs same weeks</th><th style="background:#E3EFD5;font-weight:700;color:#210235;font-size:12.5px">' + Y + ' YTD</th><th style="background:#E3EFD5;font-weight:700;color:#210235;font-size:12.5px">' + PY + '</th><th style="background:#DDD;font-weight:700;color:#210235;font-size:12.5px">Difference</th></tr></thead>';
    var row = function (r, cl) { return '<tr class="' + cl + '"><td></td><td class="l">' + esc(r.brand) + '</td><td>' + usdM(r.s26) + '</td><td>' + usdM(r.s25) + '</td><td>' + usdM(r.s25b) + '</td><td class="' + gcls(r.chg) + '">' + sgn(r.chg, 2) + '</td><td>' + pct2(r.sh26) + '</td><td>' + pct2(r.sh25) + '</td><td><b class="' + gcls(r.d) + '">' + (fin(r.d) ? (r.d > 0.0049 ? '+' : r.d < -0.0049 ? '−' : '') + Math.abs(r.d).toFixed(2) + '%' : '—') + '</b></td></tr>'; };
    var body = '<tbody><tr><td class="l" colspan="9" style="background:var(--soft);color:var(--ink);font-weight:700">Competitor brands</td></tr>' + c.comps.map(function (r) { return row(r, ''); }).join('') + row(c.top, 'all').replace('<td class="l">', '<td class="l"><b>') .replace('</td><td>', '</b></td><td>') +
      '<tr><td class="l" colspan="9" style="background:#FAF0FF;color:var(--ink);font-weight:700">Client brands</td></tr>' + c.own.map(function (r) { return row(r, 'me'); }).join('') + (c.own.length > 1 ? row(c.britax, 'me') : '') + '</tbody>';
    h += '<div class="scroll"><table class="tbl" id="t12">' + th + body + '</table></div>';
    h += '<p class="rule">% change compares ' + Y + ' YTD with the same weeks of ' + PY + ', so the shorter period does not read as a decline. Difference is ' + Y + ' YTD share minus full-year ' + PY + ' share, in percentage points; full-year ' + PY + ' includes the Q4 peak, so read gains and losses of under 1 pt with care. Top competitors = the eight largest brands in the category (of the pool loaded), ranked on ' + Y + ' YTD sales.</p>' + (si < 4 ? tierHtml('cmp', si) : '') + '</section>';
    h += '<section class="card"><h2>How big is the category?</h2><div class="scroll"><table class="tbl"><thead><tr><th class="l"></th><th>' + Y + ' YTD</th><th>' + PY + '</th><th>' + PY + ' same weeks</th><th>% change vs same weeks</th></tr></thead><tbody><tr class="all"><td class="l">' + esc(segName(si)) + ' total</td><td>' + usdM(c.total.s26) + '</td><td>' + usdM(c.total.s25) + '</td><td>' + usdM(c.total.s25b) + '</td><td class="' + gcls(c.totalChg) + '">' + sgn(c.totalChg, 2) + '</td></tr></tbody></table></div></section>';
    return h;
  }

  function donut(slices, center) {
    var R = 90, r = 56, cx = 110, cy = 110, tot = slices.reduce(function (a, s) { return a + s.v; }, 0) || 1, ang = -Math.PI / 2, out = '';
    slices.forEach(function (s) {
      if (!(s.v > 0)) return;
      var a2 = ang + s.v / tot * 2 * Math.PI, big = a2 - ang > Math.PI ? 1 : 0;
      if (s.v / tot > 0.9999) { out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R + r) / 2 + '" fill="none" stroke="' + s.color + '" stroke-width="' + (R - r) + '"/>'; }
      else out += '<path d="M' + (cx + R * Math.cos(ang)).toFixed(2) + ' ' + (cy + R * Math.sin(ang)).toFixed(2) + ' A' + R + ' ' + R + ' 0 ' + big + ' 1 ' + (cx + R * Math.cos(a2)).toFixed(2) + ' ' + (cy + R * Math.sin(a2)).toFixed(2) + ' L' + (cx + r * Math.cos(a2)).toFixed(2) + ' ' + (cy + r * Math.sin(a2)).toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + big + ' 0 ' + (cx + r * Math.cos(ang)).toFixed(2) + ' ' + (cy + r * Math.sin(ang)).toFixed(2) + 'Z" fill="' + s.color + '" stroke="#fff" stroke-width="1.5"><title>' + esc(s.name) + ' ' + (s.v / tot * 100).toFixed(1) + '%</title></path>';
      ang = a2;
    });
    var leg = slices.map(function (s) { return '<li><span class="sw" style="background:' + s.color + '"></span>' + esc(s.name) + ' <b>' + (s.v / tot * 100).toFixed(1) + '%</b></li>'; }).join('');
    return '<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><svg viewBox="0 0 220 220" width="200" height="200" role="img" aria-label="Donut chart of market share"><g>' + out + '</g><text x="110" y="106" text-anchor="middle" font-size="12" fill="#5b5266">' + esc(center[0]) + '</text><text x="110" y="126" text-anchor="middle" font-size="18" font-weight="700" fill="#210235">' + esc(center[1]) + '</text></svg><ul style="list-style:none;margin:0;padding:0;font-size:13px;line-height:1.7">' + leg + '</ul></div>';
  }

  function summaryHtml() {
    var si = state.seg, c = A.compareRows(M, si);
    if (!c) { return '<section class="card"><p class="muted">No data for this category.</p></section>'; }
    var T = c.total, OTH = '#D0D5DD';
    var britaxDonut = function (k, tk) {
      var b = c.own.reduce(function (a, r) { return a + r[k]; }, 0);
      return donut([{ name: 'Britax group', v: b, color: BRITAX }, { name: 'Others', v: T[tk] - b, color: '#B9DDF5' }], ['Britax group', (b / T[tk] * 100).toFixed(1) + '%']);
    };
    var brandDonut = function (k, tk) {
      var sl = c.own.map(function (r, i) { return { name: r.brand, v: r[k], color: i ? '#8A1FB8' : BRITAX }; }).concat(c.comps.map(function (r, i) { return { name: r.brand, v: r[k], color: COLORS[i % COLORS.length] }; }));
      var used = sl.reduce(function (a, s) { return a + s.v; }, 0);
      sl.push({ name: 'Others', v: T[tk] - used, color: OTH });
      sl.sort(function (a, b) { return a.name === 'Others' ? 1 : b.name === 'Others' ? -1 : b.v - a.v; });
      return donut(sl, [segName(si), '$' + (T[tk] / 1e6).toFixed(1) + 'M']);
    };
    var card = function (title, sub, inner) { return '<section class="card" style="margin-top:0"><h2 style="font-size:16px">' + title + '</h2><p class="sub" style="margin-bottom:6px">' + sub + '</p>' + inner + '</section>'; };
    var h = '<section class="card" style="padding:0;margin-top:0"><h2 style="margin:0;text-align:center;font-size:20px">Market share summary: ' + esc(segName(si)) + '</h2></section>';
    var lane = function (tag, title, meta, left, right) {
      return '<div class="lane"><div class="lane-h"><span class="lane-tag">' + tag + '</span><b>' + title + '</b><span class="lane-meta">' + meta + '</span></div><div class="lane-grid">' + left + right + '</div></div>';
    };
    var dpts = fin(c.britax.d) ? ' · <b class="' + gcls(c.britax.d) + '">' + (c.britax.d >= 0 ? '+' : '−') + Math.abs(c.britax.d).toFixed(2) + ' pts vs ' + PY + '</b>' : '';
    h += lane('Latest', Y + ' year to date', 'Britax ' + pct2(c.britax.sh26) + dpts + ' · category $' + (T.s26 / 1e6).toFixed(1) + 'M',
      card('Britax share of category', Y + ' year to date', britaxDonut('s26', 's26')), card('Who holds the share?', Y + ' year to date, share of estimated sales', brandDonut('s26', 's26')));
    h += lane('Prior year', PY + ' full year', 'Britax ' + pct2(c.britax.sh25) + ' · category $' + (T.s25 / 1e6).toFixed(1) + 'M',
      card('Britax share of category', PY + ' full year', britaxDonut('s25', 's25')), card('Who held the share?', PY + ' full year, share of estimated sales', brandDonut('s25', 's25')));
    var mx = Math.max.apply(null, c.own.concat(c.comps).map(function (r) { return r.n26 || 0; })) || 1;
    var bars = c.own.concat(c.comps).sort(function (a, b) { return (b.n26 || 0) - (a.n26 || 0); }).map(function (r) { return '<div style="display:flex;align-items:center;gap:8px;margin:3px 0;font-size:13px"><span style="width:110px;text-align:right;flex:none">' + esc(r.brand) + '</span><span style="height:12px;border-radius:3px;background:' + (r.own ? BRITAX : '#6AA84F') + ';width:' + Math.max(2, Math.round((r.n26 || 0) / mx * 60)) + '%"></span><b>' + (r.n26 || 0) + '</b></div>'; }).join('');
    if (T.n26 != null) h += '<div style="margin-top:16px">' + card('Brands and ASIN count', Y + ' YTD, ASINs with sales. Total tracked in the category: ' + num(T.n26), bars) + '</div>';
    return h;
  }

  // ====================== method ======================
  function renderMethod() {
    $('method').innerHTML = '<details class="src"><summary>Sources and how to read this</summary><ul class="notes">' +
      '<li><b>Source:</b> weekly Amazon US Market Share estimates (units, sales, average price) for the Britax group (Britax and Bob Gear) and tracked competitors.</li>' +
      '<li><b>Price index:</b> average selling price (sales ÷ units) of all of a brand’s products, indexed to Oct–Dec 2024 non-deal weeks = 100. It includes promotions and moves with product mix.</li>' +
      '<li><b>Promotion:</b> a price at least 5% below the product’s own average selling price (sales ÷ units) over the last 12 months.</li>' +
      '<li><b>Average price on and off promotion:</b> last 6 months (weeks of Apr 19 to Oct 11, 2026); simple average across products of each product’s price in weeks on promotion vs weeks off promotion. Each product counts once, so the difference moves with which products were promoted as well as discount depth.</li>' +
      '<li><b>How average price has changed:</b> Britax and the top 5 competitors by share of sales, on the simple average price across products (each product counts once, not weighted by units; promotions included).</li>' +
      '<li><b>Prime weeks:</b> the event week plus the week before and after. June events: Prime Day Jun 2026. July 2025 stands in for June 2025 because there was no June event. October: Prime Big Deal Days 2025 and 2026. Excluded from stability reads, along with the two weeks before and Black Friday weeks.</li>' +
      '<li><b>Price moves of 5%+:</b> the next four clean weeks average at least 5% away from the prior four, and the move holds 4–7 weeks later. Recent moves marked “too recent to tell”.</li>' +
      '<li><b>Stability, last 6 months:</b> Raised or Cut if the net change is 3% or more; “Stable, promotes often” if four or more clean weeks sit 5% below baseline or the weekly swing is 3 pts or more.</li>' +
      '<li><b>Price tiers:</b> each category’s products are split into three tiers (Value, Mid, Premium) by the product’s own average price since Jan 2024, with cut-offs that put about a third of the category’s 2026 YTD sales in each tier. The “By price tier” block on each of those cards repeats the table or chart by tier, for Britax vs all competitors, to show which tier the share loss comes from.</li>' +
      '<li><b>Price elasticity:</b> from the CommerceIQ price elasticity feed, which models Britax group products only (latest feed Mar 29, 2026). The headline figure is the 2026 YTD sales-weighted elasticity across all products with a model.</li>' +
      '<li><b>Share comparison and summary:</b> estimated sales and share of all tracked brands in the category. the year to date covers the weeks that end in January to the selected month; sales change is against the same weeks a year earlier, and share difference is against the full prior year.</li>' +
      '<li><b>Share:</b> brand sales ($) ÷ sales of all tracked brands in the category, as on the CommerceIQ platform. Estimates, so read small moves (under 0.3 pts) as noise.</li>' +
      '<li><b>Limits:</b> estimates, not reported sales. Brands with too few matching products lack a long trend. The latest Prime event has few weeks after it.</li></ul></details>';
  }

  function viewShareSummary() { $('view').innerHTML = summaryHtml() + compareHtml(); if (state.seg < 4) drawTierTables(state.seg); }

  // Keep each view to title, short description and table or graph: no insight boxes, and the notes under each table sit in a collapsed "Sources and notes" block.
  function tidy() {
    var v = $('view'); if (!v) return;
    Array.prototype.forEach.call(v.querySelectorAll('.answer'), function (e) { e.remove(); });
    Array.prototype.forEach.call(v.querySelectorAll('p.rule'), function (p) {
      if (p.parentNode.tagName === 'DETAILS') return;
      var d = document.createElement('details'); d.className = 'src'; d.innerHTML = '<summary>Sources and notes</summary>';
      p.parentNode.insertBefore(d, p); d.appendChild(p);
    });
  }
  new MutationObserver(tidy).observe($('view'), { childList: true, subtree: true });

  function render() { useMonth(); sync(); drawMonth(); drawTabs(); ({ price: viewPrice, market: viewMarket, skus: viewSkus, share: viewShare, elasticity: viewElasticity, summary: viewShareSummary })[state.view](); }
  renderMethod();
  render();
})();
