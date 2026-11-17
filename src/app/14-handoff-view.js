  // ---------- Hand-off (for typing into the real scheduler) ----------
  function handoffView(main) {
    const d = ui.day;
    const days = planDays(), i = days.indexOf(d);
    const list = shiftsOn(d).map((s) => ({ s, p: staffById(s.staffId) }))
      .sort((a, b) => GROUPS.findIndex((g) => g[0] === ROLES[a.p.role].group) - GROUPS.findIndex((g) => g[0] === ROLES[b.p.role].group) || a.s.start - b.s.start || a.p.name.localeCompare(b.p.name));
    const text = [`${placeName()} · ${longDate(d)}`, ''].concat(GROUPS.flatMap(([g, label]) => {
      const rows = list.filter((x) => ROLES[x.p.role].group === g);
      return rows.length ? [label.toUpperCase(), ...rows.map((x) => `  ${`${x.p.empId ? x.p.empId + ' ' : ''}${x.p.name}${x.p.shiftCode ? ' [' + x.p.shiftCode + ']' : ''}`.padEnd(24)} ${clock(x.s.start).padStart(8)} - ${clock(x.s.end).padStart(8)}  (${hrs(len(x.s))} h)`), ''] : [];
    })).concat([`Total ${hrs(dayHours(d))} h · forecast ${money(forecastOf(d))}`]).join('\n');
    main.append(h('div', { class: 'card' },
      h('div', { class: 'daynav' },
        h('div', { class: 'inline no-print' },
          h('button', { class: 'btn icon', 'aria-label': 'Previous day', disabled: i <= 0, onclick: () => { ui.day = days[i - 1]; persist(); render(); } }, '‹'),
          h('button', { class: 'btn icon', 'aria-label': 'Next day', disabled: i >= days.length - 1, onclick: () => { ui.day = days[i + 1]; persist(); render(); } }, '›')),
        h('h1', null, longDate(d)), h('span', { class: 'spacer' }),
        h('button', { class: 'btn sm no-print', onclick: () => navigator.clipboard.writeText(text).then(() => toast('Copied')).catch(() => toast('Copy was blocked. Select the text below instead.')) }, 'Copy as text'),
        h('button', { class: 'btn sm no-print', onclick: () => printPageDialog() }, 'Print…')),
      h('p', { class: 'hint no-print', style: { margin: '6px 0 12px' } }, 'Keep this next to the real scheduler and enter each shift in order. Tick them off as you go.'),
      h('div', { class: 'table-wrap' }, h('table', { class: 't' },
        h('thead', null, h('tr', null, h('th', { class: 'no-print' }, '✓'), h('th', null, 'Job group'), h('th', null, 'Name'), h('th', null, 'Role'), h('th', null, 'Start'), h('th', null, 'Finish'), h('th', { class: 'num' }, 'Hours'))),
        h('tbody', null, list.length ? list.map((x) => h('tr', null, h('td', { class: 'no-print c' }, h('input', { type: 'checkbox', 'aria-label': 'Entered ' + x.p.name })),
          h('td', null, GROUPS.find((g) => g[0] === ROLES[x.p.role].group)[1]), h('td', null, h('b', null, x.p.name), x.p.empId || x.p.shiftCode ? h('div', { class: 'small muted' }, [x.p.empId ? 'ID ' + x.p.empId : '', x.p.shiftCode ? 'Shift code ' + x.p.shiftCode : ''].filter(Boolean).join(' · ')) : null, tasksOn(x.p, d).length ? h('div', { class: 'small muted' }, 'Tasks: ' + tasksOn(x.p, d).map((t) => t.text).join('; ')) : null, x.s.note ? h('div', { class: 'small' }, h('b', null, 'Note: '), x.s.note) : null), h('td', null, ROLES[x.p.role].label),
          h('td', null, clock(x.s.start)), h('td', null, clock(x.s.end)), h('td', { class: 'num' }, hrs(len(x.s))))) : h('tr', null, h('td', { colspan: 7, class: 'muted' }, 'Nobody is scheduled on this day.'))),
        h('tfoot', null, h('tr', null, h('td', { class: 'no-print' }, ''), h('td', { colspan: 5 }, `Total · forecast ${money(forecastOf(d))} · target ${targetHours(d) == null ? '—' : hrs(targetHours(d))} h`), h('td', { class: 'num' }, hrs(dayHours(d)))))))),
      h('details', { class: 'card no-print' }, h('summary', null, 'Plain text version'), h('pre', { class: 'handoff-text' }, text)));
  }

