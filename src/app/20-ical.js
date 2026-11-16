  // ---------- iCal (.ics) files: out to other calendars, and back in ----------
  // Export: time off, special store hours and events as an iCalendar file that Outlook, Google Calendar and Apple Calendar
  // open. Each entry also carries X-SHIFTCRAFT-… lines (kind, id, person, reason, status, hours), so a file ShiftCraft
  // made comes back exactly, and bringing it in again updates the same entries instead of adding them twice.
  // Import: any .ics file. Each entry is shown with a guess of what it is (time off for a person whose name is in it, a
  // store closing, or an event) to change before it goes in. Times in a time zone (TZID) are read as local times.
  const ICS_TYPE = { description: 'iCalendar file', accept: { 'text/calendar': ['.ics'] } };
  const icsEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const icsUnesc = (s) => String(s || '').replace(/\\([\\;,nN])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c));
  const icsFold = (line) => { // lines longer than 75 bytes go on in the next line, which starts with a space
    const enc = new TextEncoder(); if (enc.encode(line).length <= 75) return line;
    const out = []; let cur = '', n = 0;
    for (const ch of line) { const b = enc.encode(ch).length; if (n + b > 75) { out.push(cur); cur = ' '; n = 1; } cur += ch; n += b; }
    out.push(cur); return out.join('\r\n');
  };
  const icsDay = (d) => d.replace(/-/g, '');
  const icsAt = (d, m) => `${icsDay(d)}T${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}00`;
  const ICS_STATUS = { requested: 'TENTATIVE', approved: 'CONFIRMED', denied: 'CANCELLED' };

  function icsEvent({ uidOf, from, to, hours, summary, desc, cats, status, x, repeat, skip }) {
    const L = ['BEGIN:VEVENT', `UID:${uidOf}`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`];
    if (hours) { L.push(`DTSTART:${icsAt(from, hours[0])}`, `DTEND:${icsAt(from, hours[1])}`); if (to > from && !repeat) L.push(`RRULE:FREQ=DAILY;COUNT=${timeOffDays({ from, to })}`); }
    else L.push(`DTSTART;VALUE=DATE:${icsDay(from)}`, `DTEND;VALUE=DATE:${icsDay(addDays(to, 1))}`);
    // a repeating store event: its rule, and the times left out
    if (repeat) {
      L.push(`RRULE:FREQ=${{ day: 'DAILY', week: 'WEEKLY', month: 'MONTHLY', mlast: 'MONTHLY', year: 'YEARLY' }[repeat.unit] || 'WEEKLY'};INTERVAL=${Math.max(1, repeat.every | 0)}${repeat.unit === 'mlast' ? ';BYMONTHDAY=-1' : ''}${repeat.until ? ';UNTIL=' + icsDay(repeat.until) : ''}`);
      (skip || []).forEach((d) => L.push(hours ? `EXDATE:${icsAt(d, hours[0])}` : `EXDATE;VALUE=DATE:${icsDay(d)}`));
    }
    L.push(`SUMMARY:${icsEsc(summary)}`);
    if (desc) L.push(`DESCRIPTION:${icsEsc(desc)}`);
    if (cats) L.push(`CATEGORIES:${icsEsc(cats)}`);
    if (status) L.push(`STATUS:${status}`);
    L.push('TRANSP:TRANSPARENT');
    Object.entries(x).forEach(([k, v]) => { if (v != null && v !== '') L.push(`X-SHIFTCRAFT-${k}:${icsEsc(v)}`); });
    L.push('END:VEVENT');
    return L;
  }

  function icalExportDialog(o = {}) {
    const today = iso(new Date());
    const box = (label, on, title) => { const c = h('input', { type: 'checkbox', checked: on }); c.addEventListener('change', () => sync()); return { c, el: h('label', { class: 'check', title }, c, ' ' + label) }; };
    const cA = box('Approved time off', true), cR = box('Time off requests (still to approve)', true), cD = box('Denied time off', false),
      cS = box('Special store hours (holidays)', true), cE = box('Events and notes for a day', true),
      cN = box('Leave out notes and reasons (for a file you share)', false, 'Time off then shows only “Time off” with the name and dates');
    const people = sortStaff(plan.staff.filter((p) => !p.left));
    const who = h('select', { class: 'input' }, h('option', { value: '' }, 'Everyone'), people.map((p) => h('option', { value: p.id, selected: p.id === o.person }, p.name)));
    const range = h('select', { class: 'input' }, h('option', { value: 'upcoming' }, 'Now and coming up'), h('option', { value: 'all' }, 'Everything, past ones too'));
    [who, range].forEach((e) => e.addEventListener('change', () => sync()));
    const info = h('p', { class: 'hint', style: { margin: '6px 0 0' } });
    const gather = () => {
      const out = [], up = range.value === 'upcoming', bare = cN.c.checked, keep = (x) => !up || x.to >= today || !!(x.repeat && (!x.repeat.until || x.repeat.until >= today));
      const want = { requested: cR.c.checked, approved: cA.c.checked, denied: cD.c.checked };
      people.filter((p) => !who.value || p.id === who.value).forEach((p) => (p.timeOff || []).filter((t) => want[t.status] && keep(t)).forEach((t) => {
        const label = bare ? 'Time off' : TIME_OFF_WHY[t.why] || 'Time off', cover = t.cover && staffById(t.cover);
        out.push(icsEvent({ uidOf: t.ics || `${t.id}@shiftcraft`, from: t.from, to: t.to, hours: t.hours, summary: `${p.name} · ${label}${t.status === 'requested' ? ' (requested)' : t.status === 'denied' ? ' (denied)' : ''}`,
          desc: bare ? TIME_OFF_STATUS[t.status] : [TIME_OFF_STATUS[t.status], t.paid ? (t.paid === 'paid' ? 'Paid' : 'Unpaid') : '', cover ? `Covered by ${cover.name}` : '', t.note].filter(Boolean).join('\n'),
          cats: 'Time off', status: ICS_STATUS[t.status],
          x: { KIND: 'timeoff', ID: t.id, PERSON: p.name, WHY: bare ? '' : t.why, STATUS: t.status, PAID: bare ? '' : t.paid, NOTE: bare ? '' : t.note } }));
      }));
      if (cS.c.checked) (plan.specialHours || []).filter(keep).forEach((x) => out.push(icsEvent({ uidOf: x.ics || `${x.id}@shiftcraft`, from: x.from, to: x.to, hours: null,
        summary: `${x.name || 'Special hours'}: ${x.closed ? 'store closed' : `store open ${clock(x.open)} – ${clock(x.close)}`}`, desc: bare ? '' : x.note, cats: 'Store hours',
        x: { KIND: 'special', ID: x.id, NAME: x.name, CLOSED: x.closed ? '1' : '0', OPEN: x.open, CLOSE: x.close, NOTE: bare ? '' : x.note } })));
      if (cE.c.checked) (plan.events || []).filter(keep).forEach((x) => out.push(icsEvent({ uidOf: x.ics || `${x.id}@shiftcraft`, from: x.from, to: x.to, hours: x.hours, summary: x.title, desc: bare ? '' : x.note, cats: 'Event', repeat: x.repeat, skip: x.skip,
        x: { KIND: 'event', ID: x.id, TITLE: x.title, NOTE: bare ? '' : x.note } })));
      return out;
    };
    const sync = () => { const n = gather().length; info.textContent = n ? `${n} entr${n === 1 ? 'y goes' : 'ies go'} in the file.` : 'Nothing to put in the file with these choices.'; };
    sync();
    modal({ title: 'Export calendar (iCal)', body: [
      h('p', { class: 'hint', style: { marginTop: 0 } }, 'Saves an .ics file that Outlook, Google Calendar and Apple Calendar can open or import. Bring it back into ShiftCraft with Import iCal: the same entries are updated, not added twice.'),
      h('div', { class: 'field' }, h('span', null, 'Put in'), cA.el, cR.el, cD.el, cS.el, cE.el),
      pair2(fieldOf('Time off for', who), fieldOf('Dates', range)), cN.el, info],
    actions: [{ label: 'Cancel' }, { label: 'Save .ics file…', primary: true, onClick: () => {
      const evs = gather(); if (!evs.length) { toast('Nothing to put in the file with these choices.'); return false; }
      const person = staffById(who.value);
      const txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Craft//ShiftCraft//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${icsEsc(placeName() + (person ? ' · ' + person.name : '') + ' · ShiftCraft')}`,
        ...evs.flat(), 'END:VCALENDAR'].map(icsFold).join('\r\n') + '\r\n';
      const name = [plan.company, plan.location, person ? person.name : '', 'calendar'].map(safe).filter(Boolean).join(' - ') + '.ics';
      saveBlob(name, new Blob([txt], { type: 'text/calendar' }), ICS_TYPE).then((n) => n && toast(`Saved ${evs.length} entr${evs.length === 1 ? 'y' : 'ies'} as ${n}`));
    } }] });
  }

  // ---------- Reading a file ----------
  const icsLine = (s) => {
    let q = false, i = 0;
    for (; i < s.length; i++) { const c = s[i]; if (c === '"') q = !q; else if (c === ':' && !q) break; }
    if (i >= s.length) return null;
    const head = s.slice(0, i).split(';'), params = {};
    head.slice(1).forEach((p) => { const k = p.indexOf('='); if (k > 0) params[p.slice(0, k).toUpperCase()] = p.slice(k + 1).replace(/^"|"$/g, ''); });
    return { name: head[0].trim().toUpperCase(), params, value: s.slice(i + 1) };
  };
  function icsParse(text) {
    const evs = []; let cur = null, depth = 0;
    String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n').forEach((raw) => {
      if (!raw.trim()) return;
      const m = icsLine(raw); if (!m) return;
      if (m.name === 'BEGIN') { if (!cur && m.value.trim().toUpperCase() === 'VEVENT') { cur = { _p: {} }; depth = 0; } else if (cur) depth++; return; }
      if (m.name === 'END') { if (!cur) return; if (depth === 0 && m.value.trim().toUpperCase() === 'VEVENT') { evs.push(cur); cur = null; } else depth--; return; }
      if (cur && depth === 0 && m.name === 'EXDATE') { cur.EXDATE = (cur.EXDATE ? cur.EXDATE + ',' : '') + m.value; return; }
      if (cur && depth === 0 && !(m.name in cur)) { cur[m.name] = m.value; cur._p[m.name] = m.params; }
    });
    return evs;
  }
  // a DTSTART / DTEND value: { d: 'YYYY-MM-DD', t: minutes or null for a whole day }; Z (UTC) times become local times
  const icsWhen = (v, p) => {
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(String(v || '').trim()); if (!m) return null;
    if (!m[4] || (p && String(p.VALUE).toUpperCase() === 'DATE')) return { d: `${m[1]}-${m[2]}-${m[3]}`, t: null };
    const dt = m[7] ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])) : new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    return { d: iso(dt), t: dt.getHours() * 60 + dt.getMinutes() };
  };
  const icsMinutes = (dur) => { const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/.exec(String(dur || '')); return m ? ((+m[1] || 0) * 7 * 1440 + (+m[2] || 0) * 1440 + (+m[3] || 0) * 60 + (+m[4] || 0)) : 0; };
  function icsItem(e) {
    const s = icsWhen(e.DTSTART, e._p.DTSTART); if (!s) return null;
    const en = icsWhen(e.DTEND, e._p.DTEND), dur = icsMinutes(e.DURATION);
    let from = s.d, to = s.d, hours = null;
    if (s.t == null) { if (en && en.d > s.d) to = addDays(en.d, -1); else if (dur >= 1440) to = addDays(s.d, Math.round(dur / 1440) - 1); }
    else {
      const endD = en ? en.d : iso(new Date(parseIso(s.d).getTime() + (s.t + (dur || 60)) * 60000)), endT = en ? en.t : (s.t + (dur || 60)) % 1440;
      if (endD > s.d && !(endD === addDays(s.d, 1) && endT === 0)) { if (s.t === 0 && endT === 0) to = addDays(endD, -1); else to = endD; } // over several days: whole days
      else { const a = Math.min(snap(s.t), 1410), b = endD > s.d ? 1425 : Math.min(snap(endT), 1425); hours = [a, Math.max(a + 15, b)]; }
    }
    let repeat = '', rule = null, skip = [];
    if (e.RRULE) {
      const r = Object.fromEntries(e.RRULE.split(';').map((kv) => kv.split('=')).map(([k, v]) => [String(k).toUpperCase(), v]));
      if (r.FREQ === 'DAILY' && (!r.INTERVAL || r.INTERVAL === '1') && (r.COUNT || r.UNTIL) && from === to) { if (r.COUNT) to = addDays(from, Math.max(1, +r.COUNT) - 1); else { const u = icsWhen(r.UNTIL); if (u) to = u.d; } }
      else {
        const unit = { DAILY: 'day', WEEKLY: 'week', MONTHLY: r.BYMONTHDAY === '-1' ? 'mlast' : 'month', YEARLY: 'year' }[r.FREQ], every = Math.max(1, Math.min(99, parseInt(r.INTERVAL, 10) || 1));
        // kept as it is when it is one day a week / month / year; several weekdays (BYDAY=MO,WE) or "the 2nd Tuesday" are not
        const odd = (r.FREQ === 'WEEKLY' && r.BYDAY && r.BYDAY.split(',').length > 1) || (r.FREQ === 'MONTHLY' && r.BYDAY) || (r.FREQ === 'YEARLY' && r.BYDAY);
        if (unit && !odd) {
          let until = '';
          if (r.UNTIL) { const u = icsWhen(r.UNTIL); if (u) until = u.d; }
          else if (r.COUNT) { const all = repeatStarts({ from, to: from, repeat: { every, unit, until: '' } }, from, addDays(from, 366 * 40)); until = all[Math.max(1, +r.COUNT) - 1] || ''; }
          rule = { every, unit, until };
          skip = String(e.EXDATE || '').split(',').map((v) => icsWhen(v.trim())).filter(Boolean).map((w) => w.d);
          repeat = repeatText(rule);
        } else repeat = { DAILY: 'every day', WEEKLY: 'every week', MONTHLY: 'every month', YEARLY: 'every year' }[r.FREQ] || 'repeats';
      }
    }
    if (to < from) to = from;
    const X = (k) => (e['X-SHIFTCRAFT-' + k] != null ? icsUnesc(e['X-SHIFTCRAFT-' + k]).trim() : '');
    return { uid: (e.UID || '').trim(), id: X('ID').replace(/[^\w-]/g, '').slice(0, 40), kind: X('KIND'), from, to, hours, repeat, rule, skip,
      summary: icsUnesc(e.SUMMARY).replace(/\s+/g, ' ').trim(), desc: icsUnesc(e.DESCRIPTION).trim(), cancelled: String(e.STATUS || '').trim().toUpperCase() === 'CANCELLED',
      person: X('PERSON'), why: X('WHY'), status: X('STATUS'), paid: X('PAID'), note: X('NOTE'), name: X('NAME'), title: X('TITLE'), closed: X('CLOSED'), open: parseInt(X('OPEN'), 10), close: parseInt(X('CLOSE'), 10) };
  }

  // what ShiftCraft already has with this file's id or UID: { kind, x, p? }
  function icsFind(it) {
    const ids = [it.id, it.uid.endsWith('@shiftcraft') ? it.uid.split('@')[0] : ''].filter(Boolean), same = (x) => ids.includes(x.id) || (it.uid && x.ics === it.uid);
    for (const p of plan.staff) for (const t of p.timeOff || []) if (same(t)) return { kind: 'timeoff', x: t, p };
    for (const x of plan.specialHours || []) if (same(x)) return { kind: 'special', x };
    for (const x of plan.events || []) if (same(x)) return { kind: 'event', x };
    return null;
  }
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // a first guess of what an entry is: 'event', 'closed', 'special' or 'off:<person id>'
  function icsGuess(it, ex) {
    const people = plan.staff.filter((p) => !p.left);
    if (ex) return ex.kind === 'timeoff' ? 'off:' + ex.p.id : ex.kind === 'special' ? (ex.x.closed ? 'closed' : 'special') : 'event';
    if (it.kind === 'special') return it.closed === '1' ? 'closed' : 'special';
    if (it.kind === 'event') return 'event';
    const named = it.person && people.find((p) => p.name.toLowerCase() === it.person.toLowerCase());
    if (named) return 'off:' + named.id;
    const txt = `${it.summary} ${it.desc}`.toLowerCase();
    const full = people.find((p) => txt.includes(p.name.toLowerCase())); if (full) return 'off:' + full.id;
    const firsts = people.filter((p) => new RegExp(`\\b${reEsc(p.name.split(' ')[0].toLowerCase())}\\b`).test(txt));
    if (firsts.length === 1) return 'off:' + firsts[0].id;
    if (/\b(closed|store hours|special hours|holiday hours)\b/.test(txt)) return it.hours ? 'special' : 'closed';
    return 'event';
  }
  const icsWhy = (it) => {
    if (TIME_OFF_WHY[it.why]) return it.why;
    const txt = `${it.summary} ${it.desc}`.toLowerCase();
    return [['sick', /\b(sick|ill|flu)\b/], ['appointment', /\b(appointment|dentist|doctor|dr\.?)\b/], ['school', /\b(school|class|exam)\b/], ['family', /\b(family|wedding|kids?)\b/],
      ['bereavement', /\b(funeral|bereavement)\b/], ['jury', /\bjury\b/], ['vacation', /\b(vacation|holiday|trip|pto)\b/]].find(([, re]) => re.test(txt))?.[0] || 'personal';
  };

  function icalImport() {
    const inp = h('input', { type: 'file', accept: '.ics,.ical,.icalendar,text/calendar', style: { display: 'none' } });
    inp.addEventListener('change', async () => { const f = inp.files[0]; inp.remove(); if (f) icalImportDialog(await f.text(), f.name); });
    document.body.append(inp); inp.click();
  }

  function icalImportDialog(text, fileName) {
    const today = iso(new Date());
    const found = icsParse(text).map(icsItem).filter(Boolean).sort((a, b) => a.from.localeCompare(b.from));
    const upcoming = (it) => it.to >= today || !!(it.rule && (!it.rule.until || it.rule.until >= today));
    if (!found.length) { toast(`No calendar entries found in ${fileName}.`); return; }
    const people = sortStaff(plan.staff.filter((p) => !p.left));
    let defStatus = 'requested';
    const rows = found.slice(0, 600).map((it) => {
      const ex = icsFind(it);
      const already = !ex && ((plan.events || []).some((x) => x.from === it.from && x.title.toLowerCase() === it.summary.toLowerCase())
        || (plan.specialHours || []).some((x) => x.from === it.from && (x.name || '').toLowerCase() === (it.name || it.summary).toLowerCase()));
      const tick = h('input', { type: 'checkbox', checked: !already && upcoming(it), 'aria-label': 'Bring this one in' });
      const as = h('select', { class: 'input', 'aria-label': 'Add as' },
        h('option', { value: 'event' }, 'Event (a note for the day)'), h('option', { value: 'closed' }, 'Store closed'), h('option', { value: 'special' }, 'Store open other hours'),
        h('optgroup', { label: 'Time off for' }, people.map((p) => h('option', { value: 'off:' + p.id }, p.name))));
      as.value = icsGuess(it, ex);
      if (!as.value) as.value = 'event';
      const state = ex ? h('span', { class: 'small good' }, 'Updates the one in ShiftCraft') : already ? h('span', { class: 'small muted' }, 'Looks already there') : !upcoming(it) ? h('span', { class: 'small muted' }, 'Past') : h('span', { class: 'small' }, 'New');
      const tr = h('tr', null, h('td', { class: 'c' }, tick), h('td', { class: 'nowrap small' }, timeOffWhen(it)),
        h('td', { style: { minWidth: '240px' } }, h('b', null, it.summary || '(no title)'), it.desc ? h('div', { class: 'small muted', style: { maxWidth: '320px', whiteSpace: 'pre-line', overflow: 'hidden', maxHeight: '3.4em' } }, it.desc) : null,
          it.rule ? h('div', { class: 'small good' }, `↻ Repeats ${it.repeat} (as an event)`) : it.repeat ? h('div', { class: 'small warn' }, `Repeats ${it.repeat}: only this first one comes in`) : null),
        h('td', null, as), h('td', { class: 'nowrap' }, state));
      return { it, ex, tick, as, tr };
    });
    const pick = (f) => { rows.forEach((r) => { r.tick.checked = f(r); }); };
    const seg = calSeg('Time off from this file is', [['requested', 'Requested'], ['approved', 'Approved']], defStatus, (v) => { defStatus = v; });
    modal({ title: `Import calendar · ${fileName}`, wide: true, body: [
      h('p', { class: 'hint', style: { marginTop: 0 } }, `${found.length} entr${found.length === 1 ? 'y' : 'ies'} found${found.length > rows.length ? ` (the first ${rows.length} are shown)` : ''}. Tick the ones to bring in and say what each one is: an event, the store closed or open other hours (a holiday), or time off for someone. A name in the entry picks the person.`),
      h('div', { class: 'inline' }, h('span', { class: 'small' }, 'Tick:'), h('button', { type: 'button', class: 'btn sm', onclick: () => pick(() => true) }, 'All'),
        h('button', { type: 'button', class: 'btn sm', onclick: () => pick((r) => upcoming(r.it)) }, 'Now and coming up'), h('button', { type: 'button', class: 'btn sm', onclick: () => pick(() => false) }, 'None'),
        h('span', { class: 'spacer' }), h('span', { class: 'small' }, 'Time off that doesn’t say is'), seg),
      h('div', { class: 'table-wrap', style: { maxHeight: '52vh', overflow: 'auto', marginTop: '8px' } }, h('table', { class: 't compact' },
        h('thead', null, h('tr', null, h('th', { class: 'c' }, 'In'), h('th', null, 'When'), h('th', null, 'Entry'), h('th', null, 'Add as'), h('th', null, ''))), h('tbody', null, rows.map((r) => r.tr)))),
      h('p', { class: 'hint' }, 'Times with a time zone are read as times here. An entry that repeats weekly or yearly comes in once (its first day).')],
    actions: [{ label: 'Cancel' }, { label: 'Bring them in', primary: true, onClick: () => {
      const go = rows.filter((r) => r.tick.checked);
      if (!go.length) { toast('Tick at least one entry.'); return false; }
      const n = { timeoff: 0, special: 0, event: 0, updated: 0 };
      change(() => {
        go.forEach(({ it, ex, as }) => {
          if (ex) { // take the old one out (it may be going in as another kind)
            n.updated++;
            if (ex.kind === 'timeoff') { ex.p.timeOff = ex.p.timeOff.filter((t) => t !== ex.x); if (!ex.p.timeOff.length) delete ex.p.timeOff; }
            else if (ex.kind === 'special') plan.specialHours = plan.specialHours.filter((x) => x !== ex.x);
            else plan.events = plan.events.filter((x) => x !== ex.x);
          }
          const id = ex ? ex.x.id : it.id || uid(), ics = it.uid && !it.uid.endsWith('@shiftcraft') ? { ics: it.uid.slice(0, 300) } : {};
          const note = (it.note || it.desc || '').slice(0, 300);
          const v = as.value;
          if (v === 'event') { (plan.events = plan.events || []).push({ id, from: it.from, to: it.to, title: (it.title || it.summary || 'Event').slice(0, 120), hours: it.hours, note: (it.note || it.desc || '').slice(0, 500), ...ics, ...(it.rule ? { repeat: it.rule, ...(it.skip.length ? { skip: it.skip } : {}) } : {}) }); n.event++; }
          else if (v === 'closed' || v === 'special') {
            const r = regularHours(it.from) || { open: 600, close: 960 };
            const open = Number.isFinite(it.open) ? it.open : it.hours ? it.hours[0] : r.open, close = Number.isFinite(it.close) && it.close > open ? it.close : it.hours ? it.hours[1] : Math.max(r.close, open + 60);
            (plan.specialHours = plan.specialHours || []).push({ id, from: it.from, to: it.to, name: (it.name || it.summary.replace(/:\s*store (closed|open).*$/i, '')).slice(0, 80), closed: v === 'closed', open, close: close > open ? close : open + 60, note, ...ics }); n.special++;
          } else {
            const p = staffById(v.slice(4)); if (!p) return;
            const status = TIME_OFF_STATUS[it.status] ? it.status : it.cancelled ? 'denied' : defStatus;
            (p.timeOff = p.timeOff || []).push({ id, from: it.from, to: it.to, hours: it.hours, why: icsWhy(it), status, note: it.kind === 'timeoff' ? it.note.slice(0, 300) : [it.summary, it.desc].filter(Boolean).join(' – ').slice(0, 300),
              added: today, asked: today, ...(['paid', 'unpaid'].includes(it.paid) ? { paid: it.paid } : {}), ...(status !== 'requested' ? { decided: today } : {}), ...ics });
            p.timeOff.sort((a, b) => a.from.localeCompare(b.from)); n.timeoff++;
          }
        });
        ['events', 'specialHours'].forEach((k) => { if (plan[k]) { plan[k].sort((a, b) => a.from.localeCompare(b.from)); if (!plan[k].length) delete plan[k]; } });
      });
      const parts = [n.timeoff && `${n.timeoff} time off`, n.special && `${n.special} store hours`, n.event && `${n.event} event${n.event === 1 ? '' : 's'}`].filter(Boolean).join(', ');
      toast(`Brought in ${parts}${n.updated ? ` (${n.updated} updated)` : ''}. You can undo this.`, { label: 'Undo', fn: undo });
    } }] });
  }
