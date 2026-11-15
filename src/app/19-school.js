  // ---------- School ----------
  // p.school = { on, name, from, to, classes: [{ days: [0–6, Monday first], from, to }], note }
  // The Staff › School tab: who is in school, the school, the term (first and last day; either can be left blank) and the
  // class times. During the term, class times are hours they can't work: a shift over them gets the ! mark.
  const SCHOOL_DAYS = [0, 1, 2, 3, 4, 5, 6];
  const schoolOn = (p, d) => {
    const sc = p.school; if (!sc || sc.on === false || !Array.isArray(sc.classes)) return [];
    if ((sc.from && d < sc.from) || (sc.to && d > sc.to)) return [];
    const i = avDay(d); return sc.classes.filter((c) => Array.isArray(c.days) && c.days.includes(i) && c.to > c.from);
  };
  const schoolIssue = (p, d, s) => {
    const c = s && schoolOn(p, d).find((x) => s.start < x.to && s.end > x.from);
    return c ? `${p.name.split(' ')[0]} has school ${clock(c.from)} – ${clock(c.to)} on ${dayName(d)}s${p.school.name ? ` (${p.school.name})` : ''}` : '';
  };
  const schoolText = (sc) => (sc.classes || []).map((c) => `${c.days.map((i) => WEEKDAYS[i].slice(0, 3)).join(', ') || 'no days'} ${clockShort(c.from)}–${clockShort(c.to)}`).join(' · ');

  function schoolRows() {
    const people = sortStaff(plan.staff.filter((p) => !p.left));
    const head = ['Name', 'Role', 'In school', 'School', 'Term: first day – last day', 'Class times (they can’t work these hours)', 'Note'];
    const cols = head.length;
    const dayBtns = (c) => h('div', { class: 'daytoggles', role: 'group', 'aria-label': 'Class days' }, SCHOOL_DAYS.map((i) => { const on = c.days.includes(i), wd = WEEKDAYS[i];
      return h('button', { type: 'button', class: 'dt use' + (on ? ' on' : ''), 'aria-pressed': String(on), title: `${on ? 'Class' : 'No class'} on ${wd}s (click to change)`, onclick: () => change(() => { c.days = on ? c.days.filter((x) => x !== i) : [...c.days, i].sort(); }) }, wd[0]); }));
    const classLine = (p, c, first) => {
      const fa = timePicker(c.from, 'Class from'), fb = timePicker(c.to, 'Class until');
      const save = (moved) => { let f = fa.value, t = fb.value; if (t <= f) { if (moved === 'from') t = Math.min(DAY_END, f + 60); else f = Math.max(DAY_START, t - 60); } change(() => { c.from = f; c.to = t; }); };
      fa.addEventListener('change', () => save('from')); fb.addEventListener('change', () => save('to'));
      return h('div', { class: 'sgrid' }, dayBtns(c), h('div', { class: 'inline', style: { flexWrap: 'nowrap' } }, fa, '–', fb),
        first ? ib('addTime', '+ Other class times: a line for days with different hours (for example Tuesday and Thursday 10am–2pm)', () => change(() => { p.school.classes.push({ days: [], from: c.from, to: c.to }); }))
          : ib('trash', 'Remove these class times', () => change(() => { p.school.classes = p.school.classes.filter((x) => x !== c); }), { cls: 'danger' }));
    };
    const rows = people.flatMap((p) => {
      const sc = p.school, on = !!sc && sc.on !== false;
      const box = h('input', { type: 'checkbox', checked: on, 'aria-label': `${p.name} is in school`, title: on ? 'Untick if they are not in school now (what you set is kept)' : 'Tick if they go to school: then set the term and class times',
        onchange: (e) => change(() => { if (e.target.checked) { p.school = sc ? { ...sc, on: true } : { on: true, name: '', from: '', to: '', classes: [{ days: [0, 1, 2, 3, 4], from: 480, to: 900 }], note: '' }; if (!p.school.classes.length) p.school.classes.push({ days: [0, 1, 2, 3, 4], from: 480, to: 900 }); } else if (sc) sc.on = false; }) });
      const main = [h('td', { class: 'nowrap' }, h('b', null, p.name)), h('td', { class: 'small nowrap' }, ROLES[p.role].label), h('td', { class: 'c' }, box)];
      if (!on) return [h('tr', { style: { opacity: p.active ? 1 : 0.55 } }, ...main, h('td', { colspan: cols - 3, class: 'muted small' }, sc ? `Not in school now (kept: ${[sc.name, schoolText(sc)].filter(Boolean).join(' · ')})` : ''))];
      const txt = (key, ph, label, w) => { const x = h('input', { class: 'input', value: sc[key] || '', placeholder: ph, 'aria-label': label, maxLength: key === 'note' ? 300 : 80, style: { width: '100%', minWidth: w } }); x.addEventListener('change', () => change(() => { sc[key] = x.value.trim(); })); return x; };
      const date = (key, label) => { const x = h('input', { class: 'input', type: 'date', value: sc[key] || '', 'aria-label': label, title: label + ' (leave blank if you don’t know)' }); x.addEventListener('change', () => change(() => { sc[key] = x.value || ''; if (sc.from && sc.to && sc.to < sc.from) sc.to = sc.from; })); return x; };
      const today = iso(new Date()), now = (!sc.from || sc.from <= today) && (!sc.to || today <= sc.to);
      const [c0, ...more] = sc.classes;
      return [
        h('tr', { class: more.length ? 'has-sub' : '', style: { opacity: p.active ? 1 : 0.55 } }, ...main,
          h('td', null, txt('name', 'e.g. Central High · grade 11', 'School', '150px')),
          h('td', { class: 'nowrap' }, h('div', { class: 'inline', style: { flexWrap: 'nowrap' } }, date('from', 'First day of the term'), '–', date('to', 'Last day of the term')),
            h('div', { class: 'small ' + (now ? 'good' : 'muted'), style: { marginTop: '2px' } }, now ? 'In term now' : sc.to && sc.to < today ? 'Term over (classes not counted)' : 'Term not started yet')),
          h('td', null, c0 ? classLine(p, c0, true) : null),
          h('td', null, txt('note', 'e.g. exams in June · summer: any time', 'Note', '140px'))),
        ...more.map((c) => h('tr', { class: 'subrow', style: { opacity: p.active ? 1 : 0.55 } }, h('td', { colspan: 5, class: 'small' }, h('span', { class: 'sub-arrow' }, '↳ '), 'Other class times'), h('td', null, classLine(p, c, false)), h('td')))];
    });
    const inSchool = people.filter((p) => p.school && p.school.on !== false).length;
    return { head, rows, empty: 'No one yet. Add your team on the Weekdays tab.', foot: h('tr', null, h('td', { colspan: cols, class: 'small muted', style: { fontWeight: 400 } }, `${inSchool} of ${people.length} in school. During the term, class times count as hours they can't work: a shift over them gets the ! mark. Before the first day or after the last day, they don't count.`)) };
  }
