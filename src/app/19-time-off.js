  // ---------- Time off ----------
  // Days, weeks or a few hours off, with a reason, whether it is asked for or approved, and a note. Kept on the person
  // (p.timeOff), so it goes with team files, the location file and your account like everything else about them:
  //   { id, from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', hours: null (all day) | [start, end] (minutes, each day in the range),
  //     why: TIME_OFF_WHY key, status: 'requested' | 'approved' | 'denied', note, added: 'YYYY-MM-DD' }
  // Requested and approved time off count when checking the schedule (a shift on it gets the N/A mark); denied is kept
  // only as a record. (TIME_OFF_WHY and TIME_OFF_STATUS are in 01-basics.js: loading a plan checks them first.)
  let timeOffShow = 'upcoming';
  const timeOffOn = (p, d) => (p.timeOff || []).filter((t) => t.status !== 'denied' && d >= t.from && d <= t.to);
  const timeOffDays = (t) => Math.round((parseIso(t.to) - parseIso(t.from)) / 864e5) + 1;
  const timeOffWhen = (t) => {
    const y = (s) => parseIso(s).getFullYear(), yr = y(t.from) !== new Date().getFullYear() || y(t.to) !== y(t.from) ? `, ${y(t.to)}` : '';
    const dates = t.from === t.to ? `${dayName(t.from, 'short')} ${shortDate(t.from)}${yr}` : `${dayName(t.from, 'short')} ${shortDate(t.from)} – ${dayName(t.to, 'short')} ${shortDate(t.to)}${yr}`;
    return dates + (t.hours ? `, ${clock(t.hours[0])} – ${clock(t.hours[1])}` : '');
  };
  const timeOffLabel = (t) => `${TIME_OFF_WHY[t.why] || 'Time off'}${t.status === 'requested' ? ' (requested)' : ''}`;
  // the reason a shift (or, with no shift, the whole day) clashes with time off; '' when it does not
  function timeOffIssue(p, d, s) {
    const first = p.name.split(' ')[0];
    for (const t of timeOffOn(p, d)) {
      if (!t.hours) return `${first} has time off on ${dayName(d)} ${shortDate(d)}: ${timeOffLabel(t)}${t.note ? ' – ' + t.note : ''}`;
      if (s && s.start < t.hours[1] && s.end > t.hours[0]) return `${first} has time off ${clock(t.hours[0])} – ${clock(t.hours[1])} on ${dayName(d)} ${shortDate(d)}: ${timeOffLabel(t)}${t.note ? ' – ' + t.note : ''}`;
    }
    return '';
  }
  const offAllDay = (p, d) => timeOffOn(p, d).some((t) => !t.hours);
  // shifts already on the schedule inside a stretch of time off
  const timeOffClashes = (p, t) => Object.keys(plan.shifts).filter((d) => d >= t.from && d <= t.to).flatMap((d) => plan.shifts[d].filter((s) => s.staffId === p.id && (!t.hours || (s.start < t.hours[1] && s.end > t.hours[0]))).map((s) => ({ d, s })));

  function timeOffDialog(p, t) {
    const today = iso(new Date()), cur = t || { from: today, to: today, hours: null, why: 'vacation', status: 'approved', note: '' };
    let who = p ? p.id : (sortStaff(plan.staff.filter((x) => !x.left))[0] || {}).id;
    const people = sortStaff(plan.staff.filter((x) => !x.left || (p && x.id === p.id)));
    const whoSel = h('select', { class: 'input', disabled: !!t, onchange: (e) => { who = e.target.value; sync(); } }, people.map((x) => h('option', { value: x.id, selected: x.id === who }, `${x.name} (${ROLES[x.role].short})`)));
    const from = h('input', { class: 'input', type: 'date', value: cur.from }), to = h('input', { class: 'input', type: 'date', value: cur.to });
    const allDay = h('input', { type: 'checkbox', checked: !cur.hours });
    const ta = timePicker(cur.hours ? cur.hours[0] : 540, 'Off from'), tb = timePicker(cur.hours ? cur.hours[1] : 780, 'Off until');
    const hoursRow = h('div', { class: 'inline', style: { flexWrap: 'nowrap' } }, ta, '–', tb);
    const why = h('select', { class: 'input' }, Object.entries(TIME_OFF_WHY).map(([k, l]) => h('option', { value: k, selected: k === cur.why }, l)));
    let status = cur.status;
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Status' }, Object.entries(TIME_OFF_STATUS).map(([k, l]) => h('button', { type: 'button', class: 'btn', 'aria-pressed': String(status === k), onclick: (e) => { status = k; seg.querySelectorAll('.btn').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); sync(); } }, l)));
    const note = h('input', { class: 'input', value: cur.note || '', placeholder: 'Optional, e.g. family wedding out of town; covered by Sam', maxLength: 300 });
    const drop = h('input', { type: 'checkbox', checked: true }), dropLbl = h('span'), info = h('p', { class: 'hint', style: { margin: 0 } });
    const read = () => ({ from: from.value, to: to.value < from.value ? from.value : to.value, hours: allDay.checked ? null : [ta.value, tb.value] });
    const sync = () => {
      hoursRow.style.display = allDay.checked ? 'none' : '';
      if (to.value && from.value && to.value < from.value) to.value = from.value;
      const x = read(), person = staffById(who); if (!person || !x.from) return;
      const n = status === 'denied' ? 0 : timeOffClashes(person, x).length;
      dropLbl.textContent = n ? ` Take ${person.name.split(' ')[0]} off ${n} shift${n === 1 ? '' : 's'} already scheduled in this time` : ' No shifts scheduled in this time';
      drop.disabled = !n;
      const days = timeOffDays(x);
      info.textContent = `${days} day${days === 1 ? '' : 's'}${x.hours ? `, ${clock(x.hours[0])} – ${clock(x.hours[1])} each day` : ', all day'}.`;
    };
    [from, to].forEach((e) => e.addEventListener('input', sync)); allDay.addEventListener('change', sync);
    [ta, tb].forEach((tp) => tp.addEventListener('change', sync));
    sync();
    const actions = [{ label: 'Cancel' }];
    if (t) actions.unshift({ label: 'Delete', danger: true, left: true, onClick: () => { change(() => { p.timeOff = p.timeOff.filter((x) => x.id !== t.id); if (!p.timeOff.length) delete p.timeOff; }); toast('Time off deleted. You can undo this.', { label: 'Undo', fn: undo }); } });
    actions.push({ label: t ? 'Save' : 'Add time off', primary: true, onClick: () => {
      const person = staffById(who); if (!person) return;
      const x = read(); if (!x.from) { toast('Pick the first day off.'); return false; }
      if (x.hours && x.hours[1] <= x.hours[0]) { toast('The time off must end after it starts.'); return false; }
      const entry = { id: t ? t.id : uid(), ...x, why: why.value, status, note: note.value.trim(), added: t ? t.added : iso(new Date()) };
      const clash = !drop.disabled && drop.checked ? timeOffClashes(person, entry) : [];
      change(() => {
        person.timeOff = (person.timeOff || []).filter((y) => y.id !== entry.id).concat(entry).sort((a, b) => a.from.localeCompare(b.from));
        clash.forEach(({ d, s }) => { plan.shifts[d] = plan.shifts[d].filter((y) => y.id !== s.id); });
      });
      toast(`${person.name}: ${timeOffLabel(entry)}, ${timeOffWhen(entry)}${clash.length ? ` · taken off ${clash.length} shift${clash.length === 1 ? '' : 's'}` : ''}.`);
    } });
    modal({ title: t ? `Time off · ${p.name}` : 'Add time off', body: [
      h('label', { class: 'field' }, h('span', null, 'Who'), whoSel),
      h('div', { class: 'inline' }, h('label', { class: 'field' }, h('span', null, 'First day off'), from), h('label', { class: 'field' }, h('span', null, 'Last day off'), to)),
      h('label', { class: 'check' }, allDay, ' All day (untick for just a few hours)'), hoursRow, info,
      h('label', { class: 'field' }, h('span', null, 'Reason'), why),
      h('div', { class: 'field' }, h('span', null, 'Status'), seg),
      h('label', { class: 'field' }, h('span', null, 'Note'), note),
      h('label', { class: 'check' }, drop, dropLbl),
      h('p', { class: 'hint' }, 'Requested and approved time off shows on the schedule: a shift on it gets the N/A mark, and the person shows as away under Unscheduled. Denied is kept only as a record.')],
      actions });
  }

  // the Staff › Time off section: everyone's time off in date order
  function timeOffRows() {
    const today = iso(new Date());
    const all = plan.staff.filter((p) => !p.left).flatMap((p) => (p.timeOff || []).map((t) => ({ p, t })))
      .filter(({ t }) => timeOffShow === 'all' || (timeOffShow === 'past' ? t.to < today : t.to >= today))
      .sort((a, b) => (timeOffShow === 'past' ? b.t.from.localeCompare(a.t.from) : a.t.from.localeCompare(b.t.from)) || a.p.name.localeCompare(b.p.name));
    const head = ['Name', 'Role', 'When', 'Days', 'Reason', 'Status', 'Note', ''];
    const rows = all.map(({ p, t }) => h('tr', { style: { opacity: t.status === 'denied' ? 0.55 : 1 } },
      h('td', null, h('b', null, p.name)), h('td', null, ROLES[p.role].label),
      h('td', { class: 'nowrap' }, timeOffWhen(t), t.from <= today && t.to >= today ? h('span', { class: 'small', style: { marginLeft: '6px', fontWeight: 700 } }, 'now') : null),
      h('td', { class: 'num' }, t.hours ? `${timeOffDays(t)} × ${hrs((t.hours[1] - t.hours[0]) / 60)} h` : timeOffDays(t)),
      h('td', null, TIME_OFF_WHY[t.why] || t.why), h('td', { class: t.status === 'requested' ? 'warn' : '' }, TIME_OFF_STATUS[t.status] || t.status),
      h('td', { class: 'small' }, t.note || ''),
      h('td', { class: 'nowrap' }, t.status === 'requested' ? [h('button', { class: 'btn sm primary', title: 'Approve this time off', onclick: () => change(() => { t.status = 'approved'; }) }, 'Approve'), ' ',
        h('button', { class: 'btn sm', title: 'Deny it (kept as a record)', onclick: () => change(() => { t.status = 'denied'; }) }, 'Deny'), ' '] : null,
        h('button', { class: 'btn sm', onclick: () => timeOffDialog(p, t) }, 'Edit…'))));
    const show = h('div', { class: 'seg', role: 'group', 'aria-label': 'Which time off' }, [['upcoming', 'Now and coming up'], ['past', 'Past'], ['all', 'All']].map(([k, l]) => h('button', { type: 'button', class: 'btn sm', 'aria-pressed': String(timeOffShow === k), onclick: () => { timeOffShow = k; render(); } }, l)));
    const foot = h('tr', null, h('td', { colspan: head.length }, h('div', { class: 'inline' }, h('button', { class: 'btn primary', disabled: !plan.staff.some((p) => !p.left), onclick: () => timeOffDialog(null) }, '+ Add time off'), h('span', { class: 'spacer' }), show)));
    const asked = plan.staff.reduce((n, p) => n + (p.left ? 0 : (p.timeOff || []).filter((t) => t.status === 'requested' && t.to >= today).length), 0);
    return { head, rows, foot, empty: timeOffShow === 'past' ? 'No past time off.' : 'No time off coming up. Add it with + Add time off, or Time off… on a person.', asked };
  }
