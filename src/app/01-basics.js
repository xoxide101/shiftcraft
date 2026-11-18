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
  // Small icon buttons for the rows of tables, one matching set; the title is the hover explanation (and the screen-reader name)
  const ROW_ICONS = {
    tasks: '<path d="m4 6 1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M11 6h9M11 12h9M11 18h9"/>',
    timeoff: '<rect x="3" y="5" width="18" height="16" rx="2" class="fill"/><path d="M3 10h18M8 3v4M16 3v4M9.5 13.5l5 5M14.5 13.5l-5 5"/>',
    print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2" class="fill"/><path d="M7 14h10v7H7Z"/>',
    left: '<path d="M13 4H5v16h8" class="fill"/><path d="M10 12h11M17 8l4 4-4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    addTime: '<circle cx="10" cy="12" r="7" class="fill"/><path d="M10 8v4l2.5 1.5M19 4v6M16 7h6"/>',
    wand: '<path d="m4 20 11-11"/><path d="m13 7 2-2 4 4-2 2Z" class="fill"/><path d="M19 3v3M17.5 4.5h3M7 4v2M6 5h2"/>',
    clear: '<path d="m7 21-4-4 10-10 8 8-6 6Z" class="fill"/><path d="M11 9l6 6M7 21h13"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16Z" class="fill"/><path d="m13 7 4 4"/>',
    rehire: '<circle cx="10" cy="8" r="4" class="fill"/><path d="M3 21c1-4 3.8-6 7-6s4.5 1 5.5 2.5M19 13v7M15.5 16.5h7"/>',
    approve: '<path d="m5 12 4 4 10-10"/>',
    event: '<rect x="3" y="5" width="18" height="16" rx="2" class="fill"/><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>',
    appt: '<circle cx="12" cy="13" r="8" class="fill"/><path d="M12 9v4l3 2M9 3h6"/>',
    store: '<path d="M4 10v10h16V10" class="fill"/><path d="M3 10l2-6h14l2 6ZM9 20v-6h6v6"/>',
    deny: '<path d="M6 6l12 12M18 6 6 18"/>',
    qr: '<path d="M4 4h6v6H4ZM14 4h6v6h-6ZM4 14h6v6H4Z" class="fill"/><path d="M14 14h2v2M20 14v2M14 20h2M18 18h2v2M17 17h0"/>',
  };
  // ib('trash', 'Remove Dana', () => ..., { cls: 'danger', badge: 3, disabled })
  function ib(icon, title, onclick, o = {}) {
    const b = h('button', { type: 'button', class: 'ib' + (o.cls ? ' ' + o.cls : ''), title, 'aria-label': title, disabled: !!o.disabled, onclick });
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ROW_ICONS[icon] || ''}</svg>`;
    if (o.badge) b.append(h('span', { class: 'ib-badge' }, o.badge === true ? '' : String(o.badge)));
    return b;
  }
  const ibs = (...btns) => h('div', { class: 'ibs' }, btns);
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
  const TIME_OFF_HOW = { person: 'In person', phone: 'Phone call', text: 'Text message', email: 'Email', form: 'Request form', other: 'Other' };
