  // ===================================================================
  // Shift actions
  // ===================================================================
  function addShift(d, staffId) {
    const p = staffById(staffId);
    change(() => {
      const st = setFor(p, d);
      (plan.shifts[d] = plan.shifts[d] || []).push(clampShift({ id: uid(), staffId, start: st.start, end: st.end }));
    });
    const added = plan.shifts[d][plan.shifts[d].length - 1], issue = availIssue(p, d, added);
    toast(issue ? `Added ${p.name}. Heads up: ${issue}.` : `Added ${p.name}, ${clock(added.start)} – ${clock(added.end)}`);
  }
  function removeShift(d, id) {
    const s = shiftsOn(d).find((x) => x.id === id); if (!s) return;
    const p = staffById(s.staffId);
    change(() => { plan.shifts[d] = plan.shifts[d].filter((x) => x.id !== id); });
    toast(`Removed ${p.name} from ${dayName(d)}`, { label: 'Undo', fn: undo });
  }
  function editShift(d, id) {
    const s = shiftsOn(d).find((x) => x.id === id); if (!s) return;
    const p = staffById(s.staffId);
    const a = timePicker(s.start, 'Start'), b = timePicker(s.end, 'End');
    const info = h('p', { class: 'hint' });
    const upd = () => { const n = (b.value - a.value) / 60; info.textContent = n > 0 ? `${hrs(n)} hours` : 'The end must be after the start.'; info.className = n > 0 ? 'hint' : 'hint bad'; };
    a.addEventListener('change', upd); b.addEventListener('change', upd); upd();
    const saveDefault = h('input', { type: 'checkbox' });
    const note = h('textarea', { class: 'input', rows: 3, placeholder: 'e.g. Leave at 2 for school pickup · Train on register', 'aria-label': 'Notes for this day' }, s.note || '');
    modal({ title: `${p.name} · ${dayName(d)}`, body: [
      h('p', { class: 'muted' }, ROLES[p.role].label, othersToday(d, s).length ? ` · also working ${othersToday(d, s).map((x) => `${clock(x.start)} – ${clock(x.end)}`).join(' and ')} today (a split shift)` : ''),
      h('label', { class: 'field' }, h('span', null, 'Start'), a),
      h('label', { class: 'field' }, h('span', null, 'Finish'), b),
      info,
      h('label', { class: 'check' }, saveDefault, ` Make this ${p.name.split(' ')[0]}'s usual ${isWkend(d) ? 'weekend' : 'weekday'} shift`),
      h('label', { class: 'field' }, h('span', null, `Notes for ${p.name.split(' ')[0]} on ${dayName(d)}`), note),
      h('p', { class: 'hint' }, 'The day runs from 4:00am to 11:00pm in 15-minute steps.')],
    actions: [
      { label: 'Remove from schedule', left: true, onClick: () => removeShift(d, id) },
      { label: 'Cancel' },
      { label: 'Save', primary: true, onClick: () => {
        if (b.value <= a.value) { upd(); return false; }
        change(() => {
          Object.assign(s, clampShift({ start: a.value, end: b.value }));
          if (note.value.trim()) s.note = note.value.trim(); else delete s.note;
          if (saveDefault.checked) setSet(p, isWkend(d) ? 'we' : 'wk', { start: s.start, end: s.end });
        });
      } }] });
  }
  // Click on a shift: notes for that person on that day.
  function noteDialog(d, id) {
    const s = shiftsOn(d).find((x) => x.id === id); if (!s) return;
    const p = staffById(s.staffId);
    const note = h('textarea', { class: 'input', rows: 4, placeholder: 'e.g. Leave at 2 for school pickup · Train on register · Covering for Sam', 'aria-label': 'Note' }, s.note || '');
    const tk = tasksOn(p, d);
    modal({ title: `Notes · ${p.name} · ${dayName(d)} ${shortDate(d)}`, body: [
      h('p', { class: 'muted' }, `${ROLES[p.role].label} · ${clock(s.start)} – ${clock(s.end)} (${hrs(len(s))} h)`),
      note,
      tk.length ? h('p', { class: 'hint' }, 'Tasks today: ' + tk.map((t) => (t.done ? '✓ ' : '') + t.text).join('; ')) : null,
      h('p', { class: 'hint' }, 'Notes show on the schedule, the hand-off list and printouts. Right-click a shift for more options.')],
    actions: [
      s.note ? { label: 'Delete note', left: true, onClick: () => change(() => { delete s.note; }) } : null,
      { label: 'Cancel' },
      { label: 'Save note', primary: true, onClick: () => change(() => { if (note.value.trim()) s.note = note.value.trim(); else delete s.note; }) },
    ].filter(Boolean) });
  }
  // Right-click on a shift: a small menu.
  function shiftMenu(x, y, d, id) {
    document.querySelector('.ctx-menu')?.remove();
    const s = shiftsOn(d).find((v) => v.id === id); if (!s) return;
    const p = staffById(s.staffId);
    const close = () => { menu.remove(); document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', key, true); window.removeEventListener('blur', close); };
    const item = (label, fn, cls) => h('button', { type: 'button', role: 'menuitem', class: cls || '', onclick: () => { close(); fn(); } }, label);
    const menu = h('div', { class: 'ctx-menu', role: 'menu' },
      h('div', { class: 'ctx-head' }, `${p.name} · ${clock(s.start)}–${clock(s.end)}`),
      item('Edit shift…', () => editShift(d, id)),
      item(s.note ? 'Edit note…' : 'Add a note…', () => noteDialog(d, id)),
      item('Split into two (a break in the middle)…', () => splitShiftDialog(d, id)),
      item(`Add another shift for ${p.name.split(' ')[0]} today…`, () => anotherShiftDialog(d, p.id)),
      item('Day off request…', () => dayOffRequest(p, d)),
      item('Not available some hours (appointment)…', () => dayOffRequest(p, d, [s.start, Math.min(s.end, s.start + 120)])),
      item('Tasks and training…', () => tasksDialog(p)),
      item('Remove from schedule', () => removeShift(d, id), 'danger'));
    document.body.append(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
    const outside = (e) => { if (!menu.contains(e.target)) close(); };
    const key = (e) => {
      const b = [...menu.querySelectorAll('button')], i = b.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); b[(i + 1) % b.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); b[(i - 1 + b.length) % b.length].focus(); }
    };
    setTimeout(() => { document.addEventListener('mousedown', outside, true); document.addEventListener('keydown', key, true); window.addEventListener('blur', close); menu.querySelector('button').focus(); }, 0);
  }

