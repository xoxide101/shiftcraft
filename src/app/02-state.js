  // ===================================================================
  // State
  // ===================================================================
  function examplePlan() {
    const thisMonth = iso(new Date()).slice(0, 7);
    const { start, weeks: monthWeeks } = monthInfo(thisMonth);
    const staff = [
      ['Dana Whitfield', 'GM', 360, 900], ['Marcus Bell', 'AGM', 600, 1140], ['Priya Natarajan', 'SM', 360, 870], ['Leo Grant', 'SM', 840, 1380],
      ['Sofia Ramos', 'TM', 420, 900], ['Ethan Cole', 'TM', 600, 1020], ['Mia Thompson', 'TM', 960, 1380], ['Noah Patel', 'TM', 660, 1080],
      ['Ava Kim', 'TM', 1020, 1380], ['Jordan Price', 'TM', 480, 840], ['Chloe Martin', 'TM', 720, 1140], ['Ben Ortiz', 'TM', 900, 1320],
    ].map(([name, role, ds, de]) => ({ id: uid(), name, role, active: true, defStart: ds, defEnd: de, maxHours: role === 'TM' ? 32 : 45, notes: '' }));
    // Example past sales for the 4 weeks before the plan (made-up numbers).
    const pattern = [3550, 3300, 3320, 3990, 3980, 3650, 3160];
    const history = {};
    for (let i = 28; i >= 1; i--) { const d = addDays(start, -i); history[d] = Math.round(pattern[(parseIso(d).getDay() + 6) % 7] * (0.94 + ((i * 37) % 13) / 100)); }
    const plan = { app: 'ShiftCraft', version: 2, example: true, company: 'Example Co', location: 'Main Street', splh: 85, startDate: start, weeks: monthWeeks, month: thisMonth, staff, shifts: {}, forecast: {}, history };
    // Example schedule for the first day.
    const pick = (n) => staff.find((s) => s.name === n);
    plan.shifts[start] = [['Dana Whitfield', 360, 900], ['Priya Natarajan', 480, 960], ['Leo Grant', 960, 1380], ['Sofia Ramos', 420, 840], ['Ethan Cole', 660, 1020], ['Mia Thompson', 1020, 1380], ['Ava Kim', 1110, 1380]]
      .map(([n, s, e]) => ({ id: uid(), staffId: pick(n).id, start: s, end: e }));
    return plan;
  }
  let plan;
  try { plan = JSON.parse(localStorage.getItem(KEY)); } catch (e) { plan = null; }
  if (!plan || plan.app !== 'ShiftCraft') plan = examplePlan();
  normalize(plan);
  function normalize(p) {
    p.staff = p.staff || []; p.shifts = p.shifts || {}; p.forecast = p.forecast || {}; p.history = p.history || {};
    p.weeks = Math.min(8, Math.max(1, +p.weeks || 1));
    p.midStart = +p.midStart || 660; p.pmStart = +p.pmStart || 960; p.splh = +p.splh || 85;
    p.startDate = mondayOf(p.startDate || iso(new Date()));
    validatePlan(p);
    if (p.company == null && p.location == null) { p.company = ''; p.location = p.store || ''; }
    delete p.store;
  }
  function placeName() { return [plan.company, plan.location].filter(Boolean).join(' · ') || 'My store'; }
  const ui = { tab: 'schedule', day: plan.startDate, fileHandle: null, fileName: '' };
  try { const u = JSON.parse(localStorage.getItem(KEY + '-ui') || '{}'); if (u.tab) ui.tab = u.tab; if (u.day) ui.day = u.day; } catch (e) { /* ignore */ }

  const undoStack = [];
  function snapshot() { undoStack.push(JSON.stringify(plan)); if (undoStack.length > 60) undoStack.shift(); }
  function undo() {
    const s = undoStack.pop(); if (!s) { toast('Nothing to undo'); return; }
    plan = JSON.parse(s); persist(); render(); toast('Undone');
  }
  // Call before changing the plan; persists afterwards.
  function change(fn, { keepUndo = false } = {}) { if (!keepUndo) snapshot(); fn(); persist(); render(); }
  // Another ShiftCraft tab or window changed the plan: take its version, so an older tab never saves or
  // writes back out-of-date information.
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try { const np = JSON.parse(e.newValue); normalize(np); plan = np; document.querySelectorAll('.backdrop').forEach(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))); render(); toast('Updated with changes made in another ShiftCraft tab'); } catch (err) { /* ignore */ }
  });
  let storageWarned = false;
  function persist() {
    const txt = JSON.stringify(plan);
    try { localStorage.setItem(KEY, txt); localStorage.setItem(KEY + '-ui', JSON.stringify({ tab: ui.tab, day: ui.day })); storageWarned = false; }
    catch (e) {
      if (!storageWarned) { storageWarned = true; setTimeout(() => toast('This browser’s storage is full, so the last change was not remembered. Use File › Save all weeks, then Settings › Clear old weeks.'), 0); }
    }
    try { accountSoon(txt); } catch (e) { /* (before the account part has started) */ }
  }
  const storageKB = () => { try { return Math.round(JSON.stringify(plan).length / 1024); } catch (e) { return 0; } };

