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
  // the location's own things kept beside the plan in this browser: the store profile, border designs, decorations, page
  // notes, contact cards and availability-list choices. They go to the server with the plan, and come back with it.
  const EXTRA_KEYS = () => [KEY + '-place', KEY + '-borders', KEY + '-deco', KEY + '-print-notes', KEY + '-cards', KEY + '-avail-details'];
  const extrasNow = () => { const o = {}; try { for (const k of EXTRA_KEYS()) { const v = localStorage.getItem(k); if (v != null) o[k] = v; } } catch (e) { /* blocked */ } return o; };
  const extrasBack = (o) => { if (!o || typeof o !== 'object') return; try { for (const k of EXTRA_KEYS()) if (typeof o[k] === 'string') localStorage.setItem(k, o[k]); } catch (e) { /* blocked */ } };
  // what the title bar says about the server copy
  let accSending = false, accErr = '';
  function serverState() {
    const A = CA(), l = curLoc(), st = accState();
    if (!A) return null;
    if (plan.example) return { text: '☁ example: not saved', title: 'The example schedule is not saved to the server' };
    if (l && !locSaves()) return { text: '☁ ' + LROLE[l.role], title: `You look at ${l.name}; your changes stay in this browser` };
    if (accSending) return { text: '☁ saving…', title: 'Saving to the server' };
    if (accErr) return { text: '☁ not saved', title: accErr + ' (click to try again)', run: () => saveToServer() };
    if (st.dirty) return { text: '☁ saving soon', title: 'Changes go to the server a few seconds after you stop (click to save now)', run: () => saveToServer() };
    if (st.synced) return { text: '☁ saved ' + new Date(st.synced).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), title: `Saved to the server${l ? ' for ' + l.name : ' in your account'}: ${new Date(st.synced).toLocaleString()} (click to save again)`, run: () => saveToServer() };
    return { text: '☁ not saved yet', title: 'Click to save to the server', run: () => saveToServer() };
  }
  const serverWhere = () => { const l = curLoc(); return l ? ` (${l.name}${l.number && !String(l.name).includes(l.number) ? ' #' + l.number : ''})` : CA() ? ' (your account)' : ' (log in first)'; };
  // ☁ Load: server → this browser (what is open here is replaced; Undo brings it back)
  async function loadFromServer() {
    const A = CA(); if (!A) { toast('Log in first.'); if (window.CraftAccount && CraftAccount.loginDialog) CraftAccount.loginDialog(); return; }
    const l = curLoc();
    try {
      const r = l ? await A.api('GET', locPath(l)).catch((e) => { if (e.status === 404) return null; throw e; }) : await A.get('shiftcraft', accKey());
      const v = l ? r && r.value : r; if (!v || !v.plan) { toast(`The server has nothing saved${serverWhere()} yet: use ☁ Save first.`); return; }
      const what = `${v.plan.staff.length} people, ${Object.keys(v.plan.shifts || {}).length} days with shifts, saved ${new Date(l ? r.changed : v.savedAt).toLocaleString()}${l && r.by ? ' by ' + r.by : ''}`;
      modal({ title: `☁ Load: server → this browser${serverWhere()}`, body: h('p', null, `What is open here is replaced by the server’s copy (${what}). Undo brings this browser’s back.`),
        actions: [{ label: 'Cancel' }, { label: 'Load it', primary: true, onClick: () => { extrasBack(v.extras); takePlan(v.plan, v.savedAt, l ? r.changed : '', `Loaded from the server${serverWhere()}`); } }] });
    } catch (e) { toast(e.message); }
  }
  // ⇄ Bring in from another location (one you can open) or a copy in your own account: replaces or merges into what is
  // open here, which then goes to this browser's location as usual
  function mergeInto(a, b) {
    const pa = JSON.parse(JSON.stringify(a)), idMap = {}, key = (n) => String(n || '').trim().toLowerCase();
    for (const s of b.staff || []) { const same = pa.staff.find((x) => key(x.name) === key(s.name)); if (same) idMap[s.id] = same.id; else { const n = JSON.parse(JSON.stringify(s)); if (pa.staff.some((x) => x.id === n.id)) n.id = uid(); idMap[s.id] = n.id; pa.staff.push(n); } }
    for (const [d, list] of Object.entries(b.shifts || {})) { const here = (pa.shifts[d] = pa.shifts[d] || []); for (const sh of list) { const n = { ...sh, staffId: idMap[sh.staffId] || sh.staffId }; if (!here.some((x) => x.staffId === n.staffId && x.start === n.start && x.end === n.end)) { n.id = uid(); here.push(n); } } }
    for (const [k, v] of Object.entries(b)) { if (k === 'staff' || k === 'shifts') continue;
      if (pa[k] === undefined) pa[k] = v;
      else if (Array.isArray(pa[k]) && Array.isArray(v)) { const seen = new Set(pa[k].map((x) => JSON.stringify(x))); for (const x of v) if (!seen.has(JSON.stringify(x))) pa[k].push(x); }
      else if (pa[k] && typeof pa[k] === 'object' && v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) if (pa[k][kk] === undefined) pa[k][kk] = vv; }
    return pa;
  }
  async function bringIn() {
    const A = CA(); if (!A) { toast('Log in first: then you can bring in a location’s or your account’s schedule. (A file: 📂 Load.)'); if (window.CraftAccount && CraftAccount.loginDialog) CraftAccount.loginDialog(); return; }
    const l = curLoc(), src = [];
    try { for (const x of (await A.api('GET', 'locations')).locations) if (!l || x.id !== l.id) src.push({ label: `📍 ${x.companyName ? x.companyName + ' › ' : ''}${x.name}${x.number && !String(x.name).includes(x.number) ? ' #' + x.number : ''}`, get: async () => { const r = await A.api('GET', `locations/${x.id}/data/shiftcraft/plan`); return r.value; } }); } catch (e) { /* none */ }
    try { const mine = await A.all('shiftcraft'); for (const [k, v] of Object.entries(mine || {})) if (/^plan /.test(k) && v.value && v.value.plan) src.push({ label: `👤 My account: ${k.slice(5)}`, get: async () => v.value }); } catch (e) { /* none */ }
    if (!src.length) { toast('Nothing else to bring in: no other location or account copy.'); return; }
    const sel = h('select', { class: 'input' }, ...src.map((s, i) => h('option', { value: i }, s.label)));
    const go = async (how) => { try { const v = await src[+sel.value].get(); if (!v || !v.plan) return toast('That one has nothing saved.'); const np = how === 'merge' ? mergeInto(plan, v.plan) : v.plan;
      if (l) { np.location = locLabel(l); np.company = l.company || np.company; }
      snapshot(); normalize(np); plan = np; delete plan.example; persist(); render(); toast(`${how === 'merge' ? 'Merged' : 'Brought in'}: ${src[+sel.value].label.replace(/^\S+ /, '')} → this browser${l ? ', then to ' + l.name + ' on the server' : ''}. (Undo brings back what was here.)`); } catch (e) { toast(e.message); } };
    modal({ title: '⇄ Bring in from another location or account', body: h('div', null,
        h('p', null, `Take a schedule you can open into what is open here${l ? ` (${l.name}, which then saves it to the server for ${l.name})` : ''}.`), h('label', { class: 'field' }, h('span', null, 'From'), sel),
        h('p', { class: 'muted' }, 'Replace: theirs instead of what is here. Merge: people matched by name, their shifts, events, time off and the rest added without doubles. Undo works for both.')),
      actions: [{ label: 'Cancel' }, { label: 'Merge into this', onClick: () => go('merge') }, { label: 'Replace with it', primary: true, onClick: () => go('replace') }] });
  }
  // File › Save to the server, and the title bar's ☁: now, not in a few seconds
  async function saveToServer() {
    const A = CA(); if (!A) { if (window.CraftAccount && CraftAccount.loginDialog) { toast('Log in first: then Save to the server.'); CraftAccount.loginDialog(); } else toast('Saving to the server needs the account page (AccountCraft).'); return; }
    if (plan.example) { toast('This is the example schedule: open or make your own first.'); return; }
    if (!curLoc()) { const r = await A.api('GET', 'locations').catch(() => ({ locations: [] })); if (r.locations.length) { toast('Choose the location to save to.'); return chooseLocation(); } }
    if (!locSaves()) { toast(`${LROLE[curLoc().role]} at ${curLoc().name}: you cannot save the location’s schedule.`); return; }
    clearTimeout(accT); setAcc({ dirty: true }); await accountSend();
    if (!accErr && !accState().dirty) toast(`Saved to the server${curLoc() ? ' for ' + curLoc().name : ' (your account)'}, ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}: everything (team, schedules, time off, calendar, settings).`);
  }
  let accAgain = false, accT = 0, accBusy = false, accLast = '', accQuiet = false, accSeen = 0, viewTold = false;
  function accountSoon(txt) {
    if (txt === accLast) return; accLast = txt;
    if (accQuiet || !CA() || plan.example) return;
    if (!locSaves()) { if (!viewTold) { viewTold = true; toast(`${LROLE[curLoc().role]} at ${curLoc().name}: changes stay in this browser and are not saved for the location.`); } return; }
    setAcc({ dirty: true }); clearTimeout(accT); accT = setTimeout(accountSend, 4000);
  }
  async function accountSend(force) {
    const A = CA(); if (!A || plan.example) return;
    const savedAt = new Date().toISOString(), l = curLoc(), extras = extrasNow();
    accSending = true; accErr = ''; try { render(); } catch (e) { /* starting */ }
    try {
      if (!l) { await A.put('shiftcraft', accKey(), { savedAt, plan, extras }); setAcc({ synced: savedAt, dirty: false }); return; }
      if (!locSaves()) return;
      const r = await A.api('PUT', locPath(l), { value: { savedAt, plan, extras }, base: accState().base || '', force: !!force });
      setAcc({ base: r.changed, synced: savedAt, dirty: false });
    } catch (e) {
      accErr = e.status === 413 ? 'Too big for the server (over 4 MB)' : e.status === 409 ? 'Someone else saved since' : e.status === 403 ? e.message : 'The server could not be reached';
      if (e.status === 413) toast('This plan is too big for the server (over 4 MB): Settings › Clear old weeks.');
      else if (e.status === 409) { accErr = ''; locConflict(e.info || {}); }
      else if (e.status === 403 && l) toast(e.message);
    } finally { accSending = false; try { render(); } catch (e) { /* starting */ } }
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
    try { const r = await A.api('GET', locPath(l)); extrasBack(r.value.extras); takePlan(r.value.plan, r.value.savedAt, r.changed, `${l.name}: opened the copy ${r.by ? 'saved by ' + r.by + ', ' : ''}${new Date(r.changed).toLocaleString()}`, quietly); } catch (e) { toast(e.message); }
  }
  function takePlan(np, savedAt, base, note, quiet) {
    snapshot(); normalize(np); const l = curLoc(); if (l) { np.location = locLabel(l); np.company = l.company || np.company; }
    accQuiet = true; plan = np; delete plan.example; persist(); accQuiet = false; accLast = JSON.stringify(plan); setAcc({ synced: savedAt, base: base || '', dirty: false }); render();
    if (!quiet || note) toast(note + ' (Undo brings back this browser’s)');
  }
  // the company's logo (AccountCraft › the company): kept in this browser for the title bar, the Save window and printouts
  const LOGO_KEY = KEY + '-colog';
  function companyLogo() { try { const o = JSON.parse(localStorage.getItem(LOGO_KEY) || 'null'), l = curLoc(); return o && l && o.company === l.companyId ? o.logo || '' : ''; } catch (e) { return ''; } }
  async function refreshLogo() { const A = CA(), l = curLoc(); if (!A || !l || !l.companyId) return; try { const c = (await A.api('GET', 'companies')).companies.find((x) => x.id === l.companyId); const was = companyLogo(), now = (c && c.logo) || ''; localStorage.setItem(LOGO_KEY, JSON.stringify({ company: l.companyId, logo: now })); if (was !== now) render(); } catch (e) { /* later */ } }
  async function accountCheck() {
    const A = CA(); if (!A) return; if (accBusy) { accAgain = true; return; } accBusy = true; accSeen = Date.now();
    try {
      const st = accState(), l = curLoc();
      if (l) {
        refreshLogo();
        let r = null; try { r = await A.api('GET', locPath(l)); } catch (e) { if (e.status === 403) { setAcc({ loc: null }); toast(`You no longer work at ${l.name}: back to this browser’s plan.`); render(); return; } if (e.status !== 404) throw e; }
        if (!r) return locEmpty(l);
        if (r.changed === st.base) { if (st.dirty && locSaves()) await accountSend(); return; }
        try { const same = JSON.parse(JSON.stringify(r.value.plan)); normalize(same); if (JSON.stringify(same.staff) === JSON.stringify(plan.staff) && JSON.stringify(same.shifts) === JSON.stringify(plan.shifts)) { setAcc({ base: r.changed, synced: r.value.savedAt }); if (st.dirty && locSaves()) await accountSend(); return; } } catch (e) { /* compare below */ }
        if (!st.dirty || plan.example || !locSaves()) { extrasBack(r.value.extras); return takePlan(r.value.plan, r.value.savedAt, r.changed, `${l.name}: opened the copy ${r.by ? 'saved by ' + r.by + ', ' : ''}${new Date(r.changed).toLocaleString()}`); }
        return locConflict({ by: r.by, changed: r.changed });
      }
      const r = await A.get('shiftcraft', accKey());
      if (!r || !r.plan) { if (!plan.example) await accountSend(); return; }
      if (r.savedAt === st.synced) { if (st.dirty) await accountSend(); return; }
      const take = () => (extrasBack(r.extras), takePlan(r.plan, r.savedAt, '', `Opened your account’s copy, saved ${new Date(r.savedAt).toLocaleString()}`));
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
    const pick = (x) => { if (accState().dirty && cur && locSaves()) accountSend(); setAcc({ loc: x ? { id: x.id, name: x.name, number: x.number || '', company: x.companyName || '', companyId: x.company || '', role: x.myRole, user: u.id } : null, base: '', synced: '', dirty: false }); viewTold = false; document.querySelectorAll('.backdrop').forEach(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))); accountCheck().then(render); };
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
        setAcc({ loc: { id: x.id, name: x.name, number: x.number || '', company: x.companyName || '', companyId: x.company || '', role: x.myRole, user: u.id }, base: '', synced: '', dirty: false }); viewTold = false; return accountCheck().then(render); }).catch(() => {}); }
    if (curLoc() || accState().asked === u.id) return; setAcc({ asked: u.id });
    A.api('GET', 'locations').then((r) => {
      if (!r.locations.length) return;
      const m = matchLocation(r.locations);
      if (m) { setAcc({ loc: { id: m.id, name: m.name, number: m.number || '', company: m.companyName || '', companyId: m.company || '', role: m.myRole, user: u.id }, base: '', synced: '', dirty: true, auto: true }); toast(`This schedule is ${m.companyName ? m.companyName + ' › ' : ''}${m.name}: linked to that location.`); return accountCheck().then(render); }
      chooseLocation();
    }).catch(() => {});
  }
  window.addEventListener('craft-account', () => {
    if (window.CraftAccount && CraftAccount.user() && CraftAccount.allowed && !CraftAccount.allowed('shiftcraft')) toast('Your account is not set up for ShiftCraft (ask the admin): it saves in this browser only.');
    askLocationOnce();
    accountCheck(); if (started) render();
  });
  window.addEventListener('focus', () => { if (Date.now() - accSeen > 60000) accountCheck(); });
