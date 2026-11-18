  // ---------- Forecast ----------
  function forecastView(main) {
    const w = weekOf(ui.day), days = weekDays(w);
    const weeks = h('div', { class: 'weeks' }, Array.from({ length: plan.weeks }, (_, k) => h('button', { class: 'btn sm', 'aria-pressed': String(k === w), onclick: () => { ui.day = weekDays(k)[0]; persist(); render(); } }, `Week ${k + 1}`)));
    const tot = { trend: 0, fc: 0, sched: 0, target: 0 };
    const rows = days.map((d) => {
      const t = trend(d), f = forecastOf(d), set = plan.forecast[d] != null && plan.forecast[d] !== '';
      const inp = h('input', { class: 'input in', type: 'number', min: 0, step: 1, value: set ? plan.forecast[d] : '', placeholder: t == null ? 'enter $' : Math.round(t), 'aria-label': 'Forecast for ' + usDate(d) });
      inp.addEventListener('change', () => change(() => { if (inp.value === '') delete plan.forecast[d]; else plan.forecast[d] = Math.max(0, +inp.value); }));
      const vpct = t && f != null ? (f - t) / t * 100 : null;
      tot.trend += t || 0; tot.fc += f || 0; tot.sched += dayHours(d); tot.target += targetHours(d) || 0;
      const v = varianceHours(d);
      return h('tr', null, h('td', null, `${dayName(d, 'short')} ${usDate(d)}`), h('td', { class: 'num' }, money(t)), h('td', { class: 'fc num' }, inp),
        h('td', { class: 'num' }, vpct == null ? '' : `${vpct > 0 ? '+' : ''}${vpct.toFixed(1)}%`),
        h('td', { class: 'num' }, targetHours(d) == null ? '—' : hrs(targetHours(d))), h('td', { class: 'num' }, hrs(dayHours(d))),
        h('td', { class: 'num ' + varClass(v) }, v == null ? '—' : signed(v)));
    });
    const wpct = tot.trend ? (tot.fc - tot.trend) / tot.trend * 100 : null;
    const splh = h('input', { class: 'input in', type: 'number', min: 1, step: 1, value: plan.splh, 'aria-label': 'Sales per labor hour' });
    splh.addEventListener('change', () => change(() => { plan.splh = Math.max(1, +splh.value || plan.splh); }));
    main.append(h('div', { class: 'cols2' },
      h('div', { class: 'card' },
        h('div', { class: 'daynav' }, h('h2', { style: { margin: 0 } }, `Forecast · Week ${w + 1}`), h('span', { class: 'spacer' }), weeks),
        h('p', { class: 'hint', style: { margin: '6px 0 12px' } }, 'Trend = average of the same weekday over the last 4 weeks of sales. Type a forecast to override it; leave it empty to use the trend.'),
        h('div', { class: 'table-wrap' }, h('table', { class: 't' },
          h('thead', null, h('tr', null, ['Date', 'Net $ trend', 'Forecast', 'vs trend', 'Target hrs', 'Scheduled', 'Hours variance'].map((x, i) => h('th', { class: i ? 'num' : '' }, x)))),
          h('tbody', null, rows),
          h('tfoot', null, h('tr', null, h('td', null, 'Week'), h('td', { class: 'num' }, money(tot.trend)), h('td', { class: 'num fc' }, money(tot.fc)), h('td', { class: 'num' }, wpct == null ? '' : `${wpct > 0 ? '+' : ''}${wpct.toFixed(1)}%`),
            h('td', { class: 'num' }, hrs(tot.target)), h('td', { class: 'num' }, hrs(tot.sched)), h('td', { class: 'num ' + varClass((tot.sched - tot.target) / 3) }, signed(tot.sched - tot.target)))))),
        h('div', { class: 'inline', style: { marginTop: '12px' } },
          h('label', { class: 'inline' }, h('span', null, 'Sales per labor hour target $'), splh),
          h('span', { class: 'spacer' }),
          h('button', { class: 'btn sm primary', title: 'Copy a week’s past sales or forecast onto other weeks (past to future, week by week)', onclick: () => copyForecastDialog(w) }, 'Copy a week…'),
          h('button', { class: 'btn sm', onclick: () => change(() => days.forEach((d) => { const t = trend(d); if (t != null) plan.forecast[d] = Math.round(t); })) }, 'Fill week from trend'),
          h('button', { class: 'btn sm', onclick: () => change(() => days.forEach((d) => { delete plan.forecast[d]; })) }, 'Clear my forecasts'))),
      historyCard()));
  }
  function historyCard() {
    const from = addDays(plan.startDate, -28), n = 28 + plan.weeks * 7;
    const dates = Array.from({ length: n }, (_, i) => addDays(from, i));
    const today = iso(new Date());
    const byWeek = [];
    dates.forEach((d, i) => { if (i % 7 === 0) byWeek.push([]); byWeek[byWeek.length - 1].push(d); });
    const filled = dates.filter((d) => plan.history[d] != null).length;
    return h('div', { class: 'card' },
      h('div', { class: 'daynav' }, h('h2', { style: { margin: 0 } }, 'Past sales'), h('span', { class: 'spacer' }),
        h('button', { class: 'btn sm', onclick: importSales }, 'Paste or import…'),
        h('button', { class: 'btn sm', disabled: !filled, onclick: () => confirmBox('Clear all past sales?', 'This removes every sales figure from this plan. You can undo this.', 'Clear', () => change(() => { plan.history = {}; })) }, 'Clear')),
      h('p', { class: 'hint', style: { margin: '6px 0 12px' } }, 'Net sales per day. The 4 weeks before the plan feed the trend; fill in plan weeks as they happen to keep the trend fresh.'),
      h('div', { class: 'table-wrap' }, h('table', { class: 't' },
        h('thead', null, h('tr', null, h('th', null, 'Week of'), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((x) => h('th', { class: 'num' }, x)))),
        h('tbody', null, byWeek.map((wk) => h('tr', null, h('td', { class: 'small' }, shortDate(wk[0]) + (wk[0] >= plan.startDate ? ' (plan)' : '')),
          wk.map((d) => {
            const inp = h('input', { class: 'input', type: 'number', min: 0, step: 1, style: { width: '64px', textAlign: 'right', padding: '0 6px' }, value: plan.history[d] ?? '', disabled: d > today && d >= plan.startDate, title: usDate(d), 'aria-label': 'Sales ' + usDate(d) });
            inp.addEventListener('change', () => change(() => { if (inp.value === '') delete plan.history[d]; else plan.history[d] = Math.max(0, +inp.value); }));
            return h('td', { class: 'num', style: { padding: '3px' } }, inp);
          })))))));
  }
  function importSales() {
    const ta = h('textarea', { class: 'input', rows: 10, placeholder: '10/05/2026, 3575\n10/06/2026, 3306\n…', style: { fontFamily: 'var(--mono)' } });
    const fileIn = h('input', { type: 'file', accept: '.csv,.txt,text/*' });
    fileIn.onchange = async () => { const f = fileIn.files[0]; if (f) ta.value = await f.text(); };
    modal({ title: 'Paste or import past sales', wide: true, body: [h('p', { class: 'hint' }, 'One day per line: a date and an amount, separated by a comma, tab or spaces. A heading line is skipped. Dates like 10/05/2026, 2026-10-05 or 5 Oct 2026 work.'), ta, fileIn],
      actions: [{ label: 'Cancel' }, { label: 'Import', primary: true, onClick: () => {
        let n = 0, bad = 0;
        const add = {};
        ta.value.split(/\r?\n/).forEach((line) => {
          if (!line.trim()) return;
          const parts = line.split(/[,\t;]|\s{2,}/).map((x) => x.trim()).filter(Boolean);
          const date = parts.map(parseDateText).find(Boolean);
          const amt = [...parts].reverse().map((x) => (parseDateText(x) ? null : parseAmount(x))).find((x) => x != null);
          if (date && amt != null) { add[date] = amt; n++; } else bad++;
        });
        if (!n) { toast('No dates with amounts found.'); return false; }
        change(() => Object.assign(plan.history, add));
        toast(`Imported ${n} day${n === 1 ? '' : 's'}${bad > 1 ? `, skipped ${bad} line${bad === 1 ? '' : 's'}` : ''}`);
      } }] });
  }
  function parseAmount(s) { const t = String(s).replace(/[$\s]/g, '').replace(/,(?=\d{3}\b)/g, ''); return /^-?\d+(\.\d+)?$/.test(t) ? +t : null; }
  function parseDateText(s) {
    const t = String(s).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
    if (m) return iso(new Date(+m[1], +m[2] - 1, +m[3]));
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(t);
    if (m) { let y = +m[3]; if (y < 100) y += 2000; return iso(new Date(y, +m[1] - 1, +m[2])); }
    if (/[a-z]/i.test(t) && /\d/.test(t)) { const d = new Date(t); if (!isNaN(d)) return iso(d); }
    return null;
  }

  // ---------- Copy a week's sales or forecast onto other weeks (past to future, week by week) ----------
  // from: any week (its past sales, or its forecast); to: one or more weeks, Monday to Monday; a % up or down, rounded
  // to the dollar. A forecast already there is replaced (Ctrl+Z undoes).
  function copyForecastDialog(atWeek) {
    const today = iso(new Date()), planEnd = addDays(plan.startDate, plan.weeks * 7 - 1);
    const hist = Object.keys(plan.history || {}).filter((d) => plan.history[d] != null).sort();
    const first = mondayOf(hist[0] && hist[0] < plan.startDate ? hist[0] : addDays(plan.startDate, -28));
    const last = mondayOf(addDays(planEnd, 8 * 7));
    const weeks = []; for (let m = first; m <= last; m = addDays(m, 7)) weeks.push(m);
    const days7 = (m) => Array.from({ length: 7 }, (_, i) => addDays(m, i));
    const has = (v) => v != null && v !== '';
    const salesOf = (m) => days7(m).reduce((t, d) => t + (has(plan.history[d]) ? +plan.history[d] : 0), 0), nSales = (m) => days7(m).filter((d) => has(plan.history[d])).length;
    const fcOf = (m) => days7(m).reduce((t, d) => t + (has(plan.forecast[d]) ? +plan.forecast[d] : 0), 0), nFc = (m) => days7(m).filter((d) => has(plan.forecast[d])).length;
    const label = (m) => `${shortDate(m)} – ${shortDate(addDays(m, 6))}${m.slice(0, 4) !== today.slice(0, 4) ? ', ' + m.slice(0, 4) : ''}${m >= plan.startDate && m <= planEnd ? ` (plan week ${weekOf(m) + 1})` : ''}`;
    const viewed = weekDays(atWeek)[0];
    // from: the last week with sales before the week being looked at
    const lastSales = [...weeks].reverse().find((m) => m < viewed && nSales(m)) || weeks[0];
    let what = nSales(lastSales) ? 'sales' : 'forecast';
    const fromSel = h('select', { class: 'input', 'aria-label': 'Copy from week' }, weeks.map((m) => h('option', { value: m, selected: m === lastSales }, `${label(m)} · sales ${nSales(m) ? money(salesOf(m)) : '—'} · forecast ${nFc(m) ? money(fcOf(m)) : '—'}`)));
    const quick = (txt, k) => h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { const m = addDays(viewed, -7 * k); if (weeks.includes(m)) { fromSel.value = m; sync(); } else toast('That week is not in the list (no sales that far back).'); } }, txt);
    const whatSeg = calSeg('Copy', [['sales', 'Its past sales'], ['forecast', 'Its forecast']], what, (v) => { what = v; sync(); });
    const pct = h('input', { class: 'input', type: 'number', step: 1, value: 0, style: { width: '80px' }, 'aria-label': 'Up or down by percent' });
    const boxes = weeks.map((m) => ({ m, el: h('input', { type: 'checkbox', checked: m === viewed }) }));
    const grid = h('div', { class: 'cf-grid' });
    const info = h('p', { class: 'hint', style: { margin: '6px 0 0' } });
    const sync = () => {
      const src = fromSel.value, n = what === 'sales' ? nSales(src) : nFc(src);
      grid.replaceChildren(...boxes.filter((b) => b.m > src).map((b) => h('label', { class: 'check small' + (b.m < today ? ' muted' : '') }, b.el, ` ${label(b.m)}${nFc(b.m) ? ' •' : ''}`)));
      const k = 1 + (+pct.value || 0) / 100, total = days7(src).reduce((t, d) => t + (what === 'sales' ? +(plan.history[d] || 0) : +(plan.forecast[d] || 0)), 0);
      info.textContent = n ? `${n} day${n === 1 ? '' : 's'} to copy, ${money(total * k)} a week${+pct.value ? ` (${+pct.value > 0 ? '+' : ''}${+pct.value}%)` : ''}. Weeks marked • have forecasts already: they are replaced. You can undo this.`
        : `That week has no ${what === 'sales' ? 'past sales' : 'forecast'} to copy: pick another week, or the other kind.`;
    };
    fromSel.onchange = sync; pct.oninput = sync;
    sync();
    modal({ title: 'Copy a week’s sales or forecast', wide: true, body: [
      h('p', { class: 'hint', style: { marginTop: 0 } }, 'Day by day, Monday to Monday: a week’s past sales (or its forecast) become the forecast for the weeks you tick. Up or down by a percent if you like (e.g. 5 for 5% more).'),
      h('label', { class: 'field' }, h('span', null, 'From the week'), fromSel),
      h('div', { class: 'inline', style: { gap: '6px', margin: '-4px 0 8px' } }, h('span', { class: 'muted small' }, 'Quick:'), quick('Last week', 1), quick('4 weeks ago', 4), quick('Same week last year', 52)),
      h('div', { class: 'field' }, h('span', null, 'Copy'), whatSeg),
      h('label', { class: 'field' }, h('span', null, 'Up or down by %'), pct),
      h('div', { class: 'field' }, h('span', null, 'Onto the weeks'), grid),
      h('div', { class: 'inline', style: { gap: '6px' } },
        h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { boxes.forEach((b) => { b.el.checked = b.m > fromSel.value && b.m >= plan.startDate && b.m <= planEnd; }); } }, 'The plan’s weeks'),
        h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { boxes.forEach((b) => { b.el.checked = b.m > fromSel.value && b.m >= mondayOf(today); }); } }, 'Every week from this one on'),
        h('button', { type: 'button', class: 'btn sm ghost', onclick: () => boxes.forEach((b) => { b.el.checked = false; }) }, 'None')),
      info],
    actions: [{ label: 'Cancel' }, { label: 'Copy', primary: true, onClick: () => {
      const src = fromSel.value, targets = boxes.filter((b) => b.el.checked && b.m > src).map((b) => b.m), k = 1 + (+pct.value || 0) / 100;
      const vals = days7(src).map((d) => (what === 'sales' ? plan.history[d] : plan.forecast[d]));
      if (!targets.length) { toast('Tick the weeks to copy onto.'); return false; }
      if (!vals.some(has)) { toast('That week has nothing to copy.'); return false; }
      change(() => targets.forEach((m) => days7(m).forEach((d, i) => { const v = vals[i]; if (has(v)) plan.forecast[d] = Math.max(0, Math.round(+v * k)); })));
      toast(`Copied onto ${targets.length} week${targets.length === 1 ? '' : 's'}. You can undo this.`);
    } }] });
  }
