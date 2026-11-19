  // ===================================================================
  // Menu bar
  // ===================================================================
  const go = (tab) => { ui.tab = tab; persist(); render(); };
  const nextWeek = (dir) => { const w = weekOf(ui.day) + dir; if (w >= 0 && w < plan.weeks) { ui.day = weekDays(w)[(parseIso(ui.day).getDay() + 6) % 7]; persist(); render(); } };
  const MENUS = [
    ['File', [
      { label: 'New plan…', run: newPlan },
      { label: 'Save and open… (Computer, Server, File)', key: 'Ctrl+S', run: () => saveDialog() },
      '-',
      { label: () => `☁ Computer → Server${serverWhere()} (save)`, run: () => saveToServer() },
      { label: () => `☁ Server → Computer${serverWhere()} (open)`, run: () => loadFromServer() },
      { label: '📍 Open a location… (its schedule opens here)', run: () => chooseLocation() },
      { label: '⇄ Bring in from another location or account…', run: () => bringIn() },
      '-',
      { label: '💾 Computer → File (save everything)', run: () => saveFile('location') },
      { label: '💾 Computer → File as… (save everything)', run: () => saveFile('location', { as: true }) },
      { label: '📂 File → Computer (open a file)', key: 'Ctrl+O', run: () => openFile() },
      { label: '💾 Computer → File: a part only: this week’s schedule', run: () => saveWeek(false) },
      { label: '💾 Computer → File: a part only: the month’s schedules', run: () => saveMonth(false) },
      { label: '💾 Computer → File: a part only: the team…', run: saveStaff },
      { label: '💾 Computer → File: a part only: one day', run: () => saveFile('day', { as: true }) },
      { label: 'Save… (choose what to save)', key: 'Ctrl+Shift+S', run: () => saveAsDialog() },
      { label: 'Save emailable file (.html)…', run: saveEmailable },
      { label: 'Email or share…', run: emailDialog },
      '-',
      { label: 'Print or save week table…', run: () => exportImageDialog({ layout: 'table' }) },
      { label: 'Print or save visual timeline…', run: () => exportImageDialog({ layout: 'timeline' }) },
      { label: 'Print or save the hourly week…', run: () => hourlyWeekDialog() },
      { label: 'Print the calendar…', run: () => { ui.tab = 'calendar'; persist(); render(); setTimeout(() => calPrintDialog(), 60); } }, // Calendar 2 (Calendar 1 is turned off)
      { label: 'Save as text or CSV…', run: exportTextDialog },
      { label: 'Import calendar (iCal .ics)…', run: icalImport },
      { label: 'Export calendar (iCal .ics)…', run: () => icalExportDialog() },
      { label: 'Print schedule for a person or group…', run: () => printPeopleDialog() },
      { label: 'Print availability and contact list', run: () => printAvailability() },
      { label: 'Print screen (what you see)…', key: 'Ctrl+Shift+P', run: printScreenDialog },
      { label: 'Print…', key: 'Ctrl+P', run: () => { if (inFrame) blockedHere(); else if (ui.tab === 'calendar') calPrintDialog(); else printPageDialog(); } },
      '-',
      { label: 'Company & location…', run: () => { ui.tab = 'company'; persist(); render(); } },
      { label: 'Settings…', run: settingsDialog },
    ]],
    ['Edit', [
      { label: 'Undo', key: 'Ctrl+Z', run: undo, disabled: () => !undoStack.length },
      '-',
      { label: 'Copy a day…', run: () => copyAnyDialog('day') },
      { label: 'Copy a week…', run: () => copyAnyDialog('week') },
      { label: 'Copy a month…', run: () => copyAnyDialog('month') },
      { label: 'Copy this day to several days…', run: () => copyDayDialog(ui.day) },
      '-',
      { label: 'Move week…', run: moveWeekDialog, disabled: () => plan.weeks < 2 },
      { label: 'Move whole plan to new dates…', run: movePlanDialog },
      '-',
      { label: 'Clear day', run: () => clearRange('day') },
      { label: 'Clear week', run: () => clearRange('week') },
      { label: 'Clear month (all weeks)', run: () => clearRange('month') },
      '-',
      { label: 'New-hire checklist…', run: editChecklist },
      '-',
      { label: 'Time off request…', run: () => timeOffRequest(false) },
      { label: 'Not available some hours (appointment)…', run: () => timeOffRequest(true) },
      { label: 'Time off list', run: timeOffList },
      { label: 'Special store hours (holiday)…', run: () => specialDialog(null) },
      { label: 'Event or note for a day…', run: () => eventDialog(null) },
      { label: 'Calendar list (search and sort)', run: calList },
      '-',
      { label: 'Check schedule…', run: checkDialog },
    ]],
    ['View', [
      ...TABS.map(([k, l]) => ({ label: l, run: () => go(k), checked: () => ui.tab === k })),
      '-',
      { label: 'Previous week', run: () => nextWeek(-1), disabled: () => weekOf(ui.day) <= 0 },
      { label: 'Next week', run: () => nextWeek(1), disabled: () => weekOf(ui.day) >= plan.weeks - 1 },
      '-',
      { label: 'Light theme', run: () => setTheme('light'), checked: () => document.documentElement.dataset.theme === 'light' },
      { label: 'Dark theme', run: () => setTheme('dark'), checked: () => document.documentElement.dataset.theme === 'dark' },
      { label: 'Match system', run: () => setTheme(''), checked: () => !document.documentElement.dataset.theme },
    ]],
    ['Help', [
      { label: 'How to use ShiftCraft', run: () => modal({ title: 'How to use ShiftCraft', wide: true, actions: [{ label: 'Close', primary: true }], body: [
        h('p', null, h('b', null, 'Schedule: '), 'click a name under Unscheduled to add their usual shift. Drag a shift to move it; drag its left or right edge to change the start or finish in 15-minute steps. Click a shift to remove it (Undo appears). Double-click to type exact times.'),
        h('p', null, h('b', null, 'Weeks: '), 'up to 4 weeks, Monday to Sunday. Edit › Copy week, Move week and Move whole plan help you reuse schedules.'),
        h('p', null, h('b', null, 'Forecast: '), 'type past sales (or paste them) and the trend fills in. Target hours = forecast ÷ your sales-per-labor-hour goal.'),
        h('p', null, h('b', null, 'Files: '), 'File › Save week saves just the week you are looking at; Save month saves every week. Names follow Company - Location - first date - last date. Save as image makes a printable week sheet (Letter, Legal or Tabloid) to mark up by hand.'),
        h('p', null, h('b', null, 'Hand-off: '), 'when the real scheduler unlocks, open Hand-off and enter each shift in order, ticking them off.')] }) },
      { label: 'About ShiftCraft', run: () => modal({ title: 'About ShiftCraft', actions: [{ label: 'Close', primary: true }], body: [h('p', null, 'ShiftCraft · version 0.2'), h('p', { class: 'muted' }, 'A planning tool. Everything stays on this computer.')] }) },
    ]],
  ];
  (function buildMenubar() {
    const bar = $('#menubar'); let open = null;
    const close = () => { if (!open) return; open.btn.setAttribute('aria-expanded', 'false'); open.list.remove(); open = null; };
    MENUS.forEach(([name, items]) => {
      const wrap = h('div', { class: 'menu' });
      const btn = h('button', { class: 'menu-btn', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, name);
      const show = () => {
        close();
        const list = h('div', { class: 'menu-list', role: 'menu' }, items.map((it) => it === '-' ? h('div', { class: 'menu-sep' }) :
          h('button', { class: 'menu-item', role: it.checked ? 'menuitemcheckbox' : 'menuitem', disabled: !!(it.disabled && it.disabled()), onclick: () => { close(); it.run(); } },
            h('span', { class: 'mk' }, it.checked && it.checked() ? '✓' : ''), h('span', null, it.label), h('span', { class: 'mkey' }, it.key || ''))));
        wrap.append(list); btn.setAttribute('aria-expanded', 'true'); open = { btn, list, wrap };
        list.addEventListener('keydown', (e) => {
          const b = [...list.querySelectorAll('.menu-item:not(:disabled)')], i = b.indexOf(document.activeElement);
          if (e.key === 'ArrowDown') { e.preventDefault(); b[(i + 1) % b.length].focus(); }
          if (e.key === 'ArrowUp') { e.preventDefault(); b[(i - 1 + b.length) % b.length].focus(); }
        });
      };
      btn.onclick = () => (open && open.btn === btn ? close() : show());
      btn.onmouseenter = () => { if (open && open.btn !== btn) show(); };
      btn.onkeydown = (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); show(); open.list.querySelector('.menu-item:not(:disabled)')?.focus(); } };
      wrap.append(btn); bar.append(wrap);
    });
    document.addEventListener('mousedown', (e) => { if (open && !open.wrap.contains(e.target)) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { const b = open.btn; close(); b.focus(); } });
  })();

