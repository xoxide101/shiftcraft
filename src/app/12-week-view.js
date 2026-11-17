  // ---------- Week overview ----------
  function weekView(main) {
    const w = weekOf(ui.day), days = weekDays(w);
    const weeks = h('div', { class: 'weeks no-print' }, Array.from({ length: plan.weeks }, (_, k) => h('button', { class: 'btn sm', 'aria-pressed': String(k === w), onclick: () => { ui.day = weekDays(k)[0]; persist(); render(); } }, `Week ${k + 1}`)));
    const staff = sortStaff(plan.staff.filter((p) => p.active || days.some((d) => shiftsOn(d).some((s) => s.staffId === p.id))));
    let lastGroup = null;
    const rows = [];
    staff.forEach((p) => {
      const g = ROLES[p.role].group;
      if (g !== lastGroup) { rows.push(h('tr', { class: 'grp' }, h('td', { colspan: 9 }, GROUPS.find((x) => x[0] === g)[1]))); lastGroup = g; }
      const total = personWeekHours(p.id, w);
      const over = p.maxHours && total > p.maxHours;
      rows.push(h('tr', null, h('td', null, h('b', null, p.name), h('span', { class: 'muted small' }, ` ${ROLES[p.role].short}`)),
        days.map((d) => { const ss = shiftsOf(p, d), s = ss[0], iss = ss.map((x) => availIssue(p, d, x)).filter(Boolean)[0] || (s ? '' : availIssue(p, d, null)); return h('td', { class: 'cellbtn c' + (s && iss ? ' bad' : !s && (offOn(p, d) || offAllDay(p, d)) ? ' muted' : ''), title: [iss, ...ss.filter((x) => x.note).map((x) => 'Note: ' + x.note), 'Open this day'].filter(Boolean).join('\n'), onclick: () => { ui.day = d; ui.tab = 'schedule'; persist(); render(); } }, s ? ss.map((x, j) => [j ? h('br') : null, `${clock(x.start, true)}–${clock(x.end, true)}${availIssue(p, d, x) ? ' !' : ''}`, x.note ? h('div', { class: 'cell-note' }, x.note) : null]) : offAllDay(p, d) ? 'off: ' + (TIME_OFF_WHY[timeOffOn(p, d).find((t) => !t.hours).why] || 'time off').toLowerCase() : offOn(p, d) ? 'n/a' : timeOffOn(p, d).length ? 'off ' + timeOffOn(p, d).map((t) => `${clock(t.hours[0], true)}–${clock(t.hours[1], true)}`).join(', ') : ''); }),
        h('td', { class: 'num ' + (over ? 'bad' : '') }, hrs(total), over ? ` (max ${p.maxHours})` : '')));
    });
    const foot = (label, fn, cls) => h('tr', null, h('td', null, label), days.map((d) => { const v = fn(d); return h('td', { class: 'num ' + (cls ? cls(d) : '') }, v); }), h('td', null, ''));
    main.append(h('div', { class: 'card' },
      h('div', { class: 'daynav' }, h('h1', { style: { textAlign: 'left', minWidth: 0 } }, `${placeName()} · Week ${w + 1}: ${shortDate(days[0])} – ${shortDate(days[6])}`), h('span', { class: 'spacer' }), weeks,
        h('button', { class: 'btn sm no-print', onclick: () => copyWeekDialog(w) }, 'Copy week to…'),
        h('button', { class: 'btn sm no-print', onclick: checkDialog }, 'Check schedule…'),
        h('button', { class: 'btn sm no-print', onclick: () => printPageDialog() }, 'Print…')),
      h('div', { class: 'table-wrap', style: { marginTop: '12px' } }, h('table', { class: 't' },
        h('thead', null, h('tr', null, h('th', null, 'Name'), days.map((d) => h('th', { class: 'c' }, `${dayName(d, 'short')} ${parseIso(d).getDate()}`, calMark(d))), h('th', { class: 'num' }, 'Hours'))),
        h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: 9, class: 'muted' }, 'No staff yet.'))),
        h('tfoot', null,
          foot('Scheduled hours', (d) => hrs(dayHours(d))),
          foot('Forecast', (d) => money(forecastOf(d))),
          foot('Target hours', (d) => (targetHours(d) == null ? '—' : hrs(targetHours(d)))),
          foot('Hours variance', (d) => (varianceHours(d) == null ? '—' : signed(varianceHours(d))), (d) => varClass(varianceHours(d))))))));
  }
  function copyWeekDialog(w) {
    const others = Array.from({ length: plan.weeks }, (_, k) => k).filter((k) => k !== w);
    if (!others.length) { toast('Set the plan to 2 or more weeks in Settings first.'); return; }
    const boxes = others.map((k) => ({ k, el: h('input', { type: 'checkbox', checked: k === w + 1 }) }));
    modal({ title: `Copy week ${w + 1} to…`, body: [h('p', { class: 'hint' }, 'Each chosen week is replaced, day by day. You can undo this.'), boxes.map((b) => h('label', { class: 'check' }, b.el, ` Week ${b.k + 1} (${shortDate(weekDays(b.k)[0])})`))],
      actions: [{ label: 'Cancel' }, { label: 'Copy', primary: true, onClick: () => {
        const ks = boxes.filter((b) => b.el.checked).map((b) => b.k); if (!ks.length) return false;
        change(() => ks.forEach((k) => weekDays(k).forEach((d, i) => { plan.shifts[d] = shiftsOn(weekDays(w)[i]).map((s) => ({ ...s, id: uid() })); })));
        toast('Week copied');
      } }] });
  }

