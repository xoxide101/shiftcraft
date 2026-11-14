  // ===================================================================
  // Checking: clean up files, and find problems in the schedule
  // ===================================================================
  // Fixes anything that could break the schedule (bad times, missing ids). Returns how many fixes.
  function validatePlan(p) {
    let fixes = 0;
    if (!Array.isArray(p.positions)) p.positions = defaultPositions();
    p.positions = p.positions.filter((x) => x && String(x.name || '').trim()).map((x) => ({ id: x.id || uid(), name: String(x.name).trim(), active: x.active !== false }));
    const ids = new Set();
    p.staff = (p.staff || []).filter((x) => x && String(x.name || '').trim()).map((x) => {
      const q = { ...x, name: String(x.name).trim() };
      if (!ROLES[q.role]) { q.role = 'TM'; fixes++; }
      if (q.lines !== undefined) { q.lines = Array.isArray(q.lines) ? q.lines.filter((l) => l && Array.isArray(l.days) && Number.isFinite(l.from) && Number.isFinite(l.to)) : []; if (!q.lines.length) delete q.lines; }
      if (q.timeOff !== undefined) {
        const ok = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
        q.timeOff = Array.isArray(q.timeOff) ? q.timeOff.filter((t) => t && ok(t.from)).map((t) => ({ id: t.id || uid(), from: t.from, to: ok(t.to) && t.to >= t.from ? t.to : t.from,
          hours: Array.isArray(t.hours) && Number.isFinite(t.hours[0]) && Number.isFinite(t.hours[1]) && t.hours[1] > t.hours[0] ? [t.hours[0], t.hours[1]] : null,
          why: TIME_OFF_WHY[t.why] ? t.why : 'other', status: TIME_OFF_STATUS[t.status] ? t.status : 'requested', note: String(t.note || '').slice(0, 300), added: ok(t.added) ? t.added : t.from })) : [];
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
      h('p', { class: 'hint' }, 'Looks for shifts of one person that overlap (split shifts are fine), shifts outside availability, inactive people, very long shifts, weekly hours over the max, and times with nobody from Manager or Supervisor on the floor.')],
    actions: [{ label: 'Close', primary: true }] });
  }

