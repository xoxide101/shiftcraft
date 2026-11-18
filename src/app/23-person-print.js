  // ===================================================================
  // Printed schedule for one person or a group
  // ===================================================================
  function printPeopleDialog(presetId) {
    const o = { paper: 'letter', orient: 'landscape', format: 'pdf', dpi: 300, ...(() => { try { return JSON.parse(localStorage.getItem(KEY + '-people-pr')) || {}; } catch (e) { return {}; } })() };
    let pw = null; const changed = () => pw && pw.refresh();
    const who = h('select', { class: 'input', onchange: changed },
      h('optgroup', { label: 'Groups' }, h('option', { value: 'all' }, 'Everyone (one page each)'), GROUPS.map(([g]) => h('option', { value: 'g:' + g }, `All ${PLURAL[g]}`))),
      h('optgroup', { label: 'One person' }, sortStaff(plan.staff.filter((p) => !p.left)).map((p) => h('option', { value: 'p:' + p.id, selected: p.id === presetId }, `${p.name} (${ROLES[p.role].short})`))));
    const range = h('select', { class: 'input', onchange: changed }, h('option', { value: 'week' }, `This week (week ${weekOf(ui.day) + 1})`), h('option', { value: 'all' }, `All ${plan.weeks} weeks`));
    const tasks = h('input', { type: 'checkbox', checked: true, onchange: changed });
    const onlyScheduled = h('input', { type: 'checkbox', checked: true, onchange: changed });
    const weeksOf = () => (range.value === 'week' ? [weekOf(ui.day)] : Array.from({ length: plan.weeks }, (_, k) => k));
    const peopleOf = () => { const weeks = weeksOf(); let people = who.value === 'all' ? plan.staff : who.value.startsWith('g:') ? plan.staff.filter((p) => ROLES[p.role].group === who.value.slice(2)) : plan.staff.filter((p) => 'p:' + p.id === who.value);
      if (!who.value.startsWith('p:') && onlyScheduled.checked) people = people.filter((p) => weeks.some((w) => onPaper(() => personWeekHours(p.id, w))()));
      return sortStaff(people); };
    const sheets = () => peopleOf().map((p) => personSheet(p, weeksOf(), tasks.checked));
    const keep = () => { try { localStorage.setItem(KEY + '-people-pr', JSON.stringify(o)); } catch (e) { /* blocked */ } };
    pw = printWindow({ title: 'Print or save a schedule for a person or group', use: 'person', kind: 'person', reopen: () => printPeopleDialog(presetId), opts: [
      h('label', { class: 'field' }, h('span', null, 'Who'), who),
      h('label', { class: 'field' }, h('span', null, 'Weeks'), range),
      h('label', { class: 'check' }, tasks, ' Include tasks and training'),
      h('label', { class: 'check' }, onlyScheduled, ' Skip people with no shifts in these weeks (groups only)'),
      ...paperChoices(o, changed), ...saveChoices(o, changed),
      h('p', { class: 'hint' }, 'Each person gets their own page.')],
    draw: (pv) => { const list = sheets(); if (!list.length) { pv.replaceChildren(h('p', { class: 'hint' }, 'Nobody to print for those weeks.')); return 'Nobody'; } const [w, hgt] = paperOf(o), n = pvDom(pv, list, { pw: w, ph: hgt }); return `${list.length} ${list.length === 1 ? 'person' : 'people'} · ${PAPERS[o.paper][2]} ${o.orient} · ${n} page${n > 1 ? 's' : ''}`; },
    actions: [{ label: 'Cancel' },
      { label: 'Print…', onClick: () => { const people = peopleOf(); if (!people.length) { toast('Nobody to print for those weeks.'); return false; } keep(); const [w, hgt] = paperOf(o); if (deco.border) { printDomPictures(sheets(), o, w, hgt); return; } setPrintPage(w, hgt); printPeople(people, weeksOf(), tasks.checked); } },
      { label: 'Save', primary: true, onClick: () => { const list = sheets(); if (!list.length) { toast('Nobody to save for those weeks.'); return false; } keep(); const [w, hgt] = paperOf(o), one = who.value.startsWith('p:') ? staffById(who.value.slice(2)) : null;
        savePrintout({ name: fileStem(one ? one.name : 'schedules', ...weeksOf().length === 1 ? [fileDate(weekDays(weeksOf()[0])[0])] : []), pw: w, ph: hgt, o, svgs: (k) => domPageSvgs(list, { pw: w, ph: hgt }, k) }); } }] });
  }
  // on paper: a closed day has nobody on it (onPaper, 04-calculations.js)
  const printPeople = onPaper(printPeopleBody);
  function printPeopleBody(people, weeks, withTasks) {
    if (blockedHere()) return;
    const area = $('#print-area');
    area.replaceChildren(...people.map((p) => personSheet(p, weeks, withTasks)));
    document.body.classList.add('print-people');
    const done = () => { document.body.classList.remove('print-people'); area.replaceChildren(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 60);
  }
  // on paper: a closed day has nobody on it (onPaper, 04-calculations.js)
  const personSheet = onPaper(personSheetBody);
  function personSheetBody(p, weeks, withTasks) {
    const days = weeks.flatMap((w) => weekDays(w));
    const total = weeks.reduce((t, w) => t + personWeekHours(p.id, w), 0);
    const rows = [];
    weeks.forEach((w) => {
      weekDays(w).forEach((d) => {
        const ss = shiftsOf(p, d);
        const tk = withTasks ? tasksOn(p, d) : [];
        (ss.length ? ss : [null]).forEach((s, j) => rows.push(h('tr', { class: s ? '' : 'off' }, h('td', null, j ? '' : dayName(d)), h('td', null, j ? '' : usDate(d)),
          h('td', null, s ? clock(s.start) : 'Off'), h('td', null, s ? clock(s.end) : ''), h('td', { class: 'num' }, s ? hrs(len(s)) : ''),
          h('td', { class: 'small' }, [s && s.note ? 'Note: ' + s.note : null, ...(j ? [] : tk.map((t) => (t.done ? '☑ ' : '☐ ') + t.text))].filter(Boolean).join('\n')))));
      });
      if (weeks.length > 1) rows.push(h('tr', { class: 'wk' }, h('td', { colspan: 4 }, `Week ${w + 1} total`), h('td', { class: 'num' }, hrs(personWeekHours(p.id, w))), h('td', null, '')));
    });
    const anytime = withTasks ? tasksOf(p).filter((t) => !t.date || !days.includes(t.date)) : [];
    return h('section', { class: 'person-sheet' },
      h('div', { class: 'ps-head' }, h('div', null, h('div', { class: 'ps-place' }, [plan.company, plan.location].filter(Boolean).join(' – ')), placeLine() ? h('div', { class: 'small' }, placeLine()) : null, h('h1', null, p.name), h('div', null, ROLES[p.role].label)),
        h('div', { class: 'ps-range' }, `${longDate(days[0])}`, h('br'), `to ${longDate(days[days.length - 1])}`)),
      h('table', { class: 't' },
        h('thead', null, h('tr', null, ['Day', 'Date', 'Start', 'Finish', 'Hours', withTasks ? 'Notes, tasks and training' : 'Notes'].map((x, i) => h('th', { class: i === 4 ? 'num' : '' }, x)))),
        h('tbody', null, rows),
        h('tfoot', null, h('tr', null, h('td', { colspan: 4 }, 'Total hours'), h('td', { class: 'num' }, hrs(total)), h('td', null, p.maxHours ? `Max ${p.maxHours} h per week` : '')))),
      anytime.length ? h('div', { class: 'ps-tasks' }, h('h2', null, 'Other tasks and training'), h('ul', null, anytime.map((t) => h('li', null, `${t.done ? '☑' : '☐'} ${t.text}${t.date ? ` (${usDate(t.date)})` : ''}`)))) : null,
      h('div', { class: 'ps-sign' }, h('span', null, 'Notes'), h('div', { class: 'ps-lines' })));
  }

