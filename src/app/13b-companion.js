  // ---------- Companion site (the company's own scheduler, e.g. RAD at myrad.app) ----------
  // ShiftCraft cannot look inside another site (browsers keep sites apart, which protects the logins), so the forecast
  // comes over by copy and paste: on the companion's Forecast tab select the table (or the whole page, Ctrl+A) and copy;
  // in ShiftCraft press Ctrl+V on the Forecast screen (or Paste from …). Only "a date, then two dollar amounts" is used
  // (trend, forecast); menus, names and the rest of the page are ignored. ShiftCraft shows the days and asks before using them.
  const COMP_KEY = KEY + '-companion';
  const COMP_DEFAULT = { name: 'RAD', url: 'https://myrad.app/' };
  function companion() { try { const c = JSON.parse(localStorage.getItem(COMP_KEY)); if (c && c.url) return c; } catch (e) { /* default */ } return { ...COMP_DEFAULT }; }
  let compWin = null;
  function openCompanion() {
    const c = companion();
    if (compWin && !compWin.closed) { try { compWin.focus(); } catch (e) { /* ignore */ } return toast(`${c.name} is already open in another tab.`); }
    compWin = window.open(c.url, 'shiftcraft-companion');
    if (!compWin) toast(`The browser blocked the new tab. Allow pop-ups for ShiftCraft, or open ${c.url} yourself.`);
  }
  function companionDialog() {
    const c = companion();
    const nm = h('input', { class: 'input', value: c.name, maxLength: 40, placeholder: 'e.g. RAD' });
    const url = h('input', { class: 'input', value: c.url, maxLength: 200, placeholder: 'https://…' });
    const err = h('p', { class: 'error bad', hidden: true });
    modal({ title: 'Companion site', body: [h('p', { class: 'hint' }, 'The company’s own scheduler you type the schedule into. ShiftCraft opens it in its own tab; you log in there as usual. Kept on this computer.'),
      h('label', { class: 'field' }, h('span', null, 'Name'), nm), h('label', { class: 'field' }, h('span', null, 'Address'), url), err],
    actions: [{ label: 'Back to RAD (myrad.app)', left: true, onClick: () => { try { localStorage.removeItem(COMP_KEY); } catch (e) { /* ignore */ } render(); } }, { label: 'Cancel' }, { label: 'Save', primary: true, onClick: () => {
      let u = url.value.trim(); if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
      try { const x = new URL(u); if (!/^https?:$/.test(x.protocol)) throw new Error(); } catch (e) { err.textContent = 'That address does not look right.'; err.hidden = false; return false; }
      try { localStorage.setItem(COMP_KEY, JSON.stringify({ name: nm.value.trim() || 'Companion', url: u })); } catch (e) { /* ignore */ }
      render();
    } }] });
  }
  // What came: [{ date: 'M/D/YYYY', trend: '$2,830', ops: '$2,830' }] → [{ d: 'YYYY-MM-DD', ops, trend }]
  const compMoney = (s) => { const t = String(s == null ? '' : s).replace(/[$,\s]/g, ''); return /^-?\d+(\.\d+)?$/.test(t) ? Math.round(+t) : null; };
  const compDate = (s) => { const m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (!m) return null; const d = new Date(+m[3], +m[1] - 1, +m[2]); return d.getMonth() === +m[1] - 1 ? iso(d) : null; };
  function compRows(days) {
    const out = [];
    for (const x of (Array.isArray(days) ? days : []).slice(0, 62)) {
      const d = compDate(x && x.date), ops = compMoney(x && x.ops);
      if (d && ops != null && ops >= 0 && ops < 1e7 && !out.some((o) => o.d === d)) out.push({ d, ops, trend: compMoney(x.trend) });
    }
    return out.sort((a, b) => (a.d < b.d ? -1 : 1));
  }
  // Pasted text: what the bookmark copied, or RAD's Forecast table selected and copied by hand (date, trend, forecast).
  function compParse(text) {
    const t = String(text || ''), j = t.indexOf('{');
    if (/ShiftCraft forecast/i.test(t) && j >= 0) { try { const m = JSON.parse(t.slice(j)); if (m && m.type === 'shiftcraft-forecast') return { site: m.site, days: compRows(m.days) }; } catch (e) { /* not JSON: try as a table */ } }
    const days = [];
    // RAD's table copies with nothing between the cells ("11/23/2026$2,830$2,830-13.6%"), or with tabs, or a cell per line:
    // after each date, the next two dollar amounts are the trend and the forecast (the Week total has no date, so it is left out).
    const tok = [...t.matchAll(/(\d{1,2}\/\d{1,2}\/\d{4})|(-?\$\s?[\d,]+(?:\.\d+)?)/g)];
    tok.forEach((m, i) => { if (!m[1]) return; const amt = []; for (let k = i + 1; k < tok.length && !tok[k][1] && amt.length < 2; k++) amt.push(tok[k][2]); if (amt.length === 2) days.push({ date: m[1], trend: amt[0], ops: amt[1] }); });
    return { site: '', days: compRows(days) };
  }
  let compOpen = false;
  function companionImport(got) {
    const c = companion(), rows = got.days;
    if (!rows.length) return toast(`Nothing to use: no dates with a forecast came from ${c.name}.`);
    if (compOpen) return; compOpen = true;
    const inPlan = new Set(Array.from({ length: plan.weeks }, (_, k) => weekDays(k)).flat());
    const boxes = rows.map((r) => h('input', { type: 'checkbox', checked: true, 'aria-label': 'Use ' + usDate(r.d) }));
    const all = h('input', { type: 'checkbox', checked: true, 'aria-label': 'Use every day', onchange: () => boxes.forEach((b) => { b.checked = all.checked; }) });
    const now = (d) => (plan.forecast[d] != null && plan.forecast[d] !== '' ? money(+plan.forecast[d]) : '—');
    const out = rows.filter((r) => !inPlan.has(r.d)).length;
    const body = [h('p', { class: 'hint' }, `From ${got.site || c.name}: ${rows.length} day${rows.length === 1 ? '' : 's'}, ${usDate(rows[0].d)} to ${usDate(rows[rows.length - 1].d)}. The ticked days get ${c.name}’s Forecast Ops as your forecast.`),
      h('div', { class: 'table-wrap' }, h('table', { class: 't' },
        h('thead', null, h('tr', null, h('th', null, all), h('th', null, 'Date'), h('th', { class: 'num' }, `${c.name} trend`), h('th', { class: 'num' }, `${c.name} forecast`), h('th', { class: 'num' }, 'Yours now'))),
        h('tbody', null, rows.map((r, i) => h('tr', null, h('td', null, boxes[i]), h('td', null, `${dayName(r.d, 'short')} ${usDate(r.d)}${inPlan.has(r.d) ? '' : ' *'}`),
          h('td', { class: 'num' }, r.trend == null ? '' : money(r.trend)), h('td', { class: 'num fc' }, money(r.ops) + (r.ops === 0 ? ' (closed?)' : '')), h('td', { class: 'num' }, now(r.d))))))),
      out ? h('p', { class: 'hint' }, `* ${out} day${out === 1 ? ' is' : 's are'} outside the weeks of this plan: kept by date, shown when the plan reaches ${out === 1 ? 'it' : 'them'}.`) : null];
    modal({ title: `Forecast from ${c.name}`, wide: true, body, onClose: () => { compOpen = false; },
      actions: [{ label: 'Cancel' }, { label: 'Use these', primary: true, onClick: () => {
        const use = rows.filter((r, i) => boxes[i].checked); if (!use.length) return;
        change(() => { use.forEach((r) => { plan.forecast[r.d] = r.ops; }); plan.companionLast = { site: got.site || c.name, at: new Date().toISOString(), from: use[0].d, to: use[use.length - 1].d, days: use.length }; if (inPlan.has(use[0].d)) ui.day = use[0].d; fcAt = mondayOf(use[0].d); try { localStorage.setItem(FC_KEY, fcAt); } catch (e) { /* ignore */ } });
        toast(`Forecast for ${use.length} day${use.length === 1 ? '' : 's'} from ${c.name} is in.`);
      } }] });
  }
  // Ctrl+V anywhere on the Forecast screen (not in a box you type in): a pasted forecast opens the check window
  document.addEventListener('paste', (e) => {
    if (ui.tab !== 'forecast' || $('.backdrop')) return;
    const el = e.target; if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    const got = compParse(e.clipboardData && e.clipboardData.getData('text/plain'));
    if (!got.days.length) return toast(`Nothing to use in that: copy ${companion().name}’s Forecast table (or the whole page) and paste again.`);
    e.preventDefault(); companionImport(got);
  });
  function companionPaste() {
    const c = companion(), ta = h('textarea', { class: 'input', rows: 8, placeholder: `Paste here (Ctrl+V): ${c.name}’s Forecast table, or the whole Forecast page (Ctrl+A, Ctrl+C there). Only the dates and amounts are used.`, style: { width: '100%', fontFamily: 'monospace', fontSize: '12px' } });
    const err = h('p', { class: 'error bad', hidden: true });
    modal({ title: `Paste from ${c.name}`, body: [ta, err], actions: [{ label: 'Cancel' }, { label: 'Next', primary: true, onClick: () => {
      const got = compParse(ta.value); if (!got.days.length) { err.textContent = 'No dates with amounts found in that text.'; err.hidden = false; return false; }
      setTimeout(() => companionImport(got), 0);
    } }] });
  }
  function companionCard() {
    const c = companion(), last = plan.companionLast;
    return h('div', { class: 'inline', style: { marginTop: '10px', flexWrap: 'wrap', gap: '6px' } },
      h('span', { class: 'hint' }, `Companion site: ${c.name}`),
      h('button', { class: 'btn sm', title: c.url, onclick: openCompanion }, `Open ${c.name}`),
      h('button', { class: 'btn sm primary', onclick: companionPaste }, `Paste from ${c.name}…`),
      h('span', { class: 'hint' }, `(or copy ${c.name}’s Forecast page and press Ctrl+V here)`),
      last && last.at ? h('span', { class: 'hint' }, `Last from ${last.site}: ${usDate(last.from)}–${usDate(last.to)}, ${new Date(last.at).toLocaleString([], { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`) : null);
  }
