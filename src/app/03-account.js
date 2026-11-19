  // ===================================================================
  // Your account (AccountCraft). Two ways of keeping the plan there:
  //   A location (AccountCraft › Companies › a location): the plan belongs to the location, shared by everyone working
  //     there ('shiftcraft' / 'plan' in the location). Each save says which copy it started from; when someone else saved
  //     in between, you choose: theirs, yours, or yours kept as a file and theirs opened. View only and associates look.
  //   No location chosen: your own copy, as before ('shiftcraft' / 'plan <Company · Location>' in your account).
  // Each change is sent a few seconds later; on opening (and when the window comes back into view) a newer copy is taken.
  // ===================================================================
  const ACC = KEY + '-account';
  const accState = () => { try { return JSON.parse(localStorage.getItem(ACC)) || {}; } catch (e) { return {}; } };
  const setAcc = (o) => { try { localStorage.setItem(ACC, JSON.stringify({ ...accState(), ...o })); } catch (e) { /* blocked */ } };
  const accKey = () => ('plan ' + (placeName().replace(/[^\w.\- ]+/g, ' ').replace(/\s+/g, ' ').trim() || 'My store')).slice(0, 100);
  const CA = () => (window.CraftAccount && CraftAccount.user() && (!CraftAccount.allowed || CraftAccount.allowed('shiftcraft')) ? CraftAccount : null);
  const LROLE = { admin: 'Admin', manager: 'Location manager', scheduler: 'Scheduler', associate: 'Associate', viewer: 'View only' };
  // the location open here (for this login): { id, name, number, company, role }
  const curLoc = () => { const s = accState(), u = window.CraftAccount && CraftAccount.user(); return s.loc && u && s.loc.user === u.id ? s.loc : null; };
  const locSaves = () => { const l = curLoc(); return !l || ['admin', 'manager', 'scheduler'].includes(l.role); };
  const locPath = (l) => `locations/${l.id}/data/shiftcraft/plan`;
  const locLabel = (l) => (l.number && !String(l.name).includes(l.number) ? `${l.name} ${l.number}` : l.name);
  let accAgain = false, accT = 0, accBusy = false, accLast = '', accQuiet = false, accSeen = 0, viewTold = false;
  function accountSoon(txt) {
    if (txt === accLast) return; accLast = txt;
    if (accQuiet || !CA() || plan.example) return;
    if (!locSaves()) { if (!viewTold) { viewTold = true; toast(`${LROLE[curLoc().role]} at ${curLoc().name}: changes stay in this browser and are not saved for the location.`); } return; }
    setAcc({ dirty: true }); clearTimeout(accT); accT = setTimeout(accountSend, 4000);
  }
  async function accountSend(force) {
    const A = CA(); if (!A || plan.example) return;
    const savedAt = new Date().toISOString(), l = curLoc();
    try {
      if (!l) { await A.put('shiftcraft', accKey(), { savedAt, plan }); setAcc({ synced: savedAt, dirty: false }); return; }
      if (!locSaves()) return;
      const r = await A.api('PUT', locPath(l), { value: { savedAt, plan }, base: accState().base || '', force: !!force });
      setAcc({ base: r.changed, synced: savedAt, dirty: false });
    } catch (e) {
      if (e.status === 413) toast('This plan is too big for your account (over 4 MB): Settings › Clear old weeks.');
      else if (e.status === 409) locConflict(e.info || {});
      else if (e.status === 403 && l) toast(e.message);
    }
  }
  // someone else saved the location since this browser opened it
  function locConflict(info) {
    const l = curLoc(); if (!l || document.querySelector('.loc-conflict')) return;
    modal({ title: `${info.by || 'Someone'} saved ${l.name} since you opened it`, body: h('div', { class: 'loc-conflict' },
        h('p', null, `${info.by || 'Someone'} saved ${l.name} at ${info.changed ? new Date(info.changed).toLocaleString() : 'just now'}, and this browser has changes of its own. Which one do you want to keep?`),
        h('p', { class: 'muted' }, 'Keep both: yours is saved as a file first, then theirs opens (nothing is lost).')),
      actions: [{ label: 'Keep mine', onClick: () => accountSend(true) },
        { label: 'Keep both', onClick: () => { downloadBlob(`${placeName()} - my copy.json`, new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' })); locTake(true); } },
        { label: 'Keep theirs', primary: true, onClick: () => locTake(true) }] });
  }
  async function locTake(quietly) {
    const A = CA(), l = curLoc(); if (!A || !l) return;
    try { const r = await A.api('GET', locPath(l)); takePlan(r.value.plan, r.value.savedAt, r.changed, `${l.name}: opened the copy ${r.by ? 'saved by ' + r.by + ', ' : ''}${new Date(r.changed).toLocaleString()}`, quietly); } catch (e) { toast(e.message); }
  }
  function takePlan(np, savedAt, base, note, quiet) {
    snapshot(); normalize(np); const l = curLoc(); if (l) { np.location = locLabel(l); np.company = l.company || np.company; }
    accQuiet = true; plan = np; delete plan.example; persist(); accQuiet = false; accLast = JSON.stringify(plan); setAcc({ synced: savedAt, base: base || '', dirty: false }); render();
    if (!quiet || note) toast(note + ' (Undo brings back this browser’s)');
  }
  async function accountCheck() {
    const A = CA(); if (!A) return; if (accBusy) { accAgain = true; return; } accBusy = true; accSeen = Date.now();
    try {
      const st = accState(), l = curLoc();
      if (l) {
        let r = null; try { r = await A.api('GET', locPath(l)); } catch (e) { if (e.status === 403) { setAcc({ loc: null }); toast(`You no longer work at ${l.name}: back to this browser’s plan.`); render(); return; } if (e.status !== 404) throw e; }
        if (!r) return locEmpty(l);
        if (r.changed === st.base) { if (st.dirty && locSaves()) await accountSend(); return; }
        try { const same = JSON.parse(JSON.stringify(r.value.plan)); normalize(same); if (JSON.stringify(same.staff) === JSON.stringify(plan.staff) && JSON.stringify(same.shifts) === JSON.stringify(plan.shifts)) { setAcc({ base: r.changed, synced: r.value.savedAt }); if (st.dirty && locSaves()) await accountSend(); return; } } catch (e) { /* compare below */ }
        if (!st.dirty || plan.example || !locSaves()) return takePlan(r.value.plan, r.value.savedAt, r.changed, `${l.name}: opened the copy ${r.by ? 'saved by ' + r.by + ', ' : ''}${new Date(r.changed).toLocaleString()}`);
        return locConflict({ by: r.by, changed: r.changed });
      }
      const r = await A.get('shiftcraft', accKey());
      if (!r || !r.plan) { if (!plan.example) await accountSend(); return; }
      if (r.savedAt === st.synced) { if (st.dirty) await accountSend(); return; }
      const take = () => takePlan(r.plan, r.savedAt, '', `Opened your account’s copy, saved ${new Date(r.savedAt).toLocaleString()}`);
      if (!st.dirty || plan.example) return take();
      modal({ title: 'Your account has a newer copy', body: h('p', null, `Your account’s copy of ${placeName()} was saved ${new Date(r.savedAt).toLocaleString()} on another computer, and this browser has changes of its own since then. Which one do you want to keep?`),
        actions: [{ label: 'Keep this browser’s', onClick: () => { accountSend(); } }, { label: 'Open the account’s', primary: true, onClick: take }] });
    } catch (e) { /* not reachable now: tried again later */ } finally { accBusy = false; if (accAgain) { accAgain = false; setTimeout(() => accountCheck().then(render), 0); } }
  }
  // a location with nothing saved yet: bring in what is open here, or start new
  function locEmpty(l) {
    const st0 = document.getElementById('sc-start'); if (st0) st0.hidden = true;
    if (!locSaves()) { toast(`${l.name} has nothing saved yet: its managers bring in the schedule.`); return; }
    const here = !plan.example && (plan.staff || []).length;
    if (here && accState().auto) { setAcc({ auto: false }); plan.location = locLabel(l); if (l.company) plan.company = l.company; setAcc({ base: '' }); persist(); return accountSend(true).then(() => { render(); toast(`Saved this schedule as ${l.company ? l.company + ' › ' : ''}${l.name}: everyone working there sees it now.`); }); }
    modal({ title: `${l.name} has nothing saved yet`, body: h('div', null,
        h('p', null, here ? `Bring in what is open here (${placeName()}: ${plan.staff.length} people, ${Object.keys(plan.shifts || {}).length} days with shifts) as ${l.name}’s schedule, for everyone who works there?` : `Start ${l.name} new? (Or open a schedule file first with File › Open, then choose the location again.)`)),
      actions: [{ label: 'Not now', onClick: () => { setAcc({ loc: null }); render(); } },
        ...(here ? [{ label: 'Start new instead', onClick: () => locNew(l) }] : []),
        { label: here ? 'Bring it in' : 'Start new', primary: true, onClick: () => (here ? (() => { plan.location = locLabel(l); if (l.company) plan.company = l.company; setAcc({ base: '' }); persist(); accountSend(true).then(() => { render(); toast(`${l.name} now has this schedule: everyone working there sees it.`); }); })() : locNew(l)) }] });
  }
  function locNew(l) {
    snapshot(); const np = { app: 'ShiftCraft', version: 2, company: l.company || '', location: locLabel(l), splh: 85, startDate: mondayOf(iso(new Date())), weeks: 4, staff: [], shifts: {}, forecast: {}, history: {} };
    normalize(np); accQuiet = true; plan = np; persist(); accQuiet = false; setAcc({ base: '' }); accountSend(true).then(render); toast(`${l.name}: a new, empty schedule (Undo brings back the one before).`);
  }
  // choosing the location (the title bar's store chip, and once after logging in)
  async function chooseLocation() {
    const A = CA(); if (!A) { ui.tab = 'company'; persist(); render(); return; }
    const st0 = document.getElementById('sc-start'); if (st0) st0.hidden = true;
    let list = []; try { list = (await A.api('GET', 'locations')).locations; } catch (e) { toast(e.message); return; }
    const cur = curLoc(), u = A.user(), by = {};
    for (const x of list) (by[x.companyName || 'No company'] = by[x.companyName || 'No company'] || []).push(x);
    const pick = (x) => { if (accState().dirty && cur && locSaves()) accountSend(); setAcc({ loc: x ? { id: x.id, name: x.name, number: x.number || '', company: x.companyName || '', role: x.myRole, user: u.id } : null, base: '', synced: '', dirty: false }); viewTold = false; document.querySelectorAll('.backdrop').forEach(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))); accountCheck().then(render); };
    modal({ title: 'Which location?', wide: true, body: h('div', null,
      list.length ? Object.entries(by).map(([co, ls]) => h('div', null, h('h3', { style: 'margin:10px 0 4px' }, co),
        ...ls.map((x) => h('button', { class: 'btn' + (cur && cur.id === x.id ? ' primary' : ''), style: 'display:flex;width:100%;justify-content:space-between;margin:4px 0', onclick: () => pick(x) },
          h('span', null, `📍 ${x.name}${x.number ? ' #' + x.number : ''}`), h('span', { class: 'muted' }, `${LROLE[x.myRole] || x.myRole}${x.lastSaved ? ' · saved ' + new Date(x.lastSaved).toLocaleDateString() : ' · nothing saved yet'}`)))))
        : h('p', null, 'You do not work at a location yet: the admin or a location manager adds you (AccountCraft › Companies).'),
      h('p', { class: 'muted', style: 'margin-top:12px' }, cur ? `Open now: ${cur.name}. ` : '', 'A location’s schedule is shared by everyone who works there.')),
      actions: [{ label: 'Just this browser (no location)', onClick: () => pick(null) }, { label: 'Manage locations…', onClick: () => window.open(A.server().replace(/account\.php$/, ''), '_blank') }] });
  }
  // logged in, no location chosen yet, and you work at some: ask once (per login)
  const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function matchLocation(list) {
    if (plan.example || !(plan.staff || []).length) return null;
    const mine = norm(`${plan.company} ${plan.location}`), nums = mine.match(/\b\d{3,}\b/g) || [];
    let hits = list.filter((x) => x.number && nums.includes(norm(x.number)));
    if (hits.length > 1) hits = hits.filter((x) => mine.includes(norm(x.name).replace(/\b\d{3,}\b/g, '').trim()));
    if (!hits.length) hits = list.filter((x) => norm(x.name).length > 2 && mine.includes(norm(x.name).replace(/\b\d{3,}\b/g, '').trim()));
    if (hits.length > 1) { const co = hits.filter((x) => x.companyName && mine.includes(norm(x.companyName))); if (co.length) hits = co; }
    return hits.length === 1 ? hits[0] : null;
  }
  function askLocationOnce() {
    const A = CA(), u = A && A.user(); if (!A) return;
    // opened from AccountCraft (Open in ShiftCraft): that location
    const want = new URLSearchParams(location.search).get('location');
    if (want) { try { history.replaceState(null, '', location.pathname); } catch (e) { /* a file */ } setAcc({ asked: u.id });
      if (curLoc() && curLoc().id === want) return;
      return A.api('GET', 'locations').then((r) => { const x = r.locations.find((l) => l.id === want); if (!x) return toast('You do not work at that location (ask its manager or the admin).');
        if (accState().dirty && curLoc() && locSaves()) accountSend();
        setAcc({ loc: { id: x.id, name: x.name, number: x.number || '', company: x.companyName || '', role: x.myRole, user: u.id }, base: '', synced: '', dirty: false }); viewTold = false; return accountCheck().then(render); }).catch(() => {}); }
    if (curLoc() || accState().asked === u.id) return; setAcc({ asked: u.id });
    A.api('GET', 'locations').then((r) => {
      if (!r.locations.length) return;
      const m = matchLocation(r.locations);
      if (m) { setAcc({ loc: { id: m.id, name: m.name, number: m.number || '', company: m.companyName || '', role: m.myRole, user: u.id }, base: '', synced: '', dirty: true, auto: true }); toast(`This schedule is ${m.companyName ? m.companyName + ' › ' : ''}${m.name}: linked to that location.`); return accountCheck().then(render); }
      chooseLocation();
    }).catch(() => {});
  }
  window.addEventListener('craft-account', () => {
    if (window.CraftAccount && CraftAccount.user() && CraftAccount.allowed && !CraftAccount.allowed('shiftcraft')) toast('Your account is not set up for ShiftCraft (ask the admin): it saves in this browser only.');
    askLocationOnce();
    accountCheck(); if (started) render();
  });
  window.addEventListener('focus', () => { if (Date.now() - accSeen > 60000) accountCheck(); });
