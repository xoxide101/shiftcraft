  // ===================================================================
  // Calendar: time off, special store hours and events
  // ===================================================================
  // plan.specialHours = [{ id, from, to, name, closed, open, close, note, ics? }]
  //   Store hours for a holiday (or any day): they take the place of the usual opening hours on those days. closed =
  //   shut all day. Check schedule points out shifts on a closed day, and shifts well outside the special hours.
  // plan.events = [{ id, from, to, title, hours: null | [start, end], note, ics? }]
  //   Notes and information for a day (a delivery, a meeting, an inspection, a promotion). They change nothing.
  // Time off stays on each person (p.timeOff, 19-time-off.js). The Calendar tab shows all three a month at a time or as
  // a list to search and sort, and they go out to and come in from other calendars as iCal (.ics) files (20-ical.js).
  // ics: the UID an entry had in a calendar file it came from, so bringing the same file in again updates it.
  const specialOn = (d) => (plan.specialHours || []).filter((x) => x.from <= d && d <= x.to).slice(-1)[0] || null;
  const eventsOn = (d) => (plan.events || []).filter((x) => x.from <= d && d <= x.to).sort((a, b) => (a.hours ? a.hours[0] : -1) - (b.hours ? b.hours[0] : -1));
  // ---------- Usual store hours, Monday to Sunday ----------
  // plan.hours.days = 7 entries, Monday first: { open, close } | { closed: true } | null (not set). One list, edited on the
  // Calendar and on Company & Location alike. Older plans had plan.hours.wk / .we (weekdays / weekend): those fill the
  // days until the week is changed. Special store hours (a holiday) take the place of the usual hours on their days.
  const dayIdx = (d) => (parseIso(d).getDay() + 6) % 7;
  const usualWeek = () => { const hs = plan.hours || {}; return Array.isArray(hs.days) ? WEEKDAYS.map((_, i) => hs.days[i] || null) : WEEKDAYS.map((_, i) => hs[i >= 5 ? 'we' : 'wk'] || null); };
  const usualOn = (d) => usualWeek()[dayIdx(d)];
  const regularHours = (d) => { const u = usualOn(d); return u && !u.closed ? u : null; };
  // the store's hours on a day: special hours win, otherwise the usual hours for that weekday (null: not set)
  const storeHoursOn = (d) => { const sp = specialOn(d); if (sp) return { closed: !!sp.closed, open: sp.open, close: sp.close, special: sp }; const u = usualOn(d); return u ? { closed: !!u.closed, open: u.open, close: u.close, special: null } : null; };
  const setUsual = (fn) => change(() => { const w = usualWeek(); fn(w); plan.hours = { days: w }; });
  const usualText = (u) => (!u ? 'not set' : u.closed ? 'closed' : `${clockShort(u.open)}–${clockShort(u.close)}`);
  // one line for the week, alike days together: "Mon–Fri 7am–9pm · Sat 8am–9pm · Sun closed"
  const usualSummary = () => {
    const w = usualWeek(), out = [];
    if (w.every((u) => !u)) return '';
    for (let i = 0; i < 7;) { let j = i; while (j < 6 && usualText(w[j + 1]) === usualText(w[i])) j++; out.push(`${WEEKDAYS[i].slice(0, 3)}${j > i ? '–' + WEEKDAYS[j].slice(0, 3) : ''} ${usualText(w[i])}`); i = j + 1; }
    return out.join(' · ');
  };
  // the Monday-to-Sunday editor (Calendar and Company & Location)
  function usualHoursEditor() {
    const w = usualWeek();
    const lastSet = (i) => { for (let k = i - 1; k >= 0; k--) if (w[k] && !w[k].closed) return w[k]; return w.find((u) => u && !u.closed) || { open: 420, close: 1260 }; };
    const row = (day, i) => {
      const cur = w[i], label = h('b', null, day);
      const same = i > 0 && w[i - 1] && usualText(w[i - 1]) !== usualText(cur) ? h('button', { class: 'btn sm ghost', title: `Use ${WEEKDAYS[i - 1]}’s hours on ${day} too`, onclick: () => setUsual((x) => { x[i] = { ...x[i - 1] }; }) }, `Same as ${WEEKDAYS[i - 1].slice(0, 3)}`) : h('span');
      if (!cur) return h('div', { class: 'co-hours' }, label, h('span', { class: 'muted' }, 'Not set'),
        h('div', { class: 'inline' }, h('button', { class: 'btn sm', onclick: () => setUsual((x) => { const l = lastSet(i); x[i] = { open: l.open, close: l.close }; }) }, 'Set hours'), h('button', { class: 'btn sm ghost', onclick: () => setUsual((x) => { x[i] = { closed: true }; }) }, 'Closed')), same);
      if (cur.closed) return h('div', { class: 'co-hours' }, label, h('span', { class: 'bad' }, 'Closed'),
        h('div', { class: 'inline' }, h('button', { class: 'btn sm', onclick: () => setUsual((x) => { const l = lastSet(i); x[i] = { open: l.open, close: l.close }; }) }, 'Open this day'), h('button', { class: 'btn sm ghost', title: 'Clear: not set', onclick: () => setUsual((x) => { x[i] = null; }) }, 'Clear')), same);
      const a = timePicker(cur.open, day + ' opens'), b = timePicker(cur.close, day + ' closes');
      const save = (moved) => { let o = a.value, c = b.value; if (c <= o) { if (moved === 'open') c = Math.min(DAY_END, o + 60); else o = Math.max(DAY_START, c - 60); } setUsual((x) => { x[i] = { open: o, close: c }; }); };
      a.addEventListener('change', () => save('open')); b.addEventListener('change', () => save('close'));
      return h('div', { class: 'co-hours' }, label, h('div', { class: 'inline', style: { flexWrap: 'nowrap' } }, a, '–', b),
        h('div', { class: 'inline' }, h('button', { class: 'btn sm ghost', title: `Closed every ${day}`, onclick: () => setUsual((x) => { x[i] = { closed: true }; }) }, 'Closed'), h('button', { class: 'btn sm ghost', title: 'Clear: not set', onclick: () => setUsual((x) => { x[i] = null; }) }, 'Clear')), same);
    };
    return h('div', { class: 'usual-hours' }, WEEKDAYS.map(row),
      h('p', { class: 'hint', style: { margin: '6px 0 0' } }, 'The same hours as on Company & Location (change them in either place). Special store hours on the Calendar, like Thanksgiving, Christmas or New Year’s Day, take their place on those days.'));
  }
  const specialText = (x) => (x.closed ? 'Closed all day' : `Open ${clock(x.open)} – ${clock(x.close)}`);
  const specialShort = (x) => (x.closed ? 'Closed' : `${clockShort(x.open)}–${clockShort(x.close)}`);
  const datesOnly = (x) => timeOffWhen({ from: x.from, to: x.to, hours: null });
  const calGo = () => { ui.tab = 'calendar'; persist(); render(); };

  // US holidays a store often keeps other hours on (true: usually closed all day)
  const nthDay = (y, m, dow, n) => {
    if (n > 0) { const d = new Date(y, m, 1); d.setDate(1 + ((dow - d.getDay() + 7) % 7) + (n - 1) * 7); return iso(d); }
    const d = new Date(y, m + 1, 0); d.setDate(d.getDate() - ((d.getDay() - dow + 7) % 7)); return iso(d);
  };
  const easterOf = (y) => {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const hh = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - hh - k) % 7, m = Math.floor((a + 11 * hh + 22 * l) / 451);
    return iso(new Date(y, Math.floor((hh + l - 7 * m + 114) / 31) - 1, ((hh + l - 7 * m + 114) % 31) + 1));
  };
  const HOLIDAYS = [
    ['New Year’s Day', (y) => `${y}-01-01`, true], ['Martin Luther King Jr. Day', (y) => nthDay(y, 0, 1, 3)], ['Presidents’ Day', (y) => nthDay(y, 1, 1, 3)],
    ['Easter Sunday', easterOf, true], ['Mother’s Day', (y) => nthDay(y, 4, 0, 2)], ['Memorial Day', (y) => nthDay(y, 4, 1, -1)], ['Father’s Day', (y) => nthDay(y, 5, 0, 3)],
    ['Juneteenth', (y) => `${y}-06-19`], ['Independence Day', (y) => `${y}-07-04`], ['Labor Day', (y) => nthDay(y, 8, 1, 1)], ['Halloween', (y) => `${y}-10-31`],
    ['Thanksgiving', (y) => nthDay(y, 10, 4, 4), true], ['Black Friday', (y) => addDays(nthDay(y, 10, 4, 4), 1)], ['Christmas Eve', (y) => `${y}-12-24`],
    ['Christmas Day', (y) => `${y}-12-25`, true], ['New Year’s Eve', (y) => `${y}-12-31`]];
  const holidaysFrom = (d, n = 18) => { const y = +d.slice(0, 4); return [y, y + 1].flatMap((yy) => HOLIDAYS.map(([name, fn, closed]) => ({ name, date: fn(yy), closed: !!closed }))).filter((x) => x.date >= d).sort((a, b) => a.date.localeCompare(b.date)).slice(0, n); };

  // a row of buttons where one is pressed (like the Status buttons on Time off)
  function calSeg(label, options, value, pick) {
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': label }, options.map(([v, l]) => h('button', { type: 'button', class: 'btn', 'aria-pressed': String(value === v),
      onclick: (e) => { seg.querySelectorAll('.btn').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); pick(v); } }, l)));
    return seg;
  }
  const dateIn = (v) => h('input', { class: 'input', type: 'date', value: v || '' });
  const pair2 = (a, b) => h('div', { class: 'inline', style: { alignItems: 'flex-end' } }, a, b);
  const fieldOf = (label, el) => h('label', { class: 'field' }, h('span', null, label), el);
  const shiftsBetween = (a, b) => Object.keys(plan.shifts).filter((d) => d >= a && d <= b).reduce((n, d) => n + plan.shifts[d].length, 0);

  // ---------- Special store hours ----------
  function specialDialog(x, preset) {
    const today = iso(new Date()), at = (preset && preset.from) || (x && x.from) || ui.day, base = regularHours(at) || { open: 600, close: 960 };
    const cur = x || { from: at, to: at, name: '', closed: false, open: base.open, close: base.close, note: '', ...(preset || {}) };
    const name = h('input', { class: 'input', value: cur.name || '', placeholder: 'e.g. Christmas Eve · Inventory day · Storm', maxLength: 80 });
    const from = dateIn(cur.from), to = dateIn(cur.to);
    const hl = holidaysFrom(today);
    const hol = h('select', { class: 'input', 'aria-label': 'Holiday' }, h('option', { value: '' }, 'Pick a holiday (fills in the name and date)…'),
      hl.map((o, i) => h('option', { value: i }, `${o.name} · ${dayName(o.date, 'short')} ${shortDate(o.date)}, ${o.date.slice(0, 4)}${o.closed ? ' (often closed)' : ''}`)));
    let closed = !!cur.closed;
    const seg = calSeg('Open or closed', [[false, 'Open, other hours'], [true, 'Closed all day']], closed, (v) => { closed = v; sync(); });
    const a = timePicker(cur.open, 'Opens'), b = timePicker(cur.close, 'Closes');
    const hoursRow = pair2(fieldOf('Opens', a), fieldOf('Closes', b));
    const note = h('textarea', { class: 'input', rows: 2, maxLength: 300, placeholder: 'Optional, e.g. close at 4 so everyone is home for dinner · skeleton crew' }, cur.note || '');
    const info = h('p', { class: 'hint', style: { margin: 0 } });
    hol.onchange = () => { const o = hl[+hol.value]; if (!o) return; name.value = o.name; from.value = to.value = o.date; closed = o.closed; seg.querySelectorAll('.btn').forEach((btn, i) => btn.setAttribute('aria-pressed', String(i === (closed ? 1 : 0)))); sync(); };
    const sync = () => {
      if (to.value && from.value && to.value < from.value) to.value = from.value;
      if (!to.value) to.value = from.value;
      hoursRow.style.display = closed ? 'none' : '';
      if (!from.value) { info.textContent = ''; return; }
      const r = regularHours(from.value), n = shiftsBetween(from.value, to.value || from.value);
      info.textContent = `Usual hours on ${dayName(from.value)}: ${r ? `${clock(r.open)} – ${clock(r.close)}` : 'not set (Company & Location)'}.`
        + (n ? ` ${n} shift${n === 1 ? ' is' : 's are'} already scheduled on ${from.value === to.value ? 'that day' : 'those days'}${closed ? ': Check schedule will point them out.' : '.'}` : '');
    };
    [from, to].forEach((e) => e.addEventListener('input', sync));
    sync();
    const actions = [{ label: 'Cancel' }];
    if (x) actions.unshift({ label: 'Delete', danger: true, left: true, onClick: () => { change(() => { plan.specialHours = plan.specialHours.filter((y) => y.id !== x.id); if (!plan.specialHours.length) delete plan.specialHours; }); toast('Special hours deleted. You can undo this.', { label: 'Undo', fn: undo }); } });
    actions.push({ label: x ? 'Save' : 'Add special hours', primary: true, onClick: () => {
      if (!from.value) { toast('Pick the day.'); return false; }
      if (!closed && b.value <= a.value) { toast('Closing time must be after opening time.'); return false; }
      const e = { id: x ? x.id : uid(), from: from.value, to: to.value < from.value ? from.value : to.value, name: name.value.replace(/\s+/g, ' ').trim(), closed, open: a.value, close: b.value, note: note.value.trim(), ...(x && x.ics ? { ics: x.ics } : {}) };
      change(() => { plan.specialHours = (plan.specialHours || []).filter((y) => y.id !== e.id).concat(e).sort((p, q) => p.from.localeCompare(q.from)); });
      toast(`${e.name || 'Special hours'}: ${specialText(e).toLowerCase()}, ${datesOnly(e)}.`);
    } });
    modal({ title: x ? `Special hours · ${x.name || datesOnly(x)}` : 'Special store hours', body: [
      h('p', { class: 'hint', style: { marginTop: 0 } }, 'Other opening hours for a holiday or any day: they take the place of the usual hours on those days. Nothing on the schedule moves; Check schedule points out shifts on a closed day or well outside these hours.'),
      fieldOf('Holiday', hol), fieldOf('Name', name),
      pair2(fieldOf('First day', from), fieldOf('Last day (the same for one day)', to)),
      h('div', { class: 'field' }, h('span', null, 'The store is'), seg), hoursRow, info,
      fieldOf('Note', note)], actions });
  }

  // ---------- Events: notes and information for a day ----------
  function eventDialog(x, preset) {
    const at = (preset && preset.from) || ui.day;
    const cur = x || { from: at, to: at, title: '', hours: null, note: '', ...(preset || {}) };
    const title = h('input', { class: 'input', value: cur.title || '', placeholder: 'e.g. Truck delivery · Health inspection · Team meeting · Sidewalk sale', maxLength: 120 });
    const from = dateIn(cur.from), to = dateIn(cur.to);
    let allDay = !cur.hours;
    const seg = calSeg('When in the day', [[true, 'All day'], [false, 'At a time']], allDay, (v) => { allDay = v; sync(); });
    const a = timePicker(cur.hours ? cur.hours[0] : 540, 'Starts'), b = timePicker(cur.hours ? cur.hours[1] : 600, 'Ends');
    const hoursRow = pair2(fieldOf('From', a), fieldOf('Until', b));
    const note = h('textarea', { class: 'input', rows: 3, maxLength: 500, placeholder: 'Anything to know: who is coming, what to get ready, a phone number…' }, cur.note || '');
    const sync = () => { if (to.value && from.value && to.value < from.value) to.value = from.value; if (!to.value) to.value = from.value; hoursRow.style.display = allDay ? 'none' : ''; };
    [from, to].forEach((e) => e.addEventListener('input', sync));
    sync();
    const actions = [{ label: 'Cancel' }];
    if (x) actions.unshift({ label: 'Delete', danger: true, left: true, onClick: () => { change(() => { plan.events = plan.events.filter((y) => y.id !== x.id); if (!plan.events.length) delete plan.events; }); toast('Event deleted. You can undo this.', { label: 'Undo', fn: undo }); } });
    actions.push({ label: x ? 'Save' : 'Add event', primary: true, onClick: () => {
      const t = title.value.replace(/\s+/g, ' ').trim();
      if (!t) { toast('Give the event a name.'); title.focus(); return false; }
      if (!from.value) { toast('Pick the day.'); return false; }
      if (!allDay && b.value <= a.value) { toast('The event must end after it starts.'); return false; }
      const e = { id: x ? x.id : uid(), from: from.value, to: to.value < from.value ? from.value : to.value, title: t, hours: allDay ? null : [a.value, b.value], note: note.value.trim(), ...(x && x.ics ? { ics: x.ics } : {}) };
      change(() => { plan.events = (plan.events || []).filter((y) => y.id !== e.id).concat(e).sort((p, q) => p.from.localeCompare(q.from)); });
      toast(`${e.title}: ${timeOffWhen(e)}.`);
    } });
    modal({ title: x ? `Event · ${x.title}` : 'Event or note for a day', body: [
      h('p', { class: 'hint', style: { marginTop: 0 } }, 'Extra information for a day. It shows on the Calendar, the Schedule and the Week, and changes nothing else.'),
      fieldOf('What', title), pair2(fieldOf('First day', from), fieldOf('Last day (the same for one day)', to)),
      h('div', { class: 'field' }, h('span', null, 'When'), seg), hoursRow, fieldOf('Notes', note)], actions });
  }

  // ---------- Everything on the calendar, as one list ----------
  const CAL_KIND = { timeoff: 'Time off', special: 'Store hours', event: 'Event' };
  function calItems() {
    const out = [];
    plan.staff.filter((p) => !p.left).forEach((p) => (p.timeOff || []).forEach((t) => out.push({ kind: 'timeoff', status: t.status, from: t.from, to: t.to, hours: t.hours, who: p.name, title: TIME_OFF_WHY[t.why] || 'Time off', note: t.note || '', p, t })));
    (plan.specialHours || []).forEach((x) => out.push({ kind: 'special', status: x.closed ? 'closed' : 'open', from: x.from, to: x.to, hours: null, who: '', title: x.name || 'Special hours', note: x.note || '', x }));
    (plan.events || []).forEach((x) => out.push({ kind: 'event', status: '', from: x.from, to: x.to, hours: x.hours, who: '', title: x.title, note: x.note || '', x }));
    return out;
  }
  const calOpen = (it) => (it.kind === 'timeoff' ? timeOffDialog(it.p, it.t) : it.kind === 'special' ? specialDialog(it.x) : eventDialog(it.x));
  const calHours = (it) => (it.kind === 'special' ? specialText(it.x) : it.hours ? `${clock(it.hours[0])} – ${clock(it.hours[1])}` : 'All day');
  const calStatus = (it) => (it.kind === 'timeoff' ? TIME_OFF_STATUS[it.status] || '' : it.kind === 'special' ? (it.x.closed ? 'Closed' : 'Special hours') : '');
  const calWhat = (it) => (it.kind === 'timeoff' ? `${it.who} · ${it.title}` : it.title);
  const calText = (it) => [CAL_KIND[it.kind], it.who, it.title, it.note, calHours(it), calStatus(it), datesOnly(it), it.from, it.to, it.kind === 'timeoff' && it.status === 'requested' ? 'request' : ''].join(' ').toLowerCase();
  const calTip = (it) => [`${CAL_KIND[it.kind]}: ${calWhat(it)}`, `${datesOnly(it)} · ${calHours(it)}`, calStatus(it), it.note ? 'Note: ' + it.note : '', 'Click to see or change it'].filter(Boolean).join('\n');
  const calChipText = (it) => (it.kind === 'special' ? `${specialShort(it.x)} · ${it.title}` : it.kind === 'event' ? `${it.hours ? clockShort(it.hours[0]) + ' ' : ''}${it.title}`
    : `${it.status === 'requested' ? '? ' : ''}${it.who} · ${it.title}${it.hours ? ` ${clockShort(it.hours[0])}–${clockShort(it.hours[1])}` : ''}`);
  const calChip = (it) => h('button', { type: 'button', class: `cal-chip ${it.kind} ${it.status}`, title: calTip(it), onclick: (e) => { e.stopPropagation(); calOpen(it); } }, calChipText(it));
  const calOrder = (a, b) => ['special', 'event', 'timeoff'].indexOf(a.kind) - ['special', 'event', 'timeoff'].indexOf(b.kind) || (a.hours ? a.hours[0] : -1) - (b.hours ? b.hours[0] : -1) || calWhat(a).localeCompare(calWhat(b));

  // what the Calendar shows (kept in this browser, and in Save everything with the other choices)
  const CAL_KEY = 'shiftcraft-calendar';
  const CAL_SHOW = { requested: true, approved: true, denied: false, special: true, event: true };
  const cal = { ym: '', view: 'month', q: '', show: { ...CAL_SHOW }, range: 'upcoming', sort: 'from', dir: 1 };
  try { const c = JSON.parse(localStorage.getItem(CAL_KEY) || '{}'); ['view', 'range', 'sort'].forEach((k) => { if (typeof c[k] === 'string') cal[k] = c[k]; }); if (c.dir === -1) cal.dir = -1; if (c.show) Object.assign(cal.show, c.show); } catch (e) { /* blocked */ }
  const calSave = () => { try { localStorage.setItem(CAL_KEY, JSON.stringify({ view: cal.view, show: cal.show, range: cal.range, sort: cal.sort, dir: cal.dir })); } catch (e) { /* blocked */ } };
  const calShown = (it) => (it.kind === 'timeoff' ? cal.show[it.status] : cal.show[it.kind]) && cal.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => calText(it).includes(w));
  const calList = () => { cal.view = 'list'; calSave(); calGo(); };

  // ---------- One day: everything on it, and adding to it ----------
  function dayDialog(d) {
    const its = calItems().filter((it) => it.from <= d && d <= it.to).sort(calOrder);
    const r = regularHours(d), sp = specialOn(d);
    let m;
    const add = (fn) => () => { m.close(); fn(); };
    const line = (it) => h('li', { style: { margin: '4px 0', opacity: it.status === 'denied' ? 0.55 : 1 } }, h('a', { href: '#', onclick: (e) => { e.preventDefault(); m.close(); calOpen(it); } }, h('b', null, calWhat(it))),
      ` · ${calHours(it)}`, calStatus(it) && it.kind === 'timeoff' ? [' · ', h('span', { class: it.status === 'requested' ? 'warn' : it.status === 'approved' ? 'good' : 'muted' }, calStatus(it))] : '', it.note ? h('span', { class: 'muted' }, ` — ${it.note}`) : null);
    const sect = (label, list, none) => [h('h3', { class: 'co-h3' }, label), list.length ? h('ul', { style: { margin: 0, paddingLeft: '18px' } }, list.map(line)) : h('p', { class: 'muted small', style: { margin: 0 } }, none)];
    const inPlan = planDays().includes(d);
    m = modal({ title: longDate(d), body: [
      h('p', { style: { margin: '0 0 4px' } }, h('b', null, 'Store hours: '), sp ? [`${specialText(sp)} (${sp.name || 'special hours'})`, h('span', { class: 'muted' }, ` · instead of the usual ${usualText(usualOn(d))}`)] : r ? `${clock(r.open)} – ${clock(r.close)} (usual)` : usualOn(d) ? h('span', { class: 'bad' }, 'Closed (usual)') : 'usual hours not set',
        inPlan ? h('span', { class: 'muted' }, ` · ${shiftsOn(d).length} on the schedule`) : null),
      sect('Events', its.filter((it) => it.kind === 'event'), 'No events.'),
      sect('Time off', its.filter((it) => it.kind === 'timeoff'), 'Nobody has time off.'),
      h('div', { class: 'inline', style: { marginTop: '14px' } },
        h('button', { class: 'btn sm', onclick: add(() => eventDialog(null, { from: d, to: d })) }, '+ Event'),
        h('button', { class: 'btn sm', onclick: add(() => (sp ? specialDialog(sp) : specialDialog(null, { from: d, to: d }))) }, sp ? 'Special hours…' : '+ Special hours'),
        h('button', { class: 'btn sm', disabled: !plan.staff.some((p) => !p.left), onclick: add(() => timeOffDialog(null, null, { from: d, to: d, status: 'requested', why: 'personal' })) }, '+ Time off request'),
        inPlan ? h('button', { class: 'btn sm', onclick: add(() => { ui.day = d; ui.tab = 'schedule'; persist(); render(); }) }, 'Open on the Schedule') : null)],
    actions: [{ label: 'Close', primary: true }] });
  }

  // ---------- The Calendar tab ----------
  function calendarView(main) {
    if (!cal.ym) cal.ym = ui.day.slice(0, 7);
    const today = iso(new Date());
    const items = calItems(), shown = items.filter(calShown);
    const [yy, mm] = cal.ym.split('-').map(Number), mFirst = cal.ym + '-01', mLast = iso(new Date(yy, mm, 0));
    const toMonth = (n) => { cal.ym = iso(new Date(yy, mm - 1 + n, 1)).slice(0, 7); render(); };
    const search = h('input', { class: 'input', type: 'search', id: 'cal-q', value: cal.q, placeholder: 'Search: a name, holiday, reason, note, “request”…', 'aria-label': 'Search the calendar', style: { width: '300px', maxWidth: '100%' } });
    search.addEventListener('input', () => { cal.q = search.value; render(); const s = $('#cal-q'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } });
    const count = (f) => items.filter(f).length;
    const show = (k, label, f, title) => h('label', { class: 'check small', title }, h('input', { type: 'checkbox', checked: !!cal.show[k], onchange: (e) => { cal.show[k] = e.target.checked; calSave(); render(); } }), h('span', { class: 'cal-key ' + k }), ` ${label} (${count(f)})`);
    const isList = cal.view === 'list';
    main.append(h('div', { class: 'card' },
      h('div', { class: 'daynav' },
        isList ? null : h('div', { class: 'inline no-print' },
          h('button', { class: 'btn icon', 'aria-label': 'Previous month', onclick: () => toMonth(-1) }, '‹'),
          h('button', { class: 'btn icon', 'aria-label': 'Next month', onclick: () => toMonth(1) }, '›')),
        h('h1', { style: { textAlign: 'left', minWidth: 0 } }, isList ? 'Calendar · list' : `Calendar · ${monthLabel(cal.ym)}`),
        isList ? null : h('button', { class: 'btn sm no-print', disabled: cal.ym === today.slice(0, 7), onclick: () => { cal.ym = today.slice(0, 7); render(); } }, 'This month'),
        h('span', { class: 'spacer' }),
        h('div', { class: 'no-print' }, calSeg('Show as', [['month', 'Month'], ['list', 'List']], cal.view, (v) => { cal.view = v; calSave(); render(); })),
        h('span', { class: 'no-print' }, ibs(ib('print', 'Print what you see (choose where the details go: store hours, time off, events, holidays)', (e) => { const r = e.currentTarget.getBoundingClientRect(); calPrintMenu(r.left, r.bottom + 4); })))),
      h('div', { class: 'inline no-print', style: { marginTop: '10px', gap: '14px' } }, search,
        show('requested', 'Requests', (it) => it.kind === 'timeoff' && it.status === 'requested', 'Time off asked for, still to approve'),
        show('approved', 'Approved', (it) => it.kind === 'timeoff' && it.status === 'approved', 'Approved time off'),
        show('denied', 'Denied', (it) => it.kind === 'timeoff' && it.status === 'denied', 'Denied time off (kept as a record)'),
        show('special', 'Store hours', (it) => it.kind === 'special', 'Special store hours: holidays and other days'),
        show('event', 'Events', (it) => it.kind === 'event', 'Events and notes for a day')),
      h('div', { class: 'inline no-print', style: { marginTop: '10px' } },
        h('button', { class: 'btn sm primary', onclick: () => eventDialog(null, { from: isList ? today : ui.day.slice(0, 7) === cal.ym ? ui.day : mFirst }) }, '+ Event'),
        h('button', { class: 'btn sm', onclick: () => specialDialog(null) }, '+ Special store hours'),
        h('button', { class: 'btn sm', disabled: !plan.staff.some((p) => !p.left), onclick: () => timeOffDialog(null, null, { status: 'requested', why: 'personal' }) }, '+ Time off request'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn sm', title: 'Bring in an iCal (.ics) file from Outlook, Google Calendar, Apple Calendar or ShiftCraft: holidays, time off, events', onclick: icalImport }, 'Import iCal…'),
        h('button', { class: 'btn sm', title: 'Save time off, store hours and events as an iCal (.ics) file for Outlook, Google Calendar or Apple Calendar', onclick: () => icalExportDialog() }, 'Export iCal…'))));
    if (isList) { main.append(calListCard(shown, today, mFirst, mLast), usualHoursCard()); return; }

    // the month, Monday first. Printed, every entry gets a number (in date order) and the numbered notes say what it is,
    // under the month or on a page of their own (29-page-notes.js); on screen the colours do that
    const pbook = noteBook();
    const numOf = (it) => (it.kind === 'special' ? pbook.add(noteKey.sp(it.x), noteSpecial(it.x)) : it.kind === 'event' ? pbook.add(noteKey.ev(it.x), noteEvent(it.x)) : pbook.add(noteKey.to(it.p, it.t), noteTimeOff(it.p, it.t)));
    const chipN = (it) => { const c = calChip(it); if (notesWhere !== 'off') c.prepend(h('span', { class: 'cal-n' }, supNum(numOf(it)) + ' ')); return c; };
    const start = mondayOf(mFirst), weeks = Math.ceil((Math.round((parseIso(mLast) - parseIso(start)) / 864e5) + 1) / 7);
    const MAX = 6;
    const rows = Array.from({ length: weeks }, (_, w) => h('tr', null, Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, w * 7 + i), its = shown.filter((it) => it.from <= d && d <= it.to).sort(calOrder), sp = specialOn(d), st = storeHoursOn(d);
      const n = planDays().includes(d) ? shiftsOn(d).length : 0;
      return h('td', { class: 'cal-day' + (d.slice(0, 7) !== cal.ym ? ' cal-out' : '') + (d === today ? ' cal-today' : '') + (st && st.closed ? ' cal-closed' : ''), ondblclick: (e) => { if (e.target === e.currentTarget) dayDialog(d); } },
        h('div', { class: 'cal-head' },
          h('button', { type: 'button', class: 'cal-num', title: `${longDate(d)}: see everything on this day and add to it`, onclick: () => dayDialog(d) }, String(parseIso(d).getDate())),
          n ? h('span', { class: 'small muted', title: `${n} on the schedule` }, `${n} sched.`) : null,
          h('button', { type: 'button', class: 'cal-add no-print', title: 'Add an event, special hours or time off on this day', 'aria-label': `Add to ${longDate(d)}`, onclick: () => dayDialog(d) }, '+')),
        // the store's hours that day: special hours (a holiday) win over the usual ones
        st ? h('div', { class: 'cal-hrs' + (sp ? ' special' : '') + (st.closed ? ' closed' : ''), title: sp ? `${sp.name || 'Special hours'}: ${specialText(sp).toLowerCase()} (usual: ${usualText(usualOn(d))})` : `Usual hours on ${WEEKDAYS[dayIdx(d)]}s` }, st.closed ? 'Closed' : `${clockShort(st.open)}–${clockShort(st.close)}`) : null,
        its.slice(0, its.length > MAX ? MAX - 1 : MAX).map(chipN),
        its.length > MAX ? h('button', { type: 'button', class: 'cal-more', onclick: () => dayDialog(d) }, `+${its.length - MAX + 1} more`) : null,
        // printed: the ones that don't fit as numbers only
        its.length > MAX && notesWhere !== 'off' ? h('div', { class: 'cal-n cal-nmore' }, its.slice(MAX - 1).map((it) => supNum(numOf(it))).join(',')) : null);
    })));
    main.append(h('div', { class: 'card' }, h('div', { class: 'table-wrap' }, h('table', { class: 'cal' },
      h('thead', null, h('tr', null, WEEKDAYS.map((w) => h('th', null, w.slice(0, 3))))), h('tbody', null, rows))),
      h('p', { class: 'hint', style: { margin: '8px 0 0' } }, 'Click a day’s number (or +) to see everything on it and add to it. Click an entry to change it. Under each date: the store’s hours (bold when special hours take the place of the usual ones). ? marks a time off request still to approve; a dashed line is a request, a red day is closed.')));
    // printed: the details for the weeks shown (store hours, time off, events, holidays, as on the availability list),
    // each entry with the number it has on the month; under the month or on a page of their own
    if (notesWhere !== 'off') main.append(h('div', { class: 'cal-pnotes al-sheet' + (notesWhere === 'separate' ? ' sep' : '') }, h('style', null, AL_CSS),
      h('h3', null, `Details · ${monthLabel(cal.ym)}`),
      availDetails([start, addDays(start, weeks * 7 - 1)], { show: cal.show, num: { sp: (x) => pbook.add(noteKey.sp(x), noteSpecial(x)), ev: (x) => pbook.add(noteKey.ev(x), noteEvent(x)), to: (p, t) => pbook.add(noteKey.to(p, t), noteTimeOff(p, t)) } })));
    main.append(usualHoursCard());
  }
  // the Calendar's print button: where the numbered notes go, then print
  function calPrintMenu(x, y) {
    const go = (v) => () => { setNotesWhere(v); render(); setTimeout(() => window.print(), 80); };
    popMenu(x, y, 'Print the calendar', [['Details under the month', go('page'), notesWhere === 'page' ? 'on' : ''], ['Details on a page of their own', go('separate'), notesWhere === 'separate' ? 'on' : ''], ['No details (no numbers)', go('off'), notesWhere === 'off' ? 'on' : '']]);
  }
  // the usual hours as a card on the Calendar
  function usualHoursCard() {
    return h('div', { class: 'card no-print', id: 'cal-usual' }, h('h2', { style: { margin: '0 0 2px', fontSize: '16px' } }, 'Usual store hours (Monday – Sunday)'),
      h('p', { class: 'muted small', style: { margin: '0 0 6px' } }, usualSummary() || 'Not set yet.'), usualHoursEditor());
  }

  // the list: search, filter and sort everything
  function calListCard(shown, today, mFirst, mLast) {
    const inRange = (it) => cal.range === 'all' || (cal.range === 'upcoming' ? it.to >= today : cal.range === 'past' ? it.to < today : it.from <= mLast && it.to >= mFirst);
    const COLS = [['from', 'When', (it) => it.from + String(it.hours ? it.hours[0] : 0).padStart(4, '0') + it.to], ['kind', 'Type', (it) => CAL_KIND[it.kind]], ['what', 'Who / what', calWhat],
      ['hours', 'Hours', (it) => (it.kind === 'special' ? (it.x.closed ? '0' : '1' + String(it.x.open).padStart(4, '0')) : it.hours ? '1' + String(it.hours[0]).padStart(4, '0') : '0')], ['status', 'Status', calStatus], ['note', 'Note', (it) => it.note]];
    const key = (COLS.find((c) => c[0] === cal.sort) || COLS[0])[2];
    const list = shown.filter(inRange).sort((a, b) => cal.dir * (String(key(a)).localeCompare(String(key(b)), undefined, { numeric: true, sensitivity: 'base' }) || a.from.localeCompare(b.from)));
    const head = h('tr', null, COLS.map(([k, l]) => h('th', { 'aria-sort': cal.sort === k ? (cal.dir > 0 ? 'ascending' : 'descending') : 'none' },
      h('button', { type: 'button', class: 'th-sort', title: `Sort by ${l.toLowerCase()}`, onclick: () => { if (cal.sort === k) cal.dir = -cal.dir; else { cal.sort = k; cal.dir = 1; } calSave(); render(); } }, l, cal.sort === k ? (cal.dir > 0 ? ' ▲' : ' ▼') : ''))), h('th', null, ''));
    const rows = list.map((it) => h('tr', { style: { opacity: it.status === 'denied' ? 0.55 : 1 } },
      h('td', { class: 'nowrap' }, datesOnly(it), it.from <= today && it.to >= today ? h('span', { class: 'small', style: { marginLeft: '6px', fontWeight: 700 } }, 'now') : null),
      h('td', { class: 'nowrap' }, h('span', { class: 'cal-key ' + (it.kind === 'timeoff' ? it.status : it.kind) }), ' ', CAL_KIND[it.kind]),
      h('td', null, it.kind === 'timeoff' ? [h('b', null, it.who), ` · ${it.title}`] : h('b', null, it.title)),
      h('td', { class: 'nowrap small' }, calHours(it)),
      h('td', { class: 'nowrap ' + (it.status === 'requested' ? 'warn' : it.status === 'closed' ? 'bad' : '') }, calStatus(it)),
      h('td', { class: 'small' }, it.note),
      h('td', { class: 'nowrap' }, ibs(it.kind === 'timeoff' && it.status === 'requested' ? [ib('approve', 'Approve this time off', () => approveTimeOff(it.p, it.t), { cls: 'good' }), ib('deny', 'Deny it (kept as a record)', () => denyTimeOff(it.t), { cls: 'danger' })] : null,
        ib('edit', 'See or change it (or delete it)', () => calOpen(it))))));
    const range = calSeg('Which dates', [['upcoming', 'Now and coming up'], ['month', monthLabel(cal.ym)], ['past', 'Past'], ['all', 'All']], cal.range, (v) => { cal.range = v; calSave(); render(); });
    return h('div', { class: 'card' },
      h('div', { class: 'inline no-print' }, range, h('span', { class: 'spacer' }), h('span', { class: 'muted small' }, `${list.length} shown · click a column heading to sort`)),
      h('div', { class: 'table-wrap', style: { marginTop: '10px' } }, h('table', { class: 't' }, h('thead', null, head),
        h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: COLS.length + 1, class: 'muted' }, cal.q ? `Nothing matches “${cal.q}”.` : 'Nothing here. Try another set of dates, or tick more kinds above.'))))));
  }

  // ---------- On the Schedule and the Week ----------
  // the day's special hours and events, under the date on the Schedule (nothing when there are none)
  function calStrip(d) {
    const sp = specialOn(d), ev = eventsOn(d), shut = !sp && usualOn(d) && usualOn(d).closed;
    if (!sp && !ev.length && !shut) return null;
    return h('div', { class: 'cal-strip' },
      shut ? h('button', { type: 'button', class: 'cal-chip special closed', title: `The store is usually closed on ${WEEKDAYS[dayIdx(d)]}s\nClick to see the usual hours`, onclick: () => { calGo(); setTimeout(() => $('#cal-usual')?.scrollIntoView({ block: 'center' }), 50); } }, `Store closed (usual on ${WEEKDAYS[dayIdx(d)]}s)`) : null,
      sp ? h('button', { type: 'button', class: 'cal-chip special' + (sp.closed ? ' closed' : ''), title: `Special store hours${sp.note ? '\nNote: ' + sp.note : ''}\nClick to see or change them`, onclick: () => specialDialog(sp) },
        `${sp.closed ? 'Store closed' : `Store open ${clock(sp.open)} – ${clock(sp.close)}`} · ${sp.name || 'special hours'}`) : null,
      ev.map((x) => h('button', { type: 'button', class: 'cal-chip event', title: `Event${x.note ? '\n' + x.note : ''}\nClick to see or change it`, onclick: () => eventDialog(x) }, `${x.hours ? `${clockShort(x.hours[0])}–${clockShort(x.hours[1])} ` : ''}${x.title}`)));
  }
  // a small line under the day in the Week's heading
  function calMark(d) {
    const sp = specialOn(d), ev = eventsOn(d), shut = !sp && usualOn(d) && usualOn(d).closed;
    if (!sp && !ev.length && !shut) return null;
    if (shut && !ev.length) return h('div', { class: 'cal-mark', title: 'The store is usually closed this day' }, h('span', { class: 'bad' }, 'Closed'));
    const tip = [sp ? `${sp.name || 'Special hours'}: ${specialText(sp).toLowerCase()}` : '', ...ev.map((x) => `${x.hours ? clockShort(x.hours[0]) + ' ' : ''}${x.title}`)].filter(Boolean).join('\n');
    return h('div', { class: 'cal-mark', title: tip }, sp ? h('span', { class: sp.closed ? 'bad' : 'warn' }, specialShort(sp)) : null, sp && ev.length ? ' · ' : '', ev.length ? `★ ${ev.length}` : '');
  }
