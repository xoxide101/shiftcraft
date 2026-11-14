  // ---------- Split shifts: more than one shift for a person on a day ----------
  // A person can work more than one shift on a day: a split shift (7am–11am and 4pm–9pm) or a second shift later on.
  // Each part is its own shift in plan.shifts[d], so the schedule, the week view, the hand-off list, the hours and every
  // printout already list them all. Only parts that overlap are a problem (Check schedule says so).
  const othersToday = (d, s) => shiftsOf(staffById(s.staffId), d).filter((x) => x.id !== s.id);
  const spanShort = (s) => `${clock(s.start, true)}–${clock(s.end, true)}`;
  const overlaps = (a, b) => a.start < b.end && b.start < a.end;

  // Split one shift into two with a break in between (the break is taken out of the shift).
  function splitShiftDialog(d, id) {
    const s = shiftsOn(d).find((x) => x.id === id); if (!s) return;
    const p = staffById(s.staffId);
    if (s.end - s.start < 3 * STEP) { toast('The shift is too short to split. Use Add another shift on this day instead.'); return; }
    const mid = snap((s.start + s.end) / 2), half = Math.min(60, snap((s.end - s.start) / 4));
    const a = timePicker(Math.max(s.start + STEP, mid - half), 'Break from'), b = timePicker(Math.min(s.end - STEP, mid + half), 'Break until');
    const info = h('p', { class: 'hint' });
    const upd = () => {
      const ok = a.value > s.start && b.value < s.end && b.value > a.value;
      info.className = ok ? 'hint' : 'hint bad';
      info.textContent = ok ? `${p.name.split(' ')[0]} works ${clock(s.start)} – ${clock(a.value)} (${hrs((a.value - s.start) / 60)} h) and ${clock(b.value)} – ${clock(s.end)} (${hrs((s.end - b.value) / 60)} h), ${hrs((s.end - s.start - (b.value - a.value)) / 60)} h in all.`
        : `The break must be inside the shift (${clock(s.start)} – ${clock(s.end)}) and end after it starts.`;
    };
    [a, b].forEach((x) => x.addEventListener('change', upd)); upd();
    modal({ title: `Split shift · ${p.name} · ${dayName(d)}`, body: [
      h('p', { class: 'muted' }, `Now ${clock(s.start)} – ${clock(s.end)} (${hrs(len(s))} h). Pick the break: the shift becomes two parts.`),
      h('div', { class: 'inline' }, h('label', { class: 'field' }, h('span', null, 'Break from'), a), h('label', { class: 'field' }, h('span', null, 'Break until'), b)),
      info,
      h('p', { class: 'hint' }, 'Each part can then be moved, stretched or removed on its own. The note stays on the first part.')],
    actions: [{ label: 'Cancel' }, { label: 'Split', primary: true, onClick: () => {
      if (!(a.value > s.start && b.value < s.end && b.value > a.value)) { upd(); return false; }
      const end = s.end, brk = [a.value, b.value];
      change(() => { s.end = brk[0]; plan.shifts[d].push({ id: uid(), staffId: s.staffId, start: brk[1], end }); });
      toast(`${p.name}: ${clock(s.start)} – ${clock(brk[0])} and ${clock(brk[1])} – ${clock(end)}`, { label: 'Undo', fn: undo });
    } }] });
  }

  // Add another shift for a person who may already work on that day (or pick the times for a first one).
  function anotherShiftDialog(d, staffId) {
    const p = staffById(staffId); if (!p) return;
    const mine = shiftsOf(p, d), st = setFor(p, d);
    let start = mine.length ? Math.max(...mine.map((x) => x.end)) + 120 : st.start, end = mine.length ? start + 240 : st.end;
    if (start > DAY_END - 60) { start = Math.max(DAY_START, Math.min(...mine.map((x) => x.start)) - 300); end = start + 240; }
    const t = clampShift({ start: snap(start), end: snap(end) });
    const a = timePicker(t.start, 'Start'), b = timePicker(t.end, 'Finish');
    const info = h('p', { class: 'hint' });
    const clash = () => mine.find((x) => overlaps(x, { start: a.value, end: b.value }));
    const upd = () => {
      const c = clash(), n = (b.value - a.value) / 60, bad = n <= 0 || !!c;
      info.className = bad ? 'hint bad' : 'hint';
      info.textContent = n <= 0 ? 'The finish must be after the start.' : c ? `That overlaps ${p.name.split(' ')[0]}'s shift ${clock(c.start)} – ${clock(c.end)}.`
        : `${hrs(n)} hours${mine.length ? `; ${hrs(mine.reduce((x, y) => x + len(y), 0) + n)} h on ${dayName(d)} in all` : ''}.`;
    };
    [a, b].forEach((x) => x.addEventListener('change', upd)); upd();
    const note = h('input', { class: 'input', placeholder: 'Optional, e.g. back for the dinner rush', maxLength: 500 });
    modal({ title: `${mine.length ? 'Another shift' : 'Add a shift'} · ${p.name} · ${dayName(d)} ${shortDate(d)}`, body: [
      mine.length ? h('p', { class: 'muted' }, `Already working ${mine.map((x) => `${clock(x.start)} – ${clock(x.end)}`).join(' and ')}.`) : null,
      h('div', { class: 'inline' }, h('label', { class: 'field' }, h('span', null, 'Start'), a), h('label', { class: 'field' }, h('span', null, 'Finish'), b)),
      info,
      h('label', { class: 'field' }, h('span', null, 'Note'), note)],
    actions: [{ label: 'Cancel' }, { label: 'Add shift', primary: true, onClick: () => {
      if (b.value <= a.value || clash()) { upd(); return false; }
      const s = clampShift({ id: uid(), staffId, start: a.value, end: b.value });
      if (note.value.trim()) s.note = note.value.trim();
      change(() => { (plan.shifts[d] = plan.shifts[d] || []).push(s); });
      const issue = availIssue(p, d, s);
      toast(issue ? `Added ${p.name}, ${clock(s.start)} – ${clock(s.end)}. Heads up: ${issue}.` : `Added ${p.name}, ${clock(s.start)} – ${clock(s.end)}`, { label: 'Undo', fn: undo });
    } }] });
  }

  // A day off request from the schedule: the time off window, set to Requested for that day.
  const dayOffRequest = (p, d) => timeOffDialog(p, null, { from: d, to: d, status: 'requested', why: 'personal' });

  // A small right-click menu (used for the names under Unscheduled; shifts have their own in shiftMenu).
  function popMenu(x, y, head, items) {
    document.querySelector('.ctx-menu')?.remove();
    const close = () => { menu.remove(); document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', key, true); window.removeEventListener('blur', close); };
    const menu = h('div', { class: 'ctx-menu', role: 'menu' }, h('div', { class: 'ctx-head' }, head),
      items.map(([label, fn, cls]) => h('button', { type: 'button', role: 'menuitem', class: cls || '', onclick: () => { close(); fn(); } }, label)));
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
