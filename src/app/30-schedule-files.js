  // ===================================================================
  // Schedule files for any span of days (a day, a week, weeks, a month)
  // ===================================================================
  function scheduleRange(start, nDays, month) {
    const days = daysFrom(start, nDays);
    const used = new Set();
    days.forEach((d) => shiftsOn(d).forEach((s) => used.add(s.staffId)));
    return { app: 'ShiftCraft', kind: 'weeks', version: 5, company: plan.company, location: plan.location, splh: plan.splh,
      startDate: start, days: nDays, weeks: nDays % 7 === 0 ? nDays / 7 : 0, month: month || null,
      people: plan.staff.filter((p) => used.has(p.id)).map((p) => ({ id: p.id, name: p.name, role: p.role })),
      shifts: Object.fromEntries(days.map((d) => [d, shiftsOn(d)])),
      forecast: Object.fromEntries(days.filter((d) => plan.forecast[d] != null && plan.forecast[d] !== '').map((d) => [d, plan.forecast[d]])),
      history: Object.fromEntries(Object.entries(plan.history).filter(([d]) => d >= addDays(start, -28) && d <= days[days.length - 1])) };
  }
  // A day file goes onto the day you pick.
  function placeDaysDialog(data, name) {
    const n = Math.max(1, +data.days || 1), fileDays = daysFrom(data.startDate, n);
    const people = data.people || data.staff || [];
    const when = h('select', { class: 'input' }, h('option', { value: data.startDate }, `Its own date: ${dayName(data.startDate)} ${shortDate(data.startDate)}`), data.startDate !== ui.day ? h('option', { value: ui.day }, `The day you are viewing: ${dayName(ui.day)} ${shortDate(ui.day)}`) : null, h('option', { value: 'pick' }, 'Another date…'));
    const pick = h('input', { class: 'input', type: 'date', value: ui.day, hidden: true });
    when.addEventListener('change', () => { pick.hidden = when.value !== 'pick'; });
    modal({ title: `Open ${n === 1 ? 'a day' : n + ' days'}: ${shortDate(fileDays[0])}${n > 1 ? ' – ' + shortDate(fileDays[n - 1]) : ''}`, body: [
      h('p', { class: 'muted' }, `From ${name}. ${people.length} people; anyone not on your team is added.`),
      h('label', { class: 'field' }, h('span', null, 'Put it on'), when), pick,
      h('p', { class: 'hint' }, 'Shifts already on that day are replaced. You can undo this.')],
    actions: [{ label: 'Cancel' }, { label: 'Open', primary: true, onClick: () => {
      const start = when.value === 'pick' ? pick.value : when.value;
      if (!start) return false;
      const target = daysFrom(start, n);
      change(() => {
        dropExample();
        const map = mergeStaff(people);
        fileDays.forEach((fd, i) => {
          plan.shifts[target[i]] = (data.shifts[fd] || []).map((s) => ({ ...s, id: uid(), staffId: map[s.staffId] || s.staffId }));
          if (data.forecast && data.forecast[fd] != null) plan.forecast[target[i]] = data.forecast[fd];
        });
        Object.assign(plan.history, data.history || {});
        if (planDays().includes(target[0])) ui.day = target[0];
      });
      ui.fileName = name; render(); toast(planDays().includes(target[0]) ? `Opened ${name}` : `Opened ${name} onto ${shortDate(target[0])} (outside the weeks shown; pick that month at the top to see it)`);
    } }] });
  }
  // The one Save dialog: what, then (for schedules) how much.
  // ---- Save: where it goes. This computer (a file you keep), the server (your location, or your own account copy), and
  // what this browser keeps by itself. Ctrl+S and the Save button open it; the likely choice is ready for Enter.
  const SAVE_ICON = {
    file: '<svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true"><rect x="8" y="6" width="32" height="36" rx="3" fill="#3b82f6"/><rect x="14" y="6" width="20" height="12" rx="1" fill="#dbeafe"/><rect x="28" y="8" width="4" height="8" fill="#3b82f6"/><rect x="13" y="25" width="22" height="13" rx="2" fill="#eff6ff"/><path d="M17 30h14M17 34h10" stroke="#93c5fd" stroke-width="2"/></svg>',
    cloud: '<svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true"><path d="M14 38h22a9 9 0 0 0 1.4-17.9A13 13 0 0 0 12.2 18 10 10 0 0 0 14 38z" fill="#0ea5e9"/><path d="M24 33V21m-6 6 6-6 6 6" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    browser: '<svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true"><rect x="5" y="9" width="38" height="30" rx="4" fill="#64748b"/><rect x="5" y="9" width="38" height="7" rx="3" fill="#475569"/><circle cx="10" cy="12.5" r="1.6" fill="#f87171"/><circle cx="15" cy="12.5" r="1.6" fill="#fbbf24"/><circle cx="20" cy="12.5" r="1.6" fill="#34d399"/><path d="M15 29l5 5 13-12" fill="none" stroke="#bbf7d0" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  function saveDialog() {
    const A = CA(), l = curLoc(), st = accState(), icon = (k) => { const s = h('span', { class: 'save-ic' }); s.innerHTML = SAVE_ICON[k]; return s; };
    const card = (k, title, sub, kids) => h('div', { class: 'save-card' }, h('div', { class: 'save-head' }, k === 'cloud' && companyLogo() ? h('img', { src: companyLogo(), alt: '', style: { width: '44px', height: '44px', objectFit: 'contain', borderRadius: '6px', background: '#fff' } }) : icon(k), h('div', null, h('b', null, title), h('div', { class: 'muted small' }, sub))), h('div', { class: 'save-btns' }, ...kids));
    const btn = (label, desc, run, o = {}) => h('button', { type: 'button', class: 'btn' + (o.primary ? ' primary' : ''), title: desc, disabled: !!o.disabled, onclick: () => { close(); run(); } }, label);
    let close = () => {};
    const cloudLine = !A ? 'Log in to save on the server: the same schedule at work and at home, shared with the people at your location.'
      : plan.example ? 'This is the example schedule: open or make your own first.'
      : l ? `${l.company ? l.company + ' › ' : ''}${l.name}: shared with everyone who works there.${st.synced ? ' Last saved ' + new Date(st.synced).toLocaleString() + '.' : ' Not saved there yet.'}${!locSaves() ? ' You can look here, not save (' + LROLE[l.role] + ').' : ''}`
      : `Your own account (only you see it).${st.synced ? ' Last saved ' + new Date(st.synced).toLocaleString() + '.' : ''}`;
    const body = h('div', { class: 'save-grid' },
      card('cloud', 'The server' + (A ? serverWhere() : ''), cloudLine, !A ? [btn('Log in…', 'Log in with your Craft account', () => window.CraftAccount && CraftAccount.loginDialog && CraftAccount.loginDialog(), { primary: true })] : [
        btn('Save: this browser → server', 'Everything (team, schedules, time off, calendar, settings, store profile, designs), now', saveToServer, { primary: !plan.example && locSaves(), disabled: plan.example || !locSaves() }),
        btn('Load: server → this browser', 'What is open here is replaced by the server’s copy (Undo brings it back)', loadFromServer),
        btn('📍 Switch location…', 'Open another location you work at', chooseLocation),
        btn('⇄ Bring in from another location or account…', 'Replace or merge what is open here with a schedule you can open', bringIn)]),
      card('file', 'This computer (a file)', 'A .json file you keep, copy or email. Everything: the team, every week, time off, calendar, forecast, settings, store profile and designs.', [
        btn('Save: this browser → file (everything)', 'Saves a file with everything', () => saveFile('location'), { primary: !A || plan.example }),
        btn('Save as… (choose the folder and name)', 'Saves everything, asking where', () => saveFile('location', { as: true })),
        btn('Save a part only…', 'This week, the month, the team or one day', () => saveAsDialog({ what: 'schedule' })),
        btn('📂 Load: file → this browser', 'Opens a saved file', () => openFile())]),
      card('browser', 'This browser', 'Every change is kept here by itself, as you work (even with nobody logged in). It stays on this computer and in this browser only.', [
        h('span', { class: 'muted small' }, plan.example ? 'Example data: not kept.' : `Kept now: ${plan.staff.length} people, ${Object.keys(plan.shifts).length} days with shifts.`)]));
    close = modal({ title: 'Save', wide: true, body, actions: [{ label: 'Close' }] }).close;
    setTimeout(() => { const p = document.querySelector('.save-grid .btn.primary:not([disabled])'); if (p) p.focus(); }, 0);
  }
  function saveAsDialog(preset = {}) {
    const c = { what: preset.what || 'all', range: preset.range || 'week' };
    const wkFrom = h('select', { class: 'input' }, Array.from({ length: plan.weeks }, (_, k) => h('option', { value: k, selected: k === weekOf(ui.day) }, `Week ${k + 1} (${shortDate(weekDays(k)[0])})`)));
    const wkCount = h('select', { class: 'input' }, Array.from({ length: plan.weeks }, (_, k) => h('option', { value: k + 1, selected: k === 1 }, `${k + 1} week${k ? 's' : ''}`)));
    const custom = h('div', { class: 'inline', hidden: c.range !== 'weeks' }, h('label', { class: 'field' }, h('span', null, 'Starting'), wkFrom), h('label', { class: 'field' }, h('span', null, 'How many'), wkCount));
    const ranges = [['day', `Day (${dayName(ui.day, 'short')} ${shortDate(ui.day)})`], ['week', `Week (week ${weekOf(ui.day) + 1})`], ['month', `Month (all ${plan.weeks} weeks)`], ['weeks', 'Weeks…']];
    const seg = h('div', { class: 'seg' }, ranges.map(([v, l]) => h('button', { type: 'button', class: 'btn sm', 'aria-pressed': String(c.range === v), onclick: (e) => { c.range = v; seg.querySelectorAll('.btn').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); custom.hidden = v !== 'weeks'; } }, l)));
    const schedBox = h('div', { class: 'stack', hidden: c.what !== 'schedule' }, h('span', { class: 'muted small' }, 'How much schedule'), seg, custom);
    const opts = [['all', 'Everything', 'team + schedule: every week and month planned, forecasts, past sales and settings (a Location file)'], ['team', 'Team only', 'the employee list with roles, usual shifts, availability, tasks and checklist'], ['schedule', 'Schedule only', 'shifts, notes and forecasts for a day, week, month or weeks you pick']];
    const radios = h('div', { class: 'stack' }, opts.map(([v, l, desc]) => h('label', { class: 'check', style: { alignItems: 'flex-start' } },
      h('input', { type: 'radio', name: 'savewhat', value: v, checked: c.what === v, onchange: () => { c.what = v; schedBox.hidden = v !== 'schedule'; } }), h('span', null, h('b', null, l), ` – ${desc}`))));
    modal({ title: 'Save', wide: true, body: [h('span', { class: 'muted small' }, 'Save what'), radios, schedBox, h('p', { class: 'hint' }, 'Files are small .json files you can keep, copy or email. Open them with File › Open.')],
      actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: () => {
        if (c.what === 'all') saveFile('location', { as: true });
        else if (c.what === 'team') saveFile('team', { as: true });
        else if (c.range === 'day') saveFile('day', { as: true });
        else if (c.range === 'week') saveFile('weeks', { first: weekOf(ui.day), count: 1, as: true });
        else if (c.range === 'month') saveFile('weeks', { first: 0, count: plan.weeks, as: true });
        else saveFile('weeks', { first: +wkFrom.value, count: +wkCount.value, as: true });
      } }] });
  }

