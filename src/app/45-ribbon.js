  // Title bar at the very top (Office style) and the ribbon under it. The ribbon tabs are ShiftCraft's
  // views (Schedule, Week, Forecast, Hand-off, Staff) plus Print & share; the logo opens every menu.
  // The old bar is hidden. Shared CraftTitlebar / CraftRibbon (pasted above, inside this script).
  if (window.CraftTitlebar && window.CraftRibbon) {
    const LOGO = `<svg viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="shc-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f6fdd"/><stop offset=".55" stop-color="#2a86c4"/><stop offset="1" stop-color="#1e9e8a"/></linearGradient></defs><rect x="1" y="1" width="38" height="38" rx="11" fill="url(#shc-g)"/><rect x="8" y="10" width="24" height="20" rx="3.5" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 16h24M14 7.5v5M26 7.5v5" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="11" y="19.2" width="11" height="3.2" rx="1.6" fill="#fff"/><rect x="16" y="24.6" width="8.5" height="3.2" rx="1.6" fill="#fff" opacity=".85"/><path d="M28.5 21.5l1.2 2.8 2.8 1.2-2.8 1.2-1.2 2.8-1.2-2.8-2.8-1.2 2.8-1.2Z" fill="#ffe066"/></svg>`;
    const I = window.CraftIcons;
    const st = document.createElement('style');
    st.textContent = '.ctb { position: sticky; top: 0; z-index: 56; } body > .bar { display: none !important; } .crb .month-pick { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; } .crb .month-pick select { height: 28px; }';
    document.head.append(st);
    // Ribbon buttons reuse the menu commands, so both always do the same thing.
    const all = () => MENUS.flatMap((m) => m[1]).filter((it) => it && it.label);
    const item = (start) => all().find((it) => it.label === start) || all().find((it) => it.label.startsWith(start)) || {};
    const C = (start, label, icon, o = {}) => { const it = item(start); return { label: label || it.label, icon, key: it.key, run: () => it.run && it.run(), ...o }; };
    const VIEWS = ['schedule', 'week', 'calendar', 'forecast', 'handoff', 'staff', 'company', 'border'];
    const view = (id) => () => { if (ui.tab !== id) { ui.tab = id; persist(); render(); } };
    // Start (the wizard): what do you want to do? Each tile goes to the place (or the window) for that job.
    const go = (start) => () => { const it = item(start); if (it.run) it.run(); };
    const START = [
      { title: 'Make the schedule', what: 'Shifts day by day, on the Schedule', run: view('schedule') },
      { title: 'This week at a glance', what: 'The whole week as a table', run: view('week') },
      { title: 'Staff', what: 'Add people, phone, email, positions, training', run: view('staff') },
      { title: 'Availability', what: 'Who can work when (on each person’s Staff card)', run: view('staff') },
      { title: 'Forecast and labour', what: 'Sales, labour hours, AM / MID / PM', run: view('forecast') },
      { title: 'Print or share', what: 'Week table, timeline, calendar, availability list, email', run: go('Print or save week table') },
      { title: 'Check the schedule', what: 'Gaps, overlaps, availability and hours', run: go('Check schedule') },
      { title: 'Calendar', what: 'Time off requests, holiday store hours and events; iCal in and out', run: view('calendar') },
      { title: 'Company and location', what: 'Name, address, opening hours, positions', run: view('company') },
      { title: 'Open a saved file…', what: 'A location, team or weeks file', run: () => openFile() },
      { title: 'Carry on', what: 'Back to where you were', run: () => {} },
    ];
    const START_KEY = 'shiftcraft-start-show';
    function showStart() {
      document.getElementById('sc-start-tiles').innerHTML = START.map((t, i) => `<button type="button" data-start="${i}"><b>${t.title}</b><small>${t.what}</small></button>`).join('');
      let on = true; try { on = localStorage.getItem(START_KEY) !== '0'; } catch (e) { /* blocked */ }
      document.getElementById('sc-start-show').checked = on; document.getElementById('sc-start').hidden = false;
    }
    const closeStart = () => { document.getElementById('sc-start').hidden = true; };
    document.getElementById('sc-start-tiles').onclick = (e) => { const b = e.target.closest('[data-start]'); if (!b) return; closeStart(); START[+b.dataset.start].run(); };
    document.getElementById('sc-start-close').onclick = closeStart;
    document.getElementById('sc-start').onclick = (e) => { if (e.target.id === 'sc-start') closeStart(); };
    document.getElementById('sc-start').onkeydown = (e) => { if (e.key === 'Escape') closeStart(); };
    document.getElementById('sc-start-show').onchange = (e) => { try { localStorage.setItem(START_KEY, e.target.checked ? '1' : '0'); } catch (err) { /* blocked */ } };
    const ribbon = window.CraftRibbon({
      mount: document.body, storageKey: 'shiftcraft', start: VIEWS.includes(ui.tab) ? ui.tab : 'schedule',
      tabs: [
        { id: 'schedule', label: 'Schedule', hue: '#2f6fdd', onSelect: view('schedule'), groups: [
          ['Start', [{ label: 'Start', icon: I.wand, big: true, title: 'What do you want to do? Schedule, staff, availability, forecast, print or share…', run: showStart }]],
          ['Day', [C('Copy a day', 'Copy day…', I.copy, { big: true }), { col: [C('Copy this day to several', 'Copy to several days…', I.severalDays), C('Clear day', 'Clear day', I.clear)] }]],
          ['Week', [{ col: [C('Previous week', 'Previous week', I.prev), C('Next week', 'Next week', I.next), C('Move week', 'Move week…', I.move)] }, { col: [C('Copy a week', 'Copy week…', I.copy), C('Clear week', 'Clear week', I.clear)] }]],
          ['Month', [{ el: document.querySelector('.month-pick') }, { col: [C('Copy a month', 'Copy month…', I.copy), C('Clear month', 'Clear month', I.clear), C('Move whole plan', 'Move plan…', I.move)] }]],
          ['Time off', [C('Time off request', 'Time off request…', I.calendar, { big: true }), { col: [C('Not available some hours', 'Appointment…', I.clock), C('Time off list', 'Time off list', I.list)] }]],
          ['Check', [C('Check schedule', 'Check schedule', I.check, { big: true }), C('Undo', 'Undo', I.undo, { big: true })]],
        ] },
        { id: 'week', label: 'Week', hue: '#1e9e8a', onSelect: view('week'), groups: [
          ['This week', [C('Print or save week table', 'Week table', I.table, { big: true }), C('Save this week’s schedule only', 'Save week', I.save, { big: true }), C('Copy a week', 'Copy week…', I.copy, { big: true })]],
          ['Check', [C('Check schedule', 'Check schedule', I.check, { big: true })]],
        ] },
        { id: 'calendar', label: 'Calendar', hue: '#3c8d3c', onSelect: view('calendar'), groups: [
          ['Add', [C('Event or note for a day', 'Event…', I.star, { big: true }), C('Special store hours', 'Special hours…', I.store, { big: true, title: 'Other opening hours (or closed) for a holiday or any day' }), C('Time off request', 'Time off request…', I.calendar, { big: true })]],
          ['iCal', [C('Import calendar', 'Import iCal…', I.import, { big: true }), C('Export calendar', 'Export iCal…', I.exportUp, { big: true })]],
          ['Find', [{ label: 'Search', icon: I.search, big: true, title: 'Search time off, store hours and events', run: () => { view('calendar')(); setTimeout(() => { const x = document.querySelector('#cal-q'); x && x.focus(); }, 60); } }, C('Calendar list', 'List', I.list, { big: true, title: 'Everything as a list you can sort' })]],
        ] },
        { id: 'forecast', label: 'Forecast', hue: '#e09f1f', onSelect: view('forecast'), groups: [
          ['Settings', [C('Settings', 'Settings…', I.gear, { big: true, title: 'Sales per labor hour, AM / MID / PM times, plan length' }), C('Company & location', 'Company & location', I.store, { big: true })]],
        ] },
        { id: 'handoff', label: 'Hand-off', hue: '#7b4fd6', onSelect: view('handoff'), groups: [
          ['Hand-off', [C('Print…', 'Print this list', I.print, { big: true }), C('Save as text or CSV', 'Text or CSV', I.textFile, { big: true }), C('Print screen', 'Print screen', I.screen, { big: true })]],
        ] },
        { id: 'staff', label: 'Staff', hue: '#d1408a', onSelect: view('staff'), groups: [
          ['Team', [C('Save team only', 'Save team', I.save, { big: true }), C('Open', 'Open a team file', I.folder, { big: true }), C('Print schedule for a person', 'Print for a person', I.person, { big: true })]],
          ['Time off', [C('Time off request', 'Time off request…', I.calendar, { big: true }), { col: [C('Not available some hours', 'Appointment…', I.clock), C('Time off list', 'Time off list', I.list)] }]],
          ['New hires', [C('New-hire checklist', 'New-hire checklist', I.checklist, { big: true })]],
        ] },
        { id: 'company', label: 'Company & Location', hue: '#c2711d', onSelect: view('company'), groups: [
          ['Location', [{ label: 'Details', icon: I.store, big: true, title: 'Company, location, address, phone, email, website', run: () => { coTab = 'details'; ui.tab = 'company'; persist(); render(); setTimeout(() => { const x = document.querySelector('#co-company'); x && x.focus(); }, 50); } }, C('Save location', 'Save everything', I.save, { big: true, title: 'Save the whole location: team, schedule, positions and settings' }), C('Open', 'Open…', I.folder, { big: true, title: 'Open a saved file (everything, a team or weeks)' })]],
          ['Positions', [{ label: 'Add a position', icon: I.checklist, big: true, run: () => { coTab = 'positions'; ui.tab = 'company'; persist(); render(); setTimeout(() => { const x = document.querySelector('#co-newpos'); x && x.focus(); }, 50); } }]],
        ] },
        { id: 'border', label: 'Border designer', hue: '#9b3fb5', onSelect: () => openBorderDesigner(), groups: [
          ['Border', [{ label: 'Designer', icon: I.star, big: true, title: 'Design your own page border: lines, shapes, pictures at the corners and along the sides', run: () => openBorderDesigner() },
            { label: 'Use on printouts', icon: I.check, big: true, title: 'Print with your border (Off, Thin frame or My border is also in every print window)', run: () => { borderUseOnPrint(!borderOnPrint()); toast(borderOnPrint() ? 'Printouts use your border' : 'Printouts use the thin frame'); } }]],
          ['Print with it', [C('Print the calendar', 'Calendar', I.calendar, { big: true }), C('Print or save week table', 'Week table', I.table, { big: true }), C('Print schedule for a person', 'Person or group', I.person, { big: true })]],
        ] },
        { id: 'share', label: 'Print & share', hue: '#138a9e', groups: [
          ['Print or save pictures', [C('Print or save week table', 'Week table', I.table, { big: true }), C('Print or save visual timeline', 'Timeline', I.timeline, { big: true }), C('Print or save the hourly week', 'Hourly week', I.timeline, { big: true }), C('Print the calendar', 'Calendar', I.calendar, { big: true }), C('Print schedule for a person', 'Person or group', I.person, { big: true }), C('Print availability and contact list', 'Availability list', I.table, { big: true, title: 'Everyone’s phone, positions trained, day-by-day availability and validated, on one landscape page' }), C('Print screen', 'Print screen', I.screen, { big: true })]],
          ['Share', [C('Email or share', 'Email or share', I.mail, { big: true }), C('Save emailable file', 'Emailable file', I.share, { big: true })]],
          ['Save and open', [C('Open', 'Open…', I.folder, { big: true, title: 'Open a saved file. A Save everything file brings back the team, schedules, time off and all the settings.' }), C('Save…', 'Save…', I.save, { big: true }), { col: [C('Save month', 'Save month', I.save), C('Save location', 'Save everything', I.save), C('Save as text or CSV', 'Text or CSV', I.textFile)] }]],
        ] },
      ],
    });
    // Keep the ribbon on the view you are looking at (views also change from links inside the page).
    setInterval(() => { if (VIEWS.includes(ui.tab) && ribbon.current() !== ui.tab && ribbon.current() !== 'share') ribbon.select(ui.tab); }, 400);
    const help = (MENUS.find(([n]) => n === 'Help') || [, []])[1].find((it) => it && it.run);
    window.CraftTitlebar({
      appName: 'ShiftCraft', storageKey: 'shiftcraft', colors: ['#2f6fdd', '#1e9e8a'],
      mount: document.body, toast: (m) => toast(m), logo: LOGO, menus: () => MENUS, ribbon,
      quick: [
        { icon: 'wand', title: 'Start (wizard)', run: showStart },
        { icon: 'save', title: 'Save everything (team, availability, schedules, time off and all settings)', key: 'Ctrl+S', run: () => saveFile('location') },
        { icon: 'open', title: 'Open (load) a saved file: Save everything brings back the team, schedules, time off and all settings', key: 'Ctrl+O', run: () => openFile() },
        { icon: 'undo', title: 'Undo', key: 'Ctrl+Z', run: undo, disabled: () => !undoStack.length },
        { icon: 'print', title: 'Print or save: week table, timeline, calendar or the availability and contact list', run: () => exportImageDialog({ layout: 'table' }) },
        { icon: 'export', title: 'Email or share', run: emailDialog },
        { icon: 'check', title: 'Check the schedule', run: checkDialog },
      ],
      getTitle: () => ui.fileName || placeName(),
      getStatus: () => ({ text: plan.example ? 'Example data · autosaves in this browser' : CA() ? 'Autosaves in this browser and your account' : 'Autosaves in this browser' }),
      getInfo: () => [
        { text: placeName(), title: 'Company and location (click to change)', run: () => { ui.tab = 'company'; persist(); render(); } },
        { text: 'Week of ' + shortDate(weekDays(weekOf(ui.day))[0]), title: 'The week you are working on' },
      ],
      rightEls: [window.CraftAccount && CraftAccount.button ? CraftAccount.button() : null, document.getElementById('theme-btn')].filter(Boolean),
      onHelp: help ? help.run : null,
    });
    // the top line keeps what you act on (menu, quick buttons, search, Log in, theme, help); what you are working on (the
    // store, the week) is always on the second line, at the right of the ribbon's tabs
    { const info = document.querySelector('.ctb-info'), extra = document.querySelector('.crb-extra'); if (info && extra) extra.prepend(info); }
    const ic = document.createElement('link'); ic.rel = 'icon';
    ic.href = 'data:image/svg+xml,' + encodeURIComponent(LOGO.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
    document.head.append(ic);
    try { if (localStorage.getItem(START_KEY) !== '0') showStart(); } catch (e) { showStart(); }
  }

