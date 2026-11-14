  // ===================================================================
  // Basics
  // ===================================================================
  const DAY_START = 4 * 60, DAY_END = 23 * 60, STEP = 15;
  const ROLES = {
    GM: { label: 'General Manager', short: 'GM', group: 'mgr' },
    AGM: { label: 'Assistant Manager', short: 'AGM', group: 'mgr' },
    SM: { label: 'Shift Manager', short: 'SM', group: 'sup' },
    TM: { label: 'Team Member', short: 'TM', group: 'tm' },
    NH: { label: 'New Hire', short: 'NH', group: 'trn' },
  };
  const GROUPS = [['mgr', 'Manager', 'GM, AGM'], ['sup', 'Supervisor', 'Shift Managers'], ['tm', 'Team Member', ''], ['trn', 'Training', 'New hires']];
  const KEY = 'shiftcraft-v1';
  const inFrame = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();

  const $ = (s, r = document) => r.querySelector(s);
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (typeof v !== 'string' && k in e) e[k] = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat(Infinity)) if (k != null && k !== false) e.append(k.nodeType ? k : String(k));
    return e;
  }
  const uid = () => Math.random().toString(36).slice(2, 10);
  const money = (n) => (n == null || isNaN(n) ? '—' : '$' + Math.round(n).toLocaleString());
  const hrs = (n) => (Math.round(n * 10) / 10).toFixed(1);
  const signed = (n) => (n > 0 ? '+' : '') + hrs(n);

  // Dates are 'YYYY-MM-DD' strings in local time.
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parseIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseIso(s); d.setDate(d.getDate() + n); return iso(d); };
  const mondayOf = (s) => { const d = parseIso(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return iso(d); };
  const dayName = (s, style = 'long') => parseIso(s).toLocaleDateString(undefined, { weekday: style });
  const longDate = (s) => parseIso(s).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  const shortDate = (s) => parseIso(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  // A month plan = the weeks whose Monday falls in that month. Every month has 4 or 5 Mondays.
  function monthInfo(ym) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
    const start = iso(d); let weeks = 0;
    while (d.getMonth() === m - 1) { weeks++; d.setDate(d.getDate() + 7); }
    return { start, weeks };
  }
  const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); };
  const usDate = (s) => { const d = parseIso(s); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`; };

  // Minutes after midnight <-> clock text
  // Minutes after midnight -> 6:00am / 2:30pm (always with minutes, easy to read)
  function clock(min) {
    const h24 = Math.floor(min / 60) % 24, m = min % 60;
    return `${h24 % 12 || 12}:${String(m).padStart(2, '0')}${h24 < 12 ? 'am' : 'pm'}`;
  }
  const span = (s) => `${clock(s.start)} – ${clock(s.end)}`;
  const len = (s) => (s.end - s.start) / 60;
  const snap = (m) => Math.round(m / STEP) * STEP;
  const clampShift = (s) => { s.start = Math.max(DAY_START, Math.min(DAY_END - STEP, s.start)); s.end = Math.max(s.start + STEP, Math.min(DAY_END, s.end)); return s; };
  // Time off reasons and states (used when a plan loads and by the Time off part, 19-time-off.js)
  const TIME_OFF_WHY = { vacation: 'Vacation', sick: 'Sick', personal: 'Personal', appointment: 'Appointment', family: 'Family', school: 'School', bereavement: 'Bereavement', jury: 'Jury duty', other: 'Other' };
  const TIME_OFF_STATUS = { requested: 'Requested', approved: 'Approved', denied: 'Denied' };
