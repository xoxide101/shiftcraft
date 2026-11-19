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
  // the Save window's server part: which location to save to (remembered), and the button saying where it goes
  function locPickRow() {
    const sel = h('select', { class: 'input', 'aria-label': 'Save to which location' }, h('option', { value: '' }, 'Looking for your locations…'));
    const go = h('button', { type: 'button', class: 'btn primary', disabled: true }, 'Select a location first');
    let list = [];
    const paint = () => { const x = list.find((y) => y.id === sel.value), cur = curLoc();
      if (!x) { go.disabled = true; go.textContent = 'Select a location first'; return; }
      const can = ['admin', 'manager', 'scheduler'].includes(x.myRole);
      go.disabled = plan.example || !can; go.textContent = plan.example ? 'The example schedule is not saved' : !can ? `${LROLE[x.myRole]} at ${x.name}: you cannot save here` : `☁ Computer → Server: ${x.name}${x.number && !String(x.name).includes(x.number) ? ' #' + x.number : ''}`;
      go.title = cur && cur.id === x.id ? 'Your location: saves everything there now' : 'Saves this browser’s schedule to that location; from now on it saves there'; };
    CA().api('GET', 'locations').then((r) => { list = r.locations; const cur = curLoc();
      sel.innerHTML = ''; sel.append(h('option', { value: '' }, list.length ? 'Select a location…' : 'You do not work at a location yet (your account copy instead)'));
      const by = {}; for (const x of list) (by[x.companyName || 'No company'] = by[x.companyName || 'No company'] || []).push(x);
      for (const [co, ls] of Object.entries(by)) sel.append(h('optgroup', { label: co }, ...ls.map((x) => h('option', { value: x.id, selected: !!(cur && cur.id === x.id) }, `📍 ${x.name}${x.number && !String(x.name).includes(x.number) ? ' #' + x.number : ''} · ${LROLE[x.myRole] || x.myRole}${x.lastSaved ? '' : ' · nothing saved yet'}`))));
      if (!list.length) { go.disabled = plan.example; go.textContent = '☁ Computer → Server: your account (private copy)'; go.onclick = () => { closeSave(); saveToServer(); }; return; }
      paint(); }).catch(() => { sel.innerHTML = '<option value="">The server could not be reached</option>'; });
    sel.onchange = paint;
    go.onclick = async () => { const x = list.find((y) => y.id === sel.value); if (!x) return; closeSave(); await saveToLocation(x); };
    return h('div', { class: 'save-loc' }, h('label', { class: 'muted small' }, 'Save to which location'), sel, go);
  }
  let closeSave = () => {}, saveTab = 'server';
  try { saveTab = localStorage.getItem(KEY + '-savetab') || 'server'; } catch (e) { /* blocked */ }
  // ---- Save: on the left, where (the server, this computer, this browser, backups); on the right, what you can do there,
  // each a big row saying exactly what happens. Ctrl+S, the Save button and File › Save… open it.
  function saveDialog() {
    const A = CA(), l = curLoc(), st = accState();
    const icon = (k, px = 26) => { const sp = h('span', { class: 'save-ic' }); sp.innerHTML = SAVE_ICON[k].replace(/width="44" height="44"/, `width="${px}" height="${px}"`); return sp; };
    // one action: a big row (title, what it does), and what happens on a click
    const act = (title, desc, run, o = {}) => h('button', { type: 'button', class: 'save-act' + (o.primary ? ' primary' : ''), disabled: !!o.disabled, onclick: () => { closeSave(); run(); } }, h('span', { class: 'save-act-ic' }, o.ic || ''), h('span', null, h('b', null, title), h('small', null, desc)));
    const right = h('div', { class: 'save-pane' }), nav = h('div', { class: 'save-nav', role: 'tablist' });
    const PLACES = [['server', 'cloud', 'Server (cloud)', A ? (l ? l.name : 'your account') : 'log in first'], ['file', 'file', 'File', 'a .json file you keep'], ['browser', 'browser', 'Computer', 'what is open here'], ['backups', 'cloud', 'Backups', 'copies kept for you']];
    const head = (k, title, sub) => h('div', { class: 'save-pane-head' }, k === 'server' && companyLogo() ? h('img', { src: companyLogo(), alt: '', class: 'save-logo' }) : icon(k === 'backups' ? 'cloud' : k, 44), h('div', null, h('h3', null, title), h('div', { class: 'muted' }, sub)));
    const panes = {
      server: () => !A ? [head('server', 'Server (cloud)', 'Log in to use the server: the same schedule at work and at home, shared with the people at your location.'), act('Log in…', 'With your Craft user ID and password', () => window.CraftAccount && CraftAccount.loginDialog && CraftAccount.loginDialog(), { primary: true, ic: '👤' })]
        : [head('server', 'Server (cloud)' + serverWhere(), plan.example ? 'This is the example schedule: open or make your own first.' : l ? `${l.company ? l.company + ' › ' : ''}${l.name}: shared with everyone who works there.${st.synced ? ' Last saved ' + new Date(st.synced).toLocaleString() + '.' : ' Not saved there yet.'}` : `Choose a location below, or it saves to your own account (only you see it).${st.synced ? ' Last saved ' + new Date(st.synced).toLocaleString() + '.' : ''}`),
          h('div', { class: 'save-group' }, h('div', { class: 'save-group-t' }, 'Computer → Server (save)'), locPickRow()),
          h('div', { class: 'save-group' }, h('div', { class: 'save-group-t' }, 'Server → Computer (open)'),
            act('Server → Computer: open the server’s copy', `What is open on this computer is replaced by the copy on the server${serverWhere()} (yours is kept as a backup).`, loadFromServer, { ic: '⬇' }),
            act('Server → Computer: open another location…', 'Another location you work at: its schedule opens on this computer, from the server.', chooseLocation, { ic: '📍' }),
            act('Server → Computer: bring in from another location or account…', 'Another location’s schedule (or a copy in your account) into what is open: replace it, or merge the two.', bringIn, { ic: '⇄' }))],
      file: () => [head('file', 'File', 'A .json file you keep, copy or email. “Everything” holds the team, every week, time off, calendar, forecast, settings, store profile and designs.'),
        h('div', { class: 'save-group' }, h('div', { class: 'save-group-t' }, 'Computer → File (save)'),
          act('Computer → File: everything', 'A file with all of it, in your usual folder.', () => saveFile('location'), { primary: !A || plan.example, ic: '💾' }),
          act('Computer → File as…: everything', 'Choose the folder and the file’s name.', () => saveFile('location', { as: true }), { ic: '💾' }),
          act('Computer → File: a part only…', 'This week, the month, the team or one day.', () => saveAsDialog({ what: 'schedule' }), { ic: '✂' })),
        h('div', { class: 'save-group' }, h('div', { class: 'save-group-t' }, 'File → Computer (open)'),
          act('File → Computer: open a file…', 'A saved file comes in (an everything file replaces what is open; Undo brings it back).', () => openFile(), { ic: '📂' }))],
      browser: () => [head('browser', 'Computer', 'What is open here. Every change is kept on this computer by itself as you work, also with nobody logged in (in this browser only).'),
        h('div', { class: 'save-facts' }, ...COUNT_NAMES.map(([k, n]) => h('div', null, h('b', null, String(planCounts(plan)[k])), h('span', null, n)))),
        h('p', { class: 'muted' }, plan.example ? 'This is the example schedule: it is not kept.' : 'To have it elsewhere too: Computer → Server (shared) or Computer → File.')],
      backups: () => { const box = h('div', { class: 'save-group' }, h('p', { class: 'muted' }, 'Looking…'));
        listBackups().then((list) => { box.innerHTML = ''; if (!list.length) { box.append(h('p', { class: 'muted' }, 'No backups yet. One is kept whenever a copy is replaced by a different one.')); return; }
          list.forEach((x) => { const n = x.note || {}, k = n.kept || planCounts(x.plan), d = n.difference;
            box.append(h('div', { class: 'save-bk' }, h('div', null, h('b', null, new Date(n.at || x.savedAt).toLocaleString()), h('div', { class: 'muted small' }, `${n.why || 'backup'} · ${x.where} · ${k.people} people, ${k.days} day${k.days === 1 ? '' : 's'} with shifts, ${k.events} event${k.events === 1 ? '' : 's'}${d ? ' · the other had ' + Object.entries(d).filter(([, v]) => v).map(([kk, v]) => `${v > 0 ? '+' : ''}${v} ${(COUNT_NAMES.find((c) => c[0] === kk) || [kk, kk])[1].toLowerCase()}`).join(', ') : ''}`)),
              h('div', { class: 'save-bk-b' }, h('button', { type: 'button', class: 'btn sm', onclick: () => { closeSave(); extrasBack(x.extras); takePlan(x.plan, x.savedAt, accState().base || '', 'Opened the backup from ' + new Date(n.at || x.savedAt).toLocaleString()); setAcc({ dirty: true }); } }, '→ Computer'),
                h('button', { type: 'button', class: 'btn sm', onclick: () => downloadBlob(`${placeName()} - backup ${String(n.at || x.savedAt).slice(0, 16).replace(/[:T]/g, '-')}.json`, new Blob([JSON.stringify({ ...x.plan, app: 'ShiftCraft', kind: 'location', version: 4 }, null, 2)], { type: 'application/json' })) }, '→ File')))); }); }).catch((e) => { box.innerHTML = ''; box.append(h('p', { class: 'muted' }, e.message)); });
        return [head('backups', 'Backups', 'Kept for you whenever one copy replaced a different one (on the server when logged in, on this computer when not). Open one, or download it as a file.'), box]; },
    };
    const show = (k) => { saveTab = k; try { localStorage.setItem(KEY + '-savetab', k); } catch (e) { /* blocked */ } nav.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.k === k))); right.innerHTML = ''; right.append(...panes[k]()); setTimeout(() => { const p = right.querySelector('.save-act.primary:not([disabled]), .btn.primary:not([disabled])'); if (p) p.focus(); }, 0); };
    PLACES.forEach(([k, ic, t, sub]) => nav.append(h('button', { type: 'button', role: 'tab', 'data-k': k, onclick: () => show(k) }, icon(ic), h('span', null, h('b', null, t), h('small', null, sub)))));
    const m = modal({ title: 'Save and open: Computer · Server · File', wide: true, body: h('div', { class: 'save-wrap' }, nav, right), actions: [{ label: 'Close' }] }); closeSave = m.close; m.el.classList.add('save-dialog');
    show(PLACES.some((p) => p[0] === saveTab) ? saveTab : 'server');
  }
  // the backups: this location's (or your account's) on the server, and this browser's own
  async function listBackups() {
    const out = [], A = CA(), l = curLoc();
    if (A) { try { if (l) { const o = await A.api('GET', `locations/${l.id}/data/shiftcraft`); for (const [k, v] of Object.entries(o)) if (/^backup /.test(k) && v.value && v.value.plan) out.push({ ...v.value, where: '☁ ' + l.name + (v.by ? ' (by ' + v.by + ')' : '') }); }
      else { const o = await A.all('shiftcraft'); for (const [k, v] of Object.entries(o || {})) if (/^backup /.test(k) && v.value && v.value.plan) out.push({ ...v.value, where: '☁ your account' }); } } catch (e) { /* not now */ } }
    try { for (const x of JSON.parse(localStorage.getItem(KEY + '-backups') || '[]')) out.push({ ...x, where: '🖥 this browser' }); } catch (e) { /* none */ }
    return out.sort((a, b) => String((b.note || {}).at || b.savedAt).localeCompare(String((a.note || {}).at || a.savedAt)));
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

