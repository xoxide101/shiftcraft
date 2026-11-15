  // ---------- Staff ----------
  let staffTab = 'wk';
  try { staffTab = localStorage.getItem('shiftcraft-staff-tab') || 'wk'; } catch (e) {}
  function staffView(main) {
    const roleSel = (v, on) => h('select', { class: 'input', onchange: (e) => on(e.target.value) }, Object.entries(ROLES).map(([k, r]) => h('option', { value: k, selected: k === v }, `${r.label} (${r.short})`)));
    const shiftCount = (id) => Object.values(plan.shifts).reduce((n, list) => n + list.filter((s) => s.staffId === id).length, 0);
    const SECTIONS = [['wk', '1 · Weekdays', 'Monday to Friday: usual shift, the hours they can work, AM / MID / PM and days off'], ['we', '2 · Weekend', 'Saturday and Sunday: their own usual shift, hours, AM / MID / PM and days off'], ['contact', '3 · Contact & training', 'Email, phone number, notes, and the positions each person is trained in'], ['avail', '4 · Day by day', 'Each day on its own: Any, Off, hours they can and can’t work, notes; Validated; pending training'], ['timeoff', '5 · Time off', 'Days, weeks or a few hours off: reason, requested or approved, notes']];
    const nameCell = (p) => { const name = h('input', { class: 'input', value: p.name, 'aria-label': 'Name', style: { width: '100%' } }); name.addEventListener('change', () => { if (name.value.trim()) change(() => { p.name = name.value.trim(); }); }); return h('td', { style: { minWidth: '170px' } }, name); };
    const roleCell = (p) => h('td', null, roleSel(p.role, (v) => change(() => { p.role = v; })));
    const actions = (p) => h('td', { class: 'nowrap' }, h('button', { class: 'btn sm', title: 'Tasks and training', onclick: () => tasksDialog(p) }, `Tasks${openTasks(p) ? ` (${openTasks(p)})` : ''}`), ' ',
      h('button', { class: 'btn sm', title: 'Days, weeks or a few hours off, with a reason and notes', onclick: () => timeOffDialog(p) }, `Time off${(p.timeOff || []).some((t) => t.to >= iso(new Date()) && t.status !== 'denied') ? ' •' : ''}`), ' ',
      h('button', { class: 'btn sm', title: 'Print this person’s schedule', onclick: () => printPeopleDialog(p.id) }, 'Print'), ' ',
      h('button', { class: 'btn sm', title: 'Resigned, terminated or left: they come off the schedule and lists, and everything about them is kept under Former staff', onclick: () => leftDialog(p) }, 'Left…'), ' ',
      h('button', { class: 'btn sm ghost danger-text', onclick: () => {
        const n = shiftCount(p.id);
        confirmBox(`Remove ${p.name}?`, n ? `${p.name} has ${n} shift${n === 1 ? '' : 's'} in this plan. They will be removed too. You can undo this.` : 'You can undo this.', 'Remove', () => change(() => {
          plan.staff = plan.staff.filter((x) => x.id !== p.id);
          Object.keys(plan.shifts).forEach((d) => { plan.shifts[d] = plan.shifts[d].filter((s) => s.staffId !== p.id); });
        }));
      } }, 'Remove'));
    // Weekdays or weekend: usual shift, available hours, parts of the day, days off
    const scheduleCells = (p, k) => {
      const st = setOf(p, k);
      const a = timePicker(st.start, 'Usual start'), b = timePicker(st.end, 'Usual finish');
      const saveTimes = () => { if (b.value > a.value) change(() => setSet(p, k, { start: Math.max(DAY_START, a.value), end: Math.min(DAY_END, b.value) })); else toast('The usual finish must be after the start.'); };
      a.addEventListener('change', saveTimes); b.addEventListener('change', saveTimes);
      const any = st.from == null || st.to == null;
      const fa = timePicker(any ? DAY_START : st.from, 'Available from'), fb = timePicker(any ? DAY_END : st.to, 'Available until');
      [fa, fb].forEach((tp) => tp.querySelectorAll('select').forEach((x) => { x.disabled = any; }));
      // if one end passes the other, the other moves along by an hour (no error to fix first)
      const saveWin = (moved) => { let f = fa.value, t = fb.value; if (t <= f) { if (moved === 'from') t = Math.min(DAY_END, f + 60); else f = Math.max(DAY_START, t - 60); } change(() => setSet(p, k, { from: f, to: t })); };
      fa.addEventListener('change', () => saveWin('from')); fb.addEventListener('change', () => saveWin('to'));
      const anyBox = h('input', { type: 'checkbox', checked: any, onchange: (e) => change(() => setSet(p, k, e.target.checked ? { from: null, to: null } : { from: Math.max(DAY_START, st.start - 60), to: Math.min(DAY_END, st.end + 60) })) });
      const dayIdx = k === 'we' ? [5, 6] : [0, 1, 2, 3, 4];
      // the same two lines in every row, so the table stays lined up: Any time and + Some days, then the hours (greyed for Any time)
      return [
        h('td', null, h('div', { class: 'inline', style: { flexWrap: 'nowrap' } }, a, '–', b)),
        h('td', null, h('div', { class: 'inline', style: { flexWrap: 'nowrap', marginBottom: '4px' } },
          h('label', { class: 'check small', style: { margin: 0 }, title: any ? 'Untick to set the hours they can work' : 'Tick if they can work any time' }, anyBox, ' Any time'), h('span', { class: 'spacer' }),
          h('button', { type: 'button', class: 'btn sm', title: 'Other hours on some days only: adds a line under this person where you pick the days and the hours. Add two lines for a split day (for example 7am–11am and 4pm–9pm)', onclick: () => change(() => { (p.lines = p.lines || []).push({ tab: k, days: [], from: st.from ?? st.start, to: st.to ?? st.end }); }) }, '+ Some days')),
          h('div', { class: 'inline' + (any ? ' dim' : ''), style: { flexWrap: 'nowrap' } }, fa, '–', fb)),
        h('td', null, h('div', { class: 'daytoggles', role: 'group', 'aria-label': 'Parts of the day they can work' }, PARTS.map(([pk, l]) => {
          const on = st.parts.includes(pk);
          return h('button', { type: 'button', class: 'pt' + (on ? ' on' : ''), 'aria-pressed': String(on), title: `${l}: ${pk === 'am' ? 'opening to ' + clock(plan.midStart) : pk === 'mid' ? clock(plan.midStart) + ' to ' + clock(plan.pmStart) : clock(plan.pmStart) + ' to closing'} on ${partWord(k)} (click to change)`,
            onclick: () => change(() => { const next = on ? st.parts.filter((x) => x !== pk) : [...st.parts, pk]; setSet(p, k, { parts: next.length ? next : st.parts }); }) }, l);
        }))),
        h('td', null, h('div', { class: 'daytoggles', role: 'group', 'aria-label': 'Days not available' }, dayIdx.map((i) => {
          const on = !!(p.off && p.off[i]), wd = WEEKDAYS[i];
          return h('button', { type: 'button', class: 'dt' + (on ? ' on' : ''), 'aria-pressed': String(on), title: `${on ? 'Not available' : 'Available'} on ${wd}s (click to change)`,
            onclick: () => change(() => { p.off = Array.from({ length: 7 }, (_, x) => !!(p.off && p.off[x])); p.off[i] = !p.off[i]; }) }, k === 'we' ? wd.slice(0, 3) : wd[0]);
        }))),
      ];
    };
    // hours on some days (split shifts): each line is its own sub-row under the person, lined up with the columns above:
    // the hours under "Hours they can work" and the days under the day buttons, so nothing in the person's row moves
    const lineRows = (p, k, cols) => {
      const dayIdx = k === 'we' ? [5, 6] : [0, 1, 2, 3, 4];
      const mine = (p.lines || []).filter((l) => (l.tab || (l.days.some((x) => x >= 5) ? 'we' : 'wk')) === k);
      return mine.map((l, j) => {
        const fa = timePicker(l.from, 'From'), fb = timePicker(l.to, 'Until');
        const save = (moved) => { let f = fa.value, t = fb.value; if (t <= f) { if (moved === 'from') t = Math.min(DAY_END, f + 60); else f = Math.max(DAY_START, t - 60); } change(() => { l.from = f; l.to = t; }); };
        fa.addEventListener('change', () => save('from')); fb.addEventListener('change', () => save('to'));
        const days = l.days.filter((i) => dayIdx.includes(i)).map((i) => WEEKDAYS[i].slice(0, 3));
        return h('tr', { class: 'subrow', style: { opacity: p.active ? 1 : 0.55 }, title: `${p.name}: on the days picked, they can work these hours (add another line for a split day)` },
          h('td', { colspan: 2, class: 'small' }, h('span', { class: 'sub-arrow' }, '↳ '), `Some days ${mine.length > 1 ? j + 1 : ''}`, h('span', { class: 'muted' }, days.length ? ` · ${days.join(', ')}` : ' · pick the days →')),
          h('td'),
          h('td', null, h('div', { class: 'inline', style: { flexWrap: 'nowrap' } }, fa, '–', fb)),
          h('td'),
          h('td', null, h('div', { class: 'daytoggles', role: 'group', 'aria-label': 'Days for these hours' }, dayIdx.map((i) => { const on = l.days.includes(i), wd = WEEKDAYS[i];
            return h('button', { type: 'button', class: 'dt use' + (on ? ' on' : ''), 'aria-pressed': String(on), title: `${on ? 'Uses' : 'Does not use'} these hours on ${wd}s (click to change)`, onclick: () => change(() => { l.days = on ? l.days.filter((x) => x !== i) : [...l.days, i].sort(); }) }, k === 'we' ? wd.slice(0, 3) : wd[0]); }))),
          h('td', { colspan: cols - 6 }, h('button', { type: 'button', class: 'btn sm ghost', title: 'Take these hours away', onclick: () => change(() => { p.lines = p.lines.filter((x) => x !== l); if (!p.lines.length) delete p.lines; }) }, '× Remove')));
      });
    };
    let head, rows, foot = null, empty = null, asked = 0;
    const people = sortStaff(plan.staff.filter((p) => !p.left));
    if (staffTab === 'timeoff') {
      ({ head, rows, foot, empty, asked } = timeOffRows());
    } else if (staffTab === 'avail') {
      head = ['Name', 'Role', 'Phone', ...WEEKDAYS.map((w) => w.slice(0, 3)), 'Validated', 'Pending training', ''];
      rows = people.map((p) => h('tr', { style: { opacity: p.active ? 1 : 0.55 } }, nameCell(p), roleCell(p), h('td', { style: { minWidth: '130px' } }, (() => { const ph = h('input', { class: 'input' + (p.phone ? '' : ' need'), type: 'tel', value: p.phone || '', placeholder: 'Phone needed', 'aria-label': 'Phone number for ' + p.name, title: 'Phone numbers are listed on the availability list', style: { width: '100%' } }); ph.addEventListener('change', () => change(() => { p.phone = ph.value.trim(); })); return ph; })()),
        WEEKDAYS.map((w, i) => { const own = avOf(p, i), a = own || avFromSets(p, i); return h('td', { class: 'c', style: { padding: '2px' } }, h('button', { type: 'button', class: 'avcell ' + avClass(a) + (own ? '' : ' sys'), title: `${w}: ${avText(a)}${own ? '' : ' (from the weekday / weekend settings)'}. Click to change.`, onclick: () => availEditor(p, i) }, avText(a))); }),
        h('td', { class: 'c' }, h('input', { type: 'checkbox', checked: !!p.validated, 'aria-label': 'Validated', title: p.validatedOn ? 'Validated ' + p.validatedOn : 'Tick when the person has checked their availability', onchange: (e) => change(() => { p.validated = e.target.checked; p.validatedOn = e.target.checked ? new Date().toISOString().slice(0, 10) : null; }) })),
        h('td', { class: 'c' }, h('input', { type: 'checkbox', checked: !!p.pending, 'aria-label': 'Pending training', onchange: (e) => change(() => { p.pending = e.target.checked; }) })),
        h('td', { class: 'nowrap' }, h('button', { class: 'btn sm', title: 'Fill the week from this person’s weekday and weekend settings', onclick: () => change(() => { p.avail = WEEKDAYS.map((_, i) => avFromSets(p, i)); }) }, 'From usual'), ' ',
          h('button', { class: 'btn sm ghost', title: 'Clear the day-by-day availability', disabled: !Array.isArray(p.avail), onclick: () => change(() => { delete p.avail; }) }, 'Clear'))));
    } else if (staffTab === 'contact') {
      head = ['Name', 'Role', 'Employee ID', 'Shift code', 'Email', 'Phone number', 'Notes', ''];
      rows = people.map((p) => {
        const email = h('input', { class: 'input', type: 'email', value: p.email || '', placeholder: 'name@example.com', 'aria-label': 'Email', style: { width: '100%' } });
        email.addEventListener('change', () => change(() => { p.email = email.value.trim(); }));
        const idBox = (key, label, ph) => { const x = h('input', { class: 'input', value: p[key] || '', placeholder: ph, 'aria-label': label, maxLength: 40, style: { width: '100%' } }); x.addEventListener('change', () => change(() => { const v = x.value.trim(); if (v) p[key] = v; else delete p[key]; })); return h('td', { style: { minWidth: '100px' } }, x); };
        const notes = h('input', { class: 'input', value: p.notes || '', placeholder: 'e.g. school until June', 'aria-label': 'Notes', style: { width: '100%' } });
        notes.addEventListener('change', () => change(() => { p.notes = notes.value; }));
        const phone = h('input', { class: 'input', type: 'tel', value: p.phone || '', placeholder: '(555) 010-0100', 'aria-label': 'Phone number', style: { width: '100%' } });
        phone.addEventListener('change', () => change(() => { p.phone = phone.value.trim(); }));
        return h('tr', { style: { opacity: p.active ? 1 : 0.55 } }, nameCell(p), roleCell(p), idBox('empId', 'Employee ID', 'e.g. 10234'), idBox('shiftCode', 'Shift code', 'e.g. TM-07'),
          h('td', { style: { minWidth: '220px' } }, h('div', { class: 'inline', style: { flexWrap: 'nowrap' } }, email, p.email ? h('a', { class: 'btn sm', href: 'mailto:' + p.email, title: 'Write an email' }, '✉') : null)),
          h('td', { style: { minWidth: '180px' } }, h('div', { class: 'inline', style: { flexWrap: 'nowrap' } }, phone, p.phone ? h('a', { class: 'btn sm', href: 'tel:' + p.phone.replace(/[^\d+]/g, ''), title: 'Call' }, '☎') : null)),
          h('td', { style: { minWidth: '160px' } }, notes),
          actions(p));
      });
    } else {
      const k = staffTab;
      head = ['Name', 'Role', `Usual ${k === 'we' ? 'weekend' : 'weekday'} shift`, 'Hours they can work', 'Can work', 'Not available', ...(k === 'wk' ? ['Max h/wk', 'Active'] : []), ''];
      rows = people.flatMap((p) => {
        const extra = [];
        if (k === 'wk') {
          const max = h('input', { class: 'input', type: 'number', min: 0, max: 80, value: p.maxHours || '', style: { width: '70px' }, 'aria-label': 'Max hours per week (the whole week)' });
          max.addEventListener('change', () => change(() => { p.maxHours = +max.value || 0; }));
          extra.push(h('td', null, max), h('td', { class: 'c' }, h('input', { type: 'checkbox', checked: p.active, 'aria-label': 'Active', onchange: (e) => change(() => { p.active = e.target.checked; }) })));
        }
        const subs = lineRows(p, k, head.length);
        return [h('tr', { class: subs.length ? 'has-sub' : '', style: { opacity: p.active ? 1 : 0.55 } }, nameCell(p), roleCell(p), ...scheduleCells(p, k), ...extra, actions(p)), ...subs];
      });
    }
    const newName = h('input', { class: 'input', placeholder: 'Full name', 'aria-label': 'New person name', style: { width: '100%' } });
    let newRole = 'TM';
    const addPerson = () => {
      const n = newName.value.trim(); if (!n) { newName.focus(); return; }
      const defaults = { GM: [360, 900], AGM: [600, 1140], SM: [480, 1020], TM: [600, 960], NH: [600, 900] }[newRole];
      change(() => { plan.staff.push({ id: uid(), name: n, role: newRole, active: true, defStart: defaults[0], defEnd: defaults[1], maxHours: ['TM', 'NH'].includes(newRole) ? 32 : 45, notes: '', tasks: [] }); });
      setTimeout(() => { const i = $('input[aria-label="New person name"]'); i && i.focus(); });
    };
    newName.addEventListener('keydown', (e) => { if (e.key === 'Enter') addPerson(); });
    const today0 = iso(new Date()), waiting = plan.staff.reduce((n, p) => n + (p.left ? 0 : (p.timeOff || []).filter((t) => t.status === 'requested' && t.to >= today0).length), 0);
    const counts = Object.keys(ROLES).map((k) => `${plan.staff.filter((p) => p.role === k && p.active).length} ${ROLES[k].short}`).join(' · ');
    const hint = { wk: 'Weekdays (Monday to Friday). The usual shift is what a person gets when you click their name under Unscheduled. Hours they can work: untick Any time and set the hours they are free on weekdays; + Some days adds a line under the person for other hours on the days you pick (two lines make a split day). Can work: AM, MID, PM. Not available: click the days they can’t work (red). Untick Active for people who are away.',
      we: 'Weekend (Saturday and Sunday), set apart from weekdays: many people can work any time at the weekend but not on weekdays. Their usual weekend shift is used when you add them on a Saturday or Sunday.',
      avail: 'Each day on its own, as on the availability and contact list (Print & share › Availability list). Click a day: Any, Off, a note (Mornings, Emergency, If you ask…), or hours: + adds a range they can work or can’t work (where they overlap, can’t wins). “From usual” fills the week from the weekday and weekend settings, then make any day different. A day not set on its own shows (lighter) and prints what those settings give.',
      timeoff: 'Time off for anyone: whole days, weeks, or just a few hours, with the reason, whether it is requested or approved, and a note. A shift on someone’s time off gets the N/A mark, and they show as away under Unscheduled. Time off… on a person adds it for them.',
      contact: 'How to reach each person, their Employee ID and Shift code (as in the company’s own system; shown on the Hand-off page), and notes about them. ✉ writes an email and ☎ calls (on a phone, or a computer set up for calls). Below: the positions each person is trained in.' }[staffTab];
    main.append(h('div', { class: 'card' },
      h('div', { class: 'daynav' }, h('h2', { style: { margin: 0 } }, `Staff list · ${plan.staff.filter((p) => !p.left).length} people`), h('span', { class: 'muted small' }, counts), h('span', { class: 'spacer' }),
        h('button', { class: 'btn sm', onclick: saveStaff }, 'Save team…'),
        h('button', { class: 'btn sm', onclick: () => openFile() }, 'Load team…'),
        h('button', { class: 'btn sm', disabled: !plan.staff.length, onclick: () => confirmBox('Clear the staff list?', 'Everyone is removed, along with all their shifts in this plan. Save the list first if you want to keep it. You can undo this.', 'Clear list', () => change(() => { plan.staff = []; plan.shifts = {}; plan.example = false; })) }, 'Clear list')),
      h('div', { class: 'tabs staff-tabs', role: 'tablist', 'aria-label': 'Staff sections' }, SECTIONS.map(([k, l, t]) => h('button', { class: 'tab', role: 'tab', 'aria-selected': String(staffTab === k), title: t, onclick: () => { staffTab = k; try { localStorage.setItem('shiftcraft-staff-tab', k); } catch (e) {} render(); } }, k === 'timeoff' && waiting ? `${l} (${waiting} to approve)` : l))),
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
          h('td', { class: 'nowrap' }, h('button', { class: 'btn sm', title: 'Edit the reason, date or note', onclick: () => leftDialog(p) }, 'Edit…'), ' ',
            h('button', { class: 'btn sm primary', title: 'Back on the team with everything as it was', onclick: () => change(() => { delete p.left; p.active = true; }) }, 'Rehire'), ' ',
            h('button', { class: 'btn sm ghost danger-text', title: 'Delete them and their details for good', onclick: () => confirmBox(`Delete ${p.name} for good?`, 'Their details are removed from this plan (shifts already worked are removed too). You can undo this.', 'Delete', () => change(() => { plan.staff = plan.staff.filter((x) => x !== p); Object.keys(plan.shifts).forEach((d) => { plan.shifts[d] = plan.shifts[d].filter((x) => x.staffId !== p.id); }); })) }, 'Delete')))))))));
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
  const avClass = (a) => (!a ? 'none' : a.k === 'off' ? 'off' : a.hl || (a.k === 'note' && /emergenc|morning|afternoon|evening/i.test(a.note || '')) ? 'hl' : 'on');
  // One day's availability: Any, Off, a note, or hours (+ adds a range they can work or can't work)
  function availEditor(p, i) {
    const cur = JSON.parse(JSON.stringify(avOf(p, i) || avFromSets(p, i)));
    let kind = cur.k, note = cur.note || 'Mornings', ranges = cur.r && cur.r.length ? cur.r : [[OPEN, CLOSE, '+']];
    const times = [[OPEN, 'Open'], ...Array.from({ length: (DAY_END - DAY_START) / 15 + 1 }, (_, k) => DAY_START + k * 15).map((m) => [m, clockShort(m)]), [CLOSE, 'Close']];
    const timeSel = (v, on) => h('select', { class: 'input', style: { width: 'auto' }, onchange: (e) => on(+e.target.value) }, times.map(([m, l]) => h('option', { value: m, selected: m === v }, l)));
    const box = h('div', { class: 'grid', style: { gap: '10px' } });
    const hl = h('input', { type: 'checkbox', checked: !!cur.hl });
    const draw = () => {
      box.replaceChildren(...[
        h('div', { class: 'seg', role: 'group' }, [['any', 'Any'], ['off', 'Off'], ['times', 'Hours'], ['note', 'A note']].map(([k, l]) => h('button', { type: 'button', class: 'btn', 'aria-pressed': String(kind === k), onclick: () => { kind = k; draw(); } }, l))),
        kind === 'note' ? h('div', { class: 'inline' }, AV_NOTES.map((n) => h('button', { type: 'button', class: 'btn sm' + (note === n ? ' primary' : ''), onclick: () => { note = n; draw(); } }, n)),
          h('input', { class: 'input', value: AV_NOTES.includes(note) ? '' : note, placeholder: 'or your own words', style: { width: '160px' }, oninput: (e) => { if (e.target.value.trim()) note = e.target.value.trim(); } })) : null,
        kind === 'times' ? h('div', { class: 'grid', style: { gap: '6px' } },
          ranges.map((r, j) => h('div', { class: 'inline' },
            h('select', { class: 'input', style: { width: 'auto' }, onchange: (e) => { r[2] = e.target.value; } }, h('option', { value: '+', selected: r[2] !== '-' }, 'Can work'), h('option', { value: '-', selected: r[2] === '-' }, 'Can’t work')),
            timeSel(r[0], (v) => { r[0] = v; }), h('span', null, 'to'), timeSel(r[1], (v) => { r[1] = v; }),
            h('button', { type: 'button', class: 'btn sm ghost', title: 'Take this range away', disabled: ranges.length < 2, onclick: () => { ranges.splice(j, 1); draw(); } }, '×'))),
          h('div', { class: 'inline' }, h('button', { type: 'button', class: 'btn sm', onclick: () => { ranges.push([OPEN, CLOSE, '+']); draw(); } }, '+ Can work'), h('button', { type: 'button', class: 'btn sm', onclick: () => { ranges.push([720, 780, '-']); draw(); } }, '+ Can’t work')),
          h('p', { class: 'hint' }, 'Where a can’t-work range overlaps a can-work range, can’t wins. With no can-work range, they can work any time apart from the can’t-work ranges.')) : null,
        h('label', { class: 'check' }, hl, ' Highlight this day (orange on the list)')].filter(Boolean));
    };
    draw();
    const entry = () => (kind === 'times' ? { k: 'times', r: ranges.map((r) => [r[0], r[1], r[2] === '-' ? '-' : '+']) } : kind === 'note' ? { k: 'note', note } : { k: kind });
    const save = (days) => change(() => { if (!Array.isArray(p.avail)) p.avail = WEEKDAYS.map((_, k) => avFromSets(p, k)); days.forEach((k) => { p.avail[k] = { ...entry(), ...(hl.checked ? { hl: true } : {}) }; }); });
    modal({ title: `${p.name} · ${WEEKDAYS[i]}`, body: box, wide: true, actions: [
      { label: 'Not given', onClick: () => change(() => { if (Array.isArray(p.avail)) { p.avail[i] = null; if (p.avail.every((x) => !x)) delete p.avail; } }) },
      { label: i >= 5 ? 'Same for the weekend' : 'Same for weekdays', onClick: () => save(i >= 5 ? [5, 6] : [0, 1, 2, 3, 4]) },
      { label: 'Same every day', onClick: () => save([0, 1, 2, 3, 4, 5, 6]) },
      { label: 'Save', primary: true, onClick: () => save([i]) }] });
  }

