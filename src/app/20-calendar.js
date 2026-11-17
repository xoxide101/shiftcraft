  // ===================================================================
  // Calendar: time off, special store hours and events
  // ===================================================================
  // plan.specialHours = [{ id, from, to, name, closed, open, close, note, ics? }]
  //   Store hours for a holiday (or any day): they take the place of the usual opening hours on those days. closed =
  //   shut all day. Check schedule points out shifts on a closed day, and shifts well outside the special hours.
  // plan.events = [{ id, from, to, title, hours: null | [start, end], note, ics?, repeat?, skip?, holiday?, replaces? }]
  //   replaces: the built-in holiday this event is your own version of (its name), shown in its place whatever it is called.
  //   Store events: notes and information for a day (end of period, payday, a delivery, a meeting, an inspection).
  //   They change nothing. repeat = { every: n, unit: 'day' | 'week' | 'month' | 'mlast' (the month's last day) | 'year',
  //   until: '' | last date }, counted from the first day (from); skip = [first days of times left out]. A repeating
  //   event is one day each time (to = from): a range that repeats makes far too many days, so an older one with a
  //   longer range is read as its first day only.
  // Time off stays on each person (p.timeOff, 19-time-off.js). The Calendar tab shows all three a month at a time or as
  // a list to search and sort, and they go out to and come in from other calendars as iCal (.ics) files (20-ical.js).
  // ics: the UID an entry had in a calendar file it came from, so bringing the same file in again updates it.
  const specialOn = (d) => (plan.specialHours || []).filter((x) => x.from <= d && d <= x.to).slice(-1)[0] || null;
  // ---------- Repeating events ----------
  // eventsIn(a, b): the events on any day from a to b, a repeating one once for each time, as its own copy
  // ({ ...x, from, to, series: the stored event, occ: that time's first day })
  const REPEAT_UNITS = [['day', 'day', 'days'], ['week', 'week', 'weeks'], ['month', 'month', 'months'], ['mlast', 'month, on its last day', 'months, on the last day'], ['year', 'year', 'years']];
  const dayDiff = (a, b) => Math.round((parseIso(b) - parseIso(a)) / 864e5);
  const monthStep = (d, n, last) => { const [y, m, dd] = d.split('-').map(Number), dim = new Date(y, m + n, 0).getDate(); return iso(new Date(y, m - 1 + n, last ? dim : Math.min(dd, dim))); };
  function repeatStarts(x, a, b) {
    const r = x.repeat, n = Math.max(1, r.every | 0), len = 0, out = []; // one day each time
    // every week (or every n weeks) on some days: repeat.days = [0–6], Monday first (produce Monday to Saturday)
    if (r.unit === 'week' && Array.isArray(r.days) && r.days.length) {
      const w0 = mondayOf(x.from), days = [...new Set(r.days)].filter((d) => d >= 0 && d <= 6).sort();
      for (let k = Math.max(0, Math.floor((dayDiff(w0, a) - len) / (7 * n)) - 1), i = 0; i < 3000; i++, k++) {
        const ws = addDays(w0, k * n * 7); if (ws > b || (r.until && ws > r.until)) break;
        for (const d of days) {
          const s = addDays(ws, d); if (s < x.from || s > b || (r.until && s > r.until)) continue;
          if (addDays(s, len) >= a && !(x.skip || []).includes(s)) out.push(s);
        }
      }
      return out;
    }
    const at = (k) => (r.unit === 'day' ? addDays(x.from, k * n) : r.unit === 'week' ? addDays(x.from, k * n * 7) : r.unit === 'year' ? monthStep(x.from, k * n * 12) : monthStep(x.from, k * n, r.unit === 'mlast'));
    const most = { day: 1, week: 7, year: 366 }[r.unit] || 31; // start a little before a: never past it
    for (let k = Math.max(0, Math.floor((dayDiff(x.from, a) - len) / (most * n)) - 2), i = 0; i < 3000; i++, k++) {
      const s = at(k); if (s > b || (r.until && s > r.until)) break;
      if (addDays(s, len) >= a && !(x.skip || []).includes(s)) out.push(s);
    }
    return out;
  }
  // the days as short runs: Mon–Sat, or Wed, Sat
  const dayRuns = (days) => { const d = [...new Set(days)].sort(), out = []; for (let i = 0; i < d.length;) { let j = i; while (j + 1 < d.length && d[j + 1] === d[j] + 1) j++; const A = WEEKDAYS[d[i]].slice(0, 3), B = WEEKDAYS[d[j]].slice(0, 3); out.push(j - i >= 2 ? `${A}–${B}` : j > i ? `${A}, ${B}` : A); i = j + 1; } return out.join(', '); };
  const repeatText = (r) => { const u = REPEAT_UNITS.find(([k]) => k === r.unit) || REPEAT_UNITS[1], n = Math.max(1, r.every | 0); return `every ${n === 1 ? u[1] : n === 2 && r.unit === 'week' ? 'other week' : n + ' ' + u[2]}${r.unit === 'week' && Array.isArray(r.days) && r.days.length ? ' on ' + dayRuns(r.days) : ''}${r.until ? ' until ' + shortDate(r.until) : ''}`; };
  // A one-day repeating event (produce, the truck, payday…) that falls on a day the store is closed for special hours
  // (a holiday: Thanksgiving) moves to the open day before it, marked movedFrom (shown with a circle round it). If that day
  // already has it, that one is marked instead (a double order). End of period stays on its date.
  const shutForHoliday = (d) => { const sp = specialOn(d); return !!(sp && sp.closed); };
  const openOn = (d) => { const st = storeHoursOn(d); return !st || !st.closed; };
  const eventsIn = (a, b) => (plan.events || []).flatMap((x) => {
    if (!x.repeat) return x.from <= b && x.to >= a ? [x] : [];
    const len = 0, mv = markOf(x) !== 'period', out = []; // one day each time
    for (const s of repeatStarts(x, a, mv ? addDays(b, 7) : b)) {
      let d = s, moved = '';
      if (mv && shutForHoliday(s)) { d = addDays(s, -1); for (let i = 0; i < 7 && !openOn(d); i++) d = addDays(d, -1); moved = s; }
      if (addDays(d, len) < a || d > b) continue;
      const there = out.find((o) => o.from === d);
      if (there) { if (moved && !there.movedFrom) there.movedFrom = moved; continue; }
      out.push({ ...x, from: d, to: addDays(d, len), series: x, occ: moved || s, ...(moved ? { movedFrom: moved } : {}) });
    }
    return out.sort((p, q) => p.from.localeCompare(q.from));
  });
  const eventsOn = (d) => eventsIn(d, d).sort((a, b) => (a.hours ? a.hours[0] : -1) - (b.hours ? b.hours[0] : -1));
  // ---------- Usual store hours, Monday to Sunday ----------
  // plan.hours.days = 7 entries, Monday first: { open, close } | { closed: true } | null (not set). One list, edited on the
  // Calendar and on Company & Location alike. Older plans had plan.hours.wk / .we (weekdays / weekend): those fill the
  // days until the week is changed. Special store hours (a holiday) take the place of the usual hours on their days.
  const dayIdx = (d) => (parseIso(d).getDay() + 6) % 7;
  const usualWeek = () => { const hs = plan.hours || {}; return Array.isArray(hs.days) ? WEEKDAYS.map((_, i) => hs.days[i] || null) : WEEKDAYS.map((_, i) => hs[i >= 5 ? 'we' : 'wk'] || null); };
  const usualOn = (d) => usualWeek()[dayIdx(d)];
  const regularHours = (d) => { const u = usualOn(d); return u && !u.closed ? u : null; };
  // the store's hours on a day: special hours win, otherwise the usual hours for that weekday (null: not set)
  const storeShut = (d) => { const st = storeHoursOn(d); return !!(st && st.closed); };
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
    ['Valentine’s Day', (y) => `${y}-02-14`], ['St. Patrick’s Day', (y) => `${y}-03-17`], ['Juneteenth', (y) => `${y}-06-19`], ['Independence Day', (y) => `${y}-07-04`], ['Labor Day', (y) => nthDay(y, 8, 1, 1)], ['Columbus Day', (y) => nthDay(y, 9, 1, 2)], ['Halloween', (y) => `${y}-10-31`], ['Veterans Day', (y) => `${y}-11-11`],
    ['Thanksgiving', (y) => nthDay(y, 10, 4, 4), true], ['Black Friday', (y) => addDays(nthDay(y, 10, 4, 4), 1)], ['Christmas Eve', (y) => `${y}-12-24`],
    ['Christmas Day', (y) => `${y}-12-25`, true], ['New Year’s Eve', (y) => `${y}-12-31`]];
  const holidaysFrom = (d, n = 18) => { const y = +d.slice(0, 4); return [y, y + 1].flatMap((yy) => HOLIDAYS.map(([name, fn, closed]) => ({ name, date: fn(yy), closed: !!closed }))).filter((x) => x.date >= d).sort((a, b) => a.date.localeCompare(b.date)).slice(0, n); };

  // ---------- Holidays on the month: a solid bar along the bottom of the day ----------
  // A holiday is one from the list above, an event or special hours named like one on that day, or an event ticked as a
  // holiday (x.holiday; unticked = false keeps a holiday-named event an ordinary event).
  const holKey = (s) => String(s || '').toLowerCase().replace(/[’']s?\b/g, '').replace(/\bday\b/g, '').replace(/[^a-z]/g, '');
  // two kinds: 'national' (national or state holidays) and 'local' (business, local or seasonal days: Black Friday,
  // fireworks, Halloween…), each its own colour. x.holiday on an event: 'national' | 'local' | false (not one, even if
  // named like one) | missing (from its name); true (older plans) = national.
  // the list's own days are national, apart from Black Friday (an event named like one of them can say otherwise)
  const LOCAL_BUILTIN = new Set(['Black Friday']);
  const NATIONAL = { has: (name) => !LOCAL_BUILTIN.has(name) };
  const HOL_KINDS = [['', 'Not a holiday'], ['national', 'National or state holiday'], ['local', 'Business or local day (Black Friday, fireworks…)']];
  const builtinOn = (d) => HOLIDAYS.map(([name, fn, closed]) => ({ name, date: fn(+d.slice(0, 4)), closed: !!closed, type: NATIONAL.has(name) ? 'national' : 'local' })).filter((x) => x.date === d);
  // names alike: the same; loose (special hours) also one inside the other (Thanksgiving Day (closed) is Thanksgiving),
  // but an event needs the name itself (Veterans Day Fireworks is an event, unless you say it is a holiday)
  const holLike = (a, b, loose) => { a = holKey(a); b = holKey(b); return !!a && !!b && (a === b || (!!loose && a.length >= 5 && b.length >= 5 && (a.includes(b) || b.includes(a)))); };
  const holAuto = (name, days, loose) => { for (const d of days) { const b = builtinOn(d).find((x) => holLike(x.name, name, loose)); if (b) return b.type; } return ''; };
  const holSet = (v) => (v === true ? 'national' : v === 'national' || v === 'local' ? v : '');
  const holEventType = (x) => (x.holiday != null ? holSet(x.holiday) : holAuto(x.title, [x.from]));
  const holSpecialType = (x) => (x.holiday != null ? holSet(x.holiday) : holAuto(x.name, daysFrom(x.from, dayDiff(x.from, x.to) + 1), true));
  const holEvent = (x) => !!holEventType(x);
  const holSpecial = (x) => !!holSpecialType(x);

  // ---------- Marks: store events shown as a sign by the date instead of an entry ----------
  // End of period: a box around the date. The others: a small picture next to the date (a truck, a clipboard…), with a
  // key under the month. x.mark on an event: a key below, 'none' (an ordinary entry), or missing (from its name).
  const CAL_MARKS = [
    ['period', 'End of period', /\bend of (the )?(pay ?)?(period|month)\b|\beop\b/i, ''],
    ['payday', 'Payday', /\bpay ?day\b|\bpayroll\b/i, '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9h.01M18 15h.01"/>'],
    ['produce', 'Produce', /\bproduce\b|\bveg(gie|etable)s?\b|\bfarmers?\b/i, '<path d="M12 8.2c4.2 0 7.5 2.6 7.5 6.3S16.2 21 12 21s-7.5-2.8-7.5-6.5S7.8 8.2 12 8.2z"/><path d="M12 8.2V4.5M12 8.2 8.6 6.4M12 8.2l3.4-1.8M12 8.2l-1.8 2.3M12 8.2l1.8 2.3"/>'],
    ['truck', 'Truck delivery', /\btruck\b|\bdelivery\b/i, '<path d="M2 6h11v10H2zM13 9h4.5l3.5 3.5V16h-8"/><circle cx="6" cy="17.5" r="1.9"/><circle cx="17" cy="17.5" r="1.9"/>'],
    ['inventory', 'Inventory', /\binventory\b/i, '<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="3" rx="1"/><path d="M8.5 10h7M8.5 14h7M8.5 18h4"/>'],
    ['insurance', 'Insurance enrollment', /\binsurance\b|\benrol?lment\b|\bbenefits\b/i, '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M12 9v6M9 12h6"/>'],
    ['meeting', 'Meeting', /\bmeeting\b/i, '<circle cx="12" cy="4.6" r="2.1"/><path d="M8.6 11.5c0-2 1.5-3.6 3.4-3.6s3.4 1.6 3.4 3.6"/><path d="M5 11.5h14l-2 3H7z"/><path d="M9.5 14.5v6h5v-6M8 20.5h8"/>']];
  const markOf = (x) => (x.mark === 'none' ? '' : x.mark && CAL_MARKS.some(([k]) => k === x.mark) ? x.mark : (CAL_MARKS.find(([, , re]) => re.test(x.title || '')) || [''])[0]);
  const markSvg = (k) => { const m = CAL_MARKS.find(([kk]) => kk === k), s = h('span', { class: 'cal-mark-ic ' + k }); s.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${m ? m[3] : ''}</svg>`; return s; };

  // a row of buttons where one is pressed (like the Status buttons on Time off)
  function calSeg(label, options, value, pick) {
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': label }, options.map(([v, l]) => h('button', { type: 'button', class: 'btn', 'aria-pressed': String(value === v),
      onclick: (e) => { seg.querySelectorAll('.btn').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); pick(v); } }, l)));
    return seg;
  }
  const dateIn = (v) => h('input', { class: 'input', type: 'date', value: v || '' });
  // First day / Last day: moving the first day moves the last day with it (one day stays one day; a range keeps its
  // length), so a changed first day never leaves a long range behind by mistake
  const dateLink = (from, to) => { let len = from.value && to.value ? Math.max(0, dayDiff(from.value, to.value)) : 0;
    from.addEventListener('change', () => { if (from.value) to.value = addDays(from.value, len); });
    to.addEventListener('change', () => { if (from.value && to.value) len = Math.max(0, dayDiff(from.value, to.value)); }); };
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
    dateLink(from, to); [from, to].forEach((e) => { e.addEventListener('input', sync); e.addEventListener('change', sync); });
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
  // x: the stored event (a repeating one: occ = the time clicked, which Skip leaves out)
  function eventDialog(x, preset, occ) {
    const at = (preset && preset.from) || ui.day;
    const cur = x || { from: at, to: at, title: '', hours: null, note: '', ...(preset || {}) };
    const title = h('input', { class: 'input', value: cur.title || '', placeholder: 'e.g. Truck delivery · Health inspection · Team meeting · Sidewalk sale', maxLength: 120 });
    const picks = h('div', { class: 'inline', style: { gap: '4px' } }, ['End of period', 'Payday', 'Inventory', 'Truck delivery', 'Produce', 'Insurance enrollment', 'Meeting'].map((t) => h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { title.value = t; if (from.value) to.value = from.value; sync(); title.focus(); } }, t)));
    const from = dateIn(cur.from), to = dateIn(cur.to); dateLink(from, to);
    // repeats: never, every week, every other week, every month, or every n days / weeks / months / years, until a day or not
    const r0 = cur.repeat || null;
    let rep = !r0 ? 'none' : r0.every === 1 && r0.unit === 'week' ? 'w1' : r0.every === 2 && r0.unit === 'week' ? 'w2' : r0.every === 1 && r0.unit === 'month' ? 'm1' : 'other';
    const every = h('input', { class: 'input', type: 'number', min: 1, max: 99, value: r0 ? r0.every : 1, style: { width: '70px' }, 'aria-label': 'Every how many' });
    const unit = h('select', { class: 'input', style: { width: 'auto' }, 'aria-label': 'Days, weeks, months or years' }, REPEAT_UNITS.map(([k, , pl]) => h('option', { value: k, selected: (r0 ? r0.unit : 'week') === k }, pl)));
    const until = dateIn((r0 && r0.until) || '');
    const repSeg = calSeg('Repeats', [['none', 'Never'], ['w1', 'Every week'], ['w2', 'Every other week'], ['m1', 'Every month'], ['other', 'Other…']], rep, (v) => { rep = v; sync(); });
    const otherRow = h('div', { class: 'inline' }, h('span', null, 'Every'), every, unit);
    // weekly: the days it happens (several: produce Monday to Saturday, the truck Wednesday and Saturday)
    let wdays = r0 && Array.isArray(r0.days) && r0.days.length ? [...r0.days] : null; // null: the first day's weekday
    const dayBtns = h('div', { class: 'daytoggles', role: 'group', 'aria-label': 'Days it happens' });
    const drawDays = () => { const on = wdays || (from.value ? [dayIdx(from.value)] : []); dayBtns.replaceChildren(...WEEKDAYS.map((w, i) => h('button', { type: 'button', class: 'dt use' + (on.includes(i) ? ' on' : ''), 'aria-pressed': String(on.includes(i)), title: w,
      onclick: () => { const cur2 = wdays || (from.value ? [dayIdx(from.value)] : []); const next = cur2.includes(i) ? cur2.filter((x) => x !== i) : [...cur2, i]; wdays = next.length ? next.sort() : cur2; sync(); } }, w.slice(0, 3)))); };
    const daysRow = h('div', { class: 'field' }, h('span', null, 'On these days'), dayBtns);
    const untilRow = h('div', { class: 'field' }, h('span', null, 'Stop after (optional: empty keeps repeating)'), h('div', { class: 'inline', style: { flexWrap: 'nowrap' } }, until,
      h('button', { type: 'button', class: 'btn sm ghost', title: 'Empty it: keep repeating', 'aria-label': 'Empty the stop date', onclick: () => { until.value = ''; sync(); } }, '×')));
    const nextInfo = h('p', { class: 'hint', style: { margin: 0 } });
    const ruleOf = () => (rep === 'none' ? null : { every: rep === 'w2' ? 2 : rep === 'other' ? Math.max(1, Math.min(99, Math.round(+every.value) || 1)) : 1, unit: rep === 'm1' ? 'month' : rep === 'other' ? unit.value : 'week', until: until.value && until.value > from.value ? until.value : '',
      ...((rep === 'w1' || rep === 'w2' || (rep === 'other' && unit.value === 'week')) && wdays && !(wdays.length === 1 && from.value && wdays[0] === dayIdx(from.value)) ? { days: [...wdays] } : {}) }); // a stop on or before the first day is ignored
    const markSel = h('select', { class: 'input', style: { width: 'auto' }, 'aria-label': 'Sign by the date' }, h('option', { value: '' }, 'From the name'), h('option', { value: 'none', selected: cur.mark === 'none' }, 'None (an entry)'),
      CAL_MARKS.map(([k, l]) => h('option', { value: k, selected: cur.mark === k }, k === 'period' ? 'End of period (a box around the date)' : l)));
    const holNow = holEventType({ ...cur, from: cur.from || at, title: cur.title || '' });
    const holSel = h('select', { class: 'input', style: { width: 'auto' }, 'aria-label': 'Holiday' }, HOL_KINDS.map(([k, l]) => h('option', { value: k, selected: holNow === k }, l)));
    let allDay = !cur.hours;
    const seg = calSeg('When in the day', [[true, 'All day'], [false, 'At a time']], allDay, (v) => { allDay = v; sync(); });
    const a = timePicker(cur.hours ? cur.hours[0] : 540, 'Starts'), b = timePicker(cur.hours ? cur.hours[1] : 600, 'Ends');
    const hoursRow = pair2(fieldOf('From', a), fieldOf('Until', b));
    const firstField = fieldOf('First day', from), firstLabel = firstField.firstChild, lastField = fieldOf('Last day (the same for one day)', to);
    const note = h('textarea', { class: 'input', rows: 3, maxLength: 500, placeholder: 'Anything to know: who is coming, what to get ready, a phone number…' }, cur.note || '');
    const sync = () => {
      if (to.value && from.value && to.value < from.value) to.value = from.value; if (!to.value) to.value = from.value; hoursRow.style.display = allDay ? 'none' : '';
      const r = ruleOf(); otherRow.style.display = rep === 'other' ? '' : 'none'; untilRow.style.display = nextInfo.style.display = r ? '' : 'none';
      lastField.style.display = r ? 'none' : ''; firstLabel.textContent = r ? 'First day (each time is one day)' : 'First day'; if (r && from.value) to.value = from.value;
      daysRow.style.display = r && r.unit === 'week' ? '' : 'none'; drawDays();
      if (r && from.value) { const t = iso(new Date()), a = from.value > t ? from.value : t, s = repeatStarts({ from: from.value, to: to.value || from.value, repeat: r, skip: cur.skip }, a, addDays(a, 1200)).slice(0, 6);
        nextInfo.textContent = `Starts ${shortDate(from.value)}, ${repeatText(r)}. ${s.length ? 'Next: ' + s.map((d) => `${dayName(d, 'short')} ${shortDate(d)}`).join(', ') + (s.length === 6 ? ' …' : '') : 'No more times.'}${until.value && until.value <= from.value ? ' (The stop date is on or before the first day, so it is left out.)' : ''}`; }
    };
    [from, to, every, until].forEach((e) => { e.addEventListener('input', sync); e.addEventListener('change', sync); }); unit.addEventListener('change', sync);
    sync();
    const actions = [{ label: 'Cancel' }];
    if (x) actions.unshift({ label: x.repeat ? 'Delete every time' : 'Delete', danger: true, left: true, onClick: () => { change(() => { plan.events = plan.events.filter((y) => y.id !== x.id); if (!plan.events.length) delete plan.events; }); toast('Event deleted. You can undo this.', { label: 'Undo', fn: undo }); } });
    if (x && x.repeat && occ) actions.splice(1, 0, { label: `Skip ${shortDate(occ)} only`, left: true, onClick: () => { change(() => { const s = (plan.events || []).find((y) => y.id === x.id); if (s) s.skip = [...(s.skip || []), occ].sort(); }); toast(`${x.title} on ${shortDate(occ)} is left out. You can undo this.`, { label: 'Undo', fn: undo }); } });
    actions.push({ label: x ? 'Save' : 'Add event', primary: true, onClick: () => {
      const t = title.value.replace(/\s+/g, ' ').trim();
      if (!t) { toast('Give the event a name.'); title.focus(); return false; }
      if (!from.value) { toast('Pick the day.'); return false; }
      if (!allDay && b.value <= a.value) { toast('The event must end after it starts.'); return false; }
      const r = ruleOf();
      const e = { id: x ? x.id : uid(), from: from.value, to: r || to.value < from.value ? from.value : to.value, title: t, hours: allDay ? null : [a.value, b.value], note: note.value.trim(), ...(x && x.ics ? { ics: x.ics } : {}), ...(cur.replaces ? { replaces: cur.replaces } : {}),
        ...(holSel.value !== holAuto(t, [from.value]) ? { holiday: holSel.value || false } : {}), ...(markSel.value ? { mark: markSel.value } : {}),
        ...(r ? { repeat: r } : {}), ...(r && x && x.skip && x.skip.some((d) => d >= from.value) ? { skip: x.skip.filter((d) => d >= from.value) } : {}) };
      change(() => { plan.events = (plan.events || []).filter((y) => y.id !== e.id).concat(e).sort((p, q) => p.from.localeCompare(q.from)); });
      toast(`${e.title}: ${timeOffWhen(e)}${r ? ', ' + repeatText(r) : ''}.`);
    } });
    sync();
    modal({ title: x ? `Store event · ${x.title}` : cur.replaces ? `Holiday · ${cur.replaces}` : 'Store event or note for a day', body: [
      cur.replaces && !x ? h('p', { class: 'hint', style: { marginTop: 0 } }, `${cur.replaces} comes from the built-in holiday list. Change its name, kind or details and save: your version shows in its place on ${longDate(cur.from)}.`) : null,
      h('p', { class: 'hint', style: { marginTop: 0 } }, x && x.repeat && occ ? `This repeats (${repeatText(x.repeat)}): what you change here changes every time. Skip leaves out ${longDate(occ)} only.` : 'Something for the store, not for a person: end of period, payday, a delivery, a meeting. It shows on the Calendar, the Schedule and the Week, and changes nothing else.'),
      fieldOf('What', title), picks, pair2(fieldOf('Holiday (a solid bar along the bottom of the day)', holSel), fieldOf('Sign by the date', markSel)), pair2(firstField, lastField),
      h('div', { class: 'field' }, h('span', null, 'When'), seg), hoursRow,
      h('div', { class: 'field' }, h('span', null, 'Repeats'), repSeg), otherRow, daysRow, untilRow, nextInfo, fieldOf('Notes', note)], actions });
  }

  // ---------- Everything on the calendar, as one list ----------
  const CAL_KIND = { timeoff: 'Time off', special: 'Store hours', event: 'Event' };
  function calItems(a, b) {
    const out = [];
    plan.staff.filter((p) => !p.left).forEach((p) => (p.timeOff || []).forEach((t) => out.push({ kind: 'timeoff', status: t.status, from: t.from, to: t.to, hours: t.hours, who: p.name, title: TIME_OFF_WHY[t.why] || 'Time off', note: t.note || '', p, t })));
    (plan.specialHours || []).forEach((x) => out.push({ kind: 'special', status: x.closed ? 'closed' : 'open', from: x.from, to: x.to, hours: null, who: '', title: x.name || 'Special hours', note: x.note || '', x }));
    eventsIn(a, b).forEach((x) => out.push({ kind: 'event', status: '', from: x.from, to: x.to, hours: x.hours, who: '', title: x.title, note: x.note || '', x }));
    return out;
  }
  const calOpen = (it) => (it.kind === 'timeoff' ? timeOffDialog(it.p, it.t) : it.kind === 'special' ? specialDialog(it.x) : eventDialog(it.x.series || it.x, null, it.x.occ));
  const calHours = (it) => (it.kind === 'special' ? specialText(it.x) : it.hours ? `${clock(it.hours[0])} – ${clock(it.hours[1])}` : 'All day');
  const calStatus = (it) => (it.kind === 'timeoff' ? TIME_OFF_STATUS[it.status] || '' : it.kind === 'special' ? (it.x.closed ? 'Closed' : 'Special hours') : '');
  const calWhat = (it) => (it.kind === 'timeoff' ? `${it.who} · ${it.title}` : it.title);
  const calText = (it) => [CAL_KIND[it.kind], it.who, it.title, it.note, calHours(it), calStatus(it), datesOnly(it), it.from, it.to, it.kind === 'timeoff' && it.status === 'requested' ? 'request' : ''].join(' ').toLowerCase();
  const calTip = (it) => [`${CAL_KIND[it.kind]}: ${calWhat(it)}`, `${datesOnly(it)} · ${calHours(it)}`, it.x && it.x.movedFrom ? `Moved here from ${dayName(it.x.movedFrom, 'short')} ${shortDate(it.x.movedFrom)}: the store is closed that day` : '', it.kind === 'event' && it.x.repeat ? 'Repeats ' + repeatText(it.x.repeat) : '', calStatus(it), it.note ? 'Note: ' + it.note : '', 'Click to see or change it'].filter(Boolean).join('\n');
  const calChipText = (it) => (it.kind === 'special' ? it.title /* the hours (or Closed) are by the date */ : it.kind === 'event' ? `${it.x.repeat ? '↻ ' : ''}${it.hours ? clockShort(it.hours[0]) + ' ' : ''}${it.title}`
    : `${it.status === 'requested' ? '? ' : ''}${it.who} · ${it.title}${it.hours ? ` ${clockShort(it.hours[0])}–${clockShort(it.hours[1])}` : ''}`);
  const calChip = (it) => h('button', { type: 'button', class: `cal-chip ${it.kind} ${it.status}${it.x && it.x.movedFrom ? ' urgent' : ''}`, title: calTip(it), onclick: (e) => { e.stopPropagation(); calOpen(it); } }, calChipText(it));
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
    const its = calItems(d, d).filter((it) => it.from <= d && d <= it.to).sort(calOrder);
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
    const today = iso(new Date()), g0 = mondayOf(cal.ym + '-01'), g1 = addDays(g0, 41);
    // repeating events: each time in the month shown and a year either side of today (the list)
    const items = calItems(g0 < addDays(today, -366) ? g0 : addDays(today, -366), g1 > addDays(today, 366) ? g1 : addDays(today, 366)), shown = items.filter(calShown);
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
        h('span', { class: 'no-print' }, ibs(ib('print', 'Print the calendar: pick what goes on the paper', () => calPrintDialog())))),
      h('div', { class: 'inline no-print', style: { marginTop: '10px', gap: '14px' } }, search,
        show('requested', 'Requests', (it) => it.kind === 'timeoff' && it.status === 'requested', 'Time off asked for, still to approve'),
        show('approved', 'Approved', (it) => it.kind === 'timeoff' && it.status === 'approved', 'Approved time off'),
        show('denied', 'Denied', (it) => it.kind === 'timeoff' && it.status === 'denied', 'Denied time off (kept as a record)'),
        show('special', 'Store hours', (it) => it.kind === 'special', 'Special store hours: holidays and other days'),
        show('event', 'Events', (it) => it.kind === 'event', 'Events and notes for a day'),
        h('label', { class: 'check small', title: 'Holidays: a bar along the bottom of the day' }, h('input', { type: 'checkbox', checked: cal.show.holiday !== false, onchange: (e) => { cal.show.holiday = e.target.checked; calSave(); render(); } }), h('span', { class: 'cal-key holiday' }), ' Holidays')),
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
    // time off: one bar a person a week, running across their days off (name and dates), in lanes
    // so two never overlap; every day of that week keeps the lanes' room, so the bars line up
    const multi = (it) => it.kind === 'timeoff'; // every day off, one day or more, is a bar (lined up with the others)
    const spans = Array.from({ length: weeks }, (_, w) => {
      const w0 = addDays(start, w * 7), w1 = addDays(w0, 6), lanes = [];
      shown.filter((it) => multi(it) && it.from <= w1 && it.to >= w0).sort((a, b) => a.from.localeCompare(b.from) || b.to.localeCompare(a.to)).forEach((it) => {
        const s = it.from < w0 ? w0 : it.from, e = it.to > w1 ? w1 : it.to, seg = { it, s, e, n: dayDiff(s, e) + 1 };
        let lane = lanes.find((l) => l.every((x) => x.e < s || x.s > e)); if (!lane) lanes.push((lane = [])); lane.push(seg);
      });
      return lanes;
    });
    const spanBar = (seg) => {
      const it = seg.it, el = h('button', { type: 'button', class: `cal-span ${it.status}`, style: { width: `calc(${seg.n} * (100% + 9px) - 9px)` }, title: calTip(it), onclick: (e) => { e.stopPropagation(); calOpen(it); } },
        `${it.status === 'requested' ? '? ' : ''}${it.who} · ${datesOnly(it)}${it.hours ? `, ${clockShort(it.hours[0])}–${clockShort(it.hours[1])}` : ''}`);
      if (notesWhere !== 'off') el.prepend(h('span', { class: 'cal-n' }, supNum(numOf(it)) + ' '));
      return el;
    };
    const cells = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, w * 7 + i), its = shown.filter((it) => it.from <= d && d <= it.to && !multi(it)).sort(calOrder), sp = specialOn(d), st = storeHoursOn(d);
      const n = planDays().includes(d) ? shiftsOn(d).length : 0;
      // holidays: special hours or events that are one, then the list's own (unless an entry that day has its name)
      const isHol = (it) => (it.kind === 'special' ? holSpecial(it.x) : it.kind === 'event' ? holEvent(it.x) : false);
      const holIts = cal.show.holiday === false ? [] : its.filter(isHol), named = [...eventsOn(d).flatMap((x) => [[x.title], ...(x.replaces ? [[x.replaces]] : [])]), ...(sp ? [[sp.name, true]] : [])];
      const bars = [...holIts.map((it) => ({ it, label: it.kind === 'special' ? it.x.name || 'Holiday' : `${it.hours ? clockShort(it.hours[0]) + ' ' : ''}${it.title}`, type: it.kind === 'special' ? holSpecialType(it.x) : holEventType(it.x) })),
        ...(cal.show.holiday === false ? [] : builtinOn(d).filter((b) => !named.some(([n, loose]) => holLike(n, b.name, loose))).map((b) => ({ label: b.name, type: b.type })))]
        .sort((x, y) => (x.type === 'national') - (y.type === 'national'));
      const marked = its.filter((it) => it.kind === 'event' && !holIts.includes(it) && markOf(it.x)), eop = marked.find((it) => markOf(it.x) === 'period');
      const rest = its.filter((it) => !holIts.includes(it) && !marked.includes(it)), evs = rest.filter((it) => it.kind === 'event'), evShow = evs.slice(0, 3);
      const topAll = [...rest.filter((it) => it.kind !== 'event'), ...evs.slice(3)], room = Math.max(1, MAX - evShow.length - bars.length - spans[w].length), topShow = topAll.length > room ? topAll.slice(0, room - 1) : topAll, more = topAll.slice(topShow.length);
      const bottom = evShow.length || bars.length ? h('div', { class: 'cal-bottom' }, evShow.map(chipN),
        bars.map((b) => { const el = h('button', { type: 'button', class: 'cal-hol ' + b.type, title: b.it ? calTip(b.it) : `${b.label} (${b.type === 'national' ? 'national holiday' : 'business or local day'}). Click to change its name or add details`, onclick: (e) => { e.stopPropagation(); if (b.it) calOpen(b.it); else eventDialog(null, { from: d, to: d, title: b.label, holiday: b.type, replaces: b.label }); } }, b.label);
          if (b.it && notesWhere !== 'off') el.prepend(h('span', { class: 'cal-n' }, supNum(numOf(b.it)) + ' ')); return el; })) : null;
      return h('td', { class: 'cal-day' + (d.slice(0, 7) !== cal.ym ? ' cal-out' : '') + (d === today ? ' cal-today' : '') + (d < today ? ' cal-past' : '') + (st && st.closed ? ' cal-closed' : ''), ondblclick: (e) => { if (e.target === e.currentTarget || e.target.classList.contains('cal-in')) dayDialog(d); } },
        // the day's box fills the cell (the holiday bar and events sit at its bottom); room is kept for them
        h('div', { class: 'cal-in', style: { paddingBottom: (evShow.length * 20 + bars.length * 19 + 5) + 'px' } },
        h('div', { class: 'cal-head' },
          h('button', { type: 'button', class: 'cal-num' + (eop ? ' eop' : ''), title: `${longDate(d)}${eop ? ' · ' + eop.title : ''}: see everything on this day and add to it`, onclick: () => dayDialog(d) }, String(parseIso(d).getDate())),
          eop && notesWhere !== 'off' ? h('span', { class: 'cal-n' }, supNum(numOf(eop))) : null,
          // the signs next to the date (payday, truck, inventory, insurance, meeting)
          marked.filter((it) => it !== eop).map((it) => h('button', { type: 'button', class: 'cal-mark' + (it.x.movedFrom ? ' urgent' : ''), title: calTip(it), 'aria-label': it.title, onclick: (e) => { e.stopPropagation(); calOpen(it); } }, markSvg(markOf(it.x)), notesWhere !== 'off' ? h('span', { class: 'cal-n' }, supNum(numOf(it))) : null)),
          h('button', { type: 'button', class: 'cal-add no-print', title: 'Add an event, special hours or time off on this day', 'aria-label': `Add to ${longDate(d)}`, onclick: () => dayDialog(d) }, '+')),
        // the store's hours that day: special hours (a holiday) win over the usual ones
        // and how many are on the schedule, at its right (the date's line stays one line: the time off bars line up)
        h('div', { class: 'cal-hrs' + (st && sp ? ' special' : '') + (st && st.closed ? ' closed' : '') }, st ? h('span', { class: 'cal-hrs-t', title: sp ? `${sp.name || 'Special hours'}: ${specialText(sp).toLowerCase()} (usual: ${usualText(usualOn(d))})` : `Usual hours on ${WEEKDAYS[dayIdx(d)]}s` }, st.closed ? 'Closed' : (() => { const u = usualOn(d), now = `${clockShort(st.open)}–${clockShort(st.close)}`;
          // changed hours (still open): the usual hours struck through, the day's own next to them
          return sp && u && !u.closed && u.open != null && (u.open !== st.open || u.close !== st.close) ? [h('s', { class: 'cal-was' }, `${clockShort(u.open)}–${clockShort(u.close)}`), ' ', now] : now; })()) : null,
          n ? h('span', { class: 'cal-cnt' + (st && st.closed ? ' shut' : ''), title: st && st.closed ? `${n} on the schedule, but the store is closed: Check schedule points them out (not printed)` : `${n} on the schedule` }, `${n} sched.`) : null),
        // the week's time off bars: this day's own starts here; a lane another day's bar runs through is kept empty
        spans[w].length ? h('div', { class: 'cal-lanes' }, spans[w].map((l) => { const seg = l.find((x) => x.s <= d && d <= x.e); return seg && seg.s === d ? spanBar(seg) : h('div', { class: 'cal-lane' }); })) : null,
        topShow.map(chipN),
        more.length ? h('button', { type: 'button', class: 'cal-more', onclick: () => dayDialog(d) }, `+${more.length} more`) : null,
        // printed: the ones that don't fit as numbers only
        more.length && notesWhere !== 'off' ? h('div', { class: 'cal-n cal-nmore' }, more.map((it) => supNum(numOf(it))).join(',')) : null,
        bottom));
    }));
    // the legend (what the signs mean)
    const legendEl = () => { const used = new Set(shown.filter((it) => it.kind === 'event' && it.from <= addDays(start, weeks * 7 - 1) && it.to >= start && !holEvent(it.x)).map((it) => markOf(it.x)).filter(Boolean));
        // and the heads up: something moved to the day before a closed holiday (circled)
        const moved = shown.some((it) => it.kind === 'event' && it.x.movedFrom && it.from <= addDays(start, weeks * 7 - 1) && it.to >= start);
        return used.size || moved ? h('div', { class: 'cal-legend' }, CAL_MARKS.filter(([k]) => used.has(k)).map(([k, l]) => h('span', null, k === 'period' ? h('span', { class: 'cal-eop-key' }, '24') : markSvg(k), ' ' + l)),
          moved ? h('span', null, h('span', { class: 'cal-mark urgent cal-heads' }, h('span', { class: 'cal-mark-ic' }, '!')), ' Circled: moved to the day before (the store is closed that day)') : null) : null; };
    // printed with the days outside the month left blank: the legend goes in the empty days after the month (or before
    // it) when there are 3 or more and no time off bar runs into them; on screen those days show as usual
    let legIn = false;
    if (calp.out === 'blank') {
      const lw = weeks - 1, after = dayDiff(mLast, addDays(start, lw * 7 + 6)), before = dayDiff(start, mFirst), clear = (w, ok) => !spans[w].some((l) => l.some(ok));
      const put = (w, k, atEnd) => { const leg = legendEl(); if (!leg) return; leg.classList.add('in-cell'); const row = cells[w], gone = atEnd ? row.slice(7 - k) : row.slice(0, k);
        gone.forEach((td) => td.classList.add('cal-gone')); const td = h('td', { class: 'cal-legcell', colSpan: k }, leg); if (atEnd) row.push(td); else row.unshift(td); legIn = true; };
      if (after >= 3 && clear(lw, (x) => x.e > mLast)) put(lw, after, true); else if (before >= 3 && clear(0, (x) => x.s < mFirst)) put(0, before, false);
    }
    main.append(h('div', { class: 'card cal-card' + calpClass() + (legIn ? ' cp-leg-in' : '') }, h('div', { class: 'table-wrap' }, h('table', { class: 'cal' },
      h('thead', null, h('tr', null, WEEKDAYS.map((w) => h('th', null, w.slice(0, 3))))), h('tbody', null, cells.map((row) => h('tr', null, row))))),
      legendEl(),
      h('p', { class: 'hint no-print', style: { margin: '8px 0 0' } }, 'Click a day’s number (or +) to see everything on it and add to it. Click an entry to change it. Under each date: the store’s hours (bold when special hours take the place of the usual ones). ? marks a time off request still to approve; a dashed line is a request, a red day is closed.')));
    // printed: the details for the weeks shown (store hours, time off, events, holidays, as on the availability list),
    // each entry with the number it has on the month; under the month or on a page of their own
    if (notesWhere !== 'off') main.append(h('div', { class: 'cal-pnotes al-sheet' + (notesWhere === 'separate' ? ' sep' : '') }, h('style', null, AL_CSS),
      h('h3', null, `Details · ${monthLabel(cal.ym)}`),
      availDetails([start, addDays(start, weeks * 7 - 1)], { show: cal.show, tables: calp.tables, condense: calp.condense, num: { sp: (x) => pbook.add(noteKey.sp(x), noteSpecial(x)), ev: (x) => pbook.add(noteKey.ev(x), noteEvent(x)), to: (p, t) => pbook.add(noteKey.to(p, t), noteTimeOff(p, t)) } })));
    // printed: the decorations for these weeks, over every page
    { const ov = decoOverlay(start, addDays(start, weeks * 7 - 1)); if (ov) main.append(ov); }
    main.append(usualHoursCard());
  }
  // the Calendar's print button: where the numbered notes go, then print
  // ---------- Printing the Calendar: a window to pick what goes on the paper ----------
  // On the month: store hours by the date, time off bars, events, signs, holidays, the legend. The details: under the
  // month, on a page of their own, or none; which tables; repeating events on one line each. Kept in this browser.
  const CALP_KEY = 'shiftcraft-cal-print';
  // closed: a no sign over the date on a closed day; past: the days gone by crossed off with an X
  const calp = { grid: { hours: true, timeoff: true, events: true, signs: true, holidays: true, legend: true, closed: true, past: false }, out: 'show', pastAt: 'day', tables: { hours: true, timeoff: true, events: true, holidays: true }, condense: true };
  try { const c = JSON.parse(localStorage.getItem(CALP_KEY) || '{}'); ['grid', 'tables'].forEach((g) => { if (c[g]) Object.keys(calp[g]).forEach((k) => { if (typeof c[g][k] === 'boolean') calp[g][k] = c[g][k]; }); }); if (c.condense === false) calp.condense = false; if (['show', 'dim', 'blank'].includes(c.out)) calp.out = c.out; if (['day', 'date', 'dim'].includes(c.pastAt)) calp.pastAt = c.pastAt; } catch (e) { /* blocked */ }
  const calpSave = () => { try { localStorage.setItem(CALP_KEY, JSON.stringify(calp)); } catch (e) { /* blocked */ } };
  const CALP_ON = ['closed', 'past']; // shown when ticked (the others: left off when not)
  const calpClass = () => Object.keys(calp.grid).map((k) => (CALP_ON.includes(k) ? (calp.grid[k] ? ' cp-' + k : '') : calp.grid[k] ? '' : ' cp-no-' + k)).join('') + ' cp-out-' + calp.out + (calp.pastAt === 'date' ? ' cp-pastdate' : calp.pastAt === 'dim' ? ' cp-pastdim' : '');
  function calPrintDialog() {
    const grid = JSON.parse(JSON.stringify(calp.grid)), tables = { ...calp.tables };
    let where = notesWhere, condense = calp.condense, out = calp.out, past = grid.past ? calp.pastAt : 'off';
    // the days before the first and after the last of the month: as usual, dimmed, or left blank (room for the legend)
    const outSeg = calSeg('Days outside the month', [['show', 'Show'], ['dim', 'Dim'], ['blank', 'Leave blank']], out, (v) => { out = v; });
    const tick = (obj, k, label) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!obj[k], onchange: (e) => { obj[k] = e.target.checked; } }), ' ' + label);
    const cols = (...kids) => h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 18px' } }, kids);
    const cond = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: condense, onchange: (e) => { condense = e.target.checked; } }), ' Repeating events on one line each (Produce · every week on Mon–Sat)');
    const tablesBox = h('div', { class: 'grid', style: { gap: '6px', display: where === 'off' ? 'none' : '' } },
      cols(tick(tables, 'hours', 'Store hours'), tick(tables, 'timeoff', 'Time off'), tick(tables, 'events', 'Events'), tick(tables, 'holidays', 'Holidays')), cond);
    const whereSeg = calSeg('Details', [['page', 'Under the month'], ['separate', 'On a page of their own'], ['off', 'None']], where, (v) => { where = v; tablesBox.style.display = v === 'off' ? 'none' : ''; });
    modal({ title: `Print the calendar · ${monthLabel(cal.ym)}`, body: [
      h('div', { class: 'field' }, h('span', null, 'On the month'),
        cols(tick(grid, 'hours', 'Store hours by the date'), tick(grid, 'timeoff', 'Time off bars'), tick(grid, 'events', 'Events'), tick(grid, 'signs', 'Signs (payday, produce, truck…)'), tick(grid, 'holidays', 'Holidays'), tick(grid, 'legend', 'Legend (what the signs mean)'), tick(grid, 'closed', 'Closed days: a no sign over the date')),
        h('div', { class: 'field', style: { marginTop: '6px' } }, h('span', null, 'Cross off the days gone by'), calSeg('Cross off the days gone by', [['off', 'Off'], ['dim', 'Dim them'], ['day', 'X in the middle'], ['date', 'X over the date']], past, (v) => { past = v; }))),
      h('div', { class: 'field' }, h('span', null, 'Days before the 1st and after the last day (blank: the legend can go there)'), outSeg),
      h('div', { class: 'field' }, h('span', null, 'Details: store hours, time off, events and holidays, with the numbers from the month'), whereSeg),
      tablesBox,
      h('div', { class: 'field' }, h('span', null, 'Decorations'), decoControls(() => render())),
      h('p', { class: 'hint', style: { margin: 0 } }, 'Prints what the Calendar shows (its ticks: requests, approved, store hours, events, holidays). The schedule calendar (who works each day) is in Print & share › Calendar.')],
    actions: [{ label: 'Cancel' }, { label: 'Print…', primary: true, onClick: () => { Object.assign(calp.grid, grid); Object.assign(calp.tables, tables); calp.condense = condense; calp.out = out; grid.past = past !== 'off'; if (past !== 'off') calp.pastAt = past; Object.assign(calp.grid, grid); calpSave(); setNotesWhere(where); render(); setTimeout(() => window.print(), 80); } }] });
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
    const signed = ev.filter((x) => markOf(x) && !holEvent(x)), plain = ev.filter((x) => !signed.includes(x));
    const open = (x) => eventDialog(x.series || x, null, x.occ);
    return h('div', { class: 'cal-strip-wrap' },
      // the day's signs on a line of their own: what happens today (produce, the truck, payday…), in words
      signed.length ? h('div', { class: 'cal-signs' }, signed.map((x) => { const k = markOf(x);
        return h('button', { type: 'button', class: 'cal-sign' + (x.movedFrom ? ' urgent' : ''), title: `${x.title}${x.hours ? ` · ${clockShort(x.hours[0])}–${clockShort(x.hours[1])}` : ''}${x.movedFrom ? `\nMoved here from ${dayName(x.movedFrom, 'short')} ${shortDate(x.movedFrom)}: the store is closed that day` : ''}${x.note ? '\n' + x.note : ''}\nClick to see or change it`, onclick: () => open(x) },
          k === 'period' ? h('span', { class: 'cal-eop-key' }, String(parseIso(d).getDate())) : markSvg(k), ` ${x.title}${x.hours ? ' ' + clockShort(x.hours[0]) : ''}`); })) : null,
      shut || sp || plain.length ? h('div', { class: 'cal-strip' },
        shut ? h('button', { type: 'button', class: 'cal-chip special closed', title: `The store is usually closed on ${WEEKDAYS[dayIdx(d)]}s\nClick to see the usual hours`, onclick: () => { calGo(); setTimeout(() => $('#cal-usual')?.scrollIntoView({ block: 'center' }), 50); } }, `Store closed (usual on ${WEEKDAYS[dayIdx(d)]}s)`) : null,
        sp ? h('button', { type: 'button', class: 'cal-chip special' + (sp.closed ? ' closed' : ''), title: `Special store hours${sp.note ? '\nNote: ' + sp.note : ''}\nClick to see or change them`, onclick: () => specialDialog(sp) },
          `${sp.closed ? 'Store closed' : `Store open ${clock(sp.open)} – ${clock(sp.close)}`} · ${sp.name || 'special hours'}`) : null,
        plain.map((x) => h('button', { type: 'button', class: 'cal-chip event', title: `Event${x.note ? '\n' + x.note : ''}\nClick to see or change it`, onclick: () => open(x) }, `${x.hours ? `${clockShort(x.hours[0])}–${clockShort(x.hours[1])} ` : ''}${x.title}`))) : null);
  }
  // a small line under the day in the Week's heading: special hours, the day's signs (small pictures), other events
  function calMark(d) {
    const sp = specialOn(d), ev = eventsOn(d), shut = !sp && usualOn(d) && usualOn(d).closed;
    if (!sp && !ev.length && !shut) return null;
    if (shut && !ev.length) return h('div', { class: 'cal-wkmark', title: 'The store is usually closed this day' }, h('span', { class: 'bad' }, 'Closed'));
    const signed = ev.filter((x) => markOf(x) && !holEvent(x)), rest = ev.length - signed.length;
    const tip = [sp ? `${sp.name || 'Special hours'}: ${specialText(sp).toLowerCase()}` : '', ...ev.map((x) => `${x.hours ? clockShort(x.hours[0]) + ' ' : ''}${x.title}${x.movedFrom ? ' (moved here: closed ' + shortDate(x.movedFrom) + ')' : ''}`)].filter(Boolean).join('\n');
    return h('div', { class: 'cal-wkmark', title: tip }, sp ? h('span', { class: sp.closed ? 'bad' : 'warn' }, specialShort(sp)) : null, sp && ev.length ? ' · ' : '',
      signed.map((x) => h('span', { class: 'cal-wksign' + (x.movedFrom ? ' urgent' : '') }, markOf(x) === 'period' ? h('span', { class: 'cal-eop-key small' }, 'EOP') : markSvg(markOf(x)))), rest ? ` ★ ${rest}` : '');
  }
