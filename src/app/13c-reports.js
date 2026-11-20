  // ---------- Reports: sales and forecasts over days, weeks, months and years ----------
  // Everything is kept by date (plan.history = actual net sales, plan.forecast = forecast, plan.shifts = scheduled
  // hours), so any past day can be looked at and changed here, outside the plan's own weeks.
  //  Days   = one month, a line per day: actual and forecast can be typed in (a correction is a normal change: Undo works)
  //  Weeks / Months = one year, a line per week (Monday) or month;  Years = every year that has sales
  // "vs forecast" is the forecast's miss on days that have both numbers; "vs last year" compares the same days a year
  // back (364 days: the same weekday) and only days that have sales in both years.
  const REP_KEY = KEY + '-reports';
  const rep = (() => { try { return { by: 'days', at: iso(new Date()), ...JSON.parse(localStorage.getItem(REP_KEY)) }; } catch (e) { return { by: 'days', at: iso(new Date()) }; } })();
  const repSave = () => { try { localStorage.setItem(REP_KEY, JSON.stringify(rep)); } catch (e) { /* ignore */ } };
  const repHas = (o, d) => o[d] != null && o[d] !== '' && !isNaN(+o[d]);
  const ymOf = (d) => d.slice(0, 7), yOf = (d) => d.slice(0, 4);
  const monthName = (ym) => new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const repMonday = (d) => { const x = parseIso(d); return addDays(d, -((x.getDay() + 6) % 7)); };
  function repDates(from, to) { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; }
  // Sums for a set of dates
  function repSum(dates) {
    const r = { actual: 0, nA: 0, fc: 0, nF: 0, bothA: 0, bothF: 0, nBoth: 0, miss: 0, hours: 0, salesWithHours: 0, lyThis: 0, ly: 0, nLy: 0, days: dates.length };
    for (const d of dates) {
      const a = repHas(plan.history, d), f = repHas(plan.forecast, d), hh = dayHours(d);
      if (a) { r.actual += +plan.history[d]; r.nA++; }
      if (f) { r.fc += +plan.forecast[d]; r.nF++; }
      if (a && f) { r.bothA += +plan.history[d]; r.bothF += +plan.forecast[d]; r.nBoth++; if (+plan.history[d] > 0) r.miss += Math.abs(+plan.forecast[d] - +plan.history[d]) / +plan.history[d]; }
      if (hh > 0) { r.hours += hh; if (a) r.salesWithHours += +plan.history[d]; }
      const l = addDays(d, -364);
      if (a && repHas(plan.history, l)) { r.lyThis += +plan.history[d]; r.ly += +plan.history[l]; r.nLy++; }
    }
    return r;
  }
  const pct = (a, b) => (b ? (a - b) / b * 100 : null);
  const pctTxt = (p) => (p == null ? '' : `${p > 0 ? '+' : ''}${p.toFixed(1)}%`);
  const pctCls = (p) => (p == null ? '' : p <= -5 ? 'bad' : p >= 5 ? 'good' : ''); // within 5%: plain
  // The periods shown
  function repRows() {
    const at = rep.at;
    if (rep.by === 'days') {
      const ym = ymOf(at), first = ym + '-01', last = addDays(iso(new Date(+ym.slice(0, 4), +ym.slice(5, 7), 1)), -1);
      return repDates(first, last).map((d) => ({ key: d, label: `${dayName(d, 'short')} ${usDate(d)}`, dates: [d], day: d }));
    }
    const y = yOf(at);
    if (rep.by === 'weeks') {
      const out = []; for (let m = repMonday(y + '-01-01'); m <= y + '-12-31'; m = addDays(m, 7)) if (m.slice(0, 4) === y || addDays(m, 6).slice(0, 4) === y) out.push({ key: m, label: `${shortDate(m)} – ${shortDate(addDays(m, 6))}`, dates: repDates(m, addDays(m, 6)), go: m });
      return out;
    }
    if (rep.by === 'months') return Array.from({ length: 12 }, (_, i) => { const ym = `${y}-${String(i + 1).padStart(2, '0')}`; return { key: ym, label: monthName(ym), dates: repDates(ym + '-01', addDays(iso(new Date(+y, i + 1, 1)), -1)), go: ym + '-01' }; });
    const ys = [...new Set([...Object.keys(plan.history), ...Object.keys(plan.forecast)].filter((d) => /^\d{4}-\d\d-\d\d$/.test(d)).map(yOf))].sort();
    return ys.map((yy) => ({ key: yy, label: yy, dates: repDates(yy + '-01-01', yy + '-12-31'), go: yy + '-01-01' }));
  }
  function repTitle() {
    if (rep.by === 'days') return monthName(ymOf(rep.at));
    if (rep.by === 'years') return 'Every year';
    return (rep.by === 'weeks' ? 'Weeks of ' : 'Months of ') + yOf(rep.at);
  }
  function repStep(n) {
    const d = parseIso(rep.at);
    if (rep.by === 'days') d.setMonth(d.getMonth() + n, 1); else d.setFullYear(d.getFullYear() + n, 0, 1);
    rep.at = iso(d); repSave(); render();
  }
  // A small chart: actual bars, forecast line, last year dashed
  function repChart(rows, sums) {
    const n = rows.length; if (!n) return null;
    const vals = sums.map((s, i) => ({ a: s.nA ? s.actual : null, f: s.nF ? s.fc : null, l: rep.by === 'days' ? (repHas(plan.history, addDays(rows[i].key, -364)) ? +plan.history[addDays(rows[i].key, -364)] : null) : (s.nLy ? s.ly : null) }));
    const max = Math.max(1, ...vals.flatMap((v) => [v.a, v.f, v.l].filter((x) => x != null)));
    const W = 760, H = 180, L = 46, B = 22, cw = (W - L - 6) / n, y = (v) => 6 + (H - B - 6) * (1 - v / max);
    const ns = 'http://www.w3.org/2000/svg', el = (t, a) => { const e = document.createElementNS(ns, t); Object.entries(a).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Actual sales, forecast and last year', style: 'max-height:220px;display:block' });
    [0, 0.5, 1].forEach((k) => { const v = max * k; svg.append(el('line', { x1: L, x2: W - 4, y1: y(v), y2: y(v), stroke: 'currentColor', 'stroke-opacity': '.15' })); const t = el('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end', 'font-size': '11', fill: 'currentColor', 'fill-opacity': '.7' }); t.textContent = '$' + (v >= 10000 ? Math.round(v / 1000) + 'k' : Math.round(v).toLocaleString()); svg.append(t); });
    const path = (key, attrs) => { let dd = ''; vals.forEach((v, i) => { if (v[key] == null) return; dd += `${dd && vals[i - 1] && vals[i - 1][key] != null ? 'L' : 'M'}${(L + cw * i + cw / 2).toFixed(1)},${y(v[key]).toFixed(1)}`; }); if (dd) svg.append(el('path', { d: dd, fill: 'none', ...attrs })); };
    vals.forEach((v, i) => {
      if (v.a != null) { const r = el('rect', { x: L + cw * i + cw * 0.15, width: Math.max(1, cw * 0.7), y: y(v.a), height: Math.max(0, H - B - y(v.a)), rx: 2, fill: '#3f7fe0', 'fill-opacity': '.75' }); const tt = el('title', {}); tt.textContent = `${rows[i].label}: ${money(v.a)}`; r.append(tt); svg.append(r); }
      if (n <= 31 || i % Math.ceil(n / 26) === 0) { const t = el('text', { x: L + cw * i + cw / 2, y: H - 6, 'text-anchor': 'middle', 'font-size': '10', fill: 'currentColor', 'fill-opacity': '.7' }); t.textContent = rep.by === 'days' ? String(+rows[i].key.slice(8)) : rep.by === 'weeks' ? String(i + 1) : rep.by === 'months' ? rows[i].label.slice(0, 3) : rows[i].label; svg.append(t); }
    });
    path('f', { stroke: '#e09f1f', 'stroke-width': 2.5 }); path('l', { stroke: 'currentColor', 'stroke-opacity': '.55', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' });
    const key = h('div', { class: 'inline hint', style: { gap: '14px', fontSize: '12px' } }, h('span', null, h('b', { style: { color: '#3f7fe0' } }, '■'), ' Actual sales'), h('span', null, h('b', { style: { color: '#e09f1f' } }, '—'), ' Forecast'), h('span', null, '- - Last year (same weekdays)'));
    return h('div', { style: { margin: '6px 0 12px' } }, svg, key);
  }
  // Average by weekday for what is shown (a month or a year)
  function repWeekdays(allDates) {
    const by = Array.from({ length: 7 }, () => ({ a: 0, nA: 0, f: 0, nF: 0 }));
    allDates.forEach((d) => { const k = (parseIso(d).getDay() + 6) % 7; if (repHas(plan.history, d)) { by[k].a += +plan.history[d]; by[k].nA++; } if (repHas(plan.forecast, d)) { by[k].f += +plan.forecast[d]; by[k].nF++; } });
    if (!by.some((x) => x.nA || x.nF)) return null;
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return h('div', { class: 'table-wrap' }, h('table', { class: 't' },
      h('thead', null, h('tr', null, h('th', null, 'Average'), names.map((x) => h('th', { class: 'num' }, x)))),
      h('tbody', null,
        h('tr', null, h('td', null, 'Actual'), by.map((x) => h('td', { class: 'num' }, x.nA ? money(x.a / x.nA) : '—'))),
        h('tr', null, h('td', null, 'Forecast'), by.map((x) => h('td', { class: 'num' }, x.nF ? money(x.f / x.nF) : '—'))))));
  }
  function repCsv(rows, sums) {
    const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = [['Period', 'Actual sales', 'Days with sales', 'Forecast', 'Actual vs forecast %', 'Average miss per day %', 'Scheduled hours', 'Sales per labor hour', 'Last year (same days)', 'vs last year %'].map(q).join(',')];
    rows.forEach((r, i) => { const s = sums[i]; lines.push([r.label, s.nA ? s.actual : '', s.nA, s.nF ? s.fc : '', s.nBoth ? pct(s.bothA, s.bothF).toFixed(1) : '', s.nBoth ? (s.miss / s.nBoth * 100).toFixed(1) : '', s.hours ? hrs(s.hours) : '', s.hours && s.salesWithHours ? (s.salesWithHours / s.hours).toFixed(2) : '', s.nLy ? s.ly : '', s.nLy ? pct(s.lyThis, s.ly).toFixed(1) : ''].map(q).join(',')); });
    downloadBlob(`${placeName() || 'ShiftCraft'} - sales report - ${repTitle()}.csv`.replace(/[\\/:*?"<>|]/g, '-'), new Blob([lines.join('\r\n')], { type: 'text/csv' }));
  }
  function reportsView(main) {
    const rows = repRows(), sums = rows.map((r) => repSum(r.dates)), tot = repSum(rows.flatMap((r) => r.dates));
    const today = iso(new Date());
    const by = h('div', { class: 'weeks', role: 'group', 'aria-label': 'Show by' }, [['days', 'Days'], ['weeks', 'Weeks'], ['months', 'Months'], ['years', 'Years']].map(([k, l]) => h('button', { class: 'btn sm', 'aria-pressed': String(rep.by === k), onclick: () => { rep.by = k; repSave(); render(); } }, l)));
    const go = h('input', { class: 'input', type: rep.by === 'days' ? 'month' : 'number', value: rep.by === 'days' ? ymOf(rep.at) : yOf(rep.at), min: rep.by === 'days' ? undefined : 2000, max: rep.by === 'days' ? undefined : 2100, style: { width: rep.by === 'days' ? '150px' : '90px' }, 'aria-label': rep.by === 'days' ? 'Month' : 'Year', hidden: rep.by === 'years' });
    go.addEventListener('change', () => { if (!go.value) return; rep.at = rep.by === 'days' ? go.value + '-01' : `${go.value}-01-01`; repSave(); render(); });
    const nav = h('div', { class: 'daynav' },
      h('button', { class: 'btn sm', 'aria-label': 'Before', hidden: rep.by === 'years', onclick: () => repStep(-1) }, '‹'),
      h('h2', { style: { margin: '0 6px' } }, repTitle()),
      h('button', { class: 'btn sm', 'aria-label': 'After', hidden: rep.by === 'years', onclick: () => repStep(1) }, '›'),
      go, h('button', { class: 'btn sm', hidden: rep.by === 'years', onclick: () => { rep.at = today; repSave(); render(); } }, 'Today'),
      h('span', { class: 'spacer' }), by);
    // the table
    const head = rep.by === 'days' ? ['Date', 'Actual sales', 'Forecast', 'vs forecast', 'Scheduled hrs', 'Sales / labor hr', 'Last year', 'vs last year']
      : ['Period', 'Actual sales', 'Forecast', 'vs forecast', 'Avg miss / day', 'Scheduled hrs', 'Sales / labor hr', 'Last year', 'vs last year'];
    const cell = (v, cls = '') => h('td', { class: 'num ' + cls }, v);
    const body = rows.map((r, i) => {
      const s = sums[i];
      if (rep.by === 'days') {
        const d = r.day, ly = addDays(d, -364), lyv = repHas(plan.history, ly) ? +plan.history[ly] : null;
        const box = (obj, what) => { const inp = h('input', { class: 'input num', type: 'number', min: 0, step: 1, value: repHas(obj, d) ? obj[d] : '', style: { width: '88px', padding: '0 6px' }, 'aria-label': `${what} ${usDate(d)}`, disabled: what === 'Actual sales' && d > today });
          inp.addEventListener('change', () => change(() => { const o = what === 'Actual sales' ? plan.history : plan.forecast; if (inp.value === '') delete o[d]; else o[d] = Math.max(0, Math.round(+inp.value)); })); return inp; };
        const p = s.nBoth ? pct(s.bothA, s.bothF) : null, pl = lyv != null && s.nA ? pct(s.actual, lyv) : null;
        return h('tr', { class: d === today ? 'today' : '' }, h('td', null, r.label), h('td', { class: 'num', style: { padding: '3px' } }, box(plan.history, 'Actual sales')), h('td', { class: 'num fc', style: { padding: '3px' } }, box(plan.forecast, 'Forecast')),
          cell(pctTxt(p), pctCls(p)), cell(s.hours ? hrs(s.hours) : ''), cell(s.hours && s.salesWithHours ? money(s.salesWithHours / s.hours) : ''), cell(lyv == null ? '' : money(lyv)), cell(pctTxt(pl), pctCls(pl)));
      }
      const p = s.nBoth ? pct(s.bothA, s.bothF) : null, pl = s.nLy ? pct(s.lyThis, s.ly) : null;
      return h('tr', { style: { cursor: 'pointer' }, title: 'Open these days', onclick: (e) => { if (e.target.closest('button,input')) return; rep.by = rep.by === 'years' ? 'months' : 'days'; rep.at = r.go; repSave(); render(); } },
        h('td', null, r.label, s.nA && s.nA < s.days && r.dates[r.dates.length - 1] < today ? h('span', { class: 'hint' }, ` (${s.nA} of ${s.days} days)`) : null),
        cell(s.nA ? money(s.actual) : '—'), cell(s.nF ? money(s.fc) : '—', 'fc'), cell(pctTxt(p), pctCls(p)), cell(s.nBoth ? (s.miss / s.nBoth * 100).toFixed(1) + '%' : ''),
        cell(s.hours ? hrs(s.hours) : ''), cell(s.hours && s.salesWithHours ? money(s.salesWithHours / s.hours) : ''), cell(s.nLy ? money(s.ly) : ''), cell(pctTxt(pl), pctCls(pl)));
    });
    const tp = tot.nBoth ? pct(tot.bothA, tot.bothF) : null, tl = tot.nLy ? pct(tot.lyThis, tot.ly) : null;
    const foot = h('tr', null, h('td', null, h('b', null, 'Total')), cell(tot.nA ? money(tot.actual) : '—'), cell(tot.nF ? money(tot.fc) : '—', 'fc'), cell(pctTxt(tp), pctCls(tp)),
      ...(rep.by === 'days' ? [] : [cell(tot.nBoth ? (tot.miss / tot.nBoth * 100).toFixed(1) + '%' : '')]),
      cell(tot.hours ? hrs(tot.hours) : ''), cell(tot.hours && tot.salesWithHours ? money(tot.salesWithHours / tot.hours) : ''), cell(tot.nLy ? money(tot.ly) : ''), cell(pctTxt(tl), pctCls(tl)));
    const tiles = h('div', { class: 'inline', style: { gap: '18px', flexWrap: 'wrap', margin: '4px 0 8px' } },
      ...[['Actual sales', tot.nA ? money(tot.actual) : '—', tot.nA ? `${tot.nA} day${tot.nA === 1 ? '' : 's'}, ${money(tot.actual / tot.nA)} a day` : 'no sales typed yet'],
        ['Forecast', tot.nF ? money(tot.fc) : '—', tot.nBoth ? `actual was ${pctTxt(tp)} vs forecast` : ''],
        ['Average miss', tot.nBoth ? (tot.miss / tot.nBoth * 100).toFixed(1) + '%' : '—', 'per day, forecast vs actual'],
        ['Last year', tot.nLy ? pctTxt(tl) : '—', tot.nLy ? `same ${tot.nLy} days: ${money(tot.ly)}` : 'no sales a year back']]
        .map(([t, v, s]) => h('div', null, h('div', { class: 'hint', style: { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.04em' } }, t), h('div', { style: { fontSize: '20px', fontWeight: 700 } }, v), h('div', { class: 'hint', style: { fontSize: '12px' } }, s))));
    main.append(h('div', { class: 'card' }, nav,
      h('p', { class: 'hint', style: { margin: '6px 0 4px' } }, rep.by === 'days'
        ? 'Any past day can be corrected here: type the actual sales and the forecast (Undo works). “vs forecast” = how far actual sales were from the forecast; last year = the same weekday a year back.'
        : 'Click a line to open its days. “vs forecast” = actual against forecast on days that have both; “Avg miss” = how far off the forecast was on an average day; last year = the same days a year back, where both years have sales.'),
      tiles, repChart(rows, sums),
      h('div', { class: 'table-wrap' }, h('table', { class: 't' }, h('thead', null, h('tr', null, head.map((x, i) => h('th', { class: i ? 'num' : '' }, x)))), h('tbody', null, body), h('tfoot', null, foot))),
      h('div', { class: 'inline', style: { marginTop: '12px', gap: '6px', flexWrap: 'wrap' } },
        h('button', { class: 'btn sm', onclick: () => repCsv(rows, sums) }, 'Save as CSV (Excel)'),
        h('button', { class: 'btn sm', onclick: () => { ui.tab = 'forecast'; persist(); render(); } }, 'Forecast screen'),
        h('span', { class: 'spacer' }), h('span', { class: 'hint' }, rep.by === 'years' ? '' : 'Average by weekday below is for ' + repTitle().replace(/^(Weeks|Months) of /, '') + '.'))),
      rep.by === 'years' ? null : h('div', { class: 'card', style: { marginTop: '12px' } }, h('h3', { style: { margin: '0 0 8px' } }, 'Average by weekday'), repWeekdays(rows.flatMap((r) => r.dates)) || h('p', { class: 'hint' }, 'No sales or forecasts here yet.')));
  }
