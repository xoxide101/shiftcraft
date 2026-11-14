  // ---------- Schedule (day timeline) ----------
  function scheduleView(main) {
    const d = ui.day;
    const days = planDays(), i = days.indexOf(d);
    main.append(summary(d));
    main.append(h('div', { class: 'card' },
      h('div', { class: 'daynav' },
        h('div', { class: 'inline' },
          h('button', { class: 'btn icon', 'aria-label': 'Previous day', disabled: i <= 0, onclick: () => { ui.day = days[i - 1]; persist(); render(); } }, '‹'),
          h('button', { class: 'btn icon', 'aria-label': 'Next day', disabled: i >= days.length - 1, onclick: () => { ui.day = days[i + 1]; persist(); render(); } }, '›')),
        h('h1', null, longDate(d)),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn sm', onclick: () => copyDayDialog(d) }, 'Copy day to…'),
        h('button', { class: 'btn sm', title: 'Copy this whole week onto other weeks', onclick: () => copyWeekDialog(weekOf(d)) }, 'Copy week to…'),
        h('button', { class: 'btn sm', disabled: !shiftsOn(d).length, onclick: () => confirmBox(`Clear ${dayName(d)}?`, 'Everyone on this day goes back to Unscheduled. You can undo this.', 'Clear day', () => change(() => { plan.shifts[d] = []; })) }, 'Clear day'),
        h('button', { class: 'btn sm', disabled: !weekDays(weekOf(d)).some((x) => shiftsOn(x).length), onclick: () => clearRange('week') }, 'Clear week')),
      h('div', { style: { marginTop: '12px', display: 'grid', gap: '8px' } }, dayPicker())));

    const wrap = h('div', { class: 'tl-wrap' });
    main.append(wrap);
    const labelW = 150;
    const cs = getComputedStyle(main);
    const avail = Math.max(600, main.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - labelW - 4);
    const hourW = Math.max(52, Math.floor(avail / ((DAY_END - DAY_START) / 60)));
    const pxPerMin = hourW / 60;
    const lanesW = (DAY_END - DAY_START) * pxPerMin;
    const tl = h('div', { class: 'tl' });
    tl.style.setProperty('--label-w', labelW + 'px'); tl.style.setProperty('--lanes-w', lanesW + 'px'); tl.style.setProperty('--hour-w', hourW + 'px'); tl.style.setProperty('--q-w', hourW / 4 + 'px');
    wrap.append(tl);
    const hoursRow = h('div', { class: 'hours' });
    for (let m = DAY_START; m < DAY_END; m += 60) hoursRow.append(h('span', { style: { left: (m - DAY_START) * pxPerMin + 'px' } }, hourLabel(m)));
    tl.append(h('div', { class: 'tl-row tl-head' }, h('div', { class: 'tl-label' }, 'Job group'), hoursRow));

    const week = weekOf(d);
    GROUPS.forEach(([g, label, sub]) => {
      const shifts = shiftsOn(d).filter((s) => ROLES[staffById(s.staffId).role].group === g).sort((a, b) => a.start - b.start || a.end - b.end);
      // Stack overlapping shifts into lanes.
      const laneEnds = [];
      shifts.forEach((s) => { let l = laneEnds.findIndex((e) => e <= s.start); if (l < 0) { l = laneEnds.length; laneEnds.push(0); } laneEnds[l] = s.end; s._lane = l; });
      // A lane with a note on any of its shifts is one line taller, so the note fits under the bar.
      const laneTop = [], laneH = laneEnds.map((_, l) => 32 + (shifts.some((s) => s._lane === l && s.note) ? 22 : 0));
      laneH.reduce((t, hh, l) => { laneTop[l] = t; return t + hh; }, 0);
      const lanes = h('div', { class: 'lanes', style: { height: Math.max(32, laneH.reduce((a, b) => a + b, 0)) + 8 + 'px' } });
      const hoursG = shifts.reduce((t, s) => t + len(s), 0);
      shifts.forEach((s) => {
        const p = staffById(s.staffId);
        const over = p.maxHours && personWeekHours(p.id, week) > p.maxHours;
        const tk = tasksOn(p, d);
        const bar = h('div', { class: 'shift ' + g, title: `${p.name} (${ROLES[p.role].label})\n${span(s)} · ${hrs(len(s))} h · ${hrs(weekSoFar(p.id, d))} h this week so far${tk.length ? '\nTasks: ' + tk.map((t) => (t.done ? '✓ ' : '') + t.text).join('; ') : ''}\nDrag to move, drag an edge to change start or finish.\nClick for notes, double-click to edit, right-click for more.${over ? `\nOver ${p.maxHours} h this week!` : ''}`,
          style: { left: (s.start - DAY_START) * pxPerMin + 'px', width: (s.end - s.start) * pxPerMin + 'px', top: laneTop[s._lane] + 5 + 'px' } },
          h('span', { class: 'edge l' }), over ? h('span', { class: 'w' }, '!') : null, availIssue(p, d, s) ? h('span', { class: 'w na' }, 'N/A') : null,
          h('b', null, p.name), h('span', null, `(${ROLES[p.role].label})`), h('span', { class: 't' }, `${clock(s.start, true)}–${clock(s.end, true)}`),
          tk.length ? h('span', { class: 'tk' }, `${tk.length} task${tk.length > 1 ? 's' : ''}`) : null, s.note ? h('span', { class: 'tk nt' }, 'Note') : null,
          h('span', { class: 'edge r' }));
        if (availIssue(p, d, s)) bar.title = availIssue(p, d, s) + '\n' + bar.title;
        if (s.note) bar.title = 'Note: ' + s.note + '\n' + bar.title;
        attachDrag(bar, s, d, pxPerMin);
        lanes.append(bar);
        if (s.note) {
          const note = h('div', { class: 'shift-note', title: s.note + '\n(click to edit the note)', onclick: () => noteDialog(d, s.id),
            style: { left: (s.start - DAY_START) * pxPerMin + 8 + 'px', width: Math.max(40, (s.end - s.start) * pxPerMin - 16) + 'px', top: laneTop[s._lane] + 5 + 27 + 'px' } },
            h('b', null, 'NOTES: '), s.note);
          bar._note = note;
          lanes.append(note);
        }
      });
      tl.append(h('div', { class: 'tl-row' }, h('div', { class: 'tl-label' }, label, h('small', null, `${shifts.length} · ${hrs(hoursG)} h`)), lanes));
    });

    const scheduled = new Set(shiftsOn(d).map((s) => s.staffId));
    const free = sortStaff(plan.staff.filter((p) => p.active && !scheduled.has(p.id)));
    main.append(h('div', { class: 'card' },
      h('div', { class: 'inline' }, h('h2', { style: { margin: 0 } }, 'Unscheduled'), h('span', { class: 'muted small' }, 'Click a name to add them with their usual shift.')),
      free.length ? h('div', { class: 'unsched' }, free.map((p) => {
        const wh = personWeekHours(p.id, week);
        return h('button', { class: 'chip' + (offOn(p, d) ? ' na' : ''), title: (offOn(p, d) ? availIssue(p, d) + '\n' : '') + (setFor(p, d).parts.length < 3 ? `Works ${setFor(p, d).parts.map((x) => x.toUpperCase()).join(' / ')}\n` : '') + (setFor(p, d).from != null ? `Available ${clock(setFor(p, d).from)} – ${clock(setFor(p, d).to)}\n` : '') + `Usual ${isWkend(d) ? 'weekend' : 'weekday'} shift ${clock(setFor(p, d).start)} – ${clock(setFor(p, d).end)} · ${hrs(wh)} h this week${p.notes ? '\n' + p.notes : ''}`, onclick: () => addShift(d, p.id) },
          `${p.name} `, h('small', null, `(${ROLES[p.role].label}) · ${hrs(wh)} h`));
      })) : h('p', { class: 'hint', style: { padding: '10px 0 0' } }, plan.staff.length ? 'Everyone is scheduled.' : 'No staff yet. Add people on the Staff tab.'),
      h('div', { class: 'legend no-print', style: { marginTop: '8px' } }, 'Tips: drag a shift to move it · drag its left or right edge to change start or finish (15-minute steps) · click for notes · double-click to type exact times · right-click to edit, add notes or remove · Ctrl+Z undoes')));
    main.append(hoursPanel(d));
  }

  // Drag to move, drag edges to resize; click removes, double-click edits.
  let lastClick = { id: null, t: 0 }, clickTimer = null;
  function attachDrag(bar, s, d, pxPerMin) {
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const mode = e.target.classList.contains('l') ? 'l' : e.target.classList.contains('r') ? 'r' : 'm';
      const sx = e.clientX, o = { start: s.start, end: s.end };
      let moved = false, tip = null;
      bar.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const dm = snap((ev.clientX - sx) / pxPerMin);
        if (!moved && Math.abs(ev.clientX - sx) < 4) return;
        moved = true; bar.classList.add('dragging');
        let ns = o.start, ne = o.end;
        if (mode === 'm') { const l = o.end - o.start; ns = Math.max(DAY_START, Math.min(DAY_END - l, o.start + dm)); ne = ns + l; }
        if (mode === 'l') ns = Math.max(DAY_START, Math.min(o.end - STEP, o.start + dm));
        if (mode === 'r') ne = Math.min(DAY_END, Math.max(o.start + STEP, o.end + dm));
        bar.style.left = (ns - DAY_START) * pxPerMin + 'px'; bar.style.width = (ne - ns) * pxPerMin + 'px';
        if (bar._note) { bar._note.style.left = (ns - DAY_START) * pxPerMin + 8 + 'px'; bar._note.style.width = Math.max(40, (ne - ns) * pxPerMin - 16) + 'px'; }
        bar.querySelector('.t').textContent = `${clock(ns, true)}–${clock(ne, true)}`;
        bar._next = { start: ns, end: ne };
        if (!tip) { tip = h('div', { class: 'drag-tip' }); document.body.append(tip); }
        tip.textContent = `${clock(ns)} – ${clock(ne)} · ${hrs((ne - ns) / 60)} h`;
        tip.style.left = ev.clientX + 12 + 'px'; tip.style.top = ev.clientY - 34 + 'px';
      };
      const up = () => {
        bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up);
        tip && tip.remove();
        if (moved) {
          const n = bar._next;
          if (n && (n.start !== s.start || n.end !== s.end)) change(() => { s.start = n.start; s.end = n.end; });
          else render();
          return;
        }
        // A click: wait briefly to see if it becomes a double-click.
        const now = Date.now();
        if (lastClick.id === s.id && now - lastClick.t < 320) { clearTimeout(clickTimer); lastClick = { id: null, t: 0 }; editShift(d, s.id); return; }
        lastClick = { id: s.id, t: now };
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { lastClick = { id: null, t: 0 }; noteDialog(d, s.id); }, 330);
      };
      bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
    });
    bar.addEventListener('keydown', (e) => { if (e.key === 'Enter') editShift(d, s.id); if (e.key === 'Delete') removeShift(d, s.id); });
    bar.addEventListener('contextmenu', (e) => { e.preventDefault(); clearTimeout(clickTimer); lastClick = { id: null, t: 0 }; shiftMenu(e.clientX, e.clientY, d, s.id); });
    bar.tabIndex = 0;
  }

  function copyDayDialog(from) {
    const boxes = planDays().filter((d) => d !== from).map((d) => ({ d, el: h('input', { type: 'checkbox', checked: dayName(d) === dayName(from) && weekOf(d) === weekOf(from) + 1 }) }));
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '6px' } },
      boxes.map((b) => h('label', { class: 'check' }, b.el, ` ${dayName(b.d, 'short')} ${shortDate(b.d)}${shiftsOn(b.d).length ? ' •' : ''}`)));
    modal({ title: `Copy ${dayName(from)} ${shortDate(from)} to…`, wide: true, body: [h('p', { class: 'hint' }, 'The chosen days are replaced with a copy of this day. Days marked • already have shifts. You can undo this.'), grid,
      h('div', { class: 'inline' }, h('button', { class: 'btn sm', onclick: () => boxes.forEach((b) => { b.el.checked = dayName(b.d) === dayName(from); }) }, `Every ${dayName(from)}`), h('button', { class: 'btn sm', onclick: () => boxes.forEach((b) => { b.el.checked = false; }) }, 'None'))],
    actions: [{ label: 'Cancel' }, { label: 'Copy', primary: true, onClick: () => {
      const targets = boxes.filter((b) => b.el.checked).map((b) => b.d);
      if (!targets.length) return false;
      change(() => targets.forEach((t) => { plan.shifts[t] = shiftsOn(from).map((s) => ({ ...s, id: uid() })); }));
      toast(`Copied to ${targets.length} day${targets.length === 1 ? '' : 's'}`);
    } }] });
  }

