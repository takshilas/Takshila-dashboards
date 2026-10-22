// Britax US pricing and share dashboard. Renders from precomputed tables (private/data-*.js); nothing is queried in the browser.
(function () {
  var A = window.BritaxAnalytics;
  var M = A.parse({ weekly: window.BRITAX_WEEKLY, basket: window.BRITAX_BASKET, tariff: window.BRITAX_TARIFF, events: window.BRITAX_EVENTS, moves: window.BRITAX_MOVES, ladder: window.BRITAX_LADDER });
  var SEG = A.SEGMENTS, EV = A.EVENTS, W = A.W, f1 = A.fmt1;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var fmt$ = function (v) { return v == null || !isFinite(v) ? '—' : '$' + Math.round(v).toLocaleString('en-US'); };
  var fmtN = function (v) { return v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString('en-US'); };
  var sgn = function (v, d) { return v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d == null ? 1 : d) + '%'; };
  var pp = function (v) { return v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + ' pts'; };
  var wk = A.wkLabel;
  var LAST = W - 1;

  var q = new URLSearchParams(location.search);
  var state = { seg: clampInt(q.get('seg'), 0, 5, 0), ev: clampInt(q.get('ev'), 0, 3, 2), overlay: {} };
  function clampInt(v, lo, hi, d) { var n = parseInt(v, 10); return isNaN(n) ? d : Math.max(lo, Math.min(hi, n)); }
  function sync() { var u = new URLSearchParams(); u.set('seg', state.seg); u.set('ev', state.ev); history.replaceState(null, '', '?' + u.toString() + location.hash); }

  $('asof').innerHTML = 'Amazon US · weekly Market Share estimates · data through week of <b>' + A.wkIso(LAST) + '</b> · tariff period Jan–Jun 2025 · promotional periods: June and October Prime events';

  // ---------- tabs ----------
  var tabs = $('segTabs');
  SEG.forEach(function (name, i) {
    var b = document.createElement('button');
    b.className = 'tab'; b.setAttribute('role', 'tab'); b.textContent = name; b.dataset.i = i;
    b.onclick = function () { state.seg = i; render(); };
    tabs.appendChild(b);
  });

  // ---------- generic table with sort and csv ----------
  var sortState = {};
  function table(id, cols, rows, opts) {
    opts = opts || {};
    var el = $(id);
    var st = sortState[id];
    var data = rows.slice();
    if (st) {
      var col = cols.filter(function (c) { return c.key === st.key; })[0];
      if (col) data.sort(function (a, b) {
        var x = col.sort ? col.sort(a) : a[col.key], y = col.sort ? col.sort(b) : b[col.key];
        if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
        return (typeof x === 'string' ? x.localeCompare(y) : x - y) * st.dir;
      });
    }
    var html = '<thead><tr>' + cols.map(function (c) {
      var arrow = st && st.key === c.key ? (st.dir > 0 ? ' ▲' : ' ▼') : '';
      return '<th scope="col" class="' + (c.l ? 'l' : '') + '"' + (st && st.key === c.key ? ' aria-sort="' + (st.dir > 0 ? 'ascending' : 'descending') + '"' : '') + '><button data-k="' + c.key + '" title="Sort">' + esc(c.label) + arrow + '</button></th>';
    }).join('') + '</tr></thead><tbody>' + data.map(function (r, ri) {
      return '<tr class="' + (r._cls || '') + '"' + (opts.rowAttr ? ' ' + opts.rowAttr(r) : '') + '>' + cols.map(function (c) {
        var v = c.render ? c.render(r) : esc(r[c.key] == null ? '—' : r[c.key]);
        return '<td class="' + (c.l ? 'l ' : '') + (c.wrap ? 'wrap ' : '') + (c.cls ? c.cls(r) : '') + '">' + v + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody>';
    el.innerHTML = html;
    el.onclick = function (e) {
      var b = e.target.closest('button[data-k]'); if (!b) return;
      var k = b.dataset.k; var cur = sortState[id];
      sortState[id] = { key: k, dir: cur && cur.key === k ? -cur.dir : 1 };
      table(id, cols, rows, opts);
    };
    el._csv = function () { return csv(cols, data); };
  }
  function csv(cols, rows) {
    var strip = function (s) { return String(s).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim(); };
    var line = function (a) { return a.map(function (x) { x = String(x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }).join(','); };
    return [line(cols.map(function (c) { return c.label; }))].concat(rows.map(function (r) { return line(cols.map(function (c) { return strip(c.render ? c.render(r) : (r[c.key] == null ? '' : r[c.key])); })); })).join('\n');
  }
  function download(name, text) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportBtn(tblId, name) { return '<button class="btn ghost" data-export="' + tblId + '" data-name="' + name + '">Export CSV</button>'; }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-export]'); if (!b) return;
    var t = $(b.dataset.export); if (t && t._csv) download(b.dataset.name + '-' + SEG[state.seg].toLowerCase().replace(/[^a-z]+/g, '-') + '.csv', t._csv());
  });

  // diverging inline bar for a % value, +-max
  function dv(v, max) {
    if (v == null) return '';
    var w = Math.min(50, Math.abs(v) / max * 50);
    var style = v >= 0 ? 'left:50%;width:' + w + '%;background:#B42318' : 'right:50%;width:' + w + '%;background:#067647';
    return '<span class="dv" aria-hidden="true"><i style="' + style + '"></i></span>';
  }
  function chgCls(v) { return v == null ? '' : v > 0.5 ? 'up' : v < -0.5 ? 'down' : ''; }

  // ---------- line chart (inline SVG) ----------
  var charts = {};
  function lineChart(id, o) {
    charts[id] = o;
    var wrap = $(id), svg = wrap.querySelector('svg'), tip = wrap.querySelector('.tip');
    var w = Math.max(wrap.clientWidth, 320), h = o.h || 320, m = { l: 54, r: 14, t: 16, b: 30 };
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h); svg.setAttribute('width', w); svg.setAttribute('height', h);
    var lo = o.lo, hi = o.hi, n = hi - lo;
    var vis = o.series.filter(function (s) { return s.show !== false; });
    var vals = []; vis.forEach(function (s) { for (var i = lo; i <= hi; i++) if (s.vals[i] != null) vals.push(s.vals[i]); });
    if (!vals.length) { svg.innerHTML = '<text x="' + w / 2 + '" y="' + h / 2 + '" text-anchor="middle" fill="#5b5266">No data for this view</text>'; return; }
    var ymin = Math.min.apply(null, vals), ymax = Math.max.apply(null, vals), pad = (ymax - ymin) * 0.08 || 5;
    var step = niceStep((ymax - ymin + 2 * pad) / 4);
    var y0 = o.zero ? 0 : Math.floor((ymin - pad) / step) * step, y1 = Math.ceil((ymax + pad) / step) * step;
    var x = function (i) { return m.l + (w - m.l - m.r) * (i - lo) / n; };
    var y = function (v) { return h - m.b - (h - m.t - m.b) * (v - y0) / (y1 - y0); };
    var out = '', cw = (w - m.l - m.r) / n;
    if (o.bands !== false) {
      var tw = A.TARIFF_WINDOW; var a = Math.max(lo, tw[0]), b = Math.min(hi, tw[1] + 1);
      if (b > a) out += '<rect x="' + x(a) + '" y="' + m.t + '" width="' + (x(b) - x(a)) + '" height="' + (h - m.t - m.b) + '" fill="#5AAFFE" fill-opacity=".13"/><text x="' + (x(a) + 4) + '" y="' + (m.t + 11) + '" font-size="10.5" fill="#1F22B2">Tariff period</text>';
      A.DEAL_PERIODS.forEach(function (d) { if (d[1] >= lo && d[0] <= hi) out += '<rect x="' + x(Math.max(lo, d[0])) + '" y="' + m.t + '" width="' + (x(Math.min(hi, d[1] + 1)) - x(Math.max(lo, d[0]))) + '" height="' + (h - m.t - m.b) + '" fill="#9a93a5" fill-opacity=".12"/>'; });
      EV.forEach(function (e) { if (e.week >= lo && e.week <= hi) out += '<rect x="' + x(e.week) + '" y="' + m.t + '" width="' + Math.max(cw, 3) + '" height="' + (h - m.t - m.b) + '" fill="#C231FF" fill-opacity=".2"/><text x="' + (x(e.week) + Math.max(cw, 3) / 2) + '" y="' + (h - m.b - 4) + '" font-size="10" fill="#7a1fa3" text-anchor="middle" transform="rotate(-90 ' + (x(e.week) + Math.max(cw, 3) / 2) + ' ' + (h - m.b - 4) + ')" dx="2" style="text-anchor:start">' + e.short + '</text>'; });
    }
    for (var t = y0; t <= y1 + 1e-9; t += step) out += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + y(t) + '" y2="' + y(t) + '" stroke="#E7E2EC"/><text x="' + (m.l - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end" font-size="11" fill="#5b5266">' + (o.yfmt ? o.yfmt(t) : Math.round(t)) + '</text>';
    var lastM = -1, minGap = 54, lastX = -999;
    for (var i = lo; i <= hi; i++) { var d = A.wkDate(i), mo = d.getUTCMonth() + d.getUTCFullYear() * 12; if (mo !== lastM) { lastM = mo; if (x(i) - lastX >= minGap) { lastX = x(i); out += '<text x="' + x(i) + '" y="' + (h - 9) + '" text-anchor="middle" font-size="11" fill="#5b5266">' + A.monthLabel(i) + '</text>'; } } }
    if (o.ref != null) out += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + y(o.ref) + '" y2="' + y(o.ref) + '" stroke="#210235" stroke-opacity=".45" stroke-dasharray="4 3"/>';
    vis.forEach(function (s) {
      var d = '', pen = false, dots = '';
      for (var i = lo; i <= hi; i++) { var v = s.vals[i]; if (v != null) { d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); pen = true; var prev = s.vals[i - 1], next = s.vals[i + 1]; if (prev == null && next == null) dots += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="2.2" fill="' + s.color + '"/>'; } else pen = false; }
      out += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="' + (s.width || 2) + '" stroke-linejoin="round" stroke-linecap="round"' + (s.dash ? ' stroke-dasharray="' + s.dash + '"' : '') + '/>' + dots;
    });
    out += '<line id="' + id + '-xh" y1="' + m.t + '" y2="' + (h - m.b) + '" stroke="#210235" stroke-opacity=".35" style="display:none"/>';
    out += '<rect id="' + id + '-hit" x="' + m.l + '" y="' + m.t + '" width="' + (w - m.l - m.r) + '" height="' + (h - m.t - m.b) + '" fill="transparent"/>';
    svg.innerHTML = out;
    var hit = $(id + '-hit'), xh = $(id + '-xh');
    function show(ev) {
      var r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) * (w / r.width);
      var i = Math.max(lo, Math.min(hi, Math.round(lo + (px - m.l) / (w - m.l - m.r) * n)));
      xh.setAttribute('x1', x(i)); xh.setAttribute('x2', x(i)); xh.style.display = '';
      var tag = ''; EV.forEach(function (e) { if (e.week === i) tag = ' · ' + e.label; });
      tip.innerHTML = '<b>Week of ' + wk(i) + '</b>' + (tag ? '<br><span style="color:#7a1fa3">' + esc(tag.slice(3)) + '</span>' : '') + vis.map(function (s) { return '<br><span style="color:' + s.color + '">●</span> ' + esc(s.name) + ': <b>' + (s.vals[i] == null ? '—' : (o.tipfmt || o.yfmt || Math.round)(s.vals[i])) + '</b>'; }).join('');
      tip.style.display = 'block';
      var tw = tip.offsetWidth, left = (x(i) * r.width / w) + 12; if (left + tw > r.width) left = x(i) * r.width / w - tw - 12; tip.style.left = Math.max(0, left) + 'px'; tip.style.top = '8px';
    }
    hit.onmousemove = show; hit.onmouseleave = function () { tip.style.display = 'none'; xh.style.display = 'none'; };
    hit.ontouchstart = hit.ontouchmove = function (e) { show(e.touches[0]); };
  }
  function niceStep(raw) { var p = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / p; return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p; }
  function chartBox(id, label) { return '<div class="chartwrap" id="' + id + '"><svg role="img" aria-label="' + esc(label) + '"></svg><div class="tip"></div></div>'; }
  function bandLegend() { return '<span><span class="sw" style="background:#5AAFFE;opacity:.35"></span>Tariff period (Jan–Jun 2025)</span><span><span class="sw" style="background:#C231FF;opacity:.4"></span>Prime event week</span><span><span class="sw" style="background:#9a93a5;opacity:.3"></span>Other deal period</span>'; }

  var PAL = ['#5AAFFE', '#210235', '#B54708', '#067647', '#7a7a8c', '#0e7490'];

  // ---------- section renderers ----------
  function rLead(si, cur) { return '<div class="qtext">Question ' + cur.n + '</div><h2>' + esc(cur.h) + '</h2><p class="sub">' + esc(SEG[si]) + ' · Amazon US</p>'; }

  function s1(si) {
    var rows = A.tariffRows(M, si), all = M.tariff.filter(function (t) { return t.si === si && t.brand === 'All competitors'; })[0];
    var brit = rows.filter(function (r) { return r.isBritax; })[0];
    var raised = rows.filter(function (r) { return !r.isBritax && r.raised && !r.thin && r.start != null; });
    var med = median(raised.map(function (r) { return r.start; }));
    var bs = M.basket[si] || {}, ov = bs;
    var ans = 'Competitors raised same-ASIN prices <b>' + sgn(all && all.jj != null ? all.jj - 100 : null, 0) + '</b> between January and June 2025' +
      (med != null ? ', with the typical increase starting <b>around ' + wk(Math.round(med)) + '</b>' : '') + '. ' + raised.length + ' of ' + rows.filter(function (r) { return !r.isBritax && !r.thin; }).length + ' competitor brands with enough volume moved up 4% or more.' +
      (brit ? ' Britax moved <b>' + sgn(brit.riseJan, 0) + '</b>' + (brit.start != null ? ', starting around ' + wk(brit.start) : '') + '.' : '');
    $('s1').innerHTML = rLead(si, { n: 1, h: 'Which competitors raised prices because of tariffs, by how much and when?' }) +
      '<div class="answer">' + ans + '</div>' +
      '<p class="muted">Price change is measured on the <b>same ASINs</b> in both periods, so a new model launch does not count as a price rise. Start week = first week the price sits at least 4% above its January level for three weeks running.</p>' +
      '<div class="legend"><span><i style="background:#C231FF"></i>Britax group</span><span><i style="background:#1F22B2"></i>All competitor brands</span>' + bandLegend() + '</div>' +
      '<div class="legend" id="s1ov">Add brand: ' + Object.keys(ov).filter(function (b) { return b !== 'All competitors' && b !== 'Britax group'; }).map(function (b, i) { return '<label><input type="checkbox" data-ov="' + esc(b) + '" ' + (state.overlay[si + '|' + b] ? 'checked' : '') + '> <span style="color:' + PAL[i % PAL.length] + '">●</span> ' + esc(b) + '</label>'; }).join('') + '</div>' +
      chartBox('c1', 'Same-ASIN price index, Britax vs competitors, baseline 100') +
      '<p class="rule">Index 100 = each ASIN\'s own price in Oct–Dec 2024 (deal weeks excluded). Gaps appear where fewer than 40% of baseline ASINs still sell, so the basket is not representative.</p>' +
      '<h3>Price change by brand</h3><div class="controls">' + exportBtn('t1', 'tariff-price-moves') + '</div><div class="scroll"><table class="tbl" id="t1"></table></div>';
    table('t1', [
      { key: 'brand', label: 'Brand', l: true, render: function (r) { return esc(r.brand) + (r.thin ? ' <span class="muted" title="Under 40 baseline units a week">· low volume</span>' : ''); } },
      { key: 'bu', label: 'Units/wk (baseline)', render: function (r) { return fmtN(r.bu); } },
      { key: 'riseJan', label: 'Jan → Jun 2025', render: function (r) { return '<span class="' + chgCls(r.riseJan) + '">' + sgn(r.riseJan) + '</span>' + dv(r.riseJan, 40); } },
      { key: 'riseQ4', label: 'Q4 2024 → Jun 2025', render: function (r) { return sgn(r.riseQ4); } },
      { key: 'start', label: 'Rise starts (≥4%)', sort: function (r) { return r.start; }, render: function (r) { return r.start == null ? (r.raised ? '—' : 'No sustained rise') : wk(r.start); } },
      { key: 'start8', label: 'Passes 8%', sort: function (r) { return r.start8; }, render: function (r) { return r.start8 == null ? '—' : wk(r.start8); } },
      { key: 'cov', label: 'ASIN coverage', render: function (r) { return r.cov == null ? '—' : r.cov + '%'; } }
    ], rows.map(function (r) { r._cls = r.isBritax ? 'me' : ''; return r; }));
    var series = function () {
      var arr = [{ name: 'Britax group', color: '#C231FF', vals: bs['Britax group'] ? bs['Britax group'].idx : [], width: 2.6 }, { name: 'All competitors', color: '#1F22B2', vals: bs['All competitors'] ? bs['All competitors'].idx : [], width: 2.6 }];
      Object.keys(ov).filter(function (b) { return b !== 'All competitors' && b !== 'Britax group'; }).forEach(function (b, i) { if (state.overlay[si + '|' + b]) arr.push({ name: b, color: PAL[i % PAL.length], vals: ov[b].idx, width: 1.5, dash: '5 3' }); });
      return arr;
    };
    var draw = function () { lineChart('c1', { series: series(), lo: 0, hi: LAST, ref: 100, h: 330, yfmt: function (v) { return Math.round(v); }, tipfmt: function (v) { return v.toFixed(1); } }); };
    draw(); $('s1ov').onchange = function (e) { var b = e.target.dataset.ov; if (b) { state.overlay[si + '|' + b] = e.target.checked; draw(); } };
  }

  function s2(si) {
    var rows = A.nowRows(M, si), all = rows.filter(function (r) { return r.isAll; })[0];
    var ok = rows.filter(function (r) { return !r.isAll && !r.isBritax && !r.thin && r.p13 != null && (r.cov13 || 0) >= 60; });
    var cut = ok.filter(function (r) { return r.dir === 'Cutting'; }), rise = ok.filter(function (r) { return r.dir === 'Raising'; }), hold = ok.filter(function (r) { return r.dir === 'Holding'; });
    var ans = 'Competitors overall are <b>' + (all && all.p13 != null ? (all.p13 <= -3 ? 'cutting' : all.p13 >= 3 ? 'raising' : 'holding') : 'n/a') + '</b> (' + sgn(all && all.p13) + ' on the same ASINs over the last 11 non-event weeks vs the 11 before). ' +
      (cut.length ? '<b>Cutting:</b> ' + cut.map(function (r) { return esc(r.brand) + ' ' + sgn(r.p13, 0); }).join(', ') + '. ' : 'No competitor brand is cutting 3% or more. ') +
      (rise.length ? '<b>Raising:</b> ' + rise.map(function (r) { return esc(r.brand) + ' ' + sgn(r.p13, 0); }).join(', ') + '. ' : '') +
      (hold.length ? '<b>Holding:</b> ' + hold.map(function (r) { return esc(r.brand); }).join(', ') + '.' : '');
    $('s2').innerHTML = rLead(si, { n: 2, h: 'Where are competitors moving on price now?' }) + '<div class="answer">' + ans + '</div>' +
      '<p class="muted">Compares weeks of ' + wk(A.CLEAN_NOW[0]) + ' to ' + wk(A.CLEAN_NOW[1]) + ' with ' + wk(A.CLEAN_PRIOR[0]) + ' to ' + wk(A.CLEAN_PRIOR[1]) + '. Prime event weeks, the weeks either side, and the pre-event weeks of Oct 2026 are left out. The last-4-weeks column is a shorter read of Sep 2026 and is noisier.</p>' +
      '<div class="controls">' + exportBtn('t2', 'price-direction-now') + '</div><div class="scroll"><table class="tbl" id="t2"></table></div>';
    table('t2', [
      { key: 'brand', label: 'Brand', l: true, render: function (r) { return esc(r.isAll ? 'All competitor brands' : r.brand) + (r.thin ? ' <span class="muted">· low volume</span>' : ''); } },
      { key: 'dir', label: 'Direction', render: function (r) { return '<span class="pill ' + (r.dir === 'Cutting' ? 'lower' : r.dir === 'Raising' ? 'blue' : r.dir === 'Holding' ? 'hold' : 'neutral') + '">' + r.dir + '</span>'; } },
      { key: 'p13', label: 'Last 11 wks vs prior 11', render: function (r) { return '<span class="' + chgCls(r.p13) + '">' + sgn(r.p13) + '</span>' + dv(r.p13, 15); } },
      { key: 'p4', label: 'Last 4 vs prior 4', render: function (r) { return sgn(r.p4); } },
      { key: 'yy', label: 'vs same weeks last year', render: function (r) { return sgn(r.yy); } },
      { key: 'cov13', label: 'ASIN coverage', render: function (r) { return r.cov13 == null ? '—' : r.cov13 + '%'; } }
    ], rows.map(function (r) { r._cls = r.isBritax ? 'me' : r.isAll ? 'all' : ''; return r; }));
  }

  function s3(si) {
    var rows = A.moveRows(M, si), fl = A.flagStatus(M, si);
    var off = rows.filter(function (r) { return r.bucket === 'Outside promo'; });
    var offComp = off.filter(function (r) { return !r.isBritax; });
    var latest = offComp.slice(0, 3).map(function (r) { return esc(r.brand) + ' ' + sgn(r.chg, 0) + ' (' + wk(r.week) + (r.confirmed ? '' : ', unconfirmed') + ')'; });
    var ans = '<b>' + offComp.length + ' competitor price moves of 5% or more</b> happened outside the Prime events since the tariff period (' + offComp.filter(function (r) { return r.chg > 0; }).length + ' up, ' + offComp.filter(function (r) { return r.chg < 0; }).length + ' down). ' +
      (latest.length ? 'Most recent: ' + latest.join('; ') + '. ' : '') + 'Britax status: <span class="pill ' + fl.level + '">' + (fl.level === 'amber' ? 'Flagged' : fl.level === 'green' ? 'Watch, no action' : 'Clear') + '</span>';
    var legend = '<div class="legend"><span><span class="sw" style="background:#B42318"></span>Price up</span><span><span class="sw" style="background:#067647"></span>Price down</span><span><span class="sw" style="background:#fff;border:2px solid #C231FF"></span>Britax</span>' + bandLegend() + '</div>';
    $('s3').innerHTML = rLead(si, { n: 3, h: 'Which competitor price changes happen outside promotional periods, and how will Britax be flagged?' }) +
      '<div class="answer">' + ans + '</div>' +
      '<h3>How Britax is flagged</h3>' +
      '<div id="flags">' + (fl.flags.length ? fl.flags.map(function (x) { return '<div class="flagrow"><span class="pill ' + x.level + '">' + (x.level === 'amber' ? 'Flag' : x.level === 'blue' ? 'Britax move' : 'Info') + '</span><span>' + esc(x.text) + '</span></div>'; }).join('') : '<div class="flagrow"><span class="pill clear">Clear</span><span>No competitor move of 5% or more since the week of ' + wk(94) + ', and no change in the Britax price gap.</span></div>') + '</div>' +
      '<p class="rule">Britax is flagged when (a) a competitor with 40+ units a week changes price 5% or more for four weeks running outside a Prime event, Black Friday or the Feb–Mar deal periods, and Britax does not follow, or (b) Britax\'s own price gap to the competitor average moves 5+ points in a quarter. Britax\'s own moves are listed in blue so they can be told apart from market moves. Prime events, the week either side and the weeks before an event are never used as the start of a move.</p>' +
      '<p class="rule">' + britaxPattern() + '</p>' +
      '<h3>Timeline of sustained price moves</h3>' + legend + chartBox('c3', 'Timeline of sustained competitor and Britax price moves') +
      '<h3>All moves</h3><div class="controls"><label>Show <select id="mvFilter"><option value="Outside promo">Outside promo only</option><option value="all">Everything found</option><option value="Tariff window">Tariff window</option><option value="Other deal period">Other deal periods</option></select></label>' + exportBtn('t3', 'off-promo-price-moves') + '</div><div class="scroll"><table class="tbl" id="t3"></table></div>';
    var cols = [
      { key: 'brand', label: 'Brand', l: true, render: function (r) { return esc(r.isBritax ? 'Britax group' : r.brand); } },
      { key: 'week', label: 'New level starts (week of)', sort: function (r) { return r.week; }, render: function (r) { return wk(r.week); } },
      { key: 'chg', label: 'Price change', render: function (r) { return '<span class="' + chgCls(r.chg) + '">' + sgn(r.chg) + '</span>' + dv(r.chg, 25); } },
      { key: 'bucket', label: 'Timing', render: function (r) { return esc(r.bucket) + (r.afterEvent ? ' · first clean week after a Prime event' : ''); } },
      { key: 'confirmed', label: 'Held 4–8 weeks later?', render: function (r) { return r.confirmed ? 'Yes' : 'Too recent to confirm'; } }
    ];
    var drawT = function () {
      var v = $('mvFilter').value;
      table('t3', cols, rows.filter(function (r) { return v === 'all' || r.bucket === v; }).map(function (r) { r._cls = r.isBritax ? 'me' : ''; return r; }));
    };
    $('mvFilter').onchange = drawT; drawT();
    drawTimeline('c3', rows.filter(function (r) { return r.bucket !== 'Other deal period'; }), si);
  }

  // Does Britax cut price around Memorial Day and Labor Day (outside Prime events)? Counted across all segments.
  function britaxPattern() {
    var inRange = function (lo, hi) { return M.moves.filter(function (m) { return m.brand === 'Britax group' && m.chg <= -5 && m.week >= lo && m.week <= hi; }); };
    var may = inRange(82, 84), sep = inRange(98, 100);
    var segs = function (a) { var o = {}; a.forEach(function (m) { o[m.si] = 1; }); return Object.keys(o).length; };
    var rng = function (a) { var c = a.map(function (m) { return m.chg; }); return c.length ? Math.abs(Math.max.apply(null, c)).toFixed(0) + ' to ' + Math.abs(Math.min.apply(null, c)).toFixed(0) + '%' : ''; };
    return '<b>Pattern across segments:</b> Britax\'s own sustained cuts of ' + rng(may) + ' started in the weeks around Memorial Day (mid-May 2026) in ' + segs(may) + ' segments, and cuts of ' + rng(sep) + ' started from the week of ' + wk(99) + ' (Labor Day) in ' + segs(sep) + '. Both sit outside the Prime events and are unconfirmed at the end of the data, so they show as Britax moves here.';
  }

  function drawTimeline(id, rows, si) {
    var wrap = $(id), svg = wrap.querySelector('svg'), tip = wrap.querySelector('.tip');
    var brands = []; rows.forEach(function (r) { if (brands.indexOf(r.brand) < 0) brands.push(r.brand); });
    brands.sort(function (a, b) { return (a === 'Britax group' ? -1 : 0) - (b === 'Britax group' ? -1 : 0) || a.localeCompare(b); });
    var w = Math.max(wrap.clientWidth, 320), rowH = 26, m = { l: 118, r: 12, t: 14, b: 30 }, h = m.t + m.b + Math.max(1, brands.length) * rowH;
    var lo = 5, hi = LAST, x = function (i) { return m.l + (w - m.l - m.r) * (i - lo) / (hi - lo); };
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h); svg.setAttribute('width', w); svg.setAttribute('height', h);
    if (!brands.length) { svg.innerHTML = '<text x="' + w / 2 + '" y="30" text-anchor="middle" fill="#5b5266">No sustained moves of 5% or more found</text>'; svg.setAttribute('height', 60); return; }
    var out = '', tw = A.TARIFF_WINDOW, cw = (w - m.l - m.r) / (hi - lo);
    out += '<rect x="' + x(tw[0]) + '" y="' + m.t + '" width="' + (x(tw[1] + 1) - x(tw[0])) + '" height="' + (h - m.t - m.b) + '" fill="#5AAFFE" fill-opacity=".13"/>';
    EV.forEach(function (e) { out += '<rect x="' + x(e.week) + '" y="' + m.t + '" width="' + Math.max(cw, 3) + '" height="' + (h - m.t - m.b) + '" fill="#C231FF" fill-opacity=".2"/>'; });
    var lastM = -1, lastX = -999;
    for (var i = lo; i <= hi; i++) { var d = A.wkDate(i), mo = d.getUTCMonth() + d.getUTCFullYear() * 12; if (mo !== lastM) { lastM = mo; if (x(i) - lastX >= 54) { lastX = x(i); out += '<text x="' + x(i) + '" y="' + (h - 9) + '" text-anchor="middle" font-size="11" fill="#5b5266">' + A.monthLabel(i) + '</text>'; } } }
    brands.forEach(function (b, bi) { var cy = m.t + bi * rowH + rowH / 2; out += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + cy + '" y2="' + cy + '" stroke="#E7E2EC"/><text x="' + (m.l - 8) + '" y="' + (cy + 4) + '" text-anchor="end" font-size="12" fill="' + (b === 'Britax group' ? '#7a1fa3' : '#000') + '" font-weight="' + (b === 'Britax group' ? 700 : 400) + '">' + esc(b === 'Britax group' ? 'Britax' : b.length > 15 ? b.slice(0, 14) + '…' : b) + '</text>'; });
    var dots = rows.map(function (r, k) {
      var cy = m.t + brands.indexOf(r.brand) * rowH + rowH / 2, rad = Math.min(10, 4 + Math.abs(r.chg) / 3);
      return '<circle data-k="' + k + '" cx="' + x(r.week) + '" cy="' + cy + '" r="' + rad + '" fill="' + (r.chg > 0 ? '#B42318' : '#067647') + '" fill-opacity="' + (r.confirmed ? .85 : .35) + '" stroke="' + (r.isBritax ? '#C231FF' : '#fff') + '" stroke-width="' + (r.isBritax ? 2.2 : 1) + '"/>';
    });
    svg.innerHTML = out + dots.join('');
    svg.onmousemove = function (e) {
      var c = e.target.closest('circle[data-k]'); if (!c) { tip.style.display = 'none'; return; }
      var r = rows[+c.dataset.k], box = svg.getBoundingClientRect();
      tip.innerHTML = '<b>' + esc(r.isBritax ? 'Britax group' : r.brand) + '</b><br>' + sgn(r.chg) + ' from week of ' + wk(r.week) + '<br>' + esc(r.bucket) + (r.confirmed ? '' : ' · unconfirmed');
      tip.style.display = 'block'; var cx = (+c.getAttribute('cx')) * box.width / w; tip.style.left = Math.min(cx + 12, box.width - tip.offsetWidth) + 'px'; tip.style.top = (+c.getAttribute('cy') * box.height / h + 10) + 'px';
    };
    svg.onmouseleave = function () { tip.style.display = 'none'; };
  }

  function s4(si) {
    var st = A.stability(M, si), bs = M.basket[si] || {};
    var verdict = st.stabilised ? 'Yes, stabilised' : (st.compLast13 != null && Math.abs(st.compLast13) < 3 && st.calmShare >= 40) ? 'Mostly, a few brands still moving' : 'Not yet';
    var ans = '<b>' + verdict + '.</b> Competitors\' same-ASIN prices are ' + sgn(st.compLast13) + ' over the last 11 non-event weeks vs the 11 before; ' + st.calmBrands + ' of ' + st.brands + ' brands (<b>' + Math.round(st.calmShare) + '% of competitor volume</b>) moved less than 3%.';
    var rows = A.nowRows(M, si).filter(function (r) { return !r.isAll && !r.isBritax && !r.thin && r.p13 != null && (r.cov13 || 0) >= 60 && Math.abs(r.p13) >= 3; });
    $('s4').innerHTML = rLead(si, { n: 4, h: 'Have tariff-driven prices stabilised in the market?' }) + '<div class="answer">' + ans + '</div>' +
      '<div class="tiles">' +
      tile('Competitor price, last 11 weeks', sgn(st.compLast13), 'vs the 11 weeks before, same ASINs') +
      tile('Competitor price, last 4 weeks', sgn(st.compLast4), 'vs the 4 weeks before (noisier)') +
      tile('Competitor volume that is calm', Math.round(st.calmShare) + '%', st.calmBrands + ' of ' + st.brands + ' brands within ±3%') +
      tile('Weekly price noise', st.volTariff == null ? '—' : f1(st.volTariff) + '%', 'std dev of weekly change in the tariff period (Mar–Jun 2025)') + '</div>' +
      '<p class="muted">Stabilised means the competitor basket moved less than 3% over the last 11 clean weeks and brands holding at least 60% of competitor volume moved less than 3% each.</p>' +
      '<h3>Competitor prices since the tariff period</h3><div class="legend"><span><i style="background:#C231FF"></i>Britax group</span><span><i style="background:#1F22B2"></i>All competitor brands</span>' + bandLegend() + '</div>' + chartBox('c4', 'Same-ASIN price index since January 2025') +
      (rows.length ? '<h3>Brands still moving 3% or more</h3><ul class="notes">' + rows.map(function (r) { return '<li><b>' + esc(r.brand) + '</b> ' + sgn(r.p13) + ' (' + r.dir.toLowerCase() + ')</li>'; }).join('') + '</ul>' : '<p class="muted">No competitor brand with enough volume and coverage moved 3% or more.</p>');
    lineChart('c4', { series: [{ name: 'Britax group', color: '#C231FF', vals: bs['Britax group'] ? bs['Britax group'].idx : [], width: 2.6 }, { name: 'All competitors', color: '#1F22B2', vals: bs['All competitors'] ? bs['All competitors'].idx : [], width: 2.6 }], lo: 13, hi: LAST, ref: 100, h: 300, yfmt: function (v) { return Math.round(v); }, tipfmt: function (v) { return v.toFixed(1); } });
  }
  function tile(k, v, d) { return '<div class="tile"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="d">' + (d || '&nbsp;') + '</div></div>'; }

  function s5(si) {
    var s = A.segmentSummary(M, si), w = M.weekly[si];
    var ans = '<span class="pill ' + s.verdict.tone + '">' + esc(s.verdict.call) + '</span> ' + s.verdict.reasons.map(esc).join(' ');
    $('s5').innerHTML = rLead(si, { n: 5, h: 'Should Britax lower prices or hold them where they are?' }) + '<div class="answer">' + ans + '</div>' +
      '<div class="tiles">' +
      tile('Britax unit share', f1(s.shNow.unit) + '%', 'vs ' + f1(s.shLY.unit) + '% a year ago (' + pp(s.dShareYY) + '), ' + f1(s.shPrior.unit) + '% prior 11 wks') +
      tile('Britax same-ASIN price', sgn(s.britaxBasketYY), 'vs a year ago · ' + sgn(s.britaxBasket13) + ' vs prior 11 wks') +
      tile('Competitor same-ASIN price', sgn(s.compBasketYY), 'vs a year ago · ' + sgn(s.compBasket13) + ' vs prior 11 wks') +
      tile('Prime event unit lift', f1(s.britaxLift) + 'x', 'Britax, median of 4 events · competitors ' + f1(s.compLift) + 'x') +
      tile('Event price cut', f1(s.britaxDepth) + '%', 'Britax, median · competitors ' + f1(s.compDepth) + '%') + '</div>' +
      '<h3>Weekly implied price</h3><div class="legend"><span><i style="background:#C231FF"></i>Britax group</span><span><i style="background:#1F22B2"></i>All competitor brands</span>' + bandLegend() + '</div>' + chartBox('c5a', 'Weekly implied average selling price') +
      '<p class="rule">Implied price = estimated sales ÷ estimated units. It moves with mix as well as price, so use the same-ASIN figures above for price direction.</p>' +
      '<h3>Britax share of units in the segment</h3>' + chartBox('c5b', 'Britax unit share by week') +
      '<h3>The rule</h3><ul class="notes">' +
      '<li><b>Hold</b> when unit share is steady or up vs the same weeks last year (no more than an 8% relative loss).</li>' +
      '<li><b>Hold, gap is closing</b> when share is down but competitors raised same-ASIN prices 3% or more in the last 11 weeks.</li>' +
      '<li><b>Lower selectively</b> when share is down more than 8% vs last year, competitors are not raising price, and Britax volume is large enough to read (120+ baseline units a week). Selective means the ASINs and weeks where Britax raised price while competitors held; event lift above shows how responsive shoppers are.</li>' +
      '<li>Low-volume segments (infant, double strollers) are held until there is enough volume to read.</li></ul>';
    var sh = []; for (var i = 0; i < W; i++) sh[i] = w.ub[i] != null && w.uc[i] != null ? w.ub[i] / (w.ub[i] + w.uc[i]) * 100 : null;
    lineChart('c5a', { series: [{ name: 'Britax group', color: '#C231FF', vals: w.ab, width: 2.4 }, { name: 'All competitors', color: '#1F22B2', vals: w.ac, width: 2.4 }], lo: 0, hi: LAST, h: 300, yfmt: function (v) { return '$' + Math.round(v); } });
    lineChart('c5b', { series: [{ name: 'Britax unit share', color: '#C231FF', vals: sh, width: 2.4 }], lo: 0, hi: LAST, h: 240, zero: true, yfmt: function (v) { return v.toFixed(1) + '%'; } });
  }

  function s6(si) {
    var L = A.ladderRows(M, si), mk = L.mkt, b = L.rows.filter(function (r) { return r.isBritax; })[0];
    var max = Math.max.apply(null, L.rows.map(function (r) { return r.asp; })) * 1.04;
    var ans = 'Britax sells at <b>' + fmt$(b.asp) + '</b> implied average, <b>#' + L.britaxRank + ' of ' + L.listed + '</b> brands listed. The market median ASIN price is <b>' + fmt$(mk.p50) + '</b> (middle half: ' + fmt$(mk.p25) + ' to ' + fmt$(mk.p75) + '), and <b>' + mk.belowBritax + '% of market units</b> sell below Britax\'s average price.';
    $('s6').innerHTML = rLead(si, { n: 6, h: 'Where does the rest of the market sit on pricing in the child safety industry?' }) + '<div class="answer">' + ans + '</div>' +
      '<p class="muted">Implied average selling price by brand, weeks ' + wk(A.CLEAN_NOW[0]) + ' to ' + wk(A.CLEAN_NOW[1]) + ' (non-event). Dashed lines mark the market quartiles. Bars show brands with the most units; the market figures cover every brand.</p>' +
      '<div id="ladder">' + L.rows.map(function (r) {
        var chg = r.aspLY != null ? (r.asp / r.aspLY - 1) * 100 : null;
        return '<div style="display:grid;grid-template-columns:130px 1fr 150px;gap:10px;align-items:center;margin:5px 0;font-size:13.5px"><div style="font-weight:' + (r.isBritax ? 700 : 400) + ';color:' + (r.isBritax ? '#7a1fa3' : '#000') + '">' + esc(r.brand) + '</div>' +
          '<div style="position:relative;height:18px;background:#F7F4FA;border-radius:4px"><div style="height:18px;width:' + (r.asp / max * 100).toFixed(1) + '%;background:' + (r.isBritax ? '#C231FF' : '#5AAFFE') + ';border-radius:4px"></div>' +
          [mk.p25, mk.p50, mk.p75].map(function (p, i) { return '<div title="' + ['25th', 'Median', '75th'][i] + ' percentile ' + fmt$(p) + '" style="position:absolute;top:-3px;bottom:-3px;left:' + (p / max * 100).toFixed(1) + '%;border-left:2px dashed ' + (i === 1 ? '#210235' : '#9a93a5') + '"></div>'; }).join('') + '</div>' +
          '<div style="text-align:right"><b>' + fmt$(r.asp) + '</b> <span class="muted">· ' + fmtN(r.units) + '/wk</span>' + (chg != null ? '<br><span class="muted" style="font-size:12px">' + sgn(chg, 0) + ' vs last yr</span>' : '') + '</div></div>';
      }).join('') + '</div>' +
      '<div class="legend"><span><span class="sw" style="background:#210235"></span>Market median ASIN price ' + fmt$(mk.p50) + '</span><span><span class="sw" style="background:#9a93a5"></span>25th ' + fmt$(mk.p25) + ' · 75th ' + fmt$(mk.p75) + '</span><span>All competitor brands average: <b>' + fmt$(L.compAsp) + '</b></span></div>';
  }

  function s7(si) {
    var rows = A.postPromo(M, si, state.ev), e = EV[state.ev], britax = rows.filter(function (r) { return r.isBritax; })[0], all = rows.filter(function (r) { return r.isAll; })[0];
    var comps = rows.filter(function (r) { return !r.isBritax && !r.isAll && !r.thin; });
    var big = comps.slice().sort(function (a, b) { return (a.pxE == null ? 99 : a.pxE) - (b.pxE == null ? 99 : b.pxE); })[0];
    var gainer = comps.slice().sort(function (a, b) { return b.dShare - a.dShare; })[0], loser = comps.slice().sort(function (a, b) { return a.dShare - b.dShare; })[0];
    var prov = britax.provisional;
    var ans = 'After <b>' + esc(e.label) + '</b>, Britax unit share went from <b>' + f1(britax.shLead) + '%</b> before to <b>' + f1(britax.shPost) + '%</b> after (' + pp(britax.dShare) + '); ' + (prov ? 'in the first week after' : 'in weeks 2 to 4 after') + ', competitor units ran at ' + f1(all.retain * 100, 0) + '% of their pre-event weekly level vs ' + f1(britax.retain * 100, 0) + '% for Britax. ' +
      (big && big.pxE != null && big.pxE < 97 ? esc(big.brand) + ' cut price most for the event (' + sgn(big.pxE - 100, 0) + ')' + (big.pxAfter != null ? ' and sat at ' + sgn(big.pxAfter - 100, 0) + ' afterwards' : '') + '. ' : '') +
      (gainer && loser && gainer.brand !== loser.brand ? 'Biggest share gain: ' + esc(gainer.brand) + ' (' + pp(gainer.dShare) + '); biggest loss: ' + esc(loser.brand) + ' (' + pp(loser.dShare) + ').' : '');
    $('s7').innerHTML = rLead(si, { n: 7, h: 'After a promotion ends, how are competitors performing and what are they reacting to?' }) +
      '<div class="controls"><label>Event <select id="evSel">' + EV.map(function (x) { return '<option value="' + x.id + '"' + (x.id === state.ev ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join('') + '</select></label>' + exportBtn('t7', 'post-promo') + '</div>' +
      '<div class="answer">' + ans + '</div>' +
      (e.note ? '<div class="note">' + esc(e.note) + '.</div>' : '') +
      '<p class="muted">Lead-in = the 4 weeks that end 7 weeks before the event, so early deals and Britax\'s own Memorial Day and Labor Day pricing are not in it. "After" = weeks 2 to 4 after the event' + (prov ? ' (not available yet for this event, so the first week after is used and is provisional)' : '; the first week after is shown separately because it is still event-affected') + '. Share = brand units ÷ all units in the segment. Price = same-ASIN change vs lead-in (100 = no change). "Reacting to" is read from price: a deeper cut during the event, a give-back after, or a lasting lower or higher price.</p>' +
      '<div class="scroll"><table class="tbl" id="t7"></table></div>';
    $('evSel').onchange = function (ev) { state.ev = +ev.target.value; sync(); s7(si); };
    table('t7', [
      { key: 'brand', label: 'Brand', l: true, render: function (r) { return esc(r.isAll ? 'All competitor brands' : r.isBritax ? 'Britax group' : r.brand) + (r.thin ? ' <span class="muted">· low volume</span>' : ''); } },
      { key: 'lead', label: 'Units/wk before', render: function (r) { return fmtN(r.lead); } },
      { key: 'event', label: 'Event week units', render: function (r) { return fmtN(r.event) + ' <span class="muted">(' + f1(r.liftX) + 'x)</span>'; } },
      { key: 'p1', label: 'Week after units', render: function (r) { return fmtN(r.p1); } },
      { key: 'p24', label: prov ? 'Weeks 2–4 after' : 'Units/wk, weeks 2–4 after', render: function (r) { return r.p24 == null ? '—' : fmtN(r.p24) + ' <span class="muted">(' + f1(r.p24 / r.lead * 100, 0) + '% of before)</span>'; } },
      { key: 'shLead', label: 'Share before', render: function (r) { return f1(r.shLead) + '%'; } },
      { key: 'shPost', label: prov ? 'Share, week after' : 'Share, weeks 2–4', render: function (r) { return f1(r.shPost) + '%'; } },
      { key: 'dShare', label: 'Share change', render: function (r) { return '<span class="' + (r.dShare > 0.05 ? 'down' : r.dShare < -0.05 ? 'up' : '') + '">' + pp(r.dShare) + '</span>'; } },
      { key: 'pxE', label: 'Price in event', render: function (r) { return r.pxE == null ? '—' : sgn(r.pxE - 100); } },
      { key: 'pxAfter', label: prov ? 'Price, week after' : 'Price, weeks 2–4', render: function (r) { return r.pxAfter == null ? '—' : sgn(r.pxAfter - 100); } },
      { key: 'reaction', label: 'Reaction', l: true, wrap: true, sort: function (r) { return r.reaction.length; }, render: function (r) { return r.reaction.length ? esc(r.reaction.join('; ')) : '<span class="muted">No clear price reaction</span>'; } }
    ], rows.map(function (r) { r._cls = r.isBritax ? 'me' : r.isAll ? 'all' : ''; return r; }));
  }

  function renderMethod() {
    $('method').innerHTML = '<h2>Method and data notes</h2><ul class="notes">' +
      '<li><b>Source.</b> Weekly Amazon US Market Share estimates for the Britax category (<code>client_catalog.marketshare_cubes.ms_estimations_metadata</code>, instance 1224), one row per ASIN per week, Sunday week start. Segments are the Market Share sub-categories. Britax group is every ASIN flagged as the client (Britax plus Bob Gear); competitors are every brand flagged as a competitor. The page is precomputed, so it does not query the warehouse when you open it.</li>' +
      '<li><b>Same-ASIN price change.</b> For every comparison the page takes ASINs that sold in both windows and weights by units in the starting window. A new model or a mix shift therefore does not show as a price move. Prices come from estimated sales ÷ estimated units for the ASIN, so coupons, 1P and 3P offers are blended in. Pairs where the later price is under half or over double the earlier one are dropped as data errors. Coverage columns show how much starting-window revenue found a match.</li>' +
      '<li><b>Tariff period</b> = weeks of 2025-01-05 to 2025-06-29. The baseline is October to December 2024 with deal weeks removed; the January 2025 level is shown too, because the holiday baseline can sit below normal prices.</li>' +
      '<li><b>Promotional periods</b> = the June and October Prime events: Prime Day 2025 (July; there was no June event in 2025, so the July event stands in), Prime Big Deal Days Oct 2025, Prime Day Jun 2026 and Prime Big Deal Days Oct 2026. Event weeks are confirmed by a 40 to 120% jump in unit sales across the category. The week before and after each event, the pre-event weeks of Oct 2026, Black Friday and Cyber Monday weeks, and the Feb–Mar deal periods (units 20 to 40% above normal) are kept out of "outside promo" moves.</li>' +
      '<li><b>Sustained move</b> = the average of the next 4 clean weeks differs from the prior 4 clean weeks by 5% or more, at the largest point within ±3 weeks, and (where checkable) the new level still holds 4 to 8 weeks later. Brands under 40 baseline units a week are left out of all brand tables. Moves in the last weeks of data cannot be confirmed yet.</li>' +
      '<li><b>Oct 2026 is provisional.</b> Only one full week exists after Prime Big Deal Days Oct 2026 (week of 2026-10-11).</li>' +
      '<li><b>Estimates vs actuals.</b> Market Share figures are estimates. An earlier check of the Britax brand alone (excluding Bob Gear) over the 52 weeks to Oct 2026 found estimated sales about 77% of Vendor Central ordered revenue and estimated ASP about 8% lower. That check was not repeated for this page\'s Britax group (Britax plus Bob Gear). Use this page for relative price position and direction, not for revenue reporting.</li>' +
      '<li><b>Price ladder.</b> Implied ASP blends mix and price; a brand selling cheap and premium models shows one average. The quartiles use the price of every ASIN in the segment weighted by units.</li>' +
      '<li><b>Share.</b> Brand share is units divided by all units of brands flagged in the Market Share category for the segment, not the full Amazon category.</li></ul>';
  }

  // ---------- answer cards + overview ----------
  function answers(si) {
    var rows = A.tariffRows(M, si), all = M.tariff.filter(function (t) { return t.si === si && t.brand === 'All competitors'; })[0];
    var raised = rows.filter(function (r) { return !r.isBritax && r.raised && !r.thin && r.start != null; });
    var med = median(raised.map(function (r) { return r.start; }));
    var top = raised.slice(0, 3).map(function (r) { return esc(r.brand) + ' ' + sgn(r.riseJan, 0); }).join(', ');
    var nr = A.nowRows(M, si), nall = nr.filter(function (r) { return r.isAll; })[0];
    var ok = nr.filter(function (r) { return !r.isAll && !r.isBritax && !r.thin && r.p13 != null && (r.cov13 || 0) >= 60; });
    var cut = ok.filter(function (r) { return r.dir === 'Cutting'; }), rise = ok.filter(function (r) { return r.dir === 'Raising'; });
    var mv = A.moveRows(M, si).filter(function (r) { return r.bucket === 'Outside promo' && !r.isBritax; }), fl = A.flagStatus(M, si);
    var st = A.stability(M, si), s = A.segmentSummary(M, si), L = A.ladderRows(M, si), b = L.rows.filter(function (r) { return r.isBritax; })[0];
    var pp7 = A.postPromo(M, si, 2), bb = pp7.filter(function (r) { return r.isBritax; })[0], aa = pp7.filter(function (r) { return r.isAll; })[0];
    var stab = st.stabilised ? 'Yes' : (st.compLast13 != null && Math.abs(st.compLast13) < 3 && st.calmShare >= 40) ? 'Mostly' : 'Not yet';
    var C = [
      { q: '1 · Who raised prices for tariffs, how much, when?', a: 'Competitors ' + sgn(all && all.jj != null ? all.jj - 100 : null, 0) + ' Jan to Jun 2025' + (med != null ? ', starting around ' + wk(Math.round(med)) : ''), d: top ? 'Largest: ' + top + '.' : 'No competitor brand with enough volume rose 4% or more.', id: 's1' },
      { q: '2 · Where are competitors moving now?', a: nall && nall.p13 != null ? (nall.p13 <= -3 ? 'Cutting' : nall.p13 >= 3 ? 'Raising' : 'Holding') + ' (' + sgn(nall.p13) + ' vs prior 11 weeks)' : 'No read', d: (cut.length ? 'Cutting: ' + cut.map(function (r) { return esc(r.brand) + ' ' + sgn(r.p13, 0); }).join(', ') + '. ' : '') + (rise.length ? 'Raising: ' + rise.map(function (r) { return esc(r.brand) + ' ' + sgn(r.p13, 0); }).join(', ') + '.' : '') || 'No brand moving 3% or more.', id: 's2' },
      { q: '3 · Off-promo moves, and how is Britax flagged?', a: mv.length + ' competitor moves of 5%+ outside promos', d: '<span class="pill ' + fl.level + '">' + (fl.level === 'amber' ? 'Britax flagged' : fl.level === 'green' ? 'Watch, no action' : 'Britax clear') + '</span> ' + (fl.flags[0] ? esc(fl.flags[0].text) : 'No new competitor move since ' + wk(94) + '.'), id: 's3' },
      { q: '4 · Have tariff prices stabilised?', a: stab + ': competitors ' + sgn(st.compLast13) + ' vs prior 11 weeks', d: Math.round(st.calmShare) + '% of competitor volume moved under 3%.', id: 's4' },
      { q: '5 · Lower prices or hold?', a: esc(s.verdict.call), d: 'Unit share ' + f1(s.shNow.unit) + '% vs ' + f1(s.shLY.unit) + '% a year ago; competitor same-ASIN price ' + sgn(s.compBasket13) + ' over 11 weeks.', id: 's5' },
      { q: '6 · Where does the market sit on price?', a: 'Britax ' + fmt$(b.asp) + ' · market median ' + fmt$(L.mkt.p50), d: L.mkt.belowBritax + '% of market units sell below Britax; Britax is #' + L.britaxRank + ' of ' + L.listed + ' brands.', id: 's6' },
      { q: '7 · After a promotion, who holds share, and why?', a: 'After ' + EV[2].short + ': Britax share ' + pp(bb.dShare), d: 'Weekly units after the event: competitors at ' + f1(aa.retain * 100, 0) + '% of pre-event level, Britax at ' + f1(bb.retain * 100, 0) + '%.', id: 's7' }
    ];
    $('answerGrid').innerHTML = C.map(function (c) { return '<div class="qcard"><div class="q">' + c.q + '</div><div class="a">' + c.a + '</div><div class="d">' + c.d + '</div><a class="more" href="#' + c.id + '">See the evidence</a></div>'; }).join('');
  }

  function overview() {
    var rows = SEG.map(function (n, i) {
      var s = A.segmentSummary(M, i), fl = A.flagStatus(M, i), st = A.stability(M, i);
      return { i: i, seg: n, call: s.verdict.call, tone: s.verdict.tone, shNow: s.shNow.unit, dYY: s.dShareYY, comp13: s.compBasket13, brit13: s.britaxBasket13, flag: fl.level, stab: st.stabilised ? 'Yes' : (st.compLast13 != null && Math.abs(st.compLast13) < 3 && st.calmShare >= 40) ? 'Mostly' : 'Not yet', _cls: i === state.seg ? 'me' : '' };
    });
    table('overview', [
      { key: 'seg', label: 'Segment', l: true, render: function (r) { return '<a href="#" data-seg="' + r.i + '">' + esc(r.seg) + '</a>'; } },
      { key: 'call', label: 'Lower or hold', l: true, render: function (r) { return '<span class="pill ' + r.tone + '">' + esc(r.call) + '</span>'; } },
      { key: 'shNow', label: 'Britax unit share', render: function (r) { return f1(r.shNow) + '%'; } },
      { key: 'dYY', label: 'vs last year', render: function (r) { return '<span class="' + (r.dYY < -0.05 ? 'up' : r.dYY > 0.05 ? 'down' : '') + '">' + pp(r.dYY) + '</span>'; } },
      { key: 'comp13', label: 'Competitor price, 11 wks', render: function (r) { return sgn(r.comp13); } },
      { key: 'brit13', label: 'Britax price, 11 wks', render: function (r) { return sgn(r.brit13); } },
      { key: 'stab', label: 'Prices stable?', render: function (r) { return r.stab; } },
      { key: 'flag', label: 'Britax flag', render: function (r) { return '<span class="pill ' + r.flag + '">' + (r.flag === 'amber' ? 'Flagged' : r.flag === 'green' ? 'Watch' : 'Clear') + '</span>'; } }
    ], rows);
    $('overview').onclick = function (e) { var a = e.target.closest('a[data-seg]'); if (a) { e.preventDefault(); state.seg = +a.dataset.seg; render(); window.scrollTo({ top: $('answers').offsetTop - 60, behavior: 'smooth' }); return; } var b = e.target.closest('button[data-k]'); if (b) { var k = b.dataset.k, cur = sortState.overview; sortState.overview = { key: k, dir: cur && cur.key === k ? -cur.dir : 1 }; overview(); } };
  }

  function median(a) { var s = a.filter(function (x) { return x != null; }).sort(function (x, y) { return x - y; }); if (!s.length) return null; var m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

  function render() {
    sync();
    Array.prototype.forEach.call(tabs.children, function (b) { b.setAttribute('aria-selected', +b.dataset.i === state.seg ? 'true' : 'false'); });
    var si = state.seg;
    answers(si); overview(); s1(si); s2(si); s3(si); s4(si); s5(si); s6(si); s7(si); renderMethod();
  }
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { Object.keys(charts).forEach(function (id) { if ($(id)) lineChart(id, charts[id]); }); drawTimelineAgain(); }, 150); });
  function drawTimelineAgain() { if ($('c3')) { var rows = A.moveRows(M, state.seg).filter(function (r) { return r.bucket !== 'Other deal period'; }); drawTimeline('c3', rows, state.seg); } }
  render();
})();
