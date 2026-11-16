  // ===================================================================
  // Calculations
  // ===================================================================
  const planDays = () => Array.from({ length: plan.weeks * 7 }, (_, i) => addDays(plan.startDate, i));
  const weekOf = (d) => Math.floor((parseIso(d) - parseIso(plan.startDate)) / 864e5 / 7);
  const weekDays = (w) => Array.from({ length: 7 }, (_, i) => addDays(plan.startDate, w * 7 + i));
  const staffById = (id) => plan.staff.find((s) => s.id === id);
  const shiftsOn = (d) => (plan.shifts[d] || []).filter((s) => staffById(s.staffId));
  const dayHours = (d) => shiftsOn(d).reduce((t, s) => t + len(s), 0);
  function trend(d) {
    const vals = [7, 14, 21, 28].map((k) => plan.history[addDays(d, -k)]).filter((v) => v != null && v !== '' && !isNaN(v));
    return vals.length ? vals.reduce((a, b) => a + +b, 0) / vals.length : null;
  }
  const forecastOf = (d) => { const f = plan.forecast[d]; return f != null && f !== '' ? +f : trend(d); };
  const targetHours = (d) => { const f = forecastOf(d); return f == null ? null : f / plan.splh; };
  const varianceHours = (d) => { const t = targetHours(d); return t == null ? null : dayHours(d) - t; };
  function personWeekHours(staffId, w) { return weekDays(w).reduce((t, d) => t + shiftsOn(d).filter((s) => s.staffId === staffId).reduce((a, s) => a + len(s), 0), 0); }
  const sortStaff = (list) => [...list].sort((a, b) => Object.keys(ROLES).indexOf(a.role) - Object.keys(ROLES).indexOf(b.role) || a.name.localeCompare(b.name));
  // Availability: days a person can't work, and the parts of the day they can.
  const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const PARTS = [['am', 'AM'], ['mid', 'MID'], ['pm', 'PM']];
  const partsOf = (p) => (Array.isArray(p.parts) && p.parts.length ? p.parts : ['am', 'mid', 'pm']);
  // Day-by-day availability (the availability and contact list): p.avail[0–6] (Monday first) is null (not given: the
  // weekday / weekend settings apply) or { k: 'any' | 'off' | 'times' | 'note' | 'unk' (not given: black on the list), note, hl (highlight), r: [[from, to, '+' | '-'], …] }.
  // In 'times', '+' ranges are when they can work and '-' ranges when they can't; where they overlap, can't wins.
  // With no '+' range, they can work any time apart from the '-' ranges. OPEN and CLOSE stand for the opening and closing time.
  const OPEN = -1, CLOSE = 9999;
  const shiftsOf = (p, d) => shiftsOn(d).filter((x) => x.staffId === p.id).sort((a, b) => a.start - b.start);
  const AV_NOTES = ['Mornings', 'Afternoons', 'Evenings', 'Emergency', 'If you ask'];
  const avDay = (d) => (parseIso(d).getDay() + 6) % 7;
  const avOf = (p, i) => (Array.isArray(p.avail) && p.avail[i]) || null;
  const offOn = (p, d) => { const a = avOf(p, avDay(d)); return a ? a.k === 'off' : !!(p.off && p.off[avDay(d)]); };
  const clockShort = (m) => { const h24 = Math.floor(m / 60) % 24, mm = m % 60; return `${h24 % 12 || 12}${mm ? ':' + String(mm).padStart(2, '0') : ''}${h24 < 12 ? 'am' : 'pm'}`; };
  const endWord = (m) => (m === OPEN ? 'Open' : m === CLOSE ? 'Close' : clockShort(m));
  const realMin = (m, close) => (m === OPEN ? DAY_START : m === CLOSE ? DAY_END : m);
  function avText(a) {
    if (!a) return '';
    if (a.k === 'any') return 'Any'; if (a.k === 'off') return 'Off'; if (a.k === 'unk') return 'Not given'; if (a.k === 'note') return a.note || '';
    const r = a.r || [], plus = r.filter((x) => x[2] !== '-'), minus = r.filter((x) => x[2] === '-');
    const word = (x) => `${endWord(x[0])} - ${endWord(x[1])}`;
    return (plus.length ? plus.map(word).join(' / ') : 'Any') + (minus.length ? ` (not ${minus.map(word).join(', ')})` : '');
  }
  // Hours on some days (split shifts): p.lines = [{ tab: 'wk' | 'we', days: [0–6, Monday first], from, to }], made on the
  // Weekdays or Weekend tab. On a day that has lines, they are the hours the person can work (each line one stretch, so
  // 7am–11am and 4pm–9pm is a split day) in place of the tab's usual available hours; the day-by-day list still wins.
  const linesOn = (p, i) => (Array.isArray(p.lines) ? p.lines.filter((l) => Array.isArray(l.days) && l.days.includes(i) && l.to > l.from) : []).sort((a, b) => a.from - b.from);
  // the usual weekday / weekend settings, as a day-by-day entry (to start the list from)
  function avFromSets(p, i) {
    if (p.off && p.off[i]) return { k: 'off' };
    const L = linesOn(p, i); if (L.length) return { k: 'times', r: L.map((l) => [l.from, l.to, '+']) };
    const st = setOf(p, i >= 5 ? 'we' : 'wk');
    if (st.from != null && st.to != null) return { k: 'times', r: [[st.from, st.to, '+']] };
    if (st.parts.length === 3) return { k: 'any' };
    const names = { am: 'Mornings', mid: 'Afternoons', pm: 'Evenings' };
    return st.parts.length === 1 ? { k: 'note', note: names[st.parts[0]] } : { k: 'any' };
  }
  // Weekdays (Mon–Fri) and the weekend (Sat–Sun) each have their own usual shift, available hours and parts of the day.
  // The weekday set is p.defStart, p.defEnd, p.parts, p.from, p.to; the weekend set is p.we (missing parts = same as weekdays).
  const isWkend = (d) => { const g = parseIso(d).getDay(); return g === 0 || g === 6; };
  function setOf(p, k) {
    const w = { start: p.defStart ?? 540, end: p.defEnd ?? 1020, parts: partsOf(p), from: p.from ?? null, to: p.to ?? null };
    if (k !== 'we' || !p.we) return w;
    const e = p.we;
    return { start: e.defStart ?? w.start, end: e.defEnd ?? w.end, parts: Array.isArray(e.parts) && e.parts.length ? e.parts : w.parts, from: 'from' in e ? e.from : w.from, to: 'to' in e ? e.to : w.to };
  }
  const setFor = (p, d) => setOf(p, d && isWkend(d) ? 'we' : 'wk');
  function setSet(p, k, patch) {
    const map = { start: 'defStart', end: 'defEnd', parts: 'parts', from: 'from', to: 'to' };
    if (k === 'we') { const cur = setOf(p, 'we'); p.we = { defStart: cur.start, defEnd: cur.end, parts: cur.parts, from: cur.from, to: cur.to, ...(p.we || {}) }; Object.entries(patch).forEach(([a, v]) => { p.we[map[a]] = v; }); }
    else Object.entries(patch).forEach(([a, v]) => { p[map[a]] = v; });
  }
  const partWord = (k) => (k === 'we' ? 'weekends' : 'weekdays');
  function availIssue(p, d, s) {
    const first = p.name.split(' ')[0];
    const away = timeOffIssue(p, d, s); if (away) return away;
    if (offOn(p, d)) return `${first} is not available on ${dayName(d)}s`;
    if (!s) return '';
    const sch = schoolIssue(p, d, s); if (sch) return sch;
    const a = avOf(p, avDay(d));
    if (a) {
      if (a.k === 'any') return '';
      if (a.k === 'unk') return `${first} has not given availability for ${dayName(d)}s`;
      if (a.k === 'note') {
        if (/emergenc/i.test(a.note || '')) return `${first} is only available for emergencies on ${dayName(d)}s`;
        const win = { Mornings: [DAY_START, plan.midStart], Afternoons: [plan.midStart, plan.pmStart], Evenings: [plan.pmStart, DAY_END] }[a.note];
        return win && (s.start < win[0] - 60 || s.end > win[1] + 60) ? `${first} prefers ${a.note.toLowerCase()} on ${dayName(d)}s` : '';
      }
      const r = a.r || [], plus = r.filter((x) => x[2] !== '-'), minus = r.filter((x) => x[2] === '-');
      const inPlus = !plus.length || plus.some((x) => s.start >= realMin(x[0]) && s.end <= realMin(x[1]));
      const hitMinus = minus.some((x) => s.start < realMin(x[1]) && s.end > realMin(x[0]));
      return inPlus && !hitMinus ? '' : `${first} is available ${avText(a)} on ${dayName(d)}s`;
    }
    const L = linesOn(p, avDay(d));
    if (L.length) return L.some((l) => s.start >= l.from && s.end <= l.to) ? '' : `${first} is available ${L.map((l) => `${clock(l.from)} – ${clock(l.to)}`).join(' and ')} on ${dayName(d)}s`;
    const st = setFor(p, d), parts = st.parts;
    if (st.from != null && st.to != null && (s.start < st.from || s.end > st.to)) return `${first} is only available ${clock(st.from)} – ${clock(st.to)} on ${partWord(isWkend(d) ? 'we' : 'wk')}`;
    if (parts.length === 3) return '';
    const win = { am: [DAY_START, plan.midStart], mid: [plan.midStart, plan.pmStart], pm: [plan.pmStart, DAY_END] };
    const bad = Object.entries(win).filter(([k, [a, b]]) => !parts.includes(k) && s.start < b && s.end > a).map(([k]) => k.toUpperCase());
    return bad.length ? `${first} only works ${parts.map((x) => x.toUpperCase()).join(' / ')}; this shift runs into ${bad.join(' and ')}` : '';
  }
  const varClass = (v) => (v == null ? '' : Math.abs(v) <= 2 ? 'good' : Math.abs(v) <= 6 ? 'warn' : 'bad');

