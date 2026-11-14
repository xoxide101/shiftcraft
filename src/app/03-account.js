  // ===================================================================
  // Your account (AccountCraft): logged in, the whole plan is kept there as well (team, availability, schedules,
  // settings), so the office and home have the same one. Each change is sent a few seconds later; on opening (and when
  // the window comes back into view) a newer copy saved on another computer is taken, or, when this browser has
  // changes of its own too, you choose. Kept per location: 'shiftcraft' / 'plan <Company · Location>'.
  // ===================================================================
  const ACC = KEY + '-account';
  const accState = () => { try { return JSON.parse(localStorage.getItem(ACC)) || {}; } catch (e) { return {}; } };
  const setAcc = (o) => { try { localStorage.setItem(ACC, JSON.stringify({ ...accState(), ...o })); } catch (e) { /* blocked */ } };
  const accKey = () => ('plan ' + (placeName().replace(/[^\w.\- ]+/g, ' ').replace(/\s+/g, ' ').trim() || 'My store')).slice(0, 100);
  const CA = () => (window.CraftAccount && CraftAccount.user() && (!CraftAccount.allowed || CraftAccount.allowed('shiftcraft')) ? CraftAccount : null);
  let accT = 0, accBusy = false, accLast = '', accQuiet = false, accSeen = 0;
  function accountSoon(txt) {
    if (txt === accLast) return; accLast = txt;
    if (accQuiet || !CA() || plan.example) return;
    setAcc({ dirty: true }); clearTimeout(accT); accT = setTimeout(accountSend, 4000);
  }
  async function accountSend() {
    const A = CA(); if (!A || plan.example) return;
    const savedAt = new Date().toISOString();
    try { await A.put('shiftcraft', accKey(), { savedAt, plan }); setAcc({ synced: savedAt, dirty: false }); }
    catch (e) { if (e.status === 413) toast('This plan is too big for your account (over 4 MB): Settings › Clear old weeks.'); }
  }
  async function accountCheck() {
    const A = CA(); if (!A || accBusy) return; accBusy = true; accSeen = Date.now();
    try {
      const r = await A.get('shiftcraft', accKey()), st = accState();
      if (!r || !r.plan) { if (!plan.example) await accountSend(); return; }
      if (r.savedAt === st.synced) { if (st.dirty) await accountSend(); return; }
      const take = () => { snapshot(); const np = r.plan; normalize(np); accQuiet = true; plan = np; persist(); accQuiet = false; setAcc({ synced: r.savedAt, dirty: false }); render(); toast(`Opened your account’s copy, saved ${new Date(r.savedAt).toLocaleString()} (Undo brings back this browser’s).`); };
      if (!st.dirty || plan.example) return take();
      modal({ title: 'Your account has a newer copy', body: h('p', null, `Your account’s copy of ${placeName()} was saved ${new Date(r.savedAt).toLocaleString()} on another computer, and this browser has changes of its own since then. Which one do you want to keep?`),
        actions: [{ label: 'Keep this browser’s', onClick: () => { accountSend(); } }, { label: 'Open the account’s', primary: true, onClick: take }] });
    } catch (e) { /* not reachable now: tried again later */ } finally { accBusy = false; }
  }
  window.addEventListener('craft-account', () => { if (window.CraftAccount && CraftAccount.user() && CraftAccount.allowed && !CraftAccount.allowed('shiftcraft')) toast('Your account is not set up for ShiftCraft (ask the admin): it saves in this browser only.'); accountCheck(); if (started) render(); });
  window.addEventListener('focus', () => { if (Date.now() - accSeen > 60000) accountCheck(); });

