  // ===================================================================
  // Checking: clean up files, and find problems in the schedule
  // ===================================================================
  // Fixes anything that could break the schedule (bad times, missing ids). Returns how many fixes.
  function validatePlan(p) {
    let fixes = 0;
    if (!Array.isArray(p.positions)) p.positions = defaultPositions();
    p.positions = p.positions.filter((x) => x && String(x.name || '').trim()).map((x) => ({ id: x.id || uid(), name: String(x.name).trim(), active: x.active !== false }));
    // the Calendar's special store hours and events (20-calendar.js)
    { const okd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s), okh = (a) => Array.isArray(a) && Number.isFinite(a[0]) && Number.isFinite(a[1]) && a[1] > a[0];
      const ics = (x) => (typeof x.ics === 'string' && x.ics ? { ics: x.ics.slice(0, 300) } : {}), to = (x) => (okd(x.to) && x.to >= x.from ? x.to : x.from);
      if (p.hours && p.hours.days !== undefined) p.hours = { days: Array.from({ length: 7 }, (_, i) => { const x = Array.isArray(p.hours.days) ? p.hours.days[i] : null; return !x ? null : x.closed ? { closed: true } : Number.isFinite(x.open) && Number.isFinite(x.close) && x.close > x.open ? { open: x.open, close: x.close } : null; }) };
      if (p.events !== undefined) { p.events = Array.isArray(p.events) ? p.events.filter((x) => x && okd(x.from)).map((x) => ({ id: x.id || uid(), from: x.from, to: to(x), title: String(x.title || 'Event').slice(0, 120), hours: okh(x.hours) ? [x.hours[0], x.hours[1]] : null, note: String(x.note || '').slice(0, 500), ...ics(x),
        // repeating (every n days / weeks / months / years, until a day), the times left out, holiday kind, sign by the date, the built-in holiday it stands for
        ...(x.repeat && ['day', 'week', 'month', 'mlast', 'year'].includes(x.repeat.unit) ? { repeat: { every: Math.max(1, Math.min(99, x.repeat.every | 0)), unit: x.repeat.unit, until: okd(x.repeat.until) ? x.repeat.until : '' } } : {}),
        ...(x.repeat && Array.isArray(x.skip) && x.skip.some(okd) ? { skip: x.skip.filter(okd) } : {}),
        ...(['national', 'local', false, true].includes(x.holiday) ? { holiday: x.holiday } : {}),
        ...(typeof x.mark === 'string' && /^[a-z]{1,20}$/.test(x.mark) ? { mark: x.mark } : {}),
        ...(typeof x.replaces === 'string' && x.replaces ? { replaces: x.replaces.slice(0, 80) } : {}) })) : []; if (!p.events.length) delete p.events; }
      if (p.specialHours !== undefined) { p.specialHours = Array.isArray(p.specialHours) ? p.specialHours.filter((x) => x && okd(x.from)).map((x) => { const open = Number.isFinite(x.open) ? x.open : 600; return { id: x.id || uid(), from: x.from, to: to(x), name: String(x.name || '').slice(0, 80), closed: !!x.closed, open, close: Number.isFinite(x.close) && x.close > open ? x.close : open + 60, note: String(x.note || '').slice(0, 300), ...ics(x) }; }) : []; if (!p.specialHours.length) delete p.specialHours; } }
    const ids = new Set();
    p.staff = (p.staff || []).filter((x) => x && String(x.name || '').trim()).map((x) => {
      const q = { ...x, name: String(x.name).trim() };
      if (!ROLES[q.role]) { q.role = 'TM'; fixes++; }
      if (q.lines !== undefined) { q.lines = Array.isArray(q.lines) ? q.lines.filter((l) => l && Array.isArray(l.days) && Number.isFinite(l.from) && Number.isFinite(l.to)) : []; if (!q.lines.length) delete q.lines; }
      if (q.school !== undefined) {
        const sc = q.school, okd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
        if (!sc || typeof sc !== 'object') delete q.school;
        else q.school = { on: sc.on !== false, name: String(sc.name || '').slice(0, 80), from: okd(sc.from) ? sc.from : '', to: okd(sc.to) ? sc.to : '', note: String(sc.note || '').slice(0, 300),
          classes: Array.isArray(sc.classes) ? sc.classes.filter((c) => c && Array.isArray(c.days) && Number.isFinite(c.from) && Number.isFinite(c.to)).map((c) => ({ days: c.days.filter((x) => Number.isInteger(x) && x >= 0 && x < 7), from: c.from, to: c.to })) : [] };
      }
      if (q.timeOff !== undefined) {
        const ok = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
        q.timeOff = Array.isArray(q.timeOff) ? q.timeOff.filter((t) => t && ok(t.from)).map((t) => ({ id: t.id || uid(), from: t.from, to: ok(t.to) && t.to >= t.from ? t.to : t.from,
          hours: Array.isArray(t.hours) && Number.isFinite(t.hours[0]) && Number.isFinite(t.hours[1]) && t.hours[1] > t.hours[0] ? [t.hours[0], t.hours[1]] : null,
          why: TIME_OFF_WHY[t.why] ? t.why : 'other', status: TIME_OFF_STATUS[t.status] ? t.status : 'requested', note: String(t.note || '').slice(0, 300), added: ok(t.added) ? t.added : t.from,
          ...(ok(t.asked) ? { asked: t.asked } : {}), ...(TIME_OFF_HOW[t.how] ? { how: t.how } : {}), ...(typeof t.cover === 'string' && t.cover ? { cover: t.cover } : {}),
          ...(['paid', 'unpaid'].includes(t.paid) ? { paid: t.paid } : {}), ...(ok(t.decided) ? { decided: t.decided } : {}), ...(typeof t.ics === 'string' && t.ics ? { ics: t.ics.slice(0, 300) } : {}) })) : [];
        if (!q.timeOff.length) delete q.timeOff;
      }
      if (!q.id || ids.has(q.id)) { q.id = uid(); fixes++; }
      ids.add(q.id);
      return q;
    });
    Object.keys(p.shifts || {}).forEach((d) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Array.isArray(p.shifts[d])) { delete p.shifts[d]; fixes++; return; }
      p.shifts[d] = p.shifts[d].filter((s) => s && s.staffId).map((s) => {
        const t = { ...s, start: snap(+s.start), end: snap(+s.end) };
        if (!isFinite(t.start) || !isFinite(t.end)) { t.start = 540; t.end = 1020; fixes++; }
        const before = t.start + ':' + t.end;
        clampShift(t);
        if (before !== t.start + ':' + t.end) fixes++;
        if (!t.id) { t.id = uid(); fixes++; }
        if (t.note != null) { const n = String(t.note).trim().slice(0, 500); if (n !== t.note) fixes++; if (n) t.note = n; else delete t.note; }
        return t;
      });
    });
    return fixes;
  }
  function problemsFor(days) {
    const out = [];
    const add = (d, text, kind) => out.push({ d, text, kind });
    days.forEach((d) => {
      const list = shiftsOn(d);
      const seen = {};
      // special store hours (a holiday): shifts on a closed day, or well outside the hours (over 2 h before opening, 1 h after closing)
      const sp = specialOn(d);
      const u = !sp && usualOn(d);
      if (u && u.closed && list.length) add(d, `The store is usually closed on ${WEEKDAYS[dayIdx(d)]}s, but ${list.length} shift${list.length === 1 ? ' is' : 's are'} scheduled.`, 'warn');
      if (sp && sp.closed && list.length) add(d, `The store is closed (${sp.name || 'special hours'}), but ${list.length} shift${list.length === 1 ? ' is' : 's are'} scheduled.`, 'bad');
      else if (sp) list.forEach((s) => { if (s.start < sp.open - 120 || s.end > sp.close + 60) add(d, `${staffById(s.staffId).name} works ${clock(s.start)}–${clock(s.end)}, but the store is open ${clock(sp.open)} – ${clock(sp.close)} (${sp.name || 'special hours'}).`, 'warn'); });
      list.forEach((s) => {
        const p = staffById(s.staffId);
        // more than one shift on a day is fine (a split shift); only parts that overlap are a problem
        const twin = (seen[p.id] || []).find((x) => x.start < s.end && s.start < x.end);
        if (twin) add(d, `${p.name} has shifts that overlap (${clock(twin.start)}–${clock(twin.end)} and ${clock(s.start)}–${clock(s.end)}).`, 'bad');
        seen[p.id] = (seen[p.id] || []).concat(s);
        if (!p.active) add(d, `${p.name} is scheduled but marked not active on the Staff tab.`, 'warn');
        const iss = availIssue(p, d, s);
        if (iss) add(d, iss + '.', 'warn');
        if (len(s) > 10) add(d, `${p.name} has a ${hrs(len(s))}-hour shift.`, 'warn');
      });
      // Leadership on the floor: someone from Manager or Supervisor whenever anyone is working.
      if (list.length) {
        let gap = null;
        const gaps = [];
        for (let m = DAY_START; m <= DAY_END; m += STEP) {
          const on = list.filter((s) => s.start <= m && s.end > m);
          const lead = on.some((s) => ['mgr', 'sup'].includes(ROLES[staffById(s.staffId).role].group));
          if (on.length && !lead && m < DAY_END) { if (gap == null) gap = m; }
          else if (gap != null) { gaps.push([gap, m]); gap = null; }
        }
        gaps.forEach(([a, b]) => add(d, `No manager or shift manager on the floor ${clock(a)}–${clock(b)}.`, 'bad'));
      }
    });
    // Weekly hours over each person's maximum
    const weeksSeen = new Set(days.map((d) => mondayOf(d)));
    weeksSeen.forEach((mon) => {
      const wd = daysFrom(mon, 7);
      plan.staff.forEach((p) => {
        const t = wd.reduce((a, d) => a + hoursOn(p.id, d), 0);
        if (p.maxHours && t > p.maxHours) add(mon, `${p.name} has ${hrs(t)} hours in the week of ${shortDate(mon)} (max ${p.maxHours}).`, 'warn');
      });
    });
    return out.sort((a, b) => a.d.localeCompare(b.d));
  }
  function checkDialog() {
    const range = h('select', { class: 'input' }, h('option', { value: 'day' }, `This day (${dayName(ui.day, 'short')} ${shortDate(ui.day)})`), h('option', { value: 'week', selected: true }, `This week (week ${weekOf(ui.day) + 1})`), h('option', { value: 'all' }, `Whole plan (${plan.weeks} weeks)`));
    const list = h('div', { class: 'problems' });
    const draw = () => {
      const days = range.value === 'day' ? [ui.day] : range.value === 'week' ? weekDays(weekOf(ui.day)) : planDays();
      const probs = problemsFor(days);
      list.replaceChildren(probs.length
        ? h('ul', null, probs.map((x) => h('li', { class: x.kind }, h('button', { class: 'btn sm', type: 'button', onclick: () => { ui.day = planDays().includes(x.d) ? x.d : ui.day; ui.tab = 'schedule'; persist(); document.querySelector('.backdrop')?.remove(); render(); } }, `${dayName(x.d, 'short')} ${shortDate(x.d)}`), ' ', x.text)))
        : h('p', { class: 'good' }, `No problems found in ${days.length === 1 ? 'this day' : days.length === 7 ? 'this week' : 'the plan'}.`));
    };
    range.addEventListener('change', draw); draw();
    modal({ title: 'Check schedule', wide: true, body: [h('label', { class: 'field' }, h('span', null, 'Check'), range), list,
      h('p', { class: 'hint' }, 'Looks for shifts of one person that overlap (split shifts are fine), shifts outside availability, shifts on a day the store is closed or outside special store hours, inactive people, very long shifts, weekly hours over the max, and times with nobody from Manager or Supervisor on the floor.')],
    actions: [{ label: 'Close', primary: true }] });
  }

