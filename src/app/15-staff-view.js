  // ---------- Staff ----------
  let staffTab = 'avail';
  try { staffTab = localStorage.getItem('shiftcraft-staff-tab') || 'avail'; } catch (e) {}
  // a day-by-day cell as lines: the hours (each stretch its own line) and what they can’t do
  const avCellLines = (p, i, a, noSchool) => {
    const out = [];
    if (a && a.k === 'times') {
      const r = a.r || [], plus = r.filter((x) => x[2] !== '-'), minus = r.filter((x) => x[2] === '-');
      if (!plus.length) out.push('Any');
      plus.forEach((x) => out.push(`${endWord(x[0])}–${endWord(x[1])}`));
      minus.forEach((x) => out.push(`not ${endWord(x[0])}–${endWord(x[1])}`));
    } else out.push(avText(a));
    // school class times, only when the person's School Count tick is on (then they are hours they can't work)
    const sc = p.school, today = iso(new Date());
    if (!noSchool && !(a && a.k === 'off') && sc && sc.on !== false && sc.count && Array.isArray(sc.classes) && (!sc.from || sc.from <= today) && (!sc.to || today <= sc.to))
      sc.classes.filter((c) => Array.isArray(c.days) && c.days.includes(i) && c.to > c.from).forEach((c) => out.push(`school ${clockShort(c.from)}–${clockShort(c.to)}`));
    return [...new Set(out)].map((t) => h('span', { class: 'avline' }, t));
  };
  function staffView(main) {
    const roleSel = (v, on) => h('select', { class: 'input', onchange: (e) => on(e.target.value) }, Object.entries(ROLES).map(([k, r]) => h('option', { value: k, selected: k === v }, `${r.label} (${r.short})`)));
    const shiftCount = (id) => Object.values(plan.shifts).reduce((n, list) => n + list.filter((s) => s.staffId === id).length, 0);
    const SECTIONS = [['avail', '1 · Availability', 'When each person can work, Monday to Sunday: Any time, hours (two stretches for a split day), OFF, Call first; Validated; pending training'], ['wk', '2 · Weekday shift', 'Monday to Friday: the usual shift (what they get when you click their name)'], ['we', '3 · Weekend shift', 'Saturday and Sunday: the usual shift'], ['contact', '4 · Contact & training', 'Email, phone number, notes, and the positions each person is trained in'], ['timeoff', '5 · Time off', 'Days, weeks or a few hours off: reason, requested or approved, notes'], ['school', '6 · School', 'Who is in school: the school, the term and the class times (hours they can’t work)']];
    const nameCell = (p) => { const name = h('input', { class: 'input', value: p.name, 'aria-label': 'Name', style: { width: '100%' } }); name.addEventListener('change', () => { if (name.value.trim()) change(() => { p.name = name.value.trim(); }); }); return h('td', { style: { minWidth: '170px' } }, name); };
    const roleCell = (p) => h('td', null, roleSel(p.role, (v) => change(() => { p.role = v; })));
    const actions = (p) => { const soon = (p.timeOff || []).some((t) => t.to >= iso(new Date()) && t.status !== 'denied'); return h('td', { class: 'nowrap' }, ibs(
      ib('tasks', `Tasks and training${openTasks(p) ? ` (${openTasks(p)} open)` : ''}`, () => tasksDialog(p), { badge: openTasks(p) }),
      ib('timeoff', `Time off: days, weeks or a few hours off, with a reason and notes${soon ? ' (has time off now or coming up)' : ''}`, () => timeOffDialog(p), { badge: soon }),
      ib('print', 'Print this person’s schedule', () => printPeopleDialog(p.id)),
      ib('qr', `Contact QR code: scan to add ${p.name} to a phone’s contacts (print, save or put in the barcode library)`, () => contactQrDialog(p)),
      ib('left', 'Left… (resigned, terminated or left): they come off the schedule and lists, and everything about them is kept under Former staff', () => leftDialog(p)),
      ib('trash', `Remove ${p.name}`, () => {
        const n = shiftCount(p.id);
        confirmBox(`Remove ${p.name}?`, n ? `${p.name} has ${n} shift${n === 1 ? '' : 's'} in this plan. They will be removed too. You can undo this.` : 'You can undo this.', 'Remove', () => change(() => {
          plan.staff = plan.staff.filter((x) => x.id !== p.id);
          Object.keys(plan.shifts).forEach((d) => { plan.shifts[d] = plan.shifts[d].filter((s) => s.staffId !== p.id); });
        }));
      }, { cls: 'danger' }))); };
    // Weekdays or weekend: usual shift, available hours, parts of the day, days off
    const scheduleCells = (p, k) => {
      const st = setOf(p, k);
      const a = timePicker(st.start, 'Usual start'), b = timePicker(st.end, 'Usual finish');
      const saveTimes = () => { if (b.value > a.value) change(() => setSet(p, k, { start: Math.max(DAY_START, a.value), end: Math.min(DAY_END, b.value) })); else toast('The usual finish must be after the start.'); };
      a.addEventListener('change', saveTimes); b.addEventListener('change', saveTimes);
      const dayIdx = k === 'we' ? [5, 6] : [0, 1, 2, 3, 4];
      // one cell, lined up in three columns (label | hours | button): the usual shift on top, then the hours they can work
      // (greyed while Any time is ticked). These two lines stay; + adds Some days lines under the person, and only those can go.
      return [
        h('td', null, h('div', { class: 'inline', style: { flexWrap: 'nowrap' }, title: `The usual ${k === 'we' ? 'weekend' : 'weekday'} shift: what they get when you click their name under People today` }, a, '–', b)),
        // their availability those days (the same as the Availability tab): click a day to set it
        h('td', null, h('div', { class: 'daytoggles', role: 'group', 'aria-label': 'Availability' }, dayIdx.map((i) => {
          const a = avOf(p, i), c = avClass(a), wd = WEEKDAYS[i];
          return h('button', { type: 'button', class: 'dt av-' + c, title: `${wd}: ${avText(a)}. Click to set this day; right-click for quick choices.`,
            onclick: () => availEditor(p, i), oncontextmenu: (e) => { e.preventDefault(); avMenu(p, i, e.clientX, e.clientY); } }, k === 'we' ? wd.slice(0, 3) : wd[0]);
        }))),
      ];
    };
    // hours on some days (split shifts): each line is its own sub-row under the person, lined up with the columns above:
    // the hours under "Hours they can work" and the days under the day buttons, so nothing in the person's row moves
    const lineRows = (p, k, cols) => {
      const dayIdx = k === 'we' ? [5, 6] : [0, 1, 2, 3, 4];
      const mine = (p.lines || []).filter((l) => (l.tab || (l.days.some((x) => x >= 5) ? 'we' : 'wk')) === k);
      return mine.map((l, j) => {
        const l2 = l;
        const fa = timePicker(l.from, 'From'), fb = timePicker(l.to, 'Until');
        const save = (moved) => { let f = fa.value, t = fb.value; if (t <= f) { if (moved === 'from') t = Math.min(DAY_END, f + 60); else f = Math.max(DAY_START, t - 60); } change(() => { l.from = f; l.to = t; }); };
        fa.addEventListener('change', () => save('from')); fb.addEventListener('change', () => save('to'));
        const days = l.days.filter((i) => dayIdx.includes(i)).map((i) => WEEKDAYS[i].slice(0, 3));
        return h('tr', { class: 'subrow', style: { opacity: p.active ? 1 : 0.55 }, title: `${p.name}: on the days picked, ${lineMode(l) === '=' ? 'only these hours' : lineMode(l) === '-' ? 'not these hours' : 'these hours as well as the hours above'} (+ adds, = only, − not)` },
          h('td', { colspan: 2, class: 'small' }, h('span', { class: 'sub-arrow' }, '↳ '), `Some days ${mine.length > 1 ? j + 1 : ''}`, h('span', { class: 'muted' }, days.length ? ` · ${days.join(', ')}` : ' · pick the days →')),
          h('td', null, h('div', { class: 'hgrid' }, h('span', { class: 'small hlabel' }, days.length ? days.join(', ') : 'Some days'), h('div', { class: 'inline', style: { flexWrap: 'nowrap' } },
            // + add / = only / - not: how this line works with the hours above
            h('div', { class: 'seg line-mode', role: 'group', 'aria-label': 'How these hours count' }, [['+', '+', 'Add: these hours as well as the hours above'], ['=', '=', 'Only: on these days just these hours (and any other + lines), not the hours above'], ['-', '−', 'Not: they can’t work these hours on these days']].map(([m, l, t]) =>
              h('button', { type: 'button', class: 'btn sm', title: t, 'aria-pressed': String(lineMode(l2) === m), onclick: () => change(() => { if (m === '+') delete l2.mode; else l2.mode = m; }) }, l))), fa, '–', fb),
            ib('trash', 'Remove this line (take these hours away)', () => change(() => { p.lines = p.lines.filter((x) => x !== l); if (!p.lines.length) delete p.lines; }), { cls: 'danger' }))),
          h('td'),
          h('td', null, h('div', { class: 'daytoggles', role: 'group', 'aria-label': 'Days for these hours' }, dayIdx.map((i) => { const on = l.days.includes(i), wd = WEEKDAYS[i];
            return h('button', { type: 'button', class: 'dt use' + (on ? ' on' : ''), 'aria-pressed': String(on), title: `${on ? 'Uses' : 'Does not use'} these hours on ${wd}s (click to change)`, onclick: () => change(() => { l.days = on ? l.days.filter((x) => x !== i) : [...l.days, i].sort(); }) }, k === 'we' ? wd.slice(0, 3) : wd[0]); }))),
          h('td', { colspan: cols - 5 }));
      });
    };
    // a Day by day cell: Any or Off as a word; hours one range per line (7am–11am over 4pm–9pm for a split day),
    // can't-work hours as "not …", and class times while the term is on (from the School tab, not saved into the day)
    let head, rows, foot = null, empty = null, asked = 0;
    const people = sortStaff(plan.staff.filter((p) => !p.left));
    if (staffTab === 'timeoff') {
      ({ head, rows, foot, empty, asked } = timeOffRows());
    } else if (staffTab === 'school') {
      ({ head, rows, foot, empty } = schoolRows());
    } else if (staffTab === 'avail') {
      head = ['Name', 'Role', 'Phone', ...WEEKDAYS.map((w) => w.slice(0, 3)), 'Validated', 'Pending training', ''];
      rows = people.map((p) => h('tr', { style: { opacity: p.active ? 1 : 0.55 } }, nameCell(p), roleCell(p), h('td', { style: { minWidth: '130px' } }, (() => { const ph = h('input', { class: 'input' + (p.phone ? '' : ' need'), type: 'tel', value: p.phone || '', placeholder: 'Phone needed', 'aria-label': 'Phone number for ' + p.name, title: 'Phone numbers are listed on the availability list', style: { width: '100%' } }); ph.addEventListener('change', () => change(() => { p.phone = ph.value.trim(); })); return ph; })()),
        WEEKDAYS.map((w, i) => { const a = avOf(p, i); return h('td', { class: 'c', style: { padding: '2px' } }, h('button', { type: 'button', class: 'avcell ' + avClass(a) + (a && (a.k === 'times' || a.k === 'note') ? ' tm' : ''), title: `${w}: ${avText(a)}. Click to set this day; right-click for quick choices.`, onclick: () => availEditor(p, i), oncontextmenu: (e) => { e.preventDefault(); avMenu(p, i, e.clientX, e.clientY); } }, avCellLines(p, i, a))); }),
        h('td', { class: 'c' }, h('input', { type: 'checkbox', checked: !!p.validated, 'aria-label': 'Validated', title: p.validatedOn ? 'Validated ' + p.validatedOn : 'Tick when the person has checked their availability', onchange: (e) => change(() => { p.validated = e.target.checked; p.validatedOn = e.target.checked ? new Date().toISOString().slice(0, 10) : null; }) })),
        h('td', { class: 'c' }, h('input', { type: 'checkbox', checked: !!p.pending, 'aria-label': 'Pending training', onchange: (e) => change(() => { p.pending = e.target.checked; }) })),
        h('td', { class: 'nowrap' }, ibs(ib('clear', `Any time, all week (start ${p.name.split(' ')[0]} over)`, () => confirmBox(`${p.name}: any time, all week?`, 'Every day goes back to Any time. You can undo this.', 'Any time all week', () => change(() => { p.av2 = true; p.avail = WEEKDAYS.map(() => ({ k: 'any' })); })))))));
    } else if (staffTab === 'contact') {
      // their IDs and notes first, then how to reach them (phone, email, address) together
      head = ['Name', 'Role', 'Employee ID', 'Shift code', 'Notes', 'Phone number', 'Email', ...(addrInUse() ? ['Home address'] : []), ''];
      rows = people.map((p) => {
        const email = h('input', { class: 'input', type: 'email', value: p.email || '', placeholder: 'name@example.com', 'aria-label': 'Email', style: { width: '100%' } });
        email.addEventListener('change', () => change(() => { p.email = email.value.trim(); }));
        const idBox = (key, label, ph) => { const x = h('input', { class: 'input', value: p[key] || '', placeholder: ph, 'aria-label': label, maxLength: 40, style: { width: '100%' } }); x.addEventListener('change', () => change(() => { const v = x.value.trim(); if (v) p[key] = v; else delete p[key]; })); return h('td', { style: { minWidth: '100px' } }, x); };
        const notes = h('input', { class: 'input', value: p.notes || '', placeholder: 'e.g. school until June', 'aria-label': 'Notes', style: { width: '100%' } });
        notes.addEventListener('change', () => change(() => { p.notes = notes.value; }));
        const phone = h('input', { class: 'input', type: 'tel', value: p.phone || '', placeholder: '(555) 010-0100', 'aria-label': 'Phone number', style: { width: '100%' } });
        phone.addEventListener('change', () => change(() => { p.phone = phone.value.trim(); }));
        const addr = h('input', { class: 'input', value: p.address || '', placeholder: 'Street, city, state ZIP', 'aria-label': 'Home address', maxLength: 160, style: { width: '100%' } });
        addr.addEventListener('change', () => change(() => { const v = addr.value.replace(/\s+/g, ' ').trim(); if (v) p.address = v; else delete p.address; }));
        return h('tr', { style: { opacity: p.active ? 1 : 0.55 } }, nameCell(p), roleCell(p), idBox('empId', 'Employee ID', 'e.g. 10234'), idBox('shiftCode', 'Shift code', 'e.g. TM-07'),
          h('td', { style: { minWidth: '160px' } }, notes),
          h('td', { class: 'ct-first', style: { minWidth: '180px' } }, h('div', { class: 'inline', style: { flexWrap: 'nowrap' } }, phone, p.phone ? h('a', { class: 'btn sm', href: 'tel:' + p.phone.replace(/[^\d+]/g, ''), title: 'Call' }, '☎') : null)),
          h('td', { style: { minWidth: '220px' } }, h('div', { class: 'inline', style: { flexWrap: 'nowrap' } }, email, p.email ? h('a', { class: 'btn sm', href: 'mailto:' + p.email, title: 'Write an email' }, '✉') : null)),
          addrInUse() ? h('td', { style: { minWidth: '240px' } }, addr) : null,
          actions(p));
      });
    } else {
      const k = staffTab;
      head = ['Name', 'Role', `Usual ${k === 'we' ? 'weekend' : 'weekday'} shift`, 'Availability (click a day)', ...(k === 'wk' ? ['Max h/wk', 'Active'] : []), ''];
      rows = people.flatMap((p) => {
        const extra = [];
        if (k === 'wk') {
          const max = h('input', { class: 'input', type: 'number', min: 0, max: 80, value: p.maxHours || '', style: { width: '70px' }, 'aria-label': 'Max hours per week (the whole week)' });
          max.addEventListener('change', () => change(() => { p.maxHours = +max.value || 0; }));
          extra.push(h('td', null, max), h('td', { class: 'c' }, h('input', { type: 'checkbox', checked: p.active, 'aria-label': 'Active', onchange: (e) => change(() => { p.active = e.target.checked; }) })));
        }
        const subs = [];
        return [h('tr', { class: subs.length ? 'has-sub' : '', style: { opacity: p.active ? 1 : 0.55 } }, nameCell(p), roleCell(p), ...scheduleCells(p, k), ...extra, actions(p)), ...subs];
      });
    }
    const newName = h('input', { class: 'input', placeholder: 'Full name', 'aria-label': 'New person name', style: { width: '100%' } });
    let newRole = 'TM';
    const addPerson = () => {
      const n = newName.value.trim(); if (!n) { newName.focus(); return; }
      const defaults = { GM: [360, 900], AGM: [600, 1140], SM: [480, 1020], TM: [600, 960], NH: [600, 900] }[newRole];
      change(() => { plan.staff.push({ id: uid(), name: n, role: newRole, active: true, defStart: defaults[0], defEnd: defaults[1], maxHours: ['TM', 'NH'].includes(newRole) ? 32 : 45, notes: '', tasks: [], av2: true, avail: WEEKDAYS.map(() => ({ k: 'any' })) }); });
      setTimeout(() => { const i = $('input[aria-label="New person name"]'); i && i.focus(); });
    };
    newName.addEventListener('keydown', (e) => { if (e.key === 'Enter') addPerson(); });
    const today0 = iso(new Date()), waiting = plan.staff.reduce((n, p) => n + (p.left ? 0 : (p.timeOff || []).filter((t) => t.status === 'requested' && t.to >= today0).length), 0);
    const counts = Object.keys(ROLES).map((k) => `${plan.staff.filter((p) => p.role === k && p.active).length} ${ROLES[k].short}`).join(' · ');
    const hint = { wk: 'Monday to Friday: the usual shift, what a person gets when you click their name under People today. The days show their availability (the same as the Availability tab): click a day to set it.',
      we: 'Saturday and Sunday: the usual weekend shift, used when you add them on a Saturday or Sunday. Click a day to set their availability.',
      avail: 'When each person can work, Monday to Sunday, one box a day: Any time, Hours (add another stretch for a split day, e.g. 11am–12pm and 1:30pm–9pm), OFF, a note, or Not given; tick Call first for yellow. What you set here is what prints on the availability list and what the schedule checks. Click a day to set it; right-click for quick choices. Same Mon to Fri and Same every day copy a day across.',
      school: 'Tick In school, then the school, the term (first and last day) and the class times (+ adds a line for days with other class hours). Can’t work during class (exclusion): ticked, class times come out of their availability and a shift over them gets N/A · class; unticked, school is a note only and their availability is exactly as set on the Availability tab (for someone with hours set by hand). Unticking In school keeps what you set, for next term.',
      schoolOld: 'School as its own tab: tick In school, then the school, the term (first and last day) and the class times. It is a note about the person (In school, and when): it does not limit when they can work and gives no warnings; their hours are set on the Weekdays, Weekend and Day by day tabs. + adds a line for days with different class hours. Unticking keeps what you set, for next term.',
      timeoff: 'Time off for anyone: whole days, weeks, or just a few hours, with the reason, whether it is requested or approved, and a note. A shift on someone’s time off gets the N/A mark, and they show as away under Unscheduled. Time off… on a person adds it for them.',
      contact: 'How to reach each person, their Employee ID and Shift code (as in the company’s own system; shown on the Hand-off page), and notes about them. ✉ writes an email and ☎ calls (on a phone, or a computer set up for calls). Below: the positions each person is trained in.' }[staffTab];
    main.append(h('div', { class: 'card' },
      h('div', { class: 'daynav' }, h('h2', { style: { margin: 0 } }, `Staff list · ${plan.staff.filter((p) => !p.left).length} people`), h('span', { class: 'muted small' }, counts), h('span', { class: 'spacer' }),
        h('button', { class: 'btn sm', onclick: saveStaff }, 'Save team…'),
        h('button', { class: 'btn sm', onclick: () => openFile() }, 'Load team…'),
        h('button', { class: 'btn sm', disabled: !plan.staff.length, onclick: () => confirmBox('Clear the staff list?', 'Everyone is removed, along with all their shifts in this plan. Save the list first if you want to keep it. You can undo this.', 'Clear list', () => change(() => { plan.staff = []; plan.shifts = {}; plan.example = false; })) }, 'Clear list')),
      h('div', { class: 'tabs staff-tabs', role: 'tablist', 'aria-label': 'Staff sections' }, SECTIONS.map(([k, l, t]) => h('button', { class: 'tab', role: 'tab', 'aria-selected': String(staffTab === k), title: t, onclick: () => { staffTab = k; try { localStorage.setItem('shiftcraft-staff-tab', k); } catch (e) {} render(); } }, l, k === 'timeoff' && waiting ? h('span', { class: 'st-n' }, `${waiting} to approve`) : null))),
      h('p', { class: 'hint', style: { margin: '6px 0 12px' } }, hint),
      h('div', { class: 'table-wrap' }, h('table', { class: 't' },
        h('thead', null, h('tr', null, head.map((x) => h('th', null, x)))),
        h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: head.length, class: 'muted' }, empty || 'No one yet. Add your team below, or load a saved list.'))),
        foot ? h('tfoot', null, foot) : h('tfoot', null, h('tr', null, h('td', null, newName), h('td', null, roleSel('TM', (v) => { newRole = v; })), h('td', { colspan: head.length - 2 }, h('button', { class: 'btn primary', onclick: addPerson }, '+ Add person'))))))));
    if (staffTab === 'contact') main.append(trainedGrid());
    // people who have left: everything about them is kept here, and Rehire brings them back as they were
    const former = sortStaff(plan.staff.filter((p) => p.left));
    if (former.length) main.append(h('div', { class: 'card' },
      h('div', { class: 'daynav' }, h('h2', { style: { margin: 0 } }, `Former staff · ${former.length}`), h('span', { class: 'muted small' }, 'Kept with all their details; not on the schedule or lists.')),
      h('div', { class: 'table-wrap' }, h('table', { class: 't' },
        h('thead', null, h('tr', null, ['Name', 'Role', 'Phone', 'Email', 'Left', 'Last day', 'Note', ''].map((x) => h('th', null, x)))),
        h('tbody', null, former.map((p) => h('tr', null,
          h('td', null, h('b', null, p.name)), h('td', null, ROLES[p.role].label), h('td', { class: 'nowrap' }, p.phone || ''), h('td', null, p.email || ''),
          h('td', null, LEFT_WHY[p.left.why] || p.left.why), h('td', { class: 'nowrap' }, p.left.on ? shortDate(p.left.on) : ''), h('td', { class: 'small' }, p.left.note || ''),
          h('td', { class: 'nowrap' }, ibs(ib('edit', 'Edit the reason, date or note', () => leftDialog(p)),
            ib('rehire', 'Rehire: back on the team with everything as it was', () => change(() => { delete p.left; p.active = true; }), { cls: 'good' }),
            ib('trash', `Delete ${p.name} and their details for good`, () => confirmBox(`Delete ${p.name} for good?`, 'Their details are removed from this plan (shifts already worked are removed too). You can undo this.', 'Delete', () => change(() => { plan.staff = plan.staff.filter((x) => x !== p); Object.keys(plan.shifts).forEach((d) => { plan.shifts[d] = plan.shifts[d].filter((x) => x.staffId !== p.id); }); })), { cls: 'danger' }))))))))));
  }
  const LEFT_WHY = { resigned: 'Resigned', terminated: 'Terminated', other: 'Left' };
  // Someone leaving: why, their last day and a note; shifts after the last day can come off the schedule
  function leftDialog(p) {
    const cur = p.left || { why: 'resigned', on: iso(new Date()), note: '' };
    let why = cur.why;
    const seg = h('div', { class: 'seg', role: 'group' }, Object.entries(LEFT_WHY).map(([k, l]) => h('button', { type: 'button', class: 'btn', 'aria-pressed': String(why === k), onclick: (e) => { why = k; seg.querySelectorAll('.btn').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } }, k === 'other' ? 'Other' : l)));
    const on = h('input', { class: 'input', type: 'date', value: cur.on || iso(new Date()) });
    const note = h('input', { class: 'input', value: cur.note || '', placeholder: 'Optional, e.g. moved away; would rehire', maxLength: 300 });
    const after = () => Object.keys(plan.shifts).filter((d) => d > on.value).reduce((n, d) => n + plan.shifts[d].filter((s) => s.staffId === p.id).length, 0);
    const drop = h('input', { type: 'checkbox', checked: true }), dropLbl = h('span');
    const sync = () => { const n = after(); dropLbl.textContent = n ? ` Take them off ${n} shift${n === 1 ? '' : 's'} after their last day` : ' No shifts after their last day'; drop.disabled = !n; };
    on.addEventListener('input', sync); sync();
    modal({ title: `${p.name} has left`, body: [
      h('div', { class: 'field' }, h('span', null, 'Why'), seg),
      h('label', { class: 'field' }, h('span', null, 'Last day'), on),
      h('label', { class: 'field' }, h('span', null, 'Note'), note),
      h('label', { class: 'check' }, drop, dropLbl),
      h('p', { class: 'hint' }, 'Everything about them (phone, email, availability, training, tasks and past shifts) is kept under Former staff on the Staff tab. Rehire brings them back as they were. You can undo this.')],
      actions: [{ label: 'Cancel' }, { label: p.left ? 'Save' : 'Mark as left', primary: true, onClick: () => {
        change(() => {
          p.left = { why, on: on.value || iso(new Date()), note: note.value.trim() }; p.active = false;
          if (drop.checked && !drop.disabled) Object.keys(plan.shifts).forEach((d) => { if (d > p.left.on) plan.shifts[d] = plan.shifts[d].filter((s) => s.staffId !== p.id); });
        });
        toast(`${p.name} is under Former staff. Their details are kept.`);
      } }] });
  }
  // the colours of a day: green can work, red can't, yellow call or arrange first (marked, or a note like Emergency or
  // If you ask), black not given
  const avClass = (a) => (!a || a.k === 'unk' ? 'none' : a.k === 'off' ? 'off' : a.hl || (a.k === 'note' && /emergenc|if you ask|call|arrange/i.test(a.note || '')) ? 'hl' : 'on');
  // A day's colour, straight from the cell: a click goes green › yellow › red › black › green, a right-click picks one.
  // The hours or note are kept: red and black remember what the day was (was), so going back to green brings it back.
  const AV_STATES = [['on', 'Available (green)'], ['hl', 'Call or arrange first (yellow)'], ['off', 'Unavailable (red)'], ['none', 'Not given (black)']];
  function setAv(p, i, st) {
    change(() => {
      bakeAvail(p);
      const cur = p.avail[i] || { k: 'any' };
      let base = cur.was ? { ...cur.was } : cur.k === 'off' || cur.k === 'unk' ? { k: 'any' } : { ...cur };
      delete base.hl; delete base.was;
      if (st === 'on' && avClass(base) === 'hl') base = { k: 'any' }; // a note like If you ask is yellow by itself
      // green that is just Any (or what the settings give anyway) follows the weekday / weekend settings again, so the
      // hours and Some days lines show; green with hours of the day's own keeps them
      p.avail[i] = st === 'on' ? base : st === 'hl' ? { ...base, hl: true } : { k: st === 'off' ? 'off' : 'unk', ...(base.k !== 'any' ? { was: base } : {}) };
    });
  }
  const cycleAv = (p, i) => { const c = avClass(avOf(p, i)), k = AV_STATES.findIndex(([s]) => s === c); setAv(p, i, AV_STATES[(k + 1) % 4][0]); };
  function avMenu(p, i, x, y) {
    const c = avClass(avOf(p, i));
    popMenu(x, y, `${p.name} · ${WEEKDAYS[i]}`, [['Set the hours, Any time, OFF…', () => availEditor(p, i)], ...AV_STATES.map(([s, l]) => [l, () => setAv(p, i, s), c === s ? 'on' : ''])]);
  }
  // One day's availability: Any, Off, a note, or hours (+ adds a range they can work or can't work)
  function availEditor(p, i) {
    const cur = JSON.parse(JSON.stringify(avOf(p, i)));
    let kind = cur.k, note = cur.note || 'Mornings', ranges = cur.r && cur.r.length ? cur.r : [[setOf(p, i >= 5 ? 'we' : 'wk').start, setOf(p, i >= 5 ? 'we' : 'wk').end, '+']];
    const times = [[OPEN, 'Open'], ...Array.from({ length: (DAY_END - DAY_START) / 15 + 1 }, (_, k) => DAY_START + k * 15).map((m) => [m, clockShort(m)]), [CLOSE, 'Close']];
    const timeSel = (v, on) => h('select', { class: 'input', style: { width: 'auto' }, onchange: (e) => on(+e.target.value) }, times.map(([m, l]) => h('option', { value: m, selected: m === v }, l)));
    const box = h('div', { class: 'grid', style: { gap: '10px' } });
    const hl = h('input', { type: 'checkbox', checked: !!cur.hl });
    const draw = () => {
      box.replaceChildren(...[
        h('div', { class: 'seg', role: 'group' }, [['any', 'Any time'], ['times', 'Hours'], ['off', 'OFF'], ['note', 'A note'], ['unk', 'Not given']].map(([k, l]) => h('button', { type: 'button', class: 'btn', 'aria-pressed': String(kind === k), onclick: () => { kind = k; draw(); } }, l))),
        kind === 'note' ? h('div', { class: 'inline' }, AV_NOTES.map((n) => h('button', { type: 'button', class: 'btn sm' + (note === n ? ' primary' : ''), onclick: () => { note = n; draw(); } }, n)),
          h('input', { class: 'input', value: AV_NOTES.includes(note) ? '' : note, placeholder: 'or your own words', style: { width: '160px' }, oninput: (e) => { if (e.target.value.trim()) note = e.target.value.trim(); } })) : null,
        kind === 'times' ? h('div', { class: 'grid', style: { gap: '6px' } },
          ranges.map((r, j) => h('div', { class: 'inline' },
            h('span', { class: 'av-what' + (r[2] === '-' ? ' not' : '') }, r[2] === '-' ? 'Not' : ranges.filter((x) => x[2] !== '-').indexOf(r) ? 'And' : 'From'),
            timeSel(r[0], (v) => { r[0] = v; }), h('span', null, 'to'), timeSel(r[1], (v) => { r[1] = v; }),
            // the order they show in (on screen and printed): up or down
            h('button', { type: 'button', class: 'btn sm ghost', title: 'Move up (shows first)', 'aria-label': 'Move up', disabled: j === 0, onclick: () => { [ranges[j - 1], ranges[j]] = [ranges[j], ranges[j - 1]]; draw(); } }, '▲'),
            h('button', { type: 'button', class: 'btn sm ghost', title: 'Move down', 'aria-label': 'Move down', disabled: j === ranges.length - 1, onclick: () => { [ranges[j], ranges[j + 1]] = [ranges[j + 1], ranges[j]]; draw(); } }, '▼'),
            h('button', { type: 'button', class: 'btn sm ghost', title: 'Take these hours away', disabled: ranges.length < 2, onclick: () => { ranges.splice(j, 1); draw(); } }, '×'))),
          h('div', { class: 'inline' }, h('button', { type: 'button', class: 'btn sm', onclick: () => { ranges.push([960, 1260, '+']); draw(); } }, '+ Another stretch (a split day)'), h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { ranges.push([720, 780, '-']); draw(); } }, '+ Hours they can’t work')),
          h('p', { class: 'hint' }, 'They can work the hours above: two stretches make a split day (for example 11am to 12pm and 1:30pm to 9pm). Hours they can’t work come out of them.')) : null,
        h('label', { class: 'check' }, hl, ' Call or arrange first (yellow on the list)'),
        (() => { const sc = p.school; if (!sc || sc.on === false) return null; const cl = (sc.classes || []).filter((c) => c.days.includes(i));
          return h('p', { class: 'hint', style: { margin: 0 } }, `School${sc.name ? ' (' + sc.name + ')' : ''}: ${cl.length ? cl.map((c) => clockShort(c.from) + '–' + clockShort(c.to)).join(', ') + ' on ' + WEEKDAYS[i] + 's' : 'no class on ' + WEEKDAYS[i] + 's'}. `,
            sc.count ? 'Those hours come out of the hours above (Can’t work during class is ticked on the School tab).' : 'A note only: the hours above are not changed (tick Can’t work during class on the School tab to take class times out).'); })()].filter(Boolean));
    };
    draw();
    const entry = () => (kind === 'times' ? { k: 'times', r: ranges.map((r) => [r[0], r[1], r[2] === '-' ? '-' : '+']) } : kind === 'note' ? { k: 'note', note } : { k: kind });
    const save = (days) => change(() => { bakeAvail(p); days.forEach((k) => { p.avail[k] = { ...entry(), ...(hl.checked ? { hl: true } : {}) }; }); });
    modal({ title: `${p.name} · ${WEEKDAYS[i]}`, body: box, wide: true, actions: [
      { label: 'Cancel', left: true },
      { label: i >= 5 ? 'Same for Sat and Sun' : 'Same Mon to Fri', onClick: () => save(i >= 5 ? [5, 6] : [0, 1, 2, 3, 4]) },
      { label: 'Same every day', onClick: () => save([0, 1, 2, 3, 4, 5, 6]) },
      { label: 'Save', primary: true, onClick: () => save([i]) }] });
  }

